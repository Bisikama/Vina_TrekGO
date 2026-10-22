import { Prisma } from '@prisma/client'
import { PaymentWebhooksService } from './payment-webhooks.service'

function cancelledPaymentFixture(invoiceType: 'RENTAL' | 'BOOKING') {
  const event = {
    kind: 'PAYMENT', gateway: 'momo', environment: 'MOCK', merchantAccountKey: 'merchant-1',
    providerEventId: 'provider-event-1', merchantRequestRef: 'request-1',
    transactionRef: null, status: 'SUCCEEDED', amount: '150', currency: 'VND',
    occurredAt: '2026-10-20T08:00:00Z',
  }
  const inbox = {
    id: 'inbox-1', eventKind: 'PAYMENT', payload: event,
    paymentGateway: 'momo', providerEnvironment: 'MOCK', merchantAccountKey: 'merchant-1',
    verifiedAt: new Date('2026-10-20T08:00:00Z'), processingStatus: 'RECEIVED',
  }
  const payment = {
    id: 'payment-1', invoiceId: 'invoice-1', status: 'CANCELLED',
    amount: new Prisma.Decimal(150), currency: 'VND', transactionRef: null,
    reconcileStatus: 'SCHEDULED', invoice: { invoiceType },
  }
  const tx: any = {
    $queryRaw: jest.fn(async (parts: TemplateStringsArray) =>
      parts[0].includes('payment_webhook_events') ? [{ id: inbox.id, attemptCount: 0, now: new Date() }] : []),
    paymentWebhookEvent: { findUnique: jest.fn().mockResolvedValue(inbox), update: jest.fn() },
    payment: {
      findFirst: jest.fn().mockResolvedValue(payment), findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
      update: jest.fn(),
    },
    paymentApplication: { create: jest.fn() },
    paymentOutboxEvent: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  }
  const db: any = {
    paymentWebhookEvent: { findUnique: jest.fn().mockResolvedValue(inbox) },
    $transaction: jest.fn(async (work) => work(tx)),
  }
  return { tx, service: new PaymentWebhooksService(db, {} as any, {} as any) }
}

describe('Payment callback đến sau khi hủy Rental', () => {
  it('Rental: ghi nhận cổng đã thu và chuyển sang consumer để hoàn kỹ thuật', async () => {
    const { tx, service } = cancelledPaymentFixture('RENTAL')
    await service.process('inbox-1')
    expect(tx.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SUCCEEDED' }),
    }))
    expect(tx.paymentApplication.create).toHaveBeenCalled()
    expect(tx.paymentOutboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'PAYMENT_SUCCEEDED' }),
    }))
  })

  it('Booking: giữ quy tắc terminal correction hiện có', async () => {
    const { tx, service } = cancelledPaymentFixture('BOOKING')
    await service.process('inbox-1')
    expect(tx.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reconcileStatus: 'NEEDS_REVIEW' }),
    }))
    expect(tx.paymentApplication.create).not.toHaveBeenCalled()
    expect(tx.paymentOutboxEvent.create).not.toHaveBeenCalled()
  })
})
