# HƯỚNG DẪN FRONTEND — QUYẾT TOÁN CỌC VÀ HOÀN TIỀN ĐƠN THUÊ THỰC TẾ

## ĐỐI CHIẾU TRỰC TIẾP TỪ SOURCE CODE & LOGIC BACKEND VINA_TREKGO

**Ngày cập nhật:** 26/10/2026  
**Phiên bản Backend:** `feat/delivery-record-extend` (Commit hỗ trợ tự động gom hoàn cọc & tự phục hồi)  
**Đối tượng áp dụng:** Đội ngũ Frontend Web / Mobile, QA và kỹ sư tích hợp màn hình Kho (Staff) & Quản trị (Admin)  
**Phạm vi:** Kiểm định thiết bị hoàn trả, tự động gom hoàn cọc (Grouped Refund), xử lý ngoại lệ bồi thường (Admin Exception Review), quyết toán cọc sau thời hạn 48h và mô phỏng hoàn tiền trên VNPay Sandbox.

---

## 1. Bản chất kiến trúc Backend cần nắm vững trước khi code UI

Hệ thống tách biệt hoàn toàn giữa **Quyết toán nghiệp vụ (Business Settlement)** và **Giao dịch tài chính (Financial Refund)**:

```text
[Nhân viên kho gửi FINAL Inspection từng thiết bị]
                       |
                       v
         +-------------+-------------+
         |                           |
[Thiết bị ĐẠT CHUẨN (PASS)]  [Thiết bị HƯ HỎNG/MẤT (ISSUE/MISSING)]
         |                           |
         | Tự động                   v
         | (Không cần Admin duyệt)   [Tạo RentalExceptionCase (status: OPEN)]
         |                           |
         |                           v
         |                   [Admin xem xét bằng chứng & Duyệt khấu trừ]
         |                           |
         |                           v
         |                   [Cửa sổ 48 giờ phản hồi của Khách hàng]
         |                           |
         |                           v (Sau 48h không khiếu nại)
         |                   [Admin bấm Quyết toán giải phóng tiền hoàn dư]
         |                           |
         +-------------+-------------+
                       |
                       v
   [Tự động gom nhóm (Grouped Refund) theo Original Payment]
                       |
                       v
   [Tạo lệnh Refund trên Shared Payment: status = 'PROCESSING']
                       |
                       v
   [Cổng thanh toán phản hồi (Webhook thật HOẶC Admin Sandbox Simulation)]
                       |
                       v
   [Shared Payment: status = 'SUCCEEDED' -> Bắn Outbox Event]
                       |
                       v
   [Rental Worker tiêu thụ sự kiện -> Cập nhật Item: status = 'SETTLED']
                       |
                       v
   [Closure Guards: Kiểm tra toàn diện -> Đơn thuê chuyển 'COMPLETED']
```

### Các nguyên tắc bất di bất dịch cho Frontend:

1. **Không có "Admin duyệt hoàn cọc sạch":** Các thiết bị kiểm định đạt chuẩn (`PASS`, khoản khấu trừ = 0) **hoàn toàn tự động** được hệ thống đưa vào luồng hoàn cọc khi toàn bộ kiểm định của đơn hoàn tất. Admin chỉ duyệt khi có hư hỏng/mất mát (`ISSUE` / `MISSING`).
2. **Nhóm PASS hoàn độc lập:** Nếu một đơn có 2 món PASS và 1 món DAMAGED, Backend sẽ gom và hoàn tiền ngay cho 2 món PASS. **Frontend không được giữ tiền của 2 món PASS chỉ vì món thứ 3 đang chờ giải quyết sự cố.**
3. **`FINAL_PASS_AWAIT_GROUPED_REFUND` là trạng thái chờ hợp lệ:** Khi kho kiểm định lần lượt từng món, các món đạt chuẩn trước đó sẽ mang trạng thái này. Khi món cuối cùng kiểm định xong, hệ thống sẽ tự động giải phóng tất cả để tạo **đúng 1 lệnh hoàn tiền gộp**.
4. **Quyết toán `202 Accepted` không đồng nghĩa tiền đã về tài khoản:**
   - Lệnh hoàn tiền mới chỉ ở trạng thái `PROCESSING`.
   - UI chỉ được hiển thị **"Đã hoàn tiền"** khi `refundStatus === "SUCCEEDED"`.
