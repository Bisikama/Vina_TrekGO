# Seed demo Gear Advisor

Seed dành cho PostgreSQL của TrekGo đã áp dụng các migration tương ứng với phiên bản mã nguồn và đã chạy `prisma generate`. Không có seed nào bảo đảm chạy được trên mọi database hoặc schema cũ. Kiểm tra `DIRECT_URL` và `DATABASE_URL` trong cấu hình API: script ưu tiên `DIRECT_URL` khi có, nếu không dùng `DATABASE_URL`. Chỉ trỏ tới database được phép thêm dữ liệu demo.

Trong thư mục `api`, chọn một tài khoản `ACTIVE` đã tồn tại và chạy:

```powershell
npm run seed:gear-demo -- --userId=<UUID_USER> --tripId=<UUID_TRIP>
```

Có thể bỏ `--tripId` để chỉ tạo tủ đồ và các quy tắc còn thiếu. Khi cung cấp `--tripId`, script kiểm tra trước bằng chính logic của API: chuyến chưa kết thúc hoặc bị hủy, người dùng có quyền truy cập, có thông tin độ khó và địa hình hợp lệ. Chọn chuyến phù hợp sẵn trong hệ thống; script không tạo hoặc sửa chuyến, tuyến hay thành viên. Lỗi kiểm tra làm script dừng trước khi ghi.

Seed thêm các quy tắc chuẩn còn thiếu và các món có tiền tố `[DEMO]` cho đúng tài khoản. Chạy lại bỏ qua các món đã có cùng tên, không cập nhật món đã sửa. Nếu quy tắc hiện có không tương thích hoặc có quy tắc lạ đang bật, script báo lỗi để kiểm tra cấu hình; không tự ghi đè. Không chạy hai tiến trình seed cùng lúc cho cùng tài khoản vì tên món không có ràng buộc duy nhất trong database.

Sau khi đăng nhập đúng tài khoản, chọn chuyến rồi chọn đồ trong tủ. Có món đủ thông số, món có thông số yếu và giày thiếu thông số để thử luồng bổ sung thông tin. Kết luận phụ thuộc địa hình, số ngày và khí hậu **người dùng xác nhận**, nên tên món không bảo đảm kết quả cố định. Ví dụ, để thấy cảnh báo chống mưa, có thể xác nhận xác suất mưa 60% trong kịch bản demo; chỉ sử dụng dữ kiện này như dữ liệu thử nghiệm.

Seed không tạo hàng tồn, sản phẩm thuê, hồ sơ kỹ thuật sản phẩm, tài khoản, chuyến đi, dự báo thời tiết hay khóa AI. Để demo gợi ý thuê cần catalog, hồ sơ kỹ thuật và tồn kho khả dụng đã được cấu hình riêng. Để demo trích xuất ảnh/link bằng AI cần cấu hình và dịch vụ tương ứng; kiểm tra `GET /api/v1/gear/capabilities` và quota. Không mặc định chạy seed hồ sơ kỹ thuật cho toàn bộ sản phẩm vì script đó có thể ghi đè thông số hiện có.
