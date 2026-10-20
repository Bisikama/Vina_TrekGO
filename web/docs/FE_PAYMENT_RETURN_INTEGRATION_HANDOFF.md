# TÀI LIỆU BÀN GIAO TÍCH HỢP FRONTEND — THANH TOÁN & PAYMENT RETURN (BOOKING, RENTAL & EXTENSION)

> **Dành cho**: Frontend Engineer phụ trách module Giao diện Người dùng & Luồng Thanh toán  
> **Người lập**: Senior NestJS Backend Engineer & Technical Integration Lead (Area B Rental)  
> **Phạm vi**: Đồng bộ luồng xử lý Payment Return cho **Public/Private Booking**, **Đơn thuê thiết bị (Rental Order)**, và **Gia hạn thuê (Rental Extension)**  
> **Mã tài liệu**: `FE_PAYMENT_RETURN_INTEGRATION_HANDOFF`  
> **Phiên bản**: v1.0 — Chuẩn hóa Authoritative Truth từ Backend  

---

## A. TỔNG QUAN LUỒNG THANH TOÁN & PAYMENT RETURN

### 1. Vấn đề cốt lõi cần giải quyết
Hiện tại, trang `payment-return` (`web/src/app/(private)/(user)/payment-return/page.tsx`) chỉ mới phục vụ luồng **Booking chuyến đi (Public Trip)** bằng cách đọc trực tiếp query string từ VNPay/MoMo (`vnp_ResponseCode=00`, `resultCode=0`).

Cách tiếp cận này gặp các vấn đề lớn:
1. **Lỗ hổng bảo mật (URL Spoofing)**: Người dùng có thể tự sửa thanh địa chỉ trình duyệt thành `?vnp_ResponseCode=00&bookingId=...` để giả mạo giao diện "Thanh toán thành công".
2. **Sai lệch sự thật (Payment Truth vs Business Truth)**:
   - Cổng thanh toán báo `00` chỉ chứng minh tiền đã được trừ ở cổng giao dịch.
   - Đơn hàng chỉ thực sự thành công khi Backend xử lý webhook IPN, xác thực chữ ký (checksum), ghi nhận thanh toán (`Payment SUCCEEDED`), và kích hoạt trạng thái nghiệp vụ (Booking `CONFIRMED`, Rental Order `PAID`, hoặc Extension `APPLIED`).
   - Nếu xảy ra xung đột (hết slot giữ chỗ, quá hạn thanh toán), Backend sẽ tự động hoàn tiền (`Refund`), đơn hàng sẽ bị hủy/hết hạn. Giao diện nếu chỉ tin URL sẽ hiển thị sai.
3. **Chưa hỗ trợ Rental Order & Rental Extension**: Khi người dùng thanh toán đơn thuê đồ hoặc gia hạn đơn thuê qua VNPay/MoMo, cổng redirect về `payment-return` nhưng trang chưa nhận diện `rentalOrderId` hay `extensionId`, dẫn đến lỗi hiển thị.

### 2. Chu trình Payment Return chuẩn mực
```
[User thanh toán tại VNPay / MoMo]
                │
                ▼ (Redirect trình duyệt)
[Trang web: /payment-return?rentalOrderId=...&vnp_ResponseCode=00]
                │
                ├─ 1. Đọc params: nhận diện loại đơn (Booking / Rental / Extension) & Gateway (VNPay / MoMo / MOCK)
                ├─ 2. Hiển thị UI ban đầu (Loading / Pending đồng bộ)
                ├─ 3. GỌI GET BACKEND STATUS API (Authoritative Truth):
                │      - Booking:   GET /api/v1/bookings/:id
                │      - Rental:    GET /api/v1/rental-orders/:id/payment
                │      - Extension: GET /api/v1/rental-extensions/:id/payment
                │
                ├─ 4. Polling tự động (nếu trạng thái là PENDING / PROCESSING, poll mỗi 2.5s, tối đa 5 lần)
                │
                ▼ (Backend trả kết quả xác thực)
[Hiển thị kết quả cuối cùng & Nút điều hướng tương ứng]
```

---

## B. DANH SÁCH API BACKEND THỰC TẾ (ĐÃ KIỂM TRA TRONG SOURCE)

Tất cả các API dưới đây đã tồn tại, được kiểm thử và đang hoạt động trên Backend. Frontend KHÔNG tự bịa route hoặc cấu trúc dữ liệu mới.

