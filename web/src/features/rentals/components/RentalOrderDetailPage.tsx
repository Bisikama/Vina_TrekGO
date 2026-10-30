/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { bookingApi } from "@/features/bookings/booking.api";
import { getRentalApiErrorMessage, getRentalProduct } from "@/features/rentals/services/rental.api";
import {
  getMyRentalOrder,
  getRentalDeposit,
  type RentalDepositItem,
  type RentalDepositStatus,
  type RentalOrderDetail,
} from "@/features/rentals/services/user-rental.api";
import { privateTripsApi } from "@/features/trips/services/private-trips.api";

import { dateTime, money, shortCode } from "./RentalSectionNav";

import { RentalCancellation } from "./RentalCancellation";
import { RentalThreeVisual } from "./visuals/RentalThreeVisual";

type ProductVisual = { name: string; sku?: string; imageUrl?: string };

const depositStatusLabels: Record<string, string> = {
  HELD: "Đang giữ để xử lý",
  REVIEW_REQUIRED: "Đang chờ kiểm tra",
  REFUND_PENDING: "Đang chờ hoàn cọc",
  REFUND_FAILED: "Hoàn cọc cần hỗ trợ",
  DEDUCTED: "Đã khấu trừ",
  REFUNDED: "Đã hoàn cọc",
  SETTLED: "Đã quyết toán",
};

const refundStatusLabels: Record<string, string> = {
  PENDING: "Chờ cổng thanh toán",
  PROCESSING: "Cổng thanh toán đang xử lý",
  SUCCEEDED: "Đã hoàn tiền",
  FAILED: "Hoàn tiền thất bại",
};

function labelOf(labels: Record<string, string>, value?: string | null) {
  if (!value) return "Chưa phát sinh";
  return labels[value] ?? value.replaceAll("_", " ").toLocaleLowerCase("vi-VN");
}

