"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/axios";

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

import { useLeaderTripDetail, useLeaderTripMutations } from "../../hooks";

export function LeaderTripDetail({
  tripId,
}: {
  tripId: string;
}) {
  const { trip, isLoading: isLoadingTrip } = useLeaderTripDetail({ tripId });
  const { cancelTrip, isSubmitting } = useLeaderTripMutations();

  const [members, setMembers] =
    useState(initialMembers);
  const [slots, setSlots] = useState<{ capacity: number; remainingSlots: number } | null>(null);

  useEffect(() => {
    if (!tripId) return;
    apiClient
      .get<any>(`/api/v1/trips/${tripId}`)
      .then((res) => {
        if (res.data) {
          setSlots({
            capacity: Number(res.data.capacity) || 15,
            remainingSlots: Number(res.data.remainingSlots !== undefined ? res.data.remainingSlots : res.data.capacity),
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

  const [removeTarget, setRemoveTarget] =
    useState<Member | null>(null);

  const [reason, setReason] = useState(
    "Không đạt yêu cầu kiểm tra thể lực / y tế trước giờ xuất phát",
  );

  const [waiting, setWaiting] = useState<string[]>([]);

  const visibleMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return members.filter(
      (member) =>
        !keyword ||
        `${member.name} ${member.id} ${member.phone}`
          .toLowerCase()
          .includes(keyword),
    );
  }, [members, search]);

  function confirmRemove() {
    if (!removeTarget) {
      return;
    }

    setMembers((current) =>
      current.filter(
        (member) => member.id !== removeTarget.id,
      ),
    );

    setRemoveTarget(null);
  }

  const tripTitle = trip?.title || `Chuyến đi #${tripId}`;
  const startDateStr = trip?.startAt ? new Date(trip.startAt).toLocaleDateString("vi-VN") : "";
  const endDateStr = trip?.endAt ? new Date(trip.endAt).toLocaleDateString("vi-VN") : "";
  const statusLabel = trip?.status === "OPEN" ? "Đang mở bán" : trip?.status === "DRAFT" ? "Bản nháp" : trip?.status === "FULL" ? "Đã đủ chỗ" : trip?.status === "IN_PROGRESS" ? "Đang diễn ra" : trip?.status === "COMPLETED" ? "Đã hoàn thành" : trip?.status === "CANCELLED" ? "Đã hủy" : "Chuyến đi";

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs text-slate-500">
            Quản lý dẫn đoàn　›　Chuyến đi của tôi　›　#
            {tripId}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              ● {statusLabel}
            </span>

            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              Cấp {trip?.trails?.[0]?.snapshotDifficulty || "2"} · {trip?.trails?.[0]?.snapshotName || "Trekking Tour"}
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-bold">
            {tripTitle}
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            {startDateStr} {endDateStr ? `– ${endDateStr}` : ""} · Mã tour #{tripId}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/leader/trips/${tripId}/edit`}
            className="rounded-lg bg-[#e5edfb] px-4 py-2 text-sm font-semibold"
          >
            ✎ Chỉnh sửa chuyến đi
          </Link>

          <Link
            href={`/leader/trips/${tripId}/settlement`}
            className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800"
          >
            ▤ Quyết toán
          </Link>

          <button className="rounded-lg bg-[#125238] px-5 py-2 text-sm font-bold text-white">
            ▶ Bắt đầu hành trình
          </button>
        </div>
      </div>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl bg-white p-5">
          <p className="text-xs font-bold">
            THÀNH VIÊN ĐÃ DUYỆT
          </p>

          <strong className="mt-4 block text-4xl text-[#125238]">
            {bookedCount}
            <span className="text-base text-slate-400">
              {" "}
              / {totalCapacity}
            </span>
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

          <strong className="mt-4 block text-4xl text-amber-700">
            {waiting.length}
          </strong>

          <p className="mt-4 text-xs text-slate-500">
            Cần phản hồi trước 18:00 hôm nay
          </p>
        </article>

        <article className="rounded-xl bg-white p-5">
          <p className="text-xs font-bold">
            TIẾN ĐỘ THANH TOÁN
          </p>

          <strong className="mt-4 block text-4xl">
            87%
          </strong>

          <p className="mt-4 text-xs text-slate-500">
            12 người đã hoàn tất cọc
          </p>
        </article>

        <article className="rounded-xl bg-white p-5">
          <p className="text-xs font-bold">
            CHECK-IN THỰC ĐỊA
          </p>

          <strong className="mt-4 block text-4xl">
            {
              members.filter(
                (member) => member.checkedIn,
              ).length
            }
          </strong>

          <p className="mt-4 text-xs text-slate-500">
            Mở check-in trước 60 phút
          </p>
        </article>
      </section>

      {waiting.length > 0 && (
        <section className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">
                Yêu cầu tham gia đang chờ duyệt
              </h2>

              <p className="mt-1 text-xs text-slate-600">
                Kiểm tra kinh nghiệm, sức khỏe và trang bị
                trước khi xác nhận.
              </p>
            </div>

            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold">
              {waiting.length} yêu cầu
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {waiting.map((name) => (
              <article
                key={name}
                className="flex items-center gap-3 rounded-xl bg-white p-4"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#125238] text-xs font-bold text-white">
                  {name
                    .split(" ")
                    .slice(-2)
                    .map((word) => word[0])
                    .join("")}
                </span>

                <div className="flex-1">
                  <h3 className="font-bold">{name}</h3>

                  <p className="text-xs text-slate-500">
                    Đã nộp hồ sơ sức khỏe và liên hệ khẩn
                    cấp
                  </p>
                </div>

                <button
                  onClick={() =>
                    setWaiting((current) =>
                      current.filter(
                        (item) => item !== name,
                      ),
                    )
                  }
                  className="rounded-lg bg-[#125238] px-3 py-2 text-xs font-bold text-white"
                >
                  Duyệt
                </button>

                <button
                  onClick={() =>
                    setWaiting((current) =>
                      current.filter(
                        (item) => item !== name,
                      ),
                    )
                  }
                  className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
                >
                  Từ chối
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
          <div className="flex-1">
            <h2 className="text-lg font-bold">
              Danh sách Thành viên Chính thức
            </h2>

            <p className="text-xs text-slate-500">
              Thông tin y tế, liên hệ khẩn cấp, thiết bị
              thuê và trạng thái check-in.
            </p>
          </div>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="h-10 rounded-lg bg-[#edf2fc] px-4 text-sm outline-none"
            placeholder="Tìm tên, SĐT, mã Trekker..."
          />

          <button className="rounded-lg bg-[#e5edfb] px-4 py-2 text-xs font-semibold">
            Tất cả trạng thái
          </button>

          <button className="rounded-lg bg-[#125238] px-4 py-2 text-xs font-bold text-white">
            Gửi kiểm lâm & bảo hiểm
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="bg-[#e8eef9] text-[10px] uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-4">
                  Họ tên Trekker
                </th>

                <th className="px-4 py-4">Liên lạc</th>
                <th className="px-4 py-4">Khẩn cấp</th>
                <th className="px-4 py-4">Hồ sơ y tế</th>
                <th className="px-4 py-4">
                  Thiết bị thuê
                </th>
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
                        <p className="text-xs text-slate-500 leading-relaxed">
                          (Số lượng vé đã thanh toán được trừ trực tiếp vào số chỗ. Danh sách chi tiết cá nhân của từng trekker như Họ tên, SĐT, Người liên hệ khẩn cấp đang chờ API quản trị đoàn từ Backend để đồng bộ lên bảng này).
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">Chưa có thành viên nào tham gia chuyến đi này.</span>
                    )}
                  </td>
                </tr>
              ) : (
                visibleMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="text-xs hover:bg-slate-50"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800">
                          {member.name
                            .split(" ")
                            .slice(-2)
                            .map((word) => word[0])
                            .join("")}
                        </span>

                        <div>
                          <b className="block text-sm">
                            {member.name}
                          </b>

                          <span className="text-slate-500">
                            #{member.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      {member.phone}

                      <span className="block text-slate-500">
                        {member.email}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {member.emergency}
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded bg-amber-50 px-2 py-1 text-amber-800">
                        {member.health}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {member.equipment}
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
                        {member.payment}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <button
                        onClick={() =>
                          setMembers((current) =>
                            current.map((item) =>
                              item.id === member.id
                                ? {
                                    ...item,
                                    checkedIn:
                                      !item.checkedIn,
                                  }
                                : item,
                            ),
                          )
                        }
                        className={`rounded px-2 py-1 ${
                          member.checkedIn
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {member.checkedIn
                          ? "Đã check-in"
                          : "Chưa check-in"}
                      </button>
                    </td>

                    <td className="px-4 py-4">
                      <button
                        onClick={() =>
                          setRemoveTarget(member)
                        }
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

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl bg-white p-5">
          <h2 className="font-bold">
            Đội ngũ dẫn đường & Porter
          </h2>

          <div className="mt-4 space-y-3 text-sm">
            <p className="rounded-lg bg-[#edf2fc] p-3">
              <b>Nguyễn Hùng</b>
              <span className="float-right">
                Leader chính
              </span>
            </p>

            <p className="rounded-lg bg-[#edf2fc] p-3">
              <b>Sứa A Tả Xùa</b>
              <span className="float-right">Porter</span>
            </p>

            <p className="rounded-lg bg-[#edf2fc] p-3">
              <b>Mùa Vàng</b>
              <span className="float-right">Porter</span>
            </p>
          </div>
        </article>

        <article className="rounded-xl bg-white p-5">
          <h2 className="font-bold">
            Kế hoạch cứu hộ sơ bộ
          </h2>

          <div className="mt-4 space-y-3 text-xs">
            <p className="rounded-lg bg-[#edf2fc] p-3">
              <b>Trạm y tế Xã Tà Xùa</b>
              <span className="block text-slate-500">
                Cách điểm bắt đầu 4.2km
              </span>
            </p>

            <p className="rounded-lg bg-[#edf2fc] p-3">
              <b>Kênh bộ đàm đoàn: 04</b>
              <span className="block text-slate-500">
                446.050 MHz
              </span>
            </p>

            <p className="rounded-lg bg-[#edf2fc] p-3">
              <b>Túi sơ cấp cứu Leader</b>
              <span className="block text-slate-500">
                Đã kiểm kê và niêm phong
              </span>
            </p>
          </div>
        </article>

        <article className="rounded-xl bg-white p-5">
          <h2 className="font-bold">
            Dự báo khí tượng Tà Xùa
          </h2>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-4xl">☁</span>

            <div>
              <b className="text-xl">15°C – 19°C</b>

              <p className="text-xs text-slate-500">
                Sương mù dày vào sáng sớm
              </p>
            </div>

            <div>
              <b>8km/h</b>

              <p className="text-xs text-slate-500">
                Gió nhẹ
              </p>
            </div>
          </div>

          <p className="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Khuyến cáo thành viên mang áo chắn gió và bọc
            balo chống ẩm.
          </p>
        </article>
      </section>

      {removeTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-bold">
                  Hủy tư cách tham gia của Trekker
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Thành viên: {removeTarget.name} (#
                  {removeTarget.id})
                </p>
              </div>

              <button
                onClick={() => setRemoveTarget(null)}
                className="text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 p-5">
              <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                Việc loại thành viên sau khi đã xác nhận
                cọc sẽ kích hoạt chính sách bảo vệ người
                tham gia VFRS. Hệ thống sẽ tự động gửi
                thông báo chi tiết.
              </p>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-bold">
                  Lý do loại khỏi đoàn leo núi
                </legend>

                {[
                  "Không đạt yêu cầu kiểm tra thể lực / y tế trước giờ xuất phát",
                  "Vi phạm quy chế an toàn hoặc ứng xử của đoàn leo núi",
                  "Thành viên chủ động xin rút lui gấp vì việc cá nhân",
                  "Lý do bất khả kháng / Khác",
                ].map((item) => (
                  <label
                    key={item}
                    className="flex gap-3 rounded-lg bg-[#edf2fc] p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="reason"
                      checked={reason === item}
                      onChange={() => setReason(item)}
                    />

                    {item}
                  </label>
                ))}
              </fieldset>

              <label className="block text-sm font-bold">
                Giải trình chi tiết

                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg bg-[#edf2fc] p-3 font-normal outline-none"
                  placeholder="Nhập căn cứ đưa ra quyết định..."
                />
              </label>

              <div className="rounded-lg bg-[#edf2fc] p-3 text-sm">
                <b>Chính sách xử lý tiền cọc: </b>
                Hoàn 100% về Ví TrekGo theo quy định VFRS.
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
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
                Xác nhận loại khỏi đoàn & hoàn tiền
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}