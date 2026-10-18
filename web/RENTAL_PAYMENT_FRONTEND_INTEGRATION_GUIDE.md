# Hướng dẫn FE tích hợp thanh toán Rental qua MoMo/VNPay

Ngày đối chiếu code: 18/10/2026.

## 1. Kết luận

FE có thể tích hợp thanh toán cho RentalOrder ngay bằng các API backend hiện có. Rental không cần một payment gateway riêng: backend đã dùng chung payment core, MoMo/VNPay adapter, webhook, recovery worker và cơ chế idempotency với booking.

Phạm vi có thể tích hợp ngay:

- Tạo quote rental.
- Tạo RentalOrder và giữ số lượng tồn kho.
- Tạo checkout MoMo hoặc VNPay.
- Chuyển người dùng đến trang thanh toán.
- Theo dõi payment và RentalOrder cho đến khi backend áp dụng giao dịch.
- Thanh toán phí gia hạn rental.

Giới hạn hiện tại:

- Chưa có FE rental checkout hoàn chỉnh trong repository.
- Trang `/payment-return` hiện chỉ xử lý booking; không dùng nguyên trạng cho rental.
- Chưa được xác nhận bằng một giao dịch rental end-to-end thật trên sandbox.
- Luồng tự động hoàn 100% cọc khi tất cả thiết bị `FINAL PASS` chưa nối kín. Việc này không chặn luồng thu tiền ban đầu.

## 2. Nguyên tắc tích hợp

1. FE không gửi `amount`, `rentalFee` hoặc `deposit` vào API payment. Backend lấy số tiền từ RentalOrder đã khóa giá.
2. Mỗi hành động tạo order/payment phải có `Idempotency-Key` riêng.
3. Nếu request timeout hoặc không rõ kết quả, retry với **cùng key và cùng body**.
4. Không coi redirect query của MoMo/VNPay là nguồn xác nhận cuối cùng.
5. Chỉ hiển thị thanh toán hoàn tất khi trạng thái từ backend đã đạt điều kiện thành công.
6. Lỗi API phải đọc tại `response.data.error` theo global error contract.

## 3. API flow

```text
GET  /api/v1/payments/options
  -> chọn momo hoặc vnpay

GET  /api/v1/trips/{tripId}/rental-eligibility
GET  /api/v1/rentals/availability
  -> kiểm tra user/trip và tồn kho tham khảo

POST /api/v1/rentals/quote
  -> backend tính phí thuê + tiền cọc

POST /api/v1/rental-orders
  -> giữ quantity, order ở PENDING_PAYMENT

POST /api/v1/rental-orders/{orderId}/payments
  -> tạo payment và checkout

MoMo/VNPay checkout
  -> gateway gọi webhook/IPN về backend

GET /api/v1/rental-orders/{orderId}
GET /api/v1/rental-orders/{orderId}/payment
  -> FE poll trạng thái authoritative từ backend

POST /api/v1/rental-extensions/{extensionId}/payments
GET  /api/v1/rental-extensions/{extensionId}/payment
  -> tạo checkout và poll trạng thái payment của gia hạn
```

## 4. Kiểu dữ liệu FE đề xuất

```ts
export type PaymentGateway = "momo" | "vnpay";
export type PaymentMethod = "QR" | "REDIRECT";

export type CheckoutData = {
  type: PaymentMethod;
  url: string | null;
  qrData: string | null;
};

export type RentalCheckoutResponse = {
  paymentId: string;
  invoiceId: string;
  invoiceType: "RENTAL";
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
  amount: string;
  currency: string;
  providerEnvironment: string;
  gateway: PaymentGateway;
  checkout: CheckoutData | null;
  expiresAt: string | null;
  reconciliationRequired: boolean;
};

export type PaymentOption = {
  gateway: PaymentGateway;
  environment: string;
  methods: PaymentMethod[];
};

export type PaymentOptionsResponse = {
  defaultGateway: PaymentGateway | null;
  gateways: PaymentOption[];
};

export type RentalPaymentStatus = {
  paymentRef: string;
  status: "NOT_STARTED" | "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
  nextAction: { type: string } | null;
  expiresAt: string | null;
  amount: number;
  refundedAmount: number;
  paidAt: string | null;
  invoiceStatus: string | null;
  applicationStatus: "PENDING" | "APPLIED" | "REJECTED" | null;
  applicationReasonCode: string | null;
  reconciliationStatus: string | null;
  reconciliationRequired: boolean;
  gateway: PaymentGateway | null;
  providerEnvironment: string | null;
  paymentMethod: PaymentMethod | null;
  orderStatus: string;
  financialStatus: string;
};

export type RentalExtensionPaymentStatus = {
  extensionId: string;
  rentalOrderId: string;
  extensionStatus: "QUOTED" | "PENDING_PAYMENT" | "APPLIED" | "REJECTED_CAPACITY" | "EXPIRED" | "PAYMENT_FAILED" | "CANCELLED";
  invoiceStatus: string | null;
  paymentRef: string | null;
  paymentStatus: "NOT_STARTED" | "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
  applicationStatus: "PENDING" | "APPLIED" | "REJECTED" | null;
  applicationReasonCode: string | null;
  reconciliationStatus: string | null;
  reconciliationRequired: boolean;
  amount: string;
  currency: string;
  expiresAt: string | null;
  paidAt: string | null;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    retryable: boolean;
  };
  meta: {
    requestId: string;
    serverTime: string;
    contractVersion: string;
  };
};
```

