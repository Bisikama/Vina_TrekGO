# Hướng dẫn Frontend tích hợp Media (Hình ảnh, Video & Chứng chỉ)

> **Cập nhật theo mã nguồn Backend:** 21/10/2026  
> **Module Backend tương ứng:** `api/src/modules/media` (`MediaController`, `DevMediaController`, `MediaPolicyService`, `CloudinaryStorageAdapter`)  
> **Base URL:** Tất cả các đường dẫn API Backend dưới đây đều có tiền tố `/api/v1`.

---

## 1. Nguyên tắc cốt lõi Frontend cần nắm

1. **Không gửi file binary trực tiếp vào các API nghiệp vụ:**
   - Các API nghiệp vụ (Tạo/sửa sản phẩm thuê, Chụp tình trạng thiết bị tại kho, Quét trả đồ, Khiếu nại hư hỏng, Nộp hồ sơ Leader...) **KHÔNG** nhận `multipart/form-data`, `base64` hay URL ảnh tự truyền.
   - Các API nghiệp vụ chỉ nhận **`mediaId` (UUID)** của file đã hoàn tất tải lên và đang ở trạng thái **`READY`**.
2. **Luồng tải lên (Upload) luôn gồm 3 bước (Direct-to-Cloudinary Signed Upload):**
   - **Bước 1 — Tạo Upload Intent (`POST /api/v1/media/upload-intents`):** Gửi thông tin mô tả file lên Backend để kiểm tra quyền (RBAC), định dạng, dung lượng và nhận chữ ký upload (`uploadUrl` + `formFields`).
   - **Bước 2 — Tải file trực tiếp lên Cloudinary (`POST <upload.uploadUrl>`):** Đính kèm toàn bộ `formFields` và file binary gửi thẳng lên Cloudinary (không đi qua server NestJS).
   - **Bước 3 — Xác nhận hoàn tất (`POST /api/v1/media/:id/complete`):** Gửi `{ publicId, version, signature }` do Cloudinary trả về để Backend kiểm tra chữ ký, kích thước/độ phân giải/thời lượng thực tế và chuyển trạng thái từ `PENDING_UPLOAD` sang **`READY`**.
3. **Luồng hiển thị (Delivery) lấy URL qua `GET /api/v1/media/:id/delivery`:**
   - Khi đọc dữ liệu từ các API nghiệp vụ (ví dụ sản phẩm trả về `imageMediaIds: string[]`, hoặc biên bản trả về `evidenceIds: string[]`), Frontend gọi `GET /api/v1/media/:id/delivery?variant=...` để lấy URL hiển thị ảnh (`<img>`) hoặc phát video (`<video>`).

---

## 2. Phân quyền, Định dạng & Nơi sử dụng theo từng `scope`

Khi gọi Bước 1 (`POST /api/v1/media/upload-intents`), Frontend phải truyền đúng `scope` và `resourceType` tương ứng với tính năng đang thực hiện:

