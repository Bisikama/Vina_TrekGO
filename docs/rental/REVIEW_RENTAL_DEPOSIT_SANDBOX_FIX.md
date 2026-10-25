# REVIEW: KIỂM CHỨNG VÀ HOÀN TẤT BẢN SỬA QUYẾT TOÁN CỌC SANDBOX (PROMPT 02)

**Ngày lập và kiểm chứng:** 25/10/2026
**Phạm vi:** Backend Rental & Shared Payment, Outbox Dispatcher, Rental Deposit Worker, Audit & Repair Script
**Chính sách & Quy cách áp dụng:** TrekGo Policy v1.5.2, TrekGo Business Flow v1.3.2, TrekGo Functional Requirements v1.3.2
**Baseline Wire Contract:** 1.3.2 (Không tự ý triển khai target task ownership/escalation 1.3.3)

---

## 1. Kết luận chẩn đoán đã xác minh trên mã nguồn

Trước khi sửa, hệ thống tồn tại sự không nhất quán nghiêm trọng giữa trạng thái hoàn tiền của Shared Payment và trạng thái quyết toán của Rental:

1. **Endpoint Sandbox vi phạm ranh giới dịch vụ và giả lập sớm:**
   Tại `api/src/modules/payments/sandbox-refund-simulation.service.ts`, endpoint Admin canonical `POST /api/v1/admin/payment-refunds/:refundId/sandbox-simulate-settlement` trước đây đã trực tiếp cập nhật trạng thái `DepositSettlementItem` thành `SETTLED`, cập nhật `DepositSettlement` thành `SETTLED`, và thậm chí gọi hoàn tất đơn `RentalOrder` thành `COMPLETED` (`completionMode='SANDBOX_SIMULATED'`), trong khi record hoàn tiền `Refund` của Shared Payment vẫn ở trạng thái `PROCESSING`.
2. **Trạng thái tài chính của USER không đồng nhất (Truthful Read Model bị phá vỡ):**
   Tại `api/src/modules/payments/payment-history.service.ts` (dòng 312), `financialEffect` chỉ có giá trị `'CREDIT'` khi `r.status = 'SUCCEEDED'`; đối với trạng thái `PROCESSING`, `financialEffect` trả về `'NONE'`. Do endpoint giả lập cũ giữ refund ở `PROCESSING` nhưng lại đánh dấu đơn hàng là đã hoàn tất/quyết toán, USER nhìn thấy màn hình chi tiết cọc báo "Đã hoàn" nhưng lịch sử giao dịch thanh toán lại thể hiện `NONE` (chưa có khoản tiền nào được ghi nhận).
3. **Mất liên kết thực thể (Missing foreign key `rentalOrderId`):**
   Tại `api/src/modules/payments/rental-refunds.service.ts` (dòng 188–198), khi tạo lệnh hoàn cọc mới qua `reserve()`, lệnh hoàn tiền `Refund` chỉ lưu `depositSettlementId` mà không gán `rentalOrderId: orderId`, gây khó khăn cho việc tra cứu ngược và đồng bộ theo thứ tự khóa order.
4. **Thiếu cơ chế xử lý Durable Event và phân định Worker:**
   Projection của Rental thuộc quyền sở hữu của `RentalDepositWorker`. Endpoint sandbox không được phép ghi tắt vào cơ sở dữ liệu của Rental mà phải đưa kết quả mô phỏng provider qua `RefundsService.applyEvent()` để commit trạng thái `Refund SUCCEEDED` cùng với sự kiện bền vững `paymentOutboxEvent` (`REFUND_SUCCEEDED`), sau đó để worker cập nhật projection theo cách bình đẳng với production.

### Bảng đối chiếu chẩn đoán mã nguồn

| Phát hiện                                                                         | Bằng chứng file:line                                | Bất biến bị vi phạm                                                                                              | Vị trí sửa                                                                                                                            |
| :-------------------------------------------------------------------------------- | :-------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Endpoint bypass worker & ghi tắt Rental state**                              | `sandbox-refund-simulation.service.ts:337-476` (cũ) | Bất biến 1 & 2: Refund chưa SUCCEEDED đã quyết toán cọc; endpoint ghi trực tiếp bảng Rental che giấu worker.     | `api/src/modules/payments/sandbox-refund-simulation.service.ts`                                                                       |
| **2. Thiếu liên kết `rentalOrderId` trên lệnh Refund**                            | `rental-refunds.service.ts:188-198`                 | Bất biến 7: Refund phải khớp trực tiếp với rental order nguồn; truy vết ngược bị gián đoạn.                      | `api/src/modules/payments/rental-refunds.service.ts`                                                                                  |
| **3. Lịch sử giao dịch USER không có CREDIT khi cọc báo đã settled**              | `payment-history.service.ts:312`                    | Bất biến 1: Chỉ hoàn tiền thực tế hoặc provider SUCCEEDED mới có `financialEffect=CREDIT`.                       | Giữ nguyên quy tắc `payment-history.service.ts`, chuyển `Refund` sang `SUCCEEDED` trong Shared Payment trước khi worker settled item. |
| **4. Thiếu bảo vệ chống xung đột giữa sự kiện mô phỏng và sự kiện provider thật** | `refunds.service.ts:383-435`                        | Bất biến 9 & 10: Xung đột trạng thái terminal phải được giữ nguyên bằng chứng và đưa vào diện đối soát.          | `api/src/modules/payments/refunds.service.ts`                                                                                         |
| **5. Worker thiếu kiểm tra toàn vẹn đa tầng (allocations + items)**               | `rental-deposit.worker.ts:330-375`                  | Bất biến 3, 4, 7 & 8: SUM(allocations) = Refund.amount; các allocation phải thuộc RENTAL_DEPOSIT của đúng order. | `api/src/modules/rental/payments/rental-deposit.worker.ts`                                                                            |

