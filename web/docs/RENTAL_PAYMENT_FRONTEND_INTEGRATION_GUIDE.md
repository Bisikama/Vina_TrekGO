# Hướng dẫn FE tích hợp thanh toán đơn thuê thiết bị

Đối chiếu mã nguồn trong workspace ngày 20/10/2026. Tài liệu này là contract triển khai FE theo code trong workspace, không phải xác nhận đã chạy giao dịch MoMo/VNPay end-to-end trên sandbox. Tất cả URL dưới đây có tiền tố `/api/v1` và cần Bearer token, trừ khi Swagger của endpoint ghi khác.

## 1. Nghiệp vụ và màn hình FE

| Giai đoạn | FE cần hiển thị | Nguồn dữ liệu |
|---|---|---|
| Trước thanh toán | Phí thuê, cọc, tổng thu và hạn thanh toán | Quote, RentalOrder |
| Checkout | Cổng khả dụng, link thanh toán hoặc QR | `GET /payments/options`, response tạo payment |
| Sau khi quay về | Đang xác nhận, thành công, thất bại hoặc cần hỗ trợ | Trạng thái payment **từ backend** và chi tiết order |
| Gia hạn | Phí bổ sung và trạng thái áp dụng gia hạn | Extension quote, extension payment |
| Sau trả thiết bị | Cọc từng thiết bị, khoản giữ lại, refund đang xử lý/đã hoàn | `GET /rental-orders/{id}/deposit`, lịch sử payment/refund |

Thanh toán ban đầu thu **một lần tổng phí thuê + toàn bộ cọc** (`totalAmount = rentalFee + totalDeposit`). Backend tính giá theo quote và chốt giá trên order; FE không gửi `amount`, `rentalFee` hay `deposit` vào API payment. Gia hạn có phí tạo invoice/payment riêng **chỉ cho phí gia hạn**, không thu lại cọc. Gia hạn miễn phí được áp dụng khi xác nhận extension và không cần tạo checkout.

Cọc không tự động trở thành tiền hoàn khi user trả đồ hoặc khi kho đánh dấu thiết bị sẵn sàng cho thuê lại. Kho cần nhận thiết bị, kiểm tra FINAL; khoản khấu trừ cần qua nghiệp vụ duyệt; refund được xác nhận khi `refund.status === "SUCCEEDED"`. Có thể hoàn toàn bộ, một phần hoặc giữ toàn bộ cọc **theo từng thiết bị**. `invoiceStatus === "PARTIALLY_REFUNDED"` vẫn có thể là kết quả đúng khi đã hoàn đủ cọc nhưng phí thuê được giữ lại.

**Giới hạn hiện tại cần thể hiện đúng trên UI:** nhánh FINAL `PASS` không khấu trừ đang ghi `REVIEW_REQUIRED` với lý do `FINAL_PASS_AWAIT_GROUPED_REFUND`. Worker hiện không chọn trạng thái này để tạo refund, nên FE không được hứa rằng cọc sẽ tự hoàn ngay sau FINAL PASS. Hiển thị “Đang chờ xử lý hoàn cọc” và theo dõi API cọc/refund; nếu kéo dài, hướng user đến hỗ trợ. Không tự tính hay tự phát lệnh hoàn từ FE.

### Quy tắc thuê trên Public Trip

Giữ đúng logic Rental hiện tại: trên Public Trip, **chủ Booking hợp lệ** được thuê cho tài khoản của mình, kể cả khi đặt vé hộ người khác; **người đi cùng cũng được tự thuê** nếu `booking_participants.userId` được liên kết với tài khoản đang đăng nhập, participant `ACTIVE`, Booking liên quan còn ở trạng thái hợp lệ và Rental trả đủ điều kiện. Chỉ có tài khoản trong hệ thống hoặc có tên/số điện thoại trong danh sách đi cùng **chưa đủ**; `booking_participants.userId = null` không cấp quyền tự thuê cho người đó. Leader Public Trip và thành viên Private Trip có điều kiện riêng.

Ví dụ A đứng tên Booking cho B: A có thể tạo đơn Rental của A. Nếu participant của B đã liên kết `userId` với tài khoản B, B cũng có thể tạo **đơn Rental riêng của B**, tự thanh toán và nhận thiết bị cho chính mình. Đơn B lưu `userId = B` và tham chiếu Booking của A bằng `bookingId`; B không dùng đơn hoặc payment của A. FE không chặn B chỉ vì `booking.userId !== B`, cũng không cho A chọn B làm người nhận trong đơn của A. Mỗi người thuê theo context/`recipientOptions` mà backend trả cho chính tài khoản đăng nhập.