### 1. Đơn thuê thiết bị: `GET /api/v1/rental-orders/:id/payment` (RB-API-206)
- **Method**: `GET`
- **Full Route**: `/api/v1/rental-orders/:id/payment`
- **Yêu cầu Auth**: `Bearer Token` (Header: `Authorization: Bearer <token>`). Phải là người tạo đơn thuê hoặc Leader chuyến đi.
- **Param**: `:id` — UUID của `rentalOrder`.
- **Response mẫu (HTTP 200)**:
```json
{
  "paymentRef": "b7352377-62cf-4b72-a083-d3a3f5a89401",
  "status": "SUCCEEDED",
  "nextAction": null,
  "expiresAt": null,
  "amount": 250000,
  "refundedAmount": 0,
  "paidAt": "2026-10-19T14:30:00.000Z",
  "invoiceStatus": "PAID",
  "applicationStatus": "APPLIED",
  "applicationReasonCode": null,
  "reconciliationStatus": "RESOLVED",
  "reconciliationRequired": false,
  "gateway": "vnpay",
  "providerEnvironment": "SANDBOX",
  "paymentMethod": "REDIRECT",
  "orderStatus": "PAID",
  "financialStatus": "PAID"
}
```
- **Ý nghĩa các trường quan trọng**:
  - `status`: Trạng thái thanh toán của cổng (`NOT_STARTED`, `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED`).
  - `orderStatus`: Trạng thái thực tế của đơn thuê (`DRAFT`, `PENDING_PAYMENT`, `PAID`, `PREPARING`, `READY_FOR_HANDOVER`, `ACTIVE`, `RETURN_OVERDUE`, `COMPLETED`, `CANCELLED`).
  - **Quy tắc hiển thị Thành công**: Khi `['PAID', 'PREPARING', 'READY_FOR_HANDOVER', 'ACTIVE', 'COMPLETED'].includes(orderStatus)`.
  - **Quy tắc hiển thị Đang xử lý (Pending)**: Khi `orderStatus === 'PENDING_PAYMENT'` hoặc `['PENDING', 'PROCESSING'].includes(status)`.

---

### 2. Yêu cầu gia hạn thuê: `GET /api/v1/rental-extensions/:id/payment` (RB-API-804)
- **Method**: `GET`
- **Full Route**: `/api/v1/rental-extensions/:id/payment`
- **Yêu cầu Auth**: `Bearer Token` (Header: `Authorization: Bearer <token>`).
- **Param**: `:id` — UUID của yêu cầu gia hạn (`extensionId`).
- **Response mẫu (HTTP 200)**:
```json
{
  "extensionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "rentalOrderId": "b7352377-62cf-4b72-a083-d3a3f5a89401",
  "extensionStatus": "APPLIED",
  "invoiceStatus": "PAID",
  "paymentRef": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "paymentStatus": "SUCCEEDED",
  "applicationStatus": "APPLIED",
  "applicationReasonCode": null,
  "reconciliationStatus": "RESOLVED",
  "reconciliationRequired": false,
  "amount": "50000",
  "currency": "VND",
  "expiresAt": null,
  "paidAt": "2026-10-19T15:00:00.000Z"
}
```
- **Ý nghĩa các trường quan trọng**:
  - `extensionStatus`: `QUOTED`, `PENDING_PAYMENT`, `APPLIED`, `REJECTED_CAPACITY`, `EXPIRED`, `PAYMENT_FAILED`, `CANCELLED`.
  - `paymentStatus`: `NOT_STARTED`, `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED`.
  - **Quy tắc hiển thị Thành công**: CHỈ khi `extensionStatus === 'APPLIED'`.
  - **Quy tắc hiển thị Đang xử lý**: Khi `extensionStatus === 'PENDING_PAYMENT'` hoặc `['PENDING', 'PROCESSING'].includes(paymentStatus)`.

---

