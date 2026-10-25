"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  confirmGearExtraction, createGearExtraction, createMyGear, deleteMyGear, listMyGear,
  updateMyGear, uploadUserGearPhoto, type GearCategory, type GearCondition,
  type GearExtractionDraft, type GearItemInput, type UserGearItem,
} from "@/features/rentals/services/gear.api";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import { RentalPageHeader } from "./RentalSectionNav";

const categories: Array<[GearCategory, string, string]> = [
  ["JACKET", "Áo khoác", "🧥"], ["FOOTWEAR", "Giày", "🥾"], ["PANTS", "Quần", "👖"],
  ["BACKPACK", "Balo", "🎒"], ["SLEEPING_BAG", "Túi ngủ", "🛏️"], ["TENT", "Lều", "⛺"],
  ["TREKKING_POLE", "Gậy trekking", "🥢"], ["RAIN_GEAR", "Đồ đi mưa", "🌧️"],
];
const conditions: Array<[GearCondition, string]> = [["new", "Mới"], ["good", "Tốt"], ["worn", "Đã dùng"], ["poor", "Cũ/kém"]];
const attributeConfig: Record<GearCategory, Array<[string, string, string]>> = {
  JACKET: [["waterproof_mm", "Chống nước", "mm"], ["temp_rating_c", "Chịu lạnh", "°C"], ["weight_g", "Trọng lượng", "g"], ["windproof", "Cản gió", "bool"]],
  FOOTWEAR: [["waterproof", "Chống nước", "bool"], ["ankle_support", "Hỗ trợ cổ chân", "bool"], ["grip_level", "Độ bám", "/5"], ["weight_g", "Trọng lượng", "g"]],
  PANTS: [["waterproof_mm", "Chống nước", "mm"], ["temp_rating_c", "Chịu lạnh", "°C"], ["insulated", "Giữ nhiệt", "bool"]],
  BACKPACK: [["capacity_l", "Dung tích", "L"], ["rain_cover", "Áo trùm mưa", "bool"], ["waterproof", "Chống nước", "bool"], ["weight_g", "Trọng lượng", "g"]],
  SLEEPING_BAG: [["temp_rating_c", "Nhiệt độ", "°C"], ["weight_g", "Trọng lượng", "g"]],
  TENT: [["sleeping_places", "Sức chứa", "người"], ["flysheet_waterproof_mm", "Chống nước mái", "mm"], ["floor_waterproof_mm", "Chống nước đáy", "mm"], ["weight_g", "Trọng lượng", "g"]],
  TREKKING_POLE: [["adjustable", "Điều chỉnh", "bool"], ["length_min_cm", "Dài tối thiểu", "cm"], ["length_max_cm", "Dài tối đa", "cm"], ["weight_g", "Trọng lượng", "g"]],
  RAIN_GEAR: [["waterproof_mm", "Chống nước", "mm"], ["coverage", "Phạm vi che", "coverage"], ["weight_g", "Trọng lượng", "g"]],
};

