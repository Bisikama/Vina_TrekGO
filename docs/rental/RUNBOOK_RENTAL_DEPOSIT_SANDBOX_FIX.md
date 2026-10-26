# SỔ TAY VẬN HÀNH (RUNBOOK): MÔ PHỎNG HOÀN TIỀN CỌC SANDBOX VÀ KIỂM KÊ DỮ LIỆU CŨ

**Ngày ban hành và kiểm chứng:** 25/10/2026
**Áp dụng cho:** Local Development với PostgreSQL sandbox cô lập chạy qua hostname loopback (`localhost`, `127.0.0.1`, `::1`)
**Cấm áp dụng:** Tuyệt đối không bật cờ mô phỏng hoặc chạy script apply trên môi trường Production!

> [!IMPORTANT]
> **Giới hạn triển khai môi trường (Environment Boundary):**
> QA/Staging/Sandbox Demo dùng database remote hiện **không được hỗ trợ** bởi guard runtime và sẽ bị từ chối với lỗi `SANDBOX_SIMULATION_ENV_UNSAFE`. Đây là giới hạn triển khai có chủ đích nhằm ngăn chặn việc chạy nhầm hoặc làm sai lệch dữ liệu trên các cơ sở dữ liệu dùng chung. Không nới guard để làm demo; muốn hỗ trợ instance remote phải có thiết kế allowlist/instance identity tin cậy và review bảo mật riêng.

---

## 1. Cấu hình môi trường (Environment Configuration)

Để kích hoạt tính năng mô phỏng hoàn cọc VNPay Sandbox trên máy phát triển cục bộ, các biến môi trường sau bắt buộc phải được thiết lập:

```ini
# Bắt buộc: môi trường không phải production
NODE_ENV=development

# Bắt buộc: cấu hình provider là sandbox
PAYMENT_PROVIDER_ENVIRONMENT=SANDBOX

# Bắt buộc: cờ cho phép Admin mô phỏng kết quả sandbox
PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED=true

# Bắt buộc: worker xử lý outbox thanh toán được kích hoạt
PAYMENT_EVENTS_WORKER_ENABLED=true

# Cơ sở dữ liệu: bắt buộc là localhost / 127.0.0.1 (ngăn chặn chạy nhầm trên cloud DB)
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5432/<dbname>?schema=public
```

> **Cảnh báo an toàn (Fail-Closed Gate):**
> Nếu `NODE_ENV=production`, hoặc `PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED !== 'true'`, hoặc `PAYMENT_PROVIDER_ENVIRONMENT !== 'SANDBOX'`, hoặc hostname của `DATABASE_URL` không phải là máy cục bộ (`localhost`, `127.0.0.1`, `::1`), endpoint sẽ lập tức từ chối với lỗi `SANDBOX_SIMULATION_ENV_UNSAFE` (HTTP 403).

---

## 2. Thứ tự gọi API và trạng thái dữ liệu (API Sequence & Lifecycle)

Luồng kiểm thử hoặc vận hành chuẩn diễn ra theo 4 bước:

```text
[BƯỚC 1: Kiểm tra trước mô phỏng]
  GET /api/v1/rental-orders/:orderId/deposit
  GET /api/v1/rental-orders/:orderId/payments
      │
      ▼ (Refund đang PROCESSING, item REFUND_PENDING, history NONE)
[BƯỚC 2: Admin gọi mô phỏng kết quả provider]
  POST /api/v1/admin/payment-refunds/:refundId/sandbox-simulate-settlement
      │
      ▼ (Shared Payment ghi SUCCEEDED, sinh durable outbox event)
[BƯỚC 3: Worker xử lý bất đồng bộ]
  RentalDepositWorker quét outbox, cập nhật projection, tạo consumer receipt
      │
      ▼ (Item SETTLED, Settlement SETTLED/PARTIALLY_SETTLED, Order xét hoàn tất)
[BƯỚC 4: Kiểm tra kết quả sau worker]
  GET /api/v1/rental-orders/:orderId/deposit
  GET /api/v1/rental-orders/:orderId/payments
```

