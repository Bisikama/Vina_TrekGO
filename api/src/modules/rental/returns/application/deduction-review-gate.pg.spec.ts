import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { deductionReviewGate } from './deduction-review-gate'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.TEST_DATABASE_URL
if (url && (url === process.env.DATABASE_URL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname) || !/test/i.test(new URL(url).pathname)))
  throw new Error('TEST_DATABASE_URL must identify a separate local test database')

const suite = url ? describe : describe.skip
suite('deposit review gate against PostgreSQL', () => {
  let pool: Pool
  let db: PrismaClient
  beforeAll(async () => { pool = new Pool({ connectionString: url }); db = new PrismaClient({ adapter: new PrismaPg(pool) }); await db.$connect() })
  afterAll(async () => { await db?.$disconnect(); await pool?.end() })

  it('keeps a published deduction on hold for an open dispute and releases it after resolution and 48 hours', async () => {
    const rollback = new Error('ROLLBACK_TEST_FIXTURE')
    await expect(db.$transaction(async tx => {
      const columns = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint AS count FROM information_schema.columns WHERE table_name='rental_exception_cases' AND column_name='evidence_access_blocked_at'`
      if (columns[0].count === 0n) await tx.$executeRawUnsafe(readFileSync(join(process.cwd(), 'prisma/migrations/20261101120000_rental_evidence_access_recovery/migration.sql'), 'utf8'))
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica')
      const orderId = randomUUID(), inspectionId = randomUUID(), assignmentId = randomUUID()
      const start = new Date('2026-10-01T00:00:00.000Z')
      const published = await tx.rentalExceptionCase.create({ data: { orderId, inspectionId, assignmentId,
        caseType: 'DAMAGE_DISPUTE', status: 'RESOLVED', reason: 'approved', evidenceAccessibleAt: start } })
      const dispute = await tx.rentalExceptionCase.create({ data: { orderId, inspectionId, assignmentId,
        caseType: 'DAMAGE_DISPUTE', status: 'UNDER_REVIEW', reason: 'customer dispute' } })
      const input = { orderId, inspectionId, assignmentId, reviewMinutes: 2880, now: new Date('2026-10-03T00:00:00.000Z') }
      expect(await deductionReviewGate(tx, input)).toBe('USER_DISPUTE_MUST_BE_RESOLVED')
      await tx.rentalExceptionCase.update({ where: { id: dispute.id }, data: { status: 'RESOLVED' } })
      expect(await deductionReviewGate(tx, { ...input, now: new Date(input.now.getTime() - 1) })).toBe('USER_48H_REVIEW_WINDOW_NOT_CLOSED')
      expect(await deductionReviewGate(tx, input)).toBeNull()
      await tx.rentalExceptionCase.update({ where: { id: published.id }, data: { evidenceAccessBlockedAt: input.now } })
      expect(await deductionReviewGate(tx, input)).toBe('EVIDENCE_ACCESS_INTERRUPTED')
      const restoredAt = new Date('2026-10-03T12:00:00.000Z')
      const newDue = new Date(restoredAt.getTime() + 48 * 3600_000)
      await tx.rentalExceptionCase.update({ where: { id: published.id }, data: { evidenceAccessBlockedAt: null, evidenceAccessibleAt: restoredAt, dueAt: newDue } })
      expect(await deductionReviewGate(tx, { ...input, now: new Date(newDue.getTime() - 1) })).toBe('USER_48H_REVIEW_WINDOW_NOT_CLOSED')
      expect(await deductionReviewGate(tx, { ...input, now: newDue })).toBeNull()
      throw rollback
    })).rejects.toBe(rollback)
  })
})
