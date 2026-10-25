# Runbook: Rental Deposit Refund Sandbox Settlement

Runbook này chỉ áp dụng cho test/demo sandbox cô lập. Mobile/FE không gọi Admin endpoint trực tiếp.

## Điều kiện an toàn

API simulator chỉ hoạt động khi tất cả điều kiện sau đúng:

- tài khoản Bearer có role `ADMIN`;
- `NODE_ENV` không phải `production`;
- `PAYMENT_PROVIDER_ENVIRONMENT=SANDBOX`;
- `PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED=true`;
- `DATABASE_URL` trỏ tới host local cô lập (`localhost`, `127.0.0.1` hoặc `::1`);
- refund là `DEPOSIT`, gateway `vnpay`, environment `SANDBOX`, status `PROCESSING`;
- evidence VNPay đã xác minh có `vnp_ResponseCode=00` và `vnp_TransactionStatus=05` hoặc `06`;
- order, settlement, source payment, payment allocations và item allocations khớp tuyệt đối.

Không ghi secret/hash signature vào evidence, ticket hoặc log. `PAYMENT_EVENTS_WORKER_ENABLED=true` để Rental worker áp dụng outbox; có thể tạm tắt trong test worker-delay có kiểm soát.

## Trình tự kiểm thử qua Swagger

### 1. Chứng minh nghiệp vụ refund đã tồn tại

Gọi route user thực tế:

```http
GET /api/v1/rental-orders/{orderId}/deposit
Authorization: Bearer {userToken}
```

Kiểm tra FINAL inspection/source/deduction/refundAmount, `refundRef`, item eligibility và `refundStatus=PROCESSING`. Simulator không tạo hoặc duyệt các bước này.

Kiểm tra refund:

```http
GET /api/v1/refunds/{refundId}
Authorization: Bearer {adminToken}
```

Trước simulation, transaction history không được coi refund PROCESSING là CREDIT:

```http
GET /api/v1/user/transactions?source=RENTAL&kind=REFUND
Authorization: Bearer {userToken}
```

### 2. Mô phỏng provider terminal success

Route chính:

```http
POST /api/v1/admin/payment-refunds/{refundId}/sandbox-simulate-settlement
Authorization: Bearer {adminToken}
Idempotency-Key: sandbox-refund-{stable-test-key}
Content-Type: application/json

{
  "expectedVersion": 1,
  "reason": "Swagger sandbox settlement verification",
  "acknowledgeSandboxSimulation": true,
  "expectedProviderStatus": "PROCESSING",
  "testEvidenceRef": "QA-TICKET-123"
}
```

`expectedVersion` là optional nhưng nên gửi từ refund detail vừa đọc. Alias tương thích hiện có là `POST /api/v1/admin/refunds/{refundId}/sandbox-simulate-settlement`.

Response hợp lệ phải có:

- `providerRefundStatus: "SUCCEEDED"`;
- `simulationStatus: "SIMULATED"`;
- `settlementMode: "SANDBOX_SIMULATED"`;
- `settlementProcessingStatus: "PENDING"` nếu worker chưa xử lý, hoặc `"APPLIED"` nếu outbox đã processed;
- warnings gồm `TEST_ONLY` và `NO_REAL_MONEY_RETURNED`;
- không được claim order `SETTLED/COMPLETED` khi worker còn pending.

Cùng Idempotency-Key và body trả response đã lưu. Cùng key nhưng body khác trả conflict qua Global Error Filter.

### 3. Kiểm tra provenance và Shared Payment truth

```http
GET /api/v1/admin/payment-refunds/{refundId}/sandbox-simulation
Authorization: Bearer {adminToken}
```

Provenance phải có `origin=ADMIN_SANDBOX_SIMULATION`, actor Admin, environment SANDBOX, stable event/refund references và warnings test-only.

`GET /api/v1/refunds/{refundId}` phải trả `SUCCEEDED` và `refundedAt` khác null. User transaction history lúc này có thể hiện CREDIT vì history đọc Shared Payment truth, không cần đợi Rental worker.

### 4. Quan sát worker delay

Ngay sau simulation và trước khi worker consume:

- refund: `SUCCEEDED`;
- durable outbox `refund:{refundId}:succeeded:v1`: `PENDING`;
- deposit item: `REFUND_PENDING`;
- response/read model không claim order đã hoàn tất;
- `financialTruth.realMoneyReturned=false` đối với synthetic sandbox success.

