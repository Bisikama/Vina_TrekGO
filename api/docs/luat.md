# TREKGO - AREA C FUNCTIONAL REQUIREMENTS

**Authentication via Supabase / 3D Map / GPS Tracking / Route Deviation / Checkpoint Mission / Weather**  
**Owner:** Luật

---

## 1. MỤC ĐÍCH TÀI LIỆU

Tài liệu này đặc tả Functional Requirement cho mảng C do Luật phụ trách. Mảng C gồm hai nhóm trách nhiệm:
1. **Authentication:** Dùng Supabase Auth cho toàn hệ thống.
2. **Trải nghiệm GPS/Map:** Bản đồ 3D và định vị trong chuyến trekking.

Tài liệu giữ cùng template với Mảng A Booking và Mảng B Rental để team dễ review và tích hợp.

MVP ưu tiên Authentication ổn định, bản đồ 3D, current GPS, ghi lại đường đi ở mức near-real-time/cơ bản, cảnh báo lệch route, checkpoint detection + mở nhiệm vụ và Weather API. Chat/Realtime group location chính xác cao và user tạo Trail từ GPS recording được xếp P2/P1 mở rộng tùy tiến độ.

---

## 2. PHẠM VI DOMAIN & OWNERSHIP

| Domain / Entity | Owner chính | Mảng C được phép làm gì | Mảng khác được phép làm gì |
| :--- | :--- | :--- | :--- |
| **Supabase Authentication** | Luật / Shared Platform | Tích hợp sign-up/login/logout/reset/session; backend verify Supabase JWT; mapping auth user -> TrekGo User; RBAC guard. | Các mảng A/B consume current user/role; không tự viết auth riêng. |
| **User Profile / Role** | Mảng A/Shared, Luật integration | Bootstrap identity và đọc role để guard; không tự thay business role nếu không có API được phép. | Admin/Area A có thể quản lý role theo contract. |
| **Map / GPS Session** | Luật | 3D map, current location, route rendering, GPS session, location samples, actual path, trip progress. | Mảng A cung cấp Trip/Trail/Checkpoint context. |
| **Route Deviation Alert** | Luật | Tính deviation từ active route, tạo alert, hiển thị cho User/Leader. | Mảng A không tự tính GPS deviation. |
| **Checkpoint Detection / Mission Unlock** | Luật | Xác thực User đã vào checkpoint radius, ghi arrival, mở mission theo context. | Mảng A sở hữu checkpoint/mission definition và required/optional rule. |
| **Weather Integration** | Luật | Call provider, cache/normalize weather, trả weather summary/risk theo Trip/location. | Mảng A/B consume summary nếu cần. |
| **User-created Trail From GPS** | Luật recording + Mảng A Trail owner | Luật ghi GPS path, simplify/prepare geometry; gửi Trail Draft/Proposal sang Mảng A. | Mảng A mới là source of truth của Trail. |

---

## 3. ROLE LIÊN QUAN

| Role | Quyền chính trong mảng C |
| :--- | :--- |
| **User** | Đăng ký/đăng nhập; mở bản đồ Trip; xem current GPS; nhận cảnh báo lệch route; checkpoint mission optional; xem thời tiết; xem path cá nhân. |
| **Leader** | Toàn quyền User + xem cảnh báo route deviation của đoàn ở mức MVP phù hợp; checkpoint mission/evidence bắt buộc theo rule; nhận SOS/incident nếu tích hợp. |
| **Admin** | Quản lý/giám sát account ở lớp ứng dụng; xem incident/audit; không dùng Supabase service-role từ frontend. |
| **System** | Verify JWT, ingest GPS samples, tính deviation, validate checkpoint arrival, phát event/notification, cache weather. |

---

## 4. KIẾN TRÚC AUTHENTICATION VỚI SUPABASE

Supabase Auth là Identity Provider. Frontend Web/Mobile sử dụng Supabase SDK để đăng ký, đăng nhập, logout, refresh session và reset password. Backend NestJS KHÔNG tự lưu password; mọi API TrekGo nhận Bearer Access Token và guard xác minh token Supabase trước khi vào business service.

