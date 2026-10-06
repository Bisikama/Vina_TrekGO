# Hướng dẫn API CF01, CF03, CF04 cho frontend và Swagger

Đối chiếu source ngày **06/10/2026**. Tài liệu mô tả hành vi đang triển khai, không phải API dự kiến. Các ví dụ response được rút gọn, không phải kết quả chạy live. Không bao gồm checkout/payment, thuê đồ hoặc navigation/check-in.

## 1. Chức năng và tài khoản

| Luồng | Nhiệm vụ | Người sử dụng |
|---|---|---|
| CF01 | Tạo bản nháp chuyến công khai, lập kế hoạch checkpoint/trail, kiểm tra điều kiện, publish, gửi yêu cầu hủy | `LEADER`, `ACTIVE`, sở hữu chuyến |
| CF03 | Tạo và quản lý chuyến riêng, tạo/thu hồi link mời, hủy chuyến | `USER`, `ACTIVE`; quản lý chuyến do chính mình tạo |
| CF04 | Xem lời mời, tham gia, xem phòng/thành viên, rời nhóm, host loại thành viên | Preview công khai; join yêu cầu `USER ACTIVE`; room/members dành cho creator hoặc member ACTIVE |

`HOST` và `MEMBER` là vai trò **trong chuyến đi**, không phải `user.role`. Host của private trip vẫn là tài khoản `USER`. Không dùng tài khoản Leader của CF01 để test tạo private trip hoặc join.

Chuẩn bị 3 tài khoản: Leader cho CF01, User A làm host cho CF03, User B tham gia CF04. Tài khoản phải đăng nhập được qua Supabase và có profile tương ứng trong database. Các tài khoản fixture trong `test/serve-cf01-preview.ts` không dùng được trên server `npm run start`. Tài liệu không lưu mật khẩu/token thật.

## 2. Cách gọi trên Swagger

- Chạy API trong thư mục `api`: `npm run start`.
- Swagger local: <http://localhost:3000/docs>.
- Base URL local: `http://localhost:3000/api/v1`. Nếu đổi `PORT` hoặc triển khai server khác, thay host/port tương ứng.
- **Mọi đường dẫn trong tài liệu bên dưới đều tương đối với `/api/v1`.**
- Mở endpoint → **Try it out** → điền path/query/body → **Execute** → xem HTTP code và Response body.
- Body JSON dùng `Content-Type: application/json`. UUID trong ví dụ là placeholder, phải thay bằng ID thật từ API.
- Timestamp dùng ISO 8601 có múi giờ, ví dụ `2026-11-15T06:00:00+07:00`. Khi test sau ngày này, đổi sang tương lai.

### Đăng nhập và Authorize

Trong nhóm `Auth`, gọi `POST /auth/login`:

```json
{
  "email": "EMAIL_TAI_KHOAN_TEST",
  "password": "MAT_KHAU_TAI_KHOAN_TEST"
}
```

Response có `user`, `accessToken`, `refreshToken`, `expiresIn`, `expiresAt`, `tokenType`. Kiểm tra `user.role` và `user.status`. Sao chép `accessToken` → **Authorize** → ô **bearer** → chỉ dán token, không thêm chữ `Bearer`. Request HTTP thực tế dùng `Authorization: Bearer <accessToken>`.

Khi chuyển Leader/User A/User B, đăng nhập lại và thay token trong Authorize. Token trong response login không tự thay token đã Authorize. Endpoint công khai không cần token. `GET /auth/me` có thể dùng để đối chiếu profile; nếu Swagger không gửi Authorization cho endpoint auth này, kiểm tra tên security scheme trong OpenAPI (các controller CF dùng tên `bearer`).

### Trạng thái Swagger và đọc kết quả

CF01 đã khai báo đầy đủ query (phân trang, destinationId, thời gian kiểm tra lịch), path UUID, nhiệm vụ và schema response cho cả 17 endpoint. Khởi động lại API rồi tải lại trang Swagger sau khi cập nhật source.

Phần Responses/Example Value là mô tả cấu trúc, không phải dữ liệu database. Để nhận dữ liệu thật phải bấm Try it out → Execute rồi xem **Server response**, HTTP status và **Response body**.

- HTTP 200 và body `[]`: request thành công nhưng không có bản ghi phù hợp ở trang này. Leader list chỉ lấy chuyến của tài khoản đang đăng nhập; public list chỉ lấy chuyến đã publish và OPEN/FULL.
- 401/403: kiểm tra token Authorize, role ACTIVE và quyền sở hữu.
- Failed to fetch/connection refused/loading không kết thúc: kiểm tra API đã chạy, đúng host/PORT và log server; chưa thể kết luận là danh sách rỗng.
- Không có ô query hoặc schema CF01/CF03/CF04 sau khi cập nhật: restart tiến trình API rồi hard refresh Swagger; có thể đang mở bản server cũ.

