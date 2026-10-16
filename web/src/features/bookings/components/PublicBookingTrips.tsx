'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';
import {
  usePublicBookingTrips,
  usePublicBookingTripDetail,
  useBookingMutations,
} from '../hooks';
import { formatBookingDateTime, formatMoneyVND } from '../services/booking.api';
import type { Participant } from '../types/booking.types';
import { BookingSignIn } from './BookingSignIn';

export function PublicBookingTrips() {
  const {
    trips,
    total,
    page,
    pageSize,
    isLoading,
    error,
    setPage,
    setFilters,
    refetch,
  } = usePublicBookingTrips();

  const handleFilterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    const filterObj: Record<string, any> = {};

    const dateFrom = values.get('dateFrom')?.toString();
    const dateTo = values.get('dateTo')?.toString();
    const difficulty = values.get('difficulty')?.toString();
    const priceMax = values.get('price')?.toString();

    if (dateFrom) filterObj.dateFrom = dateFrom;
    if (dateTo) filterObj.dateTo = dateTo;
    if (difficulty) filterObj.difficulty = difficulty;
    if (priceMax) filterObj.priceMax = Number(priceMax);

    setFilters(filterObj);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F4] px-4 pb-20 pt-28">
      <div className="mx-auto max-w-6xl space-y-7">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#125238]">
              Vina TrekGO · Khám Phá Chuyến Đi
            </p>
            <h1 className="mt-2 text-4xl font-bold text-stone-900">
              Chọn hành trình tiếp theo
            </h1>
            <p className="mt-3 text-stone-600">
              Xem lịch khởi hành, chỗ trống thực tế và đặt chỗ cùng nhóm của bạn.
            </p>
          </div>
          <Link
            href="/bookings"
            className="h-fit rounded-xl border border-[#125238] px-4 py-2 text-sm font-bold text-[#125238] transition hover:bg-emerald-50"
          >
            Đặt chỗ của tôi
          </Link>
        </div>

        <form
          className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:grid-cols-5"
          onSubmit={handleFilterSubmit}
        >
          <label className="text-xs font-semibold text-stone-600">
            Từ ngày
            <input
              type="date"
              name="dateFrom"
              className="mt-1 w-full rounded-lg border border-stone-200 p-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Đến ngày
            <input
              type="date"
              name="dateTo"
              className="mt-1 w-full rounded-lg border border-stone-200 p-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Độ khó
            <select
              name="difficulty"
              className="mt-1 w-full rounded-lg border border-stone-200 bg-white p-2 text-sm"
            >
              <option value="">Tất cả</option>
              <option value="EASY">Dễ</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="HARD">Khó</option>
              <option value="EXTREME">Rất khó</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Giá tối đa (₫)
            <input
              type="number"
              min="0"
              name="price"
              placeholder="VD: 3000000"
              className="mt-1 w-full rounded-lg border border-stone-200 p-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-xl bg-[#125238] p-2.5 text-sm font-bold text-white shadow transition hover:bg-[#2f6b4f]"
          >
            Tìm chuyến đi
          </button>
        </form>

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200"
          >
            <span>{error}</span>
            <button type="button" className="underline font-bold" onClick={refetch}>
              Thử lại
            </button>
          </div>
        )}

        {isLoading && !error && (
          <div className="p-12 text-center text-stone-500 text-sm">
            Đang tải danh sách chuyến đi công khai…
          </div>
        )}

        {!isLoading && trips.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-12 text-center text-stone-500">
            Chưa có chuyến đi phù hợp. Hãy thay đổi bộ lọc hoặc quay lại sau.
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <article
              key={trip.id}
              className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div>
                <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  {trip.destination?.name} · Còn {trip.remainingSlots} chỗ
                </span>
                <h2 className="mt-3 text-lg font-bold text-stone-900 line-clamp-2">
                  <Link href={`/trips/${trip.id}`} className="hover:text-[#125238]">
                    {trip.title}
                  </Link>
                </h2>
                <p className="mt-3 text-xs text-stone-500">
                  📅 {formatBookingDateTime(trip.startAt)}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  👤 Leader: {trip.leader?.fullName ?? 'Đang cập nhật'}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-stone-400 block uppercase">Giá vé trọn gói</span>
                  <strong className="text-base text-[#125238] font-bold">
                    {trip.pricePerPax ? formatMoneyVND(trip.pricePerPax) : 'Chưa có giá'}
                  </strong>
                </div>
                <Link
                  href={`/trips/${trip.id}`}
                  className="rounded-xl bg-[#125238] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#2f6b4f]"
                >
                  Xem chi tiết
                </Link>
              </div>
            </article>
          ))}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 disabled:opacity-40"
            >
              ← Trước
            </button>
            <span className="text-xs font-semibold text-stone-600">
              Trang {page} / {Math.ceil(total / pageSize)} (Tổng {total} chuyến)
            </span>
            <button
              type="button"
              disabled={page * pageSize >= total}
              onClick={() => setPage(page + 1)}
              className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 disabled:opacity-40"
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SimpleParticipantForm({
  initial,
  max,
  busy,
  submitLabel,
  onSubmit,
}: {
  initial: { fullName: string }[];
  max: number;
  busy: boolean;
  submitLabel: string;
  onSubmit: (people: Participant[]) => Promise<void>;
}) {
  const [participants, setParticipants] = useState<Participant[]>(initial);

  const add = () => {
    if (participants.length < max) {
      setParticipants([...participants, { fullName: '', phone: '' }]);
    }
  };

  const remove = (idx: number) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== idx));
    }
  };

  const update = (idx: number, field: keyof Participant, val: string) => {
    const updated = [...participants];
    updated[idx] = { ...updated[idx], [field]: val };
    setParticipants(updated);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(participants);
      }}
      className="space-y-4"
    >
      <div className="space-y-3">
        {participants.map((p, idx) => (
          <div key={idx} className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">Thành viên #{idx + 1}</span>
              {participants.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Xóa
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                required
                type="text"
                placeholder="Họ và tên *"
                value={p.fullName}
                onChange={(e) => update(idx, 'fullName', e.target.value)}
                className="rounded border border-stone-200 bg-white p-2 text-sm"
              />
              <input
                type="tel"
                placeholder="Số điện thoại"
                value={p.phone || ''}
                onChange={(e) => update(idx, 'phone', e.target.value)}
                className="rounded border border-stone-200 bg-white p-2 text-sm"
              />
            </div>
          </div>
        ))}
      </div>
      {participants.length < max && (
        <button
          type="button"
          onClick={add}
          className="text-xs font-semibold text-emerald-800 hover:underline"
        >
          + Thêm người đi cùng (Còn {max - participants.length} chỗ)
        </button>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[#125238] p-3 text-center text-sm font-bold text-white transition hover:bg-[#2f6b4f] disabled:bg-stone-300"
      >
        {busy ? 'Đang xử lý...' : submitLabel}
      </button>
    </form>
  );
}

export function PublicBookingTrip({ tripId, participantCount = 1 }: { tripId: string; participantCount?: number }) {
  const { accessToken, user } = useAuth();
  const router = useRouter();
  const { trip, isLoading, error: fetchError, refetch } = usePublicBookingTripDetail(tripId);
  const { createBooking, isSubmitting, error: mutationError } = useBookingMutations();

  const handleCreate = async (people: Participant[]) => {
    try {
      const result = await createBooking(tripId, people);
      router.push(`/bookings/${result.id}`);
    } catch {
      // Error handled by hook
    }
  };

  const error = mutationError?.message || fetchError;

  return (
    <div className="min-h-screen bg-[#F7F7F4] px-4 pb-20 pt-28">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/trips" className="text-sm font-semibold text-[#125238] hover:underline">
          ← Quay lại danh sách chuyến đi
        </Link>

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200"
          >
            <span>{error}</span>
            <button type="button" className="underline font-bold" onClick={refetch}>
              Tải lại
            </button>
          </div>
        )}

        {isLoading && !error && (
          <p className="text-sm text-stone-500">Đang tải thông tin chuyến đi…</p>
        )}

        {trip && (
          <>
            <header>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#125238]">
                {trip.destination?.name}
              </span>
              <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-stone-900">
                {trip.title}
              </h1>
              <p className="mt-3 max-w-3xl whitespace-pre-line text-sm text-stone-600">
                {trip.description}
              </p>
            </header>

            <div className="grid items-start gap-6 lg:grid-cols-2">
              <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-stone-900 border-b border-stone-100 pb-3">
                  Thông tin hành trình
                </h2>
                <div className="space-y-2 text-sm text-stone-700">
                  <p>📅 {formatBookingDateTime(trip.startAt)} – {formatBookingDateTime(trip.endAt)}</p>
                  <p>👤 Leader: {trip.leader?.fullName ?? 'Đang cập nhật'}</p>
                  <p>📍 Điểm tập kết: {trip.pickup ? `${trip.pickup.name} (${trip.pickup.address})` : 'Đang cập nhật'}</p>
                </div>

                {trip.routes && trip.routes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase text-stone-400">Tuyến đường</h3>
                    <ul className="mt-2 space-y-1 text-sm text-stone-700">
                      {trip.routes.map((r) => (
                        <li key={r.id} className="flex items-center gap-1.5">
                          • {r.snapshotName} ({r.snapshotDifficulty || 'Cấp 2'}{r.snapshotDistanceKm && ` - ${r.snapshotDistanceKm} km`})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {trip.checkpoints && trip.checkpoints.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase text-stone-400">Trạm kiểm soát</h3>
                    <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-stone-700">
                      {trip.checkpoints.map((c) => (
                        <li key={c.id}>
                          {c.name}{c.isRequired ? ' (bắt buộc)' : ''}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </section>

              <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <strong className="text-2xl font-bold text-[#125238]">
                    {trip.pricePerPax ? formatMoneyVND(trip.pricePerPax) : 'Chưa có giá'} / người
                  </strong>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-100">
                    Còn {trip.remainingSlots}/{trip.capacity} chỗ
                  </span>
                </div>

                {accessToken ? (
                  trip.status === 'OPEN' && trip.remainingSlots > 0 ? (
                    <SimpleParticipantForm
                      key={`participants-${participantCount}`}
                      initial={Array.from(
                        { length: Math.max(1, Math.min(trip.remainingSlots, participantCount)) },
                        (_, i) => ({ fullName: i === 0 ? (user?.fullName ?? '') : '', phone: '' })
                      )}
                      max={trip.remainingSlots}
                      busy={isSubmitting}
                      submitLabel="Giữ chỗ và tiếp tục thanh toán"
                      onSubmit={handleCreate}
                    />
                  ) : (
                    <p className="text-sm text-amber-700 bg-amber-50 p-4 rounded-xl">
                      Chuyến đi hiện không còn nhận đặt chỗ.
                    </p>
                  )
                ) : (
                  <BookingSignIn />
                )}

                <p className="text-xs text-stone-400 leading-relaxed">
                  * Số chỗ được kiểm tra và giữ quyền ưu tiên ngay khi bạn gửi yêu cầu đặt chỗ.
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
