# CF04 — Thiết kế API Private Trip Invite / Join

Trạng thái: API backend đã được triển khai ngày 2026-09-29; frontend invite/Room và auth returnTo chưa được triển khai trong lượt API này. Xem ghi chú triển khai ở cuối tài liệu.

Tài liệu này áp dụng các quyết định đã chốt với chủ sản phẩm, thay thế các điểm mâu thuẫn tương ứng trong requirement CF04 và thiết kế CF03 trước đây. Phần thiết kế ban đầu được tạo trước; phần backend được thực hiện ở lượt tiếp theo theo yêu cầu.

## 1. Phạm vi và invariant

- Private Trip dùng `Trip.tripType=PRIVATE`; không tạo entity Room, Booking thương mại hay Payment.
- Host có quyền qua `Trip.creatorId`. Khi tạo trip, cùng transaction tạo một `TripMember(role=HOST,status=ACTIVE,userId=creatorId)` để tính capacity. Membership HOST không phải điều kiện để creator được vào Room.
- `capacity = Trip.maxPax`; `activeMemberCount` đếm mọi membership ACTIVE, bao gồm HOST; `remainingSlots=max(0,capacity-activeMemberCount)`. Capacity=1 nghĩa là chỉ có Host.
- Có đúng một HOST, khớp creator; Host không join bằng invite, không leave, không bị remove, không chuyển quyền trong MVP.
- Chỉ account `role=USER,status=ACTIVE` được join/rejoin. Không dùng mã LEADER_CANNOT_CREATE_PRIVATE_TRIP cho join. LEADER, ADMIN và mọi STAFF đều nhận FORBIDDEN.
- Đọc Room/member list cần account ACTIVE và (creator hoặc membership ACTIVE). Role USER chỉ là điều kiện gia nhập; đổi role sau khi đã gia nhập không tự xóa membership hay quyền đọc. Nếu cần thu hồi quyền khi đổi role, đó là policy riêng cần bổ sung.
- Private Trip không được thuê đồ trong MVP, kể cả Host. Không sử dụng membership để cấp rental eligibility.
- Join/rejoin/leave/remove và tạo/revoke invite chỉ thay đổi dữ liệu khi trip OPEN và `serverNow < startAt`. Không chuyển PRIVATE sang FULL khi hết slot.
- Invite hợp lệ khi ACTIVE, chưa revoked, `serverNow < expiresAt < startAt`. Một invite ACTIVE mỗi trip. GET không cần ghi status EXPIRED; trạng thái hết hạn có thể tính lúc đọc.
- REMOVED bị chặn toàn trip, không phân biệt invite cũ/mới. Không có API phục hồi REMOVED trong MVP.
- LEFT được rejoin nếu đủ điều kiện. Dùng lại dòng membership vì unique `(tripId,userId)` áp dụng cho mọi status.
- Không auto-join khi mở link, preview, login hoặc đọc Room.
- `maxUses=null`; usedCount đếm số lần chuyển absent/LEFT -> ACTIVE qua invite, không giảm khi leave/remove và không tăng khi retry already-member. Không dùng usedCount tính capacity.

## 2. Quy ước chung

- Prefix thực tế `/api/v1`, khai báo một lần ở main.ts; controller không lặp prefix.
- Bearer auth qua shared guards. Join yêu cầu TrekGo User profile đã bootstrap; không dùng Supabase UID làm TripMember.userId.
- UUID cho trip/member; code là opaque, case-sensitive. Code mới của CF03 là randomBytes(32).toString('base64url'), dài 43 ký tự. DTO CF04 chấp nhận `[A-Za-z0-9_-]{32,120}` để không khóa cứng mã legacy; kiểm kê mã hiện hữu trước khi enforce. Không trim/đổi hoa-thường mã.
- Thời gian ISO8601 có timezone; mọi quyết định theo đồng hồ server/DB. Trong transaction lấy thời gian mới sau khi lấy lock, không dựa vào thời điểm request bắt đầu chờ lock.
- DTO strict, giới hạn độ dài và paging bằng shared ZodValidationPipe. Không nhận userId, role, tripType, status, usedCount từ client cho join.
- Thành công trả DTO JSON trực tiếp như CF03. Lỗi dùng AppError + GlobalErrorFilter, không tạo filter/envelope riêng.
- `isHost` nếu trả về chỉ là field tính toán từ creatorId, không thêm boolean vào DB bên cạnh role HOST.
- `redirectTo` luôn là đường dẫn do server tạo `/private-trips/{tripId}`, không lấy từ input.
- Các response preview/room/members/invite trả `Cache-Control: no-store`; frontend xóa dữ liệu private khi logout/403 hoặc account thay đổi.

