# Area B - B1 Freeze

## Trạng thái

**B1 = ĐÃ CHỐT**

**Phiên bản mốc:**

`area-b-b1-v1.0.0`

**Trạng thái phát triển:**

- `B1_FREEZE_FOR_B2 = YES`
- `B1_INTEGRATION_READY = NO`

> `B1_INTEGRATION_READY = NO` không chặn việc phát triển B2. Lý do là hợp đồng lấy ngữ cảnh thuê từ Mảng A chưa được tích hợp chính thức; hiện Mảng B vẫn dùng `PrismaRentalContextAdapter` — bộ chuyển tiếp Prisma tạm thời.

---

## 1. Phạm vi B1

B1 triển khai 4 API chính:

| Mã API | API | Mục đích |
|---|---|---|
| `RB-API-101` | `GET /api/v1/bookings/:bookingId/rental-eligibility` | Kiểm tra Booking/Trip có đủ điều kiện thuê hay không |
| `RB-API-102` | `GET /api/v1/rentals/availability` | Tính số lượng thiết bị khả dụng theo khoảng thời gian chiếm dụng |
| `RB-API-103` | `POST /api/v1/rentals/quote` | Tạo báo giá thuê thiết bị |
| `RB-API-104` | `GET /api/v1/bookings/:bookingId/rental-recommendations` | Gợi ý thiết bị phù hợp với chuyến đi |

B1 kết thúc tại:

```text
RentalQuote
```

B1 **không thực hiện**:

- tạo `RentalOrder` — đơn thuê thiết bị;
- tạo `RentalOrderLine` — dòng sản phẩm trong đơn thuê;
- tạo `RentalQuantityReservation` — bản ghi giữ số lượng;
- giữ tồn thiết bị;
- chọn `EquipmentUnit` — thiết bị vật lý cụ thể;
- tạo thanh toán;
- xử lý thanh toán;
- tạo nhiệm vụ kho;
- gắn thiết bị cụ thể cho đơn thuê.

---

## 2. Các quy tắc nghiệp vụ đã chốt

### 2.1 Điều kiện thuê

- Thuê thiết bị bắt buộc phải có Booking/Trip hợp lệ.
- Người gọi API phải là chủ Booking tương ứng.
- Booking tồn tại nhưng không đủ điều kiện nghiệp vụ có thể trả `200` với `eligible = false`.
- `contextVersion` — phiên bản ngữ cảnh Booking/Trip — phải được tách biệt với `policyVersion` — phiên bản chính sách thuê.
- Không dùng số lượng người tham gia làm giới hạn số lượng thiết bị được thuê.
- Người dùng được thuê số lượng nguyên dương bất kỳ miễn còn đủ số lượng khả dụng và thanh toán đầy đủ.

### 2.2 Khoảng chiếm dụng thiết bị

Khoảng tính tiền và khoảng chiếm dụng thiết bị là hai khái niệm khác nhau.

Khoảng chiếm dụng được xác định theo chính sách:

```text
occupiedFrom
=
plannedHandoverAt
-
preparationBuffer

occupiedUntil
=
plannedReturnAt
+
returnTransportBuffer
+
cleaningBuffer
```

Các khoảng đệm chỉ dùng để giữ sức chứa thiết bị, không tự làm tăng số ngày tính tiền.

### 2.3 Báo giá

`RentalQuote` — báo giá thuê — phải:

- có thời hạn sử dụng;
- lưu `contextVersion`;
- lưu phiên bản/chụp chính sách;
- lưu giá thuê tại thời điểm báo giá;
- lưu tiền cọc tại thời điểm báo giá;
- lưu số ngày tính phí;
- lưu người nhận nếu có;
- tính tiền ở Backend;
- không tin giá hoặc số ngày tính phí do Frontend gửi lên.

Báo giá **không giữ số lượng thiết bị**.

Báo giá **không chọn thiết bị vật lý cụ thể**.

Báo giá **không tạo RentalOrder**.

### 2.4 Gợi ý thiết bị

Gợi ý thiết bị chỉ dùng để:

- xếp hạng;
- giải thích;
- hỗ trợ người dùng chọn sản phẩm.

Điểm gợi ý không được quyết định:

- quyền thuê;
- số lượng khả dụng;
- giá;
- tiền cọc;
- số lượng được phép thuê.

Phiên bản hiện tại có thể hoạt động hoàn toàn bằng `RULE` — luật gợi ý cố định của hệ thống. AI chỉ là phần mở rộng tùy chọn.

---

## 3. Các vấn đề B1 đã phát hiện và xử lý

### 3.1 `contextVersion` từng bị nhầm với `policyVersion`

