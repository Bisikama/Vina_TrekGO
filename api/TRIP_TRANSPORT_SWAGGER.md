# Nhà xe và xe đón public trip — hướng dẫn Swagger

Phạm vi: danh bạ đối tác thuê xe và thông tin xe đón cho từng trip. Không quản lý đội xe, không đặt xe tự động, không tính phí vận chuyển vào payment. Hai bảng hiện có: `transport_providers`, `trip_transports`; không cần migration.

## Quyền và API

Authorize bằng bearer token ADMIN ACTIVE. Tất cả đường dẫn có tiền tố `/api/v1`.

| Phương thức | Đường dẫn | Công dụng |
| --- | --- | --- |
| GET | `/admin/transport-providers?page=1&pageSize=20` | Danh bạ; lọc `status=ACTIVE/INACTIVE` |
| POST | `/admin/transport-providers` | Tạo nhà xe |
| PATCH | `/admin/transport-providers/{id}` | Sửa liên hệ hoặc chuyển INACTIVE |
| GET | `/admin/public-trips/{tripId}/transports` | Danh sách xe, kể cả đã hủy; chưa có trả `[]` |
| POST | `/admin/public-trips/{tripId}/transports` | Thêm một xe |
| PATCH | `/admin/public-trips/{tripId}/transports/{id}` | Sửa/xác nhận/hủy một xe |

## Test luồng chính

1. Tạo nhà xe, lấy `id` làm `providerId`:

```json
{
  "name": "Nhà xe demo TrekGo",
  "contactName": "Người liên hệ demo",
  "phone": "0901234567",
  "status": "ACTIVE"
}
```

2. Chọn public trip có điểm tập kết ACTIVE và ngày bắt đầu trong tương lai. Nên chốt lịch/điểm tập kết trước khi nhập xe. POST xe với `providerId` vừa nhận; thay ngày giờ ví dụ bên dưới theo lịch trip:

```json
{
  "providerId": "UUID_NHA_XE",
  "vehicleType": "Xe 16 chỗ",
  "seatCapacity": 16,
  "meetingAt": "2026-12-20T05:30:00+07:00",
  "status": "PLANNED",
  "note": "Đón khách tại điểm tập kết đã thống nhất"
}
```

Điểm đón tự lấy từ trip, `sourceType=THIRD_PARTY`, `sequence` tự tăng. Một trip có thể có nhiều xe. Số ghế là thông tin xe, không thay đổi sức chứa booking và chưa có kiểm tra tổng ghế đủ khách. Không gửi trường giá thuê hay chi phí vào API này.

3. Nhà xe nhận chuyến: PATCH với phiên bản hiện tại:

```json
{ "expectedVersion": 1, "status": "CONFIRMED" }
```

CONFIRMED nghĩa là đã xác nhận bố trí, chưa bắt buộc biết biển số/tài xế. Chỉ nhập thông tin thực tế được cung cấp; không tự điền dữ liệu giả vào môi trường thật.

4. Khi có thông tin tài xế: PATCH tiếp, lấy `version` từ phản hồi mới nhất:

```json
{
  "expectedVersion": 2,
  "plateNumber": "DEMO-001",
  "driverName": "Tài xế demo",
  "driverPhone": "0901234567"
}
```

5. Nếu hủy bố trí xe: PATCH `{ "expectedVersion": 3, "status": "CANCELLED", "note": "Thay phương án đón" }`. Khi hủy chỉ gửi ba trường này. Bản ghi giữ lịch sử, không sửa lại được; thêm bản ghi mới nếu cần xe thay thế.

## Quy tắc chính

- Cho sửa khi trip DRAFT/OPEN/FULL/CLOSED và chưa bắt đầu. Không sửa trip PRIVATE, đang chạy, kết thúc, hủy hoặc đang chờ hủy.
- `meetingAt` không sau giờ bắt đầu trip. Nếu có `departureAt`: giờ tập trung ≤ giờ xuất phát ≤ giờ bắt đầu trip. `returnAt` không trước giờ kết thúc trip. Thời gian có múi giờ.
- Thông tin tài xế/biển số có thể để null hoặc bỏ qua. PATCH bỏ qua một trường sẽ giữ nguyên; null xóa các trường cho phép null.
- Nhà xe INACTIVE không được gán mới; thông tin xe đã gán vẫn sửa hoặc hủy được. Chuyển INACTIVE không tự hủy các xe hiện có.
- Đổi nhà xe lưu lại tên nhà xe mới trên dòng xe. Đổi tên trong danh bạ không tự đổi tên đã lưu cho các chuyến cũ.
- Mỗi PATCH xe tăng `version`. Hai yêu cầu cùng phiên bản: yêu cầu cũ bị từ chối 409; tải lại rồi sửa.
- Chưa có thông báo tự động khi đổi xe. Thông tin mới xuất hiện khi khách tải lại booking.

## Kiểm tra kết quả

- `transport_providers`: thông tin liên hệ và trạng thái hợp tác.
- `trip_transports`: `trip_id`, `provider_id`, `pickup_point_id`, `source_type`, `status`, `version`, biển số, tài xế, thời gian. Xe hủy vẫn tồn tại.
- `audit_logs`: các action `TRANSPORT_PROVIDER_CREATED`, `TRANSPORT_PROVIDER_UPDATED`, `TRIP_TRANSPORT_CREATED`, `TRIP_TRANSPORT_UPDATED`.
- `GET /trips/{id}`: xem loại xe chưa CANCELLED. `transportAvailable` chỉ phản ánh có bản ghi xe chưa hủy, không khẳng định nhà xe đã xác nhận.
- `GET /bookings/{id}` bằng tài khoản chủ booking: luồng hiện có trả loại xe; trả thêm biển số/tài xế/giờ tập trung khi booking thỏa điều kiện hiển thị. Trường chưa nhập có thể null.

Lỗi theo contract chung `error.code`, `error.message`, `error.details`, `meta`:

| HTTP | Code | Xử lý |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Kiểm tra kiểu dữ liệu, số ghế, điện thoại, lịch đón |
| 403 | FORBIDDEN | Dùng ADMIN ACTIVE |
| 404 | TRIP_TRANSPORT_NOT_FOUND | Kiểm tra trip public, nhà xe và xe thuộc đúng trip |
| 409 | TRIP_TRANSPORT_PROVIDER_UNAVAILABLE | Chọn nhà xe ACTIVE |
| 409 | TRIP_TRANSPORT_VERSION_CONFLICT | GET lại version |
| 409 | TRIP_TRANSPORT_LOCKED | Không sửa xe đã hủy hoặc trip ngoài trạng thái/thời gian cho phép |

Kiểm thử thêm: token LEADER phải bị từ chối; số ghế 0 bị 400; nhà xe INACTIVE bị chặn khi thêm xe; id xe thuộc trip khác bị 404; hai PATCH cùng expectedVersion không ghi đè nhau.
