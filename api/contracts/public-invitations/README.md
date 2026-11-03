# Public participant invitations — M6

Ngày 24/10/2026. Trạng thái **DONE_LOCAL**, chưa VERIFIED_ENV/DEPLOYED. Gói backend và hướng tích hợp, không có UI mới.

- [OpenAPI](../openapi/public-invitations.json): sáu operation mới và phần projection bổ sung cho booking detail.
- [Request HTTP](./requests.http): thay biến bằng môi trường/account test của bạn; không chứa token thật.
- [Response thực tế từ fixture local](./examples.local.json): dữ liệu tổng hợp, UUID/timestamp chỉ minh họa. `buyerParticipants` thuộc response riêng của buyer; không gửi phần này cho recipient.
- [Contract vé/self-claim M5](../public-tickets/README.md).

## Routes và quyền

Prefix `/api/v1`. Bearer token, account USER hoặc LEADER ACTIVE. Sender là buyer hiện tại của booking; recipient là account đã lưu khi gửi, không tìm lại bằng email khi accept.

| Method/path sau prefix | Body/query | Kết quả |
|---|---|---|
| POST /bookings/:id/participants/:pid/invitations | recipientEmail, expiresAt?; bắt buộc Idempotency-Key | 201 invitation snapshot, Idempotency-Replayed true/false |
| GET /me/booking-participant-invitations | page=1, pageSize=20 (1–50), status? | items/page/pageSize/total/totalPages; chỉ recipient hiện tại |
| GET /booking-participant-invitations/:id | Không body | 200 preview tối thiểu cho sender còn sở hữu booking hoặc recipient |
| POST /booking-participant-invitations/:id/accept | confirmParticipantIdentity:true | 200 invitation/currentAccess/ticketId; chỉ recipient |
| POST /booking-participant-invitations/:id/decline | reason? | 200 DECLINED; chỉ recipient |
| POST /booking-participant-invitations/:id/revoke | {} | 200 REVOKED; chỉ sender còn sở hữu booking |
| GET /bookings/:id (API có sẵn) | Không body | Buyer-only detail, bổ sung linkage và invitation history vào từng participant |

DTO strict, UUID hợp lệ, không nhận senderUserId/recipientUserId/userId từ body. Email được trim/lowercase; email không tồn tại, account không phù hợp hoặc nhiều bản ghi trùng email chuẩn hóa đều trả lỗi trung tính. Gửi cho chính buyer trả 400 với details.reason=USE_SELF_CLAIM. Đổi email sau khi gửi không chuyển quyền nhận.

Mọi API invitation trả Cache-Control: no-store. Preview/list/action không trả bookingId, payment, invoice, QR, số giấy tờ, phone hoặc contact người đi. Chỉ trả tên hiển thị sender/recipient, tên người trên vé, lịch/địa điểm và trạng thái tối thiểu. `ticketId` chỉ có khi invitation ACCEPTED và participant đang liên kết chính actor; buyer dùng participantId trong booking để quản lý, không dùng API vé riêng của recipient.

## Điều kiện và vòng đời

Create/accept mới cần booking CONFIRMED; participant ACTIVE, chưa check-in, chưa linked; trip PUBLIC OPEN/FULL/CLOSED và thời gian DB trước startAt. CLOSED do hết hạn đăng ký vẫn được nhận vé đã thanh toán trước giờ đi. Đây là nhận quyền trên chỗ đã mua, không mở thêm chỗ đăng ký.

Expiry = min(expiresAt yêu cầu hoặc DB now + TTL, DB now + TTL, startAt - 1 giây). TTL mặc định 7 ngày; expiresAt phải có timezone và còn tương lai. Chống trùng participant ACTIVE của cùng account/trip xuyên booking, với booking CONFIRMED/PARTIAL_CHECKIN/CHECKED_IN/COMPLETED. Booking CANCELLED/EXPIRED không ngăn nhận vé khác.

