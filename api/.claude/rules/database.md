# Database and migrations

- Single `prisma/schema.prisma` (shared by all teams); `DIRECT_URL` is used for migrations. Background schedulers use `@nestjs/schedule`; several use raw SQL with row locks.
- Only add new additive migrations under `prisma/migrations/`. Never edit applied migrations, never `migrate reset`.
- The README's `prisma db push` is for throwaway local setup only — do not use it against the shared database.
