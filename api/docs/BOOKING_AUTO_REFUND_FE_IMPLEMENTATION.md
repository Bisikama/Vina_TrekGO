# Hướng dẫn sửa frontend cho hoàn tiền booking tự động

Ngày đối chiếu: 05/11/2026. Đây là hướng dẫn triển khai FE, chưa phải xác nhận các thay đổi đã áp dụng vào giao diện. Không sửa backend, rental, trail, auth hoặc database trong tác vụ FE này.

Tổng thể nghiệp vụ, database và SQL minh chứng xem [VNPAY_SANDBOX_REFUND_FRONTEND_HANDOFF.md](VNPAY_SANDBOX_REFUND_FRONTEND_HANDOFF.md). Tài liệu này tập trung vào chỗ FE đang lệch và cách sửa.

## 1. Những chỗ hiện chưa khớp backend

| File/khu vực | Hiện trạng | Thay đổi cần áp dụng |
|---|---|---|
| `web/src/features/bookings/types/booking.types.ts` | RefundItem chỉ có ID, status, amount | Mở rộng type refund và thêm type response hủy |
| `web/src/features/bookings/booking.api.ts` | Khai báo Booking.refunds riêng, cũng thiếu trường | Dùng lại type chung; giữ wrapper đang được BookingCheckout/payment-return sử dụng |
| `web/src/features/bookings/services/booking.api.ts` | cancelBooking chỉ khai báo status/refundableAmount | Trả toàn bộ CancelBookingResponse, không bỏ refund/refundProcessingStatus |
| `web/src/features/bookings/hooks/useBookingMutations.ts` | Hook hủy chỉ khai báo Promise<{status}> | Trả cùng type với API service |
| `web/src/features/bookings/components/BookingCancellation.tsx` | Chỉ lưu refundableAmount và báo “xử lý riêng qua cổng thanh toán” | Lưu toàn bộ kết quả, hiển thị COMPLETED/PENDING/NOT_REQUIRED và nhãn mô phỏng |
| BookingCheckout/MyBookings | Callback sau hủy có refresh, nhưng thiếu khối theo dõi refund mới | Đọc lại booking, hiển thị refund trong chi tiết; không chỉ dựa state tạm của component hủy |
| `web/src/app/(private)/(user)/payment-return/page.tsx` | isSuccess vẫn suy từ vnp_ResponseCode/resultCode dù đã tải booking | Nhánh booking phải lấy trạng thái backend làm nguồn xác nhận; thêm trạng thái đang xác minh |
| `web/src/features/trips/components/TripCancellationRequests.tsx` | SUCCEEDED được ghi chung “Đã hoàn tiền” | Đổi thành “Đã ghi nhận hoàn”; tách tiến độ hủy và tiến độ hoàn, không khẳng định tiền về ngân hàng |
| Lịch sử booking | Hàm lịch sử hiện thấy ở rental cố định source=RENTAL | Tạo hàm đọc source=BOOKING trong feature booking; không đổi hàm rental thành dữ liệu booking |
| Dòng tiền admin | Chưa thấy web/src gọi các endpoint cashflow/transactions admin | Nếu tích hợp màn hình admin, dùng contract VNPay sandbox mới; không dựng số liệu từ danh sách một trang |

Phải giữ các luồng checkout/return rental và trail hiện có khi sửa component return dùng chung. Không xóa module MoMo/PayOS của đội khác; chỉ giới hạn màn hình báo cáo đang làm theo contract mới.

## 2. Backend frontend phải sử dụng

Backend tự hoàn sau khi hủy hợp lệ. FE chỉ cần POST hủy, đọc kết quả và refresh. **Không gọi thêm API simulate của admin sau mỗi lần khách hủy.**

| Endpoint (prefix `/api/v1`) | Cách dùng |
|---|---|
| GET /bookings/:id/cancellation-preview | canCancel, refundableAmount dự kiến, rentals blockers, tripCancellationPending |
| POST /bookings/:id/cancellations | Body {reason}, Idempotency-Key; HTTP 202 trả trạng thái hủy và trạng thái hoàn thực tế |
| GET /bookings/:id | Đọc lại booking, paymentSummary, refunds khi reload/poll |
| GET /user/transactions?source=BOOKING | Lịch sử của user đăng nhập, có dấu mô phỏng và trạng thái hoàn |
| GET /admin/cashflow/summary | Tổng thu/chi sandbox, pending riêng |
| GET /admin/transactions | Danh sách cùng phạm vi với summary, có phân trang/filter |
| GET /admin/payments/:id và /admin/refunds/:id | Chi tiết giao dịch cùng owner và nguồn thanh toán |

