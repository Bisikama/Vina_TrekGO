# M8 — Inbox hợp nhất và notification backend

Contract local ngày 25/10/2026, base URL `<origin>/api/v1`. Chưa xác minh deployment. Delivery trong M8 là lưu notification vào MongoDB hiện có để client polling/read/unread/archive; không triển khai UI, email hoặc push.

## GET /me/invitations

Bearer USER/LEADER ACTIVE. Chỉ recipient của lời mời, không nhận userId. Query strict: `type=ALL|PUBLIC|PRIVATE` (default ALL), `limit=1..50` (default 20), `cursor` tùy chọn. Không hỗ trợ status filter vì trạng thái hành động được tính lại bởi preview; không coi stored PENDING là còn hiệu lực.

Response `{items,nextCursor,hasMore}`. Item có `id,type,tripId,tripTitle,createdAt,expiresAt,storedStatus,previewRequired:true`. Không trả email, contact, bookingId, tiền, QR hay URL tùy ý. storedStatus/expiresAt là dữ liệu đã lưu; preview mới là nguồn trạng thái hiệu lực, actions và quyền hiện tại. Client không bật Accept từ storedStatus.

Một UNION PostgreSQL có recipient scope tại từng nhánh; keyset `(createdAt DESC,type DESC,id DESC)` với collation C cho type. Cursor giữ đủ microsecond, fingerprint theo actor/type/limit. Đổi account/filter/limit phải tải lại trang đầu. Cursor không cấp quyền: mọi query vẫn scope bằng actor đã xác thực. Không ghép hai offset pages; không có total count. Insert mới ở đầu không dịch chuyển trang sau; refresh trang đầu để lấy item mới. Không cam kết snapshot xuyên các request khi nguồn thay đổi/xóa.

Response `Cache-Control: no-store`. Shared error/meta: 400 query/cursor sai (VALIDATION_ERROR, lỗi cursor có details.reason=INVALID_INBOX_CURSOR), 401 chưa đăng nhập, 403 role/account không phù hợp. API Public/Private riêng M2/M6 tiếp tục được hỗ trợ.

## Audience và điều hướng

| Event | Audience | notificationType | metadata.target |
|---|---|---|---|
| PRIVATE_TRIP_MEMBER_INVITED | recipient | PRIVATE_TRIP_INVITE | `{kind:INVITATION,type:PRIVATE,invitationId}` |
| PUBLIC_PARTICIPANT_INVITED | recipient | PUBLIC_PARTICIPANT_INVITE | `{kind:INVITATION,type:PUBLIC,invitationId}` |
| PUBLIC_PARTICIPANT_CLAIMED | recipient | PUBLIC_PARTICIPANT_CLAIMED | `{kind:TICKET,participantId}` |
| PUBLIC_PARTICIPANT_CLAIMED | buyer khác recipient | PUBLIC_PARTICIPANT_CLAIMED | `{kind:BOOKING_PARTICIPANT,bookingId,participantId}` |
| PRIVATE_TRIP_MEMBER_JOINED | joiner | PRIVATE_TRIP_MEMBER_JOINED | `{kind:PRIVATE_TRIP,tripId}` |
| BOOKING_CONFIRMED / BOOKING_CANCELLED | buyer payload.userId | Giữ loại cũ | `{kind:BOOKING,bookingId}` |

Self-claim buyer=recipient chỉ nhận một notification, hướng tới vé. Không tự thông báo host; không phát thêm thông báo ACCEPTED ngoài CLAIMED/JOINED. Metadata whitelist: schemaVersion=1, tripId, target, outboxEventId, semanticType; giữ confirmedAt/cancellationId/memberRole hợp lệ của event cũ. Không sao chép payload nguyên bản; không có email/phone/QR/payment. Recipient không nhận bookingId của buyer. Định danh trong notification không cấp quyền truy cập.

## Frontend F4

Thêm màn/tab “Lời mời” dùng inbox. Click PUBLIC gọi GET /booking-participant-invitations/:id, PRIVATE gọi GET /private-trip-member-invitations/:id. Hiển thị preview/actions hiện tại trước khi gọi Accept/Decline theo M3/M6. Sau mutation refetch preview, trang đầu inbox, vé hoặc phòng Private tương ứng. Inbox độc lập với notification delivery.

Notification click: map target.kind/type qua bảng route cố định của frontend; tải lại tài nguyên và xử lý 403/404/expired. Event backlog chưa từng giao có thể được giao muộn; thông báo không chứng minh lời mời còn PENDING. Không dùng URL tùy ý từ metadata. Poll khi mở/focus màn và sau mutation, tránh poll chồng nhau. M8 không cam kết websocket/push realtime.

## Read/unread hiện có

- GET /notifications?page=1&pageSize=20, status/type theo DTO hiện có → `{items,total,page,pageSize}`. Item có id (Mongo ObjectId), userId, title, content, notificationType, referenceType/referenceId, status, readAt, metadata, createdAt, updatedAt. Mặc định bỏ ARCHIVED.
- GET /notifications/unread-count → `{unreadCount}`.
- PATCH /notifications/:id/read → `{id,status,readAt}`.
- PATCH /notifications/read-all → `{updatedCount}`.
- PATCH /notifications/:id/archive → `{id,status}`.