**Vấn đề**

Ban đầu có nguy cơ dùng phiên bản chính sách làm `contextVersion`.

**Đã xử lý**

Hai khái niệm được tách riêng:

```text
contextVersion
= phiên bản ngữ cảnh Booking / Trip

policyVersion
= phiên bản chính sách Rental
```

**Trạng thái**

`ĐÃ XỬ LÝ`

---

### 3.2 API 102 từng chỉ tính tồn theo trạng thái EquipmentUnit

**Vấn đề**

Cách tính cũ chỉ lấy tổng `EquipmentUnit` rồi trừ `RentalQuantityReservation`, chưa bảo vệ đầy đủ các trường hợp:

- thiết bị đã được chọn cho đơn;
- thiết bị trả trễ;
- thiết bị vẫn đang vệ sinh;
- nguy cơ trừ hai lần cùng một cam kết.

**Đã xử lý**

Logic khả dụng được tách thành ba lớp:

```text
1. usablePhysicalCapacity
   = sức chứa vật lý cơ sở

2. reservedQuantity
   = số lượng đang được giữ bởi Reservation hợp lệ và chồng thời gian

3. additionalBlockedUnitCount
   = thiết bị bị chặn vật lý nhưng chưa được Reservation chồng thời gian đại diện
```

Công thức cuối:

```text
availableCount
=
max(
  0,
  usablePhysicalCapacity
  - reservedQuantity
  - additionalBlockedUnitCount
)
```

**Trạng thái**

`ĐÃ XỬ LÝ`

---

### 3.3 Lỗi trừ hai lần cùng một cam kết

**Vấn đề**

Nếu một Order đã có:

```text
RentalQuantityReservation = 2
```

và Kho đã chọn:

```text
U1
U2
```

thì không được tính:

```text
10
- 2 do Reservation
- 2 do Assignment
= 6
```

vì cùng một cam kết bị trừ hai lần.

**Đã xử lý**

Thiết bị đã được một `RentalQuantityReservation CONFIRMED` đang chồng thời gian đại diện sẽ không bị trừ thêm ở phần thiết bị vật lý bị chặn.

Ví dụ:

```text
Tổng sức chứa = 10
Reservation CONFIRMED = 2
Đã pick U1, U2

availableCount = 10 - 2 = 8
```

**Trạng thái**

`ĐÃ XỬ LÝ`

---

### 3.4 Pick một phần không được làm giảm tồn sai

Ví dụ:

```text
Tổng sức chứa = 10

Reservation CONFIRMED
quantity = 3

Kho mới pick:
U1
U2
```

Kết quả đúng:

```text
availableCount = 10 - 3 = 7
```

Không được:

```text
10 - 3 - 2 = 5
```

**Trạng thái**

`ĐÃ XỬ LÝ`

---

### 3.5 Thiết bị trả trễ từng có nguy cơ bị coi là khả dụng

**Vấn đề**

Nếu khoảng giữ cũ đã hết nhưng thiết bị vật lý vẫn đang:

- `RENTED`;
- `RETURN_PENDING`;

thì Reservation cũ có thể không còn chồng thời gian với chuyến mới.

Nếu chỉ dựa vào Reservation, hệ thống có thể tưởng thiết bị đã quay về kho.

**Đã xử lý**

Thiết bị vẫn bị chặn vật lý nhưng không còn Reservation chồng thời gian đại diện sẽ được tính vào:

```text
additionalBlockedUnitCount
```

Ví dụ:

```text
Tổng sức chứa = 10
Reservation cũ không còn overlap
U1 vẫn RENTED

availableCount = 9
```

**Trạng thái**

`ĐÃ XỬ LÝ`

---

### 3.6 Thiết bị đang `CLEANING` — đang vệ sinh

**Vấn đề**

Thiết bị đang vệ sinh không được coi là sẵn sàng một cách máy móc.

Tuy nhiên, nếu `cleaningBuffer` vẫn nằm trong Reservation hiện hành thì cũng không được trừ thiết bị đó thêm lần nữa.

**Đã xử lý**

Hai trường hợp được phân biệt:

```text
CLEANING + Reservation CONFIRMED overlap
→ chỉ bị trừ bởi Reservation
→ không trừ lần hai.

CLEANING + không còn Reservation overlap
→ block vật lý
→ giảm availability.
```

**Trạng thái**

`ĐÃ XỬ LÝ`

---

### 3.7 Thiết bị hỏng, mất, bảo trì hoặc ngừng sử dụng

Các trạng thái sau làm giảm sức chứa vật lý trực tiếp:

