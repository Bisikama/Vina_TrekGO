# TREKGO - AREA A FUNCTIONAL REQUIREMENTS v2

**Trail / Trail Access / Public Trip / Private Trip / Booking / Transport**  
**Owner:** Bảo (Backend + Team Lead) & Trung (Frontend)

## 1. MỤC ĐÍCH TÀI LIỆU
Đây là bản nâng cấp của requirement Mảng A, dùng làm nguồn chính để vẽ Use Case, Activity/Sequence/State Diagram, ERD, thiết kế API và chia task code. Bản v2 cập nhật các business rule mới đã chốt: chỉ còn một role LEADER; Leader chỉ tạo Public Trip; USER chỉ tạo Private Trip bằng invite; Personal Trail tách khỏi System Trail; User có thể mua quyền truy cập System Trail; Trip hỗ trợ nhiều xe ở mức metadata; Rental và GPS tiếp tục tích hợp bằng contract rõ ràng.

Mảng A vẫn là nguồn sự thật cho Trail/Checkpoint master, Trip, Booking, Private Trip Membership, Trail Access, Trip Transport và progress nghiệp vụ của Trip. Rental/GPS/Payment không được tự sửa entity của Mảng A mà phải consume API/Event được định nghĩa trong tài liệu.

## 2. THAY ĐỔI CHÍNH SO VỚI BẢN TRƯỚC

| Hạng mục | Bản cũ | Bản v2 |
|---|---|---|
| Leader | Community Leader + Expert Leader | Một role LEADER duy nhất. |
| Public Trip | Nhiều loại Leader theo difficulty policy | Chỉ LEADER tạo; MVP cho phép mọi difficulty. |
| Private Trip | Chưa tách rõ khỏi Booking | Chỉ USER tạo; không bán slot; join bằng invite code/link. |
| Trail | Trail verified/proposal là flow chính | System Trail có sẵn/Verified; Personal Trail do User GPS record, không public. |
| Trail Purchase | Chưa có | TrailAccess vĩnh viễn; Admin đặt giá; MVP làm mức cơ bản. |
| Rental Eligibility | Booking CONFIRMED | Public: Booking CONFIRMED; Private: ACTIVE Trip Member. |
| Reschedule Public Trip | Leader có thể reschedule | Loại khỏi MVP; Leader chỉ gửi cancel request cho Admin. |
| Transport | Chưa có | Trip có 1-n TripTransport; Admin quản lý; không tracking/dispatch. |

## 3. PHẠM VI DOMAIN & OWNERSHIP

| Domain / Entity | Owner chính | Mảng A được phép làm gì | Mảng khác được phép làm gì |
|---|---|---|---|
| Destination / SystemTrail / Checkpoint | Bảo + Trung | CRUD/read master data; System Trail Verified sẵn; checkpoint/route metadata. | GPS consume route/checkpoint; không sửa master. |
| PersonalTrail / PersonalCheckpoint | Bảo + Trung + Luật contract | A sở hữu business entity; Luật cung cấp GPS route/GeoJSON recording. | GPS tạo raw route data; không tự tạo Public Trail. |
| TrailAccess / TrailPurchase | Bảo + Trung | Quản lý quyền truy cập System Trail vĩnh viễn và purchase state. | Payment xử lý tiền; không tự grant access. |
| PublicTrip / TripTrailPlan / TripCheckpoint | Bảo + Trung | Create/publish/cancel request/capacity/checkpoint/transport/lifecycle. | GPS consume navigation; Rental consume dates/context. |
| PrivateTrip / Invite / TripMember | Bảo + Trung | Create/cancel/update, capacity, invite code, membership, attendance. | Rental đọc member eligibility; GPS đọc navigation. |
| Booking / Participant | Bảo + Trung | Hold, payment confirm, participant, capacity, check-in. | Rental chỉ đọc Booking context. |
| TripTransport | Bảo + Trung | Admin CRUD vehicle/driver metadata gắn Trip. | Frontend public/confirmed booking chỉ đọc theo visibility. |
| Rental Order / Equipment Unit | Quân + Nguyên | Không sở hữu. | Rental tự quản lý. |
| GPS Session / Deviation / Weather | Luật | Không sở hữu runtime GPS. | Geo/GPS dùng contract A và gửi checkpoint reached/actual route. |

## 4. ROLE & QUYỀN NGHIỆP VỤ

| Role | Quyền chính trong Mảng A |
|---|---|
| Visitor | Xem Destination/System Trail/Trip public và thông tin công khai; chưa Booking. |
| USER | Booking Public Trip; mua TrailAccess; tạo Personal Trail; tạo Private Trip; generate invite; quản lý member; tham gia Private Trip; thuê đồ theo eligibility. |
| LEADER | Chỉ tạo/quản lý Public Trip; chọn System Trail/Checkpoint; start/switch trail/complete; gửi yêu cầu hủy Trip; không tạo Private Trip. |
| STAFF_WAREHOUSE | Không sở hữu Mảng A; consume Booking/Trip context cần thiết cho rental. |
| STAFF_LOGISTICS | Không sở hữu Mảng A; consume pickup/dropoff/booking/private member context cần thiết. |
| ADMIN | Quản lý System Trail price, Leader approval, Trip oversight/cancel, TripTransport CRUD, moderation/safety. Không tạo Public Trip thay Leader. |

## 5. THUẬT NGỮ & MÔ HÌNH CỐT LÕI

