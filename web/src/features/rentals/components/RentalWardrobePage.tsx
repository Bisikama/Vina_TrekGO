"use client";

import { FormEvent, useEffect, useState } from "react";
import { createMyGear, deleteMyGear, listMyGear, type GearCategory, type GearCondition, type UserGearItem } from "@/features/rentals/services/gear.api";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import { RentalPageHeader } from "./RentalSectionNav";

const categories: Array<[GearCategory, string]> = [["JACKET", "Áo khoác"], ["FOOTWEAR", "Giày"], ["PANTS", "Quần"], ["BACKPACK", "Balo"], ["SLEEPING_BAG", "Túi ngủ"], ["TENT", "Lều"], ["TREKKING_POLE", "Gậy trekking"], ["RAIN_GEAR", "Đồ đi mưa"]];
const conditions: Array<[GearCondition, string]> = [["NEW", "Mới"], ["GOOD", "Tốt"], ["WORN", "Đã sử dụng"], ["POOR", "Cần thay"]];
const labelOf = (values: ReadonlyArray<readonly [string, string]>, key: string) => values.find(([value]) => value === key)?.[1] || key;

export function RentalWardrobePage() {
  const [items, setItems] = useState<UserGearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listMyGear().then((result) => { if (active) { setItems(result.items ?? []); setError(null); } })
      .catch((reason) => setError(getRentalApiErrorMessage(reason, "Không thể tải tủ đồ.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const item = await createMyGear({
        name: String(form.get("name") || "").trim(), brand: String(form.get("brand") || "").trim() || undefined,
        category: String(form.get("category")) as GearCategory, condition: String(form.get("condition")) as GearCondition,
      });
      setItems((current) => [item, ...current]); setFormOpen(false);
    } catch (reason) { setError(getRentalApiErrorMessage(reason, "Chưa lưu được món đồ.")); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-[650px] bg-[#F7F7F4] px-4 py-10 sm:px-6 lg:px-8"><section className="mx-auto max-w-6xl">
      <RentalPageHeader eyebrow="Chuẩn bị hành trang" title="Tủ đồ của bạn" description="TrekGo dùng danh sách này để nhận biết bạn đã có gì và chỉ gợi ý thuê phần còn thiếu." active="/rentals/wardrobe" />
      <div className="mt-6 flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-gray-900">{items.length} món đồ cá nhân</h2><p className="text-xs text-gray-500">Dùng cho mọi chuyến trekking</p></div><button onClick={() => setFormOpen((value) => !value)} className="rounded-xl bg-[#1B5E41] px-4 py-2.5 text-xs font-extrabold text-white">+ Thêm đồ</button></div>
      {formOpen && <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:grid-cols-2">
        <label className="text-xs font-bold text-gray-700">Tên món đồ<input name="name" required placeholder="Ví dụ: Balo Naturehike 45L" className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-600" /></label>
        <label className="text-xs font-bold text-gray-700">Thương hiệu<input name="brand" placeholder="Không bắt buộc" className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-600" /></label>
        <label className="text-xs font-bold text-gray-700">Loại đồ<select name="category" className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs font-bold text-gray-700">Tình trạng<select name="condition" className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">{conditions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button disabled={saving} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-extrabold text-white sm:col-span-2 disabled:opacity-60">{saving ? "Đang cất vào tủ..." : "Lưu vào tủ đồ"}</button>
      </form>}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      {loading ? <State text="Đang mở tủ đồ..." /> : items.length === 0 ? <State text="Tủ đồ đang trống. Thêm món đầu tiên để gợi ý hành trang chính xác hơn." /> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <article key={item.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">{labelOf(categories, item.category)}</p><h3 className="mt-2 text-lg font-black text-gray-900">{item.name}</h3><p className="mt-2 text-xs text-gray-500">{[item.brand, labelOf(conditions, item.condition)].filter(Boolean).join(" · ")}</p><button onClick={async () => { if (!window.confirm(`Xóa “${item.name}” khỏi tủ đồ?`)) return; await deleteMyGear(item.id); setItems((current) => current.filter((entry) => entry.id !== item.id)); }} className="mt-4 text-xs font-bold text-red-600">Xóa khỏi tủ</button></article>)}</div>}
    </section></main>
  );
}
function State({ text }: { text: string }) { return <div className="mt-6 rounded-2xl bg-white p-10 text-center text-sm font-semibold text-gray-500 shadow-sm">{text}</div>; }
