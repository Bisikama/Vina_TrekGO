/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createRentalOrder,
  createRentalPayment,
  createRentalQuote,
  getRentalApiErrorMessage,
  getRentalAvailability,
  getRentalEligibility,
  getRentalPaymentOptions,
  getRentalProduct,
} from "@/features/rentals/services/rental.api";
import type {
  CreateRentalOrderResult,
  RentalAvailability,
  RentalEligibility,
  RentalPaymentCheckoutResponse,
  RentalPaymentGateway,
  RentalProduct,
  RentalQuote,
} from "@/features/rentals/types/rental";

type RentalQuotePageProps = {
  bookingId: string;
  productId: string;
  initialQuantity?: number;
};

type PageData = {
  eligibility: RentalEligibility;
  availability: RentalAvailability;
  product: RentalProduct;
};

function createIdempotencyKey(scope: string) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${scope}-${crypto.randomUUID()}`;
  }

  return `${scope}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: currency || "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function RentalQuotePage({
  bookingId,
  productId,
  initialQuantity = 1,
}: RentalQuotePageProps) {
  const [data, setData] = useState<PageData | null>(null);
  const [quantity, setQuantity] = useState(
    Math.max(1, Math.floor(initialQuantity)),
  );
  const [recipientId, setRecipientId] = useState("");
  const [quote, setQuote] = useState<RentalQuote | null>(null);
  const [orderResult, setOrderResult] =
    useState<CreateRentalOrderResult | null>(null);
  const [payment, setPayment] =
    useState<RentalPaymentCheckoutResponse | null>(null);
  const [gateway, setGateway] =
    useState<RentalPaymentGateway>("vnpay");
  const [paymentGateways, setPaymentGateways] = useState<
    RentalPaymentGateway[]
  >([]);
  const orderKeyRef = useRef<string | null>(null);
  const paymentKeyRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getRentalEligibility(bookingId, controller.signal),
      getRentalProduct(productId, controller.signal),
      getRentalAvailability(
        bookingId,
        productId,
        controller.signal,
      ),
      getRentalPaymentOptions(controller.signal),
    ])
      .then(
        ([
          eligibility,
          product,
          availability,
          paymentOptions,
        ]) => {
        if (controller.signal.aborted) {
          return;
        }

        setData({ eligibility, product, availability });
        const availableGateways =
          paymentOptions.gateways.map(
            (option) => option.gateway,
          );
        setPaymentGateways(availableGateways);
        setGateway((current) =>
          availableGateways.includes(current)
            ? current
            : availableGateways[0] ?? "vnpay",
        );
        setRecipientId(
          eligibility.recipientOptions[0]?.id ?? "",
        );
        setQuantity((current) =>
          Math.min(
            Math.max(current, 1),
            Math.max(availability.availableCount, 1),
          ),
        );
        setError(null);
        },
      )
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            getRentalApiErrorMessage(
              loadError,
              "Không thể chuẩn bị báo giá thuê thiết bị.",
            ),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [bookingId, productId]);

  const canCreateRental =
    data?.eligibility.eligible === true &&
    data.eligibility.allowedActions.includes(
      "CREATE_RENTAL",
    );

  const estimatedFee = useMemo(() => {
    if (!data) {
      return 0;
    }

    const startAt = new Date(data.eligibility.trip.startAt);
    const endAt = new Date(data.eligibility.trip.endAt);
    const durationMs = Math.max(
      endAt.getTime() - startAt.getTime(),
      0,
    );
    const estimatedDays = Math.max(
      1,
      Math.ceil(durationMs / 86_400_000),
    );

    return data.product.dailyPrice * quantity * estimatedDays;
  }, [data, quantity]);

  async function handleCreateQuote() {
    if (!data || submitting || !canCreateRental) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await createRentalQuote({
        bookingId: data.eligibility.bookingId,
        recipientParticipantId:
          recipientId || undefined,
        items: [
          {
            productId,
            quantity,
          },
        ],
      });

      setQuote(result);
    } catch (quoteError) {
      setError(
        getRentalApiErrorMessage(
          quoteError,
          "Không thể tạo báo giá thuê thiết bị.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateOrderAndPayment() {
    if (!quote || submitting) {
      return;
    }

    if (!paymentGateways.includes(gateway)) {
      setError(
        "Backend hiện chưa bật cổng thanh toán khả dụng.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (!orderKeyRef.current) {
        orderKeyRef.current = createIdempotencyKey(
          `rental-order-${quote.id}`,
        );
      }

      const nextOrder =
        orderResult ??
        (await createRentalOrder(
          quote.id,
          orderKeyRef.current,
        ));

      setOrderResult(nextOrder);

      if (!paymentKeyRef.current) {
        paymentKeyRef.current = createIdempotencyKey(
          `rental-payment-${nextOrder.order.id}-${gateway}`,
        );
      }

      const nextPayment =
        payment ??
        (await createRentalPayment(
          nextOrder.order.id,
          {
            paymentMethod: "REDIRECT",
            gateway,
          },
          paymentKeyRef.current,
        ));

      setPayment(nextPayment);

      if (nextPayment.checkout?.url) {
        sessionStorage.setItem(
          "trekgo:rental-payment-return",
          JSON.stringify({
            orderId: nextOrder.order.id,
            bookingId: quote.bookingId,
            paymentId: nextPayment.paymentId,
          }),
        );
        window.location.assign(nextPayment.checkout.url);
        return;
      }

      setError(
        nextPayment.reconciliationRequired
          ? "Cổng thanh toán đang xác minh giao dịch. Vui lòng chờ ít phút rồi thử lại."
          : "Cổng thanh toán chưa trả về đường dẫn thanh toán.",
      );
    } catch (checkoutError) {
      setError(
        getRentalApiErrorMessage(
          checkoutError,
          "Không thể giữ thiết bị và khởi tạo thanh toán.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[650px] bg-[#F7F7F4] px-4 py-12">
        <div className="mx-auto grid max-w-5xl animate-pulse gap-8 lg:grid-cols-[1fr_360px]">
          <div className="h-[520px] rounded-3xl bg-gray-200" />
          <div className="h-[520px] rounded-3xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[650px] bg-[#F7F7F4] px-4 py-20">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-gray-900">
            Không thể tạo báo giá
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            {error ?? "Dữ liệu thuê thiết bị không hợp lệ."}
          </p>

          <Link
            href={`/rentals?bookingId=${encodeURIComponent(
              bookingId,
            )}`}
            className="mt-6 inline-flex rounded-xl bg-[#1B5E41] px-5 py-3 text-sm font-bold text-white"
          >
            Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  const { eligibility, availability, product } = data;
  const available = availability.availableCount > 0;

  if (quote) {
    return (
      <div className="min-h-screen bg-[#F7F7F4] px-4 py-12">
        <main className="mx-auto max-w-3xl rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
            ✓
          </div>

          <h1 className="mt-5 text-center text-3xl font-black text-gray-950">
            Đã tạo báo giá thuê
          </h1>

          <p className="mt-2 text-center text-sm text-gray-600">
            Mã quote: <strong>{quote.id}</strong>
          </p>

          <div className="mt-8 rounded-2xl bg-[#F7F7F4] p-5">
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-4">
              <div>
                <p className="font-extrabold text-gray-900">
                  {quote.items[0]?.name ?? product.name}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {quote.items[0]?.quantity ?? quantity} thiết bị · {quote.chargedDays} ngày tính phí
                </p>
              </div>

              <p className="font-black text-[#1B5E41]">
                {formatMoney(
                  quote.amounts.feeAmount,
                  quote.amounts.currency,
                )}
              </p>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Phí thuê</dt>
                <dd className="font-bold text-gray-900">
                  {formatMoney(
                    quote.amounts.feeAmount,
                    quote.amounts.currency,
                  )}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Tiền cọc</dt>
                <dd className="font-bold text-gray-900">
                  {formatMoney(
                    quote.amounts.depositAmount,
                    quote.amounts.currency,
                  )}
                </dd>
              </div>

              <div className="flex justify-between gap-4 border-t border-gray-200 pt-3 text-base">
                <dt className="font-extrabold text-gray-900">
                  Tổng cộng
                </dt>
                <dd className="font-black text-[#1B5E41]">
                  {formatMoney(
                    quote.amounts.totalAmount,
                    quote.amounts.currency,
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Nhận thiết bị
              </p>
              <p className="mt-2 font-extrabold text-gray-900">
                {quote.pickup.name}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {formatDate(quote.pickup.scheduledAt)}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Trả thiết bị
              </p>
              <p className="mt-2 font-extrabold text-gray-900">
                {quote.dropoff.name}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {formatDate(quote.dropoff.scheduledAt)}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Báo giá hết hạn lúc {formatDate(quote.expiresAt)}.
            Khi tiếp tục, hệ thống sẽ giữ toàn bộ số lượng thiết bị
            rồi mới mở cổng thanh toán.
          </div>

          <section className="mt-7 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                  Shared Payment
                </p>
                <h2 className="mt-1 text-xl font-black text-gray-950">
                  Chọn cổng thanh toán
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Thiết bị chỉ được giữ khi tạo đơn thành công.
                  Trạng thái PAID sẽ do Backend xác minh lại.
                </p>
              </div>

              {paymentGateways.length === 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                Backend chưa trả về VNPay hoặc MoMo khả dụng.
                Kiểm tra cấu hình Shared Payment rồi tải lại trang.
              </div>
            )}

            {orderResult && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-emerald-700 shadow-sm">
                  Đã giữ thiết bị
                </span>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    id: "vnpay",
                    title: "VNPay",
                    detail: "Thẻ ATM, QR và ngân hàng",
                    icon: "VN",
                  },
                  {
                    id: "momo",
                    title: "MoMo",
                    detail: "Ví MoMo sandbox",
                    icon: "M",
                  },
                ] as const
              )
                .filter((option) =>
                  paymentGateways.includes(option.id),
                )
                .map((option) => {
                const selected = gateway === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={Boolean(payment) || submitting}
                    onClick={() => {
                      setGateway(option.id);
                      paymentKeyRef.current = null;
                      setPayment(null);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${selected
                      ? "border-emerald-500 bg-white shadow-[0_12px_30px_rgba(16,185,129,0.16)]"
                      : "border-emerald-100 bg-white/70 hover:border-emerald-300"} disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${selected
                        ? "bg-[#1B5E41] text-white"
                        : "bg-emerald-100 text-emerald-800"}`}
                    >
                      {option.icon}
                    </span>
                    <span>
                      <span className="block font-black text-gray-950">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {option.detail}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {orderResult && (
              <div className="mt-4 rounded-2xl bg-white p-4 text-xs leading-5 text-gray-600">
                <p>
                  Mã đơn thuê:{" "}
                  <strong className="text-gray-900">
                    {orderResult.order.id}
                  </strong>
                </p>
                <p>
                  Giữ đến:{" "}
                  <strong className="text-gray-900">
                    {formatDate(
                      orderResult.order.paymentExpiresAt,
                    )}
                  </strong>
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleCreateOrderAndPayment}
              disabled={
                submitting || paymentGateways.length === 0
              }
              className="mt-5 flex w-full items-center justify-center rounded-2xl bg-[#163F2D] px-6 py-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(22,63,45,0.24)] transition hover:-translate-y-0.5 hover:bg-[#0F5132] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? orderResult
                  ? "Đang mở cổng thanh toán..."
                  : "Đang giữ thiết bị..."
                : `Giữ thiết bị & thanh toán qua ${
                    gateway === "vnpay" ? "VNPay" : "MoMo"
                  }`}
            </button>
          </section>

          <Link
            href={`/rentals?bookingId=${encodeURIComponent(
              bookingId,
            )}`}
            className="mt-4 flex w-full justify-center rounded-xl border border-gray-200 bg-white px-6 py-4 text-sm font-extrabold text-gray-700 hover:border-emerald-300 hover:text-emerald-800"
          >
            Quay lại danh mục thuê
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F4]">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
          <Link
            href={`/rentals?bookingId=${encodeURIComponent(
              bookingId,
            )}`}
            className="hover:text-[#1B5E41]"
          >
            Thuê thiết bị
          </Link>
          <span>/</span>
          <span className="text-gray-900">Tạo báo giá</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-3xl font-black text-gray-950">
              Xác nhận thiết bị thuê
            </h1>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Server sẽ kiểm tra lại tồn kho và tính chính xác phí thuê, tiền cọc trước khi tạo quote.
            </p>

            <div className="mt-7 flex gap-5 rounded-2xl border border-gray-200 p-4">
              <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl bg-[#EEF3EF]">
                <img
                  src={product.imageUrls[0]}
                  alt={product.name}
                  className="h-full w-full object-contain p-3"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  {product.category.name}
                </p>
                <h2 className="mt-2 text-lg font-extrabold text-gray-900">
                  {product.name}
                </h2>
                <p className="mt-2 text-sm font-black text-[#1B5E41]">
                  {formatMoney(
                    product.dailyPrice,
                    product.currency,
                  )}
                  /ngày
                </p>
              </div>
            </div>

            <div className="mt-7">
              <label className="text-sm font-extrabold text-gray-900">
                Số lượng
              </label>

              <div className="mt-3 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.max(1, current - 1),
                    )
                  }
                  disabled={quantity <= 1}
                  className="h-11 w-11 rounded-xl border border-gray-200 text-xl font-bold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>

                <span className="min-w-10 text-center text-lg font-black text-gray-900">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.min(
                        availability.availableCount,
                        current + 1,
                      ),
                    )
                  }
                  disabled={
                    quantity >= availability.availableCount
                  }
                  className="h-11 w-11 rounded-xl border border-gray-200 text-xl font-bold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>

                <span className="text-xs font-semibold text-gray-500">
                  Còn {availability.availableCount} thiết bị
                </span>
              </div>
            </div>

            {eligibility.recipientOptions.length > 0 && (
              <div className="mt-7">
                <label
                  htmlFor="rental-recipient"
                  className="text-sm font-extrabold text-gray-900"
                >
                  Người nhận thiết bị
                </label>

                <select
                  id="rental-recipient"
                  value={recipientId}
                  onChange={(event) =>
                    setRecipientId(event.target.value)
                  }
                  className="mt-3 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold outline-none focus:border-[#1B5E41]"
                >
                  {eligibility.recipientOptions.map(
                    (recipient) => (
                      <option
                        key={recipient.id}
                        value={recipient.id}
                      >
                        {recipient.displayName}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {eligibility.pickup && (
                <div className="rounded-2xl bg-[#F7F7F4] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Nhận thiết bị
                  </p>
                  <p className="mt-2 text-sm font-extrabold text-gray-900">
                    {eligibility.pickup.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    {eligibility.pickup.address}
                    <br />
                    {formatDate(eligibility.pickup.scheduledAt)}
                  </p>
                </div>
              )}

              {eligibility.dropoff && (
                <div className="rounded-2xl bg-[#F7F7F4] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Trả thiết bị
                  </p>
                  <p className="mt-2 text-sm font-extrabold text-gray-900">
                    {eligibility.dropoff.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    {eligibility.dropoff.address}
                    <br />
                    {formatDate(eligibility.dropoff.scheduledAt)}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {!eligibility.eligible && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {eligibility.reason ??
                  "Booking chưa đủ điều kiện thuê thiết bị."}
              </div>
            )}

            {eligibility.existingOpenOrderId && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Booking đã có một đơn thuê đang mở. Mã đơn: {eligibility.existingOpenOrderId}
              </div>
            )}
          </section>

          <aside className="h-fit rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-extrabold text-gray-900">
              Tạm tính
            </h2>

            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">
                  Số lượng
                </dt>
                <dd className="font-bold text-gray-900">
                  {quantity}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">
                  Phí thuê dự kiến
                </dt>
                <dd className="text-right font-bold text-gray-900">
                  {formatMoney(
                    estimatedFee,
                    product.currency,
                  )}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">
                  Cọc dự kiến
                </dt>
                <dd className="text-right font-bold text-gray-900">
                  {formatMoney(
                    product.depositPolicy.amount * quantity,
                    product.currency,
                  )}
                </dd>
              </div>
            </dl>

            <p className="mt-5 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">
              Đây chỉ là tạm tính trên giao diện. Số tiền chính thức do API Quote tính lại theo chính sách hiện hành.
            </p>

            <button
              type="button"
              onClick={() => void handleCreateQuote()}
              disabled={
                submitting ||
                !available ||
                !canCreateRental
              }
              className="mt-6 w-full rounded-xl bg-[#1B5E41] px-5 py-4 text-sm font-extrabold text-white transition hover:bg-[#154B36] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {submitting
                ? "Đang tạo báo giá..."
                : "Tạo báo giá chính thức"}
            </button>

            <p className="mt-3 text-center text-[11px] leading-5 text-gray-500">
              Quote không giữ tồn kho và chưa tạo thanh toán.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
