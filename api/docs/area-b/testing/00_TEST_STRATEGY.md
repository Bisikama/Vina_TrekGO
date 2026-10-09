# CHIẾN LƯỢC KIỂM THỬ (TEST STRATEGY) — VINA_TREKGO AREA B

## 1. Mục tiêu
Chiến lược này nhằm đảm bảo tính ổn định, chính xác và toàn vẹn dữ liệu cho các Phase 00–04 thuộc Area B (Inventory, Ordering, Payment) của hệ thống Vina_TrekGo trước khi tiếp tục phát triển các Phase 05–11. 

## 2. Phân loại Kiểm thử (Test Types)
Hệ thống sử dụng **Jest** làm test runner chính. Các loại kiểm thử được áp dụng bao gồm:

### 2.1. Unit Test
- **Mục tiêu**: Kiểm tra các business rules cốt lõi, validation, tính toán (calculation), chuyển đổi trạng thái (state transition) và service logic độc lập.
- **Phạm vi**: 
  - Domain Entities / Models.
  - Các hàm tính toán số lượng tồn kho (Capacity calculation).
  - Validation rules trong Services.
- **Yêu cầu kỹ thuật**:
  - Mock các Port (Interfaces) hoặc Repository (chỉ mock trong Unit Test).
  - Đảm bảo thực thi nhanh.
  - Không kết nối đến Database.

### 2.2. Integration Test
- **Mục tiêu**: Kiểm tra sự tương tác giữa Application Services và Database (Prisma). Xác minh các ràng buộc cơ sở dữ liệu (Unique constraint, Foreign key), concurrency control và persistence.
- **Phạm vi**:
  - Transaction (all-or-nothing rollback).
  - Optimistic Locking (dùng trường `version` / `expectedVersion`).
  - Concurrent operations (VD: Đặt hàng cùng lúc).
  - Idempotency.
- **Yêu cầu kỹ thuật**:
  - Tuyệt đối **KHÔNG** mock Prisma Repository.
  - Sử dụng **PostgreSQL TEST** thực (không dùng SQLite để đảm bảo hành vi locking và partial index giống môi trường thật).
  - Khởi tạo và dọn dẹp dữ liệu (Tear-down) sau mỗi test case hoặc test suite.

### 2.3. E2E Test (End-to-End)
- **Mục tiêu**: Kiểm tra luồng request HTTP xuyên suốt từ Controller xuống Database, thông qua các NestJS module, Auth Guards và Interceptors.
- **Phạm vi**:
  - API Contracts (Request/Response format).
  - RBAC (Role-Based Access Control - xác minh quyền hạn).
  - Luồng tích hợp (Ví dụ: Ordering -> Webhook Payment).
- **Yêu cầu kỹ thuật**:
  - Sử dụng Supertest kết hợp với Jest.
  - Giả lập các callback (webhook) đúng với contract của payment provider.

## 3. Quản lý Môi trường Kiểm thử
- **Tuyệt đối KHÔNG sử dụng Production Database.**
- Các integration/E2E test phải chạy trên database có connection string từ biến môi trường `DATABASE_URL` dành riêng cho test (ví dụ `.env.test`).
- Phải có cơ chế tự động clear DB (chạy Prisma db push hoặc truncate) trước/sau khi chạy Test Suite mà không làm ảnh hưởng đến dữ liệu phát triển.
- **Credential thực tế**: Không được lưu credential (như API Key thực, mật khẩu thực) trong các file test. Dùng mock webhook handler cho Payment.

## 4. Trọng tâm ưu tiên (P0)
- **Overbooking**: Xử lý locking tồn kho đúng lúc, không cho phép cấp vượt quá sức chứa.
- **Invoice Mismatch**: Tiền thanh toán và hóa đơn phải khớp.
- **Duplicate Webhook / Late Webhook**: Phải xử lý idempotency, không nạp tiền hai lần.
- **Double Refund**: Không cho phép hoàn tiền hai lần.
- **Data Integrity**: Bảo toàn transaction boundary, dữ liệu phải nhất quán nếu xảy ra lỗi giữa chừng (Transaction rollback).
- **Authorization Bypass**: Đảm bảo user không thể thao tác trên đơn hàng của người khác.

## 5. Quy trình thực thi Test theo Đợt
- **Đợt 1**: Cấu hình Test Infrastructure, sửa lỗi TypeScript và chạy Unit/Integration cho Phase 00–02.
- **Đợt 2**: Viết/Chạy Test cho Phase 03 (Ordering) bao gồm concurrency và quote ttl.
- **Đợt 3**: Viết/Chạy Test cho Phase 04 (Payment) bao gồm webhook và idempotency.
