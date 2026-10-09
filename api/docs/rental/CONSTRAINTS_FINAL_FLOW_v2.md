# CONSTRAINTS — Rental FINAL FLOW v2

> Supersedes `CONSTRAINTS_FINAL_FLOW.md` for rental eligibility/time rules. Updated 07/10/2026.

## 1. Eligibility và Trip context
- Rental không còn yêu cầu Booking.
- USER chỉ được mở rental flow khi Area A xác nhận USER có membership hợp lệ trong `tripId` và `rentalEligible=true`.
- Public/Private Trip phải dùng cùng Trip Rental Context; Rental không suy diễn nguồn membership từ Booking/Invite.
- `bookingId` nếu còn lưu chỉ để audit/provenance, không dùng authorize.
- `rentalCutoffAt` do Backend/context quyết định; FE chỉ hiển thị.
- MVP: tối đa một RentalOrder non-terminal cho cùng `userId + tripId`.

## 2. Thời gian thuê
- Trip là nguồn quyền thuê/ngữ cảnh, không còn là giới hạn cứng của `rentalEndAt`.
- `rentalStartAt/rentalEndAt` dùng tính phí; `occupiedFrom/occupiedUntil` dùng availability.
- Mặc định rental window bám planned handover/return của Trip.
- USER được chọn trả muộn hơn Trip nếu Policy, capacity và return option cho phép.
- FE không tự tính ngày thuê, fee hoặc buffer.

## 3. Gia hạn
- USER có thể xin gia hạn RentalOrder trước dueAt; không PATCH trực tiếp `rentalEndAt`.
- MVP gia hạn toàn bộ order, không từng line/unit.
- Extension phải kiểm tra state, policy, capacity delta window và return option.
- Tất cả lines đủ capacity hoặc rollback toàn bộ.
- Dùng `RentalQuantityReservation.reservationCycle` mới để giữ delta window.
- `additionalFee` tính từ total fee mới trừ total fee đã chốt, dùng price/policy snapshot của order.
- `additionalFee > 0`: chỉ apply sau payment success. `additionalFee = 0`: có thể apply sau capacity confirmation.
- Timeout/fail/cancel extension phải release delta hold đúng một lần và giữ dueAt cũ.
- Không retroactive extension sau khi order đã overdue hoặc return đã bắt đầu.
- Mỗi order chỉ có một extension request chưa kết thúc tại một thời điểm.

## 4. Return option sau Trip
- Nếu thời điểm trả mới nằm ngoài logistics window cũ, extension chỉ hợp lệ khi Backend cung cấp `returnOption` có thể phục vụ.
- `returnOption` là abstraction; có thể là điểm TrekGo, điểm tập trung hoặc scheduled collection tùy policy sau này.
- Extension APPLIED phải update/reschedule ReturnTask; không sửa âm thầm task đã bắt đầu.

## 5. Trip reschedule khác USER extension
- Official Trip extension/reschedule là event từ Area A, không phải USER extension.
- Nếu Trip kéo dài khi asset đang ở USER, không thu hồi asset vì conflict; update operational due time và mở `ACTION_REQUIRED` nếu ảnh hưởng future capacity.
- Không tự charge USER do Trip event; điều chỉnh tiền phải là action/adjustment rõ ràng theo Policy.

## 6. Số lượng
- Không có quota theo số Participant.
- Quantity phải là số nguyên dương.
- `availableCount` là giới hạn thực tế tại thời điểm kiểm tra; create order/extension phải recheck trong transaction.
- Đơn nhiều line: giữ đủ toàn bộ hoặc rollback toàn bộ.

## 7. Giữ số lượng và exact unit
- Trước payment/warehouse pick: chỉ biết product + quantity + occupied window.
- Không expose exact EquipmentUnit ở create order.
- Sau payment, STAFF_INVENTORY chọn exact unit lúc pick; mỗi unit chỉ được gán cho một order tại thời điểm đó.
- Extension khi asset đã giao không đổi exact unit; chỉ kéo capacity window của order.
- Unit hỏng trước giao được replace bằng unit cùng product/spec còn hợp lệ.

## 8. Nhập thiết bị và QR
- Mỗi unit vật lý có `assetCode` unique.
- QR là cách nhập nhanh assetCode, không phải nguồn quyền. QR hỏng vẫn cho tìm/nhập mã thủ công.
- Nhập lô mặc định all-or-nothing; duplicate code phải báo lỗi rõ.

## 9. Bàn giao
- User/người nhận mở `pickupCode` ngắn hạn, dùng một lần.
- STAFF_DELIVERY nhập/quét mã; Backend verify đúng order/recipient/trip/điểm/giờ.
- User xem package + condition before; nếu có vấn đề báo Staff. Staff ghi `recipientNotes/reportedIssues`.
- Chỉ STAFF_DELIVERY commit handover; không có mutation User confirmation riêng.

## 10. No-show / từ chối
- Chưa handover thì cọc tài sản không được tự mất.
- No-show do User: cọc hoàn toàn bộ; tiền thuê theo policy snapshot.
- Từ chối vì TrekGo giao sai/hỏng và không thay được: hoàn phần tiền thuê liên quan + cọc.
- Package vẫn có custody cho tới khi STAFF_INVENTORY nhận lại.

## 11. Return và cọc
- Thu hồi theo từng unit.
- Thiếu một unit không chặn xử lý các unit đã trả.
- `NORMAL`: có thể khởi tạo quick refund phần cọc của unit ngay sau server xác nhận.
- `ISSUE`: giữ đúng phần cọc của unit đó và chuyển deep review.
- Chưa trả = `MISSING_PENDING_REVIEW`, không tự kết luận LOST.
- STAFF_INVENTORY chỉ deep inspect unit ISSUE/MISSING hoặc unit phát sinh discrepancy.
- Cọc UI phải minh bạch per-unit: HELD / REFUND_PENDING / REFUNDED / REVIEW_REQUIRED / DEDUCTED.

## 12. AI recommendation
- AI/RULE chỉ quyết định thứ tự gợi ý + lý do.
- Không dùng AI để quyết định eligibility, availability, giá, cọc, payment, extension approval, refund hay state transition.
- AI lỗi phải fallback RULE hoặc noRecommendation, không chặn catalog.

## 13. Concurrency / idempotency
- Create order, payment, extension hold/apply, pick, handover, return scan và refund phải idempotent.
- FE retry cùng thao tác phải giữ cùng Idempotency-Key khi chưa rõ kết quả.
- `expectedVersion` conflict -> refetch, không tự ghi đè.