| `scope` | Role được phép Upload | `resourceType` cho phép | MIME Type (`contentType`) hợp lệ | Chế độ bảo mật khi xem (`deliveryType`) | Nơi truyền `mediaId` vào API nghiệp vụ |
|---|---|---|---|---|---|
| **`RENTAL_PRODUCT`** | `STAFF_INVENTORY`, `ADMIN` | Chỉ `IMAGE` | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif` | **Public** (`upload`) — xem không cần đăng nhập | Trường `imageMediaIds: string[]` trong:<br/>• `POST /api/v1/staff/rental-products`<br/>• `PATCH /api/v1/staff/rental-products/:id` |
| **`CONDITION_EVIDENCE`** | `STAFF_INVENTORY` | `IMAGE`, `VIDEO` | **Ảnh:** như trên<br/>**Video:** `video/mp4`, `video/quicktime`, `video/webm` | **Private** (`authenticated`) — bắt buộc có Bearer Token | Trường `evidenceIds: string[]` trong:<br/>• `POST /api/v1/staff/preparation/tasks/:id/condition-snapshots` |
| **`RETURN_EVIDENCE`** | `STAFF_INVENTORY`, `STAFF_DELIVERY` | `IMAGE`, `VIDEO` | **Ảnh:** như trên<br/>**Video:** `video/mp4`, `video/quicktime`, `video/webm` | **Private** (`authenticated`) — bắt buộc có Bearer Token | Trường `evidenceIds: string[]` / `failureEvidenceId` trong:<br/>• `POST /api/v1/rental-orders/:id/return-observations`<br/>• `POST /api/v1/rental-orders/:id/return-receipts`<br/>• `POST /api/v1/staff/returns/:returnId/final-inspection` |
| **`EXCEPTION_EVIDENCE`** | `USER`, `LEADER`, `STAFF_INVENTORY`, `STAFF_DELIVERY`, `ADMIN` | `IMAGE`, `VIDEO` | **Ảnh:** như trên<br/>**Video:** `video/mp4`, `video/quicktime`, `video/webm` | **Private** (`authenticated`) — bắt buộc có Bearer Token | Trường `evidenceIds: string[]` trong:<br/>• `POST /api/v1/rental-orders/:id/assessment-reviews` (Khách khiếu nại)<br/>• `POST /api/v1/rental-orders/:id/no-show`<br/>• `POST /api/v1/rental-orders/:id/return-receipts` |
| **`LEADER_CERTIFICATE`** | Chỉ `USER` (tài khoản `ACTIVE`) | Chỉ `IMAGE` *(kể cả file PDF)* | `image/jpeg`, `image/png`, `application/pdf` | **Private** (`authenticated`) — chỉ chủ sở hữu hoặc `ADMIN` | Trường `certificates[].fileKey` trong:<br/>• `POST /api/v1/leader-applications` |

> **Lưu ý đặc biệt cho `LEADER_CERTIFICATE`:** Dù người dùng chọn file `.pdf`, Frontend vẫn phải truyền `resourceType: "IMAGE"` và `contentType: "application/pdf"` (do Cloudinary lưu trữ và xử lý PDF nhiều trang dưới resource type `image`).

---

## 3. Giới hạn Kỹ thuật (Dung lượng, Độ phân giải, Thời lượng Video)

Frontend **nên kiểm tra trước ở Client (Client-side validation)** các thông số dưới đây trước khi bắt đầu tải lên để phản hồi tức thì cho người dùng, vì ở Bước 3 (`/complete`) Backend sẽ đọc metadata thực tế từ Cloudinary và **từ chối (`REJECTED`)** nếu vi phạm:

### 3.1. Đối với Hình ảnh (`resourceType: "IMAGE"`)
* **Dung lượng tối đa:** `20 MB` (`20,971,520` bytes).
* **Định dạng cho phép:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.heif` (riêng `LEADER_CERTIFICATE` chỉ nhận `.jpg`, `.jpeg`, `.png`, `.pdf`).
* **Kích thước (Width × Height) bắt buộc:**
  - **Tối thiểu:** Rộng `>= 320px` **VÀ** Cao `>= 240px`. *(Cảnh báo: Không dùng ảnh icon 1×1px hoặc ảnh nhỏ hơn 320×240px để test vì Bước 3 sẽ báo lỗi `422 MEDIA_INVALID_DIMENSIONS`)*.
  - **Tối đa:** Rộng `<= 12000px` **VÀ** Cao `<= 12000px`.
  - *(Ngoại lệ: File `.pdf` của `LEADER_CERTIFICATE` được bỏ qua kiểm tra kích thước pixel).*

### 3.2. Đối với Video (`resourceType: "VIDEO"`)
* **Chỉ áp dụng cho 3 scope bằng chứng:** `CONDITION_EVIDENCE`, `RETURN_EVIDENCE`, `EXCEPTION_EVIDENCE`.
* **Dung lượng tối đa:** `100 MB` (`104,857,600` bytes).
* **Định dạng & MIME Type cho phép:**
  - `.mp4` (`video/mp4`)
  - `.mov` (`video/quicktime`)
  - `.webm` (`video/webm`)
* **Thời lượng tối đa (`duration`):** **Tối đa `60 giây`** (1 phút). Nếu video dài hơn 60 giây, Bước 3 sẽ từ chối với lỗi `422 MEDIA_VIDEO_TOO_LONG`.
* **Độ phân giải (Width × Height):**
  - **Tối thiểu:** `320 × 240 px`.
  - **Tối đa:** `3840 × 2160 px` (4K).

---

## 4. Chi tiết Luồng Upload 3 bước (Hình ảnh & Video)

