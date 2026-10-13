# Shared Payment M4 / M5

Implemented against the two TrekGo Shared Payment v0.1 documents. This extends [M0/M1](PAYMENT_M0_M1.md) and [M2/M3](PAYMENT_M2_M3.md), within Booking/CF01 scope. Auth, rental, trail and checkpoint workflows are unchanged.

## M4: recovery and reconciliation

`PaymentRecoveryService` claims due Payment/Refund rows with PostgreSQL `FOR UPDATE SKIP LOCKED`. Each claim records a fresh lease token, expiry and incremented version. Provider queries/submissions happen outside the transaction. Persistence checks the token, version and database-clock lease expiry; expired claims can be reclaimed and stale workers cannot overwrite newer results.

Query results distinguish `UNKNOWN`, authoritative `NOT_FOUND`, and `CONFIRMED_RESULT`. Timeout/network failure remains unresolved and schedules recovery; it never proves financial failure. Only authoritative NOT_FOUND on an open, non-review operation permits submission with the original merchant reference, and only for an adapter explicitly supporting idempotent submission. Expired payment checkouts are not recreated. A terminal FAILED refund is never automatically resubmitted, including after request replay or an administrator query.

Payment query results enter the durable inbox and existing M2/M3 flow. Refund query results and signed refund callbacks share the same guarded financial handler. Terminal corrections, mismatched amounts/references and callback identity collisions preserve financial history, record audit evidence and enter NEEDS_REVIEW. An authoritative query on review work records evidence and stops automatic retries; it does not silently correct history. Administrative reconciliation schedules a query, not approval to overwrite financial facts.

The mock adapter now stores simulator operations in `mock_payment_operations`, independently of application financial records. This makes query recovery survive process restarts and missing webhooks. `setResult` is an internal simulator/test method, not a public route. No real payment gateway is integrated by this milestone.

## M5: approved Booking refunds

`PaymentsPort.requestRefund` accepts an internal Booking cancellation decision. Booking computes the approved amount; Payments validates its source and executes it. Each cancellation uses `booking-cancellation:<cancellationId>` as its business action. Same-action replay returns the existing refund even with a different request key; changing its financial payload conflicts.

Reservation locks Trip, Booking, cancellation, Invoice and Payment in order. Both collected funds and the approved cancellation amount are capped after subtracting PENDING, PROCESSING and SUCCEEDED refunds. Unknown operations keep their reservation. Review records block new reservations. Successful partial refunds serialize on Invoice and recompute its aggregate state: PARTIALLY_REFUNDED or REFUNDED. Original Payment remains SUCCEEDED. Refund status, outbox and inbox completion commit atomically.

Booking cancellation persists its decision, Booking.CANCELLED and BOOKING_CANCELLED outbox together. The dispatcher creates/replays the refund through PaymentsPort and then marks the outbox processed. A crash between these steps is safe to replay. Zero approved amount produces no zero-value Refund.

ADMIN receives 100% of actual collected funds still refundable. ORGANIZER receives the same treatment only when the trip is already CANCELLED through the existing trip approval workflow. This applies to one Booking per request; automatic fan-out of all Bookings from CF01 is not added here.

USER cancellation must precede departure and uses the immutable Booking policy snapshot. Since the v0.1 documents do not specify a concrete JSON tier format, this implementation requires the following versioned structure. These percentages are examples, not default business policy:

```json
{
  "cancellationRules": {
    "version": 1,
    "tiers": [
      { "minHoursBeforeStart": 24, "refundPercent": 75 },
      { "minHoursBeforeStart": 0, "refundPercent": 25 }
    ]
  }
}
```

Select the highest qualifying threshold, multiply actual collection by its percentage, round down to whole VND, then subtract existing refund reservations/successes. Missing/invalid policy, duplicate thresholds or no matching tier fail with BOOKING_CANCELLATION_POLICY_INVALID; no percentage is guessed. Booking creation must populate this snapshot from the approved BookingPolicy. Existing empty snapshots are not backfilled or silently reinterpreted.

## API additions

All routes are under `/api/v1` and reuse existing Bearer authentication, ZodValidationPipe, registered AppError codes and GlobalErrorFilter.

| Route | Access and input | Result |
| --- | --- | --- |
| POST `/bookings/:id/cancellations` | Owner, eligible organizer or admin; Idempotency-Key header; `{ "reason": "..." }` | 202, cancellationId and approved refundableAmount; refund executes asynchronously |
| GET `/refunds/:id` | Invoice owner or admin | Financial summary without provider identifiers/payloads |
| POST `/admin/payments/:id/reconcile` | Admin; `{ "reason": "..." }` | 202, persisted query schedule and audit |
| POST `/admin/refunds/:id/reconcile` | Admin; `{ "reason": "..." }` | 202, persisted query schedule and audit |

Existing Booking detail includes refund progress. Clients cannot submit a refund amount or cancellation source. Existing mock webhook intake supports signed REFUND events with merchantRefundRef and refundTransactionRef in addition to the payment reference and financial fields.

## Runtime and operations

Recovery polls every two seconds in batches of up to ten payments and ten refunds. Cancellation handoff polls every two seconds in batches of 25. Multiple replicas rely on database guards and idempotent reservation. Exhausted cancellation handoff leaves FAILED outbox work for operator investigation; it does not lose the cancellation decision.

| Environment variable | Default |
| --- | --- |
| PAYMENT_RECOVERY_WORKER_ENABLED | enabled; `false` pauses recovery |
| PAYMENT_EVENTS_WORKER_ENABLED | enabled; `false` pauses inbox/application and cancellation handoff |
| PAYMENT_RECOVERY_LEASE_SECONDS | 30 |
| PAYMENT_RECOVERY_RETRY_SECONDS | 30 |
| PAYMENT_RECOVERY_MAX_ATTEMPTS | 8 unresolved attempts before review |
| PAYMENT_PROVIDER_TIMEOUT_SECONDS | 8 for recovery provider calls |

Confirmed PROCESSING results continue to be polled. A timed-out provider call may finish later, so merchant-reference idempotency remains required. Mock HMAC secret and production opt-in requirements remain as documented in M2/M3. Restart the API after deployment to load new workers.

Migration `20261005160000_mock_provider_operations` only adds simulator storage. No applied migration is rewritten and no database reset is used. Technical reversal execution from M6, real gateways, notifications and rental/deposit refunds remain outside M4/M5.

M6 technical reversals and M7 Trail integration are now implemented in [PAYMENT_M6_M7.md](PAYMENT_M6_M7.md).

## Verification (2026-10-05)

- 46 PostgreSQL-backed M1–M5 tests passed on an isolated localhost `payment_test_*` database, including concurrent claims, stale leases, missing webhooks, terminal corrections, full/partial/zero refunds, aggregate completion, over-refund prevention, timeout recovery, FAILED replay, callback collisions, policy snapshots, organizer/admin rules and HTTP authorization/error contracts.
- Migration verification passed 25 checks with legacy fixtures on the fresh isolated database.
- `npm run build`, `npx prisma validate` and `git diff --check` passed.
- `prisma migrate deploy` successfully applied `20261005160000_mock_provider_operations` to the configured project database; a read-only check confirmed both the table and completed migration record. No financial test fixtures were written to that database.
