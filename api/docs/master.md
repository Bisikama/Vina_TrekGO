# TREKGO - MASTER FUNCTIONAL REQUIREMENTS v3

**Tài liệu tổng hợp chuẩn từ 3 mảng: Trail/Trip/Booking - Rental/Inventory/Logistics - Authentication/GPS/Weather**

## 1. MỤC ĐÍCH & CÁCH SỬ DỤNG TÀI LIỆU

Tài liệu này hợp nhất ba bộ requirement chi tiết hiện tại thành một nguồn tham chiếu chung cho toàn hệ thống TrekGo. Mục tiêu chính là mô tả hệ thống phải làm gì, các domain liên quan, luồng nghiệp vụ tổng thể, trạng thái quan trọng và ranh giới giữa các mảng.

Tài liệu KHÔNG phải tài liệu thiết kế database và không đưa ra code/schema SQL. Tuy nhiên, một phần riêng ở cuối nêu các yêu cầu dữ liệu mà thiết kế database mới bắt buộc phải biểu diễn được, nhằm tránh mất business rule khi nhóm xây lại database sau nhiều lần thay đổi requirement.

**Quy tắc hợp nhất:** Area A Booking v2 được coi là baseline business mới nhất cho các rule cross-domain. Các phần Rental/GPS vẫn giữ nguyên nghiệp vụ riêng, nhưng khi có xung đột với Area A v2 thì requirement tổng sử dụng rule mới của Area A và đánh dấu điểm cần đồng bộ ngược về tài liệu chuyên môn.

## 2. NGUỒN TÀI LIỆU HỢP NHẤT

| Mảng | Tài liệu nguồn | Phạm vi chính |
| :--- | :--- | :--- |
| **Area A** | `TrekGo_backend_api_booking_v2(1).docx` | System/Personal Trail, TrailAccess, Public/Private Trip, Booking, Participant, Leader, Transport, Trip execution. |
| **Area B** | `TrekGo_backend_api_rental_v1.docx` | Rental Product, Equipment Unit, Availability, Rental Order, Warehouse, Logistics, Return, Inspection, Deposit. |
| **Area C** | `TrekGo_backend_api_gps_weather.docx` | Supabase Auth/RBAC, Map 3D, GPS session, actual path, deviation, checkpoint execution, Weather, trail recording extension. |

## 3. TỔNG QUAN HỆ THỐNG TREKGO

TrekGo là nền tảng quản lý trải nghiệm trekking từ khám phá cung đường, tạo chuyến đi, tham gia chuyến, theo dõi hành trình GPS, đi qua checkpoint, đến thuê - giao - thu hồi trang thiết bị. Hệ thống có hai loại Trip khác nhau về bản chất nghiệp vụ: Public Trip thương mại do LEADER mở và Private Trip do USER tự tổ chức.

| Chuỗi nghiệp vụ | Ý nghĩa |
| :--- | :--- |
| **System Trail / Personal Trail** | Nguồn route để lập Trip. System Trail thuộc TrekGo; Personal Trail thuộc User và không public. |
| **Public Trip** | LEADER tạo từ System Trail; User tham gia bằng Booking + Payment. |
| **Private Trip** | USER tạo từ Personal Trail hoặc System Trail đã mua quyền; thành viên join bằng Invite Code. |
| **Trip Execution** | Map/GPS sử dụng planned/active route, Required Checkpoints, actual path và deviation alerts. |
| **Rental** | User đủ điều kiện thuê theo Public Booking CONFIRMED hoặc Private TripMember ACTIVE. |
| **Warehouse & Logistics** | Kho chuẩn bị exact Equipment Unit; Logistics giao tại điểm tập trung và thu hồi sau chuyến. |
| **Post-trip** | Trip complete -> Rental return -> inspection -> deposit settlement -> inventory finalize. |

## 4. ROLE TOÀN HỆ THỐNG

| Role | Functional scope chính |
| :--- | :--- |
| **Visitor** | Xem System Trail/Public Trip và thông tin công khai; đăng ký tài khoản. |
| **USER** | Mua TrailAccess; tạo Personal Trail; tạo Private Trip; join Private Trip; Booking Public Trip; thuê thiết bị; sử dụng GPS/Weather. |
| **LEADER** | Chỉ tạo/quản lý Public Trip; chọn System Trail/Checkpoint; quản lý participant/check-in; start/switch/complete Trip; nhận deviation alerts; gửi yêu cầu hủy Trip. |
| **STAFF_WAREHOUSE** | Quản lý Rental Product/Equipment Unit, tồn kho, pick/pack, condition, maintenance, nhận hàng trả và finalize inventory. |
| **STAFF_LOGISTICS** | Nhận package, giao tại pickup point, xác minh User/Booking/Member, handover, thu hồi, inspection sơ bộ. |
| **ADMIN** | Leader approval; System Trail/price; Trip oversight/cancel; TripTransport; rental policy/report; moderation/safety. |
| **System / Shared Services** | Auth verification, Payment/Refund, Notifications, jobs, event handling và các xử lý tự động. |

