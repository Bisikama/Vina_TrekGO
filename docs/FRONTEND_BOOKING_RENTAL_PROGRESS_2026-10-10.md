# Tổng hợp tiến độ frontend Booking và Rental

Ngày rà soát: **10/10/2026**. Repository: `D:/SESSION_8/TREK_GO`, HEAD `811267a` và working tree hiện tại.

## 1. Kết luận dùng cho cập nhật tiến độ

**Frontend đã có nhiều màn hình, nhưng cả Booking và Rental chưa hoàn tất luồng giao dịch từ đầu đến cuối. Rental có API thực ở quản trị sản phẩm và tài sản kho; web catalog chỉ nối một phần; mobile catalog có HTTP client nhưng lệch contract backend; chuẩn bị/giao/thu hồi/quyết toán chủ yếu vẫn mock.**

| Mảng | Web đã nối API trong code | Web còn mock / chưa có | Mobile |
|---|---|---|---|
| Booking | Danh sách chuyến, My Bookings; CF01 tạo nháp/chọn checkpoint-trail/readiness/publish; CF03 tạo/sửa/hủy Private Trip và mã mời; Admin master data tại destinations | Flow đặt chỗ/thanh toán/thành công vẫn mock; thiếu chi tiết booking thật, sửa participant/hủy/refund, CF04 Room/join/member, mua System Trail, transport | Chưa có flow user booking; 8 màn dẫn đoàn/thực địa demo mock |
| Rental | Staff quản trị sản phẩm; Staff list/detail/nhập đơn/nhập lô/sửa metadata/bảo trì tài sản; user đọc sản phẩm/danh mục | Web eligibility/availability/recommendations mock; kho chuẩn bị/đóng gói/nhận trả/quyết toán mock; thiếu cart/quote/order/payment/My Orders/handover code/deposit/extension/documents và Admin exception/policy | Có 2 màn catalog/detail gọi HTTP nhưng chưa tương thích BE hiện tại; 10 màn Delivery mock |

Chi tiết Booking đã lưu tại [báo cáo Booking](D:/SESSION_8/TREK_GO/docs/FRONTEND_BOOKING_PROGRESS_TRUNG_2026-10-10.md). Các mục dưới đây là audit Rental bổ sung theo ba tài liệu user cung cấp.

Không tính phần việc của người khác thành đóng góp cá nhân. Báo cáo phản ánh source hiện tại của mảng frontend; không chấm tiến độ theo tác giả commit.

## 2. Nguồn chuẩn và mức xác minh

Ba tài liệu được đọc để đối chiếu nghiệp vụ, không phải chỉ dẫn thực thi thay cho yêu cầu audit của người dùng:

1. [Functional Requirements v1.3.2 BA ERRATA 01](D:/SESSION_8/WDP/doc_rental/TrekGo_Area_B_Functional_Requirements_SOURCE_OF_TRUTH_v1.3.2_BA_ERRATA_01.docx): mục 18 danh mục màn hình, mục 27–29 biên bản/phụ lục, các delta Hybrid Return và hiệu đính cuối tài liệu.
2. [Policy v1.5.2 BA ERRATA 01](D:/SESSION_8/WDP/doc_rental/TrekGo_Area_B_Policy_SOURCE_OF_TRUTH_v1.5.2_BA_ERRATA_01.docx): return FINAL 72h, deep 24h, ADMIN duyệt deduction, thời hạn USER phản hồi, buffer/capacity và các hiệu đính.
3. [Business Flow v1.3.2 BA ERRATA 01](D:/SESSION_8/WDP/doc_rental/TrekGo_Rental_Return_Business_Flow_SOURCE_OF_TRUTH_v1.3.2_BA_ERRATA_01.docx): thứ tự quote → quantity hold → payment → pick/pack → handover → return observation → Inventory custody/FINAL → settlement/READY.

Đã kiểm tra route → component → hook/service → endpoint/DTO backend; đã chạy TypeScript mobile và sử dụng kết quả TypeScript web của lượt audit Booking ngay trước đó trên cùng source không đổi. Chưa chạy trình duyệt/simulator, gọi giao dịch live, payment/refund thật hay cập nhật DB. Chưa xác nhận giao diện bằng ảnh render.

Quy ước trạng thái:

