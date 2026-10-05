# TrekGo Shared Payment Schema and API Contract v0.1

Ngày đối chiếu: 04/10/2026. Trạng thái: bản thiết kế để review trước migration và code.

Tài liệu này chuyển yêu cầu Shared Payment MVP thành danh sách thay đổi schema, ràng buộc dữ liệu, transaction và API có thể giao cho các team triển khai. Hướng đề xuất là giữ các bảng tài chính hiện có, bổ sung khả năng chống xử lý trùng, đối soát và theo dõi domain áp dụng kết quả. Booking, Trail Access và Rental vẫn sở hữu nghiệp vụ của mình.

**Phạm vi lần này chỉ là tài liệu. Không thay đổi schema, migration, database hay mã ứng dụng.** Phần Rental/Trail Access mô tả giao diện phối hợp; không mặc nhiên cho phép sửa module của các team đó.

## 1. Nguồn đối chiếu và cách đọc

- Yêu cầu đầu vào: `TrekGo_Shared_Payment_MVP_Design_Requirement_v0.1.docx`, đặc biệt mục 4, 6–14, 18–21.
- Schema hiện tại: [`../prisma/schema.prisma`](../prisma/schema.prisma).
- SQL đã có trong repository: [`20260926103348_align_rental_flow`](../prisma/migrations/20260926103348_align_rental_flow/migration.sql) và [`20260927172057_init_trekgo`](../prisma/migrations/20260927172057_init_trekgo/migration.sql), cùng các migration CF01/CF03/CF04.
- Hợp đồng lỗi: [`../src/shared/errors/`](../src/shared/errors/), [`ZodValidationPipe`](../src/shared/pipes/zod-validation.pipe.ts), [`main.ts`](../src/main.ts).
- Wiring hiện tại: [`AppModule`](../src/app.module.ts), [`SharedModule`](../src/shared/shared.module.ts), controller/adapter của Trips.

Quy ước: **Hiện có** là bằng chứng trong repository; **Đề xuất v0.1** là thiết kế cần review; **Cần chốt** là quyết định còn mở. Những chỉ dẫn nằm trong DOCX được dùng làm nội dung yêu cầu, không được xem là lệnh tự chạy migration/code. Các tài liệu nguồn mà DOCX nhắc đến nhưng không được cung cấp chưa được xác minh độc lập. Chưa truy vấn database thực tế nên “có trong migration” không đồng nghĩa đã xác nhận constraint đang tồn tại trên database cấu hình.

Trong mã nguồn đã kiểm tra, `AppModule` chưa đăng ký `PaymentsModule`; các endpoint Payment dưới đây là hợp đồng đề xuất, không phải API đã hoạt động.

## 2. Quyết định kiến trúc đề xuất

| Nội dung | Hướng v0.1 |
| --- | --- |
| Kiến trúc | Một NestJS `PaymentsModule`, dùng chung Prisma và auth/role infrastructure; provider nằm sau port |
| Một Invoice | Một nghĩa vụ thanh toán với snapshot bất biến sau khi bắt đầu checkout; có nhiều Payment attempt |
| Thu tiền | MVP thanh toán toàn bộ Invoice, không hỗ trợ chia lần/partial capture |
| Kết quả | `Payment.SUCCEEDED` là sự thật thu tiền; domain acceptance được lưu riêng |
| Retry | Timeout giữ trạng thái chưa kết luận; query/reconcile trước khi tạo attempt thay thế |
| Refund | Domain duyệt quyền và số tiền; Payment kiểm tra exposure và thực hiện hoàn |
| Môi trường | Mock/sandbox trước; DB và credentials production tách riêng; vẫn lưu environment trên giao dịch |
| Sự kiện | Outbox trong DB và worker; không yêu cầu broker mới |
| Ngoài MVP | Wallet, commission, leader payout, kế toán doanh thu |

Luồng chính: domain tạo snapshot/Invoice → Shared Payment tạo attempt → provider xác nhận → lưu financial truth + outbox → domain kiểm tra và áp dụng → nếu không thể áp dụng thì technical reversal.

## 3. Đối chiếu các bảng trực tiếp liên quan

### 3.1 Invoice và InvoiceLine

**Invoice giữ:** `invoiceNo`, `userId`, `invoiceType`, ba FK `bookingId/rentalOrderId/trailAccessId`, các amount Decimal(12,2), `currency`, `status`, `expiresAt`, `paidAt`, `version`, timestamps và indexes hiện có.

**Invoice bổ sung đề xuất:**

| Field | Kiểu đích | Ý nghĩa |
| --- | --- | --- |
| `revisionNo` | Int, default 1 | Phiên bản nghĩa vụ của cùng business source; không sửa giá Invoice đã checkout |
| `supersedesInvoiceId` | UUID nullable, self FK Restrict | Truy vết Invoice cũ khi domain cho phép lập nghĩa vụ mới |

Thêm unique theo `(bookingId, revisionNo)`, `(rentalOrderId, revisionNo)`, `(trailAccessId, revisionNo)`. Thêm partial unique cho mỗi source ở trạng thái `DRAFT/PENDING_PAYMENT`, để chỉ có một Invoice đang mở. Một source có thể có lịch sử nhiều Invoice; việc tạo revision mới phải lock source và kiểm tra chính sách domain, không chỉ dựa vào index. Invoice cũ phải kết thúc trước khi mở revision mới.

Thêm CHECK đúng một FK khác null và khớp `invoiceType`; CHECK số tiền không âm, `discountAmount <= subtotalAmount`, `totalAmount = subtotalAmount - discountAmount`. Invoice cho Booking bao gồm insurance trong subtotal Invoice: `Invoice.subtotalAmount = Booking.subtotalAmount + Booking.insuranceAmount`; không cộng insurance lần nữa. Domain xác nhận cách tính này với CF02 trước triển khai.

FK nguồn tài chính nên ghi rõ `onDelete: Restrict`; SQL cũ dùng `SET NULL` cho các FK nguồn nullable, xung đột với yêu cầu giữ lịch sử và CHECK đúng một nguồn. Đây là thay đổi FK trong migration mới, cần kiểm tra đường xóa của team sở hữu.

**InvoiceLine giữ:** toàn bộ field hiện có. Quy ước `lineCode`: `BOOKING_FARE`, `BOOKING_INSURANCE`, `TRAIL_ACCESS`, `RENTAL_FEE`, `RENTAL_DEPOSIT`. Không mặc định unique `(invoiceId, lineCode)` vì Rental có nhiều dòng cùng loại. Kiểm tra `quantity > 0`, `unitAmount >= 0`, `lineAmount >= 0`, quy tắc nhân/làm tròn xác định; tổng lineAmount bằng subtotal Invoice do service kiểm tra trong transaction. `referenceType/referenceId` là tham chiếu mềm, không phải FK đảm bảo đúng domain.

Invoice giá trị 0 đi qua use case miễn phí của domain; không tạo `Payment.SUCCEEDED` giả. Chi tiết trạng thái Invoice miễn phí là quyết định riêng cần chốt.

### 3.2 Payment

**Giữ:** quan hệ Invoice, `amount/currency`, `transactionRef`, `paymentGateway`, enum hiện tại, `idempotencyKey @unique`, payload, `paidAt`, `version` và timestamps. Không thêm purpose trùng với `Invoice.invoiceType`.