| Thuật ngữ | Định nghĩa dùng trong code/tài liệu |
|---|---|
| System Trail | Trail thuộc TrekGo, mặc định Verified trong MVP, có giá quyền truy cập do Admin đặt. |
| Personal Trail | Trail riêng của USER tạo từ GPS recording/GeoJSON; không public; owner có thể dùng cho Private Trip. |
| TrailAccess | Quyền truy cập vĩnh viễn của User đối với System Trail sau khi thanh toán thành công. |
| Checkpoint | Điểm mục tiêu/POI. Required Checkpoints là điều kiện business để hoàn thành Trip. |
| Planned Trail | Trail dự kiến dùng khi lập Trip; có thể đổi trong khi đi. |
| Actual Route Snapshot | Đường đi thực tế của Trip được lưu riêng để không phụ thuộc Trail gốc. |
| Public Trip | Trip thương mại do LEADER tạo; User tham gia bằng Booking + Payment. |
| Private Trip | Trip riêng do USER tạo; không bán slot; member join qua invite code/link. |
| Trip Member | Tài khoản TrekGo đã join Private Trip; status ACTIVE/LEFT/REMOVED... |
| Booking | Đơn mua chỗ Public Trip; một account có một active Booking/Trip và có thể chứa nhiều Participant. |
| TripTransport | Thông tin xe/tài xế gắn Trip; không phải hệ thống điều phối xe. |

## 6. STATE MODEL BASELINE

| Entity | State MVP | Ghi chú |
|---|---|---|
| Personal Trail | ACTIVE -> DELETED/ARCHIVED | UI có Delete; backend soft delete để giữ history. |
| TrailAccess | PENDING_PAYMENT -> ACTIVE \| FAILED \| REFUNDED/REVOKED | ACTIVE là quyền vĩnh viễn trong MVP. |
| Public Trip | DRAFT -> PUBLISHED/OPEN -> FULL/CLOSED -> IN_PROGRESS -> COMPLETED \| CANCEL_PENDING \| CANCELLED \| INTERRUPTED | Không có RESCHEDULE trong MVP. |
| Private Trip | DRAFT -> OPEN -> IN_PROGRESS -> COMPLETED \| CANCELLED | Host quản lý trực tiếp. |
| Invite | ACTIVE -> EXPIRED \| REVOKED | Hết hạn trước Trip start. |
| TripMember | ACTIVE -> LEFT \| REMOVED \| COMPLETED \| NO_SHOW | Join trực tiếp nếu còn capacity. |
| Booking | PENDING_PAYMENT -> CONFIRMED -> CHECKED_IN/PARTIAL_CHECKIN -> COMPLETED \| CANCELLED \| NO_SHOW \| EXPIRED | TTL hold + payment success. |
| TripCheckpoint | PENDING -> REACHED -> COMPLETED \| SKIPPED/OVERRIDDEN | GPS detect, A lưu business state. |
| TripCancellationRequest | PENDING -> APPROVED \| REJECTED | Leader request; Admin quyết định. |

## 7. PHASE 0 - SYSTEM TRAIL / PERSONAL TRAIL / CHECKPOINT
MVP giữ System Trail ở dạng dữ liệu TrekGo đã Verified sẵn. Personal Trail là feature User tự ghi GPS như Strava và chỉ dùng trong Private Trip.

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
|---|---|---|---|---|---|---|---|
| A-TR-01 | List System Trails | P0 | Visitor/User/Leader | Không | List/search System Trail theo Destination, difficulty, keyword, access state. | Có catalog Trail. | Chỉ Trail ACTIVE/Verified cho public. |
| A-TR-02 | System Trail Detail | P0 | Visitor/User/Leader | Trail accessible | Trả route GeoJSON, distance, elevation, checkpoints, price, access status. | FE render map/trail detail. | Public không lộ internal fields. |
| A-TR-03 | Admin Manage System Trail | P0 | Admin | Đăng nhập Admin | CRUD metadata/price/status của System Trail có sẵn. | Catalog được quản trị. | Route update nên versioned nếu thay đổi sau MVP. |
| A-PT-01 | Create Personal Trail From GPS | P1 | User | Authenticated | Nhận GeoJSON + metadata từ GPS recording; tạo Personal Trail PRIVATE. | Personal Trail ACTIVE. | Luật cung cấp raw route; A persist business entity. |
| A-PT-02 | Create Personal Checkpoints | P1 | User | Own Personal Trail | User chấm checkpoint, nhập info, ảnh; validate giới hạn số lượng. | Checkpoint gắn Personal Trail. | Limit configurable. |
| A-PT-03 | View My Personal Trails | P1 | User | Authenticated | List/detail Personal Trail owner. | User quản lý Trail cá nhân. | Không public. |
| A-PT-04 | Delete Personal Trail | P1 | Owner | Trail tồn tại | UI delete; backend soft delete/archive. | Không hiện trong My Trails. | Trip snapshot/history không mất. |
| A-PT-05 | No Geometry Edit | P0 | System | Trail đã tạo | Không cho chỉnh geometry trực tiếp; muốn đổi phải GPS record/tạo Trail mới. | Route integrity ổn định. | Metadata nhỏ có thể sửa nếu cần. |

### Các API Phase 0
| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
|---|---|---|---|---|---|---|
| AAPI-TR-01 | GET /api/v1/trails | Public | List System Trail | destinationId,difficulty,search,page | Paged System Trails | ACTIVE/Verified only. |
| AAPI-TR-02 | GET /api/v1/trails/:id | Public | System Trail detail | trailId | GeoJSON,checkpoint,price,accessSummary | 404 if inaccessible. |
| AAPI-TR-03 | POST /api/v1/admin/system-trails | Admin | Create/seed System Trail | route,metadata,price,checkpoints | System Trail | Admin only. |
| AAPI-TR-04 | PATCH /api/v1/admin/system-trails/:id | Admin | Update metadata/price | allowed fields | Updated Trail | Audit. |
| AAPI-PT-01 | POST /api/v1/me/personal-trails | User | Create from GPS | geoJson,title,metadata,checkpoints? | Personal Trail | Owner only; PRIVATE. |
| AAPI-PT-02 | GET /api/v1/me/personal-trails | User | My personal trails | status,page | Trail list | Ownership. |
| AAPI-PT-03 | GET /api/v1/me/personal-trails/:id | User | Personal Trail detail | trailId | Trail + checkpoints | Owner only. |
| AAPI-PT-04 | POST /api/v1/me/personal-trails/:id/checkpoints | User | Add checkpoint | lat,lng,name,info,imageRefs | Checkpoint | Config max count. |
| AAPI-PT-05 | DELETE /api/v1/me/personal-trails/:id | User | Delete personal trail | trailId | Deleted/archived status | Soft delete; history safe. |