| Thành phần | Trách nhiệm |
| :--- | :--- |
| **Supabase Auth** | Quản lý identity, email/password, session/access token/refresh token, email reset/verification nếu bật. |
| **Frontend Web/Mobile** | Gọi Supabase Auth SDK, giữ session theo SDK, gửi access token vào Authorization header khi gọi TrekGo API. |
| **NestJS Auth Guard** | Verify access token/JWT bằng cơ chế Supabase/JWKS hoặc server-side verification; reject token sai/hết hạn. |
| **TrekGo User Table** | Lưu authUserId (Supabase user id), profile và application role/rank. Không lưu password/hash của Supabase. |
| **RBAC Guard** | Sau khi identity hợp lệ, đọc role/permissions của TrekGo và kiểm tra User/Leader/Staff/Admin. |
| **Service Role Secret** | Chỉ server-side environment/secret store; tuyệt đối không đưa vào Web/Mobile bundle. |

---

## 5. STATE MODEL BASELINE

| Entity | State đề xuất cho MVP | Ghi chú |
| :--- | :--- | :--- |
| **Auth Session** | `UNAUTHENTICATED` -> `AUTHENTICATED` -> `EXPIRED/REFRESHED` -> `SIGNED_OUT` | Supabase quản lý session; backend chỉ tin token hợp lệ. |
| **GPS Session** | `IDLE` -> `ACTIVE` -> `PAUSED(optional)` -> `STOPPED` | Chỉ active khi User tham gia Trip phù hợp. |
| **GPS Sample** | `RECEIVED` -> `VALIDATED` -> `STORED/IGNORED` | Ignore sample accuracy quá kém theo config. |
| **Route Status** | `ON_ROUTE` -> `DEVIATED` -> `RECOVERED` | Deviation phải qua ngưỡng và có debounce/consecutive samples. |
| **Checkpoint Event** | `PENDING` -> `ARRIVED` -> `MISSION_UNLOCKED` -> `COMPLETED` \| `SKIPPED` | Leader/User rule khác nhau do Mảng A cung cấp. |
| **Weather Snapshot** | `FRESH` -> `STALE` -> `REFRESHED` | Cache để giảm API call. |
| **Trail Recording (Extension)** | `RECORDING` -> `STOPPED` -> `PROCESSED` -> `SUBMITTED_TO_TRAIL` | P2/P1 extension. |

---

## 6. PHASE 0 - AUTHENTICATION / SESSION / RBAC

Auth là nền dùng chung cho cả 3 mảng và nên được khóa contract sớm nhất.

### Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-FR-001** | Sign Up | P0 | Visitor | Chưa có account | Đăng ký bằng email/password qua Supabase Auth; sau auth success tạo/bootstrap TrekGo User profile. | Có Supabase identity + TrekGo User. | Không lưu password trong TrekGo DB. |
| **RC-FR-002** | Login | P0 | Visitor | Có account | Đăng nhập qua Supabase; nhận session/access token; frontend dùng token gọi backend. | Authenticated session. | Error normalize cho FE. |
| **RC-FR-003** | Logout | P0 | User | Authenticated | Sign out Supabase client; xóa local session/cache nhạy cảm. | Unauthenticated. | Backend token cũ hết hiệu lực theo Supabase session semantics. |
| **RC-FR-004** | Backend Token Verification | P0 | System | API có Bearer token | NestJS guard verify Supabase token, map authUserId -> TrekGo User, check disabled/banned nếu có. | Request có currentUser. | 401 token invalid; 403 account blocked. |
| **RC-FR-005** | RBAC | P0 | System | Identity valid | Guard role/permission cho User/Leader/Staff Kho/Staff Logistics/Admin. | API đúng role mới chạy. | Role là application data. |
| **RC-FR-006** | Forgot/Reset Password | P1 | Visitor/User | Email hợp lệ | Dùng Supabase reset flow; app xử lý deep-link/reset screen. | Password đổi qua Supabase. | Không implement password reset custom backend. |
| **RC-FR-007** | Session Refresh | P0 | Frontend | Session tồn tại | Dùng Supabase SDK refresh/auto-refresh; retry API khi token được renew theo policy. | Session liên tục. | Tránh tự viết refresh-token endpoint TrekGo. |