---

## 2. Căn cứ Single Source of Truth (SOT)

1. **TrekGo Policy v1.5.2:**
   - **RB-POL-16:** Lệnh hoàn tiền chưa rõ trạng thái phải được retry theo cùng reference tại các mốc `1m/5m/15m/1h/6h`; sau 5 lần retry chưa xác định thì cần ADMIN can thiệp; sau 24h chưa rõ phải hiển thị trạng thái đang đối soát (`NEEDS_REVIEW`). Không được bypass qua một simulation endpoint che giấu trạng thái unknown.
   - **RB-POL-22, Phụ lục Hybrid Return, RB-POL-28, RB-POL-29:** Tiền cọc được hoàn đúng theo component `RENTAL_DEPOSIT` của payment gốc đã capture. Thiết bị đạt kiểm định (PASS) được quyết toán hoàn cọc độc lập; khoản khấu trừ (deduction) phải có biên bản kiểm định, duyệt hợp lệ và cho phép USER phản hồi. Shared Payment phải xác nhận `SUCCEEDED` trước khi ghi nhận giảm nghĩa vụ hoàn tiền; sổ cái ledger và allocations được bảo vệ trong transaction ACID.
2. **TrekGo Business Flow v1.3.2:**
   - **Giai đoạn 28–30, Mục 14.1–14.2:** Hoàn tiền cọc theo đúng payment nguồn. Giao diện chỉ hiển thị tiền đã hoàn sau khi provider phản hồi `SUCCEEDED`. Đơn thuê chuyển `COMPLETED` khi và chỉ khi đã giải phóng toàn bộ nghĩa vụ tài chính, thiết bị, custody và không còn exception case mở.
3. **TrekGo Functional Requirements v1.3.2:**
   - **RB-FR-603, 607–609; Mục 24; Mục 33–36:** Không được hoàn cọc trước khi có kết quả kiểm định `FINAL`. Cơ chế phân bổ allocation, outbox và worker phải đảm bảo tính idempotent; provider unknown thì tiếp tục `RECONCILING`; cấm double settlement.
   - **Mục 17 và HYB-01/02/03/08/09/12/13 (Mục 36):** Được phép sử dụng sandbox payment adapter mô phỏng đúng contract sự kiện; thiết bị PASS không phải chờ thiết bị ISSUE/MISSING; nếu thiếu điều kiện chạy thật thì ghi `BLOCKED`, không tạo kết quả giả.

---

## 3. Các thay đổi mã nguồn chi tiết

### 3.1. `api/src/modules/payments/sandbox-refund-simulation.service.ts`

- **Ranh giới an toàn fail-closed (`assertEnvironmentSafe`):**
  - `NODE_ENV !== 'production'`.
  - `PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED === 'true'`.
  - `PAYMENT_PROVIDER_ENVIRONMENT === 'SANDBOX'`.
  - `DATABASE_URL` bắt buộc có hostname thuộc loopback nội bộ (`localhost`, `127.0.0.1`, `::1`). Remote QA/Staging DB bị fail-closed chặn để ngăn chạy nhầm vào database chia sẻ.
- **Xác thực Provenance & Allocations:**
  - Kiểm tra gateway là `vnpay`, `providerEnvironment === 'SANDBOX'`, mục đích là `DEPOSIT`.
  - Kiểm tra payload VNPay hiện tại là kết quả đang xử lý (`vnp_ResponseCode === '00'` và `vnp_TransactionStatus` thuộc `['05', '06']`).
  - Xác thực hai tầng phân bổ: tổng `paymentAllocation` (component `RENTAL_DEPOSIT`) bằng `refund.amount`, và tổng `depositRefundItems` (trạng thái `REFUND_PENDING`) bằng `refund.amount`.
  - Hỗ trợ tương thích ngược (legacy fallback): nếu `refund.rentalOrderId` là null, resolve an toàn qua `refund.depositSettlement.orderId`; nếu `depositRefundItems` rỗng, fallback sang `depositSettlementItem` đơn lẻ.
