'use client';

import React, { useEffect } from "react";
import Link from "next/link";
import { TripData } from "@/features/trips/data/mockTripsData";
import { MemberData } from "./BookingPaymentStep";

interface BookingFormProps {
  participants?: number;
  trip?: TripData | null;
  members: MemberData[];
  onMemberChange: (index: number, field: keyof MemberData, value: string) => void;
  onEquipmentCostChange?: (cost: number) => void;
  onNextStep: () => void;
}

export const BookingForm = ({
  participants = 1,
  trip,
  members,
  onMemberChange,
  onEquipmentCostChange,
  onNextStep,
}: BookingFormProps) => {
  useEffect(() => {
    if (onEquipmentCostChange) {
      onEquipmentCostChange(0);
    }
  }, [onEquipmentCostChange]);

  const memberCount = Math.max(1, participants);

  return (
    <div className="flex-1 space-y-6">
      {/* Danh sách form thành viên theo đúng số lượng đã chọn ở trang chi tiết */}
      {Array.from({ length: memberCount }).map((_, index) => {
        const isPrimary = index === 0;
        const memberNumber = String(index + 1).padStart(2, "0");
        const currentMember = members[index] || {
          name: isPrimary ? "Nguyễn Hùng" : "",
          phone: isPrimary ? "0912 345 678" : "",
          sosContact: isPrimary
            ? "Nguyễn Thị Mai - 0988 123 456 (Chị ruột)"
            : "",
          medicalNote: isPrimary
            ? "Thể lực tốt, thường xuyên chạy bộ, không say độ cao"
            : "",
          shirtSize: "Nam - Size L (1m68 - 1m75 | 65 - 73kg)",
          pickupPoint: "Bến xe Mỹ Đình, Cổng số 2, Nam Từ Liêm, Hà Nội",
        };

        return (
          <div
            key={index}
            className={`relative rounded-xl bg-white p-6 shadow-sm border ${
              isPrimary ? "border-gray-200" : "border-gray-200"
            }`}
          >
            <div className="mb-6 flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                  isPrimary ? "bg-[#125238]" : "bg-emerald-700"
                }`}
              >
                {memberNumber}
              </div>

              <div>
                <h3 className="font-bold text-gray-900">
                  {isPrimary
                    ? `${currentMember.name || "Nguyễn Hùng"} (Người đặt chỗ chính)`
                    : `Thành viên đồng hành #${index + 1}`}
                </h3>
                <p className="text-xs text-gray-500">
                  {isPrimary
                    ? "Tài khoản cá nhân đặt chỗ và người đại diện liên lạc"
                    : "Khai báo thông tin thành viên để xuất vé kiểm lâm & bảo hiểm y tế"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Họ và tên đầy đủ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentMember.name}
                  onChange={(e) =>
                    onMemberChange(index, "name", e.target.value)
                  }
                  placeholder="Nhập họ và tên đầy đủ..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Số điện thoại liên lạc <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentMember.phone}
                  onChange={(e) =>
                    onMemberChange(index, "phone", e.target.value)
                  }
                  placeholder="Nhập số điện thoại..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Người liên hệ khẩn cấp (SOS) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentMember.sosContact}
                  onChange={(e) =>
                    onMemberChange(index, "sosContact", e.target.value)
                  }
                  placeholder="Tên, số điện thoại & mối quan hệ của người thân..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Tình trạng thể lực & tiền sử y khoa
                </label>
                <input
                  type="text"
                  value={currentMember.medicalNote}
                  onChange={(e) =>
                    onMemberChange(index, "medicalNote", e.target.value)
                  }
                  placeholder="Tiền sử dị ứng, hen suyễn, đau khớp gối hoặc lưu ý y tế..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Kích thước áo đồng phục Trekking
                </label>
                <select
                  value={currentMember.shirtSize}
                  onChange={(e) =>
                    onMemberChange(index, "shirtSize", e.target.value)
                  }
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                >
                  <option value="Nam - Size L (1m68 - 1m75 | 65 - 73kg)">
                    Nam - Size L (1m68 - 1m75 | 65 - 73kg)
                  </option>
                  <option value="Nam - Size M (1m60 - 1m68 | 55 - 65kg)">
                    Nam - Size M (1m60 - 1m68 | 55 - 65kg)
                  </option>
                  <option value="Nam - Size XL (1m75 - 1m85 | 73 - 85kg)">
                    Nam - Size XL (1m75 - 1m85 | 73 - 85kg)
                  </option>
                  <option value="Nữ - Size S (1m50 - 1m58 | 42 - 48kg)">
                    Nữ - Size S (1m50 - 1m58 | 42 - 48kg)
                  </option>
                  <option value="Nữ - Size M (1m58 - 1m65 | 48 - 55kg)">
                    Nữ - Size M (1m58 - 1m65 | 48 - 55kg)
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Điểm đón đoàn xe Limousine giường nằm
                </label>
                <select
                  value={currentMember.pickupPoint}
                  onChange={(e) =>
                    onMemberChange(index, "pickupPoint", e.target.value)
                  }
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                >
                  <option value="Bến xe Mỹ Đình, Cổng số 2, Nam Từ Liêm, Hà Nội">
                    Bến xe Mỹ Đình, Cổng số 2, Nam Từ Liêm, Hà Nội
                  </option>
                  <option value="Cổng công viên Cầu Giấy (Đường Thành Thái)">
                    Cổng công viên Cầu Giấy (Đường Thành Thái)
                  </option>
                  <option value="Trạm dừng chân Hòa Lạc (Thạch Thất)">
                    Trạm dừng chân Hòa Lạc (Thạch Thất)
                  </option>
                  <option value="Điểm tập kết trực tiếp tại chân núi">
                    Điểm tập kết trực tiếp tại chân núi
                  </option>
                </select>
              </div>
            </div>
          </div>
        );
      })}

      {/* Cam kết an toàn VFRS */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
        <div className="flex items-start gap-3">
          <svg
            className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h5 className="font-semibold text-blue-950">
              Cam kết an toàn & Bảo hộ y tế VFRS
            </h5>
            <div className="mt-3 space-y-2.5">
              <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="mt-1 h-4 w-4 rounded accent-[#125238]"
                />
                <span>
                  Tôi xác nhận tất cả thành viên trong đoàn có đủ điều kiện thể
                  lực tham gia hành trình và đồng ý tuân thủ quy chuẩn an toàn
                  VFRS.
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="mt-1 h-4 w-4 rounded accent-[#125238]"
                />
                <span>
                  Tuân thủ tuyệt đối chỉ dẫn của Leader và đội ngũ hỗ trợ trong
                  suốt quá trình di chuyển trên toàn tuyến.
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Link
          href={trip?.id ? `/trips/${trip.id}` : "/trips"}
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Quay lại chi tiết chuyến đi
        </Link>

        <button
          type="button"
          onClick={onNextStep}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#125238] px-6 py-3.5 font-bold text-white shadow-md shadow-emerald-900/10 transition hover:bg-[#2f6b4f] cursor-pointer"
        >
          Tiếp tục: Rà soát & Thanh toán
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
