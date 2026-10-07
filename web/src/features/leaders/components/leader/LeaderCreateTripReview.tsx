"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TripRouteReviewMap } from "./TripRouteReviewMap";
import {
  useLeaderTripDetail,
  useLeaderTripMutations,
  useLeaderTripReadiness,
} from "../../hooks";

type DraftData = {
  title?: string;
  name?: string;
  description?: string;
  visibility?: "public" | "private";
  cancellationPolicy?: "flexible" | "standard" | "strict";
  startDate?: string;
  endDate?: string;
  meetingTime?: string;
  pickupPointId?: string;
  pickupName?: string;
  destinationName?: string;
  price?: string;
  capacity?: number;
  difficulty?: number;
};

const standardChecklist = [
  "Thông tin cơ bản chuẩn chỉnh",
  "Thẩm định an toàn cung đường",
  "Tọa độ tập kết chính xác",
  "Đủ tối thiểu trạm kiểm soát hợp lệ",
  "Chứng chỉ WFA của Leader",
  "Tỷ lệ nhân sự an toàn đạt chuẩn",
];

const difficultyLabels: Record<number, string> = {
  1: "Cấp 1 – Rất nhẹ",
  2: "Cấp 2 – Nhẹ nhàng",
  3: "Cấp 3 – Vừa phải",
  4: "Cấp 4 – Thử thách",
  5: "Cấp 5 – Chuyên gia",
};