5. **Tôn trọng cửa sổ 48 giờ khiếu nại:** Khi Admin duyệt khoản bồi thường, số tiền hoàn dư sẽ bị khóa trong 48 giờ để bảo vệ quyền khiếu nại của khách hàng (theo Policy RB-POL-28/29). Backend sẽ từ chối quyết toán nếu gọi trước khi cửa sổ này kết thúc.

---

## 2. Chuẩn hóa ngữ nghĩa dữ liệu (Status Mapping Table)

Để tránh nhầm lẫn giữa các thuật ngữ `SETTLED`, `REFUNDED`, `DEDUCTED`:

### 2.1. Từng món đồ cọc (`items[]` trong API `/rental-orders/:id/deposit`)

| Trường `status` trả về từ API | `refundStatus` kèm theo     | `heldReason` kèm theo             | Ý nghĩa thực tế trên Backend                                                                        | Nhãn hiển thị trên giao diện (UI Badge)                     |
| :---------------------------- | :-------------------------- | :-------------------------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `HELD`                        | `null`                      | `AWAITING_INSPECTION`             | Món đồ đã nhận kho nhưng chưa kiểm định FINAL.                                                      | **Đang giữ cọc (Chờ kiểm định)**                            |
| `REVIEW_REQUIRED`             | `null`                      | `FINAL_PASS_AWAIT_GROUPED_REFUND` | Đã kiểm định ĐẠT CHUẨN, đang chờ các món khác trong đơn kiểm định xong để gom hoàn 1 lần.           | **Đạt chuẩn (Chờ hoàn cọc gộp)**                            |
| `REVIEW_REQUIRED`             | `null`                      | `DEDUCTION_APPROVAL_REQUIRED`     | Phát hiện hư hỏng/mất mát, đang chờ Admin xem xét biên bản bồi thường.                              | **Chờ Admin duyệt bồi thường**                              |
| `DEDUCTED`                    | `null`                      | `ADMIN_APPROVED_DEDUCTION`        | Admin đã duyệt khấu trừ. Đang trong cửa sổ 48h phản hồi của khách hàng.                             | **Đã duyệt trừ cọc (Chờ khiếu nại 48h)**                    |
| `REFUND_PENDING`              | `PENDING` hoặc `PROCESSING` | `INVENTORY_FINAL_PASS`            | Lệnh hoàn tiền đã được tạo và gửi sang cổng thanh toán VNPay, đang chờ ngân hàng xử lý.             | **Đang chuyển khoản hoàn cọc** (Không được báo thành công!) |
| `REFUNDED`                    | `SUCCEEDED`                 | `REFUND_SUCCEEDED`                | Cổng thanh toán đã xác nhận hoàn tiền thành công.                                                   | **Đã hoàn tiền thành công**                                 |
| `DEDUCTED`                    | `SUCCEEDED` hoặc `null`     | —                                 | Tiền cọc đã được khấu trừ vào phí bồi thường (sau khi tiền hoàn dư đã hoàn tất hoặc khấu trừ 100%). | **Đã khấu trừ bồi thường**                                  |
| `REFUND_FAILED`               | `FAILED`                    | `PROVIDER_ERROR`                  | Cổng thanh toán từ chối hoặc lỗi tài khoản.                                                         | **Hoàn tiền thất bại (Cần hỗ trợ)**                         |

### 2.2. Tiến độ quyết toán toàn đơn (`DepositSettlement.status`)

