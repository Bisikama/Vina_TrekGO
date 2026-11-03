# payOS production và hoàn tiền thủ công — backend

Các lệnh Node/npm/Prisma trong tài liệu chạy từ thư mục `api/`.

## Phạm vi

- Thu tiền thật qua payOS cho booking, rental order, rental extension và trail purchase.
- Hoàn tiền payOS bằng chuyển khoản bên ngoài, admin nhận xử lý và xác nhận trong API.
- Giữ cổng mặc định, mock, VNPay/MoMo sandbox và các chính sách tính tiền/hoàn hiện có.
- Không triển khai frontend, API chi hộ hoặc hoàn số tiền tùy ý.
- `ADMIN_MANUAL` là xác nhận của admin sau khi kiểm tra ngân hàng; backend không xác minh độc lập tiền đã về người nhận.

## Cấu hình

Đăng ký tài khoản cá nhân và kênh thu trên payOS; lấy Client ID, API Key, Checksum Key. Chỉ đặt secret ở backend.

```dotenv
PAYOS_ENABLED=true
PAYOS_CLIENT_ID=<client-id>
PAYOS_API_KEY=<api-key>
PAYOS_CHECKSUM_KEY=<checksum-key>
PAYOS_RETURN_URL=https://your-web.example/payment-return
PAYOS_CANCEL_URL=https://your-web.example/payment-return
PAYOS_RECEIVING_BANK_BIN=970422
PAYOS_RECEIVING_ACCOUNT_NUMBER=<tai-khoan-nhan-tien-cua-ban>
PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED=false
PAYMENT_EVENTS_WORKER_ENABLED=true
PAYMENT_RECOVERY_WORKER_ENABLED=true
```

`PAYOS_ENABLED` mặc định false. Khi true, thiếu cấu hình sẽ làm startup thất bại. Hai URL phải là HTTPS, không chứa credentials hoặc fragment. Bank BIN gồm 6 chữ số; tài khoản là chuỗi số để giữ số 0 đầu.

Giữ `PAYMENT_PROVIDER`, `PAYMENT_PROVIDER_ENVIRONMENT` và `PAYMENT_ENABLED_PROVIDERS` theo cấu hình sandbox hiện có. Không đặt `PAYMENT_PROVIDER=payos`: phiên bản này cố ý giữ default cũ, chỉ thu tiền thật khi request chọn `gateway: "payos"`. payOS luôn có environment `PRODUCTION`, độc lập với biến môi trường sandbox.

Deployment có payOS production không được bật chức năng mô phỏng refund. Cổng sandbox vẫn dùng các adapter hiện có; muốn demo chức năng mô phỏng settlement, dùng deployment demo riêng.

Migration additive: `20261103090000_payos_manual_refunds`. Chạy:

```text
npx prisma migrate deploy
npx prisma generate
npm run build
```

Prisma sử dụng `DIRECT_URL` cho migration; khi chạy test phải trỏ cả `DATABASE_URL` và `DIRECT_URL` vào database test, không chỉ đổi `DATABASE_URL`.

## Đăng ký webhook

Trong cấu hình kênh thu payOS, đặt URL công khai:

```text
POST https://your-api.example/api/v1/payments/webhooks/payos
```

Không cần JWT. Endpoint xác minh chữ ký trên `data`, giới hạn body, kiểm tra mapping, tài khoản nhận, VND và số tiền. Trả HTTP 200 khi đã lưu inbox hoặc khi nhận đúng mẫu kiểm tra kết nối có chữ ký. Lỗi database không được ACK thành công. Webhook giả/chữ ký sai không cập nhật payment.

Return/cancel URL chỉ để điều hướng; không có quyền xác nhận tiền. Đăng ký webhook bằng dashboard hoặc API confirm-webhook của payOS, không tự gọi xác nhận kết nối mỗi lần khởi động backend.

## API thu tiền

Tất cả API ứng dụng dưới đây có prefix `/api/v1`, dùng JWT và `Idempotency-Key` theo contract hiện có.

