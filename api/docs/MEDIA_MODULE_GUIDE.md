# TrekGO - Media Module Guide (Phase M0)

Tài liệu này giải thích chi tiết cấu trúc, quy trình nghiệp vụ, mục đích sử dụng và cách chạy/test các API thuộc Media Module trong giai đoạn M0 của dự án TrekGO.

## 0. Vai trò & Cách sử dụng Module (Dành cho Developer)
Thư mục `media` đóng vai trò là **module trung tâm quản lý mọi file tĩnh (ảnh, video)** của toàn bộ dự án.

**Tại sao lại có module này?**
- **Tránh lặp code:** Mọi logic kết nối Cloudinary, bảo mật file, dọn dẹp rác đều được viết tập trung tại đây. Các module khác không cần phải tự xử lý file cồng kềnh.
- **Tối ưu hiệu năng Server:** Áp dụng cơ chế **Direct Upload**. Server Backend không trực tiếp nhận file (giúp tránh nghẽn băng thông và sập server). Thay vào đó, Server chỉ cấp một URL Ủy Quyền (Signed URL), Frontend sẽ lấy URL này để đẩy file thẳng lên Cloud.

**Cách Backend lưu trữ dữ liệu liên quan đến Media:**
Các module Backend khác (như `rental`, `user`, `trail`) **không cần gọi API HTTP của module media**. Quy trình tích hợp chuẩn như sau:
1. **Frontend -> Media API:** Client tự gọi API của module Media để upload file, sau khi thành công sẽ nhận lại một mã định danh (Ví dụ: `asset_123`).
2. **Frontend -> Rental/User API:** Client gọi API tạo dữ liệu mới (ví dụ tạo sản phẩm) kèm theo mã ID của ảnh (Ví dụ: `{ "name": "Lều cắm trại", "imageAssetId": "asset_123" }`).
3. **Lưu trữ:** Module Backend của nghiệp vụ đó (VD: `rental`) chỉ việc lấy chuỗi `asset_123` lưu vào Database. Việc bảo vệ đường dẫn, dọn dẹp ảnh rác hay thay đổi kích thước ảnh... module Media sẽ quản lý tất cả.

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

---
**TrekGO Media Architecture v1.0 - VinaTrek Project.**