CF03 và CF04 cũng đã khai báo đầy đủ query/path và schema response cho 17 endpoint: CF03 có page (cố định 20 dòng/trang), status tương thích và destinationId bắt buộc cho pickup; CF04 có inviteCode, UUID trip/member, phân trang/trạng thái thành viên và expectedMemberVersion trong query của DELETE. POST join nhận {} hoặc bỏ body. Tất cả 34 endpoint CF01/CF03/CF04 có mô tả nhiệm vụ và response ngay trên Swagger. Khi đưa timestamp vào URL, dùng URLSearchParams để dấu + của múi giờ được mã hóa đúng.

## 3. Quy ước response và version

- Response thành công trả trực tiếp object hoặc array. Với Axios, dữ liệu là `response.data`, không giả định có thêm `.data` bên trong.
- `expectedVersion` là version của **trip**; lấy từ `version`, `tripVersion` hoặc `room.trip.version` tùy response.
- `expectedMemberVersion` là version của **membership**, lấy từ `membership.version`, `room.viewer.membershipVersion` hoặc `members.items[].version`.
- Không lấy trip version thay member version. Không hard-code các số version trong ví dụ khi gọi thật.
- Join/leave/remove thực sự thay đổi membership cũng tăng trip version. Host nên tải lại trip trước khi sửa, mời hoặc hủy nếu có thành viên vừa thao tác.
- Khi nhận version conflict, tải lại dữ liệu rồi cho người dùng thực hiện lại quyết định; không tự gửi lại payload cũ vô hạn.
- CF01 danh sách/options/suggestions và CF03 danh sách/options trả **array**, không có `total`. CF04 members trả `{items, page, pageSize, total, activeMemberCount, capacity}`.
- Các giá trị decimal như giá, tọa độ, khoảng cách có thể là chuỗi JSON; frontend cần chuyển đổi có chủ đích khi vẽ bản đồ/tính toán. `price` CF01 bắt buộc gửi chuỗi.

## 4. CF01 — Leader quản lý chuyến công khai

Swagger tags: `CF01 Leader Public Trips`, `CF01 Trip Options`, `Public Trips`.

### 4.1 Danh mục API

Tất cả endpoint `/leader/...` và `/leaders/...` yêu cầu Leader ACTIVE. Với trip cụ thể, phải là creator đồng thời leader của trip.

| Method và path | Nhiệm vụ / dùng ở màn hình | Input | Response thành công |
|---|---|---|---|
| GET `/leader/trip-options/destinations` | Dropdown địa điểm ACTIVE | Query phân trang | 200, `[{id,name}]` |
| GET `/leader/trip-options/pickup-points` | Dropdown điểm tập kết phù hợp | `destinationId` bắt buộc + phân trang | 200, `[{id,name}]`; cùng địa điểm hoặc điểm dùng chung |
| GET `/leader/trip-options/checkpoints` | Chọn checkpoint bắt buộc | `destinationId` bắt buộc + phân trang | 200, array checkpoint ACTIVE, có `id,name,destinationId,latitude,longitude,defaultRadiusMeters,status,description` |
| GET `/leader/trip-options/system-trails/{id}` | Chi tiết một System Trail để xem tuyến | Path: system trail ID | 200, Trail: `id,name,destinationId,difficulty,status,version,routeGeojson,distanceKm,elevationGainM,checkpointIds` |
| GET `/leaders/me/schedule-conflicts` | Kiểm tra lịch Leader trước khi lưu | `startAt,endAt`; tùy chọn `excludeTripId` khi sửa | 200, `{hasConflict,conflicts:[{id,title,status,startAt,endAt}]}` |
| POST `/leader/public-trips` | Tạo chuyến nháp | Body create bên dưới | 201, TripView, `status=DRAFT` |
| GET `/leader/public-trips` | Danh sách chuyến của Leader hiện tại | Phân trang | 200, `TripView[]` |
| GET `/leader/public-trips/{id}` | Trang chỉnh sửa/chi tiết quản lý | Path trip ID | 200, TripView |
| PATCH `/leader/public-trips/{id}` | Sửa thông tin bản nháp | `expectedVersion` + một phần body create | 200, TripView có version mới |
| PUT `/leader/public-trips/{id}/checkpoints` | Thay toàn bộ danh sách checkpoint và thứ tự | `expectedVersion,checkpointIds` | 200, TripView |
| GET `/leader/public-trips/{id}/trail-suggestions` | Chọn tuyến theo địa điểm và kế hoạch | Phân trang | 200, array Trail + `canAppend,coveredCheckpointIds` |
| PUT `/leader/public-trips/{id}/trails` | Thay toàn bộ danh sách System Trail theo thứ tự | `expectedVersion,trailIds` | 200, TripView |
| GET `/leader/public-trips/{id}/readiness` | Hiển thị điều kiện còn thiếu trước publish | Path trip ID | 200, `{canPublish,issues:[{code,field,message}],version}` |
| POST `/leader/public-trips/{id}/publish` | Công khai chuyến nháp hợp lệ | `{expectedVersion}` | 201, TripView, `status=OPEN`, có `publishedAt` |
| POST `/leader/public-trips/{id}/cancellation-requests` | Gửi yêu cầu hủy chuyến | `expectedVersion,reason,evidenceUrls?` | 201, TripView, `status=CANCEL_PENDING` |
| GET `/public-trips` | Danh sách khách có thể xem, không cần auth | Phân trang | 200, array PublicTrip |
| GET `/public-trips/{id}` | Chi tiết công khai, không cần auth | Path trip ID | 200, PublicTrip |