FE gọi `GET /trips/{tripId}/rental-eligibility` bằng token của người đang thao tác. Dùng `eligible` và `allowedActions` từ response để quyết định mở bước tạo quote/đơn; nếu có `existingOpenOrderId`, dẫn tới đơn hiện có thay vì tạo đơn mới. `eligible=false` thì hiển thị `reason`; `TRIP_MEMBERSHIP_NOT_FOUND` (404) nghĩa là backend không tìm thấy context thành viên/Booking gắn với tài khoản đó. Quyền vẫn được backend kiểm tra lại khi tạo quote, tạo đơn, checkout và xử lý payment; FE phải tải lại trạng thái nếu dữ liệu thay đổi.

## 2. Luồng checkout ban đầu

```text
GET  /payments/options
GET  /trips/{tripId}/rental-eligibility
GET  /rentals/availability?tripId=...&productId=...
POST /rentals/quote
POST /rental-orders                         Idempotency-Key
POST /rental-orders/{orderId}/payments      Idempotency-Key
    -> mở checkout.url hoặc hiển thị checkout.qrData
    -> gateway gọi webhook/IPN về backend
GET  /rental-orders/{orderId}/payment       poll
GET  /rental-orders/{orderId}               kiểm tra order/reservation
```

**Việc FE cần sửa khi tích hợp:** `web/src/features/rentals/services/rental.api.ts` hiện dùng `createMockEligibility(bookingId)` và luôn đặt `eligible: true`; đây không phải kết quả kiểm tra quyền từ backend. Thay bằng endpoint `GET /trips/{tripId}/rental-eligibility` và cập nhật kiểu dữ liệu FE theo response thực tế (`eligible`, `reason`, `allowedActions`, `recipientOptions`, `existingOpenOrderId`, `rentalCutoffAt`). Màn hình `/rentals` hiện chỉ nhận `bookingId` trong URL, nên FE cần truyền/lấy được `tripId` cho cả chủ Booking lẫn participant B; `bookingId` của A không chứng minh B đủ quyền và API chi tiết Booking của A không nhất thiết mở cho B. Nếu chưa có đường cho B truy cập Trip tương ứng, FE phối hợp nhóm Booking về nguồn danh sách chuyến/participant. Không suy quyền thuê từ `bookingId`, `booking.userId` hoặc kết quả mock. Nếu truyền `recipientTripMemberId` khi tạo quote, chỉ lấy ID từ `recipientOptions` mà backend trả cho chính tài khoản đang đăng nhập; có thể bỏ field này khi dùng người nhận mặc định.

Quote nhận body như sau; `requestedReturnAt` và `returnOptionId` là tùy chọn theo phương án trả thiết bị:

```json
{
  "tripId": "<trip UUID>",
  "recipientTripMemberId": "<trip member UUID nếu cần>",
  "requestedReturnAt": "2026-12-15T10:00:00+07:00",
  "returnOptionId": "<return option ID>",
  "items": [{ "productId": "<product UUID>", "quantity": 1 }]
}
```

Chỉ gửi các field tùy chọn khi có giá trị. Quote trả `id` và `amounts: { feeAmount, depositAmount, totalAmount, currency }` (number VND nguyên); hiển thị các giá trị đó và không tính lại từ giá catalog. `POST /rental-orders` nhận `{ "quoteId": "<quote.id còn hạn>" }` và trả `{ order, quantityReservations }`. Order dùng tên `rentalFee`, `totalDeposit`, `totalAmount`, `currency`; lấy `order.id`, `order.paymentExpiresAt`, `order.status`, `order.financialStatus` từ response này.

Body tạo checkout cho đơn ban đầu và gia hạn giống nhau:

```http
POST /api/v1/rental-orders/{orderId}/payments
Authorization: Bearer <token>
Idempotency-Key: <key riêng cho thao tác này>
Content-Type: application/json

{"paymentMethod":"REDIRECT","gateway":"vnpay"}
```

`gateway` có thể là `momo` hoặc `vnpay`, hoặc bỏ trống để dùng cổng mặc định. Chỉ đưa ra lựa chọn có trong `GET /payments/options`; response có `defaultGateway` và `gateways[].{gateway,environment,methods}`. Bắt đầu với `REDIRECT` cho cả hai cổng. Nếu dùng `QR`, xử lý theo **`checkout.type` thực tế**: MoMo có thể có `qrData`; VNPay vẫn có thể trả hosted redirect URL. FE không giả định phương thức gửi lên quyết định hình thức checkout trả về.

Response tạo payment là object trực tiếp, không có lớp `data` bổ sung từ backend:

```ts
type PaymentGateway = "momo" | "vnpay";
type PaymentStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";

type RentalCheckoutResponse = {
  paymentId: string;
  invoiceId: string;
  invoiceType: "RENTAL";
  status: PaymentStatus;
  amount: string; // VND nguyên dạng chuỗi, ví dụ "150000"
  currency: string;
  providerEnvironment: "MOCK" | "SANDBOX" | "PRODUCTION";
  gateway: PaymentGateway;
  checkout: { type: "QR" | "REDIRECT"; url: string | null; qrData: string | null } | null;
  expiresAt: string | null;
  reconciliationRequired: boolean;
};
```

