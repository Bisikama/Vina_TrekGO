# TREKGO - AREA B FUNCTIONAL REQUIREMENTS

**Rental / Inventory / Warehouse / Logistics**

**Owner:** Quân (Backend) & Nguyên (Frontend) | *Theo template Mảng A Booking*

---

## 1. MỤC ĐÍCH TÀI LIỆU

Tài liệu này đặc tả Functional Requirement cho mảng thuê trang thiết bị của TrekGo dựa trên swimlane Rental End-to-End. Nó là nền để nhóm vẽ Use Case, Activity/Sequence/State Diagram, ERD, thiết kế API Backend/Frontend và chia task triển khai.

Mảng B chịu trách nhiệm từ Rental Product $\rightarrow$ kiểm tra điều kiện Booking $\rightarrow$ kiểm tra availability $\rightarrow$ Rental Order/Payment $\rightarrow$ reserve Equipment Unit $\rightarrow$ Staff Kho chuẩn bị $\rightarrow$ Staff Logistics giao tại điểm tập trung $\rightarrow$ thu hồi/inspection $\rightarrow$ hoàn hoặc trừ cọc $\rightarrow$ cập nhật lại trạng thái thiết bị. Tài liệu tách rõ API độc lập của Rental và API/Event cross-domain cần họp với Booking/Payment/GPS trước khi code.

---

## 2. PHẠM VI DOMAIN & OWNERSHIP

| Domain / Entity | Owner chính | Mảng B được phép làm gì | Mảng khác được phép làm gì |
| :--- | :--- | :--- | :--- |
| **RentalProduct / Category** | Quân | CRUD catalog thiết bị thuê, giá/ngày, cọc, ảnh, active status. | Consume catalog; không sửa trực tiếp. |
| **EquipmentUnit** | Quân | CRUD unit vật lý, QR/code, condition, lifecycle status, maintenance. | GPS/Booking không sửa trạng thái unit. |
| **RentalOrder / RentalOrderLine** | Quân | Tạo đơn thuê, quote, trạng thái thuê, liên kết Booking. | Booking chỉ cung cấp context; không sửa Rental Order. |
| **EquipmentReservation** | Quân | Giữ unit theo time window, chống overlap/double-book. | Booking/Trip chỉ phát event đổi lịch/hủy. |
| **WarehouseTask / Package** | Quân | Tạo task kho, pick, condition snapshot, pack, ready, custody. | Staff Kho thao tác qua API mảng B. |
| **LogisticsTask / Handover / ReturnInspection** | Quân | Task giao/thu hồi, scan, handover, inspection sơ bộ. | Booking cung cấp pickup/dropoff; không sửa task. |
| **Booking / Trip Context** | Bảo - Mảng A | B cung cấp contract read-only để B Rental consume. | Mảng B không query/sửa trực tiếp business state Booking/Trip. |
| **Payment / Refund** | Shared/Integration | Rental gọi service thanh toán và nhận callback normalized. | Payment không tự quyết inventory/rental lifecycle. |

---

## 3. ROLE LIÊN QUAN TRONG MẢNG B

| Role | Quyền chính trong mảng Rental |
| :--- | :--- |
| **User** | Xem thiết bị; chọn thiết bị theo Booking; tạo Rental Order; thanh toán; xem trạng thái; hủy theo policy; xác nhận tình trạng khi nhận; xem kết quả cọc. |
| **Staff Kho** | Quản lý Equipment Unit; xem work queue; pick; chụp condition trước giao; pack; mark ready; nhận lại thiết bị; maintenance/finalize trạng thái. |
| **Staff Logistics** | Nhận package từ kho; tới điểm tập trung; xác minh User/Booking; giao thiết bị; thu hồi; kiểm tra ngoại quan; bàn giao lại cho kho. |
| **Admin** | Xem report/giám sát; cấu hình rental policy; không trực tiếp thao tác nhập/xuất hàng thường ngày. |
| **System** | Kiểm tra availability, reserve/release, tạo task, xử lý payment event, deposit settlement, notification. |

---

## 4. THUẬT NGỮ & MÔ HÌNH NGHIỆP VỤ CỐT LÕI

| Thuật ngữ | Định nghĩa dùng trong code/tài liệu |
| :--- | :--- |
| **Rental Product** | Loại sản phẩm cho thuê: lều, gậy, balo... chứa giá thuê/ngày, deposit policy và metadata. |
| **Equipment Unit** | Một thiết bị vật lý cụ thể có `assetCode`/QR riêng, condition và lifecycle riêng. |
| **Rental Order** | Đơn thuê của User, bắt buộc gắn Booking/Trip hợp lệ. |
| **Reservation** | Bản ghi giữ Equipment Unit trong khoảng thời gian Trip để chống double-book. |
| **Warehouse Task** | Nhiệm vụ Staff Kho chuẩn bị Rental Order đã thanh toán. |
| **Package** | Gói thiết bị đã pick/pack, có `packageCode`/QR và chứa exact Equipment Units. |
| **Logistics Task** | Nhiệm vụ Staff Logistics giao/thu hồi thiết bị theo Trip + Pickup/Drop-off. |
| **Condition Snapshot** | Bằng chứng tình trạng thiết bị trước khi giao và sau khi thu hồi. |
| **Deposit Settlement** | Kết quả hoàn cọc đầy đủ / khấu trừ / giữ cọc theo inspection và policy. |

