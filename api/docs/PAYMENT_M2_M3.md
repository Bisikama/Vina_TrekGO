# Shared Payment M2 and M3

M2 adds authenticated, durable mock webhook intake and financial result processing. M3 applies successful collections to eligible Public Bookings and exposes Booking payment/application state. The M0 schema already supports these operations; no additional migration, database reset, or edits to applied migrations are needed.

## Mock webhook contract

`POST /api/v1/payments/webhooks/mock` uses the shared public-route auth metadata, with provider HMAC authentication instead of Bearer authentication. Nest raw-body capture is enabled in main.ts. Requests must be JSON and at most 16 KiB (the app parser also retains its own default limit).

Set `PAYMENT_MOCK_WEBHOOK_SECRET` to a private random value of at least 32 bytes. There is no default or checked-in secret. Keep it server-side; never put it in frontend configuration. When NODE_ENV=production, mock intake additionally requires PAYMENT_MOCK_ENABLED=true. Missing configuration returns 503.

Headers:

- `x-mock-timestamp`: Unix seconds, within 300 seconds of server time.
- `x-mock-signature`: lowercase hex HMAC-SHA256 over the timestamp, a literal dot, and the exact raw request body bytes, using PAYMENT_MOCK_WEBHOOK_SECRET.

Strict body example (replace IDs and values with the actual mock checkout):

```json
{
  "providerEventId": "demo-event-001",
  "kind": "PAYMENT",
  "merchantRequestRef": "payment:<paymentId>",
  "transactionRef": "mock-transaction-001",
  "status": "SUCCEEDED",
  "amount": "1050",
  "currency": "VND",
  "occurredAt": "2026-10-05T08:00:00.000Z"
}
```

Supported statuses: PROCESSING, SUCCEEDED, FAILED, CANCELLED, EXPIRED. SUCCEEDED requires a transactionRef. Amount is an integer string; expected amount and currency are checked against the immutable Payment snapshot before financial processing. Environment, gateway and merchant come from server configuration; they are not accepted in the body. Refund callbacks are outside this milestone.

Signing in Node.js, where rawBody is the exact string/Buffer sent over HTTP:

```js
const timestamp = Math.floor(Date.now() / 1000).toString()
const signature = createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET)
  .update(timestamp).update('.').update(rawBody).digest('hex')
```

A legitimate retry keeps the same event ID and identical body bytes and signs again with a fresh delivery timestamp. The occurrence time stays unchanged. The signature authenticates raw bytes; semantically equivalent JSON formatted differently has a different payload hash and is quarantined as an event identity conflict.

After a successful database intake transaction, the route returns HTTP 200 `{ "received": true }`. This means durable receipt, not Booking confirmation. Invalid signature/timestamp returns 401, malformed signed payload returns 400, and storage failure returns retryable 503. Errors use GlobalErrorFilter and the existing error contract version. No new controller error filter is introduced.

## M2 financial processing

PaymentWebhookEvent is the durable inbox. Its scoped provider event identity serializes duplicate intake. Exact duplicates ACK successfully without creating another row. Conflicting payloads preserve the original payload, write AuditLog evidence and flag the affected Payment for review. A previously processed event keeps its processed history; pending domain application is blocked by NEEDS_REVIEW.

The worker locks Invoice then Payment then the inbox row. Provider transaction identity is additionally serialized across invoices, and the existing database unique index remains the final guard. A matching SUCCEEDED result atomically writes Payment.SUCCEEDED, provider paidAt, PaymentApplication.PENDING, PAYMENT_SUCCEEDED outbox and inbox completion. Invoice and Booking remain pending until M3. FAILED emits PAYMENT_FAILED. Duplicate or out-of-order terminal results are audited and do not move status backward.

Amount/currency mismatch, conflicting transaction references and terminal success corrections preserve evidence and enter NEEDS_REVIEW without applying business effects. Unknown payment references remain retryable inbox work. Provider query/reconciliation is still M4; no authoritative correction is guessed here.

## M3 Booking application

BookingPaymentConsumer belongs to BookingsModule. Its transaction locks Trip → Booking → Invoice → Payment → PaymentApplication → outbox, then rereads all mappings. It uses PostgreSQL clock_timestamp after locks and again immediately before the domain decision, with no grace period.

