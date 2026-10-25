"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TripData } from "@/features/trips/data/mockTripsData";
import { TripDetailClient } from "@/features/trips/components/TripDetail/TripDetailClient";
import { bookingApiService } from "@/features/bookings/services/booking.api";
import { getTripCostPlan } from "@/features/leaders/services/leader-pricing.api";
import { apiClient } from "@/lib/axios";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<TripData | null>(null);
  const [trailCode, setTrailCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function loadTripDetail() {
      setIsLoading(true);
      setError(null);

      try {
        let rawData: any = null;

        // 1. Thử lấy từ Public Booking Discovery API (/api/v1/trips/:id)
        try {
          rawData = await bookingApiService.getPublicTripDetail(id);
        } catch {
          // Bỏ qua nếu lỗi 404
        }

        // 2. Thử lấy từ Leader Public Trip (/api/v1/leader/public-trips/:id) nếu có quyền
        if (!rawData) {
          try {
            const leaderRes = await apiClient.get<any>(`/api/v1/leader/public-trips/${id}`);
            if (leaderRes.data) {
              rawData = leaderRes.data;
            }
          } catch {}
        }

        // 3. Fallback lấy từ /api/v1/public-trips/:id
        if (!rawData) {
          const pubRes = await apiClient.get<any>(`/api/v1/public-trips/${id}`);
          rawData = pubRes.data;
        }

        if (!rawData || cancelled) return;

        // 4. Nếu thiếu thông tin destination.name, gọi API destination
        let destName = rawData.destination?.name;
        const destId = rawData.destination?.id || rawData.destinationId;
        if (!destName && destId) {
          try {
            const destRes = await apiClient.get<any>(`/api/v1/destinations/${destId}`);
            destName = destRes.data?.name || destRes.data?.data?.name;
          } catch {}
        }

        // 5. Nếu thiếu thông tin pickup, thử tìm theo pickupPointId
        let pickupInfo = rawData.pickup;
        const pId = rawData.pickup?.id || rawData.pickupPointId;
        if (!pickupInfo && pId && destId) {
          try {
            const pickupRes = await apiClient.get<any>("/api/v1/leader/trip-options/pickup-points", {
              params: { destinationId: destId },
            });
            const pItems = pickupRes.data?.items || pickupRes.data;
            if (Array.isArray(pItems)) {
              const matched = pItems.find((p: any) => p.id === pId);
              if (matched) {
                pickupInfo = { id: matched.id, name: matched.name, address: matched.address };
              }
            }
          } catch {}
        }

        // 6. Xử lý thời gian khởi hành & thời lượng
        const startAt = new Date(rawData.startAt);
        const endAt = new Date(rawData.endAt);
        const sDay = startAt.getDate().toString().padStart(2, "0");
        const sMonth = (startAt.getMonth() + 1).toString().padStart(2, "0");
        const eDay = endAt.getDate().toString().padStart(2, "0");
        const eMonth = (endAt.getMonth() + 1).toString().padStart(2, "0");
        const year = startAt.getFullYear().toString();
        const diffDays = Math.max(
          1,
          Math.round((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60 * 24)) + 1
        );
        const durationStr = diffDays > 1 ? `${diffDays} ngày` : "1 ngày";
        const durationNights = diffDays > 1 ? diffDays - 1 : 0;

        // 7. Độ khó
        const diffCode =
          rawData.routes?.[0]?.snapshotDifficulty ||
          rawData.trails?.[0]?.snapshotDifficulty ||
          "MEDIUM";
        const difficultyMap: Record<string, { level: string; label: string; color: string }> = {
          EASY: { level: "easy", label: "Cấp 1 – Dễ", color: "bg-emerald-100 text-emerald-800" },
          MEDIUM: { level: "medium", label: "Cấp 2 – Vừa phải", color: "bg-blue-100 text-blue-800" },
          HARD: { level: "hard", label: "Cấp 3 – Thử thách", color: "bg-amber-100 text-amber-800" },
          EXTREME: { level: "extreme", label: "Cấp 4 – Chuyên gia", color: "bg-red-100 text-red-800" },
        };

        const totalDist =
          rawData.routes?.[0]?.snapshotDistanceKm
            ? `${rawData.routes[0].snapshotDistanceKm} km`
            : rawData.trails?.[0]?.snapshotDistanceKm
            ? `${rawData.trails[0].snapshotDistanceKm} km`
            : undefined;

        const maxElev = rawData.trails?.[0]?.snapshotElevationGainM
          ? `+${rawData.trails[0].snapshotElevationGainM} m`
          : undefined;

        const capacity = rawData.capacity || rawData.maxPax || 15;
        const minCapacity = rawData.minCapacity || rawData.minPax || rawData.minSlots || 5;
        const remainingSlots =
          rawData.remainingSlots !== undefined ? rawData.remainingSlots : capacity;
        const booked = Math.max(0, capacity - remainingSlots);

        // 7.5. Lấy bảng chi phí chi tiết nếu có
        let costItems = rawData.costItems || [];
        let priceExplanation = rawData.priceExplanation || null;
        try {
          const planRes = await getTripCostPlan(id);
          if (planRes?.plan?.items && planRes.plan.items.length > 0) {
            costItems = planRes.plan.items.map((i: any) => ({
              id: i.id,
              category: i.category,
              name: i.name,
              kind: i.kind,
              basis: i.basis,
              unitPrice: i.unitPrice,
              quantity: i.quantity,
              durationUnits: i.durationUnits,
              capacityPerUnit: i.capacityPerUnit,
              includedInPrice: i.includedInPrice,
              sourceNote: i.sourceNote,
            }));
          }
        } catch {}

        // 8. Cung đường System Trail (CHỈ GÁN NẾU CÓ THẬT, TUYỆT ĐỐI KHÔNG FALLBACK TRAIL_BADEN_COTDIEN)
        const sysTrailId =
          rawData.trails?.[0]?.systemTrailId ||
          rawData.routes?.[0]?.id ||
          rawData.systemTrailId ||
          null;

        const statusMap: Record<string, { label: string; color: string }> = {
          OPEN: { label: "Đang mở đăng ký", color: "text-emerald-600" },
          FULL: { label: "Đã đủ người", color: "text-amber-600" },
          CLOSED: { label: "Đã đóng form đăng ký", color: "text-stone-600" },
          IN_PROGRESS: { label: "Đang khởi hành", color: "text-sky-600" },
          COMPLETED: { label: "Đã hoàn thành", color: "text-slate-600" },
          CANCELLED: { label: "Đã hủy chuyến", color: "text-red-600" },
        };

        if (!cancelled) {
          setTrailCode(sysTrailId);
          setTrip({
            id: rawData.id,
            title: rawData.title,
            description: rawData.description || "",
            duration: durationStr,
            durationDays: diffDays,
            durationNights,
            difficulty: difficultyMap[diffCode] || difficultyMap.MEDIUM,
            isVFRSVerified: true,
            location: {
              name: destName || "Khu vực trekking",
              distance: totalDist || "Theo đoàn",
            },
            image:
              "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
            date: {
              start: `${sDay}/${sMonth}`,
              end: `${eDay}/${eMonth}`,
              year,
              rawStart: rawData.startAt,
              rawEnd: rawData.endAt,
            },
            status: statusMap[rawData.status] || {
              label: rawData.status || "Đang mở đăng ký",
              color: "text-amber-600",
            },
            rawStatus: rawData.status,
            registrationOpenAt: rawData.registrationOpenAt || rawData.publishedAt || null,
            registrationDeadlineAt: rawData.registrationDeadlineAt || null,
            closedAt: rawData.closedAt || null,
            leader: {
              name: rawData.leader?.fullName || "Leader Vina TrekGO",
              avatar: "/images/avatars/avatar-1.png",
              badge: "LEADER ĐÃ XÁC THỰC",
              experience: "Đội ngũ dẫn đoàn chuyên nghiệp Vina TrekGO",
            },
            slots: {
              booked,
              total: capacity,
              min: minCapacity,
              statusText: remainingSlots > 0 ? `Còn ${remainingSlots} chỗ` : "Đã hết chỗ",
            },
            price: Number(rawData.pricePerPax || rawData.price || 0),
            totalDistance: totalDist,
            maxElevation: maxElev,
            pickup: pickupInfo || null,
            checkpoints: rawData.checkpoints || [],
            routes: rawData.routes || rawData.trails || [],
            includedServices: rawData.includedServices || [],
            excludedServices: rawData.excludedServices || [],
            costItems: costItems.length > 0 ? costItems : (rawData.costItems || []),
            priceExplanation: priceExplanation || rawData.priceExplanation || null,
            action: {
              label: remainingSlots > 0 && rawData.status === "OPEN" ? "Đặt chỗ ngay" : "Đóng đăng ký",
              variant: remainingSlots > 0 && rawData.status === "OPEN" ? "primary" : "disabled",
            },
          });
        }
      } catch (err) {
        console.error("Lỗi tải chi tiết chuyến đi:", err);
        if (!cancelled) {
          setError("Không thể tải thông tin chuyến đi.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadTripDetail();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
        <span className="text-sm font-medium text-slate-500">Đang tải chi tiết chuyến đi...</span>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-10 text-center">
        <div className="text-4xl">⚠️</div>
        <h2 className="mt-2 text-lg font-bold text-slate-800">Không tìm thấy chuyến đi</h2>
        <p className="mt-1 text-sm text-slate-500">Chuyến đi không tồn tại hoặc chưa được công khai.</p>
      </div>
    );
  }

  return <TripDetailClient trip={trip} trailCode={trailCode} />;
}