| Field thêm | Kiểu đích | Quy tắc |
| --- | --- | --- |
| `providerEnvironment` | enum `MOCK/SANDBOX/PRODUCTION` | Lấy từ cấu hình server, không nhận từ FE |
| `merchantAccountKey` | VarChar(100) | Định danh cấu hình merchant không chứa secret |
| `merchantRequestRef` | VarChar(180) | Sinh trước khi gọi provider; dùng query khi mất response |
| `requestHash` | Char(64) | SHA-256 payload chuẩn hóa cùng version thuật toán |
| `requestHashVersion` | Int default 1 | Cho phép replay qua các phiên bản canonicalization |
| `paymentMethod` | VarChar(80) | Giá trị đã chuẩn hóa, ví dụ `QR` |
| `checkoutData` | Json nullable | URL/QR được allowlist, tối thiểu cần trả lại client |
| `expiresAt` | Timestamptz nullable | Checkout expiry, không thay Booking TTL |
| `reconcileStatus` | enum `IDLE/SCHEDULED/RUNNING/NEEDS_REVIEW/RESOLVED` | Trạng thái vận hành, tách PaymentStatus |
| `lastCheckedAt`, `nextRetryAt`, `leaseUntil` | Timestamptz nullable | Lịch đối soát và lease worker |
| `retryCount` | Int default 0 | Số lần đối soát |
| `lastErrorCode` | VarChar(100) nullable | Mã lỗi đã loại dữ liệu nhạy cảm |
| `leaseToken` | UUID nullable | Ngăn worker hết lease ghi đè kết quả worker mới |

Đặt unique có scope `(paymentGateway, providerEnvironment, merchantAccountKey, merchantRequestRef)` và partial unique cùng scope cho `transactionRef IS NOT NULL`. Không đặt unique `invoiceId WHERE status='SUCCEEDED'`: cần lưu được hai khoản thu thật khác nhau để xử lý thu trùng.

Đặt partial unique `invoiceId WHERE status IN ('PENDING','PROCESSING')` để một Invoice có tối đa một attempt chưa rõ kết quả. Key khác trong lúc còn attempt mở trả 409 `PAYMENT_ATTEMPT_IN_PROGRESS`; key cũ cùng nội dung trả attempt hiện có. Attempt quá hạn local nhưng chưa có kết luận provider vẫn cần reconcile, không được giải phóng guard bằng cách tự gán FAILED.

Thêm index `(reconcileStatus, nextRetryAt)`, `(status, createdAt)`; giữ `(invoiceId,status)`. Amount/currency bất biến sau khi tạo; MVP `amount > 0`, VND nguyên và bằng Invoice snapshot. `paidAt` là thời điểm provider xác nhận thu tiền, không phải thời điểm Booking xác nhận.

### 3.3 PaymentWebhookEvent

**Giữ:** bảng hiện có làm durable inbox cho callback, `payload`, `receivedAt`, `paymentId`, `processed/processedAt/errorMessage` để tương thích.

| Bổ sung | Kiểu đích và mục đích |
| --- | --- |
| `providerEnvironment`, `merchantAccountKey` | Cùng scope Payment |
| `eventKind` | enum `PAYMENT/REFUND` |
| `refundId` | UUID nullable, FK Refund Restrict |
| `payloadHash` | Char(64), hash raw bytes để phát hiện cùng event ID nhưng nội dung khác |
| `processingStatus` | enum `RECEIVED/PROCESSING/PROCESSED/RETRY/NEEDS_REVIEW` |
| `verifiedAt` | Timestamptz, thời điểm xác thực thành công |
| `attemptCount` | Int default 0 |
| `nextRetryAt`, `leaseUntil`, `leaseToken` | Timestamptz nullable, Timestamptz nullable, UUID nullable |

Thay unique cũ `(paymentGateway, providerEventId)` bằng `(paymentGateway, providerEnvironment, merchantAccountKey, providerEventId)` trong migration mới sau backfill. Không chỉ thêm unique mới rồi giữ unique cũ vì unique cũ vẫn chặn các scope khác nhau. Index queue `(processingStatus,nextRetryAt)`; thêm index `refundId`.

`processed=true` chỉ khi kết quả callback đã được xử lý tài chính hoặc được xác nhận là no-op hợp lệ, không có nghĩa domain đã áp dụng. Khi chưa tìm được Payment/Refund, giữ event để retry/review. Callback Refund có thể lưu cả paymentId và refundId; service phải kiểm tra refund thuộc payment đó. Payload giữ tối thiểu phục vụ audit, không lưu secret/PAN; raw body dùng ngay cho verify, không bắt buộc lưu toàn bộ lâu dài.

### 3.4 Refund

**Giữ:** `paymentId`, các amount/status/ref, `idempotencyKey`, các FK nguồn, `providerPayload`, `refundedAt`, `version`, timestamps. `Refund.amount` là số tiền yêu cầu; không được sửa sau khi gửi provider.

| Bổ sung | Kiểu đích và quy tắc |
| --- | --- |
| `RefundPurpose.TECHNICAL_REVERSAL` | Enum value mới; không tạo BookingCancellation giả |
| `reasonCode` | VarChar(80) nullable cho lịch sử; technical bắt buộc `LATE_PAYMENT/DUPLICATE_PAYMENT` |
| `businessActionId` | VarChar(200), định danh quyết định hoàn do domain/server sinh |
| `requestHash`, `requestHashVersion` | Char(64), Int default 1 |
| `providerEnvironment`, `merchantAccountKey`, `paymentGateway` | Scope snapshot từ Payment, không do caller chọn |
| `merchantRefundRef` | VarChar(180), sinh trước provider call |
| Các field đối soát như Payment | `reconcileStatus`, `lastCheckedAt`, `nextRetryAt`, `retryCount`, `lastErrorCode`, `leaseUntil`, `leaseToken` |

Unique `(paymentId,businessActionId)` chống tạo hai refund cho cùng quyết định bằng hai request key; businessActionId nên gồm component nếu chia hoàn thành nhiều khoản. Unique merchantRefundRef và refundTransactionRef theo scope provider như Payment; refundTransactionRef nullable dùng partial unique. Index queue `(reconcileStatus,nextRetryAt)`.

**Constraint đã có trong SQL:** `ck_refunds_amount_positive` và `ck_refunds_purpose_source`. CHECK nguồn cũ chỉ nhận bốn purpose, nên thêm enum một mình vẫn không insert được technical reversal. Migration mới phải thay CHECK nguồn bằng phiên bản giữ đủ bốn nhánh cũ và thêm nhánh technical: reasonCode hợp lệ, toàn bộ FK cancellation/deposit/rental/trail null; `paymentId` là nguồn tài chính. Với DEPOSIT, cho phép settlement và item cùng hiện diện như SQL cũ, nhưng service phải kiểm tra cùng settlement/order. Các FK nguồn nên Restrict để không mất audit.

`depositSettlementItemId @unique` hiện giới hạn một logical Refund cho mỗi item. Giữ giới hạn trong MVP: retry uncertain dùng chính Refund đó. Khi provider xác nhận FAILED và muốn tạo provider attempt mới mà vẫn giữ đầy đủ lịch sử, cần thiết kế `RefundAttempt` trước khi mở tính năng retry này. v0.1 không tự reset FAILED thành PROCESSING hoặc tạo Refund khác vượt unique. Đây là giới hạn rõ ràng của bản đầu, không che timeout thành thất bại cuối cùng.

