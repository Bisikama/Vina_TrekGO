# CF01: demo trekking gần TP.HCM

Chạy từ thư mục `api`. Seed độc lập này không gọi seed tổng, không tạo/sửa user
và không tạo sẵn trip. Cần database đã áp dụng migrations của dự án.

```powershell
# Kiểm tra catalog và thứ tự route, không kết nối database
npm run seed:cf01-local -- --validate-only

# Kiểm tra tài khoản, dữ liệu trùng/xung đột; không ghi database
npm run seed:cf01-local -- --dry-run --actor-user-id=USER_UUID

# Tạo dữ liệu
npm run seed:cf01-local -- --actor-user-id=USER_UUID
```

Thay `USER_UUID` bằng `users.id` của tài khoản `LEADER ACTIVE`, không phải
Supabase `authUserId`. Nếu chỉ có một leader active, có thể bỏ tham số này.
Các lệnh dùng cấu hình database của API trong môi trường / `.env`.

## Nội dung

- Hai destination riêng có tiền tố `[DEMO CF01]`: Bà Đen và Chứa Chan.
- Mỗi destination có 1 pickup, 4 checkpoint A/B/C/D và 2 System Trail:
  chặng 1 đi A → B → C, chặng 2 đi C → D.
- Tổng cộng 2 destinations, 2 pickups, 8 checkpoints, 4 trails và 10 quan hệ
  TrailCheckpoint có sequence liên tục. Catalog đều ACTIVE, trail có giá 0.
- Tất cả tọa độ, GeoJSON, độ khó, khoảng cách và thời lượng là dữ liệu mô phỏng,
  không phải tuyến thực tế đã xác minh. Không sử dụng để dẫn đường.

Chạy lại với cùng actor sẽ giữ nguyên các bản ghi giống catalog. Nếu trường do
seed quản lý đã thay đổi hoặc có mã/ID trùng, seed dừng và rollback toàn bộ;
không tự khôi phục, ghi đè hay xóa dữ liệu hiện có. Dùng lại cùng actor cho các
lần chạy sau. Dry-run chỉ phản ánh database tại thời điểm kiểm tra.

## Kiểm thử trên giao diện leader

1. Tạo Public Trip với destination và pickup `[DEMO CF01]` tương ứng.
2. Đặt ngày khởi hành tương lai, kết thúc sau khởi hành, sức chứa và giá/người
   lớn hơn 0; chọn lịch không trùng các chuyến khác của leader.
3. Chọn checkpoint theo thứ tự Xuất phát → Trung gian 1 → Trung gian 2 → Đích.
4. Chọn trail Chặng 1 → Chặng 2. Seed in các ID theo đúng thứ tự để đối chiếu.
5. Kiểm tra readiness trả `canPublish: true`, sau đó publish thành `OPEN`.

Seed không bỏ qua các kiểm tra lịch, trạng thái và quyền của CF01. Việc catalog
hợp lệ không thay thế kiểm tra readiness của chuyến đi cụ thể.
