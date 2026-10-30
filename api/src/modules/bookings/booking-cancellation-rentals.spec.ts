jest.mock('@nestjs/schedule', () => ({ Interval: () => () => {} }))
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { BookingCancellationService } from './booking-cancellation.service'
import { PrismaService } from '../../shared/services/prisma.service'
import { PaymentsPort } from '../payments/payments.port'
import { AppError, GlobalErrorFilter } from '../../shared/errors'
import { Controller, Post } from '@nestjs/common'
import { paymentHash } from '../payments/payment-utils'
import { Prisma } from '@prisma/client'

const input = { bookingId: 'booking', actorId: 'owner', actorRole: 'USER', idempotencyKey: 'cancel-1', reason: 'Changed plans' }
function setup() {
  const booking = { id: 'booking', tripId: 'trip', userId: 'owner', status: 'PENDING_PAYMENT', expiresAt: new Date('2099-01-01'), trip: { creatorId: 'host', status: 'OPEN', startAt: new Date('2099-01-01') } }
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ now: new Date('2026-01-01') }]),
    booking: { findUnique: jest.fn().mockResolvedValue(booking), findUniqueOrThrow: jest.fn().mockResolvedValue(booking), update: jest.fn() },
    bookingParticipant: { findMany: jest.fn().mockResolvedValue([{ id: 'participant' }]) },
    rentalOrder: { findMany: jest.fn().mockResolvedValue([]) },
    bookingCancellation: { findUnique: jest.fn().mockResolvedValue(null) },
  }
  const db = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) }
  return { service: new BookingCancellationService(db as unknown as PrismaService, {} as PaymentsPort), tx }
}
describe('Voluntary booking cancellation rental prerequisite', () => {
  it('blocks before any booking mutation and masks rentals owned by another participant', async () => {
    const { service, tx } = setup()
    tx.rentalOrder.findMany.mockResolvedValue([{ id: 'secret', status: 'ACTIVE', userId: 'other' }] as never)
    await expect(service.cancel(input)).rejects.toMatchObject({ code: 'RELATED_RENTALS_REQUIRE_RESOLUTION', details: { rentals: [{ orderId: null, ownedByViewer: false, status: 'ACTIVE' }] } })
    expect(tx.booking.update).not.toHaveBeenCalled()
    expect(tx.rentalOrder.findMany.mock.calls[0][0]).toMatchObject({ where: { status: { notIn: ['CANCELLED', 'EXPIRED', 'COMPLETED'] }, OR: expect.arrayContaining([{ bookingId: 'booking' }, { membershipKind: 'PUBLIC_PARTICIPANT', membershipRef: { in: ['participant'] } }]) } })
  })
  it('allows a preview with no unresolved rentals without waiting for refund completion', async () => {
    const { service } = setup()
    await expect(service.preview('booking', 'owner')).resolves.toMatchObject({ canCancel: true, rentals: [], refundableAmount: '0' })
  })
  it('does not disclose a preview to someone other than the buyer', async () => {
    const { service, tx } = setup()
    await expect(service.preview('booking', 'other')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(tx.rentalOrder.findMany).not.toHaveBeenCalled()
  })
  it('preserves successful idempotent replay without rechecking rentals', async () => {
    const { service, tx } = setup()
    tx.bookingCancellation.findUnique.mockResolvedValue({ bookingId: 'booking', id: 'cancellation', refundableAmount: new Prisma.Decimal(0), policySnapshot: { decision: { requestHash: paymentHash({ bookingId: input.bookingId, reason: input.reason }) } } } as never)
    await expect(service.cancel(input)).resolves.toMatchObject({ status: 'CANCELLED', cancellationId: 'cancellation' })
    expect(tx.rentalOrder.findMany).not.toHaveBeenCalled()
  })
  it('serializes the business failure through GlobalErrorFilter as HTTP 409', async () => {
    @Controller('test-cancellation')
    class TestController {
      @Post()
      cancel() { throw AppError.fromCode('RELATED_RENTALS_REQUIRE_RESOLUTION', { details: { rentals: [] } }) }
    }
    const module = await Test.createTestingModule({ controllers: [TestController] }).compile()
    const app = module.createNestApplication()
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
    try {
      const result = await request(app.getHttpServer()).post('/test-cancellation').expect(409)
      expect(result.body.error).toMatchObject({ code: 'RELATED_RENTALS_REQUIRE_RESOLUTION', retryable: false, details: { rentals: [] } })
      expect(result.body.meta.requestId).toBeTruthy()
    } finally { await app.close() }
  })
})
