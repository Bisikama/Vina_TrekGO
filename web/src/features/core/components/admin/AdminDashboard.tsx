"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const RentalThreeCanvas = dynamic(
  () => import("@/features/rentals/components/visuals/RentalThreeCanvas").then((module) => module.RentalThreeCanvas),
  { ssr: false, loading: () => <div className="grid h-full place-items-center text-xs font-bold uppercase tracking-[0.16em] text-emerald-100/60">Đang dựng dữ liệu vận hành…</div> },
);

const metrics = [
  { label: "Doanh thu phí thuê", value: "86,4 tr₫", note: "▲ 18% so với tháng 9", tone: "dark" },
  { label: "Cọc đang giữ", value: "72,3 tr₫", note: "51 đơn đang thuê", tone: "light" },
  { label: "Đang chờ hoàn qua cổng", value: "9,8 tr₫", note: "14 lệnh hoàn", tone: "warm" },
  { label: "Đã khấu trừ", value: "1,2 tr₫", note: "Tỷ lệ hoàn đủ cọc 96%", tone: "light" },
];

const recentOrders = [
  ["#5D8A13", "Bạch Mộc Lương Tử 3N2Đ", "Mai Chi", "Đang hoàn cọc", "2.120.000₫"],
  ["#09DE27", "Lảo Thẩn săn mây", "Nguyễn Văn An", "Sẵn sàng giao", "1.460.000₫"],
  ["#A3F9C2", "Fansipan qua Trạm Tôn", "Trần Hoàng", "Đang thuê", "2.850.000₫"],
];

export const AdminDashboard = () => (
  <main className="space-y-6 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2c6e3e]">Quản trị › Thuê thiết bị</p>
        <h1 className="mt-1 text-4xl font-black tracking-[-0.045em] text-[#0f1f17] sm:text-[44px]">Tổng quan thuê thiết bị</h1>
        <p className="mt-1 text-sm text-[#617067]">Số liệu tháng 10/2026 · dữ liệu vận hành</p>
      </div>
      <div className="flex gap-3">
        <button type="button" className="rounded-[14px] border border-[#d3dbd3] bg-white px-5 py-3 text-sm font-black text-[#122219]">Tháng 10 ▾</button>
        <button type="button" className="rounded-[14px] border border-[#d3dbd3] bg-white px-5 py-3 text-sm font-black text-[#122219]">Xuất báo cáo</button>
      </div>
    </header>

    <Link href="/admin/rental-returns" className="flex flex-wrap items-center gap-4 rounded-[18px] border border-red-100 bg-[#fde8e5] px-5 py-4 text-[#a72417] transition hover:border-red-300">
      <span className="text-2xl">△</span>
      <span className="min-w-0 flex-1"><b className="block text-sm font-black">3 hồ sơ ngoại lệ cần xử lý</b><span className="text-xs">1 hư hỏng chờ duyệt khấu trừ · 1 sai lệch custody · 1 hoàn cọc cần đối soát</span></span>
      <b className="text-sm">Mở hàng xử lý →</b>
    </Link>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article key={metric.label} className={`rounded-[18px] border p-5 ${metric.tone === "dark" ? "border-[#082117] bg-[#082117] text-white" : metric.tone === "warm" ? "border-[#fee1b4] bg-[#fff0d7] text-[#743805]" : "border-[#d3dbd3] bg-white text-[#102119]"}`}>
          <p className="text-xs font-bold opacity-70">{metric.label}</p>
          <strong className="mt-2 block text-[30px] font-black leading-none tracking-[-0.04em]">{metric.value}</strong>
          <p className="mt-2 text-xs opacity-75">{metric.note}</p>
        </article>
      ))}
    </section>

    <section className="overflow-hidden rounded-[22px] bg-[#071b13] text-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
        <div><h2 className="text-xl font-black">Đơn theo chặng</h2><p className="mt-1 text-xs text-emerald-100/60">Đơn thuê đang mở trên toàn hệ thống · chiều cao theo căn bậc hai số đơn</p></div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] text-emerald-100/65">↻ Kéo để xoay</span>
      </div>
      <div className="h-[365px]"><RentalThreeCanvas variant="pipeline" /></div>
    </section>

    <section className="overflow-hidden rounded-[22px] border border-[#d3dbd3] bg-white">
      <div className="flex items-center justify-between border-b border-[#e0e6e0] px-5 py-4"><h2 className="font-black text-[#102119]">Đơn thuê gần đây</h2><Link href="/admin/rental-returns" className="text-sm font-black text-[#2c6e3e]">Xem ngoại lệ</Link></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#f4f7f3] text-[11px] uppercase tracking-[0.08em] text-[#637168]"><tr>{["Đơn", "Chuyến", "Khách thuê", "Trạng thái", "Tổng thanh toán"].map((label) => <th key={label} className="px-5 py-3 font-black">{label}</th>)}</tr></thead>
          <tbody>{recentOrders.map((order) => <tr key={order[0]} className="border-t border-[#edf0ed] text-[#13231a]"><td className="px-5 py-4 font-mono font-black text-orange-600">{order[0]}</td><td className="px-5 py-4 font-bold">{order[1]}</td><td className="px-5 py-4">{order[2]}</td><td className="px-5 py-4"><span className="rounded-full bg-[#e4f3e8] px-3 py-1 text-xs font-bold text-[#23633a]">{order[3]}</span></td><td className="px-5 py-4 font-black">{order[4]}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  </main>
);
