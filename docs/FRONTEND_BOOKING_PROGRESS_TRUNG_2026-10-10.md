# Tiến độ frontend mảng A / Booking — Nguyễn Tấn Trung

Ngày rà soát: **10/10/2026**. Source hiện tại: HEAD `811267a`, kèm working tree tại thời điểm kiểm tra.

## 1. Phạm vi và cách đọc kết quả

- Đối chiếu phạm vi Bảo (BE) + Trung (FE) trong `api/docs/bao.md`: System Trail, Trail Access, Public Trip, Private Trip, Booking, Transport và giao diện liên quan Leader/Admin.
- Đây là báo cáo **hiện trạng code frontend trong repository**, không phải thống kê số dòng hoặc xác nhận tất cả code do một cá nhân viết. Git có commit tác giả `Nguyen Tan Trung` cho BookingSuccessStep (`94aa73d`), quản lý chuyến (`ed19be9`), public trip (`4ea53ee`) và mobile trip/demo login (`4f04f45`, `74a1dac`). Các phần tích hợp có đóng góp từ nhiều người.
- **Đã nối API**: route/component thực sự gọi service/API cho chức năng nêu trong dòng. Không đồng nghĩa đã kiểm thử thành công trên môi trường triển khai.
- **Một phần**: có API nhưng còn dữ liệu cố định, thao tác mock hoặc chưa nối hết luồng.
- **Mock/UI**: có JSX/giao diện, dùng dữ liệu mẫu, state hoặc storage trên trình duyệt; chưa gọi API nghiệp vụ tương ứng.
- **Chưa có màn hoạt động**: chưa tìm thấy route/component thực hiện chức năng. Nếu có component rời chưa gắn route, ghi riêng.
- Không tính các màn Rental/Delivery thành tiến độ Booking, kể cả URL chứa `bookings`.
- Kiểm tra bằng đọc route → component → hook/service → endpoint, đối chiếu backend và chạy TypeScript web. **Chưa chạy browser/mobile simulator, chưa tạo booking hay thanh toán thật trong đợt rà soát này.**

## 2. Kết luận chính

**Web đã có nhiều giao diện và một số phần nối API, nhưng luồng user đặt chỗ/thanh toán hiện chưa hoàn chỉnh. Mobile chưa có flow user booking; có 8 màn demo dẫn đoàn/thực địa dùng mock.**

- CF01 — Leader tạo Public Trip: có giao diện và API cho tạo nháp, chọn checkpoint/trail, readiness, publish; các màn dashboard/detail/edit còn phần chưa tích hợp.
- CF02 — User booking: danh sách chuyến và danh sách booking gọi API; chi tiết chuyến nối một phần; form đặt chỗ, thanh toán, thành công trên route hiện tại vẫn mock.
- CF03 — User tạo Private Trip: có màn quản lý cơ bản nối API tạo/sửa/hủy, chọn nguồn trail và tạo/thu hồi mã mời.
- CF04 — Tham gia Private Trip: backend có endpoint nhưng chưa có frontend preview invite, join, Room, leave/remove member.
- Mua System Trail: backend có purchase/payment/grant access; chưa có frontend mua và theo dõi kết quả.
- Admin master data: `/admin/destinations` đã nối API cho Destination/System Trail/Checkpoint; `/admin/checkpoints` riêng vẫn mock.

## 3. Web — User / Booking

