# Kế hoạch triển khai CF01 Leader tạo Public Trip

Ngày rà soát: 2026-09-27. Nguồn yêu cầu: `TrekGo_CF01_Leader_Create_Public_Trip_Requirement.docx` và source hiện tại. Trạng thái: kế hoạch triển khai, chưa áp dụng thay đổi schema/database. Những quyết định ghi là đề xuất là phần bổ sung cho requirement, không phải quy tắc đã có sẵn.

## 1. Kết luận và phạm vi

Các bảng hiện có đủ để biểu diễn CF01 sau một số thay đổi nhỏ; chưa cần bảng nghiệp vụ mới. Happy path: LEADER ACTIVE tạo PUBLIC DRAFT, chọn required checkpoints có thứ tự, chọn planned System Trails, review và publish OPEN. Bao gồm API gửi yêu cầu hủy theo tài liệu; Admin duyệt hủy thuộc flow khác.

Không triển khai CRUD SystemTrail, Checkpoint hoặc TrailCheckpoint: chỉ đọc master data của thành viên phụ trách, validate và sao chép snapshot vào bảng Trip. Không triển khai Booking, Payment, Rental, GPS execution hoặc dispatch xe. Không sửa schema của các domain đó để phục vụ CF01.

## 2. Bảng liên quan và ownership

| Model | CF01 sử dụng | Thay đổi dự kiến |
|---|---|---|
| User | Actor ACTIVE, LEADER; creator/leader ownership | Không đổi bảng |
| LeaderProfile | Thông tin bổ trợ nếu contract eligibility yêu cầu | Không đổi; không tự thêm điều kiện APPROVED hoặc tier/difficulty |
| Destination | Đọc và kiểm tra ACTIVE | Không đổi |
| PickupPoint | Đọc điểm tập kết ACTIVE | Thêm inverse relation với Trip trong Prisma |
| SystemTrail | Đọc metadata, version, GeoJSON, status | Không đổi master |
| Checkpoint | Đọc tọa độ, radius, destination, status | Không đổi master |
| TrailCheckpoint | Đọc membership/thứ tự route | Không đổi master |
| Trip | Draft, lịch, capacity, price, OPEN | Thêm pickupPointId nullable + FK/index |
| TripCheckpoint | Snapshot required checkpoints, sequence | Chưa cần cột mới; validate chống trùng trong transaction |
| TripTrailPlan | Snapshot ordered System Trails | Đề xuất thêm sourceTrailVersion và snapshotCheckpointIds nullable để đối chiếu master |
| TripCancellationRequest | Gửi yêu cầu hủy và bàn giao cho Admin flow | Thêm previousTripStatus nullable; kiểm soát pending request đồng thời |

9 bảng cốt lõi happy path: User, Destination, PickupPoint, SystemTrail, Checkpoint, TrailCheckpoint, Trip, TripCheckpoint, TripTrailPlan. LeaderProfile là dependency có điều kiện. Cancellation thêm một bảng hiện có.

TripActiveTrailPlan, TripTrailSwitch và TripCheckpointProgress không bắt buộc ghi ở CF01; phía execution quyết định thời điểm khởi tạo. Không xóa/chỉnh các model này. TripTransport không thay thế điểm tập kết: requirement không bắt buộc có xe khi publish. AuditLog có thể dùng khi có convention chung; không cần thêm bảng audit. Notification/outbox là P1 khi có consumer thực tế.

## 3. Chiến lược migration tăng dần

Hiện có `20260926103348_align_rental_flow` và `20260927060956_update_gps`. Migration Rental bắt đầu bằng CREATE TYPE và tạo nền schema; tên migration không thể hiện toàn bộ phạm vi. Chưa kiểm tra lịch sử áp dụng trên DB thật.

