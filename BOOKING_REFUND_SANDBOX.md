# Kiểm tra bằng chứng thanh toán và hoàn tiền booking sandbox

## Các bảng cần xem

| Bảng | Bằng chứng cần kiểm tra |
| --- | --- |
| `invoices` | Hóa đơn gắn `booking_id`, tổng tiền, `paid_at`; sau hoàn tiền là `PARTIALLY_REFUNDED` hoặc `REFUNDED`. |
| `payments` | `status = SUCCEEDED`, `payment_gateway = vnpay`, `provider_environment = SANDBOX`, `transaction_ref`, `paid_at`. Lịch sử thu tiền vẫn giữ `SUCCEEDED` sau khi hoàn. |
| `payment_webhook_events` | Thông báo từ cổng: `verified_at`, `processed`, `processing_status`, liên kết `payment_id`. |
| `payment_applications` | `status = APPLIED` chứng minh tiền thu được đã áp dụng cho booking. |
| `payment_outbox_events`, `payment_consumer_receipts` | Sự kiện thanh toán thành công và bằng chứng consumer đã xử lý. |
| `bookings` | `status = CANCELLED`, `cancelled_at`. |
| `booking_cancellations` | Lý do hủy, `refundable_amount`, `policy_snapshot.decision` lưu tỷ lệ và số tiền được duyệt. |
| `booking_outbox_events` | Sự kiện hủy booking; `PROCESSED` cho biết đã xử lý bước đặt lệnh hoàn, không đồng nghĩa đã hoàn thành refund. |
| `refunds` | Liên kết payment/cancellation, số tiền, trạng thái, mã giao dịch hoàn, `refunded_at`. |
| `audit_logs` | Yêu cầu mô phỏng của Admin và sự kiện chấp nhận mô phỏng. |
| `idempotency_records` | Kết quả API mô phỏng được lưu để gọi lại cùng khóa không sinh giao dịch trùng. |

`PROCESSING / NEEDS_REVIEW` là bằng chứng đã tạo yêu cầu hoàn nhưng chưa hoàn tất xử lý.
Kết quả mô phỏng hoàn tất có `refunds.status = SUCCEEDED`, `reconcile_status = RESOLVED`,
`refunded_at` và `provider_payload.sandboxSimulation.status = SUCCEEDED`.
Metadata có `origin = ADMIN_SANDBOX_SIMULATION`, người thực hiện, lý do, thời điểm và
`warnings = [TEST_ONLY, NO_REAL_MONEY_RETURNED]`. Đây là bằng chứng test, không phải xác nhận chuyển tiền thật.
Không tạo webhook VNPAY giả; kết quả mô phỏng đi qua Shared Payment và được ghi audit/outbox.

## Đơn mẫu đã đối chiếu trực tiếp

Booking `753d38ba-48ae-44b4-a8bf-37d9f0a6203c`:

- Payment `dd950c38-90e2-4d8c-a644-758a5d14130e`: `SUCCEEDED`, 2.250.000 VND,
  VNPAY/SANDBOX, mã giao dịch `15721162`, thanh toán lúc 16:24:42 ngày 31/10/2026 (UTC+7).
- Invoice `e99bc2e5-462b-4630-92e6-226a15f6f20f`: `PAID`.
- Webhook `0c78f984-1020-4025-8d6a-a03e38cdeaa3`: đã xác minh, `PROCESSED`.
- Payment application: `APPLIED`; sự kiện `PAYMENT_SUCCEEDED` đã xử lý và có receipt
  của `booking-payment-application-v1`.
- Booking: `CANCELLED`; cancellation `3e52dcc2-9ed1-4b96-a124-00ecad8f51c5`
  lưu quyết định hoàn 80% = 1.800.000 VND.
- Refund `01e76d7f-e0a7-4b0a-9633-d0e13bd20436`: tại lần kiểm tra vẫn là
  `PROCESSING / NEEDS_REVIEW`. Chưa áp dụng mô phỏng lên đơn mẫu; các test ghi dữ liệu
  ở database test riêng. Có thể dùng API bên dưới bằng tài khoản Admin để hoàn tất mô phỏng.

## Mô phỏng hoàn tiền do hủy booking

Chạy backend từ mã mới. Dùng token Admin trên môi trường SANDBOX đã bật
`PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED=true`. Production luôn bị từ chối.
Database local được phép; database demo từ xa phải có cấu hình hostname cho phép theo cơ chế có sẵn.

