import { SurfaceCard } from "@/components/ui";

const statisticLabels = [
  "Tổng người dùng",
  "Chuyến đi đang diễn ra",
  "Cung đường chờ duyệt",
  "SOS đang xử lý",
];

export const StatCards = () => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statisticLabels.map((label) => (
        <SurfaceCard key={label}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            {label}
          </h2>
          <p className="mt-3 text-2xl font-bold tabular-nums" aria-label="Chưa có số liệu">
            —
          </p>
          <p className="mt-2 text-xs text-[#6B7280]">Chưa có dữ liệu thống kê</p>
        </SurfaceCard>
      ))}
    </div>
  );
};