```text
MAINTENANCE
DAMAGED
LOST
RETIRED
```

Condition — tình trạng thiết bị:

```text
DAMAGED
LOST
```

cũng bị loại khỏi sức chứa vật lý.

Logic chặn bổ sung phải dùng cùng điều kiện để tránh trừ cùng một thiết bị hai lần.

**Trạng thái**

`ĐÃ XỬ LÝ`

---

### 3.8 `REPLACED` / `UNASSIGNED` không được dùng để che thiết bị bị chặn

`REPLACED` — thiết bị đã được thay thế.

`UNASSIGNED` — thiết bị đã bị bỏ gắn khỏi dòng đơn thuê.

Hai trạng thái này không được dùng làm bằng chứng rằng một Reservation hiện tại vẫn đại diện cho thiết bị đó.

**Trạng thái**

`ĐÃ XỬ LÝ`

---

### 3.9 `HELD` không được dùng để chứng minh thiết bị vật lý đã được chọn

`HELD` — đang giữ số lượng tạm thời trong lúc chờ thanh toán.

`CONFIRMED` — số lượng đã được xác nhận sau thanh toán.

Thiết bị vật lý cụ thể chỉ được Kho chọn sau giai đoạn thanh toán.

Vì vậy:

```text
Tính reservedQuantity:
HELD còn TTL
+
CONFIRMED
```

Nhưng khi kiểm tra một `EquipmentUnit` đã được Reservation đại diện để tránh trừ hai lần:

```text
chỉ dùng Reservation CONFIRMED
```

**Trạng thái**

`ĐÃ XỬ LÝ`

---

## 4. Quy tắc cuối của API 102

### Bước 1 — Tính sức chứa vật lý

Loại:

```text
status:
MAINTENANCE
DAMAGED
LOST
RETIRED

condition:
DAMAGED
LOST
```

### Bước 2 — Tính số lượng đã được giữ

Chỉ tính Reservation thỏa:

```text
CONFIRMED
```

hoặc:

```text
HELD
AND holdExpiresAt > now
```

và chồng thời gian:

```text
existing.occupiedFrom < requested.occupiedUntil
AND
existing.occupiedUntil > requested.occupiedFrom
```

### Bước 3 — Tính thiết bị bị chặn bổ sung

Xét các trạng thái vật lý chưa sẵn sàng như:

```text
PICKED
PACKED
RENTED
RETURN_PENDING
CLEANING
```

Nếu thiết bị chưa được một Reservation `CONFIRMED` đang chồng thời gian đại diện thì thiết bị đó làm giảm khả dụng.

### Bước 4 — Kết quả

```text
availableCount
=
max(
  0,
  usablePhysicalCapacity
  - reservedQuantity
  - additionalBlockedUnitCount
)
```

API 102 vẫn chỉ là snapshot — ảnh chụp số lượng khả dụng tại thời điểm kiểm tra.

Nó **không giữ hàng**.

---

## 5. Kiểm tra kỹ thuật trước khi chốt

Kết quả kiểm tra cuối:

```text
BUILD = PASS
TEST = PASS
AVAILABILITY_CONTRACT = PASS
DOUBLE_SUBTRACTION_PREVENTED = YES
LATE_RETURN_PROTECTED = YES
CLEANING_PROTECTED = YES
B1_FREEZE_FOR_B2 = YES
```

Điều này xác nhận B1 đủ điều kiện làm nền cho B2.

---

## 6. Ranh giới B1 -> B2

### B1 kết thúc tại

```text
RentalQuote
```

### B2 bắt đầu từ

```text
RentalQuote
    ↓
Kiểm tra Quote còn hạn
    ↓
Đọc lại Rental Context
    ↓
Kiểm tra contextVersion
    ↓
Kiểm tra Booking vẫn hợp lệ
    ↓
Kiểm tra một open order / Booking
    ↓
Kiểm tra lại availability
    ↓
Giao dịch cơ sở dữ liệu nguyên tử
    ↓
Tạo RentalOrder
    ↓
Tạo RentalOrderLine
    ↓
Tạo RentalQuantityReservation = HELD
    ↓
PENDING_PAYMENT
```

B2 phải tái kiểm tra khả dụng bên trong giao dịch cơ sở dữ liệu nguyên tử để chống hai người cùng giữ số lượng tại cùng thời điểm.

B1 chỉ cung cấp snapshot.

---

## 7. Nợ kỹ thuật tạm thời

### 7.1 Area A Rental Context

Hiện tại:

```text
PrismaRentalContextAdapter
```

đang đóng vai trò bộ chuyển tiếp tạm thời để lấy Booking/Trip context trực tiếp từ database.