## 5. DOMAIN OWNERSHIP & RANH GIỚI

| Domain | Nguồn sự thật | Mảng khác chỉ được consume |
| :--- | :--- | :--- |
| **Identity / Auth** | Supabase + TrekGo User/RBAC integration | A/B/C dùng current user/role; không viết auth riêng. |
| **Trail / Checkpoint / Trip / Booking / Membership** | Area A | GPS đọc navigation; Rental đọc eligibility/context; không sửa business state trực tiếp. |
| **Rental / Equipment / Warehouse / Logistics / Deposit** | Area B | A/C không thay đổi lifecycle rental/inventory trực tiếp. |
| **GPS Runtime / Deviation / Checkpoint execution / Weather** | Area C | A nhận checkpoint progress/actual route; B chỉ dùng auth/weather nếu cần. |
| **Payment / Refund** | Shared Integration | Domain owner gửi mục đích/amount và nhận normalized result; Payment không tự đổi domain state ngoài contract. |

## 6. FUNCTIONAL REQUIREMENTS - AUTHENTICATION & USER ACCESS

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-AUTH-01 | Sign Up / Login / Logout | P0 | Visitor/User | Authentication dùng Supabase Auth. Web/Mobile lấy session/token từ Supabase; TrekGo không lưu password. |
| FR-AUTH-02 | Backend Token Verification | P0 | System | Protected API phải verify Bearer token và map auth identity sang TrekGo User. |
| FR-AUTH-03 | RBAC | P0 | System | Quyền USER/LEADER/STAFF_WAREHOUSE/STAFF_LOGISTICS/ADMIN được kiểm tra trước business logic. |
| FR-AUTH-04 | Session Refresh | P0 | Frontend | Sử dụng cơ chế refresh/auto-refresh của Supabase, không xây refresh-token riêng của TrekGo. |
| FR-AUTH-05 | Profile Bootstrap | P0 | Auth User | Sau lần đăng nhập/đăng ký đầu, hệ thống tạo/map profile ứng dụng theo authUserId. |
| FR-AUTH-06 | Forgot / Reset Password | P1 | Visitor/User | Dùng reset flow của Supabase; TrekGo backend không quản lý password reset riêng. |

## 7. FUNCTIONAL REQUIREMENTS - TRAIL, CHECKPOINT & TRAIL ACCESS

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-TR-01 | System Trail Catalog | P0 | Visitor/User/Leader | List/search/detail System Trail theo Destination, difficulty, access state; System Trail là dữ liệu TrekGo và Verified sẵn trong MVP. |
| FR-TR-02 | System Trail Administration | P0 | Admin | Quản lý metadata/price/status của System Trail; Public Trip chỉ được dùng System Trail. |
| FR-TR-03 | Checkpoint Master | P0 | Admin/Leader consume | Checkpoint là POI/mục tiêu; Trail có quan hệ với checkpoint và thứ tự đi qua. |
| FR-TR-04 | Personal Trail | P1 | User | User tạo Trail riêng từ GPS/GeoJSON; không public; chỉ owner quản lý và dùng cho Private Trip. |
| FR-TR-05 | Personal Checkpoint | P1 | User | User được chấm checkpoint riêng, nhập thông tin/ảnh, giới hạn số lượng theo config. |
| FR-TR-06 | Personal Trail Integrity | P1 | User/System | Không chỉnh geometry trực tiếp; muốn thay route phải record/tạo Trail mới. Delete trên UI nhưng backend giữ lịch sử/snapshot. |
| FR-TR-07 | Trail Access Purchase | P0 | User/System | User mua quyền truy cập System Trail; payment success tạo TrailAccess ACTIVE vĩnh viễn. |
| FR-TR-08 | My Accessible Trails | P0 | User | Hiển thị Personal Trail và các System Trail đã có TrailAccess để dùng khi tạo Private Trip. |

## 8. FUNCTIONAL REQUIREMENTS - LEADER ELIGIBILITY

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-LD-01 | Eligibility Progress | P1 | User/System | Theo dõi completed trip count theo threshold cấu hình. |
| FR-LD-02 | Leader Test | P1 | User | User hoàn thành bài test; lưu kết quả PASS/FAIL. |
| FR-LD-03 | Certificate Submission | P1 | User | Nộp chứng chỉ/tài liệu xin Leader. |
| FR-LD-04 | Admin Approval | P1 | Admin | Approve/reject Leader application; approve chuyển USER -> LEADER. |
| FR-LD-05 | Difficulty Policy | P0 | Leader | MVP không giới hạn difficulty theo cấp Leader để giảm scope. |