Phân trang CF01: `page` mặc định 1, tối đa 100000; `pageSize` mặc định 20, tối đa 100, tối thiểu 1. Dù schema chung nhận `destinationId`, hai API danh sách trip hiện **không lọc theo destinationId**; chỉ dựa vào phân trang và quyền/trạng thái.

`TripView` có `id,tripType,creatorId,leaderId,title,description,destinationId,startAt,endAt,pickupPointId,capacity,price,status,version,publishedAt,checkpoints,trails`. `checkpoints` chứa snapshot và `sourceCheckpointId`; `trails` chứa `systemTrailId,sequence,snapshotName,snapshotDifficulty,snapshotGeojson,snapshotDistanceKm,snapshotElevationGainM,sourceTrailVersion,snapshotCheckpointIds`.

`PublicTrip` chỉ có `id,title,description,destinationId,startAt,endAt,capacity,price,pickupPointId,status,publishedAt`. Không có version/checkpoint/trail trong response công khai. Chỉ trip đã publish và đang `OPEN`/`FULL` được trả về; draft hoặc `CANCEL_PENDING` không xuất hiện.

### 4.2 Body tạo/sửa

```json
{
  "destinationId": "UUID_DIA_DIEM",
  "title": "CF01 - Trekking kiểm thử",
  "description": "Chuyến đi demo",
  "startAt": "2026-11-15T06:00:00+07:00",
  "endAt": "2026-11-15T18:00:00+07:00",
  "pickupPointId": "UUID_DIEM_TAP_KET",
  "capacity": 10,
  "price": "500000"
}
```

Tất cả trường trên bắt buộc trừ `description` (cho phép null). `title` sau trim dài 1–220, description tối đa 5000; capacity là integer 1–2147483647; price > 0, tối đa 10 chữ số phần nguyên và 2 chữ số thập phân. Bắt đầu phải ở tương lai và trước kết thúc; lịch không được giao với public trip khác của Leader, kể cả draft.

PATCH ví dụ: `{"expectedVersion":1,"title":"Tên mới","capacity":12}`. Chỉ sửa ở `DRAFT`. Muốn đổi địa điểm khi đã có kế hoạch, trước hết PUT cả checkpoints và trails thành mảng rỗng (cập nhật version giữa mỗi lần), rồi đổi địa điểm cùng pickup phù hợp.

### 4.3 Luồng test chính trên Swagger

1. Authorize Leader. Lấy `destinationId`, pickup và checkpoint qua Trip Options.
2. Kiểm tra lịch qua `/leaders/me/schedule-conflicts`; khi sửa phải truyền `excludeTripId` thuộc mình.
3. POST tạo draft; lưu `id` và `version` từ response.
4. GET `/{id}/trail-suggestions`; chọn một System Trail ACTIVE cùng địa điểm có `checkpointIds` không rỗng. Chọn các required checkpoint nằm trong tuyến này theo thứ tự tuyến.
5. PUT `/{id}/checkpoints`:

```json
{"expectedVersion":1,"checkpointIds":["UUID_CHECKPOINT_1","UUID_CHECKPOINT_2"]}
```

6. Lấy version mới, PUT `/{id}/trails`:

```json
{"expectedVersion":2,"trailIds":["UUID_SYSTEM_TRAIL"]}
```

7. GET readiness. Kỳ vọng `canPublish:true`, `issues:[]`. Dùng version hiện tại để POST publish: `{"expectedVersion":3}`.
8. GET `/public-trips/{id}` để xác nhận khách xem được chuyến `OPEN`.
9. Nếu cần test hủy, làm sau bước xem công khai: POST cancellation-requests với `{"expectedVersion":4,"reason":"Hủy chuyến demo","evidenceUrls":[]}`. Kết quả là **chờ duyệt hủy**, không phải hủy ngay; API duyệt hủy không nằm trong nhóm này.

