# Review: Rental Deposit Sandbox Settlement Fix

Ngày rà soát: 2026-10-25
Phạm vi: Shared Payment và Rental deposit refund; không thay đổi Booking/CF01, Auth, Trail hoặc Gear.

## Kết luận chẩn đoán

Lỗi cũ là một split-brain tài chính:

- `SandboxRefundSimulationService` ghi trực tiếp `DepositSettlementItem`, `DepositSettlement` và `RentalOrder`, thậm chí thử đóng đơn.
- Cùng lúc đó `Refund.status` vẫn là `PROCESSING`. Vì lịch sử giao dịch chỉ coi `SUCCEEDED` là CREDIT, FE hiển thị đúng rằng tiền chưa hoàn trong khi projection Rental đã bị đánh dấu settled/completed.
- Deposit refund mới không ghi `rentalOrderId`, trong khi một số consumer/guard cần quan hệ này.
- Read model từng suy diễn item là `REFUNDED` từ `Refund.status=SUCCEEDED` ngay cả khi outbox worker chưa áp dụng projection.

Simulator không được dùng để chứng minh FINAL inspection, deduction approval hay custody đã hoàn tất. Nó chỉ mô phỏng kết quả terminal của provider trong sandbox.

## Source of Truth đã áp dụng

- Policy v1.5.2, RB-POL-22/RB-POL-29: refund phải quay về đúng nguồn thanh toán gốc và không vượt số tiền đã thu.
- Business Flow v1.3.2: quyết định kiểm định/khấu trừ tạo nghĩa vụ refund; provider success và projection Rental là hai bước riêng.
- Functional Requirements v1.3.2: refund sạch có thể gom batch; trạng thái item/order chỉ hoàn tất khi các nghĩa vụ liên quan đã terminal.
- Quy tắc đóng đơn trong Rental README: hoàn cọc không được bypass FINAL inspection, custody, exception và settlement gates.

Nguồn authoritative là ba DOCX trong `docs/rental/sot/`; các mirror Markdown chỉ hỗ trợ tra cứu.

## Thiết kế sau sửa

```text
Admin sandbox endpoint
  -> kiểm tra environment/source/allocation/idempotency
  -> RefundsService.applyEvent(SUCCEEDED)
       -> Refund.status=SUCCEEDED + refundedAt
       -> durable PaymentOutboxEvent(REFUND_SUCCEEDED)
  -> trả settlementProcessingStatus=PENDING/APPLIED

RentalDepositWorker
  -> consume REFUND_SUCCEEDED
  -> kiểm tra order/source/allocation/item invariants
  -> cập nhật item + settlement aggregate + order financial status
  -> chỉ gọi completion gate chuẩn của Rental
```

Endpoint simulator không còn ghi trực tiếp bảng Rental và không gọi API refund thật của VNPay.

## Thay đổi chính

- `SandboxRefundSimulationService`
  - gọi `RefundsService.applyEvent` với event ID/reference ổn định;
  - merge provenance `ADMIN_SANDBOX_SIMULATION`, không overwrite evidence VNPay cũ;
  - trả `providerRefundStatus=SUCCEEDED` chỉ sau khi Shared Payment đã commit;
  - trả `settlementProcessingStatus` theo durable outbox, không claim order đã settled khi worker còn chờ;
  - giữ guard Admin/controller, feature flag, sandbox provider, DB local, VNPay 05/06, expected version và idempotency.
- `RentalRefundsService.reserve`
  - deposit refund mới ghi cả `rentalOrderId` và `depositSettlementId`.
- `RentalDepositWorker.consume`
  - legacy refund thiếu `rentalOrderId` vẫn resolve qua `depositSettlement.orderId`;
  - nếu hai order ID khác nhau, allocation sai source/component/order, tổng allocation sai hoặc item sai settlement thì transaction fail-closed và outbox không bị đánh dấu processed.
- `PrismaRentalReturnAdapter.getDeposit`
  - trong worker delay, item vẫn là `REFUND_PENDING` dù refund đã `SUCCEEDED`;
  - provenance sandbox được đọc từ refund metadata;
  - sandbox success không được diễn giải thành bằng chứng tiền thật đã về tài khoản.
