"use client";

import { useMemo, useState } from "react";

type ShiftMember = {
  name: string;
  role?: string;
  currentUser?: boolean;
};

type DaySchedule = {
  id: string;
  date: string;
  dayName: string;
  load: string;
  morning: ShiftMember[];
  afternoon: ShiftMember[];
  morningNote?: string;
  afternoonNote?: string;
  tone: "green" | "orange" | "red" | "neutral";
};

const schedules: DaySchedule[] = [
  {
    id: "25-11",
    date: "T2 · 25/11",
    dayName: "Thứ Hai (Hôm nay)",
    load: "Tải kho: 18 đơn · 12 xuất · 6 trả",
    tone: "green",
    morning: [
      {
        name: "Nguyễn Văn An",
        role: "Trưởng ca · Soạn đồ Dock A",
        currentUser: true,
      },
      {
        name: "Trần Minh Đức",
        role: "Kỹ thuật RFID & Lắp trại",
      },
      {
        name: "Lê Thị Mai",
        role: "Kiểm định giặt sấy túi ngủ",
      },
    ],
    afternoon: [
      {
        name: "Phạm Hoàng Nam",
        role: "Trưởng ca chiều · Tiếp nhận Dock B",
      },
      {
        name: "Đỗ Quốc Huy",
        role: "Điều phối xe trung chuyển",
      },
      {
        name: "Nguyễn Thu Hà",
        role: "Đóng gói niêm phong & In tem RFID",
      },
    ],
    afternoonNote:
      "Giao thời 14:00 – 14:30: đối soát 12 thùng kit lều Trek và bàn giao 3 bộ đàm Garmin.",
  },
  {
    id: "26-11",
    date: "T3 · 26/11",
    dayName: "Thứ Ba",
    load: "Tải kho: 14 đơn · 8 xuất · 6 trả",
    tone: "neutral",
    morning: [
      {
        name: "Trần Minh Đức",
        role: "Trưởng ca",
      },
      {
        name: "Lê Thị Mai",
      },
      {
        name: "Đỗ Quốc Huy",
      },
    ],
    afternoon: [
      {
        name: "Phạm Hoàng Nam",
        role: "Trưởng ca",
      },
      {
        name: "Nguyễn Thu Hà",
      },
      {
        name: "Hoàng Văn Thái",
        role: "Bán thời gian",
      },
    ],
  },
  {
    id: "27-11",
    date: "T4 · 27/11",
    dayName: "Thứ Tư",
    load: "Tải kho: 22 đơn · 14 xuất · 8 trả",
    tone: "orange",
    morning: [
      {
        name: "Nguyễn Văn An",
        role: "Soạn đồ tour Tà Xùa",
        currentUser: true,
      },
      {
        name: "Trần Minh Đức",
      },
      {
        name: "Lê Thị Mai",
      },
    ],
    afternoon: [
      {
        name: "Phạm Hoàng Nam",
      },
      {
        name: "Đỗ Quốc Huy",
      },
      {
        name: "Nguyễn Thu Hà",
      },
    ],
    morningNote:
      "Nhiệm vụ: tập trung đóng gói tour Tà Xùa, 10 pack lều Marmot và 20 gậy trekking.",
  },
  {
    id: "28-11",
    date: "T5 · 28/11",
    dayName: "Thứ Năm",
    load: "Tải kho: 26 đơn · 20 xuất · 6 trả",
    tone: "orange",
    morning: [
      {
        name: "Trần Minh Đức",
        role: "Đã đổi ca",
      },
      {
        name: "Lê Thị Mai",
      },
      {
        name: "Hoàng Văn Thái",
      },
    ],
    afternoon: [
      {
        name: "Nguyễn Văn An",
        role: "Ca nhận hoàn đổi",
        currentUser: true,
      },
      {
        name: "Phạm Hoàng Nam",
      },
      {
        name: "Nguyễn Thu Hà",
      },
    ],
    afternoonNote:
      "Soát hàng đợt 1 xe trung chuyển liên tỉnh đi Lào Cai lúc 20:30.",
  },
  {
    id: "29-11",
    date: "T6 · 29/11",
    dayName: "Thứ Sáu",
    load: "Tải nặng: 38 đơn · 32 xuất · 6 trả",
    tone: "red",
    morning: [
      {
        name: "Nguyễn Văn An",
        role: "Trưởng ca · Chủ trì",
        currentUser: true,
      },
      {
        name: "Trần Minh Đức",
      },
      {
        name: "Lê Thị Mai",
      },
      {
        name: "Tiếp ứng bốc dỡ",
      },
    ],
    afternoon: [
      {
        name: "Phạm Hoàng Nam",
      },
      {
        name: "Đỗ Quốc Huy",
      },
      {
        name: "Nguyễn Thu Hà",
      },
    ],
    morningNote:
      "Lưu ý: 32 đơn cần seal nhãn NFC trước 11:30 để kịp xe tuyến Yên Bái – Hà Giang.",
  },
  {
    id: "30-11",
    date: "T7 · 30/11",
    dayName: "Thứ Bảy",
    load: "Tải kho: 24 đơn · 16 xuất · 8 trả",
    tone: "neutral",
    morning: [
      {
        name: "Trần Minh Đức",
      },
      {
        name: "Lê Thị Mai",
      },
      {
        name: "Đỗ Quốc Huy",
      },
    ],
    afternoon: [
      {
        name: "Phạm Hoàng Nam",
      },
      {
        name: "Nguyễn Thu Hà",
      },
      {
        name: "Hoàng Văn Thái",
      },
    ],
  },
  {
    id: "01-12",
    date: "CN · 01/12",
    dayName: "Chủ Nhật",
    load: "Tải cực đại: 42 đơn · 36 hoàn trả kiểm định",
    tone: "orange",
    morning: [
      {
        name: "Trần Minh Đức",
      },
      {
        name: "Lê Thị Mai",
      },
      {
        name: "Đỗ Quốc Huy",
      },
    ],
    afternoon: [
      {
        name: "Nguyễn Văn An",
        role: "Trực Dock thu hồi",
        currentUser: true,
      },
      {
        name: "Nguyễn Thu Hà",
      },
      {
        name: "Phạm Hoàng Nam",
      },
    ],
    afternoonNote:
      "Trực trạm tiếp nhận xe hoàn trả các đoàn trekking Ba Vì, Tam Đảo; kích hoạt kiểm tra cọc đồ dã ngoại.",
  },
];

