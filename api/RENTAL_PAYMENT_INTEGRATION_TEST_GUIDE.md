# Hướng dẫn tích hợp và kiểm thử thanh toán rental, khấu trừ và hoàn cọc

Ngày rà soát: 16/10/2026. Đối chiếu controller, DTO, adapter, worker và Prisma trong workspace hiện tại. Đây là hướng dẫn theo code, không phải xác nhận đã kiểm thử toàn bộ trên Render. Các điểm chưa nối hoàn chỉnh được ghi ở mục 8; không coi mọi nhánh dưới đây là đã chạy end-to-end.

## 1. Kết luận và phạm vi payment

| Nghiệp vụ | Hiện trạng trong code |
|---|---|
| Thu tiền thuê + cọc ban đầu | Có; một payment cho tổng tiền, phân bổ riêng RENTAL_FEE và RENTAL_DEPOSIT theo dòng hàng |
| Thu phí gia hạn | Có invoice/payment riêng nếu phí > 0; không thu lại cọc |
| Thanh toán thành công | Shared Payment ghi nhận kết quả; rental consumer áp dụng vào đơn và reservation |
| Hủy trước bàn giao | Có preview và yêu cầu hoàn tiền; mức hoàn phí thuê phụ thuộc hạn hủy miễn phí, cọc được hoàn |
| No-show | Có nhánh hoàn theo lỗi và hạn hủy; cần test qua nghiệp vụ delivery |
| Thanh toán muộn/trùng/không thể áp dụng | Có nhánh technical reversal trong shared payment; không ép đơn thành PAID |
| Khấu trừ theo từng thiết bị | Có kiểm tra FINAL, damage rules, snapshot và quyết định admin |
| Hoàn một phần cọc sau quyết toán | Có luồng theo từng settlement item qua Shared Payment, cần đáp ứng điều kiện duyệt/khiếu nại |
| Hoàn 100% cọc khi mọi món FINAL PASS | Có xác định đủ điều kiện nhưng **chưa thấy phần tạo hoàn gộp được nối vào runtime**; xem mục 8 |
| Gom nhiều món vào một lần hoàn | Có hàm lập nhóm và bảng phân bổ, chưa thấy nơi gọi để tạo refund trong `api/src` |

MoMo/VNPAY dùng adapter sandbox của Shared Payment. Frontend không gọi API refund của nhà cung cấp trực tiếp, không tự tính số tiền rồi gửi để backend tin theo. Hoàn tiền bám gateway, merchant và payment gốc; không đổi cổng khi hoàn.

## 2. Tiền thuê và tiền cọc được tính thế nào?

Với mỗi dòng sản phẩm:

```text
chargedDays = max(1, ceil((rentalEndAt - rentalStartAt) / 24 giờ))   [CEIL_24H]
lineRentalFee = dailyPriceSnapshot × quantity × chargedDays
lineDeposit = depositPerUnitSnapshot × quantity

rentalFee = tổng lineRentalFee
totalDeposit = tổng lineDeposit
totalAmount = rentalFee + totalDeposit
```

Giá/cọc được chốt tại dòng đơn. Không dùng giá catalog hiện tại để tính lại đơn cũ. Bộ kiểm tra payment đối chiếu tổng đơn, tổng dòng và phân bổ; tiền gửi cổng là VND nguyên.

Một dòng có quantity=2 sẽ có cọc cho 2 thiết bị thực tế sau khi được gán. `payment_allocations` phân bổ tiền theo **dòng hàng**; `deposit_settlement_items` theo **assignment/unit**. Không nhầm `productId`, `orderLineId`, `unitId`, `assignmentId` và `settlementItemId`.

## 3. Tiêu chí hoàn 100%, một phần hoặc giữ toàn bộ cọc

### 3.1. Món bình thường