- **Loại bỏ việc ghi trực tiếp vào Rental:**
  - Endpoint **không** cập nhật `DepositSettlementItem`, **không** cập nhật `DepositSettlement`, **không** cập nhật `RentalOrder`, và **không** gọi `tryCompleteOrder`.
  - Gửi synthetic event hợp lệ qua `RefundsService.applyEvent(event)`.
  - Trả về response trung thực: `providerRefundStatus: 'SUCCEEDED'`, `simulationStatus: 'SIMULATED'`, `settlementMode: 'SANDBOX_SIMULATED'`. `settlementProcessingStatus` chỉ là `APPLIED` khi tồn tại `PaymentConsumerReceipt` cho consumer `rental-deposit-v1` (`sandbox-refund-simulation.service.ts:381`); trạng thái transport `paymentOutboxEvent.status=PROCESSED` một mình không phải bằng chứng projection Rental đã commit.

### 3.2. `api/src/modules/payments/refunds.service.ts`

- **Phân biệt synthetic event và real provider event:**
  - Kiểm tra `isSandboxSimulationEvent` thông qua provenance được lưu trong `refund.providerPayload.sandboxSimulation` (`origin === 'ADMIN_SANDBOX_SIMULATION' && providerEventId === event.providerEventId`).
  - Khi synthetic event đến: cập nhật `status: 'SUCCEEDED'`, `refundedAt: now`, tạo durable outbox event `refund:${refund.id}:succeeded:v1` trong cùng transaction, và ghi audit log `ADMIN_SANDBOX_REFUND_SIMULATION_ACCEPTED`.
  - Khi real provider event đến sau simulation: nếu provider báo `FAILED` (mâu thuẫn), giữ nguyên terminal `Refund.status=SUCCEEDED`, chỉ chuyển `Refund.reconcileStatus=NEEDS_REVIEW`, ghi `lastErrorCode=SANDBOX_SIMULATION_PROVIDER_CONFLICT` và audit `REFUND_RESULT_NEEDS_REVIEW` (`refunds.service.ts:382-407`). Không demote refund đơn lẻ và không đảo projection/ledger đã commit. Nếu provider xác nhận `SUCCEEDED`, ghi audit `REAL_PROVIDER_REFUND_CONFIRMED_AFTER_SIMULATION` nhưng không phát thêm outbox success và không sinh hiệu ứng tài chính thứ hai (`refunds.service.ts:535-549`).

### 3.3. `api/src/modules/payments/rental-refunds.service.ts`

- Khi tạo refund cọc mới (`reserve()`), lưu trực tiếp `rentalOrderId: orderId` cùng với `depositSettlementId: settlementId`, đảm bảo tính toàn vẹn khóa ngoại và liên kết dữ liệu hai chiều.

### 3.4. `api/src/modules/rental/payments/rental-deposit.worker.ts`

- **Bảo vệ toàn vẹn trước khi cập nhật:**
  - Xác thực `refund.depositSettlementId === settlementId` và `refund.rentalOrderId === orderId` (nếu không null).
  - Xác thực toàn bộ allocation: component là `RENTAL_DEPOSIT`, thuộc đúng `orderId`, số tiền hợp lệ.
  - Xác thực tất cả items thuộc đúng `settlementId`.
- **Cập nhật lũy tiến và đóng đơn có kiểm soát:**
  - Cập nhật từng item sang `SETTLED` và gắn `settledAt`.
  - Tính toán lại tiến độ quyết toán qua `updateSettlementProgress()`.
  - Cập nhật `financialStatus` của order dựa trên số tiền cọc thực tế đã hoàn và trạng thái các items (hỗ trợ `PARTIALLY_REFUNDED`, `SETTLED`).
  - Gọi `tryCompleteOrder()` để đánh giá toàn bộ 8 cổng bảo vệ (custody, delivery tasks, package, sessions, unit assignments, exception cases) trước khi chuyển order sang `COMPLETED`.
  - Đảm bảo idempotency thông qua `PaymentConsumerReceipt`: khi replay sự kiện, worker bỏ qua việc ghi đè item và outbox duplicate.
  - Ghi nhận `paymentConsumerReceipt` và `paymentOutboxEvent.status = 'PROCESSED'` trong cùng một transaction (`rental-deposit.worker.ts:458-466`).

### 3.5. `api/scripts/audit-repair-sandbox-deposit-settlement.ts`

- Script kiểm kê và sửa chữa dữ liệu cũ bị simulator phiên bản cũ ghi sai.
- Chế độ mặc định là **DRY-RUN (chỉ đọc)**.
- Phân loại rõ 4 nhóm:
  1. `EARLY_PROJECTION_AUTO_REPAIR`: Refund PROCESSING có simulation marker, items settled sớm, order chưa COMPLETED, không có chứng từ bất biến.
  2. `MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL`: Order đã COMPLETED hoặc đã phát hành chứng từ PDF bất biến -> Không tự động can thiệp.
  3. `REPLAY_SHARED_SUCCESS_EVENT`: Shared Payment thực tế đã SUCCEEDED nhưng projection bị thiếu -> Khuyến nghị replay event.
  4. `MANUAL_REVIEW_UNSAFE_SOURCE`: Môi trường không phải SANDBOX hoặc quan hệ dữ liệu bất thường -> Loại khỏi auto repair.