| API | Nghiệp vụ |
|---|---|
| `POST /bookings/:id/payments` | Booking |
| `POST /rental-orders/:id/payments` | Đơn thuê |
| `POST /rental-extensions/:id/payments` | Gia hạn |
| `POST /trails/:trailId/purchase` | Mua quyền truy cập trail |
| `GET /payments/options` | Cổng đang bật; payOS có `refundMode: MANUAL_BANK_TRANSFER` |

Body:

```json
{ "paymentMethod": "QR", "gateway": "payos" }
```

`REDIRECT` cũng được hỗ trợ. Không nhận giá tiền từ client. Response giữ contract cũ: paymentId, amount dạng chuỗi VND, gateway, providerEnvironment, checkout, expiresAt... `checkout.qrData` là chuỗi dữ liệu QR để client render; `checkout.url` dẫn đến trang payOS.

`201`: checkout mới; `200`: replay; `202`: đã lưu payment nhưng chưa nhận được checkout. Khi mất response tạo link, recovery truy vấn cùng orderCode. Nếu lấy lại được link nhưng thiếu dữ liệu QR, `qrData` có thể null và dùng `checkout.url`. Không tạo orderCode mới khi timeout.

OrderCode do sequence PostgreSQL cấp, giới hạn tới 9007199254740991; mapping và request snapshot được lưu trước transport. Dispatch đầu tiên được claim bền vững; không gửi lại POST nếu kết quả gửi trước còn mơ hồ. Không coi lỗi transport/response không xác thực là bằng chứng đơn hàng chưa tồn tại.

Consumer hiện có quyết định xác nhận booking, chấp nhận rental/gia hạn hoặc cấp quyền trail. Tiền đã thu nhưng nghiệp vụ không thể áp dụng đi vào technical reversal hiện có; nếu cổng payOS thì tạo yêu cầu hoàn thủ công.

## API hoàn tiền

Refund chỉ được tạo từ quyết định nghiệp vụ hiện có: hủy booking/rental, hoàn cọc hoặc hoàn kỹ thuật. Giữ allocation và số tiền đã được duyệt; không thêm chính sách hoàn trail mới.

| API | Người dùng |
|---|---|
| `GET /refunds` | Chủ hóa đơn: danh sách của mình; tài khoản được che |
| `GET /refunds/:id` | Chủ hóa đơn hoặc admin: chi tiết |
| `PUT /refunds/:id/recipient` | Chủ hóa đơn: khai báo tài khoản nhận hoàn |
| `GET /admin/manual-refunds` | Admin: danh sách manual refund |
| `GET /admin/manual-refunds/:id` | Admin: nguồn tiền, chủ hóa đơn, allocation, lịch sử |
| `POST /admin/manual-refunds/:id/claim` | Admin nhận lệnh |
| `POST /admin/manual-refunds/:id/release` | Người được giao trả lệnh chưa chuyển |
| `POST /admin/manual-refunds/:id/review` | Người được giao đánh dấu kết quả chưa rõ |
| `POST /admin/manual-refunds/:id/reassign` | Admin chuyển người xử lý để điều tra |
| `POST /admin/manual-refunds/:id/complete` | Người được giao xác nhận đã chuyển thành công |

`:id` luôn là shared refundId. Danh sách nhận `page` (mặc định 1), `pageSize` (mặc định 20, tối đa 100), `source` (`BOOKING`, `RENTAL`, `TRAIL_ACCESS`), `purpose`, `manualStatus`, `assignedAdminId`.

Các mutation trả HTTP 200, yêu cầu JWT, `Idempotency-Key` và `expectedVersion`. Lấy version tại `manualRefund.version`, không lấy version của booking/payment. Gửi lại cùng key và cùng body trả kết quả đã lưu, kể cả sau khi đã hoàn; đổi body với cùng key trả 409. Mỗi thao tác mới dùng key mới.

### Quy trình bằng Swagger/Postman

1. Gọi API hủy/quyết toán nghiệp vụ hiện có. Worker tạo refund với `executionMode=MANUAL_BANK_TRANSFER`, không gửi API refund payOS. Poll `GET /refunds` để thấy refund.
2. Chủ hóa đơn khai báo tài khoản trước khi admin nhận:

```json
{
  "expectedVersion": 1,
  "bankBin": "970422",
  "accountNumber": "0011223344",
  "accountHolderName": "NGUYEN VAN A",
  "ownershipConfirmed": true
}
```

Tài khoản phải đứng tên chủ hóa đơn. Đây là lời xác nhận của chủ đơn và kiểm tra thủ công của admin, không phải kết quả tra cứu tên tại ngân hàng. Sau thao tác này, trạng thái là READY, version tăng lên 2.

3. Admin xem chi tiết, so tên chủ hóa đơn và tên ngân hàng hiển thị khi chuyển, rồi gọi claim:

```json
{ "expectedVersion": 2, "accountNameChecked": true }
```

Chỉ một admin claim thành công. Claim không tự hết hạn khi server restart/logout. Tài khoản nhận bị khóa; refund chuyển PROCESSING, version tăng lên 3.

4. Admin chuyển khoản **đúng số tiền của refund** bên ngoài hệ thống. Mỗi refund tương ứng một giao dịch; không chia nhỏ/gộp nhiều refund vào cùng chuyển khoản.
5. Sau khi kiểm tra ngân hàng báo thành công, gọi complete:

```json
{
  "expectedVersion": 3,
  "transferredAmount": "150000",
  "sourceBankBin": "970422",
  "sourceAccountNumber": "0099887766",
  "bankTransactionRef": "FT123456789",
  "transferredAt": "2026-11-03T10:00:00+07:00",
  "note": "Da kiem tra lich su ngan hang"
}
```

Thay transferredAmount bằng số tiền được duyệt, transferredAt bằng giờ chuyển thực tế (không trước claim hoặc sau giờ server). `bankTransactionRef` được chuẩn hóa chữ hoa; trùng ngân hàng chuyển + tài khoản chuyển + mã giao dịch sẽ bị chặn, kể cả giữa hai refund khác nhau.

Ảnh là tùy chọn: truyền `evidenceMediaId` của ảnh READY thuộc admin xác nhận trong media hiện có. Không gửi URL ảnh tùy ý; không có API upload riêng của refund.

Kết quả hoàn thành có `status=SUCCEEDED`, `manualRefund.manualStatus=COMPLETED`, `confirmationSource=ADMIN_MANUAL`. Việc cập nhật refund, hóa đơn, audit, idempotency và outbox là một transaction. Không mở lại refund đã hoàn.

### Chuyển khoản chưa rõ kết quả

- Gọi review với `{ "expectedVersion": 3, "reason": "Ngan hang timeout, can kiem tra lich su" }`. Giữ assignment và tiền dành cho refund.
- Không chuyển lần nữa khi chưa biết kết quả. Nếu xác minh đã thành công, complete với version mới.
- Nếu chưa chuyển tiền và đang PROCESSING, có thể release với `noTransferConfirmed: true`, reason và expectedVersion. NEEDS_REVIEW không được release; cần điều tra trước.
- Admin có thể reassign cho một admin ACTIVE khác, bắt buộc reason. Trạng thái giữ NEEDS_REVIEW và giữ thời điểm claim gốc để ghi nhận được giao dịch đã diễn ra trước khi đổi người xử lý.
- Hệ thống chỉ ngăn ghi nhận/chia việc trùng trong database, không thể ngăn hai người tự chuyển tiền ngoài hệ thống nếu bỏ qua quy trình.

### Trạng thái và đối soát

| manualStatus | Refund.status | Ý nghĩa |
|---|---|---|
| AWAITING_RECIPIENT | PENDING | Chờ tài khoản nhận |
| READY | PENDING | Chờ admin nhận |
| PROCESSING | PROCESSING | Đã được giao xử lý |
| NEEDS_REVIEW | PROCESSING | Kết quả ngân hàng chưa rõ |
| COMPLETED | SUCCEEDED | Admin xác nhận hoàn thành |

Worker provider-recovery bỏ qua manual refund ngay trong truy vấn claim; không tăng retry, không tự FAILED. `POST /admin/refunds/:id/reconcile` từ chối manual refund bằng 409; sử dụng luồng manual ở trên.

