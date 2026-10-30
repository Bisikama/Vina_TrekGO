"use client";

import Link from "next/link";
import { useState } from "react";

const checks = ["Đối chiếu tên và giấy tờ người nhận", "Niêm phong kiện còn nguyên", "Khách kiểm đủ thiết bị", "Chụp ảnh bàn giao cùng khách"];

export function StaffDeliveryField() {
  const [done, setDone] = useState<boolean[]>(checks.map(() => false));
  const completed = done.filter(Boolean).length;
  const ready = completed === checks.length;
  return (
    <main className="min-h-[760px] bg-[#07110c] px-4 py-7 text-white sm:px-8">
      <p className="text-xs font-black uppercase tracking-[.17em] text-[#f58b36]">Giao nhận thực địa</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">Bàn giao tại hiện trường</h1>
      <p className="mt-2 max-w-2xl text-sm text-emerald-100/60">Giao diện ưu tiên điện thoại. Tích đủ các bước và lưu ảnh trước khi xác nhận chuyển custody.</p>
      <section className="mx-auto mt-7 max-w-[430px] overflow-hidden rounded-[32px] border border-emerald-800 bg-[#0d1f16] shadow-2xl">
        <header className="border-b border-emerald-900 bg-[#08150e] p-5">
          <Link href="/delivery/tasks" className="text-xs font-bold text-emerald-200">← Nhiệm vụ hôm nay</Link>
          <p className="mt-5 font-mono text-xs font-bold text-[#f58b36]">DL-7731 · GIAO THIẾT BỊ</p>
          <h2 className="mt-1 text-xl font-black">Bàn giao tại điểm nhận</h2>
          <p className="mt-2 text-xs text-emerald-100/55">Khung giờ và thông tin kiện lấy từ nhiệm vụ đã chọn</p>
        </header>
        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-emerald-900 bg-[#10251a] p-4"><b>Kiện đã quét</b><p className="mt-1 text-xs text-emerald-100/55">Custody đang thuộc nhân viên giao nhận</p></div>
          <div className="rounded-2xl border border-emerald-900 p-4">
            <div className="mb-3 flex items-center justify-between"><b>Kiểm tra trước khi giao</b><span className="text-sm font-black text-[#f58b36]">{completed}/{checks.length}</span></div>
            {checks.map((label, index) => <label key={label} className="flex cursor-pointer items-start gap-3 border-t border-emerald-900 py-3 text-sm first:border-0"><input type="checkbox" checked={done[index]} onChange={(event) => setDone((current) => current.map((value, item) => item === index ? event.target.checked : value))} className="mt-0.5 h-5 w-5 accent-[#f58b36]" /><span>{label}</span></label>)}
          </div>
          <label className="grid min-h-28 cursor-pointer place-items-center rounded-2xl border border-dashed border-emerald-700 bg-[#08150e] text-center text-sm text-emerald-100/65">Chụp / chọn ảnh bàn giao<input type="file" accept="image/*" capture="environment" className="sr-only" /></label>
        </div>
        <footer className="border-t border-emerald-900 bg-[#08150e] p-5"><button type="button" disabled={!ready} className="w-full rounded-xl bg-[#f58b36] px-4 py-4 font-black text-[#211006] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35">{ready ? "Xác nhận đã giao" : `Còn ${checks.length - completed} bước cần hoàn tất`}</button><button type="button" className="mt-2 w-full px-4 py-3 text-sm font-bold text-red-300">Báo sự cố cho điều phối</button></footer>
      </section>
    </main>
  );
}