## 8. PHASE 1 - LEADER ELIGIBILITY / APPROVAL

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
|---|---|---|---|---|---|---|---|
| A-LR-01 | Leader Eligibility Check | P1 | User/System | Authenticated | Tổng hợp completed trip count theo ngưỡng cấu hình. | eligible flag/progress. | Không xét difficulty rank trong MVP. |
| A-LR-02 | Leader Test | P1 | User | Đủ điều kiện sơ bộ | User làm bài test; lưu result/pass status. | Test PASS/FAIL. | Question bank implementation có thể đơn giản. |
| A-LR-03 | Submit Certificate | P1 | User | Test/eligibility phù hợp | Upload chứng chỉ/tài liệu xin Leader. | Application PENDING. | Lưu document refs. |
| A-LR-04 | Admin Review Leader Application | P1 | Admin | Application PENDING | Approve/reject; approve nâng role USER -> LEADER. | Role LEADER. | Reason/audit bắt buộc. |

### Các API Phase 1
| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
|---|---|---|---|---|---|---|
| AAPI-LR-01 | GET /api/v1/me/leader-eligibility | User | View progress | none | completedTrips,threshold,testStatus,certStatus,eligible | Config driven. |
| AAPI-LR-02 | POST /api/v1/me/leader-test/submissions | User | Submit test | answers | score,pass | One active attempt rule optional. |
| AAPI-LR-03 | POST /api/v1/me/leader-applications | User | Apply Leader | certificateRefs,note? | application | Requires baseline conditions. |
| AAPI-LR-04 | PATCH /api/v1/admin/leader-applications/:id | Admin | Approve/reject | decision,reason | application + new role | Audit. |

## 9. PHASE 2 - MUA QUYỀN TRUY CẬP SYSTEM TRAIL

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
|---|---|---|---|---|---|---|---|
| A-TA-01 | Trail Access Purchase | P0 | User | System Trail ACTIVE | Tạo purchase/TrailAccess PENDING_PAYMENT với price snapshot. | Payment pending. | Một User không mua trùng Trail đã ACTIVE. |
| A-TA-02 | Confirm Trail Access | P0 | System | Payment SUCCESS | Grant TrailAccess ACTIVE vĩnh viễn. | Trail xuất hiện trong My Accessible Trails. | Idempotent payment event. |
| A-TA-03 | My Accessible Trails | P0 | User | Authenticated | List System Trail User đã mua + Personal Trail riêng. | User chọn Trail tạo Private Trip. | Không copy Trail entity. |

### Các API Phase 2
| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
|---|---|---|---|---|---|---|
| AAPI-TA-01 | POST /api/v1/trails/:trailId/purchase | User | Create TrailAccess payment | paymentMethod? | purchaseId,paymentRef/URL,amount | Purpose=TRAIL_ACCESS. |
| AAPI-TA-02 | GET /api/v1/me/trail-accesses | User | My purchased System Trails | page,status | Paged accesses + trail summaries | ACTIVE only by default. |
| AAPI-TA-03 | GET /api/v1/trails/:trailId/access | User | Check access | trailId | hasAccess,accessId,purchasedAt | Owner only. |

## 10. PHASE 3 - LEADER TẠO PUBLIC TRIP
LEADER chỉ tạo Public Trip và chỉ dùng System Trail. MVP không giới hạn difficulty theo cấp Leader.

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
|---|---|---|---|---|---|---|---|
| A-PTR-01 | Create Public Trip Draft | P0 | Leader | Role LEADER | Tạo DRAFT với Destination,title,start/end,pickup,capacity,price. | Public Trip DRAFT. | Không cho User. |
| A-PTR-02 | Select Required Checkpoints | P0 | Leader | Trip DRAFT | Chọn ordered Required Checkpoints. | TripCheckpoint plan. | Checkpoint thuộc destination/network. |
| A-PTR-03 | Select / Suggest Planned Trails | P0 | Leader/System | Required checkpoints có | Hệ thống gợi ý System Trail Verified nối checkpoint; Leader chọn 1-n Planned Trails. | TripTrailPlan. | Leader quyết định cuối. |
| A-PTR-04 | Leader Schedule Conflict | P0 | System | Create/update time | Hard block overlap với Public Trip khác của cùng Leader. | Schedule valid. | 409 conflict. |
| A-PTR-05 | Publish Public Trip | P0 | Leader | Draft đầy đủ | Validate System Trail, checkpoint, capacity, time, price; publish OPEN. | Public Trip hiển thị. | No private/personal trail. |
| A-PTR-06 | Submit Cancel Request | P0 | Leader | Trip chưa COMPLETED/CANCELLED | Leader gửi reason/evidence nếu cần; không cancel trực tiếp. | CancellationRequest PENDING. | Không reschedule. |
| A-PTR-07 | Admin Cancel Decision | P0 | Admin | Request PENDING hoặc safety issue | Approve/reject request; Admin có thể cancel trực tiếp khi moderation/safety. | Trip CANCELLED nếu approved. | Emit downstream events. |

