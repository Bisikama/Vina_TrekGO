# Giải thích tiền cọc cho Frontend

## Phạm vi bàn giao

- Backend bổ sung dữ liệu giải thích tiền cọc cho danh mục, báo giá, chi tiết đơn và gợi ý thuê của Gear Advisor.
- Bộ đọc ảnh Gear chấp nhận `null` ở đơn vị hoặc vị trí nguồn của bằng chứng do AI trả về. Thông số kỹ thuật vẫn cần có bằng chứng tương ứng và người dùng xác nhận trước khi lưu.
- Sửa và bổ sung test cho luồng hủy chuyến; thay đổi này không thêm API hoặc thay đổi giao diện cho khách.
- Các thay đổi này chưa tự cập nhật giao diện. Frontend cần tích hợp các trường mới; phải kiểm tra backend tại môi trường sử dụng đã được triển khai bản thay đổi.

## API và vị trí trường

| API | Vị trí | Ý nghĩa |
| --- | --- | --- |
| `GET /api/v1/rental-products/:id` | Trong object sản phẩm | Giá hiện tại của một món; phù hợp trang chi tiết sản phẩm. |
| `GET /api/v1/rental-products` | Mỗi phần tử `items[]` | Giá hiện tại của từng sản phẩm, kể cả từng hạng. |
| `GET /api/v1/staff/rental-products` và `GET /api/v1/staff/rental-products/:id` | Object sản phẩm / `items[]` | Cùng cấu trúc catalog, dành cho staff theo quyền hiện có. |
| `POST /api/v1/rentals/quote` | Mỗi phần tử `items[]` | Giá và tỷ lệ tại thời điểm tạo báo giá. |
| `GET /api/v1/rental-orders/:id` | Mỗi phần tử `items[]` | Giá và tỷ lệ đã chốt của đơn. |
| `POST /api/v1/gear/plans/:id/options` | Mỗi phần tử `options[].rentalLines[]` | Giá và tỷ lệ ước tính khi tạo phương án. |

Ví dụ một dòng báo giá cho hai món (VND):

```json
{
  "quantity": 2,
  "depositPerUnit": 750000,
  "replacementValue": 2500000,
  "depositAmount": 1500000,
  "depositExplanation": {
    "percentageOfReplacementValue": 30,
    "formula": "depositPerUnit / replacementValue * 100"
  }
}
```

Frontend có thể hiển thị “750.000đ ÷ 2.500.000đ × 100% = 30%”; định dạng tiền bằng `Intl.NumberFormat('vi-VN')`. Tỷ lệ là tỷ lệ tương ứng của tiền cọc thực tế mỗi món so với giá trị thay thế, làm tròn nửa lên đến 2 chữ số thập phân. Đây không nhất thiết là tỷ lệ cấu hình chính sách cọc. Không dùng tỷ lệ để tính tiền hoặc cộng giá trị thay thế vào số phải trả. Nếu tỷ lệ là `null`, ẩn phép chia và tỷ lệ.

Ở API catalog, `depositPerUnit` là tiền cọc hiện tại mỗi món theo quy tắc báo giá; trường này có thể là `null` nếu dữ liệu cũ không hợp lệ để tính bằng VND nguyên. Trường `depositPolicy.amount` vẫn được trả; với dữ liệu hợp lệ, giá trị này cũng dùng mức cọc nguyên VND của báo giá (có thể khác giá trị thập phân trước đây). Dùng `depositPerUnit` cho phần giải thích. Giá catalog có thể thay đổi trước khi tạo báo giá.

Quote và đơn dùng snapshot tại thời điểm báo giá và đặt đơn. Gear advisor dùng dữ liệu sản phẩm tại thời điểm tạo phương án, chỉ là ước tính; tiền cọc cả dòng của Gear có tên `deposit`, không phải `depositAmount`. Các phương án Gear đã lưu trước thay đổi có thể thiếu trường mới, vì vậy client cần xử lý trường vắng mặt và tạo lại phương án khi cần.

Tiền cọc cả dòng bằng tiền cọc mỗi món nhân số lượng, không nhân số ngày. Các trường và tổng hiện có không thay đổi.

## Việc Frontend cần làm

1. Cập nhật kiểu dữ liệu và mapper để giữ lại `depositPerUnit`, `replacementValue` và `depositExplanation`. Mapper sản phẩm web hiện chưa giữ hai trường mới; chỉ cập nhật backend sẽ chưa làm màn hình tự hiển thị tỷ lệ.
2. Trên chi tiết sản phẩm, hiển thị cọc mỗi món và tỷ lệ do server trả. Ví dụ: “Tiền cọc: 750.000đ/món”, “Tương ứng 30% giá trị thay thế”. Có thể hiển thị thêm phép chia từ các giá trị đã trả, không tự tính lại tỷ lệ hoặc số tiền.
3. Kiểm tra trường bị thiếu hoặc `null` trước khi hiển thị; không thay bằng 0%. Khi có nhiều hạng, lấy dữ liệu riêng của hạng đang chọn.
4. Trên báo giá và chi tiết đơn, tiếp tục hiển thị tiền thuê và cọc thành hai khoản. Trên Gear Advisor, `deposit` là cọc cả dòng; `depositPerUnit` mới là cọc mỗi món. Dùng nhãn “Ước tính” cho phương án Gear.

## Trạng thái đọc thông số bằng AI

Khi gọi `POST /api/v1/gear/extractions`, response `201` với `manualEntry.required: true` là bản nháp cần nhập tay. Dùng `manualEntry.messageVi` để thông báo; không ghi rằng AI đã nhận diện thành công. `manualEntry: null` cho biết bản nháp không được tạo theo nhánh nhập tay; vẫn cần kiểm tra dữ liệu và xác nhận trước khi lưu. Response có thể là kết quả từ cache, nên không dùng riêng giá trị này để khẳng định Gemini vừa được gọi.

`MEDIA_PROVIDER_ERROR` với `retryable: true` là lỗi có thể thử lại; ví dụ `read ECONNRESET` xảy ra khi backend tải ảnh từ kho lưu trữ. Frontend nên hiển thị thông báo dễ hiểu thay cho chi tiết kỹ thuật và cho phép người dùng thử lại. Trường hợp này chưa chứng minh AI đã nhận ảnh.

## Kiểm tra tích hợp

- Mở DevTools → Network → Response của `GET /api/v1/rental-products/:id`, kiểm tra ba trường mới và so sánh tỷ lệ với giá trị thay thế và cọc của cùng món.
- Kiểm tra một sản phẩm có hai hạng, một đơn nhiều món và trường hợp tỷ lệ `null`; không hiển thị giá trị thay thế trong tổng thanh toán.
- Đối chiếu `feeAmount`, `depositAmount`, `totalAmount` của quote với phần hiển thị; kiểm tra Gear dùng `deposit` cho cọc cả dòng.
- Thử response đọc ảnh thành công và nhánh `manualEntry.required: true`; chỉ xác nhận lưu sau khi người dùng kiểm tra dữ liệu.