```text
[Frontend]                                [TrekGo Backend]                         [Cloudinary]
    |                                             |                                      |
    |--- 1. POST /api/v1/media/upload-intents --->|                                      |
    |<-- Trả về { mediaId, upload: {              |                                      |
    |      uploadUrl, formFields } } -------------|                                      |
    |                                             |                                      |
    |--- 2. POST multipart/form-data (formFields + file) ------------------------------->|
    |<-- Trả về { public_id, version, signature } ---------------------------------------|
    |                                             |                                      |
    |--- 3. POST /api/v1/media/:id/complete ----->|                                      |
    |      { publicId, version, signature }       |--- Kiểm tra metadata, tạo biến thể ->|
    |<-- Trả về MediaAsset { id, status: "READY" }|                                      |
```

### Bước 1: Tạo Upload Intent
* **Endpoint:** `POST /api/v1/media/upload-intents`
* **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "scope": "RETURN_EVIDENCE",
    "resourceType": "VIDEO",
    "fileName": "kiem-tra-leu-trai.mp4",
    "contentType": "video/mp4",
    "sizeBytes": 15485760,
    "captureSource": "CAMERA",
    "clientCapturedAt": "2026-10-21T14:30:00.000Z"
  }
  ```
  - `captureSource` *(tùy chọn, mặc định `"UNKNOWN"`)*: `"CAMERA" | "GALLERY" | "FILE" | "SYSTEM" | "UNKNOWN"`. Với ảnh/video bằng chứng (`*_EVIDENCE`), nếu chụp trực tiếp từ camera nên gửi `"CAMERA"` kèm `clientCapturedAt` (ISO 8601 có offset/Z) để hệ thống đối chiếu EXIF Provenance.
* **Response (`201 Created`):**
  ```json
  {
    "data": {
      "mediaId": "123e4567-e89b-12d3-a456-426614174000",
      "status": "PENDING_UPLOAD",
      "expiresAt": "2026-10-21T14:45:00.000Z",
      "provider": "CLOUDINARY",
      "upload": {
        "provider": "CLOUDINARY",
        "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud_name>/video/upload",
        "method": "POST",
        "resourceType": "VIDEO",
        "formFields": {
          "api_key": "1234567890",
          "timestamp": 1792593000,
          "signature": "a1b2c3d4...",
          "public_id": "trekgo/return-evidence/123e4567-e89b-12d3-a456-426614174000",
          "type": "authenticated"
        }
      }
    }
  }
  ```
  *(Lưu ý: Upload Intent có hiệu lực trong **15 phút** tính tới `expiresAt`).*

---

### Bước 2: Upload trực tiếp file binary lên Cloudinary
* **URL:** Giá trị `upload.uploadUrl` nhận được từ Bước 1:
  - Với Ảnh, URL có dạng `https://api.cloudinary.com/v1_1/<cloud_name>/image/upload`.
  - Với Video, URL có dạng `https://api.cloudinary.com/v1_1/<cloud_name>/video/upload`.
* **Method:** `POST` (`multipart/form-data`)
* **Quy tắc cực kỳ quan trọng:**
  1. Đính kèm **TẤT CẢ** các cặp `key: value` bên trong `upload.formFields` vào `FormData` (bao gồm cả `overwrite`, `allowed_formats` nếu có ở scope `LEADER_CERTIFICATE`).
  2. Đính kèm đối tượng `File` / `Blob` vào trường tên là `"file"`.
  3. **KHÔNG** gắn header `Authorization: Bearer ...` của TrekGo vào request gọi lên Cloudinary (nếu dùng Axios instance chung của dự án có interceptor tự gắn `Authorization`, hãy dùng `fetch` thuần hoặc `XMLHttpRequest` để tránh lỗi CORS từ Cloudinary).
* **Response từ Cloudinary (`200 OK`):**
  ```json
  {
    "asset_id": "9876543210abcdef",
    "public_id": "trekgo/return-evidence/123e4567-e89b-12d3-a456-426614174000",
    "version": 1792593012,
    "signature": "f0e1d2c3b4a5...",
    "width": 1280,
    "height": 720,
    "format": "mp4",
    "resource_type": "video",
    "bytes": 15485760
  }
  ```

---

