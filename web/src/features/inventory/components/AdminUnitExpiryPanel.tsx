"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui";
import {
  getEquipmentUnits,
  getStaffInventoryErrorMessage,
  updateEquipmentUnit,
} from "@/features/rentals/services/staff-inventory.api";
import type { EquipmentUnit } from "@/features/rentals/types/rental";

// Hạn dùng thiết bị (Admin): món đã hết hạn hoặc hết hạn trong 30 ngày tới.
// Nhân viên kho chỉ được rút ngắn hạn dùng; kéo dài hoặc xoá hạn (sau khi kiểm tra món vẫn an toàn) là việc của Admin.

const SOON_DAYS = 30;

function vnToday(offsetDays = 0) {
  return new Date(Date.now() + 7 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10).split("-").reverse().join("/");
}

export function AdminUnitExpiryPanel() {
  const [units, setUnits] = useState<EquipmentUnit[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getEquipmentUnits({ expiringBefore: vnToday(SOON_DAYS), pageSize: 100, signal: controller.signal })
      .then((result) => {
        // Món đã Ngừng sử dụng / mất không quay lại cho thuê khi đổi hạn, nên không liệt kê.
        const inService = result.items.filter((unit) => unit.status !== "RETIRED" && unit.status !== "LOST");
        inService.sort((a, b) => (a.expiresAt ?? "").localeCompare(b.expiresAt ?? ""));
        setUnits(inService);
        setTruncated(result.pagination.totalItems > result.items.length);
        setError(null);
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setError(getStaffInventoryErrorMessage(requestError, "Không tải được danh sách hạn dùng."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const save = useCallback(
    async (unit: EquipmentUnit) => {
      const next = drafts[unit.id] ?? unit.expiresAt ?? "";
      setSavingId(unit.id);
      setNotice(null);
      setError(null);
      try {
        await updateEquipmentUnit(unit.id, { expectedVersion: unit.version, expiresAt: next || null });
        setNotice(
          next
            ? `Đã đổi hạn dùng của ${unit.assetCode} thành ${formatDay(next)}.`
            : `Đã bỏ hạn dùng của ${unit.assetCode}.`,
        );
        setDrafts((current) => {
          const rest = { ...current };
          delete rest[unit.id];
          return rest;
        });
        setLoading(true);
        setReloadKey((key) => key + 1);
      } catch (requestError) {
        setError(getStaffInventoryErrorMessage(requestError, "Không lưu được hạn dùng."));
      } finally {
        setSavingId(null);
      }
    },
    [drafts],
  );

  const today = vnToday();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-base font-semibold text-slate-900">Hạn dùng thiết bị</h2>
        <p className="mt-1 text-xs text-slate-500">
          Đã hết hạn hoặc hết hạn trong {SOON_DAYS} ngày. Chỉ kéo dài sau khi đã kiểm tra món còn an toàn.
        </p>
      </div>
      <div className="space-y-2 p-4">
        {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
        {notice ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p> : null}
        {loading && units.length === 0 ? (
          <p className="text-sm text-slate-500">Đang tải…</p>
        ) : units.length === 0 ? (
          <p className="text-sm text-slate-500">Không có thiết bị sắp hết hạn.</p>
        ) : (
          units.map((unit) => {
            const expired = Boolean(unit.isExpired) || (unit.expiresAt ?? "9999") <= today;
            const value = drafts[unit.id] ?? unit.expiresAt ?? "";
            const changed = value !== (unit.expiresAt ?? "");
            return (
              <div key={unit.id} className="rounded-xl border border-slate-100 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-900">{unit.product.name}</p>
                    <p className="text-xs text-slate-500">
                      <span className="font-mono">{unit.assetCode}</span>
                      {unit.intakeBatchCode ? ` · Lô ${unit.intakeBatchCode}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${expired ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {expired ? "Đã hết hạn" : "Sắp hết hạn"} {formatDay(unit.expiresAt)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="date"
                    value={value}
                    onChange={(event) => setDrafts((current) => ({ ...current, [unit.id]: event.target.value }))}
                    className="h-9 flex-1 rounded-lg border border-slate-200 px-2 text-xs"
                    aria-label={`Hạn dùng mới của ${unit.assetCode}`}
                  />
                  <Button size="sm" disabled={!changed || savingId === unit.id} loading={savingId === unit.id} onClick={() => void save(unit)}>
                    Lưu
                  </Button>
                </div>
              </div>
            );
          })
        )}
        {truncated ? (
          <p className="text-[11px] text-slate-500">Chỉ hiện 100 thiết bị có hạn sớm nhất; lọc thêm ở màn kho.</p>
        ) : null}
      </div>
    </section>
  );
}