### Các API Phase 3
| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
|---|---|---|---|---|---|---|
| AAPI-PTR-01 | POST /api/v1/leader/public-trips | Leader | Create draft | destinationId,title,startAt,endAt,pickupPointId,capacity,price | Trip draft | Role + time/capacity. |
| AAPI-PTR-02 | PATCH /api/v1/leader/public-trips/:id | Leader | Update draft | allowed fields | Updated Trip | State-sensitive. |
| AAPI-PTR-03 | PUT /api/v1/leader/public-trips/:id/checkpoints | Leader | Set required checkpoints | ordered checkpointIds | TripCheckpoint plan | No duplicates. |
| AAPI-PTR-04 | GET /api/v1/leader/public-trips/:id/trail-suggestions | Leader | Suggest trails | checkpointIds? | Candidate System Trails | Read-only suggestion. |
| AAPI-PTR-05 | PUT /api/v1/leader/public-trips/:id/trails | Leader | Set planned System Trails | ordered trailIds | TripTrailPlan | System Trail only. |
| AAPI-PTR-06 | POST /api/v1/leader/public-trips/:id/publish | Leader | Publish | none | Published Trip | 422 if incomplete. |
| AAPI-PTR-07 | GET /api/v1/leaders/me/schedule-conflicts | Leader | Pre-check overlap | startAt,endAt,excludeTripId | hasConflict,conflicts | Server still validates. |
| AAPI-PTR-08 | POST /api/v1/leader/public-trips/:id/cancellation-requests | Leader | Request cancellation | reason,evidenceRefs? | request PENDING | No direct cancel. |
| AAPI-PTR-09 | PATCH /api/v1/admin/trip-cancellation-requests/:id | Admin | Approve/reject | decision,reason | request + trip status | Cross-domain events on approve. |

## 11. PHASE 4 - USER TẠO PRIVATE TRIP / INVITE
USER chỉ tạo Private Trip, không bán slot. Trail hợp lệ: Personal Trail của chính User hoặc System Trail có TrailAccess ACTIVE.

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
|---|---|---|---|---|---|---|---|
| A-PRV-01 | Create Private Trip | P0 | User | Authenticated + valid Trail access | Tạo Private Trip với capacity,start/end,pickup,required checkpoints/planned trail. | Private Trip OPEN. | LEADER bị từ chối theo policy MVP. |
| A-PRV-02 | Generate Invite Code | P0 | Host | Own Private Trip | Tạo 1 invite code/link dùng nhiều lần; expiry trước Trip start. | Invite ACTIVE. | Host có thể regenerate/revoke. |
| A-PRV-03 | Join By Invite | P0 | User | Login + Invite ACTIVE + còn slot | Join trực tiếp, tạo TripMember ACTIVE. | Member count tăng. | Không cần Host approve. |
| A-PRV-04 | Member Management | P0 | Host | Own Trip | List/remove member; Host quản lý capacity. | Member REMOVED. | Cannot remove self host. |
| A-PRV-05 | Leave Private Trip | P0 | Member | Before trip start | Member tự rời Trip. | TripMember LEFT. | Release capacity. |
| A-PRV-06 | Private Attendance | P0 | Host | Trip day | Host manual attendance/member status; không QR. | Attendance updated. | No paid booking. |
| A-PRV-07 | Cancel / Reschedule Private Trip | P0 | Host | Before start | Host được đổi lịch hoặc cancel; notify members; rental downstream revalidate nếu cần. | Trip updated/cancelled. | Cross-domain Rental/GPS. |

### Các API Phase 4
| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
|---|---|---|---|---|---|---|
| AAPI-PRV-01 | POST /api/v1/private-trips | User | Create private trip | trailRef,type,checkpointIds,start/end,pickup,capacity | Private Trip | Trail ownership/access guard; reject LEADER. |
| AAPI-PRV-02 | PATCH /api/v1/private-trips/:id | Host | Update schedule/basic data | allowed fields | Updated Trip | Before start. |
| AAPI-PRV-03 | POST /api/v1/private-trips/:id/invitations | Host | Generate/regenerate invite | expiresAt? | inviteCode,expiresAt | Expires before trip start. |
| AAPI-PRV-04 | GET /api/v1/private-trip-invitations/:code | User | Preview invite | code | Trip summary,remaining slots | Login required before join. |
| AAPI-PRV-05 | POST /api/v1/private-trip-invitations/:code/join | User | Join private trip | none | TripMember ACTIVE | 409 full/duplicate. |
| AAPI-PRV-06 | GET /api/v1/private-trips/:id/members | Host/Member | List members | status? | Member list | Scoped data. |
| AAPI-PRV-07 | DELETE /api/v1/private-trips/:id/members/:memberId | Host | Remove member | memberId | Removed member | Host only. |
| AAPI-PRV-08 | POST /api/v1/private-trips/:id/leave | Member | Leave trip | none | LEFT status | Before start. |
| AAPI-PRV-09 | POST /api/v1/private-trips/:id/cancel | Host | Cancel private trip | reason? | Cancelled Trip | Emit downstream. |
| AAPI-PRV-10 | POST /api/v1/private-trips/:id/attendance | Host | Manual attendance | memberStatuses[] | Attendance result | No QR. |

## 12. PHASE 5 - USER KHÁM PHÁ PUBLIC TRIP / BOOKING / PAYMENT

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
|---|---|---|---|---|---|---|---|
| A-PUB-01 | Public Trip List | P0 | Visitor/User | Trip OPEN | Search/filter by destination,date,difficulty,price,availability. | Find Trip. | No private trip. |
| A-PUB-02 | Public Trip Detail | P0 | Visitor/User | Trip public | Leader summary,schedule,price,capacity,pickup,checkpoint,route summary,vehicleType only. | Decision info. | No plate/driver before booking. |
| A-BK-01 | Create Booking Hold | P0 | User | Trip OPEN + capacity | One active Booking per User/Trip; create PENDING_PAYMENT with participantCount and TTL hold. | Slots held. | Atomic capacity. |
| A-BK-02 | Update Booking Participants | P0 | Owner | Booking active | Update participantCount/basic participant data instead of creating second Booking. | Booking updated. | Revalidate capacity + amount. |
| A-BK-03 | Booking Amount | P0 | System | Valid booking | Server computes price snapshot x participants + fees. | Amount snapshot. | Do not trust FE. |
| A-BK-04 | Payment Confirm | P0 | System | Payment SUCCESS | Booking -> CONFIRMED; emit BOOKING_CONFIRMED. | Rental eligible. | Idempotent. |
| A-BK-05 | Expire Hold | P0 | System | TTL passed | Expire booking and release capacity. | Slot returned. | Background job. |
| A-BK-06 | Booking Detail Visibility | P0 | Owner | Booking exists | Confirmed booking sees full transport details incl. plate/driver/phone. | User prepared. | Pre-confirmation only vehicle type. |
| A-BK-07 | Cancel Booking | P1 | Owner | Before trip start | Cancel by policy; emit event/refund if applicable. | Booking CANCELLED. | Review Rental/Payment. |