### API Contracts

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-API-001** | Supabase SDK: `auth.signUp` | Visitor | Đăng ký | `email`, `password` | Supabase session/user | Provider validation. |
| **RC-API-002** | Supabase SDK: `auth.signInWithPassword` | Visitor | Login | `email`, `password` | session/access token | Normalize auth errors ở UI. |
| **RC-API-003** | Supabase SDK: `auth.signOut` | User | Logout | - | signed out | Clear app cache. |
| **RC-API-004** | `GET /api/v1/auth/me` | Any Auth User | Current TrekGo identity | Bearer token | `userId`, `profile`, `roles`, `permissions` | JWT guard trước controller. |
| **RC-API-005** | `POST /api/v1/auth/bootstrap` | Auth User | Tạo/map profile lần đầu | Bearer token, minimal profile | TrekGo user profile | Idempotent theo authUserId. |
| **RC-API-006** | `PATCH /api/v1/users/me` | User | Update profile cơ bản | `displayName`, `phone`,... | updated profile | Không update role qua endpoint này. |
| **RC-API-007** | Supabase SDK: `resetPasswordForEmail` / `updateUser` | Visitor/User | Reset password | email/new password via reset session | provider result | P1. |

---

## 7. PHASE 1 - LOAD TRIP NAVIGATION CONTEXT / MAP 3D

Mảng C không sở hữu Trail/Trip. Khi User mở Trip trên Mobile, C lấy context từ Mảng A rồi render bản đồ 3D.

### Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-FR-101** | Load Navigation Context | P0 | User/Leader | Có Trip accessible | Lấy active/planned Trail geometry, required checkpoints, checkpoint radius/mission summary và Trip status từ Mảng A. | Có navigation model local. | Cross-domain A <-> C. |
| **RC-FR-102** | Render 3D Map | P0 | User/Leader | Context loaded | Hiển thị route polyline, checkpoint markers, current user marker và basic progress trên bản đồ 3D. | Map sử dụng được. | Provider adapter để dễ đổi Mapbox/Google/MapLibre. |
| **RC-FR-103** | Active Trail Update | P0 | Leader/User | Trip IN_PROGRESS | Khi Leader switch verified Trail bên Mảng A, Mảng C nhận active route mới và render lại. | Map theo route active. | Required checkpoints không bị mất. |

### API Contracts

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-API-101** | `GET /api/v1/trips/:tripId/navigation-context` | User/Leader | Lấy context cho map | `tripId` | `tripStatus`, `activeTrail`, `plannedTrails`, `requiredCheckpoints` | OWNER: Mảng A; C consume. |
| **RC-API-102** | `GET /api/v1/geo/trips/:tripId/map-state` | User/Leader | Map/GPS state tổng hợp | `tripId` | `gpsSession`, `progress`, `deviation`, `lastLocation` | Mảng C own. |

---

## 8. PHASE 2 - GPS SESSION / THEO DÕI VỊ TRÍ / VẼ ĐƯỜNG ĐI

MVP không yêu cầu realtime chính xác từng giây. Ưu tiên near-real-time hoặc periodic sync để đủ demo và giảm complexity.

### Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-FR-201** | Start GPS Session | P0 | User/Leader | Trip cho phép tracking + location permission | Tạo session tracking cho User trong Trip. | GPS Session ACTIVE. | Một user/trip chỉ một session active. |
| **RC-FR-202** | Collect Location Samples | P0 | Mobile App | GPS session active | Lấy lat/lng, timestamp, accuracy, optional speed/heading; lọc sample accuracy kém. | Có sample hợp lệ. | Không cần 1Hz realtime cho MVP. |
| **RC-FR-203** | Batch/Periodic Sync | P0 | Mobile App/System | Có samples | Gửi sample theo batch/interval (ví dụ 10-30s hoặc theo distance threshold cấu hình). | Server có path gần realtime. | Batch giảm pin/network. |
| **RC-FR-204** | Draw Actual Path | P0 | Mobile App | Có samples | Vẽ polyline đường User đã đi từ local/server samples. | User thấy actual path. | Có thể simplify path để giảm điểm. |
| **RC-FR-205** | Trip Progress | P1 | User/Leader | GPS active | Tính summary distance/path/checkpoint progress ở mức cơ bản. | Có progress view. | Không cần analytics phức tạp. |
| **RC-FR-206** | Stop GPS Session | P0 | User/System | Trip complete/exit | Dừng session, flush samples cuối, đóng summary. | Session STOPPED. | Trip completion event có thể auto-stop. |

