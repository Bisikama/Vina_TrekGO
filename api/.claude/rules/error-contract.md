# Error contract

- Throw `AppError` (`AppError.fromCode(CODE, { details })`) for business failures. Codes live in `src/shared/errors/codes/*.error-codes.ts`, are re-exported from `src/shared/errors/index.ts`, and **must be registered in `ERROR_DEFINITIONS`** (status, message, retryable) — unregistered codes become HTTP 500.
- `GlobalErrorFilter` emits `{ error: { code, message, details, retryable }, meta: { requestId, serverTime, contractVersion } }`. `HttpException` 400/401/403 are mapped to common codes.
- `ZodValidationPipe(schema)` validates body/query/params; failures surface as `VALIDATION_ERROR` with `details` = `[{ field, message }]`.
- Legacy: `trips/presentation/trip-error.filter.ts` (`TripErrorFilter`) is still applied on some trip/geo/weather controllers with the older envelope. Migrate it only together with its client and only when asked.
- Swagger error responses use helpers in `src/shared/swagger/api-error-response.helper.ts`.
