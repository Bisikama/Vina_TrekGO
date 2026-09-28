"use client";

import Link from "next/link";
import { useState } from "react";

type LeaderTripSettlementProps = {
  tripId: string;
};

type MemberPayment = {
  id: string;
  name: string;
  phone: string;
  amount: number;
  method: string;
  services: string;
};

const memberPayments: MemberPayment[] = [
  {
    id: "TK-TX-01",
    name: "Phạm Thị Loan",
    phone: "0912.***.881",
    amount: 2_850_000,
    method: "VNPay-QR",
    services: "Lều cá nhân Naturehike, Gậy trekking",
  },
  {
    id: "TK-TX-02",
    name: "Đinh Thùy Linh",
    phone: "0984.***.219",
    amount: 2_850_000,
    method: "Chuyển khoản VietQR",
    services: "Túi ngủ -5°C, Đèn pin đội đầu",
  },
  {
    id: "TK-TX-03",
    name: "Vũ Đức Khánh",
    phone: "0903.***.672",
    amount: 2_850_000,
    method: "Thẻ Visa/Mastercard",
    services: "Suất ăn chay dã ngoại x3 ngày",
  },
  {
    id: "TK-TX-04",
    name: "Trần Minh Hoàng",
    phone: "0938.***.990",
    amount: 2_850_000,
    method: "Ví MoMo Smart",
    services: "Balo Osprey 50L, Gậy leo núi đôi",
  },
  {
    id: "TK-TX-05",
    name: "Nguyễn Phương Anh",
    phone: "0975.***.112",
    amount: 2_850_000,
    method: "VNPay-QR",
    services: "Gói bảo hiểm mở rộng Rescue Plus",
  },
  {
    id: "TK-TX-06",
    name: "Lê Hải Đăng",
    phone: "0918.***.438",
    amount: 2_850_000,
    method: "Chuyển khoản VietQR",
    services: "Không thuê thêm thiết bị",
  },
  {
    id: "TK-TX-07",
    name: "Đỗ Thu Thảo",
    phone: "0942.***.773",
    amount: 2_850_000,
    method: "Thẻ Visa/Mastercard",
    services: "Túi ngủ ấm, Áo mưa bộ dã ngoại",
  },
  {
    id: "TK-TX-08",
    name: "Hoàng Quốc Bảo",
    phone: "0961.***.554",
    amount: 2_850_000,
    method: "Ví MoMo Smart",
    services: "Balo trekking 35L",
  },
  {
    id: "TK-TX-09",
    name: "Nguyễn Minh Khoa",
    phone: "0908.***.127",
    amount: 2_850_000,
    method: "VNPay-QR",
    services: "Lều đôi, Đệm cách nhiệt",
  },
  {
    id: "TK-TX-10",
    name: "Trần Ngọc Mai",
    phone: "0932.***.776",
    amount: 2_850_000,
    method: "Chuyển khoản VietQR",
    services: "Gậy trekking, Găng tay",
  },
  {
    id: "TK-TX-11",
    name: "Lý Hoàng Nam",
    phone: "0977.***.290",
    amount: 2_850_000,
    method: "Thẻ Visa/Mastercard",
    services: "Không thuê thêm thiết bị",
  },
  {
    id: "TK-TX-12",
    name: "Bùi Thanh Trúc",
    phone: "0914.***.641",
    amount: 2_850_000,
    method: "VNPay-QR",
    services: "Túi ngủ, Đèn pin đội đầu",
  },
];