### API Contracts

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-API-201** | `POST /api/v1/geo/trips/:tripId/sessions` | User/Leader | Start GPS session | `deviceId?` | `sessionId`, `status` | Validate Trip access/status. |
| **RC-API-202** | `POST /api/v1/geo/sessions/:sessionId/locations/batch` | User/Leader | Upload samples | `locations[{lat,lng,at,accuracy,...}]` | `acceptedCount`, `lastProcessedAt` | Reject impossible/poor samples by rule. |
| **RC-API-203** | `GET /api/v1/geo/sessions/:sessionId/path` | Owner/Leader | Actual path | `from?`, `to?`, `simplify?` | `polyline/points`, `summary` | Privacy/role guard. |
| **RC-API-204** | `GET /api/v1/geo/trips/:tripId/progress` | User/Leader | Trip GPS progress | `tripId` | `lastLocation`, `pathSummary`, `checkpointProgress` | Leader group view can be P1. |
| **RC-API-205** | `POST /api/v1/geo/sessions/:sessionId/stop` | User/System | Stop session | `reason` | final summary | Idempotent. |

---

## 9. PHASE 3 - CẢNH BÁO ĐI LỆCH ĐƯỜNG

Hệ thống so vị trí hiện tại với active Trail polyline. Cảnh báo cần debounce để tránh GPS noise.

### Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-FR-301** | Compute Route Distance | P0 | System | Location valid + active route | Tính khoảng cách từ GPS point đến polyline route active. | Có deviation distance. | Ngưỡng X configurable. |
| **RC-FR-302** | Deviation Detection | P0 | System | distance > threshold | Chỉ mark DEVIATED nếu vượt ngưỡng trong N sample/liên tục theo config; recovered khi quay lại route. | Route status thay đổi. | Giảm false positive. |
| **RC-FR-303** | Warn Current User | P0 | Mobile App | DEVIATED | Hiển thị cảnh báo local/app cho User. | User biết lệch route. | Không cần chờ server nếu local compute được. |
| **RC-FR-304** | Alert Leader | P0 | System/Leader | Member deviated | Gửi deviation event cho Leader ở mức near-real-time/polling/notification; gồm user, last GPS, distance, time. | Leader thấy cảnh báo. | Group live-map chính xác cao là P2. |
| **RC-FR-305** | Deviation History | P1 | Leader/Admin | Trip active/completed | Lưu event start/recovered để review safety. | Có audit trail. | Không cần lưu mọi sample vĩnh viễn. |

### API Contracts

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-API-301** | `GET /api/v1/geo/trips/:tripId/deviations` | Leader | Xem alerts hiện tại/lịch sử | `status?`, `userId?` | deviation events | Leader của Trip/authorized only. |
| **RC-API-302** | `GET /api/v1/geo/trips/:tripId/members/last-locations` | Leader | Last known locations | `tripId` | `memberId`, `lastLocation`, `routeStatus` | P1 near-real-time; privacy guard. |

---

## 10. PHASE 4 - CHECKPOINT DETECTION & MỞ NHIỆM VỤ

Mảng A định nghĩa Checkpoint/Mission; mảng C chịu trách nhiệm phát hiện arrival dựa GPS và mở nhiệm vụ đúng role.

### Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-FR-401** | Detect Checkpoint Arrival | P0 | System/Mobile | Trip active + checkpoint context | Khi GPS vào bán kính checkpoint, tạo arrival candidate; backend validate distance/time/member. | Checkpoint ARRIVED. | Radius do A/context/config cung cấp. |
| **RC-FR-402** | Idempotent Arrival | P0 | System | Arrival đã tồn tại | Không tạo duplicate checkpoint event khi GPS dao động trong radius. | Một arrival hợp lệ. | Unique user/trip/checkpoint/event type. |
| **RC-FR-403** | Unlock Mission For User | P0 | User | ARRIVED + mission applicable | Trả/unlock mission nếu checkpoint có nhiệm vụ User; User mission có thể optional. | MISSION_UNLOCKED. | Definition do A cung cấp. |
| **RC-FR-404** | Unlock Leader Mission | P0 | Leader | ARRIVED + leader mission | Mở nhiệm vụ/evidence bắt buộc cho Leader theo Trip rule. | Leader thấy mission. | Completion/evidence API có thể A own hoặc C orchestrate. |
| **RC-FR-405** | Checkpoint Completion Event | P0 | System/User/Leader | Mission complete/check-in complete | Ghi event và phát contract cho Mảng A cập nhật Trip progress/completion logic. | Trip checkpoint progress cập nhật. | Cross-domain C -> A. |

