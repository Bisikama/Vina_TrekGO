# VINA_TREKGO — RENTAL BUSINESS LOGIC UPDATE v1.2

**Ngày cập nhật:** 07/10/2026  
**Trạng thái:** Business logic change baseline  
**Phạm vi:** Rental / Inventory / Delivery; tích hợp Trip, Payment và Frontend  
**Mục tiêu:** Thay đổi điều kiện thuê từ Booking sang Trip membership và đưa gia hạn thuê ngoài thời gian Trip vào phạm vi nghiệp vụ.

## 1. Quyết định nghiệp vụ đã chốt

### DEC-RNT-01 — Quyền thuê dựa trên Trip membership, không dựa trên Booking
- USER không cần có Booking để mở luồng thuê.
- Điều kiện cốt lõi: USER phải là thành viên hợp lệ của Trip được chọn.
- Booking, nếu tồn tại với Public Trip, chỉ là dữ liệu nguồn/audit; không còn là nguồn quyền thuê của Rental.
- Private Trip và Public Trip phải đi qua cùng một contract `Trip Rental Context` để Rental không cần biết Trip được hình thành từ Booking hay Invite.
- Khi tạo quote/order, Backend phải recheck Trip membership + Trip context + rental cutoff; FE không tự suy diễn eligibility.

### DEC-RNT-02 — Rental có thể kéo dài sau khi Trip kết thúc
- Trip là **nguồn quyền thuê và ngữ cảnh khởi tạo**, không còn là giới hạn cứng của `rentalEndAt`.
- Mặc định thời gian thuê vẫn bám theo Trip; USER được chọn thời điểm trả muộn hơn nếu hệ thống có khả năng phục vụ.
- Sau khi order đã tạo/đã giao, USER có thể gửi yêu cầu gia hạn. Gia hạn không được sửa trực tiếp `rentalEndAt` mà phải qua một workflow có kiểm tra capacity, báo giá bổ sung, thanh toán và audit.
- Gia hạn do USER và Trip chính thức bị kéo dài là hai nghiệp vụ khác nhau.

## 2. Nguồn sự thật cho eligibility mới

### 2.1 Contract từ Area A / Trip
Rental gọi contract chỉ đọc theo `tripId + userId`. Contract tối thiểu nên trả:

```text
tripId
userId
membershipId / membershipRef
membershipStatus
membershipRole
tripStatus
tripStartAt
tripEndAt
plannedHandoverAt
plannedReturnAt
pickupPoint
baseReturnPoint
rentalCutoffAt
contextVersion
rentalEligible
ineligibleReason
```

### 2.2 Quy tắc eligibility
USER được tạo rental mới khi đồng thời thỏa:
1. Có membership hợp lệ trong Trip theo Area A.
2. Trip chưa ở trạng thái khiến Rental bị cấm (ví dụ đã hủy); quyết định cụ thể do `rentalEligible` từ Trip Context cung cấp.
3. Chưa quá `rentalCutoffAt` đối với **đơn thuê mới**.
4. Không có RentalOrder chưa kết thúc khác của cùng `userId + tripId` trong MVP.

**Lưu ý:** Sau khi RentalOrder đã ACTIVE, việc Trip chuyển COMPLETED không làm mất quyền giữ tài sản đang thuê. Các thao tác return/extension tiếp tục dựa trên RentalOrder hiện hữu.

## 3. Mô hình thời gian mới

Tách ba khái niệm, không dùng một cặp ngày cho tất cả:

| Khái niệm | Ý nghĩa |
|---|---|
| `tripStartAt/tripEndAt` | Lịch Trip; dùng cho membership/context và gợi ý |
| `rentalStartAt/rentalEndAt` | Thời gian USER được phép giữ/thuê; dùng để tính tiền |
| `occupiedFrom/occupiedUntil` | Khoảng capacity bị chiếm, gồm chuẩn bị + rental + thu hồi/vệ sinh |

Baseline mới:
- `rentalStartAt` mặc định từ `plannedHandoverAt`.
- `rentalEndAt` mặc định từ `plannedReturnAt`.
- USER có thể yêu cầu `rentalEndAt > plannedReturnAt` nếu Policy cho phép và có return option hợp lệ.
- Fee tính theo **thời lượng Rental**, không còn mặc định tính theo `tripEndAt - tripStartAt`.
- Buffer chỉ ảnh hưởng availability; không tự động làm tăng tiền thuê.

