"use client";

import { useEffect, useState } from "react";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import { listRentalTransactions, type RentalTransaction } from "@/features/rentals/services/user-rental.api";
import { dateTime, money, RentalPageHeader, shortCode } from "./RentalSectionNav";

export function RentalTransactionsPage() {
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<RentalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listRentalTransactions({ kind: kind || undefined })
      .then((result) => { if (active) { setItems(result.items ?? []); setError(null); } })
      .catch((reason) => active && setError(getRentalApiErrorMessage(reason, "Không thể tải lịch sử giao dịch.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [kind]);

  return (
    <main className="min-h-[650px] bg-[#F7F7F4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <RentalPageHeader eyebrow="Tài chính minh bạch" title="Lịch sử giao dịch" description="Chỉ hiển thị thanh toán và hoàn tiền thuộc dịch vụ thuê thiết bị." active="/rentals/transactions" />
        <div className="mt-5 flex gap-2">
          {[['', 'Tất cả'], ['PAYMENT', 'Thanh toán'], ['REFUND', 'Hoàn tiền']].map(([value, label]) => (
            <button key={value} onClick={() => { setLoading(true); setKind(value); }} className={`rounded-full px-4 py-2 text-xs font-extrabold ${kind === value ? "bg-emerald-700 text-white" : "bg-white text-gray-600"}`}>{label}</button>
          ))}
        </div>
        {loading ? <State text="Đang tải giao dịch..." /> : error ? <State text={error} /> : items.length === 0 ? <State text="Chưa có giao dịch phù hợp." /> : (
          <div className="mt-5 space-y-3">
            {items.map((item) => {
              const isRefund = item.kind === "REFUND";
              const orderId = item.rentalOrderId || item.orderId || item.sourceId;
              return (
                <article key={item.id} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl ${isRefund ? "bg-emerald-50" : "bg-amber-50"}`}>{isRefund ? "↩" : "₫"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-extrabold text-gray-900">{isRefund ? "Hoàn tiền cọc" : "Thanh toán đơn thuê"}</h2><strong className={isRefund && item.status === "SUCCEEDED" ? "text-emerald-700" : "text-gray-900"}>{isRefund && item.status === "SUCCEEDED" ? "+" : isRefund ? "" : "−"}{money(item.amount, item.currency)}</strong></div>
                    <p className="mt-1 text-xs text-gray-500">{dateTime(item.createdAt)} · {item.status}</p>
                    {orderId && <p className="mt-2 text-xs font-bold text-emerald-800">Đơn #{shortCode(orderId)}</p>}
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

function State({ text }: { text: string }) { return <div className="mt-6 rounded-2xl bg-white p-10 text-center text-sm font-semibold text-gray-500 shadow-sm">{text}</div>; }
