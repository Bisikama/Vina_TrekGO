# TrekGO - Media Module Guide (Phase M0)

Tài liệu này giải thích chi tiết cấu trúc, quy trình nghiệp vụ và cách chạy/test các API thuộc Media Module trong giai đoạn M0 của dự án TrekGO.

## 1. Kiến trúc tổng quan (M0.1)
Media Module được xây dựng theo kiến trúc **Ports & Adapters (Hexagonal Architecture)** để đảm bảo không bị phụ thuộc chặt chẽ vào bất kỳ Provider nào (như Cloudinary hay AWS S3).
- **Ports (`src/modules/media/application/ports/`)**: Khai báo các interface hợp đồng cho Asset Management (`MediaAssetPort`), Storage (`MediaStoragePort`), Reference checking (`MediaReferencePort`), và Provenance (`MediaProvenancePort`).
- **Adapters (`src/modules/media/infrastructure/adapters/`)**: Chứa logic kết nối thực tế như `PrismaMediaAssetAdapter` (Giao tiếp Database) và `CloudinaryStorageAdapter` (Giao tiếp Cloudinary).

## 2. Luồng Upload Cơ Bản (M0.2)
Quy trình upload bắt buộc chia làm 2 bước để kiểm soát an ninh và giảm tải cho server:
1. **Upload Intent (`CreateUploadIntentUseCase`)**: Client gửi yêu cầu khởi tạo phiên upload (Scope, ResourceType, v.v.). Server cấp một provider signature (token) có thời hạn để client trực tiếp upload file lên Provider (Cloudinary). File lúc này nằm ở trạng thái `PENDING_UPLOAD`.
2. **Complete Upload (`CompleteUploadUseCase`)**: Sau khi client upload thành công lên Provider, client gọi báo cáo lại cho Server. Server chuyển file sang trạng thái `PROCESSING`, kéo thông tin metadata, xác thực dữ liệu qua `MediaPolicyService`, rồi chuyển thành `READY` (hoặc `REJECTED` nếu vi phạm chính sách).

## 3. Xác thực Image/Video (M0.3)
Toàn bộ chính sách (Policies) được khai báo tại `src/modules/media/application/policies/media.policy.ts` và được lấy mốc từ **môi trường (`.env`)**.
- **MIME & Formats**: Images (`jpg, jpeg, png, webp, heic, heif`), Videos (`mp4, mov, webm`).
- **Dimensions (Kích thước)**: Ràng buộc MIN/MAX (Vd: `MEDIA_IMAGE_MIN_WIDTH`, `MEDIA_IMAGE_MAX_WIDTH`) được kiểm tra dựa trên metadata do Cloudinary trả về.
- **Duration (Thời lượng video)**: Kiểm tra `metadata.durationMs` so với cấu hình `MEDIA_VIDEO_MAX_DURATION_SECONDS`.
- **Scope Match**: Đảm bảo Video không bị upload nhầm vào scope chỉ cho phép Image (VD: `RENTAL_PRODUCT`).

## 4. Phân phối Nguyên bản / Tối ưu hóa (M0.4 - Derivative Policy)
- **Private Original**: Các file bằng chứng (Evidence) phải được bảo mật nguyên bản, cài đặt ở mức `deliveryType: 'authenticated'` trong `MediaPolicyService`. Chỉ user có quyền mới lấy được file gốc.
- **Web/Mobile Variants**: `GetMediaDeliveryUseCase` hỗ trợ sinh ra các URL đã áp dụng chuyển đổi của Provider (VD: ép định dạng `.webp`, tự động nén `q_auto`, resize `w_400`). 
- Các hình ảnh sản phẩm (`RENTAL_PRODUCT`) được sử dụng public `deliveryType: 'upload'`.

## 5. Bằng chứng Hệ thống (M0.5 - Provenance)
Áp dụng cho các Scope Evidence (Tình trạng xe, Trả xe, Sự cố). Quá trình xử lý:
- Client tự khai báo `captureSource` (Camera trực tiếp hay lấy từ Thư viện) và `clientCapturedAt`.
- Server Streaming dữ liệu từ Cloudinary xuống bộ nhớ tạm để bóc tách **EXIF**, tính toán **SHA-256** và **Perceptual Hash**.
- So sánh `clientCapturedAt`, thời gian EXIF và thời gian Server nhận.
- Đưa ra nhãn kết luận `provenanceStatus` (VD: `DIRECT_CAPTURE`, `EXTERNAL_SOURCE`) và danh sách `provenanceReasons` (VD: `exif_missing`, `timeline_mismatch`).

## 6. Xóa & Dọn dẹp (M0.6 - Hard Delete / Retention)
- Không cho phép xóa vật lý dòng trong DB, mà sử dụng cơ chế đổi trạng thái `DELETED` làm tombstone (dấu vết audit).
- **Hard Delete API (`RequestMediaDeletionUseCase`)**: User (hoặc Staff) yêu cầu xóa. Kiểm tra nghiêm ngặt Reference (file còn đang được dùng ở đơn hàng/sản phẩm nào không) bằng truy vấn `array_contains: [mediaId]`. Nếu hợp lệ -> Mark `DELETE_PENDING`.
- **Background Cleanup (`MediaCleanupUseCase`)**: Một CRON job chạy ngầm sẽ tự động quét các file `DELETE_PENDING` (hoặc rác `PENDING_UPLOAD`, `REJECTED`, `READY` đã hết hạn Retention) để gửi lệnh xóa vật lý trên Cloudinary, sau đó đánh dấu `DELETED` trong DB.

