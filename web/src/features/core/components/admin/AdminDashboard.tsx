"use client";

import Link from "next/link";
import {
  EmptyState,
  PageHeader,
  PageShell,
  SurfaceCard,
  SurfaceSectionHeader,
} from "@/components/ui";
import { AdminInventoryAlert } from "@/features/inventory/components/AdminInventoryAlert";
import { StatCards } from "./DashboardOverview/StatCards";

export const AdminDashboard = () => {
  return (
    <PageShell maxWidth="full" withTopOffset={false}>
      <PageHeader
        eyebrow="Quản trị"
        title="Tổng quan hệ thống"
        description="Theo dõi chuyến đi và các công việc cần xử lý. Dấu — thể hiện số liệu chưa được cung cấp."
        actions={
          <Link
            href="/admin/cashflow"
            className="text-sm font-semibold text-[#125238] underline-offset-4 hover:underline"
          >
            Xem dòng tiền và giao dịch →
          </Link>
        }
      />

      <StatCards />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <SurfaceCard>
            <SurfaceSectionHeader title="Số chuyến đi theo tháng" />
            <EmptyState
              title="Chưa có số liệu thống kê chuyến đi"
              description="Biểu đồ sẽ hiển thị khi có dữ liệu tổng hợp theo tháng."
            />
          </SurfaceCard>
          <SurfaceCard>
            <SurfaceSectionHeader title="Vị trí các chuyến đi" />
            <EmptyState
              title="Chưa có dữ liệu vị trí"
              description="Bản đồ sẽ hiển thị khi có vị trí thực tế của các chuyến đi."
            />
          </SurfaceCard>
        </div>

        <div className="space-y-6">
          <SurfaceCard>
            <SurfaceSectionHeader title="Công việc cần chú ý" />
            <EmptyState
              title="Chưa có dữ liệu cảnh báo"
              description="Danh sách sẽ hiển thị khi có dữ liệu từ hệ thống."
              action={
                <Link
                  href="/admin/trip-cancellation-requests"
                  className="text-sm font-semibold text-[#125238] underline-offset-4 hover:underline"
                >
                  Xem yêu cầu hủy chuyến →
                </Link>
              }
            />
          </SurfaceCard>
          <AdminInventoryAlert />
        </div>
      </div>
    </PageShell>
  );
};