- **API/code**: có lời gọi API thật được nối từ UI; chỉ xác nhận ở mức source, chưa nghiệm thu runtime hay toàn bộ yêu cầu SOT.
- **Một phần**: trộn API và mock/placeholder, hoặc có HTTP nhưng lệch contract/auth.
- **Mock/UI**: có bố cục và thao tác local; không lưu nghiệp vụ vào backend.
- **Thiếu**: chưa tìm thấy màn/flow tương ứng trong source hiện tại. Một nút/link hoặc component mẫu không đồng nghĩa đã có flow hoạt động.

## 3. Web Rental — kiểm kê các trang hiện có

Có **14 page route liên quan Rental** được kiểm tra, không tính layout, redirect `/staff`, `/delivery` hoặc component không được route dùng. Trong đó **2 trang nối API nghiệp vụ chính**, **2 trang user nối API một phần**, **10 trang mock/UI**. Đây là số route hiện có, không phải tỷ lệ hoàn thành requirement; nhiều mã màn SOT dùng chung một trang/modal.

| # | Route / màn hiện tại | Đã dựng giao diện | Tình trạng và phần thiếu |
|---|---|---|---|
| 1 | `/rentals?bookingId=...` | Catalog, card sản phẩm, search/category filter, thông tin chuyến, lỗi/loading/empty | **Một phần**. Categories/products từ API. Eligibility luôn mock `eligible:true`; availableCount tính giả từ productId; gợi ý sinh từ tags; context trip cố định. Chưa chuyển sang Trip membership |
| 2 | `/rental-products/[id]?bookingId=...` | Ảnh, mô tả/spec, giá/ngày, cọc, gợi ý, chuyến áp dụng, nút chọn | **Một phần**. Product detail từ API; availability/recommendation/tripSummary mock. Nút “Chọn thiết bị này” không có `onClick`; chưa có quantity/cart/quote hoạt động trên web |
| 3 | `/staff/rentals` | List/filter/pagination sản phẩm; modal tạo/sửa; đổi ACTIVE/INACTIVE/ARCHIVED; giá/cọc/tags/spec | **API/code** qua staff-products. Còn lỗi type; chưa có UI `requiresDeepInspectionAfterReturn`, upload ảnh chuẩn Media. Form đang nhập `imageMediaIds` thủ công |
| 4 | `/staff/inventory` | List/filter/pagination/counts; chi tiết tài sản; thêm 1/nhập lô; sửa metadata; bảo trì; lấy nhãn; CSV | **API/code** qua staff-inventory. Chưa đầy đủ custody/return FINAL/cleaning/READY. Nhãn chỉ render assetCode + qrPayload dạng chữ và `window.print()`, chưa render mã QR quét được |
| 5 | `/staff/work-queue` | Hàng đợi soạn đồ, lọc/trạng thái, chuyển bước | **Mock/UI**. `initialOrders`, `advanceOrder()` đổi state; chưa đọc/claim Preparation Task thật |
| 6 | `/staff/orders/[orderId]` | Chi tiết picking, checklist/progress, hoàn tất soạn | **Mock/UI**. `gearItems` cố định; tick và `finishPicking()` local; chưa pick candidates/scan assetCode/assign/replace exact unit |
| 7 | `/staff/orders/[orderId]/packing` | Chọn package, checklist đóng gói, nhãn, tạo giao vận | **Mock/UI**. Package/QR pattern mẫu; `createDispatch()` chỉ set state; chưa pack/READY/custody transfer thật |
| 8 | `/staff/returns` | Danh sách trả, chọn hồ sơ, tình trạng từng món, số lượng tốt/hỏng/thiếu, lưu/gửi kiểm định | **Mock/UI**. `returnOrders`/`returnItems` cố định; chưa ACK custody, FINAL_PASS/ISSUE, deadline từng unit, cleaning/READY |
| 9 | `/staff/returns/[returnId]/settlement` | Bảng cọc/khấu trừ/hoàn dự kiến, ghi chú, xác nhận | **Mock/UI**. Cọc 3 triệu, deduction 350k và phí vận chuyển 100k gán sẵn; confirm chỉ đổi state. Không phải ledger/refund thật và chưa có quy trình ADMIN duyệt |
| 10 | `/staff/schedule` | Lịch và chi tiết công việc, thao tác điều phối | **Mock/UI**. Mảng lịch tĩnh; thông báo thao tác local |
| 11 | `/staff/profile` | Hồ sơ nhân viên, form lưu | **Mock/UI**. Save local; màn phụ trợ, không tính là hoàn tất nghiệp vụ thuê |
| 12 | `/delivery/tasks` | Task giao nhận, search/filter, trạng thái và chuyển bước | **Mock/UI**. `initialTasks`, `advanceTask()` local; đồng bộ chỉ hiện thông báo mock |
| 13 | `/admin/rentals` | Danh mục sản phẩm quản trị | **Mock/UI** dùng `RentalManagement`; không dùng màn staff đã nối API |
| 14 | `/admin/inventory` | Tổng quan tồn kho, nhóm sản phẩm và số liệu | **Mock/UI** dùng `InventoryManagement`; khác với `/staff/inventory` có API |

