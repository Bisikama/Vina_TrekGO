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
<<<<<<< HEAD
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
- # **Request Body Schema:**
        "unitId": "<unit-uuid>",
        "outcome": "PASS",
        "condition": "GOOD",
        "accessories": [],
        "damage": [],
        "evidenceIds": [],
        "notes": "Thiết bị hoạt động bình thường"
      }
  ],
  "expectedVersion": 5
  }

````

Kết quả trả về có `assessments[]`, `finalInspections[]`, `eligibleDepositItems[]`, `issues[]` và `proposedDeductions[]`.

Quy tắc FE:

- Lưu `finalInspections[].id` hoặc `assessments[].inspectionId` để dùng làm `assessmentId` ở bước quyết toán.
- `PASS` không đồng nghĩa refund đã thành công. Nó mới cho biết item đủ điều kiện đi vào luồng hoàn.
- `ISSUE`/`LOST` phải đi qua exception review; không được tự tạo số tiền khấu trừ trên client.

### 3.2. Xem return task cho màn hình Staff/Admin

```http
GET /api/v1/staff/returns/:returnId
Authorization: Bearer <STAFF_OR_ADMIN_TOKEN>
````

Response có các nhóm dữ liệu chính:

- `orderId`, `status`, `version`.
- `expectedUnits`, `receivedUnits`, `missingUnits`.
- `inspection[].preliminary` và `inspection[].final`.
- `depositActions[]` với `status`, `depositAmount`, `deductionAmount`, `refundAmount`.
- `beforeEvidence`.

Đây là nguồn dữ liệu phù hợp để thay `equipmentResults` và các con số hard-code trên `StaffDepositSettlement.tsx`.

### 3.3. Xem và xử lý exception

```http
GET  /api/v1/staff/rental-exceptions
GET  /api/v1/staff/rental-exceptions/:exceptionId
POST /api/v1/admin/rental-exceptions/:exceptionId/resolve
```

Request resolve:

> > > > > > > develop

```json
{
  "decision": "APPROVE_DEDUCTION",
<<<<<<< HEAD
  "reason": "Xác nhận hư hỏng lều theo biên bản kiểm định, duyệt trừ 100.000 VNĐ",
=======
  "reason": "Xác nhận hư hỏng theo bằng chứng và biểu phí",
>>>>>>> develop
  "assessmentVersion": 1,
  "expectedVersion": 1
}
```

<<<<<<< HEAD

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
- # **Response thành công (HTTP 202 Accepted):**
  Header:

```http
Idempotency-Key: <stable-key>
```

Response resolve trả `approvalRef`. FE phải giữ giá trị này hoặc đọc lại từ exception detail. Không tự sinh `approvalRef` ở client.

### 3.4. Tạo quyết toán cọc

Route hiện tại là:

```http
POST /api/v1/rental-orders/:orderId/deposit-settlement
Authorization: Bearer <ADMIN_TOKEN>
Idempotency-Key: <stable-key>
```

Lưu ý: API này yêu cầu role `ADMIN` nhưng route **không có** segment `/admin`.

Body:

```json
{
  "assessmentId": "<final-inspection-id>",
  "approvalRef": "<approval-ref-returned-by-resolve-exception>"
}
```

Response minh họa:

> > > > > > > develop

```json
{
  "settlement": {
<<<<<<< HEAD
    "status": "OPEN"
  },
  "refundRef": "9e5f1b2c-3d4e-4f5a-6b7c-8d9e0f1a2b3c",
  "deductionAmount": 150000,
  "refundAmount": 350000,
=======
    "status": "PARTIALLY_SETTLED"
  },
  "refundRef": "<refund-uuid>",
  "deductionAmount": 350000,
  "refundAmount": 650000,
