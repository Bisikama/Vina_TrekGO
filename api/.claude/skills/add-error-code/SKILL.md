---
name: add-error-code
description: Add a new business error code to the TrekGo backend the correct way (code constant, barrel export, ERROR_DEFINITIONS entry, usage via AppError). Use when a feature needs a new AppError code or when an AppError returns HTTP 500 because its code is not registered.
---

# Add a business error code

Unregistered codes become HTTP 500, so all four steps are required.

1. **Constant** — add the code to the matching file in `src/shared/errors/codes/<area>.error-codes.ts` (for example `booking.error-codes.ts`). Follow the file's existing style:
   ```ts
   export const BOOKING_ERROR_CODES = {
     // ...
     NEW_CODE_NAME: 'NEW_CODE_NAME',
   } as const
   ```
   Only create a new `<area>.error-codes.ts` if no existing area fits.

2. **Barrel** — if you created a new file, export it from `src/shared/errors/index.ts`:
   ```ts
   export * from './codes/<area>.error-codes'
   ```

3. **Definition** — register it in `src/shared/errors/error-definitions.ts` (import the constant with the alias already used there, e.g. `B` for booking):
   ```ts
   [B.NEW_CODE_NAME]: { status: 409, message: 'Short, user-safe message', retryable: false },
   ```
   Pick the status by meaning: 400 bad input, 403 not allowed, 404 not found, 409 state/version conflict, 422 business rule violated, 503 temporarily unavailable (usually `retryable: true`).

4. **Throw it** where the rule fails:
   ```ts
   throw AppError.fromCode(BOOKING_ERROR_CODES.NEW_CODE_NAME, { details: { bookingId } })
   ```
   Do not throw raw `HttpException` in new code (the legacy CF01 `fail()` / `TripErrorFilter` path is the only exception, and is migrated only when asked).

5. **Swagger & test** — document the response with the helpers in `src/shared/swagger/api-error-response.helper.ts`. In the HTTP test for the flow, assert `response.body.error.code === 'NEW_CODE_NAME'` and the status.