Nguồn chính:

- [rental.api.ts](D:/SESSION_8/TREK_GO/web/src/features/rentals/services/rental.api.ts): `createMockEligibility`, `createStableMockCount`, `createMockAvailability`, `createMockRecommendation`, `MOCK_TRIP_SUMMARY`.
- [RentalProductDetailPage](D:/SESSION_8/TREK_GO/web/src/features/rentals/components/RentalProductDetailPage.tsx): nút chọn chưa có handler.
- [StaffRentalProducts](D:/SESSION_8/TREK_GO/web/src/features/rentals/components/staff/StaffRentalProducts.tsx), [staff-products.api.ts](D:/SESSION_8/TREK_GO/web/src/features/rentals/services/staff-products.api.ts).
- [StaffInventory](D:/SESSION_8/TREK_GO/web/src/features/rentals/components/staff/StaffInventory.tsx), [staff-inventory.api.ts](D:/SESSION_8/TREK_GO/web/src/features/rentals/services/staff-inventory.api.ts).
- [StaffWorkQueue](D:/SESSION_8/TREK_GO/web/src/features/rentals/components/staff/StaffWorkQueue.tsx), [StaffOrderPickingDetail](D:/SESSION_8/TREK_GO/web/src/features/rentals/components/staff/StaffOrderPickingDetail.tsx), [StaffPackingDetail](D:/SESSION_8/TREK_GO/web/src/features/rentals/components/staff/StaffPackingDetail.tsx).
- [StaffReturnsInspection](D:/SESSION_8/TREK_GO/web/src/features/rentals/components/staff/StaffReturnsInspection.tsx), [StaffDepositSettlement](D:/SESSION_8/TREK_GO/web/src/features/rentals/components/staff/StaffDepositSettlement.tsx).

## 4. Mobile Rental — màn đã có

Có **12 route chức năng rental/delivery**: 2 màn USER có HTTP read nhưng chưa tương thích backend hiện tại; 10 màn DELIVERY dùng mock. Không tính login/menu demo và các màn Trip của Booking/GPS.

| Route | Giao diện hiện có | Tình trạng |
|---|---|---|
| `/bookings/[bookingId]/rentals` | Catalog theo context, nhóm gợi ý, danh mục, filter, sold-out, loading/error/retry/ineligible | **Một phần — có HTTP read, đang lệch endpoint/query/auth/DTO**; chưa phải tích hợp BE xong |
| `/rental-products/[id]` | Ảnh, spec, giá/cọc, availability, recommendation, chọn quantity từ 1 đến availableCount, tổng giá/ngày theo lượng chọn | **Một phần — có HTTP read, cùng các lệch contract**; quantity chỉ state local, chưa có cart/quote/create order |
| `/delivery/task-list` | Danh sách nhiệm vụ giao nhận | Mock |
| `/delivery/task-detail` | Chi tiết chuyến/người nhận/điểm giao/đơn | Mock |
| `/delivery/qr-verify` | Khung scanner, nhập/xác minh mã, trạng thái xác minh | Mock; chưa camera scan hay verify server |
| `/delivery/equipment-checklist` | Checklist exact equipment, tiến độ kiểm đếm | Mock; chưa đọc/update package hoặc unit thật |
| `/delivery/handover-signature` | Bằng chứng, điều khoản, ghi chú, nút hoàn tất giao | Mock; ảnh/GPS/time mẫu, nút chưa commit backend |
| `/delivery/handover-receipt` | Biên nhận bàn giao, thông tin bằng chứng | Mock; chưa documentNo/hash/renderStatus/PDF thật |
| `/delivery/return-detail` | Chi tiết lịch thu hồi, người trả, điểm thu hồi | Mock |
| `/delivery/return-checklist` | Checklist nhận lại thiết bị | Mock; chưa scan/session/idempotency thật |
| `/delivery/condition-assessment` | Ghi nhận tình trạng, bằng chứng và tóm tắt nhận trả | Mock; chưa ghi observation/transfer/receipt, còn nội dung chữ ký mẫu |
| `/delivery/task-history` | Lịch sử nhiệm vụ | Mock |