### API Contracts

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-API-401** | `POST /api/v1/geo/trips/:tripId/checkpoints/:checkpointId/arrivals` | User/Leader | Validate arrival | `lat`, `lng`, `accuracy`, `at` | `arrival`, `unlockedMissions` | 403/422 nếu quá xa/Trip invalid. |
| **RC-API-402** | `GET /api/v1/geo/trips/:tripId/checkpoint-progress` | User/Leader | Checkpoint progress | `tripId` | `arrived`, `completed`, `remaining` | Role scope. |
| **RC-API-403** | `POST /api/v1/geo/checkpoint-events/:eventId/mission-complete` | User/Leader | Complete mission/basic evidence | `answer`, `evidenceRef?` | completed event | Nếu mission business owned A, route có thể chuyển sang A API sau review. |

---

## 11. PHASE 5 - WEATHER API

Weather là integration riêng của Luật. Cần adapter + cache để không phụ thuộc chặt vào một provider.

### Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-FR-501** | Current Weather | P0 | User/Leader | Có Trip/location | Lấy current weather cho destination/current checkpoint area và normalize. | Weather widget có dữ liệu. | Cache theo location/time. |
| **RC-FR-502** | Trip Forecast | P1 | User/Leader | Trip upcoming | Forecast gần thời gian Trip nếu provider hỗ trợ. | Preparation weather. | Không block Booking khi provider lỗi. |
| **RC-FR-503** | Weather Risk Summary | P1 | System | Có weather data | Map provider condition thành summary: rain/wind/heat/storm risk để UI/leader tham khảo. | Risk flags. | Không tự động hủy Trip; Leader/Admin quyết định. |

### API Contracts

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-API-501** | `GET /api/v1/weather/trips/:tripId` | User/Leader | Weather theo Trip | `tripId` | `current`, `forecast`, `risk`, `updatedAt` | Need Trip geo context from A; cached. |
| **RC-API-502** | `GET /api/v1/weather/point?lat=&lng=` | Auth User | Weather point | `lat`, `lng` | normalized weather | Rate limit/cache. |

---

## 12. PHASE 6 - USER TỰ GHI CUNG ĐƯỜNG MỚI (MỞ RỘNG)

Đây là feature mở rộng. Luật chịu GPS recording; Mảng A vẫn là owner Trail và quyết định tạo Trail Draft/Unverified.

### Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-FR-601** | Start Trail Recording | P2 | User | Auth + location permission | User bắt đầu ghi GPS path ngoài Trip hoặc trong chế độ tạo cung đường. | Recording ACTIVE. | Không ảnh hưởng Trip GPS session. |
| **RC-FR-602** | Record/Simplify Path | P2 | Mobile/System | Recording active | Thu location samples; remove obvious noise/simplify geometry; tính distance cơ bản. | Processed path. | Không tự gán difficulty. |
| **RC-FR-603** | Create Trail Draft From Recording | P2 | User | Recording stopped | Gửi processed GeoJSON + metadata sang Trail domain để tạo Trail UNVERIFIED/DRAFT thuộc User. | Trail Draft được tạo ở Mảng A. | Cross-domain C -> A; A validates/persists Trail. |

### API Contracts

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-API-601** | `POST /api/v1/geo/trail-recordings` | User | Start recording | `name?` | `recordingId`, `status` | P2. |
| **RC-API-602** | `POST /api/v1/geo/trail-recordings/:id/locations/batch` | User | Upload route samples | `locations[]` | `acceptedCount` | P2. |
| **RC-API-603** | `POST /api/v1/geo/trail-recordings/:id/stop` | User | Stop/process | - | `geoJson`, `distance`, `summary` | P2. |
| **RC-API-604** | `POST /api/v1/geo/trail-recordings/:id/create-trail-draft` | User | Orchestrate Trail Draft | `title`, `description`, `checkpointCandidates?` | `trailId`, `status` | Calls A-owned Trail create contract; P2. |

---

## 13. API / EVENT CẦN PHỐI HỢP GIỮA CÁC MẢNG

Các contract này phải họp trước khi code vì Area C phụ thuộc mạnh vào Trip/Checkpoint và Authentication được cả A/B sử dụng.