### Các API Phase 5
| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
|---|---|---|---|---|---|---|
| AAPI-PUB-01 | GET /api/v1/trips | Public | Browse public trips | destinationId,dateFrom,dateTo,difficulty,price,page | Paged trip summaries | Public only. |
| AAPI-PUB-02 | GET /api/v1/trips/:id | Public | Public trip detail | tripId | Trip + vehicleType + checkpoint/route summary | Hide driver/plate. |
| AAPI-BK-01 | POST /api/v1/trips/:tripId/bookings | User | Create booking hold | participantCount,participants?,idempotencyKey | bookingId,status,expiresAt,amount | One active booking/user/trip. |
| AAPI-BK-02 | PATCH /api/v1/bookings/:id/participants | Owner | Update participant count/data | participants/participantCount | Updated booking | Capacity/amount revalidate. |
| AAPI-BK-03 | GET /api/v1/bookings/:id | Owner | Booking detail | bookingId | Trip/payment/participants/rental eligibility/transport visibility | Ownership. |
| AAPI-BK-04 | GET /api/v1/bookings | User | My bookings | status,page | Paged bookings | Ownership. |
| AAPI-BK-05 | POST /api/v1/bookings/:id/payments | Owner | Create payment | paymentMethod? | paymentRef/url | Only PENDING_PAYMENT. |
| AAPI-BK-06 | POST /api/v1/bookings/:id/cancel | Owner | Cancel booking | reason | Booking/refund summary | Policy/event. |

## 13. PHASE 6 - TRIP TRANSPORT / XE TRUNG CHUYỂN
Transport chỉ là metadata vận hành cho Trip. TrekGo không quản lý lịch tài xế, GPS xe, ETA, dispatch hay chi phí thuê xe.

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
|---|---|---|---|---|---|---|---|
| A-TV-01 | Manage Trip Vehicles | P0 | Admin | Trip tồn tại | Admin thêm/sửa/xóa 1-n xe gắn Trip. | Trip có transport plan. | No vehicle price. |
| A-TV-02 | Vehicle Public Visibility | P0 | System | Trip public | Public detail chỉ trả vehicleType/transportAvailable. | Không lộ private driver data. | Privacy. |
| A-TV-03 | Confirmed Booking Visibility | P0 | Booking Owner | Booking CONFIRMED | Trả vehicleType,plateNumber,driverName,driverPhone,seatCapacity,providerName. | User biết xe/tài xế. | Only confirmed member/owner. |
| A-TV-04 | Pickup/Return Rule | P0 | System | Trip transport configured | Xe đón tại Pickup Point và mặc định trả lại cùng Pickup Point. | Transport context consistent. | No route/ETA management. |

### Các API Phase 6
| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
|---|---|---|---|---|---|---|
| AAPI-TV-01 | GET /api/v1/admin/trips/:id/transports | Admin | List vehicles | tripId | Transport list | Admin only. |
| AAPI-TV-02 | POST /api/v1/admin/trips/:id/transports | Admin | Add vehicle | vehicleType,plateNumber,seatCapacity,driverName,driverPhone,providerName?,note? | TripTransport | No price field. |
| AAPI-TV-03 | PATCH /api/v1/admin/trips/:id/transports/:transportId | Admin | Update vehicle | allowed metadata | Updated transport | Audit. |
| AAPI-TV-04 | DELETE /api/v1/admin/trips/:id/transports/:transportId | Admin | Remove vehicle | transportId | Deleted/archived | Before trip / policy. |

## 14. PHASE 7 - CHECK-IN / START / GPS / TRAIL SWITCH / COMPLETE

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
|---|---|---|---|---|---|---|---|
| A-EX-01 | Public QR Check-in | P0 | Leader/Authorized | Trip day + CONFIRMED | QR/manual authorized check-in Booking/Participant. | Attendance updated. | Separate from rental handover. |
| A-EX-02 | Private Manual Attendance | P0 | Host | Trip day | Host marks active/no-show members; no QR. | TripMember attendance. | Private only. |
| A-EX-03 | Start Trip | P0 | Leader/Host | Trip ready/time valid | Public Leader hoặc Private Host chuyển Trip -> IN_PROGRESS; emit TRIP_STARTED. | GPS session can start. | Role depends tripType. |
| A-EX-04 | Navigation Context | P0 | GPS/User | Trip accessible | Return active/planned trail snapshots, required checkpoints,status. | GPS can render. | Cross-domain read. |
| A-EX-05 | Trail Switch | P0 | Leader/Host | Trip IN_PROGRESS | Switch to allowed Trail; Public target=System Trail; Private target=accessible route; log reason/time. | Active route updated. | Required checkpoints unchanged. |
| A-EX-06 | Checkpoint Reached | P0 | GPS Service | Trip IN_PROGRESS | Receive idempotent checkpoint reached event and update TripCheckpoint. | Progress updated. | GPS owns detection. |
| A-EX-07 | Actual Route Snapshot | P1 | GPS Service | Trip active/end | Persist/summarize actual route snapshot for completed Trip. | Historical actual route. | Do not mutate source Trail. |
| A-EX-08 | Complete Trip | P0 | Leader/Host | Required checkpoints complete OR valid override | Complete Public by Leader / Private by Host; emit TRIP_COMPLETED. | Downstream stop/return. | Checkpoint rule remains source of truth. |