## 4. Hai cách kéo dài thời gian thuê

### 4.1 Chọn thời gian dài hơn ngay từ lúc tạo Rental
1. USER mở Rental từ Trip.
2. System trả Trip Context + thời điểm trả mặc định + các `returnOptions` có thể hỗ trợ.
3. USER chọn equipment, quantity và có thể chọn `requestedReturnAt` muộn hơn thời điểm trả Trip.
4. Quote tính lại `chargedDays`, fee và occupied window theo thời điểm USER chọn.
5. Create order giữ toàn bộ quantity trong occupied window mới theo transaction all-or-nothing.
6. Thanh toán thành công mới xác nhận order.

### 4.2 Gia hạn sau khi RentalOrder đã tồn tại
Gia hạn áp dụng **toàn bộ RentalOrder** trong MVP; không gia hạn riêng từng line/unit.

```text
USER chọn "Gia hạn"
  -> nhập/chọn requestedReturnAt + returnOption
  -> System kiểm tra state + deadline + policy
  -> tính newOccupiedUntil
  -> kiểm tra capacity trên phần thời gian tăng thêm
  -> tạo Extension Quote
  -> USER xác nhận
  -> System giữ capacity phần tăng thêm (TTL)
  -> nếu additionalFee > 0: thanh toán bổ sung
  -> payment success: apply extension
  -> cập nhật rentalEndAt / occupiedUntil / return task
  -> gửi notification + audit
```

Nếu bất kỳ product line nào không đủ capacity trong phần thời gian tăng thêm, **toàn bộ extension bị từ chối**; order cũ và dueAt cũ giữ nguyên.

## 5. Quản lý capacity khi gia hạn

Không kéo dài trực tiếp bản ghi reservation cũ theo kiểu mất lịch sử. Dùng reservation cycle:
- Cycle 1: reservation của order ban đầu.
- Cycle 2+: reservation cho phần thời gian tăng thêm của từng extension.
- Extension chỉ cần giữ delta window `[oldOccupiedUntil, newOccupiedUntil)`.
- HELD/CONFIRMED của extension phải tham gia cùng công thức availability với mọi order khác.
- Transaction phải recheck toàn bộ line và all-or-nothing.

Điểm này tận dụng được `RentalQuantityReservation.reservationCycle` hiện có.

## 6. Cách tính tiền gia hạn

Không tính `additionalFee = số giờ kéo dài × đơn giá` một cách độc lập vì sẽ sai với rule làm tròn ngày.

Công thức baseline:

```text
newChargedDays = policy.dayCount(rentalStartAt, requestedReturnAt)
newTotalLineFee = dailyPriceSnapshot × quantity × newChargedDays
additionalLineFee = max(0, newTotalLineFee - currentLineRentalFee)
additionalFee = sum(additionalLineFee)
```

Quy tắc:
- Dùng `dailyPriceSnapshot` và Policy snapshot của RentalOrder để tránh đổi giá giữa chừng.
- Cọc của cùng EquipmentUnit không tăng chỉ vì kéo dài thời gian trong MVP.
- Nếu `additionalFee = 0`, extension có thể apply sau capacity confirmation mà không mở payment mới.
- Nếu `additionalFee > 0`, chỉ apply sau khi Payment xác nhận thành công.
- Payment timeout/fail: release extension hold; `rentalEndAt` cũ không đổi.

## 7. State của yêu cầu gia hạn

Đề xuất entity `RentalExtensionRequest`:

```text
DRAFT/QUOTED
   -> PENDING_PAYMENT
   -> APPLIED

QUOTED/PENDING_PAYMENT
   -> EXPIRED
   -> CANCELLED
   -> REJECTED_CAPACITY
   -> PAYMENT_FAILED
```

Có thể rút gọn khi code, nhưng bắt buộc phân biệt:
- yêu cầu chưa áp dụng,
- capacity đang được giữ tạm,
- đã thanh toán nhưng chưa apply/reconcile,
- extension đã được áp dụng.

Mỗi RentalOrder chỉ có **một extension request chưa kết thúc** tại một thời điểm.

## 8. Điều kiện cho phép / từ chối gia hạn

Cho phép khi:
- Order thuộc USER.
- Order ở state Policy cho phép (khuyến nghị `PAID`, `PREPARING`, `READY_FOR_HANDOVER`, `ACTIVE`).
- Chưa bắt đầu return/return scan.
- Chưa quá thời điểm cho phép gửi extension request.
- `requestedReturnAt > currentRentalEndAt`.
- Không vượt giới hạn tổng thời gian thuê theo Policy.
- Có capacity cho tất cả lines trong delta window.
- Có return option hợp lệ cho thời điểm mới.