### Bước 3: Xác nhận hoàn tất với Backend (`complete`)
* **Endpoint:** `POST /api/v1/media/:id/complete` (trong đó `:id` là `mediaId` ở Bước 1)
* **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: application/json`
* **Request Body:** Lấy đúng 3 trường từ response của Cloudinary ở Bước 2:
  ```json
  {
    "publicId": "trekgo/return-evidence/123e4567-e89b-12d3-a456-426614174000",
    "version": 1792593012,
    "signature": "f0e1d2c3b4a5..."
  }
  ```
* **Response (`200 OK`):**
  ```json
  {
    "data": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "scope": "RETURN_EVIDENCE",
      "resourceType": "VIDEO",
      "status": "READY",
      "mimeType": "video/mp4",
      "sizeBytes": 15485760,
      "width": 1280,
      "height": 720,
      "durationMs": 14500,
      "captureSource": "CAMERA",
      "provenanceStatus": "UNKNOWN",
      "readyAt": "2026-10-21T14:30:15.000Z"
    }
  }
  ```
* **Tính chất Idempotent:** Nếu mạng chập chờn và Frontend gọi lại `/complete` cho một `mediaId` đã ở trạng thái `READY`, Backend vẫn trả về `200 OK` cùng thông tin asset đó mà không báo lỗi.

---

## 5. Cách lấy URL hiển thị Hình ảnh & phát Video (`GET /api/v1/media/:id/delivery`)

Khi cần hiển thị ảnh hoặc video từ một `mediaId`, gọi endpoint:

```http
GET /api/v1/media/{mediaId}/delivery?variant={VARIANT}&format={FORMAT}
```

### 5.1. Bảng quy tắc chọn `variant` (BẮT BUỘC ĐÚNG KẾT HỢP)
Backend kiểm tra nghiêm ngặt sự tương thích giữa `scope`, `resourceType` và `variant`. Nếu truyền sai cặp (ví dụ lấy `EVIDENCE_PREVIEW` cho một `VIDEO` hoặc lấy `CATALOG_CARD` cho ảnh `RETURN_EVIDENCE`), Backend sẽ trả về lỗi **`400 VALIDATION_ERROR`**.

| Loại Media | `scope` của Media | `resourceType` | Các `variant` hợp lệ | Kích thước tối đa | Có cần gửi `Authorization: Bearer`? |
|---|---|---|---|---|---|
| **Ảnh sản phẩm Catalog** | `RENTAL_PRODUCT` | `IMAGE` | • `CATALOG_THUMBNAIL`<br/>• `CATALOG_CARD`<br/>• `CATALOG_DETAIL` | • Rộng `320px`<br/>• Rộng `720px`<br/>• Rộng `1600px` | **Không bắt buộc** (Public) |
| **Ảnh bằng chứng (Evidence)** | `CONDITION_EVIDENCE`<br/>`RETURN_EVIDENCE`<br/>`EXCEPTION_EVIDENCE` | `IMAGE` | • `EVIDENCE_THUMBNAIL`<br/>• `EVIDENCE_PREVIEW` | • Rộng `320px`<br/>• Rộng `1600px` | **Bắt buộc** (Chủ sở hữu ảnh, Staff hoặc Admin) |
| **Video bằng chứng (Evidence)** | `CONDITION_EVIDENCE`<br/>`RETURN_EVIDENCE`<br/>`EXCEPTION_EVIDENCE` | `VIDEO` | • **`VIDEO_PREVIEW`** *(duy nhất)* | • Rộng `1280px` (`.mp4`) | **Bắt buộc** (Chủ sở hữu video, Staff hoặc Admin) |
| **Chứng chỉ Leader** | `LEADER_CERTIFICATE` | `IMAGE` *(JPG/PNG/PDF)* | • **`DOCUMENT_ORIGINAL`** *(duy nhất)* | Bản gốc (Signed URL 5 phút) | **Bắt buộc** (Chủ hồ sơ hoặc `ADMIN`) |

### 5.2. Tham số `format` (Tùy chọn)
* Giá trị hợp lệ: `AUTO` (mặc định) | `WEBP` | `JPEG`.
* Với Video (`VIDEO_PREVIEW`), Backend luôn xuất ra định dạng chuẩn `.mp4` để tương thích với mọi trình duyệt (`<video src="..." controls />`).

### 5.3. Ví dụ Response của `GET /api/v1/media/:id/delivery`
```json
{
  "data": {
    "mediaId": "123e4567-e89b-12d3-a456-426614174000",
    "variant": "VIDEO_PREVIEW",
    "resourceType": "VIDEO",
    "url": "https://res.cloudinary.com/<cloud_name>/video/authenticated/s--xyz--/c_limit,q_auto,w_1280/v1/trekgo/return-evidence/123e4567-e89b-12d3-a456-426614174000.mp4",
    "expiresAt": null,
    "format": "AUTO"
  }
}
```
Frontend lấy trường `url` trong response để gán trực tiếp vào `<img src={url} />` hoặc `<video src={url} controls preload="metadata" />`.

### 5.4. Đặc biệt với Sản phẩm thuê (`RentalProduct` Catalog): Đã trả sẵn mảng `images` trong Response
Đối với các API danh mục thiết bị thuê (`GET /api/v1/rental-products`, `GET /api/v1/rental-products/:id`, `GET /api/v1/staff/rental-products`), Backend **đã tự động resolve sẵn URL các biến thể kích thước** ngay trong từng sản phẩm:
```json
{
  "id": "prod-uuid",
  "sku": "TENT-4P-001",
  "name": "Lều cắm trại 4 người",
  "imageMediaIds": ["11111111-1111-4111-8111-111111111111"],
  "images": [
    {
      "mediaId": "11111111-1111-4111-8111-111111111111",
      "url": "https://res.cloudinary.com/.../image/upload/v1/trekgo/rental-product/11111111-1111-4111-8111-111111111111.jpg",
      "thumbnailUrl": "https://res.cloudinary.com/.../image/upload/c_limit,f_auto,q_auto,w_320/v1/trekgo/rental-product/11111111-1111-4111-8111-111111111111.jpg",
      "cardUrl": "https://res.cloudinary.com/.../image/upload/c_limit,f_auto,q_auto,w_720/v1/trekgo/rental-product/11111111-1111-4111-8111-111111111111.jpg",
      "detailUrl": "https://res.cloudinary.com/.../image/upload/c_limit,f_auto,q_auto,w_1600/v1/trekgo/rental-product/11111111-1111-4111-8111-111111111111.jpg",
      "mimeType": "image/jpeg",
      "width": 1920,
      "height": 1080
    }
  ]
}
```
* **Khi hiển thị danh sách/chi tiết sản phẩm:** Frontend dùng trực tiếp `product.images[0]?.cardUrl` (hoặc `thumbnailUrl`, `detailUrl`) mà **không cần gọi thêm** `GET /api/v1/media/:id/delivery`.
* **Khi Tạo/Sửa sản phẩm (`POST /api/v1/staff/rental-products`, `PATCH /api/v1/staff/rental-products/:id`):** Frontend gửi mảng UUID `imageMediaIds` đã hoàn tất bước `/complete` với `scope: 'RENTAL_PRODUCT'`, `resourceType: 'IMAGE'`. Backend sẽ kiểm tra chặt trạng thái `READY` và tự động gỡ thời hạn xóa mồ côi (`retentionUntil = null`).

---

## 6. Xóa Media (`DELETE /api/v1/media/:id`)

* **Endpoint:** `DELETE /api/v1/media/:id` (Yêu cầu `Authorization: Bearer <token>`)
* **Lưu ý quan trọng về Chính sách Lưu trữ (Retention & Active References):**
  1. Một khi `mediaId` đã được gắn vào sản phẩm (`RentalProduct.images`), biên bản kiểm tra (`ConditionSnapshot`, `ReturnInspection`), hồ sơ ngoại lệ (`RentalExceptionCase`) hoặc chứng chỉ Leader (`LeaderCertificate`), hoặc vẫn còn trong thời hạn lưu trữ bắt buộc (`retentionUntil`), API `DELETE /api/v1/media/:id` sẽ chặn xóa và trả về **`409 MEDIA_INVALID_STATE`**.
  2. Vì vậy, khi người dùng bấm nút **"Xóa ảnh"** trên form (ví dụ khi đang sửa sản phẩm hoặc đang chọn ảnh trước khi bấm Submit biên bản):
     - Trên UI chỉ cần **bỏ `mediaId` đó ra khỏi mảng `imageMediaIds` / `evidenceIds`** sẽ gửi lên ở form nghiệp vụ.
     - Các file mồ côi (upload xong nhưng không gắn vào bản ghi nghiệp vụ nào) sẽ được cronjob `MediaCleanupScheduler` của Backend tự động dọn dẹp sau khi hết hạn retention.

---

## 7. Endpoint hỗ trợ Test nhanh trên môi trường Dev (`POST /api/v1/dev/media/upload-test`)

Khi chạy ở môi trường phát triển (`NODE_ENV !== 'production'` và biến môi trường `MEDIA_DEV_UPLOAD_ENABLED=true`), Backend mở thêm 1 API gộp cả 3 bước để Dev test nhanh trên Swagger hoặc Postman:

* **Endpoint:** `POST /api/v1/dev/media/upload-test`
* **Content-Type:** `multipart/form-data`
* **Fields:**
  - `file`: File ảnh hoặc video binary
  - `scope`: `'RENTAL_PRODUCT' | 'CONDITION_EVIDENCE' | 'RETURN_EVIDENCE' | 'EXCEPTION_EVIDENCE' | 'LEADER_CERTIFICATE'`
  - `captureSource` *(optional)*: `'CAMERA' | 'GALLERY' | 'FILE' | 'SYSTEM' | 'UNKNOWN'`
* **Lưu ý:** Tuyệt đối **KHÔNG** sử dụng `/api/v1/dev/media/upload-test` trong code giao diện Frontend chính thức (vì route này bị tắt hoàn toàn trên Production). Code Frontend luôn phải dùng luồng 3 bước chuẩn ở Mục 4.

---

## 8. Code mẫu tích hợp hoàn chỉnh cho Frontend (`media.api.ts`)

Bạn có thể tạo file `web/src/features/media/services/media.api.ts` (hoặc đặt trong `web/src/lib/media.ts`) theo mẫu chuẩn dưới đây:

```ts
import { apiClient } from '@/lib/axios'; // Instance axios có sẵn Bearer token của dự án

