import { Prisma, RentalOrderStatus, RentalFinancialStatus } from '@prisma/client'
import { PrismaRentalOrderAdapter } from './prisma-rental-order.adapter'

describe('PrismaRentalOrderAdapter rental payment and ownership', () => {
  const findUnique = jest.fn()
  const adapter = new PrismaRentalOrderAdapter(
    { rentalOrder: { findUnique } } as never,
    {} as never,
  )

  beforeEach(() => {
    findUnique.mockReset()
  })

  it('does not let a LEADER inspect another user rental order', async () => {
    findUnique.mockResolvedValue({ id: 'order-1', userId: 'owner-1' })

    await expect(
      adapter.getOrder({
        orderId: 'order-1',
        actorUserId: 'leader-2',
        actorRole: 'LEADER',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('explains deposit using order snapshots even when catalog values have changed', async () => {
    const now = new Date('2026-10-18T10:00:00.000Z')
    findUnique.mockResolvedValue({
      id: 'order-1', userId: 'user-1', status: 'PAID', financialStatus: 'PAID',
      rentalFee: new Prisma.Decimal(100), totalDeposit: new Prisma.Decimal(1500000),
      totalAmount: new Prisma.Decimal(1500100), currency: 'VND',
      paymentExpiresAt: now, rentalStartAt: now, rentalEndAt: now, occupiedEndAt: now, createdAt: now, policySnapshot: {},
      invoicesViaRentalOrderId: [],
      rentalOrderLinesViaOrderId: [{
        id: 'line-1', productId: 'p1', quantity: 2, chargedDays: 1,
        product: { name: 'Tent', replacementValue: 9000000 },
        dailyPriceSnapshot: new Prisma.Decimal(50), depositPerUnitSnapshot: new Prisma.Decimal(750000),
        replacementValueSnapshot: new Prisma.Decimal(2500000),
        lineRentalFee: new Prisma.Decimal(100), lineDeposit: new Prisma.Decimal(1500000),
        rentalUnitAssignmentsViaOrderLineId: [], rentalQuantityReservationsViaOrderLineId: [],
      }],
    })
    const result = await adapter.getOrder({ orderId: 'order-1', actorUserId: 'user-1', actorRole: 'USER' })
    expect(result.items).toEqual([expect.objectContaining({
      depositPerUnit: 750000, replacementValue: 2500000, depositAmount: 1500000,
      depositExplanation: { percentageOfReplacementValue: 30, formula: 'depositPerUnit / replacementValue * 100' },
    })])
  })

  it('returns the authoritative payment, application, reconciliation, and order states', async () => {
    findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'PAID',
      financialStatus: 'PAID',
      paymentExpiresAt: new Date('2026-10-18T10:00:00.000Z'),
      totalAmount: new Prisma.Decimal(150000),
      invoicesViaRentalOrderId: [
        {
          status: 'PAID',
          paymentsViaInvoiceId: [
            {
              id: 'payment-1',
              status: 'SUCCEEDED',
              amount: new Prisma.Decimal(150000),
              paidAt: new Date('2026-10-18T09:00:00.000Z'),
              reconcileStatus: 'SUCCEEDED',
              paymentGateway: 'vnpay',
              providerEnvironment: 'SANDBOX',
              paymentMethod: 'REDIRECT',
              application: { status: 'APPLIED', reasonCode: null },
            },
          ],
        },
      ],
      refundsViaRentalOrderId: [],
    })

    await expect(adapter.getPayment({ orderId: 'order-1', userId: 'user-1' })).resolves.toMatchObject({
      paymentRef: 'payment-1',
      status: 'SUCCEEDED',
      invoiceStatus: 'PAID',
      applicationStatus: 'APPLIED',
      reconciliationStatus: 'SUCCEEDED',
      reconciliationRequired: false,
      gateway: 'vnpay',
      providerEnvironment: 'SANDBOX',
      paymentMethod: 'REDIRECT',
      orderStatus: 'PAID',
      financialStatus: 'PAID',
      amount: 150000,
      paidAt: '2026-10-18T09:00:00.000Z',
    })
  })

  describe('processPaymentEvent: exact source matching, revoked check, and late payment refund', () => {
    let mockPrisma: any
    let paymentAdapter: PrismaRentalOrderAdapter
    let mockTx: any

    const paymentDate = new Date('2026-10-18T09:00:00.000Z')
    const futureExpires = new Date(Date.now() + 3_600_000)
    const pastExpires = new Date(Date.now() - 3_600_000)
    const originalPrimary = process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID
    const testLocationId = '11111111-1111-4111-8111-111111111111'

    afterEach(() => {
      process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = originalPrimary
    })

    beforeEach(() => {
      process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = testLocationId
      mockTx = {
        payment: {
          findUnique: jest.fn(),
          update: jest.fn().mockResolvedValue({ id: 'pay-1' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        paymentWebhookEvent: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'evt-rec-1' }),
          update: jest.fn().mockResolvedValue({ id: 'evt-rec-1' }),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'mock' }]),
        rentalOrder: {
          findUnique: jest.fn(),
          update: jest.fn().mockResolvedValue({ id: 'ord-1' }),
        },
        rentalOrderLine: {
          findMany: jest.fn().mockResolvedValue([{ id: 'line-1' }]),
        },
        rentalExtensionRequest: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        invoice: {
          update: jest.fn().mockResolvedValue({ id: 'inv-1' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue([{ id: 'inv-1' }]),
        },
        rentalQuantityReservation: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        inventoryTask: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'task-1' }),
        },
        inventoryLocation: {
          findFirst: jest.fn().mockResolvedValue({ id: testLocationId, status: 'ACTIVE', isPrimary: true }),
          findUnique: jest.fn().mockResolvedValue({ id: testLocationId, status: 'ACTIVE', isPrimary: true }),
        },
        refund: {
          upsert: jest.fn().mockResolvedValue({ id: 'ref-1', amount: new Prisma.Decimal(100000) }),
        },
        rentalOutboxEvent: {
          upsert: jest.fn().mockResolvedValue({ id: 'out-1' }),
        },
        trip: {
          findUnique: jest.fn(),
        },
        bookingParticipant: {
          findUnique: jest.fn(),
        },
        booking: {
          findUnique: jest.fn(),
        },
        tripMember: {
          findUnique: jest.fn(),
        },
      }

      mockPrisma = {
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'pay-1',
            invoiceId: 'inv-1',
            invoice: { rentalOrder: { userId: 'user-1', tripId: 'trip-1' } },
          }),
        },
        rentalExtensionRequest: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
      }

      paymentAdapter = new PrismaRentalOrderAdapter(mockPrisma as never, {} as never)
    })

    it('exact source match: order with PUBLIC_PARTICIPANT and valid source version is confirmed', async () => {
      mockTx.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        paymentGateway: 'vnpay',
        amount: new Prisma.Decimal(100000),
        currency: 'VND',
        transactionRef: 'tx-1',
        invoice: { rentalOrderId: 'ord-1' },
      })

      mockTx.rentalOrder.findUnique.mockResolvedValue({
        id: 'ord-1',
        userId: 'user-1',
        tripId: 'trip-1',
        bookingId: 'book-1',
        membershipKind: 'PUBLIC_PARTICIPANT',
        membershipRef: 'part-1',
        membershipSourceVersion: 3,
        status: RentalOrderStatus.PENDING_PAYMENT,
        financialStatus: RentalFinancialStatus.UNPAID,
        paymentExpiresAt: futureExpires,
        rentalOrderLinesViaOrderId: [{ id: 'line-1' }],
        plannedHandoverAt: new Date('2026-10-20T06:00:00Z'),
        version: 1,
      })

      mockTx.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        status: 'OPEN',
        tripType: 'PUBLIC',
        leaderId: 'leader-1',
        version: 1,
      })

      mockTx.bookingParticipant.findUnique.mockResolvedValue({
        id: 'part-1',
        userId: 'user-1',
        status: 'ACTIVE',
        bookingId: 'book-1',
        booking: {
          id: 'book-1',
          tripId: 'trip-1',
          status: 'CONFIRMED',
          version: 3,
        },
      })

      await paymentAdapter.processPaymentEvent({
        eventId: 'evt-1',
        paymentRef: 'pay-1',
        status: 'SUCCEEDED',
        amount: '100000',
        currency: 'VND',
        providerRef: 'prov-tx-1',
      })

      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: expect.objectContaining({
            status: RentalOrderStatus.PAID,
            financialStatus: RentalFinancialStatus.PAID,
          }),
        }),
      )
      expect(mockTx.rentalQuantityReservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CONFIRMED',
          }),
        }),
      )
    })

    it('revoked-before-payment: participant status revoked -> triggers late/revoked refund and expires order', async () => {
      mockTx.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        paymentGateway: 'vnpay',
        amount: new Prisma.Decimal(100000),
        currency: 'VND',
        transactionRef: 'tx-1',
        invoice: { rentalOrderId: 'ord-1' },
      })

      mockTx.rentalOrder.findUnique.mockResolvedValue({
        id: 'ord-1',
        userId: 'user-1',
        tripId: 'trip-1',
        bookingId: 'book-1',
        membershipKind: 'PUBLIC_PARTICIPANT',
        membershipRef: 'part-1',
        membershipSourceVersion: 3,
        status: RentalOrderStatus.PENDING_PAYMENT,
        financialStatus: RentalFinancialStatus.UNPAID,
        paymentExpiresAt: futureExpires,
        rentalOrderLinesViaOrderId: [{ id: 'line-1' }],
        plannedHandoverAt: new Date('2026-10-20T06:00:00Z'),
        version: 1,
      })

      mockTx.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        status: 'OPEN',
        tripType: 'PUBLIC',
        leaderId: 'leader-1',
        version: 1,
      })

      // Participant was revoked (status: CANCELLED) before payment processed
      mockTx.bookingParticipant.findUnique.mockResolvedValue({
        id: 'part-1',
        userId: 'user-1',
        status: 'CANCELLED',
        bookingId: 'book-1',
        booking: {
          id: 'book-1',
          tripId: 'trip-1',
          status: 'CONFIRMED',
          version: 4,
        },
      })

      await paymentAdapter.processPaymentEvent({
        eventId: 'evt-2',
        paymentRef: 'pay-1',
        status: 'SUCCEEDED',
        amount: '100000',
        currency: 'VND',
        providerRef: 'prov-tx-2',
      })

      // Order should be marked REFUND_PENDING and refund upserted with reason LATE_PAYMENT_EXPIRED_ORDER
      expect(mockTx.refund.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            reason: 'LATE_PAYMENT_EXPIRED_ORDER',
            rentalOrderId: 'ord-1',
          }),
        }),
      )
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: expect.objectContaining({
            financialStatus: RentalFinancialStatus.REFUND_PENDING,
          }),
        }),
      )
    })

    it('late payment refund: payment arrived after order.paymentExpiresAt -> triggers refund', async () => {
      mockTx.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        paymentGateway: 'vnpay',
        amount: new Prisma.Decimal(100000),
        currency: 'VND',
        transactionRef: 'tx-1',
        invoice: { rentalOrderId: 'ord-1' },
      })

      // Order expired in the past
      mockTx.rentalOrder.findUnique.mockResolvedValue({
        id: 'ord-1',
        userId: 'user-1',
        tripId: 'trip-1',
        bookingId: 'book-1',
        membershipKind: 'PUBLIC_PARTICIPANT',
        membershipRef: 'part-1',
        membershipSourceVersion: 1,
        status: RentalOrderStatus.PENDING_PAYMENT,
        financialStatus: RentalFinancialStatus.UNPAID,
        paymentExpiresAt: pastExpires,
        rentalOrderLinesViaOrderId: [{ id: 'line-1' }],
        plannedHandoverAt: new Date('2026-10-20T06:00:00Z'),
        version: 1,
      })

      mockTx.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        status: 'OPEN',
        tripType: 'PUBLIC',
        leaderId: 'leader-1',
        version: 1,
      })

      mockTx.bookingParticipant.findUnique.mockResolvedValue({
        id: 'part-1',
        userId: 'user-1',
        status: 'ACTIVE',
        bookingId: 'book-1',
        booking: {
          id: 'book-1',
          tripId: 'trip-1',
          status: 'CONFIRMED',
          version: 1,
        },
      })

      await paymentAdapter.processPaymentEvent({
        eventId: 'evt-3',
        paymentRef: 'pay-1',
        status: 'SUCCEEDED',
        amount: '100000',
        currency: 'VND',
        providerRef: 'prov-tx-3',
      })

      expect(mockTx.refund.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            reason: 'LATE_PAYMENT_EXPIRED_ORDER',
            rentalOrderId: 'ord-1',
          }),
        }),
      )
    })
  })
})