- Delivery chỉ quét và quan sát sơ bộ, không quyết định hoàn cọc.
- Kho phải nhận custody thực tế, có PRELIMINARY inspection và baseline `PRE_HANDOVER`.
- Mọi món nhận về đều cần FINAL của `STAFF_INVENTORY`; không chỉ món yêu cầu deep inspection.
- `PASS` không được đi cùng `condition=DAMAGED` hoặc damage rules.
- Deep inspection hoặc có vấn đề ở bước sơ bộ yêu cầu evidence phù hợp; evidence phải được xác minh.
- FINAL bình thường, không phát sinh khấu trừ: đủ điều kiện hoàn toàn bộ cọc của món, nhưng code hiện giữ `REVIEW_REQUIRED` với reason `FINAL_PASS_AWAIT_GROUPED_REFUND`. Chưa có bằng chứng đã gửi lệnh hoàn ở bước này.
- Vệ sinh/đánh dấu thiết bị AVAILABLE là luồng vật lý riêng, không chứng minh hoàn tiền thành công.

### 3.2. Món hư hỏng hoặc thiếu phụ kiện

Nhân viên kho gửi `damage[].ruleId` và số lượng. Rule phải đúng product, active và còn hiệu lực tại thời điểm kiểm tra FINAL. Số tiền không tự suy ra từ chữ GOOD/FAIR/DAMAGED, ảnh hoặc danh sách accessories.

| deductionType | Cách tính cho một finding |
|---|---|
| FIXED | deductionValue × quantity |
| PERCENT_DEPOSIT | cọc của thiết bị × deductionValue / 100 × quantity |
| PERCENT_REPLACEMENT_VALUE | replacementValueSnapshot của dòng × deductionValue / 100 × quantity |

```text
proposedDeduction_i = tổng assessedAmount của các finding trên thiết bị i
cappedDeduction_i = min(proposedDeduction_i, depositAmount_i)
excessDamageAmount_i = max(proposedDeduction_i - depositAmount_i, 0)

Admin APPROVE_DEDUCTION: approvedDeduction_i = cappedDeduction_i
Admin REJECT_DEDUCTION: approvedDeduction_i = 0
refundAmount_i = depositAmount_i - approvedDeduction_i

Tổng tiền giữ lại = tổng approvedDeduction_i
Tổng cọc dự kiến hoàn = tổng refundAmount_i
```

Admin hiện duyệt toàn bộ mức capped hoặc bác bỏ, API resolve không có trường cho nhập một mức duyệt tùy ý. Dù rule có `requiresApproval=false`, code FINAL vẫn mở case khi có khấu trừ/vấn đề; không coi cờ này là tự động trừ tiền.

Thiệt hại vượt cọc được lưu thành `excessDamageAmount` và case riêng; **không tự lấy cọc món khác bù vào**, không thấy payment thu thêm phần vượt trong nhánh này. Cộng tổng sau khi cap từng món, không cap trên tổng cọc cả đơn.

Thiếu phụ kiện chỉ được tính tiền khi gắn rule phù hợp. `accessories` ở DTO FINAL hiện không được chuyển vào use case; không dùng nó như bảng tính khấu trừ.

### 3.3. Mất đồ

Admin dùng `CONFIRM_LOST` sau thời hạn `lostConfirmationMinutes`/dueAt. Code tạo hoặc cập nhật FINAL `LOST_CONFIRMED`, giữ toàn bộ cọc món đó. Khi tiền hoàn bằng 0 thì không gọi cổng để refund 0 đồng. Thiết bị đã được kho nhận vật lý không được gửi `condition=LOST` trong FINAL.

### 3.4. Ví dụ ba thiết bị

| Thiết bị | Cọc | Khấu trừ đề xuất | Duyệt giữ lại | Dự kiến hoàn |
|---|---:|---:|---:|---:|
| Lều A, bình thường | 300.000 | 0 | 0 | 300.000 |
| Balo B, rule FIXED 50.000 | 200.000 | 50.000 | 50.000 | 150.000 |
| Đèn C, thiệt hại 150.000 | 100.000 | 150.000 | 100.000 | 0 |
| **Tổng** | **600.000** | **200.000** | **150.000** | **450.000** |

50.000 vượt cọc của đèn cần xử lý riêng. Nếu phí thuê là 180.000 thì thu ban đầu 780.000; hoàn 450.000 từ cọc, không hoàn phí thuê đã sử dụng. Ví dụ là kỳ vọng tài chính; nhánh hoàn tự động của món A hiện bị thiếu kết nối như mục 8.

Ngay cả hoàn đủ **100% cọc 600.000**, invoice thu 780.000 vẫn `PARTIALLY_REFUNDED`, vì 180.000 tiền thuê được giữ lại. `deposit_settlements.outcome=FULL_REFUND` nói về cọc, không phải toàn bộ invoice.

