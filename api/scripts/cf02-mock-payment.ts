import { config } from 'dotenv'
import { createHmac, randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

config({ quiet: true })
async function main() {
  const args = process.argv.slice(2)
  const usage =
    'npm run cf02:mock-payment -- --payment-id=UUID [--status=SUCCEEDED|FAILED|CANCELLED|PROCESSING|EXPIRED] [--base-url=http://localhost:3000]'
  if (args.includes('--help')) {
    console.log(usage)
    return
  }
  if (
    args.some((a) => !/^--(payment-id|status|base-url)=/.test(a)) ||
    new Set(args.map((a) => a.split('=')[0])).size !== args.length
  )
    throw new Error(usage)
  const paymentId = args.find((a) => a.startsWith('--payment-id='))?.slice(13)
  const status = args.find((a) => a.startsWith('--status='))?.slice(9) ?? 'SUCCEEDED'
  if (
    !paymentId ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(paymentId) ||
    !['SUCCEEDED', 'FAILED', 'CANCELLED', 'PROCESSING', 'EXPIRED'].includes(status)
  )
    throw new Error(usage)
  const base = new URL(args.find((a) => a.startsWith('--base-url='))?.slice(11) ?? 'http://localhost:3000')
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) ||
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  )
    throw new Error('Mock sender only targets a localhost API origin')
  const secret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error('Set PAYMENT_MOCK_WEBHOOK_SECRET (>=32 bytes), identical in this terminal and the mock API server')
  const db = new PrismaClient()
  try {
    const payment = await db.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { invoice: { include: { booking: { include: { trip: true } } } } },
    })
    if (
      payment.paymentGateway !== 'mock' ||
      payment.providerEnvironment !== 'MOCK' ||
      payment.merchantAccountKey !== 'trekgo-mock-v1'
    )
      throw new Error('Refusing to simulate a non-MOCK payment')
    if (
      payment.invoice.invoiceType !== 'BOOKING' ||
      !payment.invoice.booking?.trip.description?.startsWith('CF02_SEED_V1:')
    )
      throw new Error('Only payments on CF02 seeded trips may be simulated')
    if (!payment.merchantRequestRef) throw new Error('Payment is missing merchant reference')
    const body = JSON.stringify({
      providerEventId: `cf02-demo:${payment.id}:${status}:${randomUUID()}`,
      kind: 'PAYMENT',
      merchantRequestRef: payment.merchantRequestRef,
      transactionRef: `mock:${payment.merchantRequestRef}`,
      status,
      amount: payment.amount.toFixed(0),
      currency: payment.currency,
      occurredAt: new Date().toISOString(),
    })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
    const response = await fetch(new URL('/api/v1/payments/webhooks/mock', base), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'x-mock-timestamp': timestamp, 'x-mock-signature': signature },
      body,
    })
    if (!response.ok) throw new Error(`Mock API returned ${response.status}: ${await response.text()}`)
    console.log(
      JSON.stringify(
        {
          received: true,
          paymentId,
          status,
          bookingId: payment.invoice.booking.id,
          next: `GET /api/v1/bookings/${payment.invoice.booking.id}; wait for payment workers. A received webhook does not by itself mean CONFIRMED.`,
        },
        null,
        2,
      ),
    )
  } finally {
    await db.$disconnect()
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Mock sender failed')
  process.exitCode = 1
})
