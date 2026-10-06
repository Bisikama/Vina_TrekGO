# FLOW: LEADER TẠO PUBLIC TRIP (nguồn sự thật)

Actor: LEADER (người thao tác), SYSTEM (kiểm tra và lưu)

## Các bước (đúng thứ tự, không bỏ bước)
1. Leader chọn "Tạo Public Trip".
2. SYSTEM kiểm tra: Leader có quyền tạo Public Trip không?
   - KHÔNG → màn "Không đủ quyền" (nêu lý do thiếu điều kiện) → dừng, có nút quay lại.
   - CÓ → sang bước 3.
3. Leader chọn checkpoint và tạo trail cho trip.
4. Leader nhập thông tin trip (bước 1/2 trên giao diện).
5. Leader bấm "Gửi tạo trip".
6. SYSTEM kiểm tra: dữ liệu trip hợp lệ không?
   - KHÔNG → thông báo lỗi (hiện lỗi ở từng ô sai) → quay lại bước 4, KHÔNG cho sang bước sau.
   - CÓ → màn xem lại (bước 2/2).
7. Leader bấm "Publish" → SYSTEM lưu và publish trip.
8. Trip chuyển sang trạng thái PUBLISHED (user thấy và booking được) → màn thành công.

## Trạng thái trip
(chưa có) → PUBLISHED → (các flow sau: đang di chuyển → hoàn thành)

## Quy tắc kiểm tra dữ liệu (CHỈNH LẠI CHO ĐÚNG NGHIỆP VỤ CỦA MÀY)
- Tên trip: bắt buộc, tối thiểu 5 ký tự
- Ngày khởi hành: bắt buộc, phải ở tương lai
- Số slot tối đa: số nguyên từ 1 tới 20
- Giá/người: bắt buộc, lớn hơn 0
- Điểm tập trung: bắt buộc
- Checkpoint: chọn ít nhất 2, trong đó có ít nhất 1 mốc "required"

## Quy tắc quyền (mock)
Leader mock có: isCertified, completedTrips, hasActiveViolation.
Có quyền khi isCertified = true và hasActiveViolation = false.
Thiếu cái nào thì màn "Không đủ quyền" phải ghi rõ thiếu cái đó.

## Màn hình ↔ bước flow
| Bước | Màn (thư mục trong src/leader_delivery_batch) |
|---|---|
| 1-2 Kiểm tra quyền, đủ quyền | leader_t_o_public_trip_entry_ki_m_tra_quy_n_i_u_ki_n |
| 2 Không đủ quyền | leader_t_o_public_trip_kh_ng_quy_n (mày kiểm tra lại tên thư mục thật) |
| 4 Nhập thông tin (1/2) | ..._b_c_1_2_th_ng_tin_chuy_n |
| 6 Lỗi validate | ..._b_c_1_2_l_i_x_c_th_c_d_li_u |
| 6-7 Xem lại và Publish (2/2) | ..._b_c_2_2_xem_l_i_publish |
| 8 Thành công | trip_publish_success_m_tg_8924_vn |

## ĐIỀU CẦN CHỐT TRƯỚC KHI CODE
- Bước 3 (chọn checkpoint và tạo trail) trong PDF nằm TRƯỚC bước nhập thông tin, nhưng bộ screen chỉ có "bước 1/2 thông tin" và "2/2 xem lại". Chọn checkpoint nằm ở đâu? (a) thêm vào bước 1/2, hay (b) làm thêm màn riêng?
  → Quyết định của tôi: ______