## 3. Danh sách API

| Method | Path (sau /api/v1) | Quyền | Thành công |
| --- | --- | --- | --- |
| POST | /private-trips/:id/invitations | Host | 201, tạo/tạo lại lời mời |
| POST | /private-trips/:id/invitations/revoke | Host | 200, thu hồi lời mời hiện tại |
| GET | /private-trip-invitations/:code | Guest hoặc account bất kỳ | 200, preview tối thiểu |
| POST | /private-trip-invitations/:code/join | USER ACTIVE | 200, join/rejoin/already-member |
| GET | /private-trips/:id/room | Creator hoặc ACTIVE member | 200, Room context |
| GET | /private-trips/:id/members | Creator hoặc ACTIVE member | 200, danh sách phân trang |
| POST | /private-trips/:id/leave | ACTIVE MEMBER, không phải Host | 200, LEFT |
| DELETE | /private-trips/:id/members/:memberId | Host | 200, REMOVED; không hard-delete |

Hai API đầu mở rộng endpoint CF03 hiện có, không tạo controller có route trùng. Room là read API mới; giữ GET /private-trips/:id hiện tại là host-only để không vô tình nới quyền response cũ.

## 4. Contract chi tiết

### 4.1 Generate / regenerate invite

`POST /private-trips/:id/invitations`

```json
{ "expectedVersion": 5, "expiresAt": "2026-10-20T08:00:00+07:00" }
```

expectedVersion là Trip.version, bắt buộc integer >=1. expiresAt optional; mặc định giữ rule CF03: min(now+7 ngày,startAt-1 giây). Nếu không còn khoảng hợp lệ thì từ chối VALIDATION_ERROR. Body không nhận maxUses.

Response 201:

```json
{
  "inviteId": "<uuid>",
  "inviteCode": "<opaque-code>",
  "inviteUrl": "https://<configured-web-origin>/invite/<opaque-code>",
  "expiresAt": "2026-10-20T01:00:00.000Z",
  "status": "ACTIVE",
  "tripVersion": 6
}
```

Giữ các field CF03 cũ, bổ sung inviteId/inviteUrl. Origin lấy từ cấu hình deploy được kiểm soát, không dùng request Host/Origin tùy ý. Transaction vô hiệu mọi invite ACTIVE cũ trước khi tạo mới; increment Trip.version một lần. Retry với version cũ trả 409, không phát sinh mã thứ hai âm thầm.

### 4.2 Revoke

`POST /private-trips/:id/invitations/revoke`

Body: `{ "expectedVersion": 6 }`. Thu hồi lời mời hiện tại, không yêu cầu gửi secret code.

Response 200: `{ "tripId":"<uuid>", "revokedCount":1, "tripVersion":7 }`.

Không có ACTIVE invite: revokedCount=0, không increment version. Check owner, joinable state và expectedVersion trước thao tác. Retry dùng version cũ sau một revoke thực sự có thể trả 409; FE tải lại trip, không suy diễn lỗi là revoke chưa xảy ra. Đây là response mới: cập nhật CF03 FE đang coi kết quả revoke là nguyên Trip cùng lúc triển khai.

### 4.3 Public-minimal preview

`GET /private-trip-invitations/:code`; không cần Bearer, không trả dữ liệu tùy theo cookie/token.