---

## 5. STATE MODEL BASELINE

| Entity | State đề xuất cho MVP | Ghi chú |
| :--- | :--- | :--- |
| **Rental Order** | `DRAFT/QUOTE` $\rightarrow$ `PENDING_PAYMENT` $\rightarrow$ `PAID` $\rightarrow$ `PREPARING` $\rightarrow$ `READY_FOR_HANDOVER` $\rightarrow$ `ACTIVE` $\rightarrow$ `RETURN_PENDING` $\rightarrow$ `INSPECTED` $\rightarrow$ `COMPLETED` \| `CANCELLED` \| `EXPIRED` | State phải enforce bằng service. |
| **Equipment Unit** | `AVAILABLE` $\rightarrow$ `RESERVED` $\rightarrow$ `PICKED` $\rightarrow$ `PACKED` $\rightarrow$ `RENTED` $\rightarrow$ `RETURN_PENDING` $\rightarrow$ `AVAILABLE` \| `MAINTENANCE` \| `DAMAGED` \| `LOST` | Không set status tùy ý. |
| **Warehouse Task** | `OPEN` $\rightarrow$ `PICKING` $\rightarrow$ `CONDITION_CAPTURED` $\rightarrow$ `PACKED` $\rightarrow$ `READY` $\rightarrow$ `TRANSFERRED` $\rightarrow$ `CLOSED` | Created sau payment success. |
| **Logistics Task** | `SCHEDULED` $\rightarrow$ `PACKAGE_RECEIVED` $\rightarrow$ `USER_VERIFIED` $\rightarrow$ `HANDED_OVER` $\rightarrow$ `RETURN_DUE` $\rightarrow$ `RETURNED` $\rightarrow$ `CLOSED` \| `NO_SHOW` | Mobile only. |
| **Payment** | `PENDING` $\rightarrow$ `SUCCESS` \| `FAILED` $\rightarrow$ `REFUNDED` \| `PARTIAL_REFUND` | Payment service normalized. |
| **Deposit** | `HELD` $\rightarrow$ `REFUND_PENDING` $\rightarrow$ `REFUNDED` \| `PARTIAL_REFUND` \| `FORFEITED` | Settlement immutable. |

---

## 6. PHASE 0 - RENTAL CATALOG / EQUIPMENT MASTER / INVENTORY

Đây là nhóm API CRUD độc lập nhất của mảng B. Nên hoàn thiện trước order flow vì các phase sau phụ thuộc trực tiếp dữ liệu thiết bị.

### 6.1. Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-FR-001** | Manage Rental Product | P0 | Staff Kho/Admin | Đăng nhập đúng role | Tạo/sửa/deactivate Rental Product; quản lý category, dailyPrice, deposit policy, image và thông tin sử dụng. | Catalog sẵn sàng cho User. | Không có `canSell`/`salePrice` vì MVP chỉ cho thuê. |
| **RB-FR-002** | Manage Equipment Unit | P0 | Staff Kho | Có Rental Product | Tạo/sửa metadata từng Equipment Unit với `assetCode`/QR unique, condition và initial status `AVAILABLE`. | Unit xuất hiện trong inventory. | Không hard delete unit có history. |
| **RB-FR-003** | View Inventory | P0 | Staff Kho/Admin | Có quyền | List/filter Equipment Unit theo product/status/condition/code; hiển thị count tổng hợp. | Staff thấy tồn kho thực. | Admin read-only ở nghiệp vụ vận hành. |
| **RB-FR-004** | Maintenance | P1 | Staff Kho | Unit không active rental | Đưa unit vào `MAINTENANCE`, lưu reason/note; restore `AVAILABLE` khi hoàn tất. | Unit bị loại khỏi availability. | Không maintenance unit đang `RENTED`. |
| **RB-FR-005** | Condition History | P0 | Staff Kho | Unit tồn tại | Xem lịch sử condition, rental, inspection, maintenance của từng unit. | Trace được vòng đời tài sản. | History immutable. |

### 6.2. API Specifications

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-API-001** | `GET /api/v1/rental-products` | Public/User | List/search thiết bị thuê | `search`, `categoryId`, `page` | `items`, `availabilitySummary` | Chỉ `ACTIVE`; pagination. |
| **RB-API-002** | `GET /api/v1/rental-products/:id` | Public/User | Product detail | `productId` | `product`, `price`, `depositPolicy` | 404 nếu không tồn tại/inactive theo role. |
| **RB-API-003** | `POST /api/v1/staff/rental-products` | Staff Kho/Admin | Create product | `name`, `sku`, `categoryId`, `dailyPrice`, `deposit` | `product` | SKU unique; price/deposit hợp lệ. |
| **RB-API-004** | `PATCH /api/v1/staff/rental-products/:id` | Staff Kho/Admin | Update product | allowed fields | `updated product` | Không sửa inventory bằng API này. |
| **RB-API-005** | `PATCH /api/v1/staff/rental-products/:id/status` | Staff Kho/Admin | Activate/deactivate | `status` | `updated status` | Soft status change. |
| **RB-API-006** | `GET /api/v1/staff/equipment-units` | Staff Kho/Admin | Inventory list | `productId`, `status`, `condition`, `q` | `units`, `counts` | Role/filters/pagination. |
| **RB-API-007** | `POST /api/v1/staff/equipment-units` | Staff Kho | Create unit | `productId`, `assetCode`, `condition` | `unit` | `assetCode` unique. |
| **RB-API-008** | `GET /api/v1/staff/equipment-units/:id` | Staff Kho/Admin | Unit detail/history | `unitId` | `unit` + `history` | 404/role. |
| **RB-API-009** | `PATCH /api/v1/staff/equipment-units/:id` | Staff Kho | Update unit metadata | allowed metadata | `unit` | Không bypass lifecycle status. |
| **RB-API-010** | `POST /api/v1/staff/equipment-units/:id/maintenance` | Staff Kho | Start/end maintenance | `action`, `reason`, `note` | `unit status/history` | 409 nếu đang active rental. |