Không cho phép:
- Dùng extension để hợp thức hóa việc đã quá hạn. Khi quá `rentalEndAt`, đi vào overdue flow.
- Gia hạn sau khi đã trả một phần order trong MVP.
- Tự động chiếm capacity của order tương lai đã được xác nhận.

## 9. Return logistics khi thuê vượt Trip

Đây là thay đổi bắt buộc đi cùng gia hạn. Khi `rentalEndAt > plannedReturnAt`, không được giả định STAFF_DELIVERY vẫn có mặt ở điểm trả của Trip.

Baseline đề xuất:
- Backend trả `returnOptions[]` cho thời điểm USER muốn trả.
- Mỗi option chứa ít nhất `returnOptionId`, `point`, `timeWindow`, `method`, `available`.
- Chỉ cho quote/extension khi có return option được hỗ trợ.
- Khi extension APPLIED, System cập nhật hoặc tạo lại ReturnTask theo option mới và thông báo STAFF_DELIVERY.
- Nếu task cũ đã được claim/đang thực hiện, extension bị chặn hoặc chuyển `ACTION_REQUIRED`; không sửa âm thầm.

Không cần chốt ngay “cửa hàng” hay “nhân viên tới lấy”; `returnOption` là abstraction để sau này hỗ trợ cả hai.

## 10. Trip thay đổi và USER tự gia hạn là hai flow khác nhau

### USER-requested extension
- Có thể từ chối nếu thiếu capacity.
- Có thể phát sinh tiền bổ sung.
- Chỉ apply sau xác nhận/payment.

### Official Trip reschedule/extension
- Là event từ Area A.
- Nếu Trip mới kết thúc sau `rentalEndAt`, Rental phải cập nhật operational due time để USER không bị coi overdue trong lúc Trip còn diễn ra.
- Nếu gây conflict với future reservation, không thu hồi asset đang ở USER; đánh dấu `ACTION_REQUIRED` cho vận hành.
- Không tự charge USER. Nếu cần điều chỉnh tiền, tạo adjustment rõ ràng theo Policy/actor chịu trách nhiệm.

## 11. API contract vNext

### 11.1 Thay Booking-based eligibility bằng Trip-based eligibility

| Cũ | vNext |
|---|---|
| `GET /api/v1/bookings/:bookingId/rental-eligibility` | `GET /api/v1/trips/:tripId/rental-eligibility` |
| availability nhận `bookingId` | availability nhận `tripId` + optional requested return |
| quote body có `bookingId` | quote body có `tripId`, `requestedReturnAt?`, `returnOptionId?` |
| recommendations theo booking | recommendations theo trip |

Response eligibility nên trả `membershipRef`, Trip summary, cutoff, default rental window, `returnOptions` và `contextVersion`.

### 11.2 Extension APIs đề xuất

```text
POST /api/v1/rental-orders/:id/extension-quotes
  body: { requestedReturnAt, returnOptionId }

POST /api/v1/rental-orders/:id/extensions
  body: { extensionQuoteId, expectedVersion }
  -> giữ delta capacity all-or-nothing

POST /api/v1/rental-extensions/:extensionId/payments
  -> create/reuse additional payment

GET /api/v1/rental-orders/:id/extensions
  -> history + current extension state
```

Money/capacity mutation bắt buộc dùng `Idempotency-Key`; update state dùng `expectedVersion`.

## 12. Database impact đề xuất

### 12.1 RentalQuote / RentalOrder
Hiện tại schema đang ràng buộc `bookingId` và `BookingParticipant`. Baseline mới nên:
- `bookingId` -> nullable provenance hoặc bỏ hẳn khỏi Rental domain.
- thêm `tripMemberId`/`membershipRef` hoặc lưu `membershipSnapshot` + `userId + tripId`.
- `recipientParticipantId` -> thay bằng `recipientTripMemberId` hoặc `recipientUserId` + snapshot.
- `contextVersionSnapshot` trở thành Trip context version, không phải Booking context version.
- giữ `tripId` là bắt buộc.

Khuyến nghị an toàn cho migration: **giữ `bookingId?` nullable để audit các order cũ**, nhưng không dùng nó để authorize.

