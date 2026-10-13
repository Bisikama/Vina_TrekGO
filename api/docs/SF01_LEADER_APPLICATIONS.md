# SF01 Leader application backend

Implements the 12 October 2026 SF01 MVP contract: submit application with private certificates, admin review, and atomic USER → LEADER promotion. No frontend, online tests, trip-count eligibility, interviews, automatic revocation or payouts are included. Existing test/review tables and enums remain intact.

## APIs

All paths are prefixed `/api/v1`. Authenticate using a Supabase access token in `Authorization: Bearer ...`. Identity and current role are loaded from the database on every request.

| Method | Path | Access |
| --- | --- | --- |
| POST | `/leader-applications` | ACTIVE USER; LEADER receives `LEADER_CANNOT_APPLY` |
| GET | `/leader-applications/me?page=1&limit=10` | ACTIVE USER or LEADER, own history only |
| GET | `/leader-certificate-types` | ACTIVE USER, LEADER or ADMIN |
| GET | `/admin/leader-applications?status=SUBMITTED&search=&page=1&limit=20` | ACTIVE ADMIN |
| GET | `/admin/leader-applications/:id` | ACTIVE ADMIN; private document URLs included |
| PATCH | `/admin/leader-applications/:id/review` | ACTIVE ADMIN |

Swagger includes these under **Leader applications SF01**. List limits are 1–100. Lists sort by submission date descending, then ID. Admin search matches applicant name or email. Terminal applications are immutable. No update/delete/withdraw application endpoints are exposed in this MVP.

The versioned contract is `contracts/openapi/sf01.json` (six business routes plus three media dependencies). Regenerate it with `npm run openapi:sf01`; runtime Swagger is also generated from the controllers. This scoped export does not rewrite unrelated teams' API contracts.

## Private certificate uploads

Reuses the existing Media module and Cloudinary account. No second storage system is introduced.

1. `POST /media/upload-intents` with the following body:

```json
{
  "scope": "LEADER_CERTIFICATE",
  "resourceType": "IMAGE",
  "fileName": "certificate.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 102400,
  "captureSource": "FILE"
}
```

2. POST multipart data to the returned `upload.uploadUrl`, including **every** returned `upload.formFields` field and a `file` containing the binary.
3. `POST /media/:mediaId/complete` with `{ "publicId": "<public_id>", "version": 123, "signature": "<signature>" }` from the provider response.
4. Only after completion returns `READY`, use **mediaId (UUID) as fileKey** in the application request. Arbitrary URLs/storage paths are not accepted.

JPEG, PNG and PDF use Cloudinary's `image` resource type; PDF retains all pages. The shared `MEDIA_MAX_IMAGE_BYTES` applies to certificates. Image dimensions use the existing image policy; PDF does not use photo dimension checks. Validation uses provider metadata, actual detected format, bytes, delivery type, public ID and signed upload response, not the submitted MIME label alone. The project has no antivirus integration; no claim of malware scanning is made. The shared storage policy can add scanning later before READY.

Certificate upload requests are signed with `type=authenticated`, `overwrite=false` and an allowed-format list. Upload request signatures remain SHA-256. Response verification accepts Cloudinary's supported SHA-1/SHA-256 hex digests using the v1 response canonical string and constant-time comparison; request signing in the installed SDK uses v2. See [Cloudinary response signatures](https://cloudinary.com/documentation/response_signatures).