---

## 7. PHASE 1 - USER CHỌN THIẾT BỊ / KIỂM TRA ĐIỀU KIỆN THUÊ

Theo swimlane, User mở chức năng thuê $\rightarrow$ System kiểm tra Booking/Trip hợp lệ $\rightarrow$ hiển thị thiết bị khả dụng $\rightarrow$ User chọn số lượng $\rightarrow$ System kiểm tra giới hạn và availability.

### 7.1. Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-FR-101** | Validate Rental Eligibility | P0 | System/User | User chọn Booking | Rental chỉ được tiếp tục khi Booking/Trip hợp lệ, thuộc User và còn trong thời gian cho phép thuê. | User đủ điều kiện mới vào rental flow. | Cross-domain với Booking. |
| **RB-FR-102** | Availability By Booking | P0 | User/System | Booking hợp lệ | Tính số unit khả dụng theo Trip date window, loại `RESERVED`/`RENTED`/`MAINTENANCE`/`LOST` và reservation overlap. | User thấy availability thật. | Không dùng stock quantity giả. |
| **RB-FR-103** | Quantity / Policy Validation | P0 | System | User chọn qty | Validate $\text{qty} > 0$, max allowed, availability và rental cutoff. | Selection hợp lệ. | Max quantity policy có thể config. |
| **RB-FR-104** | Rental Quote | P0 | System/User | Selection hợp lệ | Tính `rentalFee` + `deposit` dựa trên Trip dates và policy snapshot; trả preview chưa tạo order. | User thấy tổng tiền. | Amount do server tính. |

### 7.2. API Specifications

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-API-101** | `GET /api/v1/bookings/:bookingId/rental-eligibility` | User | Kiểm tra được thuê hay không | `bookingId` | `eligible`, `reason`, `rentalWindow` | Mảng B gọi Booking Context nội bộ; không query Booking DB. |
| **RB-API-102** | `GET /api/v1/rentals/availability` | User | Availability theo Booking | `bookingId`, `productId`, `quantity?` | `availableCount`, `rentalWindow` | 409/422 nếu Booking invalid. |
| **RB-API-103** | `POST /api/v1/rentals/quote` | User | Tính quote | `bookingId`, `items[]` | `rentalFee`, `deposit`, `chargedDays`, `expiresAt` | Server-side pricing; quote có TTL. |

---

## 8. PHASE 2 - RENTAL ORDER / RESERVATION / PAYMENT

Order chỉ được tạo sau khi quote hợp lệ. Backend phải reserve Equipment Unit atomically để tránh hai User thuê cùng một thiết bị trong cùng time window.

### 8.1. Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-FR-201** | Create Rental Order | P0 | User | Quote còn hiệu lực | Tạo Rental Order `PENDING_PAYMENT`, snapshot giá/policy và liên kết Booking/Trip. | Order tồn tại. | Không tạo nếu Booking invalid. |
| **RB-FR-202** | Reserve Equipment Units | P0 | System | Create order | Chọn exact Equipment Units khả dụng và tạo reservation theo date window trong transaction. | Units `RESERVED`. | Concurrency bắt buộc. |
| **RB-FR-203** | Rental Payment | P0 | User/System | Order `PENDING_PAYMENT` | Tạo payment intent cho rental fee + deposit; success $\rightarrow$ `PAID`; failed/expired $\rightarrow$ xử lý release theo policy. | Payment state đồng bộ. | Cross-domain Payment. |
| **RB-FR-204** | Cancel Before Handover | P0 | User/System | Order chưa handed over | Cho hủy theo trạng thái/policy; release reservation và refund nếu cần. | Order `CANCELLED`. | Không release unit đang `ACTIVE`. |
| **RB-FR-205** | Payment Timeout | P0 | System | Order chưa thanh toán quá TTL | Expire order và release reservation idempotently. | Không giữ tồn kho ảo. | Job retry an toàn. |

### 8.2. API Specifications

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-API-201** | `POST /api/v1/rental-orders` | User | Create order | `bookingId`, `quoteId/items` | `orderId`, `status`, `amount`, `reservations` | Transaction; 409 nếu race mất availability. |
| **RB-API-202** | `GET /api/v1/rental-orders` | User | My rental orders | `status`, `bookingId`, `page` | `orders` | Ownership. |
| **RB-API-203** | `GET /api/v1/rental-orders/:id` | User/Staff | Rental order detail | `orderId` | `order/items/payment/deposit/timeline` | Role/ownership. |
| **RB-API-204** | `POST /api/v1/rental-orders/:id/payments` | User | Create payment | `idempotencyKey` | `paymentIntent/status` | Only `PENDING_PAYMENT`. |
| **RB-API-205** | `POST /api/v1/rental-orders/:id/cancel` | User/System | Cancel order | `reason` | `order/refund/release result` | State/policy guard. |
| **RB-API-206** | `GET /api/v1/rental-orders/:id/payment` | User | Payment status | `orderId` | `normalized payment state` | Không lộ provider secret. |