1. Trước khi tạo migration, cập nhật nhánh nền và kiểm tra diff/schema/migration mới của team. Kiểm tra migration status và drift trên môi trường dev được xác định rõ; không in connection string/secret.
2. Giữ nguyên migration cũ đã chia sẻ/áp dụng. Mọi thay đổi CF01 có migration mới, mô tả lý do và bảng chịu ảnh hưởng; schema.prisma và SQL phải cùng được lưu trong version control.
3. Tạo migration trên DB phát triển riêng bằng chế độ create-only; review SQL trước khi chạy. Nếu phát hiện drift hoặc yêu cầu reset, dừng thao tác DB để đối chiếu; không tự reset DB chung.
4. Không dùng db push cho thay đổi CF01, không dùng migrate reset, không xóa/recreate bảng, đổi enum hoặc rename cột domain khác. Không chạy migrate dev trên DB dùng chung/production. Dùng migration đã review để deploy theo quy trình môi trường.
5. Migration đầu chỉ bổ sung cột nullable, FK/index cần thiết. Không gán pickup giả hoặc trạng thái lịch sử giả cho bản ghi cũ.
6. Dữ liệu cũ thiếu field phải được thống kê và có kế hoạch backfill dựa trên nguồn đáng tin. Chỉ thêm NOT NULL/constraint chặt hơn ở migration sau khi kiểm chứng dữ liệu và tương thích các flow.
7. Chạy toàn bộ chuỗi migration trên DB test trống và chạy migration CF01 trên DB test có dữ liệu cũ. Kiểm tra số lượng/bản ghi cũ được giữ nguyên, FK và schema drift sau áp dụng.
8. Nếu migration cũ đã tạo bảng trên DB nhưng chưa có lịch sử, chỉ baseline/resolve sau khi kiểm chứng schema tương đương; không đánh dấu applied để bỏ qua lỗi.
9. Trước áp dụng DB có dữ liệu: có backup/restore đã được chuẩn bị theo môi trường. Rollback ứng dụng có thể giữ cột nullable; sửa SQL bằng migration mới. Prisma không tự cung cấp down migration an toàn; không xóa cột có dữ liệu để rollback.

Migration A đề xuất: `cf01_trip_pickup_and_plan_snapshot` thêm trips.pickup_point_id, FK/index, trip_trail_plans.source_trail_version và snapshot_checkpoint_ids. Hai field snapshot mới lưu version và mảng ID theo thứ tự; không thay đổi master hoặc snapshot_geojson.

Migration B đề xuất: `cf01_cancellation_origin_state` thêm previous_trip_status. Unique partial cho một request PENDING/trip chỉ thêm sau khi kiểm tra dữ liệu cũ và đồng thuận phạm vi mọi loại Trip. Nếu chưa thể áp dụng global, trước mắt khóa Trip và kiểm tra pending request trong transaction CF01.

Chưa thêm unique global `(trip_id, source_checkpoint_id)` hoặc CHECK mới cho mọi Trip khi chưa xác nhận Private Trip cần cùng quy tắc. CF01 chống trùng bằng validation + lock Trip. CHECK cục bộ cho dữ liệu Public có thể bổ sung ở migration sau. Không tạo bảng LeaderSchedule: lịch lấy từ Trip.

## 4. Business rules

### Quy tắc đã có trong requirement

- Chỉ LEADER ACTIVE tạo/publish; update và các thao tác draft chỉ owner. Server gán creatorId/leaderId từ actor, type PUBLIC và state DRAFT.
- Chỉ System Trail được phép; không giới hạn difficulty theo cấp Leader. Không mua TrailAccess để làm CF01.
- Có ít nhất một required checkpoint và một planned trail trước publish. Required checkpoints là mục tiêu; planned trails là đường đi dự kiến.
- Checkpoint không trùng, sequence có thứ tự, phù hợp destination; thời gian startAt < endAt; capacity > 0; giá và pickup hợp lệ.
- Không overlap Public Trip khác của Leader. Pre-check không thay thế kiểm tra lúc ghi/publish.
- Chỉ publish thành công mới public. Không trực tiếp cancel hoặc reschedule Public Trip đã publish.

### Quy tắc bổ sung đề xuất cho implementation