Lưu ý contract tiền hiện tại không giống nhau giữa hai loại response: response tạo checkout và trạng thái extension trả `amount` dạng `string`, còn `GET /rental-orders/{id}/payment` trả số nguyên VND dạng `number`. FE nên khai báo type riêng như trên, không dùng ép kiểu chung cho mọi response.

## 5. Service gọi API

Nên tạo file như `src/features/rentals/services/rental-payment.api.ts`.

```ts
import axios from "axios";
import { apiClient } from "@/lib/axios";
import type {
  PaymentOptionsResponse,
  RentalExtensionPaymentStatus,
  RentalPaymentStatus,
} from "../types/rental-payment.types";

export type PaymentGateway = "momo" | "vnpay";

export type RentalCheckoutResponse = {
  paymentId: string;
  invoiceId: string;
  invoiceType: "RENTAL";
  status: string;
  amount: string;
  currency: string;
  providerEnvironment: string;
  gateway: PaymentGateway;
  checkout: {
    type: "QR" | "REDIRECT";
    url: string | null;
    qrData: string | null;
  } | null;
  expiresAt: string | null;
  reconciliationRequired: boolean;
};

// Dùng same-origin Next rewrite giống booking để tránh CORS.
const sameOrigin = { baseURL: "" };

const idempotent = (key: string) => ({
  ...sameOrigin,
  headers: { "Idempotency-Key": key },
});

export const rentalPaymentApi = {
  options: async () =>
    (
      await apiClient.get<PaymentOptionsResponse>(
        "/api/v1/payments/options",
        sameOrigin,
      )
    ).data,

  createQuote: async (input: {
    tripId: string;
    recipientTripMemberId?: string;
    requestedReturnAt?: string;
    returnOptionId?: string;
    items: Array<{ productId: string; quantity: number }>;
  }) =>
    (await apiClient.post("/api/v1/rentals/quote", input, sameOrigin)).data,

  createOrder: async (quoteId: string, key: string) =>
    (
      await apiClient.post(
        "/api/v1/rental-orders",
        { quoteId },
        idempotent(key),
      )
    ).data,

  createCheckout: async (
    orderId: string,
    gateway: PaymentGateway,
    key: string,
  ) =>
    (
      await apiClient.post<RentalCheckoutResponse>(
        `/api/v1/rental-orders/${orderId}/payments`,
        { paymentMethod: "REDIRECT", gateway },
        idempotent(key),
      )
    ).data,

  getOrder: async (orderId: string) =>
    (
      await apiClient.get(
        `/api/v1/rental-orders/${orderId}`,
        sameOrigin,
      )
    ).data,

  getPayment: async (orderId: string) =>
    (
      await apiClient.get<RentalPaymentStatus>(
        `/api/v1/rental-orders/${orderId}/payment`,
        sameOrigin,
      )
    ).data,

  createExtensionCheckout: async (
    extensionId: string,
    gateway: PaymentGateway,
    key: string,
  ) =>
    (
      await apiClient.post<RentalCheckoutResponse>(
        `/api/v1/rental-extensions/${extensionId}/payments`,
        { paymentMethod: "REDIRECT", gateway },
        idempotent(key),
      )
    ).data,

  getExtensionPayment: async (extensionId: string) =>
    (
      await apiClient.get<RentalExtensionPaymentStatus>(
        `/api/v1/rental-extensions/${extensionId}/payment`,
        sameOrigin,
      )
    ).data,
};

export function getRentalPaymentError(error: unknown): {
  code?: string;
  message: string;
  retryable: boolean;
} {
  if (axios.isAxiosError(error)) {
    const problem = error.response?.data?.error;
    return {
      code: problem?.code,
      message: problem?.message ?? "Không thể kết nối máy chủ thanh toán.",
      retryable: problem?.retryable === true,
    };
  }

  return {
    message: "Không thể thực hiện thanh toán.",
    retryable: false,
  };
}
```

