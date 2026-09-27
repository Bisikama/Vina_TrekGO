"use client";

import { useState } from "react";

type ProfileTab =
  | "personal"
  | "certificates"
  | "security"
  | "performance";

const tabs: {
  id: ProfileTab;
  label: string;
}[] = [
  {
    id: "personal",
    label: "Thông tin cá nhân",
  },
  {
    id: "certificates",
    label: "Chứng chỉ nghiệp vụ",
  },
  {
    id: "security",
    label: "Bảo mật & Phiên đăng nhập",
  },
  {
    id: "performance",
    label: "Hiệu suất vận hành",
  },
];

export function StaffProfile() {
  const [activeTab, setActiveTab] =
    useState<ProfileTab>("personal");

  const [fullName, setFullName] =
    useState("Nguyễn Văn An");

  const [phone, setPhone] =
    useState("0914 882 305");

  const [email, setEmail] = useState(
    "nguyen.van.an@trekgo.vn",
  );

  const [address, setAddress] = useState(
    "Số 45 Đường Hoàng Hoa Thám, Ba Đình, Hà Nội",
  );

  const [bio, setBio] = useState(
    "Nhân viên kho vận phụ trách soạn hàng, kiểm định thiết bị dã ngoại, đóng gói RFID và điều phối hoàn trả tại Hub North-01.",
  );

  const [notifications, setNotifications] =
    useState({
      urgentOrders: true,
      shiftChanges: true,
      maintenance: true,
      emailSummary: false,
    });

  const [saved, setSaved] = useState(false);

  function saveProfile() {
    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1450px]">
        <div className="text-xs text-slate-500">
          Kho vận hệ thống
          <span className="mx-2">›</span>
          Tài khoản
          <span className="mx-2">›</span>
          <strong className="text-slate-900">
            Hồ sơ cá nhân
          </strong>
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative bg-gradient-to-r from-[#0a3f2d] via-[#125238] to-[#287456] px-6 py-8 text-white">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute right-16 top-5 h-32 w-32 rounded-full border-8 border-white" />
              <div className="absolute right-52 top-16 h-20 w-20 rotate-45 border-8 border-white" />
            </div>

            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-[#e8eefb] text-3xl font-black text-[#125238] shadow-lg">
                    AN
                  </div>

                  <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#125238] bg-emerald-400 text-xs text-emerald-950">
                    ✓
                  </span>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-black">
                      Nguyễn Văn An
                    </h1>

                    <span className="rounded-full bg-emerald-300 px-3 py-1 text-[9px] font-black text-emerald-950">
                      NHÂN VIÊN KHO VẬN
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-emerald-100">
                    Thủ kho ca sáng · Hub North-01 Cầu
                    Giấy
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-[9px]">
                    <span className="rounded bg-white/15 px-3 py-1.5">
                      Mã nhân viên: STAFF-WH-0102
                    </span>

                    <span className="rounded bg-white/15 px-3 py-1.5">
                      Gia nhập: 03/2023
                    </span>

                    <span className="rounded bg-white/15 px-3 py-1.5">
                      Trạng thái: Đang trực
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Ca đã trực", "186"],
                  ["Đơn xử lý", "1.248"],
                  ["Độ chính xác", "99.8%"],
                  ["Đánh giá", "4.95/5"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-white/10 p-4 text-center backdrop-blur"
                  >
                    <p className="text-xl font-black">
                      {value}
                    </p>

                    <p className="mt-1 text-[9px] text-emerald-100">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <nav className="flex overflow-x-auto border-t border-slate-100">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`min-w-44 border-b-2 px-5 py-4 text-xs font-bold transition ${
                  activeTab === tab.id
                    ? "border-[#125238] bg-emerald-50 text-[#125238]"
                    : "border-transparent text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </section>

        {saved && (
          <div className="mt-4 rounded-lg bg-emerald-100 p-3 text-xs font-bold text-emerald-900">
            ✓ Đã lưu cập nhật hồ sơ nhân viên.
          </div>
        )}

        {activeTab === "personal" && (
          <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-black">
                  Thông tin cá nhân
                </h2>

                <p className="mt-1 text-[10px] text-slate-500">
                  Thông tin nhận dạng và liên hệ của nhân
                  viên kho vận.
                </p>
              </div>

              <div className="mt-5 rounded-xl bg-[#edf3ff] p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#125238] text-xl font-black text-white">
                      AN
                    </div>

                    <div>
                      <p className="text-xs font-black">
                        Ảnh hồ sơ nhân viên
                      </p>

                      <p className="mt-1 text-[9px] text-slate-500">
                        JPG/PNG dưới 5MB · Ảnh nhìn rõ
                        khuôn mặt.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="rounded-lg bg-white px-4 py-2 text-[10px] font-bold shadow-sm"
                  >
                    Tải ảnh mới
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="staff-name"
                    className="text-[10px] font-bold text-slate-700"
                  >
                    Họ và tên đầy đủ
                  </label>

                  <input
                    id="staff-name"
                    value={fullName}
                    onChange={(event) =>
                      setFullName(event.target.value)
                    }
                    className="mt-2 h-11 w-full rounded-lg bg-[#edf3ff] px-3 text-xs outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label
                    htmlFor="staff-phone"
                    className="text-[10px] font-bold text-slate-700"
                  >
                    Số điện thoại liên lạc
                  </label>

                  <input
                    id="staff-phone"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    className="mt-2 h-11 w-full rounded-lg bg-[#edf3ff] px-3 text-xs outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label
                    htmlFor="staff-email"
                    className="text-[10px] font-bold text-slate-700"
                  >
                    Email công việc
                  </label>

                  <input
                    id="staff-email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    className="mt-2 h-11 w-full rounded-lg bg-[#edf3ff] px-3 text-xs outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label
                    htmlFor="staff-birthday"
                    className="text-[10px] font-bold text-slate-700"
                  >
                    Ngày sinh
                  </label>

                  <input
                    id="staff-birthday"
                    type="date"
                    defaultValue="1996-08-15"
                    className="mt-2 h-11 w-full rounded-lg bg-[#edf3ff] px-3 text-xs outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="staff-address"
                  className="text-[10px] font-bold text-slate-700"
                >
                  Địa chỉ thường trú
                </label>

                <input
                  id="staff-address"
                  value={address}
                  onChange={(event) =>
                    setAddress(event.target.value)
                  }
                  className="mt-2 h-11 w-full rounded-lg bg-[#edf3ff] px-3 text-xs outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="mt-4">
                <label
                  htmlFor="staff-bio"
                  className="text-[10px] font-bold text-slate-700"
                >
                  Giới thiệu nghiệp vụ
                </label>

                <textarea
                  id="staff-bio"
                  value={bio}
                  onChange={(event) =>
                    setBio(event.target.value)
                  }
                  className="mt-2 min-h-28 w-full resize-none rounded-lg bg-[#edf3ff] p-3 text-xs leading-6 outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[#edf3ff] px-5 py-3 text-xs font-bold"
                >
                  Hủy thay đổi
                </button>

                <button
                  type="button"
                  onClick={saveProfile}
                  className="rounded-lg bg-[#125238] px-5 py-3 text-xs font-black text-white"
                >
                  Lưu cập nhật hồ sơ
                </button>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black">
                    Thông tin công việc
                  </h2>

                  <span className="rounded bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-800">
                    Đang hoạt động
                  </span>
                </div>

                <dl className="mt-4 space-y-3 text-[10px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Chức danh
                    </dt>
                    <dd className="text-right font-black">
                      Thủ kho ca sáng
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Bộ phận
                    </dt>
                    <dd className="text-right font-black">
                      Kho vận & Thiết bị
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Hub làm việc
                    </dt>
                    <dd className="text-right font-black">
                      North-01 Cầu Giấy
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Ca mặc định
                    </dt>
                    <dd className="text-right font-black">
                      06:30 – 14:30
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">
                      Quản lý trực tiếp
                    </dt>
                    <dd className="text-right font-black">
                      Trần Quốc Tuấn
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black">
                  Liên hệ khẩn cấp
                </h2>

                <div className="mt-4 rounded-xl bg-[#edf3ff] p-4">
                  <p className="text-xs font-black">
                    Nguyễn Thị Mai
                  </p>

                  <p className="mt-1 text-[9px] text-slate-500">
                    Chị ruột · 0987 221 409
                  </p>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black">
                  Cài đặt thông báo
                </h2>

                <div className="mt-4 space-y-3">
                  {[
                    [
                      "urgentOrders",
                      "Đơn xuất kho khẩn cấp",
                    ],
                    [
                      "shiftChanges",
                      "Thay đổi lịch phân ca",
                    ],
                    [
                      "maintenance",
                      "Thiết bị cần bảo dưỡng",
                    ],
                    [
                      "emailSummary",
                      "Báo cáo tổng hợp qua Email",
                    ],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-[#edf3ff] p-3 text-[10px] font-semibold"
                    >
                      {label}

                      <input
                        type="checkbox"
                        checked={
                          notifications[
                            key as keyof typeof notifications
                          ]
                        }
                        onChange={() =>
                          setNotifications((current) => ({
                            ...current,
                            [key]:
                              !current[
                                key as keyof typeof current
                              ],
                          }))
                        }
                        className="h-4 w-4 accent-[#125238]"
                      />
                    </label>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}

        {activeTab === "certificates" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {[
              {
                title:
                  "Chứng nhận Vận hành Zebra TC26 & RFID",
                code: "WH-RFID-TC26-2026-0102",
                valid: "Hiệu lực đến 20/12/2027",
                color: "bg-emerald-100 text-emerald-800",
              },
              {
                title:
                  "Kiểm định Thiết bị Dã ngoại TrekSafe",
                code: "TREKSAFE-QA-L2-0412",
                valid: "Hiệu lực đến 15/08/2027",
                color: "bg-emerald-100 text-emerald-800",
              },
              {
                title:
                  "Sơ cứu Ngoại viện Cơ bản (WFA)",
                code: "WFA-8842",
                valid: "Hiệu lực đến 20/12/2025",
                color: "bg-orange-100 text-orange-800",
              },
              {
                title:
                  "An toàn Phòng cháy Kho Vật tư",
                code: "PCCC-WH-NORTH-018",
                valid: "Đã xác minh 05/2026",
                color: "bg-emerald-100 text-emerald-800",
              },
            ].map((certificate) => (
              <article
                key={certificate.code}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#125238] text-xl text-white">
                    🏅
                  </div>

                  <div>
                    <h2 className="text-sm font-black">
                      {certificate.title}
                    </h2>

                    <p className="mt-2 font-mono text-[9px] text-slate-500">
                      Mã chứng chỉ: {certificate.code}
                    </p>

                    <span
                      className={`mt-3 inline-flex rounded px-3 py-1 text-[9px] font-bold ${certificate.color}`}
                    >
                      {certificate.valid}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {activeTab === "security" && (
          <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">
                Bảo mật tài khoản
              </h2>

              <div className="mt-5 rounded-xl bg-emerald-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black">
                      Xác thực hai yếu tố (2FA)
                    </p>

                    <p className="mt-1 text-[9px] text-slate-500">
                      Google Authenticator đang hoạt động.
                    </p>
                  </div>

                  <span className="rounded bg-emerald-100 px-3 py-1 text-[9px] font-bold text-emerald-800">
                    Đã bật
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <input
                  type="password"
                  placeholder="Mật khẩu hiện tại"
                  className="h-11 rounded-lg bg-[#edf3ff] px-3 text-xs outline-none"
                />

                <input
                  type="password"
                  placeholder="Mật khẩu mới"
                  className="h-11 rounded-lg bg-[#edf3ff] px-3 text-xs outline-none"
                />

                <input
                  type="password"
                  placeholder="Xác nhận mật khẩu mới"
                  className="h-11 rounded-lg bg-[#edf3ff] px-3 text-xs outline-none"
                />

                <button
                  type="button"
                  className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white"
                >
                  Cập nhật mật khẩu
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">
                  Phiên đăng nhập hoạt động
                </h2>

                <button
                  type="button"
                  className="text-[10px] font-bold text-red-700"
                >
                  Đăng xuất thiết bị khác
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-xl bg-[#edf3ff] p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-xs font-black">
                        Chrome trên Windows 11
                      </p>

                      <p className="mt-1 text-[9px] text-slate-500">
                        Hà Nội · IP 118.70.124.89
                      </p>
                    </div>

                    <span className="rounded bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-800">
                      Thiết bị này
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-[#edf3ff] p-4">
                  <p className="text-xs font-black">
                    TrekOps App · Zebra TC26
                  </p>

                  <p className="mt-1 text-[9px] text-slate-500">
                    Hub North-01 · Hoạt động 2 giờ trước
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "performance" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {[
              {
                label: "Độ chính xác kiểm kê",
                value: "99.8%",
                detail:
                  "Chênh lệch 2/1.248 thiết bị trong 12 tháng.",
              },
              {
                label: "Tốc độ xử lý trung bình",
                value: "7m 42s",
                detail:
                  "Nhanh hơn chuẩn Hub North-01 khoảng 18%.",
              },
              {
                label: "Đánh giá nội bộ",
                value: "4.95/5",
                detail:
                  "Dựa trên 186 ca trực và 42 lượt đánh giá.",
              },
              {
                label: "Đơn xuất kho hoàn tất",
                value: "642",
                detail:
                  "Không có đơn bàn giao sai người nhận.",
              },
              {
                label: "Lô hoàn trả kiểm định",
                value: "318",
                detail:
                  "Tỷ lệ phát hiện đúng hư hại đạt 98.7%.",
              },
              {
                label: "Ca an toàn liên tục",
                value: "94",
                detail:
                  "Không xảy ra tai nạn hoặc thất thoát.",
              },
            ].map((metric) => (
              <article
                key={metric.label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  {metric.label}
                </p>

                <p className="mt-3 text-3xl font-black text-[#125238]">
                  {metric.value}
                </p>

                <p className="mt-3 text-[10px] leading-5 text-slate-600">
                  {metric.detail}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}