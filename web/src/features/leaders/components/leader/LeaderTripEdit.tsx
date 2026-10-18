"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

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
    label: "Lịch trình & Tập kết",
  },
  {
    id: "section-trail",
    number: 3,
    label: "Cung đường & Trạm dừng",
  },
  {
    id: "section-price",
    number: 4,
    label: "Quy mô & Giá vé",
  },
  {
    id: "section-safety",
    number: 5,
    label: "An toàn & Hủy tour",
  },
];

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
          <h2 className="text-lg font-bold text-slate-950">
            {title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
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

import { useLeaderTripDetail, useLeaderTripMutations } from "../../hooks";

export function LeaderTripEdit({
  tripId,
}: LeaderTripEditProps) {
  const cleanTripId = tripId.replace(/^#/, "");
  const { trip, isLoading: isLoadingTrip } = useLeaderTripDetail({ tripId: cleanTripId });
  const { updateTrip, cancelTrip, isSubmitting } = useLeaderTripMutations();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceExplanation, setPriceExplanation] = useState("");
  const [capacity, setCapacity] = useState(15);
  const [price, setPrice] = useState("2850000");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [savedMessage, setSavedMessage] = useState("");
  const [showCancelModal, setShowCancelModal] =
    useState(false);

  useEffect(() => {
    if (trip) {
      if (trip.title) setTitle(trip.title);
      if (trip.description) setDescription(trip.description);
      if (trip.priceExplanation !== undefined && trip.priceExplanation !== null) {
        setPriceExplanation(trip.priceExplanation);
      }
      if (trip.startAt) setStartDate(trip.startAt.slice(0, 10));
      if (trip.endAt) setEndDate(trip.endAt.slice(0, 10));
      if (trip.capacity) setCapacity(trip.capacity);
      if (trip.price) setPrice(trip.price);
    }
  }, [trip]);

  function showTemporaryMessage(message: string) {
    setSavedMessage(message);

    window.setTimeout(() => {
      setSavedMessage("");
    }, 3000);
  }

  async function handleSave() {
    if (trip) {
      try {
        await updateTrip(cleanTripId, {
          expectedVersion: trip.version,
          title: title.trim() || undefined,
          description: description.trim() || null,
          priceExplanation: priceExplanation.trim() || null,
          capacity: Number(capacity),
          price: String(price).replace(/\D/g, ""),
        });
        showTemporaryMessage(
          "Đã lưu thay đổi của chuyến đi thành công.",
        );
      } catch (err: unknown) {
        showTemporaryMessage(
          err instanceof Error ? err.message : "Lỗi lưu thay đổi.",
        );
      }
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
        showTemporaryMessage(
          "Đã ghi nhận yêu cầu hủy chuyến đi.",
        );
      } catch (err: unknown) {
        showTemporaryMessage(
          err instanceof Error ? err.message : "Lỗi hủy chuyến đi.",
        );
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

              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">
                0/{capacity} thành viên
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
                Cập nhật thông tin chuyến trekking, lịch
                trình, hậu cần và các yêu cầu an toàn của
                đoàn.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/leader/trips/${cleanTripId}`}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-200"
              >
                ◉ Xem trước
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

        <section className="mt-5 flex flex-col gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-5 md:flex-row">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-xl text-white">
            !
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-orange-950">
                LƯU Ý QUAN TRỌNG TỪ HỆ THỐNG AN TOÀN VFRS
              </h2>

              <span className="rounded-md bg-orange-600 px-2 py-1 text-[10px] font-bold uppercase text-white">
                Ràng buộc pháp lý
              </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-orange-900">
              Chuyến đi đã có{" "}
              <strong>
                12 thành viên thanh toán xác nhận cọc
              </strong>
              . Mọi thay đổi liên quan đến ngày khởi hành,
              địa điểm tập kết hoặc giá vé sẽ gửi thông báo
              tới người tham gia.
            </p>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[285px_minmax(0,1fr)]">
          <aside className="sticky top-20 hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mục lục biểu mẫu
              </span>

              <span className="text-xs font-bold text-[#2f6b4f]">
                5/5
              </span>
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
                      index === 0
                        ? "bg-white/20"
                        : "bg-slate-100"
                    }`}
                  >
                    {item.number}
                  </span>

                  {item.label}

                  <span className="ml-auto">✓</span>
                </a>
              ))}
            </nav>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">
                  Tỷ lệ lấp đầy
                </span>

                <strong className="text-[#2f6b4f]">
                  80%
                </strong>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-4/5 rounded-full bg-[#2f6b4f]" />
              </div>

              <div className="mt-3 flex justify-between text-xs text-slate-500">
                <span>
                  Còn trống: <strong>3 chỗ</strong>
                </span>

                <strong className="text-[#2f6b4f]">
                  34.2M
                </strong>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              ☁ Tự động lưu: 1 phút trước
            </p>
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
                  <FieldLabel required>
                    Tên chuyến đi trekking
                  </FieldLabel>

                  <input
                    className={inputClass}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tên chuyến đi"
                  />

                  <span className="mt-1 block text-xs text-slate-400">
                    Độ dài lý tưởng từ 50–90 ký tự.
                  </span>
                </label>

                <div>
                  <FieldLabel>
                    Hình thức chuyến đi
                  </FieldLabel>

                  <div className="rounded-xl border border-[#2f6b4f] bg-[#2f6b4f]/10 p-4 text-left text-sm font-semibold text-[#125238]">
                    ◉ Chuyến đi Công khai
                    <span className="mt-1 block text-xs font-normal">
                      Hiển thị trên trang khám phá.
                    </span>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <FieldLabel>
                      Ảnh bìa hành trình
                    </FieldLabel>

                    <button
                      type="button"
                      className="text-xs font-bold text-[#2f6b4f]"
                    >
                      ↑ Thay ảnh mới
                    </button>
                  </div>

                  <div
                    className="relative h-64 overflow-hidden rounded-2xl bg-cover bg-center"
                    style={{
                      backgroundImage:
                        'linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,.08)), url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80")',
                    }}
                  >
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <span className="rounded-md bg-[#2f6b4f] px-2 py-1 text-xs font-bold">
                        Ảnh chính hiển thị
                      </span>

                      <p className="mt-2 text-sm">
                        Hình ảnh hành trình trekking VFRS
                      </p>
                    </div>
                  </div>
                </div>

                <label className="block">
                  <FieldLabel required>
                    Mô tả chi tiết &amp; Điểm nhấn
                  </FieldLabel>

                  <textarea
                    rows={7}
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
              title="Lịch trình &amp; Điểm tập kết"
              description="Ngày khởi hành, thời gian kết thúc và địa điểm tập trung của đoàn."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <FieldLabel required>
                    Ngày khởi hành
                  </FieldLabel>

                  <input
                    type="date"
                    className={inputClass}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>

                <label>
                  <FieldLabel required>
                    Ngày kết thúc
                  </FieldLabel>

                  <input
                    type="date"
                    className={inputClass}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
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
                  <FieldLabel required>
                    Số thành viên tối đa
                  </FieldLabel>

                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  />
                </label>

                <label>
                  <FieldLabel required>
                    Giá vé mỗi người (VNĐ)
                  </FieldLabel>

                  <input
                    type="text"
                    className={inputClass}
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
                  />
                </label>

                <label className="md:col-span-2 block">
                  <FieldLabel required>
                    Cơ sở tính giá &amp; Giải trình chi phí nội bộ (priceExplanation)
                  </FieldLabel>

                  <textarea
                    rows={4}
                    maxLength={5000}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-[#f8fafc] p-4 text-sm leading-6 text-slate-950 outline-none focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#2f6b4f]/15"
                    value={priceExplanation}
                    onChange={(e) => setPriceExplanation(e.target.value)}
                    placeholder="Nhập cơ sở tính giá nội bộ: chi phí chung, chi phí/người, số khách dự toán, dự phòng và lợi nhuận..."
                  />

                  <span className="mt-1 block text-xs text-slate-400">
                    Bắt buộc trước khi xuất bản chuyến đi. Không hiển thị công khai. ({priceExplanation.length}/5000 ký tự)
                  </span>
                </label>
              </div>

              <div className="mt-5 rounded-xl bg-emerald-50 p-4">
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <span className="text-slate-500">
                      Đã đăng ký
                    </span>
                    <strong className="mt-1 block text-slate-950">
                      12/15 thành viên
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500">
                      Tỷ lệ lấp đầy
                    </span>
                    <strong className="mt-1 block text-[#2f6b4f]">
                      80%
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500">
                      Doanh thu dự kiến
                    </span>
                    <strong className="mt-1 block text-[#2f6b4f]">
                      42.750.000₫
                    </strong>
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              id="section-safety"
              number={5}
              title="An toàn & Chính sách hủy tour"
              description="Yêu cầu sức khỏe, trang bị bắt buộc và điều kiện hoàn tiền."
            >
              <div className="space-y-5">
                <label>
                  <FieldLabel required>
                    Yêu cầu thể lực và sức khỏe
                  </FieldLabel>

                  <textarea
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] p-4 text-sm leading-6 outline-none focus:border-[#2f6b4f]"
                    defaultValue="Người tham gia cần có thể lực tốt, không mắc bệnh tim mạch hoặc huyết áp nghiêm trọng. Khuyến nghị tập luyện tối thiểu 2 tuần trước chuyến đi."
                  />
                </label>

                <div>
                  <FieldLabel>
                    Trang bị bắt buộc
                  </FieldLabel>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      "Giày trekking có độ bám tốt",
                      "Áo khoác chống nước",
                      "Đèn pin cá nhân",
                      "Balo từ 25–35 lít",
                      "Thuốc và vật dụng cá nhân",
                      "Giấy tờ tùy thân",
                    ].map((equipment) => (
                      <label
                        key={equipment}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          defaultChecked
                          className="h-4 w-4 accent-[#2f6b4f]"
                        />

                        {equipment}
                      </label>
                    ))}
                  </div>
                </div>

                <label>
                  <FieldLabel required>
                    Chính sách hủy và hoàn tiền
                  </FieldLabel>

                  <select
                    className={inputClass}
                    defaultValue="standard"
                  >
                    <option value="standard">
                      Tiêu chuẩn VFRS – hoàn theo thời điểm
                      hủy
                    </option>
                    <option value="flexible">
                      Linh hoạt – hỗ trợ đổi ngày
                    </option>
                    <option value="strict">
                      Nghiêm ngặt – không hoàn tiền cọc
                    </option>
                  </select>
                </label>
              </div>
            </FormSection>

            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
              <p className="text-sm text-slate-500">
                Mọi thay đổi quan trọng sẽ được ghi lại trong
                lịch sử vận hành.
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
              Chuyến đi đã có 12 thành viên đặt cọc. Hệ thống
              sẽ gửi thông báo và bắt đầu quy trình hoàn tiền
              theo chính sách hiện hành.
            </p>

            <label className="mt-5 block">
              <FieldLabel required>
                Lý do hủy chuyến
              </FieldLabel>

              <textarea
                rows={4}
                placeholder="Nhập lý do hủy chuyến..."
                className="w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-red-500"
              />
            </label>

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