---

## 9. PHASE 3 - STAFF KHO CHUẨN BỊ THIẾT BỊ

Payment success xác nhận Rental Order và tạo Warehouse Task. Staff Kho nhận work queue, scan/pick exact unit, ghi evidence, pack và mark Ready.

### 9.1. Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-FR-301** | Create Warehouse Task | P0 | System | Order `PAID` | Tự động tạo task chuẩn bị theo Trip/Pickup/Order. | Task `OPEN`. | Idempotent event. |
| **RB-FR-302** | Pick Reserved Units | P0 | Staff Kho | Task `OPEN` | Scan exact unit đã reserved; validate ownership/order; chuyển `PICKED`. | Task tiến độ. | Sai unit bị reject. |
| **RB-FR-303** | Pre-handover Condition Evidence | P0 | Staff Kho | Units picked | Chụp/lưu condition trước giao, note và ảnh cho từng unit. | Baseline evidence tồn tại. | Bắt buộc trước pack. |
| **RB-FR-304** | Pack Package | P0 | Staff Kho | Evidence complete | Tạo `packageCode`/QR, map exact units với User/Booking/Trip. | Package `PACKED`. | Không mix cross-order. |
| **RB-FR-305** | Mark Ready | P0 | Staff Kho | Package đầy đủ | Mark `READY_FOR_HANDOVER` và tạo Logistics Task. | Downstream task được tạo. | Không ready nếu thiếu evidence/package. |

### 9.2. API Specifications

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-API-301** | `GET /api/v1/staff/warehouse/tasks` | Staff Kho | Work queue | `date`, `status`, `tripId`, `pickupPointId` | `tasks` | Least-privilege data. |
| **RB-API-302** | `GET /api/v1/staff/warehouse/tasks/:id` | Staff Kho | Task detail | `taskId` | `order`, `units`, `pickup context` | Role. |
| **RB-API-303** | `POST /api/v1/staff/warehouse/tasks/:id/pick` | Staff Kho | Scan/pick unit | `assetCodes[]` | `pickedUnits`, `progress` | 409 sai reservation/order. |
| **RB-API-304** | `POST /api/v1/staff/warehouse/tasks/:id/condition-snapshots` | Staff Kho | Save condition before | `unitId`, `condition`, `notes`, `images` | `snapshot` | Không overwrite snapshot cũ. |
| **RB-API-305** | `POST /api/v1/staff/warehouse/tasks/:id/pack` | Staff Kho | Pack package | `unitIds` | `packageCode`, `qr`, `status` | Require all picked/evidence. |
| **RB-API-306** | `POST /api/v1/staff/warehouse/tasks/:id/ready` | Staff Kho | Ready for logistics | `packageId` | `task/logisticsTaskRef` | Idempotent. |

---

## 10. PHASE 4 - STAFF LOGISTICS GIAO THIẾT BỊ TẠI ĐIỂM TẬP TRUNG

Theo swimlane, Staff Logistics nhận task + package từ kho, di chuyển tới điểm tập trung, xác minh User/Booking, kiểm tra và bàn giao thiết bị. Check-in Trip và Rental Handover vẫn là hai nghiệp vụ riêng.

### 10.1. Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-FR-401** | Receive Package From Warehouse | P0 | Staff Logistics | Task scheduled | Scan package để nhận custody từ Staff Kho. | `PACKAGE_RECEIVED`. | Chain-of-custody. |
| **RB-FR-402** | Verify User / Booking | P0 | Staff Logistics | Tại pickup point | Scan User/Booking/Participant; xác thực đúng Trip/Pickup và Booking hợp lệ. | `USER_VERIFIED`. | Cross-domain Booking context. |
| **RB-FR-403** | Handover Equipment | P0 | Staff Logistics | User verified | Đối chiếu package, hiển thị condition; User xác nhận nhận; mark units `RENTED` và Rental `ACTIVE`. | Rental `ACTIVE`. | Không gộp Attendance check-in. |
| **RB-FR-404** | No-show / Refuse Handover | P1 | Staff Logistics/System | User không tới/từ chối | Ghi reason; không handover; tạo return-to-warehouse/cancellation flow. | Assets được giải phóng đúng policy. | Cần Booking no-show contract nếu dùng. |

### 10.2. API Specifications

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-API-401** | `GET /api/v1/logistics/tasks` | Staff Logistics | Task list | `date`, `status`, `type` | `tasks` | Role-scoped. |
| **RB-API-402** | `POST /api/v1/logistics/tasks/:id/receive-package` | Staff Logistics | Nhận package | `packageCode` | `task`, `custody` | Validate task/package. |
| **RB-API-403** | `POST /api/v1/logistics/tasks/:id/verify-user` | Staff Logistics | Verify User/Booking | `bookingQr/userQr` | `verification` + `expected package` | Cross-domain Booking validation. |
| **RB-API-404** | `POST /api/v1/rentals/:rentalId/handover` | Staff Logistics | Confirm handover | `packageId`, `userConfirmation` | `rental ACTIVE`, `units RENTED` | Require package received + user verified. |
| **RB-API-405** | `POST /api/v1/rentals/:rentalId/no-show` | Staff Logistics/System | No-show/refuse | `reason`, `evidence?` | `status/action` | Policy/idempotency. |