Quy tắc kế hoạch: ít nhất 1 required checkpoint và 1 System Trail; không ID trùng; tối đa 100 checkpoint/50 trail. Nếu nhiều trail, checkpoint cuối trail trước phải bằng checkpoint đầu trail sau. Tuyến ghép phải đi qua required checkpoint đúng thứ tự. Personal Trail không được dùng cho CF01. `canAppend` chỉ giúp chọn trail tiếp theo, không thay thế readiness. Nếu nguồn checkpoint/trail thay đổi, chọn lại kế hoạch để làm mới snapshot rồi kiểm tra lại.

`reason` hủy dài 1–2000 sau trim; `evidenceUrls` tối đa 10 URL, mỗi URL tối đa 2048 ký tự. Chỉ gửi yêu cầu hủy khi trip đang `DRAFT`, `OPEN` hoặc `FULL` và chưa có yêu cầu PENDING.

## 5. CF03 — User tạo và quản lý chuyến riêng

Swagger tag: `CF03 Private Trips`. Tất cả endpoint yêu cầu `USER ACTIVE`. LEADER bị trả `LEADER_CANNOT_CREATE_PRIVATE_TRIP` bởi kiểm tra chung, kể cả khi gọi danh sách/options trong nhóm này.

### 5.1 Danh mục API

| Method và path | Nhiệm vụ / dùng ở màn hình | Input | Response thành công |
|---|---|---|---|
| GET `/me/personal-trails` | Chọn trail cá nhân thuộc user | `page`, tùy chọn `status=ACTIVE` | 200, array PersonalTrail kèm `personalCheckpointsViaPersonalTrailId` theo sequence |
| GET `/me/trail-accesses` | Chọn System Trail user có quyền ACTIVE | `page`, tùy chọn `status=ACTIVE` | 200, array TrailAccess kèm `systemTrail` và `systemTrail.trailCheckpointsViaSystemTrailId[].checkpoint` |
| GET `/trails/{trailId}/access` | Kiểm tra quyền dùng System Trail | Path system trail ID | 200, `{hasAccess,accessId,purchasedAt}` |
| GET `/private-trip-options/pickup-points` | Chọn điểm tập kết cùng địa điểm | `destinationId` bắt buộc, `page` | 200, `[{id,name,destinationId}]` |
| POST `/private-trips` | Tạo private trip và membership HOST | Body create bên dưới | 201, PrivateTripRaw, `status=OPEN` |
| GET `/private-trips` | Danh sách private trip do mình tạo | `page`, tùy chọn `status=ACTIVE` | 200, `PrivateTripRaw[]` |
| GET `/private-trips/{id}` | Chi tiết cho người tạo | Path trip ID | 200, PrivateTripRaw |
| PATCH `/private-trips/{id}` | Sửa thông tin cơ bản | `expectedVersion` + trường được phép | 200, PrivateTripRaw với version mới |
| POST `/private-trips/{id}/invitations` | Tạo/đổi link mời, thu hồi link ACTIVE cũ | `expectedVersion`, tùy chọn `expiresAt` | 201, `{inviteId,inviteCode,inviteUrl,expiresAt,status,tripVersion}` |
| POST `/private-trips/{id}/invitations/revoke` | Thu hồi link mời ACTIVE | `{expectedVersion}` | 200, `{tripId,revokedCount,tripVersion}` |
| POST `/private-trips/{id}/cancel` | Hủy ngay private trip, thu hồi link mời | `expectedVersion`, tùy chọn `reason` | 201, raw trip, `status=CANCELLED`, version mới; không kèm hai mảng relation |

Phân trang CF03: chỉ `page` mặc định 1, tối đa 100000; server cố định 20 dòng/trang. Không gửi `pageSize` (schema strict). `status=ACTIVE` là giá trị duy nhất schema page nhận nhưng **không lọc trạng thái trip** trong GET `/private-trips`; các options trail vốn đã lọc ACTIVE. Danh sách private trip này **không phải danh sách tất cả chuyến user đã tham gia**.

`PrivateTripRaw` hiện trả field tên database: `maxPax` thay cho `capacity`, `pricePerPax` (null) thay cho `price`, `tripTrailPlansViaTripId` thay cho `trails`, `tripCheckpointsViaTripId` thay cho `checkpoints`, cùng `id,creatorId,leaderId,tripType,title,description,destinationId,pickupPointId,startAt,endAt,status,version,...`. Frontend nên map riêng, không tái sử dụng nguyên kiểu TripView của CF01. Date là chuỗi ISO khi qua HTTP.

### 5.2 Lấy đúng ID nguồn

| Dữ liệu form | PERSONAL | SYSTEM |
|---|---|---|
| `type` | `PERSONAL` | `SYSTEM` |
| `trailRef` | `personalTrail.id` | `trailAccess.systemTrail.id` hoặc `systemTrailId`, **không phải trailAccess.id** |
| `destinationId` | Địa điểm tương ứng trail | `systemTrail.destinationId` |
| `checkpointIds` | ID trong `personalCheckpointsViaPersonalTrailId[]` | `trailCheckpointsViaSystemTrailId[].checkpoint.id`, **không phải ID dòng liên kết** |

