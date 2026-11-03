# Hướng Dẫn Tích Hợp Frontend — Xử Lý Biên Bản Giao Nhận & Chứng Từ Thuê Đồ (Rental Delivery & Documents)

- **Người nhận:** Frontend Team (Web App, Mobile App & Staff Mobile App)
- **Hệ thống:** TrekGo Rental Subsystem (Area B) — Delivery & Documents Module
- **Trạng thái:** Ánh xạ 100% theo mã nguồn Backend hiện tại (`api/src/modules/rental/delivery/`, `api/src/modules/rental/documents/`, `api/src/modules/rental/returns/`)
- **Phiên bản tài liệu:** v1.0.0 (Policy v1.5.2, Template v1.3.2)

---

## 1. Tổng Quan Kiến Trúc Biên Bản & Chứng Từ (Rental Documents)

Trong hệ thống TrekGo, **Biên bản giao nhận** không phải là các bản ghi chỉnh sửa tự do mà là **chứng từ pháp lý bất biến (Immutable Legal Documents)**. Chúng được tự động phát hành ngay trong cùng một Transaction khi các nghiệp vụ bàn giao hoặc nhận trả thực tế hoàn tất, được bảo chứng bằng mã băm **SHA-256** và kết xuất thành tệp PDF chính thức.

### 5 Loại Biên bản / Chứng từ trong hệ thống (`RentalDocumentType`)

| Loại chứng từ (`documentType`) | Tên hiển thị tiếng Việt | Thời điểm tự động phát hành | Tệp PDF tương ứng |
| :--- | :--- | :--- | :--- |
| **`HANDOVER`** | **Biên bản bàn giao thiết bị** | Khi nhân viên giao hàng xác minh mã khách và bấm chốt bàn giao thành công tại trạm (`POST /rental-orders/:id/handover`). Đơn hàng chuyển sang `ACTIVE`. | `TG-HANDOVER-...pdf` |
| **`RETURN_RECEIPT`** | **Biên nhận trả thiết bị** | Khi nhân viên nhận trả quét kiểm tra thiết bị và chốt phiên nhận trả (`POST /rental-orders/:id/return-receipts`). | `TG-RETURN_RECEIPT-...pdf` |
| **`EXTENSION_APPENDIX`** | **Phụ lục gia hạn thuê thiết bị** | Khi khách hàng gia hạn đơn thuê và thanh toán tiền gia hạn thành công. | `TG-EXTENSION_APPENDIX-...pdf` |
| **`SCHEDULE_NOTICE`** | **Thông báo điều chỉnh lịch trả** | Khi lịch trình chuyến đi dời do thời tiết/thiên tai (miễn phí phát sinh). | `TG-SCHEDULE_NOTICE-...pdf` |
| **`CORRECTION_NOTICE`** | **Thông báo đính chính chứng từ** | Khi Admin phát hành đính chính thông tin cho chứng từ trước đó. | `TG-CORRECTION_NOTICE-...pdf` |

---

## 2. Quy Trình Bàn Giao Thiết Bị (Handover Flow)

Quy trình giao nhận được phối hợp chặt chẽ giữa 2 màn hình: **Khách hàng (User)** và **Nhân viên giao nhận (Staff Delivery)**.

```
       [ KHÁCH HÀNG / RENTER ]                                [ NHÂN VIÊN GIAO NHẬN / STAFF ]
                  │                                                          │
   1. Xem trước gói đồ & tình trạng                                          │
      GET /rental-orders/:id/handover-preview                                │
                  │                                                          │
   2. Lấy mã nhận đồ (Pickup OTP / QR)                                       │
      GET /rental-orders/:id/pickup-code                                     │
                  │                                                          │
                  │────── Cung cấp mã Pickup Code (6-8 ký tự) ──────────────►│
                  │                                                          │
                  │                                            3. Quét/Nhập mã OTP để xác thực
                  │                                               POST /delivery/tasks/:id/verify-user
                  │                                               (Nhận về verificationRef)
                  │                                                          │
                  │                                            4. Kiểm tra đồ cùng khách & Ký chốt
                  │                                               POST /rental-orders/:id/handover
                  │                                                          │
                  │◄──────── Tự động sinh Biên bản HANDOVER ─────────────────┤
                  │          (Đơn hàng chuyển sang ACTIVE)                   │
   5. Tải & Xem Biên bản Bàn giao PDF                                        │
      GET /rental-orders/:id/documents                                       │
      GET /rental-documents/:docId/download                                  │
```