HTTP `201` là payment mới, `200` là lần gọi lặp trả payment hiện có, `202` là payment đã ghi nhận nhưng checkout chưa chắc chắn (`checkout` có thể `null`). Với `202` hoặc `checkout === null`, hiện trạng thái đang xử lý và poll backend; không báo thất bại hay tạo key mới. Nếu có `checkout.url` của cổng thật, chuyển đến URL đó; riêng `providerEnvironment=MOCK` xem mục 4. Nếu `checkout.type === "QR"` và có `qrData`, hiển thị QR và đồng thời poll. Không coi response tạo checkout là bằng chứng đã trả tiền.

## 3. Idempotency và retry

- Dùng key khác nhau cho `createOrder`, payment ban đầu, xác nhận extension và payment extension. Header `Idempotency-Key` của payment phải dài 1–200 ký tự ASCII không có khoảng trắng; `crypto.randomUUID()` phù hợp.
- Lưu key theo thao tác và body trong `sessionStorage` để giữ qua reload/redirect. Khi timeout hoặc mất mạng mà chưa biết kết quả, gọi lại **cùng key và cùng body**. Đổi gateway hoặc `paymentMethod` là thao tác mới và cần key khác.
- Trước khi tạo payment mới, đọc trạng thái payment hiện tại. Khi `PENDING`/`PROCESSING`, khóa nút thanh toán và poll. Với `PAYMENT_ATTEMPT_IN_PROGRESS`, chuyển sang polling.
- Sau trạng thái terminal, chỉ cho thử lại nếu order/extension vẫn được backend cho phép và `nextAction`/trạng thái phù hợp; lần thử mới dùng key mới. Không retry payment đã `SUCCEEDED` chỉ vì FE chưa thấy order cập nhật.
- Chống double click và tránh các vòng polling chạy chồng request. Không xóa key chỉ vì navigation hoặc HTTP `202`.

## 4. Trang `/payment-return` và trạng thái authoritative

Backend tạo return path:

```text
/payment-return?rentalOrderId={orderId}
/payment-return?rentalOrderId={orderId}&extensionId={extensionId}
```

Trang hiện tại `web/src/app/(private)/(user)/payment-return/page.tsx` chỉ đọc `bookingId` và suy ra kết quả từ `vnp_ResponseCode`/`resultCode`. FE cần nhận diện loại giao dịch bằng ID nghiệp vụ **trước khi** diễn giải tham số của cổng:

| Query trên return URL | Nhánh FE | Nguồn trạng thái sau khi quay về |
|---|---|---|
| `rentalOrderId` + `extensionId` | Gia hạn Rental | `GET /rental-extensions/{extensionId}/payment` |
| `rentalOrderId`, không có `extensionId` | Thanh toán đơn Rental ban đầu | `GET /rental-orders/{rentalOrderId}/payment` và `GET /rental-orders/{rentalOrderId}` |
| `bookingId`, không có ID Rental | Booking | API trạng thái Booking tương ứng do nhóm Booking/FE thống nhất |

Backend tạo return path ở trên chỉ kèm ID nghiệp vụ, **không bảo đảm có `paymentId`**. FE có thể lưu context checkout trong `sessionStorage` trước redirect để hỗ trợ khôi phục khi URL mất query, nhưng phải xác minh lại trạng thái qua backend. URL không có `vnp_ResponseCode`/`resultCode` (kể cả URL chỉ có ID nghiệp vụ, hoặc thêm `paymentId`) phải hiển thị “Đang xác minh giao dịch” rồi gọi API theo nhánh tương ứng; không báo thất bại vì thiếu mã cổng. Không dùng mã kết quả, `amount`, `transactionRef`, `paymentId` hoặc thông báo cổng trên URL để tự xác nhận thanh toán thành công. Nếu không có ID nghiệp vụ và cũng không khôi phục được context, hiển thị trạng thái chưa xác định và lối quay về danh sách đơn; không gán nhầm giao dịch vào Booking.

Với `providerEnvironment=MOCK`, `checkout.url` do backend trả về là URL `.invalid` phục vụ mô phỏng, không phải redirect hoạt động như cổng thật. Trong môi trường cho phép thử nghiệm, UI kiểm thử có thể dùng `POST /payments/{paymentId}/mock-confirm` với payment ID từ response checkout, rồi poll trạng thái nghiệp vụ. HTTP `202` của thao tác xác nhận MOCK vẫn chỉ là đang xử lý.

Với đơn ban đầu, poll `GET /rental-orders/{id}/payment` và `GET /rental-orders/{id}`. Trạng thái payment trả về trực tiếp:

```ts
type RentalPaymentStatus = {
  paymentRef: string; // "" khi NOT_STARTED
  status: "NOT_STARTED" | PaymentStatus;
  nextAction: { type: "CREATE_PAYMENT" | "AWAIT_PAYMENT_RESULT" | "RETRY_PAYMENT" } | null;
  expiresAt: string | null;
  amount: number; // VND nguyên, khác kiểu amount của checkout
  refundedAmount: number;
  paidAt?: string | null;
  invoiceStatus: string | null;
  applicationStatus: "PENDING" | "APPLIED" | "REJECTED" | null;
  applicationReasonCode: string | null;
  reconciliationStatus: string | null;
  reconciliationRequired: boolean;
  gateway: PaymentGateway | null;
  providerEnvironment: string | null;
  paymentMethod: "QR" | "REDIRECT" | null;
  orderStatus: string;
  financialStatus: string;
};
```

Chỉ hiển thị **thanh toán đơn thuê hoàn tất ngay sau checkout** khi `status=SUCCEEDED`, `applicationStatus=APPLIED`, `invoiceStatus=PAID`, `orderStatus=PAID`, `financialStatus=PAID` và các `quantityReservations` trong chi tiết order đều `CONFIRMED`. Chi tiết order là `{ order, items, quantityReservations, ... }`; đọc `order.status`, không giả định `status` ở top level. Khi xem lại đơn sau đó, `orderStatus` có thể đã tiến sang `PREPARING`, `READY_FOR_HANDOVER` hoặc `ACTIVE`; đó không phải lỗi payment nếu application đã `APPLIED` và trạng thái tài chính/đơn vẫn phù hợp. Nếu payment thành công nhưng application/order còn chậm, tiếp tục báo “Đang xác nhận đơn thuê” và poll. Nếu payment thất bại/hết hạn, tải lại order để quyết định khả năng thử lại. Nếu `applicationStatus=REJECTED` hoặc `reconciliationStatus=NEEDS_REVIEW`, hiển thị cần hỗ trợ/đối soát; không tự tạo payment mới.

`status=SUCCEEDED` chỉ xác nhận cổng đã thu tiền; nó **không** bảo đảm Rental đã nhận đơn. Nếu `applicationStatus=REJECTED`, hiển thị lý do từ `applicationReasonCode` và trạng thái “Đã thu tiền, đơn thuê không được áp dụng; đang kiểm tra hoàn tiền”. Theo dõi refund ở mục 6; chỉ đổi sang “Đã hoàn tiền” khi refund `SUCCEEDED`. Khi đơn đã `CANCELLED`, luôn ưu tiên trạng thái hủy và hoàn tiền từ chi tiết order/lịch sử giao dịch, kể cả nếu payment status `SUCCEEDED` hoặc `nextAction` gợi ý `CREATE_PAYMENT`/`AWAIT_PAYMENT_RESULT`; không mở checkout mới cho đơn đã hủy.

Poll tuần tự (ví dụ mỗi 1,5–2 giây) và dừng sau timeout UI khoảng 60 giây. Timeout UI chỉ có nghĩa **chưa xác nhận được**: cho user tải lại trang hoặc mở chi tiết đơn để tiếp tục kiểm tra. Không tự hủy order và không kết luận giao dịch thất bại vì hết thời gian chờ của FE.

FE cần kiểm tra các đường quay về: Booking, đơn Rental ban đầu, gia hạn; VNPay/MoMo có và không có mã kết quả; MOCK không có mã cổng; reload trang; webhook đến chậm; payment thành công nhưng application chưa `APPLIED`. Các trường hợp chưa có kết luận từ backend phải tiếp tục hiển thị đang xác minh hoặc cần hỗ trợ theo trạng thái thực tế.

## 5. Gia hạn thuê

```text
POST /rental-orders/{orderId}/extension-quotes
POST /rental-orders/{orderId}/extensions       Idempotency-Key
  nếu additionalFee = 0 -> gia hạn áp dụng ngay, không gọi payment
  nếu additionalFee > 0:
POST /rental-extensions/{extensionId}/payments Idempotency-Key mới
GET  /rental-extensions/{extensionId}/payment  poll
```

Extension quote nhận `{ requestedReturnAt, returnOptionId }`; quote này **chưa giữ tồn kho**. Xác nhận extension nhận `{ extensionQuoteId, expectedVersion, acceptedTermsVersion, termsHash? }`, lấy version và điều khoản từ order/quote mới nhất. Bước xác nhận mới giữ capacity bổ sung. Nếu phí > 0, thanh toán `additionalFee` qua checkout riêng; đừng dùng lại key/payment ban đầu.

