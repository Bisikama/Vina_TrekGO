'use client';
import { useState } from 'react';
import type { Participant } from '../booking.api';

export function BookingParticipantsForm({ initial, max, busy, submitLabel, onSubmit }: {
  initial: Participant[]; max: number; busy: boolean; submitLabel: string;
  onSubmit: (participants: Participant[]) => Promise<void>;
}) {
  const [people, setPeople] = useState(initial);
  const update = (index: number, patch: Partial<Participant>) => setPeople((current) => current.map((person, i) => i === index ? { ...person, ...patch } : person));
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void onSubmit(people); }}>
    <fieldset disabled={busy} className="space-y-4">
      <legend className="mb-3 font-semibold">Thành viên tham gia</legend>
      {people.map((person, index) => <div key={index} className="space-y-3 rounded-xl border border-stone-200 p-4">
        <label className="block">Họ tên người {index + 1}<input required maxLength={150} value={person.fullName} onChange={(event) => update(index, { fullName: event.target.value })} className="mt-1 w-full rounded border p-2" /></label>
        <label className="block">Số điện thoại<input type="tel" maxLength={30} value={person.phone ?? ''} onChange={(event) => update(index, { phone: event.target.value })} className="mt-1 w-full rounded border p-2" /></label>
        {people.length > 1 && <button type="button" className="text-sm text-red-800 underline" onClick={() => setPeople((current) => current.filter((_, i) => i !== index))}>Xóa thành viên</button>}
      </div>)}
      {people.length < max && <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setPeople((current) => [...current, { fullName: '' }])}>Thêm thành viên</button>}
      <button type="submit" disabled={people.length > max} className="w-full rounded-xl bg-green-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Đang giữ chỗ…' : submitLabel}</button>
    </fieldset>
  </form>;
}
