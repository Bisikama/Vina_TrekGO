# Tổng Hợp Lệnh Prisma CLI Cơ Bản

## 1. Khởi tạo & Định dạng code (Setup & Formatting)

* **`npx prisma init`**: Khởi tạo cấu hình Prisma trong một dự án mới. Lệnh này tự động tạo thư mục `prisma`, file `schema.prisma` và file `.env` chứa chuỗi kết nối database (như PostgreSQL hoặc MongoDB).
* **`npx prisma format`**: Tự động căn chỉnh và format lại code trong file `schema.prisma` cho chuẩn syntax và dễ nhìn.
* **`npx prisma validate`**: Xác thực tính hợp lệ của cấu trúc trong `schema.prisma`. Nên chạy để kiểm tra lỗi cú pháp trước khi thực thi các thao tác can thiệp vào database.

---

## 2. Đồng bộ Database & Schema (Database Sync)

*Nhóm lệnh này quyết định cách cấu trúc bạn định nghĩa trong file `schema.prisma` được áp dụng vào database thực tế.*

* **`npx prisma db push`**: Đẩy trực tiếp định nghĩa schema hiện tại vào database mà **không** tạo ra file lịch sử (migration files).
  * *Khi nào dùng:* Rất lý tưởng trong giai đoạn đầu thiết kế tính năng (prototyping) khi bạn cần thay đổi cấu trúc bảng liên tục.
  * *Lưu ý:* Có thể gây mất dữ liệu (data loss) nếu bạn xóa cột hoặc thay đổi kiểu dữ liệu quan trọng.
* **`npx prisma db pull`**: Kéo (introspect) cấu trúc từ một database đã có sẵn và tự động viết ngược lại thành code vào file `schema.prisma`.
* **`npx prisma migrate dev`**: So sánh schema hiện tại với database, tự động tạo ra một file kịch bản lịch sử (`.sql`) và chạy file đó để cập nhật database. Dùng khi cấu trúc database đã tương đối ổn định và cần theo dõi lịch sử thay đổi trong team.
* **`npx prisma migrate deploy`**: Chạy tất cả các file migration chưa được thực thi lên database. Lệnh này không can thiệp vào file schema, dành riêng cho môi trường CI/CD hoặc Production.
* **`npx prisma migrate reset`**: Xóa toàn bộ database hiện tại, tạo lại từ đầu, chạy tất cả các file migrations và tự động kích hoạt script nạp dữ liệu mẫu. Hữu ích khi môi trường dev bị lỗi data nghiêm trọng cần làm mới hoàn toàn.

---

## 3. Tạo Client & Thao tác dữ liệu (Client & Utilities)

* **`npx prisma generate`**: Đọc cấu trúc `schema.prisma` và sinh ra thư viện Prisma Client (thường lưu ngầm ở `node_modules/.prisma/client`).
  * *Khi nào dùng:* **Bắt buộc phải chạy lại lệnh này** mỗi khi bạn có bất kỳ thay đổi nào trong file schema. Nó giúp các trình soạn thảo (như Cursor, VS Code) cập nhật tính năng tự động gợi ý code (IntelliSense) và kiểm tra chặt chẽ kiểu dữ liệu cho TypeScript.
* **`npx prisma studio`**: Khởi chạy một trình duyệt web (mặc định tại `localhost:5555`) cung cấp giao diện quản trị (GUI) trực quan. Giúp bạn xem, thêm, sửa, xóa dữ liệu trực tiếp trong database mà không cần cài thêm các công cụ quản lý CSDL bên ngoài.
* **`npx prisma db seed`**: Thực thi kịch bản đẩy dữ liệu mẫu ban đầu vào database (cần khai báo đường dẫn tới file seed trong `package.json` trước).