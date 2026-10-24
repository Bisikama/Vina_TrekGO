# Public self-claim và vé cá nhân — M5

Contract cục bộ ngày 23/10/2026. Base URL tích hợp: `<origin>/api/v1`; cần xác minh deployment trước khi sử dụng. Bearer token của USER/LEADER ACTIVE. Không chứa token thật trong bộ tài liệu.

| Method/path (sau prefix) | Mục đích |
|---|---|
| POST /bookings/{id}/participants/{pid}/self-claim | Buyer xác nhận người trên vé là chính mình, liên kết account sau thanh toán |
| GET /me/tickets?page=1&pageSize=20 | Vé Public đã liên kết account hiện tại, gồm lịch sử; pageSize tối đa 50 |
| GET /me/tickets/{participantId} | Chi tiết tối thiểu của vé đã liên kết; vé người khác trả 404 |

Request tự nhận vé:

```http
POST {{baseUrl}}/bookings/{{bookingId}}/participants/{{participantId}}/self-claim
Authorization: Bearer {{token}}
Content-Type: application/json

{"confirmParticipantIdentity":true}
```

```http
GET {{baseUrl}}/me/tickets?page=1&pageSize=20
Authorization: Bearer {{token}}
```

```http
GET {{baseUrl}}/me/tickets/{{participantId}}
Authorization: Bearer {{token}}
```

Body strict: không truyền userId/email hoặc field bổ sung. Không cần Idempotency-Key: replay cùng account/participant trả `alreadyClaimed=true`, không đổi QR lần nữa. Response 200 có Cache-Control: no-store. Thứ tự list là createdAt giảm dần rồi id giảm dần; trang rỗng có items=[], totalPages=0 nếu chưa có vé.

Điều kiện nhận mới: buyer sở hữu booking CONFIRMED, trip PUBLIC OPEN/FULL/CLOSED chưa khởi hành; participant ACTIVE, chưa check-in và chưa liên kết. Không đổi chủ booking/invoice, tên người đi, số chỗ hoặc số tiền. Không tự liên kết bằng tên/email. Pending invitation còn hạn chặn tự nhận; pending hết hạn được chuyển EXPIRED. Không thể nhận thêm một participant hợp lệ trong cùng trip dù thuộc booking khác.

Client đọc `response.data.error` và `meta` theo shared envelope. 400: body/UUID/pagination không hợp lệ; 401: chưa xác thực; 403: actor không phù hợp; 404: booking/participant không thuộc phạm vi truy cập. 409 gồm `PARTICIPANT_ALREADY_LINKED`, `TRIP_PARTICIPATION_EXISTS`, `PENDING_INVITATION_EXISTS`, `PARTICIPANT_CLAIM_NOT_ALLOWED`. Sau conflict, tải lại booking/vé thay vì tự suy luận từ trạng thái cũ.

Vé chỉ trả tên người trên vé, trạng thái participant/check-in/booking, trip/destination summary và permissions. Không trả QR, tiền, invoice, payment hoặc contact. `participantActive` là trạng thái nghiệp vụ hiện tại; `canNavigate/canRent/canCheckIn=false`, reason=INTEGRATION_NOT_VERIFIED cho tới M7/M9. Các field này không thay thế authorization của API liên domain, không tự vô hiệu hóa API Rental hiện có.

Frontend: đặt thao tác “Đây là vé của tôi” ở participant card của buyer sau thanh toán, hiển thị tên người trên vé và yêu cầu xác nhận rõ trước POST. Thành công thì refetch booking + list/detail vé. Trang “Vé của tôi” lấy GET /me/tickets; chọn vé gọi detail. Hiển thị vé đã hủy như lịch sử, không bật hành động hoạt động dựa vào HTTP 200 hoặc alreadyClaimed. Nút gửi vé/accept invitation và linkageStatus thuộc M6, chưa có trong contract này. Không có UI được xây trong M5.

## Bằng chứng và tái lập

- [OpenAPI](../openapi/public-tickets.json), xuất từ controller bằng `node node_modules/ts-node/dist/bin.js scripts/export-public-tickets-openapi.ts`.
- [Response thật từ fixture local](./examples.local.json); UUID/timestamp chỉ minh họa, không dùng làm input. Tất cả dữ liệu giả, không phải dữ liệu khách hàng.
- Chạy tại api: đặt PUBLIC_CLAIM_TEST_DATABASE_URL vào PostgreSQL localhost database `cf01_test_invitation_m5*`, có schema baseline và cả hai migration M5; chạy `node node_modules/jest/bin/jest.js --config test/jest-cf02.json --testRegex tickets.spec.ts$ --runInBand`. Config dùng chung xử lý scheduler ESM. M5_CAPTURE_EXAMPLES=true cập nhật examples.
- Hai migration additive: 20261023120000_public_participant_invitation và 20261023121000_public_invitation_index_names. Migration thứ hai sửa tên index dài, không thay migration đã áp dụng.
- Test dùng PostgreSQL và Nest HTTP thật, shared auth guards/error filter; Supabase token verification được stub bằng account fixture. Không kiểm thử live Supabase hoặc payment gateway bên ngoài.
- Chỉ áp migration vào DB test local. Chưa VERIFIED_ENV/DEPLOYED; chưa kiểm chứng replay toàn bộ lịch sử migration. Rental/Check-in cần owner và SOT ở M9 trước rollout khả năng hoạt động.
- Kết quả ngày 23/10/2026: M5 12/12, booking policy 13/13, CF02 booking/payment/cancel 21/21; production TypeScript và Prisma validate đạt. Database CF02 có thêm constraints/trigger nguyên bản từ migration booking_policy_management; baseline schema Prisma đơn thuần không thay thế các constraint SQL của lịch sử migration.

## Cập nhật M6

Ngày 24/10/2026: API gửi/nhận/thu hồi vé và booking linkage đã có [contract M6](../public-invitations/README.md). Pending mất điều kiện recipient hoặc đã có participation khác cũng được vô hiệu khi self-claim/create; booking/trip/participant mất điều kiện ưu tiên INVALIDATED trước expiry. Schema self-claim/vé không thay đổi. Quota invitation Public/Private dùng chung actor counters.