API thành công ở bảng này trả object trực tiếp: Axios đọc `response.data`. POST admin simulate riêng trả `{data: ...}` nên đọc `response.data.data`. Lỗi chung đọc `error.response?.data?.error`, không lấy top-level message/code.

### Khác biệt dữ liệu cần hỗ trợ ngay

Booking detail hiện có executionMode, purpose, status, refundedAt nhưng chưa có warnings/settlementMode của simulation; confirmationSource vẫn có thể null dù refund mô phỏng SUCCEEDED.

Vì vậy nhận diện **loại giao dịch** bằng executionMode; xác định **hoàn tất** bằng refund.status. Không coi confirmationSource null là FAILED. Không tự điền confirmationSource='PROVIDER' hoặc gán ngân hàng đã xác nhận. Response hủy, lịch sử user và detail admin cung cấp thông tin simulation đầy đủ hơn.

## 3. Bước 1 — Đồng bộ types, API service và hook

Thêm các type dùng chung ở `features/bookings/types/booking.types.ts`; có thể thay RefundItem bằng alias BookingRefund để giữ tương thích import hiện có:

```ts
export interface BookingRefund {
  refundId: string;
  paymentId: string;
  purpose: string;
  amount: string;
  currency: string;
  status: string;
  executionMode: string;
  confirmationSource: string | null;
  refundedAt: string | null;
  reconciliationRequired: boolean;
  reasonCode?: string | null;
  settlementMode?: string;
  warnings?: string[];
}

export type RefundItem = BookingRefund;

export interface CancelBookingResponse {
  bookingId: string;
  cancellationId: string;
  status: 'CANCELLED';
  refundableAmount: string;
  currency: string;
  refundProcessingStatus: 'COMPLETED' | 'PENDING' | 'NOT_REQUIRED';
  refund: BookingRefund | null;
}
```

Trong `features/bookings/booking.api.ts`, import BookingRefund để khai báo `Booking.refunds: BookingRefund[]`; không giữ một type 3 trường độc lập. Không xóa wrapper này vì checkout/return đang sử dụng.

Trong `features/bookings/services/booking.api.ts`, import CancelBookingResponse và thay khai báo cancelBooking bằng phiên bản sau (dùng lại apiClient và headers đang có trong file):

```ts
cancelBooking: async (
  bookingId: string,
  reason: string,
  idempotencyKey: string,
): Promise<CancelBookingResponse> => {
  const response = await apiClient.post<CancelBookingResponse>(
    `/api/v1/bookings/${encodeURIComponent(bookingId)}/cancellations`,
    { reason },
    headers(idempotencyKey),
  );
  return response.data;
},
```

Hook useBookingMutations.cancelBooking đổi return type thành `Promise<CancelBookingResponse>` và tiếp tục return nguyên kết quả service. Wrapper bookingApi.cancel nếu được sử dụng cũng khai báo cùng type; không thêm tầng unwrap không có trong response backend.

## 4. Bước 2 — Sửa BookingCancellation và cách refresh

Thay `useState<string | null>` của result bằng `useState<CancelBookingResponse | null>`. Thay `setResult(value.refundableAmount)` bằng `setResult(value)`.

Giữ preview, lý do, chặn double-click và key hiện có. Nhánh thành công lựa chọn thông báo theo bảng sau:

| Điều kiện | Nội dung |
|---|---|
| NOT_REQUIRED, refund null | “Đã hủy đặt chỗ. Không phát sinh khoản hoàn.” |
| refund SUCCEEDED và mode mô phỏng | “Đã hủy đặt chỗ. Đã ghi nhận hoàn mô phỏng [refund.amount].” |
| PENDING, refund PENDING/PROCESSING hoặc null | “Đã hủy đặt chỗ. Khoản hoàn đang chờ ghi nhận mô phỏng.” |
| refund FAILED | “Đã hủy đặt chỗ. Hoàn mô phỏng không thành công, cần kiểm tra.” |
| Dữ liệu thiếu/mâu thuẫn | “Đã hủy đặt chỗ. Đang xác minh trạng thái khoản hoàn.” rồi refetch |

Không báo hoàn thành chỉ vì HTTP 202, status booking CANCELLED, refundableAmount > 0 hoặc refund có ID. Số tiền đã ghi nhận hoàn lấy từ refund.amount, không lấy preview làm bằng chứng.

Có thể dùng helper nhận diện loại mô phỏng:

```ts
function isSimulatedRefund(refund: BookingRefund): boolean {
  return refund.executionMode === 'SANDBOX_SIMULATED'
    || refund.settlementMode === 'SANDBOX_SIMULATED'
    || refund.confirmationSource === 'SANDBOX_SIMULATION';
}
```

Helper này không kiểm tra thành công. Phải kết hợp `refund.status === 'SUCCEEDED'` trước khi dùng câu “Đã ghi nhận hoàn mô phỏng”.