## 4. Chuẩn bị tích hợp và test Swagger

- Mọi URL bên dưới có tiền tố `/api/v1`. Dùng Swagger và database cùng môi trường deploy.
- Bật `PAYMENT_EVENTS_WORKER_ENABLED=true`, `PAYMENT_RECOVERY_WORKER_ENABLED=true`.
- Cấu hình merchant sandbox, IPN đúng môi trường. VNPAY adapter hiện cần `VNPAY_SANDBOX_API_IP` cho query/refund. Giữ merchant gốc của payment cho tới khi hoàn xong.
- Chuẩn bị token USER chủ đơn, STAFF_DELIVERY, STAFF_INVENTORY, ADMIN; đổi Authorize theo từng bước. Role ở controller và quyền tài nguyên đều phải thỏa.
- Chuẩn bị trip/membership hợp lệ, product/stock, lịch bàn giao/trả, rental policy và damage rules. Không dùng UUID mẫu nếu chúng không có trong database.
- Mỗi hành động mới dùng idempotency-key riêng; retry cùng hành động dùng lại đúng key và body. Return endpoints yêu cầu key 8–200 ký tự; payment 1–200 ký tự ASCII không khoảng trắng.
- Lấy `expectedVersion` mới nhất của đúng đối tượng, không cố định số 1 trong mọi request. `returnId` là delivery task RETURN, không phải orderId.
- Evidence là ID media hợp lệ, đúng quyền/phạm vi và sẵn sàng; không phải URL ảnh tùy ý.

### A. Thu tiền thuê + cọc

1. `GET /trips/{tripId}/rental-eligibility` kiểm tra quyền thuê.
2. `POST /rentals/quote`: dùng schema Swagger để chọn product, số lượng và lịch thuê/trả. Kiểm tra rentalFee/totalDeposit/totalAmount trả về.
3. `POST /rental-orders`, header key mới:

```json
{"quoteId":"<quote UUID còn hạn của user>"}
```

4. `POST /rental-orders/{orderId}/payments`, header key mới:

```json
{"paymentMethod":"REDIRECT","gateway":"vnpay"}
```

Có thể thay `momo` cho lượt test khác. Không gửi amount/deposit/clientIp trong body; backend lấy tiền từ đơn, lấy IP từ request. Đọc `checkout.url` (không phải checkoutUrl). HTTP 202 chưa có checkout không phải thanh toán thành công.

5. Mở checkout và trả tiền trên sandbox. Poll `GET /rental-orders/{orderId}` và `GET /rental-orders/{orderId}/payment`.
6. Kết quả: payment SUCCEEDED, application APPLIED, invoice PAID; rental order PAID/financialStatus PAID; reservation HELD chuyển CONFIRMED. Redirect thành công nhưng database chưa đạt các điều kiện này thì chưa hoàn tất áp dụng nghiệp vụ.

### B. Gia hạn có phí

1. `POST /rental-orders/{orderId}/extension-quotes` với `requestedReturnAt`, `returnOptionId` hợp lệ.
2. `POST /rental-orders/{orderId}/extensions` với `extensionQuoteId`, `expectedVersion`, `acceptedTermsVersion` lấy từ dữ liệu hiện hành; key mới.
3. Nếu phí > 0: `POST /rental-extensions/{extensionId}/payments`, body paymentMethod/gateway như trên.
4. Nếu phí = 0: không gọi cổng; kiểm tra gia hạn đã áp dụng. Nếu có phí, chỉ coi gia hạn xong sau kết quả payment và application.
5. Kiểm tra invoice và allocation mới chỉ là phí gia hạn. Tiền hoàn cọc phải lấy từ payment ban đầu có RENTAL_DEPOSIT, không lấy từ payment gia hạn.

### C. Trả đồ và xác định số tiền hoàn

Trước chuỗi này phải hoàn thành preparation, gán unit, ghi baseline và bàn giao cho khách qua luồng rental/delivery. Không sửa trạng thái database để bỏ qua custody.

