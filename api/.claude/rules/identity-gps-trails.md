---
paths:
  - "src/modules/identity/**"
  - "src/modules/leader-applications/**"
  - "src/modules/geo/**"
  - "src/modules/personal-trail/**"
  - "src/shared/guards/**"
  - "test/sf01*"
  - "api/src/modules/identity/**"
  - "api/src/modules/leader-applications/**"
  - "api/src/modules/geo/**"
  - "api/src/modules/personal-trail/**"
  - "api/src/shared/guards/**"
  - "api/test/sf01*"
---

# Area C: Identity, GPS, trails

## Identity (`identity`, `shared/guards/access-token.guard.ts`)

- Supabase is the identity provider. The guard verifies the Bearer token with Supabase, then loads the TrekGo `User` by `authUserId`, including the leader profile and rank. A user must exist in PostgreSQL.
- `POST auth/bootstrap` creates the profile on first login (`USER`/`ACTIVE`).
- register/login/OTP/refresh/forgot-password wrap Supabase Auth.

## Leader application (SF01, `leader-applications`)

A user submits an application with certificates (`leader-certificate-types`). An admin reviews it at `PATCH admin/leader-applications/:id/review`. Approval changes the user's role from `USER` to `LEADER` and writes an audit log.

## Trip GPS (`geo`, docs `docs/GPS_IN_TRIP.md`, `docs/TRIP_GPS_OFFLINE_SYNC_V2.md`)

- Recording is allowed only while the trip is `IN_PROGRESS` and the user is still a valid participant or member (`GpsAccessService`). Each user has at most one `ACTIVE/PAUSED` session in the whole system, bound to one device (`X-GPS-Device-Id`).
- REST endpoints under `geo/trips/:tripId/gps`: open a session, post samples, pause/resume/finish, `end-trip`.
- Offline sync v2 under `.../sync`: metadata → batches → manifest pages → complete. `GpsSyncWorker` (2s, leased) assembles the uploads; after 4 failed attempts the sync becomes `NEEDS_ATTENTION`.
- Live view: Socket.IO namespace `/gps` (`gps:subscribe`, `gps:location.publish`). The gateway publishes a GPS outbox every 500ms and revalidates subscriptions and presence every 5s.
- The planned route comes from the `TripTrailPlan` snapshot (the active plan), and deviation is checked against it. Checkpoint arrival is confirmed once per user per checkpoint.
- `TripGpsRecordingService` finalizes ended trips into a `TripActualRoute` for each user (5s) and prunes raw points every hour.
- GPS never changes booking, attendance or payment state.

## Personal trail (`personal-trail`)

`trail-recordings` (start → raw-samples → finish) builds a `PersonalTrail` with checkpoints and elevation (via `elevation`, AWS Terrarium tiles). `submit-verification` submits it for review (`TrailSubmissionStatus`). Personal trails are what private trips use as a `PERSONAL` route source.