Đối với khoản mô phỏng, thêm badge “Sandbox / mô phỏng” và chú thích “Không có tiền thật được chuyển về tài khoản ngân hàng.” Bỏ thông báo cũ “được xử lý riêng qua cổng thanh toán” trong nhánh này.

### Refetch và polling

- Sau POST hủy: refetch chi tiết booking, danh sách booking và lịch sử booking nếu đang hiển thị. Dùng cơ chế fetch/cache hiện có, không thêm thư viện state mới chỉ cho thay đổi này.
- Component hủy có thể bị unmount khi canCancel=false; vì vậy hiển thị khối refund trong **chi tiết booking** để reload hoặc đóng modal vẫn thấy kết quả.
- Với PENDING, lấy refund mới từ GET booking detail; nếu chưa có refund thì tiếp tục đọc, không kết luận không được hoàn.
- Poll mỗi 2 giây, tối đa 30 lần. Khi dừng mà chưa có kết quả, giữ trạng thái “Đang xử lý”, cung cấp “Tải lại”; không tự chuyển FAILED do hết thời gian chờ.
- Cleanup timer và request khi unmount/đổi booking. Dừng khi thấy refund liên quan ở trạng thái cuối hoặc xác nhận NOT_REQUIRED.
- Lỗi mạng sau POST: giữ key và body cũ cho retry cùng thao tác. Nếu người dùng đổi lý do sau lỗi validation/conflict, tải lại preview/trạng thái rồi bắt đầu thao tác mới với key mới; không đổi payload dưới một key đã được backend ghi nhận.

## 5. Bước 3 — Sửa payment-return cho nhánh booking

Hiện trang return xác định isSuccess từ query string. Chỉ thay nhánh có bookingId:

1. Bắt đầu bằng trạng thái “Đang xác minh thanh toán”.
2. GET booking detail; poll khi payment còn PENDING/PROCESSING hoặc domain application chưa xong.
3. Báo booking thành công khi paymentSummary.status=SUCCEEDED, applicationStatus=APPLIED và booking ở trạng thái xác nhận phù hợp. Nếu booking đã CANCELLED thì hiển thị tình trạng hủy/hoàn hiện tại, không ép thành màn hình booking thành công.
4. Payment SUCCEEDED nhưng applicationStatus=REJECTED: báo khoản thu đã ghi nhận nhưng không áp dụng được; theo dõi TECHNICAL_REVERSAL và hiện trạng thái hoàn mô phỏng.
5. Không dùng vnp_ResponseCode=00 hoặc việc forward tham số về IPN thành công để tự xác nhận. RspCode IPN là acknowledgement, không phải bằng chứng worker đã áp dụng booking.
6. Thiếu bookingId và không khôi phục được ngữ cảnh: báo chưa xác định, cho quay về danh sách booking; không gán bừa giao dịch.

Giữ logic rental/trail riêng. Không sửa backend hoặc biến endpoint webhook thành API mà frontend gọi để tự khai báo thành công.

## 6. Bước 4 — Hiển thị chi tiết và lịch sử hoàn

Trong khối refund của BookingCheckout/chi tiết booking, hiển thị từng refund theo refundId: số tiền, trạng thái, purpose, refundedAt và nhãn mô phỏng. Không đổi trạng thái booking thành REFUNDED; trạng thái hoàn và trạng thái booking là hai thông tin riêng.

Tạo hàm lịch sử BOOKING trong feature booking, dùng apiClient có auth interceptor hiện có:

```ts
// Bổ sung type theo UserTransactionsResponseDto của backend.
const response = await apiClient.get('/api/v1/user/transactions', {
  params: { source: 'BOOKING', page: 1, pageSize: 20 },
});
const { items, pagination } = response.data;
```

Không gọi listRentalTransactions rồi đổi nhãn thành booking vì hàm đó gửi source=RENTAL. Không gọi endpoint admin để lấy dữ liệu cho user.

PAYMENT SUCCEEDED vẫn là khoản thu kể cả sau hoàn. REFUND SUCCEEDED là khoản chi mô phỏng riêng. Dùng ID giao dịch làm key, không gộp theo số thẻ test; hai user dùng cùng thẻ test vẫn là hai payment khác nhau. Không cộng cùng refund hai lần khi ghép response hủy với lịch sử.

## 7. Bước 5 — Trang hủy chuyến và admin dòng tiền

### Trang hủy cả chuyến

`TripCancellationRequests.tsx` cần phân biệt “đã duyệt hủy”, “đã hủy các booking” và “đã ghi nhận hoàn”. Refresh tiến độ theo API detail request hiện có, không kết luận mọi khoản đã hoàn ngay khi approve trả HTTP 202.

