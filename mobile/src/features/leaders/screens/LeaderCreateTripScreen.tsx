import { ConfirmModal, ScreenShell, StepIndicator } from "@/components/ui";
import { Colors } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import {
  LeaderPermissionDenied,
  LeaderTripFormStep,
  LeaderTripRouteStep,
  LeaderTripReviewStep,
  LeaderTripSuccessView,
  type LeaderTripFormData,
} from "@/features/leaders/components";
import {
  useLeaderTripCreation,
  type TripOptionCheckpoint,
  type TripOptionDestination,
  type TripOptionPickupPoint,
} from "@/features/leaders/hooks";
import type { LeaderTrailSuggestion } from "@/features/leaders/services/leader-public-trips.api";
import {
  STANDARD_COST_TEMPLATE,
  type CostItem,
} from "@/features/leaders/services/leader-pricing.api";
import { validateTripDates } from "@/features/leaders/utils/tripDateUtils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatIsoToVnDate(isoStr?: string | null): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return "";
  }
}

function parseDateToIso(str: string, timeStr = "06:00:00"): string {
  const trimmed = str.trim();
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return new Date(`${year}-${month}-${day}T${timeStr}.000Z`).toISOString();
    }
  }
  if (trimmed.includes("-")) {
    return new Date(`${trimmed}T${timeStr}.000Z`).toISOString();
  }
  return new Date(trimmed).toISOString();
}

interface LeaderCreateTripScreenProps {
  onNavigateTab?: (tabKey: "dashboard" | "trips" | "profile") => void;
}

const WIZARD_STEPS = [
  { key: "form", label: "Thông tin chuyến" },
  { key: "route", label: "Lộ trình & Checkpoint" },
  { key: "review", label: "Kiểm tra & Xuất bản" },
];