### Các API Phase 7
| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
|---|---|---|---|---|---|---|
| AAPI-EX-01 | POST /api/v1/leader/public-trips/:id/check-in | Leader/Staff | Public attendance | qrCode/participantId | Attendance result | Idempotent. |
| AAPI-EX-02 | POST /api/v1/private-trips/:id/attendance | Host | Private attendance | memberStatuses[] | Attendance result | Host only. |
| AAPI-EX-03 | POST /api/v1/trips/:id/start | Leader/Host | Start trip | none | IN_PROGRESS Trip | Role based trip type. |
| AAPI-EX-04 | GET /api/v1/trips/:id/navigation-context | Participant/Geo | Read navigation | tripId | plannedTrails,activeTrail,requiredCheckpoints,status | No GPS runtime DB. |
| AAPI-EX-05 | POST /api/v1/trips/:id/trail-switches | Leader/Host | Switch trail | targetTrailId,reason | Switch log + context | Validate access/type. |
| AAPI-EX-06 | POST /api/v1/internal/trips/:id/checkpoints/:cpId/reached | Geo Service | Persist reached | subjectId,detectedAt,evidence?,idempotencyKey | Checkpoint progress | Service auth. |
| AAPI-EX-07 | POST /api/v1/internal/trips/:id/actual-route-snapshot | Geo Service | Persist actual route | geoJson/summary | Saved snapshot ref | No source Trail mutation. |
| AAPI-EX-08 | POST /api/v1/trips/:id/complete | Leader/Host | Complete trip | overrideReason?,evidence? | Completed Trip | Required checkpoints validation. |

## 15. API / EVENT CẦN PHỐI HỢP GIỮA CÁC MẢNG

| API / Event | Owner | Consumer | Purpose | Key Contract | Review |
|---|---|---|---|---|---|
| GET /internal/bookings/:id/rental-context | Area A | Rental | Public rental eligibility/context | bookingId,userId,tripId,status,start/end,pickup,participantCount | Bảo + Quân |
| GET /internal/private-trips/:id/members/:userId/rental-context | Area A | Rental | Private member rental eligibility | tripId,userId,memberStatus,start/end,pickup,tripType | Bảo + Quân |
| EVENT BOOKING_CONFIRMED | Area A | Rental/Notification | Open Public rental | bookingId,tripId,userId,confirmedAt | Bảo + Quân |
| EVENT PRIVATE_TRIP_MEMBER_JOINED | Area A | Rental/Notification | Member can rent | tripId,userId,joinedAt | Bảo + Quân |
| EVENT BOOKING_CANCELLED | Area A | Rental/Payment | Release/refund | bookingId,tripId,cancelSource,cancelledAt | Bảo + Quân |
| EVENT PRIVATE_TRIP_UPDATED/CANCELLED | Area A | Rental + GPS | Revalidate dates/cancel private rental | tripId,oldWindow,newWindow,status,version | Bảo + Quân + Luật |
| GET /trips/:id/navigation-context | Area A | GPS | Render route/checkpoints | tripId,type,status,planned/active trail,required checkpoints | Bảo + Luật |
| POST /.../checkpoints/:cpId/reached | Area A | GPS Service | Persist progress | checkpointId,subject,detectedAt,idempotencyKey | Bảo + Luật |
| EVENT TRIP_STARTED | Area A | GPS/Rental Logistics | Start GPS/downstream active | tripId,type,startAt,actorId | Bảo + Luật + Quân |
| EVENT TRIP_COMPLETED | Area A | GPS + Rental | Stop GPS/open return | tripId,type,completedAt,checkpointSummary | Bảo + Luật + Quân |
| PAYMENT SUCCESS purpose=BOOKING | Payment | Area A | Confirm Public Booking | paymentRef,bookingId,amount,eventId | Bảo + Payment owner |
| PAYMENT SUCCESS purpose=TRAIL_ACCESS | Payment | Area A | Grant TrailAccess | paymentRef,userId,trailId,amount,eventId | Bảo + Payment owner |

## 16. BUSINESS RULE CỐT LÕI PHẢI CHỐT TRƯỚC KHI CODE