function depositTone(item: RentalDepositItem) {
  if (item.refundStatus === "SUCCEEDED" || item.status === "REFUNDED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (item.refundStatus === "FAILED" || item.status === "REFUND_FAILED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (item.status === "DEDUCTED") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function RentalOrderDetailPage({ orderId }: { orderId: string }) {
  const [detail, setDetail] = useState<RentalOrderDetail | null>(null);
  const [tripName, setTripName] = useState("Chuyến trekking của bạn");
  const [visuals, setVisuals] = useState<Record<string, ProductVisual>>({});
  const [deposit, setDeposit] = useState<RentalDepositStatus>();
  const [depositError, setDepositError] = useState<string>();
  const [depositLoading, setDepositLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDeposit = useCallback(async () => {
    setDepositLoading(true);
    setDepositError(undefined);
    try {
      setDeposit(await getRentalDeposit(orderId));
    } catch (reason) {
      setDepositError(
        getRentalApiErrorMessage(reason, "Không thể tải trạng thái quyết toán cọc."),
      );
    } finally {
      setDepositLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    let active = true;
    getMyRentalOrder(orderId)
      .then(async (value) => {
        if (!active) return;
        setDetail(value);
        const [bookings, privateTrips, productResults] = await Promise.all([
          bookingApi.list(1, "").catch(() => null),
          privateTripsApi.list().catch(() => []),
          Promise.allSettled(
            value.items.map((item) =>
              getRentalProduct(item.product.id || item.productId || ""),
            ),
          ),
        ]);
        if (!active) return;
        const booking = bookings?.items.find((item) => item.trip.id === value.order.tripId);
        const privateTrip = privateTrips.find((item) => item.id === value.order.tripId);
        setTripName(booking?.trip.title || privateTrip?.title || "Chuyến trekking của bạn");
        setVisuals(
          Object.fromEntries(
            productResults.flatMap((result) =>
              result.status === "fulfilled"
                ? [[result.value.id, {
                    name: result.value.name,
                    sku: result.value.sku,
                    imageUrl: result.value.imageUrls[0],
                  }]]
                : [],
            ),
          ),
        );
      })
      .catch((reason) => {
        if (active) {
          setError(getRentalApiErrorMessage(reason, "Không thể tải chi tiết đơn thuê."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  useEffect(() => {
    let active = true;
    getRentalDeposit(orderId)
      .then((value) => {
        if (active) setDeposit(value);
      })
      .catch((reason) => {
        if (active) {
          setDepositError(
            getRentalApiErrorMessage(reason, "Không thể tải trạng thái quyết toán cọc."),
          );
        }
      })
      .finally(() => {
        if (active) setDepositLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <main className="space-y-5">
        <Link href="/rentals/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-[#58685f] hover:text-[#102119]">← Đơn thuê của bạn</Link>

        {loading ? (
          <State text="Đang tải chi tiết đơn thuê..." />
        ) : error || !detail ? (
          <State text={error || "Không tìm thấy đơn thuê."} />
        ) : (
          <>
            <RentalThreeVisual
              variant="order"
              progress={orderProgress(detail.order.status)}
              eyebrow={`Hành trình đơn #${shortCode(orderId)}`}
              title={tripName}
              description={`${dateTime(detail.trip.rentalStartAt)} – ${dateTime(detail.order.dueAt)} · ${detail.items.length} thiết bị. Đường trail cam là chặng đơn đã đi qua.`}
              badge={detail.order.status.replaceAll("_", " ")}
              footer={`ĐƠN #${shortCode(orderId)} · THEO DÕI THỜI GIAN THỰC`}
              compact
            />
            <RentalCancellation orderId={orderId} status={detail.order.status} onCancelled={async () => { setDetail(await getMyRentalOrder(orderId)); await loadDeposit(); }} />
            <div className="grid gap-3 md:grid-cols-3">
              <Info label="Trạng thái" value={detail.order.status.replaceAll("_", " ")} />
              <Info
                label="Tổng thanh toán"
                value={money(detail.order.totalAmount, detail.order.currency)}
              />
              <Info label="Hạn trả thiết bị" value={dateTime(detail.order.dueAt)} />
            </div>

            {detail.order.status === "PENDING_PAYMENT" ? (
              <PaymentCountdown expiresAt={detail.order.paymentExpiresAt} />
            ) : null}

            <section className="mt-1">
              <h2 className="text-[22px] font-black tracking-[-0.025em] text-[#102119]">Thiết bị trong đơn</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {detail.items.map((item) => {
                  const visual = visuals[item.product.id] || item.product;
                  return (
                    <article key={item.id} className="flex gap-4 rounded-2xl border border-[#d6ded6] bg-white p-4">
                      {visual.imageUrl ? (
                        <img
                          src={visual.imageUrl}
                          alt={visual.name}
                          className="h-24 w-24 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-emerald-50 text-2xl">
                          ⛺
                        </div>
                      )}
                      <div className="min-w-0">
                        {visual.sku ? (
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                            {visual.sku}
                          </p>
                        ) : null}
                        <h3 className="mt-1 font-black text-gray-900">{visual.name}</h3>
                        <p className="mt-2 text-xs text-gray-500">Số lượng: {item.quantity}</p>
                        <p className="mt-1 text-sm font-extrabold text-gray-900">
                          {money(item.feeAmount, detail.order.currency)}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Location title="Điểm nhận" point={detail.pickupPoint} />
              <Location title="Điểm trả" point={detail.returnPoint} />
            </div>

            <DepositSettlementPanel
              deposit={deposit}
              currency={detail.order.currency}
              loading={depositLoading}
              error={depositError}
              onRetry={() => void loadDeposit()}
            />

            <div className="mt-6 flex flex-wrap gap-3">
              {detail.order.status === "COMPLETED" &&
              detail.order.financialStatus === "SETTLED" ? (
                <Link
                  href={`/rentals/reviews/${orderId}`}
                  className="rounded-xl bg-[#1B5E41] px-4 py-2.5 text-xs font-extrabold text-white"
                >
                  Đánh giá thiết bị
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-xl bg-gray-100 px-4 py-2.5 text-xs font-extrabold text-gray-400">
                  Chỉ đánh giá sau khi hoàn tất trả đồ và quyết toán cọc
                </span>
              )}
              <Link
                href="/rentals/transactions"
                className="rounded-xl border border-emerald-900/15 bg-white px-4 py-2.5 text-xs font-extrabold text-gray-700"
              >
                Xem giao dịch hoàn tiền
              </Link>
            </div>
          </>
        )}
    </main>
  );
}

function orderProgress(status: string) {
  const stages = [
    "PENDING_PAYMENT",
    "PAID",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "IN_USE",
    "RETURNING",
    "RETURNED",
    "INSPECTING",
    "COMPLETED",
  ];
  const index = stages.indexOf(status);
  if (status === "CANCELLED" || status === "EXPIRED") return 0;
  return index < 0 ? 0.25 : index / (stages.length - 1);
}

function DepositSettlementPanel({
  deposit,
  currency,
  loading,
  error,
  onRetry,
}: {
  deposit?: RentalDepositStatus;
  currency: string;
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-[#123f31] px-5 py-5 text-white sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">
            Tiền cọc thiết bị
          </p>
          <h2 className="mt-1 text-xl font-black">Quyết toán cọc</h2>
          <p className="mt-1 text-xs leading-5 text-emerald-100/80">
            Quyết toán xác định khoản giữ, khấu trừ và phải hoàn. Hoàn tiền là bước riêng qua cổng thanh toán.
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {loading ? "Đang cập nhật..." : "Cập nhật trạng thái"}
        </button>
      </div>

      {error ? (
        <div className="m-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={onRetry} className="font-bold underline">
            Thử lại
          </button>
        </div>
      ) : null}

      {!error && loading && !deposit ? (
        <div className="p-8 text-center text-sm font-semibold text-slate-500">
          Đang đối chiếu trạng thái cọc từ hệ thống...
        </div>
      ) : null}

      {!error && deposit ? (
        <div className="p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <DepositAmount label="Đã thu" value={deposit.collectedAmount} currency={currency} />
            <DepositAmount label="Đang giữ" value={deposit.heldAmount} currency={currency} />
            <DepositAmount
              label="Chờ hoàn"
              value={deposit.refundPendingAmount}
              currency={currency}
              tone="amber"
            />
            <DepositAmount
              label="Đã hoàn"
              value={deposit.refundedAmount}
              currency={currency}
              tone="green"
            />
            <DepositAmount
              label="Khấu trừ"
              value={deposit.deductionAmount}
              currency={currency}
              tone="slate"
            />
          </div>

          {deposit.refundPendingAmount > 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Khoản “Chờ hoàn” mới là yêu cầu đang xử lý. Chỉ khi cổng thanh toán trả trạng thái thành công, số tiền mới chuyển sang “Đã hoàn”.
            </p>
          ) : null}

          {deposit.settlementMode === "SANDBOX_SIMULATED" ? (
            <p className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs leading-5 text-violet-800">
              {deposit.notice || "Đây là kết quả mô phỏng sandbox, không phải bằng chứng tiền thật đã về tài khoản."}
            </p>
          ) : null}

          {deposit.items.length ? (
            <div className="mt-5 space-y-3">
              {deposit.items.map((item) => (
                <article
                  key={item.unitId}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      Thiết bị {item.assetCode || shortCode(item.unitId)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      Cọc {money(item.depositAmount ?? item.amount ?? 0, currency)}
                    </p>
                    {item.reason ? (
                      <p className="mt-1 text-xs text-slate-500">{item.reason}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${depositTone(item)}`}>
                      {labelOf(depositStatusLabels, item.status)}
                    </span>
                    {item.refundStatus ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {labelOf(refundStatusLabels, item.refundStatus)}
                        {item.refundAmount ? ` · ${money(item.refundAmount, currency)}` : ""}
                      </p>
                    ) : item.deduction ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Khấu trừ {money(item.deduction, currency)}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
              Chưa phát sinh quyết toán theo thiết bị. Tiền cọc sẽ được theo dõi tại đây sau khi thiết bị được bàn giao và hoàn trả.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function DepositAmount({
  label,
  value,
  currency,
  tone = "default",
}: {
  label: string;
  value: number;
  currency: string;
  tone?: "default" | "amber" | "green" | "slate";
}) {
  const tones = {
    default: "bg-emerald-50 text-emerald-950",
    amber: "bg-amber-50 text-amber-950",
    green: "bg-green-50 text-green-950",
    slate: "bg-slate-100 text-slate-900",
  };
  return (
    <div className={`rounded-2xl p-4 ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-1 text-base font-black">{money(value, currency)}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#d6ded6] bg-white p-5">
      <p className="text-xs font-semibold text-[#58685f]">{label}</p>
      <p className="mt-2 text-xl font-black tracking-[-0.02em] text-[#102119]">{value}</p>
    </div>
  );
}

function Location({
  title,
  point,
}: {
  title: string;
  point: RentalOrderDetail["pickupPoint"];
}) {
  return (
    <div className="rounded-2xl border border-[#d6ded6] bg-white p-5">
      <p className="text-xs font-extrabold uppercase tracking-wider text-[#2c6e3e]">{title}</p>
      <p className="mt-2 font-black text-[#102119]">{point?.name || "Chưa cập nhật"}</p>
      <p className="mt-1 text-sm text-[#58685f]">{point?.address}</p>
    </div>
  );
}

function State({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-10 text-center text-sm font-semibold text-gray-500 shadow-sm">
      {text}
    </div>
  );
}

function PaymentCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return (
    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
        Thời gian giữ đơn
      </p>
      <p className="mt-2 text-2xl font-black text-amber-900">
        {remaining > 0
          ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
          : "Đã hết hạn"}
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Hoàn tất chuyển khoản trước khi đồng hồ kết thúc.
      </p>
    </div>
  );
}