```json
{
  "trip": {
    "id": "<uuid>", "tripType": "PRIVATE", "title": "Chuyến đi cuối tuần",
    "startAt": "2026-10-21T01:00:00.000Z", "endAt": "2026-10-22T10:00:00.000Z",
    "status": "OPEN", "host": { "displayName": "An" },
    "activeMemberCount": 3, "capacity": 5, "remainingSlots": 2
  },
  "invite": { "expiresAt": "2026-10-20T01:00:00.000Z", "status": "ACTIVE" },
  "joinable": true,
  "joinDisabledReason": null
}
```

Đầy chỗ: vẫn 200, joinable=false, joinDisabledReason=CAPACITY_CONFLICT. Đây chỉ là trạng thái preview, không phải cam kết giữ slot. Không trả image khi DB chưa có nguồn ảnh rõ; không thêm cột ảnh chỉ vì mockup. Không trả member list, userId của Host, pickup chính xác, route/checkpoint chi tiết, ghi chú private hoặc code khác.

Mã không tồn tại 404; revoked 410 INVITE_REVOKED; expired 410 INVITE_EXPIRED; trip không PRIVATE/không tồn tại 404; trip không OPEN/đã start 409 INVALID_STATE_TRANSITION. Lỗi không kèm trip context.

### 4.4 Join / rejoin / already-member

`POST /private-trip-invitations/:code/join`; Bearer bắt buộc; body rỗng hoặc `{}`. Không dùng expectedVersion của preview vì slot phải được xét lại trên server.

Response luôn 200 cho ba kết quả thành công:

```json
{
  "tripId": "<uuid>",
  "membership": {
    "id": "<uuid>", "role": "MEMBER", "status": "ACTIVE",
    "joinedAt": "2026-10-10T03:00:00.000Z", "version": 1
  },
  "alreadyMember": false,
  "rejoined": false,
  "isHost": false,
  "activeMemberCount": 4,
  "capacity": 5,
  "tripVersion": 8,
  "redirectTo": "/private-trips/<uuid>"
}
```

- ACTIVE: alreadyMember=true,rejoined=false, không thay đổi count/version/event. Không dùng lỗi MEMBERSHIP_EXISTS cho case này.
- LEFT -> ACTIVE: alreadyMember=false,rejoined=true; giữ membership.id, increment membership.version; joinedAt=now,leftAt=null,joinedByInviteId=invite hiện tại. Attendance reset NOT_MARKED, attendedAt/attendanceMarkedBy=null. Pickup mặc định theo Trip.pickupPointId tại thời điểm join/rejoin.
- Chưa tồn tại: tạo MEMBER ACTIVE, version=1.
- Creator USER gọi endpoint: không tạo membership thứ hai; trả HOST đã có với alreadyMember=true,isHost=true. Backfill HOST phải hoàn tất trước mở CF04.
- REMOVED: 403 FORBIDDEN với details.reason=MEMBER_REMOVED bất kể mã cũ/mới.
- COMPLETED/NO_SHOW: không tự chuyển ACTIVE qua CF04; 409 INVALID_STATE_TRANSITION.

Thứ tự để giải quyết mâu thuẫn expired/full với already-member:

1. Kiểm tra authentication, account ACTIVE và role USER.
2. Resolve code sang invite/trip PRIVATE (giữ lịch sử invite revoked/expired; không xóa code cũ).
3. Đọc membership: nếu creator hoặc ACTIVE, trả already-member không xét capacity/expiry/start. Không cấp thêm quyền: Room kiểm tra độc lập. Nếu REMOVED, trả FORBIDDEN.
4. Với người cần join/rejoin thực sự: kiểm tra trip OPEN/chưa start, invite chưa revoked, chưa expired, maxUses nếu có dữ liệu legacy hữu hạn, rồi capacity.
5. Ghi membership, usedCount, Trip.version và outbox cùng transaction; commit rồi trả response.