```http
POST /api/v1/admin/payment-refunds/01e76d7f-e0a7-4b0a-9633-d0e13bd20436/sandbox-simulate-settlement
Authorization: Bearer <ADMIN_TOKEN>
Idempotency-Key: booking-cancellation-demo-753d38ba-v1
Content-Type: application/json

{
  "reason": "Kiểm thử lưu bằng chứng hoàn tiền khi hủy booking",
  "acknowledgeSandboxSimulation": true,
  "expectedProviderStatus": "PROCESSING",
  "testEvidenceRef": "booking:753d38ba-48ae-44b4-a8bf-37d9f0a6203c"
}
```

Có thể gửi `expectedVersion` để kiểm tra phiên bản refund.
Refund `PENDING` cần bật riêng `PAYMENT_SANDBOX_REFUND_SIMULATION_ALLOW_PENDING_REFUND=true`.
Gọi lại cùng khóa và cùng body trả kết quả đã lưu; đổi body với cùng khóa trả lỗi 409.
API kiểm tra booking đã hủy, hóa đơn đúng chủ/đúng booking, payment đã thu và áp dụng,
scope cổng thanh toán khớp, số tiền không vượt quyết định hủy và không có lease đối soát đang chạy.
Trường hợp thiếu phản hồi xử lý từ cổng được ghi `providerConfirmation = UNCONFIRMED_DEMO`.

Xem bằng chứng qua `GET /api/v1/admin/payment-refunds/:refundId/sandbox-simulation`
hoặc `GET /api/v1/refunds/:refundId` bằng tài khoản có quyền.
Nhánh thêm mới hỗ trợ `BOOKING_CANCELLATION`; nhánh `DEPOSIT` giữ cơ chế hiện có.
`RENTAL_CANCELLATION` chưa được mở mô phỏng trong thay đổi này.

## SQL chỉ đọc trong PostgreSQL / Prisma Studio

```sql
SELECT b.id AS booking_id, b.status AS booking_status,
       i.id AS invoice_id, i.status AS invoice_status, i.total_amount,
       p.id AS payment_id, p.status AS payment_status,
       p.payment_gateway, p.provider_environment, p.transaction_ref, p.paid_at,
       pa.status AS application_status,
       c.id AS cancellation_id, c.reason, c.refundable_amount,
       c.policy_snapshot -> 'decision' AS cancellation_decision,
       r.id AS refund_id, r.amount AS refund_amount, r.status AS refund_status,
       r.reconcile_status, r.refund_transaction_ref, r.refunded_at,
       r.provider_payload -> 'sandboxSimulation' AS simulation_evidence
FROM bookings b
LEFT JOIN invoices i ON i.booking_id = b.id AND i.invoice_type = 'BOOKING'
LEFT JOIN payments p ON p.invoice_id = i.id
LEFT JOIN payment_applications pa ON pa.payment_id = p.id
LEFT JOIN booking_cancellations c ON c.booking_id = b.id
LEFT JOIN refunds r ON r.payment_id = p.id AND r.booking_cancellation_id = c.id
WHERE b.id = '753d38ba-48ae-44b4-a8bf-37d9f0a6203c'::uuid;

SELECT id, payment_id, verified_at, processed, processing_status
FROM payment_webhook_events
WHERE payment_id = 'dd950c38-90e2-4d8c-a644-758a5d14130e'::uuid;

SELECT id, event_type, status, created_at
FROM payment_outbox_events
WHERE aggregate_id IN (
  'dd950c38-90e2-4d8c-a644-758a5d14130e'::uuid,
  '01e76d7f-e0a7-4b0a-9633-d0e13bd20436'::uuid
);

SELECT action, entity_id, created_at, new_values
FROM audit_logs
WHERE entity_id = '01e76d7f-e0a7-4b0a-9633-d0e13bd20436'::uuid
ORDER BY created_at;
```

## Kiểm thử

`api/test/cf02.spec.ts` kiểm tra trên database PostgreSQL riêng `cf02_test_*`:
thu tiền bằng webhook mock có chữ ký, xác nhận booking, hủy đơn, tạo refund,
chuyển fixture sang scope VNPAY sandbox và gọi API mô phỏng với tỷ lệ 80%/100%.
Trường hợp chính sách 0% vẫn hủy booking nhưng không tạo refund và hóa đơn giữ `PAID`.
Kiểm tra quyền Admin, từ chối số tiền vượt chính sách, hóa đơn tương ứng,
refund/audit/outbox, trạng thái booking và gọi lặp không nhân đôi giao dịch.
Phần fixture scope này không phải một lần thu tiền trực tiếp qua VNPAY.
`api/test/vnpay-payments.spec.ts` kiểm tra riêng giao thức chữ ký và xử lý VNPAY bằng HTTP stub.

```powershell
cd api
node -r dotenv/config node_modules/jest/bin/jest.js --config test/jest-cf02.json --runInBand
node node_modules/jest/bin/jest.js --config test/jest-payments.json --runInBand --runTestsByPath test/vnpay-payments.spec.ts
```
