# Kiểm tra backend Vina TrekGo — 31/10/2026

## Phạm vi và giới hạn

Đối chiếu source tại commit `a5f6973` và trạng thái workspace khi bắt đầu kiểm tra. Đây là báo cáo kiểm tra rủi ro ưu tiên, không phải chứng nhận toàn bộ backend đúng hoặc đủ điều kiện production. Các module chưa được kiểm tra chi tiết từng endpoint; chưa kiểm thử tích hợp với PostgreSQL test, MongoDB, Supabase, Cloudinary, Gemini, Firecrawl hoặc provider thanh toán thật. Không thay đổi code nghiệp vụ và không áp dụng migration.

## Phát hiện cần ưu tiên

### 1. Cao — WebSocket thông báo cho phép kết nối và phát thông điệp không xác thực

- `api/src/websockets/websocket.adapter.ts`: middleware mặc định chỉ ghi log rồi gọi `next()`; chưa kiểm tra danh tính.
- `api/src/websockets/notification.gateway.ts`: client gửi `send-notifications` khiến server phát `receive-notifications` cho toàn namespace. Gateway được đăng ký trong `websocket.module.ts`.
- Tác động nhìn thấy trong code: client có thể gửi thông điệp tuỳ ý cho các client kết nối namespace; chưa có bằng chứng từ các file này về việc lộ notification cá nhân trong database. `/gps` có middleware xác thực riêng và không nên được đồng nhất với namespace này.
- Khuyến nghị: xác thực handshake, phân quyền sự kiện và dùng room theo user; cân nhắc bỏ event demo nếu không có nhu cầu sản phẩm. Kiểm thử kết nối và phát từ client không được phép.

### 2. Cao — Thông báo cũ có thể không bao giờ được gửi

- `api/src/modules/notifications/consumers/notification-outbox-drain.ts` chỉ quét event mới hơn 3 ngày, kể cả event chưa gửi. Sau sự cố hoặc tắt consumer lâu hơn 3 ngày, event cũ không được chọn lại.
- Migration `20261031090000_notification_receipts` đánh dấu các event thuộc danh sách sẵn có là đã xử lý. Migration `20261031100000_notification_receipts_followup` chỉ bỏ đánh dấu các event trong khoảng 1 giờ gần trước migration đầu; event cũ hơn chưa từng được gửi vẫn có thể bị bỏ qua.
- Điều này ảnh hưởng thông báo huỷ, kết quả hoàn tiền và các sự kiện khác; không chứng minh giao dịch hoàn tiền thất bại. Cần kiểm kê event chưa gửi và quyết định replay/đối soát theo loại thông báo trước triển khai; không tự sửa migration đã áp.

### 3. Cao — Chưa đủ chứng cứ đáp ứng yêu cầu thông báo Rental

- `api/docs/NOTIFICATIONS_HANDOFF.md` nêu email tiền/cọc chưa làm, Trip công khai đổi lịch chưa có event thông báo riêng cho mọi người tham gia và khách tự huỷ đơn thuê chưa có thông báo xác nhận.
- `api/src/modules/notifications/consumers/rental-notification.projection.ts` gửi thiếu hàng do hạ hạng cho staff; khách chỉ nhận ở bước huỷ do lỗi hệ thống. Business Flow yêu cầu thông báo USER trước giờ hẹn trong tình huống xác định không phục vụ được. Cần PO/BA chốt lúc xác định không phục vụ được và rà soát hành vi trước giờ hẹn.
- Policy RB-POL-20 yêu cầu thông báo trong ứng dụng, email cho sự kiện tiền/cọc, retry tối đa 5 lần trong 24 giờ và chống trùng. Code retry rental/payment hiện có quy tắc khác; cần đối chiếu, quyết định và kiểm thử.

### 4. Trung bình — Catalog có thể hiển thị cọc khác báo giá

- `api/src/modules/rental/catalog/infrastructure/adapters/prisma-rental-product.adapter.ts` giữ `depositPolicy.amount` cũ, tính phần trăm bằng phép chia số thực; `depositPerUnit` dùng quy tắc làm tròn về VND nguyên của quote. Ví dụ giá trị thay thế 10đ và tỷ lệ 33,33%: field cũ cho 3,333đ, cọc báo giá/field mới là 3đ.
- DTO tạo sản phẩm cho phép giá và giá trị cọc dạng số thập phân nhưng `parseWholeVnd` trong quote yêu cầu VND nguyên. Cần kiểm tra dữ liệu cũ và thống nhất validation/contract, tránh tự làm tròn dữ liệu đã lưu. FE dùng field mới để giải thích, báo giá là giá chính thức.