const settlementItems = [
  {
    label: "Tổng thu từ 12 Trekker",
    amount: 34_200_000,
    type: "income",
  },
  {
    label: "Phí nền tảng VFRS (10%)",
    amount: -3_420_000,
    type: "expense",
  },
  {
    label: "Đối soát thuê thiết bị",
    amount: -2_850_000,
    type: "expense",
  },
  {
    label: "Thưởng hoàn thành an toàn",
    amount: 1_000_000,
    type: "bonus",
  },
  {
    label: "Phụ cấp Porter",
    amount: 500_000,
    type: "bonus",
  },
];

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(
    Math.abs(value),
  )}₫`;
}

export function LeaderTripSettlement({
  tripId,
}: LeaderTripSettlementProps) {
  const cleanTripId = tripId.replace(/^#/, "");

  const [showConfirmModal, setShowConfirmModal] =
    useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [downloadMessage, setDownloadMessage] =
    useState(false);

  function handleSubmitSettlement() {
    setShowConfirmModal(false);
    setSubmitted(true);
  }

  function handleDownload() {
    setDownloadMessage(true);

    window.setTimeout(() => {
      setDownloadMessage(false);
    }, 2500);
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Link
              href="/leader"
              className="hover:text-[#125238]"
            >
              Quản lý dẫn đoàn
            </Link>

            <span>›</span>

            <Link
              href="/leader/trips"
              className="hover:text-[#125238]"
            >
              Chuyến đi của tôi
            </Link>

            <span>›</span>

            <Link
              href={`/leader/trips/${cleanTripId}`}
              className="hover:text-[#125238]"
            >
              #{cleanTripId}
            </Link>

            <span>›</span>

            <span className="font-semibold text-[#125238]">
              Quyết toán & Thù lao
            </span>
          </nav>

          <div className="mt-5 flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-[#125238]">
                  MÃ HÓA ĐƠN: #INV-TX2411-VFRS
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    submitted
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-orange-100 text-orange-800"
                  }`}
                >
                  ●{" "}
                  {submitted
                    ? "Đã gửi yêu cầu giải ngân"
                    : "Chờ Leader xác nhận quyết toán"}
                </span>

                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  ✓ Hoàn thành an toàn 100%
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                Quyết toán chuyến đi: Chinh phục Sống Lưng
                Khủng Long Tà Xùa
              </h1>

              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                <span>▣ 15/11/2024 – 17/11/2024 (3N2Đ)</span>
                <span>•</span>
                <span>♟ 12/12 thành viên</span>
                <span>•</span>
                <span className="font-semibold text-[#125238]">
                  ◈ VFRS Escrow bảo hộ
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
              >
                ⇩ Tải hóa đơn PDF
              </button>

              <button
                type="button"
                disabled={submitted}
                onClick={() => setShowConfirmModal(true)}
                className="h-11 rounded-xl bg-[#125238] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#2f6b4f] disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitted
                  ? "✓ Đã gửi yêu cầu"
                  : "Xác nhận & Gửi yêu cầu giải ngân"}
              </button>
            </div>
          </div>
        </section>

        {submitted && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#125238] text-xl text-white">
                ✓
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-emerald-950">
                    Đã gửi hồ sơ quyết toán thành công!
                  </h2>

                  <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-[#125238]">
                    #STL-2024-8891-VN
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  Số dư ròng{" "}
                  <strong>29.430.000₫</strong> đã được
                  chuyển đến Ban Tài chính & Giám sát ký quỹ
                  VFRS. Tiền sẽ được giải ngân trong vòng 24
                  giờ làm việc.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tổng thu từ Trekker
              </span>

              <span className="text-xl">◉</span>
            </div>

            <p className="mt-5 text-2xl font-bold text-slate-950">
              34.200.000₫
            </p>

            <p className="mt-2 text-xs text-slate-500">
              ✓ 12/12 thành viên, 100% Escrow
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Phí sàn VFRS (10%)
              </span>

              <span className="text-xl">◇</span>
            </div>

            <p className="mt-5 text-2xl font-bold text-slate-950">
              -3.420.000₫
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Bao gồm bảo hiểm dã ngoại
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Thu hộ thiết bị trừ cọc
              </span>

              <span className="text-xl">♙</span>
            </div>

            <p className="mt-5 text-2xl font-bold text-slate-950">
              -2.850.000₫
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Đối soát kho trung chuyển Tà Xùa
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-[#125238] p-5 text-white shadow-lg">
            <div className="absolute -bottom-12 -right-12 h-36 w-36 rounded-full bg-white/5" />

            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                  Thực nhận của Leader
                </span>

                <span className="rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-bold text-[#125238]">
                  NET PAYOUT
                </span>
              </div>

              <p className="mt-5 text-2xl font-bold">
                29.430.000₫
              </p>

              <p className="mt-2 text-xs text-emerald-100">
                ✓ Đã cộng thưởng và phụ cấp Porter
              </p>
            </div>
          </div>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Chi tiết đóng góp thành viên
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Tất cả thanh toán được giữ an toàn qua
                  cổng VFRS Escrow.
                </p>
              </div>

              <span className="w-fit rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-bold text-[#125238]">
                100% ĐÃ KÝ QUỸ
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-left">
                <thead className="bg-[#eef3fb] text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-5 py-4">
                      STT & Trekker
                    </th>
                    <th className="px-5 py-4">
                      Số tiền
                    </th>
                    <th className="px-5 py-4">
                      Phương thức
                    </th>
                    <th className="px-5 py-4">
                      Dịch vụ & Thiết bị
                    </th>
                    <th className="px-5 py-4 text-right">
                      Trạng thái
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {memberPayments.map((member, index) => (
                    <tr
                      key={member.id}
                      className="border-t border-slate-100 text-sm hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex gap-3">
                          <span className="text-xs text-slate-400">
                            {String(index + 1).padStart(
                              2,
                              "0",
                            )}
                          </span>

                          <div>
                            <strong className="text-slate-900">
                              {member.name}
                            </strong>

                            <p className="mt-1 font-mono text-xs text-slate-400">
                              {member.id} • {member.phone}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {formatCurrency(member.amount)}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {member.method}
                        </span>
                      </td>

                      <td className="max-w-[240px] px-5 py-4 text-xs leading-5 text-slate-500">
                        {member.services}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          Đã cọc 100%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Tổng hợp quyết toán
              </h2>

              <div className="mt-5 space-y-4">
                {settlementItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex justify-between gap-4 text-sm"
                  >
                    <span className="text-slate-500">
                      {item.label}
                    </span>

                    <strong
                      className={
                        item.type === "income" ||
                        item.type === "bonus"
                          ? "text-[#125238]"
                          : "text-red-600"
                      }
                    >
                      {item.amount > 0 ? "+" : "-"}
                      {formatCurrency(item.amount)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="my-5 border-t border-dashed border-slate-300" />

              <div className="flex items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500">
                    Thực nhận
                  </span>

                  <p className="mt-1 text-xs text-slate-400">
                    Sau tất cả khấu trừ
                  </p>
                </div>

                <strong className="text-2xl text-[#125238]">
                  29.430.000₫
                </strong>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-950">
                Tài khoản nhận tiền
              </h2>

              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500">
                      Vietcombank
                    </p>

                    <p className="mt-1 font-mono font-bold text-slate-950">
                      ******8821
                    </p>
                  </div>

                  <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-[#125238]">
                    Đã xác minh
                  </span>
                </div>

                <p className="mt-3 text-sm font-semibold text-slate-800">
                  NGUYEN HUNG
                </p>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Tiền giải ngân chỉ được chuyển vào tài khoản
                đã xác minh của Leader.
              </p>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <h2 className="font-bold text-orange-950">
                Thời gian giải ngân
              </h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="font-bold text-orange-700">
                    01
                  </span>
                  <span className="text-orange-900">
                    Leader xác nhận quyết toán.
                  </span>
                </div>

                <div className="flex gap-3">
                  <span className="font-bold text-orange-700">
                    02
                  </span>
                  <span className="text-orange-900">
                    VFRS kiểm tra trong 2–4 giờ.
                  </span>
                </div>

                <div className="flex gap-3">
                  <span className="font-bold text-orange-700">
                    03
                  </span>
                  <span className="text-orange-900">
                    Chuyển khoản trong 24 giờ làm việc.
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={submitted}
              onClick={() => setShowConfirmModal(true)}
              className="h-12 w-full rounded-xl bg-[#125238] px-5 text-sm font-bold text-white shadow-md transition hover:bg-[#2f6b4f] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitted
                ? "✓ Hồ sơ đã được gửi"
                : "Xác nhận & Gửi yêu cầu giải ngân"}
            </button>
          </aside>
        </section>
      </div>

      {downloadMessage && (
        <div className="fixed bottom-6 right-6 z-[80] rounded-xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          ✓ Đã tạo hóa đơn PDF mẫu.
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-5 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-[#125238]">
              ₫
            </div>

            <h2 className="mt-4 text-xl font-bold text-slate-950">
              Xác nhận gửi yêu cầu giải ngân?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ngin xác nhận thông tin quyết toán là chính xác
              và đồng ý nhận số tiền thực tế:
            </p>

            <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center">
              <span className="text-xs font-bold uppercase text-slate-500">
                Tổng tiền thực nhận
              </span>

              <p className="mt-2 text-3xl font-bold text-[#125238]">
                29.430.000₫
              </p>
            </div>

            <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-600">
              <input
                type="checkbox"
                defaultChecked
                className="mt-1 h-4 w-4 accent-[#125238]"
              />

              Tôi đã kiểm tra chi tiết thành viên, các khoản
              phí và tài khoản nhận tiền.
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700"
              >
                Kiểm tra lại
              </button>

              <button
                type="button"
                onClick={handleSubmitSettlement}
                className="h-11 rounded-xl bg-[#125238] px-5 text-sm font-bold text-white hover:bg-[#2f6b4f]"
              >
                Xác nhận gửi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}