- `OPEN`: Đang trong quá trình kiểm định, duyệt bồi thường hoặc đang chờ hoàn tiền.
- `SETTLED`: Toàn bộ các món cọc trong đơn đã giải quyết xong nghĩa vụ tài chính (đã hoàn tiền thành công hoặc đã khấu trừ xong).

### 2.3. Trạng thái đơn thuê tổng thể (`RentalOrder.status` & `financialStatus`)

- `RentalOrder.status = 'RETURN_PROCESSING'`: Đang xử lý trả hàng và kiểm định.
- `RentalOrder.financialStatus = 'REFUND_PENDING'`: Có ít nhất một khoản cọc đang trong tiến trình hoàn tiền.
- `RentalOrder.financialStatus = 'PAID'`: Đã thanh toán đầy đủ và toàn bộ các nghĩa vụ hoàn cọc đã kết thúc.
- `RentalOrder.status = 'COMPLETED'`: **Chỉ đạt được khi thỏa mãn toàn bộ Closure Guards:**
  1. Tất cả thiết bị đã bàn giao nhập kho (không còn giữ vật lý).
  2. Toàn bộ `RentalExceptionCase` đã được giải quyết (`RESOLVED` hoặc đóng).
  3. Tất cả các khoản hoàn cọc đã đạt `SUCCEEDED` (không còn khoản nào `PROCESSING`).

---

## 3. Danh mục API Backend thực tế và Schema chuẩn

Tất cả các endpoint đều có tiền tố `/api/v1`.

### 3.1. Nhân viên kho kiểm định FINAL (Staff Final Inspection)

- **Phương thức & URL:** `POST /api/v1/staff/returns/:returnId/final-inspection`
- **Phân quyền (Role):** `STAFF_INVENTORY`
- **Headers bắt buộc:**
  - `Authorization: Bearer <TOKEN>`
  - `Idempotency-Key: <chuỗi-duy-nhất-8-den-200-ky-tu>`
- **Request Body Schema:**

```json
{
  "items": [
    {
      "unitId": "06326810-7ff7-471a-bf77-f6035305c32a",
      "outcome": "PASS",
      "condition": "GOOD",
      "accessories": ["Túi đựng", "Cọc neo"],
      "damage": [],
      "evidenceIds": [],
      "notes": "Thiết bị nguyên vẹn, hoạt động bình thường"
    }
  ],
  "expectedVersion": 1
}
```

_Lưu ý:_

- Khi món đồ bị hư hỏng: `outcome = "ISSUE"`, `condition = "DAMAGED"`, gửi mảng `damage` chứa `ruleId` (lấy từ quy tắc hư hỏng) và `evidenceIds` (ảnh chụp bằng chứng).
- Khi request này gửi món cuối cùng của đơn hoàn tất: Backend sẽ tự động phát hiện đơn hàng đã hoàn tất kiểm định và tự động chuyển các món PASS sang `REFUND_PENDING` để hoàn tiền!

---

### 3.2. Khách hàng / Nhân viên xem bảng kê cọc (Rental Order Deposit Summary)

- **Phương thức & URL:** `GET /api/v1/rental-orders/:orderId/deposit`
- **Phân quyền (Role):** `USER`, `LEADER`, `ADMIN`, `STAFF_INVENTORY`
- **Response Structure (Object trực tiếp, không wrapper `data`):**