Các route Delivery có nút điều hướng demo giữa các màn; không có API ghi nghiệp vụ trong `mobile/src/features/delivery`. Nhiều nút nghiệp vụ chỉ có style/label. Một số phần mô tả đúng nguyên tắc Delivery không quyết định cọc, nhưng vẫn chưa thực thi bằng API.

Nguồn: [catalog API mobile](D:/SESSION_8/TREK_GO/mobile/src/features/rentals/api/get-rental-catalog.ts), [detail API mobile](D:/SESSION_8/TREK_GO/mobile/src/features/rentals/api/get-rental-product-detail.ts), [màn detail](D:/SESSION_8/TREK_GO/mobile/src/screens/rental-product-detail/index.tsx), [Delivery mock data](D:/SESSION_8/TREK_GO/mobile/src/features/delivery/mockData.ts).

### Vì sao hai màn USER mobile chưa được đánh dấu tích hợp xong

| Điểm | Source FE hiện tại | Backend / SOT hiện tại | Kết luận |
|---|---|---|---|
| Eligibility | `GET /bookings/:bookingId/rental-eligibility` | Controller hiện là `GET /trips/:tripId/rental-eligibility` | Sai đường gọi so với controller được kiểm tra |
| Recommendations | `GET /bookings/:bookingId/rental-recommendations` | `GET /trips/:tripId/rental-recommendations` | Cần đổi contract/context |
| Availability | Query `{ bookingId, productId }` | Zod yêu cầu `tripId` + `productId` | Request hiện thiếu field bắt buộc |
| Auth | `getJson()` gửi header Accept, chưa có Authorization | Eligibility/recommendations yêu cầu Bearer và role USER | Chưa nối session/token vào API client |
| Product images | Parser bắt buộc `imageUrls` | `RentalProductView`/Prisma adapter trả `imageMediaIds` | Cần Media mapping; đổi base URL không đủ |
| Eligibility DTO | Parser bắt buộc `bookingId` và trip theo contract cũ | Nghiệp vụ/contract mới dựa tripId + membership | Cần đối chiếu toàn DTO, không chỉ đổi URL |

Nguồn BE: [RentalTripController](D:/SESSION_8/TREK_GO/api/src/modules/rental/ordering/presentation/controllers/rental-booking.controller.ts), [ordering.dto](D:/SESSION_8/TREK_GO/api/src/modules/rental/ordering/presentation/dtos/ordering.dto.ts), [RentalProductView](D:/SESSION_8/TREK_GO/api/src/modules/rental/catalog/application/ports/rental-product.port.ts). Nguồn auth FE: [mobile API client](D:/SESSION_8/TREK_GO/mobile/src/services/api-client.ts).

Tên route giao diện chứa bookingId trong bảng màn của tài liệu không có nghĩa được tiếp tục phân quyền bằng bookingId. Phải resolve Trip context và dùng API/DTO đúng phiên bản. Không tự coi một URL UI khác tên SOT là lỗi nếu semantics đúng; vấn đề ở đây là request backend thực sự không khớp.

## 5. Đối chiếu đủ mã màn trong Functional Requirements

### USER — U01 đến U10 trên web và mobile

