"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BookingSteps } from "./BookingSteps";
import { BookingForm } from "./BookingForm";
import { BookingSidebar } from "./BookingSidebar";
import {
  BookingPaymentStep,
  MemberData,
} from "./BookingPaymentStep";
import { BookingSuccessStep } from "./BookingSuccessStep";
import { mockTripsData, TripData } from "@/features/trips/data/mockTripsData";
import {
  createdTripToTripData,
  readCreatedLeaderTrip,
} from "@/features/leaders/data/mockLeaderTripStore";

export interface BookingInfo {
  tripId: string;
  participants: number;
  price: number;
  title: string;
  image: string;
  date: { start: string; end: string; year: string };
  duration: string;
  leader: { name: string; avatar: string; rating: number };
  difficulty?: { label: string; level: string; color: string };
}

export const BookingLayout = () => {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [equipmentCost, setEquipmentCost] = useState(0);
  const [participants, setParticipants] = useState(1);
  const [trip, setTrip] = useState<TripData | null>(null);

  // Danh sách thành viên tham gia
  const [members, setMembers] = useState<MemberData[]>([
    {
      name: "Nguyễn Hùng",
      phone: "0912 345 678",
      sosContact: "Nguyễn Thị Mai - 0988 123 456 (Chị ruột)",
      medicalNote:
        "Thể lực tốt, thường xuyên chạy bộ, không say độ cao, không tiền sử tim mạch hay hen suyễn",
      shirtSize: "Nam - Size L (1m68 - 1m75 | 65 - 73kg)",
      pickupPoint: "Bến xe Mỹ Đình, Cổng số 2, Nam Từ Liêm, Hà Nội",
    },
  ]);

  // Payment info
  const [paymentMethod, setPaymentMethod] = useState("vnpay");
  const [bookingCode, setBookingCode] = useState("TGO-BK-902094");

  useEffect(() => {
    // 1. Lấy số lượng người đăng ký từ query param hoặc sessionStorage
    const paramCount = searchParams.get("participants");
    const storedBookingStr = window.sessionStorage.getItem(
      "trekgo-booking-info",
    );
    let storedBooking: BookingInfo | null = null;
    if (storedBookingStr) {
      try {
        storedBooking = JSON.parse(storedBookingStr);
      } catch (e) {
        console.error("Lỗi parse booking info:", e);
      }
    }

    const count = paramCount
      ? Math.max(1, Number(paramCount) || 1)
      : storedBooking?.participants
      ? storedBooking.participants
      : 1;

    setParticipants(count);

    // Đồng bộ mảng thành viên theo số lượng
    setMembers((prev) => {
      const updated = [...prev];
      while (updated.length < count) {
        updated.push({
          name: "",
          phone: "",
          sosContact: "",
          medicalNote: "",
          shirtSize: "Nam - Size L (1m68 - 1m75 | 65 - 73kg)",
          pickupPoint: "Bến xe Mỹ Đình, Cổng số 2, Nam Từ Liêm, Hà Nội",
        });
      }
      return updated;
    });

    // 2. Lấy dữ liệu trip
    const created = readCreatedLeaderTrip();
    if (created && created.id === id) {
      setTrip(createdTripToTripData(created));
      setBookingCode(`TGO-BK-${created.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase() || "902094"}`);
    } else {
      const found = mockTripsData.find((t) => t.id === id);
      if (found) {
        setTrip(found);
        setBookingCode(`TGO-BK-${found.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase() || "902094"}`);
      } else if (storedBooking) {
        setTrip({
          id: storedBooking.tripId || id || "TRK-MOCK-902094",
          title: storedBooking.title || "Chinh phục Núi Bà Đen",
          price: storedBooking.price || 2850000,
          image:
            storedBooking.image ||
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
          duration: storedBooking.duration || "6 ngày",
          date: storedBooking.date || { start: "5", end: "10", year: "2026" },
          difficulty: storedBooking.difficulty || {
            label: "Cấp 2 – Vừa phải",
            level: "medium",
            color: "text-emerald-700 bg-emerald-50",
          },
          leader: {
            name: storedBooking.leader?.name || "Leader hiện tại",
            avatar:
              storedBooking.leader?.avatar || "/images/avatars/avatar-1.png",
            badge: "Leader PRO",
            experience: "Kinh nghiệm trekking",
            rating: storedBooking.leader?.rating || 5,
            totalTrips: 1,
            porters: 0,
          },
          slots: { booked: 0, total: 10 },
          location: { name: "Bến xe Mỹ Đình", distance: "15 km" },
          isVFRSVerified: true,
          status: { label: "Đang mở đăng ký", color: "text-emerald-600" },
          description: "",
          action: { label: "Đặt chuyến", variant: "primary" },
        });
        setBookingCode(`TGO-BK-${(storedBooking.tripId || "902094").replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`);
      }
    }
  }, [id, searchParams]);

  const handleMemberChange = (
    index: number,
    field: keyof MemberData,
    value: string,
  ) => {
    setMembers((prev) => {
      const updated = [...prev];
      if (!updated[index]) {
        updated[index] = {
          name: "",
          phone: "",
          sosContact: "",
          medicalNote: "",
          shirtSize: "Nam - Size L (1m68 - 1m75 | 65 - 73kg)",
          pickupPoint: "Bến xe Mỹ Đình, Cổng số 2, Nam Từ Liêm, Hà Nội",
        };
      }
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const handleNextStep = () => {
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrevStep = () => {
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleConfirmPayment = (paymentData: { method: string }) => {
    setPaymentMethod(paymentData.method);
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#F7F7F4] pb-20 pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <BookingSteps trip={trip} currentStep={currentStep} />

        {currentStep === 1 && (
          <div className="flex flex-col gap-8 lg:flex-row">
            <BookingForm
              participants={participants}
              trip={trip}
              members={members}
              onMemberChange={handleMemberChange}
              onEquipmentCostChange={setEquipmentCost}
              onNextStep={handleNextStep}
            />
            <BookingSidebar
              participants={participants}
              trip={trip}
              equipmentCost={equipmentCost}
            />
          </div>
        )}

        {currentStep === 2 && (
          <div className="flex flex-col gap-8 lg:flex-row">
            <BookingPaymentStep
              trip={trip}
              participants={participants}
              members={members}
              equipmentCost={equipmentCost}
              onBack={handlePrevStep}
              onConfirmPayment={handleConfirmPayment}
            />
            <BookingSidebar
              participants={participants}
              trip={trip}
              equipmentCost={equipmentCost}
            />
          </div>
        )}

        {currentStep === 3 && (
          <BookingSuccessStep
            trip={trip}
            participants={participants}
            members={members}
            bookingCode={bookingCode}
            paymentMethod={paymentMethod}
            equipmentCost={equipmentCost}
          />
        )}
      </div>
    </div>
  );
};