`GET /rental-extensions/{id}/payment` trả `extensionId`, `rentalOrderId`, `extensionStatus`, `invoiceStatus`, `paymentRef`, `paymentStatus`, `applicationStatus`, `applicationReasonCode`, `reconciliationStatus`, `reconciliationRequired`, `amount` (**string** VND nguyên), `currency`, `expiresAt`, `paidAt`. Chỉ báo gia hạn có phí hoàn tất khi đồng thời `paymentStatus=SUCCEEDED`, `applicationStatus=APPLIED`, `invoiceStatus=PAID`, `extensionStatus=APPLIED`. Payment thành công nhưng extension chưa `APPLIED` là trạng thái đang áp dụng hoặc cần đối soát, không phải lý do tạo payment khác. Nếu `applicationStatus=REJECTED` (ví dụ `EXTENSION_NOT_APPLICABLE` khi lịch thuê gốc thay đổi), gia hạn không có hiệu lực; khoản đã thu đi vào luồng hoàn kỹ thuật. `invoiceStatus=PAID` trong lúc này phản ánh tiền đã thu, **không** có nghĩa gia hạn được áp dụng. Sau khi cổng xác nhận hoàn, invoice chuyển `REFUNDED` hoặc `PARTIALLY_REFUNDED`; FE kiểm tra refund thực tế trước khi báo đã hoàn. Với gia hạn miễn phí, kiểm tra `extensionStatus=APPLIED` từ response xác nhận/chi tiết extension; `paymentStatus=NOT_STARTED` là bình thường.

## 6. Cọc, refund và lịch sử giao dịch

Sau bàn giao/trả thiết bị, trang chi tiết đơn nên gọi `GET /rental-orders/{id}/deposit`. Response gồm `collectedAmount`, `heldAmount`, `refundedAmount`, `refundPendingAmount`, `deductionAmount`, `items[]`, `groupedRefunds[]`; các số tiền này là **number VND nguyên**. Mỗi item có `unitId`, `assetCode`, `depositAmount`, `status`, `inspectionStatus`, `refundRef`, `refundStatus`, `heldReason`, `deduction`, `refundAmount`. Dùng `refundRef` khác `null` để gọi `GET /refunds/{refundId}`; chỉ `SUCCEEDED` mới là đã hoàn tiền. `refundPendingAmount` và `refundedAmount` là hai khoản riêng.

`GET /rental-orders/{id}/payment` phục vụ trạng thái **payment ban đầu** và chỉ lấy invoice đầu tiên của đơn; không dùng endpoint này làm danh sách toàn bộ payment gia hạn/refund. `refundedAmount` ở đây có thể bao gồm các refund thành công của order, nên phần quyết toán cọc cần dựa vào `/deposit` và chi tiết refund.

Backend workspace cũng có `GET /rental-orders/{id}/payments` để hiển thị lịch sử **các lần thử thanh toán** của đơn, gồm payment ban đầu và extension, mỗi payment kèm `refunds[]`. Swagger hiện đánh dấu endpoint này “Proposed Non-Breaking API Extension — Pending BA Contract Adoption”; FE nên xác nhận endpoint đã có trong môi trường bàn giao trước khi phụ thuộc vào nó. Query: `page` (mặc định 1), `pageSize` (mặc định 20, tối đa 100), `status`, `from`, `to` (ISO-8601; `from <= to`). Response:

```ts
type RentalPaymentHistory = {
  orderId: string;
  items: Array<{
    paymentId: string; paymentRef: string; invoiceId: string;
    purpose: "RENTAL_PAYMENT" | "RENTAL_EXTENSION";
    amount: string; currency: string; status: PaymentStatus;
    applicationStatus: "PENDING" | "APPLIED" | "REJECTED" | null;
    paymentMethod: string | null; paymentGateway: string;
    createdAt: string; paidAt: string | null;
    refunds: Array<{
      refundId: string; amount: string; status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
      purpose: string; createdAt: string; refundedAt: string | null;
    }>;
  }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
```

`amount` trong lịch sử được định dạng **string có 2 chữ số thập phân** (ví dụ `"150000.00"`), khác response checkout (`"150000"`) và deposit (number). Phân trang đếm **payment**, còn refund nằm lồng trong payment đó; bộ lọc `status`/thời gian lọc payment, không lọc riêng refund. Không cộng các payment `FAILED` vào “đã thanh toán”; không cộng refund `PENDING` vào “đã hoàn”. Nếu có màn hình giao dịch chung, `GET /user/transactions?source=RENTAL` là timeline payment/refund riêng từng dòng, khác shape của lịch sử theo order.

Hủy trước bàn giao có `GET /rental-orders/{id}/cancellation-preview` và `POST /rental-orders/{id}/cancel`. FE phải hiển thị `feeRefund`, `depositRefund` từ preview, gửi `previewVersion` và `expectedVersion` hiện hành khi xác nhận; không dùng công thức hoàn cọc sau sử dụng cho luồng hủy. Refund có thể chưa hoàn tất khi API hủy trả về. Theo dõi `refundRef` bằng `GET /refunds/{id}` nếu có. Hủy muộn có thể giữ phí thuê nhưng hoàn cọc; đơn chưa trả tiền không phát sinh tiền hoàn.

### Trip/Booking hủy đơn Rental trước bàn giao

