'use client';

import { useState } from 'react';
import { LoginForm } from '@/features/auth';
import { usePublicTrips } from '../hooks/usePublicTrips';
import type { Trip, TripInput, Option } from '../types/trip.types';

const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed';
const field = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 mt-1';
const localDate = (v?: string) => { if (!v) return ''; const date = new Date(v); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const BasicForm = ({ trip, destinations, pickups, busy, onDestination, onSave }: { trip: Trip | null; destinations: Option[]; pickups: Option[]; busy: boolean; onDestination: (id: string) => void; onSave: (data: TripInput) => void }) => {
  const [destination, setDestination] = useState(trip?.destinationId || '');
  return <form onSubmit={e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    onSave({ title: String(form.get('title')), description: String(form.get('description')), destinationId: destination,
      pickupPointId: String(form.get('pickup')), startAt: new Date(String(form.get('start'))).toISOString(), endAt: new Date(String(form.get('end'))).toISOString(),
      capacity: Number(form.get('capacity')), price: String(form.get('price')) });
  }}><fieldset disabled={busy || (!!trip && trip.status !== 'DRAFT')} className="grid gap-4 sm:grid-cols-2">
    <legend className="mb-4 text-lg font-semibold">1. Thông tin chuyến đi</legend>
    <label>Tên chuyến<input className={field} name="title" required maxLength={220} defaultValue={trip?.title} /></label>
    <label>Điểm đến<select className={field} value={destination} required disabled={!!trip && !!(trip.checkpoints.length || trip.trails.length)} onChange={e => { setDestination(e.target.value); onDestination(e.target.value); }}><option value="">Chọn điểm đến</option>{destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label>Bắt đầu (giờ địa phương)<input className={field} name="start" type="datetime-local" required defaultValue={localDate(trip?.startAt)} /></label>
    <label>Kết thúc (giờ địa phương)<input className={field} name="end" type="datetime-local" required defaultValue={localDate(trip?.endAt)} /></label>
    <label>Điểm tập kết<select key={destination} className={field} name="pickup" required defaultValue={trip?.pickupPointId || ''}><option value="">Chọn điểm tập kết</option>{pickups.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Số người tối đa<input className={field} name="capacity" type="number" min={1} max={2147483647} required defaultValue={trip?.capacity || 1} /></label>
    <label>Giá/người (VND)<input className={field} name="price" inputMode="decimal" pattern="[0-9]{1,10}(\.[0-9]{1,2})?" required defaultValue={trip?.price || ''} /></label>
    <label>Mô tả<textarea className={field} name="description" maxLength={5000} defaultValue={trip?.description || ''} /></label>
    <button className={`${button} sm:col-span-2`} type="submit">{trip ? 'Lưu thay đổi' : 'Tạo bản nháp'}</button>
  </fieldset></form>;
};
const OrderedSelection = ({ title, items, disabled, onChange }: { title: string; items: Option[]; disabled: boolean; onChange: (ids: string[]) => void }) => {
  const ids = items.map(i => i.id);
  const move = (i: number, delta: number) => { const next = [...ids]; [next[i], next[i + delta]] = [next[i + delta], next[i]]; onChange(next); };
  return <><h2 className="font-semibold text-lg mb-3">{title}</h2><ol className="space-y-2">{items.map((item, i) => <li key={item.id} className="flex flex-wrap gap-2 items-center"><span className="mr-auto">{i + 1}. {item.name}</span><button aria-label={`Đưa ${item.name} lên`} className={button} disabled={disabled || !i} onClick={() => move(i, -1)}>↑</button><button aria-label={`Đưa ${item.name} xuống`} className={button} disabled={disabled || i === ids.length - 1} onClick={() => move(i, 1)}>↓</button><button className={button} disabled={disabled} onClick={() => onChange(ids.filter((_, j) => j !== i))}>Bỏ chọn</button></li>)}</ol>{!items.length && <p className="text-slate-500">Chưa có lựa chọn.</p>}<button className={`${button} my-3`} disabled={disabled || !items.length} onClick={() => onChange(ids)}>Cập nhật snapshot từ dữ liệu hệ thống</button></>;
};
export const PublicTrips = () => {
  const vm = usePublicTrips();
  const [reason, setReason] = useState('');
  const trip = vm.trip;
  const checkpointIds = trip?.checkpoints.flatMap(c => c.sourceCheckpointId ? [c.sourceCheckpointId] : []) || [];
  const trailIds = trip?.trails.map(t => t.systemTrailId) || [];
  const editable = trip?.status === 'DRAFT' && !vm.busy;
  return <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8"><div className="max-w-6xl mx-auto space-y-6">
    <header><p className="text-teal-700 text-sm font-semibold">TREKGO · LEADER</p><h1 className="text-3xl font-bold mt-1">Lên kế hoạch chuyến đi công khai</h1><p className="mt-2 text-slate-600">Lưu bản nháp, chọn các điểm cần đến và kiểm tra lộ trình trước khi mở đăng ký.</p></header>
    {vm.error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{vm.error} Nếu dữ liệu đã thay đổi, hãy tải lại từ server.</p>}
    {!vm.token ? <LoginForm /> : vm.user?.role !== 'LEADER' ? <div><p>Chức năng này dành cho tài khoản Leader.</p><LoginForm /></div> : <>
      <div className="flex flex-wrap gap-2 items-center"><span>{vm.user.fullName || vm.user.name || vm.user.email}</span><button className={button} disabled={vm.busy} onClick={vm.newDraft}>Tạo chuyến mới</button><button className={button} disabled={vm.busy} onClick={vm.refresh}>Tải lại từ server</button>{vm.busy && <span role="status">Đang xử lý…</span>}</div>
      {vm.notice && <p role="status" className="rounded-lg bg-teal-50 p-4 text-teal-900">{vm.notice}</p>}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]"><aside className="space-y-3"><h2 className="font-semibold">Chuyến của tôi</h2>{!vm.busy && !vm.trips.length && <p className="text-slate-500">Chưa có chuyến ở trang này.</p>}
        {vm.trips.map(t => <button key={t.id} disabled={vm.busy} onClick={() => vm.open(t.id)} className={`${button} block w-full text-left ${trip?.id === t.id ? 'bg-teal-50 border-teal-600' : 'bg-white'}`}><strong className="block">{t.title}</strong><span className="text-xs">{t.status} · {new Date(t.startAt).toLocaleDateString('vi-VN')}</span></button>)}
        <div className="flex gap-2"><button className={button} disabled={vm.busy || vm.page === 1} onClick={() => vm.listPage(vm.page - 1)}>Trước</button><button className={button} disabled={vm.busy || vm.trips.length < 20} onClick={() => vm.listPage(vm.page + 1)}>Sau</button></div>
      </aside><section className="rounded-xl border border-slate-200 bg-white p-5 space-y-8">
        {trip && <p className="text-sm text-teal-800">{trip.status} · phiên bản {trip.version}</p>}
        <BasicForm key={`${trip?.id || 'new'}-${trip?.version || 0}`} trip={trip} destinations={vm.destinations} pickups={vm.pickups} busy={vm.busy} onDestination={vm.loadDestination} onSave={vm.save} />
        {trip && <>
          <section><OrderedSelection title="2. Checkpoint bắt buộc theo thứ tự" items={trip.checkpoints.flatMap(c => c.sourceCheckpointId ? [{ id: c.sourceCheckpointId, name: c.name }] : [])} disabled={!editable} onChange={vm.setCheckpointIds} />
            <label className="block mt-3">Thêm checkpoint<select className={field} value="" disabled={!editable} onChange={e => { if (e.target.value) void vm.setCheckpointIds([...checkpointIds, e.target.value]); }}><option value="">Chọn checkpoint</option>{vm.checkpoints.filter(c => !checkpointIds.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          </section>
          <section><OrderedSelection title="3. Trail hệ thống dự kiến" items={trip.trails.map(t => ({ id: t.systemTrailId, name: t.snapshotName }))} disabled={!editable} onChange={vm.setTrailIds} /><p className="text-sm text-slate-500 mb-3">Đi theo chiều chuẩn. Điểm cuối trail trước phải nối với điểm đầu trail sau.</p>
            {!vm.trails.length && <p className="text-slate-500">Không có trail hệ thống ở trang này. Cần master data từ nhóm quản lý trail.</p>}
            <div className="grid gap-2 sm:grid-cols-2">{vm.trails.map(t => <button key={t.id} className={`${button} text-left`} disabled={!editable || !t.canAppend} onClick={() => vm.setTrailIds([...trailIds, t.id])}><strong className="block">{t.name}</strong><span>{t.distanceKm} km · {t.difficulty}</span><span className="block text-xs">Đi qua {t.coveredCheckpointIds.length} checkpoint đã chọn{!t.canAppend ? ' · Không thể nối tiếp hoặc đã chọn' : ''}</span></button>)}</div>
            <div className="flex gap-2 mt-3"><button className={button} disabled={vm.busy || vm.trailPage === 1} onClick={() => vm.suggestionsPage(vm.trailPage - 1)}>Trước</button><button className={button} disabled={vm.busy || vm.trails.length < 20} onClick={() => vm.suggestionsPage(vm.trailPage + 1)}>Sau</button></div>
          </section>
          <section><h2 className="font-semibold text-lg mb-3">4. Kiểm tra và publish</h2><button className={button} disabled={!editable} onClick={vm.review}>Kiểm tra điều kiện</button>
            {vm.readiness && <div className="my-3" role="status">{vm.readiness.canPublish ? <p className="text-teal-700">Trip đã sẵn sàng. Publish sẽ kiểm tra lại toàn bộ dữ liệu.</p> : <ul className="list-disc pl-5 text-red-700">{vm.readiness.issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul>}</div>}
            <button className={`${button} ml-2 bg-teal-700 text-white hover:bg-teal-800`} disabled={!editable || !vm.readiness?.canPublish || vm.readiness.version !== trip.version} onClick={vm.publish}>Publish chuyến đi</button>
          </section>
          {['DRAFT', 'OPEN', 'FULL'].includes(trip.status) && <form onSubmit={e => { e.preventDefault(); void vm.cancel(reason); }} className="border-t pt-4"><label>Yêu cầu hủy (Admin xét duyệt)<textarea className={field} required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label><button className={`${button} mt-2`} disabled={vm.busy || !reason.trim()}>Gửi yêu cầu hủy</button></form>}
        </>}
      </section></div>
    </>}
  </div></main>;
};