| Bước | API | Actor / mục đích |
|---|---|---|
| 1 | POST /rental-orders/{id}/return-scan | Delivery; quét assetCodes, operationId, expectedVersion |
| 2 | POST /rental-orders/{id}/return-observations | Delivery; quan sát từng unit, evidence; không quyết định khấu trừ |
| 3 | POST /delivery/tasks/{returnId}/return-to-inventory-location | Delivery; tạo/chuyển custody về kho |
| 4 | POST /staff/returns/{returnId}/receive | Kho; pendingTransferId, inventoryLocationId, scannedUnitIds, expectedVersion |
| 5 | POST /staff/returns/{returnId}/final-inspection | Kho; FINAL cho mọi món đã nhận |
| 6 | GET /staff/rental-exceptions và GET /staff/rental-exceptions/{id} | Xác định case và version nếu có vấn đề |
| 7 | POST /admin/rental-exceptions/{id}/resolve | Admin duyệt/bác khấu trừ hoặc xác nhận mất |
| 8 | POST /rental-orders/{id}/deposit-settlement | Admin; assessmentId + approvalRef, sau khi đáp ứng điều kiện |
| 9 | GET /rental-orders/{id}/deposit | User chủ đơn/người nhận được cho phép; xem từng món, tổng và refundRef |
| 10 | GET /refunds/{refundId} | Chủ hóa đơn hoặc admin; xác minh kết quả tài chính |

Ví dụ FINAL bình thường:

```json
{
  "items": [{"unitId":"<unit UUID>","outcome":"PASS","condition":"GOOD","damage":[],"evidenceIds":[]}],
  "expectedVersion": 5
}
```

`evidenceIds=[]` chỉ phù hợp khi không thuộc trường hợp bắt buộc evidence. Thay version bằng version thực tế. Kỳ vọng hiện tại: ghi FINAL, eligible item, REVIEW_REQUIRED chờ nhóm; không kỳ vọng có refund ngay.

Ví dụ FINAL có rule khấu trừ:

```json
{
  "items": [{
    "unitId":"<unit UUID>","outcome":"ISSUE","condition":"DAMAGED",
    "damage":[{"ruleId":"<active rule UUID đúng product>","quantity":1,"evidenceIds":["<media UUID>"]}],
    "evidenceIds":["<media UUID>"],"notes":"Ghi nhận hư hỏng so với baseline"
  }],
  "expectedVersion": 5
}
```

Lấy inspectionId/exceptionCaseId từ response. Admin resolve:

```json
{"decision":"APPROVE_DEDUCTION","reason":"Xác minh bằng chứng hư hỏng","assessmentVersion":1,"expectedVersion":1}
```

Hoặc `REJECT_DEDUCTION` nếu bác khấu trừ. Lấy `approvalRef` response, gọi deposit-settlement:

```json
{"assessmentId":"<FINAL inspection UUID>","approvalRef":"<approvalRef từ resolve>"}
```

Với mức khấu trừ > 0, code yêu cầu bằng chứng đã truy cập được (`evidenceAccessibleAt`), hết `userAssessmentReviewMinutes` và không có assessment-review chặn. Không mặc định luôn đúng 48 giờ chỉ vì tên lỗi chứa 48H; thời gian lấy từ policy. Điểm xử lý dispute hiện còn hạn chế ở mục 8.

API settlement có thể trả `refundRef=null` khi mới đánh dấu chờ worker. Poll deposit endpoint để lấy refund thực tế; đừng truyền null vào GET refunds.

Sau đó finalize kết quả trả, vệ sinh và `POST /staff/equipment-units/{id}/ready` theo schema Swagger. Trạng thái kho AVAILABLE và refund SUCCEEDED là hai điều kiện độc lập.

### D. Hủy đơn trước khi nhận đồ

1. `GET /rental-orders/{id}/cancellation-preview` lấy canCancel, feeRefund, depositRefund, previewVersion.
2. `POST /rental-orders/{id}/cancel` với key mới:

```json
{"reason":"Thay đổi kế hoạch","previewVersion":"<previewVersion>","expectedVersion":1}
```

Các trạng thái được preview cho hủy: PENDING_PAYMENT, PAID, PREPARING, READY_FOR_HANDOVER. Đơn chưa trả tiền không có tiền hoàn. Đơn đã trả: trước/đúng hạn `rentalStartAt - freeCancellationHours` hoàn phí thuê + cọc; sau hạn giữ phí thuê, hoàn cọc. Đây không phải quyết toán hư hỏng sau sử dụng.