Chỉ chọn checkpoint theo thứ tự sequence của trail, không trùng, ít nhất 1 và tối đa 100. System checkpoint phải ACTIVE và đúng địa điểm. PERSONAL phải thuộc user hiện tại và chưa archived; SYSTEM phải ACTIVE, chưa archived và user có TrailAccess ACTIVE chưa bị revoke.

CF03 không có endpoint danh sách destination riêng. Dùng destination từ trail đã chọn hoặc catalog dùng chung của ứng dụng. Nếu personal trail chưa có destination, cần chọn một destination ACTIVE qua catalog được phép truy cập; không gọi options của Leader bằng tài khoản USER. Pickup của CF03 bắt buộc thuộc chính địa điểm đó, không nhận pickup dùng chung có destinationId null như CF01.

### 5.3 Body và thứ tự thao tác

Authorize **User A**. Lấy trail/options theo bảng trên rồi gọi POST `/private-trips`:

```json
{
  "type": "SYSTEM",
  "trailRef": "UUID_SYSTEM_TRAIL",
  "destinationId": "UUID_DIA_DIEM",
  "title": "CF03 - Nhóm trekking riêng",
  "description": "Chuyến đi cùng bạn bè",
  "startAt": "2026-11-16T06:00:00+07:00",
  "endAt": "2026-11-16T18:00:00+07:00",
  "pickupPointId": "UUID_DIEM_TAP_KET",
  "capacity": 5,
  "checkpointIds": ["UUID_CHECKPOINT_1", "UUID_CHECKPOINT_2"]
}
```

Tất cả bắt buộc trừ description (string tối đa 5000, không nhận null); title trim dài 1–220; capacity integer 1–2147483647. Ngày bắt đầu phải tương lai và trước kết thúc. Không gửi `price`, `leaderId`, `creatorId` hoặc `status`. Tạo thành công đã là `OPEN`, tự thêm creator thành HOST ACTIVE, không có bước publish riêng. Capacity **tính cả host**, do đó capacity=1 không còn chỗ cho bạn bè.

PATCH chỉ được sửa `title,description,startAt,endAt,pickupPointId,capacity` cùng `expectedVersion`:

```json
{"expectedVersion":1,"title":"Nhóm trekking cuối tuần","capacity":6}
```

Không được đổi trail/type/destination/checkpoints qua PATCH này. Không giảm capacity dưới số thành viên ACTIVE. Sửa/mời/thu hồi/hủy đều yêu cầu trip OPEN và chưa bắt đầu. Nếu đổi lịch sớm hơn khiến expiry link không còn trước giờ bắt đầu, server thu hồi link đó.

Tạo link mời (lấy version mới nhất):

```json
{"expectedVersion":2}
```

Có thể thêm `expiresAt` ở tương lai và **nhỏ hơn startAt**. Mặc định là thời điểm sớm hơn giữa 7 ngày kể từ hiện tại và 1 giây trước giờ bắt đầu. Response rút gọn:

```json
{
  "inviteId": "UUID_INVITE",
  "inviteCode": "MA_MOI_SERVER_TRA_VE",
  "inviteUrl": "http://localhost:3001/invite/MA_MOI_SERVER_TRA_VE",
  "expiresAt": "2026-10-13T03:00:00.000Z",
  "status": "ACTIVE",
  "tripVersion": 3
}
```

Frontend chia sẻ `inviteUrl`, dùng **inviteCode** gọi CF04 (không dùng inviteId). URL lấy từ `WEB_APP_ORIGIN`, local mặc định `http://localhost:3001`; production cần cấu hình origin của frontend. Tạo link mới thu hồi link cũ và tăng trip version. Revoke không xóa membership đã tham gia; nếu không có link ACTIVE để revoke, trip version không tăng.

Hủy chỉ test sau khi hoàn tất CF04: POST `/private-trips/{id}/cancel` với `{"expectedVersion":3,"reason":"Hủy chuyến demo"}` (reason tối đa 2000). Private trip chuyển `CANCELLED` ngay và link ACTIVE bị thu hồi, khác CF01 chờ duyệt. Không giả định API hủy trả thêm danh sách membership hoặc tự đổi tất cả membership sang LEFT.

## 6. CF04 — Tham gia và quản lý thành viên

Swagger tag: `CF04 Private Trip Membership`.

### 6.1 Danh mục API