- Chế độ `--apply` yêu cầu `--snapshot-in`, allowlist `--refund-id`, `--order-id`, khóa và revalidate trong transaction đối với order, settlement/items, refund cùng payment source, payment/refund allocations, item mappings, inspections/evidence, cases, immutable documents, outbox và consumer receipts. Snapshot canonical bao phủ toàn bộ các facts trên; thay đổi sau dry-run làm hash đổi và apply bị từ chối trước khi khôi phục item về `REFUND_PENDING`.

---

## 4. 11 Bất biến được bảo vệ

1. **Không giải phóng nghĩa vụ khi chưa SUCCEEDED:** Refund `PROCESSING`, unknown hoặc thất bại không có `financialEffect=CREDIT`, không làm item thành `SETTLED`, không giảm nghĩa vụ nợ.
2. **Tách biệt pha xử lý (Decoupled Projection):** Shared Payment `SUCCEEDED` và Rental projection là hai bước xử lý bất đồng bộ. Endpoint simulation chỉ xác nhận kết quả provider, không ghi tắt projection Rental.
3. **Quyết toán từng item trọn vẹn:** Item chỉ `SETTLED` khi toàn bộ allocation hoàn tiền của nó thành công.
4. **Cân bằng nghĩa vụ tổng thể (Aggregate Integrity):** Một batch/refund thành công không quyết toán thay cho các batch/item còn pending hoặc review.
5. **Đóng đơn toàn diện (Holistic Completion):** Order chỉ `COMPLETED` khi đồng thời thỏa mãn: tài chính `SETTLED`, thiết bị `CLOSED`, custody `RECEIVED`, task `CLOSED`, package `CLOSED`, case `RESOLVED`.
6. **Cô lập ngoại lệ (Exception Isolation):** Item bị hư hại/mất mát (`ISSUE`/`MISSING`) không chặn hoàn cọc của các item đạt chuẩn (`PASS`).
7. **Bảo toàn số tiền phân bổ:** `SUM(allocations) = Refund.amount`, nguồn hoàn tiền duy nhất là component `RENTAL_DEPOSIT` của payment gốc.
8. **Bảo vệ ngân sách hoàn (No Double Settlement):** Các khoản hoàn đang pending cũng giữ chỗ ngân sách; không cho phép hoàn vượt số cọc đã thu.
9. **Chống trùng lặp đa tầng (Idempotency):** Idempotency key, provider event ID, outbox deduplication key và consumer receipt ngăn chặn hoàn tiền hoặc ghi có hai lần.
10. **Độc lập vận hành kho (Physical Independence):** Trạng thái thiết bị `READY`/`AVAILABLE` độc lập với quá trình hoàn tiền; simulation không thay đổi kết quả kiểm định kho.
11. **Nhánh cọc khấu trừ toàn bộ (Zero Refund Amount):** Khi khấu trừ 100% (`refundAmount = 0`), worker quyết toán qua `settleRetained` mà không tạo lệnh provider refund giả.

---

## 5. Rủi ro và điểm cần lưu ý khi vận hành

1. **Dữ liệu lịch sử đã đóng đơn (Completed Orders):**
   Các đơn hàng demo trước đây đã bị script/simulator cũ chuyển sang `COMPLETED` sẽ **không** được script tự động đảo ngược trạng thái để tránh làm xáo trộn vòng đời đơn hàng. Những trường hợp này được phân loại vào `MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL`.
2. **Độ trễ Worker trong môi trường Demo:**
   Response simulation có thể trả `PENDING` hoặc `APPLIED` tùy Rental worker đã commit trước lúc response đọc receipt hay chưa. Chu kỳ quét hiện là 2 giây nhưng không phải SLA hoàn thành. Client/test phải polling có giới hạn theo điều kiện `PaymentConsumerReceipt`/projection hoặc USER API, và khi timeout phải giữ trạng thái pending rồi chẩn đoán outbox; không dùng refresh cố định 1–2 giây làm bằng chứng.

---

## 6. Xác minh và Xử lý chi tiết các Rủi ro V1–V7 (Prompt 02)

### V1: Thiếu bằng chứng chạy test và triển khai