>>>>>>> develop
  "status": "REFUND_PENDING"
}
```

## <<<<<<< HEAD

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

````json
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
=======
Quy tắc quan trọng:

- Một request xử lý một `assessmentId`/deposit item, không phải toàn bộ order trong một body.
- HTTP `202` nghĩa là Backend đã chấp nhận quyết toán và có thể đã tạo yêu cầu refund.
- Nếu `refundRef !== null`, FE chuyển sang theo dõi refund đó.
- Nếu `refundAmount === 0`, đây có thể là khấu trừ toàn bộ. Không có chuyển tiền về provider; item có thể được quyết toán `SETTLED`.
- Không đổi nút thành “Đã hoàn tiền” ngay sau response này.

Backend có thể từ chối quyết toán nếu:

- Assessment không phải FINAL hoặc không thuộc order.
- Exception chưa được Admin giải quyết.
- `approvalRef` không đúng với exception đã resolve.
- Cửa sổ để user xem/phản hồi assessment chưa kết thúc.
- User đã mở dispute chưa được giải quyết.
- Khoản khấu trừ vượt tiền cọc.

### 3.5. USER xem bảng kê cọc

```http
GET /api/v1/rental-orders/:orderId/deposit
Authorization: Bearer <USER_OR_LEADER_TOKEN>
````

Response là object trực tiếp, không có wrapper `{ data: ... }`:

```ts
export type DepositItemStatus =
  | "HELD"
  | "REVIEW_REQUIRED"
  | "REFUND_PENDING"
  | "REFUND_FAILED"
  | "DEDUCTED"
  | "REFUNDED"
  | "SETTLED";

export type RefundStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export interface RentalDepositResponse {
  collectedAmount: number;
  heldAmount: number;
  refundedAmount: number;
  refundPendingAmount: number;
  deductionAmount: number;
  items: Array<{
    unitId: string;
    assetCode: string;
    depositAmount: number;
    amount: number;
    status: DepositItemStatus;
    inspectionStatus: "FINAL_PASS" | "FINAL_ISSUE" | "PENDING" | "NOT_RECEIVED";
    inventoryCustodyReceivedAt: string | null;
    inspectionDueAt: string | null;
    refundBatchId: string | null;
    refundRef: string | null;
    refundStatus: RefundStatus | null;
    heldReason: string | null;
    deduction: number;
    refundAmount: number;
    reason: string | null;
    settlementMode: "STANDARD" | "SANDBOX_SIMULATED";
    simulationNotice: string | null;
  }>;
  groupedRefunds: Array<{
    refundRef: string;
    status: RefundStatus;
    amount: number;
    itemIds: string[];
  }>;
  financialTruth?: {
    providerRefundedAmount: number;
    providerRefundPendingAmount: number;
    realMoneyReturned: boolean;
  };
  settlementMode?: "SANDBOX_SIMULATED";
  simulatedSettledAmount?: number;
  unconfirmedSimulatedAmount?: number;
  effectiveHeldAmount?: number;
  notice?: string;
  warnings?: string[];
}
```

Các số tiền của API `/deposit` là `number` VND nguyên. FE nên hiển thị tổng từ chính các field aggregate của Backend, không cộng lại rồi dùng kết quả client làm nguồn sự thật.

### 3.6. Xem chi tiết refund

```http
GET /api/v1/refunds/:refundId
Authorization: Bearer <OWNER_OR_ADMIN_TOKEN>
```

Response chính:

```ts
interface RefundDetail {
  refundId: string;
  paymentId: string;
  purpose: string;
  reasonCode: string | null;
  amount: string;
  currency: string;
  status: RefundStatus;
  refundedAt: string | null;
  reconciliationRequired: boolean;
  simulationStatus?: "SIMULATED";
  settlementMode?: "SANDBOX_SIMULATED";
  warnings?: string[];
  simulationNotice?: string;
  discrepancy?: string;
}
```

`amount` ở endpoint này là string số tiền, ví dụ `"650000"`.

### 3.7. Lịch sử payment/refund theo order

```http
GET /api/v1/rental-orders/:orderId/payments?page=1&pageSize=20
```

Refund nằm trong `items[].refunds[]`. Chỉ `refund.status === "SUCCEEDED"` mới là refund hoàn thành.

Giá trị `amount` của API lịch sử là string có hai chữ số thập phân, ví dụ `"650000.00"`. Không trộn trực tiếp kiểu tiền của API này với `number` từ `/deposit`.

### 3.8. Timeline giao dịch của user

```http
GET /api/v1/user/transactions?source=RENTAL
GET /api/v1/user/transactions?source=RENTAL&kind=REFUND
```

Mỗi refund là một dòng riêng:

```ts
interface UserTransactionItem {
  id: string;
  kind: "PAYMENT" | "REFUND";
  source: "RENTAL" | "BOOKING" | "TRAIL_ACCESS";
  sourceId: string | null;
  paymentId: string;
  refundId: string | null;
  invoiceId: string;
  amount: string;
  currency: string;
  status: string;
  financialEffect: "DEBIT" | "CREDIT" | "NONE";
  description: string;
  paymentMethod: string | null;
  createdAt: string;
  completedAt: string | null;
}
```

Mapping tài chính:

- Payment `SUCCEEDED` → `DEBIT`.
- Refund `SUCCEEDED` → `CREDIT`.
- Refund `PENDING`/`PROCESSING`/`FAILED`/`CANCELLED` → `NONE`.

Với sandbox simulation, timeline vẫn có thể trả `CREDIT` để phản ánh Shared Payment đã ghi `SUCCEEDED`, nhưng FE phải kết hợp cảnh báo từ `/deposit` hoặc `/refunds/:id`; không được diễn giải `CREDIT` sandbox là tiền thật đã về ngân hàng.

---

## 4. Mapping trạng thái sang giao diện

### 4.1. Theo từng item cọc

| Dữ liệu Backend                                                | Nhãn UI đề xuất                  | Có được báo “đã hoàn tiền” không?        |
| -------------------------------------------------------------- | -------------------------------- | ---------------------------------------- |
| `status=HELD`                                                  | Đang giữ cọc                     | Không                                    |
| `status=REVIEW_REQUIRED`                                       | Chờ kiểm định/đối soát           | Không                                    |
| `status=REFUND_PENDING` hoặc `refundStatus=PENDING/PROCESSING` | Đang hoàn tiền                   | Không                                    |
| `status=REFUND_FAILED` hoặc `refundStatus=FAILED`              | Hoàn tiền thất bại — cần hỗ trợ  | Không                                    |
| `refundStatus=CANCELLED`                                       | Yêu cầu hoàn đã hủy — cần hỗ trợ | Không                                    |
| `status=DEDUCTED`                                              | Đã khấu trừ                      | Không có khoản hoàn cho phần bị khấu trừ |
| `status=REFUNDED` và `settlementMode=STANDARD`                 | Đã hoàn tiền                     | Có                                       |
| `refundStatus=SUCCEEDED` và `settlementMode=SANDBOX_SIMULATED` | Đã mô phỏng hoàn tiền            | Không được gọi là tiền thật              |
| `status=SETTLED` nhưng không có refund thành công              | Đã quyết toán                    | Không suy diễn thành đã chuyển tiền      |

### 4.2. Mức order

Không kết luận toàn bộ order đã quyết toán chỉ vì một refund thành công. Đơn có thể có nhiều item:

- Một nhóm PASS đã được hoàn.
- Một item hư hỏng vẫn đang review.
- Một item bị giữ lại hoặc khấu trừ.

FE chỉ hiển thị “Quyết toán hoàn tất” khi dữ liệu order/deposit không còn item pending/review/failed cần xử lý và Backend đã cập nhật aggregate tương ứng.

### 4.3. Sandbox simulation

Nếu response có một trong các dấu hiệu sau:

```text
settlementMode = SANDBOX_SIMULATED
simulationStatus = SIMULATED
warnings chứa TEST_ONLY hoặc NO_REAL_MONEY_RETURNED
```

UI phải:

- Hiển thị badge `SANDBOX / TEST ONLY`.
- Hiển thị `simulationNotice` hoặc `notice`.
- Không hiển thị “đã chuyển khoản về ngân hàng”.
- Không hiển thị tài khoản nhận tiền nếu Backend không trả dữ liệu đó.
- Không phát hành nội dung có thể được hiểu là biên lai hoàn tiền thật.

---

## 5. Cách triển khai service phía Web

Web hiện đã có `apiClient` tại `web/src/lib/axios.ts`. `web/next.config.ts` hiện rewrite toàn bộ `/api/v1/:path*`, vì vậy không cần thêm rewrite riêng cho Rental.

Ví dụ service:

```ts
import { apiClient } from "@/lib/axios";

const sameOrigin = { baseURL: "" };

export const rentalDepositApi = {
  getReturnDetail: async (returnId: string) =>
    (
      await apiClient.get(
        `/api/v1/staff/returns/${encodeURIComponent(returnId)}`,
        sameOrigin,
      )
    ).data,

  createSettlement: async (
    orderId: string,
    input: { assessmentId: string; approvalRef: string },
    idempotencyKey: string,
  ) =>
    (
      await apiClient.post(
        `/api/v1/rental-orders/${encodeURIComponent(orderId)}/deposit-settlement`,
        input,
        {
          ...sameOrigin,
          headers: { "Idempotency-Key": idempotencyKey },
        },
      )
    ).data,

  getDeposit: async (orderId: string): Promise<RentalDepositResponse> =>
    (
      await apiClient.get<RentalDepositResponse>(
        `/api/v1/rental-orders/${encodeURIComponent(orderId)}/deposit`,
        sameOrigin,
      )
    ).data,

  getRefund: async (refundId: string): Promise<RefundDetail> =>
    (
      await apiClient.get<RefundDetail>(
        `/api/v1/refunds/${encodeURIComponent(refundId)}`,
        sameOrigin,
      )
    ).data,

  getPaymentHistory: async (orderId: string, page = 1) =>
    (
      await apiClient.get(
        `/api/v1/rental-orders/${encodeURIComponent(orderId)}/payments`,
        { ...sameOrigin, params: { page, pageSize: 20 } },
      )
    ).data,
};
```

Idempotency key phải ổn định cho cùng một lần bấm/retry:

```ts
const settlementKey = `deposit-settlement-${assessmentId}-${crypto.randomUUID()}`;
```

Khi request timeout mà chưa biết Backend đã nhận hay chưa, retry bằng **đúng key và đúng body cũ**. Không tạo key mới ngay lập tức vì có thể tạo thao tác nghiệp vụ trùng.

---

## 6. Polling trạng thái refund

Sau khi tạo quyết toán và nhận `refundRef`, FE thực hiện bounded polling:

1. Gọi `GET /api/v1/refunds/:refundId`.
2. Nếu `PENDING` hoặc `PROCESSING`, tiếp tục polling.
3. Đồng thời revalidate `GET /rental-orders/:orderId/deposit` để nhận projection theo từng item.
4. Dừng khi refund là terminal: `SUCCEEDED`, `FAILED`, `CANCELLED`.
5. Nếu hết số lần polling mà vẫn chưa terminal, giữ trạng thái “Đang xử lý” và cung cấp nút “Kiểm tra lại”. Không đổi thành lỗi hoặc thành công chỉ vì timeout.

Khuyến nghị UI polling mỗi 2,5 giây, tối đa khoảng 30 giây cho vòng tự động đầu tiên. Đây là hành vi giao diện, không phải SLA của provider.

Ví dụ điều kiện:

```ts
function shouldPollDeposit(data?: RentalDepositResponse) {
  if (!data) return true;

  return data.items.some(
    (item) =>
      item.status === "REFUND_PENDING" ||
      item.refundStatus === "PENDING" ||
      item.refundStatus === "PROCESSING",
  );
}
```

Nên revalidate thêm khi:

- User quay lại tab trình duyệt.
- Mạng được reconnect.
- User bấm “Kiểm tra lại”.
- Điều hướng từ màn lịch sử giao dịch về chi tiết đơn.

Không tạo refund mới từ FE để “đẩy nhanh” trạng thái đang `PROCESSING`.

---

## 7. Thiết kế lại màn hình quyết toán hiện tại

### 7.1. Khu vực Staff Inventory

Staff Inventory chỉ thực hiện nghiệp vụ vật lý và kiểm định:

- Nhận thiết bị.
- Ghi FINAL inspection.
- Ghi condition, damage rules, phụ kiện và evidence.
- Xem khoản khấu trừ đề xuất từ Backend.

Không hiển thị nút “Giải ngân ngay” cho Staff nếu token không phải `ADMIN`.

### 7.2. Khu vực Admin

Admin UI nên hiển thị:

- Thông tin return task lấy từ `/staff/returns/:returnId`.
- FINAL inspection và evidence.
- Exception/review của user.
- Khoản khấu trừ đề xuất và khoản được duyệt từ Backend.
- Cửa sổ user review còn mở hay đã đóng.
- `approvalRef` từ kết quả resolve exception.

Nút phù hợp:

```text
Xác nhận quyết toán và tạo yêu cầu hoàn
```

Không dùng:

```text
Giải ngân cọc ngay
Đã chuyển về ngân hàng
Hoàn tiền thành công
```

ngay sau API `deposit-settlement`.

Sau response `202`:

- Nếu có `refundRef`: hiển thị “Yêu cầu hoàn tiền đã được tạo — đang chờ provider xác nhận”.
- Nếu `refundAmount = 0`: hiển thị “Đã quyết toán khấu trừ toàn bộ”, không dựng một giao dịch hoàn tiền giả.
- Disable nút bằng request state và idempotency key.
- Reload dữ liệu từ Backend thay vì chỉ thay state local.

### 7.3. Khu vực User/Leader

Trang chi tiết cọc nên có:

1. Tổng cọc đã thu: `collectedAmount`.
2. Đang giữ: `heldAmount`.
3. Đang hoàn: `refundPendingAmount`.
4. Đã hoàn: `refundedAmount`.
5. Đã khấu trừ: `deductionAmount`.
6. Danh sách từng thiết bị và trạng thái quyết toán.
7. Danh sách refund group theo `groupedRefunds`.
8. Cảnh báo sandbox nếu có.

Không hiển thị số tài khoản nhận hoàn hoặc tên ngân hàng nếu Backend không trả những field này.

---

## 8. API mô phỏng sandbox dành cho QA/Admin

Hai route đúng là:

```http
POST /api/v1/admin/payment-refunds/:refundId/sandbox-simulate-settlement
GET  /api/v1/admin/payment-refunds/:refundId/sandbox-simulation
```

Đây không phải API dành cho mobile/user frontend. QA/Admin gọi qua Swagger hoặc công cụ nội bộ có kiểm soát.

Body POST:

```json
{
  "reason": "Mô phỏng provider xác nhận refund sandbox",
  "acknowledgeSandboxSimulation": true,
  "expectedProviderStatus": "PROCESSING",
  "testEvidenceRef": "QA-REFUND-001"
}
```

Header:

```http
Idempotency-Key: sandbox-refund-<unique-value>
```

API chỉ chạy khi Backend thỏa tất cả điều kiện:

```ini
NODE_ENV=development
PAYMENT_PROVIDER_ENVIRONMENT=SANDBOX
PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED=true
PAYMENT_EVENTS_WORKER_ENABLED=true
DATABASE_URL=postgresql://...@127.0.0.1:5432/<isolated-local-db>
```

Nếu `DATABASE_URL` đang là Neon/cloud, API trả:

```text
403 SANDBOX_SIMULATION_ENV_UNSAFE
```

FE/QA không retry lỗi này. Cần đổi Backend sang PostgreSQL local cô lập hoặc chờ một thiết kế QA remote được Backend phê duyệt. Không nới guard và không chuyển lỗi này thành thông báo “refund thất bại” cho user.

Response POST có wrapper `{ data: ... }` và có:

```ts
settlementProcessingStatus: "PENDING" | "APPLIED";
```

Ý nghĩa:

- `PENDING`: Shared Payment đã ghi refund `SUCCEEDED`, nhưng Rental worker chưa chứng minh projection đã commit.
- `APPLIED`: đã có `PaymentConsumerReceipt` của `rental-deposit-v1`; Rental projection đã được áp dụng trong transaction worker.

Ngay cả khi `APPLIED`, nếu là simulation thì vẫn là `TEST_ONLY`, không phải bằng chứng tiền thật.

---

## 9. Xử lý lỗi đúng contract Backend

Global error response:

```json
{
  "error": {
    "code": "SANDBOX_SIMULATION_ENV_UNSAFE",
    "message": "...",
    "details": {},
    "retryable": false
  },
  "meta": {
    "requestId": "...",
    "serverTime": "...",
    "contractVersion": "..."
>>>>>>> develop
  }
}
```

## <<<<<<< HEAD

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
   - # Trong Axios, đọc lỗi từ `error.response?.data?.error`. Không giả định `message` nằm ở cấp độ ngoài cùng.
     Với Axios, đọc:

```ts
const apiError = axiosError.response?.data?.error;
```

Không giả định `message` hoặc `code` nằm ở top-level.