| BR ID | Business Rule | Mức |
|---|---|---|
| BR-A2-01 | Chỉ role LEADER được tạo/publish Public Trip; LEADER không được tạo Private Trip trong MVP. | P0 |
| BR-A2-02 | USER chỉ tạo Private Trip; Private Trip không public, không bán slot, không dùng Public Booking/Trip payment. | P0 |
| BR-A2-03 | Public Trip chỉ dùng System Trail; Personal Trail không được dùng để mở Public Trip. | P0 |
| BR-A2-04 | Private Trip chỉ dùng Personal Trail owner hoặc System Trail có TrailAccess ACTIVE. | P0 |
| BR-A2-05 | TrailAccess sau payment success là quyền sử dụng vĩnh viễn trong MVP; không copy Trail entity cho User. | P0 |
| BR-A2-06 | Personal Trail không public; member của Private Trip được xem route thông qua Trip context. | P0 |
| BR-A2-07 | Personal Trail geometry không edit trực tiếp; muốn thay đổi phải GPS record/tạo Trail mới. | P1 |
| BR-A2-08 | Delete Personal Trail thực hiện soft delete/archive để giữ Trip snapshot/history. | P1 |
| BR-A2-09 | Private invite code dùng nhiều người, join trực tiếp nếu còn slot, hết hạn trước Trip start. | P0 |
| BR-A2-10 | Host được remove member; member được leave trước Trip start; mọi participant phải có TrekGo account. | P0 |
| BR-A2-11 | Public Booking: một User chỉ có một active Booking/Trip; muốn mua thêm chỗ phải update Booking hiện có. | P0 |
| BR-A2-12 | Booking capacity hold atomic/concurrency-safe; TTL hết phải release; payment success mới CONFIRMED. | P0 |
| BR-A2-13 | Rental eligibility: Public = Booking CONFIRMED; Private = TripMember ACTIVE. Mỗi account tự thuê cho chính mình. | P0 |
| BR-A2-14 | Leader không được reschedule Public Trip trong MVP; muốn cancel phải submit request cho Admin. | P0 |
| BR-A2-15 | Admin không tạo Public Trip; chỉ oversight/cancel/safety/transport/Leader approval. | P0 |
| BR-A2-16 | Cùng một LEADER không có hai Public Trip overlap. | P0 |
| BR-A2-17 | Planned Trail là route dự kiến; Trip completion dựa trên Required Checkpoints + Leader/Host complete action. | P0 |
| BR-A2-18 | Leader/Host có thể switch Trail khi IN_PROGRESS; required checkpoints không đổi. | P0 |
| BR-A2-19 | Public Trip QR check-in; Private Trip Host manual attendance. | P0 |
| BR-A2-20 | Trip có thể có nhiều TripTransport; chỉ Admin CRUD; không lưu giá xe/ETA/GPS/dispatch. | P0 |
| BR-A2-21 | Public detail chỉ lộ vehicleType; full plate/driver/phone chỉ hiện cho Booking CONFIRMED. | P0 |
| BR-A2-22 | Pickup Point là điểm xe đón; MVP mặc định xe trả về cùng Pickup Point. | P0 |
| BR-A2-23 | Leader promotion yêu cầu completed trip threshold + test pass + certificate + Admin approve. | P1 |

## 17. ERROR CONTRACT / VALIDATION CHUNG

| HTTP | Code đề xuất | Ý nghĩa |
|---|---|---|
| 400 | VALIDATION_ERROR | Payload sai format/range. |
| 401 | UNAUTHENTICATED | Chưa đăng nhập/token sai. |
| 403 | FORBIDDEN | Sai role/ownership. |
| 403 | TRAIL_ACCESS_REQUIRED | Private Trip dùng System Trail chưa mua quyền. |
| 403 | LEADER_CANNOT_CREATE_PRIVATE_TRIP | LEADER bị chặn tạo Private Trip. |
| 404 | NOT_FOUND | Trail/Trip/Booking/Invite không tồn tại hoặc inaccessible. |
| 409 | CAPACITY_CONFLICT | Không đủ chỗ khi Booking/Private Join concurrency. |
| 409 | ACTIVE_BOOKING_EXISTS | User đã có active Booking cho Trip. |
| 409 | LEADER_SCHEDULE_CONFLICT | Leader có Public Trip overlap. |
| 409 | INVALID_STATE_TRANSITION | Action không hợp lệ ở state hiện tại. |
| 410 | BOOKING_HOLD_EXPIRED | Booking hold hết TTL. |
| 410 | INVITE_EXPIRED | Private invite hết hạn/revoked. |
| 422 | TRIP_NOT_READY_TO_PUBLISH | Thiếu checkpoint/trail/time/capacity/price. |
| 422 | INVALID_TRAIL_FOR_TRIP_TYPE | Trail không phù hợp Public/Private rule. |

## 18. ENTITY / ERD TỐI THIỂU

| Entity | Field/Relation quan trọng | Ownership / Ghi chú |
|---|---|---|
| User | id,authId,role,status | Shared identity; Area A consumes. |
| LeaderProfile | userId,completedTripCount,testStatus,approvalStatus | One Leader role; no difficulty tier MVP. |
| Destination | id,name,status,mapBounds/center | A owns. |
| SystemTrail | id,destinationId,routeGeoJson,difficulty,distance,elevation,price,status | Verified/seeded. |
| Checkpoint | id,destinationId,name,lat,lng,type,defaultRadius,status | Master checkpoint. |
| TrailCheckpoint | trailId,checkpointId,sequence | System Trail network. |
| PersonalTrail | id,ownerUserId,destinationId?,routeGeoJson,title,status,createdAt | Private, GPS-derived. |
| PersonalCheckpoint | id,personalTrailId,lat,lng,name,info,imageRefs,sequence | Config max count. |
| TrailAccess | id,userId,systemTrailId,status,purchasedAt,priceSnapshot,paymentRef | Permanent access. |
| Trip | id,type,host/leaderId,destinationId,title,startAt,endAt,pickupPointId,capacity,price?,status | PUBLIC/PRIVATE discriminator. |
| TripTrailPlan | tripId,trailRef,trailType,sequence,isActive,snapshotRef | Plan + snapshot. |
| TripTrailSwitch | tripId,fromRef,toRef,reason,switchedAt,actorId | Actual switch log. |
| TripCheckpoint | tripId,checkpointRef,sequence,required,status | Business progress. |
| TripActualRouteSnapshot | tripId,geoJson/summary,recordedAt | Historical actual route. |
| PrivateTripInvite | id,tripId,code,status,expiresAt,createdBy | Multi-use. |
| TripMember | id,tripId,userId,status,joinedAt | Private membership. |
| Booking | id,tripId,userId,participantCount,status,expiresAt,priceSnapshot,totalAmount,paymentRef | Public only. |
| Participant | id,bookingId,fullName,phone?,emergencyContact?,status | Public booking participants. |
| Attendance | tripId,subjectType,subjectId,status,checkedInAt,actorId | Booking participant / private member. |
| TripTransport | id,tripId,vehicleType,plateNumber,seatCapacity,driverName,driverPhone,providerName,note | Admin managed; no price. |
| TripCancellationRequest | id,tripId,leaderId,reason,evidenceRefs,status,reviewedBy | Public Trip cancellation approval. |

