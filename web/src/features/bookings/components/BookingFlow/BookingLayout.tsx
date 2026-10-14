'use client';

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BookingSteps } from "./BookingSteps";
import { BookingForm } from "./BookingForm";
import { BookingSidebar } from "./BookingSidebar";
import {
  BookingPaymentStep,
  MemberData,
} from "./BookingPaymentStep";
import { BookingSuccessStep } from "./BookingSuccessStep";
import type { TripData } from "@/features/trips/data/mockTripsData";
import {
  useBookingDetail,
  useBookingMutations,
  usePublicBookingTripDetail,
} from "@/features/bookings/hooks";
import type {
  BookingDetail,
  Participant,
  PaymentMethod,
  PublicBookingTrip,
} from "@/features/bookings/types";
import { getCurrentUserApi } from "@/features/auth/services/auth.api";
import { useAuthStore } from "@/features/auth/store/authStore";

const createEmptyMember = (): MemberData => ({
  name: "",
  phone: "",
  sosContact: "",
  medicalNote: "",
  shirtSize: "Nam - Size L (1m68 - 1m75 | 65 - 73kg)",
  pickupPoint: "",
});

function publicTripToTripData(pt: PublicBookingTrip): TripData {
  const startAt = new Date(pt.startAt);
  const endAt = new Date(pt.endAt);
  const startDay = startAt.getDate().toString().padStart(2, "0");
  const endDay = endAt.getDate().toString().padStart(2, "0");
  const year = startAt.getFullYear().toString();
  const durationDays = Math.max(
    1,
    Math.ceil((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    id: pt.id,
    title: pt.title,
    price: Number(pt.pricePerPax) || 0,
    image:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    duration: `${durationDays} ngày`,
    date: { start: startDay, end: endDay, year },
    difficulty: {
      label: "Cấp 2 – Vừa phải",
      level: "medium",
      color: "text-emerald-700 bg-emerald-50",
    },
    leader: {
      name: pt.leader?.fullName || "Leader đoàn",
      avatar: "/images/avatars/avatar-1.png",
      badge: "Leader PRO",
      experience: "Kinh nghiệm thực địa",
      rating: 5,
      totalTrips: 1,
      porters: 0,
    },
    slots: {
      booked: pt.capacity - pt.remainingSlots,
      total: pt.capacity,
    },
    location: {
      name: pt.pickup?.name || pt.destination?.name || "Điểm tập kết",
      distance: pt.pickup?.address || "Lộ trình trekking",
    },
    isVFRSVerified: true,
    status: {
      label: pt.status === "OPEN" ? "Đang mở đăng ký" : pt.status,
      color: "text-emerald-600",
    },
    description: pt.description || "",
    action: { label: "Đặt chuyến", variant: "primary" },
  };
}

function bookingDetailToTripData(b: BookingDetail): TripData {
  const startAt = new Date(b.trip.startAt);
  const endAt = new Date(b.trip.endAt);
  const startDay = startAt.getDate().toString().padStart(2, "0");
  const endDay = endAt.getDate().toString().padStart(2, "0");
  const year = startAt.getFullYear().toString();
  const durationDays = Math.max(
    1,
    Math.ceil((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    id: b.trip.id,
    title: b.trip.title,
    price: Number(b.pricePerPax) || 0,
    image:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    duration: `${durationDays} ngày`,
    date: { start: startDay, end: endDay, year },
    difficulty: {
      label: "Cấp 2 – Vừa phải",
      level: "medium",
      color: "text-emerald-700 bg-emerald-50",
    },
    leader: {
      name: "Leader đoàn",
      avatar: "/images/avatars/avatar-1.png",
      badge: "Leader PRO",
      experience: "Kinh nghiệm thực địa",
      rating: 5,
      totalTrips: 1,
      porters: 0,
    },
    slots: { booked: b.participantCount, total: 20 },
    location: {
      name: b.pickup?.name || "Điểm tập kết",
      distance: b.pickup?.address || "",
    },
    isVFRSVerified: true,
    status: { label: b.trip.status, color: "text-emerald-600" },
    description: "",
    action: { label: "Đặt chuyến", variant: "primary" },
  };
}

export const BookingLayout = () => {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Custom hooks gọi API thật
  const bookingDetailQuery = useBookingDetail(id);
  const publicTripQuery = usePublicBookingTripDetail(id);
  const {
    createBooking,
    updateParticipants,
    createPayment,
    isSubmitting,
    error: mutationError,
    clearError,
  } = useBookingMutations();

  const [activeBooking, setActiveBooking] = useState<BookingDetail | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [equipmentCost, setEquipmentCost] = useState(0);
  const [participants, setParticipants] = useState(1);
  const [trip, setTrip] = useState<TripData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("momo");
  const [bookingCode, setBookingCode] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  // Tạm thời bật bypass cổng MoMo do backend chưa cấp tài khoản test thật
  const [bypassPaymentGateway, setBypassPaymentGateway] = useState<boolean>(true);
  const [isBypassed, setIsBypassed] = useState<boolean>(false);

  // Danh sách thành viên tham gia - Người đặt chỗ chính ưu tiên lấy từ profile auth
  const [members, setMembers] = useState<MemberData[]>(() => {
    const cachedUser = useAuthStore.getState().user;
    return [
      {
        ...createEmptyMember(),
        name: cachedUser?.fullName || cachedUser?.name || "",
        phone: cachedUser?.phone || "",
      },
    ];
  });

  // Gọi trực tiếp GET /api/v1/auth/me để đổ profile mới nhất của user vào người đặt chỗ chính
  useEffect(() => {
    let cancelled = false;

    async function fetchMe() {
      try {
        const currentUser = await getCurrentUserApi();
        if (cancelled || !currentUser) return;

        // Cập nhật lại store
        useAuthStore.getState().setUser(currentUser);

        setMembers((prev) => {
          if (!prev || prev.length === 0) return [createEmptyMember()];
          const currentPrimary = prev[0];
          const resolvedName = currentPrimary.name || currentUser.fullName || currentUser.name || "";
          const resolvedPhone = currentPrimary.phone || currentUser.phone || "";

          if (currentPrimary.name === resolvedName && currentPrimary.phone === resolvedPhone) {
            return prev;
          }

          return [
            {
              ...currentPrimary,
              name: resolvedName,
              phone: resolvedPhone,
            },
            ...prev.slice(1),
          ];
        });
      } catch (err) {
        // Chưa đăng nhập hoặc lỗi mạng thì giữ nguyên trạng thái
      }
    }

    fetchMe();

    return () => {
      cancelled = true;
    };
  }, []);

  // Đồng bộ số lượng thành viên từ query param ?participants=X
  useEffect(() => {
    const paramCount = searchParams.get("participants");
    const count = Math.max(1, Number(paramCount) || 1);
    setParticipants(count);

    setMembers((prev) => {
      const updated = [...prev];
      while (updated.length < count) {
        updated.push(createEmptyMember());
      }
      return updated.slice(0, count);
    });
  }, [searchParams]);

  // Cập nhật dữ liệu từ API thật
  useEffect(() => {
    if (bookingDetailQuery.booking) {
      const b = bookingDetailQuery.booking;
      setActiveBooking(b);
      setBookingCode(b.id);
      setParticipants(b.participantCount);
      setTrip(bookingDetailToTripData(b));

      if (b.participants && b.participants.length > 0) {
        setMembers(
          b.participants.map((p) => ({
            id: p.id,
            name: p.fullName || "",
            phone: p.phone || "",
            sosContact: [p.emergencyContactName, p.emergencyContactPhone]
              .filter(Boolean)
              .join(" - "),
            medicalNote: "",
            shirtSize: "Nam - Size L (1m68 - 1m75 | 65 - 73kg)",
            pickupPoint: b.pickup?.address || "",
          }))
        );
      }

      if (b.status === "PENDING_PAYMENT") {
        setCurrentStep(2);
      } else if (b.status === "CONFIRMED") {
        setCurrentStep(3);
      }
    } else if (publicTripQuery.trip) {
      const pt = publicTripQuery.trip;
      setTrip(publicTripToTripData(pt));
      setBookingCode(pt.id);
    }
  }, [bookingDetailQuery.booking, publicTripQuery.trip]);

  const handleMemberChange = (
    index: number,
    field: keyof MemberData,
    value: string
  ) => {
    setMembers((prev) => {
      const updated = [...prev];
      if (!updated[index]) {
        updated[index] = createEmptyMember();
      }
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const handleNextStep = async () => {
    setLocalError(null);
    clearError();

    // Rà soát hợp lệ thông tin người tham gia
    const primaryName = members[0]?.name?.trim();
    const primaryPhone = members[0]?.phone?.trim();
    if (!primaryName) {
      setLocalError("Vui lòng nhập họ và tên của người đặt chỗ chính.");
      return;
    }
    if (!primaryPhone) {
      setLocalError("Vui lòng nhập số điện thoại của người đặt chỗ chính.");
      return;
    }

    const participantsPayload: Participant[] = members.slice(0, participants).map((m, idx) => {
      const rawSos = m.sosContact || "";
      const sosParts = rawSos.split("-");
      const emergencyContactName = sosParts[0]?.trim() || undefined;
      const emergencyContactPhone = sosParts[1]?.trim() || undefined;

      return {
        ...(m.id ? { id: m.id } : {}),
        fullName: m.name.trim() || `Thành viên #${idx + 1}`,
        phone: m.phone.trim() || undefined,
        emergencyContactName,
        emergencyContactPhone,
      };
    });

    try {
      if (activeBooking && activeBooking.status === "PENDING_PAYMENT") {
        // Cập nhật danh sách thành viên đơn đặt chỗ đang chờ thanh toán
        const updated = await updateParticipants(
          activeBooking.id,
          participantsPayload,
          activeBooking.version
        );
        setActiveBooking(updated);
        setBookingCode(updated.id);
        setCurrentStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Tạo đặt chỗ mới trên API
        const targetTripId = trip?.id || id;
        const created = await createBooking(targetTripId, participantsPayload);
        setActiveBooking(created);
        setBookingCode(created.id);
        setCurrentStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: unknown) {
      // Lỗi được lưu và hiển thị thông qua mutationError
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleConfirmPayment = async (paymentData: { method: string }) => {
    setLocalError(null);
    clearError();
    setPaymentMethod(paymentData.method);

    if (!activeBooking) {
      setLocalError("Không tìm thấy thông tin đặt chỗ để thực hiện thanh toán.");
      return;
    }

    const apiMethod: PaymentMethod =
      paymentData.method === "vietqr" ? "QR" : "REDIRECT";

    try {
      // Vẫn giữ trọn vẹn luồng gọi API Backend
      const paymentResult = await createPayment(activeBooking.id, apiMethod).catch((err) => {
        console.warn("Backend payment creation notice:", err);
        return null;
      });

      if (paymentResult?.checkout?.url) {
        setCheckoutUrl(paymentResult.checkout.url);
      }
      if (paymentResult?.checkout?.qrData) {
        setQrData(paymentResult.checkout.qrData);
      }

      // TẠM THỜI BYPASS: Do Backend chưa cấp tài khoản test, tự động sang Bước 3 (Đặt Chỗ Thành Công)
      if (bypassPaymentGateway) {
        setIsBypassed(true);
        setCurrentStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // LUỒNG CHÍNH THỨC: Tự động chuyển hướng ngay sang cổng MoMo khi có tài khoản
      if (paymentResult?.checkout?.url) {
        setIsRedirecting(true);
        window.location.href = paymentResult.checkout.url;
        return;
      }

      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      if (bypassPaymentGateway) {
        setIsBypassed(true);
        setCurrentStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setIsRedirecting(false);
      }
    }
  };

  // Trạng thái đang tải dữ liệu API
  const isInitialLoading =
    (bookingDetailQuery.isLoading && !bookingDetailQuery.booking) ||
    (publicTripQuery.isLoading && !publicTripQuery.trip);

  if (isInitialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F4]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-medium text-gray-500">Đang tải thông tin chuyến đi từ hệ thống...</p>
        </div>
      </div>
    );
  }

  // Trường hợp không tìm thấy dữ liệu từ API
  if (!trip && !activeBooking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F4] p-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center shadow-sm border border-gray-200">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Không tìm thấy thông tin chuyến đi</h2>
          <p className="mt-2 text-xs text-gray-500">Mã chuyến đi hoặc đơn đặt chỗ không tồn tại trong hệ thống.</p>
          <div className="mt-6">
            <Link
              href="/trips"
              className="inline-flex items-center gap-2 rounded-xl bg-[#125238] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2f6b4f]"
            >
              Khám phá danh sách chuyến đi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentErrorMessage = localError || mutationError?.message || null;

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
              isSubmitting={isSubmitting}
              errorMessage={currentErrorMessage}
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
              bookingCode={bookingCode}
              remainingSeconds={bookingDetailQuery.remainingSeconds}
              isHoldExpired={bookingDetailQuery.isHoldExpired}
              isProcessingPayment={isSubmitting || isRedirecting}
              errorMessage={currentErrorMessage}
              isBypassMode={bypassPaymentGateway}
              onToggleBypassMode={() => setBypassPaymentGateway((prev) => !prev)}
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
            totalAmount={activeBooking?.totalAmount}
            checkoutUrl={checkoutUrl}
            qrData={qrData}
            bookingStatus={isBypassed ? "CONFIRMED" : activeBooking?.status}
          />
        )}
      </div>
    </div>
  );
};
