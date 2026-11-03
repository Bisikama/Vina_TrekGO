# ĐẶC TẢ KỸ THUẬT API VÀ LUỒNG NGHIỆP VỤ: PRIVATE TRIP (CHUYẾN ĐI RIÊNG TƯ)

> Tài liệu chuẩn dành cho Developer và AI Agent để phát triển tính năng Private Trip (CF03 & CF04) trên ứng dụng Mobile của Vina TrekGO.

---

## 1. TỔNG QUAN VÀ QUY ƯỚC CHUNG

- **Base URL:** `https://api.yourdomain.com/api/v1` (cấu hình qua biến môi trường `API_URL`).
- **Authentication:**
  - Header chuẩn: `Authorization: Bearer <accessToken>`
  - Riêng endpoint preview lời mời (`GET /private-trip-invitations/:code`): Công khai, không gửi token.
- **Tài khoản sử dụng:**
  - Người tạo chuyến (Host) và người tham gia (Member) đều là tài khoản có role `USER` ở trạng thái `ACTIVE`.
  - Tài khoản `LEADER` **không được phép** tạo hoặc tham gia private trip (sẽ trả lỗi `403 LEADER_CANNOT_CREATE_PRIVATE_TRIP`).
- **Quy ước Response thành công:**
  - Dữ liệu trả về trực tiếp trong `response.data` (object hoặc array).