Only an unexpired PENDING_PAYMENT hold on a PUBLIC OPEN/FULL trip before departure can apply. CANCEL_PENDING and other ineligible states are rejected. Invoice ownership, currency and Booking money snapshots must match. Active participant count must match the hold snapshot, and occupied capacity includes confirmed bookings and unexpired pending holds. FULL caused by the current hold is allowed. Every other writer of capacity must use the same Trip lock protocol.

Success commits Booking.CONFIRMED, a stable `payment:<paymentId>` confirmation key, Invoice.PAID, PaymentApplication.APPLIED, BOOKING_CONFIRMED outbox, consumer receipt and payment-outbox completion in one transaction. Duplicate deliveries and competing consumers have one effect. Application guards cover the Booking source across Invoice revisions as well as the database's one-APPLIED-per-Invoice invariant.

An ineligible collection stays Payment.SUCCEEDED and becomes application REJECTED with LATE_PAYMENT, DOMAIN_NOT_ELIGIBLE or DUPLICATE_PAYMENT. A durable TECHNICAL_REVERSAL_REQUESTED event is recorded, but no Refund or provider refund call is created in M3. Expired/cancelled Bookings are never resurrected. Infrastructure errors roll back the transaction and leave application PENDING for retry.

## Reading progress

`GET /api/v1/bookings/:id` requires the existing Bearer guard and Booking ownership. It returns id, status, expiresAt, confirmedAt, totalAmount, currency, paymentSummary and refunds. paymentSummary includes paymentId, financial status, applicationStatus, applicationReasonCode and reconciliationRequired. An APPLIED payment takes precedence over a newer duplicate payment. Provider payloads, hashes, secrets and participant PII are not exposed.

Clients can show “payment collected, Booking confirmation pending” while Payment=SUCCEEDED and application=PENDING. Only Booking=CONFIRMED/application=APPLIED means the business accepted the collection.

## Worker and recovery boundaries

PaymentEventsWorker uses the existing ScheduleModule, polling every second in batches of 25. Set PAYMENT_EVENTS_WORKER_ENABLED=false to pause automatic processing while retaining intake. The worker first processes due mock inbox rows, then due PAYMENT_SUCCEEDED Booking outbox rows in separate transactions.

These workers perform database operations only. Short transactions and row locks/SKIP LOCKED protect effects across replicas; a crash rolls back and releases locks. They do not hold transactions across provider network calls, and do not need network-operation leases. Provider query leases/reconciliation remain M4.

Transient failures retry after 30 seconds, up to eight attempts. Inbox exhaustion is NEEDS_REVIEW; exhausted Booking outbox work is FAILED while the application remains PENDING. Durable error markers and logs require operator review. Outbox events for PAYMENT_FAILED, BOOKING_CONFIRMED and TECHNICAL_REVERSAL_REQUESTED are retained for their downstream milestones; this worker does not claim to deliver notifications or execute reversals.

## Verification

The combined `npm run test:payments` suite runs against an isolated localhost payment_test_* PostgreSQL database via PAYMENT_TEST_DATABASE_URL. Shared auth guards and GlobalErrorFilter are real; only external Supabase token verification and selected provider timing/failure scenarios are mocked. Jest transforms the installed schedule ESM package for compatibility with the project's Node 22 test runtime.

Coverage includes M1 replay/concurrency, HMAC and timestamp failures, strict payloads, durable ACK failures, duplicate and conflicting callbacks, amount/currency mismatch, missing payment retry, webhook-before-create races, out-of-order/terminal correction, financial/domain transaction rollback, competing consumers, TTL and CANCEL_PENDING rejection, FULL hold acceptance, distinct real collections, expiry race and Booking detail ownership.

No new schema migration was needed for M2/M3. M4 reconciliation and M5 Booking refunds are documented in [PAYMENT_M4_M5.md](PAYMENT_M4_M5.md); M6 reversals and M7 Trail purchases are documented in [PAYMENT_M6_M7.md](PAYMENT_M6_M7.md). The API process must be restarted to load these source changes; a real mock demo also needs the webhook secret configured.