## 9. FUNCTIONAL REQUIREMENTS - PUBLIC TRIP

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-PT-01 | Create Public Trip Draft | P0 | Leader | LEADER tạo draft gồm Destination, thời gian, pickup, capacity, price và thông tin chuyến. |
| FR-PT-02 | Required Checkpoints | P0 | Leader | Leader chọn ordered Required Checkpoints. Đây là tiêu chí business quan trọng để đánh giá hoàn thành Trip. |
| FR-PT-03 | Planned Trails | P0 | Leader/System | Hệ thống gợi ý System Trail nối checkpoint; Leader chọn một hoặc nhiều Planned Trails. |
| FR-PT-04 | Schedule Conflict | P0 | System | Một LEADER không được có hai Public Trip overlap thời gian. |
| FR-PT-05 | Publish | P0 | Leader | Chỉ publish khi System Trail/checkpoint/time/capacity/price hợp lệ. |
| FR-PT-06 | Public Cancellation | P0 | Leader/Admin | Leader không cancel trực tiếp; gửi Cancellation Request để Admin approve/reject. Admin có thể cancel trực tiếp vì safety/moderation. |
| FR-PT-07 | No Public Reschedule | P0 | Leader | Public Trip không reschedule trong MVP để tránh dây chuyền Booking/Rental/Payment. |

## 10. FUNCTIONAL REQUIREMENTS - PRIVATE TRIP

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-PR-01 | Create Private Trip | P0 | User | Chỉ USER tạo Private Trip; LEADER bị chặn trong MVP. Trail hợp lệ: Personal Trail owner hoặc System Trail có TrailAccess ACTIVE. |
| FR-PR-02 | Capacity | P0 | Host/System | Private Trip có giới hạn số member. |
| FR-PR-03 | Invite Code / Link | P0 | Host | Một mã dùng nhiều người; Host có thể regenerate/revoke; mã hết hạn trước Trip start. |
| FR-PR-04 | Join By Invite | P0 | User | User phải có tài khoản, join trực tiếp nếu invite active và còn capacity. |
| FR-PR-05 | Member Management | P0 | Host/Member | Host remove member; member được leave trước Trip start. |
| FR-PR-06 | Attendance | P0 | Host | Host tự điểm danh; không dùng QR. |
| FR-PR-07 | Private Update/Cancel | P0 | Host | Host có thể đổi lịch/cancel trước start; downstream Rental/GPS phải được thông báo để revalidate. |

## 11. FUNCTIONAL REQUIREMENTS - PUBLIC BOOKING & PARTICIPANT

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-BK-01 | Public Trip Discovery | P0 | Visitor/User | List/detail Public Trip theo destination/date/difficulty/price/availability; Private Trip không xuất hiện public. |
| FR-BK-02 | Booking Hold | P0 | User/System | Một User chỉ có một active Booking/Trip; tạo PENDING_PAYMENT và giữ capacity bằng TTL. |
| FR-BK-03 | Multiple Participants | P0 | Booking Owner | Một Booking có thể chứa nhiều Participant. Muốn thêm người phải update Booking thay vì tạo Booking mới. |
| FR-BK-04 | Capacity Safety | P0 | System | Capacity phải concurrency-safe; không oversell khi nhiều User booking cùng lúc. |
| FR-BK-05 | Server-side Amount | P0 | System | Giá/fees/participant count được snapshot và tính phía server. |
| FR-BK-06 | Payment Confirm | P0 | System | Payment success mới chuyển Booking -> CONFIRMED; event xử lý idempotent. |
| FR-BK-07 | Hold Expiry | P0 | System | TTL hết thì Booking EXPIRED và capacity được release. |
| FR-BK-08 | Booking Cancellation | P1 | User/System | Hủy trước Trip theo policy; phát event cho Payment/Rental nếu liên quan. |
| FR-BK-09 | Public Check-in | P0 | Leader/Authorized | Booking/Participant CONFIRMED được QR/manual authorized check-in; tách khỏi Rental handover. |

## 12. FUNCTIONAL REQUIREMENTS - TRIP TRANSPORT

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-TV-01 | Trip Vehicle Management | P0 | Admin | Một Trip có thể có nhiều xe. Admin thêm/sửa/xóa metadata xe/tài xế. |
| FR-TV-02 | Transport Data | P0 | Admin/System | Lưu vehicleType, plateNumber, seatCapacity, driverName, driverPhone, providerName/note; không lưu giá xe. |
| FR-TV-03 | Visibility | P0 | Visitor/Booking Owner | Public chỉ thấy vehicleType/transportAvailable; Booking CONFIRMED mới thấy plate/driver/phone. |
| FR-TV-04 | Pickup/Return | P0 | System | Xe đón tại Pickup Point và mặc định trả về chính Pickup Point. |
| FR-TV-05 | Out of Scope | P0 | System | Không quản lý GPS xe, ETA, lịch tài xế, dispatch hoặc driver app. |

