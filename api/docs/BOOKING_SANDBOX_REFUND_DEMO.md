# Booking: thanh toán VNPay sandbox, tự hoàn tiền mô phỏng

## Cấu hình local

Giữ DATABASE_URL và DIRECT_URL trỏ đến PostgreSQL local của dự án. Không reset database.

```env
NODE_ENV=development
PAYMENT_PROVIDER=vnpay
PAYMENT_PROVIDER_ENVIRONMENT=SANDBOX
PAYOS_ENABLED=false
PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED=true
PAYMENT_SANDBOX_REFUND_SIMULATION_REMOTE_DEMO_ENABLED=false
PAYMENT_EVENTS_WORKER_ENABLED=true
TRIP_CANCELLATION_WORKER_ENABLED=true
```

Giữ bộ VNPAY_SANDBOX_TMN_CODE, VNPAY_SANDBOX_HASH_SECRET, VNPAY_SANDBOX_RETURN_URL và VNPAY_SANDBOX_API_IP hiện có. Không đưa secret vào frontend. Callback thanh toán VNPay/IPN vẫn cần endpoint backend công khai; chạy local có thể dùng tunnel và đăng ký URL với VNPay. Refund mô phỏng chỉ xử lý nội bộ, không cần tunnel riêng.

Áp dụng migration additive bằng `npx prisma migrate deploy`, sau khi kiểm tra danh sách migration đang chờ vì lệnh này áp dụng **tất cả** migration pending. Sinh Prisma client bằng `npx prisma generate`, rồi khởi động lại backend. Nếu DLL Prisma đang bị server dev giữ, dừng server đó trước khi generate rồi chạy lại.

`NODE_ENV=production` cũng hoạt động cho refund booking có mode SANDBOX_SIMULATED, nếu bật simulation và payment thuộc VNPay SANDBOX. Đây là runtime production chạy demo, không phải giao dịch tiền thật. Database cloud chỉ được phép nếu bật REMOTE_DEMO và cấu hình đúng PAYMENT_SANDBOX_REFUND_SIMULATION_ALLOWED_DATABASE_HOST; không đưa URL chứa mật khẩu vào hostname này.

## Luồng demo

1. Đăng nhập user A, tạo booking và thanh toán VNPay sandbox như bình thường. Đợi backend xác nhận payment SUCCEEDED và application APPLIED.
2. Xem `GET /api/v1/bookings/:id/cancellation-preview` để biết tiền được hoàn theo policy snapshot.
3. Gọi `POST /api/v1/bookings/:id/cancellations` (alias `:id/cancel`) với Bearer token, header `Idempotency-Key` và body `{"reason":"Thay đổi kế hoạch"}`.
4. Backend lưu hủy rồi tự tạo và settle refund mô phỏng. Không gọi API VNPay refund/query-refund. Không cần admin bấm xác nhận.
5. Kiểm tra `refundProcessingStatus`, `refund.status`, lịch sử user và báo cáo admin.

Ví dụ các trường bổ sung trong response HTTP 202:

```json
{
  "refundProcessingStatus": "COMPLETED",
  "refund": {
    "refundId": "<uuid>",
    "paymentId": "<payment-goc>",
    "amount": "70000",
    "currency": "VND",
    "status": "SUCCEEDED",
    "executionMode": "SANDBOX_SIMULATED",
    "confirmationSource": "SANDBOX_SIMULATION",
    "settlementMode": "SANDBOX_SIMULATED",
    "warnings": ["TEST_ONLY", "NO_REAL_MONEY_RETURNED"]
  }
}
```

HTTP 202 xác nhận hủy, không tự chứng minh refund hoàn tất. Nếu settlement lỗi, `refundProcessingStatus=PENDING`, refund có thể còn PENDING hoặc null nếu chưa tạo được. Retry cùng request/key hoặc tác vụ outbox sẽ tiếp tục; không gửi provider. Booking chưa thanh toán hoặc policy cho hoàn 0% trả `refund=null`, `refundProcessingStatus=NOT_REQUIRED`.

Khách tự hủy áp dụng policy snapshot; admin hủy hoặc hủy chuyến được duyệt giữ quy tắc hoàn 100% phần còn được phép hoàn. Hủy cả chuyến xử lý từng booking qua tác vụ nền rồi tự settle, không chờ thao tác hoàn tiền thủ công. Hoàn kỹ thuật của payment booking cũng dùng simulation khi payment thuộc VNPay SANDBOX.

