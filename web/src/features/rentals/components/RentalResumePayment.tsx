"use client";

import { useEffect, useState } from "react";

import {
  createRentalPayment,
  getRentalApiErrorMessage,
  getRentalPaymentOptions,
} from "@/features/rentals/services/rental.api";
import type { RentalPaymentGateway } from "@/features/rentals/types/rental";

// Thanh toán tiếp một đơn thuê đang chờ thanh toán (khách thoát giữa chừng rồi quay lại).
// Khoá idempotency lưu theo đơn + cổng để bấm lại không tạo giao dịch trùng.

const TERMINAL_PAYMENT_STATUSES = new Set(["FAILED", "CANCELLED", "EXPIRED"]);
const GATEWAY_LABELS: Record<RentalPaymentGateway, string> = { vnpay: "VNPAY", momo: "MoMo" };

const keyStorageName = (orderId: string, gateway: RentalPaymentGateway) =>
  `trekgo:rental-payment-key:${orderId}:${gateway}`;

function newKey(orderId: string, gateway: RentalPaymentGateway) {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `rental-payment-${orderId}-${gateway}-${random}`;
}

function readKey(orderId: string, gateway: RentalPaymentGateway) {
  try {
    const stored = localStorage.getItem(keyStorageName(orderId, gateway));
    if (stored) return stored;
    const created = newKey(orderId, gateway);
    localStorage.setItem(keyStorageName(orderId, gateway), created);
    return created;
  } catch {
    return newKey(orderId, gateway);
  }
}

function dropKey(orderId: string, gateway: RentalPaymentGateway) {
  try {
    localStorage.removeItem(keyStorageName(orderId, gateway));
  } catch {
    // Trình duyệt chặn bộ nhớ: lần sau tự tạo khoá mới.
  }
}

export function RentalResumePayment({
  orderId,
  bookingId,
  expiresAt,
}: {
  orderId: string;
  bookingId: string | null;
  expiresAt: string;
}) {
  const [gateways, setGateways] = useState<RentalPaymentGateway[]>([]);
  const [gateway, setGateway] = useState<RentalPaymentGateway>("vnpay");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const check = () => setExpired(new Date(expiresAt).getTime() <= Date.now());
    check();
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    const controller = new AbortController();
    getRentalPaymentOptions(controller.signal)
      .then((options) => {
        const available = options.gateways.map((option) => option.gateway);
        setGateways(available);
        if (available.length && !available.includes("vnpay")) setGateway(available[0]);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(getRentalApiErrorMessage(reason, "Chưa tải được cổng thanh toán."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingOptions(false);
      });
    return () => controller.abort();
  }, []);

  async function pay() {
    if (submitting || expired || !gateways.includes(gateway)) return;
    setSubmitting(true);
    setError(null);
    try {
      let payment = await createRentalPayment(orderId, { paymentMethod: "REDIRECT", gateway }, readKey(orderId, gateway));
      // Giao dịch cũ đã hỏng/hết hạn: tạo lần thanh toán mới với khoá mới.
      if (TERMINAL_PAYMENT_STATUSES.has(payment.status) || !payment.checkout?.url) {
        if (payment.reconciliationRequired) {
          setError("Cổng thanh toán đang xác minh giao dịch trước đó. Vui lòng chờ ít phút rồi tải lại trang.");
          return;
        }
        dropKey(orderId, gateway);
        payment = await createRentalPayment(orderId, { paymentMethod: "REDIRECT", gateway }, readKey(orderId, gateway));
      }
      if (!payment.checkout?.url) {
        setError("Cổng thanh toán chưa trả về đường dẫn. Vui lòng thử lại sau ít phút.");
        return;
      }
      sessionStorage.setItem(
        "trekgo:rental-payment-return",
        JSON.stringify({ orderId, bookingId: bookingId ?? "", paymentId: payment.paymentId }),
      );
      window.location.assign(payment.checkout.url);
    } catch (reason) {
      setError(getRentalApiErrorMessage(reason, "Chưa mở được cổng thanh toán."));
    } finally {
      setSubmitting(false);
    }
  }

  if (expired) {
    return (
      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        Đơn đã quá hạn thanh toán nên thiết bị không còn được giữ. Bạn có thể tạo đơn mới từ danh mục thuê.
      </section>
    );
  }

  return (
    <section id="thanh-toan" className="mt-4 scroll-mt-24 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">Thanh toán tiếp</h2>
      <p className="mt-1 text-sm text-gray-500">Thiết bị vẫn đang được giữ cho bạn đến hết thời gian thanh toán.</p>
      {loadingOptions ? (
        <p className="mt-4 text-sm text-gray-500">Đang tải cổng thanh toán...</p>
      ) : gateways.length === 0 ? (
        <p className="mt-4 text-sm text-amber-700">Hiện chưa có cổng thanh toán khả dụng. Vui lòng thử lại sau.</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {gateways.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setGateway(item)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                gateway === item ? "border-[#1B5E41] bg-emerald-50 text-[#1B5E41]" : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {GATEWAY_LABELS[item]}
            </button>
          ))}
          <button
            type="button"
            disabled={submitting}
            onClick={() => void pay()}
            className="ml-auto rounded-xl bg-[#1B5E41] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#144a33] disabled:opacity-60"
          >
            {submitting ? "Đang mở cổng thanh toán..." : `Thanh toán qua ${GATEWAY_LABELS[gateway]}`}
          </button>
        </div>
      )}
      {error ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
