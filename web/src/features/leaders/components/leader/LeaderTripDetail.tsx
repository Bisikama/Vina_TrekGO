"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/axios";
import { useLeaderTripDetail, useLeaderTripMutations } from "../../hooks";
import {
  getLeaderTripParticipants,
  getLeaderTripErrorMessage,
} from "../../services/leader-public-trips.api";
import type {
  LeaderParticipantItem,
  LeaderParticipantsSummary,
} from "../../types/leader-trips";

function formatDateTimeVi(iso?: string | null) {
  if (!iso) return "Chưa ghi nhận";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Chưa ghi nhận";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function LeaderTripDetail({ tripId }: { tripId: string }) {
  const { trip, refetch: refetchTrip } = useLeaderTripDetail({ tripId });
  const { closeRegistration, startTrip, completeTrip, isSubmitting } = useLeaderTripMutations();

  const [participants, setParticipants] = useState<LeaderParticipantItem[]>([]);
  const [summary, setSummary] = useState<LeaderParticipantsSummary | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(true);
  
  const [slots, setSlots] = useState<{ capacity: number; remainingSlots: number } | null>(null);
  const [actionBanner, setActionBanner] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'NO_SHOW'>('ALL');

  function showMessage(msg: string) {
    setActionBanner(msg);
    window.setTimeout(() => setActionBanner(""), 4500);
  }

  // Tải danh sách thành viên và tóm tắt điểm danh từ Backend
  async function fetchRoster() {
    if (!tripId) return;
    try {
      setLoadingRoster(true);
      const data = await getLeaderTripParticipants(tripId, { pageSize: 100 });
      setParticipants(data.items || []);
      setSummary(data.summary || null);
    } catch (err: unknown) {
      console.warn("Không thể tải danh sách quân số:", err);
    } finally {
      setLoadingRoster(false);
    }
  }

  useEffect(() => {
    fetchRoster();
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    apiClient
      .get<any>(`/api/v1/trips/${tripId}`)
      .then((res) => {
        if (res.data) {
          setSlots({
            capacity: Number(res.data.capacity) || 15,
            remainingSlots: Number(
              res.data.remainingSlots !== undefined ? res.data.remainingSlots : res.data.capacity
            ),
          });
        }
      })
      .catch((err) => {
        console.warn("Could not fetch trip slots:", err);
      });
  }, [tripId]);

  const totalCapacity = trip?.capacity || slots?.capacity || summary?.capacity || 15;
  const bookedCount = summary ? summary.totalParticipants : (slots ? Math.max(0, slots.capacity - slots.remainingSlots) : participants.length);

  // Lọc theo từ khóa tìm kiếm và tab trạng thái
  const visibleParticipants = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return participants.filter((p) => {
      const matchKeyword =
        !keyword ||
        `${p.fullName} ${p.phone ?? ''} ${p.idDocumentNo ?? ''} ${p.buyerDisplay}`.toLowerCase().includes(keyword);
      const matchStatus =
        statusFilter === 'ALL' || p.checkinStatus === statusFilter;
      return matchKeyword && matchStatus;
    });
  }, [participants, search, statusFilter]);

  

  async function handleCloseRegistration() {
    if (!trip) return;
    try {
      await closeRegistration(tripId, { expectedVersion: trip.version });
      await refetchTrip();
      showMessage("Đã đóng sổ đăng ký thành công (ghi nhận thời gian đóng thực tế).");
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : "Không thể đóng sổ đăng ký.");
    }
  }

  async function handleStartTrip() {
    if (!trip) return;
    if (summary && summary.notCheckedInCount > 0) {
      const confirmed = window.confirm(
        `Vẫn còn ${summary.notCheckedInCount} thành viên chưa điểm danh. Bạn có chắc chắn muốn xuất phát hành trình không?`
      );
      if (!confirmed) return;
    }
    try {
      await startTrip(tripId, { expectedVersion: trip.version });
      await refetchTrip();
      await fetchRoster();
      showMessage("Đã bắt đầu xuất phát chuyến đi (ghi nhận thời gian khởi hành thực tế).");
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : "Không thể bắt đầu chuyến đi.");
    }
  }

  async function handleCompleteTrip() {
    if (!trip) return;
    try {
      await completeTrip(tripId, { expectedVersion: trip.version });
      await refetchTrip();
      showMessage("Đã hoàn thành chuyến đi (ghi nhận thời gian hoàn thành thực tế).");
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : "Không thể hoàn thành chuyến đi.");
    }
  }

  const tripTitle = trip?.title || `Chuyến đi #${tripId}`;
  const startDateStr = trip?.startAt ? new Date(trip.startAt).toLocaleDateString("vi-VN") : "";
  const endDateStr = trip?.endAt ? new Date(trip.endAt).toLocaleDateString("vi-VN") : "";
  const statusLabel =
    trip?.status === "OPEN"
      ? "Đang mở đăng ký"
      : trip?.status === "DRAFT"
      ? "Bản nháp"
      : trip?.status === "FULL"
      ? "Đã đủ chỗ (FULL)"
      : trip?.status === "CLOSED"
      ? "Đã đóng form đăng ký"
      : trip?.status === "IN_PROGRESS"
      ? "Đang diễn ra (IN_PROGRESS)"
      : trip?.status === "COMPLETED"
      ? "Đã hoàn thành"
      : trip?.status === "CANCELLED"
      ? "Đã hủy"
      : "Chuyến đi";

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
      {actionBanner && (
        <div className="mb-4 rounded-xl bg-[#125238] px-4 py-3 text-sm font-semibold text-white shadow">
          {actionBanner}
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs text-slate-500">
            Quản lý dẫn đoàn　›　Chuyến đi của tôi　›　#{tripId}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              {statusLabel}
            </span>

            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              Cấp {trip?.trails?.[0]?.snapshotDifficulty || "2"} ·{" "}
              {trip?.trails?.[0]?.snapshotName || "Trekking Tour"}
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-bold">{tripTitle}</h1>

          <p className="mt-2 text-sm text-slate-600">
            {startDateStr} {endDateStr ? `– ${endDateStr}` : ""} · Mã tour #{tripId}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/leader/trips/${tripId}/edit`}
            className="rounded-lg bg-[#e5edfb] px-4 py-2 text-sm font-semibold hover:bg-[#d5e3f9] transition"
          >
            Chỉnh sửa &amp; Hạn đóng form
          </Link>

          <Link
            href={`/leader/trips/${tripId}/settlement`}
            className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition"
          >
            Quyết toán
          </Link>

          {(trip?.status === "OPEN" || trip?.status === "FULL") && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCloseRegistration}
              className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-200 disabled:opacity-50 transition"
            >
              Đóng form đăng ký sớm
            </button>
          )}

          {(trip?.status === "OPEN" ||
            trip?.status === "FULL" ||
            trip?.status === "CLOSED") && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleStartTrip}
              className="rounded-lg bg-[#125238] px-5 py-2 text-sm font-bold text-white hover:bg-[#2f6b4f] disabled:opacity-50 transition shadow"
            >
              Bắt đầu hành trình
            </button>
          )}

          {trip?.status === "IN_PROGRESS" && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCompleteTrip}
              className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50 transition shadow"
            >
              Hoàn thành chuyến đi
            </button>
          )}
        </div>
      </div>

      {/* Lịch trình & Timeline Vận hành Thực tế */}
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#125238]">
                Mục 1 · Kế hoạch &amp; Cửa sổ Đăng ký
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Lịch trình Dự kiến &amp; Hạn Đóng/Mở Form
              </h2>
            </div>
            <Link
              href={`/leader/trips/${tripId}/edit#section-schedule`}
              className="text-xs font-bold text-[#125238] hover:underline"
            >
              Điều chỉnh hạn đóng form →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="text-slate-500 block">Giờ mở nhận đăng ký (dự kiến)</span>
              <strong className="mt-1 block text-sm text-slate-900">
                {formatDateTimeVi(trip?.registrationOpenAt ?? trip?.publishedAt)}
              </strong>
            </div>

            <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3">
              <span className="text-amber-800 block">Hạn chót đóng form (tự động đóng sổ)</span>
              <strong className="mt-1 block text-sm text-amber-950">
                {formatDateTimeVi(trip?.registrationDeadlineAt)}
              </strong>
              <span className="text-[11px] text-amber-700">
                Mặc định trước 2 ngày (tối thiểu trước 1 ngày)
              </span>
            </div>

            <div className="rounded-xl bg-emerald-50/60 p-3">
              <span className="text-slate-600 block">Giờ khởi hành dự kiến</span>
              <strong className="mt-1 block text-sm text-[#125238]">
                {formatDateTimeVi(trip?.startAt)}
              </strong>
            </div>

            <div className="rounded-xl bg-emerald-50/60 p-3">
              <span className="text-slate-600 block">Giờ kết thúc dự kiến</span>
              <strong className="mt-1 block text-sm text-[#125238]">
                {formatDateTimeVi(trip?.endAt)}
              </strong>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Mục 2 · Dấu thời gian Luồng Thực tế
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Timeline Vận hành Thực tế (Actual Lifecycle)
              </h2>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">
              Tự động ghi nhận theo luồng
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="text-slate-500 block">1. Công khai mở bán (publishedAt)</span>
              <strong className="mt-1 block text-sm text-slate-900">
                {formatDateTimeVi(trip?.publishedAt)}
              </strong>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <span className="text-slate-500 block">2. Đóng sổ đăng ký thực tế (closedAt)</span>
              <strong className="mt-1 block text-sm text-slate-900">
                {formatDateTimeVi(trip?.closedAt)}
              </strong>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <span className="text-slate-500 block">3. Xuất phát thực tế (startedAt)</span>
              <strong className="mt-1 block text-sm text-slate-900">
                {formatDateTimeVi(trip?.startedAt)}
              </strong>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <span className="text-slate-500 block">
                {trip?.cancelledAt ? "4. Thời điểm hủy (cancelledAt)" : "4. Hoàn thành thực tế (completedAt)"}
              </span>
              <strong className="mt-1 block text-sm text-slate-900">
                {formatDateTimeVi(trip?.cancelledAt ?? trip?.completedAt)}
              </strong>
            </div>
          </div>
        </article>
      </section>

      {/* 4 Thẻ Thống kê Thực địa */}
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl bg-white p-5 shadow-xs border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase">QUÂN SỐ ĐÃ ĐĂNG KÝ</p>

          <strong className="mt-4 block text-4xl text-[#125238]">
            {bookedCount}
            <span className="text-base text-slate-400"> / {totalCapacity}</span>
          </strong>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-[#125238] transition-all"
              style={{
                width: `${totalCapacity > 0 ? (bookedCount / totalCapacity) * 100 : 0}%`,
              }}
            />
          </div>
        </article>

        <article className="rounded-xl bg-white p-5 shadow-xs border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase">TIẾN ĐỘ TẬP KẾT</p>

          <strong className="mt-4 block text-4xl text-blue-700">
            {summary ? `${summary.progressPercent}%` : "0%"}
          </strong>

          <p className="mt-4 text-xs text-slate-500">
            {summary ? `${summary.checkedInCount}/${summary.totalParticipants} thành viên đã có mặt` : "Chưa có thành viên"}
          </p>
        </article>

        <article className="rounded-xl bg-white p-5 shadow-xs border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase">CHECK-IN THỰC ĐỊA</p>

          <strong className="mt-4 block text-4xl text-emerald-700">
            {summary?.checkedInCount ?? 0}
            <span className="text-base text-slate-400"> / {summary?.totalParticipants ?? bookedCount}</span>
          </strong>

          <p className="mt-4 text-xs text-slate-500">
            Chưa tới: <b className="text-amber-800">{summary?.notCheckedInCount ?? 0}</b> · Vắng: <b className="text-red-700">{summary?.noShowCount ?? 0}</b>
          </p>
        </article>

        <article className="rounded-xl bg-white p-5 shadow-xs border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase">VẮNG MẶT (NO-SHOW)</p>

          <strong className="mt-4 block text-4xl text-red-600">
            {summary?.noShowCount ?? 0}
          </strong>

          <p className="mt-4 text-xs text-slate-500">
            Chốt sổ khi bấm xuất phát tour
          </p>
        </article>
      </section>

      {/* Bảng Danh Sách Thành Viên & Thao Tác Điểm Danh Thực Địa */}
      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">Danh sách Thành viên &amp; Quân số</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Thông tin liên lạc, người đi cùng, điểm đón và trạng thái check-in thời gian thực.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Tabs */}
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`rounded-md px-3 py-1.5 transition ${statusFilter === 'ALL' ? 'bg-white font-bold text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Tất cả ({participants.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('NOT_CHECKED_IN')}
                className={`rounded-md px-3 py-1.5 transition ${statusFilter === 'NOT_CHECKED_IN' ? 'bg-amber-100 font-bold text-amber-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Chưa đến ({summary?.notCheckedInCount ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CHECKED_IN')}
                className={`rounded-md px-3 py-1.5 transition ${statusFilter === 'CHECKED_IN' ? 'bg-emerald-100 font-bold text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Đã đến ({summary?.checkedInCount ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('NO_SHOW')}
                className={`rounded-md px-3 py-1.5 transition ${statusFilter === 'NO_SHOW' ? 'bg-red-100 font-bold text-red-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Vắng mặt ({summary?.noShowCount ?? 0})
              </button>
            </div>

            {/* Ô tìm kiếm */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-lg bg-[#edf2fc] px-3.5 text-xs outline-none focus:ring-2 focus:ring-[#125238]/30 min-w-[200px]"
              placeholder="Tìm tên, SĐT, người đặt..."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="bg-[#e8eef9] text-[11px] uppercase tracking-wider text-slate-700">
              <tr>
                <th className="px-4 py-3.5">Họ tên Trekker</th>
                <th className="px-4 py-3.5">Liên lạc &amp; Người mua</th>
                <th className="px-4 py-3.5">Liên hệ khẩn cấp</th>
                <th className="px-4 py-3.5">Ngày sinh / CCCD</th>
                <th className="px-4 py-3.5">Điểm đón tập kết</th>
                <th className="px-4 py-3.5">Trạng thái Check-in</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {loadingRoster ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <svg className="inline-block animate-spin -mt-0.5 mr-2 h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Đang nạp danh sách quân số...
                  </td>
                </tr>
              ) : visibleParticipants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    {participants.length === 0 ? (
                      <div className="max-w-md mx-auto p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                                                <p className="font-bold text-slate-800 text-sm mb-1">
                          Chưa có thành viên nào đặt chỗ cho chuyến đi này
                        </p>
                        <p className="text-xs text-slate-500">
                          Khi có khách đăng ký và thanh toán thành công, danh sách sẽ tự động hiển thị tại đây.
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Không tìm thấy thành viên nào phù hợp với bộ lọc hiện tại.
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                visibleParticipants.map((p) => {
                  const isChecked = p.checkinStatus === 'CHECKED_IN';
                  const isNoShow = p.checkinStatus === 'NO_SHOW';
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900 text-sm">{p.fullName}</p>
                        {p.isLinkedAccount ? (
                          <span className="mt-0.5 inline-block text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                            Tài khoản cá nhân
                          </span>
                        ) : (
                          <span className="mt-0.5 inline-block text-[10px] text-slate-400 font-medium">
                            Chưa liên kết tài khoản
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-900">{p.phone || "—"}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Mua bởi: <span className="font-semibold">{p.buyerDisplay}</span> {p.buyerPhone ? `(${p.buyerPhone})` : ''}
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800">{p.emergencyContactName || "—"}</p>
                        <p className="text-[11px] text-slate-500">{p.emergencyContactPhone || ""}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="text-slate-800">{p.dateOfBirth || "—"}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{p.idDocumentNo || "—"}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800">{p.pickupPoint?.name || "Điểm tập kết chung"}</p>
                        {p.pickupPoint?.address && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{p.pickupPoint.address}</p>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isChecked ? (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                              Đã điểm danh
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-1">
                              {p.checkinMethod === 'QR' ? 'Quét QR' : 'Thủ công'} · {formatDateTimeVi(p.checkedInAt)}
                            </span>
                          </div>
                        ) : isNoShow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                            Vắng mặt (No-show)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900">
                            Chưa đến
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
