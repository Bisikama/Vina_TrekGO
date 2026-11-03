---
paths:
  - "src/modules/rental/**"
  - "test/area-b*"
  - "docs/rental/**"
  - "api/src/modules/rental/**"
  - "api/test/area-b*"
  - "api/docs/rental/**"
---

# Area B: Rental (`rental/*`)

Business source of truth: `docs/rental/sot/` (DOCX) and `docs/rental/reference/*.md`. The invariants are in `./AGENTS.md`. Each submodule is hexagonal with its own Nest module, aggregated by `rental.module.ts`.

`RentalOrderStatus`: `PENDING_PAYMENT → PAID → PREPARING → READY_FOR_HANDOVER → ACTIVE → RETURN_PENDING → RETURN_PROCESSING → COMPLETED`, or `CANCELLED`, `EXPIRED`. Orders also have a separate `financialStatus` and `exceptionStatus` (`NONE/ACTION_REQUIRED/OVERDUE/RETURN_INCOMPLETE`).

1. **Eligibility & context (ordering):**
   - Renting needs trip membership, resolved by `PrismaRentalContextAdapter`: a claimed public participant of a confirmed booking, or an ACTIVE private-trip member. A `bookingId` alone does not authorize renting.
   - The context carries `membershipKind/Ref/SourceVersion` and `contextVersion`. These are re-checked at order time, and any mismatch rejects the order.
2. **Catalog → availability → quote → order:**
   - Availability is quantity-based over the *occupied window* (rental period plus buffers) and computed by `prisma-rental-availability.adapter.ts`. No physical unit is chosen at this stage.
   - `POST rentals/quote` creates a `RentalQuote` with a policy snapshot (`admin/rental-policy`).
   - `POST rental-orders {quoteId}` re-checks quote, context and capacity under lock. It creates the order, `HELD` reservations per line and a `RENTAL` invoice, with `paymentExpiresAt = now + paymentHoldMinutes`.
   - `RentalOrderExpiryScheduler` (every minute) expires unpaid orders and releases their holds.
3. **Payment (`rental/payments`):**
   - `POST rental-orders/:id/payments` → `RentalCheckoutService`. The payment is split into allocations per line and component (rent vs `RENTAL_DEPOSIT`).
   - When the payment succeeds, `RentalPaymentConsumer` validates it. On success: order `PAID`, reservations `CONFIRMED`, an `InventoryTask(OPEN)` at the single primary `InventoryLocation` (`RENTAL_PRIMARY_INVENTORY_LOCATION_ID`), and `RENTAL_PAID` written to the rental outbox. Otherwise: rejection plus a technical reversal.
4. **Preparation (`STAFF_INVENTORY`, `staff/preparation/tasks`):**
   - Claim → `pick` assigns physical `EquipmentUnit`s (`AVAILABLE→PICKED`, `RentalUnitAssignment ASSIGNED`, order `PREPARING`). This is the first point where units are chosen.
   - `condition-snapshots` captures the `PRE_HANDOVER` condition baseline with media. Then `pack` (package `PACKED`).
   - `ready` → order `READY_FOR_HANDOVER`, a `DeliveryTask(HANDOVER, SCHEDULED)` is created, and a `CustodyTransfer(PENDING_RECEIPT)` is opened.
   - `replace-unit` and `transfer-request` handle bad units or stock at another location.
5. **Delivery & handover (`STAFF_DELIVERY`, `delivery/tasks`, `rental-orders/:id/handover`):**
   - Tasks are claimed by staff or assigned by an admin (`admin/rental-tasks/:id/assign`). They are never auto-assigned or auto-released.
   - `receive-package` moves custody from inventory to delivery staff (a `CustodyEvent`). `verify-user` checks the renter with the pickup code (`rental-orders/:id/pickup-code`).
   - `handover` is all-or-nothing: units `RENTED`, assignment `HANDED_OVER`, order `ACTIVE`, a deposit settlement `OPEN` with items `HELD`, and a handover document.
   - `no-show` cancels the order and releases its reservations.
6. **Active period:**
   - Extension (`rental-orders/:id/extension-quotes` → `extensions` → `rental-extensions/:id/payments`) re-checks capacity and goes through the normal payment flow. `RentalPaymentConsumer` applies it, or rejects it and reverses the payment.
   - `RentalExtensionScheduler` (every minute) expires extension holds, opens due `RETURN` delivery tasks (`RentalOverdueService.openDueReturnTasks`) and marks overdue orders.
7. **Return:**
   - Delivery staff: `return-scan` (`ACTIVE→RETURN_PENDING/RETURN_PROCESSING`, units `RETURN_PENDING`) → `return-observations` (a `PRELIMINARY` inspection, which can open a `RentalExceptionCase`) → `return-to-inventory-location` (custody transfer back to the warehouse).
   - Inventory staff: `staff/returns/:id/receive` (custody ACK, units `CLEANING`/`MAINTENANCE`; the inspection SLA starts here) → `final-inspection` (the `FINAL` stage, decided only by inventory, never by delivery staff) → `finalize` (assignments `CLOSED`; units `AVAILABLE`, `DAMAGED` or `LOST`).
8. **Deposit settlement:**
   - A final inspection with no damage sets the deposit items to `REFUND_PENDING`.
   - With damage, the items go to `REVIEW_REQUIRED`. The case goes through `assessment-reviews` and an admin `deposit-settlement` or `admin/rental-exceptions/:id/resolve`. A deduction can never exceed the deposit.
   - `RentalDepositWorker` (`@Interval(2000)`) refunds each item to its original payment source (`RentalRefundsService`), grouping refunds per order. It sets items `SETTLED` when the provider confirms; the order closes as `COMPLETED`.
9. **Background monitoring:**
   - `RentalOperationalEscalationScheduler` only flags problems: delayed custody transfers, breached admin review SLAs, and a closure sweep for stuck orders. It never changes custody, inspection or refund outcomes.
   - `RentalDocumentRenderWorker` renders PDFs (handover, extension appendix, return receipt).
10. **Trip lifecycle coupling (`rental/lifecycle`):**
    - `BookingMembershipEventConsumer` (`rental-lifecycle-v1`) reacts to `BOOKING_CANCELLED`, `TRIP_CANCELLED`, `PRIVATE_TRIP_*` and `PUBLIC_PARTICIPANT_CLAIMED`. It cancels or refunds orders that have not started and handles changes to membership.
    - There is also an internal API-key webhook, `internal/rental/trip-events` (reschedule, cancel-trip, cancel-booking).