No-show dùng nhánh delivery: nếu không phải lỗi user, helper tính hoàn phí thuê + cọc; nếu lỗi user, phí thuê theo hạn hủy và vẫn hoàn cọc. Kiểm tra trạng thái/điều kiện delivery trước khi gọi.

Hiện helper hoàn hủy/no-show yêu cầu chỉ một payment đã SUCCEEDED/APPLIED cho đơn; đơn có thêm payment gia hạn bị chặn để review.

## 5. Đọc kết quả và kiểm tra database

`GET /rental-orders/{id}/deposit` trả collectedAmount, heldAmount, refundedAmount, refundPendingAmount, deductionAmount, items và groupedRefunds. heldAmount hiện bao gồm phần chưa hoàn xong (kể cả pending); không cộng heldAmount + refundPendingAmount để tính tổng cọc.

| Bảng | Field/đối chiếu |
|---|---|
| rental_orders | rental_fee, total_deposit, total_amount, status, financial_status |
| rental_order_lines | quantity, charged_days, daily_price_snapshot, deposit_per_unit_snapshot, replacement_value_snapshot, line_rental_fee, line_deposit |
| invoices / payments / payment_applications | invoice PAID/PARTIALLY_REFUNDED/REFUNDED; payment SUCCEEDED; application APPLIED |
| payment_allocations | rental_order_line_id, component RENTAL_FEE hoặc RENTAL_DEPOSIT, amount |
| rental_unit_assignments | Liên kết dòng hàng với equipment unit |
| condition_snapshots | PRE_HANDOVER và RETURN_FINAL làm căn cứ đối chiếu |
| return_inspections / return_inspection_findings | FINAL/outcome; rule_id, quantity, assessed_amount, rule_snapshot |
| rental_exception_cases / rental_assessment_reviews | Phê duyệt, bằng chứng, dispute, thời hạn |
| deposit_settlements | Tổng cọc, total_deduction, refund_amount, status, outcome |
| deposit_settlement_items | Mỗi unit: deposit_amount, deduction_amount, refund_amount, decision_snapshot, approved_at/by, status |
| refunds | purpose=DEPOSIT; payment_id, deposit_settlement_item_id; status, refunded_at, refund_transaction_ref, reconcile_status, last_error_code |
| refund_allocations | Tiền hoàn nối đúng allocation RENTAL_DEPOSIT của payment gốc |
| deposit_refund_item_allocations | Cấu trúc phân bổ hoàn gộp đã có; chưa thấy writer runtime |
| payment_outbox_events / payment_consumer_receipts | REFUND_SUCCEEDED/FAILED và consumer rental-deposit-v1 |
| rental_outbox_events | Sự kiện duyệt/hoàn cọc và lỗi xử lý nghiệp vụ |

Món đã hoàn: refund SUCCEEDED, có refunded_at, item SETTLED. Toàn bộ cọc quyết toán xong: settlement SETTLED, outcome FULL_REFUND/PARTIAL_REFUND/FULL_DEDUCTION phù hợp. Payments giữ SUCCEEDED vì đó là lịch sử thu tiền. Không chỉ nhìn rental_orders.financial_status để kết luận (mục 8).

SQL chỉ đọc; thay ORDER_UUID bằng rental order ID:

```sql
SELECT o.id, o.status, o.financial_status, o.rental_fee, o.total_deposit, o.total_amount,
       i.id AS invoice_id, i.status AS invoice_status,
       p.id AS payment_id, p.amount, p.status AS payment_status,
       p.payment_gateway, a.status AS application_status
FROM rental_orders o
LEFT JOIN invoices i ON i.rental_order_id=o.id
LEFT JOIN payments p ON p.invoice_id=i.id
LEFT JOIN payment_applications a ON a.payment_id=p.id
WHERE o.id='ORDER_UUID'::uuid;

SELECT s.id AS settlement_id, s.total_deposit, s.total_deduction,
       s.refund_amount AS total_refund, s.status AS settlement_status, s.outcome,
       d.id AS item_id, d.unit_id, d.inspection_id, d.deposit_amount,
       d.deduction_amount, d.refund_amount, d.status AS item_status,
       d.reason, d.decision_snapshot, d.approved_at,
       r.id AS refund_id, r.status AS refund_status, r.refunded_at,
       r.reconcile_status, r.last_error_code, r.refund_transaction_ref
FROM deposit_settlements s
JOIN deposit_settlement_items d ON d.settlement_id=s.id
LEFT JOIN refunds r ON r.deposit_settlement_item_id=d.id
WHERE s.order_id='ORDER_UUID'::uuid;

SELECT pa.id, pa.payment_id, pa.rental_order_line_id, pa.component, pa.amount,
       ra.refund_id, ra.amount AS allocated_refund, r.status AS refund_status
FROM payment_allocations pa
JOIN payments p ON p.id=pa.payment_id
JOIN invoices i ON i.id=p.invoice_id
LEFT JOIN refund_allocations ra ON ra.payment_allocation_id=pa.id
LEFT JOIN refunds r ON r.id=ra.refund_id
WHERE i.rental_order_id='ORDER_UUID'::uuid;

SELECT e.id, e.event_type, e.status, e.retry_count, e.last_error, e.payload
FROM payment_outbox_events e
JOIN refunds r ON r.id=e.aggregate_id
JOIN payments p ON p.id=r.payment_id
JOIN invoices i ON i.id=p.invoice_id
WHERE e.aggregate_type='Refund' AND i.rental_order_id='ORDER_UUID'::uuid;
```

Query settlement trên dùng quan hệ hoàn từng món đang được worker hỗ trợ. Khi triển khai hoàn gộp phải join thêm deposit_refund_item_allocations, không coi refund_id null ở quan hệ cũ là chưa hoàn.

## 6. Ma trận test cần chạy

| Ca | Kỳ vọng / dấu hiệu cần bắt |
|---|---|
| Thu 2 loại hàng, quantity > 1 | Tổng phí + cọc khớp dòng; allocations không thiếu/trùng |
| Retry tạo payment cùng key | Không thu hai lần; đổi gateway/body cùng key bị từ chối |
| Gia hạn có phí | Payment riêng chỉ có phí, cọc ban đầu không đổi |
| Mọi món FINAL PASS | Kỳ vọng nghiệp vụ hoàn 100% cọc; hiện bị chặn ở kết nối grouped refund |
| Một món hư, còn lại bình thường | Cap riêng từng món; món bị giữ không được lấy tiền từ cọc món khác |
| Admin bác khấu trừ có finding | Sau settlement hoàn đủ cọc món, không hoàn phí thuê |
| Thiệt hại vượt cọc | Giữ tối đa cọc món, excess lưu case; không tự thu thêm |
| Mất đồ | Không xác nhận trước deadline; xác nhận hợp lệ giữ toàn bộ cọc, không refund 0 |
| Có dispute / chưa hết review window | Không phát sinh hoàn/khấu trừ trái quyết định; kiểm thử điểm chặn mục 8 |
| Rule trùng hoặc tính ra tiền lẻ | Phải phát hiện lệch finding/số tiền nguyên; hiện còn rủi ro mục 8 |
| Refund timeout / UNKNOWN | Chưa được SETTLED; kiểm tra reconcile và không tạo lệnh trùng |
| Hoàn cọc sau payment gia hạn | Dùng đúng payment có RENTAL_DEPOSIT |
| Hủy đơn có nhiều payment | Hiện bị chặn MULTI_PAYMENT_RENTAL_CANCELLATION_REVIEW_REQUIRED |

Nếu refund đã có ID nhưng bị treo, admin có thể dùng `POST /admin/refunds/{id}/reconcile` với body reason. HTTP 202 chỉ lên lịch; không ép thành công. Nếu chưa có refund vì FINAL_PASS đang REVIEW_REQUIRED, reconcile không thay thế phần tạo refund còn thiếu.

## 7. Kết quả kiểm tra trong lần rà soát

- Đã đọc mã nguồn và đối chiếu các nhánh kể trên; không sửa nghiệp vụ rental/payment hoặc dữ liệu database.
- Chạy hai bộ unit test hiện có: `rental-ordering.rules.spec.ts` và `operational-deadlines.spec.ts`: **14/14 pass**. Phạm vi là tính ngày thuê/quy tắc ordering và deadline, không chứng minh toàn bộ hoàn cọc chạy được.
- Chưa chạy end-to-end có PostgreSQL, media, custody, worker và nhà cung cấp sandbox; các phát hiện dưới đây dựa trên đường đi code.

