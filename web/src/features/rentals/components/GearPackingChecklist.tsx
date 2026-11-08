"use client";

import { useState } from "react";
import { Button, ErrorAlert, InfoBanner, Input, SurfaceCard } from "@/components/ui";
import { getGearAdvisorErrorCode, getGearAdvisorErrorMessage, getGearPlan, saveChecklistProgress, type GearPlan, type PackingChecklistItem } from "../services/gear-advisor.api";
import { downloadPackingChecklist } from "./gear-checklist-template";

const coverageLabels: Record<string, string> = {
  COVERED_BY_OWNED: "Đồ đã chọn đáp ứng",
  PLANNED_RENTAL: "Dự kiến thuê",
  USER_DECLARED_PROVISION: "Tự chuẩn bị",
  NEEDS_REPLACEMENT: "Cần thay thế",
  MISSING: "Cần chuẩn bị thêm",
  UNKNOWN: "Cần thêm thông tin",
  ESSENTIAL: "Đồ thiết yếu",
};

type Progress = { requirementId: string; isChecked: boolean; note?: string };
export function GearPackingChecklist({ plan, checklist, itemNames, tripTitle, tripDate, stale, onPlanChange }: {
  plan: GearPlan; checklist: PackingChecklistItem[]; itemNames: Record<string, string>; tripTitle: string; tripDate: string; stale: boolean; onPlanChange: (plan: GearPlan) => void;
}) {
  const stored = Array.isArray(plan.progressJson) ? plan.progressJson : plan.progressJson?.items ?? [];
  const [draft, setDraft] = useState<Progress[]>(() => checklist.map((item) => {
    const saved = stored.find((entry) => entry.requirementId === item.requirementId);
    return { requirementId: item.requirementId, isChecked: saved?.isChecked ?? false, note: saved?.note ?? "" };
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const packed = draft.filter((entry) => entry.isChecked).length;

  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await saveChecklistProgress(plan.id, plan.progressVersion, draft.map((entry) => ({ ...entry, note: entry.note?.trim() || undefined })));
      onPlanChange({ ...plan, ...updated, isStale: plan.isStale });
      setNotice("Đã lưu tiến độ đóng gói.");
    } catch (e) {
      if (getGearAdvisorErrorCode(e) === "GEAR_PROGRESS_CAS_CONFLICT") {
        try {
          const latest = await getGearPlan(plan.id);
          const fresh = Array.isArray(latest.progressJson) ? latest.progressJson : latest.progressJson?.items ?? [];
          setDraft(checklist.map((item) => { const entry = fresh.find((saved) => saved.requirementId === item.requirementId); return { requirementId: item.requirementId, isChecked: entry?.isChecked ?? false, note: entry?.note ?? "" }; }));
          onPlanChange(latest);
          setError("Tiến độ đã thay đổi ở nơi khác. Đã tải bản mới; vui lòng kiểm tra và đánh dấu lại.");
        }
        catch (reloadError) { setError(getGearAdvisorErrorMessage(reloadError)); }
      } else setError(getGearAdvisorErrorMessage(e));
    } finally { setBusy(false); }
  }

  async function download() {
    setBusy(true); setError("");
    try { await downloadPackingChecklist(tripTitle, tripDate, plan.evaluatedRevision!, checklist, draft, itemNames); }
    catch (e) { setError(getGearAdvisorErrorMessage(e)); }
    finally { setBusy(false); }
  }

  return <SurfaceCard id="packing-checklist" padding="lg" className="scroll-mt-24 space-y-5 rounded-2xl border-[#dbe8dc] shadow-[0_8px_30px_rgba(26,59,39,.04)]">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b9979]">05 / Checklist của chuyến</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-[#203c2d]">Đóng gói trước ngày đi</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Đánh dấu khi đã xếp đồ vào hành lý. Tiến độ này không thay đổi đánh giá hay giữ chỗ thuê.</p></div>
      <div className="min-w-40 rounded-2xl bg-[#eef6ed] px-4 py-3"><div className="flex justify-between gap-4 text-xs font-semibold text-[#53715e]"><span>Tiến độ</span><strong className="text-[#22583b]">{packed}/{checklist.length}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#d4e8d5]"><div className="h-full rounded-full bg-[#3f855a]" style={{ width: `${checklist.length ? packed / checklist.length * 100 : 0}%` }} /></div></div>
    </div>
    {stale && <InfoBanner tone="warning" title="Checklist thuộc lần đánh giá trước">Hãy đánh giá lại sau khi thay đổi chuyến, thời tiết hoặc đồ đã chọn để cập nhật yêu cầu.</InfoBanner>}
    {error && <ErrorAlert message={error} />}{notice && <InfoBanner title="Đã lưu">{notice}</InfoBanner>}
    <div className="overflow-hidden rounded-2xl border border-[#e3ebe3] divide-y divide-[#e9eee9]">{checklist.map((item, index) => {
      const value = draft[index];
      return <div key={item.requirementId} className={`p-4 sm:p-5 ${value.isChecked ? "bg-[#f5faf4]" : "bg-white"}`}>
        <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={value.isChecked} onChange={(event) => setDraft((old) => old.map((entry, i) => i === index ? { ...entry, isChecked: event.target.checked } : entry))} className="mt-1 h-4 w-4 accent-[#2F6B4F]" /><span className="min-w-0 flex-1"><strong className="text-sm text-[#1F2937]">{item.title || item.category}</strong><span className="mt-1 block text-xs text-slate-500">{item.priority === "REQUIRED" ? "Bắt buộc" : item.status === "ESSENTIAL" ? "Nên mang" : "Tùy chọn"} · Số lượng {item.quantity} · {coverageLabels[item.status] ?? item.status}{item.remainingQuantity > 0 ? ` · Còn thiếu ${item.remainingQuantity}` : ""}</span>{item.reason ? <span className="mt-1 block text-xs text-slate-600">{item.reason}</span> : null}{item.assignedItemIds?.length > 0 && <span className="mt-1 block text-xs text-[#2F6B4F]">Đồ được chọn: {item.assignedItemIds.map((id) => itemNames[id] ?? "Món đồ không còn trong Tủ đồ").join(", ")}</span>}</span></label>
        <details className="ml-7 mt-2"><summary className="cursor-pointer text-xs font-semibold text-[#6b8875]">{value.note ? "Xem ghi chú" : "+ Thêm ghi chú"}</summary><Input aria-label={`Ghi chú ${item.title || item.category}`} value={value.note ?? ""} maxLength={500} placeholder="Ghi chú khi chuẩn bị (không bắt buộc)" className="mt-2" onChange={(event) => setDraft((old) => old.map((entry, i) => i === index ? { ...entry, note: event.target.value } : entry))} /></details>
      </div>;
    })}</div>
    <div className="flex flex-wrap gap-3"><Button onClick={() => void save()} disabled={busy || stale || !draft.length}>Lưu tiến độ</Button><Button variant="outline" onClick={() => void download()} disabled={busy || stale || !draft.length}>{busy ? "Đang xử lý..." : "↓ Tải checklist PDF"}</Button></div>
    <p className="text-xs leading-5 text-slate-500">PDF có ô để đánh dấu trên ứng dụng hỗ trợ biểu mẫu hoặc sau khi in. Thay đổi trong PDF không đồng bộ với trang.</p>
  </SurfaceCard>;
}