- **Trạng thái:** `Đã xác minh trong phạm vi chạy được; các giới hạn được ghi rõ`
- **Chi tiết xác minh:**
  - Bộ test payments, các test simulation/repair chuyên biệt và regression Rental/history/Swagger đã được chạy thực tế; số liệu cuối cùng được ghi trong `TEST_EVIDENCE_RENTAL_DEPOSIT_FIX.md` và log đi kèm, không suy diễn từ số lượng test khai báo trong source.
  - `npm run lint` và `npm run build` đều phải đạt exit code `0` trước khi bàn giao.
  - HTTP tests dùng Nest in-memory + Supertest chạy được và PASS. Đây vẫn chưa phải deployed E2E qua Neon/VNPay.
  - Các bài PostgreSQL thật bị skip có chủ đích vì chưa có `PAYMENT_TEST_DATABASE_URL` trỏ tới database `payment_test_*` trên loopback. Sandbox E2E thật và kiểm chứng khóa tương thời vì vậy được ghi nhận là **BLOCKED**, không dùng mocked test để thay thế kết luận này.

### V2: Xung đột Provider FAILED sau Simulation SUCCEEDED không làm mất tính nhất quán (Status Demotion)

- **Trạng thái:** `Đã xác minh đúng trên mã nguồn`
- **Bằng chứng mã nguồn:** `api/src/modules/payments/refunds.service.ts:382-408`
- **Chi tiết xác minh:**
  - Review trước đây dùng cụm từ vắn tắt "đưa refund vào NEEDS_REVIEW" gây hiểu lầm là đổi `Refund.status` từ `SUCCEEDED` thành `NEEDS_REVIEW`.
  - Trên mã nguồn thực tế tại `refunds.service.ts`:
    ```ts
    const terminal = !['PENDING', 'PROCESSING'].includes(refund.status)
    if (terminal && sandboxSimulation && !isSandboxSimulationEvent && refund.status !== event.status)
      reason = 'SANDBOX_SIMULATION_PROVIDER_CONFLICT'
    if (reason) {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          reconcileStatus: 'NEEDS_REVIEW',
          lastErrorCode: reason,
          // Lưu ý: field status KHÔNG hề bị thay đổi, giữ nguyên SUCCEEDED!
          nextRetryAt: ...
        },
      })
      await tx.auditLog.create({
        data: {
          action: 'REFUND_RESULT_NEEDS_REVIEW',
          entityType: 'Refund',
          entityId: refund.id,
          newValues: { reason, event: { ...event } },
        },
      })
    }
    ```
  - **Quy tắc Terminal State Invariant trong nhánh xung đột này:** `Refund.status` không bị demote; nó vẫn giữ nguyên là `SUCCEEDED`. Chỉ có `Refund.reconcileStatus` (metadata đối soát nội bộ backend) được chuyển sang `'NEEDS_REVIEW'`, kèm mã lỗi `SANDBOX_SIMULATION_PROVIDER_CONFLICT` và audit log đối soát.
  - Nhờ đó, phía USER read model (`payment-history.service.ts`) vẫn đọc `status === 'SUCCEEDED'` và giữ `financialEffect === 'CREDIT'`, không bị đảo ngược về `NONE` trong khi Rental projection đã settled.
  - Khi provider thật đến sau và báo `SUCCEEDED` (`refunds.service.ts:535-549`), `terminal && refund.status === event.status` không phát sinh reason lỗi, không tạo duplicate outbox event, không thực hiện credit lần hai, mà chỉ ghi audit log `REAL_PROVIDER_REFUND_CONFIRMED_AFTER_SIMULATION`.

### V3: Phân biệt `RefundAllocation` và `PaymentAllocation` (Hỗ trợ hoàn một phần - Partial Refunds)

- **Trạng thái:** `Đã xác minh đúng trên mã nguồn`
- **Bằng chứng mã nguồn:** `api/src/modules/payments/sandbox-refund-simulation.service.ts:455-472` và `api/src/modules/rental/payments/rental-deposit.worker.ts:333-356`
- **Chi tiết xác minh:**
  - Review trước đây dùng cách diễn đạt "tổng paymentAllocation component RENTAL_DEPOSIT bằng refund.amount", gây lo ngại rằng captured deposit allocation gốc (ví dụ 1.000.000 VND) bị ép phải bằng số tiền hoàn của một đợt partial (ví dụ 400.000 VND), làm chặn hoàn tiền một phần.
  - Trên mã nguồn thực tế:
    - `refund.allocations` là danh sách các bản ghi `RefundAllocation` **thuộc riêng về refund đang xử lý**.
    - Tại `sandbox-refund-simulation.service.ts:455-460`:
      ```ts
      const paymentAllocationTotal = refund.allocations.reduce(
        (sum: Prisma.Decimal, allocation: any) => sum.plus(allocation.amount),
        new Prisma.Decimal(0),
      );
      if (
        !paymentAllocationTotal.equals(refund.amount) ||
        refund.allocations.length === 0
      ) {
        throw AppError.fromCode(P.REFUND_SOURCE_INVALID);
      }
      ```
      Điều kiện này kiểm tra: Tổng số tiền phân bổ của _đợt hoàn tiền này_ (`RefundAllocation.amount`) phải bằng đúng số tiền của lệnh hoàn tiền đó (`refund.amount`). Đây là quy tắc bất biến số học bắt buộc (FR mục 35).
    - Tại dòng 468: `allocation.amount.gt(allocation.paymentAllocation.amount)` bảo đảm số tiền hoàn của từng allocation không vượt quá số tiền cọc đã capture ban đầu trên order line (`allocation.paymentAllocation.amount`).
    - Tại `RentalRefundsService.reserve()`: Hệ thống tính tổng toàn bộ các refund đang giữ chỗ (`PENDING`, `PROCESSING`, `SUCCEEDED`) trên cùng payment allocation, bảo đảm tổng số tiền hoàn cọc qua tất cả các đợt không vượt quá ngân sách cọc ban đầu.
    - Do đó, hoàn một phần (ví dụ cọc 1.000.000 VND, hoàn nhóm PASS 400.000 VND, giữ lại 600.000 VND cho item tranh chấp) hoàn toàn hợp lệ và hoạt động bình thường, không hề bị chặn.

