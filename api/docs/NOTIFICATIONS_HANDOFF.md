# Thông báo trong app: thiếu hàng, huỷ Trip, kết quả hoàn tiền

Cập nhật: 31/10/2026 · Dành cho: Frontend (web/mobile), PO/BA, vận hành backend

Kênh: **chỉ thông báo trong app** (MongoDB, `GET /api/v1/notifications`). Email cho sự kiện tiền/cọc **chưa làm**.

## 1. Thông báo nào, gửi khi nào, cho ai

| Sự kiện nguồn | `notificationType` | Người nhận | Khi nào | `referenceType` / `referenceId` |
|---|---|---|---|---|
| `RENTAL_PAID` | `RENTAL_ORDER_CONFIRMED` | Chủ đơn thuê | Đơn thuê thanh toán xong | `RENTAL_ORDER` / orderId |
| `RENTAL_ORDER_CANCELLED` (ADMIN huỷ do lỗi TrekGo) | `RENTAL_ORDER_CANCELLED` | Chủ đơn thuê | ADMIN huỷ system-fault | `RENTAL_ORDER` / orderId |
| `RENTAL_ORDER_CANCELLED` (Trip/Booking/thành viên huỷ, **mới**) | `RENTAL_ORDER_CANCELLED` | Chủ đơn thuê | Đơn chưa bàn giao bị huỷ theo Trip, Booking hoặc vì rời Trip | `RENTAL_ORDER` / orderId |
| `RENTAL_ACTION_REQUIRED` (khách đang giữ đồ, **mới**) | `RENTAL_ACTION_REQUIRED` | Chủ đơn thuê | Trip/Booking/thành viên bị huỷ khi khách đang giữ thiết bị | `RENTAL_ORDER` / orderId |
| `RENTAL_SCHEDULE_NOTICE_ISSUED` (**mới**) | `RENTAL_SCHEDULE_CHANGED` | Chủ đơn thuê | Trip dời lịch làm đổi hạn trả | `RENTAL_ORDER` / orderId |
| `RENTAL_ACTION_REQUIRED` (thiếu hàng do hạ hạng, **mới**) | `RENTAL_STAFF_ACTION_REQUIRED` | Mọi ADMIN + STAFF_INVENTORY đang hoạt động | Ngay khi hạ hạng làm đơn chưa bàn giao thiếu hàng | `RENTAL_ORDER` / orderId |
| `RENTAL_ACTION_REQUIRED` `kind = GRADE_SHORTAGE_HANDOVER_DEADLINE` (**mới**) | `RENTAL_STAFF_ACTION_REQUIRED` | Mọi ADMIN + STAFF_INVENTORY đang hoạt động | Đơn vẫn thiếu hàng khi còn ≤ `GRADE_SHORTAGE_ALERT_HOURS` (mặc định 24) giờ tới giờ nhận | `RENTAL_ORDER` / orderId |
| `DEPOSIT_REFUND_SUCCEEDED` | `RENTAL_DEPOSIT_REFUNDED` | Chủ đơn thuê | Provider xác nhận đã hoàn cọc | `RENTAL_ORDER` / orderId |
| `DEPOSIT_RETAINED` | `RENTAL_DAMAGE_REPORTED` | Chủ đơn thuê | Cọc bị khấu trừ theo biên bản | `RENTAL_ORDER` / orderId |
| `PAYMENT_SUCCEEDED` | `PAYMENT_SUCCESS` | Chủ hoá đơn | Thanh toán thành công | `PAYMENT` / paymentId |
| `REFUND_SUCCEEDED` purpose `RENTAL_CANCELLATION` (**mới**) | `PAYMENT_REFUND` | Chủ hoá đơn | Provider xác nhận đã hoàn tiền huỷ đơn thuê | `RENTAL_ORDER` / orderId |
| `REFUND_SUCCEEDED` purpose `BOOKING_CANCELLATION` (**mới**) | `PAYMENT_REFUND` | Chủ hoá đơn | Provider xác nhận đã hoàn tiền huỷ booking | `BOOKING` / bookingId |
| `BOOKING_CANCELLED` `cancelSource = USER` | `BOOKING_CANCELLED` | Người mua | Khách tự huỷ (giữ nội dung cũ) | `BOOKING` / bookingId |
| `BOOKING_CANCELLED` `cancelSource = ORGANIZER` (**đổi nội dung**) | `TRIP_CANCELLED` | Người mua + người đã nhận vé | Trip công khai bị huỷ | Người mua: `BOOKING`; người nhận vé: `TRIP` |
| `BOOKING_CANCELLED` `cancelSource = ADMIN` (**đổi nội dung**) | `BOOKING_CANCELLED` | Người mua + người đã nhận vé | ADMIN huỷ một booking | như trên |
| `PRIVATE_TRIP_CANCELLED` (**mới**) | `TRIP_CANCELLED` | Thành viên ACTIVE (trừ người tạo) | Người tạo huỷ Trip riêng | `TRIP` / tripId |
| `PRIVATE_TRIP_UPDATED` (**mới**, chỉ khi đổi giờ) | `TRIP_SCHEDULE_CHANGED` | Thành viên ACTIVE (trừ người tạo) | Trip riêng đổi giờ bắt đầu/kết thúc | `TRIP` / tripId |