---

## 11. PHASE 5 - TRONG CHUYẾN / CHUẨN BỊ THU HỒI

Mảng B không điều khiển Trip. Khi Trip kết thúc hoặc đến return window, hệ thống nhận event từ Mảng A để tạo Return Task.

### 11.1. Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-FR-501** | Rental Active Tracking | P0 | System/User | Handover complete | Cho User xem các thiết bị đang thuê, due time và trạng thái. | Rental được theo dõi. | Không cần GPS tracking riêng. |
| **RB-FR-502** | Create Return Task | P0 | System | Trip completed/return window | Tạo task thu hồi theo Drop-off Point và package/rental. | `RETURN_DUE` task. | Cross-domain `TRIP_COMPLETED`. |
| **RB-FR-503** | Trip Change Handling | P1 | System | Trip rescheduled/cancelled | Revalidate reservation/order và thông báo action required/refund. | Rental không bị lệch ngày Trip. | Cross-domain. |

### 11.2. API Specifications

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-API-501** | `GET /api/v1/rentals/active` | User | Danh sách đang thuê | `bookingId?` | `active rentals`, `due info` | Ownership. |
| **RB-API-502** | `GET /api/v1/rentals/:id` | User/Staff | Rental lifecycle detail | `rentalId` | `assets`, `handover`, `return`, `deposit` | Role/ownership. |

---

## 12. PHASE 6 - THU HỒI / INSPECTION / HOÀN CỌC / FINALIZE INVENTORY

Staff Logistics thu hồi và đánh giá sơ bộ; Staff Kho nhận lại, re-check tình trạng và xác định trạng thái tồn kho cuối. System xử lý deposit theo kết quả hợp lệ.

### 12.1. Functional Requirements

| FR ID | Function | Priority | Actor | Pre-condition | Functional Requirement | Post-condition | Business Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-FR-601** | Return Scan | P0 | Staff Logistics | Return task due | Scan package/unit tại điểm trả; set `RETURN_PENDING`. | Return started. | Sai package/unit flag exception. |
| **RB-FR-602** | Preliminary Inspection | P0 | Staff Logistics | Return scan done | Ghi `NORMAL`/`DAMAGED`/`LOST` sơ bộ, note, ảnh evidence. | Inspection sơ bộ. | Không tự finalize inventory. |
| **RB-FR-603** | Return To Warehouse | P0 | Staff Logistics | Inspection done | Transfer custody package/units lại Staff Kho. | Warehouse can receive. | Trace custody. |
| **RB-FR-604** | Warehouse Re-inspection | P0 | Staff Kho | Units returned | Đối chiếu condition trước/sau; xác nhận final condition và damage/loss. | Final assessment. | Nếu discrepancy tạo exception. |
| **RB-FR-605** | Deposit Settlement | P0 | System/Staff | Final assessment | Normal $\rightarrow$ full refund; damaged/lost $\rightarrow$ deduction theo policy; lưu settlement immutable. | User nhận kết quả. | Không settle hai lần. |
| **RB-FR-606** | Finalize Equipment State | P0 | Staff Kho/System | Settlement/assessment complete | `NORMAL` $\rightarrow$ `AVAILABLE`; `DAMAGED` $\rightarrow$ `MAINTENANCE`/`DAMAGED`; `LOST` $\rightarrow$ `LOST`; cập nhật inventory. | Rental `COMPLETED`. | Không đưa đồ hỏng vào pool. |

### 12.2. API Specifications

| API ID | Method + Route | Role | Purpose | Request chính | Response chính | Rules / Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RB-API-601** | `POST /api/v1/rentals/:id/return-scan` | Staff Logistics | Start return | `packageCode`, `assetCodes` | `RETURN_PENDING` | Validate active rental. |
| **RB-API-602** | `POST /api/v1/rentals/:id/return-inspection` | Staff Logistics | Preliminary inspection | `items[{unitId,status,note,images}]` | `inspection` | Evidence required. |
| **RB-API-603** | `POST /api/v1/logistics/tasks/:id/return-to-warehouse` | Staff Logistics | Transfer custody | `packageId` | `custody transfer` | Task guard. |
| **RB-API-604** | `POST /api/v1/staff/returns/:returnId/receive` | Staff Kho | Warehouse receive | `scannedUnitIds` | `received/discrepancies` | Exact units. |
| **RB-API-605** | `POST /api/v1/staff/returns/:returnId/final-inspection` | Staff Kho | Final assessment | `per-unit condition/damage` | `final assessment` | Compare baseline. |
| **RB-API-606** | `POST /api/v1/rentals/:id/deposit-settlement` | System/Authorized Staff | Settle deposit | `assessmentId` | `refund`, `deduction`, `status` | Idempotent; amount bounded by deposit. |
| **RB-API-607** | `GET /api/v1/rentals/:id/deposit` | User | Deposit status | `rentalId` | `held/refund/deduction/reason` | Ownership. |
| **RB-API-608** | `POST /api/v1/staff/returns/:returnId/finalize` | Staff Kho | Finalize inventory/order | `returnId` | `unit states`, `rental COMPLETED` | Require inspection/settlement. |

