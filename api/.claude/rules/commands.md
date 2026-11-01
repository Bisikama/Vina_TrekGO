# Commands, tests and CI

Run from `api/`.

```bash
npm run start:dev                 # watch mode; Swagger at http://localhost:3000/docs
npm run start:cf02-mock           # dev with mock payment provider + payment workers enabled
npm run build                     # nest build (CI builds with NODE_ENV=production)
npm run lint                      # eslint --fix
npm run format                    # prettier

npx prisma validate && npx prisma generate
npx prisma migrate dev --create-only --name <name>   # author a new additive migration
npx prisma migrate deploy                            # what CI runs
```

## Tests (Jest + ts-jest)

```bash
npm test                                   # unit specs under src/**/*.spec.ts (rootDir=src)
npx jest src/modules/bookings/booking-policy.spec.ts       # single unit spec
npx jest src/modules/geo -t "name of test"                 # filter by test name

# Suites under test/ need their own config (default config only sees src/):
npm run test:cf01                          # test/cf01.(integration|http).spec.ts — runs in CI
npm run test:cf02 | test:cf03 | test:cf04 | test:sf01 | test:payments | test:gear
npx jest --config test/jest-area-b.json --runInBand        # Area B rental phases
npx jest --config test/jest-cf01.json --runInBand test/cf01.http.spec.ts   # single file
```

## CI

CI (`../.github/workflows`) runs: `prisma validate` → `generate` → `migrate deploy` → `build` → `npm test -- --runInBand --forceExit` → `test:cf01`.

Integration specs that touch a real DB read `PAYMENT_TEST_DATABASE_URL` / `AREAB_TEST_DATABASE_URL`; never point them at shared data.

## Seeds and OpenAPI

- Seeds: `npx prisma db seed` (`prisma/seed.ts`), plus targeted `npm run seed:*` scripts (booking-policies, gear-rules, damage-rules, gps-policy, coreflows, booking-all, demo-prereqs). See `HUONG_DAN_SEED_DU_LIEU.md`.
- OpenAPI snapshots: `npm run openapi:generate` (and `openapi:sf01`, `openapi:booking-policies`, `openapi:trip-gps`) write into `contracts/openapi/`.