Mã hoàn toàn không tồn tại luôn 404, kể cả user là member của một trip khác. Preview public vẫn có thể trả 410, nhưng member có thể vào Room bằng URL đã biết; FE có thể cho user chủ động bấm “Mở chuyến đã tham gia” gọi endpoint join, không gọi tự động sau login. Đây là cách giữ rule không auto-join.

### 4.5 Room

`GET /private-trips/:id/room`.

```json
{
  "trip": {
    "id":"<uuid>", "tripType":"PRIVATE", "title":"Chuyến đi cuối tuần",
    "description":"...", "status":"OPEN", "version":8,
    "startAt":"2026-10-21T01:00:00.000Z", "endAt":"2026-10-22T10:00:00.000Z",
    "capacity":5, "activeMemberCount":4,
    "pickupPoint": { "id":"<uuid>", "name":"Điểm tập kết", "address":"...", "latitude":"10.0", "longitude":"106.0" }
  },
  "viewer": { "isHost":false, "membershipId":"<uuid>", "membershipVersion":1, "membershipStatus":"ACTIVE" },
  "permissions": { "canInvite":false, "canRemoveMembers":false, "canLeave":true, "canRent":false },
  "rental": { "eligible":false, "reason":"PRIVATE_TRIP_RENTAL_DISABLED" },
  "plannedRoutes": [],
  "requiredCheckpoints": []
}
```

plannedRoutes gồm id, sequence, sourceType PERSONAL/SYSTEM, tên/độ khó/distance/elevation/GeoJSON snapshot. requiredCheckpoints gồm id, sequence, name, description, latitude, longitude, radiusMeters, isRequired, isEnabled từ TripCheckpoint. Không trả source master owner, quyền TrailAccess, invite secret, email hoặc raw Prisma User.

Creator được đọc không phụ thuộc membership ACTIVE. Non-host phải ACTIVE. Permission canLeave/canInvite/canRemoveMembers chỉ true nếu đúng vai trò, trip OPEN và chưa start. Đọc không bị giới hạn trước start; các trạng thái membership sau completion thuộc execution flow, không mở rộng quyền non-ACTIVE ở CF04.

Không dùng quyền Room để gọi API PersonalTrail gốc; route chỉ được trả từ snapshot theo Trip context. Member không cần mua TrailAccess riêng.

### 4.6 Member list

`GET /private-trips/:id/members?status=ACTIVE&page=1&pageSize=20`.

- page>=1, pageSize 1..100, mặc định 20; sort joinedAt ASC,id ASC.
- Host được lọc các status hoặc `ALL`; non-host chỉ ACTIVE, yêu cầu status khác trả 403.
- Trả `{items:[{id,userId,displayName,role,status,joinedAt,version,isHost}],page,pageSize,total,activeMemberCount,capacity}`.
- Host xuất hiện đúng một lần từ membership HOST, không prepend thêm một dòng giả.
- Không trả phone/email/CCCD/authUserId/attendance private data/inviteCode. Kiểm tra quyền trước khi query/trả count.

### 4.7 Leave

`POST /private-trips/:id/leave`, body `{ "expectedMemberVersion": 2 }`.

Response 200: `{ "tripId":"<uuid>", "membershipId":"<uuid>", "status":"LEFT", "memberVersion":3, "tripVersion":9, "changed":true }`.

Host 403; không có membership 404; REMOVED 403; ACTIVE chỉ đổi trước start, OPEN. Increment member.version/trip.version, leftAt=now; slot được giải phóng. LEFT sẵn trả 200 changed=false, không ghi event/version lần nữa. Expected member version ngăn request leave cũ làm rời một lần rejoin mới; mismatch 409 MEMBERSHIP_VERSION_CONFLICT. FE xóa Room context khi leave thành công.

### 4.8 Remove

`DELETE /private-trips/:id/members/:memberId?expectedMemberVersion=2` (không dùng DELETE body).

Response 200: `{ "tripId":"<uuid>", "membershipId":"<uuid>", "status":"REMOVED", "memberVersion":3, "tripVersion":9, "changed":true }`.