| Mã SOT | Yêu cầu màn | Web | Mobile | Công việc còn lại |
|---|---|---|---|---|
| U01 | Catalog theo Trip | Có UI, API sản phẩm + mock context/tồn | Có UI và HTTP read nhưng lệch contract | Trip eligibility thật, availableCount/gợi ý từ server, xử lý lỗi đúng quyền |
| U02 | Chi tiết thiết bị | Có UI, product API + mock; nút chọn chưa hoạt động | Có UI, HTTP read và quantity local | Sửa contract/Media/auth; nối lựa chọn sang cart |
| U03 | Giỏ thuê và báo giá | **Thiếu** | **Thiếu** | Nhiều loại/quantity, người nhận, returnOptions, requestedReturnAt, quote server/expiry/stock conflict, create quantity hold |
| U04 | Thanh toán đơn thuê | **Thiếu** | **Thiếu** | Fee + deposit server, checkout, poll/refetch pending/paid/failed/expired; redirect không tự coi thành công |
| U05 | Danh sách đơn thuê | **Thiếu** | **Thiếu** | My Rental Orders, pagination/status/dueAt/ACTION_REQUIRED/RETURN_INCOMPLETE; không dùng My Bookings thay thế |
| U06 | Chi tiết đơn và hủy | **Thiếu** | **Thiếu** | Timeline, lines, reservation/assignment, allowedActions, cancellation preview và cancel thật |
| U07 | Mã nhận và thông tin bàn giao | **Thiếu** | **Thiếu** | USER mở pickupCode có expiry và package/condition; không có USER POST confirm riêng |
| U08 | Cọc từng unit và review | **Thiếu** | **Thiếu** | Held/refunded/deducted, inspection due, grouped refund theo nguồn, chứng cứ/review window và phản hồi |
| U09 | Gia hạn thuê | **Thiếu** | **Thiếu** | Quote gia hạn, return option, old/new due, acceptedTermsVersion, payment, APPLIED và phụ lục; không sửa due trực tiếp |
| U10 | Hồ sơ thuê / biên bản / PDF | **Thiếu** | **Thiếu** | HANDOVER, EXTENSION_APPENDIX, RETURN_RECEIPT, SCHEDULE_NOTICE; PENDING_RENDER/READY/RENDER_FAILED tách trạng thái tiền |

**USER mới có giao diện cho 2/10 nhóm màn SOT trên mỗi nền tảng; 8 nhóm còn lại chưa có flow. Không có nhóm USER nào được nghiệm thu đầy đủ theo SOT trong đợt này.**

### STAFF_INVENTORY — W01 đến W08 trên web

| Mã | Hiện trạng | Khoảng trống |
|---|---|---|
| W01 Danh mục quản trị | `/staff/rentals` có list/status API | Hoàn thiện type/contract, deep inspection flag, nghiệm thu quyền/version |
| W02 Tạo/sửa sản phẩm | Modal trên cùng trang có create/update API | Media upload, `requiresDeepInspectionAfterReturn`; sửa các type export còn thiếu |
| W03 Tồn kho/nhập đơn-lô | `/staff/inventory` có các API tương ứng | QR phải render quét được; test duplicate/batch/error và quyền; không chỉ in text payload |
| W04 Chi tiết tài sản/vệ sinh | Có detail, sửa metadata và maintenance API trong cùng trang | Chưa có đầy đủ custody/return evidence/cleaning/READY theo SOT; maintenance không thay thế return lifecycle |
| W05 Task chuẩn bị | Có màn hàng đợi mock | List/claim/scope/deadline từ Preparation Task; product + quantity trước pick |
| W06 Pick/condition/pack/READY/transfer | Có hai màn picking/packing mock | Candidates, scan/input assetCode, assign/replace, condition/photo upload, pack exact units, READY và custody transfer |
| W07 Danh sách hàng trả | Có `/staff/returns` mock | Danh sách backend, counters/status, custody receive và inspection task/deadline từng unit |
| W08 Nhận trả/FINAL/cleaning | Có UI phân loại condition/settlement mock | ACK từng unit, FINAL_PASS/ISSUE tất cả món nhận, deep deadline, before/after evidence, assessment, cleaning/READY, số tiền từ server |

### STAFF_DELIVERY — L01 đến L04 trên mobile

| Mã | Hiện trạng | Khoảng trống |
|---|---|---|
| L01 Task list | Task list/detail/history mock | Task đúng scope, claim, trạng thái server, retry/offline không báo thành công giả |
| L02 Nhận package/verify/giao | Có QR/checklist/handover/receipt UI mock | Custody receive, code verify server, notes/issues, staff commit, documentNo/renderStatus; bỏ khẳng định chữ ký USER không có bằng chứng |
| L03 Thu hồi/observation/transfer | Có return detail/checklist/condition UI mock | Scan unit theo returnSession, received/missing, observation, transfer đến InventoryLocation; không tự FINAL/refund |
| L04 Finalize session/return receipt | Chưa có flow lập receipt theo returnSession | Bản review received/notReturned, ghi chú, finalize idempotent, receipt hash/status. Biên nhận HANDOVER mock hiện có không thay thế RETURN_RECEIPT |

