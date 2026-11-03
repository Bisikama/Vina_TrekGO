# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TrekGo mobile app: Expo 58 / React Native with expo-router, for User, Leader and Staff roles. It lives in the `mobile/` folder of a monorepo alongside `api/` (NestJS) and `web/` (Next.js). Product flows are described in `docs.md`, `FULL_PUBLIC_TRIP_FLOW.md` and `Private_Trip.md`.

## Commands

Run from `mobile/`:

```bash
npm start                # expo start (also: npm run android | ios | web)
npm run lint             # expo lint
npx tsc --noEmit         # type check
npm run api:gen          # generate client from a running backend's /docs-json (DOCS_JSON_URL overrides)

npm run test:trip-gps    # three of the eight test files
npm run test:offline-map # offline map pack logic
node --test src/services/storage/personal-trail.regression.test.cjs   # single file
node --test --test-name-pattern="<regex>" <file>                      # single test
```

- Tests use `node:test` in `*.test.cjs` files; there is no Jest. They transpile TS sources with `typescript` and run them in a `vm` with stubbed imports, so a new import in a tested module can fail with `Unexpected import` until the test's overrides include it.
- `npm run test:trip-gps` omits `useTripGps.regression`, `personal-trail.regression`, `personalTrailSimulation` and `trip-share`; run those directly.
- `trip-gps.v2.test.cjs` needs Node 22+ (`node:sqlite`). Native collector and background behaviour needs a device.
- CI for `mobile/` (`.github/workflows/ci.yml`) runs on Node 20: lint (non-blocking) and `tsc --noEmit` (blocking). It does not run these tests.

## Environment

`.env` is git-ignored and holds `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_MAPTILER_API_KEY` and `EXPO_PUBLIC_MAPTILER_STYLE_ID`. The API URL differs by target: Android emulator `http://10.0.2.2:3000`, iOS simulator/web `http://127.0.0.1:3000`, physical phone the computer's LAN IP.

## Architecture

**Routing.** `src/app/` holds file-based routes, with typed routes enabled. Most route files are thin and render screens from `src/features/<domain>/`. `src/app/_layout.tsx` sets the provider order (`AuthProvider` → `TripGpsLifecycle` → `AppProvider` → `RentalSelectionProvider`) and does role-based redirects: `STAFF_INVENTORY` → `/inventory-operations`, `STAFF_DELIVERY` and `LEADER` → `/field-operations`, everyone else → `/(tabs)`. New top-level routes may need checking against these redirects.

**API access.** Call the backend through `apiRequest` in `src/lib/api-client.ts`. It attaches the stored token, retries once after a single shared refresh on 401, applies a 15s default timeout, and throws `ApiError` (`status`, `code`, `details`, `retryable`) with status 0 for network failures. It reads the backend's `{ error: { code, message, details, retryable } }` envelope. Domain calls live in each feature's `services/*.api.ts` or `api.ts`. `src/api/generated` is git-ignored and absent by default, and app code does not import it.

**Global state.** `src/context/AppContext.tsx` is a very large provider that combines legacy mock data (`src/data/mockData`), the mock `authRole` switcher, offline packages and personal-trail sync. Real sessions live in `features/auth/AuthContext`. Some leader `field-operations` screens still use `src/data/fieldOpsMock`, so check whether a screen is on real data before extending it.

**Two offline GPS systems, kept separate:**

- **Trip GPS** (`src/features/trip-gps/`) covers live group trips. `tripGpsRuntime` is a singleton outside React, driven by `TripGpsLifecycle` (auth changes, reconnect on network or foreground). It coordinates the collector, SQLite storage (`trip-gps.v2-storage`), the sync coordinator and the socket. The barrel exports `hooks/useTripGpsV2`; `hooks/useTripGps.ts` is the older implementation with the same hook name, so import from `@/features/trip-gps`.
  - The share image (`/trips/[id]/share`) uses the server's merged per-user route from `actual-routes/me`, not individual sessions. `TripShareButton` shows according to the route's `resultStatus`, not the trip's status.
  - When changing the GPS contract in `api/`, update all three copies (`src/modules/geo/application/trip-gps.contract.ts`, `docs/trip-gps.contract.ts`, the block embedded in `docs/GPS_IN_TRIP.md`), which a spec requires to be identical, and the `.strict()` schemas in `trip-gps-response.schemas.ts`.
- **Personal trails** (`src/services/storage/`, `src/services/location/`) cover solo recording. `recordingDatabase.ts` is the expo-sqlite store and `syncService.ts` drains its outbox (auto-started from `AppContext`). `backgroundLocationTask` must stay imported at module scope in `_layout.tsx` so the task is registered.

**Maps.** `components/map/MapLibre3DView.tsx` and `components/Trip3DMapView.tsx` run MapLibre GL inside a `WebView` from inline HTML, with the library embedded from `maplibre-bundle.generated.ts` (`npm run map:bundle`). Changes to map behaviour are made in that embedded JS and cross the RN/WebView bridge. `MapLibre3DView` loads style and tiles through a `trekgo://` protocol that reads `assets/maps/offline-map.db` via `services/map/offlineMapPack.ts` and falls back to the network for anything missing. `npm run map:build` creates the pack (regions are declared in `scripts/build-offline-map.cjs`); bump `OFFLINE_MAP_PACK_VERSION` after rebuilding. `offlineMapStorage` and `downloadOfflineTrail` are a separate mock that downloads nothing.

**Native config.** Background location, camera, sqlite and media library are set up through plugins in `app.json`, so plugin changes need a rebuild rather than a reload. The legacy functions exported by `expo-media-library`, such as `saveToLibraryAsync`, pass `tsc` but throw at runtime; use `Asset.create()`.

## UI conventions

- Reuse `@/components/ui` (`ScreenShell`, `SurfaceCard`, `Button`, `FormField`, `StatusBadge`, `LoadingState`, `ErrorAlert`, and others); see `src/components/ui/README.md`. It mirrors the web design language, "Tactical Topographic Utility".
- Use tokens from `@/constants/designTokens` (exported through the same barrel). Every number (price, km, slots, time) needs `Typography.tabularNums`, and money uses `formatVnd`.
- Use `ConfirmModal`, not `Alert.alert`, to confirm important actions.
- User-facing copy is Vietnamese.
- `stitch_trekgo_mobile_app/` and `src/leader_delivery_batch/` are static design references (`code.html`, `screen.png`) that app code does not import. Don't treat them as source.

## Repo-wide rules

The root `AGENTS.md` holds team conventions; read it before touching `api/` or booking and CF01 work. Keep mobile tasks inside `mobile/` unless the backend change is explicitly requested.