## 7. Swagger & Hướng dẫn Test API (M0.7)
Module đã cung cấp API test riêng trên Swagger để giúp dev/tester upload trực tiếp file từ máy lên thẳng API mà không cần tự code luồng Intent ở Client.

### Cấu hình môi trường Test
Để gọi được API Test Upload:
1. Đảm bảo bạn chạy dự án với file `.env` đã có:
   ```env
   NODE_ENV=development
   MEDIA_DEV_UPLOAD_ENABLED=true
   ```
2. Sinh file Swagger dành cho Dev bằng lệnh:
   ```bash
   npm run openapi:generate:dev
   ```

### Chạy và Test Postman/Swagger
1. Import file `contracts/openapi/openapi.dev.json` vào công cụ test (Swagger Editor/Postman).
2. Lấy **Access Token** (thông qua API Login của Identity Module) và gắn vào Header (Bearer Auth).
3. Sử dụng Endpoint: **`POST /api/v1/dev/media/upload-test`**
   - Loại dữ liệu: `multipart/form-data`
   - Tham số:
     - `file`: Chọn file hình ảnh/video từ máy (File object).
     - `scope`: Nhập scope (VD: `RENTAL_PRODUCT`, `CONDITION_EVIDENCE`).
     - `captureSource` (Tùy chọn): VD `CAMERA`.
     - `clientCapturedAt` (Tùy chọn): VD `2026-09-30T10:00:00Z`.
4. Sau khi gọi API thành công, hệ thống Dev-Controller sẽ:
   - Thay bạn xin `Upload Intent`.
   - Trực tiếp stream file đẩy lên Cloudinary theo đúng quy định bảo mật.
   - Gọi lại `Complete Upload`.
   - Trả về Full JSON bao gồm Metadata, SHA-256, Exif và Provenance.

## 8. Hướng dẫn tích hợp Media Module cho các Domain khác (Booking, GPS, v.v.)
Module `Media` là một **Foundation Module (Module nền tảng)** được thiết kế để sử dụng chung cho toàn bộ dự án. Bất kỳ Domain nào cần tính năng tải ảnh/video đều có thể (và bắt buộc phải) gọi đến Media Module thay vì tự viết lại logic giao tiếp với Cloudinary.

Để tích hợp Media Module vào Domain mới (Ví dụ: Domain Booking muốn thêm ảnh bìa chuyến đi `TRIP_EVIDENCE`), bạn chỉ cần làm 3 bước:

### Bước 1: Định nghĩa thêm `Scope` (Phạm vi sử dụng)
1. Mở file `src/modules/media/presentation/dto/create-upload-intent.dto.ts`.
2. Thêm tên Scope mới vào Enum validation của Zod:
   ```typescript
   scope: z.enum(['RENTAL_PRODUCT', 'CONDITION_EVIDENCE', 'RETURN_EVIDENCE', 'EXCEPTION_EVIDENCE', 'TRIP_EVIDENCE'] as const)
   ```
3. Khai báo kiểu dữ liệu tương ứng trong port nếu cần (VD: `MediaScopeValue`).

### Bước 2: Cấu hình chính sách cho Scope mới
1. Mở file `src/modules/media/application/policies/media.policy.ts`.
2. Khai báo quy tắc giới hạn (Policies) cho Scope mới. Ví dụ:
   ```typescript
   TRIP_EVIDENCE: {
     allowedResourceTypes: ['IMAGE', 'VIDEO'],
     requiresProvenance: true, // Nếu cần phân tích Exif, SHA-256 để chống giả mạo
     deliveryType: 'authenticated', // Bảo mật, cần token để truy xuất
   }
   ```
   *Lưu ý: Nếu chỉ là ảnh Thumbnail public thì để `deliveryType: 'upload'` và `requiresProvenance: false`.*

### Bước 3: Domain lưu trữ ID liên kết
Trong Database của Domain mới (Ví dụ bảng `Trip`), bạn chỉ cần tạo cột kiểu chuỗi (hoặc UUID) để lưu lại giá trị `mediaId`.
- **Luồng Client:** Client gọi API của `Media` -> Lấy được `mediaId` -> Client gọi API `CreateTrip` của Domain Booking truyền kèm `coverMediaId: mediaId`.
- **Luồng Server:** Module Booking chỉ lưu ID. Khi cần hiển thị, Client sẽ gọi API `GET /api/v1/media/{mediaId}/delivery` của module Media để lấy URL hiển thị (Media module sẽ tự xử lý cấp token xem ảnh bảo mật nếu cần). Hai Domain hoàn toàn độc lập và giao tiếp lỏng lẻo thông qua `mediaId`.

---
**TrekGO Media Architecture v1.0 - VinaTrek Project.**