## 8. Thiếu sót và rủi ro cần xử lý trước khi coi flow hoàn chỉnh

1. **FINAL PASS chưa nối tạo hoàn gộp.** Adapter ghi REVIEW_REQUIRED, worker chỉ chọn DEDUCTION_APPROVED/DEDUCTION_REJECTED/REFUND_PENDING. `planDepositRefundGroups` không có caller trong api/src; chưa thấy writer của deposit_refund_item_allocations. API deposit-settlement lại yêu cầu resolved exception + approvalRef, trong khi món PASS bình thường không tạo case đó. Bật worker không tự giải quyết khoảng trống này.
2. **Dispute đã từng tạo có thể chặn settlement mãi.** createDepositSettlement kiểm tra sự tồn tại của bất kỳ rentalAssessmentReview theo inspectionId, không kiểm tra dispute đã giải quyết chưa; resolveException chưa thấy xóa/chuyển điều kiện này. Cần test và định nghĩa rõ trạng thái sau giải quyết.
3. **Hai nơi tổng hợp tài chính khác nhau.** `refreshSettlementAggregate` có thể ghi rental financialStatus=SETTLED khi mọi item settled; RentalDepositWorker.consume ghi PARTIALLY_REFUNDED nếu chỉ hoàn phần cọc trên tổng payment, và PAID nếu không hoàn. Không dùng một giá trị financial_status duy nhất làm tiêu chí pass hiện tại; cần thống nhất contract.
4. **Hoàn hủy/no-show còn hạn chế.** Helper chặn nhiều payment đã áp dụng; consumer refund của rental-deposit chỉ nhận purpose=DEPOSIT. Chưa thấy consumer tương ứng tự đồng bộ trạng thái rental cho RENTAL_CANCELLATION từ Shared Payment outbox.
5. **Rule trùng trong cùng FINAL có thể cộng tiền trùng.** DTO chưa bắt ruleId duy nhất; vòng lặp cộng assessed mỗi lần nhưng finding upsert theo inspectionId_ruleId chỉ lưu một bản. Có nguy cơ tổng đề xuất không khớp findings; cần chặn input lặp hoặc gộp quantity rõ ràng.
6. **Phần trăm có thể tạo tiền lẻ.** calculateRuleDeduction dùng Decimal không có quy tắc làm tròn VND tại đây, trong khi Shared Payment yêu cầu amount nguyên. Cần thống nhất làm tròn hoặc ràng buộc rule trước khi dùng mức phần trăm tạo số lẻ.
7. **Swagger rental payment còn tên response cũ.** Mô tả checkoutUrl/qrCode không khớp `checkout.url/checkout.qrData`, thiếu response 202. File này dùng field thực tế; chưa chỉnh controller rental trong lần rà soát này.

Ưu tiên sửa kết nối FINAL PASS → refund và điều kiện dispute trước, sau đó thống nhất aggregation/trạng thái, validation rule và Swagger. Không tự đổi REVIEW_REQUIRED thành SETTLED trong DB để vượt qua lỗi.

## 9. Mã nguồn đối chiếu

- `src/modules/rental/payments/rental-payment.rules.ts`: tổng thu và phân bổ.
- `src/modules/rental/payments/rental-checkout.service.ts`, `rental-payment.consumer.ts`: reserve và áp dụng payment.
- `src/modules/rental/returns/infrastructure/adapters/prisma-rental-return.adapter.ts`: FINAL, resolve, settlement, deposit view, công thức rule.
- `src/modules/rental/returns/application/deposit-grouping.policy.ts`: lập nhóm thuần túy, không gửi tiền.
- `src/modules/payments/rental-refunds.service.ts`: ràng buộc source/allocations và giới hạn hoàn từng món.
- `src/modules/rental/payments/rental-deposit.worker.ts`, `settlement-progress.ts`: tạo refund, consume kết quả và tổng hợp.
- `src/modules/rental/payments/rental-cancellation-refund.ts`: hoàn hủy/no-show từ payment gốc.
- `src/modules/rental/ordering/infrastructure/adapters/prisma-rental-order.adapter.ts`: preview hủy và hạn miễn phí.
- `src/modules/rental/returns/presentation/dtos/rental-return.dto.ts`: request thực tế.
