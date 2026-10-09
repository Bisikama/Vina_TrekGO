# TEST MATRIX — VINA_TREKGO AREA B

Dưới đây là ma trận kiểm thử chi tiết cho Phase 00–04.

| Test ID | Phase | Yêu cầu nghiệp vụ | Mục tiêu | Input / Scenario | Kết quả mong đợi (Expected) | Loại Test | Trạng thái |
|---|---|---|---|---|---|---|---|
| T-00-01 | Ph00/01 | Quản lý Catalog | Xác minh chỉ role STAFF_INVENTORY và ADMIN được tạo/sửa Catalog. | User với role USER gửi request tạo RentalCategory. | 403 Forbidden. | E2E | NOT_RUN |
| T-00-02 | Ph00/01 | Validation Catalog | Kiểm tra dữ liệu khi tạo RentalProduct. | Gửi request thiếu basePrice hoặc name. | 400 Bad Request (Validation failed). | Unit / E2E | NOT_RUN |
| T-02-01 | Ph02 | Quản lý EquipmentUnit | Đảm bảo tính duy nhất của `assetCode`. | Tạo 2 EquipmentUnit cùng một `assetCode`. | Lỗi Unique constraint vi phạm. | Integration | NOT_RUN |
| T-02-02 | Ph02 | Status Transition | Không thể chuyển trạng thái unit vật lý từ RENTED sang AVAILABLE mà bỏ qua quá trình kiểm tra. | Unit đang ở RENTED, request sang AVAILABLE. | Bị từ chối (Domain logic error). | Unit | NOT_RUN |
| T-02-03 | Ph02 | Optimistic Locking | Đảm bảo an toàn khi nhiều request cập nhật cùng một Inventory record. | Hai request (A, B) cùng update một bản ghi với `version` cũ. | Request B thất bại (Concurrency Exception). | Integration | NOT_RUN |
| T-03-01 | Ph03 | Quote TTL | Quote chỉ tồn tại trong 10 phút. | Lấy một Quote đã tạo 11 phút trước để tiến hành Order. | Bị từ chối (Quote expired). | Unit / E2E | NOT_RUN |
| T-03-02 | Ph03 | Tạo Order concurrency | Ngăn chặn cấp quá số lượng tồn kho (Overbooking). | Gửi 5 request đặt hàng đồng thời cho 3 sản phẩm còn lại. | 3 thành công, 2 thất bại (Out of stock). | Integration | NOT_RUN |
| T-03-03 | Ph03 | Duplicate RentalOrder | Một User không được có 2 RentalOrder active trên cùng 1 Trip. | Tạo Order B khi Order A đang active cho cùng 1 User+Trip. | Bị từ chối (Already has active order). | Integration | NOT_RUN |
| T-03-04 | Ph03 | Idempotency tạo Order | Tránh tạo đơn hàng 2 lần cho cùng một intent. | Gửi 2 request với cùng Idempotency-Key. | Request 2 trả về kết quả của Request 1. | Integration | NOT_RUN |
| T-03-05 | Ph03 | Transaction Rollback | Đảm bảo Order không được lưu nếu lưu RentalOrderLine thất bại. | Giả lập lỗi ở bước lưu RentalOrderLine. | RentalOrder cũng không được lưu trong Database. | Integration | NOT_RUN |
| T-04-01 | Ph04 | Payment Webhook Duplicate | Xử lý webhook được gọi 2 lần từ provider. | Gửi 2 webhook cho cùng một Payment ID. | Request 2 bị bỏ qua / báo success mà không cộng tiền lần 2. | Integration | NOT_RUN |
| T-04-02 | Ph04 | Payment Timeout/Late | Xử lý webhook thành công đến sau khi Payment Timeout. | Webhook "Success" được gửi sau khi hệ thống đã đánh dấu Payment là FAILED/EXPIRED. | Payment được ghi nhận lại, hoặc refund tùy business rule. | Unit / E2E | NOT_RUN |
| T-04-03 | Ph04 | Double Refund | Chống hoàn tiền nhiều lần trên cùng 1 khoản thanh toán. | Gọi API hoàn tiền 2 lần liên tiếp. | Lần 2 báo lỗi khoản thanh toán đã được hoàn. | Integration | NOT_RUN |
| T-04-04 | Ph04 | Transaction Boundaries | PaymentAllocation và cập nhật Order Status phải nguyên tử (atomic). | Giả lập lỗi ở bước cập nhật Order Status. | PaymentAllocation bị rollback. | Integration | NOT_RUN |
| T-04-05 | Ph04 | Invoice Mismatch | Không cho phép thanh toán nếu số tiền Payment Amount khác Total Invoice Amount. | Provider webhook báo số tiền X, nhưng Invoice cần Y. | Đánh dấu Payment nghi ngờ (Partial/Mismatch). | Unit | NOT_RUN |
| T-04-06 | Ph04 | Kích hoạt Warehouse/Task | Tránh tạo trùng lặp Warehouse/Inventory Task sau khi Payment Success. | Gửi webhook success 2 lần cho cùng 1 Order. | Task chỉ được tạo 1 lần. | Integration | NOT_RUN |
