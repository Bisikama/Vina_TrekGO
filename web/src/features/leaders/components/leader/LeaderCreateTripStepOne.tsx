"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type Visibility = "public" | "private";
type CancellationPolicy = "flexible" | "standard" | "strict";

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-[#f6f8fc] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#2f6b4f]/15";

import { useLeaderTripMutations, useLeaderTripOptions } from "../../hooks";

const difficultyLabels: Record<number, { name: string; detail: string }> = {
  1: { name: "Rất nhẹ", detail: "Dạo bộ rừng" },
  2: { name: "Nhẹ nhàng", detail: "Người mới" },
  3: { name: "Vừa phải", detail: "6–8 giờ/tiếng" },
  4: { name: "Thử thách", detail: "Dốc đứng" },
  5: { name: "Chuyên gia", detail: "Đòi hỏi kỹ thuật" },
};

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
  const { destinations, fetchPickups, checkConflicts, isLoadingDestinations } = useLeaderTripOptions();
  const { createDraft, updateTrip, isSubmitting } = useLeaderTripMutations();

  const [destinationId, setDestinationId] = useState<string>("");
  const [apiPickups, setApiPickups] = useState<Array<{ id: string; name: string }>>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState("");

  const [visibility, setVisibility] = useState<Visibility>("public");
  const [cancellationPolicy, setCancellationPolicy] =
    useState<CancellationPolicy>("flexible");

  const [capacity, setCapacity] = useState(15);
  const [price, setPrice] = useState("2850000");
  const [difficulty, setDifficulty] = useState(3);
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
  const [isFetchingPickups, setIsFetchingPickups] = useState(false);

  // Khôi phục bản nháp nếu đã lưu trước đó trong sessionStorage
  useEffect(() => {
    const savedDraft = window.sessionStorage.getItem("leader-create-trip-draft");
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.title) setTitle(draft.title);
        if (draft.name && !draft.title) setTitle(draft.name);
        if (draft.description) setDescription(draft.description);
        if (draft.visibility) setVisibility(draft.visibility);
        if (draft.cancellationPolicy) setCancellationPolicy(draft.cancellationPolicy);
        if (draft.capacity) setCapacity(Number(draft.capacity));
        if (draft.price) setPrice(String(draft.price));
        if (draft.difficulty) setDifficulty(Number(draft.difficulty));
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
  }, [fetchPickups]);

  // Bỏ tự động load pickups, yêu cầu người dùng tự chọn Điểm đến trước

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

      const createdTrip = await createDraft({
        destinationId,
        pickupPointId,
        title: title.trim(),
        description: description.trim() || null,
        startAt,
        endAt,
        capacity: Number(capacity),
        price: cleanPrice,
      });

      window.sessionStorage.setItem("leader-create-trip-id", createdTrip.id);
      window.sessionStorage.setItem(
        "leader-create-trip-draft",
        JSON.stringify({
          id: createdTrip.id,
          version: createdTrip.version,
          destinationId,
          destinationName: destinations.find((d) => d.id === destinationId)?.name,
          pickupPointId,
          pickupName: selectedPickupName,
          title: createdTrip.title,
          name: createdTrip.title,
          description: createdTrip.description,
          visibility,
          cancellationPolicy,
          startDate,
          endDate,
          meetingTime,
          price: cleanPrice,
          capacity: createdTrip.capacity,
          difficulty,
        })
      );

      router.push(`/leader/create-trip/route?tripId=${createdTrip.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã có lỗi xảy ra khi tạo chuyến đi nháp.";
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

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
                HÀNH TRÌNH MỚI
              </span>

              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#125238]">
                ● Chuẩn VFRS v2.4
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs text-slate-500">Mã dự thảo: #TRK-TX-8824</p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                Tạo Chuyến Đi Mới
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

            <div className="rounded-xl bg-[#eef3fb] p-4 text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 font-bold">
                  2
                </span>

                <div>
                  <p className="text-[10px] font-bold uppercase">Bước 2</p>
                  <strong className="text-sm">Cung đường & Trạm dừng</strong>
                </div>

                <span className="ml-auto">▣</span>
              </div>
            </div>

            <div className="rounded-xl bg-[#eef3fb] p-4 text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 font-bold">
                  3
                </span>

                <div>
                  <p className="text-[10px] font-bold uppercase">Bước 3</p>
                  <strong className="text-sm">Xem lại & Công khai</strong>
                </div>

                <span className="ml-auto">▣</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="space-y-6">
            <FormCard
              number={1}
              title="Thông tin chung & Nhận diện"
              description="Tên tour, bản chất đoàn và nội dung tóm tắt để người leo núi dễ tiếp cận."
            >
              <div className="space-y-5">
                <label className="block">
                  <FieldLabel required>Tiêu đề chuyến đi</FieldLabel>

                  <input
                    className={`${inputClass} ${
                      titleError ? "border-red-500 focus:border-red-500" : ""
                    }`}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (titleError) setTitleError("");
                    }}
                    placeholder="Nhập tiêu đề chuyến đi (VD: Khám phá Thiên Nhiên Kỳ Vĩ, Săn Mây Đại Ngàn...)"
                    maxLength={100}
                  />

                  <div className="mt-1 flex items-center justify-between text-xs">
                    {titleError ? (
                      <span className="font-semibold text-red-600">{titleError}</span>
                    ) : (
                      <span className="text-slate-400">
                        Đặt tên súc tích, hấp dẫn và nêu bật đặc trưng chuyến đi.
                      </span>
                    )}
                    <span className="text-slate-400">{title.length}/100 ký tự</span>
                  </div>
                </label>

                <div>
                  <FieldLabel required>Loại hình chuyến đi</FieldLabel>

                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setVisibility("public")}
                      className={`rounded-xl border p-4 text-left transition ${
                        visibility === "public"
                          ? "border-[#2f6b4f] bg-emerald-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-4 w-4 rounded-full border-4 ${
                            visibility === "public"
                              ? "border-[#125238]"
                              : "border-slate-300"
                          }`}
                        />

                        <strong className="text-sm text-slate-900">
                          Chuyến đi Công khai
                        </strong>

                        <span className="ml-auto rounded bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-800">
                          VFRS L2
                        </span>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Mở bán vé rộng rãi trên hệ thống, tiếp cận cộng đồng hơn
                        45.000 trekker.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisibility("private")}
                      className={`rounded-xl border p-4 text-left transition ${
                        visibility === "private"
                          ? "border-[#2f6b4f] bg-emerald-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-4 w-4 rounded-full border-4 ${
                            visibility === "private"
                              ? "border-[#125238]"
                              : "border-slate-300"
                          }`}
                        />

                        <strong className="text-sm text-slate-900">
                          Chuyến đi Riêng tư
                        </strong>

                        <span className="ml-auto rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-[#125238]">
                          Hiện dùng
                        </span>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Dành cho nhóm bạn, câu lạc bộ hoặc doanh nghiệp. Tham gia
                        bằng mã hoặc đường liên kết.
                      </p>
                    </button>
                  </div>
                </div>

                <label className="block">
                  <FieldLabel required>
                    Mô tả chi tiết chuyến đi & Lịch trình tóm tắt
                  </FieldLabel>

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="flex gap-1 bg-[#eef3fb] px-3 py-2 text-xs font-bold text-slate-600">
                      <button type="button" className="px-2">
                        B
                      </button>
                      <button type="button" className="px-2 italic">
                        I
                      </button>
                      <button type="button" className="px-2 underline">
                        U
                      </button>
                      <button type="button" className="px-2">
                        ☷
                      </button>
                      <button type="button" className="px-2">
                        ⛓
                      </button>

                      <span className="ml-auto font-normal">Markdown hỗ trợ</span>
                    </div>

                    <textarea
                      rows={8}
                      className="w-full resize-y bg-[#f8fafc] p-4 text-sm leading-6 text-slate-800 outline-none"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Nhập mô tả chi tiết chuyến đi, lịch trình tóm tắt, yêu cầu thể lực và các lưu ý chuẩn bị cho đoàn..."
                    />
                  </div>
                </label>

                <div>
                  <FieldLabel>Ảnh bìa chuyến đi</FieldLabel>

                  <div
                    className="relative h-72 overflow-hidden rounded-2xl bg-cover bg-center"
                    style={{
                      backgroundImage:
                        'linear-gradient(to top, rgba(0,0,0,.75), rgba(0,0,0,.05)), url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80")',
                    }}
                  >
                    <span className="absolute right-4 top-4 rounded-md bg-[#125238] px-2 py-1 text-xs font-bold text-white">
                      1376 × 768 px
                    </span>

                    <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 p-4">
                      <button
                        type="button"
                        className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                      >
                        ↻ Đổi ảnh bìa
                      </button>

                      <button
                        type="button"
                        className="rounded-lg bg-slate-950/70 px-3 py-2 text-xs font-bold text-white hover:bg-slate-950"
                      >
                        ⛶ Cắt tỉ lệ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </FormCard>

            <FormCard
              number={2}
              title="Thời gian & Điểm tập kết đoàn"
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
                      const today = dateInputValue(new Date());
                      if (nextStartDate < today) {
                        setDateError(
                          "Ngày khởi hành không được là ngày trong quá khứ.",
                        );
                        return;
                      }
                      setStartDate(nextStartDate);
                      setDateError("");
                      if (endDate < nextStartDate) {
                        setEndDate(nextStartDate);
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
                      if (nextEndDate < startDate) {
                        setDateError(
                          "Ngày kết thúc phải từ ngày khởi hành trở đi.",
                        );
                        return;
                      }
                      setEndDate(nextEndDate);
                      setDateError("");
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
                          setIsFetchingPickups(true);
                          setApiPickups([]);
                          setPickupPointId("");
                          const pickups = await fetchPickups(dId);
                          setApiPickups(pickups);
                          if (pickups.length > 0) {
                            setPickupPointId(pickups[0].id);
                          }
                        } catch {
                          // Handle error
                        } finally {
                          setIsFetchingPickups(false);
                        }
                      } else {
                        setApiPickups([]);
                        setPickupPointId("");
                      }
                    }}
                  >
                    <option value="">-- Chọn điểm đến trekking từ hệ thống --</option>
                    {destinations.map((point) => (
                      <option key={point.id} value={point.id}>
                        {point.name}
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
                  >
                    {apiPickups.length > 0 ? (
                      apiPickups.map((point) => (
                        <option key={point.id} value={point.id}>
                          {point.name}
                        </option>
                      ))
                    ) : (
                      <option value="">
                        {!destinationId 
                          ? "Vui lòng chọn Điểm đến trước" 
                          : isFetchingPickups 
                            ? "Đang tải điểm đón..." 
                            : "Không có điểm đón nào"}
                      </option>
                    )}
                  </select>
                </label>
              </div>
            </FormCard>

            <FormCard
              number={3}
              title="Quy mô đoàn, Giá vé & Cấp độ thử thách"
              description="Thiết lập chi phí minh bạch và độ khó chuẩn hóa."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <FieldLabel required>Số thành viên tối đa</FieldLabel>

                  <div className="flex h-12 overflow-hidden rounded-xl border border-slate-200 bg-[#f6f8fc]">
                    <button
                      type="button"
                      onClick={() =>
                        setCapacity((current) => Math.max(5, current - 1))
                      }
                      className="w-12 font-bold text-slate-600 hover:bg-slate-200"
                    >
                      −
                    </button>

                    <div className="flex flex-1 items-center justify-center font-bold text-slate-950">
                      {capacity}
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        thành viên
                      </span>
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
              </div>

              <div className="mt-6">
                <FieldLabel required>Cấp độ thử thách</FieldLabel>

                <div className="grid gap-2 md:grid-cols-5">
                  {[1, 2, 3, 4, 5].map((lvl) => {
                    const item = difficultyLabels[lvl];
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDifficulty(lvl)}
                        className={`rounded-xl border p-3 text-left transition ${
                          difficulty === lvl
                            ? "border-orange-400 bg-orange-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase text-slate-500">
                          Cấp {lvl}
                        </span>

                        <strong className="mt-1 block text-sm text-slate-900">
                          {item.name}
                        </strong>

                        <span className="mt-1 block text-[10px] text-slate-500">
                          {item.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </FormCard>

            <FormCard
              number={4}
              title="Chính sách hủy tour & Bất khả kháng"
              description="Minh bạch điều khoản tài chính theo chuẩn bảo hộ."
            >
              <div className="space-y-3">
                {[
                  {
                    value: "flexible" as const,
                    title: "Chính sách Linh hoạt",
                    description:
                      "Hoàn 100% trước ngày khởi hành 7 ngày; hoàn 50% nếu hủy trước 3 ngày.",
                  },
                  {
                    value: "standard" as const,
                    title: "Chính sách Tiêu chuẩn",
                    description:
                      "Hoàn 100% trước 14 ngày; hoàn 30% nếu hủy trước 5 ngày.",
                  },
                  {
                    value: "strict" as const,
                    title: "Chính sách Nghiêm ngặt",
                    description:
                      "Chỉ hoàn 80% nếu hủy trước 15 ngày; không hoàn sát thời điểm đi.",
                  },
                ].map((policy) => (
                  <button
                    key={policy.value}
                    type="button"
                    onClick={() => setCancellationPolicy(policy.value)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      cancellationPolicy === policy.value
                        ? "border-[#2f6b4f] bg-emerald-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex gap-3">
                      <span
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-4 ${
                          cancellationPolicy === policy.value
                            ? "border-[#125238]"
                            : "border-slate-300"
                        }`}
                      />

                      <div>
                        <strong className="text-sm text-slate-900">
                          {policy.title}
                        </strong>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {policy.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <label className="mt-5 block">
                <FieldLabel>Điều khoản bất khả kháng</FieldLabel>

                <textarea
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-[#f6f8fc] p-4 text-sm leading-6 outline-none focus:border-[#2f6b4f]"
                  defaultValue="Nếu có cảnh báo thời tiết bão lũ cấp độ 3 trở lên, đoàn sẽ tự động dời lịch sang tuần kế tiếp hoặc hoàn trả 100% kinh phí sau khi trừ chi phí phát sinh hợp lệ."
                />
              </label>
            </FormCard>

            {submitError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <strong className="font-bold">Lỗi tạo chuyến: </strong>
                {submitError}
              </div>
            )}

            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
              <Link
                href="/leader/trips"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700"
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
                  {isSubmitting ? "Đang xử lý..." : "Tiếp tục: Chọn cung đường →"}
                </button>
              </div>
            </div>
          </div>

          <aside className="sticky top-20 hidden space-y-5 xl:block">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <strong className="text-sm text-slate-900">
                  Xem trước thẻ chuyến
                </strong>

                <span className="text-xs text-[#125238]">Trekker View</span>
              </div>

              <div
                className="h-44 bg-cover bg-center"
                style={{
                  backgroundImage:
                    'url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80")',
                }}
              />

              <div className="p-5">
                <div className="flex gap-2">
                  <span className="rounded bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-800">
                    Cấp {difficulty} – {difficultyLabels[difficulty]?.name || "Vừa phải"}
                  </span>

                  <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-[#125238]">
                    {visibility === "public" ? "Công khai" : "Riêng tư"}
                  </span>
                </div>

                <h2 className="mt-4 font-bold leading-6 text-slate-950">
                  {title.trim() ? title : "Tiêu đề chuyến đi (Chưa đặt tên)"}
                </h2>

                <div className="mt-3 space-y-2 text-xs text-slate-500">
                  <p>
                    ▣{" "}
                    {new Date(startDate + "T00:00:00").toLocaleDateString(
                      "vi-VN",
                    )}{" "}
                    ({durationText})
                  </p>
                  <p>⌖ Điểm đón: {selectedPickupName.split(",")[0]}</p>
                  <p className="font-semibold text-emerald-700">
                    ⌁ Cung đường: Chọn ở Bước 2
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500">
                      Chi phí trọn gói
                    </span>

                    <p className="font-bold text-[#125238]">
                      {Number(price || 0).toLocaleString("vi-VN")}₫
                      <span className="text-xs font-normal text-slate-500">
                        /khách
                      </span>
                    </p>
                  </div>

                  <span className="text-xs text-slate-500">
                    Còn trống
                    <strong className="ml-1 text-slate-900">
                      {capacity}/15
                    </strong>
                  </span>
                </div>
              </div>
            </section>

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