"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-[#f6f8fc] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#2f6b4f]/15";

import {
  useLeaderTripDetail,
  useLeaderTripMutations,
  useLeaderTripOptions,
} from "../../hooks";
import type { LeaderTripView } from "../../types";

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function nextMeetingTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 60);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="mb-2 block text-sm font-semibold text-slate-800">
      {children}
      {required && <span className="ml-1 text-red-600">*</span>}
    </span>
  );
}

function FormCard({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 font-bold text-[#125238]">
          {number}
        </div>

        <div>
          <h2 className="font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

export function LeaderCreateTripStepOne() {
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

  const { trip, isLoading: isLoadingTrip } = useLeaderTripDetail({
    tripId: tripId || undefined,
  });

  const { destinations, fetchPickups } = useLeaderTripOptions();
  const {
    createDraft,
    updateTrip,
    setCheckpoints,
    setTrails,
    isSubmitting,
  } = useLeaderTripMutations();

  const [destinationId, setDestinationId] = useState<string>("");
  const [apiPickups, setApiPickups] = useState<Array<{ id: string; name: string }>>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState("");

  const [capacity, setCapacity] = useState(15);
  const [price, setPrice] = useState("2850000");
  const [priceExplanation, setPriceExplanation] = useState("");
  const [startDate, setStartDate] = useState(() => dateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dateInputValue(tomorrow);
  });
  const [meetingTime, setMeetingTime] = useState(nextMeetingTime);
  const [pickupPointId, setPickupPointId] = useState<string>("");
  const [dateError, setDateError] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Khôi phục dữ liệu: ưu tiên dữ liệu thực tế từ chuyến đi đã tạo (nếu quay lại Bước 1)
  useEffect(() => {
    if (trip) {
      if (trip.title) setTitle(trip.title);
      if (trip.description) setDescription(trip.description);
      if (trip.capacity) setCapacity(Number(trip.capacity));
      if (trip.price) {
        const num = parseInt(trip.price.replace(/\D/g, ""), 10);
        if (!isNaN(num)) setPrice(String(num));
      }
      if (trip.priceExplanation) setPriceExplanation(trip.priceExplanation);
      if (trip.destinationId) {
        setDestinationId(trip.destinationId);
        fetchPickups(trip.destinationId).then((pickups) => {
          setApiPickups(pickups);
          if (trip.pickupPointId) {
            setPickupPointId(trip.pickupPointId);
          } else if (pickups.length > 0) {
            setPickupPointId(pickups[0].id);
          }
        });
      }
      if (trip.startAt) {
        const startObj = new Date(trip.startAt);
        if (!isNaN(startObj.getTime())) {
          setStartDate(dateInputValue(startObj));
          const hh = String(startObj.getHours()).padStart(2, "0");
          const mm = String(startObj.getMinutes()).padStart(2, "0");
          setMeetingTime(`${hh}:${mm}`);
        }
      }
      if (trip.endAt) {
        const endObj = new Date(trip.endAt);
        if (!isNaN(endObj.getTime())) {
          setEndDate(dateInputValue(endObj));
        }
      }
    } else {
      // Khôi phục bản nháp local nếu chưa có chuyến trên server
      const savedDraft = window.sessionStorage.getItem("leader-create-trip-draft");
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.id && !tripId) setTripId(draft.id);
          if (draft.title) setTitle(draft.title);
          if (draft.name && !draft.title) setTitle(draft.name);
          if (draft.description) setDescription(draft.description);
          if (draft.capacity) setCapacity(Number(draft.capacity));
          if (draft.price) setPrice(String(draft.price));
          if (draft.priceExplanation) setPriceExplanation(String(draft.priceExplanation));
          if (draft.startDate) setStartDate(draft.startDate);
          if (draft.endDate) setEndDate(draft.endDate);
          if (draft.meetingTime) setMeetingTime(draft.meetingTime);
          if (draft.destinationId) {
            setDestinationId(draft.destinationId);
            fetchPickups(draft.destinationId).then((pickups) => {
              setApiPickups(pickups);
              if (draft.pickupPointId) {
                setPickupPointId(draft.pickupPointId);
              } else if (pickups.length > 0) {
                setPickupPointId(pickups[0].id);
              }
            });
          }
        } catch (err) {
          console.error("Lỗi đọc draft:", err);
        }
      }
    }
  }, [trip, fetchPickups]);

  const selectedPickupName =
    apiPickups.find((point) => point.id === pickupPointId)?.name ??
    (destinationId ? "Điểm tập kết tại điểm đến" : "Chưa chọn điểm đón");

  const daysCount = Math.max(
    1,
    Math.round(
      (new Date(endDate + "T00:00:00").getTime() -
        new Date(startDate + "T00:00:00").getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1,
  );
  const nightsCount = Math.max(0, daysCount - 1);
  const durationText =
    nightsCount > 0 ? `${daysCount} ngày ${nightsCount} đêm` : `${daysCount} ngày`;

  function handleStartNewTrip() {
    window.sessionStorage.removeItem("leader-create-trip-id");
    window.sessionStorage.removeItem("leader-create-trip-draft");
    window.sessionStorage.removeItem("leader-create-trip-route");
    setTripId(null);
    setTitle("");
    setDescription("");
    setPriceExplanation("");
    setDestinationId("");
    setPickupPointId("");
    setApiPickups([]);
    setSubmitError("");
    router.replace("/leader/create-trip");
  }

  async function handleContinue() {
    if (!title.trim()) {
      setTitleError("Vui lòng nhập tiêu đề chuyến đi trước khi tiếp tục.");
      return;
    }
    if (!destinationId) {
      setDateError("Vui lòng chọn Điểm đến của chuyến đi.");
      return;
    }
    if (!pickupPointId) {
      setDateError("Vui lòng chọn Địa điểm tập kết đón đoàn.");
      return;
    }
    const today = dateInputValue(new Date());
    if (startDate < today) {
      setDateError("Ngày khởi hành không được là ngày trong quá khứ.");
      return;
    }
    if (endDate < startDate) {
      setDateError("Ngày kết thúc phải từ ngày khởi hành trở đi.");
      return;
    }
    if (startDate === today) {
      const now = new Date();
      const [hours, minutes] = meetingTime.split(":").map(Number);
      const meeting = new Date();
      meeting.setHours(hours, minutes, 0, 0);
      if (meeting <= now) {
        setDateError("Giờ tập trung hôm nay phải lớn hơn thời gian hiện tại.");
        return;
      }
    }
    setDateError("");
    setTitleError("");
    setSubmitError("");

    try {
      const startAt = new Date(`${startDate}T${meetingTime}:00`).toISOString();
      const endAt = new Date(`${endDate}T23:59:59`).toISOString();
      const cleanPrice = String(price).replace(/\D/g, "") || "1000000";
      const cleanPriceExplanation = priceExplanation.trim() || null;

      let savedTrip: LeaderTripView;

      if (tripId) {
        let currentVersion = trip?.version || 1;

        // Nếu người dùng đổi Destination thì cần xóa checkpoints/trails cũ trước (quy tắc backend)
        if (trip && trip.destinationId && destinationId !== trip.destinationId) {
          if (trip.checkpoints && trip.checkpoints.length > 0) {
            const cpRes = await setCheckpoints(tripId, {
              expectedVersion: currentVersion,
              checkpointIds: [],
            });
            currentVersion = cpRes.version;
          }
          if (trip.trails && trip.trails.length > 0) {
            const trailRes = await setTrails(tripId, {
              expectedVersion: currentVersion,
              trailIds: [],
            });
            currentVersion = trailRes.version;
          }
        }

        // Cập nhật lại bản nháp hiện có, tránh tạo chuyến mới gây trùng lịch
        savedTrip = await updateTrip(tripId, {
          expectedVersion: currentVersion,
          destinationId,
          pickupPointId,
          title: title.trim(),
          description: description.trim() || null,
          priceExplanation: cleanPriceExplanation,
          startAt,
          endAt,
          capacity: Number(capacity),
          price: cleanPrice,
        });
      } else {
        // Tạo chuyến đi nháp mới lần đầu
        savedTrip = await createDraft({
          destinationId,
          pickupPointId,
          title: title.trim(),
          description: description.trim() || null,
          priceExplanation: cleanPriceExplanation,
          startAt,
          endAt,
          capacity: Number(capacity),
          price: cleanPrice,
        });
      }

      window.sessionStorage.setItem("leader-create-trip-id", savedTrip.id);
      window.sessionStorage.setItem(
        "leader-create-trip-draft",
        JSON.stringify({
          id: savedTrip.id,
          version: savedTrip.version,
          destinationId,
          destinationName: destinations.find((d) => d.id === destinationId)?.name,
          pickupPointId,
          pickupName: selectedPickupName,
          title: savedTrip.title,
          name: savedTrip.title,
          description: savedTrip.description,
          priceExplanation: savedTrip.priceExplanation ?? cleanPriceExplanation,
          visibility: "public",
          startDate,
          endDate,
          meetingTime,
          price: cleanPrice,
          capacity: savedTrip.capacity,
        })
      );

      router.push(`/leader/create-trip/route?tripId=${savedTrip.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã có lỗi xảy ra khi lưu thông tin chuyến đi.";
      setSubmitError(msg);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Quản lý dẫn đoàn
              <span className="mx-2">›</span>
              Tạo chuyến đi mới
              <span className="mx-2">›</span>
              <strong className="text-[#125238]">
                Bước 1: Thông tin cơ bản
              </strong>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tripId ? (
                <>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                    Đang chỉnh sửa bản nháp
                  </span>
                  <button
                    type="button"
                    onClick={handleStartNewTrip}
                    className="text-xs font-medium text-slate-500 hover:text-red-600 underline transition"
                  >
                    Tạo chuyến mới
                  </button>
                </>
              ) : (
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
                  HÀNH TRÌNH MỚI
                </span>
              )}

              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#125238]">
                ● Chuẩn VFRS
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              {tripId && (
                <p className="text-xs text-slate-500">
                  Mã bản nháp: #{tripId.slice(0, 8)}
                </p>
              )}

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                {tripId ? "Chỉnh Sửa Thông Tin Chuyến Đi" : "Tạo Chuyến Đi Mới"}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Thiết lập hành trình trekking an toàn, đạt chuẩn thẩm định của
                VFRS.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-[#2f6b4f]/10 p-4 text-[#125238]">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#125238] font-bold text-white">
                  1
                </span>

                <div>
                  <p className="text-[10px] font-bold uppercase">
                    Bước 1 đang nhập
                  </p>
                  <strong className="text-sm">Thông tin cơ bản</strong>
                </div>
              </div>
            </div>

            {tripId ? (
              <button
                type="button"
                onClick={() =>
                  router.push(`/leader/create-trip/route?tripId=${tripId}`)
                }
                className="rounded-xl bg-[#eef3fb] p-4 text-slate-700 text-left hover:bg-slate-200 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f6b4f] font-bold text-white">
                    2
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#125238]">
                      Bước 2
                    </p>
                    <strong className="text-sm">Cung đường &amp; Trạm dừng</strong>
                  </div>
                  <span className="ml-auto text-xs text-emerald-700">→</span>
                </div>
              </button>
            ) : (
              <div className="rounded-xl bg-[#eef3fb] p-4 text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 font-bold">
                    2
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase">Bước 2</p>
                    <strong className="text-sm">Cung đường &amp; Trạm dừng</strong>
                  </div>
                  <span className="ml-auto">▣</span>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-[#eef3fb] p-4 text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 font-bold">
                  3
                </span>

                <div>
                  <p className="text-[10px] font-bold uppercase">Bước 3</p>
                  <strong className="text-sm">Xem lại &amp; Công khai</strong>
                </div>

                <span className="ml-auto">▣</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <FormCard
              number={1}
              title="Thông tin cơ bản & Hồ sơ đoàn"
              description="Các thông tin bắt buộc để định danh chuyến đi."
            >
              <div className="space-y-4">
                <label className="block">
                  <FieldLabel required>Tiêu đề chuyến đi</FieldLabel>

                  <input
                    className={inputClass}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (titleError) setTitleError("");
                    }}
                    placeholder="Ví dụ: Trekking Chinh Phục Đỉnh Núi Dinh Mùa Thu 2026..."
                  />

                  {titleError && (
                    <p className="mt-1 text-xs text-red-600">{titleError}</p>
                  )}
                </label>
              </div>
            </FormCard>

            <FormCard
              number={2}
              title="Thời gian &amp; Điểm tập kết đoàn"
              description="Lịch xuất phát chính xác và tọa độ trạm hội quân."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <FieldLabel required>Ngày bắt đầu khởi hành</FieldLabel>

                  <input
                    type="date"
                    className={inputClass}
                    value={startDate}
                    min={dateInputValue(new Date())}
                    onChange={(event) => {
                      const nextStartDate = event.target.value;
                      setStartDate(nextStartDate);
                      const today = dateInputValue(new Date());
                      if (nextStartDate && nextStartDate < today) {
                        setDateError(
                          "Ngày khởi hành không được là ngày trong quá khứ.",
                        );
                      } else {
                        setDateError("");
                        if (nextStartDate && endDate < nextStartDate) {
                          setEndDate(nextStartDate);
                        }
                      }
                    }}
                  />
                </label>

                <label>
                  <FieldLabel required>Ngày hoàn thành kết thúc</FieldLabel>

                  <input
                    type="date"
                    className={inputClass}
                    value={endDate}
                    min={startDate}
                    onChange={(event) => {
                      const nextEndDate = event.target.value;
                      setEndDate(nextEndDate);
                      if (nextEndDate && nextEndDate < startDate) {
                        setDateError(
                          "Ngày kết thúc phải từ ngày khởi hành trở đi.",
                        );
                      } else {
                        setDateError("");
                      }
                    }}
                  />
                </label>
                {dateError && (
                  <p className="text-sm text-red-600 md:col-span-2" role="alert">
                    {dateError}
                  </p>
                )}

                <div className="rounded-xl bg-emerald-50 p-3 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600">
                      ◷ Tổng thời lượng:
                      <strong className="ml-1 text-slate-900">
                        {durationText}
                      </strong>
                    </span>

                    <span className="rounded bg-emerald-100 px-2 py-1 font-bold text-[#125238]">
                      Lịch trình chuẩn
                    </span>
                  </div>
                </div>

                <label className="md:col-span-2">
                  <FieldLabel required>Điểm đến (Destination)</FieldLabel>

                  <select
                    className={inputClass}
                    value={destinationId}
                    onChange={async (event) => {
                      const dId = event.target.value;
                      setDestinationId(dId);
                      if (dId) {
                        try {
                          setApiPickups([]);
                          setPickupPointId("");
                          const pickups = await fetchPickups(dId);
                          setApiPickups(pickups);
                          if (pickups.length > 0) {
                            setPickupPointId(pickups[0].id);
                          }
                        } catch {
                          // Handle error
                        }
                      } else {
                        setApiPickups([]);
                        setPickupPointId("");
                      }
                    }}
                  >
                    <option value="">-- Chọn điểm đến --</option>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <FieldLabel required>Giờ tập trung</FieldLabel>

                  <input
                    type="time"
                    className={inputClass}
                    value={meetingTime}
                    onChange={(event) => {
                      setMeetingTime(event.target.value);
                      setDateError("");
                    }}
                  />
                </label>

                <label>
                  <FieldLabel required>Địa điểm tập kết đón đoàn</FieldLabel>

                  <select
                    className={inputClass}
                    value={pickupPointId}
                    onChange={(event) => setPickupPointId(event.target.value)}
                    disabled={!destinationId || apiPickups.length === 0}
                  >
                    {!destinationId ? (
                      <option value="">Vui lòng chọn Điểm đến trước</option>
                    ) : apiPickups.length === 0 ? (
                      <option value="">Đang tải điểm đón...</option>
                    ) : (
                      apiPickups.map((point) => (
                        <option key={point.id} value={point.id}>
                          {point.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <div className="md:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                  <span className="flex items-center gap-2">
                    <span className="text-base">📝</span>
                    <span>
                      <strong>Mô tả chi tiết &amp; Lịch trình chuyến đi:</strong> Sẽ được tự động tạo và tinh chỉnh ở <strong>Bước 3 (Xem lại &amp; Công khai)</strong> sau khi bạn hoàn tất chọn Cung đường và Checkpoints ở Bước 2.
                    </span>
                  </span>
                </div>
              </div>
            </FormCard>

            <FormCard
              number={3}
              title="Quy mô đoàn, Giá vé &amp; Cấp độ thử thách"
              description="Thiết lập chi phí minh bạch và độ khó chuẩn hóa."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <FieldLabel required>Số thành viên tối đa</FieldLabel>

                  <div className="flex h-12 overflow-hidden rounded-xl border border-slate-200 bg-[#f6f8fc]">
                    <button
                      type="button"
                      onClick={() =>
                        setCapacity((current) => Math.max(1, current - 1))
                      }
                      className="w-12 font-bold text-slate-600 hover:bg-slate-200"
                    >
                      -
                    </button>

                    <div className="flex flex-1 items-center justify-center font-bold text-slate-900">
                      {capacity} thành viên
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setCapacity((current) => Math.min(30, current + 1))
                      }
                      className="w-12 font-bold text-slate-600 hover:bg-slate-200"
                    >
                      +
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-orange-700">
                    Hạn ngạch Leader hiện tại tối đa 15 người.
                  </p>
                </div>

                <label>
                  <FieldLabel required>Giá tour trọn gói/người</FieldLabel>

                  <div className="relative">
                    <input
                      className={`${inputClass} pr-16`}
                      value={Number(price || 0).toLocaleString("vi-VN")}
                      onChange={(event) =>
                        setPrice(event.target.value.replace(/\D/g, ""))
                      }
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      VNĐ
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Đã gồm bảo hiểm VFRS 600 triệu/người.
                  </p>
                </label>

                <label className="md:col-span-2 block">
                  <FieldLabel required>
                    Cơ sở tính giá &amp; Giải trình chi phí (Nội bộ)
                  </FieldLabel>

                  <textarea
                    rows={4}
                    maxLength={5000}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-[#f6f8fc] p-4 text-sm leading-6 text-slate-950 outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#2f6b4f]/15"
                    value={priceExplanation}
                    onChange={(event) => setPriceExplanation(event.target.value)}
                    placeholder="Nhập cơ sở tính giá nội bộ: chi phí chung (xe, porter, lều trại), chi phí/người (ăn uống, vé rừng, bảo hiểm), số khách dự toán, dự phòng và lợi nhuận..."
                  />

                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      Có thể tạm để trống khi lưu nháp, nhưng{" "}
                      <strong className="text-slate-700">
                        bắt buộc phải nhập trước khi công khai (Publish)
                      </strong>
                      . Không hiển thị công khai cho khách.
                    </span>
                    <span className="text-slate-400">
                      {priceExplanation.length}/5000 ký tự
                    </span>
                  </div>
                </label>
              </div>
            </FormCard>

            {submitError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <strong className="font-bold">
                  {tripId ? "Lỗi cập nhật chuyến: " : "Lỗi tạo chuyến: "}
                </strong>
                {submitError}
              </div>
            )}

            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
              <Link
                href="/leader/trips"
                onClick={() => {
                  window.sessionStorage.removeItem("leader-create-trip-id");
                  window.sessionStorage.removeItem("leader-create-trip-draft");
                  window.sessionStorage.removeItem("leader-create-trip-route");
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                Hủy bỏ
              </Link>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleContinue}
                  className="h-11 rounded-xl bg-[#125238] px-6 text-sm font-bold text-white shadow-sm hover:bg-[#2f6b4f] disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSubmitting
                    ? "Đang xử lý..."
                    : tripId
                    ? "Cập nhật & Tiếp tục: Chọn cung đường →"
                    : "Tiếp tục: Chọn cung đường →"}
                </button>
              </div>
            </div>
          </div>

          <aside className="sticky top-20 hidden space-y-5 xl:block">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-950">
                Quy tắc an toàn VFRS cho Leader
              </h2>

              <ul className="mt-4 space-y-3 text-xs leading-5 text-slate-600">
                <li>✓ Tỷ lệ kiểm soát đoàn tối đa 15 người.</li>
                <li>✓ Bắt buộc Leader chịu trách nhiệm kiểm tra GPS.</li>
                <li>✓ Kiểm tra thiết bị cá nhân trước khi khởi hành.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
