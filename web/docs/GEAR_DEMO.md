# Seed demo Gear Advisor

Để chuẩn bị chuyến booking demo, chạy trong `api`:

```powershell
npm run seed:booking-all -- --config=prisma/seeds/data/booking-demo.local.json
```

Lệnh nạp cung hệ thống `HBS_COKIEU_LABAN` từ `prisma/seeds/data/destination-nui-dinh.seed.json` trước khi tạo chuyến. GeoJSON của cung có `terrain: ["mountain", "rocky"]` làm dữ kiện cho kịch bản demo; đây là dữ liệu mẫu cần được người quản lý cung xác minh trước khi sử dụng thực tế. Các chuyến mới chọn cung sau khi nạp sẽ lưu GeoJSON và độ khó vào snapshot. Cung khác trong cấu hình cũng cần có địa hình riêng để dùng Gear Advisor. Chuyến đã tạo trước đó không tự cập nhật snapshot.

**Lưu ý khi chạy lại:** `seed:booking-all` ghi đè các trường của cung Núi Dinh và thay thế checkpoint của cung theo dữ liệu seed; nó cũng thay thế các chuyến demo thuộc batch, bao gồm thay đổi đã thực hiện trên các chuyến đó. Kiểm tra dữ liệu và dừng API/background workers theo cấu hình trước khi chạy. Không dùng lệnh này trên database có dữ liệu cần giữ lại nếu chưa đánh giá tác động. Script tăng phiên bản cung khi GeoJSON thay đổi.

Seed dành cho PostgreSQL của TrekGo đã áp dụng các migration tương ứng với phiên bản mã nguồn và đã chạy `prisma generate`. Không có seed nào bảo đảm chạy được trên mọi database hoặc schema cũ. Kiểm tra `DIRECT_URL` và `DATABASE_URL` trong cấu hình API: script ưu tiên `DIRECT_URL` khi có, nếu không dùng `DATABASE_URL`. Chỉ trỏ tới database được phép thêm dữ liệu demo.

Trong thư mục `api`, chọn một tài khoản `ACTIVE` đã tồn tại và chạy:

```powershell
npm run seed:gear-demo -- --userId=<UUID_USER> --tripId=<UUID_TRIP>
```

Có thể bỏ `--tripId` để chỉ tạo tủ đồ và các quy tắc còn thiếu. Khi cung cấp `--tripId`, script kiểm tra trước bằng chính logic của API: chuyến chưa kết thúc hoặc bị hủy, người dùng có quyền truy cập, có thông tin độ khó và địa hình hợp lệ. Chọn chuyến phù hợp sẵn trong hệ thống; script không tạo hoặc sửa chuyến, tuyến hay thành viên. Lỗi kiểm tra làm script dừng trước khi ghi.

Seed thêm các quy tắc chuẩn còn thiếu và các món mẫu cho đúng tài khoản, không thêm tiền tố vào tên. Chạy lại bỏ qua món có cùng tên hoặc tên cũ có tiền tố `[DEMO]`, không đổi tên hay cập nhật món đã sửa. Các món cũ có tiền tố hoặc đã trùng vẫn giữ nguyên; xóa hoặc đổi tên qua tủ đồ nếu cần. Nếu quy tắc hiện có không tương thích hoặc có quy tắc lạ đang bật, script báo lỗi để kiểm tra cấu hình; không tự ghi đè. Không chạy hai tiến trình seed cùng lúc cho cùng tài khoản vì tên món không có ràng buộc duy nhất trong database.

Sau khi đăng nhập đúng tài khoản, chọn chuyến rồi chọn đồ trong tủ. Có món đủ thông số, món có thông số yếu và giày thiếu thông số để thử luồng bổ sung thông tin. Kết luận phụ thuộc địa hình, số ngày và khí hậu **người dùng xác nhận**, nên tên món không bảo đảm kết quả cố định. Ví dụ, để thấy cảnh báo chống mưa, có thể xác nhận xác suất mưa 60% trong kịch bản demo; chỉ sử dụng dữ kiện này như dữ liệu thử nghiệm.

Seed không tạo hàng tồn, sản phẩm thuê, hồ sơ kỹ thuật sản phẩm, tài khoản, chuyến đi, dự báo thời tiết hay khóa AI. Để demo gợi ý thuê cần catalog, hồ sơ kỹ thuật và tồn kho khả dụng đã được cấu hình riêng. Để demo trích xuất ảnh/link bằng AI cần cấu hình và dịch vụ tương ứng; kiểm tra `GET /api/v1/gear/capabilities` và quota. Không mặc định chạy seed hồ sơ kỹ thuật cho toàn bộ sản phẩm vì script đó có thể ghi đè thông số hiện có.

Để thử hai phương án khác nhau trên database local, `npm run seed:local-rental-products` tạo catalog, unit và hồ sơ kỹ thuật: `PACK-003-GU` là balo 20L 750 g giá 37.000đ/ngày và `PACK-004-GU` là balo 20L 600 g giá 60.000đ/ngày. Cần còn tồn khả dụng, chuyến có yêu cầu balo phù hợp, chưa được đồ cá nhân đáp ứng, ngân sách đủ và cả hai sản phẩm nằm trong tập ứng viên. Tạo lại phương án để lấy dữ liệu mới. Đây là thông số mẫu, không phải cam kết về sản phẩm thực. **Lệnh này ghi đè sản phẩm và hồ sơ seed, đồng thời có thể vô hiệu hóa sản phẩm ngoài seed trên database local**; kiểm tra dữ liệu trước khi chạy.