| Tình huống | Xử lý |
|---|---|
| Pending còn hợp lệ trên participant | Create/self-claim bị chặn; buyer revoke trước |
| Accept hợp lệ | Link account, rotate checkinCode một lần, tăng Booking.version; giữ buyer/invoice owner, tên khai báo, số tiền và số chỗ |
| Accept lại ACCEPTED | Trả lịch sử cùng trạng thái/quyền hiện tại; không rotate QR hoặc tạo event lần nữa |
| Decline/Revoke lặp đúng trạng thái | 200, không ghi transition lần hai |
| ACCEPTED rồi Decline/Revoke | 409 INVALID_STATE_TRANSITION; không chuyển hoặc thu hồi vé bằng invitation |
| Pending hết hạn | Read hiển thị EXPIRED; mutation commit EXPIRED rồi trả 410 |
| Booking/participant/trip mất điều kiện, recipient không hợp lệ hoặc đã có vé khác | Read hiển thị INVALIDATED; mutation lưu INVALIDATED trước khi trả lỗi |
| Hủy booking qua service hiện có | Vô hiệu pending trong cùng transaction; giữ ACCEPTED làm lịch sử |
| Create replay sau hủy/hết hạn | Trả snapshot cũ với Idempotency-Replayed=true; phải GET preview để lấy trạng thái hiện tại |

Read projection dùng effective status và không tự ghi lịch sử. Bộ lọc status áp dụng trước pagination, gồm cả expiry/invalidation hiệu lực, sắp createdAt DESC/id DESC. Mutation Create/Accept/Decline/Revoke/self-claim dùng cùng quy tắc; không cần chờ cron. Khi nhiều nguyên nhân đồng thời, mất điều kiện booking/participant/trip được ưu tiên INVALIDATED trước expiry. Không hồi sinh invitation đã lưu terminal.

Decline reason: IDENTITY_MISMATCH, NOT_INTERESTED, SCHEDULE_CONFLICT, OTHER. Accept xác nhận người trên vé là chính mình; không đổi tên theo profile và không phải bước xác minh pháp lý. Không có API đổi người/gỡ liên kết/chuyển vé trong M6.

## Booking projection và hướng F2/F3

Mỗi participant trong booking detail giữ các field cũ và thêm:

- `linkageStatus`: UNLINKED / INVITATION_PENDING / CLAIMED.
- `pendingInvitationId`: ID pending còn hiệu lực hoặc null.
- `recipientDisplay`: tên account đã linked hoặc recipient pending, null nếu chưa liên kết.
- `invitations`: tối đa 10 bản ghi mới nhất của participant, có id/status/reason/version/expiresAt/recipientDisplay. Không phải toàn bộ lịch sử vô hạn.
- `actions.canInvite`, `canSelfClaim`, `canRevoke`: trạng thái để hiển thị thao tác; server vẫn kiểm tra lại sau lock khi mutation.

F2: trên thẻ người tham gia của booking đã thanh toán, dùng actions để hiện “Gửi vé”, “Đây là vé của tôi”, “Thu hồi lời mời”. Generate key mới khi gửi yêu cầu mới; timeout thì retry đúng key và body. Sau mutation tải lại booking detail và preview. CLAIMED không có nút gửi lại/chuyển vé.

F3: dùng list recipient làm điểm vào trước khi có inbox hợp nhất M8. Preview hiển thị tên người trên vé và yêu cầu xác nhận rõ. Nếu không phải mình, decline IDENTITY_MISMATCH. Sau accept tải lại preview và GET /me/tickets/:participantId. Không điều hướng vào booking buyer. `participantStatus`, `bookingStatus`, `checkinStatus` hỗ trợ hiển thị lịch sử; không suy quyền từ ACCEPTED hoặc HTTP 200.

M7: `currentAccess.canNavigate` theo participant liên kết chính actor và trạng thái hiện tại; buyer preview không được nhận quyền của recipient. `canCheckIn` giữ baseline check-in hiện có; `canRent=false`, reason INTEGRATION_NOT_VERIFIED còn áp dụng cho Rental. Xem [contract M7](../public-participation/README.md). Field này không phải kill switch đối với API Rental có sẵn. M6 chỉ ghi audit/outbox; delivery notification và inbox hợp nhất thuộc M8, tích hợp liên domain thuộc M9.

## Idempotency, quota và lỗi