### 3. Đơn đặt tour (Booking): `GET /api/v1/bookings/:id`
- **Method**: `GET`
- **Full Route**: `/api/v1/bookings/:id`
- **Yêu cầu Auth**: `Bearer Token`.
- **Param**: `:id` — UUID của booking.
- **Response mẫu (HTTP 200)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "CONFIRMED",
  "version": 2,
  "participantCount": 2,
  "totalAmount": "1800000",
  "currency": "VND",
  "trip": {
    "id": "7b0a70f8-c2b3-4f9e-a89c-b16cf29d0101",
    "title": "Chinh phục đỉnh Tà Xùa"
  },
  "paymentSummary": {
    "paymentId": "payment-uuid",
    "status": "SUCCEEDED",
    "gateway": "VNPAY"
  }
}
```
- **Quy tắc hiển thị Thành công**: Khi `['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'].includes(booking.status)`.
- **Quy tắc hiển thị Đang xử lý**: Khi `booking.status === 'PENDING_PAYMENT'` và `['PENDING', 'PROCESSING'].includes(booking.paymentSummary?.status)`.

---

## C. CÁC FILE FRONTEND CẦN THAO TÁC

### 1. `web/next.config.ts` (Next.js API Rewrites)
Nếu Frontend gọi API thông qua cùng origin (`/api/v1/...`), cần bổ sung các prefix của Rental vào danh sách rewrites:
```typescript
// web/next.config.ts
const nextConfig: NextConfig = {
  async rewrites() {
    const api = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
    return [
      'trips',
      'bookings',
      'auth',
      'payments',
      // Bổ sung các resource của Rental:
      'rental-orders',
      'rental-extensions',
      'rentals',
      'rental-products',
      'rental-categories',
    ].map((resource) => ({
      source: `/api/v1/${resource}/:path*`,
      destination: `${api}/api/v1/${resource}/:path*`,
    }));
  },
  // ...
};
```

### 2. `web/src/app/(private)/(user)/payment-return/page.tsx`
Cần mở rộng component để:
1. Đọc cả 3 loại param:
   ```typescript
   const rawBookingId = searchParams.get('bookingId');
   const rawRentalOrderId = searchParams.get('rentalOrderId');
   const rawExtensionId = searchParams.get('extensionId');
   ```
2. Gọi API tương ứng khi mount (`useEffect`).
3. Thực hiện polling nếu kết quả trả về đang là trạng thái chờ (`PENDING` / `PROCESSING`).
4. Hiển thị UI 3 trạng thái:
   - `isPending`: Spinner xoay, icon đồng hồ cát, thông báo "Đang đồng bộ kết quả giao dịch...".
   - `isSuccess`: Icon tick xanh, thông báo thành công và nút chuyển hướng tương ứng.
   - `isFailed`: Icon chéo đỏ, lý do lỗi chi tiết và nút "Thử lại".
5. Điều hướng nút bấm sau thanh toán:
   - **Booking**: "Xem chi tiết chuyến đi" -> `/bookings/${rawBookingId}`.
   - **Rental Order**: "Xem đơn thuê thiết bị" -> `/rentals?orderId=${rawRentalOrderId}`.
   - **Extension**: "Xem đơn thuê thiết bị" -> `/rentals?orderId=${rentalPayment?.rentalOrderId || ''}`.

---

## D. CHI TIẾT YÊU CẦU NGHIỆP VỤ & PHÒNG NGỪA RỦI RO

1. **Tuyệt đối không gọi `createPayment` lại khi mount `payment-return/page.tsx`**:
   - Trang này chỉ là callback nhận kết quả hiển thị.
   - Gọi lại `createPayment` sẽ gây xung đột `IDEMPOTENCY_KEY` hoặc tạo thêm giao dịch trùng lặp không đáng có.
2. **Xử lý môi trường MOCK Sandbox (Development)**:
   - Trong quá trình test dev, Backend có thể trả về môi trường MOCK.
   - Frontend nhận diện nếu query có `mock=true` hoặc không có tham số VNPay/MoMo nhưng có `rentalOrderId`/`bookingId`, hiển thị nhãn `MOCK Sandbox` thay vì báo lỗi giao dịch rỗng.
3. **Phòng chống giả mạo URL (Anti-Tampering)**:
   - Nếu ai đó truy cập `/payment-return?vnp_ResponseCode=00&rentalOrderId=xxx`, nhưng khi gọi backend `GET /api/v1/rental-orders/xxx/payment` mà backend trả về `orderStatus: 'PENDING_PAYMENT'` hoặc `FAILED`, thì giao diện **PHẢI** hiển thị trạng thái thực tế từ Backend, không được hiển thị Thành công.
4. **Không báo Extension APPLIED nếu Backend chưa xác nhận**:
   - Nếu thanh toán thành công nhưng thiết bị không còn đủ số lượng để gia hạn (`extensionStatus === 'REJECTED_CAPACITY'`), Backend sẽ kích hoạt hoàn tiền và chuyển trạng thái yêu cầu gia hạn thành không hợp lệ. Frontend phải hiển thị thông báo gia hạn thất bại.

---

## E. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

| STT | Tiêu chí | Kết quả mong đợi |
| :---: | :--- | :--- |
| **AC-01** | Booking Payment Return cũ | Tiếp tục hoạt động bình thường, chuyển hướng xem vé `/bookings/:id` thành công. |
| **AC-02** | Rental Order Payment Return | Nhận diện `rentalOrderId`, gọi `/api/v1/rental-orders/:id/payment`, nút điều hướng trỏ về `/rentals?orderId=...`. |
| **AC-03** | Rental Extension Payment Return | Nhận diện `extensionId`, gọi `/api/v1/rental-extensions/:id/payment`, chỉ báo thành công khi `extensionStatus === 'APPLIED'`. |
| **AC-04** | Cơ chế Polling | Nếu IPN từ cổng thanh toán về chậm hơn redirect của người dùng, giao diện hiển thị trạng thái chờ và tự động kiểm tra lại tối đa 5 lần (mỗi 2.5s). |
| **AC-05** | Môi trường MOCK Sandbox | Không hiển thị lỗi "Không tìm thấy phiên giao dịch" khi test môi trường MOCK local. |
| **AC-06** | Chống giả mạo URL | URL chứa mã `00` nhưng Backend chưa nhận được tiền sẽ không hiển thị "Thành công". |
| **AC-07** | Bảo vệ UI & UX | Không bị vỡ layout, màu sắc hài hòa với design system hiện tại (`#125238`, Emerald, Amber, Rose). |

