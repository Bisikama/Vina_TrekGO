"use client";

import { useEffect, useState } from "react";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import {
  listRentalTransactions,
  type RentalTransaction,
} from "@/features/rentals/services/user-rental.api";
import {
  dateTime,
  money,
  RentalPageHeader,
  shortCode,
} from "./RentalSectionNav";

export function RentalTransactionsPage() {
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<RentalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listRentalTransactions({ kind: kind || undefined })
      .then((result) => {
        if (active) {
          setItems(result.items ?? []);
          setError(null);
        }
      })
      .catch(
        (reason) =>
          active &&
          setError(
            getRentalApiErrorMessage(
              reason,
              "Không thể tải lịch sử giao dịch.",
            ),
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [kind]);

  return (
    <main className="min-h-[650px] bg-[#F7F7F4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <RentalPageHeader
          eyebrow="Lịch sử giao dịch"
          title="Tài chính minh bạch"
          highlight="cho mọi chuyến đi."
          description="Chỉ hiển thị thanh toán và hoàn tiền thuộc dịch vụ thuê thiết bị."
          action={{ href: "/rentals/orders", label: "Xem đơn thuê" }}
          active="/rentals/transactions"
        />
        <div className="mt-5 flex gap-2">
          {[
            ["", "Tất cả"],
            ["PAYMENT", "Thanh toán"],
            ["REFUND", "Hoàn tiền"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setLoading(true);
                setKind(value);
              }}
              className={`rounded-full px-4 py-2 text-xs font-extrabold ${kind === value ? "bg-emerald-700 text-white" : "bg-white text-gray-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {loading ? (
          <State text="Đang tải giao dịch..." />
        ) : error ? (
          <State text={error} />
        ) : items.length === 0 ? (
          <State text="Chưa có giao dịch phù hợp." />
        ) : (
          <div className="mt-5 space-y-3">
            {items.map((item) => {
              const isRefund = item.kind === "REFUND";
              const orderId =
                item.rentalOrderId || item.orderId || item.sourceId;
              return (
                <article
                  key={item.id}
                  className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl ${isRefund ? "bg-emerald-50" : "bg-amber-50"}`}
                  >
                    {isRefund ? "↩" : "₫"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="font-extrabold text-gray-900">
                        {isRefund ? (REFUND_PURPOSE[item.purpose ?? ""] ?? "Hoàn tiền thuê") : "Thanh toán đơn thuê"}
                      </h2>
                      <strong
                        className={
                          isRefund && item.status === "SUCCEEDED"
                            ? "text-emerald-700"
                            : "text-gray-900"
                        }
                      >
                        {isRefund && item.status === "SUCCEEDED"
                          ? "+"
                          : isRefund
                            ? ""
                            : "−"}
                        {money(item.amount, item.currency)}
                      </strong>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {dateTime(item.createdAt)} ·{" "}
                      <span className={statusTone(item.status)}>{statusText(item)}</span>
                    </p>
                    {orderId && (
                      <p className="mt-2 text-xs font-bold text-emerald-800">
                        Đơn #{shortCode(orderId)}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

const REFUND_PURPOSE: Record<string, string> = {
  DEPOSIT: "Hoàn tiền cọc",
  RENTAL_CANCELLATION: "Hoàn tiền hủy đơn thuê",
  TECHNICAL_REVERSAL: "Hoàn tiền do lỗi thanh toán",
};

// Trạng thái giao dịch bằng tiếng Việt; hoàn tiền thành công ghi "Đã hoàn tiền".
function statusText(item: { kind: string; status: string }) {
  const refund = item.kind === "REFUND";
  switch (item.status) {
    case "SUCCEEDED":
      return refund ? "Đã hoàn tiền" : "Thanh toán thành công";
    case "PENDING":
    case "PROCESSING":
      return refund ? "Đang hoàn tiền" : "Đang xử lý";
    case "FAILED":
      return refund ? "Hoàn tiền chưa thành công" : "Thanh toán thất bại";
    case "CANCELLED":
      return "Đã hủy";
    case "EXPIRED":
      return "Hết hạn";
    default:
      return "Đang cập nhật";
  }
}

function statusTone(status: string) {
  if (status === "SUCCEEDED") return "text-emerald-700";
  if (status === "FAILED") return "text-red-600";
  if (status === "PENDING" || status === "PROCESSING") return "text-amber-700";
  return "text-gray-500";
}

function State({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-10 text-center text-sm font-semibold text-gray-500 shadow-sm">
      {text}
    </div>
  );
}