### Bước 1: Kiểm tra trước mô phỏng

1. **Xem chi tiết cọc đơn thuê:**
   - **Method/Route:** `GET /api/v1/rental-orders/{{orderId}}/deposit`
   - **Headers:** `Authorization: Bearer <USER_OR_LEADER_TOKEN>`
   - **Kết quả mong đợi:**
     - Các item cọc có `status: "REFUND_PENDING"`.
     - `refundStatus: "PROCESSING"`.
     - `financialTruth.providerRefundedAmount: 0`.
     - `financialTruth.realMoneyReturned: false`.
2. **Xem lịch sử thanh toán của USER:**
   - **Method/Route:** `GET /api/v1/rental-orders/{{orderId}}/payments`
   - **Headers:** `Authorization: Bearer <USER_OR_LEADER_TOKEN>`
   - **Kết quả mong đợi:**
     - Bản ghi hoàn tiền có `status: "PROCESSING"`.
     - `financialEffect: "NONE"` (chưa có dòng tiền ghi có).

---

### Bước 2: Admin thực hiện mô phỏng provider SUCCEEDED

- **Method/Route canonical:** `POST /api/v1/admin/payment-refunds/{{refundId}}/sandbox-simulate-settlement`
- **Alias hỗ trợ:** `POST /api/v1/admin/refunds/{{refundId}}/sandbox-simulate-settlement`
- **Headers:**
  - `Authorization: Bearer <ADMIN_TOKEN>` (Chỉ role `ADMIN` được phép gọi)
  - `Idempotency-Key: admin-sim-key-<UUID-hoac-chuoi-ngau-nhien-min-8-chars>`
  - `Content-Type: application/json`
- **Body:**
  ```json
  {
    "reason": "Mô phỏng hoàn cọc VNPay Sandbox do provider kẹt tại mã 05",
    "acknowledgeSandboxSimulation": true,
    "expectedProviderStatus": "PROCESSING",
    "testEvidenceRef": "DEMO-TICKET-20261025"
  }
  ```
- **Response minh họa (HTTP 200):**
  ```json
  {
    "data": {
      "simulationId": "a1b2c3d4e5f6...",
      "refundId": "550e8400-e29b-41d4-a716-446655440000",
      "rentalOrderId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "depositSettlementId": "d3b07384-d113-4809-a79b-57778b47926e",
      "provider": "VNPAY_SANDBOX",
      "providerRefundStatus": "SUCCEEDED",
      "simulationStatus": "SIMULATED",
      "simulatedAmount": "780000",
      "currency": "VND",
      "orderStatus": "RETURN_PROCESSING",
      "financialStatus": "DEPOSIT_HELD",
      "completionMode": "STANDARD",
      "settlementMode": "SANDBOX_SIMULATED",
      "settlementProcessingStatus": "PENDING",
      "simulatedAt": "2026-10-25T06:00:00.000Z",
      "actorAdminId": "admin-user-id",
      "reason": "Mô phỏng hoàn cọc VNPay Sandbox do provider kẹt tại mã 05",
      "warnings": ["TEST_ONLY", "NO_REAL_MONEY_RETURNED"],
      "notices": {
        "userNotice": "Sandbox provider result simulated successfully; no real bank transfer occurred.",
        "adminNotice": "Shared Payment recorded SUCCEEDED. Rental settlement remains asynchronous through the outbox worker."
      }
    }
  }
  ```