Refund gắn payment/invoice/user gốc, không gắn số thẻ test. Hai user dùng cùng thẻ test vẫn có payment và mã giao dịch riêng. Không tạo số dư ví hoặc thực hiện chuyển tiền ngân hàng.

## Kiểm thử và phục hồi bằng admin

API có sẵn vẫn dùng được:

```http
POST /api/v1/admin/payment-refunds/:refundId/sandbox-simulate-settlement
Authorization: Bearer <admin-token>
Idempotency-Key: demo-refund-recovery-001
Content-Type: application/json

{
  "reason": "Phục hồi hoàn mô phỏng demo",
  "acknowledgeSandboxSimulation": true,
  "expectedProviderStatus": "PENDING"
}
```

Alias: `POST /api/v1/admin/refunds/:refundId/sandbox-simulate-settlement`. Không có webhook giả lập công khai. Body không cho chọn người nhận hoặc số tiền. API dùng chung settlement với luồng hủy, có kiểm tra trạng thái, phiên bản và idempotency. `actorAdminId=null`, `trigger=BOOKING_AUTOMATIC` cho luồng tự động; admin gọi trực tiếp có trigger ADMIN.

`POST /api/v1/admin/refunds/:id/reconcile` phục hồi mode SANDBOX_SIMULATED bằng logic nội bộ, không truy vấn VNPay. Worker chỉ gửi/query refund có mode PROVIDER_API. Refund cũ từng gửi provider không tự chuyển mode. Rental/trail và PayOS/MoMo giữ cơ chế thực thi riêng.

## Báo cáo dòng tiền

- `GET /api/v1/admin/cashflow/summary` (alias `/admin/transactions/summary`).
- `GET /api/v1/admin/transactions` với source, kind, direction, category, status, thời gian, userId và phân trang hiện có.
- `GET /api/v1/admin/payments/:id`, `GET /api/v1/admin/refunds/:id` và các alias `/admin/transactions/payments/:id`, `/admin/transactions/refunds/:id`.

Thu: payment VNPay SANDBOX SUCCEEDED. Chi: refund mô phỏng SUCCEEDED có payment gốc VNPay SANDBOX thành công. Refund cũ có dấu vết sandboxSimulation vẫn thuộc báo cáo; refund provider không có dấu vết mô phỏng bị loại. Khoản pending được thống kê riêng. Cùng phạm vi được áp dụng cho list, count, summary và detail.

Mặc định gateway=vnpay; ALL/BOTH là alias chỉ VNPay. PayOS/MoMo/mock bị từ chối bằng HTTP 400 VALIDATION_ERROR; detail ngoài phạm vi trả 404. Các trường PayOS cũ deprecated và trả null/0. Nhãn TEST_ONLY/NO_REAL_MONEY_RETURNED phải được frontend thể hiện khi tích hợp; số liệu demo không phải số dư tài khoản ngân hàng.

Lỗi tiếp tục theo GlobalErrorFilter: đọc `response.data.error`, kèm meta requestId/serverTime/contractVersion. Không có envelope lỗi riêng cho booking.

## Ghi nhận kiểm tra và migration

Các nhóm test chính đã qua: hủy booking/chuyến với PostgreSQL tạm (33 test), CF02 HTTP trên database test local (24 test), regression provider/history/Swagger/policy/technical reversal (110 test qua, 8 test bỏ qua theo điều kiện database). Bộ payments đầy đủ có 144 test qua, 82 test bỏ qua và 6 lỗi rental đã đối chiếu tái hiện với dịch vụ simulation trước thay đổi. Bốn lỗi liên quan kỳ vọng provenance của provider cũ, hai lỗi do fixture rental thiếu phương thức; không sửa nghiệp vụ rental trong thay đổi này.

Migration `20261104000000_booking_sandbox_refund_mode` đã áp dụng vào database project local. Lệnh migrate deploy cũng áp dụng 5 migration có sẵn đang chờ: `20261031090000_notification_receipts`, `20261031100000_notification_receipts_followup`, `20261031110000_gear_advisor_phase2`, `20261031110100_gear_catalog_revocation`, `20261101120000_rental_evidence_access_recovery`. Không reset database hay sửa migration cũ. Database CF02 test được cập nhật schema để chạy test; kiểm thử hủy chuyến dùng database tạm riêng.