| Mã | Quyết định đề xuất | Kiểm chứng |
|---|---|---|
| CF01-R01 | State lưu DB là OPEN; không tạo PUBLISHED/REGISTRATION_OPEN mới | Enum/DTO/mapping nhất quán |
| CF01-R02 | DRAFT cho sửa lịch; sau OPEN cấm PATCH trong CF01 | Phân biệt sửa draft với reschedule |
| CF01-R03 | Lịch chiếm chỗ: DRAFT, OPEN, FULL, CLOSED, CANCEL_PENDING, IN_PROGRESS | Không tự giải phóng lịch khi mới xin hủy |
| CF01-R04 | Khoảng [startAt,endAt); conflict khi existing.startAt < endAt và existing.endAt > startAt; loại chính Trip khi update | Hai chuyến tiếp giáp không conflict |
| CF01-R05 | Create/publish yêu cầu startAt > thời gian server; API ISO 8601 có timezone, DB UTC | Test ranh giới thời gian bằng clock cố định |
| CF01-R06 | capacity là số nguyên dương ánh xạ maxPax; minPax giữ mặc định 1; giá/người VND > 0, dùng decimal string theo precision DB | Không tính tiền bằng float; giá 0 cần thay policy nếu business muốn |
| CF01-R07 | Create yêu cầu đủ thông tin cơ bản; draft chưa cần checkpoints/trails. PUT [] được phép để xóa plan ở DRAFT nhưng không publish được | FE hiển thị readiness |
| CF01-R08 | Đổi destination khi đã có plan bị từ chối; caller xóa plan trước | Không âm thầm bỏ dữ liệu Leader đã chọn |
| CF01-R09 | Pickup ACTIVE, destinationId null hoặc bằng destination của Trip | Cần xác nhận nếu điểm tập kết liên vùng dùng destination khác |
| CF01-R10 | Snapshot do server đọc master; không nhận GeoJSON, giá trị snapshot hoặc isRequired từ client | Không cho sửa master bằng payload Trip |
| CF01-R11 | Mỗi mutation tăng Trip.version; client gửi expectedVersion, sai trả 409 VERSION_CONFLICT | Ngăn hai tab ghi đè; bổ sung contract API |
| CF01-R12 | Publish lặp lại khi đã OPEN trả INVALID_STATE_TRANSITION theo contract gốc; không phát side effect lần hai | FE refetch sau timeout |

DRAFT chiếm lịch có thể làm Leader bị giữ lịch bởi draft bỏ dở. MVP sử dụng cancellation request như state diagram; không tự thêm xóa draft hoặc TTL chưa được yêu cầu. Đây là tradeoff cần hiển thị trong UI và có thể mở rộng sau.

### Route MVP và snapshot

Đề xuất MVP chỉ đi toàn bộ trail theo chiều sequence chuẩn; chưa đi ngược hoặc cắt đoạn. Tất cả master đã chọn phải ACTIVE và cùng destination. Planned trail không trùng ID trong một plan. Server chuẩn hóa sequence liên tục từ 1.

Một trail dùng danh sách checkpoint có thứ tự từ TrailCheckpoint. Với nhiều trail, checkpoint cuối của trail trước phải là checkpoint đầu của trail sau; ghép chuỗi và bỏ checkpoint chung tại điểm nối. Required checkpoint IDs phải là subsequence theo đúng thứ tự của chuỗi ghép. Không xem việc có đủ checkpoint trong hợp các trail là đủ chứng minh tính liên tục. Master catalog phải bảo đảm các checkpoint đầu/cuối phản ánh đúng route; nếu chưa có cam kết dữ liệu này, thuật toán chỉ chứng minh kết nối trên graph checkpoint, không bảo đảm kết nối hình học GeoJSON.

Suggestions trả các candidate nối tiếp hợp lệ, coverage và lý do chưa nối được; không cần tối ưu đường ngắn nhất hoặc tự chọn toàn bộ route. Không có candidate thì giữ draft. Đọc catalog qua port để thay thuật toán/data provider mà không đổi use case.

Set trails lưu snapshot metadata/GeoJSON, sourceTrailVersion và ordered checkpoint IDs. Set checkpoints lưu snapshot tên/tọa độ/radius và isRequired=true. Review/publish đối chiếu source version, membership và dữ liệu checkpoint liên quan; thay đổi thì trả readiness issue PLAN_SOURCE_CHANGED để Leader review/reselect. Sau publish không tự cập nhật snapshot từ master. Với concurrent master update cần đọc/khóa nhất quán các bản ghi nguồn trong publish transaction theo thứ tự ổn định; phối hợp contract cập nhật catalog với thành viên sở hữu. Chỉ dựa vào version SystemTrail là chưa đủ nếu họ thay membership mà không tăng version.