Trip hoặc Booking bị hủy có thể làm Rental chuyển `order.status=CANCELLED` mà user không gọi `POST /rental-orders/{id}/cancel`. Tải lại chi tiết order khi nhận thông tin hủy; khóa nút thanh toán/gia hạn/nhận đồ theo trạng thái mới. Backend hủy invoice/payment chưa thu (`DRAFT`/`PENDING_PAYMENT`, `PENDING`/`PROCESSING`). Nếu cổng báo thu tiền **sau** khi payment được đánh dấu `CANCELLED`, callback đã xác thực vẫn có thể đổi payment thành `SUCCEEDED`, nhưng Rental từ chối áp dụng đơn và yêu cầu hoàn kỹ thuật. FE không coi callback hoặc `payment.status=SUCCEEDED` riêng lẻ là đơn còn hiệu lực.

Chính sách hủy tự động **trước bàn giao** mà backend đang áp dụng theo SOT Rental:

| Nguồn hủy | Phí thuê hoàn | Cọc hoàn |
|---|---:|---:|
| Hệ thống/TrekGo hủy Trip hoặc Booking | 100% | 100% |
| USER hủy Booking trước hoặc đúng hạn miễn phí theo `rentalPolicy.freeCancellationHours` (baseline 24 giờ trước `rentalStartAt`) | 100% | 100% |
| USER hủy Booking sau hạn miễn phí | 0% | 100% |

Đây là số tiền **dự kiến theo chính sách**, không phải chứng từ đã hoàn. Với đơn đã thu, khi backend đặt được refund, `order.financialStatus=REFUND_PENDING`; sau khi cổng xác nhận refund `SUCCEEDED`, trạng thái thành `REFUNDED` hoặc `PARTIALLY_REFUNDED` và invoice tương ứng được cập nhật. Nếu không xác minh được nguồn hủy, nguồn payment/giá trị hoàn, hoặc đơn có nhiều payment/gia hạn đã áp dụng, backend có thể để `financialStatus=PAID` và `exceptionStatus=ACTION_REQUIRED` để đối soát thủ công. FE hiển thị cần hỗ trợ, không tự hứa số tiền hoặc thời điểm hoàn. Refund `FAILED`/`CANCELLED` cũng cần hỗ trợ; trạng thái `REFUND_PENDING` không đồng nghĩa tiền đã về tài khoản.

Để theo dõi khoản hoàn từ hủy tự động hoặc hoàn kỹ thuật, dùng `GET /rental-orders/{id}/payments` (nếu endpoint đã có ở môi trường FE) và `refunds[]` của từng payment, hoặc timeline `GET /user/transactions?source=RENTAL`; có `refundId` thì xem `GET /refunds/{refundId}`. `GET /rental-orders/{id}/deposit` phục vụ quyết toán cọc sau trả đồ, không phải nguồn duy nhất để xác định khoản hoàn khi hủy trước bàn giao. Nếu chưa thấy refund sau khi payment đã `SUCCEEDED` nhưng application `REJECTED`, tiếp tục hiển thị đang đối soát/cần hỗ trợ; không tự tạo yêu cầu hoàn mới từ FE.

## 7. Gọi API và xử lý lỗi

FE hiện có `apiClient` tại `web/src/lib/axios.ts` với interceptor token/refresh. Dùng lại client đó. `web/next.config.ts` hiện chỉ rewrite `trips`, `bookings`, `auth`, `payments`; khi dùng same-origin `{ baseURL: "" }`, FE cần thêm rewrite `/api/v1/rentals/:path*`, `/api/v1/rental-orders/:path*`, `/api/v1/rental-extensions/:path*` đến cùng backend với các resource hiện có. Thêm các resource catalog liên quan nếu màn hình sử dụng. Nếu FE gọi backend khác origin trực tiếp thì kiểm tra base URL và CORS của môi trường thực tế thay vì dựa vào rewrite.

Sau khi thêm rewrite, kiểm tra trực tiếp trên origin của Next.js rằng `GET /api/v1/rental-orders/{id}/payment` và `GET /api/v1/rental-extensions/{id}/payment` tới đúng API; kiểm tra cả `POST /api/v1/rental-orders/{id}/payments` và `POST /api/v1/rental-extensions/{id}/payments` khi tích hợp checkout. Restart Next.js sau khi đổi `next.config.ts`.

Ví dụ service tối thiểu:

```ts
import { apiClient } from "@/lib/axios";

const sameOrigin = { baseURL: "" };
const withKey = (key: string) => ({ ...sameOrigin, headers: { "Idempotency-Key": key } });

export const rentalPaymentApi = {
  options: async () => (await apiClient.get("/api/v1/payments/options", sameOrigin)).data,
  createOrder: async (quoteId: string, key: string) =>
    (await apiClient.post("/api/v1/rental-orders", { quoteId }, withKey(key))).data,
  checkout: async (orderId: string, gateway: PaymentGateway, key: string) =>
    (await apiClient.post<RentalCheckoutResponse>(
      `/api/v1/rental-orders/${orderId}/payments`,
      { paymentMethod: "REDIRECT", gateway }, withKey(key),
    )).data,
  payment: async (orderId: string) =>
    (await apiClient.get<RentalPaymentStatus>(`/api/v1/rental-orders/${orderId}/payment`, sameOrigin)).data,
  order: async (orderId: string) =>
    (await apiClient.get(`/api/v1/rental-orders/${orderId}`, sameOrigin)).data,
  deposit: async (orderId: string) =>
    (await apiClient.get(`/api/v1/rental-orders/${orderId}/deposit`, sameOrigin)).data,
  extensionCheckout: async (extensionId: string, gateway: PaymentGateway, key: string) =>
    (await apiClient.post<RentalCheckoutResponse>(
      `/api/v1/rental-extensions/${extensionId}/payments`,
      { paymentMethod: "REDIRECT", gateway }, withKey(key),
    )).data,
  extensionPayment: async (extensionId: string) =>
    (await apiClient.get(`/api/v1/rental-extensions/${extensionId}/payment`, sameOrigin)).data,
};
```

Global error response có dạng `{ error: { code, message, details, retryable }, meta: { requestId, serverTime, contractVersion } }`. Với Axios đọc `error.response?.data?.error`, không đọc top-level `message`/`code`. Ưu tiên hành động theo `error.code`:

| Code / trạng thái | FE xử lý |
|---|---|
| `VALIDATION_ERROR` (`400`) | Hiển thị lỗi input; kiểm tra UUID, body, header key |
| `UNAUTHENTICATED`/`UNAUTHORIZED` (`401`) | Dùng refresh/login flow hiện có |
| `FORBIDDEN` (`403`), `PAYMENT_NOT_FOUND`/`RENTAL_ORDER_NOT_FOUND` (`404`) | Không hiển thị dữ liệu đơn khác; tải lại danh sách hoặc báo không tìm thấy |
| `PAYMENT_ATTEMPT_IN_PROGRESS` (`409`) | Poll payment hiện tại |
| `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD` (`409`) | Kiểm tra body/key đã lưu; không retry mù bằng key mới |
| `PAYMENT_INVALID_STATE` (`409`) | Reload order/extension và kiểm tra hạn giữ chỗ |
| `PAYMENT_AMOUNT_MISMATCH` (`422`) | Dừng checkout, báo hỗ trợ; FE không sửa amount |
| `INSUFFICIENT_AVAILABLE_QUANTITY` (`400`) | Tạo quote lại/đổi số lượng hoặc thời gian |
| `PAYMENT_PROVIDER_UNAVAILABLE` (`503`) | Hiển thị sự cố cổng; retry theo `error.retryable` sau khi kiểm tra trạng thái |

HTTP code và `error.code` là hai lớp khác nhau; ví dụ `PAYMENT_INVALID_STATE` hiện được đăng ký HTTP `409` trong shared error definitions. Lỗi mạng/timeout không có response body: giữ key và kiểm tra trạng thái backend trước khi quyết định gửi lại.

## 8. Checklist bàn giao FE

- [ ] Public Trip: chủ Booking hợp lệ và participant `ACTIVE` đã liên kết `userId` có thể thuê riêng khi backend trả đủ điều kiện; participant chưa liên kết tài khoản không tự thuê. Không chặn participant chỉ vì họ không phải chủ Booking.
- [ ] Thay `createMockEligibility()` đang luôn trả `eligible: true` bằng `GET /trips/{tripId}/rental-eligibility`; dùng `eligible`, `allowedActions`, `existingOpenOrderId` và `recipientOptions` theo response thực tế.
- [ ] Đường vào `/rentals` cung cấp `tripId` cho cả người đặt vé và participant đã liên kết; không lấy quyền thuê của B từ Booking detail chỉ dành cho A.
- [ ] Quote hiển thị `amounts.feeAmount`, `amounts.depositAmount`, `amounts.totalAmount`; order dùng `quote.id` còn hạn và key riêng.
- [ ] Chỉ hiển thị gateway backend bật; mở `checkout.url` hoặc QR theo response thực tế.
- [ ] Retry timeout giữ cùng key/body; double click và reload không tạo payment trùng.
- [ ] `/payment-return` nhận cả rental ban đầu và extension, xác nhận qua backend; `202`/pending không bị báo thất bại.
- [ ] `/payment-return` phân nhánh bằng `extensionId` + `rentalOrderId`, `rentalOrderId`, hoặc `bookingId`; URL thiếu `vnp_ResponseCode`/`resultCode` vẫn xác minh qua backend, kể cả MOCK và URL không có `paymentId`.
- [ ] `web/next.config.ts` rewrite `rentals`, `rental-orders`, `rental-extensions`; thử cả GET trạng thái và POST checkout qua `/api/v1/...` trên origin của Next.js.
- [ ] Thành công đơn ban đầu kiểm tra payment, application, invoice, order và reservation; thành công gia hạn có phí kiểm tra đủ bốn trạng thái extension.
- [ ] Đơn `CANCELLED` khóa checkout dù `nextAction` còn gợi ý tạo/chờ payment; callback thu tiền đến muộn và `applicationStatus=REJECTED` được hiển thị là đang hoàn/đối soát, không phải thành công đơn.
- [ ] Hủy Trip/Booking trước bàn giao hiển thị chính sách phí/cọc, phân biệt `REFUND_PENDING`, refund `SUCCEEDED` và `ACTION_REQUIRED`; gia hạn bị `EXTENSION_NOT_APPLICABLE` không được báo đã áp dụng dù invoice đang `PAID`.
- [ ] Trang chi tiết đơn hiển thị cọc/refund theo từng thiết bị; `REVIEW_REQUIRED` và refund `PENDING` không bị gọi là đã hoàn.
- [ ] Nếu tích hợp lịch sử `/rental-orders/{id}/payments`, xác nhận endpoint trên môi trường bàn giao; phân biệt payment attempt với refund và các kiểu tiền.
- [ ] Đọc lỗi từ `response.data.error`; xử lý 401, 409, 422, 503 và timeout.
- [ ] Kiểm thử thủ công MoMo/VNPay sandbox với webhook/IPN thật, return URL, reload và đối soát chậm. Chưa có xác nhận end-to-end trong workspace hiện tại.