## 13. FUNCTIONAL REQUIREMENTS - TRIP EXECUTION / CHECKPOINT / COMPLETION

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-EX-01 | Start Trip | P0 | Leader/Private Host | Public Leader hoặc Private Host chuyển Trip -> IN_PROGRESS khi hợp lệ. |
| FR-EX-02 | Navigation Context | P0 | GPS/Participant | Trip cung cấp active/planned route snapshot, Required Checkpoints và status cho GPS. |
| FR-EX-03 | Trail Switch | P0 | Leader/Host | Khi IN_PROGRESS được đổi Trail hợp lệ; Required Checkpoints không đổi. |
| FR-EX-04 | Checkpoint Progress | P0 | GPS/System | GPS xác thực arrival; Area A lưu business progress và tránh duplicate. |
| FR-EX-05 | Actual Route Snapshot | P1 | GPS/System | Lưu/summarize route thực tế riêng cho Trip, không sửa Trail nguồn. |
| FR-EX-06 | Complete Trip | P0 | Leader/Host | Trip hoàn thành khi Required Checkpoints đạt yêu cầu và Leader/Host complete, hoặc có safety override hợp lệ. |
| FR-EX-07 | Trip Complete Event | P0 | System | Complete/cancel/interrupt phải phát event cho GPS/Rental/Notification. |

## 14. FUNCTIONAL REQUIREMENTS - MAP / GPS / ROUTE DEVIATION

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-GPS-01 | Render 3D Map | P0 | User/Leader | Hiển thị active/planned route, Required Checkpoints, current marker và basic progress. |
| FR-GPS-02 | GPS Session | P0 | User/Leader | Mỗi user/trip chỉ một GPS session active; start/stop theo Trip access/status. |
| FR-GPS-03 | Location Samples | P0 | Mobile/System | Thu lat/lng/timestamp/accuracy; sample kém có thể ignore theo config. |
| FR-GPS-04 | Periodic/Batch Sync | P0 | Mobile/System | MVP dùng near-real-time/periodic batch thay vì realtime 1Hz bắt buộc. |
| FR-GPS-05 | Actual Path | P0 | User | Vẽ đường thực tế từ local/server samples; có thể simplify. |
| FR-GPS-06 | Deviation Detection | P0 | System | Tính khoảng cách đến active route; chỉ alert sau threshold + debounce/consecutive samples. |
| FR-GPS-07 | Deviation Alert | P0 | User/Leader | User nhận warning; Leader được thấy alert/last-known location của thành viên Trip phù hợp. |
| FR-GPS-08 | Checkpoint Arrival | P0 | User/Leader/System | Arrival phải validate server-side theo radius, idempotent và liên kết đúng Trip/checkpoint/user. |
| FR-GPS-09 | Checkpoint Mission Unlock | P0 | User/Leader | Sau ARRIVED, mở mission theo rule; User có thể optional, Leader mission/evidence theo Trip rule. |

## 15. FUNCTIONAL REQUIREMENTS - WEATHER

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-WE-01 | Current Weather | P0 | User/Leader | Lấy và normalize thời tiết hiện tại theo Trip/location/checkpoint area. |
| FR-WE-02 | Forecast | P1 | User/Leader | Forecast gần thời gian Trip nếu provider hỗ trợ. |
| FR-WE-03 | Risk Summary | P1 | System/Leader | Map weather thành rain/wind/heat/storm risk để tham khảo. |
| FR-WE-04 | Provider Resilience | P0 | System | Weather provider lỗi không được làm fail Booking/Trip core flow. |
| FR-WE-05 | No Auto-cancel | P1 | System/Leader/Admin | Weather chỉ hỗ trợ quyết định; hệ thống không tự động hủy Trip. |

## 16. FUNCTIONAL REQUIREMENTS - RENTAL CATALOG & INVENTORY

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-RT-01 | Rental Product Catalog | P0 | User/Staff/Admin | Chỉ cho thuê; product có category, daily price, deposit policy, images, active status. |
| FR-RT-02 | Equipment Unit | P0 | Staff Warehouse | Mỗi thiết bị vật lý có assetCode/QR unique, condition và lifecycle riêng. |
| FR-RT-03 | Inventory View | P0 | Staff Warehouse/Admin | List/filter theo product/status/condition/code; Admin chủ yếu giám sát. |
| FR-RT-04 | Condition History | P0 | Staff Warehouse | Lưu lịch sử rental/condition/inspection/maintenance để trace tài sản. |
| FR-RT-05 | Maintenance | P1 | Staff Warehouse | Unit không active rental có thể vào MAINTENANCE và bị loại khỏi availability. |

## 17. FUNCTIONAL REQUIREMENTS - RENTAL ELIGIBILITY / ORDER / RESERVATION