Không đọc lỗi bằng `error.response.data.message` hoặc `error.response.data.code`; hai trường đó nằm trong `error.response.data.error`.

## 6. Tạo và giữ Idempotency-Key

FE phải giữ key qua reload và các lỗi mạng không rõ kết quả.

```ts
function getOrCreatePaymentKey(orderId: string, gateway: PaymentGateway) {
  const storageKey = `rental-payment:${orderId}:${gateway}`;
  let key = sessionStorage.getItem(storageKey);

  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  }

  return { storageKey, key };
}
```

Quy tắc:

- Cùng thao tác và cùng body: dùng lại key.
- Đổi gateway hoặc payment method: dùng key khác.
- Không tạo key mới chỉ vì request timeout.
- Không cho người dùng bấm liên tục trong khi payment đang `PENDING` hoặc `PROCESSING`.
- Chỉ xóa key khi payment đã có kết quả terminal hoặc order không còn khả năng thanh toán.

## 7. Hàm bắt đầu checkout

```ts
async function startRentalPayment(
  orderId: string,
  gateway: PaymentGateway,
) {
  const { key } = getOrCreatePaymentKey(orderId, gateway);

  // Backend gắn rentalOrderId vào return URL. Vẫn lưu context làm fallback
  // nếu người dùng mở return page cũ hoặc URL bị mất query string.
  sessionStorage.setItem(
    "rental-payment-return-context",
    JSON.stringify({ orderId, gateway, savedAt: Date.now() }),
  );

  const result = await rentalPaymentApi.createCheckout(
    orderId,
    gateway,
    key,
  );

  if (
    result.checkout?.url &&
    ["PENDING", "PROCESSING"].includes(result.status)
  ) {
    window.location.assign(result.checkout.url);
    return;
  }

  // HTTP 202 hoặc checkout=null: chưa được phép kết luận thất bại.
  // Hiển thị trạng thái đang đối soát và bắt đầu poll backend.
  return result;
}
```

Khuyến nghị ban đầu dùng `paymentMethod: "REDIRECT"` cho cả hai gateway:

- MoMo có thể hỗ trợ `QR` và trả `checkout.qrData`.
- VNPay hiện trả hosted redirect URL; ngay cả khi gửi `QR`, adapter vẫn có thể trả checkout dạng redirect.

## 8. Trang payment return cho rental

Không dùng query return của gateway để tự cập nhật order hoặc hiển thị chắc chắn "đã thanh toán".

Trang return cần:

1. Đọc `rentalOrderId` và `extensionId` từ query string; chỉ dùng `sessionStorage` làm fallback.
2. Hiển thị "Đang xác nhận thanh toán".
3. Rental ban đầu: poll `GET /rental-orders/{orderId}/payment` và có thể lấy thêm chi tiết order.
4. Rental extension: poll `GET /rental-extensions/{extensionId}/payment`.
5. Chỉ hiển thị thành công khi backend đã áp dụng payment.
6. Cho phép thoát polling khi đạt terminal state hoặc hết timeout UI.

Backend hiện redirect về một trong hai dạng:

```text
/payment-return?rentalOrderId={orderId}
/payment-return?rentalOrderId={orderId}&extensionId={extensionId}
```

Ví dụ đọc context:

```ts
const params = new URLSearchParams(window.location.search);
const rentalOrderId = params.get("rentalOrderId");
const extensionId = params.get("extensionId");
```

Ví dụ:

```ts
const TERMINAL_PAYMENT_STATUSES = new Set([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]);

async function waitForRentalPayment(
  orderId: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 1_500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [orderDetail, payment] = await Promise.all([
      rentalPaymentApi.getOrder(orderId),
      rentalPaymentApi.getPayment(orderId),
    ]);

    const paymentApplied =
      payment.status === "SUCCEEDED" &&
      payment.applicationStatus === "APPLIED" &&
      payment.invoiceStatus === "PAID";
    const orderPaid =
      payment.orderStatus === "PAID" &&
      payment.financialStatus === "PAID";
    const reservationsConfirmed =
      orderDetail.quantityReservations.length > 0 &&
      orderDetail.quantityReservations.every(
        (reservation: { status: string }) =>
          reservation.status === "CONFIRMED",
      );

    if (paymentApplied && orderPaid && reservationsConfirmed) {
      return { kind: "SUCCEEDED" as const, orderDetail, payment };
    }

    if (
      TERMINAL_PAYMENT_STATUSES.has(payment.status) &&
      payment.status !== "SUCCEEDED"
    ) {
      return { kind: "FAILED" as const, orderDetail, payment };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { kind: "PENDING" as const };
}
```

