"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createGearCatalogDraft,
  listGearCatalogDrafts,
  revokeGearCatalog,
  searchGearCatalog,
  updateGearCatalogDraft,
  verifyGearCatalog,
  type GearCatalogEntry,
  type GearCategory,
} from "@/features/rentals/services/gear.api";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";

// Danh mục sản phẩm cá nhân (Gear phase 2).
// Staff kho / Admin tạo + sửa bản nháp; chỉ Admin công bố (verify) và thu hồi (revoke).
// Mỗi thông số có giá trị BẮT BUỘC kèm nguồn minh chứng (evidence) cùng key.

const CATEGORIES: [GearCategory, string][] = [
  ["JACKET", "Áo khoác"], ["FOOTWEAR", "Giày"], ["PANTS", "Quần"], ["BACKPACK", "Balo"],
  ["SLEEPING_BAG", "Túi ngủ"], ["TENT", "Lều"], ["TREKKING_POLE", "Gậy trekking"], ["RAIN_GEAR", "Đồ đi mưa"],
];
const ATTRIBUTES: Record<GearCategory, [string, string, string][]> = {
  JACKET: [["waterproof_mm", "Chống nước", "mm"], ["temp_rating_c", "Chịu lạnh", "°C"], ["weight_g", "Trọng lượng", "g"], ["windproof", "Cản gió", "bool"]],
  FOOTWEAR: [["waterproof", "Chống nước", "bool"], ["ankle_support", "Hỗ trợ cổ chân", "bool"], ["grip_level", "Độ bám", "/5"], ["weight_g", "Trọng lượng", "g"]],
  PANTS: [["waterproof_mm", "Chống nước", "mm"], ["temp_rating_c", "Chịu lạnh", "°C"], ["insulated", "Giữ nhiệt", "bool"]],
  BACKPACK: [["capacity_l", "Dung tích", "L"], ["rain_cover", "Áo trùm mưa", "bool"], ["waterproof", "Chống nước", "bool"], ["weight_g", "Trọng lượng", "g"]],
  SLEEPING_BAG: [["temp_rating_c", "Nhiệt độ", "°C"], ["weight_g", "Trọng lượng", "g"]],
  TENT: [["sleeping_places", "Sức chứa", "người"], ["flysheet_waterproof_mm", "Chống nước mái", "mm"], ["floor_waterproof_mm", "Chống nước đáy", "mm"], ["weight_g", "Trọng lượng", "g"]],
  TREKKING_POLE: [["adjustable", "Điều chỉnh", "bool"], ["length_min_cm", "Dài tối thiểu", "cm"], ["length_max_cm", "Dài tối đa", "cm"], ["weight_g", "Trọng lượng", "g"]],
  RAIN_GEAR: [["waterproof_mm", "Chống nước", "mm"], ["coverage", "Phạm vi che", "coverage"], ["weight_g", "Trọng lượng", "g"]],
};
const categoryLabel = (value: GearCategory) => CATEGORIES.find(([key]) => key === value)?.[1] ?? value;
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#27735a] focus:ring-2 focus:ring-emerald-100";

function formatValue(value: unknown, unit: string) {
  if (value === true) return "Có";
  if (value === false) return "Không";
  if (value === null || value === undefined || value === "") return "—";
  if (unit === "coverage") return value === "FULL_BODY" ? "Toàn thân" : "Thân trên";
  return `${String(value)} ${unit}`;
}

type FormState = {
  id?: string;
  version?: number;
  name: string;
  brand: string;
  category: GearCategory;
  values: Record<string, string>;
  evidence: Record<string, string>;
};

const emptyForm = (): FormState => ({ name: "", brand: "", category: "JACKET", values: {}, evidence: {} });

function formFromEntry(entry: GearCatalogEntry): FormState {
  return {
    id: entry.id,
    version: entry.version,
    name: entry.name,
    brand: entry.brand ?? "",
    category: entry.category,
    values: Object.fromEntries(
      Object.entries(entry.attributes ?? {})
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    ),
    evidence: { ...(entry.evidence ?? {}) },
  };
}