Host-only; memberId phải thuộc đúng trip; không được target creator/HOST. ACTIVE -> REMOVED giải phóng slot; LEFT -> REMOVED cho phép Host chặn rejoin, không thay đổi active count. Chỉ trước start, OPEN. REMOVED sẵn trả changed=false, không event mới. COMPLETED/NO_SHOW bị từ chối. Kiểm tra expectedMemberVersion để tránh remove nhầm thế hệ membership vừa rejoin. Không hard-delete, không đưa status trở lại LEFT.

## 5. Error contract

```json
{
  "error": { "code":"CAPACITY_CONFLICT", "message":"Trip has no remaining slots", "details":{}, "retryable":false },
  "meta": { "requestId":"<id>", "serverTime":"2026-10-10T03:00:00.000Z", "contractVersion":"0.2.0-final-flow" }
}
```

details có thể không xuất hiện khi undefined theo GlobalErrorFilter hiện có. Không trả SQL error, stack trace, invite secret hoặc danh tính thành viên khác trong lỗi.

| HTTP | Code | Cách xử lý |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Payload/code/paging sai; sửa request |
| 401 | UNAUTHENTICATED | Login/refresh, giữ returnTo |
| 403 | FORBIDDEN | Sai role, REMOVED, Host leave/remove self, account inactive, thiếu quyền Room |
| 404 | NOT_FOUND | Resource không tồn tại, không PRIVATE, member không thuộc trip |
| 409 | CAPACITY_CONFLICT | Reload capacity; không tự retry liên tục |
| 409 | INVALID_STATE_TRANSITION | Trip đã start/không OPEN hoặc status membership không phù hợp |
| 409 | PRIVATE_TRIP_VERSION_CONFLICT | Giữ mã CF03 cho stale Trip.version |
| 409 | MEMBERSHIP_VERSION_CONFLICT | Tải lại member/version trước khi xác nhận lại leave/remove |
| 409 | INVITE_USAGE_LIMIT_REACHED | Chỉ cho invite legacy có maxUses hữu hạn đã hết lượt |
| 410 | INVITE_EXPIRED | Xin link mới |
| 410 | INVITE_REVOKED | Xin link mới |

Không dùng MEMBERSHIP_EXISTS vì duplicate ACTIVE là thành công idempotent. Các mã mới đăng ký trong shared/errors/codes/booking.error-codes.ts + ERROR_DEFINITIONS + barrel exports. Business exceptions dùng AppError; 404/409/410 không ném HttpException trần vì shared filter hiện chỉ map 400/401/403.

## 6. Transaction / concurrency

Mọi command CF03/CF04 ảnh hưởng trip phải phối hợp cùng mutex DB: khóa User của actor -> Trip -> Invite (nếu dùng) -> TripMember. Giữ thứ tự nhất quán với adapter CF03; không khóa user mục tiêu sau khi đã khóa Trip để tránh deadlock với join. Re-read invite và actor sau khi lấy lock, không dùng kết quả resolve ban đầu làm quyết định.

Join transaction SERIALIZABLE:

1. Resolve code để biết tripId, sau đó khóa/re-read các bản ghi trong transaction.
2. Kiểm tra theo thứ tự mục 4.4 và tính thời gian sau lock.
3. COUNT ACTIVE (gồm HOST) dưới lock Trip; nếu count>=maxPax từ chối.
4. Insert MEMBER hoặc update LEFT; increment usedCount một lần, trip.version một lần.
5. Insert PRIVATE_TRIP_MEMBER_JOINED vào BookingOutboxEvent trong cùng transaction.
6. Commit; response/redirect không phát trước commit.

Unique `(tripId,userId)` là lớp bảo vệ cuối, không thay thế kiểm tra status. Retry giới hạn cho serialization/deadlock; sau retry phải đọc lại và trả business error đúng. Hết retry trả PRIVATE_TRIP_VERSION_CONFLICT, không leak Prisma error.