| Màn hình / route | Giao diện đã có | Tích hợp hiện tại | Còn thiếu / lưu ý |
|---|---|---|---|
| Landing `/`, `/public` | Trang giới thiệu, thẻ chuyến nổi bật | **Một phần**: `listPublicTrips()`; dữ liệu thẻ khởi tạo bằng mẫu | Không tính toàn bộ nội dung/thống kê landing là dữ liệu thật; nhiều CTA dẫn đăng nhập/đăng ký |
| Danh sách chuyến `/trips` | Danh sách, bộ lọc ngày/độ khó/giá, phân trang, loading/error/empty | **Đã nối API đọc** `GET /api/v1/trips` trong `PublicBookingTrips` | Chưa được xác nhận runtime trong đợt này; flow từ danh sách sang đặt chỗ còn đứt |
| Chi tiết chuyến `/trips/[id]` | Header, thông tin chuyến, lịch trình, bản đồ, số người, nút đặt | **Một phần**: `GET /api/v1/public-trips/:id` | Leader, rating, số đã đặt và một số thông tin gán cố định; bản đồ dùng cố định `TRAIL_BADEN_COTDIEN`; nút đặt dùng `addMockBooking()` |
| Đặt chỗ `/bookings/[id]` — bước 1 | Form nhiều thành viên: tên, điện thoại, SOS, sức khỏe, size áo, điểm đón, bảng giá | **Mock/UI**: `BookingLayout` đọc mock trip và `sessionStorage` | Chưa tạo hold/booking thật. Route hiện dùng `id` như trip ID, trong khi danh sách booking truyền booking ID |
| Cùng route — bước 2 rà soát/thanh toán | Rà soát thành viên, chọn VNPAY/MoMo/card/VietQR | **Mock/UI**: `setTimeout(..., 700)` rồi chuyển bước | Chưa gọi API tạo payment, mở checkout thực, polling trạng thái, xử lý pending/failed/expired. Tính VAT 8% trên client, chưa theo hóa đơn server |
| Cùng route — bước 3 thành công | Banner thành công, e-ticket, mã đặt chỗ, thành viên, tổng tiền | **Mock/UI** | Hiện thành công theo state local; mã booking tự dựng; chưa xác nhận `CONFIRMED` từ backend. Chưa có bằng chứng gửi email/SMS/QR dù UI có câu thông báo |
| Danh sách booking `/bookings` và `/my-trips` | Cùng component `MyBookings`: lọc trạng thái, phân trang, loading/error/empty, link chi tiết | **Đã nối API đọc** `GET /api/v1/bookings` | Đây là hai route dùng cùng một màn; link chi tiết đang mở `BookingLayout` mock, chưa phải chi tiết booking thật |
| Chi tiết booking thực từ booking ID | Đã có vỏ route nhưng nội dung là flow mock nói trên | **Chưa có nội dung nối API** | `bookingApi.detail()` có định nghĩa nhưng không có caller UI; thiếu hold countdown, invoice/payment/refund/transport thực |
| Sửa participant của booking hiện có | Có form nhập trước đặt chỗ | **Chưa có thao tác sửa booking thật** | `bookingApi.update()` chưa được UI sử dụng; thiếu đồng bộ version, giá và capacity khi sửa |
| Hủy booking / theo dõi hoàn tiền | Chưa thấy màn hoặc dialog thực hiện | **Chưa có UI nghiệp vụ** | `bookingApi.cancel()` chưa có caller; cần reason, policy, confirmation và kết quả/refund status |
| Quản lý Private Trip `/private-trips` | List, tạo/sửa, chọn nguồn trail/checkpoint, điểm tập kết, ngày, sức chứa, hủy | **Đã nối API cho các thao tác này** | Giao diện cơ bản; chưa phải Room/membership. Nguồn trail cá nhân/đã có quyền chỉ là selector |
| Tạo/thu hồi mã mời tại `/private-trips` | Form expiry, tạo/tạo lại và hiển thị code, thu hồi | **Đã nối API** invitations/revoke | Chưa có luồng người nhận mở link → preview → join; hiện chủ yếu hiển thị mã dạng text |
| Preview/join invite, Room, member list, leave/remove | Chưa có `/invite/[code]`, `/private-trips/[id]` và UI thành viên tương ứng | **Chưa xây giao diện hoạt động** | CF04 có BE nhưng không có service/UI FE sử dụng các endpoint đó |
| Danh sách trail `/routes`, `/my-routes` | Cùng `MyRoutesList`, thẻ trail, bộ lọc/thống kê | **Mock/UI**: thẻ viết cố định | Chưa phải My Personal Trails / My Purchased Trails nối API |
| Chi tiết trail `/routes/[id]` | Header, checkpoints, bản đồ và chuyến gợi ý | **Một phần**: page lấy `mockRoutesData`; map có gọi System Trail API | ID không có trong mock trả notFound; chưa phải chi tiết catalog động hoàn chỉnh, chưa có giá/quyền và mua trail |
| Tạo Personal Trail | Có bộ component `CreateRoute` | **Component rời / mock** | Không có page `/routes/create` trong source hiện tại; chưa có create từ GPS, lưu checkpoint hoặc delete personal trail thật |
| Đề xuất/publish trail `/routes/[id]/publish` | Form ghi chú, checklist, tóm tắt | **Mock/UI** | Chưa có API submit. Đây là UI cũ; cần đối chiếu nghiệp vụ Personal Trail riêng tư trước khi tính vào MVP mới |
| Mua System Trail / kết quả / thư viện trail đã mua | Chưa có màn mua | **Chưa xây giao diện** | Chưa gọi `POST /trails/:id/purchase`; danh sách quyền ở Private Trip không thay thế flow mua và quản lý trail đã mua |