Không gửi cho khách:
- Thiếu hàng do hạ hạng: khách chỉ nhận thông báo khi ADMIN huỷ đơn system-fault.
- `REFUND_FAILED`: không báo khách (đã vào hàng xử lý tay); FE tiếp tục hiển thị "đang xử lý".
- Refund `DEPOSIT` qua payment (đã có `DEPOSIT_REFUND_SUCCEEDED`), `TECHNICAL_REVERSAL`, `TRAIL_ACCESS`.

Refund mô phỏng trong sandbox có tiêu đề bắt đầu bằng `[Sandbox]` và `metadata.sandboxSimulated = true`.

## 2. Quy tắc FE cần theo

- **Hạ hạng không đồng nghĩa bị trừ cọc.** Hao mòn thông thường là 0%; hư hỏng xử lý qua kiểm định và quyết toán riêng. Giá và cọc của đơn cũ là snapshot đã chốt (đã có test PG bảo vệ).
- **`ACTION_REQUIRED` là trạng thái cần xử lý**, không có nghĩa đơn đã huỷ hay tiền đã hoàn.
- **Trạng thái hoàn tiền:** chỉ hiển thị "đã hoàn" khi refund `SUCCEEDED` (hoặc khi nhận `PAYMENT_REFUND` / `RENTAL_DEPOSIT_REFUNDED`). Đơn/booking bị huỷ chỉ có nghĩa là hoàn tiền "đang xử lý".
- **Huỷ Trip không luôn huỷ ngay mọi đơn thuê.** Đơn đã bàn giao (khách đang giữ thiết bị) vẫn hiệu lực, chuyển sang cần xử lý; đọc trạng thái đơn và hành động được phép từ API.
- **Map cọc theo API:**
  - Gear `rentalLines[].depositAmount` (mới, = `deposit`, cọc cả dòng); `deposit` vẫn trả nhưng **deprecated**.
  - Quote/order: `items[].depositAmount` (cọc cả dòng).
  - `depositPerUnit`: cọc một món. Catalog không có cọc cả dòng (chưa có số lượng).
- `metadata` của thông báo có `schemaVersion`, `orderId`, `refundId`, `purpose`, `amount`, `cancellationSource`, `financialStatus`... tuỳ loại; đừng phụ thuộc vào nội dung `content` để rẽ nhánh.

## 3. Thay đổi kỹ thuật (backend)