const toneClass: Record<DaySchedule["tone"], string> = {
  green: "border-l-emerald-700",
  orange: "border-l-orange-500",
  red: "border-l-red-600",
  neutral: "border-l-slate-300",
};

function ShiftColumn({
  title,
  time,
  members,
  note,
}: {
  title: string;
  time: string;
  members: ShiftMember[];
  note?: string;
}) {
  return (
    <div className="rounded-lg bg-[#edf3ff] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black text-slate-800">
          {title} ({time})
        </p>

        <span className="text-[9px] text-slate-500">
          {members.length} nhân sự
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {members.map((member, index) => (
          <div
            key={`${member.name}-${index}`}
            className={`rounded-lg p-2 ${
              member.currentUser
                ? "bg-[#125238] text-white"
                : "bg-white text-slate-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-black ${
                  member.currentUser
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-[#e4ebf8] text-slate-700"
                }`}
              >
                {member.name
                  .split(" ")
                  .slice(-2)
                  .map((word) => word[0])
                  .join("")}
              </span>

              <div>
                <p className="text-[10px] font-black">
                  {member.name}
                  {member.currentUser && " (Bạn)"}
                </p>

                {member.role && (
                  <p
                    className={`mt-1 text-[8px] ${
                      member.currentUser
                        ? "text-emerald-100"
                        : "text-slate-500"
                    }`}
                  >
                    {member.role}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {note && (
        <div className="mt-3 rounded-lg bg-orange-50 p-2 text-[9px] leading-5 text-orange-800">
          {note}
        </div>
      )}
    </div>
  );
}

export function StaffSchedule() {
  const [filter, setFilter] = useState<
    "all" | "mine" | "busy"
  >("all");

  const [swapDate, setSwapDate] = useState(
    "T4 27/11 · Ca sáng",
  );

  const [swapWith, setSwapWith] = useState(
    "Phạm Hoàng Nam",
  );

  const [swapReason, setSwapReason] = useState("");

  const [message, setMessage] = useState("");

  const visibleSchedules = useMemo(() => {
    if (filter === "mine") {
      return schedules.filter(
        (schedule) =>
          schedule.morning.some(
            (member) => member.currentUser,
          ) ||
          schedule.afternoon.some(
            (member) => member.currentUser,
          ),
      );
    }

    if (filter === "busy") {
      return schedules.filter(
        (schedule) =>
          schedule.tone === "red" ||
          schedule.tone === "orange",
      );
    }

    return schedules;
  }, [filter]);

  function showMessage(value: string) {
    setMessage(value);

    window.setTimeout(() => {
      setMessage("");
    }, 2500);
  }

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1500px]">
        <div className="text-xs text-slate-500">
          Kho & Thiết bị
          <span className="mx-2">›</span>
          Điều phối kho vận
          <span className="mx-2">›</span>
          <strong className="text-slate-900">
            Lịch phân ca tuần 48
          </strong>
        </div>

        <section className="mt-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-950">
                Lịch phân ca & Điều phối
              </h1>

              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[9px] font-bold text-emerald-800">
                  Tuần 48 / 2024
                </span>

                <span className="rounded-full bg-[#edf3ff] px-3 py-1 text-[9px] font-semibold">
                  100% Đủ quân số
                </span>
              </div>

              <p className="mt-2 text-[10px] text-slate-500">
                Quản lý lịch làm việc 2 ca trực chuẩn,
                điều tiết nhân sự xuất nhập kho dã ngoại
                và giám sát bàn giao ca.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-[#edf3ff] px-4 py-2 text-[10px] font-bold"
              >
                ‹ Tuần trước
              </button>

              <span className="rounded-lg bg-[#edf3ff] px-4 py-2 text-[10px] font-bold">
                25/11 – 01/12
              </span>

              <button
                type="button"
                className="rounded-lg bg-[#edf3ff] px-4 py-2 text-[10px] font-bold"
              >
                Tuần sau ›
              </button>

              <button
                type="button"
                onClick={() =>
                  showMessage(
                    "Đã đăng ký ca trực bổ sung.",
                  )
                }
                className="rounded-lg bg-[#125238] px-4 py-2 text-[10px] font-black text-white"
              >
                ⊕ Đăng ký ca trực
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-3 rounded-lg bg-emerald-100 p-3 text-xs font-bold text-emerald-900">
            ✓ {message}
          </div>
        )}

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            [
              "Tổng ca trực tuần",
              "28",
              "14 sáng · 14 chiều",
            ],
            [
              "Nhân sự hiện diện",
              "6",
              "Thủ kho & KTV",
            ],
            [
              "Dự báo tải kho tuần",
              "184",
              "Đơn thuê/trả",
            ],
            [
              "Ca của bạn",
              "5",
              "40 giờ đã phân công",
            ],
            [
              "Bàn giao & Thiết bị",
              "14/14",
              "Phiên giao thời",
            ],
          ].map(([label, value, detail]) => (
            <article
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[9px] text-slate-500">
                {label}
              </p>

              <p className="mt-3 text-2xl font-black text-slate-950">
                {value}
              </p>

              <p className="mt-1 text-[9px] text-slate-500">
                {detail}
              </p>
            </article>
          ))}
        </section>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-sm font-black">
                  Phân bổ ca theo ngày
                </h2>

                <p className="mt-1 text-[9px] text-slate-500">
                  Hub North-01 · Cầu Giấy
                </p>
              </div>

              <div className="flex gap-2 text-[9px] font-bold">
                {[
                  ["all", "Tất cả ca trực"],
                  ["mine", "Ca của tôi"],
                  ["busy", "Cao điểm"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() =>
                      setFilter(
                        value as
                          | "all"
                          | "mine"
                          | "busy",
                      )
                    }
                    className={`rounded-lg px-3 py-2 ${
                      filter === value
                        ? "bg-[#125238] text-white"
                        : "bg-[#edf3ff] text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {visibleSchedules.map((schedule) => (
                <article
                  key={schedule.id}
                  className={`rounded-xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm ${
                    toneClass[schedule.tone]
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-lg px-3 py-2 text-[10px] font-black ${
                          schedule.tone === "red"
                            ? "bg-red-600 text-white"
                            : schedule.tone === "orange"
                              ? "bg-orange-100 text-orange-900"
                              : schedule.tone === "green"
                                ? "bg-[#125238] text-white"
                                : "bg-[#edf3ff]"
                        }`}
                      >
                        {schedule.date}
                      </span>

                      <h3 className="text-sm font-black text-slate-950">
                        {schedule.dayName}
                      </h3>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-[9px] font-bold ${
                        schedule.tone === "red"
                          ? "bg-red-100 text-red-700"
                          : "bg-[#edf3ff] text-slate-700"
                      }`}
                    >
                      {schedule.load}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <ShiftColumn
                      title="Ca Sáng"
                      time="06:30 – 14:30"
                      members={schedule.morning}
                      note={schedule.morningNote}
                    />

                    <ShiftColumn
                      title="Ca Chiều"
                      time="14:00 – 22:00"
                      members={schedule.afternoon}
                      note={schedule.afternoonNote}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black">
                  Lịch cá nhân của tôi
                </h2>

                <span className="rounded-full bg-[#125238] px-3 py-1 text-[9px] font-bold text-white">
                  5 ca / 40h
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {[
                  [
                    "Hôm nay · Thứ Hai",
                    "Ca sáng 06:30 – 14:30",
                    "Đang diễn ra",
                    "bg-emerald-100 text-emerald-800",
                  ],
                  [
                    "Thứ Tư · 27/11",
                    "Ca sáng 06:30 – 14:30",
                    "Kế hoạch",
                    "bg-[#edf3ff]",
                  ],
                  [
                    "Thứ Năm · 28/11",
                    "Ca chiều 14:00 – 22:00",
                    "Đã đổi ca",
                    "bg-emerald-100 text-emerald-800",
                  ],
                  [
                    "Thứ Sáu · 29/11",
                    "Ca sáng 06:30 – 14:30",
                    "Cao điểm",
                    "bg-red-100 text-red-700",
                  ],
                  [
                    "Chủ Nhật · 01/12",
                    "Ca chiều 14:00 – 22:00",
                    "Thu hồi",
                    "bg-orange-100 text-orange-800",
                  ],
                ].map(
                  ([date, shift, status, statusClass]) => (
                    <div
                      key={date}
                      className="rounded-lg bg-[#edf3ff] p-3"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="text-[10px] font-black">
                          {date}
                        </p>

                        <span
                          className={`rounded px-2 py-1 text-[8px] font-bold ${statusClass}`}
                        >
                          {status}
                        </span>
                      </div>

                      <p className="mt-2 text-[9px] text-slate-600">
                        {shift}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black">
                Yêu cầu hoán đổi ca
              </h2>

              <div className="mt-4 rounded-lg bg-emerald-50 p-3">
                <div className="flex justify-between gap-2">
                  <p className="text-[9px] font-bold">
                    Yêu cầu gần nhất
                  </p>

                  <span className="rounded bg-emerald-100 px-2 py-1 text-[8px] font-bold text-emerald-800">
                    Đã phê duyệt
                  </span>
                </div>

                <p className="mt-2 text-[9px] leading-5 text-slate-600">
                  Đổi ca ngày 28/11 với đồng nghiệp
                  Trần Minh Đức.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500">
                    Ca của bạn
                  </label>

                  <select
                    value={swapDate}
                    onChange={(event) =>
                      setSwapDate(event.target.value)
                    }
                    className="mt-1 h-10 w-full rounded-lg bg-[#edf3ff] px-2 text-[9px] outline-none"
                  >
                    <option>T4 27/11 · Ca sáng</option>
                    <option>T5 28/11 · Ca chiều</option>
                    <option>T6 29/11 · Ca sáng</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-slate-500">
                    Đồng nghiệp đổi
                  </label>

                  <select
                    value={swapWith}
                    onChange={(event) =>
                      setSwapWith(event.target.value)
                    }
                    className="mt-1 h-10 w-full rounded-lg bg-[#edf3ff] px-2 text-[9px] outline-none"
                  >
                    <option>Phạm Hoàng Nam</option>
                    <option>Trần Minh Đức</option>
                    <option>Đỗ Quốc Huy</option>
                  </select>
                </div>
              </div>

              <textarea
                value={swapReason}
                onChange={(event) =>
                  setSwapReason(event.target.value)
                }
                placeholder="Lý do hoán đổi ca..."
                className="mt-3 min-h-20 w-full resize-none rounded-lg bg-[#edf3ff] p-3 text-[9px] outline-none"
              />

              <button
                type="button"
                onClick={() =>
                  showMessage(
                    `Đã gửi yêu cầu đổi ${swapDate} với ${swapWith}.`,
                  )
                }
                className="mt-3 w-full rounded-lg bg-[#125238] px-4 py-3 text-[10px] font-black text-white"
              >
                Gửi yêu cầu tới Quản lý
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black text-emerald-900">
                Quy định vận hành ca trực
              </h2>

              <ul className="mt-3 space-y-2 text-[9px] leading-5 text-slate-600">
                <li>
                  ✓ Tối đa 6 ca/tuần, nghỉ tối thiểu 12
                  giờ giữa hai ca.
                </li>
                <li>
                  ✓ Điểm danh check-in trước giờ ca 15
                  phút bằng Zebra TC26.
                </li>
                <li>
                  ✓ Bàn giao ca bắt buộc xác nhận đủ
                  niêm phong Seal RFID.
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}