Giữ scope tài khoản hiện tại; không dùng UUID lời mời làm notificationId. Đã đọc không có nghĩa đã accept. Không dựng kho notification cạnh tranh trong PostgreSQL.

## Delivery, retry và legacy

BookingNotificationConsumer hiện có chạy mỗi 3 giây nếu NOTIFICATION_CONSUMER_ENABLED=true. Mỗi lượt tối đa 4 batch ×25, oldest-first. Receipt đã hoàn tất loại event khỏi lượt sau, nên backlog tiếp tục drain. Không coi outbox PROCESSED là receipt và không sửa global outbox status. Receipt riêng `(event_id,consumer=booking-notifications-v1)` lưu completedAt/attempts/nextAttemptAt/lastError. Chỉ xử lý sáu event type trên; không đổi Payment/Rental consumers.

Mongo `deliveryKey=eventId:userId:semanticType` có unique partial index, chỉ áp dụng document chứa key dạng string. Legacy document không cần backfill. Consumer xác nhận index trước khi delivery, kể cả autoIndex=false. Upsert `$setOnInsert` chống race, không reset read/archive. Nhận diện notification cũ theo outboxEventId + userId và semanticType hoặc thiếu semanticType; không gửi lại delivery cũ. EventId đơn lẻ không được chặn recipient thứ hai.

Chỉ ghi receipt complete sau khi mọi audience đã được lưu. Crash sau Mongo insert trước PostgreSQL receipt: retry nhận diện delivery cũ rồi hoàn tất receipt. Giao được một recipient: retry chỉ bổ sung người còn thiếu. Lỗi retry sau 3s rồi exponential backoff tối đa 300s; payload sai giữ receipt failed để sửa/replay, không khóa event hợp lệ phía sau. Log chỉ eventId và lỗi tổng quát. Không tự xóa lịch sử.

## Migration và rollout

1. Stop consumer phiên bản cũ trước khi bật bản mới: worker cũ không có deliveryKey và có thể tạo trùng khi chạy cùng bản mới.
2. Áp migration additive `20261025090000_booking_notification_receipts` qua quy trình Prisma migrate deploy. M8 mới áp trên DB test local; không reset hay sửa migration cũ.
3. Mongo runtime cần quyền createIndex cho `notification_delivery_key_unique`. Nếu index thất bại consumer retry, không đánh dấu thành công. Không xóa index/dữ liệu legacy.
4. Bật NOTIFICATION_CONSUMER_ENABLED và kiểm tra receipt completed/failed, attempts, nextAttemptAt cùng notification đúng audience. Inbox không phụ thuộc cờ; cờ chung hiện có vẫn giữ semantics cho các consumer khác.
5. Rollback: dừng consumer trước, giữ bảng/index additive. Không tự chạy lại worker cũ chỉ hiểu eventId/25 event mới nhất. Sửa lỗi dữ liệu/hạ tầng rồi chờ retry; có thể đưa next_attempt_at về now cho event đã xác minh.

Quan sát backlog bằng LEFT JOIN booking_outbox_events với receipt theo consumer, lọc sáu event type và completed_at IS NULL. Không có receipt nghĩa chưa hoàn tất delivery dù global status=PROCESSED. Số notification có thể lớn hơn số event vì CLAIMED có hai audience.

## Kiểm thử và artifact

[OpenAPI](../openapi/invitation-inbox.json), [requests](./requests.http), [inbox HTTP examples](./examples.local.json), [notification example](./notification.local.json). Xuất metadata bằng `node node_modules/ts-node/dist/bin.js scripts/export-invitation-inbox-openapi.ts`. Response shape của API notification legacy được mô tả ở trên.

Inbox/regression: PUBLIC_CLAIM_TEST_DATABASE_URL là PostgreSQL localhost `cf01_test_invitation_m5*`, chạy `node node_modules/jest/bin/jest.js --config test/jest-cf02.json --testRegex '(tickets|booking-policy|trip-history.controller).spec.ts$' --runInBand`.

Delivery: M8_TEST_DATABASE_URL là PostgreSQL localhost database `cf01_test_invitation_m8`; M8_TEST_MONGO_URL là MongoDB localhost database `cf01_test_invitation_m8`. Chạy `node --require ts-node/register --test test/booking-notification.integration.ts`. DB test cần schema baseline + migration M8. Suite đánh dấu receipt của fixture có sẵn khi khởi tạo để chỉ xử lý event do lượt test tạo; tuyệt đối không dùng database ứng dụng. Node test runner tránh lỗi BSON handshake của driver trong Jest VM; không mock Mongo/PostgreSQL. M8_CAPTURE_EXAMPLES=true cập nhật examples giả.

Chưa kiểm chứng staging/production, live Supabase, traffic/load, push/email hoặc replay toàn bộ migration. Inbox test dùng auth guard thật, stub xác minh token Supabase. M9 Rental/Check-in tiếp tục theo owner/SOT.

Kết quả 25/10/2026 trên nhánh feat/invitation sau merge develop: 50/50 Jest tests (tickets/inbox 29, booking policy 13, history 8), 5/5 integration delivery PostgreSQL/MongoDB thật; production TypeScript, Prisma validate và xuất OpenAPI đạt. M8.1/.2/.3/.4/.6 DONE_LOCAL. Backend chưa deploy, chưa áp migration M8 vào database ứng dụng.