> [!NOTE]
> **Quy tắc về trạng thái `settlementProcessingStatus`:**
>
> - `settlementProcessingStatus` trả về `"APPLIED"` nếu và chỉ nếu `PaymentConsumerReceipt` cho consumer `rental-deposit-v1` đã tồn tại trong database (chứng minh Rental worker đã commit toàn bộ projection).
> - Nếu worker chưa chạy hoặc đang chạy dở dang, response trả về `"PENDING"`.
> - Do đó, trong thực tế response có thể là `PENDING` hoặc `APPLIED` tùy thuộc vào độ trễ thực thi. Không mặc định luôn là `PENDING`. Nếu muốn kiểm thử trạng thái trung gian trong test suite, phải chủ động giữ worker bằng test barrier.

---

### Bước 3: Quan sát và thực thi Outbox Worker

1. **Kiểm tra sự kiện outbox đã được sinh ra:**
   Trong cơ sở dữ liệu:
   ```sql
   SELECT id, aggregate_id, event_type, status, retry_count, created_at
   FROM payment_outbox_events
   WHERE aggregate_id = '{{refundId}}'::uuid
     AND event_type = 'REFUND_SUCCEEDED';
   ```
   Kiểm tra bằng chứng Rental consumer đã commit:
   ```sql
   SELECT event_id, consumer_name, processed_at
   FROM payment_consumer_receipts
   WHERE event_id = '{{outboxEventId}}'::uuid
     AND consumer_name = 'rental-deposit-v1';
   ```
2. **Cơ chế xử lý của Worker:**
   - Worker chạy nền định kỳ mỗi 2 giây (`@Interval(2000)`).
   - **Chiến lược kiểm tra (Bounded Polling):** Không dùng thời gian cố định 1–2 giây làm tiêu chí kiểm thử. Client/test phải polling lặp lại có giới hạn (ví dụ tối đa 10 lần, mỗi lần 500ms) kiểm tra điều kiện xuất hiện `PaymentConsumerReceipt` hoặc dữ liệu cập nhật từ USER APIs. Nếu quá thời hạn mà chưa xong, giữ nguyên trạng thái `PENDING` và truy vấn bảng `payment_outbox_events` (`status`, `retry_count`, `last_error`) để chẩn đoán nguyên nhân.

---

### Bước 4: Kiểm tra trạng thái sau khi Worker hoàn tất

#### Trường hợp A: Đơn hàng hoàn tất hoàn hảo (Full Clean Scenario)

Tất cả thiết bị đều PASS kiểm định, hoàn cọc 100% hoặc khấu trừ hợp lệ, không có khiếu nại mở:

1. **Xem chi tiết cọc đơn thuê (`GET /api/v1/rental-orders/{{orderId}}/deposit`):**
   - Tất cả các item cọc chuyển sang `status: "SETTLED"`.
   - `settlementMode: "SANDBOX_SIMULATED"`.
   - `financialTruth.providerRefundedAmount`: ghi nhận đúng số tiền mô phỏng (ví dụ: `780000`).
   - `financialTruth.realMoneyReturned: false` (bảo đảm tính trung thực tài chính, không coi đây là tiền thật đã về tài khoản ngân hàng).
   - `warnings`: chứa cảnh báo `["TEST_ONLY", "NO_REAL_MONEY_RETURNED"]`.
2. **Xem lịch sử thanh toán của USER (`GET /api/v1/rental-orders/{{orderId}}/payments`):**
   - Giao dịch hoàn cọc hiển thị `status: "SUCCEEDED"`.
   - `financialEffect: "CREDIT"` (theo quy tắc hiển thị read model khi `Refund.status === 'SUCCEEDED'`).
3. **Xem trạng thái đơn thuê (`GET /api/v1/rental-orders/{{orderId}}`):**
   - `financialStatus: "SETTLED"`.
   - `orderStatus`: chuyển sang `"COMPLETED"` (nếu đã thỏa mãn toàn bộ 8 cổng: bàn giao xong, custody received, không có case mở).

#### Trường hợp B: Đơn hàng hoàn một phần hoặc có ngoại lệ (Mixed / Partial Scenario)