export function GearCatalogManager({ mode }: { mode: "staff" | "admin" }) {
  const isAdmin = mode === "admin";
  const [tab, setTab] = useState<"drafts" | "verified">("drafts");
  const [drafts, setDrafts] = useState<GearCatalogEntry[]>([]);
  const [verified, setVerified] = useState<GearCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [draftList, verifiedList] = await Promise.all([
        listGearCatalogDrafts(),
        // Không có API riêng cho admin: dùng tìm kiếm công khai (chỉ trả hồ sơ VERIFIED, kèm version để thu hồi).
        isAdmin ? searchGearCatalog({ limit: 50 }).then((result) => result.items) : Promise.resolve([]),
      ]);
      setDrafts(draftList);
      setVerified(verifiedList);
    } catch (reason) {
      setError(getRentalApiErrorMessage(reason, "Không tải được danh mục sản phẩm."));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      setError("Nhập tên sản phẩm.");
      return;
    }
    const attributes: Record<string, unknown> = {};
    const evidence: Record<string, string> = {};
    for (const [key, label, unit] of ATTRIBUTES[form.category]) {
      const raw = (form.values[key] ?? "").trim();
      if (!raw) continue;
      if (unit === "bool") attributes[key] = raw === "true";
      else if (unit === "coverage") attributes[key] = raw;
      else {
        const number = Number(raw.replace(",", "."));
        if (!Number.isFinite(number)) {
          setError(`${label}: “${raw}” không phải số hợp lệ.`);
          return;
        }
        attributes[key] = number;
      }
      const source = (form.evidence[key] ?? "").trim();
      if (!source) {
        setError(`${label}: cần ghi nguồn minh chứng (vd. "Thông số nhà sản xuất, trang 4").`);
        return;
      }
      evidence[key] = source;
    }
    if (!Object.keys(attributes).length) {
      setError("Cần ít nhất một thông số có giá trị và nguồn minh chứng.");
      return;
    }
    const input = { name: form.name.trim(), brand: form.brand.trim() || null, category: form.category, attributes, evidence };
    setBusy(true);
    setError(null);
    try {
      if (form.id && form.version) await updateGearCatalogDraft(form.id, { ...input, expectedVersion: form.version });
      else await createGearCatalogDraft(input);
      setNotice(form.id ? "Đã cập nhật bản nháp." : isAdmin ? "Đã tạo bản nháp. Bấm “Duyệt & công bố” khi đã kiểm tra." : "Đã tạo bản nháp, chờ Admin duyệt.");
      setForm(null);
      await load();
    } catch (reason) {
      setError(getRentalApiErrorMessage(reason, "Chưa lưu được bản nháp."));
    } finally {
      setBusy(false);
    }
  }

  async function act(entry: GearCatalogEntry, action: "verify" | "revoke") {
    const question =
      action === "verify"
        ? `Công bố “${entry.name}”? Sau khi duyệt, hồ sơ không sửa trực tiếp được; khách sẽ tìm thấy và thêm vào tủ đồ.`
        : `Thu hồi “${entry.name}”? Hồ sơ sẽ không còn xuất hiện khi khách tìm. Bản sao khách đã thêm vào tủ không tự đổi.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "verify") await verifyGearCatalog(entry.id, entry.version);
      else await revokeGearCatalog(entry.id, entry.version);
      setNotice(action === "verify" ? `Đã công bố “${entry.name}”.` : `Đã thu hồi “${entry.name}”.`);
      await load();
    } catch (reason) {
      setError(getRentalApiErrorMessage(reason, "Thao tác chưa thành công. Tải lại để lấy phiên bản mới nhất."));
    } finally {
      setBusy(false);
    }
  }

  const list = tab === "drafts" ? drafts : verified;

  return (
    <main className="min-h-[600px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#27735a]">Gear · Danh mục sản phẩm cá nhân</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">Hồ sơ sản phẩm đã kiểm duyệt</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {isAdmin
                ? "Tạo/sửa bản nháp, duyệt để công bố cho khách, hoặc thu hồi hồ sơ sai. Hồ sơ đã duyệt không sửa trực tiếp."
                : "Tạo hồ sơ sản phẩm với thông số và nguồn minh chứng. Admin sẽ duyệt trước khi khách nhìn thấy."}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} disabled={loading || busy} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">↻ Làm mới</button>
            <button onClick={() => { setForm(emptyForm()); setError(null); }} className="rounded-xl bg-[#123f32] px-4 py-2.5 text-sm font-black text-white">＋ Tạo bản nháp</button>
          </div>
        </div>

        {notice && <div className="mt-5 flex justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900"><span>{notice}</span><button onClick={() => setNotice(null)}>✕</button></div>}
        {error && !form && <div className="mt-5 flex justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"><span>{error}</span><button onClick={() => setError(null)}>✕</button></div>}

        {isAdmin && (
          <div className="mt-6 flex gap-2">
            {(["drafts", "verified"] as const).map((key) => (
              <button key={key} onClick={() => setTab(key)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === key ? "bg-[#123f32] text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
                {key === "drafts" ? `Chờ duyệt (${drafts.length})` : `Đã công bố (${verified.length})`}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Đang tải...</p>
        ) : list.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            {tab === "drafts" ? "Chưa có bản nháp nào chờ duyệt." : "Chưa có hồ sơ nào được công bố."}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {list.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#27735a]">{categoryLabel(entry.category)}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">{entry.name}</h3>
                    <p className="text-xs text-slate-500">{entry.brand || "Chưa ghi thương hiệu"} · phiên bản {entry.version}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${tab === "drafts" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                    {tab === "drafts" ? "Bản nháp" : "Đã công bố"}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {ATTRIBUTES[entry.category]
                    .filter(([key]) => entry.attributes?.[key] !== null && entry.attributes?.[key] !== undefined)
                    .map(([key, label, unit]) => (
                      <li key={key}>
                        <b>{label}:</b> {formatValue(entry.attributes[key], unit)}
                        {entry.evidence?.[key] && <span className="block text-xs text-slate-500">Nguồn: {entry.evidence[key]}</span>}
                      </li>
                    ))}
                </ul>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {tab === "drafts" && (
                    <button disabled={busy} onClick={() => { setForm(formFromEntry(entry)); setError(null); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50">Sửa</button>
                  )}
                  {isAdmin && tab === "drafts" && (
                    <button disabled={busy} onClick={() => void act(entry, "verify")} className="rounded-xl bg-[#123f32] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Duyệt & công bố</button>
                  )}
                  {isAdmin && tab === "verified" && (
                    <button disabled={busy} onClick={() => void act(entry, "revoke")} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50">Thu hồi</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b p-5">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#27735a]">{form.id ? "Sửa bản nháp" : "Bản nháp mới"}</p>
              <h2 className="mt-1 text-xl font-black">Hồ sơ sản phẩm</h2>
              <p className="mt-1 text-xs text-slate-500">Mỗi thông số có giá trị phải kèm nguồn minh chứng (tài liệu nhà sản xuất, trang web chính hãng...). Để trống thông số nếu không có nguồn.</p>
            </div>
            <div className="space-y-4 overflow-y-auto p-5">
              {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700">Tên sản phẩm<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-bold text-slate-700">Thương hiệu<input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} className={`${inputClass} mt-1.5`} /></label>
              </div>
              <label className="block text-xs font-bold text-slate-700">Loại đồ
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as GearCategory, values: {}, evidence: {} })} className={`${inputClass} mt-1.5`}>
                  {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {ATTRIBUTES[form.category].map(([key, label, unit]) => (
                <div key={key} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[180px_1fr]">
                  <label className="text-xs font-bold text-slate-700">
                    {label}{unit !== "bool" && unit !== "coverage" ? ` (${unit})` : ""}
                    {unit === "bool" ? (
                      <select value={form.values[key] ?? ""} onChange={(event) => setForm({ ...form, values: { ...form.values, [key]: event.target.value } })} className={`${inputClass} mt-1.5`}>
                        <option value="">Không ghi</option><option value="true">Có</option><option value="false">Không</option>
                      </select>
                    ) : unit === "coverage" ? (
                      <select value={form.values[key] ?? ""} onChange={(event) => setForm({ ...form, values: { ...form.values, [key]: event.target.value } })} className={`${inputClass} mt-1.5`}>
                        <option value="">Không ghi</option><option value="UPPER_BODY">Thân trên</option><option value="FULL_BODY">Toàn thân</option>
                      </select>
                    ) : (
                      <input inputMode="decimal" value={form.values[key] ?? ""} onChange={(event) => setForm({ ...form, values: { ...form.values, [key]: event.target.value } })} className={`${inputClass} mt-1.5`} placeholder="Không ghi" />
                    )}
                  </label>
                  <label className="text-xs font-bold text-slate-700">Nguồn minh chứng
                    <input
                      value={form.evidence[key] ?? ""}
                      disabled={!(form.values[key] ?? "").trim()}
                      onChange={(event) => setForm({ ...form, evidence: { ...form.evidence, [key]: event.target.value } })}
                      className={`${inputClass} mt-1.5 disabled:bg-slate-50`}
                      placeholder={(form.values[key] ?? "").trim() ? "vd. Trang thông số chính hãng, mục Specs" : "Nhập giá trị trước"}
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t p-4">
              <button onClick={() => { setForm(null); setError(null); }} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Huỷ</button>
              <button disabled={busy} onClick={() => void save()} className="rounded-xl bg-[#123f32] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{busy ? "Đang lưu..." : "Lưu bản nháp"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
