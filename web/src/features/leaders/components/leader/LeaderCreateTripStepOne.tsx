"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const inputClass =
  "h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#F7F7F4] px-4 text-sm text-[#1F2937] outline-none transition focus:border-[#2F6B4F] focus:bg-white focus:ring-2 focus:ring-[#2F6B4F]/15";

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

function toDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getMinNowDateTimeLocal() {
  return toDateTimeLocalValue(new Date());
}

function computeDeadlineBeforeStart(startDate: string, meetingTime: string, hoursBefore = 48) {
  const startObj = new Date(`${startDate}T${meetingTime || "06:00"}:00`);
  if (isNaN(startObj.getTime())) return "";
  return toDateTimeLocalValue(new Date(startObj.getTime() - hoursBefore * 3600_000));
}

function getMinTripStartDate(daysAdvance = 3) {
  const date = new Date();
  date.setDate(date.getDate() + daysAdvance);
  return dateInputValue(date);
}

function getDefaultTripEndDate(daysAdvance = 4) {
  const date = new Date();
  date.setDate(date.getDate() + daysAdvance);
  return dateInputValue(date);
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
    <span className="mb-2 block text-sm font-semibold text-[#1F2937]">
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
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs md:p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 font-bold text-[#125238]">
          {number}
        </div>

        <div>
          <h2 className="font-bold text-[#1F2937]">{title}</h2>
          <p className="mt-1 text-xs text-[#6B7280]">{description}</p>
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
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("leader-create-trip-id", tripIdFromParam);
      }
    } else if (typeof window !== "undefined") {
      const savedId = window.sessionStorage.getItem("leader-create-trip-id");
      if (savedId) setTripId(savedId);
    }
  }, [tripIdFromParam]);

  const { trip, error: tripFetchError } = useLeaderTripDetail({
    tripId: tripId || undefined,
  });

  const { destinations, isLoadingDestinations, fetchPickups } = useLeaderTripOptions();
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
  const [minCapacity, setMinCapacity] = useState(5);
  const [price, setPrice] = useState("2850000");
  const [priceExplanation, setPriceExplanation] = useState("");
  const [startDate, setStartDate] = useState(() => getMinTripStartDate(3));
  const [endDate, setEndDate] = useState(() => getDefaultTripEndDate(4));
  const [meetingTime, setMeetingTime] = useState(nextMeetingTime);
  const [registrationOpenLocal, setRegistrationOpenLocal] = useState<string>("");
  const [registrationDeadlineLocal, setRegistrationDeadlineLocal] = useState<string>(() =>
    computeDeadlineBeforeStart(getMinTripStartDate(3), nextMeetingTime(), 48)
  );
  const [customDeadlineTouched, setCustomDeadlineTouched] = useState(false);
  const [pickupPointId, setPickupPointId] = useState<string>("");
  const [dateError, setDateError] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Nếu tripId lưu trong sessionStorage không còn tồn tại trên server (VD: đổi DB hoặc bản nháp đã xóa), tự động xóa session cũ
  useEffect(() => {
    if (tripId && tripFetchError && !tripIdFromParam) {
      window.sessionStorage.removeItem("leader-create-trip-id");
      window.sessionStorage.removeItem("leader-create-trip-draft");
      window.sessionStorage.removeItem("leader-create-trip-route");
      setTripId(null);
      setDestinationId("");
      setPickupPointId("");
      setApiPickups([]);
    }
  }, [tripId, tripFetchError, tripIdFromParam]);

  // Nếu destinationId được khôi phục từ sessionStorage không nằm trong danh sách destinations khả dụng của DB hiện tại thì reset
  useEffect(() => {
    if (!isLoadingDestinations && destinations.length > 0 && destinationId) {
      const exists = destinations.some((d) => d.id === destinationId);
      if (!exists) {
        setDestinationId("");
        setPickupPointId("");
        setApiPickups([]);
      }
    }
  }, [isLoadingDestinations, destinations, destinationId]);

  // Tự động cập nhật hạn đóng form mặc định (trước 2 ngày = 48h) khi đổi ngày/giờ khởi hành nếu Leader chưa chỉnh tay
  useEffect(() => {
    if (!customDeadlineTouched && startDate && meetingTime) {
      const nextDefault = computeDeadlineBeforeStart(startDate, meetingTime, 48);
      if (nextDefault) setRegistrationDeadlineLocal(nextDefault);
    }
  }, [startDate, meetingTime, customDeadlineTouched]);

  // Khôi phục dữ liệu: ưu tiên dữ liệu thực tế từ chuyến đi đã tạo (nếu quay lại Bước 1)
  useEffect(() => {
    if (trip) {
      if (trip.title) setTitle(trip.title);
      if (trip.description) setDescription(trip.description);
      if (trip.capacity) setCapacity(Number(trip.capacity));
      if (trip.minCapacity) setMinCapacity(Number(trip.minCapacity));
      if (trip.price) {
        const num = parseInt(trip.price.replace(/\D/g, ""), 10);
        if (!isNaN(num)) setPrice(String(num));
      }
      if (trip.priceExplanation) setPriceExplanation(trip.priceExplanation);
      if (trip.destinationId) {
        setDestinationId(trip.destinationId);
        fetchPickups(trip.destinationId)
          .then((pickups) => {
            setApiPickups(pickups);
            if (trip.pickupPointId && pickups.some((p) => p.id === trip.pickupPointId)) {
              setPickupPointId(trip.pickupPointId);
            } else if (pickups.length > 0) {
              setPickupPointId(pickups[0].id);
            } else {
              setPickupPointId("");
            }
          })
          .catch(() => {
            setApiPickups([]);
            setPickupPointId("");
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
      if (trip.registrationOpenAt) {
        const openObj = new Date(trip.registrationOpenAt);
        if (!isNaN(openObj.getTime())) {
          setRegistrationOpenLocal(toDateTimeLocalValue(openObj));
        }
      }
      if (trip.registrationDeadlineAt) {
        const deadlineObj = new Date(trip.registrationDeadlineAt);
        if (!isNaN(deadlineObj.getTime())) {
          setRegistrationDeadlineLocal(toDateTimeLocalValue(deadlineObj));
          setCustomDeadlineTouched(true);
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
          if (draft.minCapacity) setMinCapacity(Number(draft.minCapacity));
          if (draft.price) setPrice(String(draft.price));
          if (draft.priceExplanation) setPriceExplanation(String(draft.priceExplanation));
          if (draft.startDate) setStartDate(draft.startDate);
          if (draft.endDate) setEndDate(draft.endDate);
          if (draft.meetingTime) setMeetingTime(draft.meetingTime);
          if (draft.registrationOpenLocal) setRegistrationOpenLocal(draft.registrationOpenLocal);
          if (draft.registrationDeadlineLocal) {
            setRegistrationDeadlineLocal(draft.registrationDeadlineLocal);
            setCustomDeadlineTouched(true);
          }
          if (draft.destinationId) {
            setDestinationId(draft.destinationId);
            fetchPickups(draft.destinationId)
              .then((pickups) => {
                setApiPickups(pickups);
                if (draft.pickupPointId && pickups.some((p) => p.id === draft.pickupPointId)) {
                  setPickupPointId(draft.pickupPointId);
                } else if (pickups.length > 0) {
                  setPickupPointId(pickups[0].id);
                } else {
                  setDestinationId("");
                  setPickupPointId("");
                }
              })
              .catch(() => {
                setDestinationId("");
                setPickupPointId("");
                setApiPickups([]);
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

  const minNowLocal = getMinNowDateTimeLocal();
  const maxAllowedDeadlineLocal = computeDeadlineBeforeStart(startDate, meetingTime, 24);

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
    setRegistrationOpenLocal("");
    setCustomDeadlineTouched(false);
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
    const minStart = getMinTripStartDate(3);
    if (startDate < minStart) {
      setDateError(
        "Theo chuẩn vận hành & an toàn VFRS, chuyến đi ghép đoàn cần được tạo trước ngày khởi hành tối thiểu 3 ngày (để kịp gom đoàn, mở thuê trang bị và nộp danh sách kiểm lâm).",
      );
      return;
    }
    if (endDate < startDate) {
      setDateError("Ngày kết thúc phải từ ngày khởi hành trở đi.");
      return;
    }
    if (minCapacity < 1) {
      setDateError("Số thành viên tối thiểu để khởi hành phải từ 1 người trở lên.");
      return;
    }
    if (minCapacity > capacity) {
      setDateError("Số thành viên tối thiểu không được vượt quá số thành viên tối đa.");
      return;
    }

    const startAtDate = new Date(`${startDate}T${meetingTime}:00`);
    const maxDeadlineMs = startAtDate.getTime() - 24 * 3600_000;
    const deadlineDate = registrationDeadlineLocal
      ? new Date(registrationDeadlineLocal)
      : new Date(startAtDate.getTime() - 48 * 3600_000);

    if (isNaN(deadlineDate.getTime()) || deadlineDate.getTime() < Date.now() - 60_000) {
      setDateError("Hạn chót đóng form đăng ký không được chọn thời điểm trong quá khứ.");
      return;
    }

    if (deadlineDate.getTime() > maxDeadlineMs) {
      setDateError(
        "Hạn chót đóng form đăng ký phải trước giờ khởi hành ít nhất 1 ngày (24 giờ). Không được phép đóng form sát giờ xuất phát hơn 1 ngày.",
      );
      return;
    }

    let openDate: Date | null = null;
    if (registrationOpenLocal.trim()) {
      openDate = new Date(registrationOpenLocal);
      if (isNaN(openDate.getTime()) || openDate.getTime() < Date.now() - 60_000) {
        setDateError("Giờ mở nhận đăng ký không được chọn ngày giờ trong quá khứ.");
        return;
      }
      if (openDate.getTime() >= deadlineDate.getTime()) {
        setDateError("Giờ mở đăng ký phải trước thời điểm đóng form đăng ký.");
        return;
      }
    }

    setDateError("");
    setTitleError("");
    setSubmitError("");

    try {
      const startAt = startAtDate.toISOString();
      const endAt = new Date(`${endDate}T23:59:59`).toISOString();
      const registrationDeadlineAt = deadlineDate.toISOString();
      const registrationOpenAt = openDate ? openDate.toISOString() : null;
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
          registrationOpenAt,
          registrationDeadlineAt,
          capacity: Number(capacity),
          minCapacity: Number(minCapacity),
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
          registrationOpenAt,
          registrationDeadlineAt,
          capacity: Number(capacity),
          minCapacity: Number(minCapacity),
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
          registrationOpenLocal,
          registrationDeadlineLocal,
          registrationOpenAt: savedTrip.registrationOpenAt ?? registrationOpenAt,
          registrationDeadlineAt: savedTrip.registrationDeadlineAt ?? registrationDeadlineAt,
          price: cleanPrice,
          capacity: savedTrip.capacity,
          minCapacity: savedTrip.minCapacity ?? Number(minCapacity),
        })
      );

      router.push(`/leader/create-trip/route?tripId=${savedTrip.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã có lỗi xảy ra khi lưu thông tin chuyến đi.";
      setSubmitError(msg);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F7F4] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#6B7280]">
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
                    className="text-xs font-medium text-[#6B7280] hover:text-red-600 underline transition"
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
                <p className="text-xs text-[#6B7280]">
                  Mã bản nháp: #{tripId.slice(0, 8)}
                </p>
              )}

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#1F2937]">
                {tripId ? "Chỉnh Sửa Thông Tin Chuyến Đi" : "Tạo Chuyến Đi Mới"}
              </h1>

              <p className="mt-2 text-sm text-[#6B7280]">
                Thiết lập hành trình trekking an toàn, đạt chuẩn thẩm định của
                VFRS.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-[#2F6B4F]/10 p-4 text-[#125238]">
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
                className="rounded-xl bg-[#F7F7F4] border border-[#E5E7EB] p-4 text-[#1F2937] text-left hover:bg-[#EFEFE9] transition"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2F6B4F] font-bold text-white">
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
              <div className="rounded-xl bg-[#F7F7F4] border border-[#E5E7EB] p-4 text-[#6B7280]">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-200 font-bold">
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

            <div className="rounded-xl bg-[#F7F7F4] border border-[#E5E7EB] p-4 text-[#6B7280]">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-200 font-bold">
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
              title="Thời gian Dự kiến, Hạn Đóng/Mở Form &amp; Điểm tập kết"
              description="Lịch xuất phát dự kiến, thời gian mở/đóng nhận đăng ký và tọa độ trạm hội quân."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <FieldLabel required>Ngày bắt đầu khởi hành (dự kiến)</FieldLabel>

                  <input
                    type="date"
                    className={inputClass}
                    value={startDate}
                    min={getMinTripStartDate(3)}
                    onChange={(event) => {
                      const nextStartDate = event.target.value;
                      setStartDate(nextStartDate);
                      const minAllowed = getMinTripStartDate(3);
                      if (nextStartDate && nextStartDate < minAllowed) {
                        setDateError(
                          "Theo chuẩn an toàn VFRS, chuyến đi ghép đoàn cần tạo trước ngày khởi hành tối thiểu 3 ngày.",
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
                  <FieldLabel required>Ngày hoàn thành kết thúc (dự kiến)</FieldLabel>

                  <input
                    type="date"
                    className={inputClass}
                    value={endDate}
                    min={startDate || getMinTripStartDate(3)}
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

                <label>
                  <FieldLabel required>Giờ tập trung xuất phát</FieldLabel>

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

                <div className="rounded-xl bg-emerald-50 p-3 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-[#6B7280] block">Tổng thời lượng dự kiến:</span>
                    <strong className="text-sm text-[#1F2937]">{durationText}</strong>
                  </div>
                  <span className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-bold text-[#125238]">
                    Lịch trình chuẩn
                  </span>
                </div>

                {/* Khung cấu hình Thời gian Mở & Đóng Form Đăng ký */}
                <div className="md:col-span-2 rounded-2xl border border-[#E5E7EB] bg-[#F7F7F4]/70 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#1F2937]">
                        Thời gian Mở &amp; Đóng Form Đăng Ký (Booking Gate)
                      </h3>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        Mặc định đóng form trước <strong>2 ngày (48h)</strong> so với giờ khởi hành. Tối đa cho phép chỉnh sát nhất là <strong>trước 1 ngày (24h)</strong>.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "Trước 3 ngày", hours: 72 },
                        { label: "Trước 2 ngày (Mặc định)", hours: 48 },
                        { label: "Trước 1 ngày (Tối đa)", hours: 24 },
                      ].map((preset) => {
                        const presetVal = computeDeadlineBeforeStart(startDate, meetingTime, preset.hours);
                        const isActive = registrationDeadlineLocal === presetVal;
                        return (
                          <button
                            key={preset.hours}
                            type="button"
                            onClick={() => {
                              setRegistrationDeadlineLocal(presetVal);
                              setCustomDeadlineTouched(preset.hours !== 48);
                              setDateError("");
                            }}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                              isActive
                                ? "bg-[#125238] text-white"
                                : "bg-white border border-[#E5E7EB] text-[#1F2937] hover:border-[#2F6B4F]"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label>
                      <FieldLabel>Giờ mở nhận đăng ký (Tùy chọn)</FieldLabel>
                      <input
                        type="datetime-local"
                        className={inputClass}
                        value={registrationOpenLocal}
                        min={minNowLocal}
                        max={registrationDeadlineLocal || maxAllowedDeadlineLocal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegistrationOpenLocal(val);
                          if (val && new Date(val).getTime() < Date.now() - 60_000) {
                            setDateError("Giờ mở nhận đăng ký không được chọn ngày giờ trong quá khứ.");
                          } else {
                            setDateError("");
                          }
                        }}
                      />
                      <span className="mt-1 block text-[11px] text-[#6B7280]">
                        Để trống nếu muốn mở đăng ký ngay lập tức khi Publish chuyến đi. Không được chọn ngày quá khứ.
                      </span>
                    </label>

                    <label>
                      <FieldLabel required>Hạn chót đóng form đăng ký</FieldLabel>
                      <input
                        type="datetime-local"
                        className={inputClass}
                        value={registrationDeadlineLocal}
                        min={registrationOpenLocal || minNowLocal}
                        max={maxAllowedDeadlineLocal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegistrationDeadlineLocal(val);
                          setCustomDeadlineTouched(true);
                          if (val && new Date(val).getTime() < Date.now() - 60_000) {
                            setDateError("Hạn chót đóng form đăng ký không được chọn ngày giờ trong quá khứ.");
                          } else {
                            setDateError("");
                          }
                        }}
                      />
                      <span className="mt-1 block text-[11px] text-amber-800">
                        Sau mốc này sẽ chặn tạo đơn mới. Khách đã giữ chỗ trước khi đóng form vẫn được thanh toán nốt trong thời gian giữ chỗ.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-[#1F2937]">
                  <strong className="text-[#125238] font-bold">Quy chuẩn an toàn VFRS:</strong> Chuyến đi ghép đoàn cần mở trước ngày khởi hành tối thiểu <strong>3 ngày</strong> để đảm bảo đủ thời gian gom đoàn, xử lý các đơn thuê trang bị (Rental Cutoff 24h) và nộp danh sách khai báo kiểm lâm.
                </div>
                {dateError && (
                  <p className="text-sm font-medium text-red-600 md:col-span-2" role="alert">
                    {dateError}
                  </p>
                )}

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

                <label className="md:col-span-2">
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

                <div className="md:col-span-2 text-xs text-[#1F2937] bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                  <strong className="text-[#125238]">Mô tả chi tiết &amp; Lịch trình chuyến đi:</strong> Sẽ được tự động tạo và tinh chỉnh ở <strong>Bước 3 (Xem lại &amp; Công khai)</strong> sau khi bạn hoàn tất chọn Cung đường và Checkpoints ở Bước 2.
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
                  <FieldLabel required>Số thành viên tối thiểu để khởi hành</FieldLabel>

                  <div className="flex h-12 overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F7F7F4]">
                    <button
                      type="button"
                      onClick={() =>
                        setMinCapacity((current) => Math.max(1, current - 1))
                      }
                      className="w-12 font-bold text-[#6B7280] hover:bg-[#E5E7EB]"
                    >
                      -
                    </button>

                    <div className="flex flex-1 items-center justify-center font-bold text-[#1F2937] tabular-nums">
                      {minCapacity} thành viên
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setMinCapacity((current) => Math.min(capacity, current + 1))
                      }
                      className="w-12 font-bold text-[#6B7280] hover:bg-[#E5E7EB]"
                    >
                      +
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-[#6B7280]">
                    Chuyến đi đạt số lượng tối thiểu này sẽ chắc chắn khởi hành.
                  </p>
                </div>

                <div>
                  <FieldLabel required>Số thành viên tối đa (quy mô đoàn)</FieldLabel>

                  <div className="flex h-12 overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F7F7F4]">
                    <button
                      type="button"
                      onClick={() =>
                        setCapacity((current) => Math.max(minCapacity, current - 1))
                      }
                      className="w-12 font-bold text-[#6B7280] hover:bg-[#E5E7EB]"
                    >
                      -
                    </button>

                    <div className="flex flex-1 items-center justify-center font-bold text-[#1F2937] tabular-nums">
                      {capacity} thành viên
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setCapacity((current) => Math.min(30, current + 1))
                      }
                      className="w-12 font-bold text-[#6B7280] hover:bg-[#E5E7EB]"
                    >
                      +
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-orange-700">
                    Khi đủ số người tối đa, hệ thống sẽ tự động đóng đăng ký (FULL).
                  </p>
                </div>

                <label>
                  <FieldLabel required>Giá tour tạm tính / người</FieldLabel>

                  <div className="relative">
                    <input
                      className={`${inputClass} pr-16 tabular-nums`}
                      value={Number(price || 0).toLocaleString("vi-VN")}
                      onChange={(event) =>
                        setPrice(event.target.value.replace(/\D/g, ""))
                      }
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280]">
                      VNĐ
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-[#6B7280]">
                    Mức giá tạm tính. Bạn có thể lập bảng chi phí chi tiết và chạy mô phỏng lợi nhuận ở Bước 3.
                  </p>
                </label>

                <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-[#1F2937] space-y-1">
                  <strong className="text-[#125238] font-bold block text-sm">
                    Dự toán chi phí &amp; Trekking Pricing Simulator tự động:
                  </strong>
                  <p className="text-[#6B7280] leading-relaxed">
                    Bạn không cần phải tự giải trình cơ sở tính giá bằng tay. Ở <strong>Bước 3 (Xem lại &amp; Công khai)</strong>, hệ thống sẽ cung cấp <strong>Bảng kê chi phí</strong> (xe cộ, ăn uống, porter, bảo hiểm) cùng <strong>Simulator kéo thả</strong> để tính toán điểm hòa vốn, biên lợi nhuận và tự động sinh bản giải trình cho bạn.
                  </p>
                </div>
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

            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:flex-row sm:items-center">
              <Link
                href="/leader/trips"
                onClick={() => {
                  window.sessionStorage.removeItem("leader-create-trip-id");
                  window.sessionStorage.removeItem("leader-create-trip-draft");
                  window.sessionStorage.removeItem("leader-create-trip-route");
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#F7F7F4] border border-[#E5E7EB] px-5 text-sm font-bold text-[#1F2937] hover:bg-[#EFEFE9] transition"
              >
                Hủy bỏ
              </Link>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleContinue}
                  className="h-11 rounded-xl bg-[#2F6B4F] px-6 text-sm font-bold text-white shadow-xs hover:bg-[#1F4A36] disabled:cursor-not-allowed disabled:bg-stone-400"
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
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs">
              <h2 className="font-bold text-[#1F2937]">
                Quy tắc 3 Điều kiện Mở/Đóng Đăng ký
              </h2>

              <ul className="mt-4 space-y-3 text-xs leading-5 text-[#6B7280]">
                <li>✓ <strong>Hạn chót đăng ký:</strong> Tự động đóng form trước giờ khởi hành 2 ngày (có thể chỉnh tối đa sát nhất trước 1 ngày).</li>
                <li>✓ <strong>Bảo vệ giữ chỗ:</strong> Khách đã vào form giữ chỗ trước giờ đóng sổ vẫn được thanh toán nốt trong thời gian giữ chỗ.</li>
                <li>✓ <strong>Sức chứa tối đa:</strong> Đủ số người tối đa sẽ tự động chuyển sang trạng thái Đủ chỗ (FULL).</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