*Lưu ý hợp nhất quan trọng: tài liệu Rental v1 còn mô tả eligibility dựa trên Booking, trong khi Area A v2 đã mở rộng Private Trip. Requirement tổng chuẩn hóa eligibility thành hai nguồn hợp lệ: Public Booking CONFIRMED hoặc Private TripMember ACTIVE.*

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-RO-01 | Rental Eligibility | P0 | User/System | Public: User có Booking CONFIRMED. Private: User có TripMember ACTIVE. Mỗi account tự thuê cho mình. |
| FR-RO-02 | Rental Window | P0 | System | Ngày thuê derive từ Trip start/end; FE không tự đặt ngày để thay đổi phí. |
| FR-RO-03 | Availability | P0 | System | Tính availability theo time window và loại RESERVED/RENTED/MAINTENANCE/LOST/overlap. |
| FR-RO-04 | Quantity / Cutoff | P0/P1 | System | Validate quantity, max policy và rental cutoff cấu hình. |
| FR-RO-05 | Rental Quote | P0 | User/System | Tính rental fee + deposit server-side và tạo quote có TTL. |
| FR-RO-06 | Rental Order | P0 | User | Tạo PENDING_PAYMENT và snapshot giá/policy/context. |
| FR-RO-07 | Atomic Reservation | P0 | System | Reserve exact Equipment Unit theo time window; concurrent checkout không được double-book. |
| FR-RO-08 | Rental Payment | P0 | User/System | Payment success -> PAID; failed/expired/cancel trước handover phải release reservation theo policy. |
| FR-RO-09 | Rental Cancellation | P0 | User/System | Hủy trước handover theo state/policy; refund/release phải idempotent. |

## 18. FUNCTIONAL REQUIREMENTS - WAREHOUSE

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-WH-01 | Warehouse Task | P0 | System/Staff Warehouse | Payment success tạo task chuẩn bị theo Trip/Pickup/Order một lần duy nhất. |
| FR-WH-02 | Pick Reserved Units | P0 | Staff Warehouse | Scan đúng exact Equipment Units đã reserve; sai unit/order bị reject. |
| FR-WH-03 | Pre-handover Condition | P0 | Staff Warehouse | Lưu condition + note + ảnh trước giao cho từng unit; làm baseline tranh chấp. |
| FR-WH-04 | Package | P0 | Staff Warehouse | Đóng gói exact units theo rental/order và tạo packageCode/QR. |
| FR-WH-05 | Ready / Custody Transfer | P0 | Staff Warehouse/System | Chỉ mark ready khi đủ pick/evidence/package; tạo Logistics Task/chuyển custody. |
| FR-WH-06 | Returned Equipment Receive | P0 | Staff Warehouse | Nhận exact units trả về, re-inspect và xác định final condition. |
| FR-WH-07 | Finalize Inventory | P0 | Staff Warehouse/System | NORMAL -> AVAILABLE; DAMAGED -> MAINTENANCE/DAMAGED; LOST -> LOST. |

## 19. FUNCTIONAL REQUIREMENTS - LOGISTICS / HANDOVER / RETURN

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-LG-01 | Logistics Task | P0 | Staff Logistics | Nhận task theo Trip/Pickup/Return và package đã ready. |
| FR-LG-02 | Receive Package | P0 | Staff Logistics | Scan package để nhận chain-of-custody từ kho. |
| FR-LG-03 | Verify Recipient | P0 | Staff Logistics | Xác minh đúng User + Public Booking hoặc Private TripMember + Trip/Pickup. |
| FR-LG-04 | Handover | P0 | Staff Logistics/User | Hiển thị condition, User xác nhận nhận; Rental ACTIVE và units RENTED. |
| FR-LG-05 | No-show / Refuse | P1 | Staff Logistics/System | Không handover; ghi lý do và trả package/release theo policy. |
| FR-LG-06 | Return Scan | P0 | Staff Logistics | Scan package/unit tại điểm trả; chuyển RETURN_PENDING. |
| FR-LG-07 | Preliminary Inspection | P0 | Staff Logistics | Ghi NORMAL/DAMAGED/LOST sơ bộ + note/ảnh; không tự finalize inventory. |
| FR-LG-08 | Return To Warehouse | P0 | Staff Logistics | Chuyển custody về Staff Warehouse để final assessment. |

## 20. FUNCTIONAL REQUIREMENTS - DEPOSIT / DAMAGE / REFUND

| FR | Function | Priority | Actors | Requirement chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| FR-DP-01 | Final Assessment | P0 | Staff Warehouse | So condition trước/sau để xác nhận normal/damage/lost. |
| FR-DP-02 | Deposit Settlement | P0 | System/Authorized Staff | Normal -> full refund; damaged/lost -> deduction theo policy; settlement immutable/idempotent. |
| FR-DP-03 | Deduction Bound | P0 | System | Deduction không vượt deposit/policy. |
| FR-DP-04 | User Visibility | P0 | User | Xem held/refund/deduction/reason của deposit. |
| FR-DP-05 | Dispute / Override | P1 | Admin/Staff Warehouse | MVP cho phép Staff Warehouse xác nhận amount trong policy; Admin can thiệp khi tranh chấp. |

## 21. MAIN END-TO-END FLOWS

