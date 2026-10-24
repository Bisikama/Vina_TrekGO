"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/axios";
import { useLeaderTripDetail, useLeaderTripMutations } from "../../hooks";

type Member = {
  id: string;
  name: string;
  phone: string;
  email: string;
  emergency: string;
  health: string;
  equipment: string;
  payment: string;
  checkedIn: boolean;
};

const initialMembers: Member[] = [];

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

  const [members, setMembers] = useState(initialMembers);
  const [slots, setSlots] = useState<{ capacity: number; remainingSlots: number } | null>(null);
  const [actionBanner, setActionBanner] = useState<string>("");

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

  const totalCapacity = trip?.capacity || slots?.capacity || 15;
  const bookedCount = slots ? Math.max(0, slots.capacity - slots.remainingSlots) : members.length;

  const [search, setSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [reason, setReason] = useState(
    "Không đạt yêu cầu kiểm tra thể lực / y tế trước giờ xuất phát"
  );
  const [waiting, setWaiting] = useState<string[]>([]);

  const visibleMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return members.filter(
      (member) =>
        !keyword ||
        `${member.name} ${member.id} ${member.phone}`.toLowerCase().includes(keyword)
    );
  }, [members, search]);

  function showMessage(msg: string) {
    setActionBanner(msg);
    window.setTimeout(() => setActionBanner(""), 4000);
  }

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
    try {
      await startTrip(tripId, { expectedVersion: trip.version });
      await refetchTrip();
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

  function confirmRemove() {
    if (!removeTarget) return;
    setMembers((current) => current.filter((member) => member.id !== removeTarget.id));
    setRemoveTarget(null);
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
      ? "Đang diễn ra"
      : trip?.status === "COMPLETED"
      ? "Đã hoàn thành"
      : trip?.status === "CANCELLED"
      ? "Đã hủy"
      : "Chuyến đi";

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
      {actionBanner && (
        <div className="mb-4 rounded-xl bg-[#125238] px-4 py-3 text-sm font-semibold text-white shadow">
          ✓ {actionBanner}
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs text-slate-500">
            Quản lý dẫn đoàn　›　Chuyến đi của tôi　›　#{tripId}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              ● {statusLabel}
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
            className="rounded-lg bg-[#e5edfb] px-4 py-2 text-sm font-semibold"
          >
            ✎ Chỉnh sửa &amp; Hạn đóng form
          </Link>

          <Link
            href={`/leader/trips/${tripId}/settlement`}
            className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800"
          >
            ▤ Quyết toán
          </Link>

          {(trip?.status === "OPEN" || trip?.status === "FULL") && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCloseRegistration}
              className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
            >
              🔒 Đóng form đăng ký sớm
            </button>
          )}

          {(trip?.status === "OPEN" ||
            trip?.status === "FULL" ||
            trip?.status === "CLOSED") && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleStartTrip}
              className="rounded-lg bg-[#125238] px-5 py-2 text-sm font-bold text-white hover:bg-[#2f6b4f] disabled:opacity-50"
            >
              ▶ Bắt đầu hành trình
            </button>
          )}

          {trip?.status === "IN_PROGRESS" && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCompleteTrip}
              className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              ✓ Hoàn thành chuyến đi
            </button>
          )}
        </div>
      </div>

      {/* Tách biệt Lịch trình Dự kiến vs Timeline Vận hành Thực tế */}
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

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl bg-white p-5">
          <p className="text-xs font-bold">THÀNH VIÊN ĐÃ DUYỆT</p>

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

        <article className="rounded-xl bg-white p-5">
          <p className="text-xs font-bold">CHỜ DUYỆT</p>

          <strong className="mt-4 block text-4xl text-amber-700">{waiting.length}</strong>

          <p className="mt-4 text-xs text-slate-500">Cần phản hồi trước 18:00 hôm nay</p>
        </article>

        <article className="rounded-xl bg-white p-5">
          <p className="text-xs font-bold">TIẾN ĐỘ THANH TOÁN</p>

          <strong className="mt-4 block text-4xl">87%</strong>

          <p className="mt-4 text-xs text-slate-500">12 người đã hoàn tất cọc</p>
        </article>

        <article className="rounded-xl bg-white p-5">
          <p className="text-xs font-bold">CHECK-IN THỰC ĐỊA</p>

          <strong className="mt-4 block text-4xl">
            {members.filter((member) => member.checkedIn).length}
          </strong>

          <p className="mt-4 text-xs text-slate-500">Mở check-in trước 60 phút</p>
        </article>
      </section>

      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
          <div className="flex-1">
            <h2 className="text-lg font-bold">Danh sách Thành viên Chính thức</h2>

            <p className="text-xs text-slate-500">
              Thông tin y tế, liên hệ khẩn cấp, thiết bị thuê và trạng thái check-in.
            </p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 rounded-lg bg-[#edf2fc] px-4 text-sm outline-none"
            placeholder="Tìm tên, SĐT, mã Trekker..."
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="bg-[#e8eef9] text-[10px] uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-4">Họ tên Trekker</th>
                <th className="px-4 py-4">Liên lạc</th>
                <th className="px-4 py-4">Khẩn cấp</th>
                <th className="px-4 py-4">Hồ sơ y tế</th>
                <th className="px-4 py-4">Thiết bị thuê</th>
                <th className="px-4 py-4">Thanh toán</th>
                <th className="px-4 py-4">Check-in</th>
                <th className="px-4 py-4" />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {visibleMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    {bookedCount > 0 ? (
                      <div className="max-w-md mx-auto p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-2 font-bold text-sm">
                          {bookedCount}
                        </div>
                        <p className="font-bold text-slate-800 text-sm mb-1">
                          Hệ thống đã ghi nhận {bookedCount} thành viên đặt chỗ thành công
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">
                        Chưa có thành viên nào tham gia chuyến đi này.
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                visibleMembers.map((member) => (
                  <tr key={member.id} className="text-xs hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <b>{member.name}</b>
                    </td>
                    <td className="px-4 py-4">{member.phone}</td>
                    <td className="px-4 py-4">{member.emergency}</td>
                    <td className="px-4 py-4">{member.health}</td>
                    <td className="px-4 py-4">{member.equipment}</td>
                    <td className="px-4 py-4">{member.payment}</td>
                    <td className="px-4 py-4">
                      {member.checkedIn ? "Đã check-in" : "Chưa check-in"}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setRemoveTarget(member)}
                        className="rounded-lg bg-red-50 px-3 py-2 font-semibold text-red-700"
                      >
                        Loại khỏi đoàn
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {removeTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xl rounded-2xl bg-white shadow-2xl p-5"
          >
            <h2 className="text-lg font-bold">
              Hủy tư cách tham gia của Trekker ({removeTarget.name})
            </h2>
            <p className="mt-2 text-xs text-slate-500">{reason}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRemoveTarget(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm"
              >
                Giữ lại thành viên
              </button>
              <button
                onClick={confirmRemove}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white"
              >
                Xác nhận loại khỏi đoàn
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