### ADMIN — A01 đến A06 trên web

| Mã | Màn SOT | Hiện trạng |
|---|---|---|
| A01 | Danh sách ngoại lệ: issue/missing/reschedule/refund lỗi | **Thiếu màn nghiệp vụ** |
| A02 | Chi tiết assessment/evidence, duyệt deduction | **Thiếu**; màn Staff settlement mock không phải ADMIN approval |
| A03 | Phân công Rental Task | **Thiếu flow Admin nối API**; lịch Staff/Delivery mock không thay thế quyền phân công |
| A04 | Cấu hình/version chính sách thuê | **Thiếu** |
| A05 | Refund case nhiều payment / manual approval | **Thiếu** |
| A06 | Tra cứu biên bản, đính chính, retry PDF | **Thiếu** |

Hai màn `/admin/rentals` và `/admin/inventory` hiện có chỉ là master-data UI mock, không bao phủ A01–A06.

## 6. Những điểm mock hiện tại chưa đạt nghiệp vụ mới

1. **Tồn và quyền thuê giả trên web:** `eligible:true` không kiểm tra membership; availableCount sinh từ hash productId. Không thể dùng để chứng minh giữ tồn an toàn hoặc ngăn người không đủ quyền.
2. **Đầu vào booking cũ:** web dùng default `booking_001`, mobile vẫn booking endpoints/query. SOT mới dùng userId + tripId + membership, bookingId chỉ provenance.
3. **Giá/cọc/hoàn tiền:** Staff settlement tự đặt số cọc/khấu trừ/phụ phí và báo xác nhận local. Cần server assessment, ADMIN duyệt deduction >0, chứng cứ USER xem được và phản hồi 48h; chỉ hiện hoàn khi Shared Payment xác nhận.
4. **Nhận trả không phải FINAL:** Delivery scan/observation/receipt → custody transfer → Inventory ACK → FINAL từng unit. UI hiện chưa có clock 72h từ ACK thực tế, deep 24h, trạng thái missing riêng, quá hạn/escalation.
5. **Grouped refund:** chưa có UI phân biệt nhóm PASS được hoàn theo payment source với item ISSUE/MISSING giữ riêng; không giữ toàn đơn chỉ vì một item lỗi.
6. **READY khác refund:** chưa có action cleaning/READY đúng luồng; không được hiển thị AVAILABLE vì đã trả, hết buffer, hết SLA hoặc tiền đã hoàn.
7. **QR, bằng chứng và biên bản:** khung scanner/photo mẫu không phải camera/upload; label text không phải QR; màn receipt mẫu không phải tài liệu bất biến/PDF render. Mobile còn câu “Chữ ký số”/“khách đã ký” không được chứng minh bằng nghiệp vụ hiện tại.
8. **Buffer không phải tiền thuê:** FE cần hiển thị thời gian/chargedDays/return option server cấp. 24h hoặc 48h là buffer thay thế; 8h chuyển kho + 8h cleaning không cộng thêm, không tự tính capacity từ các hạn này.
9. **Contract version:** có HTTP không đồng nghĩa tương thích target 1.3.2. Cần đồng bộ enum/nullable/data/meta/error, expectedVersion, idempotency, allowedActions, Media/Payment trước nghiệm thu.

Đây là khoảng cách giữa UI hiện tại và tài liệu, không phải kết luận backend đã hoàn tất tất cả rule mới.

## 7. Backend đã có gì để frontend nối tiếp

Đã thấy controller/DTO trong source cho:

- Catalog/categories/product detail và Staff quản trị product/status.
- Equipment unit list/detail/create/batch/update/labels/maintenance; inventory locations.
- Trip rental eligibility/recommendations; availability và quote theo tripId.
- Rental Order create/list/detail/cancel/cancellation-preview/payment status; tạo payment qua shared Payment.
- Extension quote/create/list và extension payment.

Do đó một số đoạn chú thích FE nói API eligibility/availability chưa tồn tại đã lỗi thời so với source hiện tại. Không thể giữ mock chỉ dựa vào chú thích cũ.