| API / Event | Owner | Consumer | Purpose | Key Contract | Review Before Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Supabase Auth / JWT Guard** | Luật / Shared | A + B + C | Identity/session chung | `authUserId`, `accessToken`, `currentUser`, `roles` | Luật + Bảo + Quân |
| **`GET /trips/:id/navigation-context`** | Mảng A - Bảo | Mảng C - Luật | Render map/route/checkpoints | `tripId`, `status`, `activeTrailGeoJSON`, `requiredCheckpoints`, `radius`, `mission summary` | Bảo + Luật |
| **`ACTIVE_TRAIL_CHANGED` / Trail Switch** | Mảng A | Mảng C | Update route active | `tripId`, `fromTrailId`, `toTrailId`, `changedAt`, `reason` | Bảo + Luật |
| **`CHECKPOINT_ARRIVED` / `COMPLETED`** | Mảng C | Mảng A | Cập nhật Trip progress/completion | `tripId`, `checkpointId`, `userId`, `role`, `eventType`, `at` | Bảo + Luật |
| **`EVENT TRIP_STARTED`** | Mảng A | Mảng C | Cho start GPS session/tracking | `tripId`, `startAt`, `participants` | Bảo + Luật |
| **`EVENT TRIP_COMPLETED` / `INTERRUPTED`** | Mảng A | Mảng C | Stop GPS session + close progress | `tripId`, `status`, `endedAt` | Bảo + Luật |
| **`GET /internal/trips/:id/weather-context`** | Mảng A | Mảng C | Lấy geo/time context cho weather | `lat`, `lng`, `startAt`, `endAt`, `destinationId` | Bảo + Luật |
| **Trail Draft Create Contract** | Mảng A | Mảng C extension | Persist User-recorded route as Trail Draft | `creatorId`, `geoJson`, `name`, `metadata` | Bảo + Luật |
| **Auth current user / roles** | Luật / Shared | Mảng B - Quân | Rental role/ownership guard | `userId`, `roles`, `status` | Luật + Quân |
| **Deviation Notification** | Mảng C | Notification / Leader UI | Cảnh báo leader | `tripId`, `userId`, `lastLocation`, `distance`, `status`, `at` | Luật + integration owner |

---

## 14. BUSINESS RULE CỐT LÕI

| BR ID | Business Rule | Mức |
| :--- | :--- | :--- |
| **RC-BR-01** | Password/auth session do Supabase quản lý; TrekGo backend không lưu password Supabase. | P0 |
| **RC-BR-02** | Supabase service-role key chỉ tồn tại server-side; tuyệt đối không đưa vào Web/Mobile. | P0 |
| **RC-BR-03** | Mọi protected API phải verify Bearer token và RBAC trước business logic. | P0 |
| **RC-BR-04** | GPS tracking chỉ hoạt động khi có permission và User có quyền truy cập Trip. | P0 |
| **RC-BR-05** | MVP dùng periodic/batch GPS; không bắt buộc realtime từng giây. | P0 |
| **RC-BR-06** | Location sample phải có timestamp + accuracy; sample quá kém có thể ignore theo config. | P0 |
| **RC-BR-07** | Deviation chỉ tạo alert sau threshold + debounce/consecutive samples để tránh GPS noise. | P0 |
| **RC-BR-08** | Leader chỉ xem location/deviation của thành viên Trip mà Leader phụ trách. | P0 |
| **RC-BR-09** | Checkpoint arrival phải validate server-side theo checkpoint radius và idempotent. | P0 |
| **RC-BR-10** | Mission definition/required rule thuộc Trip/Checkpoint domain; C chỉ unlock/record execution. | P0 |
| **RC-BR-11** | Weather API failure không được làm fail Trip/Booking core flow. | P0 |
| **RC-BR-12** | Weather alert chỉ hỗ trợ quyết định; hệ thống không tự hủy Trip. | P1 |
| **RC-BR-13** | User-created Trail từ GPS là extension; persisted Trail phải qua A-owned Trail contract. | P2 |
| **RC-BR-14** | Actual path raw data cần retention/privacy policy; MVP có thể giới hạn sampling và thời gian lưu. | P1 |

---

## 15. ERROR CONTRACT / VALIDATION CHUNG