export function LeaderCreateTripScreen({ onNavigateTab }: LeaderCreateTripScreenProps = {}) {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ id?: string; tripId?: string }>();
  const initialTripId = searchParams.id || searchParams.tripId;

  const { user: authUser, accessToken } = useAuth();
  const { user } = useApp();

  const {
    loading: apiLoading,
    loadDestinations,
    loadPickupPoints,
    loadCheckpoints,
    checkConflict,
    createTrip,
    updateTrip,
    getTripById,
    assignCheckpoints,
    loadTrailSuggestions,
    assignTrails,
    checkReadiness,
    publish,
  } = useLeaderTripCreation(accessToken);

  const canCreatePublicTrip = authUser?.role === "LEADER" || user?.role === "LEADER";

  // Flow 3 bước đồng bộ với Web: form (Bước 1) -> route (Bước 2) -> review (Bước 3)
  const [step, setStep] = useState<"form" | "route" | "review">("form");
  const [destinations, setDestinations] = useState<TripOptionDestination[]>([]);
  const [pickupPoints, setPickupPoints] = useState<TripOptionPickupPoint[]>([]);
  const [checkpoints, setCheckpoints] = useState<TripOptionCheckpoint[]>([]);
  const [trailSuggestions, setTrailSuggestions] = useState<LeaderTrailSuggestion[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<LeaderTrailSuggestion | null>(null);

  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isLoadingRouteData, setIsLoadingRouteData] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const [draftTripId, setDraftTripId] = useState<string | null>(initialTripId || null);
  const [draftTripVersion, setDraftTripVersion] = useState<number>(1);
  const [lastSavedDestinationId, setLastSavedDestinationId] = useState<string | null>(null);
  const [readinessIssues, setReadinessIssues] = useState<string[]>([]);
  const [canPublish, setCanPublish] = useState<boolean>(false);

  // Module định giá & minh bạch tài chính (TG-PTR-PRICING-01)
  const [costItems, setCostItems] = useState<CostItem[]>([...STANDARD_COST_TEMPLATE]);
  const [isPriceConfirmed, setIsPriceConfirmed] = useState(false);
  const [confirmedPriceExplanation, setConfirmedPriceExplanation] = useState<string | null>(null);

  const [form, setForm] = useState<LeaderTripFormData>({
    name: "",
    description: "",
    destinationId: "",
    pickupPointId: "",
    startDate: "",
    endDate: "",
    departureTime: "05:30",
    bookingGateDays: "2",
    registrationOpenAt: "",
    registrationDeadlineAt: "",
    slots: "15",
    minPax: "5",
    price: "2850000",
    priceExplanation: "",
    checkpointIds: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LeaderTripFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishedTrip, setPublishedTrip] = useState<{
    id: string;
    title: string;
    code: string;
  } | null>(null);

  // Modal xác nhận "Lưu nháp" (thay Alert.alert mặc định)
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftModalHasDraft, setDraftModalHasDraft] = useState(false);

  // Load existing trip if initialTripId is passed (Editing Public Trip)
  useEffect(() => {
    if (!initialTripId || !accessToken) return;
    setIsLoadingMeta(true);
    getTripById(initialTripId)
      .then((existing: any) => {
        setDraftTripId(existing.id);
        setDraftTripVersion(existing.version);
        setLastSavedDestinationId(existing.destination?.id || existing.destinationId || null);
        if (existing.priceExplanation) {
          setIsPriceConfirmed(true);
          setConfirmedPriceExplanation(existing.priceExplanation);
        }
        let depTime = "05:30";
        if (existing.startAt) {
          try {
            const dt = new Date(existing.startAt);
            if (!isNaN(dt.getTime())) {
              depTime = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
            }
          } catch {}
        }
        setForm((prev) => ({
          ...prev,
          name: existing.title || prev.name,
          description: existing.description || "",
          destinationId: existing.destination?.id || existing.destinationId || prev.destinationId,
          pickupPointId: existing.pickupPoint?.id || existing.pickupPointId || prev.pickupPointId,
          startDate: formatIsoToVnDate(existing.startAt) || prev.startDate,
          endDate: formatIsoToVnDate(existing.endAt) || prev.endDate,
          departureTime: depTime,
          bookingGateDays: "2",
          registrationOpenAt: existing.registrationOpenAt || "",
          registrationDeadlineAt: existing.registrationDeadlineAt || "",
          slots: String(existing.capacity || prev.slots),
          minPax: String(existing.minPax || prev.minPax || "5"),
          price: existing.pricePerPax || existing.price || prev.price,
          priceExplanation: existing.priceExplanation || "",
        }));
      })
      .catch((err: any) => {
        console.warn("Lỗi tải thông tin chuyến để chỉnh sửa:", err?.message);
      })
      .finally(() => setIsLoadingMeta(false));
  }, [initialTripId, accessToken, getTripById]);

  const fetchDestinations = useCallback(() => {
    if (!canCreatePublicTrip || !accessToken) return;
    setIsLoadingMeta(true);
    setSubmitError(null);
    loadDestinations()
      .then((items) => {
        setDestinations(items);
      })
      .catch((err) => {
        setSubmitError(err?.message || "Không thể tải danh sách điểm đến.");
      })
      .finally(() => setIsLoadingMeta(false));
  }, [canCreatePublicTrip, accessToken, loadDestinations]);

  // Load destinations from API on mount
  useEffect(() => {
    fetchDestinations();
  }, [fetchDestinations]);

  // Load pickup points when destination changes
  useEffect(() => {
    if (!form.destinationId || !accessToken) {
      setPickupPoints([]);
      return;
    }
    loadPickupPoints(form.destinationId)
      .then((pts) => {
        setPickupPoints(pts);
      })
      .catch(() => setPickupPoints([]));
  }, [form.destinationId, accessToken, loadPickupPoints]);

  const selectedDestination = useMemo(
    () => destinations.find((d) => d.id === form.destinationId),
    [destinations, form.destinationId],
  );

  const selectedPickup = useMemo(
    () => pickupPoints.find((p) => p.id === form.pickupPointId),
    [pickupPoints, form.pickupPointId],
  );

  // Checkpoints thuộc trail được chọn theo đúng thứ tự
  const selectedCheckpoints = useMemo(() => {
    if (!selectedTrail?.checkpointIds) return [];
    return selectedTrail.checkpointIds
      .map((id) => checkpoints.find((c) => c.id === id))
      .filter((cp): cp is TripOptionCheckpoint => Boolean(cp));
  }, [selectedTrail, checkpoints]);

  const updateField = (field: keyof LeaderTripFormData, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "destinationId" && value !== current.destinationId) {
        next.pickupPointId = "";
        next.checkpointIds = [];
        setSelectedTrail(null);
      }
      return next;
    });
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const formatIssues = (rawIssues?: any[]): string[] => {
    if (!Array.isArray(rawIssues)) return [];
    return rawIssues
      .map((iss: any) => {
        if (!iss) return "";
        if (typeof iss === "string") return iss;
        return (
          iss.message ||
          iss.reason ||
          iss.detail ||
          iss.description ||
          (iss.field ? `${iss.field}: ${iss.code || "chưa hợp lệ"}` : "") ||
          iss.code ||
          JSON.stringify(iss)
        );
      })
      .filter(Boolean);
  };

  const validateFormStep = () => {
    const nextErrors: Partial<Record<keyof LeaderTripFormData, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Vui lòng nhập tên chuyến đi.";
    if (!form.destinationId) {
      nextErrors.destinationId = "Vui lòng chọn điểm đến trekking từ hệ thống.";
    }
    if (!form.pickupPointId) {
      nextErrors.pickupPointId = "Vui lòng chọn điểm đón / tập kết toàn đoàn.";
    }

    // Strict date validation
    const dateCheck = validateTripDates(form.startDate, form.endDate);
    if (!dateCheck.isValid) {
      if (dateCheck.startError) nextErrors.startDate = dateCheck.startError;
      if (dateCheck.endError) nextErrors.endDate = dateCheck.endError;
    }

    // Validate minPax and slots
    const minPax = Number(form.minPax || 5);
    if (isNaN(minPax) || minPax < 3 || minPax > 10) {
      nextErrors.minPax = "Quy mô tối thiểu (minPax) phải từ 3 đến 10 khách theo quy định VFRS.";
    }

    const slots = Number(form.slots);
    if (!form.slots.trim() || !Number.isInteger(slots) || slots < minPax) {
      nextErrors.slots = `Số slot tối đa phải là số nguyên và lớn hơn hoặc bằng ${minPax}.`;
    } else if (slots > 30) {
      nextErrors.slots = "Quy định an toàn VFRS: Tối đa 30 slot / đoàn.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // ─── BƯỚC 1: LƯU THÔNG TIN & CHUYỂN SANG BƯỚC 2 (LỘ TRÌNH) ───────────────────
  const handleProceedToRoute = async () => {
    if (!validateFormStep()) return;
    setConflictWarning(null);
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const depTime = form.departureTime || "05:30";
      const [depHour, depMin] = depTime.split(":");
      const timeStr = `${(depHour || "05").padStart(2, "0")}:${(depMin || "30").padStart(2, "0")}:00`;
      const startIso = parseDateToIso(form.startDate, timeStr);
      const endIso = parseDateToIso(form.endDate, "18:00:00");

      const startDateObj = new Date(startIso);
      const gateDays = parseInt(form.bookingGateDays || "2", 10) || 2;
      const registrationDeadlineIso = new Date(
        startDateObj.getTime() - gateDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      let registrationOpenIso = new Date().toISOString();
      if (form.registrationOpenAt?.trim()) {
        try {
          registrationOpenIso = parseDateToIso(form.registrationOpenAt.trim(), "00:00:00");
        } catch {
          registrationOpenIso = new Date().toISOString();
        }
      }

      let activeDraftId = draftTripId;
      let activeVersion = draftTripVersion;

      // Verify schedule conflict via API
      if (accessToken) {
        try {
          const conflict = await checkConflict(
            startIso,
            endIso,
            activeDraftId || undefined,
          );
          if (conflict?.hasConflict && conflict.conflicts?.length > 0) {
            setConflictWarning(`Trùng lịch với chuyến: ${conflict.conflicts[0].title}`);
          }
        } catch {
          // Non-blocking
        }
      }

      // 1. Tạo hoặc Cập nhật DRAFT public trip
      if (!activeDraftId) {
        const draft = await createTrip({
          destinationId: form.destinationId,
          title: form.name.trim(),
          description:
            form.description.trim() ||
            `Chuyến đi công khai do Mountain Leader ${authUser?.name || "TrekGo"} phụ trách.`,
          startAt: startIso,
          endAt: endIso,
          pickupPointId: form.pickupPointId || (pickupPoints[0]?.id ?? ""),
          capacity: Number(form.slots),
          minPax: Number(form.minPax || 5),
          price: form.price.trim() || "2850000",
          registrationDeadlineAt: registrationDeadlineIso,
          registrationOpenAt: registrationOpenIso,
        });
        activeDraftId = draft.id;
        activeVersion = draft.version;
        setDraftTripId(draft.id);
        setDraftTripVersion(draft.version);
        setLastSavedDestinationId(form.destinationId);
      } else {
        // Ràng buộc BE: Checkpoints và Trails phải thuộc đúng destinationId.
        // Nếu Leader đổi destinationId trên bản nháp đã có, phải reset checkpoints và trails rỗng trước:
        if (lastSavedDestinationId && form.destinationId !== lastSavedDestinationId) {
          try {
            const cpReset = await assignCheckpoints(activeDraftId, {
              expectedVersion: activeVersion,
              checkpointIds: [],
            });
            activeVersion = cpReset.version;
            setDraftTripVersion(activeVersion);

            const trailReset = await assignTrails(activeDraftId, {
              expectedVersion: activeVersion,
              trailIds: [],
            });
            activeVersion = trailReset.version;
            setDraftTripVersion(activeVersion);

            setSelectedTrail(null);
            setForm((prev) => ({ ...prev, checkpointIds: [] }));
          } catch (resetErr) {
            console.warn("Lỗi khi reset checkpoints/trails cũ trước khi đổi điểm đến:", resetErr);
          }
        }

        const updated = await updateTrip(activeDraftId, {
          expectedVersion: activeVersion,
          title: form.name.trim(),
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
          startAt: startIso,
          endAt: endIso,
          pickupPointId: form.pickupPointId || (pickupPoints[0]?.id ?? ""),
          capacity: Number(form.slots),
          minPax: Number(form.minPax || 5),
          price: form.price.trim() || "2850000",
          destinationId: form.destinationId,
          registrationDeadlineAt: registrationDeadlineIso,
          registrationOpenAt: registrationOpenIso,
        });
        activeVersion = updated.version;
        setDraftTripVersion(updated.version);
        setLastSavedDestinationId(form.destinationId);
      }

      // 2. Tải danh sách System Trail suggestions & Checkpoints của Destination
      setIsLoadingRouteData(true);
      const [rawSuggestions, destinationCps] = await Promise.all([
        loadTrailSuggestions(activeDraftId),
        loadCheckpoints(form.destinationId),
      ]);

      setCheckpoints(destinationCps);

      const suggestions = Array.isArray(rawSuggestions)
        ? rawSuggestions
        : ((rawSuggestions as any)?.items ?? []);

      setTrailSuggestions(suggestions);

      // Lọc các cung đường hợp lệ có checkpointIds.length > 0
      const validSuggestions = suggestions.filter(
        (s: any) => Array.isArray(s.checkpointIds) && s.checkpointIds.length > 0,
      );

      // Chọn trail hợp lệ đầu tiên nếu chưa chọn trail nào hoặc trail hiện tại không hợp lệ
      if (validSuggestions.length > 0) {
        if (!selectedTrail || !validSuggestions.some((v: any) => v.id === selectedTrail.id)) {
          const firstValid = validSuggestions[0];
          setSelectedTrail(firstValid);
          setForm((prev) => ({
            ...prev,
            checkpointIds: firstValid.checkpointIds || [],
          }));
        }
      } else {
        setSelectedTrail(null);
      }

      setStep("route");
    } catch (err: any) {
      setSubmitError(err?.message || "Không thể chuẩn bị chuyến đi để thiết lập lộ trình.");
    } finally {
      setIsSubmitting(false);
      setIsLoadingRouteData(false);
    }
  };

  // Chọn 1 System Trail từ danh sách hợp lệ và tự động lấy Checkpoints theo trail đó
  const handleSelectTrail = (trail: LeaderTrailSuggestion) => {
    if (!Array.isArray(trail.checkpointIds) || trail.checkpointIds.length === 0) {
      setSubmitError("Cung đường này chưa có checkpoint để xác định đường đi.");
      return;
    }
    setSubmitError(null);
    setSelectedTrail(trail);
    setForm((prev) => ({
      ...prev,
      checkpointIds: trail.checkpointIds || [],
    }));
  };

  // ─── BƯỚC 2: LƯU LỘ TRÌNH (CHECKPOINTS & TRAILS) VÀ SANG BƯỚC 3 (REVIEW) ─────
  const handleSaveRouteAndProceedToReview = async () => {
    if (!draftTripId) {
      setSubmitError("Chưa có mã chuyến đi. Vui lòng quay lại Bước 1.");
      return;
    }

    if (
      !selectedTrail ||
      !Array.isArray(selectedTrail.checkpointIds) ||
      selectedTrail.checkpointIds.length === 0
    ) {
      setSubmitError("Vui lòng lựa chọn 1 cung đường đã thẩm định có trạm kiểm soát hợp lệ.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let currentVer = draftTripVersion;

      // Bước 2.1: PUT /api/v1/leader/public-trips/{tripId}/checkpoints với expectedVersion
      const cpRes = await assignCheckpoints(draftTripId, {
        expectedVersion: currentVer,
        checkpointIds: selectedTrail.checkpointIds,
      });
      const nextVersion = cpRes.version;
      currentVer = nextVersion;
      setDraftTripVersion(nextVersion);

      // Bước 2.2: PUT /api/v1/leader/public-trips/{tripId}/trails với expectedVersion = nextVersion
      const trailRes = await assignTrails(draftTripId, {
        expectedVersion: nextVersion,
        trailIds: [selectedTrail.id],
      });
      currentVer = trailRes.version;
      setDraftTripVersion(trailRes.version);

      // Bước 2.3: Kiểm tra điều kiện sẵn sàng xuất bản (Readiness Check)
      const readiness = await checkReadiness(draftTripId);
      if (typeof readiness.version === "number") {
        setDraftTripVersion(readiness.version);
      }
      setCanPublish(readiness.canPublish);
      const formatted = formatIssues(readiness.issues);
      setReadinessIssues(formatted);

      setStep("review");
    } catch (err: any) {
      setSubmitError(err?.message || "Không thể lưu cấu hình lộ trình chuyến đi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePriceConfirmed = async (
    confirmedPrice: number,
    minPax: number,
    explanation: string,
    newVersion: number,
  ) => {
    setDraftTripVersion(newVersion);
    setForm((prev) => ({
      ...prev,
      price: String(confirmedPrice),
      minPax: String(minPax),
      priceExplanation: explanation,
    }));
    setConfirmedPriceExplanation(explanation);
    setIsPriceConfirmed(true);

    if (draftTripId) {
      try {
        const readiness = await checkReadiness(draftTripId);
        if (typeof readiness.version === "number") {
          setDraftTripVersion(readiness.version);
        }
        setCanPublish(readiness.canPublish);
        setReadinessIssues(formatIssues(readiness.issues));
      } catch {
        // non-blocking
      }
    }
  };

  // ─── BƯỚC 3: XUẤT BẢN CHUYẾN ĐI (PUBLISH) ──────────────────────────────────
  const handlePublish = async () => {
    if (!draftTripId) {
      setSubmitError("Chưa tạo được bản nháp chuyến đi. Vui lòng quay lại thử lại.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Re-check readiness right before publishing
      // Lưu mô tả nhập ở Bước 3 trước khi xuất bản
      if (form.description.trim()) {
        try {
          const pre = await checkReadiness(draftTripId);
          const ver = typeof pre.version === "number" ? pre.version : draftTripVersion;
          const saved = await updateTrip(draftTripId, {
            expectedVersion: ver,
            description: form.description.trim(),
          });
          setDraftTripVersion(saved.version);
        } catch (descErr) {
          console.warn("Không lưu được mô tả trước khi xuất bản:", descErr);
        }
      }

      const readiness = await checkReadiness(draftTripId);
      const currentVer = typeof readiness.version === "number" ? readiness.version : draftTripVersion;
      setCanPublish(readiness.canPublish);

      if (!readiness.canPublish) {
        const formatted = formatIssues(readiness.issues);
        setReadinessIssues(formatted);
        if (formatted.length > 0) {
          throw new Error(`Chưa đủ điều kiện xuất bản: ${formatted.join(". ")}`);
        }
        throw new Error("Chuyến đi chưa sẵn sàng xuất bản. Vui lòng kiểm tra lại thông tin cơ cấu giá hoặc lộ trình.");
      }

      // Publish trip (DRAFT -> OPEN)
      const finalTrip = await publish(draftTripId, currentVer);

      setPublishedTrip({
        id: finalTrip.id,
        title: finalTrip.title,
        code: finalTrip.id.slice(-6).toUpperCase(),
      });
    } catch (err: any) {
      setSubmitError(err?.message || "Không thể xuất bản chuyến đi. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSafeGoBack = useCallback(() => {
    if (onNavigateTab) {
      onNavigateTab("dashboard");
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/field-operations" as any);
    }
  }, [onNavigateTab, router]);

  useEffect(() => {
    const onHardwareBack = () => {
      if (publishedTrip) {
        if (onNavigateTab) {
          setPublishedTrip(null);
          setStep("form");
          onNavigateTab("dashboard");
        } else {
          router.replace("/field-operations" as any);
        }
        return true;
      }
      if (step === "review") {
        setStep("route");
        return true;
      }
      if (step === "route") {
        setStep("form");
        return true;
      }
      handleSafeGoBack();
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
    return () => sub.remove();
  }, [step, publishedTrip, onNavigateTab, handleSafeGoBack]);

  if (!canCreatePublicTrip) {
    return (
      <SafeAreaView style={styles.safe}>
        <LeaderPermissionDenied onBack={handleSafeGoBack} />
      </SafeAreaView>
    );
  }

  if (publishedTrip) {
    return (
      <SafeAreaView style={styles.safe}>
        <LeaderTripSuccessView
          publishedTrip={publishedTrip}
          form={form}
          selectedDestination={selectedDestination}
          onViewTripDetail={() =>
            (onNavigateTab ? (setPublishedTrip(null), setStep("form"), onNavigateTab("trips"), router.push) : router.replace)({
              pathname: "/field-operations/leader-trip-detail" as any,
              params: { id: publishedTrip.id, tripId: publishedTrip.id },
            })
          }
          onGoToDashboard={() => {
            if (onNavigateTab) {
              setPublishedTrip(null);
              setStep("form");
              onNavigateTab("dashboard");
            } else {
              router.replace("/field-operations" as any);
            }
          }}
        />
      </SafeAreaView>
    );
  }

  const handleGoToTripsList = () => {
    setShowDraftModal(false);
    if (onNavigateTab) {
      onNavigateTab("trips");
    } else {
      router.replace("/field-operations" as any);
    }
  };

  const handleSaveDraft = () => {
    // Chưa qua bước 1 thì chưa có gì được lưu trên server — thông báo phải trung thực
    setDraftModalHasDraft(Boolean(draftTripId));
    setShowDraftModal(true);
  };

  const draftModal = (
    <ConfirmModal
      visible={showDraftModal}
      title={
        draftModalHasDraft
          ? "Bản nháp đã lưu trên hệ thống"
          : "Chưa có bản nháp để lưu"
      }
      description={
        draftModalHasDraft
          ? "Chuyến đi và toàn bộ cấu hình đã được lưu an toàn. Bạn có thể quay lại duyệt hoặc xuất bản bất kỳ lúc nào."
          : "Chuyến đi sẽ được tạo và lưu dưới dạng bản nháp khi bạn hoàn tất bước thông tin và chuyển sang bước lộ trình."
      }
      confirmLabel="Về danh sách"
      cancelLabel="Tiếp tục chỉnh sửa"
      variant="primary"
      onConfirm={handleGoToTripsList}
      onClose={() => setShowDraftModal(false)}
    />
  );

  // BƯỚC 3: XEM LẠI & XUẤT BẢN
  if (step === "review") {
    return (
      <ScreenShell scrollable contentContainerStyle={styles.content}>
        <StepIndicator steps={WIZARD_STEPS} currentStepIndex={2} style={styles.stepBar} />
        <LeaderTripReviewStep
            form={form}
            tripId={draftTripId || ""}
            expectedVersion={draftTripVersion}
            accessToken={accessToken || ""}
            costItems={costItems}
            onChangeCostItems={setCostItems}
            selectedDestination={selectedDestination}
            selectedPickup={selectedPickup}
            selectedCheckpoints={selectedCheckpoints}
            selectedTrail={selectedTrail}
            conflictWarning={conflictWarning}
            submitError={submitError}
            readinessIssues={readinessIssues}
            canPublish={canPublish}
            isSubmitting={isSubmitting}
            apiLoading={apiLoading}
            onPublish={() => void handlePublish()}
            onBackToForm={() => setStep("route")}
            onBackToStep1={() => setStep("form")}
            onPriceConfirmed={handlePriceConfirmed}
            isPriceConfirmed={isPriceConfirmed}
            confirmedPriceExplanation={confirmedPriceExplanation}
            onVersionUpdated={(newVer) => setDraftTripVersion(newVer)}
            onUpdateDescription={(desc) => updateField("description", desc)}
            onSaveDraft={handleSaveDraft}
        />
        {draftModal}
      </ScreenShell>
    );
  }

  // BƯỚC 2: THIẾT LẬP LỘ TRÌNH (CHỌN SYSTEM TRAIL & CHECKPOINTS TƯƠNG ỨNG)
  if (step === "route") {
    return (
      <ScreenShell scrollable contentContainerStyle={styles.content}>
        <StepIndicator steps={WIZARD_STEPS} currentStepIndex={1} style={styles.stepBar} />
        <LeaderTripRouteStep
            tripTitle={form.name}
            destinationName={selectedDestination?.name}
            trailSuggestions={trailSuggestions}
            destinationCheckpoints={checkpoints}
            selectedTrail={selectedTrail}
            onSelectTrail={handleSelectTrail}
            isLoading={isLoadingRouteData || isSubmitting}
            submitError={submitError}
            onProceed={() => void handleSaveRouteAndProceedToReview()}
            onBack={() => setStep("form")}
            onRetry={() => {
              if (draftTripId) {
                setIsLoadingRouteData(true);
                loadTrailSuggestions(draftTripId)
                  .then((raw) => {
                    const items = Array.isArray(raw) ? raw : ((raw as any)?.items ?? []);
                    setTrailSuggestions(items);
                  })
                  .finally(() => setIsLoadingRouteData(false));
              }
            }}
            onSaveDraft={handleSaveDraft}
        />
        {draftModal}
      </ScreenShell>
    );
  }

  // BƯỚC 1: THIẾT LẬP THÔNG TIN CHUYẾN ĐI
  return (
    <ScreenShell scrollable contentContainerStyle={styles.content}>
      <StepIndicator steps={WIZARD_STEPS} currentStepIndex={0} style={styles.stepBar} />
      <LeaderTripFormStep
          form={form}
          errors={errors}
          destinations={destinations}
          pickupPoints={pickupPoints}
          checkpoints={checkpoints}
          isLoadingMeta={isLoadingMeta}
          submitError={submitError}
          onUpdateField={updateField}
          onProceed={() => void handleProceedToRoute()}
          onBack={handleSafeGoBack}
          onRetryLoadMeta={fetchDestinations}
      />
      {draftModal}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  stepBar: {
    marginBottom: 16,
  },
});
