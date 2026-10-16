import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { SharedModule } from '../src/shared/shared.module'
import { PaymentsModule } from '../src/modules/payments/payments.module'
import { PrismaService } from '../src/shared/services/prisma.service'
import { SupabaseService } from '../src/shared/services/supabase.service'
import { PaymentProvider } from '../src/modules/payments/payment-provider.port'
import { MockPaymentProvider } from '../src/modules/payments/mock-payment.provider'
import { PaymentEventsWorker } from '../src/modules/payments/payment-events.worker'
import { GlobalErrorFilter } from '../src/shared/errors'

const url = process.env.CF02_TEST_DATABASE_URL
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !/^\/cf02_test_[a-z0-9_]+$/.test(new URL(url).pathname)
)
  throw new Error('Isolated localhost cf02_test_* DB required')
const run = promisify(execFile)
describe('CF02 seed and mock helper acceptance', () => {
  const db = new PrismaClient({ datasourceUrl: url })
  const batch = `acceptance_${randomUUID().slice(0, 8)}`
  const secret = 'cf02-seed-acceptance-only-secret-32-characters'
  let app: INestApplication, userId: string, leaderId: string, base: string
  let seeded: { destinationId: string; trips: { id: string; scenario: string }[] }
  const previousSecret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET
  const cli = (file: string, args: string[]) =>
    run(process.execPath, [require.resolve('ts-node/dist/bin.js'), file, ...args], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        DATABASE_URL: url,
        DIRECT_URL: url,
        PAYMENT_PROVIDER: 'mock',
        PAYMENT_MOCK_WEBHOOK_SECRET: secret,
      },
      timeout: 60000,
    })
  beforeAll(async () => {
    process.env.PAYMENT_MOCK_WEBHOOK_SECRET = secret
    leaderId = (
      await db.user.create({
        data: { authUserId: randomUUID(), email: `${randomUUID()}@seed.test`, fullName: 'Seed Leader', role: 'LEADER' },
      })
    ).id
    const user = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@seed.test`, fullName: 'Seed Booker' },
    })
    userId = user.id
    const destination = await db.destination.create({ data: { name: 'Seed schedule blocker' } })
    await db.trip.create({
      data: {
        tripType: 'PUBLIC',
        creatorId: leaderId,
        leaderId,
        destinationId: destination.id,
        title: 'Existing leader trip',
        startAt: new Date(Date.now() + 115 * 3600000),
        endAt: new Date(Date.now() + 130 * 3600000),
        maxPax: 10,
        status: 'OPEN',
        publishedAt: new Date(),
      },
    })
    const module = await Test.createTestingModule({ imports: [SharedModule, PaymentsModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(SupabaseService)
      .useValue({
        verifyToken: (token: string) =>
          Promise.resolve(token === userId ? { id: user.authUserId, email: user.email } : null),
      })
      .overrideProvider(PaymentProvider)
      .useValue(new MockPaymentProvider(db as unknown as PrismaService))
      .compile()
    app = module.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.listen(0, '127.0.0.1')
    base = await app.getUrl()
  })
  afterAll(async () => {
    await app?.close()
    await db.$disconnect()
    if (previousSecret === undefined) delete process.env.PAYMENT_MOCK_WEBHOOK_SECRET
    else process.env.PAYMENT_MOCK_WEBHOOK_SECRET = previousSecret
  })

  it('dry-runs without writes, seeds complete public trips, and repeats without changing dates or creating bookings', async () => {
    const args = [`--leader-id=${leaderId}`, `--batch=${batch}`]
    const before = await db.trip.count()
    const dry = JSON.parse((await cli('prisma/seeds/cf02-public-trips.seed.ts', [...args, '--dry-run'])).stdout)
    expect(dry.action).toBe('WOULD_CREATE')
    expect(await db.trip.count()).toBe(before)
    seeded = JSON.parse((await cli('prisma/seeds/cf02-public-trips.seed.ts', args)).stdout)
    expect(seeded.trips).toHaveLength(6)
    const allTrips = await db.trip.findMany({ where: { leaderId }, orderBy: { startAt: 'asc' } })
    for (let i = 1; i < allTrips.length; i++)
      expect(allTrips[i].startAt.getTime()).toBeGreaterThanOrEqual(allTrips[i - 1].endAt.getTime())
    const repeated = JSON.parse((await cli('prisma/seeds/cf02-public-trips.seed.ts', args)).stdout)
    expect(repeated.action).toBe('UNCHANGED')
    expect(repeated.trips).toEqual(seeded.trips)
    expect(await db.booking.count({ where: { tripId: { in: seeded.trips.map((t) => t.id) } } })).toBe(0)
    const listing = await request(app.getHttpServer())
      .get(`/api/v1/trips?destinationId=${seeded.destinationId}`)
      .expect(200)
    expect(listing.body.total).toBe(6)
    for (const item of listing.body.items) {
      expect(item.status).toBe('OPEN')
      expect(item.routes).toHaveLength(1)
      expect(item.checkpoints).toHaveLength(2)
      expect(item.transportAvailable).toBe(true)
    }
  }, 120000)

  it('uses actual checkout and signed mock webhook to confirm exactly once, preserving results on rerun', async () => {
    const tripId = seeded.trips.find((t) => t.scenario === 'MOCK')!.id
    const booking = (
      await request(app.getHttpServer())
        .post(`/api/v1/trips/${tripId}/bookings`)
        .set('Authorization', `Bearer ${userId}`)
        .set('Idempotency-Key', randomUUID())
        .send({ participantCount: 2, participants: [{ fullName: 'Demo A' }, { fullName: 'Demo B' }] })
        .expect(201)
    ).body
    const payment = (
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${booking.id}/payments`)
        .set('Authorization', `Bearer ${userId}`)
        .set('Idempotency-Key', randomUUID())
        .send({ paymentMethod: 'REDIRECT' })
        .expect(201)
    ).body
    expect(payment.amount).toBe('20000')
    for (let i = 0; i < 2; i++) {
      await cli('scripts/cf02-mock-payment.ts', [`--payment-id=${payment.paymentId}`, `--base-url=${base}`])
      await app.get(PaymentEventsWorker).tick()
    }
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED')
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: booking.id, eventType: 'BOOKING_CONFIRMED' } }),
    ).toBe(1)
    await cli('prisma/seeds/cf02-public-trips.seed.ts', [`--leader-id=${leaderId}`, `--batch=${batch}`])
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED')
    await db.payment.update({
      where: { id: payment.paymentId },
      data: { paymentGateway: 'momo', providerEnvironment: 'SANDBOX' },
    })
    await expect(
      cli('scripts/cf02-mock-payment.ts', [`--payment-id=${payment.paymentId}`, `--base-url=${base}`]),
    ).rejects.toMatchObject({ stderr: expect.stringContaining('non-MOCK') })
  }, 120000)
})