| Method và path | Nhiệm vụ / quyền | Input | Response thành công |
|---|---|---|---|
| GET `/private-trip-invitations/{code}` | Landing page link mời; không cần auth, không tạo membership | `code` nhận từ CF03 | 200, `{trip,invite,joinable,joinDisabledReason}` |
| POST `/private-trip-invitations/{code}/join` | USER ACTIVE xác nhận tham gia/rejoin | Path code; body `{}` hoặc không gửi | 200, JoinResult bên dưới |
| GET `/private-trips/{id}/room` | Phòng chuyến đi cho creator hoặc member ACTIVE | Path trip ID; Bearer | 200, Room bên dưới |
| GET `/private-trips/{id}/members` | Danh sách thành viên cho creator hoặc member ACTIVE | `page,pageSize,status`; Bearer | 200, trang membership |
| POST `/private-trips/{id}/leave` | Member tự rời nhóm; host không được rời | `{expectedMemberVersion}`; Bearer | 200, MembershipChange, `status=LEFT` |
| DELETE `/private-trips/{id}/members/{memberId}` | Creator loại thành viên; không được loại host | **Query** `expectedMemberVersion` bắt buộc; Bearer | 200, MembershipChange, `status=REMOVED` |

`code` phải khớp `[A-Za-z0-9_-]{32,120}`. Dùng nguyên code server trả, không tự đặt mã ngắn. `memberId` là ID membership từ `members.items[].id`, **không phải userId**.

Members: page mặc định 1 (1–100000), pageSize mặc định 20 (1–100); status mặc định `ACTIVE`, các giá trị `ACTIVE,LEFT,REMOVED,COMPLETED,NO_SHOW,ALL`. Chỉ creator được xem status khác ACTIVE. Mỗi item có `id,role,status,joinedAt,version,userId,displayName,isHost`.

### 6.2 Response để dựng UI

Preview (rút gọn):

```json
{
  "trip": {
    "id": "UUID_TRIP", "tripType": "PRIVATE", "title": "Nhóm trekking riêng",
    "startAt": "2026-11-16T06:00:00+07:00", "endAt": "2026-11-16T18:00:00+07:00",
    "status": "OPEN", "host": {"displayName": "User A"},
    "activeMemberCount": 1, "capacity": 5, "remainingSlots": 4
  },
  "invite": {"expiresAt": "2026-10-13T03:00:00.000Z", "status": "ACTIVE"},
  "joinable": true,
  "joinDisabledReason": null
}
```

Preview chỉ trả thông tin tối thiểu, không trả route chi tiết, pickup hay danh sách thành viên. Hết chỗ hoặc hết lượt dùng link có thể vẫn HTTP 200 nhưng `joinable=false`, `joinDisabledReason` là `CAPACITY_CONFLICT` hoặc `INVITE_USAGE_LIMIT_REACHED`. Link hết hạn/thu hồi trả 410; chuyến không OPEN/chưa bắt đầu không thỏa trả 409. Kết quả preview không giữ chỗ: join vẫn có thể trả hết chỗ nếu người khác vừa tham gia.

JoinResult:

```json
{
  "tripId": "UUID_TRIP",
  "membership": {"id":"UUID_MEMBER","role":"MEMBER","status":"ACTIVE","joinedAt":"2026-10-06T03:00:00.000Z","version":1},
  "alreadyMember": false,
  "rejoined": false,
  "isHost": false,
  "activeMemberCount": 2,
  "capacity": 5,
  "tripVersion": 4,
  "redirectTo": "/private-trips/UUID_TRIP"
}
```

`redirectTo` là đường dẫn frontend, không phải URL REST. Nhấn join lần nữa khi đã ACTIVE trả `alreadyMember=true`, không tạo membership hoặc chiếm chỗ lần hai. Với creator/member ACTIVE, code hiện tại trả membership hiện có trước khi kiểm tra expiry/revoke/trạng thái chuyến; vì vậy join lặp có thể thành công dù preview cùng code báo link không còn dùng được. Không dùng join thay room để kiểm tra khả năng thao tác hiện tại. `membership` có thể null ở creator của dữ liệu lịch sử chưa backfill.

Room có các nhóm:

- `trip`: `id,tripType,title,description,status,version,startAt,endAt,capacity,activeMemberCount,pickupPoint` (pickup có id/name/address/latitude/longitude hoặc null).
- `viewer`: `isHost,membershipId,membershipVersion,membershipStatus`.
- `permissions`: `canInvite,canRemoveMembers,canLeave,canRent`. Dùng trực tiếp để bật/tắt nút; server vẫn kiểm tra quyền khi gọi.
- `rental`: hiện `{eligible:false,reason:"PRIVATE_TRIP_RENTAL_DISABLED"}`; không hiển thị luồng thuê đồ cho private trip.
- `plannedRoutes`: array `id,sequence,sourceType,name,difficulty,distanceKm,elevationGainM,geojson`.
- `requiredCheckpoints`: array snapshot `id,sequence,name,description,latitude,longitude,radiusMeters,isRequired,isEnabled`.

ID route/checkpoint trong room là ID snapshot của kế hoạch, không thay cho trailRef/checkpoint nguồn khi tạo trip khác. Member dùng `/room`; không dùng `GET /private-trips/{id}` của CF03 vì API đó chỉ dành cho creator.

