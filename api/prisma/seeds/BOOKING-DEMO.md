# Booking demo seed V2

Seeder này thay dữ liệu của **cùng batch**, gồm thao tác booking trên UI của các trip demo. Không dùng `prisma migrate reset`, `TRUNCATE` hay seeder tổng (seeder tổng có rental).

## Chuẩn bị

1. Áp dụng các migration dự án theo quy trình hiện có. Seeder không sửa schema.
2. Copy `data/booking-demo.example.json` thành file cấu hình local, điền UUID thật. Bảy tài khoản phải khác nhau, ACTIVE, có bản ghi Supabase Auth. `admin` là ADMIN, `leader` là LEADER, năm tài khoản còn lại là USER. Không thay role hoặc mật khẩu.
3. Điền tuyến, địa điểm và điểm đón/trả đã nhập trên web. Có thể dùng lại một tuyến cho cả sáu kịch bản. Tuyến phải ACTIVE, có GeoJSON và checkpoint hợp lệ; host đã có `trail_access` ACTIVE cho tuyến private.
4. Có đúng một `PUBLIC_BOOKING_DEFAULT` đã publish và đang hiệu lực. Leader đã có hồ sơ hợp lệ sẽ được giữ nguyên. Nếu chưa có application, thêm `certificateMediaId` trỏ tới tài liệu demo đã upload, thuộc leader, scope LEADER_CERTIFICATE, READY, authenticated, retained (`retentionUntil=null`), chưa gắn chứng chỉ. Seeder không upload/giả mạo media hoặc sửa trạng thái hồ sơ thật.
5. Cấu hình `DATABASE_URL`, `MONGODB_URI` trong môi trường API. Nếu DATABASE_URL dùng transaction pooler, đặt `SEED_LOCK_DATABASE_URL` là direct/session URL **cùng database**. Không đưa secrets vào JSON hoặc Git.
6. Dừng API, scheduler và các worker payment/booking/notification/GPS/rental trong lúc chạy hoặc resume. `workersStopped: true` là xác nhận của người vận hành, không phải script tự dừng dịch vụ. Khóa advisory chỉ ngăn các seeder chạy đồng thời; không thay thế bước này.

## Chạy trong thư mục api

```sh
npm run seed:coreflows -- --config=prisma/seeds/data/booking-demo.local.json --dry-run
npm run seed:coreflows -- --config=prisma/seeds/data/booking-demo.local.json
npm run seed:coreflows -- --config=prisma/seeds/data/booking-demo.local.json --verify-only
```

Dry run đọc dữ liệu và in lịch dự kiến, số bản ghi sẽ xóa, phần hồ sơ cần bổ sung; không tạo index, dữ liệu hay thông báo. UUID placeholder trong cấu hình mẫu cố ý không hợp lệ để không vô tình chọn dữ liệu thật.

Mỗi lần chạy thường tạo ID mới, thời gian mới, thay batch cũ trong một transaction PostgreSQL. Dữ liệu nguồn map, user/Auth, policy, media và hồ sơ leader được giữ. Hồ sơ demo bổ sung được giữ và tái sử dụng, không tạo lặp mỗi lần chạy. Booking/invoice/payment luôn dùng số tiền VND nguyên; payment là MOCK với trạng thái provider mô phỏng đủ để demo hoàn tiền.

Nếu MongoDB hoặc kiểm tra sau commit lỗi, manifest trong `audit_logs` giữ trạng thái `NOTIFICATIONS_PENDING`. Giữ nguyên cấu hình, dừng worker và chạy:

```sh
npm run seed:coreflows -- --config=prisma/seeds/data/booking-demo.local.json --resume
```

Resume không tạo lại trip/payment; hoàn tất xóa thông báo cũ, upsert thông báo mới và receipt. Chỉ chạy lại seed thường sau khi lượt pending đã hoàn tất. `--verify-only` kiểm tra bộ fixture ban đầu; nếu đã thao tác UI, trạng thái có thể khác và verification báo lỗi là đúng. Sau nhiều ngày lời mời hết hạn hoặc trip đóng đăng ký, chạy thay batch để có bộ demo mới.

## Sáu kịch bản

| Kịch bản    | Dữ liệu                                                       | Demo                                              |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------- |
| PUBLIC_D7   | OPEN, 0/12 khách                                              | Booker tạo booking rồi thanh toán mock qua UI     |
| PUBLIC_D14  | OPEN, 4/12: booker1 1 vé, booker2 3 vé                        | Vé, invoice/payment, danh sách khách              |
| PUBLIC_D21  | OPEN, 3/12: booker1, claimedMember, vé đang mời invitedMember | Đăng nhập invitedMember và nhận vé                |
| PUBLIC_D28  | FULL, 6/6: hai booker, mỗi người 3 vé                         | Trạng thái đủ chỗ                                 |
| PRIVATE_D10 | Host + claimedMember + invitedMember, cùng link mời           | Danh sách nhóm; một USER khác có thể vào qua link |
| PRIVATE_D17 | Host + claimedMember đã nhận mời, invitedMember đang chờ      | Đăng nhập invitedMember và nhận lời mời           |

Giờ bắt đầu 07:00 Việt Nam của D+n; thời lượng tối thiểu 8 giờ hoặc theo tuyến nếu dài hơn. Public đóng đăng ký trước khởi hành 48 giờ. Mọi vé ban đầu chưa check-in; private không có booking/invoice tham gia. Không seed refund/no-show/review/trip đã hoàn thành hay bài thi leader không được yêu cầu bởi luồng hiện tại.

## Dọn dữ liệu có giới hạn

Manifest trong database xác định trip sở hữu; không dựa vào tên trip hay xóa theo user. Seeder mở rộng xuống các quan hệ booking để bao gồm dữ liệu phát sinh trên UI: invoice revision, payment/refund MOCK, cancellation, lời mời, outbox, receipts, audit và invitation/refund-simulation idempotency có ID liên quan chính xác. Counter rate limit theo user được giữ nguyên.

Nếu gặp GPS, rental, weather, gear, đánh giá hoặc bất kỳ bảng phụ thuộc ngoài danh sách booking cho phép, seeder dừng trước khi xóa. Dữ liệu tài chính không phải MOCK cũng chặn cleanup. Không có tùy chọn force/cascade. Không xóa dữ liệu map giả do seeder V1 tạo.

Để thay trip của batch V1, thêm tên batch vào `replaceLegacyBatches`. Chỉ các batch có audit manifest `CF01_CF04_HAPPY_V1` được nhận diện; users/map/trail_access của V1 vẫn giữ. Giữ batch V2 cố định qua các lần chạy để không tích lũy bộ demo.

## Kiểm thử

`npm run test:coreflows-seed` chạy kiểm tra cấu hình/lịch/giá. Test tích hợp chỉ bật với `CORE_FLOWS_TEST_DATABASE_URL` trỏ localhost database có tên bắt đầu `cf04_test` và `CORE_FLOWS_TEST_MONGODB_URI` trỏ localhost database có tên bắt đầu `booking_demo_test`. Chuẩn bị schema Prisma hiện tại trên database **trống, riêng cho test**; test tạo dữ liệu nguồn chỉ trong database test và bổ sung CHECK/index từ migration booking. Không trỏ test vào database dự án.
