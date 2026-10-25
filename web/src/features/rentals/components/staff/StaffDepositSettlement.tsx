"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getStaffReturn,
  getStaffReturnErrorMessage,
  type StaffReturnDetail,
} from "@/features/rentals/services/staff-returns.api";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

export function StaffDepositSettlement({ returnId }: { returnId: string }) {
  const [detail, setDetail] = useState<StaffReturnDetail>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    getStaffReturn(returnId, controller.signal)
      .then(setDetail)
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(getStaffReturnErrorMessage(requestError));
      });
    return () => controller.abort();
  }, [returnId]);

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-5xl">
        <Link href="/staff/returns" className="text-xs font-bold text-emerald-800">← Quay lại tiếp nhận hoàn trả</Link>
        <h1 className="mt-3 text-2xl font-black">Theo dõi xử lý cọc</h1>
        <p className="mt-1 text-sm text-slate-500">
          Staff Inventory chỉ xem kết quả. Mọi khoản khấu trừ phải được Admin phê duyệt qua ngoại lệ; màn này không giả lập giải ngân.
        </p>
        {error ? <div className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</div> : null}
        {!detail && !error ? <p className="mt-5 text-sm text-slate-500">Đang tải dữ liệu thật...</p> : null}
        {detail ? (
          <div className="mt-5 space-y-3">
            {detail.depositActions.map((item) => {
              const unit = detail.expectedUnits.find((entry) => entry.unitId === item.unitId);
              return (
                <article key={item.unitId} className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h2 className="font-black">{unit?.productName ?? item.unitId}</h2>
                      <p className="mt-1 font-mono text-xs text-slate-500">{unit?.assetCode}</p>
                    </div>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">{item.status}</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Amount label="Tiền cọc" value={item.depositAmount} />
                    <Amount label="Khấu trừ" value={item.deductionAmount} />
                    <Amount label="Hoàn lại" value={item.refundAmount} />
                  </div>
                </article>
              );
            })}
            {detail.depositActions.length === 0 ? (
              <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Chưa có dữ liệu quyết toán cho task này.</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Amount({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-[#edf3ff] p-3"><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="mt-1 font-black">{money(value)}</p></div>;
}
