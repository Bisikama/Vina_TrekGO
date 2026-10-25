import { Prisma } from '@prisma/client'
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
})