### 3.5 Booking và các bảng liên quan

| Model | Giữ | Thay đổi hoặc quy tắc đề xuất |
| --- | --- | --- |
| `BookingPolicy` | TTL, versionNo, cancellationRules và snapshot model | Không hard-code TTL/% refund trong Payment; policy đã dùng phải bất biến |
| `Booking` | Giá, insurance, policySnapshot, expiresAt, version, confirmationIdempotencyKey | Không cần nhét gateway/refund status vào Booking; map Payment qua Invoice/application record; confirmation key do server sinh từ paymentId |
| `BookingParticipant` | Mọi field/check-in hiện tại | Không thêm payment từng người trong MVP; confirmation vẫn theo Booking |
| `BookingCancellation` | refundableAmount, policySnapshot, người hủy, timestamps | Thêm `source` enum `USER/ORGANIZER/ADMIN`, `tripCancellationRequestId UUID?` FK Restrict, `idempotencyKey VarChar(200) @unique`; index tripCancellationRequestId |
| `BookingOutboxEvent` | Bảng riêng domain, deduplicationKey unique | Giữ `BOOKING_CONFIRMED`; dùng cùng pattern worker, không chuyển thành payment outbox |
| `Trip` | maxPax, trạng thái, version | Không thêm balance/counter Payment; lock Trip khi thay đổi capacity/confirm/cancel |
| `TripCancellationRequest` | Quy trình yêu cầu/duyệt và previousTripStatus | Back relation tới BookingCancellation; orchestration từng booking, không một transaction gọi provider hàng loạt |

`uq_bookings_active_user_trip` đã có trong migration `20260926103348_align_rental_flow`: unique `(user_id,trip_id)` cho `PENDING_PAYMENT/CONFIRMED/PARTIAL_CHECKIN/CHECKED_IN`. **Giữ index này, không tạo trùng.** Hold hết TTL cần thực sự chuyển EXPIRED; chỉ bỏ nó khỏi phép đếm mà giữ status cũ sẽ vẫn bị unique chặn khi đặt lại.

Capacity v0.1 tính từ số participant của booking chiếm chỗ; không có `Trip.heldSeats` trong schema hiện tại. Booking domain phải dùng cùng quy tắc đếm và lock Trip cho mọi đường giữ/nhả/chuyển chỗ. Các trạng thái chiếm chỗ và khả năng checkout trong `CANCEL_PENDING` cần chốt; đề xuất chặn checkout/confirmation mới khi đang chờ hủy. `FULL` do chính hold hiện tại không phải lý do tự từ chối confirmation của hold đó.

### 3.6 Trail Access và Rental

| Model | Hiện có và hướng v0.1 |
| --- | --- |
| `SystemTrail` | Domain đọc trạng thái/giá; Payment không sửa hoặc tự grant |
| `TrailAccess` | Đã unique `(userId,systemTrailId)` trên mọi trạng thái; không thêm một record mới khi retry. Dùng cùng access + Invoice revision nếu domain cho phép mua lại; lịch sử tài chính giữ ở Invoice/Payment. Không overwrite snapshot của access ACTIVE. Có thể thêm `version Int default 1` khi team Trail triển khai optimistic concurrency |
| `RentalOrder` | Đã có rentalFee, totalDeposit, totalAmount, financialStatus, paymentExpiresAt, version; giữ, Rental tự chuyển state |
| `RentalOrderLine` | Đã có quantity, lineRentalFee, lineDeposit; nguồn chia allocation theo dòng |
| `RentalQuantityReservation` | Giữ; Rental chịu trách nhiệm confirm/release reservation |
| `RentalUnitAssignment` | Dùng map settlement item về order line; không yêu cầu có assignment ngay lúc checkout |
| `DepositSettlement` | Giữ tổng deposit/deduction/refund, status, idempotencyKey |
| `DepositSettlementItem` | Giữ decisionSnapshot/approvedAt/deductionAmount/refundAmount; Payment chỉ thực hiện khoản đã duyệt |
| `RentalOutboxEvent` | Giữ ownership Rental; consumer phản ánh RefundSucceeded về settlement |

Các CHECK deduction + refund <= deposit và điều kiện SETTLED đã được ghi trong migration Rental; phải tái dùng/kiểm tra tồn tại, không giả định là gap mới. Phần allocation mục 4.3 chỉ triển khai khi Rental tham gia milestone, phối hợp team Rental trước khi thay đổi.

## 4. Bảng mới đề xuất

### 4.1 PaymentApplication

Lưu quyết định áp dụng mỗi khoản thu vào nghĩa vụ, để phân biệt “đã thu tiền” với “đã xác nhận dịch vụ”. Domain consumer sở hữu việc ra quyết định; Shared Payment không tự xác nhận booking.

| Field | Kiểu và ràng buộc |
| --- | --- |
| `id` | UUID PK |
| `paymentId` | UUID unique FK Payment Restrict |
| `invoiceId` | UUID FK Invoice Restrict |
| `status` | enum `PENDING/APPLIED/REJECTED` |
| `reasonCode` | VarChar(80) nullable; `LATE_PAYMENT`, `DUPLICATE_PAYMENT`, `DOMAIN_NOT_ELIGIBLE` |
| `appliedAt`, `decidedAt` | Timestamptz nullable |
| `createdAt`, `updatedAt` | Timestamptz |

Map `payment_applications`. Partial unique `invoiceId WHERE status='APPLIED'`; index `(status,createdAt)`. Service kiểm tra application.invoiceId đúng với payment.invoiceId; có thể dùng composite FK `(paymentId,invoiceId)` tới Payment với unique tương ứng khi viết migration chi tiết. Domain còn phải guard ở source vì một source có nhiều Invoice revision. Record APPLIED là lịch sử, không xóa khi refund.

Trong transaction lưu PaymentSucceeded tạo application PENDING + outbox. Domain transaction chuyển APPLIED cùng business state và business outbox. Nếu REJECTED, ghi reason + sự kiện yêu cầu technical reversal trong cùng transaction. Worker bị lỗi tạm thời giữ PENDING và retry, không biến lỗi hạ tầng thành từ chối nghiệp vụ.

### 4.2 PaymentOutboxEvent và PaymentConsumerReceipt

`PaymentOutboxEvent` map `payment_outbox_events`: giữ cấu trúc cùng `BookingOutboxEvent` gồm UUID id, deduplicationKey unique VarChar(220), eventType VarChar(140), aggregateType VarChar(100), aggregateId UUID, payload Json, EventStatus, retryCount, lastError, createdAt/publishedAt/processedAt. Bổ sung `nextRetryAt Timestamptz?`, `leaseUntil Timestamptz?`, `leaseToken UUID?`; index `(status,nextRetryAt)`, `(aggregateType,aggregateId,createdAt)`.

`PaymentConsumerReceipt` map `payment_consumer_receipts`: `eventId UUID` FK outbox Restrict, `consumerName VarChar(100)`, `processedAt Timestamptz`; composite PK `(eventId,consumerName)`. Insert receipt trong cùng transaction với hiệu ứng consumer. Không đánh dấu processed trước khi effect commit. Với domain dùng outbox khác, receipt tương ứng thuộc domain đó hoặc tái dùng cơ chế inbox có sẵn; không giả định một receipt payment bao trùm mọi outbox của dự án.