```json
{
  "collectedAmount": 900000,
  "heldAmount": 0,
  "refundedAmount": 900000,
  "refundPendingAmount": 0,
  "deductionAmount": 0,
  "items": [
    {
      "unitId": "00295978-0679-455c-933d-6edb9aeaec4d",
      "assetCode": "TENT-4P-001",
      "depositAmount": 300000,
      "amount": 300000,
      "status": "REFUNDED",
      "inspectionStatus": "FINAL_PASS",
      "inventoryCustodyReceivedAt": "2026-10-26T04:39:15.000Z",
      "inspectionDueAt": "2026-10-26T16:39:15.000Z",
      "refundBatchId": "f6817cca-d484-45fb-9b5c-c558154eb9a7",
      "refundRef": "7b3b44b8-e215-4fa2-bf42-a160ec8c0f51",
      "refundStatus": "SUCCEEDED",
      "heldReason": "INVENTORY_FINAL_PASS",
      "deduction": 0,
      "refundAmount": 300000,
      "reason": "INVENTORY_FINAL_PASS",
      "settlementMode": "SANDBOX_SIMULATED",
      "simulationNotice": "Hoàn cọc mô phỏng (VNPay Sandbox) - không phải bằng chứng tiền đã về tài khoản khách"
    }
  ],
  "groupedRefunds": [
    {
      "refundRef": "7b3b44b8-e215-4fa2-bf42-a160ec8c0f51",
      "status": "SUCCEEDED",
      "amount": 900000,
      "itemIds": [
        "1e8c6da5-b39b-41bc-8f66-01a12a5c93aa",
        "110ba2ce-27ac-4a05-b987-e697d5ead0d4",
        "f68edd20-8df9-4c21-a4d2-9876890fdde9"
      ]
    }
  ]
}
```

---

### 3.3. Admin duyệt ngoại lệ bồi thường (Admin Resolve Exception)

- **Phương thức & URL:** `POST /api/v1/admin/rental-exceptions/:exceptionId/resolve`
- **Phân quyền (Role):** `ADMIN`
- **Headers bắt buộc:** `Idempotency-Key`
- **Request Body Schema:**

```json
{
  "decision": "APPROVE_DEDUCTION",
  "reason": "Xác nhận hư hỏng lều theo biên bản kiểm định, duyệt trừ 100.000 VNĐ",
  "assessmentVersion": 1,
  "expectedVersion": 1
}
```

- **Response:** Trả về đối tượng chứa `approvalRef` (Ví dụ: `APPROVE-EXP-93190AFD-01`).  
  _Frontend cần lưu mã `approvalRef` này để dùng cho bước quyết toán cọc sau 48 giờ._

---

### 3.4. Admin tạo quyết toán cọc phần dư (Admin Create Deposit Settlement)

- **Phương thức & URL:** `POST /api/v1/rental-orders/:orderId/deposit-settlement`
- **Phân quyền (Role):** `ADMIN` _(Lưu ý: Route này không có tiền tố `/admin`)_
- **Headers bắt buộc:** `Idempotency-Key`
- **Request Body Schema:**

```json
{
  "assessmentId": "<uuid-ban-ghi-kiem-dinh-final>",
  "approvalRef": "<ma-approvalRef-nhan-tu-api-resolve>"
}
```

- **Ràng buộc Backend sẽ từ chối nếu vi phạm:**
  1. Chưa hết 48 giờ kể từ khi gửi biên bản cho khách hàng (`USER_48H_REVIEW_WINDOW_NOT_CLOSED`).
  2. Khách hàng đang có khiếu nại chưa được xử lý (`USER_DISPUTE_MUST_BE_RESOLVED`).
  3. Khoản khấu trừ lớn hơn tổng tiền cọc của món (`DEDUCTION_EXCEEDS_DEPOSIT`).
- **Response thành công (HTTP 202 Accepted):**

```json
{
  "settlement": {
    "status": "OPEN"
  },
  "refundRef": "9e5f1b2c-3d4e-4f5a-6b7c-8d9e0f1a2b3c",
  "deductionAmount": 150000,
  "refundAmount": 350000,
  "status": "REFUND_PENDING"
}
```

---

### 3.5. Admin mô phỏng cổng thanh toán VNPay hoàn tiền thành công (Sandbox Simulation)

_Dành riêng cho môi trường DEV / SANDBOX để hoàn tất quy trình test E2E khi không có webhook thực tế từ cổng thanh toán._

