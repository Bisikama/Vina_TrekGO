# BASELINE AUDIT BÁO CÁO ĐỢT 0 — VINA_TREKGO (AREA B)

## 1. Hiện trạng Code Phase 00–04
Thông qua việc kiểm tra cấu trúc thư mục, `package.json`, `prisma/schema.prisma` và các module, hiện trạng source code Phase 00-04 trong repository thực tế đã được xác nhận:
- **Phase 00 & Phase 01 (Foundation & Catalog)**: Đã triển khai. Cấu trúc Hexagonal Architecture được áp dụng (ví dụ: `src/modules/rental/inventory` có các thư mục `application`, `infrastructure`, `presentation`).
- **Phase 02 (Inventory)**: Model `InventoryLocation`, `EquipmentUnit`, `InventoryTask`, `DeliveryTask` đều có mặt trong Prisma schema. Có dấu hiệu tồn tại của các tên chưa thống nhất như `warehouse.error-codes.ts` và `logistics.error-codes.ts` trong `src/shared/errors/codes`.
- **Phase 03 (Ordering)**: Thư mục `src/modules/rental/ordering` có tồn tại. Models như `RentalOrder`, `RentalQuote`, `RentalOrderLine` có mặt trong schema.
- **Phase 04 (Payment)**: Tồn tại module shared payment tại `src/modules/payments` (chứa provider, worker, controller) và module tích hợp rental payment tại `src/modules/rental/payments` (chứa `rental-checkout.service.ts`, `rental-payment.consumer.ts`, `rental-deposit.worker.ts`).

**Kết luận:** Code của Phase 00–04 ĐÃ CÓ trong repository thực tế. Chúng tuân thủ cấu trúc NestJS với Prisma ORM, và đang sử dụng database PostgreSQL.

## 2. Hiện trạng Test
- **Framework**: Dự án đã được cấu hình với **Jest**. Có nhiều file cấu hình test riêng biệt trong thư mục `test/`: `jest-cf01.json`, `jest-cf02.json`, `jest-payments.json`, v.v.
- **Test Files**: Tồn tại nhiều file spec: `cf01.http.spec.ts`, `cf01.integration.spec.ts`, `cf02.spec.ts`, `cf03.spec.ts`, `cf04.spec.ts`, `payments.spec.ts`.
- **Thực trạng**: 
  - File `test/payments.spec.ts` có kích thước rất lớn (~93KB) và đang chứa **hàng loạt lỗi TypeScript** (Type mismatch, missing properties).
  - Test E2E/HTTP cho CF01 chạy thành công (Pass `cf01.http.spec.ts`).

## 3. Baseline Build/Test PASS/FAIL/BLOCKED
Qua các lệnh kiểm tra baseline trên môi trường hiện tại, kết quả như sau:

- **npm install**: `PASS` (Cài đặt dependencies thành công, dù có vài cảnh báo peer dependency).
- **Prisma Validate (`npx prisma@6 validate`)**: `PASS` (Schema hợp lệ).
- **NestJS Build (`npm run build`)**: `PASS` (Quá trình compile NestJS bằng tsc/webpack build nội bộ thành công).
- **TypeScript Typecheck (`npx tsc --noEmit`)**: `FAIL`. Lỗi tập trung chính ở file `test/payments.spec.ts` do truyền sai các object DTO/Prisma Input, các trường như `plannedHandoverAt`, `plannedReturnAt` bị thiếu.
- **Unit/Integration/E2E Tests (`npm run test`)**: `FAIL/BLOCKED` một phần.
  - Lệnh test của CF01 (`npx jest --config ./test/jest-cf01.json`) chạy `PASS` đối với HTTP spec.
  - Tuy nhiên, do lỗi Typecheck, không thể đảm bảo toàn bộ hệ thống test (đặc biệt là test của payments) có thể chạy thành công mà không sửa code test.

## 4. Các lỗi được xác nhận
- File `test/payments.spec.ts` không hợp lệ về mặt TypeScript (lỗi Type error P1012, missing property `plannedHandoverAt`, `occupiedStartAt`).
- Naming convention chưa thống nhất giữa `warehouse`, `logistics` và các tên chuẩn mới mong muốn (`preparation`, `inventory`, `delivery`, `returns`). Lỗi code error vẫn đang sử dụng file `warehouse.error-codes.ts` và `logistics.error-codes.ts`.

## 5. Các lỗi nghi ngờ cần test (Đang chờ Test chạy)
Do chưa thể chạy Full Test cho Area B, các điểm nghi ngờ sau (như Business Rules đề ra) vẫn cần được test chuyên sâu:
- Overbooking (Giữ quantity trong 15 phút, optimistic locking `expectedVersion`).
- InvoiceLine và Payment Extension mismatch.
- Webhook duplicate/timeout handling của Payment.
- Transactional all-or-nothing (đặc biệt khi xử lý PaymentAllocation và Refund).
- Vấn đề tạo 2 active RentalOrder cho cùng 1 user + trip.

## 6. Những module/dependency thiếu
- Test infrastructure hiện tại có vẻ dựa nhiều vào Testcontainers hoặc mock db, nhưng nếu chạy database integration test (với PostgreSQL TEST db) thì có thể đang thiếu cấu hình `.env.test` rõ ràng (hiện tại test HTTP đang inject biến từ `.env`). Cần tách bạch PostgreSQL TEST và môi trường dev.

## 7. Kế hoạch cụ thể để kiểm thử Phase 00–02 ở Đợt tiếp theo
- **Sửa lỗi TypeScript**: Chỉnh sửa mock data và các DTO type trong file test (`test/payments.spec.ts` và các file test liên quan) để `npx tsc --noEmit` pass toàn bộ dự án.
- **Tạo Database Test an toàn**: Xác nhận sự hiện diện của biến môi trường Test Database, cấu hình lại Prisma Service trong test để trỏ vào Test DB (không dùng Production DB).
- **Chạy & Báo Cáo Test Phase 00-02**: Viết hoặc cập nhật Unit Test và Integration Test cho Catalog, Inventory (Optimistic Locking, Capacity Calculation). Báo cáo các lỗi nghiệp vụ được phát hiện, chờ duyệt trước khi fix.