`GET /media/:mediaId/delivery?variant=DOCUMENT_ORIGINAL` allows the ACTIVE owner or ADMIN only; warehouse/delivery staff have no certificate access. It returns the original PDF/image and its URL expiry. Other variants cannot issue permanent certificate URLs. The adapter uses [Cloudinary private_download_url](https://cloudinary.com/documentation/control_access_to_media#providing_time_limited_access_to_private_media_assets), including the signed expiry, rather than a permanent signed CDN URL. Responses containing download URLs are `Cache-Control: private, no-store`.

The returned URL is a short-lived bearer capability: anyone holding it can use it until expiry. Ownership is checked when issuing the URL. URLs must not be logged or shared. `leader_certificates.file_url` stores `media:<UUID>`, never a temporary signed URL; the additional nullable `media_asset_id` FK identifies new private documents. Legacy certificate rows remain unchanged.

Each submitted certificate gets a distinct uploaded media asset. Reapplication needs new uploads; history and the original evidence remain attached to the previous application. Referenced files are excluded from cleanup/deletion, with a DB trigger guarding submit/delete races. Unsubmitted READY files use the shared orphan-retention policy.

## Submit and review examples

```json
{
  "motivation": "Mong muốn dẫn đoàn trekking an toàn",
  "experienceSummary": "Kinh nghiệm hoạt động ngoài trời",
  "certificates": [{
    "typeCode": "FIRST_AID",
    "certificateNumber": "FA-2026-001",
    "issuer": "Đơn vị cấp",
    "issuedAt": "2026-01-10",
    "expiresAt": "2028-01-10",
    "fileKey": "00000000-0000-4000-8000-000000000001"
  }]
}
```

Submit returns 201 with `id`, `status=SUBMITTED`, `submittedAt`, `certificateCount`. The registry contains FIRST_AID, TOUR_GUIDING, OUTDOOR_SAFETY, RESCUE and OTHER. These are product categories, not legal licensing assertions. OTHER requires `otherTypeName` (maximum 94 characters); storage uses `OTHER:<name>`, reads decode it. Foreign `userId`, `verifiedBy`, status and other unknown DTO fields are rejected.

```json
{
  "decision": "APPROVED",
  "certificateReviews": [
    { "certificateId": "00000000-0000-4000-8000-000000000002", "status": "VERIFIED" },
    { "certificateId": "00000000-0000-4000-8000-000000000003", "status": "REJECTED", "rejectionReason": "Không xác minh được" }
  ]
}
```

Approval requires all PENDING certificates to be reviewed and at least one VERIFIED certificate valid on the business date in **Asia/Ho_Chi_Minh**. Expiry is inclusive: a certificate expiring today is valid today. Future issue dates are not valid proof yet. Null expiry requires the admin's manual verification; there is no automatic expiry/revocation job. Duplicate/foreign certificate review IDs are rejected.

```json
{ "decision": "REJECTED", "rejectionReason": "Hồ sơ chưa đủ minh chứng", "certificateReviews": [] }
```

Application rejection and individual certificate rejection require nonblank reasons. Rejecting an application without individual reviews leaves its certificate history PENDING. The application decision is authoritative. Only SUBMITTED applications can be reviewed; terminal and legacy UNDER_REVIEW states cannot be reviewed through this MVP endpoint.

Application, certificate decisions, verified profile, role and audit entries commit together. Row locks serialize submit/review; the partial unique index independently prevents multiple SUBMITTED/UNDER_REVIEW applications per user. Audit records include reviewer, time, request ID, decision and reviewed certificate IDs/status/reasons, never document URLs. The same authenticated token observes the new database role on the next request.

Promoted leaders can create Public Trips under existing CF01 rules. Existing Private Trip creators keep owner/host operations; they cannot create a new Private Trip. Ownership is still enforced by the private-trip repository.

## Validation and errors

Success payloads are business objects. All errors use the existing GlobalErrorFilter `{error:{code,message,details?,retryable},meta:{requestId,serverTime,contractVersion}}` envelope. Structural DTO errors return 400 `VALIDATION_ERROR` with field details, consistent with the shared ZodValidationPipe. Business failures return the following registered codes:

| HTTP | Codes |
| --- | --- |
| 403 | FORBIDDEN, LEADER_CANNOT_APPLY |
| 404 | APPLICATION_NOT_FOUND, DOCUMENT_NOT_FOUND; shared MEDIA_NOT_FOUND for missing assets |
| 409 | APPLICATION_ALREADY_PENDING, APPLICATION_NOT_REVIEWABLE |
| 422 | CERTIFICATE_REQUIRED, INVALID_CERTIFICATE_TYPE, INVALID_CERTIFICATE_FILE, INVALID_CERTIFICATE_REVIEW, CERTIFICATE_EXPIRED, REJECTION_REASON_REQUIRED, NO_VALID_CERTIFICATE |

Media retains its established validation/provider errors. Legacy certificate rows without private media links are preserved but cannot receive secure URLs; admin detail returns DOCUMENT_NOT_FOUND for these rows rather than exposing a legacy URL.

## Configuration and migration

| Setting | Default |
| --- | --- |
| LEADER_MAX_CERTIFICATES | 10 (range 1–100) |
| LEADER_DOCUMENT_URL_TTL_SECONDS | 300 (range 30–900) |
| MEDIA_MAX_IMAGE_BYTES | Existing shared image limit |

Migration: `20261013010000_sf01_leader_applications`. Adds the media scope, nullable certificate-media FK with unique index, one-open-application partial unique index, and evidence-retention trigger. It aborts if duplicate open applications exist and never rewrites or deletes history. Do not use `prisma db push` to manage the partial index.

## Verification

```powershell
# Only an isolated localhost database named sf01_test* is accepted.
$env:SF01_TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/sf01_test'
npm run test:sf01

# Optional real provider acceptance: uploads a synthetic PDF and deletes it in finally.
$env:SF01_LIVE_STORAGE_TEST = '1'
npm run test:sf01
```

The tests exercise shared authentication/role guards and GlobalErrorFilter against PostgreSQL, concurrent submissions/reviews, rollback after a DB failure, private ownership, reapplication, certificate encoding/date validation, role refresh, public creation and old private-trip ownership. Provider acceptance additionally checks actual PDF upload/completion/download, expired URLs and unsigned access. Standard runs skip that external-provider test unless explicitly enabled.

### Verification performed 13 October 2026

- Prisma schema validation, client generation and Nest build passed.
- SF01: 15 local/HTTP/PostgreSQL cases passed; the separate opt-in Cloudinary PDF acceptance case also passed against the configured provider. Synthetic files were deleted after each provider test.
- Media regression: 120 tests passed. CF01/CF02/CF03/CF04 regression: 62 tests passed.
- All migrations applied successfully to a clean isolated PostgreSQL database. Upgrade testing preserved seeded application/certificate history and verified that duplicate open applications abort migration safely.
- Configured project database: all existing migration checksums matched (allowing line-ending normalization); duplicate-open preflight returned zero. Migration `20261013010000_sf01_leader_applications` was applied successfully. No application/certificate/user business data was seeded into the project database.
- The broad `tsc --noEmit` check also includes pre-existing Area B tests with three optional-secret typing errors in `test/area-b-phase-04-e2e.spec.ts`; the backend build and targeted suites above pass.