---

## 3. Chi Tiết API Phía Khách Hàng (Customer / Renter App)

### 3.1. Xem trước gói đồ trước giờ nhận (Handover Preview)
- **Endpoint:** `GET /rental-orders/:id/handover-preview` (RB-API-409)
- **Role:** `USER`, `LEADER`
- **Mục đích:** Khách kiểm tra danh sách thiết bị, mã tài sản (assetCode), phụ kiện kèm theo, và ảnh chụp tình trạng do kho chuẩn bị trước khi ra trạm nhận đồ.
- **Response thành công (HTTP 200):**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "packageId": "660e8400-e29b-41d4-a716-446655440002",
  "packageCode": "PKG-2026-1005-001",
  "items": [
    {
      "unitId": "770e8400-e29b-41d4-a716-446655440003",
      "assetCode": "TENT-4P-001",
      "productName": "Lều cắm trại 4 người chống nước",
      "condition": "GOOD",
      "accessories": ["4 cọc lều", "2 thanh khung", "túi đựng"],
      "evidencePhotos": [
        "https://cdn.trekgo.vn/evidence/pre-handover-tent-1.jpg"
      ]
    }
  ],
  "pickupPoint": {
    "name": "Trạm trung chuyển Đà Lạt",
    "address": "Số 1 Trần Hưng Đạo, P.10, Đà Lạt"
  },
  "scheduledAt": "2026-11-01T06:00:00.000Z"
}
```

---

### 3.2. Lấy mã nhận đồ một lần (Pickup Code / QR)
- **Endpoint:** `GET /rental-orders/:id/pickup-code` (RB-API-407)
- **Role:** `USER`, `LEADER`
- **Header:** `Cache-Control: no-store` (Backend bắt buộc không cache)
- **Mục đích:** Khách hàng bấm "Lấy mã nhận đồ" để lấy OTP/mã QR đưa cho nhân viên giao hàng tại điểm hẹn.
- **Response thành công (HTTP 200):**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "pickupCode": "TREK-8A3F",
  "expiresAt": "2026-11-01T07:00:00.000Z",
  "remainingSeconds": 3600,
  "qrPayload": "trekgo://rental/pickup?code=TREK-8A3F&orderId=550e8400-e29b-41d4-a716-446655440000"
}
```
> **Lưu ý Frontend:** Mã có thời hạn (`expiresAt`). Hãy hiển thị đồng hồ đếm ngược; khi hết hạn, cho phép khách bấm "Tạo lại mã".

---

### 3.3. Danh sách chứng từ của đơn hàng (List Documents)
- **Endpoint:** `GET /rental-orders/:id/documents` (RB-API-1001)
- **Role:** `USER`, `LEADER`, `STAFF_DELIVERY`, `STAFF_INVENTORY`, `ADMIN`
- **Query Params:**
  - `type` (tùy chọn): `HANDOVER` | `RETURN_RECEIPT` | `EXTENSION_APPENDIX` | `SCHEDULE_NOTICE` | `CORRECTION_NOTICE`
  - `page` (default: 1), `pageSize` (default: 20)