Đây là nợ kỹ thuật vì Mảng A chưa cung cấp hợp đồng nội bộ chính thức.

Mục tiêu sau này:

```http
GET /internal/bookings/:bookingId/rental-context
```

Khi Mảng A cung cấp hợp đồng:

```text
PrismaRentalContextAdapter
        ↓
HttpRentalContextAdapter
```

Các Use Case — ca sử dụng ứng dụng — của B1/B2 không được phải thay đổi.

---

### 7.2 `contextVersion`

`contextVersion` phải đại diện cho phiên bản ngữ cảnh ảnh hưởng việc thuê, ví dụ:

- trạng thái Booking;
- Trip bị đổi lịch;
- thời gian giao/trả;
- người nhận;
- participant;
- điểm giao;
- context khác ảnh hưởng Rental.

Hiện việc lấy `contextVersion` vẫn phụ thuộc implementation tạm cho đến khi Mảng A sở hữu hợp đồng rental-context chính thức.

---

### 7.3 Vòng đời `RentalQuantityReservation -> CLOSED`

Source hiện tại chưa hoàn tất toàn bộ luồng thực tế chuyển:

```text
CONFIRMED
→
CLOSED
```

ở giai đoạn trả thiết bị/kết thúc vòng đời.

Điểm này **không chặn B1**, vì B1 đã có cơ chế bảo vệ thiết bị trả trễ và thiết bị chưa sẵn sàng.

Tuy nhiên khi triển khai các phase sau, vòng đời này phải được hoàn thiện theo Business Flow và Functional Requirements.

---

## 8. Những điều không được thay đổi sau khi chốt B1

Sau khi B1 đã chốt:

### Được phép

- sửa lỗi;
- thêm kiểm thử;
- cải thiện comment;
- refactor nội bộ nếu không đổi hành vi;
- tối ưu câu truy vấn nếu kết quả nghiệp vụ không đổi.

### Không được tự ý

- thay route;
- đổi request DTO;
- đổi response DTO;
- đổi HTTP status;
- bỏ field đã chốt;
- đổi nghĩa `contextVersion`;
- thêm participant quota;
- cho Quote giữ quantity;
- chọn exact `EquipmentUnit` ở B1;
- chuyển logic giữ hàng của B2 ngược về B1.

---

## 9. Chính sách thay đổi contract

Nếu có thay đổi phá vỡ tương thích API:

```text
breaking change
= thay đổi làm Frontend/consumer cũ không còn dùng API như trước
```

thì bắt buộc:

1. tăng `contractVersion`;
2. cập nhật OpenAPI;
3. cập nhật fixture/mock;
4. cập nhật mapping Frontend;
5. ghi rõ API/màn hình bị ảnh hưởng;
6. review lại trước khi merge.

Sau thay đổi contract cần sinh lại:

```bash
npm run openapi:generate
```

và kiểm tra:

```bash
git diff -- contracts/openapi/openapi.json
```

---

## 10. Trạng thái cuối cùng

```text
AREA B - B1

RB-API-101 = FROZEN
RB-API-102 = FROZEN
RB-API-103 = FROZEN
RB-API-104 = FROZEN

BUILD = PASS
TEST = PASS

B1_FREEZE_FOR_B2 = YES
B1_INTEGRATION_READY = NO
```

### Kết luận

B1 đã hoàn tất phạm vi:

```text
Eligibility
→ Availability
→ Quote
→ Recommendations
```

và đã xử lý các vấn đề quan trọng:

```text
không quota theo participant
không giữ quantity trong quote
không chọn exact unit trước kho
không double subtraction
không bỏ sót late return
không coi CLEANING là sẵn sàng sai
không để thiết bị hỏng/mất/bảo trì làm tăng capacity
```

B1 được dùng làm baseline — mốc chuẩn — để bắt đầu B2.

---

## 11. Nguồn đối chiếu

B1 được triển khai và chốt dựa trên:

- `TrekGo_Area_B_Functional_Requirements_Unified_v1.1.docx`
- `TrekGo_Area_B_Policy_Unified_v1.3.docx`
- `TrekGo_Rental_Return_Business_Flow_Unified_v1.1.docx`
- `CONSTRAINTS_FINAL_FLOW.md`
- `MIGRATION_FROM_0.1.0.md`
- `schema.prisma`
- kiến trúc lục giác hiện tại của TrekGo

Thứ tự ưu tiên khi có xung đột:

```text
Business Flow
→ Policy
→ Functional Requirements
→ Source implementation
```

Không dùng mock/tài liệu lịch sử để ghi đè business rule của bộ tài liệu Unified hiện tại.