const categoryLabel = (key: GearCategory) => categories.find(([value]) => value === key)?.[1] ?? key;
const categoryIcon = (key: GearCategory) => categories.find(([value]) => value === key)?.[2] ?? "🎒";
const conditionLabel = (key: GearCondition) => conditions.find(([value]) => value === key)?.[1] ?? key;
const sourceLabel = (source: UserGearItem["source"]) => source === "ai_image" ? "AI Camera" : source === "ai_link" ? "AI Link" : "Nhập tay";
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-[#27735a] focus:ring-2 focus:ring-emerald-100";

function issueOf(reason: unknown) {
  const body = (reason as { response?: { data?: unknown } })?.response?.data as Record<string, unknown> | undefined;
  const root = body && typeof body.data === "object" ? body.data as Record<string, unknown> : body;
  const error = root && typeof root.error === "object" ? root.error as Record<string, unknown> : root;
  return { code: String(error?.code ?? ""), details: (error?.details ?? {}) as Record<string, unknown> };
}

export function RentalWardrobePage() {
  const [items, setItems] = useState<UserGearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GearCategory | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ item?: UserGearItem; draft?: GearExtractionDraft; photoRef?: string } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<{ input: GearItemInput; item?: UserGearItem; draft?: GearExtractionDraft; details: Record<string, unknown> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    listMyGear()
      .then((result) => { if (active) { setItems(result.items ?? []); setError(null); } })
      .catch((reason) => { if (active) setError(getRentalApiErrorMessage(reason, "Không thể tải tủ đồ.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchCategory = filter === "ALL" || item.category === filter;
    const needle = query.trim().toLocaleLowerCase("vi");
    return matchCategory && (!needle || `${item.name} ${item.brand ?? ""}`.toLocaleLowerCase("vi").includes(needle));
  }), [filter, items, query]);

  async function save(input: GearItemInput, context = editor, acknowledgeDuplicate = false) {
    setBusy(true); setError(null);
    try {
      let saved: UserGearItem;
      if (context?.draft) {
        saved = (await confirmGearExtraction(context.draft.id, { expectedVersion: context.draft.version, item: input, acknowledgeDuplicate })).item;
      } else if (context?.item) {
        saved = await updateMyGear(context.item.id, { ...input, expectedVersion: context.item.version });
      } else {
        saved = await createMyGear({ ...input, acknowledgeDuplicate });
      }
      setItems((current) => context?.item ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current.filter((item) => item.id !== saved.id)]);
      setEditor(null); setDuplicate(null);
    } catch (reason) {
      const issue = issueOf(reason);
      if (issue.code === "GEAR_ITEM_POSSIBLE_DUPLICATE") {
        setDuplicate({ input, item: context?.item, draft: context?.draft, details: issue.details });
      } else setError(getRentalApiErrorMessage(reason, "Chưa lưu được món đồ."));
    } finally { setBusy(false); }
  }

  async function analyzeImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const uploadId = await uploadUserGearPhoto(file);
      const draft = await createGearExtraction({ source: "IMAGE", uploadId });
      if (draft.status !== "READY") throw new Error("AI chưa tạo được bản nháp sẵn sàng. Bạn vẫn có thể nhập tay.");
      setEditor({ draft, photoRef: uploadId });
    } catch (reason) { setError(getRentalApiErrorMessage(reason, reason instanceof Error ? reason.message : "Không thể đọc ảnh bằng AI.")); }
    finally { setBusy(false); }
  }

  return <main className="min-h-[700px] bg-[#f4f7fb] px-4 py-8 sm:px-6 lg:px-8">
    <section className="mx-auto max-w-7xl">
      <RentalPageHeader eyebrow="Chuẩn bị hành trang" title="Tủ đồ cá nhân" description="Quản lý trang bị thật của bạn, kiểm tra thông số và chuẩn bị chính xác cho từng chuyến đi." active="/rentals/wardrobe" />

      <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,.05)] lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-xl bg-[#dff4e8] text-2xl">▣</div>
          <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-4"><p className="font-black text-slate-900">Tủ đồ kỹ thuật</p><p className="text-sm font-black text-slate-900">{items.length} / 50</p></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#165c45]" style={{ width: `${Math.min(items.length * 2, 100)}%` }} /></div>
            <p className="mt-2 text-xs text-slate-500">Còn {Math.max(50 - items.length, 0)} vị trí · lịch sử đánh giá theo chuyến vẫn được bảo toàn khi xóa món.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={analyzeImage} />
          <button disabled={busy} onClick={() => fileRef.current?.click()} className="rounded-xl border border-[#165c45] bg-white px-4 py-3 text-sm font-bold text-[#165c45] disabled:opacity-50">✦ Nạp ảnh bằng AI</button>
          <button disabled={busy} onClick={() => setLinkOpen(true)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-50">🔗 Dán link sản phẩm</button>
          <button onClick={() => setEditor({})} className="rounded-xl bg-[#123f32] px-4 py-3 text-sm font-extrabold text-white shadow-sm">＋ Nhập tay</button>
        </div>
      </div>

      {busy && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">⛰️ TrekGo đang đọc thông số và sắp xếp hành trang...</div>}
      {error && <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><span>{error}</span><button onClick={() => setError(null)}>✕</button></div>}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Filter active={filter === "ALL"} onClick={() => setFilter("ALL")}>Tất cả <b>{items.length}</b></Filter>
            {categories.map(([value, label]) => <Filter key={value} active={filter === value} onClick={() => setFilter(value)}>{label} <b>{items.filter((item) => item.category === value).length}</b></Filter>)}
          </div>
          <label className="flex min-w-64 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-slate-900 outline-none" placeholder="Tìm tên hoặc thương hiệu..." /></label>
        </div>
      </div>

      {loading ? <State title="Đang mở tủ đồ..." description="TrekGo đang kiểm tra trang bị của bạn." /> : visibleItems.length === 0 ? <State title={items.length ? "Không có món phù hợp bộ lọc" : "Tủ đồ đang trống"} description={items.length ? "Thử chọn danh mục khác hoặc xóa từ khóa tìm kiếm." : "Thêm món đầu tiên bằng ảnh AI, link sản phẩm hoặc nhập tay."} /> :
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleItems.map((item) => <GearCard key={item.id} item={item} onEdit={() => setEditor({ item })} onDelete={async () => {
          if (!window.confirm(`Xóa hẳn “${item.name}”? Món đồ không thể khôi phục, nhưng lịch sử kiểm tra theo chuyến vẫn được giữ.`)) return;
          try { await deleteMyGear(item.id); setItems((current) => current.filter((entry) => entry.id !== item.id)); }
          catch (reason) { setError(getRentalApiErrorMessage(reason, "Chưa xóa được món đồ.")); }
        }} />)}</div>}
    </section>

    {editor && <GearEditor context={editor} busy={busy} onClose={() => setEditor(null)} onSave={(input) => void save(input)} />}
    {linkOpen && <LinkDialog busy={busy} onClose={() => setLinkOpen(false)} onSubmit={async (url) => {
      setBusy(true); setError(null);
      try { const draft = await createGearExtraction({ source: "LINK", url }); setLinkOpen(false); setEditor({ draft }); }
      catch (reason) { setError(getRentalApiErrorMessage(reason, "Không thể đọc link sản phẩm.")); }
      finally { setBusy(false); }
    }} />}
    {duplicate && <DuplicateDialog data={duplicate.details} busy={busy} onBack={() => { setDuplicate(null); setEditor({ item: duplicate.item, draft: duplicate.draft }); }} onConfirm={() => void save(duplicate.input, { item: duplicate.item, draft: duplicate.draft }, true)} />}
  </main>;
}

function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${active ? "bg-[#123f32] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{children}</button>;
}

function GearCard({ item, onEdit, onDelete }: { item: UserGearItem; onEdit: () => void; onDelete: () => void }) {
  const stats = attributeConfig[item.category].filter(([key]) => item.attributes?.[key] !== null && item.attributes?.[key] !== undefined).slice(0, 3);
  return <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,.05)] transition hover:-translate-y-1 hover:shadow-lg">
    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#dcebe5] to-[#eef4fb]" style={item.photoUrl ? { backgroundImage: `url(${item.photoUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>
      {!item.photoUrl && <div className="grid h-full place-items-center text-6xl opacity-80">{categoryIcon(item.category)}</div>}
      <span className="absolute left-3 top-3 rounded-lg bg-slate-950/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">Ảnh chính</span>
      <span className="absolute right-3 top-3 rounded-lg bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#165c45]">✦ {sourceLabel(item.source)}</span>
    </div>
    <div className="p-4"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-wider text-[#27735a]">{categoryLabel(item.category)}</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">● {conditionLabel(item.condition)}</span></div>
      <h3 className="mt-2 line-clamp-2 min-h-12 text-lg font-black leading-6 text-slate-950">{item.name}</h3>
      <p className="mt-1 text-xs text-slate-500">{item.brand || "Chưa khai thương hiệu"}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3">{stats.length ? stats.map(([key, label, unit]) => <div key={key} className="min-w-0"><p className="truncate text-[9px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-black text-slate-800">{formatAttribute(item.attributes[key], unit)}</p></div>) : <p className="col-span-3 text-xs text-amber-700">⚠ Chưa có thông số kỹ thuật</p>}</div>
      <div className="mt-4 flex items-center justify-between"><button onClick={onDelete} className="rounded-lg px-2 py-2 text-xs font-bold text-red-600 hover:bg-red-50">♲ Gỡ bỏ</button><button onClick={onEdit} className="rounded-xl bg-[#e8f0ff] px-4 py-2.5 text-xs font-black text-slate-900">Xem & Sửa ›</button></div>
    </div>
  </article>;
}

function GearEditor({ context, busy, onClose, onSave }: { context: { item?: UserGearItem; draft?: GearExtractionDraft; photoRef?: string }; busy: boolean; onClose: () => void; onSave: (input: GearItemInput) => void }) {
  const seed = context.item ?? context.draft?.extractedData;
  const [category, setCategory] = useState<GearCategory>((seed?.category as GearCategory) ?? "BACKPACK");
  const [attributes, setAttributes] = useState<Record<string, unknown>>(seed?.attributes ?? {});
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const parsed: Record<string, unknown> = {};
    attributeConfig[category].forEach(([key, , unit]) => { const raw = String(form.get(`attr_${key}`) ?? ""); if (!raw) parsed[key] = null; else if (unit === "bool") parsed[key] = raw === "true"; else if (unit === "coverage") parsed[key] = raw; else parsed[key] = Number(raw); });
    onSave({ name: String(form.get("name") ?? "").trim(), brand: String(form.get("brand") ?? "").trim() || null, category, condition: String(form.get("condition")) as GearCondition, attributes: parsed, photoRef: context.photoRef ?? context.item?.photoRef ?? null });
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"><form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#27735a]">{context.draft ? "AI · Bản nháp cần xác nhận" : context.item ? "Tủ đồ cá nhân" : "Nhập tay số liệu"}</p><h2 className="mt-1 text-xl font-black text-slate-950">{context.item ? "Xem & sửa trang bị" : "Thêm trang bị vào tủ"}</h2></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-slate-100">✕</button></div>
    <div className="grid gap-4 p-6 sm:grid-cols-2">
      {context.draft && <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">✦ AI đã tạo bản nháp. Hãy kiểm tra các field chưa rõ trước khi xác nhận lưu.</div>}
      <Field label="Tên món đồ"><input name="name" required defaultValue={seed?.name ?? ""} className={inputClass} placeholder="Ví dụ: Balo Naturehike 45L" /></Field>
      <Field label="Thương hiệu"><input name="brand" defaultValue={seed?.brand ?? ""} className={inputClass} placeholder="Không bắt buộc" /></Field>
      <Field label="Loại đồ"><select name="category" value={category} onChange={(event) => { setCategory(event.target.value as GearCategory); setAttributes({}); }} className={inputClass}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Tình trạng"><select name="condition" defaultValue={(seed?.condition as GearCondition) ?? "good"} className={inputClass}>{conditions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <div className="sm:col-span-2 mt-2"><p className="text-sm font-black text-slate-900">Thông số kỹ thuật</p><p className="mt-1 text-xs text-slate-500">Để trống nếu chưa biết, TrekGo không tự biến thành 0.</p></div>
      {attributeConfig[category].map(([key, label, unit]) => <Field key={key} label={`${label}${!["bool", "coverage"].includes(unit) ? ` (${unit})` : ""}`}>{unit === "bool" ? <select name={`attr_${key}`} defaultValue={attributes[key] === true ? "true" : attributes[key] === false ? "false" : ""} className={inputClass}><option value="">Chưa biết</option><option value="true">Có</option><option value="false">Không</option></select> : unit === "coverage" ? <select name={`attr_${key}`} defaultValue={String(attributes[key] ?? "")} className={inputClass}><option value="">Chưa biết</option><option value="UPPER_BODY">Thân trên</option><option value="FULL_BODY">Toàn thân</option></select> : <input name={`attr_${key}`} type="number" defaultValue={typeof attributes[key] === "number" ? String(attributes[key]) : ""} className={inputClass} placeholder="Chưa biết" />}</Field>)}
    </div>
    <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">Hủy</button><button disabled={busy} className="rounded-xl bg-[#123f32] px-6 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Đang lưu..." : context.draft ? "Xác nhận lưu vào tủ" : "Lưu vào tủ đồ"}</button></div>
  </form></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-xs font-bold text-slate-700">{label}<div className="mt-2">{children}</div></label>; }
function LinkDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (url: string) => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"><form onSubmit={(event) => { event.preventDefault(); onSubmit(String(new FormData(event.currentTarget).get("url") ?? "")); }} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><p className="text-[10px] font-black uppercase tracking-wider text-[#27735a]">AI Link</p><h2 className="mt-1 text-xl font-black">Nạp thông số từ sản phẩm</h2><p className="mt-2 text-sm text-slate-500">Dán một đường dẫn sản phẩm trekking. Bạn luôn được xem và sửa bản nháp trước khi lưu.</p><input name="url" type="url" required autoFocus className={`${inputClass} mt-5`} placeholder="https://..." /><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Hủy</button><button disabled={busy} className="rounded-xl bg-[#123f32] px-5 py-2.5 text-sm font-black text-white">{busy ? "Đang đọc..." : "Tạo bản nháp"}</button></div></form></div>; }
function DuplicateDialog({ data, busy, onBack, onConfirm }: { data: Record<string, unknown>; busy: boolean; onBack: () => void; onConfirm: () => void }) { const similar = data.similarItem as { name?: string } | undefined; const matched = Array.isArray(data.matchedFields) ? data.matchedFields.join(", ") : "các thông số kỹ thuật"; return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4"><div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="bg-orange-50 px-6 py-5"><p className="text-[10px] font-black uppercase tracking-wider text-orange-600">409 · Possible duplicate</p><h3 className="mt-1 text-lg font-black">Tủ đã có một món có thông số tương tự</h3></div><div className="p-6 text-sm text-slate-600"><p>Món tương tự: <b className="text-slate-950">{similar?.name ?? "Trang bị đã lưu"}</b></p><p className="mt-2">Thông số trùng: <b>{matched}</b></p><p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs">Đây chỉ là so sánh thông số, không khẳng định cùng một vật thật.</p></div><div className="flex justify-end gap-3 border-t p-4"><button onClick={onBack} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Quay lại chỉnh sửa</button><button disabled={busy} onClick={onConfirm} className="rounded-xl bg-[#123f32] px-4 py-2.5 text-sm font-black text-white">Vẫn lưu thêm</button></div></div></div>; }
function State({ title, description }: { title: string; description: string }) { return <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><div className="text-4xl">🎒</div><p className="mt-4 font-black text-slate-900">{title}</p><p className="mt-2 text-sm text-slate-500">{description}</p></div>; }
function formatAttribute(value: unknown, unit: string) { if (value === true) return "Có"; if (value === false) return "Không"; if (value === null || value === undefined || value === "") return "Chưa biết"; if (unit === "coverage") return value === "FULL_BODY" ? "Toàn thân" : "Thân trên"; return `${String(value)}${unit}`; }