- **Phương thức & URL:** `POST /api/v1/admin/payment-refunds/:refundId/sandbox-simulate-settlement`  
  _(Alias khả dụng: `POST /api/v1/admin/refunds/:refundId/sandbox-simulate-settlement`)_
- **Phân quyền (Role):** `ADMIN`
- **Headers bắt buộc:**
  - `Idempotency-Key: sim-refund-<unique-key-8-den-200-chars>`
- **Request Body Schema:**

```json
{
  "reason": "Mô phỏng xác nhận hoàn tiền VNPay Sandbox thành công",
  "acknowledgeSandboxSimulation": true,
  "expectedProviderStatus": "PROCESSING",
  "testEvidenceRef": "FE-E2E-TEST-001"
}
```

- **Response thành công (HTTP 200 OK):**

```json
{
  "data": {
    "simulationId": "uuid",
    "refundId": "uuid",
    "providerRefundStatus": "SUCCEEDED",
    "simulationStatus": "SIMULATED",
    "simulatedAmount": "350000",
    "completionMode": "SANDBOX_SIMULATED",
    "settlementProcessingStatus": "APPLIED",
    "warnings": [
      "TEST_ONLY_RECORD: Không có tiền thật được hoàn qua giao dịch này"
    ]
  }
}
```

---

## 4. Dữ liệu thử nghiệm thật trên Database Sandbox (FE Test Scenarios)

Dữ liệu dưới đây đã được khởi tạo và kiểm chứng trực tiếp trên **Neon PostgreSQL Sandbox**. Đội ngũ Frontend có thể sử dụng ngay:

### 🌟 Kịch bản A: Đơn sạch 3 món ĐẠT CHUẨN (Tự động gom hoàn cọc)

_Dùng để test: Kho kiểm định xong món cuối cùng -> Toàn bộ tự động hoàn cọc gộp không cần Admin duyệt._

- **Mã đơn thuê (`rentalOrderId`):** `716f716a-f611-43a9-b374-06d01d1f5fdf`
- **Mã phiên trả hàng (`returnSessionId`):** `6e561371-e26c-4ba6-bf1f-d7b68f5eb8eb`
- **Tài khoản User / Staff:** `tantrunh16@gmail.com`
- **Hiện trạng Database:**
  - Món 1 & Món 2: `REVIEW_REQUIRED`, `heldReason = "FINAL_PASS_AWAIT_GROUPED_REFUND"`.
  - Món 3 (`unitId = "06326810-7ff7-471a-bf77-f6035305c32a"`): `HELD`, `AWAITING_INSPECTION`.
- **Hành động FE thực hiện:**
  1. Đăng nhập Staff Kho, gọi API kiểm định món 3:
     `POST /api/v1/staff/returns/6e561371-e26c-4ba6-bf1f-d7b68f5eb8eb/final-inspection` với `outcome = "PASS"`.
  2. Quan sát: Cả 3 món lập tức chuyển `REFUND_PENDING`. Sau tối đa 5 giây, Worker gom đúng 1 lệnh Refund (900.000 VNĐ, status `PROCESSING`).
  3. Lấy `refundRef` từ API `/deposit`, đăng nhập Admin gọi `simulate-settlement` -> Đơn hoàn tất `COMPLETED`.

---

### ⚠️ Kịch bản B1: Đơn có món hư hỏng (Chờ Admin duyệt bồi thường)

_Dùng để test: Màn hình Admin Review xem biên bản hư hại và duyệt mức khấu trừ._

- **Mã đơn thuê (`rentalOrderId`):** `ef0469df-f3ec-4df7-ac02-1d71bb1823d2`
- **Mã biên bản sự cố (`exceptionId`):** `93190afd-2797-4ac7-a6f9-fdc743413bdd` (Trạng thái: `OPEN`)
- **Tài khoản User:** `trungnguyentan1605@gmail.com`
- **Hiện trạng Database:**
  - Món 1 (PASS): `REFUND_PENDING` (Đã được giải phóng hoàn cọc độc lập, không bị giam giữ!).
  - Món 2 (DAMAGED): `REVIEW_REQUIRED`, cọc 300k, đề xuất khấu trừ 100k, chờ Admin duyệt.
