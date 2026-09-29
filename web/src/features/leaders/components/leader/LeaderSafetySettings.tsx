"use client";

import { useState } from "react";

type SafetySettings = {
  automaticCheckIn: boolean;
  missedCheckInAlert: boolean;
  weatherWarning: boolean;
  gpsSharing: boolean;
  emergencyContactSharing: boolean;
  equipmentReminder: boolean;
  incidentNotification: boolean;
};

type ToggleProps = {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
};

const initialSettings: SafetySettings = {
  automaticCheckIn: true,
  missedCheckInAlert: true,
  weatherWarning: true,
  gpsSharing: true,
  emergencyContactSharing: true,
  equipmentReminder: true,
  incidentNotification: true,
};

function Toggle({
  checked,
  description,
  label,
  onChange,
}: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h3 className="font-bold text-slate-900">{label}</h3>

        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-[#2f6b4f]" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function SectionHeader({
  description,
  icon,
  title,
}: {
  description: string;
  icon: string;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e9f3ed] text-xl">
        {icon}
      </div>

      <div>
        <h2 className="text-xl font-black text-slate-950">
          {title}
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function ReadinessItem({
  completed,
  description,
  label,
}: {
  completed: boolean;
  description: string;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
          completed
            ? "bg-emerald-600 text-white"
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {completed ? "✓" : "!"}
      </span>

      <div>
        <p className="font-bold text-slate-800">{label}</p>

        <p className="mt-1 text-sm leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

export function LeaderSafetySettings() {
  const [settings, setSettings] =
    useState<SafetySettings>(initialSettings);

  const [saved, setSaved] = useState(false);

  const [sosTested, setSosTested] = useState(false);

  function toggleSetting(setting: keyof SafetySettings) {
    setSettings((current) => ({
      ...current,
      [setting]: !current[setting],
    }));
  }

  function saveSettings() {
    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  function testSos() {
    setSosTested(true);

    window.setTimeout(() => {
      setSosTested(false);
    }, 3000);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Trung tâm Leader
              <span className="mx-2">›</span>
              An toàn VFRS
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Cài đặt an toàn VFRS
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Thiết lập cảnh báo, liên lạc khẩn cấp và quy trình
              giám sát an toàn cho các chuyến trekking.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Hệ thống an toàn đang hoạt động
          </div>
        </div>

        <section className="mt-7 overflow-hidden rounded-3xl bg-gradient-to-br from-[#123f2d] via-[#1e5b40] to-[#347457] p-6 text-white shadow-lg sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl">
                  🛡️
                </span>

                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-200">
                    VFRS Safety Readiness
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    Mức độ sẵn sàng: Tốt
                  </h2>
                </div>
              </div>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-50/80">
                Hồ sơ Leader đã hoàn thành hầu hết yêu cầu an
                toàn. Hãy kiểm tra thiết bị liên lạc trước mỗi
                chuyến đi.
              </p>

              <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[88%] rounded-full bg-emerald-300" />
              </div>

              <div className="mt-2 flex justify-between text-xs font-semibold text-emerald-100">
                <span>Tiến độ hoàn thành</span>
                <span>88%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-2xl font-black">03</p>

                <p className="mt-1 text-xs leading-5 text-emerald-100">
                  Liên hệ khẩn cấp
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-2xl font-black">144.500</p>

                <p className="mt-1 text-xs leading-5 text-emerald-100">
                  Kênh VHF chính
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-2xl font-black">15 phút</p>

                <p className="mt-1 text-xs leading-5 text-emerald-100">
                  Chu kỳ GPS
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-2xl font-black">24/7</p>

                <p className="mt-1 text-xs leading-5 text-emerald-100">
                  Điều phối cứu hộ
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-7 grid gap-7 xl:grid-cols-[1fr_360px]">
          <div className="space-y-7">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <SectionHeader
                icon="📍"
                title="Giám sát hành trình"
                description="Quy định cách hệ thống theo dõi vị trí và trạng thái đoàn."
              />

              <div className="space-y-4">
                <Toggle
                  checked={settings.automaticCheckIn}
                  label="Check-in GPS tự động"
                  description="Gửi vị trí của Leader về trung tâm điều phối theo chu kỳ đã thiết lập."
                  onChange={() =>
                    toggleSetting("automaticCheckIn")
                  }
                />

                <Toggle
                  checked={settings.gpsSharing}
                  label="Chia sẻ vị trí với đoàn"
                  description="Cho phép thành viên đã xác nhận booking xem vị trí Leader trong chuyến đi."
                  onChange={() => toggleSetting("gpsSharing")}
                />

                <Toggle
                  checked={settings.missedCheckInAlert}
                  label="Cảnh báo khi bỏ lỡ check-in"
                  description="Thông báo cho Staff Field nếu Leader không cập nhật vị trí đúng thời gian."
                  onChange={() =>
                    toggleSetting("missedCheckInAlert")
                  }
                />
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Chu kỳ cập nhật GPS
                  </span>

                  <select
                    defaultValue="15"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#2f6b4f] focus:ring-4 focus:ring-[#2f6b4f]/10"
                  >
                    <option value="5">Mỗi 5 phút</option>
                    <option value="10">Mỗi 10 phút</option>
                    <option value="15">Mỗi 15 phút</option>
                    <option value="30">Mỗi 30 phút</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Thời gian chờ trước cảnh báo
                  </span>

                  <select
                    defaultValue="20"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#2f6b4f] focus:ring-4 focus:ring-[#2f6b4f]/10"
                  >
                    <option value="10">10 phút</option>
                    <option value="20">20 phút</option>
                    <option value="30">30 phút</option>
                    <option value="60">60 phút</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <SectionHeader
                icon="🌧️"
                title="Cảnh báo thời tiết"
                description="Thiết lập ngưỡng cảnh báo khi điều kiện thời tiết trở nên nguy hiểm."
              />

              <Toggle
                checked={settings.weatherWarning}
                label="Nhận cảnh báo thời tiết VFRS"
                description="Thông báo khi có mưa lớn, giông sét, lũ quét hoặc gió mạnh trên cung đường."
                onChange={() => toggleSetting("weatherWarning")}
              />

              <div className="mt-5 grid gap-5 md:grid-cols-3">
                <label>
                  <span className="text-sm font-bold text-slate-700">
                    Lượng mưa
                  </span>

                  <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200">
                    <input
                      type="number"
                      defaultValue="50"
                      className="min-w-0 flex-1 px-4 py-3 text-sm outline-none"
                    />

                    <span className="flex items-center bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                      mm
                    </span>
                  </div>
                </label>

                <label>
                  <span className="text-sm font-bold text-slate-700">
                    Tốc độ gió
                  </span>

                  <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200">
                    <input
                      type="number"
                      defaultValue="45"
                      className="min-w-0 flex-1 px-4 py-3 text-sm outline-none"
                    />

                    <span className="flex items-center bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                      km/h
                    </span>
                  </div>
                </label>

                <label>
                  <span className="text-sm font-bold text-slate-700">
                    Tầm nhìn tối thiểu
                  </span>

                  <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200">
                    <input
                      type="number"
                      defaultValue="200"
                      className="min-w-0 flex-1 px-4 py-3 text-sm outline-none"
                    />

                    <span className="flex items-center bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                      mét
                    </span>
                  </div>
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <SectionHeader
                icon="📡"
                title="Kênh liên lạc khẩn cấp"
                description="Tần số và đầu mối liên hệ được sử dụng trong quá trình cứu hộ."
              />

              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <span className="text-sm font-bold text-slate-700">
                    Kênh VHF chính
                  </span>

                  <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200">
                    <input
                      defaultValue="144.500"
                      className="min-w-0 flex-1 px-4 py-3 text-sm outline-none focus:bg-emerald-50/40"
                    />

                    <span className="flex items-center bg-slate-50 px-4 text-sm font-semibold text-slate-500">
                      MHz
                    </span>
                  </div>
                </label>

                <label>
                  <span className="text-sm font-bold text-slate-700">
                    Kênh dự phòng
                  </span>

                  <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200">
                    <input
                      defaultValue="145.800"
                      className="min-w-0 flex-1 px-4 py-3 text-sm outline-none focus:bg-emerald-50/40"
                    />

                    <span className="flex items-center bg-slate-50 px-4 text-sm font-semibold text-slate-500">
                      MHz
                    </span>
                  </div>
                </label>

                <label>
                  <span className="text-sm font-bold text-slate-700">
                    Điều phối viên chính
                  </span>

                  <input
                    defaultValue="Trần Minh Khoa"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2f6b4f] focus:ring-4 focus:ring-[#2f6b4f]/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-slate-700">
                    Hotline cứu hộ
                  </span>

                  <input
                    defaultValue="1900 636 789"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2f6b4f] focus:ring-4 focus:ring-[#2f6b4f]/10"
                  />
                </label>
              </div>

              <div className="mt-5">
                <Toggle
                  checked={settings.emergencyContactSharing}
                  label="Chia sẻ liên hệ khẩn cấp"
                  description="Cho phép trung tâm VFRS truy cập danh sách liên hệ khẩn cấp khi có sự cố."
                  onChange={() =>
                    toggleSetting("emergencyContactSharing")
                  }
                />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <SectionHeader
                icon="🎒"
                title="Nhắc nhở trước chuyến đi"
                description="Tự động kiểm tra các yêu cầu an toàn trước giờ khởi hành."
              />

              <div className="space-y-4">
                <Toggle
                  checked={settings.equipmentReminder}
                  label="Nhắc kiểm tra thiết bị"
                  description="Yêu cầu Leader xác nhận bộ sơ cứu, bộ đàm, pin dự phòng và thiết bị định vị."
                  onChange={() =>
                    toggleSetting("equipmentReminder")
                  }
                />

                <Toggle
                  checked={settings.incidentNotification}
                  label="Thông báo sự cố cho Staff Field"
                  description="Gửi sự kiện bất thường cho nhân sự hiện trường và trung tâm điều phối."
                  onChange={() =>
                    toggleSetting("incidentNotification")
                  }
                />
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">
                Kiểm tra sẵn sàng
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Trạng thái hồ sơ an toàn hiện tại.
              </p>

              <div className="mt-5 space-y-3">
                <ReadinessItem
                  completed
                  label="Hồ sơ y tế"
                  description="Đã cập nhật ngày 25/09/2026."
                />

                <ReadinessItem
                  completed
                  label="Liên hệ khẩn cấp"
                  description="Đã xác minh 3 số điện thoại."
                />

                <ReadinessItem
                  completed
                  label="Chứng chỉ sơ cứu"
                  description="Còn hiệu lực đến 05/2028."
                />

                <ReadinessItem
                  completed={false}
                  label="Kiểm tra bộ đàm"
                  description="Chưa kiểm tra trong 30 ngày gần nhất."
                />
              </div>
            </section>

            <section className="rounded-3xl border border-red-200 bg-red-50 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-2xl">
                🆘
              </div>

              <h2 className="mt-4 text-lg font-black text-red-950">
                Kiểm tra tín hiệu SOS
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-800">
                Thao tác này chỉ mô phỏng kết nối và không gửi yêu
                cầu cứu hộ thật.
              </p>

              <button
                type="button"
                onClick={testSos}
                className="mt-5 w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white transition hover:bg-red-800"
              >
                {sosTested
                  ? "✓ Kết nối SOS ổn định"
                  : "Chạy kiểm tra SOS"}
              </button>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">
                Hỗ trợ VFRS
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Liên hệ trung tâm điều phối nếu cần thay đổi quy
                trình an toàn cho chuyến đi đặc biệt.
              </p>

              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-bold text-slate-800">
                    Hotline
                  </p>

                  <p className="mt-1 text-slate-500">
                    1900 636 789
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-bold text-slate-800">
                    Email
                  </p>

                  <p className="mt-1 break-all text-slate-500">
                    safety@trekgo.vn
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div className="sticky bottom-4 mt-7 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Các thay đổi chỉ áp dụng cho những chuyến chưa bắt
            đầu.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSettings(initialSettings)}
              className="flex-1 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
            >
              Khôi phục
            </button>

            <button
              type="button"
              onClick={saveSettings}
              className="flex-1 rounded-xl bg-[#2f6b4f] px-6 py-3 text-sm font-black text-white transition hover:bg-[#24573f] sm:flex-none"
            >
              Lưu cài đặt
            </button>
          </div>
        </div>
      </div>

      {saved && (
        <div className="fixed bottom-24 right-6 z-50 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-2xl">
          ✓ Đã lưu cài đặt an toàn VFRS
        </div>
      )}
    </main>
  );
}