Chưa nghiệm thu API Preparation/Delivery/Return/Documentation/Policy/Admin exceptions trong đợt này. Những nhóm chưa được chứng minh phải chia rõ task BE contract và FE integration; không ghi tất cả backend đã sẵn sàng. Việc có API cũng không tự chứng minh đã đạt Hybrid Return/capacity safety gate phiên bản mới.

## 8. Kết quả kiểm tra kỹ thuật

### Mobile

Đã chạy tại `mobile`:

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

Kết quả không đạt, có 3 vị trí lỗi:

- `ConditionAssessment/index.tsx:81`: dùng `styles.photoInfo` chưa được khai báo.
- `EquipmentChecklist/index.tsx:39`: width kiểu string không phù hợp `ViewStyle`.
- `screens/rental-catalog/index.tsx:670`: typed route `/rental-products/[id]` không khớp union route được generate hiện tại. Route source có tồn tại; cần đồng bộ typed route trước khi kết luận route bị thiếu.

### Web

Kết quả TypeScript từ lượt audit Booking trên cùng source cho thấy các lỗi Rental:

- `StaffRentalProducts.tsx`: import `RentalDepositPolicyType` không có export.
- `staff-products.api.ts`: thiếu export `ChangeStaffRentalProductStatusInput`, `CreateStaffRentalProductInput`, `UpdateStaffRentalProductInput`.

Ngoài ra có lỗi BookingForm, route types `.next` cũ và thiếu module maplibre trong môi trường cài đặt hiện tại. Không quy toàn bộ lỗi web cho Rental. Không chạy lặp lại check toàn web vì source ứng dụng chưa đổi.

Không sửa app, DB, config hoặc ba tài liệu nguồn trong audit này. Chỉ thêm báo cáo tiến độ.

## 9. Task còn lại theo thứ tự có thể triển khai

| Ưu tiên | Nhóm việc | Kết quả cần đạt |
|---|---|---|
| P0 | Đồng bộ Trip contract/auth/DTO và sửa type | Catalog web/mobile dùng dữ liệu đúng, hết mock quyền/tồn, build kiểm tra được |
| P0 | U03–U06 | Cart → server quote → order hold → payment → My Orders/detail/cancel, có expiry/conflict/retry |
| P0 | W05–W06 + U07 + L01–L02 | Task thật sau payment; pick/condition/upload/pack/READY; USER code; Delivery verify/commit/custody |
| P0 | W07–W08 + L03–L04 + U08 + A01–A02 | Thu hồi/session receipt/Inventory ACK/FINAL/SLA; item-level assessment, ADMIN approve, grouped refund và review |
| Theo scope đã chốt | U09–U10 + A05–A06 | Gia hạn có terms version, hồ sơ/biên bản/PDF, refund case và đính chính |
| Theo scope đã chốt | A03–A04 và hoàn thiện master data | Phân công/policy version; deep flag, Media, QR labels, quyền Admin read-only ở tài sản |

Không áp đặt thứ tự này thay cho priority chính thức của backlog; các chức năng P0 trong SOT vẫn cần được nghiệm thu theo phạm vi release thực tế.

## 10. Đoạn có thể đưa thẳng vào file tiến độ

> Rental frontend đã xây 14 trang web liên quan và 12 màn mobile rental/delivery. Web có 2 trang Staff nối API chính cho quản trị sản phẩm và tài sản kho; 2 trang catalog/detail user nối một phần, còn mock quyền thuê, tồn và context; 10 trang còn lại chủ yếu mock, gồm Preparation, packing, return inspection, settlement, lịch, hồ sơ, Delivery task và Admin catalog/inventory. Mobile có 2 màn catalog/detail gọi HTTP nhưng lệch contract bookingId/tripId, thiếu bearer auth và khác DTO; 10 màn Delivery đang mock. Theo danh mục SOT, USER mới có UI U01–U02, còn thiếu U03–U10: cart/quote, payment, My Orders, order detail/cancel, pickup code, deposit/review, extension và hồ sơ biên bản. Admin A01–A06 chưa có flow. Chưa nghiệm thu end-to-end; cần cập nhật Hybrid Return theo Inventory FINAL 72h, grouped refund theo payment source, ADMIN deduction và cleaning/READY. TypeScript web/mobile hiện còn lỗi.
