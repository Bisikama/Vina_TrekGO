# M9 — Booking / Check-in

Ngày 26/10/2026. Phạm vi được thống nhất: sửa Booking/Check-in, không sửa Rental. Booking/Check-in DONE_LOCAL; Rental chờ Quân tích hợp và nghiệm thu. Không đánh dấu toàn bộ M9 hoàn tất, chưa deploy. Không thêm migration trong phần này.

## Context nội bộ từ Booking

`BookingParticipationContextService` được export từ BookingsModule. Đây là service nội bộ dùng Prisma transaction của caller, không phải REST endpoint và không thay thế API Rental eligibility. Không cấp quyền đọc context tùy ý cho frontend.

`read(tx, tripId, userId)` trả null cho trip không tồn tại hoặc PRIVATE (membership Private do module Trips quản lý). Với Public, trả contractVersion=1.0, tripId/userId, actorActive, trip status/version/startAt/endAt/cancelledAt/completedAt/leaderId và danh sách sources:

| Field | Ý nghĩa |
|---|---|
| membershipKind | PUBLIC_PARTICIPANT hoặc PUBLIC_BOOKING_BUYER |
| membershipRef | ID participant hoặc booking tương ứng với kind |
| bookingId | Nguồn gốc booking, không tự cấp quyền cho người đọc |
| bookingVersion | Version booking hiện tại; claim/check-in/cancel tăng version |
| bookingStatus | Trạng thái booking tại thời điểm đọc |
| participantStatus/checkinStatus | Có trên nguồn participant; null trên nguồn buyer |
| sourceActive | Trạng thái nguồn quyền; **không phải rentalEligible** |

Trả tất cả nguồn, gồm nguồn lịch sử đã mất hiệu lực; Quân phải chọn và lưu rõ nguồn của đơn thuê. Participant source chỉ active khi account USER/LEADER ACTIVE, participant ACTIVE, booking CONFIRMED/PARTIAL_CHECKIN/CHECKED_IN, trip OPEN/FULL/CLOSED/IN_PROGRESS. Buyer source phản ánh booking CONFIRMED/PARTIAL_CHECKIN/CHECKED_IN/COMPLETED của account; nó không quyết định người mua hộ có quyền thuê theo chính sách Rental. Caller vẫn phải kiểm tra trip terminal markers, cutoff, logistics, quote, policy và stock. Không có QR/contact/invoice/payment trong context.

`lockAndRead(tx, tripId, userId)` khóa Trip trước khi đọc để phối hợp với Booking claim/cancel/check-in. Caller Rental cần gọi **trước các khóa quote/order/stock và trong cùng transaction với việc tạo order**. Snapshot HTTP hoặc đọc context ngoài transaction không cung cấp sự bảo vệ này. Khóa Trip chỉ bảo vệ các writer tuân thủ thứ tự Trip → Booking → Participant; không tuyên bố khóa mọi thay đổi account/policy/logistics. Rental vẫn cần kiểm tra nguồn và version tại thời điểm mutation theo hợp đồng hai bên.

## Check-in hiện tại và phần đã chốt

Base URL `<origin>/api/v1`, Bearer leader hợp lệ. Route chính:

- GET /leader/public-trips/:id/participants (alias /leader/trips/:id/participants).
- POST /leader/public-trips/:id/checkin: `{checkinCode,method:"QR"}` hoặc `{participantId,method:"MANUAL",checkinStatus}`.
- POST /leader/public-trips/:id/participants/:participantId/checkin: `{checkinStatus}`; hỗ trợ CHECKED_IN, NO_SHOW, NOT_CHECKED_IN. Các alias check-in và /leader/trips giữ nguyên.

Quyền leader giữ baseline: account LEADER ACTIVE; nếu trip có leaderId thì actor phải đồng thời là creator và leader; nếu chưa có leaderId thì creator được thao tác. Không mở rộng quyền creator/leader trong M9. Roster chứa thông tin xác minh người đi cho leader có quyền, không dành cho recipient/outsider.

Server chấp nhận trip OPEN/FULL/CLOSED/IN_PROGRESS, không có cancelledAt/completedAt; booking CONFIRMED/PARTIAL_CHECKIN/CHECKED_IN/NO_SHOW, participant ACTIVE/NO_SHOW. Leader có thể phục hồi NO_SHOW hoặc reset điểm danh bằng manual theo baseline. Quyền canCheckIn trên vé là nút cho vé liên kết active chưa điểm danh, không đại diện tất cả thao tác chỉnh sửa của leader. M9 đồng bộ canCheckIn=false khi trip đã có terminal timestamp dù status chưa phản ánh.

