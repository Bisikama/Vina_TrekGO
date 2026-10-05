# Dữ liệu mẫu điểm tập kết CF01

Seed riêng `prisma/seeds/cf01.seed.ts` thêm ba điểm tập kết demo vào các Destination
đã có. Chạy từ thư mục `api`; script đọc `DATABASE_URL` qua cấu hình `.env` hiện có.

```powershell
npm run seed:cf01 -- --dry-run
npm run seed:cf01
```

Nếu có nhiều LEADER ACTIVE, chỉ định **User.id** của tài khoản đã có:

```powershell
npm run seed:cf01 -- --actor-user-id=<User-UUID>
```

| Mã | Destination | Kết quả sau seed đã kiểm tra |
|---|---|---|
| CF01_DEMO_BADEN_01 | Núi Bà Đen – Tây Ninh | Tạo mới |
| CF01_DEMO_BADEN_02 | Núi Bà Đen – Tây Ninh | Tạo mới |
| CF01_DEMO_FANSIPAN_01 | Đỉnh Fansipan – Sa Pa | Tạo mới |

Sau lần chạy ngày 04/10/2026, bộ lọc điểm tập kết ACTIVE cùng destination hoặc
destination null trả: Bà Đen **2**, Đỉnh Fansipan **1**, Hoàng Liên **1**.
Chạy lần hai trả `UNCHANGED` cho cả ba mã, giữ nguyên ID và không tạo trùng.

Tên, địa chỉ và ghi chú đều đánh dấu demo. Tọa độ dùng tâm Destination hiện có,
không đại diện cho địa điểm đón khách đã được xác minh. Hai điểm demo Bà Đen dùng
cùng tọa độ tâm để kiểm thử lựa chọn.

## Phạm vi và hành vi chạy lại

- Không gọi seed tổng/navigation/rental; không đổi quyền hoặc tạo tài khoản.
- Không tạo/sửa Destination, Checkpoint, SystemTrail hoặc TrailCheckpoint.
- Kiểm tra hai Destination đích ACTIVE và một tài khoản LEADER ACTIVE.
- Mỗi mã đã tồn tại và đúng destination/ACTIVE được giữ nguyên, kể cả nội dung đã
  được chỉnh thủ công. Khác destination hoặc inactive thì báo xung đột, rollback.
- Toàn bộ thao tác ghi trong một transaction Serializable, có advisory lock giữa
  các lần chạy script. Nếu có lỗi serialization thì có thể chạy lại cùng lệnh.
- `--dry-run` không ghi dữ liệu; coverage của dry-run phản ánh DB trước khi seed.
- Không cần migration hoặc reset database cho việc thêm ba điểm này.

## Thử CF01 trên giao diện

1. Đăng nhập tài khoản Leader hiện có; tải lại trang, chọn **Núi Bà Đen – Tây Ninh**.
2. Chọn một điểm `[DEMO CF01]`, lịch tương lai không trùng chuyến khác,
   capacity 10 và giá mẫu 500000 VND.
3. Tạo bản nháp, chọn checkpoint theo thứ tự: Cột số 1 → Cột số 55 → Chóp đỉnh.
4. Chọn trail **Cung đường Cột Điện - Đỉnh Núi Bà Đen**.
5. Kiểm tra readiness rồi publish.

Hoàng Liên vẫn chưa có checkpoint master/liên kết checkpoint cho hai trail mẫu;
seed này chỉ khắc phục dữ liệu điểm tập kết, không chỉnh catalog của team khác.
Các migration Payment chưa triển khai không cần áp dụng để chạy seed CF01 này.

## Kiểm tra đã thực hiện

- Chạy dry-run, chạy seed thật và chạy lại: thành công, ba ID giữ nguyên.
- Gọi use case/Prisma adapter CF01 thật với catalog Bà Đen: trả 2 pickup và
  3 checkpoint; tạo DRAFT → chọn checkpoint → chọn trail → readiness hợp lệ → OPEN.
- Toàn bộ thao tác tạo/publish chuyến thử nằm trong transaction được chủ động
  rollback; truy vấn sau rollback xác nhận không lưu Trip thử.
- Đây là kiểm tra backend với DB thật, chưa phải kiểm thử đăng nhập/HTTP/trình duyệt
  hoặc concurrency giữa các request độc lập.