Hai user tranh slot cuối: chỉ một join. Join đụng cancel/revoke/regenerate/shrink capacity: theo thứ tự transaction lấy lock; nếu revoke/cancel commit trước thì join mới không được thành công. Revoke không đá các member đã ACTIVE. Duplicate concurrent join cùng user chỉ tăng usedCount/event một lần.

Leave/remove/update capacity đều khóa cùng Trip. Update capacity CF03 đếm HOST cùng các ACTIVE members. Không tự khôi phục OPEN từ CANCELLED/IN_PROGRESS. Tất cả nguồn ghi membership sau này phải tuân thủ invariant này.

## 7. Event riêng của booking

Dùng BookingOutboxEvent, aggregateType=`PRIVATE_TRIP`, aggregateId=tripId. Không dùng RentalOutboxEvent/GpsOutboxEvent.

- PRIVATE_TRIP_MEMBER_JOINED (join và rejoin).
- PRIVATE_TRIP_MEMBER_LEFT.
- PRIVATE_TRIP_MEMBER_REMOVED.

Payload: `{schemaVersion:1,tripId,tripType:"PRIVATE",memberId,userId,actorId,memberRole,previousStatus,status,memberVersion,tripVersion,inviteId?,rejoined?,occurredAt}`. Không đưa inviteCode/route/PII vào event. deduplicationKey=`eventType:memberId:memberVersion` để phân biệt lần rejoin và chống xử lý trùng.

Outbox insert cùng transaction; publisher chỉ giao event đã commit, consumer dedupe. Notification là consumer tùy chọn; không cần chờ thông báo để trả join success. Không dùng MEMBER_JOINED để cấp quyền Rental cho PRIVATE. canRent=false ở FE không thay thế việc Rental API từ chối server-side; cần chốt hợp đồng với owner Rental, không tự sửa module đó trong CF04.

## 8. Auth return flow và UI routes

- Public route `/invite/{code}` phải được proxy cho phép mở khi guest. Dùng trang login có thật `/public/login`, không tạo thêm `/login` chỉ vì ví dụ requirement.
- Guest xem preview tối thiểu, bấm tiếp tục -> `/public/login?returnTo=<encoded /invite/code>`. Register/verify/refresh giữ nguyên returnTo, bootstrap TrekGo profile trước join.
- Chỉ allowlist returnTo nội bộ `/invite/<valid-code>`; từ chối absolute URL, `//host`, backslash, double-encoded redirect tricks. Server tạo redirectTo Room.
- Auth thành công quay lại preview, không POST join tự động. User bấm Join; nếu 401 thì login lại và giữ context, không tự gia nhập sau login.
- Room frontend `/private-trips/:tripId`; `/private-trips` hiện có vẫn là màn quản lý Host CF03.
- Người đã vào Room dùng URL Room trực tiếp, không phụ thuộc invite. Link expired không làm mất membership.
- Route/member list chỉ lấy sau khi API authorize. Chặn user REMOVED/LEFT ngay ở API mỗi request, không chỉ ẩn nút FE.
- Rate-limit preview/join theo IP và account; ngưỡng là cấu hình triển khai cần thống nhất, không hard-code trong nghiệp vụ. Redact code trong access log/telemetry, không đưa vào external analytics; trang invite đặt Referrer-Policy: no-referrer.

## 9. Thay đổi DB / tương thích CF03 cần làm khi triển khai

Không cần bảng mới cho Room hoặc membership. TripType PRIVATE/PUBLIC, TripMemberRole HOST/MEMBER và BookingOutboxEvent.aggregateType/eventType đã đủ phân biệt.

