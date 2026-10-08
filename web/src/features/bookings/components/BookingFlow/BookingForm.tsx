'use client';

import { useState } from 'react';
import type { Participant } from '../../booking.api';

export function BookingForm({ initial, max, busy, submitLabel, onSubmit, onDirtyChange }: {
  initial: Participant[]; max: number; busy: boolean; submitLabel: string; onSubmit: (people: Participant[]) => Promise<void>; onDirtyChange?: (dirty: boolean) => void;
}) {
  const [people, setPeople] = useState<Participant[]>(initial);
  const updatePeople = (rows: Participant[]) => { setPeople(rows); onDirtyChange?.(JSON.stringify(rows) !== JSON.stringify(initial)); };
  const change = (index: number, field: keyof Participant, value: string) => updatePeople(people.map((p, i) => i === index ? { ...p, [field]: value } : p));
  return <form onSubmit={(event) => { event.preventDefault(); void onSubmit(people); }} className="space-y-5">
    <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
      <legend className="mb-4 text-xl font-semibold">Thông tin thành viên</legend>
      {people.map((person, index) => <div key={person.id ?? index} className="rounded-xl border border-stone-200 p-4 space-y-3">
        <div className="flex justify-between"><h3 className="font-semibold">Thành viên {index + 1}</h3>
          {people.length > 1 && <button type="button" className="text-sm text-red-700 underline" onClick={() => updatePeople(people.filter((_, i) => i !== index))}>Xóa thành viên {index + 1}</button>}</div>
        <label className="block text-sm">Họ và tên <span aria-hidden>*</span><input aria-label={`Họ và tên thành viên ${index + 1}`} required maxLength={150} value={person.fullName} onChange={(e) => change(index, 'fullName', e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Điện thoại<input type="tel" minLength={5} maxLength={30} value={person.phone ?? ''} onChange={(e) => change(index, 'phone', e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Ngày sinh<input type="date" max={new Date().toISOString().slice(0, 10)} value={person.dateOfBirth ?? ''} onChange={(e) => change(index, 'dateOfBirth', e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Người liên hệ khẩn cấp<input maxLength={150} value={person.emergencyContactName ?? ''} onChange={(e) => change(index, 'emergencyContactName', e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Số điện thoại khẩn cấp<input type="tel" minLength={5} maxLength={30} value={person.emergencyContactPhone ?? ''} onChange={(e) => change(index, 'emergencyContactPhone', e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
        </div>
      </div>)}
      <div className="flex flex-wrap items-center gap-4"><button type="button" disabled={people.length >= Math.min(max, 100)} className="rounded-lg border px-4 py-2 disabled:opacity-40" onClick={() => updatePeople([...people, { fullName: '' }])}>+ Thêm thành viên</button><span>{people.length} người</span></div>
      <button disabled={busy || max < people.length} className="w-full rounded-lg bg-[#1B4332] p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Đang xử lý…' : submitLabel}</button>
    </fieldset>
  </form>;
}