### 5. Trung bình — CORS rộng và xác thực HTTP mặc định mở

- `api/src/main.ts` phản chiếu origin bất kỳ cùng `credentials: true`. Đánh giá theo phương thức xác thực/cookie và cấu hình triển khai trước khi kết luận có thể khai thác; dùng allowlist phù hợp môi trường.
- `api/src/shared/guards/authentication.guard.ts` mặc định `AuthType.None` nếu endpoint không khai báo. Dễ vô tình công khai endpoint mới; cần rà soát toàn bộ route và thêm kiểm thử quyền, tránh đổi mặc định một cách phá vỡ API public.

### 6. Trung bình — Cảnh báo thiếu hàng có thể được ghi sau khi trạng thái đơn đã đổi

- `api/src/modules/rental/inventory/infrastructure/equipment-grade-transfer.ts`: `updateMany` kiểm lại trạng thái đơn nhưng code vẫn ghi outbox và trả orderId sau đó mà không xét số dòng đã cập nhật. Trường hợp đơn vừa bàn giao/hủy hoặc đã ACTION_REQUIRED có thể tạo cảnh báo dựa trên dữ liệu đọc trước đó. Cần test đồng thời và xác định điều kiện phát event mong muốn; chưa kiểm chứng bằng PostgreSQL.

## Luồng hoạt động chính

1. API NestJS có prefix `/api/v1`, filter lỗi chung, Swagger và guard auth/role; PostgreSQL qua Prisma, MongoDB lưu thông báo.
2. Booking/Trip xác thực người dùng, quản lý tư cách tham gia, trạng thái và sự kiện lifecycle. Hủy Trip tạo event để các worker xử lý Booking và Rental.
3. Rental tạo quote từ Trip context, availability và giá từng sản phẩm; quote chưa giữ tồn. Khi tạo đơn, dùng snapshot và giữ số lượng theo khoảng thời gian. Sau thanh toán mới chuẩn bị và giao unit.
4. Payment xử lý provider callback qua inbox/outbox và cập nhật payment/refund. Việc xác nhận refund phụ thuộc trạng thái provider; sandbox có đánh dấu mô phỏng.
5. Trả đồ qua thu hồi, kiểm định FINAL, quyết toán từng món, xử lý refund và sau đó đóng đơn khi điều kiện trạng thái/cọc/custody đủ. Hạ hạng unit là quyết định riêng, không trực tiếp trừ cọc.
6. Gear đánh giá theo quy tắc, tạo các phương án thuê ước tính. Gemini chọn từ nhận định đã được server duyệt; nếu không dùng được AI thì có thể fallback. Trích xuất link cần Firecrawl và HTTPS công khai; ảnh cần đọc từ Cloudinary.
7. Consumer thông báo đọc outbox và ghi MongoDB; delivery key giúp chống gửi trùng, receipt theo consumer theo dõi lần gửi và retry.

## Kết quả kiểm thử và bước tiếp theo

- `npm.cmd run build`: PASS.
- `npm.cmd test -- --runInBand --testPathIgnorePatterns='\.pg\.spec\.ts$'`: 68 suite, 833 test PASS; 3 suite, 82 test skipped. Đã chủ động loại test PostgreSQL, nên không gọi đây là test toàn bộ.
- Lần chạy `npm test` trước đó: FAIL do không kết nối PostgreSQL test tại `localhost:5433`; 12 test fail, 833 test pass, 83 test skipped. Cần chạy lại trên database test riêng có migration và seed thích hợp.
- Test thông báo/hạ hạng/lifecycle riêng: 91 PASS; test Gear liên quan: 52 PASS.
- Cần rà soát phần còn lại theo từng module và hợp đồng API, xác minh auth/quyền dữ liệu, test giao dịch/concurrency trên PostgreSQL riêng, kiểm thử thực tế các provider, lịch worker, migration và thông báo end-to-end. Không suy ra trạng thái deploy từ source.