- `NotificationType` thêm: `TRIP_CANCELLED`, `TRIP_SCHEDULE_CHANGED`, `RENTAL_SCHEDULE_CHANGED`, `RENTAL_ACTION_REQUIRED`, `RENTAL_STAFF_ACTION_REQUIRED`. Filter `GET /notifications?type=` nhận các giá trị mới.
- Payload outbox `RENTAL_ORDER_CANCELLED` của lifecycle thêm `cancellationSource: 'TRIP' | 'BOOKING' | 'MEMBERSHIP'` (additive).
- Gear: `rentalLines[].depositAmount`, quote-intent `lines[].depositAmount`.
- Env mới: `GRADE_SHORTAGE_ALERT_HOURS` (1–168, mặc định 24).
- Migration `20261031090000_notification_receipts`: bảng `rental_notification_receipts`, `payment_notification_receipts`; chèn receipt "đã xử lý" cho event cũ thuộc phạm vi (không gửi dồn khi deploy).
- Migration `20261031100000_notification_receipts_followup`: index `payment_outbox_events (event_type, created_at)`; gỡ receipt backfill của event phát sinh trong 1 giờ trước lúc deploy để các event đó vẫn được gửi (event consumer cũ đã báo không bị gửi lại). Chỉ xoá receipt do migration trước chèn, không đụng dữ liệu khác.
- Kết quả khi deploy: event cũ hơn 1 giờ trước deploy **không** được báo; event trong 1 giờ gần nhất được báo bình thường.
- Sửa lỗi: consumer thông báo rental/payment trước chỉ đọc 25 event mới nhất, không có receipt → khi có > 25 event cùng loại, event cũ hơn không bao giờ được gửi; chống trùng bằng index không unique. Nay dùng receipt theo consumer + `deliveryKey` unique như booking.

## 4. Vận hành

### Đối soát thông báo cũ — chỉ đọc, không tự gửi lại

Các receipt `BACKFILLED_AT_MIGRATION` không chứng minh người dùng đã nhận thông báo. Event quá 3 ngày không có receipt hoàn tất cũng không còn được consumer rental/payment chọn. Chạy các truy vấn sau trên môi trường cần đối soát; đây chỉ là danh sách **ứng viên cần kiểm tra**, không phải danh sách chắc chắn chưa gửi. Consumer booking có chính sách retry riêng.

```sql
SELECT e.id, e.event_type, e.created_at, r.completed_at, r.last_error
FROM rental_outbox_events e
LEFT JOIN rental_notification_receipts r
  ON r.event_id = e.id AND r.consumer = 'rental-notifications-v1'
WHERE e.event_type IN ('RENTAL_PAID', 'RENTAL_ORDER_CONFIRMED', 'DEPOSIT_REFUND_SUCCEEDED',
  'DEPOSIT_RETAINED', 'RENTAL_ORDER_CANCELLED', 'RENTAL_ACTION_REQUIRED', 'RENTAL_SCHEDULE_NOTICE_ISSUED')
  AND (r.last_error = 'BACKFILLED_AT_MIGRATION'
    OR (r.completed_at IS NULL AND e.created_at <= now() - interval '3 days'))
ORDER BY e.created_at, e.id;

SELECT e.id, e.event_type, e.created_at, r.completed_at, r.last_error
FROM payment_outbox_events e
LEFT JOIN payment_notification_receipts r
  ON r.event_id = e.id AND r.consumer = 'payment-notifications-v1'
WHERE e.event_type IN ('PAYMENT_SUCCEEDED', 'REFUND_SUCCEEDED')
  AND (r.last_error = 'BACKFILLED_AT_MIGRATION'
    OR (r.completed_at IS NULL AND e.created_at <= now() - interval '3 days'))
ORDER BY e.created_at, e.id;

SELECT e.id, e.event_type, e.created_at, r.completed_at, r.last_error
FROM booking_outbox_events e
JOIN booking_notification_receipts r
  ON r.event_id = e.id AND r.consumer = 'booking-notifications-v1'
WHERE r.last_error = 'BACKFILLED_AT_MIGRATION'
ORDER BY e.created_at, e.id;
```