| Flow | Luồng tổng hợp |
| :--- | :--- |
| **E2E-01 System Trail Access** | User xem System Trail -> mua quyền -> Payment success -> TrailAccess ACTIVE -> Trail xuất hiện trong My Accessible Trails. |
| **E2E-02 Public Trip** | Leader chọn Destination/System Trail/Required Checkpoints -> planned trails -> publish -> User xem Public Trip. |
| **E2E-03 Public Booking** | User tạo Booking hold -> capacity reserved -> update participants nếu cần -> payment -> Booking CONFIRMED -> check-in ngày Trip. |
| **E2E-04 Private Trip** | User chọn Personal Trail hoặc System Trail có TrailAccess -> tạo Private Trip -> invite code -> members join -> Host attendance. |
| **E2E-05 Trip Navigation** | Trip start -> GPS session -> render active route/checkpoints -> sample sync -> deviation alert -> checkpoint arrival/mission -> optional trail switch -> actual route. |
| **E2E-06 Trip Completion** | Leader/Host đi qua Required Checkpoints -> complete/override -> TRIP_COMPLETED -> GPS stop + Rental return flow. |
| **E2E-07 Rental** | Eligible User -> availability -> quote -> order -> exact unit reservation -> payment -> warehouse prepare -> logistics handover -> rental ACTIVE. |
| **E2E-08 Rental Return** | Trip complete/return window -> Logistics return scan/inspection -> Warehouse re-inspection -> deposit settlement -> inventory finalize. |

## 22. STATE MODEL TỔNG HỢP

| Entity | State cần hỗ trợ | Ý nghĩa chính |
| :--- | :--- | :--- |
| **Auth Session** | UNAUTHENTICATED -> AUTHENTICATED -> EXPIRED/REFRESHED -> SIGNED_OUT | Supabase quản lý identity/session. |
| **TrailAccess** | PENDING_PAYMENT -> ACTIVE \| FAILED \| REFUNDED/REVOKED | ACTIVE cho quyền System Trail. |
| **Public Trip** | DRAFT -> PUBLISHED/OPEN -> FULL/CLOSED -> IN_PROGRESS -> COMPLETED \| CANCEL_PENDING \| CANCELLED \| INTERRUPTED | Không reschedule MVP. |
| **Private Trip** | DRAFT -> OPEN -> IN_PROGRESS -> COMPLETED \| CANCELLED | Host quản lý. |
| **Invite** | ACTIVE -> EXPIRED \| REVOKED | Multi-use trước Trip start. |
| **TripMember** | ACTIVE -> LEFT \| REMOVED \| COMPLETED \| NO_SHOW | Private membership. |
| **Booking** | PENDING_PAYMENT -> CONFIRMED -> CHECKED_IN/PARTIAL_CHECKIN -> COMPLETED \| CANCELLED \| NO_SHOW \| EXPIRED | Public Trip only. |
| **TripCheckpoint** | PENDING -> REACHED -> COMPLETED \| SKIPPED/OVERRIDDEN | A owns progress; GPS detects. |
| **GPS Session** | IDLE -> ACTIVE -> PAUSED(optional) -> STOPPED | Per user/trip. |
| **Route Status** | ON_ROUTE -> DEVIATED -> RECOVERED | Debounced deviation. |
| **Rental Order** | QUOTE/DRAFT -> PENDING_PAYMENT -> PAID -> PREPARING -> READY_FOR_HANDOVER -> ACTIVE -> RETURN_PENDING -> INSPECTED -> COMPLETED \| CANCELLED \| EXPIRED | Rental lifecycle. |
| **Equipment Unit** | AVAILABLE -> RESERVED -> PICKED -> PACKED -> RENTED -> RETURN_PENDING -> AVAILABLE \| MAINTENANCE \| DAMAGED \| LOST | Serialized asset. |
| **Warehouse Task** | OPEN -> PICKING -> CONDITION_CAPTURED -> PACKED -> READY -> TRANSFERRED -> CLOSED | Staff Warehouse. |
| **Logistics Task** | SCHEDULED -> PACKAGE_RECEIVED -> USER_VERIFIED -> HANDED_OVER -> RETURN_DUE -> RETURNED -> CLOSED \| NO_SHOW | Staff Logistics. |
| **Deposit** | HELD -> REFUND_PENDING -> REFUNDED \| PARTIAL_REFUND \| FORFEITED | Settlement immutable. |

## 23. CROSS-DOMAIN CONTRACTS PHẢI KHÓA TRƯỚC KHI XÂY LẠI HỆ THỐNG

| Contract / Event | Producer | Consumer | Requirement dữ liệu tối thiểu |
| :--- | :--- | :--- | :--- |
| **Current User / Roles** | Auth/Shared | A/B/C | userId, authUserId, roles, status. |
| **Public Rental Context** | Area A | Rental | bookingId,userId,tripId,status,start/end,pickup,participant context. |
| **Private Rental Context** | Area A | Rental | tripId,userId,TripMember status,start/end,pickup,tripType. |
| **BOOKING_CONFIRMED / CANCELLED** | Area A | Rental/Payment/Notification | bookingId,tripId,userId,status timestamps/cancel source. |
| **PRIVATE_TRIP_MEMBER_JOINED / UPDATED / CANCELLED** | Area A | Rental/GPS/Notification | tripId,userId/member status,time window/version. |
| **Navigation Context** | Area A | GPS | tripId,type,status,active/planned route,Required Checkpoints,radius/mission summary. |
| **CHECKPOINT_ARRIVED / COMPLETED** | GPS | Area A | tripId,checkpointId,userId/role,eventType,timestamp,idempotency. |
| **TRIP_STARTED / COMPLETED / INTERRUPTED** | Area A | GPS/Rental | tripId,type,status,start/end time,checkpoint summary. |
| **Payment Result** | Payment | A/B | purpose,entityRef,amount,status,eventId/providerRef. |
| **Weather Context** | Area A | GPS/Weather | trip geo/time context. |