MembershipChange của leave/remove:

```json
{
  "tripId":"UUID_TRIP", "membershipId":"UUID_MEMBER", "status":"LEFT",
  "memberVersion":2, "tripVersion":5, "changed":true
}
```

Remove trả `status=REMOVED`. Gọi lặp khi đã ở đúng trạng thái trả `changed=false` và không tăng version, kể cả expectedMemberVersion đã cũ. Với thay đổi thật, version sai trả conflict.

### 6.3 Luồng test A/B

1. User A tạo trip capacity ≥ 2 bằng CF03, lấy code mời.
2. GET preview không đăng nhập: xem tên chuyến, host, số chỗ; chưa có membership mới.
3. Đăng nhập User B và thay token Authorize. POST join với `{}`; lưu tripId, membership.id và membership.version.
4. Gọi join lần nữa: `alreadyMember=true`, số thành viên không tăng thêm.
5. User B GET room và members. UI hiện nút rời; không hiện mời/loại thành viên.
6. User B POST leave với `{"expectedMemberVersion":1}` (dùng version thật). Kỳ vọng LEFT; B không còn quyền đọc room/members.
7. B có thể join lại bằng link còn hợp lệ, chuyến OPEN chưa bắt đầu và còn chỗ: `rejoined=true`, vẫn membership đó với version tăng.
8. Chuyển Authorize về User A. GET members để lấy membership ID và version hiện tại của B.
9. DELETE `/private-trips/{id}/members/{memberId}?expectedMemberVersion=3` (3 chỉ minh họa). Kỳ vọng REMOVED. Host có thể loại cả membership đang LEFT.
10. Chuyển về B, thử join lại: bị 403 FORBIDDEN, `error.details.reason=MEMBER_REMOVED`. Người bị loại không thể tự vào lại bằng link mới.
11. Nếu cần, A tải lại trip/version rồi thu hồi lời mời hoặc hủy chuyến bằng CF03.

Leave/remove thay đổi thật chỉ được khi trip OPEN, trước giờ bắt đầu. Không thể rời hoặc loại host (`HOST_MEMBERSHIP_IMMUTABLE`). Host phải dùng CF03 cancel nếu muốn hủy cả chuyến.

## 7. Xử lý lỗi ở frontend

### CF01: envelope cũ còn đang sử dụng

Các HttpException qua TripErrorFilter trả kiểu:

```json
{"statusCode":409,"code":"VERSION_CONFLICT","message":"Trip đã thay đổi. Hãy tải lại trước khi tiếp tục."}
```

Có thể có `issues:[{code,field,message}]`. Lỗi bất ngờ không thuộc HttpException vẫn có thể qua global filter. Frontend CF01 cần hỗ trợ cả hai envelope trong giai đoạn hiện tại.

| HTTP / code CF01 | Cách xử lý |
|---|---|
| 400 `VALIDATION_ERROR` | Sửa field hoặc danh sách ID theo issues; kiểm tra ngày/giá/pickup |
| 401 `UNAUTHENTICATED`, 403 `FORBIDDEN` | Đăng nhập/kiểm tra Leader ACTIVE và quyền sở hữu |
| 404 `NOT_FOUND` | Tải lại danh mục hoặc quay lại danh sách |
| 409 `VERSION_CONFLICT` | GET lại trip trước khi lưu |
| 409 `LEADER_SCHEDULE_CONFLICT` | Chọn thời gian khác; dùng API schedule-conflicts |
| 409 `INVALID_STATE_TRANSITION` | Đồng bộ trạng thái; khóa nút sửa/publish không hợp lệ |
| 422 `INVALID_TRAIL_FOR_TRIP_TYPE` | Chọn System Trail ACTIVE đúng địa điểm |
| 422 `TRIP_NOT_READY_TO_PUBLISH` | Hiển thị issues, sửa kế hoạch rồi kiểm tra readiness |

`INVALID_ROUTE`, `PLAN_SOURCE_CHANGED`, `INVALID_TIME` có thể nằm trong `issues`, không nhất thiết là code cấp ngoài.

### CF03/CF04: envelope chuẩn

```json
{
  "error": {
    "code": "MEMBERSHIP_VERSION_CONFLICT",
    "message": "Reload membership before retrying",
    "retryable": false
  },
  "meta": {
    "requestId": "REQUEST_ID",
    "serverTime": "2026-10-06T03:00:00.000Z",
    "contractVersion": "0.2.0-final-flow"
  }
}
```

`error.details` có thể vắng mặt, là object (ví dụ `{reason:"MEMBER_REMOVED"}`) hoặc array lỗi validation `{field,message}`. Đọc `response.data.error`, không giả định `response.data.message`.