Hoàn cọc rental vẫn được worker nghiệp vụ áp dụng sau `REFUND_SUCCEEDED`. `GET /refunds/:id` trả `settlementProcessingStatus` cho DEPOSIT: PENDING/PROCESSED/FAILED; không coi claim hoặc complete response là bằng chứng worker rental đã hoàn tất. API rental deposit/history và lịch sử người dùng có thêm thông tin executionMode/confirmationSource để không gọi hoàn thủ công là xác nhận của provider.

## Giao dịch thu bất thường

```text
GET /api/v1/admin/payos-payments?reconcileStatus=NEEDS_REVIEW
```

Admin xem số tiền dự kiến, số tiền quan sát, số giao dịch và lý do cần kiểm tra. Chuyển thiếu/thừa, nhiều lần hoặc sai mapping được giữ bằng chứng trong database/audit, không tự xác nhận đơn hoặc phát hành refund tùy ý. Có thể yêu cầu truy vấn lại bằng `POST /admin/payments/:id/reconcile` với reason; truy vấn lại không tự xóa một quyết định NEEDS_REVIEW chưa được giải quyết.

V1 chưa có API điều chỉnh số tiền/hợp nhất nhiều khoản thu hoặc tự giải quyết phần tiền thừa. Đối soát trường hợp này với ngân hàng/payOS trước khi xử lý tiếp; không sửa trực tiếp bảng payment/refund để ép trạng thái.

## Kiểm thử và nghiệm thu

Chạy focused protocol/HTTP tests:

```text
npx jest --config test/jest-payments.json --runInBand --runTestsByPath test/payos-payments.spec.ts test/vnpay-payments.spec.ts test/momo-payments.spec.ts test/mock-checkout-payments.spec.ts
```

Để chạy các ca PostgreSQL về claim/complete song song, cần `PAYMENT_TEST_DATABASE_URL` trỏ vào database local riêng có tên `payment_test_*`, đã áp dụng migration. Không dùng database dự án làm database test, không reset dữ liệu đang có. Bộ test tạo fixture bằng ID riêng và không xóa dữ liệu người dùng.

Kiểm thử tiền thật là bước nghiệm thu riêng: dùng kênh payOS đã xác thực, cấu hình đúng tài khoản, thanh toán số nhỏ, kiểm tra tiền nhận, hủy theo chính sách, chuyển khoản hoàn rồi complete. Các test tự động dùng transport stub; việc chúng chạy thành công không chứng minh đã phát sinh giao dịch thật.

Tham khảo: [payOS API](https://payos.vn/docs/api/), [webhook](https://payos.vn/docs/du-lieu-tra-ve/webhook/), [chữ ký](https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/).

## Kết quả xác minh triển khai — 03/11/2026

- Nest build và Prisma validate: thành công.
- Bốn suite payOS, VNPay, MoMo và mock: 88 test thành công, gồm HTTP và PostgreSQL concurrency cho payOS.
- Bảy suite payment webhook, technical reversal, history, Swagger, rental cancellation/payment consumer/returns: 138 test thành công.
- Bộ integration tổng hợp `test/payments.spec.ts`: 60 test thành công, 15 test thất bại. Đã tái hiện đúng 15 lỗi khi ánh xạ riêng `RefundsService` sang bản gốc HEAD trong một bản sao kiểm thử; không thay thế source workspace. Các lỗi gồm kỳ vọng trạng thái hóa đơn cũ sau technical reversal và fixture rental không đáp ứng điều kiện checkout hiện tại. Không thay chính sách hoặc cập nhật các test đó trong thay đổi payOS này.
- Migration mới đã áp dụng vào database cấu hình, không reset database hoặc sửa migration cũ. Các test PostgreSQL chạy trong database local `payment_test_*` riêng.
- Chưa bật payOS trong `.env`, chưa dùng merchant thật hoặc thực hiện giao dịch tiền thật. Cần cấu hình kênh đã xác thực và thực hiện nghiệm thu end-to-end riêng.