1. CF03 create: transaction tạo Trip + snapshot + membership HOST ACTIVE, joinedByInviteId=null. Chưa sửa bằng tài liệu này.
2. Preflight private trips cũ: thiếu HOST, nhiều HOST, creator đang có row MEMBER/LEFT/REMOVED, capacity sau bổ sung Host bị vượt. Không tự tăng capacity/xóa member/ghi đè status khi gặp bất thường; liệt kê và quyết định remediation trước backfill. Không tự gán ACTIVE cho trip CANCELLED/COMPLETED; quy tắc backfill lịch sử cần tách khỏi tập OPEN có thể join.
3. Backfill OPEN hợp lệ: tạo HOST nếu thiếu, giữ unique `(tripId,userId)`. Tài liệu triển khai phải ghi rõ số dòng sửa và transaction. Room giữ creator access trong giai đoạn nâng cấp.
4. Đề xuất partial unique `(trip_id) WHERE status='ACTIVE'` trên private_trip_invites và `(trip_id) WHERE role='HOST'` trên trip_members. Kiểm kê duplicate trước, không xóa lịch sử. Expired nhưng status ACTIVE phải chuyển EXPIRED/revoke trong transaction generate trước insert. Index không tự đánh giá expiry theo thời gian.
5. Enum/field không đảm bảo HOST.userId=Trip.creatorId; enforce ở command transaction và test. Không thêm isHost DB trùng nghĩa. TripMember đã có version/leftAt, không cần bảng ban riêng vì REMOVED chặn toàn trip.
6. Không cần trường removedBy/reason ngay cho contract MVP; actor/time và transition audit nằm trong outbox. Nếu cần audit lưu trữ dài hạn độc lập với retention outbox thì thiết kế bổ sung sau, không coi outbox là lịch sử vĩnh viễn.
7. Các migration mới additive, chạy sau khi review preflight. Không reset DB hoặc sửa migration đã áp dụng.

## 10. Cấu trúc triển khai dự kiến

Giữ module trips hiện tại và shared:

- presentation/controllers/private-trip-invitation.controller.ts: public preview + authenticated join, khai báo Auth rõ từng handler.
- presentation/controllers/private-trip-membership.controller.ts: Room, member list, leave, remove.
- presentation/dtos/private-trip-membership.dto.ts: strict validation, Swagger request/response DTO.
- application/use-cases/private-trip-membership.use-case.ts và port: orchestrate permissions, state, command/query contract; không đặt Prisma trong application.
- infrastructure/adapters/prisma-private-trip-membership.adapter.ts: atomic persistence, locks, snapshot projection, outbox.
- Mở rộng controller/port/use-case CF03 hiện hữu cho invite response và HOST; không duplicate route hoặc làm lại auth.
- Web dùng feature trips và auth shared; error đọc response.data.error. Thay đổi auth returnTo phải phối hợp đúng owner.

## 11. Acceptance tests tối thiểu

Gom theo nhóm trong ít file test, không dựng nhiều harness:

1. Create CF03 có đúng một HOST, capacity=1 không cho khách join; Host vào Room không cần invite.
2. Preview guest không auto-join, không expose route/member/PII; expired/revoked/invalid không leak trip context.
3. Login/register/verify/expired session giữ returnTo hợp lệ; external returnTo bị từ chối.
4. USER ACTIVE join thành công: member+usedCount+tripVersion+outbox đúng; role khác/inactive/missing profile bị chặn.
5. Hai user tranh slot cuối; duplicate concurrent request cùng user; retry response đã mất không tạo event mới.
6. ACTIVE gọi lại với known code đã revoked/expired hoặc trip full/started được already-member; user chưa là member không được join.
7. LEFT rejoin cùng row, version tăng; REMOVED dùng code mới vẫn FORBIDDEN; Host không leave/remove self.
8. Leave/remove giải phóng slot; stale leave/remove sau rejoin trả version conflict; action thực sự sau start bị chặn.
9. Join race với revoke/cancel/shrink capacity giữ invariant; thời gian được xét sau lock.
10. Room/member list authorize mọi request; removed/left/outsider không đọc snapshot; member không xem danh sách status khác ACTIVE.
11. GlobalErrorFilter trả đúng error/meta cho 400/401/403/404/409/410; không dùng filter CF01 riêng.
12. PRIVATE luôn canRent=false; phối hợp test Rental API từ chối PRIVATE, không gọi đó là hoàn tất nếu mới chặn FE.

## 12. Thứ tự triển khai

