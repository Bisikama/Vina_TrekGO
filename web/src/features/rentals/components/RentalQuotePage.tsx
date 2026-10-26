/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useRentalCart } from "@/features/rentals/hooks/useRentalCart";
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
  productId?: string;
  initialQuantity?: number;
};

type CheckoutLine = {
  product: RentalProduct;
  quantity: number;
  availability: RentalAvailability;
};

type PageData = {
  eligibility: RentalEligibility;
  lines: CheckoutLine[];
};

function formatMoney(value: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function shortCode(value: string) {
  return value.replaceAll("-", "").slice(-6).toUpperCase();
}

function createIdempotencyKey(scope: string) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${scope}-${crypto.randomUUID()}`;
  }
  return `${scope}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function PaymentCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-800">
        Thời gian còn lại để chuyển khoản
      </p>
      <p className="mt-2 text-3xl font-black tabular-nums text-amber-950">
        {remaining > 0
          ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
          : "Đã hết hạn"}
      </p>
    </div>
  );
}

export function RentalQuotePage({
  bookingId,
  productId = "",
  initialQuantity = 1,
}: RentalQuotePageProps) {
  const cart = useRentalCart(bookingId);
  const [data, setData] = useState<PageData | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [quote, setQuote] = useState<RentalQuote | null>(null);
  const [orderResult, setOrderResult] =
    useState<CreateRentalOrderResult | null>(null);
  const [payment, setPayment] = useState<RentalPaymentCheckoutResponse | null>(
    null,
  );
  const [gateway, setGateway] = useState<RentalPaymentGateway>("vnpay");
  const [paymentGateways, setPaymentGateways] = useState<
    RentalPaymentGateway[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orderKeyRef = useRef<string | null>(null);
  const paymentKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cart.hydrated) return;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [eligibility, paymentOptions] = await Promise.all([
          getRentalEligibility(bookingId, controller.signal),
          getRentalPaymentOptions(controller.signal).catch(() => ({
            gateways: [],
          })),
        ]);

        let requested = cart.items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
        }));

        if (requested.length === 0 && productId) {
          const product = await getRentalProduct(productId, controller.signal);
          requested = [
            { product, quantity: Math.max(1, Math.floor(initialQuantity)) },
          ];
        }

        const lines = await Promise.all(
          requested.map(async (item) => ({
            ...item,
            availability: await getRentalAvailability(
              bookingId,
              item.product.id,
              controller.signal,
            ),
          })),
        );

        if (controller.signal.aborted) return;
        setData({ eligibility, lines });
        setRecipientId(
          (current) => current || eligibility.recipientOptions[0]?.id || "",
        );
        const gateways = paymentOptions.gateways.map(
          (option) => option.gateway,
        );
        setPaymentGateways(gateways);
        setGateway((current) =>
          gateways.includes(current) ? current : (gateways[0] ?? "vnpay"),
        );
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            getRentalApiErrorMessage(
              loadError,
              "Không thể kiểm tra giỏ thiết bị.",
            ),
          );
          setData(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [bookingId, cart.hydrated, cart.items, initialQuantity, productId]);

  const shortages = useMemo(
    () =>
      data?.lines.filter(
        (line) => line.quantity > line.availability.availableCount,
      ) ?? [],
    [data],
  );

  const estimatedDays = useMemo(() => {
    if (!data) return 1;
    const duration =
      new Date(data.eligibility.trip.endAt).getTime() -
      new Date(data.eligibility.trip.startAt).getTime();
    return Math.max(1, Math.ceil(Math.max(0, duration) / 86_400_000));
  }, [data]);

  const estimatedFee = useMemo(
    () =>
      (data?.lines ?? []).reduce(
        (sum, line) =>
          sum + line.product.dailyPrice * line.quantity * estimatedDays,
        0,
      ),
    [data, estimatedDays],
  );

  const canCreateRental =
    data?.eligibility.eligible === true &&
    data.eligibility.allowedActions.includes("CREATE_RENTAL") &&
    data.lines.length > 0 &&
    shortages.length === 0;

  async function handleCreateQuote() {
    if (!data || !canCreateRental || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      setQuote(
        await createRentalQuote({
          tripId: data.eligibility.trip.id,
          recipientTripMemberId: recipientId || undefined,
          items: data.lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        }),
      );
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
    if (!quote || submitting) return;
    if (!paymentGateways.includes(gateway)) {
      setError("Backend hiện chưa bật cổng thanh toán khả dụng.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      orderKeyRef.current ??= createIdempotencyKey(`rental-order-${quote.id}`);
      const nextOrder =
        orderResult ?? (await createRentalOrder(quote.id, orderKeyRef.current));
      setOrderResult(nextOrder);

      paymentKeyRef.current ??= createIdempotencyKey(
        `rental-payment-${nextOrder.order.id}-${gateway}`,
      );
      const nextPayment =
        payment ??
        (await createRentalPayment(
          nextOrder.order.id,
          { paymentMethod: "REDIRECT", gateway },
          paymentKeyRef.current,
        ));
      setPayment(nextPayment);

      if (nextPayment.checkout?.url) {
        cart.clear();
        sessionStorage.setItem(
          "trekgo:rental-payment-return",
          JSON.stringify({
            orderId: nextOrder.order.id,
            bookingId,
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

  if (loading || !cart.hydrated) {
    return (
      <div className="min-h-[650px] bg-[#F4F6F1] px-4 py-12">
        <div className="mx-auto grid max-w-5xl animate-pulse gap-8 lg:grid-cols-[1fr_360px]">
          <div className="h-[520px] rounded-3xl bg-gray-200" />
          <div className="h-[520px] rounded-3xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!data || data.lines.length === 0) {
    return (
      <div className="min-h-[650px] bg-[#F4F6F1] px-4 py-20">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">🎒</div>
          <h1 className="mt-4 text-xl font-black text-gray-950">
            Giỏ hành trang đang trống
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            {error ?? "Hãy chọn ít nhất một thiết bị trước khi tạo báo giá."}
          </p>
          <Link
            href={`/rentals?bookingId=${encodeURIComponent(bookingId)}`}
            className="mt-6 inline-flex rounded-xl bg-[#174B36] px-5 py-3 text-sm font-black text-white"
          >
            Quay lại chọn thiết bị
          </Link>
        </div>
      </div>
    );
  }

  const { eligibility, lines } = data;

  if (quote) {
    return (
      <div className="min-h-screen bg-[#F4F6F1] px-4 py-12">
        <main className="mx-auto max-w-3xl rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_18px_50px_rgba(22,63,45,0.10)] sm:p-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
            ✓
          </div>
          <h1 className="mt-5 text-center text-3xl font-black text-gray-950">
            Báo giá hành trang đã sẵn sàng
          </h1>
          <p className="mt-2 text-center text-xs font-semibold text-gray-500">
            Mã báo giá #{shortCode(quote.id)} · {quote.chargedDays} ngày tính
            phí
          </p>

          <div className="mt-8 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-[#FAFBF8] px-5">
            {quote.items.map((item) => {
              const product = lines.find(
                (line) => line.product.id === item.productId,
              )?.product;
              return (
                <div
                  key={item.productId}
                  className="flex items-center gap-4 py-4"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#EEF3EF]">
                    {product?.imageUrls[0] ? (
                      <img
                        src={product.imageUrls[0]}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-2xl">
                        🏕️
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-950">{item.name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Số lượng {item.quantity} ·{" "}
                      {formatMoney(item.dailyPrice, quote.amounts.currency)}
                      /ngày
                    </p>
                  </div>
                  <p className="text-sm font-black text-[#174B36]">
                    {formatMoney(item.feeAmount, quote.amounts.currency)}
                  </p>
                </div>
              );
            })}
          </div>

          <dl className="mt-5 space-y-3 rounded-2xl bg-[#F0F6EF] p-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Phí thuê</dt>
              <dd className="font-black">
                {formatMoney(quote.amounts.feeAmount, quote.amounts.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Tiền cọc</dt>
              <dd className="font-black">
                {formatMoney(
                  quote.amounts.depositAmount,
                  quote.amounts.currency,
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t border-emerald-900/10 pt-3 text-base">
              <dt className="font-black">Tổng thanh toán</dt>
              <dd className="text-xl font-black text-[#174B36]">
                {formatMoney(quote.amounts.totalAmount, quote.amounts.currency)}
              </dd>
            </div>
          </dl>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Nhận thiết bị
              </p>
              <p className="mt-2 text-sm font-black">{quote.pickup.name}</p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(quote.pickup.scheduledAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Trả thiết bị
              </p>
              <p className="mt-2 text-sm font-black">{quote.dropoff.name}</p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(quote.dropoff.scheduledAt)}
              </p>
            </div>
          </div>

          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Báo giá có hiệu lực đến{" "}
            <strong>{formatDate(quote.expiresAt)}</strong>. Hệ thống chỉ giữ
            thiết bị sau khi tạo đơn.
          </p>

          <section className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              Thanh toán an toàn
            </p>
            <h2 className="mt-1 text-xl font-black text-gray-950">
              Chọn cổng thanh toán
            </h2>
            {paymentGateways.length === 0 && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                Backend chưa trả về VNPay hoặc MoMo khả dụng.
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    id: "vnpay",
                    title: "VNPay",
                    detail: "ATM, QR và ngân hàng",
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
                .filter((option) => paymentGateways.includes(option.id))
                .map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={Boolean(payment) || submitting}
                    onClick={() => {
                      setGateway(option.id);
                      paymentKeyRef.current = null;
                      setPayment(null);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${gateway === option.id ? "border-emerald-500 bg-white shadow-lg" : "border-emerald-100 bg-white/70 hover:border-emerald-300"}`}
                  >
                    <span
                      className={`grid h-11 w-11 place-items-center rounded-2xl text-sm font-black ${gateway === option.id ? "bg-[#174B36] text-white" : "bg-emerald-100 text-emerald-800"}`}
                    >
                      {option.icon}
                    </span>
                    <span>
                      <span className="block font-black">{option.title}</span>
                      <span className="block text-xs text-gray-500">
                        {option.detail}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
            {orderResult && (
              <div className="mt-4 rounded-2xl bg-white p-4 text-xs text-gray-600">
                <p>
                  Mã đơn thuê{" "}
                  <strong className="text-gray-950">
                    #{shortCode(orderResult.order.id)}
                  </strong>
                </p>
                <p className="mt-1">
                  Giữ đến{" "}
                  <strong className="text-gray-950">
                    {formatDate(orderResult.order.paymentExpiresAt)}
                  </strong>
                </p>
                <PaymentCountdown
                  expiresAt={orderResult.order.paymentExpiresAt}
                />
              </div>
            )}
            {error && (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleCreateOrderAndPayment}
              disabled={submitting || paymentGateways.length === 0}
              className="mt-5 flex w-full justify-center rounded-2xl bg-[#174B36] px-6 py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#0F5A3B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? orderResult
                  ? "Đang mở cổng thanh toán..."
                  : "Đang giữ thiết bị..."
                : `Giữ thiết bị & thanh toán qua ${gateway === "vnpay" ? "VNPay" : "MoMo"}`}
            </button>
          </section>
          <Link
            href={`/rentals?bookingId=${encodeURIComponent(bookingId)}`}
            className="mt-4 flex justify-center rounded-xl border border-gray-200 px-6 py-4 text-sm font-black text-gray-700 hover:border-emerald-400"
          >
            Quay lại danh mục
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F1]">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 flex items-center gap-2 text-xs font-bold text-gray-500">
          <Link
            href={`/rentals?bookingId=${encodeURIComponent(bookingId)}`}
            className="hover:text-emerald-700"
          >
            Danh mục thuê
          </Link>
          <span>/</span>
          <span className="text-gray-900">Kiểm tra giỏ hành trang</span>
        </nav>
        <div className="grid gap-7 lg:grid-cols-[1fr_380px]">
          <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_12px_35px_rgba(22,63,45,0.08)] sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Bước 1 · Kiểm tra hành trang
            </p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">
              Giỏ thiết bị thuê
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Kiểm tra lại số lượng. Backend sẽ xác nhận tồn kho và tính chính
              xác phí thuê, tiền cọc cho toàn bộ giỏ.
            </p>

            <div className="mt-7 space-y-3">
              {lines.map((line) => {
                const shortage =
                  line.quantity > line.availability.availableCount;
                return (
                  <div
                    key={line.product.id}
                    className={`flex gap-4 rounded-2xl border p-4 ${shortage ? "border-red-200 bg-red-50" : "border-gray-200"}`}
                  >
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#EEF3EF]">
                      {line.product.imageUrls[0] ? (
                        <img
                          src={line.product.imageUrls[0]}
                          alt={line.product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-3xl">
                          🏕️
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        {line.product.category.name}
                      </p>
                      <h2 className="mt-1 font-black text-gray-950">
                        {line.product.name}
                      </h2>
                      {line.product.sku && (
                        <p className="mt-1 text-[10px] font-bold uppercase text-gray-400">
                          SKU {line.product.sku}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-black text-[#174B36]">
                          {formatMoney(
                            line.product.dailyPrice,
                            line.product.currency,
                          )}
                          /ngày
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              cart.setQuantity(
                                line.product,
                                line.availability.availableCount,
                                line.quantity - 1,
                              )
                            }
                            className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 font-black"
                          >
                            −
                          </button>
                          <span className="min-w-6 text-center text-sm font-black">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={
                              line.quantity >= line.availability.availableCount
                            }
                            onClick={() =>
                              cart.setQuantity(
                                line.product,
                                line.availability.availableCount,
                                line.quantity + 1,
                              )
                            }
                            className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 font-black disabled:text-gray-300"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p
                        className={`mt-2 text-xs font-bold ${shortage ? "text-red-700" : "text-gray-500"}`}
                      >
                        {shortage
                          ? `Chỉ còn ${line.availability.availableCount} thiết bị`
                          : `Tồn kho khả dụng: ${line.availability.availableCount}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {eligibility.recipientOptions.length > 0 && (
              <div className="mt-7">
                <label
                  htmlFor="rental-recipient"
                  className="text-sm font-black text-gray-900"
                >
                  Người nhận thiết bị
                </label>
                <select
                  id="rental-recipient"
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                  className="mt-3 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold outline-none focus:border-emerald-600"
                >
                  {eligibility.recipientOptions.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {eligibility.pickup && (
                <div className="rounded-2xl bg-[#F4F6F1] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                    Nhận thiết bị
                  </p>
                  <p className="mt-2 text-sm font-black">
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
                <div className="rounded-2xl bg-[#F4F6F1] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                    Trả thiết bị
                  </p>
                  <p className="mt-2 text-sm font-black">
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
          </section>

          <aside className="h-fit rounded-[28px] bg-[#123D2C] p-6 text-white shadow-[0_18px_45px_rgba(18,61,44,0.22)] lg:sticky lg:top-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-300">
              Chuyến đi
            </p>
            <h2 className="mt-2 text-xl font-black">{eligibility.trip.name}</h2>
            <p className="mt-2 text-xs leading-5 text-emerald-50/70">
              {estimatedDays} ngày · {lines.length} loại ·{" "}
              {lines.reduce((sum, line) => sum + line.quantity, 0)} thiết bị
            </p>
            <dl className="mt-6 space-y-4 border-y border-white/15 py-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-emerald-50/70">Phí thuê dự kiến</dt>
                <dd className="font-black">{formatMoney(estimatedFee)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-emerald-50/70">Tiền cọc</dt>
                <dd className="font-bold text-lime-300">Backend sẽ tính</dd>
              </div>
            </dl>
            {!eligibility.eligible && (
              <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs font-bold text-amber-100">
                {eligibility.reason ?? "Chuyến đi chưa đủ điều kiện thuê."}
              </p>
            )}
            {shortages.length > 0 && (
              <p className="mt-4 rounded-xl border border-red-300/30 bg-red-300/10 p-3 text-xs font-bold text-red-100">
                Có thiết bị vượt số lượng tồn kho. Hãy giảm số lượng để tiếp
                tục.
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-xl border border-red-300/30 bg-red-300/10 p-3 text-xs font-bold text-red-100">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleCreateQuote}
              disabled={!canCreateRental || submitting}
              className="mt-5 flex w-full justify-center rounded-2xl bg-lime-300 px-5 py-4 text-sm font-black text-[#123D2C] shadow-lg transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/50"
            >
              {submitting
                ? "Đang kiểm tra tồn kho..."
                : "Tạo báo giá cho toàn bộ giỏ →"}
            </button>
            <Link
              href={`/rentals?bookingId=${encodeURIComponent(bookingId)}`}
              className="mt-3 flex w-full justify-center rounded-2xl border border-white/20 px-5 py-3 text-xs font-black text-white hover:bg-white/10"
            >
              Chọn thêm thiết bị
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