- **Quy ước Response lỗi chuẩn (HTTP 4xx / 5xx):**
  ```json
  {
    "error": {
      "code": "MA_LOI",
      "message": "Thông báo lỗi chi tiết cho người dùng",
      "details": null,
      "retryable": false
    },
    "meta": {
      "requestId": "uuid",
      "serverTime": "2026-10-14T23:00:00.000Z",
      "contractVersion": "0.2.0-final-flow"
    }
  }

  Lưu ý cho Mobile: Khi bắt lỗi (try/catch), luôn đọc thông báo lỗi từ error.response.data.error.message và mã lỗi từ error.response.data.error.code.

2. QUY TẮC NGHIỆP VỤ BẮT BUỘC (BUSINESS RULES)
Khóa chống xung đột phiên bản (Optimistic Concurrency Control):
Trip Version (expectedVersion): Mọi thao tác sửa chuyến, tạo mã mời, thu hồi mã mời, hủy chuyến đều phải gửi expectedVersion tương ứng với version hiện tại của Trip.
Member Version (expectedMemberVersion): Thao tác rời nhóm (leave) hoặc loại thành viên (remove) phải gửi expectedMemberVersion lấy từ version của Membership của người đó, KHÔNG ĐƯỢC lấy version của Trip.
Khi gặp lỗi HTTP 409 (PRIVATE_TRIP_VERSION_CONFLICT hoặc MEMBERSHIP_VERSION_CONFLICT), client phải tải lại dữ liệu mới nhất từ server rồi mới cho phép người dùng thao tác lại.
Quy tắc Sĩ số (capacity):
capacity tính luôn cả Host. Ví dụ nếu tạo chuyến có capacity = 5, thì Host chiếm 1 chỗ, chỉ còn 4 chỗ cho bạn bè tham gia.
Khi chỉnh sửa chuyến, không được giảm capacity thấp hơn số thành viên đang ACTIVE.
Quyền hạn trong chuyến đi:
Người tạo chuyến có role là HOST, bạn bè tham gia có role là MEMBER.
HOST không thể tự rời chuyến bằng API leave (muốn dừng phải dùng API hủy chuyến cancel).
Thành viên bị Host loại (REMOVED) sẽ không thể dùng link mời để tự join lại.
Trạng thái chuyến:
Private Trip tạo thành công sẽ có trạng thái OPEN ngay lập tức (không có bước Draft/Publish như Public Trip).
Chỉ được sửa thông tin, tạo lời mời, tham gia, rời nhóm hoặc hủy chuyến khi chuyến đang ở trạng thái OPEN và thời điểm hiện tại chưa đến giờ bắt đầu (startAt).
Rate Limiting:
API xem trước lời mời (preview): Giới hạn 60 request/phút/IP.
API xác nhận tham gia (join): Giới hạn 30 request/phút/IP.
3. CÁC KIỂU DỮ LIỆU CỐT LÕI (DATA MODELS / TYPES)
typescript
export type TripStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MemberRole = 'HOST' | 'MEMBER';
export type MemberStatus = 'ACTIVE' | 'LEFT' | 'REMOVED' | 'COMPLETED' | 'NO_SHOW';
export interface CheckpointItem {
  id: string;
  name: string;
  sequence: number;
  latitude?: number;
  longitude?: number;
}
export interface PrivateTrailSource {
  id: string; // personal trail ID hoặc systemTrailId
  type: 'PERSONAL' | 'SYSTEM';
  name: string;
  destinationId: string;
  points: CheckpointItem[];
}
export interface PrivateTrip {
  id: string;
  title: string;
  description: string | null;
  startAt: string; // ISO 8601
  endAt: string;   // ISO 8601
  maxPax: number;  // capacity
  pickupPointId: string;
  destinationId: string;
  status: TripStatus;
  version: number;
}
export interface TripMember {
  id: string;       // membershipId (Dùng để kick/leave)
  userId: string;   // userId của tài khoản
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  version: number;
  displayName: string;
  isHost: boolean;
  avatarUrl?: string | null;
}
4. DANH SÁCH CHI TIẾT CÁC ENDPOINT API
NHÓM A: DỮ LIỆU ĐẦU VÀO ĐỂ TẠO CHUYẾN
1. Lấy danh sách Cung đường cá nhân (Personal Trails)
Endpoint: GET /me/personal-trails
Auth: Bearer Token
Query Params: page (integer, mặc định 1)
Response thành công (200):
json
[
  {
    "id": "c1f7a0b3-1111-4a1a-8e2b-111111111111",
    "title": "Cung đường tự vẽ Núi Chứa Chan",
    "destinationId": "d2e3f4a5-0000-4b2b-9c3c-000000000000",
    "personalCheckpointsViaPersonalTrailId": [
      { "id": "cp-1", "name": "Chân núi", "sequence": 1 },
      { "id": "cp-2", "name": "Chùa Gia Lào", "sequence": 2 },
      { "id": "cp-3", "name": "Đỉnh núi", "sequence": 3 }
    ]
  }
]
2. Lấy danh sách Cung đường hệ thống đã mua quyền (System Trails)
Endpoint: GET /me/trail-accesses
Auth: Bearer Token
Query Params: page (integer, mặc định 1)
Response thành công (200):
json
[
  {
    "systemTrailId": "s9a8b7c6-2222-4a2a-8e3b-222222222222",
    "systemTrail": {
      "id": "s9a8b7c6-2222-4a2a-8e3b-222222222222",
      "name": "Tà Năng - Phan Dũng Chuẩn",
      "destinationId": "d3e4f5a6-0000-4b2b-9c3c-111111111111",
      "trailCheckpointsViaSystemTrailId": [
        {
          "sequence": 1,
          "checkpoint": {
            "id": "cp-sys-1",
            "name": "Bìa rừng Tà Năng",
            "status": "ACTIVE",
            "destinationId": "d3e4f5a6-0000-4b2b-9c3c-111111111111"
          }
        }
      ]
    }
  }
]
(Lưu ý: Chỉ chọn các checkpoint có status === 'ACTIVE')
3. Lấy Điểm tập kết theo Địa điểm (Pickup Points)
Endpoint: GET /private-trip-options/pickup-points
Auth: Bearer Token
Query Params:
destinationId (bắt buộc, UUID)
page (integer, mặc định 1)
Response thành công (200):
json
[
  { "id": "pk-1", "name": "Bến xe Miền Đông Mới" },
  { "id": "pk-2", "name": "Ngã tư Hàng Xanh" }
]
NHÓM B: QUẢN LÝ CHUYẾN ĐI (DÀNH CHO HOST)
4. Tạo chuyến đi riêng mới
Endpoint: POST /private-trips
Auth: Bearer Token
Request Body:
json
{
  "type": "PERSONAL", // "PERSONAL" hoặc "SYSTEM"
  "trailRef": "c1f7a0b3-1111-4a1a-8e2b-111111111111", // ID trail cá nhân hoặc systemTrailId
  "destinationId": "d2e3f4a5-0000-4b2b-9c3c-000000000000",
  "title": "Cuối tuần leo Chứa Chan",
  "description": "Mang theo lều và nước uống", // Tối đa 5000 ký tự (tuỳ chọn)
  "startAt": "2026-11-20T06:00:00+07:00", // Tương lai
  "endAt": "2026-11-20T18:00:00+07:00",   // Sau startAt
  "pickupPointId": "pk-1",
  "capacity": 5, // int từ 1 - 2147483647 (đã bao gồm host)
  "checkpointIds": ["cp-1", "cp-2", "cp-3"] // Thứ tự theo sequence của trail
}
Response thành công (201):
json
{
  "id": "trip-uuid-123",
  "title": "Cuối tuần leo Chứa Chan",
  "description": "Mang theo lều và nước uống",
  "startAt": "2026-11-20T06:00:00.000Z",
  "endAt": "2026-11-20T18:00:00.000Z",
  "maxPax": 5,
  "pickupPointId": "pk-1",
  "destinationId": "d2e3f4a5-0000-4b2b-9c3c-000000000000",
  "status": "OPEN",
  "version": 1
}
5. Danh sách chuyến đi do mình tạo
Endpoint: GET /private-trips
Auth: Bearer Token
Query Params: page (mặc định 1)
Response thành công (200): Array PrivateTrip[].
6. Chi tiết chuyến đi dành cho Host
Endpoint: GET /private-trips/{id}
Auth: Bearer Token (Chỉ creator mới được gọi, thành viên gọi API Room)
Response thành công (200):
json
{
  "id": "trip-uuid-123",
  "title": "Cuối tuần leo Chứa Chan",
  "description": "Mang theo lều và nước uống",
  "startAt": "2026-11-20T06:00:00.000Z",
  "endAt": "2026-11-20T18:00:00.000Z",
  "maxPax": 5,
  "status": "OPEN",
  "version": 1,
  "tripTrailPlansViaTripId": [
    {
      "snapshotName": "Tên tuyến",
      "snapshotGeojson": { "type": "FeatureCollection", "features": [] }
    }
  ],
  "tripCheckpointsViaTripId": [
    { "id": "tcp-1", "name": "Trạm 1", "sequence": 1, "latitude": 10.9, "longitude": 107.3 }
  ]
}
7. Cập nhật thông tin chuyến đi
Endpoint: PATCH /private-trips/{id}
Auth: Bearer Token
Request Body:
json
{
  "expectedVersion": 1, // BẮT BUỘC
  "title": "Tiêu đề mới",
  "description": "Mô tả mới",
  "startAt": "2026-11-20T07:00:00+07:00",
  "endAt": "2026-11-20T19:00:00+07:00",
  "capacity": 6,
  "pickupPointId": "pk-2"
}
Response thành công (200): Object PrivateTrip với version mới tăng lên 1 đơn vị.
8. Tạo mã mời / Link mời bạn bè
Endpoint: POST /private-trips/{id}/invitations
Auth: Bearer Token
Request Body:
json
{
  "expectedVersion": 1, // version hiện tại của trip
  "expiresAt": "2026-11-19T23:59:59+07:00" // Tuỳ chọn, phải trước startAt
}
Response thành công (201):
json
{
  "inviteId": "uuid-invite",
  "inviteCode": "b6a8f192c730419dbfae82937512a43b",
  "inviteUrl": "https://vinatrekgo.vn/invite/b6a8f192c730419dbfae82937512a43b",
  "expiresAt": "2026-11-19T16:59:59.000Z",
  "status": "ACTIVE",
  "tripVersion": 2
}
(Khi tạo mã mới, server tự thu hồi mã cũ và tăng version của Trip lên 1)
9. Thu hồi mã mời
Endpoint: POST /private-trips/{id}/invitations/revoke
Auth: Bearer Token
Request Body: {"expectedVersion": 2}
Response thành công (200): {"tripId": "uuid", "revokedCount": 1, "tripVersion": 3}
10. Hủy chuyến đi
Endpoint: POST /private-trips/{id}/cancel
Auth: Bearer Token
Request Body:
json
{
  "expectedVersion": 2,
  "reason": "Thời tiết xấu nên hủy" // Tối đa 2000 ký tự
}
Response thành công (201): Object PrivateTrip với status: "CANCELLED".
NHÓM C: THÀNH VIÊN, LỜI MỜI VÀ PHÒNG CHỜ
11. Xem trước lời mời (Public Preview)
Endpoint: GET /private-trip-invitations/{code}
Auth: Không gửi token
Rate Limit: 60 req/phút
Response thành công (200):
json
{
  "trip": {
    "id": "trip-uuid-123",
    "tripType": "PRIVATE",
    "title": "Cuối tuần leo Chứa Chan",
    "startAt": "2026-11-20T06:00:00.000Z",
    "endAt": "2026-11-20T18:00:00.000Z",
    "status": "OPEN",
    "host": { "displayName": "Nguyễn Văn Host" },
    "activeMemberCount": 2,
    "capacity": 5,
    "remainingSlots": 3
  },
  "invite": {
    "expiresAt": "2026-11-19T16:59:59.000Z",
    "status": "ACTIVE"
  },
  "joinable": true,
  "joinDisabledReason": null
}
(Nếu link hết hạn hoặc đã thu hồi, trả về HTTP 410 INVITE_EXPIRED hoặc INVITE_REVOKED)
12. Xác nhận tham gia chuyến đi
Endpoint: POST /private-trip-invitations/{code}/join
Auth: Bearer Token (User phải đăng nhập)
Rate Limit: 30 req/phút
Request Body: {} (object rỗng)
Response thành công (200):
json
{
  "tripId": "trip-uuid-123",
  "membership": {
    "id": "membership-uuid-999",
    "role": "MEMBER",
    "status": "ACTIVE",
    "joinedAt": "2026-10-14T23:10:00.000Z",
    "version": 1
  },
  "alreadyMember": false,
  "rejoined": false,
  "isHost": false,
  "activeMemberCount": 3,
  "capacity": 5,
  "tripVersion": 4,
  "redirectTo": "/private-trips/trip-uuid-123"
}
13. Xem Phòng chờ chuyến đi (Trip Room)
Endpoint: GET /private-trips/{id}/room
Auth: Bearer Token (Chỉ Host hoặc Member ACTIVE)
Response thành công (200):
json
{
  "trip": {
    "id": "trip-uuid-123",
    "title": "Cuối tuần leo Chứa Chan",
    "status": "OPEN",
    "startAt": "2026-11-20T06:00:00.000Z",
    "endAt": "2026-11-20T18:00:00.000Z",
    "capacity": 5,
    "activeMemberCount": 3,
    "pickupPoint": {
      "id": "pk-1",
      "name": "Bến xe Miền Đông Mới",
      "address": "TP. Thủ Đức, TP. HCM"
    }
  },
  "viewer": {
    "isHost": false,
    "membershipId": "membership-uuid-999",
    "membershipVersion": 1,
    "membershipStatus": "ACTIVE"
  },
  "permissions": {
    "canInvite": false,
    "canRemoveMembers": false,
    "canLeave": true,
    "canRent": false
  },
  "plannedRoutes": [],
  "requiredCheckpoints": []
}
(Dùng các cờ trong permissions để ẩn/hiện nút Mời, Rời nhóm, Xóa thành viên)
14. Lấy danh sách thành viên trong chuyến đi
Endpoint: GET /private-trips/{id}/members
Auth: Bearer Token
Query Params:
page (mặc định 1)
pageSize (mặc định 20)
status: Mặc định ACTIVE (Thành viên chỉ xem được ACTIVE; Host có thể truyền ALL hoặc LEFT, REMOVED)
Response thành công (200):
json
{
  "items": [
    {
      "id": "membership-uuid-host",
      "userId": "user-uuid-1",
      "role": "HOST",
      "status": "ACTIVE",
      "joinedAt": "2026-10-14T20:00:00.000Z",
      "version": 1,
      "displayName": "Nguyễn Văn Host",
      "isHost": true
    },
    {
      "id": "membership-uuid-999",
      "userId": "user-uuid-2",
      "role": "MEMBER",
      "status": "ACTIVE",
      "joinedAt": "2026-10-14T23:10:00.000Z",
      "version": 1,
      "displayName": "Trần Thị Bạn",
      "isHost": false
    }
  ],
  "total": 2,
  "page": 1,
  "pageSize": 20,
  "activeMemberCount": 2,
  "capacity": 5
}
15. Thành viên tự rời nhóm
Endpoint: POST /private-trips/{id}/leave
Auth: Bearer Token (Chỉ Member ACTIVE, Host không được rời)
Request Body:
json
{
  "expectedMemberVersion": 1 // Lấy từ viewer.membershipVersion
}
Response thành công (200):
json
{
  "tripId": "trip-uuid-123",
  "membershipId": "membership-uuid-999",
  "status": "LEFT",
  "memberVersion": 2,
  "tripVersion": 5,
  "changed": true
}
16. Host loại thành viên khỏi chuyến đi
Endpoint: DELETE /private-trips/{id}/members/{memberId}?expectedMemberVersion={version}
Auth: Bearer Token (Chỉ Host được gọi, không được xóa Host)
Path Params:
id: UUID của Trip
memberId: UUID của Membership (chính là item.id trong danh sách members, KHÔNG PHẢI userId)
Query Params:
expectedMemberVersion (bắt buộc, integer, lấy từ item.version của member đó)
Response thành công (200):
json
{
  "tripId": "trip-uuid-123",
  "membershipId": "membership-uuid-999",
  "status": "REMOVED",
  "memberVersion": 2,
  "tripVersion": 6,
  "changed": true
}
5. BẢNG MÃ LỖI THƯỜNG GẶP (ERROR CODES)
HTTP Code	Error Code	Giải thích và Hành động trên Mobile
400	VALIDATION_ERROR	Dữ liệu gửi lên sai định dạng (kiểm tra ngày tháng, capacity < 1, thiếu trường...).
401	UNAUTHENTICATED	Hết hạn token, yêu cầu đăng nhập lại.
403	LEADER_CANNOT_CREATE_PRIVATE_TRIP	Tài khoản Leader không được tham gia luồng Private Trip.
403	TRAIL_ACCESS_REQUIRED	User chưa sở hữu quyền truy cập System Trail này.
403	FORBIDDEN / MEMBER_REMOVED	Người dùng đã từng bị Host loại nên không thể tham gia lại.
404	NOT_FOUND	Chuyến đi hoặc thành viên không tồn tại.
409	PRIVATE_TRIP_VERSION_CONFLICT	Phiên bản chuyến đi đã bị thay đổi bởi người khác. Hãy reload lại dữ liệu.
409	MEMBERSHIP_VERSION_CONFLICT	Phiên bản thành viên đã thay đổi. Hãy reload danh sách thành viên.
409	CAPACITY_CONFLICT	Chuyến đi đã đủ người, không còn slot trống.
409	INVALID_STATE_TRANSITION	Chuyến đi đã bắt đầu hoặc không còn ở trạng thái OPEN.
410	INVITE_EXPIRED / INVITE_REVOKED	Lời mời đã hết hạn hoặc bị Host thu hồi.
429	INVITE_RATE_LIMITED	Gọi link quá nhiều lần trong thời gian ngắn. Chờ theo số giây trong header Retry-After.
6. THIẾT KẾ MÀN HÌNH VÀ LUỒNG ĐIỀU HƯỚNG TRÊN MOBILE
[Màn hình My Trips]
  ├── Nút (+) ──> [Màn hình Tạo Chuyến Đi] ──(Tạo thành công)──> [Màn hình Chi tiết Chuyến]
  └── Chọn 1 chuyến ──> [Màn hình Chi tiết Chuyến]
                            ├── Bấm "Mã Mời" ──> Mở Share Sheet (Gửi link/code qua Zalo/Messenger)
                            ├── Bấm "Vào phòng chờ" ──> [Màn hình Trip Room]
                            └── Bấm "Hủy chuyến" ──> Popup xác nhận ──> Quay về My Trips
[Người nhận được Link chia sẻ]
  └── Mở DeepLink / Paste Mã ──> [Màn hình Preview Lời Mời]
                                      └── Bấm "Tham Gia" ──(Thành công)──> [Màn hình Trip Room]
Yêu cầu UI từng màn hình:
Màn hình My Trips:
Tabs: "Sắp tới", "Đã hoàn thành", "Đã hủy".
Mỗi card chuyến đi gồm: Tên, ngày giờ khởi hành, sĩ số (vd: 3/5 người), badge trạng thái.
Màn hình Tạo Chuyến Đi (Create Private Trip):
Bước 1: Dropdown/BottomSheet chọn Tuyến đường (gọi cả 2 API Personal Trails & System Trail Accesses). Hiển thị danh sách trạm dừng (checkpoints).
Bước 2: Nhập Tên chuyến, Mô tả, Ngày giờ bắt đầu & Kết thúc (Date/Time Picker).
Bước 3: Nhập Sĩ số (tối thiểu 1, mặc định 5), Dropdown chọn Điểm đón (Pickup).
Nút "Tạo chuyến đi" có loading state.
Màn hình Chi Tiết Chuyến (Host View):
Thông tin tổng quan, thời gian, điểm tập kết, danh sách trạm dừng.
Nút "Chia sẻ lời mời": Gọi API tạo invite rồi kích hoạt Share Sheet (Native Share) của điện thoại.
Nút "Phòng chờ": Chuyển sang Trip Room.
Nút "Hủy chuyến": Dialog màu đỏ kèm ô nhập lý do hủy.
Màn hình Preview Lời Mời (Invite Landing Screen):
Hiển thị card thư mời sang trọng: Tên chuyến, Host, ngày giờ, số chỗ còn trống (remainingSlots).
Nếu joinable === false: Nút tham gia bị disable kèm lý do (ví dụ: "Chuyến đi đã hết chỗ").
Nếu chưa đăng nhập: Nút chuyển sang màn hình Đăng nhập.
Nếu đã đăng nhập: Nút "Xác nhận tham gia" gọi POST .../join.
Màn hình Phòng Chờ Chuyến Đi (Trip Room):
Hiển thị danh sách thành viên tham gia (Avatar, Tên, Badge "Trưởng đoàn" hoặc "Thành viên").
Đối với Member: Nút "Rời chuyến đi" màu đỏ ở góc trên/dưới.
Đối với Host: Bên cạnh mỗi thành viên có icon Thùng rác/Gạch chéo để loại thành viên khỏi chuyến (DELETE .../members/{memberId}).