Worker thực thi ít nhất một lần; không hứa “exactly once delivery”. Unique, state guards và transaction tạo một hiệu ứng nghiệp vụ. Lease hết hạn được claim lại; status `PUBLISHED` không đủ chứng minh mọi consumer đã xử lý.

### 4.3 PaymentAllocation và RefundAllocation cho Rental

| Bảng | Fields đề xuất |
| --- | --- |
| `PaymentAllocation` | UUID id PK; paymentId FK Restrict; rentalOrderLineId FK Restrict; component enum `RENTAL_FEE/RENTAL_DEPOSIT`; amount Decimal(12,2); createdAt; unique `(paymentId,rentalOrderLineId,component)` |
| `RefundAllocation` | UUID id PK; refundId FK Restrict; paymentAllocationId FK Restrict; amount Decimal(12,2); createdAt; unique `(refundId,paymentAllocationId)`; index paymentAllocationId |

Map `payment_allocations`, `refund_allocations`. Mỗi allocation amount > 0; dòng có amount 0 được bỏ qua. Currency kế thừa parent, không thêm currency độc lập dễ lệch. Tổng PaymentAllocation của một Rental Payment bằng payment.amount; tổng RefundAllocation bằng refund.amount. Kiểm tra hai parent cùng payment/order trong service transaction; CHECK một hàng không bảo vệ được tổng nhiều hàng.

Chọn granularity theo order line + component cho checkout, vì equipment assignment có thể chưa tồn tại. Với hoàn deposit từng item, truy `DepositSettlementItem.assignmentId → RentalUnitAssignment.orderLineId`, kiểm tra approved refundable amount của item, khóa payment + allocation và item. Unique depositSettlementItemId ngăn hoàn cùng item hai lần. Các quyết định giữ/deduct deposit khác trên cùng dòng cũng phải được xét; không suy ra toàn bộ allocation còn lại đều được phép hoàn.

Technical reversal của khoản thu thừa trả lại toàn bộ allocation của chính Payment thừa, không khấu trừ damage của khoản thu đã được domain chấp nhận. Domain cancellation và deposit return trên Payment đã áp dụng phải cùng dùng allocation guard. Không tự thêm ledger/wallet vào MVP.

## 5. Constraint và index cần đưa vào migration mới

SQL dưới đây là minh họa thiết kế dùng tên bảng/cột hiện tại, **không phải migration đã chạy**. Các cột mới phải được tạo/backfill trước khi dùng.

```sql
ALTER TABLE invoices ADD CONSTRAINT ck_invoices_source_type CHECK (
  (invoice_type = 'BOOKING' AND booking_id IS NOT NULL
    AND rental_order_id IS NULL AND trail_access_id IS NULL)
  OR (invoice_type = 'RENTAL' AND rental_order_id IS NOT NULL
    AND booking_id IS NULL AND trail_access_id IS NULL)
  OR (invoice_type = 'TRAIL_ACCESS' AND trail_access_id IS NOT NULL
    AND booking_id IS NULL AND rental_order_id IS NULL)
) NOT VALID;

CREATE UNIQUE INDEX uq_payments_provider_transaction
ON payments(payment_gateway, provider_environment, merchant_account_key, transaction_ref)
WHERE transaction_ref IS NOT NULL;

CREATE UNIQUE INDEX uq_payments_open_attempt
ON payments(invoice_id) WHERE status IN ('PENDING', 'PROCESSING');

CREATE UNIQUE INDEX uq_payment_application_applied
ON payment_applications(invoice_id) WHERE status = 'APPLIED';

CREATE UNIQUE INDEX uq_invoice_open_booking
ON invoices(booking_id)
WHERE booking_id IS NOT NULL AND status IN ('DRAFT', 'PENDING_PAYMENT');
```

Tạo index open Invoice tương tự cho rental_order_id và trail_access_id. Không dùng `now()` trong predicate index cho hold; TTL được xử lý bằng status transition. Không đặt CHECK có subquery SUM refund: tổng liên hàng cần serialization/transaction.

| Invariant | Cách bảo vệ |
| --- | --- |
| Nguồn Invoice hợp lệ | FK + CHECK đúng type/đúng một nguồn |
| Cùng provider transaction không ghi hai Payment | Scoped unique transactionRef |
| Hai khoản thu khác nhau vẫn được audit | Cho phép nhiều SUCCEEDED trên Invoice |
| Một lần áp dụng nghĩa vụ | PaymentApplication partial unique + lock Invoice + guard business source |
| Cùng request cùng kết quả | idempotencyKey unique + requestHash |
| Cùng quyết định hoàn không nhân đôi | unique `(paymentId,businessActionId)` và guard nguồn |
| Không hoàn vượt tiền | Lock Payment/allocation + SUM PENDING/PROCESSING/SUCCEEDED |
| Nguồn refund khớp purpose | Mở rộng CHECK cũ + validate quan hệ xuyên bảng |
| VND chính xác | Decimal, input/output chuỗi số nguyên, CHECK integer cho dòng VND |
| Lịch sử không mất khi xóa domain | FK Restrict + policy xóa phù hợp |

`Decimal(12,2)` giữ nguyên để tương thích; VND phải trong giới hạn lưu trữ và có phần thập phân bằng 0. API dùng chuỗi như `"1300000"`, không tính tiền bằng JavaScript Number. Money thành công từ provider mà sai amount/currency được giữ evidence và NEEDS_REVIEW, chưa phát PaymentSucceeded để áp dụng; không overwrite expected amount cho khớp callback.

## 6. Trạng thái và cách tính số tiền

Giữ PaymentStatus/RefundStatus/InvoiceStatus đang có. Payment PENDING/PROCESSING đi tới kết quả authoritative SUCCEEDED/FAILED/CANCELLED/EXPIRED. Refund PENDING/PROCESSING đi tới SUCCEEDED/FAILED/CANCELLED. Network timeout không phải một kết quả cuối cùng. `SUCCEEDED` không đổi về FAILED khi hoàn tiền.

Invoice chỉ PAID khi khoản thu được domain chấp nhận cho nghĩa vụ. Invoice EXPIRED/CANCELLED nhận late success vẫn giữ trạng thái đó; financial truth hiển thị qua Payment và technical Refund. Với Invoice có payment được áp dụng, tính trạng thái refund từ các refund của **payment đã APPLIED**, không tính refund khoản thu trùng. PAID → PARTIALLY_REFUNDED khi 0 < refundedApplied < appliedAmount; REFUNDED khi bằng appliedAmount. Rental hoàn toàn bộ tiền cọc nhưng vẫn giữ phí thuê là PARTIALLY_REFUNDED, không phải REFUNDED.

```text
reservedRefund = SUM(Refund.amount WHERE status IN [PENDING, PROCESSING])
succeededRefund = SUM(Refund.amount WHERE status = SUCCEEDED)
financialAvailable = Payment.amount - reservedRefund - succeededRefund
allowedRefund = min(financialAvailable, domainApprovedRemaining)
```

Rental còn kiểm tra từng allocation và approved deduction/held deposit; không trừ deduction hai lần nếu domainApprovedRemaining đã loại nó. Trạng thái refund FAILED authoritative mới được giải phóng reservation; kết quả chưa rõ giữ PROCESSING và reservation. Aggregate invoice/refund totals được recompute dưới lock Invoice khi ghi kết quả cuối, tránh hai partial refund đồng thời để lại trạng thái tổng sai.