Đối chiếu từng ứng viên với loại event, người nhận thực tế và thông báo MongoDB (`metadata.outboxEventId` cùng userId); một số event không có người nhận theo projection. Chỉ sau đó vận hành quyết định cách xử lý thủ công. Không xoá receipt hoặc reset retry hàng loạt: điều đó có thể gửi trùng hoặc gửi nội dung đã lỗi thời. Việc cập nhật `next_attempt_at` không khiến consumer chọn event đã quá 3 ngày.

### Thời điểm báo khách khi thiếu hàng

Khi mới phát hiện nguy cơ thiếu hàng do hạ hạng, hệ thống báo staff. Khi ADMIN xác nhận không thể phục vụ và thực hiện huỷ system-fault, `RENTAL_ORDER_CANCELLED` được đưa vào luồng thông báo khách; nội dung phân biệt “sẽ hoàn” với thông báo hoàn thành sau xác nhận provider. Chưa có event thông báo khách riêng ở thời điểm xác nhận nếu nhân viên xác nhận mà chưa hủy đơn; cần tổ chức xử lý trước giờ hẹn theo Business Flow.

- Consumer: `rental-notifications-v1`, `payment-notifications-v1`, `booking-notifications-v1`; bật bằng `NOTIFICATION_CONSUMER_ENABLED=true`.
- Lỗi gửi: retry backoff 3s × 2ⁿ (tối đa 5 phút); sau 20 lần lỗi (~1 giờ) chuyển sang thử **mỗi giờ**, không dừng hẳn — MongoDB sập vài giờ thì khi hồi phục thông báo vẫn được gửi.
- Event cũ hơn **3 ngày** không gửi nữa (kể cả event chưa từng xử lý, ví dụ khi tắt `NOTIFICATION_CONSUMER_ENABLED` quá 3 ngày): tránh gửi thông báo đã quá cũ; event dữ liệu hỏng cũng tự dừng sau 3 ngày. Xem event đang lỗi:
  ```sql
  SELECT * FROM rental_notification_receipts WHERE completed_at IS NULL AND attempts > 0 ORDER BY attempts DESC;
  ```
  Gửi lại ngay sau khi sửa nguyên nhân: `UPDATE ... SET next_attempt_at = now() WHERE event_id = '<id>' AND consumer = '<consumer>';` (gửi lại an toàn, không tạo trùng).
- Nhắc thiếu hàng chạy trong `RentalOperationalEscalationScheduler` (mỗi phút), mỗi lần hạ hạng gây thiếu chỉ nhắc một lần.
- Nhắc sắp tới giờ nhận chỉ dựa vào việc đơn còn `ACTION_REQUIRED` sau một lần hạ hạng gây thiếu, nên nội dung là "hãy kiểm tra" (đơn có thể đang cần xử lý vì lý do khác).
- Thông báo cho staff mà không có ADMIN/STAFF_INVENTORY nào đang hoạt động: event được retry (`last_error = NO_STAFF_RECIPIENT`) thay vì bỏ qua.
- Người nhận vé đã `NO_SHOW`/`COMPLETED` trước đó không nhận thông báo "vé bị huỷ".

## 5. Chưa làm / cần PO chốt

1. Câu chữ cho khách khi Trip/Booking huỷ lúc đang giữ thiết bị (hiện: "Đơn thuê vẫn còn hiệu lực… Nhân viên TrekGo sẽ liên hệ để hướng dẫn trả thiết bị.").
2. Mốc nhắc staff 24 giờ có phù hợp không (`GRADE_SHORTAGE_ALERT_HOURS`).
3. Có báo khách cho refund `TECHNICAL_REVERSAL` / `TRAIL_ACCESS` không (hiện: không).
4. Email cho sự kiện tiền/cọc (provider, lịch triển khai).
5. Trip công khai dời lịch: booking chưa có event riêng nên chưa báo người tham gia (đơn thuê bị ảnh hưởng đã có `RENTAL_SCHEDULE_CHANGED`).
6. Khách tự huỷ đơn thuê: chưa có thông báo xác nhận (hành động do chính khách làm).
7. `RentalCapacityAlert` không tự đóng khi đơn bị huỷ.