Nếu business cần đi ngược/cắt đoạn, đây là thay đổi riêng: bổ sung direction/entry/exit vào TripTrailPlan bằng migration mới, không sửa SystemTrail ngay trong CF01.

## 5. Transaction và cạnh tranh

- Create/update lịch/publish khóa hàng User của Leader trước khi truy vấn overlap và ghi Trip, trong cùng transaction. Mọi writer Public Trip về sau phải tuân theo cùng khóa; index không tự ngăn overlap.
- Mutation trên Trip khóa Trip và kiểm tra actor/type/state/version trong transaction. Thứ tự khóa thống nhất User rồi Trip rồi catalog khi cần, tránh deadlock. Có bounded retry cho lỗi transaction/deadlock được phân loại.
- Set checkpoints/trails validate toàn bộ, sau đó replace children và tăng version trong một transaction; lỗi không để plan nửa cũ nửa mới.
- Publish revalidate tất cả invariant, lưu OPEN + publishedAt + tăng version atomic. Readiness chỉ là preview, không phải giấy phép publish.
- Cancellation: khóa Trip, kiểm tra owner/state/expectedVersion, kiểm tra chưa có pending, lưu previousTripStatus và request, chuyển CANCEL_PENDING atomic. Chỉ DRAFT/OPEN/FULL theo state diagram CF01. EvidenceRefs phải có contract resolver hoặc map rõ sang evidenceUrls; không tự coi ref là URL.
- Admin reject/approve không triển khai ở đây; bàn giao contract previous state, version và lock. Không phục hồi trạng thái cũ mù quáng nếu flow khác đã thay đổi Trip.

## 6. API tối thiểu

Giữ 8 API trong requirement với prefix `/api/v1`; mutation thêm expectedVersion (body/header thống nhất), ngoại trừ create. Không tự bật global prefix làm hỏng auth cũ; kiểm tra convention và tương thích routing trước.

| Method/route sau prefix | Mục đích |
|---|---|
| POST /leader/public-trips | Create DRAFT |
| PATCH /leader/public-trips/:id | Update DRAFT |
| PUT /leader/public-trips/:id/checkpoints | Replace ordered required checkpoints |
| GET /leader/public-trips/:id/trail-suggestions | Read candidate trails theo checkpoint/current plan |
| PUT /leader/public-trips/:id/trails | Replace planned trails |
| POST /leader/public-trips/:id/publish | Publish |
| GET /leaders/me/schedule-conflicts | Advisory pre-check, chỉ dữ liệu actor |
| POST /leader/public-trips/:id/cancellation-requests | Submit cancellation |
| GET /leader/public-trips | My drafts/trips, filter/pagination |
| GET /leader/public-trips/:id | Owner detail + snapshots |
| GET /leader/public-trips/:id/readiness | canPublish + issues[{code,field,message}] |
| GET /leader/trip-options/destinations | ACTIVE destinations |
| GET /leader/trip-options/pickup-points?destinationId= | Pickup hợp lệ |
| GET /leader/trip-options/checkpoints?destinationId= | Master checkpoint lựa chọn |
| GET /leader/trip-options/system-trails/:id | Trail preview + ordered checkpoints |
| GET /public-trips và GET /public-trips/:id | Read projection cho Trip đã publish; không lộ draft/PII |

Các route đọc catalog là đề xuất facade cho CF01. Nếu thành viên catalog đã có endpoint/port tương đương thì tái sử dụng, không tạo bản thứ hai. Master list có pagination và filter. Public projection tối thiểu hiện OPEN, FULL; list bookable chỉ OPEN; các trạng thái còn lại do browse lifecycle bổ sung sau. Không lộ route GeoJSON đầy đủ qua public projection nếu chưa có access policy.

Errors giữ 400 VALIDATION_ERROR, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 LEADER_SCHEDULE_CONFLICT/INVALID_STATE_TRANSITION, 422 TRIP_NOT_READY_TO_PUBLISH/INVALID_TRAIL_FOR_TRIP_TYPE. Bổ sung 409 VERSION_CONFLICT; PLAN_SOURCE_CHANGED là readiness issue. UUID không tồn tại trả NOT_FOUND; nếu cần nhận biết PersonalTrail để trả INVALID_TRAIL_FOR_TRIP_TYPE, adapter chỉ kiểm tra tồn tại tối thiểu, không đọc/lộ nội dung cá nhân.