### V4: Bằng chứng Worker commit từng Item và ranh giới xác định trạng thái APPLIED

- **Trạng thái:** `Đã sửa và hoàn thiện ranh giới xác nhận`
- **Bằng chứng mã nguồn:** `api/src/modules/payments/sandbox-refund-simulation.service.ts:332-342, 381` và `api/src/modules/rental/payments/rental-deposit.worker.ts:431-466`
- **Chi tiết xác minh:**
  - Trạng thái `paymentOutboxEvent.status === 'PROCESSED'` chỉ là trạng thái của tầng vận chuyển (transport status). Nếu chỉ dựa vào outbox status thì chưa đủ để khẳng định Rental consumer đã hoàn tất ghi projection vào database.
  - Trên mã nguồn `sandbox-refund-simulation.service.ts`:
    ```ts
    const successOutbox = await tx.paymentOutboxEvent.findUnique({
      where: { deduplicationKey: `refund:${refund.id}:succeeded:v1` },
      select: {
        status: true,
        receipts: {
          where: { consumerName: "rental-deposit-v1" },
          select: { processedAt: true },
          take: 1,
        },
      },
    });
    // settlementProcessingStatus chỉ là 'APPLIED' khi đã có PaymentConsumerReceipt của rental-deposit-v1!
    settlementProcessingStatus: successOutbox.receipts.length > 0
      ? "APPLIED"
      : "PENDING";
    ```
  - Tại `rental-deposit.worker.ts:280-466`: Toàn bộ các thao tác:
    1. Cập nhật `depositSettlementItem.status = 'SETTLED'`.
    2. Cập nhật tiến độ `updateSettlementProgress()`.
    3. Cập nhật `rentalOrder.financialStatus` (tính trên component `RENTAL_DEPOSIT`).
    4. Đánh giá hoàn tất đơn `tryCompleteOrder()`.
    5. Tạo `paymentConsumerReceipt` cho consumer `'rental-deposit-v1'`.
    6. Cập nhật `paymentOutboxEvent.status = 'PROCESSED'`.
       Đều nằm trong **cùng một transaction ACID duy nhất** (`await this.db.$transaction(async (tx) => { ... })`).
  - Do đó, trong transaction boundary hiện tại của worker, sự tồn tại của `paymentConsumerReceipt` cho `'rental-deposit-v1'` là commit fact của Rental projection. Nếu worker chưa commit transaction, response trả về trung thực là `PENDING`.
  - Về tính chất 1:1 của Item: Trong Prisma schema hiện tại, `depositSettlementItemId` trên `Refund` hoặc bảng liên kết `DepositRefundItemAllocation` đảm bảo mapping chặt chẽ; mỗi item chỉ settled khi toàn bộ nghĩa vụ hoàn tiền của item đó thành công.

### V5: Nhận diện Synthetic Event và nguồn gốc Provenance an toàn

- **Trạng thái:** `Đã xác minh đúng trên mã nguồn`
- **Bằng chứng mã nguồn:** `api/src/modules/payments/refunds.service.ts:326-328` và `api/src/modules/payments/sandbox-refund-simulation.service.ts:216-280`
- **Chi tiết xác minh:**
  - `isSandboxSimulationEvent` không chỉ kiểm tra cờ tồn tại đơn thuần trên refund, mà kiểm tra sự trùng khớp giữa context sự kiện và provenance đã commit:
    ```ts
    const sandboxSimulation = existingPayload?.sandboxSimulation as
      | Record<string, unknown>
      | undefined;
    const isSandboxSimulationEvent =
      sandboxSimulation?.origin === "ADMIN_SANDBOX_SIMULATION" &&
      sandboxSimulation.providerEventId === event.providerEventId;
    ```
  - Provenance `sandboxSimulation` được ghi vào `providerPayload` bên trong transaction của `prepareSimulation` trên backend, với `providerEventId = sandbox-refund-simulation:${refund.id}:succeeded:v1` và `origin = 'ADMIN_SANDBOX_SIMULATION'`.
  - Webhook công khai từ bên ngoài không thể tự nhận là synthetic event:
    1. Webhook VNPay bắt buộc phải qua xác thực chữ ký SHA-512 (`vnp_SecureHash`) với bí mật cổng thanh toán.
    2. Provider event ID của webhook thực được sinh từ tham số của ngân hàng/VNPay (`vnp_TransactionNo`), trong khi nhánh synthetic yêu cầu khớp chính xác identity canonical đã được backend commit là `sandbox-refund-simulation:...`.
    3. Webhook thực không chứa cờ nội bộ `ADMIN_SANDBOX_SIMULATION`.
  - Sau khi worker xử lý, provenance `SANDBOX_SIMULATED` cùng cảnh báo `TEST_ONLY`, `NO_REAL_MONEY_RETURNED` được duy trì trong read model và chi tiết cọc, ngăn chặn việc ngộ nhận kết quả mô phỏng là giao dịch tiền mặt thực tế.