- `RefundsService.applyEvent`
  - audit phân biệt event simulator với provider thật;
  - event provider terminal mâu thuẫn sau simulation bị đưa vào reconciliation review, không ghi đè mù.
- DTO/OpenAPI
  - `providerRefundStatus` của response simulation là `SUCCEEDED`;
  - thêm `settlementProcessingStatus: PENDING | APPLIED`;
  - mô tả rõ Rental settlement chạy bất đồng bộ.

Không cần thay schema hoặc migration cho bản sửa này.

## Dữ liệu cũ

Script `api/scripts/audit-repair-sandbox-deposit-settlement.ts` chỉ dry-run theo mặc định và phân loại:

1. `EARLY_PROJECTION_AUTO_REPAIR`: refund sandbox còn PROCESSING nhưng item đã settled sớm, quan hệ đầy đủ, item có marker simulator, order chưa COMPLETED và chưa phát hành chứng từ.
2. `MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL`: order đã COMPLETED hoặc có chứng từ bất biến; tuyệt đối không tự reopen.
3. `REPLAY_SHARED_SUCCESS_EVENT`: Shared Payment đã SUCCEEDED nhưng projection thiếu; xử lý bằng replay/reconciliation event chung.
4. `MANUAL_REVIEW_UNSAFE_SOURCE`: nguồn không phải sandbox, quan hệ/provenance không đủ hoặc mâu thuẫn.

Apply chỉ cho nhóm 1, bắt buộc allowlist cả refund và order, snapshot hash đúng, recheck trong transaction và audit before/after. Script không demote refund, không tạo refund mới và không gọi provider.

Chưa chạy audit/apply trên database đang phục vụ người dùng; code fix không đồng nghĩa dữ liệu cũ đã được repair.

## Rủi ro và phần chưa xác minh

- Unit/mocked integration không thay thế bằng chứng PostgreSQL thật cho row lock, unique race và outbox concurrency.
- VNPay sandbox success ở endpoint là synthetic test evidence, không phải xác nhận chuyển khoản ngân hàng.
- Cần staging/local PostgreSQL cô lập để chạy E2E thật: tạo refund từ FINAL inspection, gọi simulator, quan sát worker và kiểm tra transaction history.
- Các payment integration test phụ thuộc database được giữ nguyên trạng thái skip khi biến môi trường test DB không có.

## Bằng chứng kiểm thử

| Test/command | Kết quả thực chạy | Bằng chứng | Trạng thái |
| --- | --- | --- | --- |
| `npm run test:payments` | 6 suites; 106 passed; 74 skipped | Payment, VNPay, simulator, audit classifier; DB integration bị skip do không có test DB | PASS/BLOCKED phần DB |
| `npx jest --config ./test/jest-payments.json --runInBand --testRegex payment-history.spec.ts$` | 21 passed | Refund PROCESSING không CREDIT; SUCCEEDED là CREDIT | PASS |
| `npx jest src/modules/rental/returns/rental-returns-and-settlement.spec.ts --runInBand` | 82 passed | Grouped refund worker, retry, failed/succeeded projection, completion gates | PASS |
| `npm run build` | Nest build exit 0 | TypeScript production source compile | PASS |
| `npm run lint` | ESLint exit 0 | Script thật của repository (`eslint ... --fix`) | PASS |
| PostgreSQL E2E + Swagger manual | Chưa chạy trên DB sandbox cô lập | Cần credentials/test fixture phù hợp; không dùng DB đang phục vụ người dùng | BLOCKED |

Kết luận hiện tại:

- Code và regression liên quan: PASS tại các suite nêu trên, gồm build và lint.
- Sandbox end-to-end qua outbox/worker trên PostgreSQL thật: BLOCKED do chưa có test DB cô lập được xác nhận.
- Dữ liệu cũ: chưa kiểm kê live, chờ operator chạy dry-run.
- FE có thể tiếp tục kiểm thử contract bằng mocked/unit evidence; chưa nên tuyên bố nghiệm thu tích hợp tài chính E2E cho tới khi staging PostgreSQL và Swagger flow đạt.