Create dùng IdempotencyRecord hiện có: scope actor + action + booking/participant, request hash của body chuẩn hóa, mặc định replay 24 giờ. Cùng key khác body trả 409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD. Replay thành công không tiêu tốn quota hoặc tạo event mới. Accept/Decline/Revoke idempotent theo invitation ID. Self-claim giữ contract M5 không cần key.

Quota actor dùng chung Public/Private: mặc định create 10/phút và 50/ngày, mutation 30/phút. Lần lookup thất bại vẫn tiêu quota. Counter dùng bảng private_invitation_rate_buckets có sẵn (tên legacy), không thêm hệ thống rate limit mới. 429 có Retry-After và error.details.retryAfterSeconds. Khi override cấu hình PUBLIC_INVITATION_CREATE_PER_MINUTE/CREATE_PER_DAY/MUTATE_PER_MINUTE, cần giữ đồng nhất với PRIVATE_INVITATION_* vì cùng actor counters. TTL_SECONDS và REPLAY_SECONDS cũng có prefix PUBLIC_INVITATION_, giống mặc định Private.

Client đọc `response.data.error` theo GlobalErrorFilter, kèm meta.requestId/serverTime/contractVersion. Các lỗi chính:

| HTTP | Code | Cách xử lý |
|---|---|---|
| 400 | VALIDATION_ERROR | Sửa field; USE_SELF_CLAIM chuyển sang thao tác tự nhận |
| 401/403 | UNAUTHENTICATED/FORBIDDEN | Xử lý auth/quyền hiện tại |
| 404 | NOT_FOUND | Không tồn tại hoặc không có quyền; không tiết lộ recipient |
| 409 | PENDING_INVITATION_EXISTS | Refetch, revoke lời mời hiện tại nếu cần |
| 409 | PARTICIPANT_ALREADY_LINKED/TRIP_PARTICIPATION_EXISTS | Không nhận thêm/chuyển vé; refetch trạng thái |
| 409 | PARTICIPANT_CLAIM_NOT_ALLOWED/INVITATION_NOT_ACTIONABLE/INVALID_STATE_TRANSITION | Refetch nguồn dữ liệu và tắt thao tác không còn hợp lệ |
| 409 | IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD | Không đổi payload của một lượt retry |
| 410 | INVITE_EXPIRED | Hiện hết hạn; buyer có thể gửi lại nếu còn điều kiện |
| 422 | INVITATION_RECIPIENT_UNAVAILABLE | Thông báo trung tính, không suy email tồn tại |
| 429 | INVITE_RATE_LIMITED | Chờ Retry-After |

## Kiểm chứng và môi trường

- M5/M6: 23/23; booking policy: 13/13; Private foundation/flow: 30/30; CF02 booking/payment/cancel: 21/21. Các response mới và booking projection được validate bằng AJV theo Swagger.
- Test dùng Nest HTTP, guard/error filter và PostgreSQL thật; Supabase verifyToken là fixture, không kiểm chứng đăng nhập live. Payment/cancellation dùng bản ghi local; không gọi gateway thật.
- Chạy tại api: PUBLIC_CLAIM_TEST_DATABASE_URL trỏ localhost database `cf01_test_invitation_m5*`; `node node_modules/jest/bin/jest.js --config test/jest-cf02.json --testRegex tickets.spec.ts$ --runInBand`. M6_CAPTURE_EXAMPLES=true ghi lại examples. Suite hiện chứa cả M5 và M6 để tái sử dụng fixture/harness.
- Export: `node node_modules/ts-node/dist/bin.js scripts/export-public-invitations-openapi.ts`.
- M6 không tạo migration. Cần schema M1/M5 (cả migration sửa index 20261023121000) và baseline hiện tại của dự án. DB test đã bổ sung migration timeline 20261024093000 do workspace có thay đổi song song; đây không phải migration do M6 tạo.
- Private regression bổ sung nguyên constraints/index từ migration M1 và CF04 vào baseline schema; CF02 có constraints/trigger policy từ migration 20261013100000. Không tuyên bố đã replay toàn bộ migration chain.
- Chưa áp migration hoặc deploy database dự án. Outbox event được ghi cùng transaction; không có chứng nhận delivery notification cho M8 hay operational capability cho M9.