export function LeaderCreateTripReview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripIdFromParam = searchParams.get("tripId");

  const [tripId, setTripId] = useState<string | null>(null);

  useEffect(() => {
    if (tripIdFromParam) {
      setTripId(tripIdFromParam);
    } else if (typeof window !== "undefined") {
      const savedId = window.sessionStorage.getItem("leader-create-trip-id");
      if (savedId) setTripId(savedId);
    }
  }, [tripIdFromParam]);

  const { trip, isLoading: isLoadingTrip } = useLeaderTripDetail({ tripId });
  const { readiness, isLoading: isLoadingReadiness, refetch: refetchReadiness } =
    useLeaderTripReadiness({ tripId });
  const { publishTrip: apiPublishTrip, isSubmitting } = useLeaderTripMutations();

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [published, setPublished] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [draftData, setDraftData] = useState<DraftData>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedDraft = window.sessionStorage.getItem("leader-create-trip-draft");
      if (storedDraft) {
        try {
          setDraftData(JSON.parse(storedDraft));
        } catch (err) {
          console.error("Lỗi đọc draft:", err);
        }
      }
    }
  }, []);

  function handleSaveDraft() {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  const tripTitle = trip?.title || draftData.title || draftData.name || "Chuyến đi Trekking";
  const tripDescription =
    trip?.description ||
    draftData.description ||
    "Khám phá trọn vẹn hành trình trekking cùng Leader chuyên nghiệp theo chuẩn an toàn VFRS.";

  const startDateFormatted = trip?.startAt
    ? new Date(trip.startAt).toLocaleDateString("vi-VN")
    : draftData.startDate
    ? new Date(`${draftData.startDate}T00:00:00`).toLocaleDateString("vi-VN")
    : "Chưa xác định";

  const endDateFormatted = trip?.endAt
    ? new Date(trip.endAt).toLocaleDateString("vi-VN")
    : draftData.endDate
    ? new Date(`${draftData.endDate}T00:00:00`).toLocaleDateString("vi-VN")
    : "";

  const durationDays = useMemo(() => {
    const s = trip?.startAt || draftData.startDate;
    const e = trip?.endAt || draftData.endDate;
    if (s && e) {
      return Math.max(
        1,
        Math.round(
          (new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      );
    }
    return 1;
  }, [trip?.startAt, trip?.endAt, draftData.startDate, draftData.endDate]);

  const priceNum = Number(trip?.price || draftData.price || "2850000") || 0;
  const priceFormatted = priceNum.toLocaleString("vi-VN");
  const capacityNum = trip?.capacity || draftData.capacity || 15;
  const totalRevenue = (priceNum * capacityNum).toLocaleString("vi-VN");

  const plannedTrail = trip?.trails?.[0];
  const trailCode = plannedTrail?.systemTrailId || "TRAIL_BADEN_COTDIEN";
  const trailName = plannedTrail?.snapshotName || "Núi Bà Đen - Cung Đường Cột Điện";

  async function handleConfirmPublish() {
    if (!tripId || !trip) return;
    setErrorMsg("");

    try {
      await apiPublishTrip(tripId, { expectedVersion: trip.version });
      setPublished(true);
      setShowPublishModal(false);

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("leader-create-trip-id");
        window.sessionStorage.removeItem("leader-create-trip-draft");
        window.sessionStorage.removeItem("leader-create-trip-route");
      }

      setTimeout(() => {
        router.push("/leader/trips");
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chưa đủ điều kiện xuất bản.";
      setErrorMsg(msg);
      setShowPublishModal(false);
    }
  }

  const canPublishTrip = readiness?.canPublish ?? false;

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-[#125238]">
                  BƯỚC 3/3
                </span>

                <span className="text-slate-500">
                  • Hồ sơ xác thực VFRS cấp Leader
                </span>
              </div>

              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                Xem lại hồ sơ &amp; Công khai chuyến đi
              </h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="h-11 rounded-xl bg-[#eef3fb] px-4 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                ▣ Lưu bản nháp
              </button>
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong className="font-bold">Lỗi xuất bản: </strong>
            {errorMsg}
          </div>
        )}

        <section className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => router.push("/leader/create-trip")}
            className="rounded-xl bg-emerald-50 p-4 text-left text-[#125238]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#125238] font-bold text-white">
                ✓
              </span>

              <div>
                <p className="text-[10px] font-bold uppercase">Bước 1</p>
                <strong className="text-sm">Thông tin cơ bản &amp; Lịch trình</strong>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                tripId ? `/leader/create-trip/route?tripId=${tripId}` : "/leader/create-trip/route"
              )
            }
            className="rounded-xl bg-emerald-50 p-4 text-left text-[#125238]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#125238] font-bold text-white">
                ✓
              </span>

              <div>
                <p className="text-[10px] font-bold uppercase">Bước 2</p>
                <strong className="text-sm">Cung đường &amp; Trạm dừng</strong>
              </div>
            </div>
          </button>

          <div className="rounded-xl bg-[#eef3fb] p-4 text-[#125238]">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2f6b4f] font-bold text-white">
                3
              </span>

              <div>
                <p className="text-[10px] font-bold uppercase">
                  Bước 3 hiện tại
                </p>
                <strong className="text-sm">Xem lại &amp; Công khai</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#125238]">
                    Mục 01 · Thông tin đoàn
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    Chi tiết chuyến đi &amp; Quy mô
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/leader/create-trip")}
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-[#125238] hover:bg-emerald-100"
                >
                  ✎ Chỉnh sửa Bước 1
                </button>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-[210px_minmax(0,1fr)]">
                <div>
                  <div
                    className="relative h-44 rounded-xl bg-cover bg-center"
                    style={{
                      backgroundImage: `linear-gradient(to top, rgba(0,0,0,.65), transparent), url("https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=700&q=80")`,
                    }}
                  >
                    <span className="absolute left-3 top-3 rounded bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-800">
                      {difficultyLabels[draftData.difficulty || 3] || "Cấp 3 – Vừa phải"}
                    </span>

                    <span className="absolute bottom-3 left-3 rounded bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">
                      #{trip?.id ? trip.id.slice(0, 8) : "DRAFT"}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>
                      {draftData.visibility === "private"
                        ? "Chuyến đi Riêng tư"
                        : "Công khai VFRS"}
                    </span>
                    <strong className="text-[#125238]">✓ Đạt chuẩn</strong>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-950">
                    {tripTitle}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {tripDescription}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-[#eef3fb] p-4">
                      <span className="text-xs text-slate-500">
                        Thời gian thực hiện
                      </span>

                      <strong className="mt-1 block text-sm">
                        {startDateFormatted}
                        {endDateFormatted && ` – ${endDateFormatted}`}
                      </strong>

                      <span className="text-xs text-slate-500">
                        {durationDays} ngày
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#eef3fb] p-4">
                      <span className="text-xs text-slate-500">
                        Quy mô đoàn
                      </span>

                      <strong className="mt-1 block text-sm">
                        Tối đa {capacityNum} người
                      </strong>

                      <span className="text-xs text-orange-700">
                        Slot: 0/{capacityNum}
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#eef3fb] p-4">
                      <span className="text-xs text-slate-500">
                        Chính sách hủy
                      </span>

                      <strong className="mt-1 block text-sm">
                        {draftData.cancellationPolicy === "strict"
                          ? "Nghiêm ngặt"
                          : draftData.cancellationPolicy === "standard"
                          ? "Tiêu chuẩn"
                          : "Linh hoạt"}
                      </strong>

                      <span className="text-xs text-slate-500">
                        {draftData.cancellationPolicy === "strict"
                          ? "Hoàn trả trước 15 ngày"
                          : draftData.cancellationPolicy === "standard"
                          ? "Hoàn trả trước 14 ngày"
                          : "Hoàn trả trước 7 ngày"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-[#eef3fb] p-4 text-xs leading-5 text-slate-600">
                    <strong className="text-slate-900">⌖ Điểm tập kết:</strong>{" "}
                    {draftData.meetingTime || "07:00"} tại{" "}
                    {draftData.pickupName || "Điểm đón đã xác thực"}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#125238]">
                    Mục 02 · Bản đồ &amp; Trắc địa
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    Cung đường &amp; Lộ trình chi tiết
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      tripId
                        ? `/leader/create-trip/route?tripId=${tripId}`
                        : "/leader/create-trip/route"
                    )
                  }
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-[#125238] hover:bg-emerald-100"
                >
                  ✎ Chỉnh sửa Bước 2
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4">
                <div>
                  <strong className="text-sm text-slate-950">
                    ⌁ Cung đường: {trailName}
                  </strong>

                  <p className="mt-1 text-xs text-slate-500">
                    Mã quản lý: #{trailCode.slice(0, 8)} • Cự ly: {plannedTrail?.snapshotDistanceKm || "4.5"} km
                  </p>
                </div>

                <span className="rounded-full bg-[#125238] px-3 py-1.5 text-xs font-bold text-white">
                  ◉ VFRS Verified
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ["Tổng cự ly", `${plannedTrail?.snapshotDistanceKm || "4.5"} km`],
                  ["Độ khó", plannedTrail?.snapshotDifficulty || "Cấp 2"],
                  ["Cao độ đỉnh", plannedTrail?.snapshotElevationGainM ? `+${plannedTrail.snapshotElevationGainM}m` : "986m"],
                  ["Dự kiến leo", "~5 giờ"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[#eef3fb] p-4">
                    <span className="text-xs text-slate-500">{label}</span>
                    <strong className="mt-2 block text-lg text-slate-950">
                      {value}
                    </strong>
                  </div>
                ))}
              </div>

              <TripRouteReviewMap trailCode={trailCode} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#125238]">
                    Mục 03 · An toàn &amp; Giám sát
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    {trip?.checkpoints?.length || 0} Trạm kiểm soát an toàn
                  </h2>
                </div>

                <span className="rounded-full bg-[#125238] px-3 py-1 text-xs font-bold text-white">
                  {trip?.checkpoints?.length || 0} Đã thiết lập
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {trip?.checkpoints && trip.checkpoints.length > 0 ? (
                  trip.checkpoints.map((cp, idx) => (
                    <article
                      key={cp.sourceCheckpointId || idx}
                      className="flex items-center gap-3 rounded-xl border border-blue-100 bg-[#eef3fb] p-4"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#125238] font-bold text-white">
                        {cp.sequence || idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-slate-950">
                            {cp.name}
                          </strong>

                          {cp.isRequired && (
                            <span className="rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">
                              Bắt buộc
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {cp.description || `Mốc GPS (${Number(cp.latitude).toFixed(3)}, ${Number(cp.longitude).toFixed(3)})`}
                        </p>
                      </div>

                      <span className="text-[#125238]">✓</span>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Chưa có checkpoint nào được cấu hình cho chuyến đi này.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#125238]">
                    Mục 04 · Tài chính đoàn
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    Cơ cấu Giá vé &amp; Dự toán Doanh thu
                  </h2>
                </div>

                <span className="text-xs text-slate-500">Đơn vị: VNĐ</span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-[#eef3fb] p-5">
                  <span className="text-xs text-slate-500">
                    Giá vé niêm yết/khách
                  </span>

                  <strong className="mt-2 block text-2xl text-[#125238]">
                    {priceFormatted}₫
                  </strong>

                  <span className="mt-1 block text-xs text-slate-500">
                    Bao gồm trọn gói dịch vụ
                  </span>
                </div>

                <div className="rounded-xl bg-[#eef3fb] p-5">
                  <span className="text-xs text-slate-500">
                    Dự toán doanh thu ({capacityNum} vé)
                  </span>

                  <strong className="mt-2 block text-2xl text-slate-950">
                    {totalRevenue}₫
                  </strong>

                  <span className="mt-1 block text-xs text-orange-700">
                    Tạm giữ tại VFRS Escrow
                  </span>
                </div>

                <div className="rounded-xl bg-[#125238] p-5 text-white">
                  <span className="text-xs text-emerald-100">
                    Phụ cấp Leader dự kiến
                  </span>

                  <strong className="mt-2 block text-2xl">
                    ~{(priceNum * capacityNum * 0.35).toLocaleString("vi-VN")}₫
                  </strong>

                  <span className="mt-1 block text-xs text-emerald-100">
                    Giải ngân sau khi kết thúc chuyến
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-xl bg-[#eef3fb] p-4 text-xs sm:grid-cols-2">
                <span>✓ Bảo hiểm cứu hộ dã ngoại 600 triệu/người</span>
                <span>✓ Phương tiện di chuyển điểm đón ↔ điểm bắt đầu</span>
                <span>✓ Toàn bộ bữa ăn chính và hỗ trợ tiếp tế</span>
                <span>✓ Phí quản lý rừng và sinh môi trường</span>
              </div>
            </section>
          </div>

          <aside className="sticky top-20 hidden space-y-5 xl:block">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-[#125238]">
                  ✓
                </span>

                <div>
                  <h2 className="font-bold text-slate-950">
                    Điều kiện xuất bản
                  </h2>

                  <p className="text-xs text-slate-500">
                    Pre-publish Readiness Check
                  </p>
                </div>
              </div>

              <div
                className={`mt-5 flex items-center gap-4 rounded-xl p-4 ${
                  canPublishTrip ? "bg-emerald-50" : "bg-orange-50"
                }`}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-4 text-sm font-bold ${
                    canPublishTrip
                      ? "border-[#125238] text-[#125238]"
                      : "border-orange-500 text-orange-700"
                  }`}
                >
                  {canPublishTrip ? "100%" : "Cần bổ sung"}
                </div>

                <div>
                  <strong className="text-sm text-slate-950">
                    {canPublishTrip
                      ? "Hồ sơ hoàn tất xuất sắc"
                      : "Chưa đạt điều kiện xuất bản"}
                  </strong>

                  <p className="mt-1 text-xs text-slate-500">
                    {canPublishTrip
                      ? "Đạt toàn bộ tiêu chuẩn an toàn VFRS."
                      : "Vui lòng xem lại danh sách kiểm tra bên dưới."}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {readiness?.issues && readiness.issues.length > 0 ? (
                  readiness.issues.map((issue, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-red-600">
                      <span>✕</span>
                      <span>{issue.message}</span>
                    </div>
                  ))
                ) : (
                  standardChecklist.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm">
                      <span className="text-[#125238]">✓</span>
                      <span className="text-slate-700">{item}</span>
                    </div>
                  ))
                )}
              </div>

              <div
                className={`mt-5 rounded-xl p-4 text-center text-sm font-bold ${
                  canPublishTrip
                    ? "bg-emerald-100 text-[#125238]"
                    : "bg-orange-100 text-orange-800"
                }`}
              >
                {canPublishTrip
                  ? "✓ Đủ điều kiện kích hoạt mở bán tự động"
                  : "⚠ Cần hoàn thiện cung đường & trạm dừng"}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <button
                type="button"
                disabled={published || isSubmitting || !canPublishTrip}
                onClick={() => setShowPublishModal(true)}
                className="h-12 w-full rounded-xl bg-[#125238] px-5 text-sm font-bold text-white shadow-md hover:bg-[#2f6b4f] disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {published
                  ? "✓ Chuyến đi đã công khai"
                  : isSubmitting
                  ? "Đang xuất bản..."
                  : "Công khai chuyến đi ngay"}
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                className="mt-3 h-11 w-full rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                ▣ Lưu bản nháp để duyệt sau
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    tripId
                      ? `/leader/create-trip/route?tripId=${tripId}`
                      : "/leader/create-trip/route"
                  )
                }
                className="mt-3 h-11 w-full text-sm font-semibold text-slate-500 hover:text-[#125238]"
              >
                ← Quay lại Bước 2
              </button>
            </section>
          </aside>
        </div>

        <footer className="mt-6 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center xl:hidden">
          <button
            type="button"
            onClick={() =>
              router.push(
                tripId
                  ? `/leader/create-trip/route?tripId=${tripId}`
                  : "/leader/create-trip/route"
              )
            }
            className="h-11 rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            ← Quay lại Bước 2
          </button>

          <button
            type="button"
            disabled={published || isSubmitting || !canPublishTrip}
            onClick={() => setShowPublishModal(true)}
            className="h-11 rounded-xl bg-[#125238] px-6 text-sm font-bold text-white disabled:bg-slate-400"
          >
            {published ? "✓ Đã công khai" : "Công khai chuyến đi"}
          </button>
        </footer>
      </div>

      {saved && (
        <div className="fixed bottom-6 right-6 z-[80] rounded-xl bg-[#125238] px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          ✓ Đã lưu bản nháp chuyến đi.
        </div>
      )}

      {published && (
        <div className="fixed bottom-6 right-6 z-[80] max-w-sm rounded-xl bg-[#125238] px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          ✓ Công khai chuyến đi thành công! Đang chuyển hướng về trang danh sách...
        </div>
      )}

      {showPublishModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-5 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mt-4 text-xl font-bold text-slate-950">
              Công khai chuyến đi ngay?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sau khi công khai, chuyến đi sẽ xuất hiện trên trang khám phá và
              Trekker có thể bắt đầu đăng ký tham gia.
            </p>

            <div className="mt-5 rounded-xl bg-emerald-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tên chuyến</span>
                <strong className="text-slate-900">{tripTitle}</strong>
              </div>

              <div className="mt-3 flex justify-between text-sm">
                <span className="text-slate-500">Trạng thái sau xuất bản</span>
                <strong className="text-[#125238]">Đang mở bán (OPEN)</strong>
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-600">
              <input
                type="checkbox"
                defaultChecked
                className="mt-1 h-4 w-4 accent-[#125238]"
              />
              Tôi xác nhận thông tin, cung đường và điều kiện an toàn của
              chuyến đi là chính xác.
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                Kiểm tra lại
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmPublish}
                className="h-11 rounded-xl bg-[#125238] px-5 text-sm font-bold text-white hover:bg-[#2f6b4f] disabled:bg-slate-400"
              >
                {isSubmitting ? "Đang xuất bản..." : "Xác nhận công khai"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}