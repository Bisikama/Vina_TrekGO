"use client";

import Link from "next/link";
import { TripPricingManager } from "../pricing/TripPricingManager";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLeaderTripDetail, useLeaderTripMutations } from "../../hooks";

type LeaderTripEditProps = {
  tripId: string;
};

type FormSectionProps = {
  id: string;
  number: number;
  title: string;
  description: string;
  children: ReactNode;
};

const navigationItems = [
  {
    id: "section-general",
    number: 1,
    label: "Thông tin & Ảnh bìa",
  },
  {
    id: "section-schedule",
    number: 2,
    label: "Lịch trình & Hạn đóng form",
  },
  {
    id: "section-price",
    number: 3,
    label: "Quy mô & Giá vé",
  },
  {
    id: "section-safety",
    number: 4,
    label: "An toàn & Hủy tour",
  },
];

function getMinTripStartDate(daysAdvance = 3) {
  const date = new Date();
  date.setDate(date.getDate() + daysAdvance);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function toDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function FormSection({
  id,
  number,
  title,
  description,
  children,
}: FormSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
    >
      <div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2f6b4f] font-bold text-white">
          {number}
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
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

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#2f6b4f]/15";

export function LeaderTripEdit({ tripId }: LeaderTripEditProps) {
  const cleanTripId = tripId.replace(/^#/, "");
  const { trip, refetch: refetchTrip } = useLeaderTripDetail({ tripId: cleanTripId });
  const { updateTrip, cancelTrip, isSubmitting } = useLeaderTripMutations();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceExplanation, setPriceExplanation] = useState("");
  const [capacity, setCapacity] = useState(15);
  const [minCapacity, setMinCapacity] = useState(5);
  const [price, setPrice] = useState("2850000");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [registrationOpenLocal, setRegistrationOpenLocal] = useState("");
  const [registrationDeadlineLocal, setRegistrationDeadlineLocal] = useState("");
  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 2;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  }, [startDate, endDate]);

  const [savedMessage, setSavedMessage] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (trip) {
      if (trip.title) setTitle(trip.title);
      if (trip.description) setDescription(trip.description);
      if (trip.priceExplanation !== undefined && trip.priceExplanation !== null) {
        setPriceExplanation(trip.priceExplanation);
      }
      if (trip.startAt) setStartDate(trip.startAt.slice(0, 10));
      if (trip.endAt) setEndDate(trip.endAt.slice(0, 10));
      if (trip.registrationOpenAt) {
        const d = new Date(trip.registrationOpenAt);
        if (!isNaN(d.getTime())) setRegistrationOpenLocal(toDateTimeLocalValue(d));
      }
      if (trip.registrationDeadlineAt) {
        const d = new Date(trip.registrationDeadlineAt);
        if (!isNaN(d.getTime())) setRegistrationDeadlineLocal(toDateTimeLocalValue(d));
      } else if (trip.startAt) {
        const startObj = new Date(trip.startAt);
        if (!isNaN(startObj.getTime())) {
          setRegistrationDeadlineLocal(toDateTimeLocalValue(new Date(startObj.getTime() - 48 * 3600_000)));
        }
      }
      if (trip.capacity) setCapacity(trip.capacity);
      if (trip.minCapacity || trip.minPax) setMinCapacity(trip.minCapacity || trip.minPax || 5);
      if (trip.price) setPrice(trip.price);
    }
  }, [trip]);

  function showTemporaryMessage(message: string) {
    setSavedMessage(message);
    window.setTimeout(() => {
      setSavedMessage("");
    }, 3500);
  }

  const maxAllowedDeadlineLocal = useMemo(() => {
    if (!trip?.startAt && !startDate) return undefined;
    const baseStart = trip?.startAt ? new Date(trip.startAt) : new Date(`${startDate}T06:00:00`);
    if (isNaN(baseStart.getTime())) return undefined;
    return toDateTimeLocalValue(new Date(baseStart.getTime() - 24 * 3600_000));
  }, [trip?.startAt, startDate]);

  async function handleSave() {
    if (!trip) return;
    try {
      const baseStart = trip.startAt ? new Date(trip.startAt) : new Date(`${startDate}T06:00:00`);
      const maxDeadlineMs = baseStart.getTime() - 24 * 3600_000;
      const deadlineDate = registrationDeadlineLocal ? new Date(registrationDeadlineLocal) : null;
      if (deadlineDate && (isNaN(deadlineDate.getTime()) || deadlineDate.getTime() > maxDeadlineMs)) {
        showTemporaryMessage(
          "Hạn chót đóng form đăng ký phải trước giờ khởi hành ít nhất 1 ngày (24 giờ)."
        );
        return;
      }
      const openDate = registrationOpenLocal ? new Date(registrationOpenLocal) : null;
      if (openDate && deadlineDate && openDate.getTime() >= deadlineDate.getTime()) {
        showTemporaryMessage("Giờ mở đăng ký phải trước hạn chót đóng form.");
        return;
      }

      if (trip.status !== "DRAFT") {
        await updateTrip(cleanTripId, {
          expectedVersion: trip.version,
          registrationOpenAt: openDate ? openDate.toISOString() : undefined,
          registrationDeadlineAt: deadlineDate ? deadlineDate.toISOString() : undefined,
        });
      } else {
        await updateTrip(cleanTripId, {
          expectedVersion: trip.version,
          title: title.trim() || undefined,
          description: description.trim() || null,
          priceExplanation: priceExplanation.trim() || null,
          registrationOpenAt: openDate ? openDate.toISOString() : null,
          registrationDeadlineAt: deadlineDate ? deadlineDate.toISOString() : undefined,
          capacity: Number(capacity),
          minCapacity: Number(minCapacity),
          price: String(price).replace(/\D/g, ""),
        });
      }
      await refetchTrip();
      showTemporaryMessage("Đã lưu thay đổi của chuyến đi thành công.");
    } catch (err: unknown) {
      showTemporaryMessage(err instanceof Error ? err.message : "Lỗi lưu thay đổi.");
    }
  }

  async function handleCancelTrip() {
    setShowCancelModal(false);
    if (trip) {
      try {
        await cancelTrip(cleanTripId, {
          expectedVersion: trip.version,
          reason: "Leader yêu cầu hủy chuyến đi",
        });
        await refetchTrip();
        showTemporaryMessage("Đã ghi nhận yêu cầu hủy chuyến đi.");
      } catch (err: unknown) {
        showTemporaryMessage(err instanceof Error ? err.message : "Lỗi hủy chuyến đi.");
      }
    }
  }

  const tripDisplayTitle = trip?.title || title || "Chỉnh sửa chuyến đi";

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        {savedMessage && (
          <div className="mb-4 rounded-xl bg-[#125238] p-4 text-sm font-semibold text-white shadow-lg">
            ✓ {savedMessage}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Link
                href="/leader/trips"
                className="font-semibold text-[#2f6b4f] hover:underline"
              >
                ← Chuyến đi của tôi
              </Link>

              <span>/</span>
              <span>Mã tour:</span>

              <span className="rounded-md bg-slate-100 px-2 py-1 font-mono font-bold text-slate-800">
                #{cleanTripId}
              </span>

              <span>•</span>
              <span>Phiên bản v{trip?.version || 1}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#2f6b4f] px-3 py-1.5 text-xs font-bold text-white">
                ● {trip?.status || "DRAFT"}
              </span>

              <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-800">
                VFRS Chuẩn
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                Chỉnh sửa chuyến đi: {tripDisplayTitle}
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                Cập nhật thông tin chuyến trekking, thời gian mở/đóng form đăng ký (tối thiểu trước 1 ngày khởi hành) và hậu cần đoàn.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/leader/trips/${cleanTripId}`}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-200"
              >
                ◉ Xem quản lý đoàn &amp; Timeline
              </Link>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowCancelModal(true)}
                className="h-11 rounded-xl bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                ⊗ Hủy chuyến
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSave}
                className="h-11 rounded-xl bg-[#125238] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#2f6b4f] disabled:opacity-50"
              >
                {isSubmitting ? "Đang lưu..." : "✓ Lưu thay đổi"}
              </button>
            </div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[285px_minmax(0,1fr)]">
          <aside className="sticky top-20 hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mục lục biểu mẫu
              </span>

              <span className="text-xs font-bold text-[#2f6b4f]">4/4</span>
            </div>

            <nav className="space-y-1">
              {navigationItems.map((item, index) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                    index === 0
                      ? "bg-[#2f6b4f] text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0 ? "bg-white/20" : "bg-slate-100"
                    }`}
                  >
                    {item.number}
                  </span>

                  {item.label}

                  <span className="ml-auto">✓</span>
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-6">
            <FormSection
              id="section-general"
              number={1}
              title="Thông tin cơ bản & Ảnh bìa hành trình"
              description="Tên chuyến đi, hình thức công khai và nội dung giới thiệu."
            >
              <div className="space-y-5">
                <label className="block">
                  <FieldLabel required>Tên chuyến đi trekking</FieldLabel>

                  <input
                    className={inputClass}
                    value={title}
                    disabled={trip?.status !== "DRAFT"}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tên chuyến đi"
                  />
                </label>

                <label className="block">
                  <FieldLabel required>Mô tả chi tiết &amp; Điểm nhấn</FieldLabel>

                  <textarea
                    rows={7}
                    disabled={trip?.status !== "DRAFT"}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-[#f8fafc] p-4 text-sm leading-6 text-slate-950 outline-none focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#2f6b4f]/15"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Nhập mô tả chi tiết chuyến đi"
                  />
                </label>
              </div>
            </FormSection>

            <FormSection
              id="section-schedule"
              number={2}
              title="Lịch trình Dự kiến &amp; Thời hạn Đóng/Mở Form Đăng Ký"
              description="Ngày khởi hành dự kiến và hạn chót đóng nhận đăng ký (mặc định trước 2 ngày, tối thiểu trước 1 ngày)."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <FieldLabel required>Ngày khởi hành (dự kiến)</FieldLabel>

                  <input
                    type="date"
                    className={inputClass}
                    value={startDate}
                    disabled={trip?.status !== "DRAFT"}
                    min={getMinTripStartDate(3)}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>

                <label>
                  <FieldLabel required>Ngày kết thúc (dự kiến)</FieldLabel>

                  <input
                    type="date"
                    className={inputClass}
                    value={endDate}
                    disabled={trip?.status !== "DRAFT"}
                    min={startDate || getMinTripStartDate(3)}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>

                <label>
                  <FieldLabel>Giờ mở nhận đăng ký</FieldLabel>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={registrationOpenLocal}
                    max={registrationDeadlineLocal || maxAllowedDeadlineLocal}
                    onChange={(e) => setRegistrationOpenLocal(e.target.value)}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Để trống nếu mở ngay khi Publish chuyến đi.
                  </span>
                </label>

                <label>
                  <FieldLabel required>Hạn chót đóng form đăng ký</FieldLabel>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={registrationDeadlineLocal}
                    max={maxAllowedDeadlineLocal}
                    onChange={(e) => setRegistrationDeadlineLocal(e.target.value)}
                  />
                  <span className="mt-1 block text-xs text-amber-800">
                    Mặc định trước 2 ngày (48h). Không cho phép đặt sát hơn 1 ngày (24h) trước giờ khởi hành.
                  </span>
                </label>

                <div className="md:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-slate-700 flex items-start gap-2.5">
                  <span className="text-base leading-none">💡</span>
                  <div>
                    <strong className="text-emerald-950 font-bold">Cơ chế bảo vệ giữ chỗ khi đóng form:</strong> Khi đến hạn đóng form, hệ thống chỉ chặn tạo đơn đăng ký mới. Những thành viên đã mở form giữ chỗ trước thời điểm đóng sổ vẫn được phép thanh toán cho đến khi hết thời gian giữ chỗ.
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              id="section-price"
              number={3}
              title="Quy mô đoàn &amp; Giá vé"
              description="Số lượng thành viên và chi phí tham gia."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <FieldLabel required>Số thành viên tối thiểu (để khởi hành)</FieldLabel>

                  <input
                    type="number"
                    min={1}
                    max={capacity}
                    disabled={trip?.status !== "DRAFT"}
                    className={inputClass}
                    value={minCapacity}
                    onChange={(e) => setMinCapacity(Number(e.target.value))}
                  />
                </label>

                <label>
                  <FieldLabel required>Số thành viên tối đa (quy mô đoàn)</FieldLabel>

                  <input
                    type="number"
                    min={minCapacity}
                    disabled={trip?.status !== "DRAFT"}
                    className={inputClass}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  />
                </label>

                <div className="md:col-span-2 pt-2">
                  <TripPricingManager
                    tripId={cleanTripId}
                    tripVersion={trip?.version || 1}
                    capacity={capacity}
                    minPax={minCapacity}
                    durationDays={durationDays}
                    initialPrice={price}
                    onPriceConfirmed={({ selectedPrice, selectedMinPax }) => {
                      setPrice(selectedPrice);
                      setMinCapacity(selectedMinPax);
                      refetchTrip();
                    }}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              id="section-safety"
              number={4}
              title="An toàn & Chính sách hủy tour"
              description="Yêu cầu sức khỏe, trang bị bắt buộc và điều kiện hoàn tiền."
            >
              <div className="space-y-5">
                <label>
                  <FieldLabel required>Yêu cầu thể lực và sức khỏe</FieldLabel>

                  <textarea
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] p-4 text-sm leading-6 outline-none focus:border-[#2f6b4f]"
                    defaultValue="Người tham gia cần có thể lực tốt, không mắc bệnh tim mạch hoặc huyết áp nghiêm trọng. Khuyến nghị tập luyện tối thiểu 2 tuần trước chuyến đi."
                  />
                </label>
              </div>
            </FormSection>

            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
              <p className="text-sm text-slate-500">
                Mọi thay đổi quan trọng sẽ được ghi lại trong lịch sử vận hành.
              </p>

              <div className="flex gap-3">
                <Link
                  href={`/leader/trips/${cleanTripId}`}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700 hover:bg-slate-200"
                >
                  Hủy chỉnh sửa
                </Link>

                <button
                  type="button"
                  onClick={handleSave}
                  className="h-11 rounded-xl bg-[#125238] px-6 text-sm font-bold text-white hover:bg-[#2f6b4f]"
                >
                  ✓ Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {savedMessage && (
        <div className="fixed bottom-6 right-6 z-[70] max-w-sm rounded-xl bg-[#125238] px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          ✓ {savedMessage}
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-5 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl text-red-700">
              !
            </div>

            <h2 className="mt-4 text-xl font-bold text-slate-950">
              Xác nhận hủy chuyến đi?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Hệ thống sẽ gửi thông báo và bắt đầu quy trình hoàn tiền theo chính sách hiện hành.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700"
              >
                Quay lại
              </button>

              <button
                type="button"
                onClick={handleCancelTrip}
                className="h-11 rounded-xl bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700"
              >
                Xác nhận hủy chuyến
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
