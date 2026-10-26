# M7 — Public participation, navigation và history

Backend contract cục bộ. Base URL: `<origin>/api/v1`; chưa xác minh deployment. Bearer token, account ACTIVE. Không triển khai giao diện trong M7.

| API | Quyền và kết quả |
|---|---|
| GET /trips/{tripId}/navigation-context | Endpoint hiện có, bổ sung quyền từ Public participant đã liên kết. Trả accessSource, trail/GeoJSON/checkpoint; không trả booking/payment/contact/QR. |
| GET /me/public-trip-participations/history | USER/LEADER, lịch sử theo participant.userId của actor; không nhận userId từ client. |

## Quyền hiện tại

Nguồn PUBLIC_PARTICIPANT cần đồng thời: actor USER/LEADER ACTIVE, participant ACTIVE liên kết đúng actor, booking CONFIRMED/PARTIAL_CHECKIN/CHECKED_IN, trip PUBLIC OPEN/FULL/CLOSED/IN_PROGRESS. Pending invitation không cấp quyền; accept thành công mới có linkage. Mỗi lần GET kiểm tra lại database trong transaction RepeatableRead; response `Cache-Control: no-store`.

Giữ các nguồn quyền cũ: ADMIN, TRIP_MANAGER (creator/leader), BOOKING_BUYER (booking CONFIRMED/PARTIAL_CHECKIN/CHECKED_IN/COMPLETED), PRIVATE_MEMBER (membership ACTIVE). LEGACY_MEMBERSHIP là fallback tương thích adapter cũ. Ưu tiên nguồn: admin → manager → linked participant → buyer → member. Mất linkage không thu hồi một nguồn quyền độc lập còn hợp lệ. Đặc biệt buyer/manager có thể vẫn đọc navigation của chuyến terminal theo quyền cũ; M7 chỉ giới hạn quyền mới từ participant.

`permissions.canNavigate` trên vé và invitation là quyền từ **vé của actor**, không phải tổng quyền manager/buyer/admin. Buyer preview vé đã gửi không nhận quyền của recipient. `canRent=false` giữ nguyên, chờ tích hợp M9; `reason=INTEGRATION_NOT_VERIFIED` trên vé active hiện còn áp dụng cho Rental, không có nghĩa navigation bị khóa. Giữ nguyên baseline QR/check-in: vé active có checkinCode, canCheckIn phụ thuộc NOT_CHECKED_IN. M7 không thay đổi API check-in hoặc điều kiện vận hành của module đó. Quyền đọc navigation không cho phép đổi trail, xem invoice hay booking của buyer.

## Lịch sử

Chỉ các trip PUBLIC COMPLETED/CANCELLED/INTERRUPTED có participant liên kết actor, kể cả participant CANCELLED/NO_SHOW hoặc booking đã hủy. Dedupe theo trip, không theo vé. Không tự suy luận identity từ buyer, tên hay email và không backfill dữ liệu cũ.

Query strict: page mặc định 1 (1..1.000.000), pageSize mặc định 20 (1..50). Sort startAt DESC rồi id DESC. Offset pagination không cam kết snapshot xuyên các request; từng response count/items đọc cùng snapshot. Trả `{items,page,pageSize,total,totalPages}`; trang rỗng `items=[]`. Mỗi item có trip summary, destination, participationSource=PUBLIC_PARTICIPANT và permissions đều false với reason=HISTORICAL_ONLY. Không có contact/QR/payment/bookingId. Lịch sử không tái cấp quyền hiện tại.

`GET /me/public-trips/history` vẫn là lịch sử **đã đặt** theo booking.userId với confirmedAt khác null; không đổi nghĩa thành lịch sử recipient. Private history giữ nguyên.

## Lỗi và tích hợp frontend F2/F3

History/vé dùng shared `{error:{code,message,details,retryable},meta:{requestId,serverTime,contractVersion}}`. History: 400 query sai/field dư, 401 chưa xác thực, 403 account/role không phù hợp. Navigation tiếp tục dùng TripErrorFilter cũ cho lỗi nghiệp vụ: `{statusCode,code,message}` (403 không có quyền, 404 không có trip). Lỗi từ auth/shared validation có thể dùng shared envelope; client cần hỗ trợ cả hai khi gọi endpoint navigation cũ. M7 không đổi error contract CF01.

- Buyer: giữ màn “Lịch sử đã đặt” dùng API cũ; participant card vẫn dùng booking detail và invitation actions M6.
- Recipient: “Vé của tôi” lấy list/detail vé; nút “Xem hành trình” theo canNavigate rồi gọi navigation-context. Trang “Lịch sử tham gia” dùng API mới, chỉ hiển thị thông tin lịch sử.
- Sau claim/accept/cancel hoặc khi quay lại màn: refetch booking nếu là buyer, vé, history và navigation. Không suy luận quyền từ invitation ACCEPTED hay cache; xử lý 403 bằng tải lại trạng thái, tắt hành động không còn hợp lệ.
- QR chỉ nằm trên chi tiết vé được API cho phép; không đưa vào notification, lịch sử hay navigation. Rental tiếp tục thuộc M9 và owner tương ứng.

## Bằng chứng kiểm thử và tái lập

[OpenAPI](../openapi/public-participation.json) xuất bằng `node node_modules/ts-node/dist/bin.js scripts/export-public-tickets-openapi.ts`. [Requests](./requests.http) dùng token placeholder. [Examples](./examples.local.json) là response HTTP fixture giả local, không phải dữ liệu người dùng.

Test M7 được thêm vào `src/modules/bookings/tickets.spec.ts`, dùng PostgreSQL localhost `cf01_test_invitation_m5*`, auth guards/filter và HTTP thật; chỉ token verification Supabase được stub. Đặt PUBLIC_CLAIM_TEST_DATABASE_URL rồi chạy `node node_modules/jest/bin/jest.js --config test/jest-cf02.json --testRegex '(tickets|booking-policy).spec.ts$' --runInBand`. M7_CAPTURE_EXAMPLES=true ghi lại history/error examples.

M7 không thêm migration. DB test kế thừa schema baseline, migration invitation M5 và timeline hiện hành; không đại diện replay toàn bộ lịch sử migrations. Chưa kiểm thử live Supabase, tải thực tế, staging/production hay tích hợp Rental.