### 12.2 New entity
`RentalExtensionRequest` tối thiểu:

```text
id
orderId
previousRentalEndAt
requestedRentalEndAt
previousOccupiedUntil
requestedOccupiedUntil
returnOptionSnapshot
status
additionalFee
currency
policySnapshot / policyVersion
paymentExpiresAt?
appliedAt?
version
createdAt / updatedAt
```

Nếu cần audit tiền theo từng line, thêm `RentalExtensionLine`:
`extensionId, orderLineId, previousChargedDays, newChargedDays, additionalFee`.

### 12.3 Reservation
Giữ model `RentalQuantityReservation`; dùng `reservationCycle` cho extension. Không cần tạo exact unit reservation mới khi asset đã được handover.

## 13. Business rules vNext

- **RNT-BR-01:** Rental eligibility dựa trên Trip membership, không dựa trên Booking.
- **RNT-BR-02:** `bookingId`, nếu còn lưu, chỉ là provenance; không dùng authorize.
- **RNT-BR-03:** New rental phải recheck membership/context/cutoff ở quote, create order và payment apply.
- **RNT-BR-04:** Một USER có tối đa một RentalOrder non-terminal trên cùng Trip trong MVP.
- **RNT-BR-05:** Rental end có thể vượt Trip end nếu Policy + capacity + return option cho phép.
- **RNT-BR-06:** Extension là all-or-nothing cho toàn order trong MVP.
- **RNT-BR-07:** Extension capacity chỉ giữ phần delta window và phải atomic cho mọi line.
- **RNT-BR-08:** Không apply extension trước khi additional payment thành công, trừ khi additionalFee = 0.
- **RNT-BR-09:** Extension thất bại/hết TTL không thay dueAt cũ.
- **RNT-BR-10:** Không retroactive extension sau overdue; overdue flow xử lý riêng.
- **RNT-BR-11:** Return option là bắt buộc nếu thời điểm trả mới không còn nằm trong logistics window của Trip.
- **RNT-BR-12:** Official Trip extension không được tự charge; conflict với future order -> ACTION_REQUIRED.

## 14. Policy values cần chốt sau

Không hardcode trước khi nhóm chốt:
- `maxRentalAfterTripHours` — tối đa được giữ thiết bị sau Trip.
- `extensionRequestCutoffMinutes` — phải xin gia hạn trước dueAt bao lâu.
- `extensionHoldMinutes` — TTL giữ capacity chờ payment.
- return methods/options nào được hỗ trợ trong MVP.
- có cho extension nhiều lần hay chỉ một lần; nếu nhiều lần thì giới hạn theo tổng thời gian, không chỉ số lần.

## 15. Acceptance criteria bắt buộc

1. USER có Trip membership hợp lệ nhưng không có Booking vẫn xem catalog, quote và tạo RentalOrder được.
2. USER không thuộc Trip không tạo quote/order bằng cách biết `tripId`.
3. Private Trip và Public Trip dùng cùng Rental eligibility contract.
4. Rental có `rentalEndAt > tripEndAt` chỉ thành công nếu capacity và return option hợp lệ.
5. Hai USER cạnh tranh capacity ở extension không thể làm tổng reservation vượt capacity.
6. Extension payment timeout không thay dueAt và phải release delta reservation đúng một lần.
7. Extension applied cập nhật order, reservation cycle, return task và timeline atomically/idempotently.
8. Gia hạn bị từ chối không ảnh hưởng order đang thuê.
9. Quá hạn không thể bấm gia hạn để xóa trạng thái overdue.
10. Trip chính thức kéo dài không làm asset đang ở USER bị thu hồi tự động; conflict tương lai được đưa vào ACTION_REQUIRED.

## 16. Tài liệu/contract phải đồng bộ khi merge change này

- Business Flow Rental: bump `v1.1 -> v1.2`.
- Policy Area B: bump `v1.3 -> v1.4`; thay RB-TBD-12 và cách tính phí theo rental window.
- Functional Requirements: bump `v1.1 -> v1.2`; đổi API/DTO/error/screen từ booking context sang trip context và thêm extension phase.
- `CONSTRAINTS_FINAL_FLOW.md`: thay eligibility và extension constraints.
- `schema.prisma`: tách Rental khỏi `bookingId` bắt buộc; thêm extension entity.
- OpenAPI + FE mock pack: breaking contract version; regenerate cùng lúc sau khi API vNext được chốt.
