import { AdminEarlyReturns } from "@/features/rentals/components/admin/AdminEarlyReturns";

export default function StaffEarlyReturnsPage() {
  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1200px]">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Điều phối thu hồi</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Lịch trả đồ sớm</h1>
        <p className="mb-5 mt-1 text-sm text-slate-500">
          Xác nhận hoặc từ chối giờ khách muốn trả đồ sớm. Việc này chỉ dời lịch thu hồi, không thay đổi phí thuê hay tiền cọc.
        </p>
        <AdminEarlyReturns audience="staff" />
      </div>
    </main>
  );
}
