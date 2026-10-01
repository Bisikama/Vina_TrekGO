'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { privateTripsApi as api, PrivateSource, PrivateTrip, PrivateInput } from '../services/private-trips.api';
const inputClass = 'block w-full rounded border p-2 mt-1';
const button = 'rounded border px-3 py-2 disabled:opacity-40';
const local = (date: string) => { const d = new Date(date); return new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); };
function message(e: unknown) {
  if (axios.isAxiosError<{ error?: { message?: string; code?: string } }>(e)) return e.response?.data?.error?.message || e.message;
  return e instanceof Error ? e.message : 'Không thể thực hiện thao tác';
}
export function PrivateTrips() {
  const { user, accessToken } = useAuth();
  const [sources, setSources] = useState<PrivateSource[]>([]), [trips, setTrips] = useState<PrivateTrip[]>([]);
  const [trip, setTrip] = useState<PrivateTrip | null>(null), [sourceKey, setSourceKey] = useState('');
  const [destination, setDestination] = useState(''), [selected, setSelected] = useState<string[]>([]);
  const [pickups, setPickups] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [invite, setInvite] = useState('');
  const source = sources.find(s => `${s.type}:${s.id}` === sourceKey);
  useEffect(() => {
    let cancelled = false;
    if (!accessToken || user?.role !== 'USER') return;
    Promise.all([api.sources(), api.list()]).then(([s,t]) => { if (!cancelled) { setSources(s); setTrips(t); } }).catch(e => { if (!cancelled) setError(message(e)); });
    return () => { cancelled = true; };
  }, [accessToken, user?.role]);
  useEffect(() => {
    let cancelled = false;
    if (!destination) return;
    api.pickups(destination).then(p => { if (!cancelled) setPickups(p); }).catch(e => { if (!cancelled) setError(message(e)); });
    return () => { cancelled = true; };
  }, [destination]);
  async function run(work: () => Promise<void>) { setBusy(true); setError(''); try { await work(); setTrips(await api.list()); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
  const editable = !trip || (trip.status === 'OPEN' && new Date(trip.startAt) > new Date());
  return <main className="mx-auto max-w-5xl space-y-6 p-6"><h1 className="text-3xl font-bold">Chuyến đi riêng tư</h1><p>Chỉ dùng trail cá nhân hoặc trail hệ thống đã có quyền sử dụng. Không bán slot, không tạo booking thanh toán.</p>
    {!accessToken ? <Link href="/public/login">Đăng nhập để tiếp tục</Link> : user?.role !== 'USER' ? <p>CF03 chỉ dành cho tài khoản USER.</p> : <>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button className={button} disabled={busy} onClick={() => { setTrip(null); setSourceKey(''); setDestination(''); setPickups([]); setSelected([]); setInvite(''); }}>Tạo chuyến mới</button>
      <button className={button} disabled={busy} onClick={() => void run(async () => { const t = await api.list(); setTrips(t); if (trip) setTrip(t.find(x => x.id === trip.id) ?? null); })}>Tải lại dữ liệu</button>
      <div className="grid gap-6 md:grid-cols-[240px_1fr]"><aside className="space-y-2">{trips.map(t => <button className={`${button} block w-full text-left`} disabled={busy} key={t.id} onClick={() => { setTrip(t); setDestination(t.destinationId); setPickups([]); setInvite(''); }}>{t.title} · {t.status}</button>)}</aside><section className="space-y-5">
        {trip && <p>{trip.status} · phiên bản {trip.version}</p>}
        {!trip && <><label>Trail nguồn<select className={inputClass} value={sourceKey} disabled={busy} onChange={e => { const s = sources.find(x => `${x.type}:${x.id}` === e.target.value); setSourceKey(e.target.value); setDestination(s?.destinationId || ''); setPickups([]); setSelected([]); }}><option value="">Chọn trail</option>{sources.map(s => <option key={`${s.type}:${s.id}`} value={`${s.type}:${s.id}`}>{s.name} ({s.type})</option>)}</select></label>
          {source && !source.destinationId && <label>ID điểm đến của trail chưa gắn địa điểm<input className={inputClass} value={destination} onChange={e => { setDestination(e.target.value); setPickups([]); }} placeholder="UUID điểm đến" /></label>}
          <fieldset disabled={busy}><legend>Checkpoint bắt buộc (ít nhất một, theo thứ tự trail)</legend>{source?.points.map(p => <label key={p.id} className="block"><input type="checkbox" checked={selected.includes(p.id)} onChange={e => setSelected(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))} /> {p.sequence}. {p.name}</label>)}</fieldset></>}
        <form key={trip ? `${trip.id}:${trip.version}` : sourceKey} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => {
          const data: PrivateInput = { title: String(f.get('title')), description: String(f.get('description')), startAt: new Date(String(f.get('start'))).toISOString(), endAt: new Date(String(f.get('end'))).toISOString(), capacity: Number(f.get('capacity')), pickupPointId: String(f.get('pickup')) };
          const t = trip ? await api.update(trip,data) : await api.create({ ...data, type: source!.type, trailRef: source!.id, destinationId: destination, checkpointIds: source!.points.filter(p => selected.includes(p.id)).map(p => p.id) }); setTrip(t); setInvite('');
        }); }}><fieldset disabled={busy || !editable} className="space-y-3">
          <label className="block">Tên chuyến<input name="title" className={inputClass} required maxLength={220} defaultValue={trip?.title} /></label>
          <label className="block">Mô tả<textarea name="description" className={inputClass} maxLength={5000} defaultValue={trip?.description || ''} /></label>
          <label className="block">Bắt đầu<input name="start" type="datetime-local" className={inputClass} required defaultValue={trip ? local(trip.startAt) : ''} /></label>
          <label className="block">Kết thúc<input name="end" type="datetime-local" className={inputClass} required defaultValue={trip ? local(trip.endAt) : ''} /></label>
          <label className="block">Sức chứa<input name="capacity" type="number" min={1} max={2147483647} className={inputClass} required defaultValue={trip?.maxPax || 1} /></label>
          <label className="block">Điểm tập kết<select name="pickup" key={`${trip?.pickupPointId}-${pickups.map(p => p.id).join()}`} className={inputClass} required defaultValue={trip?.pickupPointId || ''}><option value="">Chọn điểm tập kết</option>{pickups.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <button className={button} disabled={!trip && (!source || !selected.length || !destination)}>{trip ? 'Lưu thay đổi' : 'Tạo chuyến OPEN'}</button>
        </fieldset></form>
        {trip && editable && <><form onSubmit={e => { e.preventDefault(); const expiry = String(new FormData(e.currentTarget).get('expiry')); void run(async () => { const result = await api.invite(trip, expiry ? new Date(expiry).toISOString() : undefined); setTrip({ ...trip, version: result.tripVersion }); setInvite(`${result.inviteCode} (hết hạn ${new Date(result.expiresAt).toLocaleString('vi-VN')})`); }); }}><label>Hết hạn lời mời (trước giờ khởi hành)<input className={inputClass} name="expiry" type="datetime-local" /></label><button className={button} disabled={busy}>Tạo / tạo lại mã mời</button></form>
          {invite && <p role="status" className="break-all">Mã mời: {invite}</p>}
          <button className={button} disabled={busy} onClick={() => void run(async () => { setTrip(await api.revoke(trip)); setInvite(''); })}>Thu hồi mã mời</button>
          <form onSubmit={e => { e.preventDefault(); const reason = String(new FormData(e.currentTarget).get('reason')); void run(async () => { setTrip(await api.cancel(trip, reason)); setInvite(''); }); }}><label>Lý do hủy<input className={inputClass} name="reason" maxLength={2000} /></label><button className={button} disabled={busy}>Hủy chuyến riêng tư</button></form>
        </>}
      </section></div>
    </>}
  </main>;
}