| Error code                                | Hướng xử lý FE                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| `UNAUTHENTICATED` / HTTP 401              | Dùng refresh/login flow hiện có                                                   |
| `FORBIDDEN` / HTTP 403                    | Ẩn thao tác không đúng role; không retry mù                                       |
| `VERSION_CONFLICT` / `OPERATION_CONFLICT` | Reload return/order và yêu cầu người dùng kiểm tra lại                            |
| `IDEMPOTENCY_KEY_REQUIRED`                | Sửa client để luôn gửi key hợp lệ                                                 |
| `IDEMPOTENCY_KEY_REUSED`                  | Không dùng lại key cho body khác                                                  |
| `ASSESSMENT_NOT_FOUND`                    | Reload FINAL inspection                                                           |
| `ASSESSMENT_NOT_APPROVED`                 | Hoàn thành exception approval trước                                               |
| `INVALID_RETURN_STATE`                    | Đọc `error.details.reason`; có thể đang trong user review window hoặc còn dispute |
| `DEDUCTION_EXCEEDS_DEPOSIT`               | Dừng thao tác và yêu cầu đối soát; FE không tự sửa amount                         |
| `SANDBOX_SIMULATION_ENV_UNSAFE`           | Chỉ QA/Admin: chuyển sang local isolated DB, không retry trên Neon                |
| `SANDBOX_SIMULATION_ALREADY_SIMULATED`    | Đọc lại refund/simulation detail, không tạo lần mô phỏng thứ hai                  |

---

## 10. Acceptance checklist cho FE

- [ ] `StaffDepositSettlement.tsx` không còn dùng tiền, thiết bị, ngân hàng và trạng thái hard-code.
- [ ] Role `STAFF_INVENTORY` chỉ làm kiểm định; nút tạo quyết toán chỉ hiện cho `ADMIN` theo contract hiện tại.
- [ ] Mỗi quyết toán dùng đúng `assessmentId`, `approvalRef` và một idempotency key ổn định.
- [ ] HTTP `202`/có `refundRef` chỉ hiển thị “Đang hoàn tiền”.
- [ ] Chỉ refund `SUCCEEDED` mới hiển thị “Đã hoàn tiền”.
- [ ] Refund `FAILED`/`CANCELLED` hiển thị cần hỗ trợ, không tự retry tạo refund mới.
- [ ] Màn user lấy tổng tiền từ `/rental-orders/:id/deposit`.
- [ ] Màn lịch sử phân biệt `financialEffect=CREDIT`, `NONE` và trạng thái refund.
- [ ] Sandbox simulation luôn có badge `TEST ONLY` và câu “không phải tiền thật”.
- [ ] Mobile/user frontend không gọi API `/admin/payment-refunds/...`.
- [ ] Polling có giới hạn, dừng ở terminal state và có nút kiểm tra lại.
- [ ] Timeout không bị diễn giải thành thất bại hoặc thành công.
- [ ] FE đọc lỗi từ `response.data.error`.
- [ ] Không hiển thị tài khoản ngân hàng hoặc biên lai thật nếu Backend không trả dữ liệu chứng minh.
- [ ] Test mixed case: một item đã hoàn, một item còn review; UI không báo toàn order hoàn tất.
- [ ] Test full deduction: `refundAmount=0`; UI không tạo dòng “hoàn 0 đồng” như một refund provider.
- [ ] Test Neon/cloud: simulation trả `SANDBOX_SIMULATION_ENV_UNSAFE` và UI QA hướng dẫn dùng local DB.

---

## 11. File Backend/Frontend dùng để đối chiếu

Backend:

- `api/src/modules/rental/returns/presentation/controllers/staff-return.controller.ts`
- `api/src/modules/rental/returns/presentation/controllers/rental-return-admin.controller.ts`
- `api/src/modules/rental/returns/presentation/controllers/rental-return.controller.ts`
- `api/src/modules/rental/returns/infrastructure/adapters/prisma-rental-return.adapter.ts`
- `api/src/modules/payments/payment-operations.controller.ts`
- `api/src/modules/payments/sandbox-refund-simulation.service.ts`
- `api/src/modules/payments/payment-history.service.ts`
- `api/src/modules/payments/refunds.service.ts`

Frontend:

- `web/src/lib/axios.ts`
- `web/next.config.ts`
- `web/src/features/rentals/services/rental.api.ts`
- `web/src/features/rentals/components/staff/StaffDepositSettlement.tsx`

Tài liệu này mô tả contract đang tồn tại trong source hiện tại. Nếu Backend thay đổi role, route hoặc response DTO, FE cần cập nhật types và acceptance checklist theo Swagger/source mới trước khi triển khai.

> > > > > > > develop
