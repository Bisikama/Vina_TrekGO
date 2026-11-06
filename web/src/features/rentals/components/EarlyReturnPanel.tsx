"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  ConfirmModal,
  ErrorAlert,
  FormField,
  InfoBanner,
  Input,
  LoadingState,
  StatusBadge,
  SurfaceCard,
} from "@/components/ui";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import {
  cancelEarlyReturn,
  EARLY_RETURN_STATUS_LABELS,
  getEarlyReturn,
  OPEN_EARLY_RETURN_STATUSES,
  requestEarlyReturn,
  type EarlyReturn,
  type EarlyReturnStatus,
} from "@/features/rentals/services/early-return.api";

const BADGE_STATUS: Record<EarlyReturnStatus, string> = {
  PENDING: "PENDING_PAYMENT",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  SUPERSEDED: "CLOSED",
  REJECTED: "CANCELLED",
  EXPIRED: "EXPIRED",
};

const TIME_PRESETS = ["07:00", "09:00", "11:00", "13:30", "15:00", "17:00", "19:00"];
const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

const pad = (n: number) => String(n).padStart(2, "0");
const toDateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateTime = (value: string | Date) =>
  new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
const longDateTime = (d: Date) =>
  `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} lúc ${pad(d.getHours())}:${pad(d.getMinutes())}`;

function periodLabel(time: string) {
  const hour = Number(time.split(":")[0]);
  return hour < 11 ? "Sáng" : hour < 14 ? "Trưa" : hour < 18 ? "Chiều" : "Tối";
}