### Bằng chứng trọng yếu của CF02

- [Route chi tiết chuyến hiện tại](../web/src/app/(private)/(user)/trips/[id]/page.tsx) gọi `usePublicTripDetail`, không render `PublicBookingTrip` có API create booking.
- [BookingSidebar của chi tiết chuyến](../web/src/features/trips/components/TripDetail/BookingSidebar.tsx): gọi `addMockBooking`, lưu `trekgo-booking-info`, link `/bookings/${trip.id}?participants=...`.
- [Route booking hiện tại](../web/src/app/(private)/(user)/bookings/[id]/page.tsx) render [BookingLayout](../web/src/features/bookings/components/BookingFlow/BookingLayout.tsx), dùng mock/storage.
- [BookingPaymentStep](../web/src/features/bookings/components/BookingFlow/BookingPaymentStep.tsx): timer 700 ms gọi `onConfirmPayment`; không xác nhận payment từ backend.
- [booking.api.ts](../web/src/features/bookings/booking.api.ts) có `create/detail/update/pay/cancel`, nhưng có service không đồng nghĩa đã tích hợp UI.
- [PublicBookingTrip](../web/src/features/bookings/components/PublicBookingTrips.tsx) có `bookingApi.create()` nhưng không được page hiện tại sử dụng; props truyền cho `BookingForm` không khớp component hiện tại.
- [MyBookings](../web/src/features/bookings/components/MyBookings.tsx) thực sự gọi API list, nhưng link booking ID sang route đang hiểu là trip ID.

## 4. Web — Leader / quản lý Public Trip

| Màn hình / route | Tình trạng | Phần thực hiện được và phần còn thiếu |
|---|---|---|
| Dashboard `/leader` | **Một phần** | Có `useLeaderPublicTrips`; các thẻ KPI, ứng viên, thông báo/thao tác khác chưa đồng bộ đầy đủ với API |
| Danh sách chuyến `/leader/trips` | **Một phần** | List từ API, search/tab phía client; `registered: 0`, revenue = giá × capacity, địa điểm/ảnh có placeholder; chưa phải số booking/doanh thu thực |
| Tạo chuyến bước 1 `/leader/create-trip` | **Đã nối nghiệp vụ tạo nháp; còn UI phụ chưa nối** | Gọi options điểm đến/pickup và `createDraft`. Lựa chọn Public/Private trên UI không chứng minh Leader tạo được Private: request vẫn là Public Trip. Một số field hình ảnh/độ khó không thuộc payload create |
| Tạo chuyến bước 2 `/leader/create-trip/route` | **Đã nối API chọn route/checkpoint** | Detail, suggestions, checkpoints; lưu bằng PUT checkpoints/trails với expectedVersion. UI chính chọn một trail; không coi đã hoàn tất mọi biến thể đa trail của BE |
| Review/publish `/leader/create-trip/review` | **Đã nối API readiness/publish; một phần UI** | Đọc detail/readiness và POST publish; một số thông tin có fallback mẫu. Nút “Lưu nháp” ở review chỉ đổi state thông báo, không tự gọi API save |
| Chi tiết quản lý `/leader/trips/[tripId]` | **Một phần** | Có API trip detail. Member list khởi tạo rỗng, remove chỉ cập nhật state, số liệu thanh toán gán sẵn; nút “Bắt đầu hành trình” chưa có handler/API |
| Chỉnh sửa `/leader/trips/[tripId]/edit` | **Một phần** | PATCH title/description/capacity/price và gửi cancellation request có API; nhiều control khác trên form không được gửi trong payload save |
| Yêu cầu hủy chuyến | **Có API trong UI edit và màn quản lý cơ bản** | Là gửi yêu cầu hủy để Admin xử lý; không phải hủy được duyệt ngay. Chưa thấy UI Admin duyệt/từ chối yêu cầu |
| Quản lý cơ bản `/leader/public-trips` | **Đã nối API cho CF01 cốt lõi** | List/detail, tạo/sửa DRAFT, xếp checkpoint/trail, readiness, publish, cancellation request. Đây là màn khác với bộ wizard có thiết kế ở trên |
| Quyết toán `/leader/trips/[tripId]/settlement` | **Mock/UI** | Dữ liệu mẫu; submit đổi state, download chỉ hiện thông báo; chưa có quyết toán hoặc tải file thực |
| Hồ sơ `/leader/profile` | **Mock/UI** | Form và nút lưu chỉ đổi state; thuộc phần liên quan Leader, không tính là booking API hoàn tất |
| An toàn `/leader/safety` | **Mock/UI** | Toggle/lưu/test SOS mô phỏng; chưa tích hợp runtime an toàn |
| Public QR/manual check-in, private attendance | **Chưa có flow thực** | Có phần hiển thị check-in trong UI, nhưng chưa gọi API điểm danh; không tính QR bàn giao đồ của Rental |
| Start / switch trail / complete trip | **Chưa có flow FE nối API** | Nút hoặc demo thực địa chưa thực hiện chuyển trạng thái nghiệp vụ; cần tích hợp và phối hợp GPS |

