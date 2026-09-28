"use client";

import { useState } from "react";

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 text-sm text-slate-900 outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#2f6b4f]/15";

const certificates = [
  {
    title: "Wilderness First Aid (WFA)",
    issuer: "VFRS-8842",
    expiry: "20/12/2025",
    status: "Còn hiệu lực",
  },
  {
    title: "Định vị GPS & Bản đồ Địa hình Offline",
    issuer: "NAV-0391",
    expiry: "Không thời hạn",
    status: "Đã xác minh",
  },
  {
    title: "Điều phối & Cứu hộ Đoàn Trekking",
    issuer: "RESCUE-2214",
    expiry: "18/08/2027",
    status: "Còn hiệu lực",
  },
];

export function LeaderProfile() {
  const [activeTab, setActiveTab] =
    useState("personal");

  const [saved, setSaved] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] =
    useState(true);

  function saveProfile() {
    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Trang chủ
            <span className="mx-2">›</span>
            Tài khoản
            <span className="mx-2">›</span>
            <strong className="text-[#125238]">
              Hồ sơ cá nhân
            </strong>
          </div>

          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-[#125238]">
            ● Hệ thống dữ liệu đồng bộ
          </span>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div
            className="relative min-h-[270px] bg-cover bg-center"
            style={{
              backgroundImage:
                'linear-gradient(to top, rgba(15,23,42,.8), rgba(15,23,42,.05)), url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=85")',
            }}
          >
            <span className="absolute right-5 top-5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#125238] shadow">
              ◈ CCCD xác thực điện tử
            </span>

            <div className="absolute inset-x-0 bottom-0 flex flex-col justify-between gap-5 p-6 text-white md:flex-row md:items-end">
              <div className="flex items-end gap-5">
                <div
                  className="h-28 w-28 shrink-0 rounded-2xl border-4 border-white bg-cover bg-center shadow-xl"
                  style={{
                    backgroundImage:
                      'url("https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80")',
                  }}
                />

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold">
                      Nguyễn Hùng
                    </h1>

                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#125238]">
                      Leader PRO
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-200">
                    ✓ Đã xác thực CCCD/VNeID • Leader ID:
                    LK-882
                  </p>

                  <p className="mt-2 text-sm font-semibold">
                    Vai trò: Leader hệ thống / Trekker
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white/90 p-4 text-slate-900 backdrop-blur md:grid-cols-4">
                <div>
                  <span className="text-[10px] uppercase text-slate-500">
                    Hành trình
                  </span>
                  <strong className="block text-lg">
                    8 chuyến
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-slate-500">
                    Tổng cự ly
                  </span>
                  <strong className="block text-lg">
                    184 km
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-slate-500">
                    Nhóm máu
                  </span>
                  <strong className="block text-lg text-red-600">
                    O+
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-slate-500">
                    Chứng chỉ
                  </span>
                  <strong className="block text-lg text-[#125238]">
                    3
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex overflow-x-auto border-t border-slate-100 p-2">
            {[
              ["personal", "Thông tin cá nhân"],
              ["medical", "Y tế & Khẩn cấp"],
              ["security", "Bảo mật & Phiên đăng nhập"],
              ["certificates", "Hồ sơ Leader & Chứng chỉ"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`min-w-max rounded-xl px-5 py-3 text-sm font-semibold transition ${
                  activeTab === value
                    ? "bg-[#125238] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </section>

        <section className="mt-5 flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-emerald-950">
                Tài khoản được duyệt quyền Leader PRO
              </h2>

              <span className="rounded bg-emerald-200 px-2 py-1 text-[10px] font-bold text-emerald-900">
                CỤM PHÍA BẮC
              </span>
            </div>

            <p className="mt-1 text-sm text-emerald-800">
              Chứng chỉ WFA và năng lực dẫn đoàn còn hiệu
              lực đến ngày 20/12/2025.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab("certificates")}
            className="h-11 rounded-xl bg-[#125238] px-5 text-sm font-bold text-white"
          >
            Xem hồ sơ chuyên môn
          </button>
        </section>

        {activeTab === "personal" && (
          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Thông tin cá nhân
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Thông tin nhận dạng và giấy tờ pháp lý.
                </p>
              </div>

              <div className="mt-5 rounded-xl bg-[#eef3fb] p-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <strong className="text-sm text-slate-900">
                      Ảnh đại diện thẻ leo núi
                    </strong>

                    <p className="mt-1 text-xs text-slate-500">
                      Hỗ trợ JPG, PNG dưới 5MB.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="h-10 rounded-lg bg-white px-4 text-xs font-bold text-slate-700"
                  >
                    ⇧ Tải ảnh mới
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    Họ và tên đầy đủ
                  </span>

                  <input
                    className={inputClass}
                    defaultValue="Nguyễn Hùng"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    Số điện thoại liên lạc
                  </span>

                  <input
                    className={inputClass}
                    defaultValue="001096012345"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    Email
                  </span>

                  <input
                    type="email"
                    className={inputClass}
                    defaultValue="nguyen.hung@trekgo.vn"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    Ngày sinh
                  </span>

                  <input
                    type="date"
                    className={inputClass}
                    defaultValue="1996-08-15"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    Giới tính
                  </span>

                  <select
                    className={inputClass}
                    defaultValue="male"
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    Khu vực vận hành
                  </span>

                  <select
                    className={inputClass}
                    defaultValue="north"
                  >
                    <option value="north">
                      Cụm phía Bắc
                    </option>
                    <option value="central">
                      Cụm miền Trung
                    </option>
                    <option value="south">
                      Cụm phía Nam
                    </option>
                  </select>
                </label>

                <label className="md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">
                    Địa chỉ thường trú
                  </span>

                  <input
                    className={inputClass}
                    defaultValue="Số 45 Đường Hoàng Hoa Thám, Ba Đình, Hà Nội"
                  />
                </label>

                <label className="md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">
                    Giới thiệu bản thân
                  </span>

                  <textarea
                    rows={5}
                    className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] p-4 text-sm leading-6 outline-none focus:border-[#2f6b4f]"
                    defaultValue="Leader trekking khu vực phía Bắc, có kinh nghiệm dẫn đoàn tại Fansipan, Tà Xùa và Lảo Thẩn. Có kỹ năng cắm trại dã ngoại và cứu hộ sinh tồn cơ bản."
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-slate-950">
                Y tế & Cứu hộ khẩn cấp
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Dữ liệu phục vụ trường hợp khẩn cấp.
              </p>

              <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-900">
                Dữ liệu y tế được mã hóa và chỉ hiển thị cho
                Leader phụ trách đoàn hoặc đội cứu hộ.
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <span className="text-xs text-slate-500">
                    Người liên hệ khẩn cấp
                  </span>

                  <strong className="mt-1 block text-slate-950">
                    Nguyễn Thị Mai
                  </strong>

                  <p className="mt-1 text-xs text-slate-500">
                    Chị ruột • 0908.***.281
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-red-50 p-4">
                    <span className="text-xs text-slate-500">
                      Nhóm máu
                    </span>

                    <strong className="mt-1 block text-xl text-red-700">
                      O+
                    </strong>

                    <span className="text-[10px] text-emerald-700">
                      Đã xác thực xét nghiệm
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <span className="text-xs text-slate-500">
                      Thể lực & độ cao
                    </span>

                    <strong className="mt-1 block text-lg">
                      &lt; 3.000m
                    </strong>

                    <span className="text-[10px] text-slate-500">
                      Không say độ cao nhẹ
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-700">
                    Cấp độ năng lực leo núi
                  </span>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-3/5 rounded-full bg-[#125238]" />
                  </div>

                  <div className="mt-2 flex justify-between text-xs">
                    <span>Trung cấp</span>
                    <strong>Cấp độ 3/5</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "medical" && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">
              Hồ sơ Y tế & Liên hệ khẩn cấp
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold">
                  Nhóm máu
                </span>

                <select
                  className={inputClass}
                  defaultValue="o-positive"
                >
                  <option value="o-positive">O+</option>
                  <option value="a-positive">A+</option>
                  <option value="b-positive">B+</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">
                  Số điện thoại khẩn cấp
                </span>

                <input
                  className={inputClass}
                  defaultValue="0908123281"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold">
                  Tiền sử dị ứng và ghi chú thuốc men
                </span>

                <textarea
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] p-4 text-sm leading-6 outline-none focus:border-[#2f6b4f]"
                  defaultValue="Dị ứng nhẹ với phấn hoa vào mùa xuân. Đã tiêm ngừa uốn ván tháng 05/2023. Không có tiền sử hen suyễn hoặc bệnh tim mạch."
                />
              </label>
            </div>
          </section>
        )}

        {activeTab === "security" && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Bảo mật & Phiên đăng nhập
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Quản lý mật khẩu, xác thực hai lớp và các
                  thiết bị đang hoạt động.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setTwoFactorEnabled((current) => !current)
                }
                className={`rounded-xl px-4 py-2 text-sm font-bold ${
                  twoFactorEnabled
                    ? "bg-emerald-100 text-[#125238]"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                2FA:{" "}
                {twoFactorEnabled ? "Đang bật" : "Đang tắt"}
              </button>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <input
                type="password"
                className={inputClass}
                defaultValue="123456789"
              />

              <input
                type="password"
                className={inputClass}
                placeholder="Mật khẩu mới"
              />

              <input
                type="password"
                className={inputClass}
                placeholder="Nhập lại mật khẩu mới"
              />
            </div>

            <div className="mt-6 space-y-3">
              {[
                {
                  device: "Chrome trên Windows 11",
                  location: "TP.HCM, Việt Nam",
                  current: true,
                },
                {
                  device: "Trekking System App – iPhone",
                  location: "Hà Nội, Việt Nam",
                  current: false,
                },
              ].map((session) => (
                <div
                  key={session.device}
                  className="flex items-center justify-between rounded-xl bg-[#eef3fb] p-4"
                >
                  <div>
                    <strong className="text-sm text-slate-900">
                      {session.device}
                    </strong>

                    <p className="mt-1 text-xs text-slate-500">
                      {session.location}
                    </p>
                  </div>

                  <span
                    className={`text-xs font-bold ${
                      session.current
                        ? "text-[#125238]"
                        : "text-red-600"
                    }`}
                  >
                    {session.current
                      ? "Thiết bị này"
                      : "Đăng xuất"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "certificates" && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Chứng chỉ dã ngoại & Hồ sơ Leader
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Bằng cấp, kỹ năng sinh tồn và an toàn được
                  VFRS xác nhận.
                </p>
              </div>

              <button
                type="button"
                className="h-11 rounded-xl bg-[#125238] px-5 text-sm font-bold text-white"
              >
                ＋ Tải chứng chỉ mới
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {certificates.map((certificate) => (
                <article
                  key={certificate.issuer}
                  className="rounded-2xl border border-slate-200 bg-[#eef3fb] p-5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#125238] text-xl text-white">
                    ✦
                  </div>

                  <h3 className="mt-4 font-bold text-slate-950">
                    {certificate.title}
                  </h3>

                  <p className="mt-2 text-xs text-slate-500">
                    Số hiệu: {certificate.issuer}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Hạn kiểm định: {certificate.expiry}
                  </p>

                  <span className="mt-4 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#125238]">
                    ✓ {certificate.status}
                  </span>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-xl bg-orange-50 p-4">
              <strong className="text-orange-950">
                Đánh giá tín cậy thành viên: 4.95/5.0
              </strong>

              <p className="mt-1 text-xs text-orange-800">
                Từ 46 nhận xét sau 8 hành trình dã ngoại.
              </p>
            </div>
          </section>
        )}

        <footer className="sticky bottom-0 z-30 mt-6 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center">
          <p className="text-xs text-slate-500">
            ● Bạn có thông tin vừa cập nhật chưa lưu.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              className="h-11 rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700"
            >
              Hủy thay đổi
            </button>

            <button
              type="button"
              onClick={saveProfile}
              className="h-11 rounded-xl bg-[#125238] px-6 text-sm font-bold text-white"
            >
              ✓ Lưu cập nhật hồ sơ
            </button>
          </div>
        </footer>
      </div>

      {saved && (
        <div className="fixed bottom-24 right-6 z-[80] rounded-xl bg-[#125238] px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          ✓ Đã lưu cập nhật hồ sơ Leader.
        </div>
      )}
    </main>
  );
}