/** Ghép giá trị của <input type="date"> và <input type="time"> theo giờ máy người dùng. */
function combine(date: string, time: string): Date | null {
  if (!date || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isFinite(value.getTime()) ? value : null;
}

function ReturnIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14L4 9m0 0l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

export function EarlyReturnPanel({
  orderId,
  orderStatus,
  dueAt,
}: {
  orderId: string;
  orderStatus: string;
  dueAt?: string | null;
}) {
  const [request, setRequest] = useState<EarlyReturn | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const cancelKey = useRef<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRequest(await getEarlyReturn(orderId));
      setError(null);
    } catch (e) {
      setError(getRentalApiErrorMessage(e, "Không tải được yêu cầu trả đồ sớm."));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    let active = true;
    getEarlyReturn(orderId)
      .then((value) => {
        if (active) {
          setRequest(value);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError(getRentalApiErrorMessage(e, "Không tải được yêu cầu trả đồ sớm."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  if (orderStatus !== "ACTIVE" && !request) return null;

  const open = !!request && OPEN_EARLY_RETURN_STATUSES.includes(request.status);
  // Thu hồi đã được sắp xếp theo lịch khác hoặc đã xong: không mời khách gửi yêu cầu mới.
  const closedForGood = request?.status === "COMPLETED" || request?.status === "SUPERSEDED";
  const canRequest = orderStatus === "ACTIVE" && !open && !closedForGood && !loading;
  const due = dueAt ? new Date(dueAt) : null;
  const now = new Date();
  const picked = combine(date, time);
  const pickedError = !picked
    ? null
    : picked <= now
      ? "Giờ trả phải ở tương lai."
      : due && picked >= due
        ? `Giờ trả phải trước hạn trả ${dateTime(due)}.`
        : null;
  const slotAt = request ? (request.confirmedSlotAt ?? request.requestedSlotAt) : null;

  const changeSlot = (nextDate: string, nextTime: string) => {
    requestKey.current = null;
    setError(null);
    setDate(nextDate);
    setTime(nextTime);
  };

  async function submit() {
    if (!date || !time) {
      setError("Vui lòng chọn ngày và giờ muốn trả đồ.");
      return;
    }
    if (!picked || pickedError) {
      setError(pickedError ?? "Ngày giờ chưa hợp lệ.");
      return;
    }
    setBusy(true);
    setError(null);
    requestKey.current ??= `early-return-${crypto.randomUUID()}`;
    try {
      setRequest(await requestEarlyReturn(orderId, picked.toISOString(), requestKey.current));
      requestKey.current = null;
      setDate("");
      setTime("");
    } catch (e) {
      setError(getRentalApiErrorMessage(e, "Không gửi được yêu cầu."));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!request) return;
    setBusy(true);
    setError(null);
    cancelKey.current ??= `early-return-${crypto.randomUUID()}`;
    try {
      setRequest(await cancelEarlyReturn(request, cancelKey.current));
      cancelKey.current = null;
    } catch (e) {
      cancelKey.current = null;
      setError(getRentalApiErrorMessage(e, "Không huỷ được yêu cầu."));
      await reload();
    } finally {
      setConfirmCancel(false);
      setBusy(false);
    }
  }

  return (
    <SurfaceCard className="mt-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2F6B4F]/10 text-[#125238]">
          <ReturnIcon />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[#1F2937]">Trả đồ sớm</h2>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            Hẹn giờ để TrekGo đến nhận lại đồ trước hạn. Phí thuê không đổi, tiền cọc xử lý như khi trả đúng hạn.
          </p>
        </div>
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorAlert className="mt-4" message={error} onDismiss={() => setError(null)} /> : null}

      {request && slotAt ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F7F7F4] p-3">
            <span className="text-[#125238]">
              <CalendarIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">Giờ hẹn trả đồ</p>
              <p className="text-sm font-bold text-[#1F2937] tabular-nums">{longDateTime(new Date(slotAt))}</p>
            </div>
            <StatusBadge status={BADGE_STATUS[request.status]} customLabel={EARLY_RETURN_STATUS_LABELS[request.status]} />
          </div>
          {request.status === "PENDING" ? (
            <InfoBanner tone="info">
              {request.supersededAt
                ? "Lịch chuyến đi vừa thay đổi nên lịch trả đồ sớm cần TrekGo xác nhận lại."
                : "TrekGo đã nhận yêu cầu và sẽ xác nhận lịch. Nếu quá giờ hẹn mà chưa được xác nhận, yêu cầu tự hết hạn."}
            </InfoBanner>
          ) : null}
          {request.status === "CONFIRMED" ? (
            <InfoBanner tone="success">
              Lịch đã được xác nhận. Nhân viên có thể đến sớm tối đa 30 phút; hãy chuẩn bị đủ đồ và phụ kiện.
            </InfoBanner>
          ) : null}
          {request.status === "REJECTED" ? (
            <InfoBanner tone="warning" title="TrekGo chưa thể nhận đồ vào giờ này">
              {request.rejectionReason ?? "Vui lòng chọn giờ khác."}
            </InfoBanner>
          ) : null}
          {request.status === "EXPIRED" ? (
            <InfoBanner tone="warning">
              Yêu cầu chưa kịp được xác nhận trước giờ hẹn nên đã hết hạn. Bạn có thể chọn giờ mới.
            </InfoBanner>
          ) : null}
          {request.status === "SUPERSEDED" ? (
            <InfoBanner tone="info">
              Đồ được thu hồi theo lịch khác của đơn (đến hạn trả hoặc do chuyến đi thay đổi), không theo yêu cầu trả sớm này.
            </InfoBanner>
          ) : null}
          {request.status === "COMPLETED" ? (
            <InfoBanner tone="success">Nhân viên đã nhận đồ theo lịch trả sớm.</InfoBanner>
          ) : null}
          {open ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" loading={busy} onClick={() => setConfirmCancel(true)}>
                Huỷ yêu cầu
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void reload()}>
                Làm mới trạng thái
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {canRequest ? (
        <div className="mt-5 space-y-4 border-t border-[#E5E7EB] pt-4">
          {request ? <p className="text-sm font-bold text-[#1F2937]">Chọn lịch mới</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Ngày trả đồ" required>
              <Input
                type="date"
                value={date}
                suppressHydrationWarning
                min={toDateValue(now)}
                max={due ? toDateValue(due) : undefined}
                onChange={(e) => changeSlot(e.target.value, time)}
              />
            </FormField>
            <FormField label="Giờ trả đồ" required>
              <Input type="time" value={time} suppressHydrationWarning onChange={(e) => changeSlot(date, e.target.value)} />
            </FormField>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-[#6B7280]">Gợi ý khung giờ</p>
            <div className="flex flex-wrap gap-1.5">
              {TIME_PRESETS.map((preset) => {
                const at = combine(date, preset);
                const disabled = !!at && (at <= now || (!!due && at >= due));
                const active = time === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={disabled}
                    onClick={() => changeSlot(date, preset)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "bg-[#125238] text-white"
                        : "border border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#2F6B4F]"
                    }`}
                  >
                    {preset} {periodLabel(preset)}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`flex items-center justify-between gap-3 rounded-xl p-3 ${
              pickedError ? "bg-red-50" : "bg-emerald-50"
            }`}
          >
            <div className="text-xs">
              <span className="block text-[#6B7280]">{pickedError ? "Chưa hợp lệ" : "Lịch bạn chọn"}</span>
              <strong className={`text-sm tabular-nums ${pickedError ? "text-[#DC2626]" : "text-[#1F2937]"}`}>
                {pickedError ?? (picked ? longDateTime(picked) : "Chưa chọn ngày và giờ")}
              </strong>
            </div>
            {due ? (
              <span className="shrink-0 rounded bg-emerald-100 px-2.5 py-1 text-xs font-bold text-[#125238] tabular-nums">
                Hạn trả {dateTime(due)}
              </span>
            ) : null}
          </div>

          <Button loading={busy} disabled={!picked || !!pickedError} onClick={() => void submit()}>
            Gửi yêu cầu trả đồ sớm
          </Button>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => void cancel()}
        title="Huỷ yêu cầu trả đồ sớm?"
        description="Đồ sẽ được thu hồi theo hạn trả thường của đơn."
        confirmLabel="Huỷ yêu cầu"
        cancelLabel="Giữ yêu cầu"
        confirmVariant="danger"
        loading={busy}
      />
    </SurfaceCard>
  );
}