Danh sách detail.refunds hiện là **thống kê nhóm theo status**, không phải từng refund có executionMode. Không tự gắn nhãn “tất cả đã hoàn mô phỏng” chỉ vì một nhóm SUCCEEDED. Dùng câu trung tính “Khoản hoàn đã ghi nhận”; muốn chứng minh một khoản là mô phỏng, mở dữ liệu booking/refund detail có metadata tương ứng. Không trộn số liệu rental với booking.

### Admin dòng tiền

Nếu bổ sung trang admin, đặt nhãn “Dòng tiền VNPay sandbox / demo”. Dùng cùng gateway/source/from/to giữa summary và list. Mặc định gateway=vnpay; ALL/BOTH chỉ có VNPay. source=BOOKING nếu màn hình chỉ theo dõi booking.

- Tổng thu: payment VNPay sandbox SUCCEEDED.
- Tổng chi: refund mô phỏng SUCCEEDED có payment gốc VNPay sandbox thành công.
- Pending: thống kê riêng, không cộng vào tổng chi hoàn tất.
- Không tính tổng từ items của một trang; lấy totals backend.
- Bỏ lựa chọn PayOS/MoMo trong màn hình này; backend trả 400 cho filter không hỗ trợ. Trường PayOS cũ null/0.
- API GET /admin/refunds/:id là nguồn detail cho admin. Detail ngoài phạm vi sandbox trả 404.

Nút admin giả lập chỉ phục vụ kiểm thử/phục hồi và cần quyền ADMIN. Khách hủy không được gọi nó. Nếu làm nút, chỉ hiện khi canSimulateSandbox và trạng thái phù hợp; POST `/admin/payment-refunds/:refundId/sandbox-simulate-settlement` với reason, acknowledgeSandboxSimulation=true, expectedProviderStatus và Idempotency-Key. Đọc kết quả lồng data, rồi refetch detail/list/summary.

Không phụ thuộc GET `/admin/payment-refunds/:id/sandbox-simulation` trong runtime production vì endpoint legacy còn guard môi trường cũ. Không gửi amount, payment owner hoặc tài khoản nhận từ FE.

## 8. UI dùng chung, lỗi và tiêu chí hoàn tất

Tái sử dụng `@/components/ui` theo README/index hiện có: PageShell, PageHeader, SurfaceCard, Button, FormField, StatusBadge, LoadingState, EmptyState, ErrorAlert. Dùng formatMoneyVND/money hiện có để hiển thị, giữ tiền từ API là string; không nhân/chia 100 ở refund. Chuyển đổi đơn vị VNPay chỉ thuộc giao thức thanh toán/backend.

Lỗi HTTP: đọc error.code/message/details/retryable trong error.response.data.error. 409 cần tải lại trạng thái/preview; 401 dùng xử lý auth chung. Lỗi hủy không tự biến thành hoàn thành hoặc tự tạo refund phía client.

Checklist nghiệm thu:

- [ ] Thanh toán sandbox, backend xác nhận, user hủy: hiện hoàn mô phỏng ngay khi refund SUCCEEDED.
- [ ] Hoàn một phần/100% hiển thị đúng amount; chưa trả tiền/0% hiện không phát sinh hoàn.
- [ ] Refund PENDING hoặc null sau hủy vẫn hiện chờ xử lý; không báo không được hoàn chỉ vì null.
- [ ] Reload chi tiết sau hủy vẫn thấy refund và badge, kể cả confirmationSource ở booking detail là null.
- [ ] Lỗi mạng/retry không tạo thao tác mới hoặc hiển thị trùng khoản hoàn.
- [ ] Query return bị sửa thành thành công nhưng backend chưa xác nhận: UI vẫn chờ xác minh.
- [ ] Payment thu thành công nhưng application REJECTED: UI giải thích khoản hoàn kỹ thuật.
- [ ] Hai user cùng thẻ test không thấy giao dịch của nhau.
- [ ] Hủy cả chuyến: tiến độ booking và refund không bị gộp thành một trạng thái thành công duy nhất.
- [ ] Summary/list admin khớp filter; pending không cộng vào tổng chi; không có PayOS/MoMo.
- [ ] Không có câu “tiền đã về ngân hàng”, “VNPay đã hoàn” hoặc số dư ví/thẻ giả.
- [ ] Không có thay đổi ngoài phạm vi booking/CF01 và UI báo cáo liên quan.

Thứ tự áp dụng: types → services/hook → component hủy và detail → payment-return → lịch sử user → trang hủy chuyến/admin → kiểm thử. Chạy typecheck/build web theo scripts hiện có và các kiểm thử UI cần thiết sau khi thực sự sửa FE; việc tạo tài liệu này không phải một lần chạy kiểm thử giao diện.
