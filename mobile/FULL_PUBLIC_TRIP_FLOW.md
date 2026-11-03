# HỆ THỐNG PUBLIC TRIP TOÀN DIỆN (TREKGO MOBILE)

## I. MÔ HÌNH VÒNG ĐỜI TRẠNG THÁI (LIFECYCLE)
1. **Leader tạo DRAFT**: Nhập thông tin cơ bản -> Chuyến ở trạng thái `DRAFT` (User chưa thấy).
2. **Leader cấu hình lộ trình**: Gán Checkpoint bắt buộc -> Gán chuỗi System Trail nối tiếp nhau.
3. **Leader kiểm tra & Xuất bản**: Chạy kiểm tra Readiness -> Gọi Publish -> Chuyến chuyển sang `OPEN`.
4. **User khám phá & Đặt chỗ**: Chuyến OPEN xuất hiện trên Feed User -> User xem chi tiết -> Gửi Booking giữ chỗ.

---

## II. DANH SÁCH API CHI TIẾT (REQUEST & RESPONSE)

### [NHÓM A] DỮ LIỆU ĐẦU VÀO PHỤC VỤ LEADER TẠO CHUYẾN
*Yêu cầu Auth: Bearer Token (Role: LEADER)*

1. Lấy danh sách Điểm đến (Destinations):
   - `GET /api/v1/leader/trip-options/destinations?page=1&pageSize=100`
   - Response 200: `[{ "id": "uuid-dest", "name": "Núi Bà Đen - Tây Ninh" }]`

2. Lấy điểm tập kết / đón xe theo Điểm đến:
   - `GET /api/v1/leader/trip-options/pickup-points?destinationId={id}`
   - Response 200: `[{ "id": "uuid-pickup", "name": "Cây xăng Hàng Xanh" }]`

3. Lấy trạm Checkpoint chính thức theo Điểm đến:
   - `GET /api/v1/leader/trip-options/checkpoints?destinationId={id}`
   - Response 200: `[{ "id": "uuid-cp", "name": "Cột điện 55", "latitude": "11.365", "longitude": "106.162" }]`

4. Kiểm tra Leader có bị trùng lịch hay không:
   - `GET /api/v1/leaders/me/schedule-conflicts?startAt={isoTime}&endAt={isoTime}`
   - Response 200: `{ "hasConflict": false, "conflicts": [] }`

---

### [NHÓM B] QUY TRÌNH LEADER TẠO & XUẤT BẢN CHUYẾN (CF01)
*Yêu cầu Auth: Bearer Token (Role: LEADER)*

1. Tạo chuyến đi nháp (DRAFT):
   - `POST /api/v1/leader/public-trips`
   - Body:
     ```json
     {
       "destinationId": "uuid-dest",
       "title": "Chinh phục đỉnh Bà Đen 2N1Đ",
       "description": "Kế hoạch chi tiết...",
       "startAt": "2026-11-20T05:00:00+07:00",
       "endAt": "2026-11-21T18:00:00+07:00",
       "pickupPointId": "uuid-pickup",
       "capacity": 15,
       "price": "1500000.00"
     }
     ```
   - Response 201: Trả về Trip object, trạng thái `"status": "DRAFT"`, `"version": 1`.

2. Gán Checkpoint bắt buộc theo thứ tự:
   - `PUT /api/v1/leader/public-trips/{id}/checkpoints`
   - Body: `{ "expectedVersion": 1, "checkpointIds": ["uuid-cp-1", "uuid-cp-2"] }`
   - Response 200: Trả về Trip object với `"version": 2`.

3. Lấy gợi ý cung đường tiếp nối (Trail suggestions):
   - `GET /api/v1/leader/public-trips/{id}/trail-suggestions?page=1&pageSize=20`
   - Response 200:
     ```json
     [
       {
         "id": "uuid-trail-1",
         "name": "Cung đường Cột Điện",
         "difficulty": "MEDIUM",
         "distanceKm": "8.5",
         "canAppend": true,
         "coveredCheckpointIds": ["uuid-cp-1"]
       }
     ]
     ```

4. Gán danh sách Cung đường (System Trails):
   - `PUT /api/v1/leader/public-trips/{id}/trails`
   - Body: `{ "expectedVersion": 2, "trailIds": ["uuid-trail-1"] }`
   - Response 200: Trả về Trip object với `"version": 3`.

5. Kiểm tra điều kiện xuất bản (Readiness check):
   - `GET /api/v1/leader/public-trips/{id}/readiness`
   - Response 200:
     ```json
     {
       "canPublish": true,
       "issues": [],
       "version": 3
     }
     ```
     *(Nếu canPublish = false, issues sẽ chứa danh sách lỗi: lộ trình không liền mạch, thiếu checkpoint, v.v.).*