| HTTP Status | Code đề xuất | Ý nghĩa |
| :--- | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Payload/location fields sai. |
| **401** | `UNAUTHENTICATED` | Supabase token thiếu/sai/hết hạn. |
| **403** | `FORBIDDEN` | Không thuộc Trip/không đúng role/account bị khóa. |
| **404** | `TRIP_OR_GEO_SESSION_NOT_FOUND` | Entity không tồn tại. |
| **409** | `GPS_SESSION_ALREADY_ACTIVE` | Đã có session active. |
| **409** | `CHECKPOINT_ALREADY_ARRIVED` | Arrival duplicate/idempotent. |
| **422** | `CHECKPOINT_OUT_OF_RANGE` | Vị trí không nằm trong radius hợp lệ. |
| **422** | `LOCATION_ACCURACY_TOO_LOW` | Accuracy không đủ theo rule nếu cần reject. |
| **429** | `LOCATION_RATE_LIMITED` | Upload quá dày / abuse. |
| **502 / 503** | `WEATHER_PROVIDER_UNAVAILABLE` | Weather provider lỗi có kiểm soát. |

---

## 16. ENTITY / ERD TỐI THIỂU CHO MẢNG C

| Entity | Field / Relation quan trọng | Ghi chú ownership |
| :--- | :--- | :--- |
| **UserAuthMapping** | `userId`, `authUserId(supabase)`, `status` | Shared/auth integration; no password. |
| **GpsSession** | `id`, `userId`, `tripId`, `status`, `startedAt`, `endedAt`, `deviceId?` | C owner. |
| **GpsLocation** | `sessionId`, `lat`, `lng`, `accuracy`, `recordedAt`, `speed?`, `heading?` | Có thể partition/retention later. |
| **RouteDeviationEvent** | `tripId`, `userId`, `sessionId`, `status`, `startAt`, `recoveredAt`, `maxDistance`, `lastLocation` | C owner. |
| **CheckpointEvent** | `tripId`, `checkpointId`, `userId`, `role`, `arrivalAt`, `status`, `missionStatus` | C execution; checkpoint definition from A. |
| **WeatherSnapshot** | `tripId/lat/lng`, `provider`, `observedAt`, `payloadNormalized`, `riskSummary`, `expiresAt` | C owner/cache. |
| **TrailRecording** | `id`, `userId`, `status`, `startedAt`, `endedAt`, `processedGeoJson`, `distance` | Extension P2. |

---

## 17. ACCEPTANCE CRITERIA MVP CHO MẢNG C

* Web/Mobile đăng ký, đăng nhập, logout bằng Supabase và gọi được API TrekGo bằng Bearer token.
* Backend từ token xác định đúng TrekGo User và role; API sai role bị `403`.
* Mobile mở Trip hiển thị được map 3D, active Trail và required checkpoints từ API thật.
* GPS session start/stop được; app ghi location samples và vẽ actual path cơ bản.
* Periodic/batch sync hoạt động; không yêu cầu live từng giây.
* User lệch route vượt threshold đủ lâu thì nhận warning; Leader thấy deviation alert/last-known location ở mức MVP.
* Đến checkpoint trong radius hợp lệ tạo event duy nhất và mở mission đúng User/Leader.
* Checkpoint completion được gửi về Mảng A để Trip progress sử dụng.
* Weather API trả dữ liệu normalized/cached; provider lỗi không làm Trip/Booking lỗi.
* Không có Supabase service-role key trong frontend repository/build.
* User-create Trail from GPS chỉ là extension và không được làm chậm P0.

---

## 18. API IMPLEMENTATION ROADMAP - ĐỀ XUẤT THEO GIAI ĐOẠN

| Giai đoạn | API / Feature trọng tâm | Điều kiện hoàn tất |
| :--- | :--- | :--- |
| **C0 - Auth Foundation** | Supabase SDK + JWT Guard + `/auth/me` + RBAC | A/B dùng chung auth contract. |
| **C1 - Navigation Context** | Map 3D + consume Trip navigation context | Bảo - Luật chốt contract. |
| **C2 - GPS Session** | start / locations batch / path / stop | Demo vẽ actual path. |
| **C3 - Deviation** | distance-to-route + alert + leader view | False alert được debounce. |
| **C4 - Checkpoint Mission** | arrival + unlock + complete event | A-C integration pass. |
| **C5 - Weather** | provider adapter + cache + trip weather | Provider failure handled. |
| **C6 - Hardening** | privacy/retention, offline queue basic, notifications | P0 stable. |
| **C7 - Extension** | User route recording -> create Trail Draft; realtime/chat | Chỉ khi P0/P1 ổn. |