Nguồn: [leader-public-trips.api.ts](../web/src/features/leaders/services/leader-public-trips.api.ts), [LeaderTripDetail](../web/src/features/leaders/components/leader/LeaderTripDetail.tsx), [LeaderTripEdit](../web/src/features/leaders/components/leader/LeaderTripEdit.tsx), [PublicTrips](../web/src/features/trips/components/PublicTrips.tsx).

## 5. Web — Admin / master data / Leader approval

| Màn hình / route | Tình trạng | Ghi chú |
|---|---|---|
| `/admin/destinations` — tab Destination | **Đã nối API CRUD** | List/create/update/delete qua `destinationApi` và modal |
| Cùng trang — tab System Trail | **Đã nối API CRUD metadata/giá** | List/detail/create/update/delete, map/checkpoint; modal hiện gửi status `ACTIVE` cố định, không tính đã có đầy đủ UI chuyển trạng thái |
| Cùng trang — tab Checkpoint | **Đã nối API CRUD** | `checkpointApi`, modal tạo/sửa/xóa, bản đồ |
| `/admin/checkpoints` độc lập | **Mock/UI** | `CheckpointsManager` dùng danh sách khởi tạo trong state. Không nhầm với tab Checkpoint có API tại `/admin/destinations` |
| `/leader-registration` | **Mock/UI** | Form hồ sơ nhiều bước, tài liệu/chứng chỉ; chưa có API nộp hồ sơ thật |
| `/leader-registration/test` | **Mock/UI** | UI bài test/câu hỏi; chưa có API lấy/nộp bài |
| `/leader-registration/progress` | **Mock/UI** | Timeline, lịch phỏng vấn và hồ sơ mẫu |
| `/admin/leaders`, `/admin/leaders/[id]` | **Mock/UI** | List/thẩm định hồ sơ mẫu; chưa thấy API phê duyệt/từ chối trong component |
| Admin Trip oversight / duyệt hủy Public Trip | **Chưa thấy màn nghiệp vụ riêng** | Cần list/detail và approve/reject kết nối backend phù hợp |
| Trip Transport — xe/tài xế theo chuyến | **Chưa thấy màn CRUD** | Thiếu thêm/sửa/xóa xe, tài xế, giờ tập kết; chi tiết booking cũng chưa hiển thị dữ liệu transport thật theo quyền |

Nguồn: [DestinationManagement](../web/src/features/destinations/components/DestinationManagement.tsx), [SystemTrailModal](../web/src/features/destinations/components/modals/SystemTrailModal.tsx), [CheckpointsManager](../web/src/features/checkpoints/components/CheckpointsManager.tsx), [LeaderManagement](../web/src/features/leaders/components/LeaderManagement.tsx), [LeaderDetails](../web/src/features/leaders/components/LeaderDetails.tsx).

## 6. Mobile — giao diện đã có

Có **8 route Trip/Leader demo**, đều dùng dữ liệu mẫu trong `mobile/src/features/trip/mockData.ts` và các section tĩnh, chưa có API booking/trip nghiệp vụ:

| Route | Giao diện | Tích hợp |
|---|---|---|
| `/trip/dashboard` | Dashboard dẫn đoàn, danh sách thành viên, tiến độ check-in | Mock |
| `/trip/map` | Bản đồ hành trình, tiến độ, trạng thái nhóm | Mock |
| `/trip/deviation` | Cảnh báo lệch tuyến, thống kê, bản đồ minh họa | Mock |
| `/trip/reroute` | Cảnh báo và lựa chọn tuyến thay thế | Mock; chưa switch trail thật |
| `/trip/checkpoint` | Thông tin checkpoint, xác minh vị trí, hướng dẫn an toàn | Mock; chưa cập nhật checkpoint/attendance thật |
| `/trip/safety-report` | Form sự cố và nút SOS | Mock; chưa gửi báo cáo/SOS backend |
| `/trip/group-chat` | Hội thoại, thao tác nhanh, ô nhập tin | Mock; chưa chat realtime |
| `/trip/summary` | Tổng kết hành trình, thống kê và danh sách | Mock; chưa đọc kết quả/complete trip backend |

Các màn có nút chuyển tuần tự sang màn demo kế tiếp; không phải bằng chứng hoàn tất business flow. GPS/chat/SOS là phần phối hợp với domain khác, không gộp thành “booking đã tích hợp”.

- Route `/` là login UI cho Leader/Delivery, nút đăng nhập điều hướng trực tiếp sang `/trip/dashboard` hoặc `/delivery/task-list`; chưa xác thực bằng API trong màn này.
- `(tabs)/index.tsx` là menu demo. Có link `/leader/pre-trip-checkin` nhưng không thấy route tương ứng trong source.
- Có `/bookings/[bookingId]/rentals` và `/rental-products/[id]` nối API rental catalog/eligibility/availability. **Đây là phần Rental, không phải màn tạo/xem booking user.**
- 10 màn Delivery là ngoài phạm vi Booking của báo cáo này.

Nguồn: [Mobile login](../mobile/src/app/index.tsx), [menu demo](../mobile/src/app/(tabs)/index.tsx), [trip mock data](../mobile/src/features/trip/mockData.ts), [rental API](../mobile/src/features/rentals/api/get-rental-catalog.ts).

## 7. Mobile — giao diện Booking còn thiếu

Chưa thấy route/component mobile thực hiện các nhóm sau:

1. Khám phá/tìm kiếm/lọc Public Trip và chi tiết chuyến phục vụ đặt chỗ.
2. Chọn số lượng, nhập participant, tạo booking/hold, xem tổng tiền server và thời gian giữ chỗ.
3. Thanh toán, mở checkout, quay lại app, trạng thái chờ/thành công/thất bại/hết hạn.
4. My Bookings, chi tiết booking thật, sửa participant, hủy và theo dõi refund, transport theo quyền.
5. Catalog/chi tiết System Trail có giá/quyền; mua trail, kết quả, danh sách trail đã có quyền.
6. Tạo/sửa/hủy Private Trip, chọn trail/checkpoint/pickup, tạo/chia sẻ/thu hồi invite.
7. Preview/join invite, Room, danh sách member, leave/remove và private attendance.
8. Leader quản lý/tạo/sửa/publish Public Trip trên mobile nếu sản phẩm yêu cầu hỗ trợ ngoài web.
9. Flow check-in và start/switch/complete thực: có demo thực địa nhưng chưa có dữ liệu/thao tác API.
10. My Personal Trails, tạo từ GPS/checkpoint và xóa trail; cần phối hợp chủ sở hữu GPS.

Admin CRUD trên mobile không được tự xem là yêu cầu bắt buộc; cần theo phân bổ nền tảng của sản phẩm. Các mục mobile trên là khoảng trống so với nghiệp vụ, không tự suy ra mọi chức năng web phải được sao chép nguyên vẹn.

## 8. Đối chiếu với backend để lên task tích hợp

| Nhóm | Bằng chứng API hiện có trong source | Frontend cần làm |
|---|---|---|
| CF01 | `leader/public-trips`: create/list/detail/update/checkpoints/trails/suggestions/readiness/publish/cancellation-requests | Hoàn thiện các field/thao tác và loại bỏ số liệu giả ở wizard/dashboard/detail |
| CF02 | `GET trips`, `GET trips/:id`, `POST trips/:id/bookings`, `GET bookings`, `GET bookings/:id`, `PATCH bookings/:id/participants`, payment/cancel | Nối route booking thật, checkout và kết quả; sử dụng các service đang chưa có caller |
| CF03 | private-trips CRUD/cancel/invitations/revoke; personal-trails/trail-accesses/pickups | Web đã có UI cơ bản; mobile chưa có |
| CF04 | invitation preview/join, private Room/members/leave/remove | Xây UI và service cho web/mobile |
| Trail purchase | `POST trails/:trailId/purchase`, xử lý payment thành công và cấp access; read access | Xây giao diện mua, trạng thái thanh toán và quyền sở hữu |
| Navigation | `GET trips/:tripId/navigation-context`, `POST trips/:tripId/switch-trail` | Nối đúng context vào UI map/reroute; hiện chưa thấy FE caller |