## 7. Kiến trúc phù hợp source

`api/src/modules/trips/` theo identity hiện có: application/ports, application/use-cases, infrastructure/adapters, presentation/controllers, presentation/dtos và trips.module.ts. Policy thuần cho time overlap/route readiness đặt trong module trips; port dùng DTO nghiệp vụ, không trả Prisma model ra application. Adapter Prisma đóng gói lock/transaction, không để use case import Prisma.

Ports dự kiến: TripRepository/transaction operations và TripCatalogReader. Catalog adapter chỉ query; khi module của thành viên khác sẵn sàng thì thay binding. Không cần tạo nhiều module master CRUD.

Tái sử dụng SharedModule, PrismaService, SupabaseService, Auth/ActiveUser, RolesGuard và ZodValidationPipe. Controller CF01 gắn cả Bearer và Roles(LEADER); guard không thay thế ownership. Không đặt publish/route/schedule policy vào shared. Response/error contract chung phải được kiểm tra cách đăng ký interceptor/filter thực tế trước khi áp dụng.

Web theo features/trips với services/hooks/components/types và public index.ts. Mobile theo route -> screen -> feature hook -> feature API -> shared API client, tuân thủ CODING_GUIDELINES.md; không sao chép quy tắc barrel web sang mobile. Chọn client nghiệm thu đầu tiên trước phase UI; scope hoàn thành cả web và mobile cần được tính riêng, backend dùng chung.

## 8. Thứ tự thực hiện và tiêu chí hoàn thành

1. Baseline và contract: chạy typecheck/test hiện tại; rà auth role assignment và bootstrap actor binding. Hiện đã có RolesGuard và bootstrap Bearer nhưng DTO còn role, nên phải kiểm tra use case trước khi kết luận đã an toàn. Shared Trip enum còn lệch Prisma: đồng bộ mapping có kiểm tra consumer. Không mặc định lỗi lần rà trước vẫn còn nguyên.
2. Chốt route policy, source snapshot contract, lịch/state, price/pickup; tạo OpenAPI DTO/error/readiness. Ghi rõ đề xuất được chọn vào đặc tả. Vẽ activity/sequence/state tối thiểu theo DoD gốc.
3. Tạo/review/test migration tăng dần theo mục 3; fixtures catalog test không chạy seed ghi đè master DB chung.
4. Implement read-only catalog, create/update/detail/list draft và conflict protection.
5. Implement set checkpoints/trails, suggestions và readiness; transaction/version tests.
6. Implement publish/public projection, cancellation request; integration concurrency tests trên PostgreSQL thật ở môi trường test.
7. Implement UI client được chọn: basic info -> checkpoints -> trails -> review/publish; resume draft, error/empty/loading/content, conflict và stale-version recovery. Không tự bổ sung màn CRUD catalog.
8. Nghiệm thu: API contract, migrations và hướng dẫn chạy được lưu; baseline/typecheck/test pass; demo Leader tạo -> reload -> review -> OPEN; user browse chỉ thấy published Trip. Bàn giao catalog/GPS/cancellation contracts.

Tests bắt buộc: USER/ADMIN bị từ chối; Leader khác không sửa/read owner data; tài khoản inactive; sai destination/trail/pickup; duplicate/order checkpoints; multi-trail nối và đứt; thiếu dữ liệu; catalog đổi sau chọn; overlap create/update/publish; hai request đồng thời cùng Leader chỉ một được ghi; hai tab cùng version không mất dữ liệu; replace rollback; failed publish giữ DRAFT; OPEN không reschedule; draft không public; cancellation duplicate và previous status đúng; dữ liệu Private/Rental/GPS cũ không bị migration đổi.

Definition of Done chưa thể đạt chỉ bằng Prisma validate hoặc unit test mock. Phải có integration test transaction/concurrency, migration replay và UI/API acceptance; không cần triển khai downstream Booking/Payment để nghiệm thu CF01.