Nếu provider gửi SUCCESS mâu thuẫn với terminal FAILED/CANCELLED/EXPIRED đã ghi: giữ event evidence, NEEDS_REVIEW và query provider. Không bỏ mất khoản thu thật hoặc tự sửa lịch sử theo callback cuối cùng. Nếu query xác nhận correction, cần quy trình điều chỉnh có audit và cùng một Payment identity; chốt mapping provider trước khi phát hành. Local hold expiry không được gán Payment.EXPIRED nên late success thông thường vẫn xử lý từ PENDING/PROCESSING.

## 7. Transaction và lock

### 7.1 Nguyên tắc chung

Không gọi network provider trong DB transaction. Mỗi operation có pha reserve/commit → gọi provider → persist result/commit. Mọi đường thay đổi cùng invariant phải theo cùng protocol lock; `version` đơn lẻ không bảo vệ tổng refund hay capacity.

Thứ tự lock chung khi cần nhiều loại: **Trip → business source (Booking/TrailAccess/RentalOrder) → cancellation/settlement item theo ID tăng dần → Invoice → Payment → PaymentAllocation theo ID tăng dần → Refund → application/receipt**. Operation chỉ cần tài chính có thể bắt đầu ở Invoice. Không lấy ngược từ Payment rồi quay lại Trip trong cùng transaction; tách financial truth và domain apply. Query xác định các ID trước, sau lock đọc lại và kiểm tra mapping/version. Deadlock/serialization failure retry hữu hạn toàn bộ transaction bằng cùng logical key, không gọi lại provider tùy tiện.

### 7.2 Ma trận transaction

| Transaction | Khóa/serialization | Ghi atomically |
| --- | --- | --- |
| T1 tạo Booking hold | Trip FOR UPDATE; xử lý hold cũ hết hạn của user; tính capacity và active booking | Booking + participants + Invoice/lines; thời gian dùng DB |
| T2 reserve checkout | Source rồi Invoice; kiểm tra quyền, TTL, payable và key | Payment PENDING + refs/hash + lịch recover; unique open attempt |
| T3 nhận webhook | Unique event identity; chưa cần khóa business | Verified event RECEIVED trước ACK |
| T4 áp dụng provider result | Invoice → Payment/Refund; event guard | Financial status, timestamps, webhook processed, application PENDING nếu payment success, PaymentOutboxEvent |
| T5 domain apply | Trip/source → Invoice → Payment → application | Booking CONFIRMED hoặc domain state, application APPLIED, confirmation key, domain outbox, receipt |
| T6 domain reject | Cùng guard T5 | application REJECTED + durable request technical reversal; không resurrect source |
| T7 expiry Booking | Trip → Booking → Invoice | Booking EXPIRED, Invoice EXPIRED nếu chưa được áp dụng; capacity được nhả qua trạng thái |
| T8 reserve Refund | Source/decision nếu cần → Invoice → Payment → allocation | Validate approval + exposure, Refund PENDING và RefundAllocation |
| T9 hoàn tiền thành công | Invoice → Payment → allocations → Refund | Refund SUCCEEDED + recompute Invoice + REFUND_SUCCEEDED outbox; Rental cập nhật settlement qua consumer riêng |
| T10 claim worker | Hàng công việc FOR UPDATE SKIP LOCKED, lease token | Đặt lease ngắn, commit rồi mới query provider; persist có kiểm tra token/version |
| T11 Trip cancellation | Trip/request trước, rồi từng Booking trong transaction riêng | Quyết định Trip + sự kiện; mỗi BookingCancellation và refund command idempotent, không transaction bao trọn tất cả provider calls |

T2 phải kiểm tra idempotency replay hợp lệ trước khi từ chối vì trạng thái đã thay đổi: key cũ vẫn trả resource cũ sau success/expiry, sau khi kiểm tra quyền. Key mới thì áp dụng toàn bộ payable checks. Nếu crash sau reserve trước provider call, worker query bằng merchantRequestRef; chỉ submit cùng ref/key khi adapter bảo đảm an toàn và kết quả query đủ chắc chắn. Provider không hỗ trợ tra cứu theo ref này hoặc create idempotent là gap cần giải quyết trước tích hợp.

### 7.3 Race expiry với payment success

Đề xuất dùng thời điểm domain apply và DB clock: `now < Booking.expiresAt` mới đủ điều kiện confirm, dù provider paidAt sớm hơn. T5 và T7 serialize qua cùng Trip/Booking lock. Nếu T7 thắng hoặc TTL đã qua khi T5 kiểm tra, giữ Booking EXPIRED và technical reversal. Nếu T5 hợp lệ thắng, T7 thấy CONFIRMED và no-op. Đây là lựa chọn bảo thủ cần team chốt, không tuyên bố DOCX đã chốt grace period.

### 7.4 Race refund

T8 lock Payment trước khi tính SUM. Hai request cùng tranh 1.000.000 còn lại, mỗi request 700.000: transaction thứ nhất reserve 700.000; transaction sau chỉ thấy còn 300.000 và trả 409. Không đợi đến RefundSucceeded mới trừ exposure. Mọi cập nhật làm tăng reservation lại phải chạy cùng validation; v0.1 không tự retry một FAILED refund bằng cách đổi status.

## 8. API và DTO đề xuất

### 8.1 Quy ước chung

- Prefix `/api/v1` khớp `main.ts`. UUID cho ID, UTC ISO-8601 cho thời gian, chuỗi số nguyên cho VND.
- Bearer auth và ownership do domain kiểm tra; dùng guard/decorator sẵn có. Không nhận userId, số tiền hoặc currency từ public checkout body.
- POST tạo checkout/purchase bắt buộc `Idempotency-Key` (1–200 ký tự, không chứa PII). Server namespace theo actor + operation, lưu hash namespace thành key <= 200 ký tự; raw key không dùng chung trực tiếp giữa mọi user.
- Request hash gồm actor, operation, business source, Invoice/revision/amount/currency snapshot, method đã chuẩn hóa. Replay so với snapshot gốc, không lấy giá mới để tính lại. Return URL lấy cấu hình allowlist server.
- DTO body dùng Zod strict + `ZodValidationPipe`, UUID params/header validation rõ ràng. Field lạ như amount bị từ chối thay vì lặng lẽ tin tưởng.
- Success DTO dưới đây trả object trực tiếp theo hợp đồng endpoint; error envelope duy nhất ở mục 10. Tên DTO là đề xuất, không phải file đang có.

### 8.2 Danh sách endpoint

| Method và route | Quyền | Request | Response |
| --- | --- | --- | --- |
| POST `/bookings/:id/payments` | Owner Booking | CreateCheckoutRequest + key | 201 attempt mới; 200 replay; 202 khi đang tạo/đối soát |
| GET `/bookings/:id` | Owner/role được phép của domain | Không body | 200 Booking detail + PaymentSummary/RefundSummary |
| POST `/trails/:trailId/purchase` | User hợp lệ | CreateCheckoutRequest + key | 201 purchase mới; 200 replay; 202 unresolved, gồm trailAccessId + CheckoutResponse |
| POST `/rental-orders/:id/payments` | Owner order | CreateCheckoutRequest + key | Cùng checkout DTO; route **cần team Rental chốt** |
| GET `/payments/:id` | Invoice owner/Admin | Không body | 200 PaymentDetail; không raw provider payload |
| GET `/refunds/:id` | Invoice owner/Admin | Không body | 200 RefundDetail |
| POST `/payments/webhooks/:provider` | Chữ ký provider | Raw provider body | ACK adapter sau durable intake |
| POST `/admin/payments/:id/reconcile` | ADMIN | `{ "reason": "..." }` | 202 `{paymentId,reconcileStatus:"SCHEDULED"}`; queue idempotent |
| POST `/admin/refunds/:id/reconcile` | ADMIN | `{ "reason": "..." }` | 202 `{refundId,reconcileStatus:"SCHEDULED"}` |