| HTTP / code | Ý nghĩa và thao tác UI |
|---|---|
| 400 `VALIDATION_ERROR` | Kiểm tra UUID, ngày, field thừa, capacity và checkpoint |
| 401 `UNAUTHENTICATED` | Đăng nhập/refresh token |
| 403 `FORBIDDEN` | Không đủ quyền; xem details.reason nếu có |
| 403 `LEADER_CANNOT_CREATE_PRIVATE_TRIP` | Chuyển sang tài khoản USER |
| 403 `TRAIL_ACCESS_REQUIRED` | User chưa có quyền ACTIVE đối với System Trail |
| 404 `NOT_FOUND` | Không tìm thấy hoặc không thuộc creator hiện tại |
| 409 `PRIVATE_TRIP_VERSION_CONFLICT` | Tải lại trip/version |
| 409 `MEMBERSHIP_VERSION_CONFLICT` | Tải lại membership/version |
| 409 `INVALID_STATE_TRANSITION` | Chuyến không OPEN, đã đến giờ bắt đầu hoặc membership không cho phép thao tác |
| 409 `CAPACITY_CONFLICT` | Hết chỗ, tải lại preview/room |
| 409 `INVITE_USAGE_LIMIT_REACHED` | Lời mời hết lượt dùng |
| 410 `INVITE_EXPIRED`, `INVITE_REVOKED` | Thông báo link không còn hiệu lực, xin host link mới |
| 422 `INVALID_TRAIL_FOR_TRIP_TYPE` | Trail/checkpoint sai nguồn, địa điểm hoặc thứ tự |
| 429 `INVITE_RATE_LIMITED` | Chờ số giây trong header `Retry-After` |

Rate limit preview hiện 60 request/phút/IP; join 30 request/phút/IP và theo user khi nhận diện được. Không polling preview/join liên tục. Join body không nhận `userId`, `tripId` hay role; danh tính lấy từ token.

Ví dụ đọc lỗi Axios cho CF03/CF04 và tương thích CF01:

```ts
const body = err.response?.data;
const apiError = body?.error ?? body; // fallback chỉ phục vụ CF01 legacy
const code = apiError?.code;
const message = apiError?.message ?? 'Không thể thực hiện yêu cầu';
const details = apiError?.details ?? body?.issues;
```

## 8. Checklist bàn giao frontend

- [ ] Leader chạy được CF01 draft → kế hoạch → readiness → OPEN → xem công khai.
- [ ] USER A tạo private trip bằng PERSONAL hoặc SYSTEM có quyền; host chiếm 1 chỗ.
- [ ] USER B preview → join → room/members → leave → rejoin.
- [ ] Host remove B → B không join lại được; revoke link không đuổi member đang ACTIVE.
- [ ] Các nút lấy quyền từ room.permissions; member không gọi API chi tiết creator của CF03.
- [ ] Cập nhật trip version và member version riêng; xử lý 409 bằng tải lại dữ liệu.
- [ ] Thử thiếu token, sai role, capacity đầy, link hết hạn/thu hồi, version cũ, ngày quá khứ.
- [ ] Map đúng CF01 `capacity/checkpoints/trails` và CF03 `maxPax/tripCheckpointsViaTripId/tripTrailPlansViaTripId`.
- [ ] Dùng UUID nguồn đúng loại; không nhầm userId/memberId, inviteId/inviteCode, accessId/trailRef.
- [ ] Phân biệt CF01 yêu cầu hủy (`CANCEL_PENDING`) với CF03 hủy ngay (`CANCELLED`).

## 9. Nguồn đối chiếu trong repository

- `api/src/main.ts`: prefix, Swagger, error filter.
- `api/src/modules/trips/presentation/controllers/public-trip.controller.ts`, `private-trip.controller.ts`, `private-membership.controller.ts`: routes, quyền và HTTP status.
- `api/src/modules/trips/presentation/dtos/public-trip.dto.ts`, `private-trip.dto.ts`, `private-membership.dto.ts`: request schemas.
- `api/src/modules/trips/application/use-cases/public-trip.use-case.ts`, `private-trip.use-case.ts`, `private-membership.use-case.ts` và `application/trip.policy.ts`: nghiệp vụ.
- `api/src/modules/trips/infrastructure/adapters/prisma-trip.adapter.ts`, `prisma-private-trip.adapter.ts`, `prisma-private-membership.adapter.ts`: response và thay đổi trạng thái/version.
- `api/src/modules/trips/presentation/trip-error.filter.ts`, `private-invite-rate.guard.ts`, `api/src/shared/errors/`: lỗi và giới hạn lời mời.

Tài liệu được đối chiếu controller/DTO/use-case/adapter. OpenAPI và HTTP input/response CF01/CF03/CF04 đã được kiểm tra với dữ liệu giả lập; không thay thế kiểm thử end-to-end với Supabase/database thật. Không tạo dữ liệu test trong database dự án.