---

## 19. CÁC DIAGRAM NÊN VẼ TỪ TÀI LIỆU NÀY

| Diagram | Phạm vi nên thể hiện |
| :--- | :--- |
| **Use Case Diagram** | Visitor/User/Leader/Admin + Supabase + Weather Provider + Trip Service. |
| **Sequence - Authentication** | Web/Mobile -> Supabase Auth -> TrekGo API Guard -> User/RBAC. |
| **Sequence - Start GPS Tracking** | Mobile -> Trip Navigation Context -> Geo Session -> Location Batch. |
| **Activity - Route Deviation** | GPS sample -> validate -> distance-to-route -> debounce -> warn User/Leader -> recovered. |
| **Sequence - Checkpoint Arrival** | Mobile GPS -> Geo API -> checkpoint context -> arrival validation -> mission unlock -> event to Trip. |
| **Sequence - Weather** | Client -> TrekGo Weather API -> cache -> provider -> normalized response. |
| **State Diagram - GPS Session** | `IDLE` / `ACTIVE` / `STOPPED`. |
| **State Diagram - Route Status** | `ON_ROUTE` / `DEVIATED` / `RECOVERED`. |
| **ERD** | `UserAuthMapping`, `GpsSession`, `LocationSample`, `DeviationEvent`, `CheckpointEvent`, `WeatherSnapshot`. |
| **Extension Sequence** | Trail Recording -> Process Path -> Trail Draft API Mảng A. |

---

## 20. OPEN DECISIONS / TBD CẦN TEAM CHỐT

| TBD | Vấn đề | Khuyến nghị MVP |
| :--- | :--- | :--- |
| **RC-TBD-01** | Map provider dùng Mapbox / Google / MapLibre? | Chọn 1 provider dễ mobile + polyline; bọc adapter. |
| **RC-TBD-02** | Deviation threshold X mét và số sample liên tiếp N? | Config; test thực địa rồi chốt. |
| **RC-TBD-03** | GPS sync interval chính xác? | 10-30 giây hoặc distance-based; không 1Hz. |
| **RC-TBD-04** | Leader có xem vị trí tất cả thành viên trên map MVP không? | P1; MVP ít nhất alert + last-known location. |
| **RC-TBD-05** | Checkpoint radius bao nhiêu? | Nhận từ checkpoint config; không hardcode. |
| **RC-TBD-06** | Mission completion/evidence endpoint thuộc A hay C? | A owns definition/business; C owns arrival. Họp Bảo-Luật trước code. |
| **RC-TBD-07** | GPS samples lưu bao lâu? | Giới hạn retention cho capstone; summary/path simplified giữ lâu hơn. |
| **RC-TBD-08** | Weather provider nào? | Chọn provider free/sandbox phù hợp; adapter normalized. |
| **RC-TBD-09** | User-created Trail có làm trong 8 tuần không? | P2; chỉ làm sau GPS core stable. |
| **RC-TBD-10** | Supabase email verification có bắt buộc trước login/booking không? | Team chốt UAT sớm; khuyến nghị bật nếu không gây cản demo. |

---

## 21. KẾT LUẬN

Mảng C nên được triển khai theo thứ tự:
$$\text{Auth Foundation} \longrightarrow \text{Trip Navigation Context} \longrightarrow \text{Map/GPS Session} \longrightarrow \text{Route Deviation} \longrightarrow \text{Checkpoint Mission} \longrightarrow \text{Weather}$$

Đây là core đủ mạnh cho MVP. Realtime chính xác cao, chat, offline map đầy đủ và User tạo Trail từ GPS chỉ nên làm sau khi các flow P0 ổn định.

**Boundary quan trọng nhất:** Luật sở hữu Authentication integration và GPS execution, nhưng không sở hữu Trip/Trail/Checkpoint definition. Bảo/Mảng A cung cấp navigation context và nhận checkpoint progress; Quân/Mảng B chỉ consume auth. Các contract cross-domain phải được review trước khi code để tránh conflict schema, API và business rule.