GET tài nguyên không thuộc quyền truy cập có thể trả 404 để tránh lộ tồn tại; thống nhất với convention domain. Admin reconcile chỉ query kết quả, không cho sửa amount/status/balance trực tiếp. Không có public endpoint `refund(amount)` hoặc endpoint FE tự confirm success. Booking cancellation vẫn là use case domain; service nội bộ nhận quyết định hoàn đã được duyệt.

### 8.3 Checkout request và response

```ts
type CreateCheckoutRequest = {
  paymentMethod: "QR" | "REDIRECT"; // phương thức khả dụng do cấu hình adapter giới hạn
};

type CheckoutResponse = {
  paymentId: string;
  invoiceId: string;
  invoiceType: "BOOKING" | "TRAIL_ACCESS" | "RENTAL";
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
  amount: string;
  currency: "VND";
  providerEnvironment: "MOCK" | "SANDBOX" | "PRODUCTION";
  checkout: null | { type: "REDIRECT" | "QR"; url: string | null; qrData: string | null };
  expiresAt: string | null;
  reconciliationRequired: boolean;
};
```

Response ví dụ khi provider create timeout và attempt đã được lưu (HTTP 202):

```json
{
  "paymentId": "6fcb8dfd-4d22-4b13-9dbc-824f78b0b437",
  "invoiceId": "09c75e94-96ee-49db-8b6a-9d0e0ad5f163",
  "invoiceType": "BOOKING",
  "status": "PROCESSING",
  "amount": "1200000",
  "currency": "VND",
  "providerEnvironment": "SANDBOX",
  "checkout": null,
  "expiresAt": "2026-10-04T03:15:00Z",
  "reconciliationRequired": true
}
```

CheckoutResponse không có boolean “bookingConfirmed”. Retry cùng key trả cùng paymentId và checkout identity, nhưng status có thể mới hơn. GET Booking detail trả ít nhất `id,status,expiresAt,confirmedAt,totalAmount,currency,paymentSummary,refunds`. `paymentSummary` gồm `paymentId,status,applicationStatus(PENDING/APPLIED/REJECTED|null),applicationReasonCode,reconciliationRequired`; `refunds` là danh sách RefundSummary. UI có thể hiển thị “Đã thu tiền, đang xác nhận booking” khi Payment SUCCEEDED nhưng application PENDING; chỉ nói “Đã hoàn tiền” khi Refund SUCCEEDED.

PaymentDetail mở rộng CheckoutResponse với `paidAt`, `applicationStatus`, `applicationReasonCode`, `refunds`; không trả merchant secret/payload nội bộ. RefundSummary/RefundDetail gồm `refundId,paymentId,purpose,reasonCode,amount,currency,status,refundedAt,reconciliationRequired`. Trail purchase replay sau khi access đã ACTIVE vẫn trả kết quả cũ cho cùng key; request mới không bán lại access ACTIVE. Để lookup replay trước khi có accessId, namespace key dựa actor + trailId + operation; unique TrailAccess và lock source ngăn duplicate purchase.

### 8.4 Service contract nội bộ

```ts
interface PaymentsPort {
  createCheckout(input: {
    invoiceId: string;
    actorUserId: string;       // context đã xác thực; service vẫn kiểm tra mapping
    idempotencyKey: string;
    paymentMethod: "QR" | "REDIRECT";
  }): Promise<CheckoutResponse>;

  requestRefund(input: {
    paymentId: string;
    businessActionId: string;
    purpose: "DEPOSIT" | "BOOKING_CANCELLATION" | "RENTAL_CANCELLATION"
      | "TRAIL_ACCESS" | "TECHNICAL_REVERSAL";
    reasonCode?: "LATE_PAYMENT" | "DUPLICATE_PAYMENT";
    amount: string;            // quyết định domain, không phải request FE
    idempotencyKey: string;
    source: {
      bookingCancellationId?: string;
      depositSettlementId?: string;
      depositSettlementItemId?: string;
      rentalOrderId?: string;
      trailAccessId?: string;
    };
    allocations?: Array<{ paymentAllocationId: string; amount: string }>;
  }): Promise<RefundDetail>;

  reconcilePayment(paymentId: string): Promise<void>;
  reconcileRefund(refundId: string): Promise<void>;
}
```

Đây là interface phác thảo; schema triển khai cần discriminated union theo purpose để bắt buộc nguồn đúng. Domain approval và source mapping được đọc lại trong T8, không xem object input là bằng chứng quyền. Technical reversal dùng businessActionId ổn định `technical-reversal:{paymentId}`; cùng khoản thu không tạo hai reversal vì reason thay đổi.

## 9. Webhook, provider port và outbox contract

### 9.1 Provider port

Port gồm `createPayment`, `queryPayment`, `refund`, `queryRefund`, `verifyWebhook`. Create luôn nhận merchantRequestRef/idempotency identity, amount/currency và callback/return URLs từ server. Query/refund phải mang đúng provider + merchant + environment. Adapter trả `CONFIRMED_RESULT` hoặc `UNKNOWN`, không chuyển timeout thành FAILED.

Normalized event nội bộ tối thiểu:

```ts
type VerifiedProviderEvent = {
  provider: string;
  environment: "MOCK" | "SANDBOX" | "PRODUCTION";
  merchantAccountKey: string;
  providerEventId: string;
  kind: "PAYMENT" | "REFUND";
  merchantRequestRef: string;
  transactionRef: string | null;
  merchantRefundRef?: string;
  refundTransactionRef?: string;
  status: "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
  amount: string;
  currency: string;
  occurredAt: string;
};
```

REFUND không nhận EXPIRED trong persistence hiện tại; adapter phải trả UNKNOWN/review hoặc mapping được duyệt. Các field provider không cung cấp, đặc biệt amount/currency, phải bổ sung qua authoritative query trước khi kết luận. Đây là normalized DTO sau verify, không yêu cầu provider bên ngoài gửi đúng JSON này.

### 9.2 Intake và ACK

1. Route chỉ chọn adapter trong allowlist. Xác định merchant/environment bằng server routing/config và credential đã xác thực, không tin trường environment trong body.
2. Giữ raw bytes trước JSON parse; `main.ts` hiện chưa bật rawBody, đây là thay đổi cần làm khi code. Tái dùng cơ chế auth public của dự án cho webhook, nhưng xác thực bằng provider signature thay cho Bearer.
3. Verify signature theo adapter, timestamp/replay policy có xét legitimate retries, và giới hạn body. Không giả định header HMAC cụ thể khi chưa chọn provider.
4. Persist event và unique scope. Duplicate đã hợp lệ: trả ACK thành công; event chưa xử lý vẫn giữ trong queue. Duplicate cùng event ID nhưng payloadHash khác: review/audit, không overwrite payload cũ; ACK theo contract adapter.
5. Commit intake rồi mới ACK. DB ghi thất bại: trả retryable failure theo protocol provider, không báo nhận thành công. Invalid signature: từ chối, không xử lý financial event.
6. Worker normalize/query, kiểm tra merchant/ref/amount/currency, áp dụng T4. Financial success + outbox cùng transaction; business apply là T5 riêng.