### V6: Ranh giới Môi trường Runbook và Kỳ vọng Thời gian thực tế

- **Trạng thái:** `Đã sửa và chuẩn hóa tài liệu`
- **Bằng chứng mã nguồn:** `api/src/modules/payments/sandbox-refund-simulation.service.ts:39-87` và `RUNBOOK_RENTAL_DEPOSIT_SANDBOX_FIX.md`
- **Chi tiết xác minh:**
  - `assertEnvironmentSafe()` kiểm tra fail-closed: `NODE_ENV !== 'production'`, `PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED === 'true'`, `PAYMENT_PROVIDER_ENVIRONMENT === 'SANDBOX'`, và hostname của `DATABASE_URL` bắt buộc phải là loopback (`localhost`, `127.0.0.1`, `::1`).
  - **Sửa tài liệu Runbook:** Runbook đã được cập nhật để ghi rõ: Tính năng này chỉ áp dụng cho môi trường phát triển cục bộ (Local Development) có database cô lập trên loopback. Việc chạy trên QA/Staging sử dụng database remote hiện tại **bị chặn (BLOCKED)** do thiết kế an toàn fail-closed, không nới lỏng guard để làm demo.
  - **Kỳ vọng Response Timing:** Response của simulation có thể là `PENDING` hoặc `APPLIED` tùy thuộc vào việc worker đã commit transaction trước khi controller truy vấn receipt hay chưa. Runbook không khẳng định luôn là `PENDING` và loại bỏ hoàn toàn kỳ vọng "refresh sau 1–2 giây". Client/test phải dùng cơ chế bounded polling có điều kiện hoàn tất.
  - **Phân tách kịch bản Mixed/Partial:** Trong kịch bản kiểm định có lỗi hoặc hư hại (mixed/partial scenario), chỉ có nhóm item PASS được settled; `financialStatus` của order sẽ là `PARTIALLY_REFUNDED` hoặc `REFUND_PENDING` (chưa phải `SETTLED`), và order không được chuyển sang `COMPLETED` cho đến khi tất cả các thiết bị và khiếu nại được giải quyết dứt điểm.
  - **Tính trung thực tài chính:** `financialTruth.realMoneyReturned` luôn là `false` đối với giao dịch mô phỏng sandbox; `financialEffect: 'CREDIT'` trên USER history là hiển thị tương thích read model nhưng kèm cảnh báo `TEST_ONLY`.

### V7: Tính toàn vẹn của Repair Script và Snapshot Hash thực tế

- **Trạng thái:** `Đã sửa mã nguồn và bổ sung test; kiểm chứng PostgreSQL thật còn BLOCKED`
- **Bằng chứng mã nguồn:** `api/scripts/audit-repair-sandbox-deposit-settlement.ts:143-200, 450-513` và `api/test/audit-repair-sandbox-deposit-settlement.spec.ts:202-230`
- **Chi tiết xác minh:**
  - **Snapshot Canonical Hash bao phủ toàn diện:** Hàm `candidateSnapshotHash()` mã hóa SHA-256 đối tượng JSON chuẩn hóa bao gồm toàn bộ các facts quyết định: `refundId`, `refundStatus`, `refundReconcileStatus`, `refundAmount`, `simulationProvenanceHash`, `orderId`, `orderStatus`, `orderFinancialStatus`, `orderVersion`, `settlementStatus`, `settlementVersion`, `allocatedItems` (status, depositAmount, deductionAmount, refundAmount, decisionSnapshotHash, inspection/evidenceHash), `sourcePayment` & allocations, `sourceRefundReservations`, `cases` (status, evidenceHash), `documents` (documentType, snapshotHash), và `durableEvents` (receipts).
  - Test `changes the canonical snapshot hash when %s changes` (`audit-repair-sandbox-deposit-settlement.spec.ts`) đã chứng minh: chỉ cần thay đổi một fact nhỏ (như reconcile status, order version, inspection evidence, document ledger, hay allocation budget), hash lập tức thay đổi và lệnh `--apply` sẽ từ chối thực thi với lỗi `Snapshot hash changed or is missing`.
  - **Transaction Locking an toàn đa bảng:** Trong chế độ `--apply`, script mở transaction và thực hiện `SELECT ... FOR UPDATE` đồng thời trên 12 bảng liên quan (`rental_orders`, `deposit_settlements`, `deposit_settlement_items`, `refunds`, `payment_allocations`, `refund_allocations`, `deposit_refund_item_allocations`, `return_inspections`, `rental_exception_cases`, `rental_documents`, `payment_outbox_events`, `payment_consumer_receipts`), sau đó refetch và revalidate snapshot hash bên trong lock trước khi thực hiện khôi phục item về `REFUND_PENDING`.
  - **Loại bỏ Hash rỗng/Hash mẫu có vẻ hợp lệ trong Runbook:** Ví dụ chỉ dùng placeholder `<SHA-256_FROM_DRY_RUN>`; operator bắt buộc lấy nguyên giá trị do chính lần dry-run xuất ra. Không công bố một hash fixture cố định như bằng chứng cho dữ liệu thực tế.

