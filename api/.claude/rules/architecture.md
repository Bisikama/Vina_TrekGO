# Architecture and cross-module conventions

## Bootstrap and cross-cutting concerns

- `src/main.ts`: global prefix `api/v1`, global `GlobalErrorFilter`, Swagger at `/docs`, custom `WebsocketAdapter`, `rawBody: true` (needed for payment webhook signature verification).
- `src/shared/config.ts`: all env vars are parsed by a Zod schema at import time; the process exits on invalid env unless `NODE_ENV=test`. Add new env vars there, not via ad-hoc `process.env` reads.
- `SharedModule` is `@Global` and provides `PrismaService` (Prisma with the `pg` driver adapter), `SupabaseService`, `RedisService`, and registers two `APP_GUARD`s:
  - `AuthenticationGuard` — routes are **public by default**. Protect with `@Auth([AuthType.Bearer])`, `ApiKey` (internal, `x-api-key`), or `Optional`; multiple types combine with `{ condition: ConditonGuardType.Or }`.
  - `RolesGuard` — `@Roles(UserRole.X)`; current user via `@ActiveUser()`.

Roles (`UserRole`): `USER`, `LEADER`, `STAFF_INVENTORY`, `STAFF_DELIVERY`, `ADMIN`.

## Module styles

Two styles coexist; follow the one already used by the module you are editing.

- **Hexagonal** (trips, rental/*, gear, geo, identity, checkpoint, destination, system-trail, personal-trail, media, weather, elevation): `application/{ports,use-cases}`, `infrastructure/adapters` (Prisma implementations), `presentation/{controllers,dtos}`. Ports are injection tokens bound in the module (`{ provide: RENTAL_ORDER_PORT, useClass: PrismaRentalOrderAdapter }`). New modules can be scaffolded with `npm run g:hex <name>` (see `docs/gen-hex-guide.md`, `docs/hexagonal-architecture.md`).
- **Flat services** (bookings, payments, notifications): controller + service + consumer files in one folder.

## How modules talk to each other

Modules rarely call each other synchronously. They write **outbox rows in the same DB transaction** as the state change, and **polling workers** (`@Interval` / `@Cron` from `@nestjs/schedule`, all in-process) consume them. Workers use `FOR UPDATE SKIP LOCKED` or a lease, a per-consumer receipt table for idempotency, `retry_count` + `next_retry_at` backoff, and a terminal `FAILED`/`NEEDS_REVIEW` state for manual replay.

Outbox tables:

- `payment_outbox_events`: `PAYMENT_SUCCEEDED`, `TECHNICAL_REVERSAL_REQUESTED`, refund events.
- `booking_outbox_events`: `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `TRIP_CANCELLED`, `TRIP_BOOKING_CANCELLATION`, `PRIVATE_TRIP_CANCELLED`, `PRIVATE_TRIP_MEMBER_JOINED/LEFT/REMOVED`, `PUBLIC_PARTICIPANT_CLAIMED`, `PUBLIC_PARTICIPANT_CHECKED_IN`, `PUBLIC_INVITATION_ACCEPTED`.
- `rental_outbox_events`: `RENTAL_PAID`, operational alerts, and other rental events.

Cancellation fan-out goes through `shared/services/cancellation-delivery.service.ts`, with one delivery row per `(event, consumer)` for the consumers `trip-bookings-v1` and `rental-lifecycle-v1`.

## Write-path conventions

- `Idempotency-Key` header, stored as a hash of `(userId, action, key)`. A replay with a different payload returns `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.
- An integer `version` column for optimistic concurrency. Clients send the expected version and get `VERSION_CONFLICT` if it is stale.
- Explicit row locks (`SELECT … FOR UPDATE`) in a fixed order. For example, the booking flow locks trip → booking → invoice → payment.
- Time comes from the DB (`SELECT clock_timestamp()`), not from `new Date()`, inside financial and capacity transactions.

## Worker kill-switches

Many workers have env kill-switches: `PAYMENT_EVENTS_WORKER_ENABLED`, `PAYMENT_RECOVERY_WORKER_ENABLED`, `BOOKING_EXPIRY_WORKER_ENABLED`, and `TRIP_CANCELLATION_WORKER_ENABLED` (which must be `'true'`, or admin cancellation review is refused).