Mock contract đề xuất: valid durable intake/duplicate trả HTTP 200 `{ "received": true }`; invalid signature HTTP 401; malformed body HTTP 400; unavailable storage HTTP 503. Adapter PSP thật phải có phụ lục riêng về URL, headers, thuật toán ký, ACK body/status, event ID fallback, retry window và query SLA. Không dùng success/error envelope của API người dùng để thay thế một ACK đặc thù PSP. Đây là transport boundary của webhook, không phải controller filter riêng cho Booking.

Không có event ID: adapter tạo identity ổn định từ provider transaction/refund ref + loại sự kiện + trạng thái/version provider; không dùng receivedAt/random UUID. Không chỉ hash nguyên body nếu provider thay delivery timestamp mỗi lần retry. Event FAILED sau SUCCEEDED là no-op có audit; event pending sau success không kéo lùi trạng thái.

### 9.3 Integration event

```json
{
  "eventId": "9a87ed91-0812-4935-91ce-b13671c1817a",
  "eventType": "PAYMENT_SUCCEEDED",
  "schemaVersion": 1,
  "deduplicationKey": "payment:6fcb8dfd-4d22-4b13-9dbc-824f78b0b437:succeeded:v1",
  "occurredAt": "2026-10-04T03:05:00Z",
  "payload": {
    "paymentId": "6fcb8dfd-4d22-4b13-9dbc-824f78b0b437",
    "invoiceId": "09c75e94-96ee-49db-8b6a-9d0e0ad5f163",
    "invoiceType": "BOOKING",
    "amount": "1200000",
    "currency": "VND",
    "providerRef": "sandbox-transaction-001"
  }
}
```

Events P0: `PAYMENT_SUCCEEDED`, `PAYMENT_FAILED`, `REFUND_SUCCEEDED`, `REFUND_FAILED`, `TECHNICAL_REVERSAL_REQUESTED`. Refund events thêm `refundId,paymentId,businessActionId,purpose,source,amount,currency,providerRef`. Technical reversal event thêm `paymentId,invoiceId,reasonCode`; consumer validate lại, không tin amount tự do trong payload. Domain emit `BOOKING_CONFIRMED` từ BookingOutboxEvent như hiện có.

Consumer dùng eventId + consumerName, business guard và source lock; không dùng providerEventId làm confirmation key vì reconciliation không nhất thiết có event ID của webhook. Dùng stable paymentId/refundId để dedup kết quả query và callback. Dashboard cảnh báo application PENDING lâu, outbox retry lâu, NEEDS_REVIEW và technical refund chưa xong.

## 10. Error contract tương thích dự án

Dùng shared `AppError`, đăng ký code trong `ERROR_DEFINITIONS`, export qua shared barrel và để `GlobalErrorFilter` format. Error version hiện tại là **`0.2.0-final-flow`**, khác version 0.1 của tài liệu này; không tự đổi version lỗi toàn dự án.

```json
{
  "error": {
    "code": "BOOKING_HOLD_EXPIRED",
    "message": "Booking hold has expired",
    "details": { "bookingId": "b6fa7cac-567c-4695-b978-bbf7d18a91b1" },
    "retryable": false
  },
  "meta": {
    "requestId": "request-001",
    "serverTime": "2026-10-04T03:16:00Z",
    "contractVersion": "0.2.0-final-flow"
  }
}
```

`details` có thể vắng khi không được cung cấp theo filter hiện tại. FE đọc `response.data.error`. Các code mới dưới đây **chưa tồn tại** trừ common error; khi code phải có status/default message/retryable tương ứng.

| Code | HTTP | Default message đề xuất | Retryable |
| --- | --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Validation failed, giữ common mapping | false |
| `UNAUTHENTICATED` / `FORBIDDEN` | 401 / 403 | Giữ common mapping | false |
| `PAYMENT_NOT_FOUND` | 404 | Payment resource not found | false |
| `PAYMENT_INVALID_STATE` | 409 | Invoice is not payable | false |
| `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD` | 409 | Idempotency key was used for a different request | false |
| `PAYMENT_ATTEMPT_IN_PROGRESS` | 409 | A payment attempt is still unresolved | false |
| `BOOKING_HOLD_EXPIRED` | 410 | Booking hold has expired | false |
| `PAYMENT_AMOUNT_MISMATCH` | 422 | Provider amount or currency does not match | false |
| `REFUND_AMOUNT_EXCEEDED` | 409 | Refund exceeds the approved remaining amount | false |
| `REFUND_SOURCE_INVALID` | 422 | Refund source does not match payment | false |
| `PAYMENT_PROVIDER_UNAVAILABLE` | 503 | Payment provider is temporarily unavailable | true |

`retryable=true` nghĩa là retry an toàn theo cùng logical key, không phải tạo giao dịch mới. Nếu attempt đã durable và provider timeout, ưu tiên HTTP 202 + resource thay vì một 503 mơ hồ. Mã Payment dùng file codes riêng trong shared/errors; mã Booking thêm vào booking.error-codes.ts. Không tái dùng `INVALID_STATE_TRANSITION` cho Payment với default message hiện tại nói về OPEN trip.

CF01 hiện dùng `TripErrorFilter` cũ. Tài liệu này không triển khai refactor; nếu đợt code sau thay error handling CF01 thì migrate filter và client cùng lúc, có HTTP test đi qua GlobalErrorFilter. Không tạo response envelope riêng cho Booking/Payment business APIs.

## 11. Kế hoạch migration và triển khai

1. **Chốt quyết định mục 13.** P0 schema phụ thuộc provider scope, Invoice revision, late-success policy và giới hạn refund retry; Rental allocation có gate riêng.
2. **Preflight read-only trên DB đích khi triển khai:** migration history/drift, CHECK/index thực tế, Invoice sai source/type, duplicate provider refs, nhiều open attempts/Invoices, orphan FK và refund vượt thu. Lịch sử không rõ merchant/environment/hash đưa vào danh sách cần đối soát, không gán giả là sandbox hay tự xóa duplicate.
3. **Expand bằng migration mới:** thêm enum/field nullable và bảng mới; thêm relation inverse trong Prisma. Enum value và SQL sử dụng value mới có thể tách migration để kiểm soát rollout. Giữ các field tương thích của webhook.
4. **Backfill có kiểm chứng:** revision theo source, provider scope từ cấu hình/lịch sử; requestHash chỉ dựng nếu có đủ snapshot. Legacy row thiếu bằng chứng không được replay như request mới; đánh dấu/manual review, giữ lịch sử.
5. **Harden:** validate CHECK sau sửa dữ liệu được review; tạo unique sau audit duplicates. Thay CHECK refund cũ bằng bản mở rộng trong một thay đổi transactional có kiểm soát; thay unique webhook scope và FK delete policy. Không rewrite applied migrations. Dùng index concurrent chỉ khi đã có kế hoạch runner hỗ trợ, không nhét tùy tiện vào transaction migration.
6. **Code shared core + mock:** ports, persistence, queue lease, idempotency, webhook, reconciliation và outbox. Bật các constraint tương ứng trước mở writer mới; chuyển NOT NULL sau backfill đầy đủ.
7. **Booking integration:** hold → checkout → apply → expiry → technical reversal; CF01 cancellation orchestration theo từng booking, phần refund % vẫn policy-driven.
8. **Trail và Rental theo ownership:** Trail grant idempotent; Rental allocation/settlement chỉ bật sau review với team sở hữu.
9. **Rollout sandbox:** feature flag, quan sát queue/reconcile/refund; production là milestone riêng. Rollback ứng dụng ưu tiên tắt tạo attempt mới nhưng giữ webhook/worker xử lý giao dịch đang bay; không drop financial history để rollback.

