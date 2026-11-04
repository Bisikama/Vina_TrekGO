"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getAllEquipmentUnits } from "@/features/inventory/services/admin-inventory.api";
import { getStaffInventoryErrorMessage, getStaffRentalProducts } from "@/features/rentals/services/staff-inventory.api";

// Ô cảnh báo tồn kho trên Dashboard admin — cùng cách tính với màn Kho vật tư:
// sản phẩm có dưới 20% thiết bị sẵn sàng (không tính thiết bị thất lạc / đã thanh lý).

const LOW_STOCK_RATIO = 0.2;
const SERVICE_STATUSES = new Set(["CLEANING", "MAINTENANCE", "DAMAGED"]);

type LowStockRow = { id: string; name: string; available: number; total: number };
type AlertData = { low: LowStockRow[]; service: number; productCount: number };

function stripGradeSuffix(name: string) {
  return name
    .replace(/\s*[-–—:]\s*(rất mới|như mới|mới|đã sử dụng tốt|sử dụng tốt|đã qua sử dụng)\s*$/i, "")
    .trim();
}

export function AdminInventoryAlert() {
  const [data, setData] = useState<AlertData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getStaffRentalProducts({ pageSize: 100, signal: controller.signal }),
      getAllEquipmentUnits(controller.signal),
    ])
      .then(([products, units]) => {
        if (controller.signal.aborted) return;
        const stock = new Map<string, LowStockRow>();
        for (const product of products.items) {
          stock.set(product.id, { id: product.id, name: stripGradeSuffix(product.name), available: 0, total: 0 });
        }
        let service = 0;
        for (const unit of units.items) {
          if (unit.status === "RETIRED" || unit.status === "LOST") continue;
          if (SERVICE_STATUSES.has(unit.status)) service += 1;
          const row = stock.get(unit.product.id);
          if (!row) continue;
          row.total += 1;
          if (unit.status === "AVAILABLE") row.available += 1;
        }
        const low = [...stock.values()]
          .filter((row) => row.total > 0 && row.available / row.total < LOW_STOCK_RATIO)
          .sort((a, b) => a.available / a.total - b.available / b.total);
        setData({ low, service, productCount: products.items.length });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(getStaffInventoryErrorMessage(err));
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Cảnh báo tồn kho</h3>
        <Link href="/admin/inventory" className="text-xs font-medium text-[#1B5E41] hover:underline">
          Xem kho
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : !data ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#1B5E41]" />
          Đang tải...
        </div>
      ) : (
        <div className="space-y-3">
          {data.low.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
              Tồn kho ổn định · {data.productCount} sản phẩm đều còn trên {Math.round(LOW_STOCK_RATIO * 100)}% sẵn sàng
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                {data.low.length} sản phẩm còn dưới {Math.round(LOW_STOCK_RATIO * 100)}% thiết bị sẵn sàng
              </p>
              <ul className="space-y-2">
                {data.low.slice(0, 5).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2">
                    <span className="truncate text-sm text-gray-900">{row.name}</span>
                    <span className="shrink-0 text-xs font-medium text-rose-700">
                      {row.available}/{row.total} sẵn sàng
                    </span>
                  </li>
                ))}
              </ul>
              {data.low.length > 5 ? <p className="text-xs text-gray-500">và {data.low.length - 5} sản phẩm khác</p> : null}
            </>
          )}
          <p className="text-xs text-gray-500">
            Đang vệ sinh / bảo trì: <span className="font-medium text-amber-700">{data.service}</span> thiết bị
          </p>
        </div>
      )}
    </div>
  );
}