Schema preflight/backfill HOST -> migration indexes -> chỉnh CF03 atomic HOST/invite DTO -> CF04 backend + transaction tests -> Auth returnTo + preview/Room frontend -> test tích hợp thực tế. Không tuyên bố auth/Rental consumer đã tích hợp chỉ vì đã tạo outbox hay field canRent.

## 13. Ghi chú triển khai backend

- Sáu route mới nằm trong `PrivateMembershipController`; hai route invite cũ được mở rộng trong `PrivateTripController`, không trùng route. Backend dùng cùng TripsModule, SharedModule, ZodValidationPipe, AppError và GlobalErrorFilter.
- CF03 create nay tạo HOST/ACTIVE atomically. New join từ chối nếu trip OPEN thiếu HOST/ACTIVE để tránh lệch capacity khi ứng dụng cũ còn chạy trong giai đoạn deploy.
- SQL migration `20260929120000_cf04_private_membership` kiểm tra dữ liệu, backfill OPEN hợp lệ và thêm hai partial unique index. Không thêm entity Room, không sửa migration cũ. Hai index SQL được chú thích trong Prisma schema vì Prisma 6 không mô tả partial unique bằng @@unique thông thường.
- `WEB_APP_ORIGIN` phải là origin web tuyệt đối, không có path/query/credentials, ví dụ `https://app.example.com`. Production thiếu biến này sẽ từ chối generate link thay vì trả link sai. Development mặc định `http://localhost:3001`; cấu hình lại theo port web thực tế. Không tự sửa .env của người dùng.
- Revoke trả `{tripId,revokedCount,tripVersion}`. Client CF03 hiện hữu đã được chuyển đổi response này về local Trip để tránh làm hỏng màn quản lý cũ.
- Rate guard CF04: preview 60/phút/IP; join 30/phút/IP và account, mã `429 INVITE_RATE_LIMITED` + Retry-After; không dùng code/token làm bucket key. Đây là rate limit mỗi process, không thay thế gateway/shared limiter cho triển khai nhiều instance. Cấu hình trusted proxy và log redaction ở hạ tầng vẫn cần được kiểm tra khi deploy.
- `BookingOutboxEvent` chỉ lưu event PENDING, chưa có publisher/consumer mới trong scope này. Không ghi secret invite vào payload.
- Repository Rental hiện chỉ có catalog/inventory, chưa có API rental-order/eligibility để nối guard PRIVATE. Room luôn trả canRent/eligible=false; owner Rental phải giữ quy tắc từ chối PRIVATE khi triển khai order, không suy ra eligibility từ ACTIVE membership.
- Không sửa auth mock hay xây UI invite/Room trong lượt triển khai API. `inviteUrl`/`redirectTo` là contract cho FE; chưa xác nhận các trang đó chạy được end-to-end.
- Chạy test: `CF04_TEST_DATABASE_URL=postgresql://...@127.0.0.1:PORT/cf04_test npm run test:cf04` (PowerShell đặt biến env riêng). Test từ chối host remote và database khác. Một file `test/cf04.spec.ts` bao gồm PostgreSQL integration, concurrency, migration rollback và HTTP với shared guards; chỉ Supabase token verification được mock.
- Production có migrations Media mới chưa có trong source local: `20260928164318_media_foundation`, `20260928170115_media_foundation_hardening`. Không tự xóa/resolve/ghi đè; cần lấy migration từ owner Media để đồng bộ repository. Không tuyên bố toàn bộ schema production khớp local.
- Kết quả xác minh 2026-09-29: CF04 15/15 test đạt; CF03 10/10 đạt; unit test hiện có 26/26 đạt; API TypeScript, lint file mới, Prisma validate và lint service web sửa tương thích đều đạt. Không chạy test ghi dữ liệu trên production.
- Migration CF04 đã áp dụng production, finished_at được xác minh; hai index `private_trip_one_active_invite` và `trip_member_one_host` tồn tại đúng predicate. Trước/sau có 0 private trips và 0 HOST, không có backfill dữ liệu thực tế. Chưa deploy API/web application hoặc commit/push source.