Không reset DB. Các sửa dữ liệu lịch sử, thay FK hoặc constraint chặn luồng xóa phải được đánh giá tác động trước khi áp dụng. Bản v0.1 này không chứa migration thực thi hoặc chứng nhận data đã sạch.

## 12. Kiểm thử cần có khi triển khai

| Nhóm | Ca kiểm thử chính và kỳ vọng |
| --- | --- |
| Luồng chính | Booking hold hợp lệ → thu tiền → application APPLIED → confirm/outbox đúng một lần |
| Idempotency | Response bị mất, retry cùng key; đổi method/source cùng key phải conflict; hai key song song chỉ một open attempt |
| Webhook | Signature sai không có effect; duplicate x3; event ID cùng payload khác; event tới trước provider response; DB lỗi thì không ACK success |
| Reconcile | Không webhook, create timeout, crash sau reserve, lease hết hạn; không tạo thêm charge/refund khi chưa rõ |
| Expiry race | Confirmation và TTL worker đồng thời; expiry thắng không resurrect, money success vẫn được ghi và reversal |
| Thu trùng | Hai transactionRef khác nhau cùng SUCCEEDED, một application và một technical reversal |
| Refund | PENDING/PROCESSING giữ exposure; hai refund vượt tổng bị chặn; refund timeout không tạo mới; nguồn hoàn sai bị từ chối |
| Invoice totals | Refund partial/full đồng thời đúng tổng; refund payment thu trùng không làm Invoice đã trả hợp lệ thành REFUNDED |
| Domain | Trail callback retry grant một lần; Rental giữ khoản dispute/deduction, hoàn đúng item; Trip cancelled không có nghĩa mọi refund xong |
| DB | CHECK source/type, unique scope, existing active-booking unique; FK không mất source financial |
| HTTP | Auth/ownership, Zod strict, registered AppError và GlobalErrorFilter; error envelope/contractVersion đúng |
| Migration | Data legacy, null scope, duplicate refs/open attempts, constraint cũ refund; không làm mất lịch sử |

Ưu tiên integration test với PostgreSQL thật cho concurrency/constraint; unit mock không chứng minh row lock. Không cần nhiều harness/file trùng nhau. Provider sandbox contract test phải bổ sung sau khi chọn PSP.

## 13. Quyết định cần chốt trước khi viết migration

| ID | Quyết định | Đề xuất trong tài liệu | Gate |
| --- | --- | --- | --- |
| D01 | Provider/merchant và khả năng query/idempotency | Mock trước, một PSP sandbox; scope gateway + environment + merchant | Trước adapter và unique provider ref cuối |
| D02 | TTL và cutoff confirm | BookingPolicy; DB clock tại domain apply, không grace period mặc định | Trước test end-to-end |
| D03 | Refund khi organizer hủy và user hủy | Policy riêng; chưa khẳng định organizer luôn hoàn 100% | Trước phát hành cancellation refund |
| D04 | Invoice retry/reprice | Cùng Invoice cho retry; revision mới chỉ khi domain cho phép | Trước schema final |
| D05 | Refund retry sau authoritative FAILED | Không tự retry mới trong v0.1; cần RefundAttempt nếu mở tính năng | Trước release refund operations |
| D06 | Rental allocation | Order line + component, map item qua assignment | Trước Rental migration |
| D07 | Reconcile storage | Fields + lease trên Payment/Refund, không bảng job riêng | Trước code worker |
| D08 | Application/outbox | PaymentApplication + PaymentOutboxEvent + receipts | Trước migration core |
| D09 | Booking khi Trip CANCEL_PENDING | Chặn checkout/confirm mới; thu đến thì review/reversal theo quyết định domain | Trước CF01 integration |
| D10 | Terminal provider correction | Query + audit; mapping theo PSP, không bỏ thu thật | Trước adapter release |
| D11 | SLA, retention, operational review | Config theo provider; môi trường tách riêng | Trước production |
| D12 | Giá trị 0 và mua lại TrailAccess | Use case domain riêng; không tạo successful payment giả | Trước mở các flow đó |

Sau khi chốt các gate, tài liệu này là đầu vào để viết additive migration và API implementation. Những nội dung mới vẫn là đề xuất v0.1 cho tới khi team review.

## Phụ lục A. Phạm vi các model còn lại trong schema

Các model liệt kê dưới đây đã được kiểm kê tên trong schema. Chúng không cần thay đổi scalar/constraint cho Shared Payment MVP theo phạm vi hiện tại; quan hệ ngược Prisma chỉ thêm nếu một FK mới thực sự trỏ tới chúng. Đây không phải review sâu nghiệp vụ của các team khác.

| Nhóm | Model giữ nguyên |
| --- | --- |
| Identity và leader | User, LeaderProfile, LeaderApplication, LeaderTest, LeaderTestAttempt, LeaderCertificate |
| Media | MediaAsset |
| Trail và điểm đón | Destination, PickupPoint, PersonalTrail, TrailSubmission, Checkpoint, TrailCheckpoint, PersonalCheckpoint, TrailRecording, TrailRecordingPoint |
| Trip navigation và membership | TripTrailPlan, TripActiveTrailPlan, TripTrailSwitch, TripCheckpoint, TripCheckpointProgress, TransportProvider, TripTransport, PrivateTripInvite, TripMember |
| Rental catalog và quote | InventoryLocation, RentalCategory, RentalProduct, DamageAssessmentRule, EquipmentUnit, RentalPolicy, RentalProductPriceHistory, RentalQuote, RentalQuoteLine |
| Rental vận hành | Package, PackageItem, InventoryTask, DeliveryTask, RentalPickupCode, RentalHandover, ConditionSnapshot, ReturnInspection, ReturnInspectionFinding, RentalExceptionCase, RentalAssessmentReview, MaintenanceRecord, CustodyEvent |
| GPS và thời tiết | GpsPolicy, GpsSession, GpsLocation, RouteDeviationEvent, CheckpointEvent, TripActualRoute, WeatherSnapshot, GpsOutboxEvent |
| Gamification và review | Rank, UserRank, PointTransaction, Badge, UserBadge, TripReview, LeaderReview, RentalReview |
| Hạ tầng dùng chung | SystemConfig, Notification, AuditLog |

Tái dùng SystemConfig cho cấu hình kỹ thuật phù hợp, không đặt secret provider hoặc Booking refund policy vào đó tùy tiện. Notification nhận sự kiện đã dedup; AuditLog ghi admin reconcile và quyết định điều chỉnh, không thay cho financial history.