## 19. ACCEPTANCE CRITERIA MVP
*   LEADER tạo/publish được Public Trip từ System Trail và không thể tạo Private Trip.
*   USER tạo được Private Trip từ Personal Trail hoặc System Trail đã có TrailAccess; invite code join trực tiếp nếu còn capacity.
*   TrailAccess mua một lần và dùng vĩnh viễn; Trail xuất hiện trong My Accessible Trails.
*   Public Booking giữ chỗ bằng TTL, không oversell, payment success xác nhận một lần dù webhook retry.
*   Một User không tạo được hai active Booking cho cùng Trip; có thể update Booking để thêm participant.
*   Public Booking CONFIRMED mở Rental Context; Private TripMember ACTIVE mở Private Rental Context.
*   Admin quản lý 1-n xe cho Trip; public chỉ thấy vehicleType, confirmed booking thấy plate/driver/phone.
*   Leader gửi cancel request, Admin approve/reject; không có Public Trip reschedule trong MVP.
*   Public QR check-in và Private manual attendance chạy đúng role.
*   Leader/Host start Trip, switch Trail, complete theo Required Checkpoints; GPS gửi reached events và actual route snapshot.
*   Cancel/complete/private update phát event cần thiết cho Rental/GPS/Payment.

## 20. API IMPLEMENTATION ROADMAP

| Giai đoạn | API / Feature trọng tâm | Điều kiện hoàn tất |
|---|---|---|
| A0 - Foundation | Auth/RBAC contract, System Trail/Checkpoint read, error contract. | FE render catalog; role rule thống nhất. |
| A1 - Trail Access | Trail purchase + payment purpose TRAIL_ACCESS + My Accessible Trails. | User mua và dùng TrailAccess. |
| A2 - Public Trip | Leader draft/checkpoint/trail suggestion/plan/publish/conflict/cancel request. | Leader publish được Public Trip. |
| A3 - Private Trip | Create Private, invite, join, member management, cancel/update, attendance. | Private flow end-to-end. |
| A4 - Public Booking | Hold/capacity/update participants/payment/confirm/expiry/cancel. | Booking không oversell. |
| A5 - Transport | Admin TripTransport CRUD + visibility policy. | Public/confirmed view đúng. |
| A6 - Rental Contracts | Public Booking rental context + Private Member rental context + events. | Quân tích hợp không chạm DB A. |
| A7 - GPS Contracts | Navigation, start, trail switch, checkpoint reached, actual route, complete. | Luật tích hợp không chạm domain A. |
| A8 - Leader Promotion | Eligibility/test/certificate/Admin approval. | USER -> LEADER flow cơ bản. |
| A9 - Hardening | Cancellation, moderation, downstream event retry, integration tests. | Core journeys ổn định. |

## 21. CÁC DIAGRAM NÊN VẼ

| Diagram | Phạm vi |
|---|---|
| Use Case - Area A v2 | Visitor/User/Leader/Admin + TrailAccess/Public Trip/Private Trip/Booking/Transport. |
| Activity - Leader Public Trip | System Trail -> Required Checkpoints -> Trail suggestion/plan -> publish. |
| Activity - User Private Trip | Trail access/personal trail -> create -> invite -> join -> attendance. |
| Activity - Trail Purchase | Trail detail -> purchase -> payment -> TrailAccess ACTIVE. |
| Activity - Public Booking | Browse -> hold -> update participants -> payment -> confirmed/expire/cancel. |
| Sequence - Booking -> Rental | Rental Context + BOOKING_CONFIRMED. |
| Sequence - Private Member -> Rental | Private membership validation -> rental context. |
| Sequence - Trip -> GPS | Navigation -> checkpoint reached -> trail switch -> actual route -> complete. |
| State - Public Trip | DRAFT/PUBLISHED/IN_PROGRESS/COMPLETED/CANCEL_PENDING/CANCELLED/INTERRUPTED. |
| State - Private Trip | DRAFT/OPEN/IN_PROGRESS/COMPLETED/CANCELLED. |
| State - Booking / Invite / TrailAccess | Các state đã định nghĩa ở mục 6. |
| ERD - Area A v2 | SystemTrail/PersonalTrail/TrailAccess/Trip/Invite/Member/Booking/Transport. |

## 22. OPEN DECISIONS / TBD CÒN LẠI

| TBD | Vấn đề | Khuyến nghị MVP |
|---|---|---|
| TBD-A2-01 | Giới hạn số checkpoint Personal Trail cụ thể bao nhiêu? | Config, ví dụ 10-20; không hard-code service. |
| TBD-A2-02 | TrailAccess refund/revoke sau khi đã dùng tạo Private Trip? | Không xử lý phức tạp trong MVP; ACTIVE coi là final sau payment. |
| TBD-A2-03 | Private Trip reschedule khi member đã có Rental reservation conflict. | Emit update event; Rental trả action-required, không tự đổi unit im lặng. |
| TBD-A2-04 | System Trail trail suggestion thuật toán cụ thể. | MVP filter/query Trail nối checkpoint; không cần shortest-path tối ưu. |
| TBD-A2-05 | Checkpoint override an toàn dùng COMPLETED_WITH_OVERRIDE hay INTERRUPTED. | Chốt cùng GPS khi vẽ state diagram. |
| TBD-A2-06 | Cancellation/refund policy Public Booking chi tiết theo số ngày. | P1 config; không hard-code trong Booking service. |

## 23. KẾT LUẬN
Bản v2 tách rõ ba đường nghiệp vụ: LEADER -> Public Trip -> Booking/Payment; USER -> Private Trip -> Invite/Member; USER -> Trail Purchase/Personal Trail -> quyền tạo Private Trip. Mảng A tiếp tục giữ ownership business state, trong khi Rental/GPS/Payment tích hợp bằng contract/event. Thiết kế này giảm xung đột code, tránh lách doanh thu qua Private Trip của Leader, và vẫn giữ phạm vi MVP có thể triển khai trong 8 tuần.