## 9. Ghi chú chuyển nhóm Booking: khóa trip trong luồng đọc

Đây là việc của nhóm Booking; tài liệu này không yêu cầu FE hay Rental sửa mã Booking. Hiện `BookingsService.detail` gọi `expire(tripId)` khi đọc mỗi Booking thuộc user. `BookingsService.list` gọi `expire(tripId)` cho từng trip mà user có Booking `PENDING_PAYMENT`, kể cả hold chưa hết hạn. `expire` mở transaction và khóa dòng `trips` bằng `SELECT ... FOR UPDATE`. Rental checkout và payment consumer đã bỏ khóa trip ở các bước tương ứng, nên phần khóa phát sinh từ GET Booking vẫn cần nhóm Booking xem xét. Chưa có kiểm thử tải chứng minh connection pool đã cạn hoặc đã hết nguy cơ.

Đề nghị nhóm Booking lọc hold **đã quá `expiresAt`** trước khi gọi `expire`, và kiểm tra lại điều kiện hết hạn bên trong transaction sau khi lấy khóa để giữ đúng nghiệp vụ khi có request song song. Cần giữ hành vi hết hạn hold, tính chỗ và tính lặp an toàn; worker hết hạn vẫn xử lý các hold không được đọc. Kiểm tra tải với GET detail/list đồng thời checkout/payment Rental, theo dõi thời gian chờ khóa, transaction timeout và số connection đang dùng trước khi kết luận vấn đề đã giải quyết.

## 10. Mã nguồn để đối chiếu

- Checkout/extension: `api/src/modules/rental/payments/rental-payments.controller.ts`, `rental-extension-payments.controller.ts`, `rental-checkout.service.ts`, `api/src/modules/payments/payments.service.ts`.
- Trạng thái/order/return path: `api/src/modules/rental/ordering/presentation/controllers/rental-order.controller.ts`, `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-order.adapter.ts`, `api/src/modules/payments/payment-return-path.ts`.
- Cọc/refund/lịch sử: `api/src/modules/rental/returns/infrastructure/adapters/prisma-rental-return.adapter.ts`, `api/src/modules/rental/payments/rental-deposit.worker.ts`, `api/src/modules/payments/payment-history.service.ts`, `api/src/modules/payments/dtos/rental-order-payment-history.dto.ts`.
- Hủy tự động/hoàn kỹ thuật: `api/src/modules/rental/lifecycle/infrastructure/adapters/prisma-trip-lifecycle.adapter.ts`, `api/src/modules/rental/payments/rental-cancellation-refund.ts`, `api/src/modules/rental/payments/rental-payment.consumer.ts`, `api/src/modules/rental/ordering/extension/rental-extension.service.ts`, `api/src/modules/payments/payment-webhooks.service.ts`, `api/src/modules/payments/refunds.service.ts`.
- FE hiện có: `web/src/features/bookings/booking.api.ts`, `web/src/features/rentals/services/rental.api.ts`, `web/src/app/(private)/(user)/payment-return/page.tsx`, `web/next.config.ts`.
- Quyền Rental Public Trip và khóa Booking: `api/src/modules/rental/ordering/infrastructure/adapters/prisma-rental-context.adapter.ts`, `api/src/modules/rental/payments/rental-membership.guard.ts`, `api/src/modules/bookings/bookings.service.ts`.