**Không có cửa sổ giờ mở check-in riêng trong baseline**: không mặc định “đến ngày khởi hành mới quét được”. M9 giữ nguyên, không tự đặt số giờ/ngày mới. Claim/accept lại có cutoff riêng trước startAt; không nhầm hai quy tắc. Nếu muốn thêm cửa sổ check-in cần chốt nghiệp vụ và kiểm thử riêng.

Claim/accept đổi checkinCode đúng một lần; replay không đổi lại. QR cũ/sai trip → 422 CHECKIN_TOKEN_INVALID. Vé/booking/chuyến mất điều kiện → 409 CHECKIN_NOT_ALLOWED; không có quyền → 403. Dùng shared `{error,meta}`. QR là token điểm danh, không phải chứng minh danh tính người cầm; leader đối chiếu hồ sơ/giấy tờ theo quy trình, không có tự động KYC trong M9.

Các mutation claim/cancel/check-in khóa Trip → Booking → Participant (invitation sau participant khi cần). Nếu accept thắng, QR cũ không thể check-in; nếu check-in trước, invitation pending bị invalidated. Nếu hủy trước, QR hiện tại bị từ chối; nếu check-in trước, hủy USER bị chặn theo baseline. Audit/outbox lỗi thì mutation rollback. Check-in lặp không tăng version hay phát event lần hai.

## Events bàn giao

| Event | Identity / version dùng phối hợp |
|---|---|
| PUBLIC_PARTICIPANT_CLAIMED | tripId, bookingId, participantId, buyerUserId, recipientUserId, bookingVersion, occurredAt |
| PUBLIC_PARTICIPANT_CHECKED_IN / MARKED_NO_SHOW / CHECKIN_RESET (đều có prefix PUBLIC_PARTICIPANT_) | tripId, bookingId, participantId, participantUserId, bookingVersion, checkinStatus, occurredAt |
| BOOKING_CANCELLED | tripId, bookingId, userId, cancellationId, cancelledAt; **bổ sung bookingVersion** cho cả unpaid hold và paid cancellation |
| PRIVATE_TRIP_MEMBER_JOINED và lifecycle Private | Event Trips hiện có: memberId, userId, memberVersion, tripVersion, previousStatus/status; không sửa trong lượt này |

bookingVersion là mốc theo booking, không phải participant version độc lập. Field mới additive, giữ schemaVersion=1 và deduplicationKey hiện có; event cũ có thể thiếu version. Consumer phải tái đọc nguồn hiện tại hoặc xử lý tương thích, không tự áp event cũ lên đơn mới. Event hủy gốc có thể chứa paymentId phục vụ Payment; Quân chỉ lấy whitelist cần thiết, không đưa payload tài chính/QR vào notification. Booking không tự hủy rental order, release stock hoặc quyết định refund Rental.

## Bằng chứng

`tickets.spec.ts`: 33 tests, thêm bốn scenario M9 với nhiều nhánh: một vé A→B, context version/privacy, accept-vs-old-QR, cancel-vs-check-in, terminal timestamp, concurrent replay, rollback do outbox collision. `leader-checkin.spec.ts`: 2 tests baseline/contract; `booking-policy.spec.ts`: 13 tests. Tổng 48/48 đạt trên PostgreSQL localhost với HTTP thật (Supabase token verification stub).

Chạy: PUBLIC_CLAIM_TEST_DATABASE_URL là PostgreSQL localhost cf01_test_invitation_m5*, rồi `node node_modules/jest/bin/jest.js --config test/jest-cf02.json --testRegex '(tickets|leader-checkin|booking-policy).spec.ts$' --runInBand`. M9_CAPTURE_EXAMPLES=true ghi fixture examples. TypeScript/Prisma và OpenAPI cần được kiểm tra khi thay contract. Không coi test context là bằng chứng Rental đã tích hợp; chưa kiểm thử order/payment/stock Rental end-to-end.

[Bàn giao Quân](./rental-handoff-quan.md), [OpenAPI Check-in](../openapi/booking-checkin-m9.json), [requests](./requests.http), [response mẫu từ fixture](./examples.local.json). Không triển khai UI; frontend đọc permissions rồi refetch vé/roster sau mutation, xử lý mã QR hết hiệu lực bằng tải lại vé.

Production TypeScript đã đạt; Prisma validate và xuất OpenAPI đạt ngày 26/10/2026. Đã chạy riêng scenario M9 một vé để ghi examples (1 passed, 32 tests khác không được chọn); số 48/48 phía trên là lượt regression đầy đủ trước đó. Examples chỉ chứa dữ liệu giả của fixture, không phải khách hàng thực.