Không dùng `setInterval` nếu callback có thể chạy chồng lên request trước. Dùng vòng lặp tuần tự hoặc `setTimeout` sau khi request hoàn tất.

## 9. Điều kiện thành công authoritative

FE chỉ hiển thị hoàn tất khi các trạng thái backend phù hợp:

| Đối tượng | Trạng thái kỳ vọng |
|---|---|
| Payment | `SUCCEEDED` |
| Payment application | `APPLIED` |
| Invoice | `PAID` |
| RentalOrder | `PAID` |
| Rental financial status | `PAID` |
| Quantity reservation | `CONFIRMED` |

`GET /rental-orders/{orderId}/payment` hiện trả trực tiếp `applicationStatus`, `invoiceStatus`, `orderStatus`, `financialStatus` và trạng thái reconciliation. FE phải dùng các field này thay vì suy luận từ redirect của gateway. Có thể gọi thêm API chi tiết order để kiểm tra các quantity reservation đều đã `CONFIRMED`.

Nếu Payment đã `SUCCEEDED` nhưng RentalOrder chưa `PAID`, FE phải tiếp tục hiển thị trạng thái đang xử lý và poll trong giới hạn thời gian; không được tự suy luận đơn đã hoàn tất từ query của gateway.

## 10. Xử lý HTTP status

| HTTP | Ý nghĩa FE |
|---:|---|
| `201` | Đã tạo payment mới; dùng `checkout.url` nếu có |
| `200` | Request idempotent trả lại payment hiện hữu |
| `202` | Payment đã được ghi nhận nhưng chưa có checkout chắc chắn; poll/reconcile, không tạo key mới |
| `400` | Body, UUID, gateway hoặc payment method không hợp lệ |
| `401` | Token thiếu/hết hạn; dùng refresh interceptor hiện có |
| `404` | Không tìm thấy order hoặc user không sở hữu order |
| `409` | Trùng key khác body, hoặc đang có payment attempt |
| `422` | Order không còn ở trạng thái cho phép thanh toán hoặc số tiền/order không hợp lệ |
| `503` | Provider tạm thời không khả dụng; đọc `error.retryable` |

Các error code FE nên xử lý riêng:

- `PAYMENT_ATTEMPT_IN_PROGRESS`: chuyển sang polling, không tạo payment mới.
- `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`: tạo flow mới chỉ sau khi xác định request cũ không còn được dùng.
- `PAYMENT_INVALID_STATE`: reload RentalOrder.
- `PAYMENT_AMOUNT_MISMATCH`: dừng thanh toán và báo cần hỗ trợ; FE không tự sửa số tiền.
- `PAYMENT_PROVIDER_UNAVAILABLE`: cho retry theo `error.retryable`.
- `INSUFFICIENT_AVAILABLE_QUANTITY`: quay lại quote/tồn kho.
- `VALIDATION_ERROR`: hiển thị lỗi input phù hợp.

## 11. Next.js rewrite và CORS

Booking hiện dùng same-origin rewrite, nhưng `next.config.ts` chưa proxy các resource rental. FE nên mở rộng danh sách rewrite:

```ts
return [
  "trips",
  "bookings",
  "auth",
  "payments",
  "rentals",
  "rental-orders",
  "rental-products",
  "rental-categories",
  "rental-extensions",
].map((resource) => ({
  source: `/api/v1/${resource}/:path*`,
  destination: `${api}/api/v1/${resource}/:path*`,
}));
```

Sau đó các request rental payment nên dùng `{ baseURL: "" }` như booking.

Nếu FE gọi API backend khác origin trực tiếp, backend đã cho phép `Idempotency-Key` trong CORS `allowedHeaders`. Production vẫn nên giới hạn danh sách origin theo domain FE thực tế thay vì để origin động.

## 12. Thanh toán gia hạn

Luồng gia hạn có phí dùng cùng payment core:

```text
POST /api/v1/rental-orders/{orderId}/extension-quotes
POST /api/v1/rental-orders/{orderId}/extensions
POST /api/v1/rental-extensions/{extensionId}/payments
GET  /api/v1/rental-extensions/{extensionId}/payment
```

