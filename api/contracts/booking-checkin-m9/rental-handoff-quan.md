# Bàn giao Quân — phần Rental của M9

Ngày 26/10/2026. Đây là đề xuất tích hợp, chưa sửa code Rental, chưa gửi tự động cho Quân. Booking cung cấp `BookingParticipationContextService` qua BookingsModule và events/version theo [contract](./README.md).

## Các file cần Quân rà

| File (từ api/src/modules/rental) | Hiện trạng / đề xuất |
|---|---|
| ordering/infrastructure/adapters/prisma-rental-context.adapter.ts | Đang tự phân giải Private member/Public leader/participant/buyer; production có nhánh gọi /internal/trips/:id/rental-context. Rà contract thực tế của endpoint, không coi service Booking mới là endpoint này. |
| shared/public-booking-membership.ts | Đang cho buyer có booking hợp lệ thuê dù không có vé bản thân. Xác nhận đây là chính sách được duyệt. |
| ordering/application/ports/rental-context.port.ts | Hiện membershipRef chưa có discriminator. Đề xuất thêm membershipKind và lưu nguồn/version rõ ràng sau khi thống nhất tương thích dữ liệu cũ. |
| ordering/infrastructure/adapters/prisma-rental-order.adapter.ts | Context snapshot được so version nhưng cần bảo vệ quyền khi tạo order. Cùng DB: lấy lockAndRead trước khóa quote/order/stock trong cùng transaction. Rà deadlock và retry trước khi tích hợp. |
| payments/rental-membership.guard.ts | Có nhánh participant/buyer legacy; so khớp nguồn được lưu, bookingId không tự đủ làm authorization. Tái kiểm tra khi thanh toán, giữ tương thích đơn cũ. |
| lifecycle/* | Xử lý cancellation/leave/remove/rejoin theo SOT; dedupe/receipt theo consumer, kiểm tra version và nguồn của đơn để event cũ không tác động lần tham gia mới. |

## Quyết định Quân cần xác nhận

1. A mua một vé cho B, A không đi: code hiện cho A thuê qua BOOKER và B qua participant sau accept. Giữ hay đổi quyền mua hộ? Mỗi người hiện tự là recipientOption của mình; không mặc định A chọn B nhận đồ.
2. Khi một account có nhiều nguồn hợp lệ: ưu tiên nguồn nào và có giữ cố định nguồn trên đơn đã tạo hay không? Context Booking trả tất cả sources, chưa tự chốt precedence.
3. Cutoff từ meetingAt/startAt theo Rental policy; điều kiện participant/booking COMPLETED và trạng thái trip phải nhất quán ở eligibility/create/payment.
4. Khi mất quyền và đã có đơn thuê: chặn tạo mới và xử lý đơn đang tồn tại theo trạng thái paid/preparing/handed-over. Không mặc định hủy hết hoặc bắt buộc user hủy trước; refund/stock/custody do Rental quyết định theo SOT.
5. Chốt migration/FK cho membershipRef đa hình: BookingParticipant, Booking buyer, Private TripMember, Public leader. Không dùng participant UUID vào FK chỉ trỏ TripMember.

Tài liệu SOT được api/AGENTS.md chỉ tới docs/rental/README.md và docs/rental/sot (Policy 1.5.2, Flow/FR 1.3.2) hiện không tìm thấy trong workspace này. Quân cần đối chiếu bản gốc trước khi quyết định nghiệp vụ Rental; code là bằng chứng hiện trạng, không thay thế chính sách.

## Checklist nghiệm thu phía Rental

- A chỉ mua 1 vé cho B: A vẫn sở hữu booking, B nhận vé và tạo đơn thuê bằng tài khoản B; không lộ booking/payment riêng tư cho B.
- Pending/declined/expired invitation không tạo nguồn quyền participant. Self-claim không tạo hai danh tính thuê cho cùng nguồn.
- Quyền mất trước transaction tạo order → từ chối; order tạo trước → lifecycle theo SOT. Kiểm thử thực tế cả hai thứ tự, không chỉ mock context.
- Payment success đến sau cancellation; buyer/participant/leader/member cũ còn được xử lý tương thích nhưng không vượt quyền.
- Leave/remove/rejoin + event cũ/replay không hủy nhầm đơn mới; consumer có receipt riêng và dedupe.
- Hết cutoff, thiếu logistics, hết stock, open order trùng, quote stale đều bị chặn đúng API.

**Trạng thái:** Booking/Check-in local đã có contract/test; Rental integration và E2E liên module chờ Quân. `canRent=false` trên vé vẫn giữ cho tới nghiệm thu; không dùng field này làm bằng chứng toàn module Rental đã bị tắt.