- **Hành động FE thực hiện:**
  - Test giao diện Admin: Vào xem chi tiết case bồi thường, bấm Duyệt khấu trừ (`resolve`).

---

### 🚀 Kịch bản B2: Đơn đã quá 48h khiếu nại (Test Admin Settlement -> Refund SUCCEEDED)

_Dùng để test đúng yêu cầu của FE: "Chạy luồng Admin settlement -> refund SUCCEEDED ngay lập tức"._

- **Mã đơn thuê (`rentalOrderId`):** `aaf14c2f-778c-4246-8ad2-9fe5cf862760`
- **Mã biên bản quyết toán (`settlementId`):** `28bffb6d-49a2-4d4c-9413-f9120bedea75`
- **Mã biên bản kiểm định (`assessmentId`):** Lấy từ item 2 trong API `/deposit`.
- **Tài khoản User:** `luatluat304@gmail.com`
- **Hiện trạng Database:**
  - Món 1: Đã hoàn tất thành công (`status = "SETTLED"`).
  - Món 2: Đã duyệt trừ 150.000 VNĐ, số tiền hoàn dư 350.000 VNĐ ở trạng thái `DEDUCTION_APPROVED`.
  - **Thời gian khiếu nại đã trôi qua 52 giờ (> 48 giờ theo chính sách), đã đủ điều kiện quyết toán ngay!**
- **Hành động FE thực hiện:**
  1. Gọi `POST /api/v1/rental-orders/aaf14c2f-778c-4246-8ad2-9fe5cf862760/deposit-settlement` -> Nhận `refundRef` (số tiền 350.000 VNĐ, status `REFUND_PENDING`).
  2. Gọi `POST /api/v1/admin/payment-refunds/:refundRef/sandbox-simulate-settlement` -> Refund thành công `SUCCEEDED`.
  3. Worker cập nhật Món 2 sang `status = "SETTLED"`, đơn thuê tự động đóng `status = "COMPLETED"`.

---

## 5. Quy tắc hiển thị UI và Polling cho Frontend

1. **Quy tắc Polling:**
   - Khi có item hoặc refund ở trạng thái `PENDING` hoặc `PROCESSING`: Polling mỗi **3 đến 5 giây** (tối đa 30–45 giây).
   - Nếu quá thời gian polling mà trạng thái vẫn là `PROCESSING`: Hiển thị thông báo _"Giao dịch đang được xử lý bởi cổng thanh toán, vui lòng tải lại sau"_, cung cấp nút **"Kiểm tra lại"**. **Tuyệt đối không báo lỗi thất bại và không tự tạo thêm lệnh hoàn tiền mới!**
2. **Cảnh báo Sandbox:**
   - Khi item có `settlementMode === "SANDBOX_SIMULATED"` hoặc response trả về có trường cảnh báo: Bắt buộc gắn badge **[Mô phỏng Sandbox]** bên cạnh số tiền hoàn và không hiển thị thông tin biên lai ngân hàng thật.
3. **Xử lý lỗi theo Global Error Contract:**
   - Backend sử dụng chuẩn `GlobalErrorFilter`, lỗi trả về theo cấu trúc:
     ```json
     {
       "error": {
         "code": "USER_48H_REVIEW_WINDOW_NOT_CLOSED",
         "message": "Không thể quyết toán trước khi cửa sổ 48h khiếu nại kết thúc",
         "details": { "reason": "USER_48H_REVIEW_WINDOW_NOT_CLOSED" },
         "retryable": false
       }
     }
     ```
   - Trong Axios, đọc lỗi từ `error.response?.data?.error`. Không giả định `message` nằm ở cấp độ ngoài cùng.
