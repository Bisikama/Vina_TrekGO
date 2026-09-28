# Booking / CF01 conventions

- Keep requested implementation scoped to booking and CF01; preserve other teams' auth, rental, trail and checkpoint modules. Reuse shared modules rather than introducing competing infrastructure.
- Before changing API error handling, read `api/src/shared/errors/` and `api/src/shared/pipes/zod-validation.pipe.ts`.
- Use shared `AppError` for business failures. Define booking-specific codes under `api/src/shared/errors/codes/`, export them through the shared barrel, and register their HTTP status, default message and retryability in `ERROR_DEFINITIONS`. Unregistered AppError codes default to HTTP 500.
- Let the shared `GlobalErrorFilter` format responses as `{ error: { code, message, details, retryable }, meta: { requestId, serverTime, contractVersion } }`. Do not introduce booking-specific response envelopes or controller filters that bypass this contract.
- Reuse `ZodValidationPipe` for request validation where applicable. Booking clients must read `response.data.error`, not assume top-level `message` or `code`. Test the global filter in HTTP tests when changing the error contract.
- Existing CF01 `TripErrorFilter` and its client still use the older envelope; migrate them together when an error-handling implementation change is requested. Reading these conventions alone is not authorization for a broad refactor.
- Database changes use new additive migrations; never rewrite applied migrations or reset the database. The user permits applying requested migrations to the configured project database. Warn before changes that risk data loss.
- Keep tests focused on the main flow, important business rules and meaningful failure cases; avoid redundant test files and auxiliary harnesses.