## 24. NHỮNG LƯU Ý QUAN TRỌNG KHI DÙNG REQUIREMENT NÀY ĐỂ XÂY LẠI DATABASE

Phần này không chỉ cách thiết kế bảng hay viết schema. Đây là checklist về những khái niệm nghiệp vụ mà database mới bắt buộc phải phân biệt và lưu được nếu muốn bám đúng requirement.

| Lưu ý | Yêu cầu dữ liệu phải biểu diễn được |
| :--- | :--- |
| **Public Trip và Private Trip** | Không được coi chúng là cùng một flow tham gia. Public dùng Booking/Participant/Payment; Private dùng Invite/TripMember và không bán slot. |
| **System Trail và Personal Trail** | Phải phân biệt ownership/visibility/source. Public Trip chỉ dùng System Trail; Private Trip có thể dùng Personal Trail owner hoặc System Trail có TrailAccess. |
| **TrailAccess** | Là quyền sử dụng System Trail vĩnh viễn; không copy System Trail thành Trail mới cho User. |
| **Planned vs Actual Route** | Trip phải giữ planned route/snapshot và actual route/trail switches tách khỏi Trail nguồn để lịch sử không thay đổi khi Trail nguồn thay đổi/xóa. |
| **Required Checkpoints** | Trip completion phụ thuộc checkpoint business progress, không phụ thuộc việc bám đúng một polyline ban đầu. |
| **Booking vs TripMember** | Rental eligibility có hai nguồn khác nhau; database phải cho biết rental order bắt nguồn từ Public Booking hay Private Membership mà không làm mơ hồ ownership. |
| **Participant vs Account** | Public Booking có thể mua cho nhiều Participant; Private Trip chỉ member là TrekGo account join bằng invite. |
| **Serialized Equipment** | Không chỉ lưu stock quantity. Mỗi Equipment Unit phải có identity/lifecycle riêng để reserve, QR, condition, maintenance, damage/lost. |
| **Reservation Time Window** | Availability phụ thuộc overlap theo thời gian Trip; phải lưu được start/end và trạng thái reservation. |
| **Condition & Evidence History** | Ảnh/tình trạng trước giao và sau trả là bằng chứng lịch sử, không nên bị overwrite. |
| **Custody Chain** | Phải trace thiết bị/package từ Warehouse -> Logistics -> User -> Logistics -> Warehouse. |
| **Payment Purpose** | Payment có thể phục vụ Booking, TrailAccess, Rental/Deposit; requirement phải phân biệt mục đích và entity tham chiếu. |
| **Idempotency / Event History** | Booking confirm, reservation, payment, handover, checkpoint arrival, refund/settlement đều có hành vi cần tránh xử lý lặp. |
| **GPS Raw vs Summary** | Raw GPS samples có retention riêng; actual path/summary của Trip có thể được giữ lâu hơn. |
| **Transport** | Một Trip có thể có nhiều xe; đây là metadata vận hành, không phải hệ thống dispatch. |
| **Soft Delete / Historical Integrity** | Personal Trail, Product/Unit có history không nên mất dấu khi UI 'delete/deactivate'. |
| **Configurable Rules** | Booking TTL, rental cutoff, quantity limits, checkpoint radius, deviation threshold, GPS sync interval nên là rule/config thay vì giá trị gắn cứng vào business history. |
| **Role & Leader Progression** | LEADER là role duy nhất; Leader application/test/certificate/progress là dữ liệu nghiệp vụ riêng với role. |

## 25. CÁC ĐIỂM KHÔNG ĐỒNG BỘ GIỮA 3 DOC CẦN SỬA Ở TÀI LIỆU CHUYÊN MÔN