Ví dụ: 1 item PASS (hoàn 400.000 VND), 1 item HƯ HẠI (đang mở exception case, giữ cọc 600.000 VND):

1. **Xem chi tiết cọc:**
   - Item PASS chuyển sang `status: "SETTLED"`.
   - Item HƯ HẠI giữ nguyên trạng thái kiểm định/tranh chấp (ví dụ: `INSPECTION_PENDING` hoặc `DEDUCTION_PENDING`), **không bị settled vội**.
2. **Xem lịch sử thanh toán:**
   - Xuất hiện 1 dòng hoàn tiền 400.000 VND có `status: "SUCCEEDED"` và `financialEffect: "CREDIT"`.
3. **Xem trạng thái đơn thuê:**
   - `financialStatus`: là `"PARTIALLY_REFUNDED"` hoặc `"REFUND_PENDING"`, **chưa thể là `"SETTLED"`**.
   - `orderStatus`: giữ nguyên trạng thái xử lý hiện tại (ví dụ `"RETURN_PROCESSING"` hoặc `"INSPECTION"`), **tuyệt đối không được chuyển sang `"COMPLETED"`** cho đến khi item tranh chấp và biên bản bồi thường được giải quyết xong.

---

## 3. Kiểm tra nguồn gốc mô phỏng (Provenance Verification)

Để kiểm tra thông tin provenance của một lệnh hoàn cọc đã được mô phỏng:

- **Method/Route:** `GET /api/v1/admin/payment-refunds/{{refundId}}/sandbox-simulation`
- **Headers:** `Authorization: Bearer <ADMIN_TOKEN>`
- **Response (HTTP 200):**
  ```json
  {
    "refundId": "550e8400-e29b-41d4-a716-446655440000",
    "paymentId": "44444444-4444-4444-8444-444444444444",
    "amount": "780000",
    "currency": "VND",
    "providerRefundStatus": "SUCCEEDED",
    "simulationStatus": "SIMULATED",
    "simulationProvenance": {
      "origin": "ADMIN_SANDBOX_SIMULATION",
      "environment": "SANDBOX",
      "status": "SUCCEEDED",
      "simulationId": "a1b2c3d4e5f6...",
      "providerEventId": "sandbox-refund-simulation:550e8400...:succeeded:v1",
      "actorAdminId": "admin-user-id",
      "reason": "Mô phỏng hoàn cọc VNPay Sandbox do provider kẹt tại mã 05",
      "requestedAt": "2026-10-25T06:00:00.000Z",
      "committedAt": "2026-10-25T06:00:01.000Z",
      "warnings": ["TEST_ONLY", "NO_REAL_MONEY_RETURNED"]
    },
    "warnings": ["TEST_ONLY", "NO_REAL_MONEY_RETURNED"]
  }
  ```

---

## 4. Công cụ kiểm kê và sửa chữa dữ liệu cũ (Audit & Repair CLI)

Hệ thống cung cấp script an toàn: `api/scripts/audit-repair-sandbox-deposit-settlement.ts`.

### Quy tắc an toàn bắt buộc:

1. Chế độ mặc định là **DRY-RUN** (chỉ đọc, không ghi cơ sở dữ liệu).
2. Khi chạy chế độ sửa chữa (`--apply`), script bắt buộc kiểm tra:
   - File snapshot từ lần chạy dry-run (`--snapshot-in`).
   - Khớp mã băm `snapshotHash` của từng bản ghi trước khi áp dụng.
   - Danh sách allowlist rõ ràng: `--refund-id=<UUID>` và `--order-id=<UUID>`.
   - Khóa dòng `SELECT ... FOR UPDATE` bên trong transaction trên tất cả các bảng liên quan để chống xung đột tương thời.
3. **Không tự động mở lại các đơn hàng đã `COMPLETED`** hoặc đã phát hành chứng từ PDF bất biến (đưa vào diện `MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL`).

