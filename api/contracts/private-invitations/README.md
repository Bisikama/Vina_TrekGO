# M4 — Private invitation integration package

Updated 2026-10-22. Backend handoff only; no frontend implementation.

## Contents

- [OpenAPI 1.0.0](../openapi/private-member-invitations.json): seven direct-invitation operations generated from actual controller decorators. Includes response schemas, shared errors, UUID parameters, paging bounds and headers.
- [requests.json](./requests.json): ordered executable HTTP collection for the runner below (custom JSON format, not Postman format).
- [examples.local.json](./examples.local.json): actual responses captured from synthetic local fixtures; no bearer tokens or real customer data. IDs/dates are examples, not reusable fixtures.
- [Frontend integration guide](../../design/invitation-frontend-integration-guide-v1.3.md): screen locations, actions, state/error handling, navigation/refetch.
- [M3 semantics](../../design/invitation-m3-handoff.md): replay, LEFT/REMOVED, capacity and lifecycle rules.

## Environment manifest

| Item | Verified state |
|---|---|
| Source contract | M2/M3 implementation, M4 docs version 1.0.0 |
| Production response error version | meta.contractVersion = 0.2.0-final-flow; separate from OpenAPI version |
| Application API prefix | /api/v1, include it exactly once |
| Deployment URL | Not supplied/verified. Do not assume localhost:3000 or an existing staging deployment has these changes |
| Local verification | Ephemeral Nest HTTP server, real AuthenticationGuard/AccessTokenGuard/GlobalErrorFilter, real PostgreSQL |
| Identity verification in test | Supabase verifyToken stub maps synthetic host/recipient tokens to fixture accounts; not a live Supabase login test |
| Database test | localhost:55439/cf01_test_invitation_m1 |
| Migration dependency | 20261021120000_private_member_invitation_foundation, applied to local test DB; project deployment not verified |
| Other migrations | M4 creates none; do not deploy unrelated pending migrations as part of this package |
| Notification | Durable outbox only; delivery not certified by M4 |
| Frontend integration | Guidance delivered; UI implementation and end-to-end login/browser verification belong to frontend/integration owner |

The automated smoke fixture uses two USER ACTIVE accounts and a PRIVATE OPEN trip starting in the future, HOST ACTIVE and capacity 2. Recipient starts without membership. The DB test may contain other unrelated synthetic fixtures; use the IDs supplied by each test, not earlier examples.

## Execute against your selected integration environment

Requires Node 20+, actual host/recipient bearer access tokens, recipient email, and a **dedicated disposable test trip** with one available member slot. Confirm M1 migration and M2/M3 code deployed first. Runner creates four invitations, declines/revokes/expires three and accepts the last. It leaves the accepted member and audit history intact; it does not delete data. Do not run it against a live customer trip.

Set these variables in a private local shell/secret mechanism (do not commit tokens):

```powershell
$env:INVITATION_API_BASE_URL='https://YOUR-TEST-HOST/api/v1'
$env:INVITATION_HOST_TOKEN='<host access token>'
$env:INVITATION_RECIPIENT_TOKEN='<recipient access token>'
$env:INVITATION_TRIP_ID='<dedicated private trip UUID>'
$env:INVITATION_RECIPIENT_EMAIL='<recipient account email>'
$env:INVITATION_SMOKE_ALLOW_MUTATIONS='true'
# From api/:
node scripts/run-private-invitation-smoke.cjs
```

Do not set INVITATION_SMOKE_EVIDENCE_FILE for real accounts unless you intentionally want response data saved in a controlled location. Never commit real response exports. Runner prints step names/status failures only; it never prints token values. Clear local token environment variables when finished.

Collection flow: create → host list → recipient list → preview → decline/replay → create → revoke/replay → create with short expiry → wait → accept returns 410 → create/replay using same key → accept/replay → Room. Expiry uses a two-second window for local tests; on remote high-latency/clock-skew environments adjust the runner's expiry interval and collection wait together or use a longer expiry manually. A failure does not clean up partial business state: inspect current invitation/member status before rerunning, use a fresh trip or the normal leave/revoke APIs as appropriate. Quota applies across runs; wait Retry-After rather than bypassing it.

Manual example (real client values replace placeholders):

```http
POST /api/v1/private-trips/<tripId>/member-invitations
Authorization: Bearer <hostToken>
Content-Type: application/json
Idempotency-Key: <new UUID for this send>

{"recipientEmail":"recipient@example.com"}
```

Create expects 201. Retry the same logical send with the same key/body; key reuse with changed payload is 409. Fetch preview as recipient, then POST /api/v1/private-trip-member-invitations/<id>/accept with `{}`. Navigate only if canEnterRoom=true, then fetch GET /api/v1/private-trips/<tripId>/room. Actual web Room route is `/trip-room/<tripId>`, not the API URL or host-only detail page.

## Authorization, errors and client behavior

- Direct APIs require an ACTIVE USER/LEADER account. Host mutations also require creator ownership and HOST ACTIVE. A new/reactivated membership requires USER ACTIVE; an ACCEPTED historical replay may be read after promotion to LEADER.
- Unknown or unauthorized invitation/host target returns NOT_FOUND; never infer recipient email availability from distinct errors.
- DTOs strict; page=1..1000000, pageSize=1..50 (defaults 1/20), optional status enum. Lists sort createdAt DESC/id DESC and expose effective status/expiry.
- All seven operations send Cache-Control:no-store. Create sends Idempotency-Replayed as string true/false. Mutation 429 sends Retry-After seconds, error.details.retryAfterSeconds, retryable=true.
- Parse response.data.error.code/message/details and meta.requestId; details can be business object or validation field array. Not all failures include details.
- Actions: after create/revoke refresh host list; after accept/decline refresh recipient list/preview; after successful join refresh Room/members. No optimistic membership creation from pending invitation.
- 409 CAPACITY_CONFLICT keeps invitation pending; retry only while still valid. 410 means expired. MEMBER_REMOVED is a 403 reason; old invitation cannot rejoin. Accepted replay can return LEFT/REMOVED and canEnterRoom=false.
- Preview actions.canAccept is a snapshot, not a reservation. Room may return 403 if access changes before its request. Invitation ACCEPTED does not grant Rental/Check-in permissions.

Config: PRIVATE_INVITATION_TTL_SECONDS=604800, REPLAY_SECONDS=86400, CREATE_PER_MINUTE=10, CREATE_PER_DAY=50, MUTATE_PER_MINUTE=30 (full variable prefix PRIVATE_INVITATION_). Actual environment may override; default expiry is capped at trip start minus one second. Quota windows are fixed UTC windows. See M0/M1 handoff for allowed config ranges.

## Reproduce local evidence

From api/, with the isolated PostgreSQL test already started and M1 migration applied:

```powershell
node node_modules/ts-node/dist/bin.js --transpile-only scripts/export-private-invitation-openapi.ts
$env:INVITATION_TEST_DATABASE_URL='postgresql://invitation_test@127.0.0.1:55439/cf01_test_invitation_m1?connection_limit=20'
$env:INVITATION_EXPORT_EXAMPLES='true'
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/modules/trips/private-member-invitation.spec.ts
node node_modules/typescript/bin/tsc --project tsconfig.build.json --noEmit --incremental false
```

OpenAPI export is metadata-only, no DB/worker startup; the empty service provider is used only to generate documentation, not to claim business functionality. The HTTP collection test uses the real service/adapters. No auth or frontend files were modified for this package.