---

## F. DANH SÁCH THAY ĐỔI THAM KHẢO (ĐÃ ĐƯỢC LƯU TRONG EVIDENCE PATCH)

Bản mẫu tham khảo đầy đủ đã được lưu tại:  
`handoffs/rental/evidence/web_payment_return_v2_reference.patch`

Tóm tắt các đoạn code thay đổi chính:
1. **Import `apiClient`**:
   ```typescript
   import { apiClient } from '@/lib/axios';
   ```
2. **Mở rộng State & Polling Hook**:
   ```typescript
   const [rentalPayment, setRentalPayment] = useState<any | null>(null);
   const [extensionPayment, setExtensionPayment] = useState<any | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   ```
3. **Logic kiểm tra Backend Authoritative Truth**:
   - Lấy dữ liệu và xác định `isSuccess` dựa trên `orderStatus` / `extensionStatus`.

---

## G. CÁC DEPENDENCY TỪ BACKEND / AREA A CẦN BIẾT

1. **Mô hình thành viên chuyến đi (Area A)**:
   - **Public Trip**: Người tham gia nằm trong `booking_participants`. Người đặt booking phải có bản ghi participant gắn với `userId` mới được phép thuê đồ cá nhân.
   - **Private Trip**: Người tham gia nằm trong `trip_members`.
   - Nếu người dùng truy cập trang thuê nhưng không đủ điều kiện tham gia, Backend sẽ trả lỗi `TRIP_MEMBERSHIP_NOT_ELIGIBLE` (HTTP 403 hoặc rentalEligible = false).
2. **Quy tắc Lock Contention**:
   - Backend đã được tối ưu để tránh giữ khóa ghi DB. Tuy nhiên, Frontend không nên polling với tần suất quá cao (< 2 giây/lần) để tránh tải không cần thiết lên hệ thống.

---

## H. CHECKLIST DÀNH CHO FRONTEND DEVELOPER

- [ ] 1. Mở `web/next.config.ts`, bổ sung rewrites cho `rental-orders`, `rental-extensions`, `rentals`.
- [ ] 2. Mở `web/src/app/(private)/(user)/payment-return/page.tsx`:
  - [ ] Thêm đọc param `rentalOrderId` và `extensionId`.
  - [ ] Thêm lời gọi API xác thực trạng thái backend với `apiClient`.
  - [ ] Thêm hiệu ứng Loading / Polling khi trạng thái là `PENDING` / `PROCESSING`.
  - [ ] Cập nhật nút điều hướng khi thanh toán Rental Order (`/rentals?orderId=...`).
  - [ ] Cập nhật nút "Thử lại" khi thanh toán Rental Order thất bại.
- [ ] 3. Kiểm thử thủ công:
  - [ ] Luồng Booking cũ: kiểm tra thanh toán qua Sandbox VNPay / MoMo.
  - [ ] Luồng Rental Order: kiểm tra đơn thuê từ checkout đến trang return.
  - [ ] Thử sửa URL giả mạo mã `00` để xác nhận giao diện không hiển thị sai.
- [ ] 4. Đánh dấu hoàn thành và thông báo cho Integration Lead.
