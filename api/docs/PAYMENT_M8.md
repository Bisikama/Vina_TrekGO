# Shared Payment M8 — Rental payment and deposit allocation

Extends [M6/M7](PAYMENT_M6_M7.md). This milestone connects persisted Rental Orders and approved per-unit deposit decisions to Shared Payment. It does not create another catalog, order/quote engine, inspection workflow or damage-pricing policy. The provider remains MOCK; real PSP integration is M9.

## Checkout and application

`POST /api/v1/rental-orders/:id/payments` requires Bearer ownership, Idempotency-Key and the strict body `{ "paymentMethod": "QR" }` (or REDIRECT). Client amounts, currency, allocations and user IDs are rejected. The Rental order/line snapshots determine the money. Replay is checked before current eligibility so the original key still returns its payment after success/expiry; changing the method conflicts.

The transaction locks Trip → Booking → RentalOrder → quantity reservations → Invoice. A confirmed Booking on an eligible PUBLIC Trip, valid payment deadline and live HELD quantity reservation per line are required. Rental creates/reuses its Invoice and reserves Payment plus PaymentAllocation atomically. No equipment-unit assignment is required at checkout. Provider create runs after commit through Shared Payment, with the existing bounded timeout/recovery behavior.

Each positive line amount produces an allocation under RENTAL_FEE or RENTAL_DEPOSIT. The sum must equal Payment.amount; zero components are omitted. Invoice lines use the same source/component snapshots. A zero-total order is rejected by financial checkout rather than manufacturing a successful payment; free Rental fulfillment is a separate domain use case.

On PAYMENT_SUCCEEDED, RentalPaymentConsumer revalidates source mappings, snapshots, allocations, Booking/Trip eligibility, database-clock deadline and held quantities. Success atomically sets RentalOrder.PAID/financialStatus.PAID, confirms quantity reservations, marks Invoice.PAID and application.APPLIED, records RENTAL_PAID outbox and consumer receipt. Duplicate deliveries cannot confirm twice. Late/ineligible/excess collections are REJECTED and enter the M6 technical reversal flow.

Rental technical reversal returns every allocation of that rejected payment, including fee and deposit. It does not subtract damage from an accepted rental or change the accepted Invoice's refund state. Payment.SUCCEEDED remains financial history.

## Approved deposit refunds

RentalDepositWorker reads approved DepositSettlementItem decisions and calls PaymentsPort.requestRefund. There is no public endpoint accepting an amount or approving damage. Rental must already provide the item, matching assignment/unit/inspection, approvedBy, approvedAt, decisionSnapshot and a complete split where deductionAmount + refundAmount = depositAmount.

Positive refunds use purpose=DEPOSIT, source settlement/item IDs, stable business action `deposit-item:<itemId>:refund:v1` and exactly one RefundAllocation to the corresponding RENTAL_DEPOSIT allocation. The path locks RentalOrder → settlement → items in ID order → Invoice → Payment → allocations. It checks ownership/source mappings, APPLIED collection, inspection outcome, approval state, per-unit snapshot, held/deducted amounts of sibling items and existing PENDING/PROCESSING/SUCCEEDED reservations at both Payment and allocation levels. Wrong component, wrong source, excessive amount, unresolved review or open dispute is refused.

One logical refund per settlement item is retained. Timeout keeps its reservation and reconciles the same merchantRefundRef. Authoritative FAILED stays FAILED and is never automatically reset/recreated. Partial deposit refund means a complete approved item decision returns less than its deposit, or some items refund while others remain held; multiple provider attempts for one item are not introduced.

An approved full deduction with refundAmount=0 settles the retained item and emits DEPOSIT_RETAINED once, without a zero-value Refund or provider call. Payment does not infer the deduction from damage findings. Pending/issue inspections cannot authorize a refund.

REFUND_SUCCEEDED/FAILED application is separate from financial truth. The Rental consumer updates the item to SETTLED/REFUND_FAILED, recomputes settlement progress from completed items, updates Rental financialStatus and records Rental outbox plus receipt atomically. A failed domain transaction retries without losing the provider result. Returning all deposit while retaining rental fees leaves Invoice PARTIALLY_REFUNDED. Failed refunds with no money returned leave financialStatus PAID and settlement ACTION_REQUIRED.

## Workers and integration boundaries

- Shared payment event worker now dispatches RENTAL payment applications alongside Booking and Trail.
- Deposit worker polls every two seconds, up to 25 approved unreserved items and 25 due refund-result events. Its cursor rotates through invalid approvals so they cannot permanently block later items.
- PAYMENT_EVENTS_WORKER_ENABLED=false pauses domain workers; PAYMENT_RECOVERY_WORKER_ENABLED=false pauses provider recovery. Existing recovery lease/timeout settings apply.
- Failed refund-result application retries after 30 seconds up to eight attempts, retaining FAILED outbox work for investigation. Invalid approvals retain their domain records and are logged for review.
- Existing Rental approval writers must use the same Order/settlement/item lock protocol and must not rewrite a decision after its refund has been reserved.
- Quote/order creation, inventory preparation, handover, inspection/approval APIs, cancellation-policy authoring and UI are owned by Rental and are not implemented by this payment milestone. This implementation consumes their persisted records. Rental cancellation refunds are not inferred from a CANCELLED status; the implemented business refund command is the approved per-item deposit return.

## Additive schema

`20261006060000_rental_payment_allocations` adds PaymentAllocation, RefundAllocation, their positive whole-VND checks/unique indexes/restrictive foreign keys, and Rental Invoice revision/open-Invoice uniqueness. The migration refuses conflicting legacy Invoice rows rather than deleting or rewriting them. Cross-row allocation sums and refund exposure are checked inside serialized service transactions; a row CHECK cannot enforce SUM across rows.

No applied migration is rewritten and no database is reset. The new API/workers require an API restart after deployment.

## Verification

Verified on 2026-10-06:

- 69/69 PostgreSQL integration tests passed across M1–M8. Rental tests cover allocation totals/components, zero components, source ownership/strict DTO, idempotent application, quantity-hold expiry, concurrent item refund reservations, deductions/reviewed siblings, provider timeout, authoritative failure, reversal of all rejected-payment components, full retention without refund, zero-total rejection and settlement rollback/replay.
- 25 migration/business checks passed on a new isolated database with the full migration chain and legacy fixtures.
- API build, Prisma validation and `git diff --check` passed.
- Migration `20261006060000_rental_payment_allocations` was deployed successfully to the configured project database. Read-only verification confirmed both allocation tables, the open-Rental-Invoice index and the completed migration record.

Tests use isolated localhost payment_test_* databases, never project financial data.