- **Response thành công (HTTP 200):**
```json
{
  "data": [
    {
      "id": "110e8400-e29b-41d4-a716-446655440001",
      "documentNumber": "TG-HANDOVER-8A3F2026B1C2",
      "documentType": "HANDOVER",
      "sourceRef": "handover-uuid-1234",
      "renderStatus": "READY",
      "pdfReady": true,
      "issuedAt": "2026-11-01T06:15:00.000Z",
      "snapshotHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

---

### 3.4. Tải tệp PDF biên bản chính thức (Download Signed PDF)
- **Endpoint:** `GET /rental-documents/:documentId/download` (RB-API-1003)
- **Role:** Tất cả các role có quyền trên đơn hàng
- **Response thành công (HTTP 200):**
```json
{
  "data": {
    "downloadUrl": "https://storage.trekgo.vn/rental-documents/110e8400.../doc.pdf?X-Amz-Signature=...",
    "expiresAt": "2026-11-01T06:25:00.000Z",
    "fileName": "TG-HANDOVER-8A3F2026B1C2.pdf",
    "contentType": "application/pdf",
    "sha256": "7d28041521c0b1fbc2bb950a13a96ae2e94bf2caf1c719f7ff19ee713acfb168"
  }
}
```
> **Lưu ý Frontend:** 
> - Đường dẫn `downloadUrl` là Pre-signed URL **chỉ có hiệu lực trong 10 phút**.
> - Không lưu vĩnh viễn URL này vào database/localStorage. Mỗi lần người dùng bấm "Xem biên bản" hoặc "Tải PDF", hãy gọi lại API này.
> - Nếu `renderStatus !== 'READY'` (API trả về HTTP 409 `DOCUMENT_NOT_READY`), hiển thị trạng thái *"Đang tạo file PDF, vui lòng thử lại sau giây lát..."*.

---

### 3.5. Kiểm tra tính toàn vẹn của biên bản (Verify SHA-256)
- **Endpoint:** `GET /rental-documents/:documentId/verification` (RB-API-1005)
- **Mục đích:** Chứng minh với khách hàng và kiểm toán rằng biên bản không bị chỉnh sửa sau khi bàn giao.
- **Response thành công (HTTP 200):**
```json
{
  "data": {
    "documentNo": "TG-HANDOVER-8A3F2026B1C2",
    "issuedAt": "2026-11-01T06:15:00.000Z",
    "snapshotHash": "e3b0c442...",
    "pdfHash": "7d280415...",
    "snapshotVerified": true,
    "pdfVerified": true,
    "verified": true,
    "verificationStatus": "VERIFIED"
  }
}
```

---

## 4. Chi Tiết API Phía Nhân Viên Giao Nhận (Staff Delivery App)

### 4.1. Danh sách Task giao hàng
- **Endpoint:** `GET /delivery/tasks` (hoặc `GET /logistics/tasks`) (RB-API-401)
- **Query Params:**
  - `type`: `OUTBOUND` (Giao thiết bị đi) | `RETURN` (Thu hồi thiết bị về)
  - `status`: `SCHEDULED`, `PACKAGE_RECEIVED`, `RECIPIENT_VERIFIED`, `HANDED_OVER`, `NO_SHOW`, `REFUSED`, v.v.
  - `date`: `YYYY-MM-DD`
  - `page`, `pageSize`

---

### 4.2. Nhận gói đồ từ kho (Custody Transfer: Warehouse ➔ Staff Delivery)
- **Endpoint:** `POST /delivery/tasks/:id/receive-package` (RB-API-402)
- **Header bắt buộc:** `Idempotency-Key: <unique-string>`
- **Request Body:**
```json
{
  "custodyTransferId": "990e8400-e29b-41d4-a716-446655440010",
  "packageCode": "PKG-2026-1005-001",
  "expectedVersion": 2
}
```

---

### 4.3. Xác thực khách nhận bằng mã OTP (Verify Recipient)
- **Endpoint:** `POST /delivery/tasks/:id/verify-user` (RB-API-403)
- **Header bắt buộc:** `Idempotency-Key: <unique-string>`
- **Request Body:**
```json
{
  "pickupCode": "TREK-8A3F",
  "expectedVersion": 3
}
```
- **Response thành công (HTTP 200):**
```json
{
  "verified": true,
  "verificationRef": "VERIFY-REF-8A3F-20261101-ABCD",
  "recipient": {
    "userId": "330e8400-e29b-41d4-a716-446655440099",
    "displayName": "Nguyễn Văn Trekker",
    "phone": "0912345678"
  },
  "packageId": "660e8400-e29b-41d4-a716-446655440002",
  "nextVersion": 4
}
```
> **Quan trọng:** Lưu lại `verificationRef` từ response này để gửi vào bước Ký chốt Bàn giao ngay sau đây!

---

### 4.4. Ký chốt Bàn Giao Thiết Bị (Commit Handover)
- **Endpoint:** `POST /rental-orders/:id/handover` (RB-API-404)
- **Header bắt buộc:** `Idempotency-Key: <unique-string>`
- **Request Body:**
```json
{
  "packageId": "660e8400-e29b-41d4-a716-446655440002",
  "verificationRef": "VERIFY-REF-8A3F-20261101-ABCD",
  "recipientNotes": "Khách đã kiểm tra đủ 4 cọc lều, hài lòng với tình trạng.",
  "reportedIssues": [
    {
      "unitId": "770e8400-e29b-41d4-a716-446655440003",
      "type": "SCRATCHED",
      "description": "Vết trầy nhẹ 2cm ở chân khung nhôm từ trước, không ảnh hưởng kết cấu."
    }
  ],
  "expectedVersion": 4
}
```
- **Response thành công (HTTP 200):**
```json
{
  "success": true,
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "orderStatus": "ACTIVE",
  "handoverId": "440e8400-e29b-41d4-a716-446655440055",
  "documentId": "110e8400-e29b-41d4-a716-446655440001",
  "documentNumber": "TG-HANDOVER-8A3F2026B1C2",
  "handedOverAt": "2026-11-01T06:15:00.000Z"
}
```
> **Hiệu ứng hệ thống:** Ngay khi API này thành công:
> 1. Trạng thái đơn hàng chuyển sang `ACTIVE`.
> 2. Biên bản `HANDOVER` được sinh ra tự động kèm đầy đủ danh sách thiết bị và ảnh chụp snapshot tình trạng.
> 3. Cả khách hàng và nhân viên đều có thể xem biên bản này trên ứng dụng.

---

### 4.5. Xử lý khách vắng mặt / từ chối nhận đồ (Mark No-Show / Refused)
- **Endpoint:** `POST /rental-orders/:id/no-show` (RB-API-405)
- **Header bắt buộc:** `Idempotency-Key: <unique-string>`
- **Request Body:**
```json
{
  "reason": "USER_NO_SHOW",
  "notes": "Đã chờ tại điểm tập kết 45 phút, liên hệ 3 cuộc gọi không nghe máy.",
  "evidenceIds": ["media-uuid-call-log-1", "media-uuid-photo-station"],
  "expectedVersion": 3
}
```
- **Các giá trị hợp lệ của `reason`:**
  - `USER_NO_SHOW`: Khách không đến điểm hẹn.
  - `USER_CHANGED_MIND`: Khách đến nhưng đổi ý không muốn thuê nữa.
  - `USER_REFUSED_DISCLOSED_CONDITION`: Khách từ chối nhận do tình trạng thiết bị không như ý muốn.
  - `SYSTEM_WRONG_EQUIPMENT` / `SYSTEM_DAMAGED_EQUIPMENT` / `SYSTEM_MISSING_EQUIPMENT`: Lỗi do phía TrekGo (soạn sai/thiếu/hỏng đồ).

---

## 5. Quy Trình Thu Hồi & Biên Nhận Trả Đồ (Return Receipt Flow)

Khi chuyến đi kết thúc, khách trả lại thiết bị tại trạm:

1. **Quét thiết bị trả (Return Scan):**
   - Nhân viên gọi `POST /rental-orders/:id/return-scan` quét mã vạch (barcode/assetCode) từng thiết bị.
2. **Kiểm tra sơ bộ tình trạng (Return Inspection):**
   - Nhân viên gọi `POST /rental-orders/:id/return-inspection` ghi nhận tình trạng sạch/bẩn, phụ kiện đủ/thiếu.
3. **Chốt phiên và phát hành Biên nhận trả đồ (`RETURN_RECEIPT`):**
   - **Endpoint:** `POST /rental-orders/:id/return-receipts` (RB-API-1004)
   - **Header:** `Idempotency-Key: <unique-key>`
   - **Request Body:**
     ```json
     {
       "returnSessionId": "550e8400-e29b-41d4-a716-446655440020",
       "expectedVersion": 1,
       "remarks": "Đã nhận lại đủ 1 lều và 2 gậy trekking. Lều hơi dính bùn cần vệ sinh.",
       "evidenceIds": ["media-uuid-photo-1"]
     }
     ```
   - **Response thành công (HTTP 201):**
     ```json
     {
       "success": true,
       "documentId": "220e8400-e29b-41d4-a716-446655440088",
       "documentNumber": "TG-RETURN_RECEIPT-9C2A4400",
       "documentType": "RETURN_RECEIPT",
       "issuedAt": "2026-11-03T17:30:00.000Z"
     }
     ```
   ➔ Khách hàng lập tức thấy biên nhận trả đồ này trong danh sách chứng từ trên ứng dụng của mình.

---

## 6. Quy Tắc Bắt Buộc Dành Cho Frontend Developer

### 1. Luôn gửi Header `Idempotency-Key` cho các lệnh Thay Đổi Dữ Liệu (POST)
- **Danh sách API bắt buộc có `Idempotency-Key`:**
  - `POST /rental-orders/:id/handover`
  - `POST /rental-orders/:id/no-show`
  - `POST /delivery/tasks/:id/claim`
  - `POST /delivery/tasks/:id/receive-package`
  - `POST /delivery/tasks/:id/verify-user`
  - `POST /rental-orders/:id/return-receipts`
- **Cách sinh key trên FE:** Sinh UUID v4 (chuỗi từ 8–200 ký tự).  
  *Ví dụ:* `handover-${orderId}-${Date.now()}`.  
- **Quy tắc Retry:** Nếu mạng bị timeout hoặc gián đoạn, khi bấm "Thử lại", **PHẢI GIỮ NGUYÊN key cũ** để Backend nhận diện là yêu cầu gửi lại và không tạo ra hai biên bản trùng lặp.

### 2. Quản lý Phiên bản Lạc quan (`expectedVersion`)
- Mỗi task hoặc phiên giao nhận đều có trường `version` tăng dần.
- Luôn truyền `expectedVersion` bằng đúng số version lấy từ API GET gần nhất.
- Nếu nhận về **HTTP 409 Conflict**, Frontend cần hiển thị thông báo: *"Dữ liệu vừa được cập nhật bởi thao tác khác. Vui lòng tải lại trang"* và tự động gọi lại API GET để cập nhật giao diện.

### 3. Cấu trúc Bắt Lỗi Thống Nhất
Toàn bộ mã lỗi trả về theo chuẩn `GlobalErrorFilter`:
```json
{
  "error": {
    "code": "PICKUP_CODE_INVALID",
    "message": "Mã pickup không hợp lệ hoặc đã hết hạn",
    "details": {},
    "retryable": false
  }
}
```
Bóc tách lỗi từ `response.data.error.message` và `response.data.error.code` để hiển thị Toast/Popup thân thiện cho người dùng.

---

## 7. TypeScript Type Definitions Mẫu Cho Frontend

```typescript
// 1. Enum loại chứng từ
export enum RentalDocumentType {
  HANDOVER = 'HANDOVER',
  RETURN_RECEIPT = 'RETURN_RECEIPT',
  EXTENSION_APPENDIX = 'EXTENSION_APPENDIX',
  SCHEDULE_NOTICE = 'SCHEDULE_NOTICE',
  CORRECTION_NOTICE = 'CORRECTION_NOTICE',
}