Read-only SQL dành cho DB test/local (không đưa connection string vào log):

```sql
SELECT status, refunded_at, reconcile_status
FROM refunds
WHERE id = '<refund UUID>';

SELECT event_type, status, retry_count, last_error
FROM payment_outbox_events
WHERE aggregate_type = 'Refund' AND aggregate_id = '<refund UUID>';
```

### 5. Cho worker xử lý và tải lại

Đảm bảo API process có `PAYMENT_EVENTS_WORKER_ENABLED=true`. `RentalDepositWorker` quét event mỗi 2 giây. Sau khi event `PROCESSED`, tải lại:

```http
GET /api/v1/rental-orders/{orderId}/deposit
GET /api/v1/user/transactions?source=RENTAL&kind=REFUND
GET /api/v1/refunds/{refundId}
```

Kỳ vọng:

- đúng các item thuộc refund được `SETTLED` hoặc `REFUND_FAILED` theo event;
- aggregate/totals được tính lại từ toàn bộ item;
- outbox chỉ processed sau khi projection và consumer receipt commit;
- order chỉ `COMPLETED` nếu toàn bộ completion gates chuẩn đều đạt;
- retry/replay không nhân đôi credit, totals, notification hoặc settled timestamp.

Nếu event retry/failed, xem `last_error`; không gọi simulator lần nữa bằng key khác để ép trạng thái.

## Audit dữ liệu simulation cũ

Chạy từ thư mục `api`. Mặc định chỉ đọc:

```powershell
npm.cmd run audit:repair-sandbox-deposit -- --snapshot-out=.\sandbox-deposit-audit.json
```

File snapshot dùng chế độ create-new; chọn tên khác nếu file đã tồn tại. Không commit snapshot vì có internal IDs.

Ý nghĩa classification:

- `EARLY_PROJECTION_AUTO_REPAIR`: có thể xem xét apply trên DB test/local sau review.
- `MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL`: không tự reopen order hoặc xóa chứng từ.
- `REPLAY_SHARED_SUCCESS_EVENT`: replay/reconcile durable event chung; không demote refund.
- `MANUAL_REVIEW_UNSAFE_SOURCE`: không auto repair.

## Apply repair có kiểm soát

Không chạy trên production hoặc DB đang phục vụ người dùng trong nhiệm vụ này. Trước apply phải backup/snapshot DB test và review JSON.

```powershell
npm.cmd run audit:repair-sandbox-deposit -- --apply --snapshot-in=.\sandbox-deposit-audit.json --refund-id=<refund-uuid> --order-id=<order-uuid>
```

Script bắt buộc:

- environment SANDBOX, database local, không production;
- refund và order cùng nằm trong allowlist;
- classification vẫn là `EARLY_PROJECTION_AUTO_REPAIR`;
- snapshot hash không đổi sau dry-run;
- lock order → settlement → items → refund rồi recheck;
- chỉ đưa item có evidence simulator về `REFUND_PENDING`, xóa riêng `settledAt` mô phỏng, tính lại aggregate/financial status và ghi audit;
- không reopen order COMPLETED, không sửa chứng từ bất biến, không tạo refund và không gọi provider.

Chạy lại sau repair không sửa lần hai vì record không còn thuộc nhóm auto-repair.

## Xử lý sự cố

- `SANDBOX_SIMULATION_ENV_UNSAFE`: dừng; kiểm tra NODE_ENV/provider environment/DB host, không hạ guard.
- `SANDBOX_SIMULATION_INVALID_REFUND`: refund không đúng loại/status/evidence 05/06; dùng reconcile/provider query chuẩn.
- `REFUND_SOURCE_INVALID`: order/source/allocation/item không khớp; đưa manual review, không đoán quan hệ.
- `VERSION_CONFLICT`: đọc lại refund, đánh giá thay đổi rồi dùng version mới nếu vẫn hợp lệ.
- Outbox retry nhiều lần: giữ event observable, kiểm tra invariant violation và consumer receipt; không đánh dấu processed thủ công.
- Provider thật về sau mâu thuẫn synthetic result: refund được đánh dấu `NEEDS_REVIEW`; giữ cả provider evidence và provenance simulator.
