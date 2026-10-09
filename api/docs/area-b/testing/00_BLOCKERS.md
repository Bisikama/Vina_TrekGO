# BLOCKERS VÀ RISKS — VINA_TREKGO AREA B

## 1. Blockers (Cản trở tiến độ)

- **Lỗi TypeScript ở Phase 04 (`test/payments.spec.ts`)**: 
  - Lỗi TypeScript nghiêm trọng (hơn 40 lỗi type mismatch) khiến lệnh `npm run test` tổng thể (hoặc test payment) và quá trình CI/CD typecheck thất bại.
  - Các mock data truyền vào không khớp với kiểu `*UncheckedCreateInput` của Prisma sinh ra (thiếu `plannedHandoverAt`, `occupiedStartAt`, v.v.).
  - **Giải pháp**: Cần một đợt (sắp tới) để audit và sửa mock data trong các file test bị lỗi.

- **Thiếu DB Environment chuyên biệt cho Integration Test**:
  - Không có thiết lập rõ ràng cho PostgreSQL Test Database (như Testcontainers hay config cấp phát DB độc lập trong `.env.test`).
  - Prisma validation ban đầu báo lỗi do `url = env("DATABASE_URL")` bị deprecated trong Prisma 6/7, tuy đã bypass bằng `npx prisma@6` nhưng nếu chạy integration test với database, chúng ta có nguy cơ ghi đè dữ liệu phát triển hoặc production nếu không cô lập `DATABASE_URL`.
  - **Giải pháp**: Cấu hình cơ chế sử dụng schema `test` hoặc tạo DB `trekiing_test`, cùng script reset database an toàn cho Test Suite.

## 2. Risks (Rủi ro tiềm ẩn)

- **Rủi ro Đồng bộ Dữ liệu Tồn Kho (Concurrency / Optimistic Locking)**:
  - Nếu Unit/Integration test về optimistic locking (`version`/`expectedVersion`) chưa được triển khai hoàn chỉnh, hệ thống sẽ gặp rủi ro Overbooking ở môi trường thật, đặc biệt trong các event có lượng truy cập lớn (ví dụ: tạo 10 Order cùng lúc cho 1 sản phẩm chỉ còn 5 chiếc).

- **Rủi ro Dữ Liệu khi Sửa Đổi Cấu Trúc Lỗi**:
  - Việc đổi tên/dọn dẹp `warehouse.error-codes.ts` và `logistics.error-codes.ts` có thể làm ảnh hưởng client.
  - Theo luật "giữ hợp đồng Global Error Filter", client bắt lỗi bằng mã. Nếu ta đổi mã lỗi (Error Code String), các xử lý phía client sẽ bị hỏng.
  - **Khắc phục**: Khi chuyển đổi, giữ nguyên mã HTTP Status Code và Mã String, chỉ đổi đường dẫn file nội bộ và class.

- **Rủi ro về Payment Provider Sync**:
  - Thời điểm provider xác nhận giao dịch có thể diễn ra trước hoặc sau khi worker xử lý sự kiện trong database.
  - Chưa rõ liệu Job queue (ví dụ BullMQ) đã được thiết lập chặt chẽ cho Idempotency hay chưa.
  - Cần viết test case E2E giả lập webhook đến muộn (Late Webhook) và webhook lặp lại (Duplicate Webhook).