| Vấn đề | Requirement tổng chuẩn hóa | Tài liệu cần cập nhật |
| :--- | :--- | :--- |
| **Rental eligibility** | Public Booking CONFIRMED OR Private TripMember ACTIVE. | Rental v1 đang mô tả Booking-only ở nhiều chỗ. |
| **Rental Context** | Phải hỗ trợ cả public booking context và private membership context. | Rental v1 contract hiện tập trung `/bookings/:id/rental-context`. |
| **Trip reschedule** | Public Trip không reschedule; Private Trip có thể update/reschedule trước start. | Rental v1 có `TRIP_RESCHEDULED` chung; cần đổi semantics. |
| **Logistics verification** | Phải xác minh Public Booking hoặc Private TripMember. | Rental v1 mô tả User/Booking/Participant. |
| **User-created Trail priority** | Area A v2 xem Personal Trail là P1; GPS doc xem route recording P2 extension. | MVP có thể chạy Private Trip bằng purchased System Trail; trail recording chỉ làm khi GPS core ổn. |
| **Trail switch context** | Public Leader và Private Host đều có thể switch route hợp lệ khi IN_PROGRESS. | GPS doc chủ yếu diễn giải Leader switch; cần mở rộng trip type/host behavior. |
| **Checkpoint mission ownership** | Area A sở hữu definition/business progress; GPS sở hữu arrival/execution. | Hai doc đều đã gần thống nhất nhưng endpoint ownership vẫn là TBD. |

## 26. MVP PRIORITY TỔNG HỢP

| Priority | Nhóm tính năng |
| :--- | :--- |
| **P0 - Core** | Auth/RBAC; System Trail/Checkpoint; TrailAccess cơ bản; Public Trip; Private Trip + Invite; Booking + capacity/payment; TripTransport cơ bản; Map/GPS session; deviation; checkpoint arrival; Rental Product/Equipment Unit; availability/reservation; Warehouse; Logistics; Return/Deposit. |
| **P1 - Important** | Leader promotion; Personal Trail/checkpoint; Booking cancellation/refund chi tiết; maintenance; weather forecast/risk; GPS progress/history; no-show; dispute; actual route snapshot nếu không hoàn tất cùng P0. |
| **P2 - Extension** | Realtime group map chính xác cao; chat; offline map đầy đủ; advanced Trail recording workflow; advanced analytics/recommendation. |

## 27. ACCEPTANCE CRITERIA CỦA REQUIREMENT TỔNG

* Một Visitor/User có thể đăng ký, đăng nhập và được phân quyền đúng bằng Supabase + TrekGo RBAC.
* LEADER tạo/publish Public Trip từ System Trail; USER tạo Private Trip từ Personal/Purchased Trail; hai flow không bị trộn Booking với Invite.
* Public Booking không oversell, có TTL và payment confirm idempotent; một Booking có thể quản lý nhiều Participant.
* Private Trip invite join trực tiếp nếu còn capacity; Host quản lý member và attendance.
* Trip navigation hiển thị route/checkpoint; GPS periodic sync, deviation warning và checkpoint arrival hoạt động.
* Trip complete dựa trên Required Checkpoints và complete action/override hợp lệ, đồng thời phát downstream events.
* Public Booking CONFIRMED và Private TripMember ACTIVE đều có thể mở rental theo đúng context.
* Rental không double-book exact Equipment Unit trong cùng time window.
* Staff Warehouse và Staff Logistics hoàn thành chain-of-custody từ prepare -> handover -> return.
* Return/inspection/deposit settlement hoàn tất và Equipment Unit quay về đúng trạng thái.
* Weather provider lỗi không làm hỏng Booking/Trip core.
* Các domain chỉ tích hợp qua contract/event đã thống nhất, không tự sửa state thuộc domain khác.

## 28. OPEN DECISIONS / TBD TỔNG HỢP

| TBD | Vấn đề còn mở |
| :--- | :--- |
| **TBD-01** | Giới hạn checkpoint Personal Trail cụ thể. |
| **TBD-02** | Cancellation/refund policy chi tiết cho Public Booking. |
| **TBD-03** | Private Trip reschedule khi thành viên đã reserve Rental và không còn inventory ở ngày mới. |
| **TBD-04** | Thuật toán gợi ý System Trail để nối Required Checkpoints. |
| **TBD-05** | Checkpoint safety override: COMPLETED_WITH_OVERRIDE hay INTERRUPTED. |
| **TBD-06** | Rental cutoff và max quantity per product/participant. |
| **TBD-07** | Damage severity/deduction policy và dispute approval cuối. |
| **TBD-08** | Map provider, deviation threshold, GPS sync interval, checkpoint radius. |
| **TBD-09** | Checkpoint mission completion/evidence endpoint thuộc Area A hay C. |
| **TBD-10** | GPS raw sample retention/privacy period. |
| **TBD-11** | Supabase email verification có bắt buộc trước Booking/Trail Purchase hay không. |

## 29. KẾT LUẬN

Requirement tổng hợp mới xác định TrekGo theo ba trục liên kết:
1. Trail/Trip/Booking và Private Membership là nghiệp vụ chuyến đi,
2. Rental/Inventory/Warehouse/Logistics là nghiệp vụ tài sản và vận hành, và
3. Auth/GPS/Weather là nền tảng định danh và thực thi hành trình.

Khi xây lại database, nhóm nên dùng phần 24 như checklist bắt buộc về khả năng biểu diễn dữ liệu, nhưng không biến tài liệu này thành thiết kế database. Database design nên được tạo sau khi requirement tổng này được team duyệt, đặc biệt sau khi cập nhật những xung đột ở mục 25 và chốt các TBD ảnh hưởng dữ liệu.