export type MediaScope =
  | 'RENTAL_PRODUCT'
  | 'CONDITION_EVIDENCE'
  | 'RETURN_EVIDENCE'
  | 'EXCEPTION_EVIDENCE'
  | 'LEADER_CERTIFICATE';

export type MediaResourceType = 'IMAGE' | 'VIDEO';

export type MediaCaptureSource = 'CAMERA' | 'GALLERY' | 'FILE' | 'SYSTEM' | 'UNKNOWN';

export type MediaDeliveryVariant =
  | 'CATALOG_THUMBNAIL'
  | 'CATALOG_CARD'
  | 'CATALOG_DETAIL'
  | 'EVIDENCE_THUMBNAIL'
  | 'EVIDENCE_PREVIEW'
  | 'VIDEO_PREVIEW'
  | 'DOCUMENT_ORIGINAL';

export interface UploadIntentResponse {
  mediaId: string;
  status: 'PENDING_UPLOAD';
  expiresAt: string;
  provider: 'CLOUDINARY';
  upload: {
    provider: 'CLOUDINARY';
    uploadUrl: string;
    method: 'POST';
    resourceType: MediaResourceType;
    formFields: Record<string, string | number | boolean>;
  };
}

export interface MediaAssetReadyResponse {
  id: string;
  scope: MediaScope;
  resourceType: MediaResourceType;
  status: 'READY';
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  captureSource: MediaCaptureSource;
  provenanceStatus: string | null;
  readyAt: string;
}