Các dòng trên chỉ xác nhận endpoint/implementation có trong source. Không xác nhận môi trường đã deploy hoặc mọi API chưa được liệt kê là đã hoàn tất. Đặc biệt attendance/start/complete/transport/Leader approval cần kiểm tra backend riêng trước khi chốt thời hạn tích hợp.

## 9. Kiểm tra kỹ thuật và điểm chặn

Đã chạy tại `web`:

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

Kết quả **không đạt**. Lỗi trực tiếp liên quan booking:

```text
src/features/bookings/components/PublicBookingTrips.tsx(60,89): TS2322
Property 'initial' does not exist on type 'IntrinsicAttributes & BookingFormProps'.
```

`PublicBookingTrip` truyền `initial/max/busy/submitLabel/onSubmit`, còn `BookingForm` hiện nhận `members/onMemberChange/onNextStep/...`. Vì vậy không thể lấy component API cũ làm bằng chứng flow đặt chỗ đã hoàn tất.

Kiểm tra toàn web còn báo type route `.next` tham chiếu page đã không còn trong source, module `maplibre-gl` không resolve trong cài đặt hiện tại và lỗi export type ở Rental. Những lỗi này được ghi nhận để giới hạn kết luận, không quy toàn bộ lỗi cho Booking hoặc cho Trung. Không sửa source/config/cache trong đợt audit.

Tài liệu `docs/CF02-implementation.md` ghi từng hoàn tất flow API/browser, nhưng route và component hiện tại không còn chứng minh trạng thái đó. Báo cáo này ưu tiên source hiện tại; không sử dụng kết quả test cũ làm xác nhận cho bản hiện tại.

## 10. Thứ tự hoàn thiện đề xuất

1. **CF02 web:** thống nhất ý nghĩa trip ID / booking ID và route; nối create/detail/participant/payment/cancel vào UI thật; sửa props form; lấy giá/invoice/trạng thái từ server.
2. **Xác minh flow:** list → detail → hold → checkout → server confirm → My Bookings → detail; thêm các tình huống hết chỗ/hết hạn/lỗi thanh toán và hủy theo policy.
3. **CF04:** xây preview invite, join, Room/membership; nối vào mã mời CF03 đã có.
4. **Trail purchase:** catalog/detail theo ID thật, nút mua/checkout/kết quả/My Access; phân biệt trail mẫu và trail đã có quyền.
5. **Leader/Admin:** nối member/check-in/lifecycle, số liệu thực, transport và duyệt yêu cầu hủy; xác nhận API còn thiếu với BE.
6. **Mobile:** xây flow user booking còn thiếu; sau đó nối 8 màn thực địa hiện có với trip/booking/GPS theo phạm vi đã thống nhất.

## 11. Đoạn ngắn để đưa vào file cập nhật chung

> Frontend Booking — Nguyễn Tấn Trung: Web đã xây bộ giao diện khám phá chuyến, chi tiết chuyến, đặt chỗ 3 bước, danh sách booking, quản lý/tạo Public Trip, Private Trip và các màn trail/Leader/Admin liên quan. Đã nối API đọc danh sách chuyến, danh sách booking; CF01 tạo nháp/chọn checkpoint-trail/readiness/publish; CF03 quản lý chuyến riêng/tạo-thu hồi invite; Admin Destination/System Trail/Checkpoint tại trang destinations. Chi tiết chuyến và các màn Leader còn tích hợp một phần. Flow đặt chỗ/thanh toán/thành công hiện vẫn mock; chưa có chi tiết booking thật, sửa participant/hủy/refund, CF04 invite-join-Room, mua System Trail và quản lý transport. Mobile có 8 màn demo dẫn đoàn/thực địa dùng mock, chưa có flow user booking. Chưa nghiệm thu end-to-end; kiểm tra TypeScript hiện còn lỗi props BookingForm cùng các lỗi khác của workspace.
