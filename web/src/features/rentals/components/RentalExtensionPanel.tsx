"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button, ErrorAlert, FormField, InfoBanner, Input, LoadingState, StatusBadge, SurfaceCard } from "@/components/ui";
import { getRentalPaymentOptions } from "@/features/rentals/services/rental.api";
import {
  confirmRentalExtension,
  createRentalExtensionPayment,
  EXTENSION_STATUS_LABELS,
  getExtensionErrorMessage,
  getRentalReturnOptions,
  listRentalExtensions,
  quoteRentalExtension,
  type RentalExtension,
  type RentalExtensionQuote,
  type RentalReturnOption,
} from "@/features/rentals/services/rental-extension.api";
import type { RentalPaymentGateway } from "@/features/rentals/types/rental";

import { money } from "./RentalSectionNav";

const TIME_PRESETS = ["07:00", "09:00", "11:00", "13:30", "15:00", "17:00", "19:00"];
const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const GATEWAY_LABELS: Record<string, string> = { vnpay: "VNPAY", momo: "MoMo", payos: "PayOS" };
const BADGE_STATUS: Record<string, string> = {
  QUOTED: "PENDING",
  PENDING_PAYMENT: "PENDING_PAYMENT",
  APPLIED: "COMPLETED",
  REJECTED_CAPACITY: "CANCELLED",
  EXPIRED: "EXPIRED",
  PAYMENT_FAILED: "CANCELLED",
  CANCELLED: "CANCELLED",
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const longDateTime = (value: string | Date) => {
  const d = new Date(value);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} lúc ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const shortDateTime = (value: string | Date) =>
  new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

function combine(date: string, time: string): Date | null {
  if (!date || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isFinite(value.getTime()) ? value : null;
}

function newKey(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Gia hạn đơn thuê: khách đang giữ đồ chọn giờ trả mới → xem phí → xác nhận → thanh toán nếu có phí.
 * Server quyết định khung giờ được phép (returnOptions) và tính phí; FE chỉ hiển thị.
 */
export function RentalExtensionPanel({
  orderId,
  tripId,
  orderStatus,
  dueAt,
  currency,
  onExtended,
}: {
  orderId: string;
  tripId: string;
  orderStatus: string;
  dueAt?: string | null;
  currency: string;
  onExtended: () => void;
}) {
  const [extensions, setExtensions] = useState<RentalExtension[]>([]);
  const [option, setOption] = useState<RentalReturnOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [quote, setQuote] = useState<RentalExtensionQuote | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [gateways, setGateways] = useState<RentalPaymentGateway[]>([]);
  const [gateway, setGateway] = useState<RentalPaymentGateway>("vnpay");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmKey = useRef<string | null>(null);
  const payKeys = useRef<Record<string, string>>({});

  const fetchState = useCallback(async () => {
    const [items, options] = await Promise.all([
      listRentalExtensions(orderId).catch(() => [] as RentalExtension[]),
      orderStatus === "ACTIVE" ? getRentalReturnOptions(tripId).catch(() => [] as RentalReturnOption[]) : Promise.resolve([]),
    ]);
    return { items, option: options[0] ?? null };
  }, [orderId, orderStatus, tripId]);

  const reload = useCallback(async () => {
    const next = await fetchState();
    setExtensions(next.items);
    setOption(next.option);
  }, [fetchState]);

  useEffect(() => {
    let active = true;
    fetchState()
      .then((next) => {
        if (!active) return;
        setExtensions(next.items);
        setOption(next.option);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    getRentalPaymentOptions()
      .then((result) => {
        if (!active) return;
        const available = result.gateways.map((item) => item.gateway);
        setGateways(available);
        if (available.length && !available.includes("vnpay")) setGateway(available[0]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [fetchState]);

  const history = extensions.filter((item) => item.status !== "QUOTED");
  if (orderStatus !== "ACTIVE" && history.length === 0) return null;

  const now = new Date();
  const pending = extensions.find(
    (item) => item.status === "PENDING_PAYMENT" && (!item.holdExpiresAt || new Date(item.holdExpiresAt) > now),
  );
  const due = dueAt ? new Date(dueAt) : null;
  const windowEnd = option ? new Date(option.windowEnd) : null;
  const picked = combine(date, time);
  const pickedError = !picked
    ? null
    : due && picked <= due
      ? `Giờ trả mới phải sau hạn hiện tại (${shortDateTime(due)}).`
      : windowEnd && picked > windowEnd
        ? `Chỉ gia hạn được tới ${shortDateTime(windowEnd)}.`
        : null;
  const canExtend = orderStatus === "ACTIVE" && !!option && !pending;

  const changeSlot = (nextDate: string, nextTime: string) => {
    setQuote(null);
    setAgreed(false);
    setError(null);
    setDate(nextDate);
    setTime(nextTime);
  };

  async function getQuote() {
    if (!option || !picked || pickedError) {
      setError(pickedError ?? "Vui lòng chọn ngày và giờ trả mới.");
      return;
    }
    setBusy("quote");
    setError(null);
    try {
      setQuote(await quoteRentalExtension(orderId, { requestedReturnAt: picked.toISOString(), returnOptionId: option.id }));
      setAgreed(false);
      confirmKey.current = null;
    } catch (e) {
      setError(getExtensionErrorMessage(e, "Không tính được phí gia hạn."));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!quote || !agreed) return;
    if (new Date(quote.expiresAt) <= new Date()) {
      setQuote(null);
      setError("Báo giá đã hết hạn, vui lòng bấm xem phí lại.");
      return;
    }
    setBusy("confirm");
    setError(null);
    confirmKey.current ??= newKey("rental-extension");
    try {
      const result = await confirmRentalExtension(orderId, quote, confirmKey.current);
      confirmKey.current = null;
      setQuote(null);
      setOpen(false);
      setDate("");
      setTime("");
      if (result.status === "APPLIED") {
        setNotice("Đã gia hạn. Hạn trả mới đã được cập nhật.");
        onExtended();
      } else {
        setNotice(`Đã giữ thiết bị cho lần gia hạn. Thanh toán ${money(result.additionalFee, currency)} để hoàn tất.`);
      }
      await reload();
    } catch (e) {
      setError(getExtensionErrorMessage(e, "Không xác nhận được gia hạn."));
      confirmKey.current = null;
    } finally {
      setBusy(null);
    }
  }

  async function pay(extension: RentalExtension) {
    // Mở tab trước khi gọi API để trình duyệt không chặn cửa sổ bật lên.
    const tab = window.open("about:blank", "_blank");
    setBusy("pay");
    setError(null);
    const keyName = `${extension.id}:${gateway}`;
    payKeys.current[keyName] ??= newKey("rental-extension-pay");
    try {
      const payment = await createRentalExtensionPayment(extension.id, gateway, payKeys.current[keyName]);
      if (!payment.checkout?.url) {
        tab?.close();
        setError(
          payment.reconciliationRequired
            ? "Cổng thanh toán đang xác minh giao dịch trước đó. Chờ ít phút rồi bấm Kiểm tra lại."
            : "Cổng thanh toán chưa trả về đường dẫn. Vui lòng thử lại sau ít phút.",
        );
        return;
      }
      if (tab) tab.location.href = payment.checkout.url;
      else window.location.assign(payment.checkout.url);
      setNotice("Đã mở trang thanh toán ở tab mới. Thanh toán xong, quay lại đây bấm Kiểm tra lại.");
    } catch (e) {
      tab?.close();
      setError(getExtensionErrorMessage(e, "Chưa mở được cổng thanh toán."));
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy("refresh");
    const before = extensions.find((item) => item.status === "PENDING_PAYMENT")?.id;
    await reload();
    setBusy(null);
    if (before) onExtended();
  }

  return (
    <SurfaceCard className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2F6B4F]/10 text-[#125238]">
            <ClockIcon />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1F2937]">Gia hạn thuê</h2>
            <p className="mt-0.5 text-sm text-[#6B7280]">
              Cần giữ đồ lâu hơn? Chọn giờ trả mới, xem phí thêm rồi xác nhận.
              {due ? <> Hạn trả hiện tại: <strong className="tabular-nums text-[#1F2937]">{shortDateTime(due)}</strong>.</> : null}
            </p>
          </div>
        </div>
        {canExtend && !open ? (
          <Button onClick={() => setOpen(true)}>Gia hạn</Button>
        ) : null}
      </div>

      {loading ? <LoadingState /> : null}
      {notice ? <InfoBanner className="mt-4" tone="success">{notice}</InfoBanner> : null}
      {error ? <ErrorAlert className="mt-4" message={error} onDismiss={() => setError(null)} /> : null}

      {!loading && orderStatus === "ACTIVE" && !option && !pending ? (
        <p className="mt-4 rounded-xl bg-[#F7F7F4] p-3 text-sm text-[#6B7280]">
          Chuyến đi này hiện không có khung giờ trả muộn hơn nên chưa gia hạn được.
        </p>
      ) : null}

      {pending ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            Chờ thanh toán {money(pending.additionalFee, currency)} để gia hạn tới {longDateTime(pending.requestedRentalEndAt)}
          </p>
          {pending.holdExpiresAt ? (
            <p className="mt-1 text-xs text-amber-800">Thiết bị được giữ cho bạn tới {shortDateTime(pending.holdExpiresAt)}. Quá giờ này yêu cầu tự huỷ.</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {gateways.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setGateway(item)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium ${gateway === item ? "border-[#1B5E41] bg-white text-[#1B5E41]" : "border-amber-200 text-gray-700"}`}
              >
                {GATEWAY_LABELS[item] ?? item}
              </button>
            ))}
            <Button loading={busy === "pay"} disabled={!gateways.length || Boolean(busy)} onClick={() => void pay(pending)}>
              Thanh toán {gateways.length ? `qua ${GATEWAY_LABELS[gateway] ?? gateway}` : ""}
            </Button>
            <Button variant="secondary" loading={busy === "refresh"} disabled={Boolean(busy)} onClick={() => void refresh()}>
              Kiểm tra lại
            </Button>
          </div>
        </div>
      ) : null}

      {open && canExtend && option ? (
        <div className="mt-5 space-y-4 border-t border-[#E5E7EB] pt-4">
          <p className="text-xs text-[#6B7280]">
            Trả tại <strong className="text-[#1F2937]">{option.pointName}</strong> · được gia hạn tới{" "}
            <strong className="tabular-nums text-[#1F2937]">{shortDateTime(option.windowEnd)}</strong>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Ngày trả mới" required>
              <Input
                type="date"
                value={date}
                suppressHydrationWarning
                min={due ? toDateValue(due) : toDateValue(now)}
                max={windowEnd ? toDateValue(windowEnd) : undefined}
                onChange={(e) => changeSlot(e.target.value, time)}
              />
            </FormField>
            <FormField label="Giờ trả mới" required>
              <Input type="time" value={time} suppressHydrationWarning onChange={(e) => changeSlot(date, e.target.value)} />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TIME_PRESETS.map((preset) => {
              const at = combine(date, preset);
              const disabled = !!at && ((!!due && at <= due) || (!!windowEnd && at > windowEnd));
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={disabled}
                  onClick={() => changeSlot(date, preset)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums disabled:cursor-not-allowed disabled:opacity-40 ${
                    time === preset ? "bg-[#125238] text-white" : "border border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#2F6B4F]"
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
          {pickedError ? <p className="text-sm font-semibold text-[#DC2626]">{pickedError}</p> : null}

          {quote ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <dl className="space-y-1">
                <div className="flex justify-between gap-3"><dt className="text-[#6B7280]">Hạn trả hiện tại</dt><dd className="tabular-nums">{longDateTime(quote.currentDueAt)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[#6B7280]">Hạn trả mới</dt><dd className="font-bold tabular-nums text-[#125238]">{longDateTime(quote.requestedReturnAt)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[#6B7280]">Tổng số ngày tính phí</dt><dd className="tabular-nums">{quote.chargedDays} ngày</dd></div>
                <div className="flex justify-between gap-3 border-t border-emerald-200 pt-1"><dt className="font-bold text-[#1F2937]">Phí gia hạn</dt><dd className="text-base font-black tabular-nums text-[#125238]">{quote.additionalFee > 0 ? money(quote.additionalFee, quote.currency) : "Miễn phí"}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-[#6B7280]">Báo giá giữ tới {shortDateTime(quote.expiresAt)}. Tiền cọc không đổi.</p>
              <label className="mt-3 flex items-start gap-2 text-xs text-[#1F2937]">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#125238]" />
                <span>Tôi đồng ý gia hạn theo điều khoản thuê (phiên bản {quote.termsVersion}) và trả đồ đúng giờ mới.</span>
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {quote ? (
              <Button loading={busy === "confirm"} disabled={!agreed || Boolean(busy)} onClick={() => void confirm()}>
                {quote.additionalFee > 0 ? "Xác nhận & giữ thiết bị" : "Xác nhận gia hạn"}
              </Button>
            ) : (
              <Button loading={busy === "quote"} disabled={!picked || Boolean(pickedError) || Boolean(busy)} onClick={() => void getQuote()}>
                Xem phí gia hạn
              </Button>
            )}
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => {
                setOpen(false);
                changeSlot("", "");
              }}
            >
              Huỷ
            </Button>
          </div>
        </div>
      ) : null}

      {history.length ? (
        <div className="mt-5 border-t border-[#E5E7EB] pt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6B7280]">Lịch sử gia hạn</p>
          <ul className="space-y-2">
            {history.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F7F4] px-3 py-2 text-sm">
                <span className="tabular-nums text-[#1F2937]">
                  {shortDateTime(item.previousRentalEndAt)} → <strong>{shortDateTime(item.requestedRentalEndAt)}</strong>
                  <span className="ml-2 text-xs text-[#6B7280]">{item.additionalFee > 0 ? money(item.additionalFee, item.currency) : "Miễn phí"}</span>
                </span>
                <StatusBadge status={BADGE_STATUS[item.status] ?? item.status} customLabel={EXTENSION_STATUS_LABELS[item.status] ?? item.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