export interface MediaDeliveryResponse {
  mediaId: string;
  variant: MediaDeliveryVariant;
  resourceType: MediaResourceType;
  url: string;
  expiresAt: string | null;
  format: string;
}

function unwrap<T>(res: { data: { data?: T } & T }): T {
  return (res.data?.data ?? res.data) as T;
}

/**
 * Tự động xác định resourceType từ File và Scope
 */
export function inferResourceType(file: File, scope: MediaScope): MediaResourceType {
  if (scope === 'LEADER_CERTIFICATE') {
    return 'IMAGE'; // PDF của chứng chỉ Leader cũng dùng resourceType = IMAGE
  }
  return file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
}

/**
 * Hàm Upload trọn gói 3 bước (Intent -> Cloudinary Direct Upload -> Complete)
 * Hỗ trợ callback onProgress(percent) để làm thanh tiến trình khi tải video/ảnh nặng.
 */
export async function uploadMediaFile(
  file: File,
  options: {
    scope: MediaScope;
    captureSource?: MediaCaptureSource;
    clientCapturedAt?: string;
    onProgress?: (percent: number) => void;
  },
): Promise<MediaAssetReadyResponse> {
  const resourceType = inferResourceType(file, options.scope);

  // Bước 1: Xin Upload Intent từ Backend
  const intentRes = await apiClient.post('/media/upload-intents', {
    scope: options.scope,
    resourceType,
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    captureSource: options.captureSource ?? 'FILE',
    ...(options.clientCapturedAt ? { clientCapturedAt: options.clientCapturedAt } : {}),
  });
  const intent = unwrap<UploadIntentResponse>(intentRes);

  // Bước 2: Đẩy file trực tiếp lên Cloudinary (KHÔNG dùng apiClient để tránh đính kèm Authorization header)
  const formData = new FormData();
  for (const [key, value] of Object.entries(intent.upload.formFields)) {
    formData.append(key, String(value));
  }
  formData.append('file', file);

  const cloudinaryData = await new Promise<{
    public_id: string;
    version: number;
    signature: string;
  }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(intent.upload.method, intent.upload.uploadUrl);

    if (options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          options.onProgress?.(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Không đọc được phản hồi từ Cloudinary'));
        }
      } else {
        reject(new Error(`Tải lên Cloudinary thất bại (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Lỗi kết nối mạng khi tải file lên Cloudinary'));
    xhr.send(formData);
  });

  // Bước 3: Xác nhận hoàn tất với Backend để chuyển sang trạng thái READY
  const completeRes = await apiClient.post(`/media/${intent.mediaId}/complete`, {
    publicId: cloudinaryData.public_id,
    version: Number(cloudinaryData.version),
    signature: cloudinaryData.signature,
  });

  return unwrap<MediaAssetReadyResponse>(completeRes);
}

/**
 * Lấy URL phân phối của Ảnh hoặc Video để hiển thị trên UI
 */
export async function getMediaDeliveryUrl(
  mediaId: string,
  variant: MediaDeliveryVariant,
  format: 'AUTO' | 'WEBP' | 'JPEG' = 'AUTO',
): Promise<MediaDeliveryResponse> {
  const res = await apiClient.get(`/media/${mediaId}/delivery`, {
    params: { variant, format },
  });
  return unwrap<MediaDeliveryResponse>(res);
}
```

---

## 9. Ví dụ sử dụng thực tế trong các màn hình Frontend

### 9.1. Ví dụ 1: Nhân viên Kho tạo Sản phẩm thuê kèm danh sách ảnh (`RENTAL_PRODUCT`)
```ts
// 1. Upload nhiều ảnh sản phẩm song song
const uploadedAssets = await Promise.all(
  selectedImageFiles.map((file) =>
    uploadMediaFile(file, { scope: 'RENTAL_PRODUCT', captureSource: 'FILE' }),
  ),
);

// 2. Lấy mảng mediaId đã READY truyền vào API tạo sản phẩm
const imageMediaIds = uploadedAssets.map((asset) => asset.id);

await apiClient.post('/staff/rental-products', {
  sku: 'TENT-4P-PRO',
  name: 'Lều cắm trại 4 người chống mưa',
  categoryId: selectedCategoryId,
  dailyPrice: 120000,
  replacementValue: 2500000,
  currency: 'VND',
  depositPolicy: { type: 'FIXED', amount: 500000 },
  imageMediaIds, // <-- Mảng UUID từ bước upload
});
```

### 9.2. Ví dụ 2: Nhân viên / Khách hàng tải lên cả Ảnh và Video minh chứng (`RETURN_EVIDENCE` / `EXCEPTION_EVIDENCE`)
```ts
// Người dùng có thể chọn hỗn hợp cả file ảnh (.jpg, .png) và video (.mp4, .mov <= 60s)
const uploadedEvidences = await Promise.all(
  selectedFiles.map((file) =>
    uploadMediaFile(file, {
      scope: 'RETURN_EVIDENCE', // Hoặc 'EXCEPTION_EVIDENCE' khi khách khiếu nại
      captureSource: 'CAMERA',
      clientCapturedAt: new Date().toISOString(),
      onProgress: (pct) => console.log(`${file.name}: ${pct}%`),
    }),
  ),
);

const evidenceIds = uploadedEvidences.map((item) => item.id);

// Gửi mảng evidenceIds vào API ghi nhận quan sát trả đồ
await apiClient.post(
  `/rental-orders/${orderId}/return-observations`,
  {
    expectedVersion: order.version,
    items: [
      {
        unitId: unit.id,
        visibleDamage: true,
        accessoryObservations: ['Rách nhẹ túi đựng'],
        notes: 'Đã quay video chi tiết vết rách',
        evidenceIds, // <-- Chấp nhận cả mediaId của IMAGE và VIDEO
      },
    ],
  },
  { headers: { 'Idempotency-Key': crypto.randomUUID() } },
);
```

### 9.3. Ví dụ 3: Hiển thị Ảnh & Phát Video bằng chứng khi chưa biết `mediaId` là Ảnh hay Video
Nếu API nghiệp vụ chỉ trả về mảng `evidenceIds: string[]` (không kèm `resourceType`), Frontend có thể thử lấy `EVIDENCE_THUMBNAIL` (hoặc nếu biết là video thì gọi `VIDEO_PREVIEW`):

```ts
export async function resolveEvidenceMedia(mediaId: string): Promise<MediaDeliveryResponse> {
  try {
    // Mặc định thử lấy ảnh preview trước
    return await getMediaDeliveryUrl(mediaId, 'EVIDENCE_PREVIEW');
  } catch {
    // Nếu mediaId là VIDEO, gọi sang biến thể dành riêng cho video
    return await getMediaDeliveryUrl(mediaId, 'VIDEO_PREVIEW');
  }
}
```
Khi render trên React:
- Nếu `media.resourceType === 'VIDEO'`:
  ```tsx
  <video
    src={media.url}
    controls
    preload="metadata"
    className="w-full max-w-lg rounded-lg border"
  />
  ```
- Nếu `media.resourceType === 'IMAGE'`:
  ```tsx
  <img
    src={media.url}
    alt="Minh chứng thiết bị"
    loading="lazy"
    className="w-full max-w-lg rounded-lg object-cover border"
  />
  ```

---

## 10. Bảng mã lỗi Media (`response.data.error`) và cách xử lý trên UI

Tất cả các lỗi từ module Media đều đi qua `GlobalErrorFilter` với cấu trúc chuẩn `{ error: { code, message, details, retryable }, meta: { ... } }`:

| Mã lỗi (`error.code`) | HTTP | Nguyên nhân | Cách xử lý trên Frontend |
|---|---:|---|---|
| `MEDIA_FILE_TOO_LARGE` | `413` | Ảnh vượt quá `20MB` hoặc Video vượt quá `100MB`. | Chặn ngay từ lúc chọn file (`file.size`) và báo người dùng chọn file nhỏ hơn. |
| `MEDIA_UNSUPPORTED_MIME_TYPE` | `422` | Gửi sai MIME type (ví dụ `.gif`, `.avi`, `.mkv`). | Giới hạn thuộc tính `accept` trên thẻ `<input type="file" />` theo đúng bảng ở Mục 2. |
| `MEDIA_UNSUPPORTED_FORMAT` | `422` | Định dạng thực tế của file trên Cloudinary không nằm trong danh sách cho phép. | Báo người dùng chọn đúng định dạng ảnh (`JPG/PNG/WEBP/HEIC`) hoặc video (`MP4/MOV/WEBM`). |
| `MEDIA_INVALID_DIMENSIONS` | `422` | Ảnh/Video nhỏ hơn `320×240px`, hoặc Ảnh lớn hơn `12000×12000px`, hoặc Video lớn hơn `3840×2160px`. | Báo người dùng chọn ảnh/video có độ phân giải tối thiểu `320×240px`. |
| `MEDIA_VIDEO_TOO_LONG` | `422` | Thời lượng video vượt quá `60 giây`. | Kiểm tra `videoElement.duration <= 60` trước khi upload hoặc thông báo người dùng cắt ngắn video dưới 1 phút. |
| `MEDIA_UPLOAD_EXPIRED` | `410` | Quá 15 phút kể từ lúc gọi `upload-intents` mới gọi `complete`. | Tự động chạy lại từ Bước 1 (`POST /media/upload-intents`). |
| `MEDIA_UPLOAD_SIGNATURE_INVALID` | `422` | Sai chữ ký `signature`, `publicId` hoặc `version` khi gọi `/complete`. | Đảm bảo truyền nguyên vẹn `public_id`, `version`, `signature` từ response của Cloudinary. |
| `MEDIA_INVALID_STATE` | `409` | Gọi `/delivery` khi file chưa `READY`, hoặc gọi `DELETE` khi file đang được gắn với sản phẩm/đơn hàng hoặc chưa hết hạn lưu trữ. | Chỉ gọi `/delivery` và chỉ gắn `mediaId` vào đơn hàng sau khi Bước 3 (`/complete`) đã trả về `status: "READY"`. |
| `MEDIA_PROVIDER_ERROR` | `502` | Lỗi tạm thời khi giao tiếp với Cloudinary (`retryable: true`). | Cho phép người dùng bấm **"Thử lại"**. |

