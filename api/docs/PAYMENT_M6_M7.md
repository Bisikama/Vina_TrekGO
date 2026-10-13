# Shared Payment M6 / M7

Implemented from the TrekGo Shared Payment milestone plan and schema/API contract v0.1, extending [M4/M5](PAYMENT_M4_M5.md). The provider remains MOCK. Rental payment/deposit integration is now documented in [M8](PAYMENT_M8.md); M9 PSP integration remains pending.

## M6: late payments and duplicate real collection

Booking rejection already persists Payment.SUCCEEDED, PaymentApplication.REJECTED and TECHNICAL_REVERSAL_REQUESTED atomically. TechnicalReversalWorker now consumes that decision through PaymentsPort.requestRefund. Allowed reasons are LATE_PAYMENT, DUPLICATE_PAYMENT and DOMAIN_NOT_ELIGIBLE (including cancellation races). The stable action/key is `payment:<paymentId>:technical-reversal:v1`.

Refund Core locks Invoice → Payment → PaymentApplication, rereads the rejected decision and matching outbox, and validates the full collected amount, scope and available exposure. Callers cannot reverse an APPLIED payment, invent a reason, attach a cancellation source or override the rejected decision's amount. Review cases defer rather than blindly refund. Reservation produces one logical TECHNICAL_REVERSAL refund; multiple workers or a crash between reservation and outbox acknowledgement replay that same refund. The acknowledgement and consumer receipt commit together.

Provider execution uses existing M4 refund recovery with lease/token/version guards and stable merchantRefundRef. Timeout remains unresolved. Authoritative FAILED is retained and never automatically resubmitted. PROCESSED reversal outbox means the refund was reserved, not that money has already been returned; check Refund.status.

Payment remains SUCCEEDED and application remains REJECTED after a reversal. Expired Bookings are not resurrected. When two distinct real collections target the same Invoice, both remain auditable, only one application is APPLIED, and the excess payment is reversed. Refunding a rejected excess payment does not change the valid Invoice from PAID to REFUNDED.

The reversal worker polls every two seconds in batches of 25. PAYMENT_EVENTS_WORKER_ENABLED=false pauses it. Failed reservation handoff retries after 30 seconds, up to eight attempts, then retains FAILED outbox work for investigation. Financial provider execution remains controlled separately by PAYMENT_RECOVERY_WORKER_ENABLED.

## M7: Trail Access purchases

Added `POST /api/v1/trails/:trailId/purchase` with existing Bearer authentication and a required Idempotency-Key (1–200 printable non-space ASCII characters). Strict body:

```json
{ "paymentMethod": "QR" }
```

REDIRECT is also supported. Client amount, currency, userId and other extra fields are rejected through ZodValidationPipe and GlobalErrorFilter.

PurchaseTrailUseCase owns price snapshot and access/Invoice creation. It calls PaymentsPort.createCheckout; it never calls the provider. The new use cases/controller live under the existing system-trail module tree and are wired in PaymentsModule alongside shared orchestration, without changing existing catalog CRUD/controllers or creating another catalog.

Purchase locks SystemTrail then TrailAccess then Invoice. Price is whole VND, read from SystemTrail for a new source and saved in TrailAccess.priceSnapshot plus Invoice/InvoiceLine. Retry reuses this obligation despite later catalog price changes. New Invoice starts at revisionNo=1. An existing legacy Invoice without revision metadata is not silently reinterpreted. Only one open Invoice and one open Payment per Invoice are allowed.

TrailPurchaseRequest stores a hashed actor + trail + operation + client-key identity, source, Invoice and method. It supports replay before a payment is reserved and also supports free grants. Same-key/same-method replay returns the same financial resource with current status; changed method conflicts. A different key cannot sell an ACTIVE access again. Access in REVOKED/REFUNDED/FAILED state requires a separate repurchase policy; no automatic reactivation is introduced.

Paid responses use the existing CheckoutResponse with invoiceType=TRAIL_ACCESS plus trailAccessId and accessStatus. HTTP status is 201 for a new checkout, 200 for a resolved replay, or 202 when checkout remains unresolved. An open payment attempt under another key returns 409. The purchase route can be replayed to read current access/payment state. A successful provider result alone does not mean access is ACTIVE.

For price=0, the domain atomically grants ACTIVE access, writes a free-grant audit and saves the request receipt. Response has paymentId=null, invoiceId=null, checkout=null, amount="0" and accessStatus=ACTIVE. No Invoice, Payment, PaymentApplication or fabricated financial success is created. Replay remains free even if catalog pricing later changes. Existing pending paid snapshots cannot be converted to free by changing the catalog price.

## Trail payment application

The shared PaymentEventsWorker routes PAYMENT_SUCCEEDED by Invoice type to Booking or ApplyTrailPaymentUseCase. Trail application locks SystemTrail → TrailAccess → Invoice → Payment → application → outbox, rechecks mappings and records its receipt in the same transaction as ACTIVE access, PAID Invoice, APPLIED application and TRAIL_ACCESS_ACTIVATED outbox. Duplicate callbacks/competing consumers produce one grant. Transaction failure leaves application PENDING for retry.

A trail archived/deactivated before application, revoked/ineligible access, or an excess real payment is rejected and handed to the same M6 technical reversal. Existing ACTIVE access is never overwritten. Catalog price changes alone do not invalidate an already snapshotted purchase. TRAIL_ACCESS_ACTIVATED is retained for downstream consumers; notification delivery is not part of this milestone.

PAYMENT_TRAIL_CHECKOUT_TTL_SECONDS configures the mock checkout lifetime (default 900). This is provider checkout validity, not a Booking seat-hold deadline; a Trail Invoice has no automatic business expiry unless explicitly configured on the Invoice. Initial provider create now uses the same bounded timeout helper as recovery for both Booking and Trail.

## Additive database changes

- `20261006030000_trail_purchase_replay`: creates trail_purchase_requests with replay-key uniqueness, method validation and restrictive foreign keys preserving purchase history.
- `20261006030100_trail_invoice_guards`: adds uniqueness for (trail_access_id, revision_no) and a partial unique index for open DRAFT/PENDING_PAYMENT Trail Invoices. Preflight fails on legacy conflicts rather than rewriting rows.

No applied migration was rewritten, no database was reset and no unrelated module schema was changed. Remote preflight found no conflicting Trail Invoices or mismatched applied migration checksums.

## Verification (2026-10-06)

- 57/57 PostgreSQL-backed M1–M7 tests passed. Coverage adds actual late/excess refund execution, retained financial history and PAID Invoice, concurrent reversal reservation, replay after reservation before ACK, rejected forged reversal, paid/free Trail purchase, duplicate grant, immutable pricing, checkout retry, concurrent purchase, Invoice uniqueness, buyer isolation, missing-webhook recovery, deactivation reversal, atomic grant rollback, authentication and strict shared errors.
- 25 migration/business checks passed against a new isolated PostgreSQL database with legacy fixtures and the full migration chain.
- API build, Prisma schema validation and whitespace checks passed.
- Both M7 migrations were successfully deployed to the configured project database. Read-only verification confirmed the replay table, both Invoice indexes and both completed migration records.

Restart the API after migration to load the new route and workers. Automated tests used localhost payment_test_* databases, not project financial data.
