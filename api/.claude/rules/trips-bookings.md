---
paths:
  - "src/modules/trips/**"
  - "src/modules/bookings/**"
  - "src/modules/system-trail/**"
  - "src/modules/checkpoint/**"
  - "src/modules/destination/**"
  - "test/cf01*"
  - "test/cf03*"
  - "test/cf04*"
  - "api/src/modules/trips/**"
  - "api/src/modules/bookings/**"
  - "api/src/modules/system-trail/**"
  - "api/src/modules/checkpoint/**"
  - "api/src/modules/destination/**"
  - "api/test/cf01*"
  - "api/test/cf03*"
  - "api/test/cf04*"
---

# Area A: Trips & Bookings (`trips`, `bookings`, `system-trail`, `checkpoint`, `destination`)

## Public trip lifecycle (CF01)

`trips/application/use-cases/public-trip.use-case.ts`, routes `leader/public-trips`.

`TripStatus`: `DRAFT → OPEN ⇄ FULL → CLOSED → IN_PROGRESS → COMPLETED`, plus `CANCEL_PENDING → CANCELLED`.

1. A leader (must be `LEADER` + `ACTIVE` and both creator and leader of the trip) creates a `DRAFT`. While it is `DRAFT`, they set destination, pickup point, required checkpoints (`PUT :id/checkpoints`) and system trails (`PUT :id/trails`). `routeIssues()` in `trip.policy.ts` checks that the trails chain end-to-start and pass the required checkpoints in order.
2. Pricing (`trips/pricing`): save a cost plan (FIXED / VARIABLE / STEP costs), preview, then confirm. This produces `pricePerPax`, and `TripCostPlanStatus` must be `CONFIRMED`. Transport (`trips/transport`, admin only) attaches vehicles and providers.
3. `GET :id/readiness` → `POST :id/publish`. Publishing checks readiness and leader schedule conflicts (`LEADER_SCHEDULE_CONFLICT`), then sets `publishedAt` and status `OPEN`.
4. Registration window: it opens at `registrationOpenAt ?? publishedAt`. It closes at `registrationDeadlineAt`, which defaults to `startAt − 48h` and must be at least 24h before start. `syncTripRegistrationState()` (`bookings/booking-capacity.ts`) moves the trip `OPEN ⇄ FULL` based on occupied seats and to `CLOSED` at the deadline. It is called after every booking change and by the expiry worker. A leader can also `close-registration` manually.
5. `start` (from OPEN/FULL/CLOSED) → `IN_PROGRESS`. `complete` (only from IN_PROGRESS) → `COMPLETED`.
6. Cancellation: the leader calls `POST :id/cancellation-requests`, which creates a `CancellationRequest`; the trip goes to `CANCEL_PENDING`. An admin then approves or rejects it (`admin/trip-cancellation-requests`, `bookings/trip-cancellation.service.ts`). Approval writes `TRIP_CANCELLED`. The `trip-bookings-v1` consumer fans it out into one `TRIP_BOOKING_CANCELLATION` per booking, and each of those cancels the booking with a refund. `rental-lifecycle-v1` cancels the related rentals. Failed deliveries can be replayed via `POST deliveries/:eventId/retry`. Approval is refused if the trip has started or any participant has checked in. Rejection returns the trip to its previous status.

This use-case still throws `HttpException` through a local `fail()` (old envelope via `TripErrorFilter`), not `AppError`.

## Booking

`bookings/bookings.service.ts`, `POST trips/:tripId/bookings`.

`BookingStatus`: `PENDING_PAYMENT → CONFIRMED → PARTIAL_CHECKIN/CHECKED_IN → COMPLETED`, or `EXPIRED`, `CANCELLED`, `NO_SHOW`.

1. Create is a single transaction:
   - Idempotency is guarded by an advisory lock on the key.
   - Lock the trip row, then expire stale holds (`expireTripHolds`).
   - Gates: trip status, registration window, one active booking per user per trip (`ACTIVE_BOOKING_EXISTS`), and capacity (`occupiedSeats` counts ACTIVE participants of confirmed bookings plus unexpired `PENDING_PAYMENT` holds).
   - Resolve the active `BookingPolicy`, which is versioned and published by admins at `admin/booking-policies`. Snapshot it into `booking.policySnapshot` (`holdTtlMinutes`, `cancellationRules`).
   - Create the participants, each with a `checkinCode`, and a `BOOKING` invoice. `expiresAt = min(now + holdTtl, trip.startAt)`.
2. Payment: `POST bookings/:id/payments` creates a `Payment` through the provider (see the payments rule).
3. When the payment succeeds, `BookingPaymentConsumer` validates amount, currency, expiry, capacity and duplicates. On success it marks the `PaymentApplication` as `APPLIED` and the booking `CONFIRMED`. Otherwise it marks the application `REJECTED` (`LATE_PAYMENT`, `DUPLICATE_PAYMENT`, `DOMAIN_NOT_ELIGIBLE`) and emits `TECHNICAL_REVERSAL_REQUESTED`, which refunds the money automatically.
4. Expiry: `BookingsService.expireTick` (`@Interval(5000)`) expires unpaid holds and closes trips whose deadline has passed. Expiry never touches payment state.
5. User cancellation (`bookings/:id/cancellation-preview`, `POST bookings/:id/cancel`):
   - It is blocked while the booking has active rentals (`rentalBlockers`).
   - The refund is the applied payment × `refundPercentAt(policySnapshot, startAt, now)`, minus refunds already reserved.
   - It writes `BOOKING_CANCELLED`. `BookingCancellationService.tick` (`@Interval(2000)`) then calls `RefundsService.requestRefund`.
6. Participants and tickets:
   - The booker can invite an account to a participant slot (`bookings/:id/participants/:pid/invitations`, accept/decline/revoke) or claim a slot themselves (`self-claim`). Either way the participant is linked to a user and `PUBLIC_PARTICIPANT_CLAIMED` is written, which grants that user rental eligibility.
   - Users see their tickets at `me/tickets` and their invitation inbox at `me/invitations`.
7. Leader check-in (`leader/public-trips/:id/check-in`): by QR `checkinCode` or manually by participant ID. It is idempotent and recomputes `PARTIAL_CHECKIN`/`CHECKED_IN`.

## Private trip (CF03/CF04)

`private-trip.use-case.ts`, `private-membership.use-case.ts`.

- Only a `USER` can create one; a leader cannot (`LEADER_CANNOT_CREATE_PRIVATE_TRIP`). It has no payment and no booking.
- The route source is a `PERSONAL` trail (the user's own) or a `SYSTEM` trail. A paid system trail requires an ACTIVE `TrailAccess`, and at least one checkpoint must be chosen.
- Joining: by invite code (`private-trip-invitations/:code/join`) or by a direct member invitation (accept/decline/revoke). The member list lives in `TripMember` (`ACTIVE/LEFT/REMOVED/...`).
- Join, leave, remove and cancel write `PRIVATE_TRIP_*` events, which the rental lifecycle consumes.

## System trail purchase

`system-trail/.../purchase-trail.use-case.ts`, `POST trails/:trailId/purchase`.

- Free trail: `TrailAccess` is granted immediately.
- Paid trail: a `TRAIL_ACCESS` invoice is created (or reused) with a `PENDING_PAYMENT` access row. `ApplyTrailPaymentUseCase` activates it when the payment event arrives.

## Navigation

`trips/:tripId/navigation-context`, `switch-trail`. A public trip can have several `TripTrailPlan` snapshots. `activeTrailPlanId` selects the plan used by GPS for route-deviation checks.
