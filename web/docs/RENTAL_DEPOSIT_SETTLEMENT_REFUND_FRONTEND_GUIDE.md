# HƯỚNG DẪN FRONTEND — QUYẾT TOÁN CỌC VÀ HOÀN TIỀN ĐƠN THUÊ

**Ngày đối chiếu Backend:** 25/10/2026  
**Đối tượng đọc:** Frontend Web/Mobile, QA và người phụ trách màn hình Admin/Staff Rental  
**Phạm vi:** Quyết toán cọc sau khi trả thiết bị, theo dõi refund và mô phỏng provider trong môi trường sandbox cục bộ

---

## 1. Kết luận cần hiểu trước khi làm giao diện

Quyết toán cọc và hoàn tiền là hai giai đoạn khác nhau:

1. **Quyết toán nghiệp vụ:** Backend xác định thiết bị nào đạt kiểm định, thiết bị nào bị khấu trừ, số tiền được hoàn và tạo yêu cầu refund.
2. **Hoàn tiền tài chính:** Refund được gửi sang Shared Payment/provider và chỉ hoàn tất khi `Refund.status === "SUCCEEDED"`.

Vì vậy:

- API quyết toán trả HTTP `202` hoặc tạo được `refundRef` **không có nghĩa tiền đã hoàn xong**.
- Refund `PENDING` hoặc `PROCESSING` phải hiển thị là **Đang hoàn tiền**.
- Chỉ refund `SUCCEEDED` mới được hiển thị là **Đã hoàn tiền**.
- Nếu refund được mô phỏng trong VNPay Sandbox thì phải hiển thị rõ **Đã mô phỏng hoàn tiền — không phải tiền thật đã về tài khoản**.
- Frontend không tự tính lại số tiền quyết toán thay Backend, không tự đổi trạng thái thành công và không tự tạo thêm refund khi polling chậm.

Luồng chuẩn:

```text
Kho kiểm định FINAL
        |
        v
Backend xác định PASS / ISSUE / LOST và khoản khấu trừ
        |
        +--> PASS: đi vào luồng hoàn cọc theo nhóm
        |
        +--> ISSUE/LOST: Admin xử lý ngoại lệ, chờ hết cửa sổ phản hồi rồi quyết toán
        |
        v
Shared Payment tạo Refund PENDING/PROCESSING
        |
        v
Provider xác nhận SUCCEEDED
        |
        v
Rental worker áp dụng kết quả vào từng item và trạng thái đơn
        |
        v
USER API phản ánh REFUNDED / CREDIT / SETTLED
```

---

## 2. Tình trạng Frontend hiện tại

File hiện có:

```text
web/src/features/rentals/components/staff/StaffDepositSettlement.tsx
```

Màn hình này hiện là prototype và chưa nối luồng quyết toán thật:

- `equipmentResults`, tiền cọc, khoản khấu trừ và thông tin khách hàng đang hard-code.
- Tài khoản ngân hàng nhận tiền đang hard-code.
- Nút xác nhận chỉ gọi `setConfirmed(true)`, không gọi Backend.
- Sau khi bấm nút, UI tự hiển thị “đã hoàn về MB Bank” dù chưa có `Refund SUCCEEDED`.
- UI dùng nội dung “giải ngân ngay”, trong khi Backend xử lý refund bất đồng bộ.
- Component nằm trong khu vực Staff, nhưng API tạo quyết toán hiện tại chỉ cho role `ADMIN`.

Do đó, chưa được dùng trạng thái `confirmed` local làm bằng chứng hoàn tiền. Khi tích hợp, cần thay toàn bộ dữ liệu mẫu và thông báo thành công bằng dữ liệu từ API.

### Phân quyền Backend hiện tại

| Nghiệp vụ                                     | Role Backend hiện cho phép                      |
| --------------------------------------------- | ----------------------------------------------- |
| Nhận thiết bị và kiểm định FINAL              | `STAFF_INVENTORY`                               |
| Xem chi tiết return task                      | `STAFF_INVENTORY`, `STAFF_DELIVERY`, `ADMIN`    |
| Xem/xử lý exception                           | Xem: `STAFF_INVENTORY`, `ADMIN`; xử lý: `ADMIN` |
| Tạo quyết toán cọc cho assessment có khấu trừ | `ADMIN`                                         |
| Xem cọc của đơn                               | `USER`, `LEADER` có quyền trên đơn              |
| Xem refund detail                             | Chủ invoice hoặc `ADMIN`                        |
| Giả lập provider settlement                   | Chỉ `ADMIN`, chỉ local sandbox an toàn          |

Nếu sản phẩm muốn `STAFF_INVENTORY` tự bấm quyết toán thì cần Backend/BA đổi contract quyền riêng. FE không được tự coi trang `/staff/...` là đủ quyền gọi API Admin.

---

## 3. API Backend đang có

Tất cả route dưới đây đã bao gồm global prefix `/api/v1`.

### 3.1. Kiểm định FINAL của kho

```http
POST /api/v1/staff/returns/:returnId/final-inspection
Authorization: Bearer <STAFF_INVENTORY_TOKEN>
Idempotency-Key: <stable-key-8-to-200-chars>
```

Ví dụ body:

```json
{
  "items": [
    {
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
```

Kết quả trả về có `assessments[]`, `finalInspections[]`, `eligibleDepositItems[]`, `issues[]` và `proposedDeductions[]`.

Quy tắc FE:

- Lưu `finalInspections[].id` hoặc `assessments[].inspectionId` để dùng làm `assessmentId` ở bước quyết toán.
- `PASS` không đồng nghĩa refund đã thành công. Nó mới cho biết item đủ điều kiện đi vào luồng hoàn.
- `ISSUE`/`LOST` phải đi qua exception review; không được tự tạo số tiền khấu trừ trên client.

### 3.2. Xem return task cho màn hình Staff/Admin

```http
GET /api/v1/staff/returns/:returnId
Authorization: Bearer <STAFF_OR_ADMIN_TOKEN>
```

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

```json
{
  "decision": "APPROVE_DEDUCTION",
  "reason": "Xác nhận hư hỏng theo bằng chứng và biểu phí",
  "assessmentVersion": 1,
  "expectedVersion": 1
}
```

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

```json
{
  "settlement": {
    "status": "PARTIALLY_SETTLED"
  },
  "refundRef": "<refund-uuid>",
  "deductionAmount": 350000,
  "refundAmount": 650000,
  "status": "REFUND_PENDING"
}
```

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
```

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
  }
}
```

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