---

## 13. API / EVENT CẦN PHỐI HỢP GIỮA CÁC MẢNG

Các contract dưới đây phải họp owner/consumer trước khi code. Đây là vùng dễ gây xung đột nghiệp vụ nhất và không nên để mảng B tự đoán dữ liệu từ Booking/Trip/Payment.

| API / Event | Owner | Consumer | Purpose | Key Contract | Review Before Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /internal/bookings/:id/rental-context` | Mảng A - Bảo | Mảng B - Quân | Kiểm tra quyền thuê và lấy context | `bookingId`, `userId`, `tripId`, `status`, `startAt`, `endAt`, `pickupPointId`, `dropoffPointId` | Bảo + Quân |
| `EVENT BOOKING_CONFIRMED` | Mảng A | Mảng B | Cho phép mở rental flow / preload context | `bookingId`, `tripId`, `userId`, `timestamps` | Bảo + Quân |
| `EVENT BOOKING_CANCELLED` | Mảng A | Mảng B | Hủy/release rental theo policy | `bookingId`, `cancelReason`, `source`, `effectiveAt` | Bảo + Quân + Luật nếu payment refund |
| `EVENT TRIP_RESCHEDULED` | Mảng A | Mảng B | Revalidate reservation/time window | `tripId`, `oldWindow`, `newWindow`, `affectedBookingIds` | Bảo + Quân |
| `EVENT TRIP_COMPLETED` | Mảng A | Mảng B | Mở return flow / create Return Task | `tripId`, `completedAt`, `dropoffPointId` | Bảo + Quân |
| `GET /internal/trips/:id/logistics-context` | Mảng A | Mảng B | Lấy pickup/dropoff/time cho task logistics | `tripId`, `pickup/dropoff`, `time`, `status` | Bảo + Quân |
| `POST /payments` / `PAYMENT_SUCCESS\|FAILED` | Shared Payment | Mảng B | Thanh toán rental fee + deposit | `orderRef`, `amount`, `status`, `providerRef`, `idempotencyKey` | Quân + Luật/Payment owner |
| `POST /refunds` / `REFUND_RESULT` | Shared Payment | Mảng B | Hoàn tiền/cọc | `rentalOrderId`, `amount`, `reason`, `status` | Quân + Luật/Payment owner |
| `EVENT NOTIFICATION` | Mảng B | Notification service | Thông báo order/payment/ready/handover/return/refund | `recipientId`, `type`, `entityRef`, `payload` | Quân + integration owner |
| `AUTH / RBAC` | Shared | Mảng B | Xác thực User/Staff roles | `userId`, `roles`, `permissions` | Team thống nhất chung |

---

## 14. BUSINESS RULE CỐT LÕI PHẢI CHỐT TRƯỚC KHI CODE

| BR ID | Business Rule | Mức |
| :--- | :--- | :--- |
| **RB-BR-01** | Không được tạo Rental Order nếu không có Booking hợp lệ thuộc User. | P0 |
| **RB-BR-02** | Rental date window phải derive từ Trip; FE không tự gửi ngày để thay đổi giá. | P0 |
| **RB-BR-03** | Một Equipment Unit không được có reservation/rental overlap trong cùng time window. | P0 |
| **RB-BR-04** | Reservation phải atomic; concurrent checkout không thể cùng reserve một unit. | P0 |
| **RB-BR-05** | Payment timeout/cancel trước handover phải release reservation idempotently. | P0 |
| **RB-BR-06** | Staff Kho là role duy nhất thao tác master inventory/Equipment Unit lifecycle nghiệp vụ kho. | P0 |
| **RB-BR-07** | Staff Logistics không được chỉnh product price, inventory master hoặc maintenance. | P0 |
| **RB-BR-08** | Handover yêu cầu package đúng + User/Booking đúng + task đúng pickup. | P0 |
| **RB-BR-09** | Condition before-handover phải tồn tại trước khi giao; User cần xác nhận tình trạng khi nhận. | P0 |
| **RB-BR-10** | Return inspection của Logistics là sơ bộ; Staff Kho chịu final inventory assessment. | P0 |
| **RB-BR-11** | Thiết bị `DAMAGED`/`LOST` không được tự quay `AVAILABLE`. | P0 |
| **RB-BR-12** | Deposit settlement không được thực hiện hai lần và deduction không vượt deposit/policy. | P0 |
| **RB-BR-13** | Booking cancellation / Trip reschedule phải được xử lý qua event/contract, không query DB mảng A trực tiếp. | P0 |
| **RB-BR-14** | Check-in Trip và Rental Handover là hai nghiệp vụ riêng dù cùng xảy ra tại điểm tập trung. | P0 |
| **RB-BR-15** | Số lượng thuê tối đa/cutoff trước Trip phải cấu hình được; giá trị cụ thể có thể chốt sau. | P1 |

---

## 15. ERROR CONTRACT / VALIDATION CHUNG

| HTTP Status | Code đề xuất | Ý nghĩa |
| :--- | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Request thiếu/sai field. |
| **401** | `UNAUTHENTICATED` | Chưa đăng nhập/token sai. |
| **403** | `FORBIDDEN` | Role/ownership không đủ quyền. |
| **404** | `RENTAL_NOT_FOUND` / `UNIT_NOT_FOUND` | Entity không tồn tại. |
| **409** | `EQUIPMENT_NOT_AVAILABLE` | Không đủ unit khả dụng / race conflict. |
| **409** | `INVALID_RENTAL_STATE` | State transition không hợp lệ. |
| **409** | `DUPLICATE_OPERATION` | Handover/refund/settlement đã xử lý. |
| **422** | `BOOKING_NOT_RENTAL_ELIGIBLE` | Booking/Trip không đủ điều kiện thuê. |
| **422** | `RENTAL_CUTOFF_PASSED` | Đã qua deadline thuê. |
| **502 / 503** | `PAYMENT_SERVICE_UNAVAILABLE` | External/shared service lỗi có kiểm soát. |

---

## 16. ENTITY / ERD TỐI THIỂU CHO MẢNG B

| Entity | Field / Relation quan trọng | Ghi chú ownership |
| :--- | :--- | :--- |
| **RentalProduct** | `id`, `sku`, `name`, `categoryId`, `dailyPrice`, `depositPolicy`, `status` | B owner. |
| **EquipmentUnit** | `id`, `productId`, `assetCode`, `status`, `condition` | Serialized asset. |
| **EquipmentReservation** | `id`, `unitId`, `rentalOrderId`, `startAt`, `endAt`, `status` | Unique/locking logic. |
| **RentalOrder** | `id`, `userId`, `bookingId`, `tripId`, `status`, `fee`, `deposit`, `policySnapshot` | Không FK logic ngược sang sửa Booking. |
| **RentalOrderLine** | `orderId`, `productId`, `qty`, `dailyPriceSnapshot`, `chargedDays` | Snapshot giá. |
| **WarehouseTask** | `orderId`, `status`, `deadline`, `tripId`, `pickupPointRef` | Generated after paid. |
| **Package** | `id`, `packageCode`, `orderId`, `status` | Contains exact units. |
| **PackageItem** | `packageId`, `equipmentUnitId` | Traceability. |
| **ConditionSnapshot** | `unitId`, `type(BEFORE/RETURN)`, `condition`, `images`, `createdBy` | Immutable evidence. |
| **LogisticsTask** | `tripId`, `orderId`, `packageId`, `type`, `pickup/dropoffRef`, `status`, `assignee` | Mobile workflow. |
| **HandoverRecord** | `rentalOrderId`, `packageId`, `staffId`, `userConfirmAt` | Chain of custody. |
| **ReturnInspection** | `rentalOrderId`, `unitId`, `preliminary/final`, `status`, `note`, `evidence` | Two-stage inspection. |
| **DepositSettlement** | `rentalOrderId`, `deposit`, `deduction`, `refundAmount`, `status`, `reason` | Immutable financial record. |
| **MaintenanceRecord** | `unitId`, `start/end`, `reason`, `note`, `status` | Warehouse owner. |

---

## 17. ACCEPTANCE CRITERIA MVP CHO MẢNG B

- [ ] User có Booking hợp lệ mới tạo được Rental Order.
- [ ] Availability tính đúng theo Trip date window và loại unit đang reserved/rented/maintenance.
- [ ] Hai User checkout đồng thời không thể reserve cùng Equipment Unit.
- [ ] Payment success tạo Warehouse Task đúng một lần; payment failed/expired release reservation đúng.
- [ ] Staff Kho pick đúng exact unit, lưu condition before, pack package QR và mark ready.
- [ ] Staff Logistics nhận package, verify đúng User/Booking, handover và mark Rental `ACTIVE`.
- [ ] Trip complete tạo return flow; Logistics scan return và lưu inspection sơ bộ.
- [ ] Staff Kho nhận lại, re-inspect và finalize Equipment Unit state.
- [ ] Normal $\rightarrow$ refund full; Damaged/Lost $\rightarrow$ deduction theo policy; settlement idempotent.
- [ ] Booking/Trip/Payment integration chỉ qua contract/event đã thống nhất, không chỉnh DB/domain nhóm khác.

---

## 18. API IMPLEMENTATION ROADMAP - ĐỀ XUẤT THEO GIAI ĐOẠN

| Giai đoạn | API / Feature trọng tâm | Điều kiện hoàn tất |
| :--- | :--- | :--- |
| **R0 - Master Data** | RentalProduct + EquipmentUnit CRUD + inventory filters | Có data thật, unit QR/code unique. |
| **R1 - Eligibility/Availability** | Booking rental context + availability + quote | Chốt contract Bảo - Quân. |
| **R2 - Order/Reservation** | Create order + atomic reservation + cancel/expiry | Concurrency test pass. |
| **R3 - Payment** | Payment intent + webhook + refund contract | Idempotent. |
| **R4 - Warehouse** | Work queue + pick + condition + pack + ready | Staff Kho flow demo được. |
| **R5 - Logistics Handover** | Task + receive package + verify user + handover | Mobile giao đồ demo được. |
| **R6 - Return/Deposit** | Return scan + inspections + settlement + finalize inventory | End-to-end hoàn tất. |
| **R7 - Integration Hardening** | Cancel/reschedule/no-show/notifications | Cross-domain test pass. |

---

## 19. CÁC DIAGRAM NÊN VẼ TỪ TÀI LIỆU NÀY

| Diagram | Phạm vi nên thể hiện |
| :--- | :--- |
| **Use Case Diagram** | User / Staff Kho / Staff Logistics / Admin / Payment / Booking System. |
| **Activity Diagram - Rental E2E** | Từ eligibility $\rightarrow$ quote $\rightarrow$ order $\rightarrow$ payment $\rightarrow$ warehouse $\rightarrow$ handover $\rightarrow$ return $\rightarrow$ deposit. |
| **Sequence - Create Rental Order** | User $\leftrightarrow$ Rental $\leftrightarrow$ Booking Context $\leftrightarrow$ Reservation DB $\leftrightarrow$ Payment. |
| **Sequence - Warehouse Preparation** | Payment Event $\rightarrow$ Warehouse Task $\rightarrow$ Pick $\rightarrow$ Condition $\rightarrow$ Pack $\rightarrow$ Ready. |
| **Sequence - Logistics Handover** | Logistics App $\rightarrow$ Task $\rightarrow$ Booking Verify $\rightarrow$ Package $\rightarrow$ Handover. |
| **Sequence - Return & Deposit** | Return Scan $\rightarrow$ Inspection $\rightarrow$ Warehouse Recheck $\rightarrow$ Deposit Settlement $\rightarrow$ Inventory. |
| **State Diagram - EquipmentUnit** | `AVAILABLE`...`LOST`/`MAINTENANCE`. |
| **State Diagram - RentalOrder** | `PENDING_PAYMENT`...`COMPLETED`/`CANCELLED`. |
| **ERD** | `RentalProduct`, `EquipmentUnit`, `Reservation`, `RentalOrder`, `Task`, `Package`, `Inspection`, `Deposit`. |
| **Integration Diagram** | Booking/Trip/Payment/Notification contracts với Rental. |

---

## 20. TEMPLATE CHUẨN MẢNG B ĐANG DÙNG

Đây là cùng cấu trúc với tài liệu Mảng A Booking để team review đồng nhất:

| Mục bắt buộc | Nội dung |
| :---: | :--- |
| **1** | Mục đích tài liệu |
| **2** | Domain & ownership |
| **3** | Roles |
| **4** | Terminology / core model |
| **5** | State model |
| **6+** | Functional Requirement theo từng phase |
| **Mỗi phase** | FR table + API table |
| **Cross-domain** | API/Event cần họp owner-consumer |
| **Business Rule** | Rule ID + priority |
| **Error Contract** | HTTP + business error code |
| **ERD** | Entity + relation/ownership |
| **Acceptance** | MVP completion criteria |
| **Roadmap** | Thứ tự implement |
| **Diagram** | Danh sách diagram cần vẽ |
| **TBD** | Điểm chưa chốt |

---

## 21. OPEN DECISIONS / TBD CẦN TEAM CHỐT

| TBD | Vấn đề | Khuyến nghị MVP |
| :--- | :--- | :--- |
| **RB-TBD-01** | Rental cutoff chính xác trước Trip bao lâu? | Config; mặc định 7 ngày theo thảo luận hiện tại. |
| **RB-TBD-02** | Giới hạn qty theo participant/loại thiết bị? | Config per product; không hardcode. |
| **RB-TBD-03** | Damage severity và công thức deduction cụ thể? | MVP Staff Kho xác nhận amount trong giới hạn policy. |
| **RB-TBD-04** | User từ chối tình trạng khi handover xử lý thế nào? | Tạo handover exception; không mark `RENTED`. |
| **RB-TBD-05** | Private Trip tự tới cửa hàng nhận đồ có làm MVP không? | Để P1; core dùng Staff Logistics tại điểm tập trung. |
| **RB-TBD-06** | No-show mất rental fee/deposit mức nào? | Họp Bảo + Quân + Payment owner. |
| **RB-TBD-07** | Trip reschedule nếu unit mới bị conflict xử lý thế nào? | Action required; không tự đổi reservation im lặng. |
| **RB-TBD-08** | Ai phê duyệt tranh chấp damage? | MVP Staff Kho + Admin override nếu cần. |

---

## 22. KẾT LUẬN

Mảng B phải được xem là nguồn sự thật cho Rental Product, Equipment Unit, Reservation, Rental Order, Warehouse/Logistics Task và trạng thái thiết bị. Mảng A Booking/Trip chỉ cung cấp context/event; Payment chỉ xử lý tiền; các mảng khác không được sửa trực tiếp lifecycle của Rental. 

Thứ tự quan trọng cho MVP:

$$
\text{Master Inventory} \longrightarrow \text{Eligibility/Availability} \longrightarrow \text{Order/Reservation} \longrightarrow \text{Payment} \longrightarrow \text{Warehouse} \longrightarrow \text{Logistics Handover} \longrightarrow \text{Return/Inspection} \longrightarrow \text{Deposit/Finalize}
$$

Các API nội bộ Rental có thể được Quân/Nguyên thiết kế và triển khai độc lập theo bảng trên. Khi chạm Booking/Trip/Payment/Notification, cần mở review contract trước khi code để tránh conflict cả schema, code và business rule.