### Hướng dẫn chạy từng bước:

#### Bước A: Chạy kiểm kê Dry-run và xuất Snapshot

```bash
cd api
npm run audit:repair-sandbox-deposit -- --snapshot-out=audit-snapshot-20261025.json
```

Output sẽ in ra danh sách phân loại ứng viên:

```json
{
  "mode": "DRY_RUN",
  "generatedAt": "2026-10-25T06:15:00.000Z",
  "candidates": [
    {
      "refundId": "550e8400-e29b-41d4-a716-446655440000",
      "orderId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "refundStatus": "PROCESSING",
      "classification": "EARLY_PROJECTION_AUTO_REPAIR",
      "reasons": ["PROCESSING_REFUND_WITH_EARLY_SETTLED_PROJECTION"],
      "snapshotHash": "<SHA-256_FROM_DRY_RUN>"
    }
  ]
}
```

> [!NOTE]
> `<SHA-256_FROM_DRY_RUN>` chỉ là placeholder. Mỗi candidate có một `snapshotHash` riêng tương ứng với toàn bộ facts tại thời điểm dry-run. Không tự bịa, tái sử dụng hash trong tài liệu hoặc sao chép hash của candidate khác; apply bắt buộc dùng nguyên file snapshot do chính lần dry-run xuất ra.

#### Bước B: Phân tích kết quả kiểm kê

- **`EARLY_PROJECTION_AUTO_REPAIR`**: Đủ điều kiện để khôi phục projection về đúng trạng thái `REFUND_PENDING` (lệnh hoàn tiền còn `PROCESSING`, items bị ghi sớm là `SETTLED`, đơn chưa `COMPLETED`, chưa có chứng từ bất biến).
- **`MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL`**: Đơn hàng đã `COMPLETED` hoặc đã phát hành văn bản/chứng từ PDF pháp lý. Script **từ chối sửa tự động** để tránh xáo trộn vòng đời đơn; yêu cầu đội ngũ đối soát kiểm tra thủ công.
- **`REPLAY_SHARED_SUCCESS_EVENT`**: Shared Payment thực tế đã `SUCCEEDED` nhưng Rental projection bị thiếu. Cần replay chính sự kiện outbox bền vững (`REFUND_SUCCEEDED`) thay vì sửa đè dữ liệu.
- **`MANUAL_REVIEW_UNSAFE_SOURCE`**: Nguồn tiền không phải SANDBOX, quan hệ khóa ngoại bị sai lệch, có exception case mở, hoặc sự kiện durable đã tồn tại nhưng có dấu hiệu bất thường. Cần đối soát thủ công.

#### Bước C: Thực hiện sửa chữa (Apply Mode) cho bản ghi đủ điều kiện

Chỉ chạy trên môi trường sandbox cục bộ đã được cấp phép:

```bash
cd api
npm run audit:repair-sandbox-deposit -- \
  --apply \
  --snapshot-in=audit-snapshot-20261025.json \
  --refund-id=550e8400-e29b-41d4-a716-446655440000 \
  --order-id=7c9e6679-7425-40de-944b-e07fc1f90ae7
```

Output xác nhận:

```json
{
  "mode": "APPLY",
  "results": [
    {
      "refundId": "550e8400-e29b-41d4-a716-446655440000",
      "orderId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "result": "REPAIRED"
    }
  ]
}
```

Sau khi apply thành công:

1. `DepositSettlementItem` được đưa về `status: 'REFUND_PENDING'` và `settledAt: null`.
2. `DepositSettlement` được cập nhật lại theo tiến độ thực tế thông qua `updateSettlementProgress()`.
3. `RentalOrder.financialStatus` được tính toán lại chính xác.
4. Một bản ghi kiểm toán `SANDBOX_DEPOSIT_EARLY_PROJECTION_REPAIRED` được tạo trong bảng `AuditLog` để lưu vết lịch sử.
