import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { canonicalPolicy, PUBLIC_BOOKING_POLICY_CODE as CODE } from '../src/modules/bookings/booking-policy'

// Privileged deployment tool, not an HTTP endpoint. Values must be explicitly approved by the operator.
const content = canonicalPolicy({
  holdTtlMinutes: Number(process.env.CF02_HOLD_TTL_MINUTES),
  cancellationRules: JSON.parse(process.env.CF02_CANCELLATION_RULES ?? 'null'),
})
if (process.env.CF02_POLICY_CODE && process.env.CF02_POLICY_CODE !== CODE)
  throw new Error(`Policy code must be ${CODE}`)
const db = new PrismaClient()
async function main() {
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('booking-policy:PUBLIC_BOOKING_DEFAULT', 0))::text`
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`
    const versions = await tx.bookingPolicy.findMany({ where: { policyCode: CODE }, orderBy: { versionNo: 'desc' } })
    const current = versions.filter(
      (p) => p.publishedAt && p.isActive && p.effectiveFrom <= now && (!p.effectiveTo || p.effectiveTo > now),
    )
    if (
      current.length > 1 ||
      versions.some((p) => p.publishedAt && (p.effectiveFrom >= now || (p.effectiveTo && p.effectiveTo > now)))
    )
      throw new Error('Ambiguous or scheduled policy; reconcile explicitly before publishing')
    if (current.length === 1) {
      try {
        if (
          JSON.stringify(
            canonicalPolicy({
              holdTtlMinutes: current[0].holdTtlMinutes,
              cancellationRules: current[0].cancellationRules as typeof content.cancellationRules,
            }),
          ) === JSON.stringify(content)
        )
          return { changed: false, id: current[0].id, versionNo: current[0].versionNo }
      } catch {
        /* Invalid legacy content can be replaced, never silently edited. */
      }
    }
    const versionNo = (versions[0]?.versionNo ?? 0) + 1
    if (process.argv.includes('--dry-run'))
      return { dryRun: true, policyCode: CODE, versionNo, ...content, retireIds: current.map((p) => p.id) }
    await tx.bookingPolicy.updateMany({
      where: { policyCode: CODE, isActive: true, publishedAt: { not: null }, effectiveTo: null },
      data: { effectiveTo: now },
    })
    const row = await tx.bookingPolicy.create({
      data: { ...content, policyCode: CODE, versionNo, effectiveFrom: now, publishedAt: now, isActive: true },
    })
    await tx.auditLog.create({
      data: {
        action: 'BOOKING_POLICY_PUBLISHED',
        entityType: 'BookingPolicy',
        entityId: row.id,
        newValues: { source: 'DEPLOYMENT_SCRIPT', versionNo, effectiveFrom: now.toISOString(), ...content },
      },
    })
    return { changed: true, id: row.id, policyCode: CODE, versionNo }
  })
  console.log(JSON.stringify(result))
}
main()
  .catch(() => {
    console.error('Policy publication failed; verify policy inputs, intervals and database access.')
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
