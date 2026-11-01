---
paths:
  - "src/modules/gear/**"
  - "src/modules/media/**"
  - "src/modules/notifications/**"
  - "src/modules/weather/**"
  - "src/modules/elevation/**"
  - "src/modules/destination/**"
  - "src/modules/checkpoint/**"
  - "src/websockets/**"
  - "test/gear*"
  - "api/src/modules/gear/**"
  - "api/src/modules/media/**"
  - "api/src/modules/notifications/**"
  - "api/src/modules/weather/**"
  - "api/src/modules/elevation/**"
  - "api/src/modules/destination/**"
  - "api/src/modules/checkpoint/**"
  - "api/src/websockets/**"
  - "api/test/gear*"
---

# Supporting modules

## Gear advisor (`gear`, docs `docs/gear-advisor`)

- Pure rule engine and planner in `gear/domain` (`pure-gear-engine.ts`, `pure-planner.ts`, `constraint-evaluator.ts`), with rules seeded by `seed:gear-rules`.
- A user's gear inventory lives at `gear/items` (with photos).
- Extraction (`gear/extractions`) turns an image or link into a draft via Gemini or Firecrawl, with a daily quota and a cache; the user then confirms it.
- Gear plans (`gear/plans`) can be created for a trip or manually. They are revisioned, and support evaluate, diff, options and AI `advice`. `quote-intents`/`quote-links` link into the rental quote flow.
- AI access goes through `gear-ai.port.ts`.

## Media (`media`)

- `POST media/upload-intents` returns a signed Cloudinary upload. The client uploads directly, then calls `POST media/:id/complete`, which verifies the upload and provenance/C2PA and sets the media `READY`.
- `GET :id/delivery` returns a signed URL. `MediaCleanupScheduler` runs hourly and processes `DELETE_PENDING` assets.
- It is disabled unless `MEDIA_ENABLED=true`. Rental condition snapshots and return evidence reference `READY` media.

## Notifications (`notifications`)

- Three consumers (`@Interval(3000)`) poll the booking, payment and rental outboxes. They use receipt tables (for example `booking_notification_receipts`) to avoid duplicates.
- Notifications are stored in MongoDB (`NotificationStatus` UNREAD/READ/ARCHIVED) and pushed via `websockets/notification.gateway.ts` (`receive-notifications`).
- `GET notifications`, `unread-count` and `read-all` serve the inbox.

## Weather / elevation / destination / checkpoint

- Weather and elevation are read-only lookups; weather keeps snapshots per trip.
- Destination and checkpoint are admin CRUD for the master data that trips and trails are built from (`CheckpointType` START…END).