// 2. Trạng thái render PDF
export enum RentalDocumentRenderStatus {
  PENDING_RENDER = 'PENDING_RENDER',
  READY = 'READY',
  RENDER_FAILED = 'RENDER_FAILED',
}

// 3. Item trong danh sách chứng từ
export interface RentalDocumentSummary {
  id: string;
  documentNumber: string;
  documentType: RentalDocumentType;
  sourceRef: string;
  renderStatus: RentalDocumentRenderStatus;
  pdfReady: boolean;
  issuedAt: string;
  snapshotHash: string;
}

// 4. Response tải PDF có chữ ký
export interface RentalDocumentDownloadResponse {
  downloadUrl: string;
  expiresAt: string;
  fileName: string;
  contentType: string;
  sha256: string;
}

// 5. Response xem trước gói đồ (Handover Preview)
export interface HandoverPreviewResponse {
  orderId: string;
  packageId: string;
  packageCode: string;
  items: Array<{
    unitId: string;
    assetCode: string;
    productName: string;
    condition: 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED';
    accessories: string[];
    evidencePhotos: string[];
  }>;
  pickupPoint: {
    name: string;
    address: string;
  };
  scheduledAt: string;
}

// 6. Response lấy mã nhận đồ (Pickup Code)
export interface RentalPickupCodeResponse {
  orderId: string;
  pickupCode: string;
  expiresAt: string;
  remainingSeconds: number;
  qrPayload: string;
}
```

---
*Mọi thắc mắc kỹ thuật hoặc yêu cầu môi trường giả lập (mocking), vui lòng liên hệ Backend Team để được hỗ trợ.*