Body payment:

```json
{
  "paymentMethod": "REDIRECT",
  "gateway": "vnpay"
}
```

Phải dùng một `Idempotency-Key` mới cho payment của extension. Phí gia hạn là invoice/payment riêng và không thu lại tiền cọc ban đầu.

Sau redirect, nếu URL có `extensionId`, FE poll API trạng thái extension. Chỉ báo thành công khi đồng thời:

- `paymentStatus === "SUCCEEDED"`
- `applicationStatus === "APPLIED"`
- `invoiceStatus === "PAID"`
- `extensionStatus === "APPLIED"`

Nếu payment đã `SUCCEEDED` nhưng application chưa `APPLIED`, tiếp tục hiển thị "Đang áp dụng gia hạn" và poll; không tạo payment mới.

## 13. Checklist test FE

### Luồng chính

- [ ] Hiển thị gateway từ `GET /payments/options`, không hard-code gateway đang bật.
- [ ] Tạo quote và hiển thị riêng phí thuê, cọc và tổng tiền.
- [ ] Tạo order với idempotency key.
- [ ] Thanh toán MoMo bằng `REDIRECT`.
- [ ] Thanh toán VNPay bằng `REDIRECT`.
- [ ] Đọc `rentalOrderId`/`extensionId` từ return URL và giữ `sessionStorage` làm fallback.
- [ ] Sau return, poll backend cho đến khi payment được áp dụng.
- [ ] Với extension, poll `GET /rental-extensions/{extensionId}/payment`.
- [ ] Refresh trang không tạo payment mới.
- [ ] Double click không gửi hai request song song.

### Failure/retry

- [ ] Timeout khi tạo checkout: retry cùng key.
- [ ] HTTP `202`: không báo thất bại, chuyển sang polling.
- [ ] `PAYMENT_ATTEMPT_IN_PROGRESS`: khóa nút và poll.
- [ ] Gateway báo thành công nhưng backend chưa `APPLIED`: tiếp tục chờ.
- [ ] Gateway query báo thất bại nhưng backend chưa terminal: không tự hủy order.
- [ ] Order/hold hết hạn: reload order và yêu cầu tạo quote mới.

### Bảo mật

- [ ] Không gửi hoặc log secret/API key của MoMo/VNPay.
- [ ] Không tin `amount`, `transactionRef` hoặc success flag từ URL return.
- [ ] Không cho FE gọi API refund trực tiếp của nhà cung cấp.
- [ ] Không lưu access token trong URL.
- [ ] Không log toàn bộ error response nếu có thể chứa dữ liệu thanh toán.

## 14. Tiêu chí bàn giao FE

Phần FE thanh toán rental được coi là hoàn thành khi:

1. User tạo được quote và RentalOrder từ dữ liệu thật, không dùng mock eligibility/availability.
2. User chọn được gateway backend đang bật.
3. FE mở đúng `checkout.url`.
4. Reload/retry không tạo giao dịch trùng.
5. Trang return xác nhận trạng thái từ backend thay vì tin query gateway.
6. Thành công chỉ hiển thị khi Payment `SUCCEEDED`, application `APPLIED`, invoice `PAID`, RentalOrder và financial status đều `PAID`, đồng thời các quantity reservation đều `CONFIRMED`.
7. Các trạng thái pending, failed, expired và retryable được hiển thị rõ.
8. Cả MoMo và VNPay sandbox được test thủ công với callback/IPN thật.

## 15. Các file backend/FE để đối chiếu

- `api/src/modules/rental/payments/rental-payments.controller.ts`
- `api/src/modules/rental/payments/rental-checkout.service.ts`
- `api/src/modules/rental/payments/rental-payment.consumer.ts`
- `api/src/modules/payments/payments.service.ts`
- `api/src/modules/payments/payment-return-path.ts`
- `api/src/modules/payments/payment-recovery.service.ts`
- `api/src/modules/payments/payment-provider.router.ts`
- `api/src/modules/payments/momo-payment.provider.ts`
- `api/src/modules/payments/vnpay-payment.provider.ts`
- `api/src/modules/payments/payment-webhooks.controller.ts`
- `api/src/modules/payments/vnpay-ipn.controller.ts`
- `api/src/modules/rental/payments/rental-extension-payments.controller.ts`
- `web/src/features/bookings/booking.api.ts`
- `web/src/features/bookings/components/BookingCheckout.tsx`
- `web/src/app/(private)/(user)/payment-return/page.tsx`
- `web/src/features/rentals/services/rental.api.ts`
- `web/next.config.ts`

