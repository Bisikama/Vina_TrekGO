# Shared Payment M0 and M1

Implemented against the supplied milestone plan and schema/API contract v0.1. Scope is Shared Payment foundation and Public Booking checkout. No changes to CF01 error handling or the other teams' auth, rental, trail and checkpoint implementations.

This file records the M0/M1 checkpoint. Webhook and Booking application have subsequently been implemented; see [M2 and M3](PAYMENT_M2_M3.md) for current capabilities and configuration. The remaining-milestones section below describes the original M1 boundary.

## Schema review and M0

The existing migrations `20261004090000_payment_reversal_purpose` and `20261004090100_booking_payment_foundation` already provide the M0 storage. No replacement migration or schema rewrite was necessary. Both migrations were applied successfully to the configured project database on 2026-10-05 after preflight and isolated PostgreSQL tests.

Preflight found zero invoices, payments, refunds and webhook records, no conflicting open attempts/invoices, and the expected original refund source CHECK. All locally available applied migration checksums match when LF/CRLF is accounted for. The project database also contains `20261005125000_b2_ordering_foundation`, which is absent locally; it was preserved. This is not a certification of full database drift outside Payment.

Intentional differences from the broad draft contract:

- Legacy revision/provider/hash fields remain nullable; unknown historical metadata is never fabricated. New checkout writes a complete provider scope, request snapshot and versioned hash.
- Invoice revision/open uniqueness and restrictive source FK rollout are Booking scoped. Rental/Trail revision rollout and allocation remain with their milestones and owners.
- PostgreSQL ordinary nullable unique provider reference indexes already allow multiple NULL references while enforcing non-NULL scoped identities; no duplicate partial indexes are needed.
- CHECK constraints created as NOT VALID protect subsequent writes without claiming validation of historical data. Financial source CHECKs can reject source deletion even where the older Rental/Trail FK still says SET NULL.
- PaymentApplication has a composite FK to enforce the Payment/Invoice mapping, plus one APPLIED application per invoice. Multiple real SUCCEEDED collections can still be recorded for later duplicate reversal handling.

## M1 endpoint

`POST /api/v1/bookings/:id/payments`

Requires the existing Bearer authentication and Booking ownership. Header `Idempotency-Key` must be 1–200 printable non-whitespace ASCII characters. Body is strictly:

```json
{ "paymentMethod": "QR" }
```

`REDIRECT` is also supported. Client amount, currency, userId and other extra properties return validation errors through the existing GlobalErrorFilter. Response is the direct CheckoutResponse: paymentId, invoiceId, invoiceType, status, amount, currency, providerEnvironment, checkout, expiresAt and reconciliationRequired.

- 201: new checkout ready.
- 200: replay with stored checkout/current payment status.
- 202: durable attempt without checkout; keep the same key and reference.
- 409: changed payload/key reuse, another unresolved attempt, or nonpayable state.
- 410: expired Booking hold for a new request.
- 422: inconsistent server money snapshot, unsupported currency or zero amount.

The caller needs an existing Booking hold and Invoice with lines. M1 does not implement hold creation. Invoice subtotal must equal Booking subtotal plus insurance; discounts are subtracted once. All amounts are Decimal and VND is returned as an integer string.

## Transaction and replay behavior

An actor/operation/key hash namespaces idempotency. A transaction-scoped advisory lock also serializes the same key across different Booking IDs. Reservation then locks Trip, Booking and Invoice, rereads ownership/state and uses the database clock. Only PUBLIC OPEN/FULL trips before departure and valid PENDING_PAYMENT holds can start checkout. CANCEL_PENDING is blocked.

Replay validates ownership and the stored original snapshot before checking current eligibility, so an existing key remains usable after expiry. Canonical JSON hashing sorts object keys because JSONB reorders keys. A new key on an unresolved attempt returns a conflict. Authoritative failed attempts can be replaced on the same Invoice; a collected unapplied payment blocks another collection.

Provider create runs after reservation commits. Merchant reference, amount, method and environment come from the server. A guarded version/status update prevents a delayed create response from overwriting a newer result. Timeout keeps PROCESSING and a durable SCHEDULED recovery marker, never FAILED. Replaying does not resubmit the provider call.

## Mock boundary and remaining milestones

The provider port includes createPayment, queryPayment, refund, queryRefund and verifyWebhook. Only createPayment is implemented in M1. Query/refund skeletons return UNKNOWN; webhook verification fails closed. There is no callback endpoint, financial success transition, Booking confirmation, refund execution or reconciliation worker yet.

Mock QR data uses `trekgo-mock:`. Redirects deliberately use the reserved `checkout.trekgo.invalid` domain and are demo identities, not hosted checkout pages. Mock checkout is available outside production; with NODE_ENV=production, explicitly set PAYMENT_MOCK_ENABLED=true for an intentional mock demo. No PSP credentials or real-money calls are used.

M2 adds verified durable webhook intake and financial truth. M3 adds Booking application. M4 consumes recovery metadata and handles missing callbacks/crashes; a SCHEDULED row in M1 does not recover automatically.

## Verification

M0: `prisma validate`, `prisma generate`, and 25 real PostgreSQL migration/constraint checks, including legacy data preservation, scoped uniqueness, composite FK, technical reversal sources and competing inserts.

API `npm run build` passes with dependencies restored from the existing package-lock.json; dependency versions and lockfile were not changed. Formatting and `git diff --check` pass for the implementation.

M1: 11 PostgreSQL/HTTP tests pass via `npm run test:payments` with PAYMENT_TEST_DATABASE_URL pointing to an isolated localhost payment_test_* database. Coverage includes same/different concurrent keys, replay after expiry, different Booking/method conflicts, ownership, strict body/header/UUID validation, money/TTL/CANCEL_PENDING guards, timeout, authoritative failure retry and production mock opt-in. Tests use real shared auth guards and GlobalErrorFilter; only Supabase token verification and provider timing/failure scenarios are mocked. Missing database configuration skips integration tests and is not a passing DB verification.

For a fresh empty isolated database, first run `node test/verify-payment-migration.cjs` with PAYMENT_MIGRATION_TEST_URL. Then set PAYMENT_TEST_DATABASE_URL to the same database and run the M1 tests. The migration verifier refuses nonempty or remote databases and never resets them.