---

## 7. Bốn Cổng Đánh Giá Nghiệm Thu (Four-Gate Evaluation)

### Gate 1: Code, Build & Regression

- **Kết luận:** **PASS**
- **Căn cứ:**
  - `npm run lint` và `npm run build`: exit code `0` ở vòng kiểm chứng cuối.
  - Test payments, targeted simulation/repair và Rental/history/Swagger đều PASS trong phạm vi in-memory/mocked; số lượng chính xác và lệnh chạy được ghi tại `TEST_EVIDENCE_RENTAL_DEPOSIT_FIX.md`.
  - 74 PostgreSQL tests bị skip vì thiếu isolated local test DB và không được tính là PASS.

### Gate 2: Sandbox E2E Flow (Shared Payment → Outbox → Worker → USER APIs)

- **Kết luận:** **PASS trên Unit/Mocked/In-memory HTTP Integration; BLOCKED đối với deployed E2E và live PostgreSQL.**
- **Căn cứ:**
  - Các test chứng minh từng ranh giới logic từ Admin simulation, Shared Payment/outbox, Rental worker/receipt đến USER read model; HTTP contract in-memory cũng PASS.
  - Chưa có bằng chứng deployed E2E với PostgreSQL thật. `.env` hiện trỏ tới database remote Neon, còn simulation guard chỉ cho phép database loopback nên lời gọi thật sẽ bị từ chối với `403 SANDBOX_SIMULATION_ENV_UNSAFE`.

### Gate 3: Data Audit & Repair Tooling

- **Kết luận:** **PARTIAL PASS trên logic phân loại/hash/guard; PostgreSQL dry-run/apply/locking thật BLOCKED.**
- **Căn cứ:**
  - Logic phân loại 4 nhóm ứng viên (`EARLY_PROJECTION_AUTO_REPAIR`, `MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL`, `REPLAY_SHARED_SUCCESS_EVENT`, `MANUAL_REVIEW_UNSAFE_SOURCE`) và cơ chế chống stale bằng canonical snapshot hash đã được kiểm chứng tự động.
  - Replay chỉ được đề xuất khi durable success event tồn tại và chưa có Rental receipt; thiếu event hoặc receipt đã có nhưng projection thiếu đều chuyển sang manual review.
  - Script mặc định chạy ở chế độ chỉ đọc DRY-RUN, không tự ý sửa DB đang phục vụ người dùng.
  - Chưa chạy dry-run/apply trên database đang cấu hình và chưa chứng minh `SELECT ... FOR UPDATE` bằng race test PostgreSQL thật.

### Gate 4: Frontend Integration Readiness

- **Kết luận:** **Contract/read model sẵn sàng tích hợp; nghiệm thu/freeze tài chính trên Neon hiện tại BLOCKED.**
- **Căn cứ:**
  - Contracts cho FE đã được chốt và đồng bộ:
    - Admin simulate endpoint: `POST /api/v1/admin/payment-refunds/:refundId/sandbox-simulate-settlement`.
    - Admin inspect endpoint: `GET /api/v1/admin/payment-refunds/:refundId/sandbox-simulation`.
    - Trả về trường `settlementProcessingStatus` ('PENDING' hoặc 'APPLIED') để FE hiển thị tiến trình bất đồng bộ thay vì block giao diện.
    - USER endpoints: `GET /api/v1/rental-orders/:orderId/deposit` và `GET /api/v1/rental-orders/:orderId/payments` phản ánh đúng `financialEffect: 'CREDIT'` và cảnh báo `warnings: ['TEST_ONLY', 'NO_REAL_MONEY_RETURNED']`.
  - Mobile/FE không gọi trực tiếp hai Admin endpoints; Admin/operator dùng Swagger để trigger, còn FE bounded-poll hai USER endpoints.
  - Muốn nghiệm thu flow simulation phải chuyển sang PostgreSQL local cô lập trên loopback. Không nới guard để cho phép Neon hiện tại.