6. Xuất bản chuyến đi sang OPEN:
   - `POST /api/v1/leader/public-trips/{id}/publish`
   - Body: `{ "expectedVersion": 3 }`
   - Response 201: Trả về Trip với `"status": "OPEN"`, `"publishedAt": "2026-10-13T...", "version": 4`.

7. Lấy danh sách chuyến của Leader quản lý:
   - `GET /api/v1/leader/public-trips?page=1&pageSize=20`
   - Response 200: Mảng các chuyến đi của Leader (bao gồm DRAFT, OPEN, FULL...).

---

### [NHÓM C] USER / TREKKER KHÁM PHÁ & ĐẶT CHỖ (DISCOVERY & BOOKING)

1. Danh sách chuyến đi công khai (Explore Feed):
   - `GET /api/v1/trips` (Public, không cần Auth)
   - Query: `page`, `pageSize`, `destinationId`, `difficulty`, `dateFrom`, `dateTo`, `price`
   - Response 200:
     ```json
     {
       "items": [
         {
           "id": "uuid-trip",
           "title": "Chinh phục đỉnh Bà Đen 2N1Đ",
           "status": "OPEN",
           "startAt": "2026-11-20T05:00:00.000Z",
           "endAt": "2026-11-21T18:00:00.000Z",
           "destination": { "id": "uuid-dest", "name": "Núi Bà Đen" },
           "leader": { "id": "uuid-leader", "fullName": "Nguyễn Văn Trekker" },
           "pricePerPax": "1500000",
           "currency": "VND",
           "capacity": 15,
           "remainingSlots": 8,
           "pickup": { "name": "Cây xăng Hàng Xanh", "address": "178 Điện Biên Phủ" },
           "routes": [{ "snapshotName": "Cột Điện", "snapshotDifficulty": "MEDIUM", "snapshotDistanceKm": "8.5" }],
           "checkpoints": [{ "name": "Cột điện 55", "isRequired": true }]
         }
       ],
       "total": 1, "page": 1, "pageSize": 12
     }
     ```

2. Chi tiết chuyến đi cho User:
   - `GET /api/v1/trips/{id}`
   - Response 200: Trả về chi tiết 1 trip (như phần tử trong mảng items).

3. Đặt chỗ chuyến đi (Booking):
   - `POST /api/v1/trips/{tripId}/bookings`
   - Auth: `Bearer <token>`
   - Header: `Idempotency-Key: <UUID>`
   - Body:
     ```json
     {
       "participantCount": 2,
       "participants": [
         { "fullName": "Nguyễn Văn A", "phone": "0912345678", "dateOfBirth": "1995-08-15" },
         { "fullName": "Trần Thị B", "phone": "0909123456", "dateOfBirth": "1998-05-20" }
       ]
     }
     ```
   - Response 201:
     ```json
     {
       "id": "uuid-booking",
       "status": "PENDING_PAYMENT",
       "version": 1,
       "participantCount": 2,
       "expiresAt": "2026-10-13T06:15:00.000Z",
       "totalAmount": "3000000",
       "currency": "VND"
     }
     ```

---

### [NHÓM D] QUY CHUẨN XỬ LÝ LỖI (GLOBAL ERROR ENVELOPE)
Mọi response lỗi HTTP (400, 404, 409, 422...) trả về định dạng:
```json
{
  "error": {
    "code": "CAPACITY_CONFLICT",
    "message": "Chuyến đi không còn đủ chỗ.",
    "details": { "remainingSlots": 0 },
    "retryable": false
  }
}


API Contract cho Map 3D:
Endpoint: GET /api/v1/system-trails/{trailCode} (ví dụ: TRAIL_BADEN_COTDIEN) hoặc GET /api/v1/leader/trip-options/system-trails/{id}
Response 200:
json
{
  "id": "uuid-trail",
  "code": "TRAIL_BADEN_COTDIEN",
  "name": "Đường Cột Điện Núi Bà Đen",
  "distanceKm": 8.5,
  "elevationGainM": 850,
  "destination": {
    "name": "Núi Bà Đen",
    "centerLat": 11.3789,
    "centerLng": 106.1712
  },
  "routeGeojson": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [106.162, 11.365, 50],
            [106.168, 11.378, 986]
          ]
        }
      }
    ]
  },
  "checkpoints": [
    {
      "id": "cp-1",
      "name": "Cột điện 55",
      "sequence": 1,
      "latitude": 11.365,
      "longitude": 106.162
    }
  ],
  "initialCamera": {
    "center": [106.1712, 11.3789],
    "zoom": 13.5,
    "pitch": 60,
    "bearing": -20
  }
}