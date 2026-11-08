import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import {
  gearAdvisorApi,
  gearErrorCode,
  gearErrorMessage,
  selfProvidedOf,
  type ClimateSuggestion,
  type ConfirmedClimate,
  type GearPlan,
  type GearPlanPrefill,
  type GearTripCandidate,
  type GuidanceQuestion,
  type GuidanceRequirement,
  type PackingChecklistItem,
  type PlanGuidance,
} from "@/features/gear/advisor-api";
import { gearApi } from "@/features/gear/api";
import { GearRentalOptionsCard } from "@/features/gear/GearRentalOptionsCard";
import { PackingChecklistCard } from "@/features/gear/PackingChecklistCard";
import {
  CompassLoader,
  CompletenessBar,
  DifficultyPeaks,
  FadeInUp,
  GearThumb,
  MountainHero,
  PopIn,
  SummitProgress,
  TrailSign,
  TrailStepper,
  Trek,
  WeatherGlyph,
  specCompleteness,
  type TrailStepState,
  type WeatherKind,
} from "@/features/gear/TrekKit";
import type { GearCategory, UserGearItem } from "@/features/gear/types";

const CATEGORIES: [GearCategory, string][] = [
  ["JACKET", "Áo khoác"],
  ["PANTS", "Quần"],
  ["FOOTWEAR", "Giày"],
  ["BACKPACK", "Balo"],
  ["SLEEPING_BAG", "Túi ngủ"],
  ["TENT", "Lều"],
  ["TREKKING_POLE", "Gậy trekking"],
  ["RAIN_GEAR", "Đồ đi mưa"],
];
const categoryLabel = (category: string) => CATEGORIES.find(([key]) => key === category)?.[1] ?? category;

const ITEM_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  SUITABLE: { label: "Phù hợp", color: Trek.trail, bg: Trek.mintPale },
  NEEDS_INFORMATION: { label: "Cần thêm thông tin", color: Trek.skyInk, bg: Trek.skyBg },
  NEEDS_ATTENTION: { label: "Chưa đạt", color: Trek.amberInk, bg: Trek.amberBg },
  NOT_ASSESSED: { label: "Chuyến không yêu cầu", color: "#55625a", bg: "#eef1ef" },
};

const REQUIREMENT_STATUS: Record<string, { label: string; color: string; bg: string; hint?: string }> = {
  COVERED_BY_OWNED: { label: "Đã đủ", color: Trek.trail, bg: Trek.mintPale },
  USER_DECLARED_PROVISION: { label: "Bạn tự chuẩn bị", color: Trek.indigoInk, bg: Trek.indigoBg, hint: "Không tính vào phương án thuê." },
  UNKNOWN: {
    label: "Cần thêm thông tin",
    color: Trek.skyInk,
    bg: Trek.skyBg,
    hint: "Đồ bạn chọn thiếu thông số để kiểm tra. Trả lời câu hỏi bên dưới rồi đánh giá lại.",
  },
  NEEDS_REPLACEMENT: {
    label: "Đồ hiện có chưa đạt",
    color: Trek.amberInk,
    bg: Trek.amberBg,
    hint: "Chọn món khác trong tủ, thuê ở bên dưới hoặc tự chuẩn bị.",
  },
  MISSING: { label: "Còn thiếu", color: Trek.amberInk, bg: Trek.amberBg, hint: "Chọn đồ trong tủ, thuê ở bên dưới hoặc tự chuẩn bị." },
};

const CLIMATE_FIELDS: [keyof ConfirmedClimate, string, string, WeatherKind][] = [
  ["temp_min_c", "Ban ngày thấp nhất", "°C", "cloud-sun"],
  ["temp_max_c", "Ban ngày cao nhất", "°C", "sun"],
  ["temp_min_night_c", "Ban đêm thấp nhất", "°C", "moon"],
  ["rain_prob_pct", "Khả năng mưa", "%", "rain"],
];

const TERRAIN_LABELS: Record<string, string> = {
  muddy: "Bùn lầy",
  rocky: "Đá dốc",
  mountain: "Núi",
  forest: "Rừng",
  stream: "Suối",
  river: "Sông suối",
  grassland: "Đồi cỏ",
};

const COVERAGE_LABELS: Record<string, string> = { UPPER_BODY: "Thân trên", FULL_BODY: "Toàn thân" };

type ClimateDraft = Record<keyof ConfirmedClimate, string>;
type ClimateOrigin = "PLAN" | "SUGGESTED" | "MANUAL" | "NONE";
const EMPTY_CLIMATE: ClimateDraft = { temp_min_c: "", temp_max_c: "", temp_min_night_c: "", rain_prob_pct: "" };

const toDraft = (climate: ConfirmedClimate | null | undefined): ClimateDraft =>
  climate
    ? {
        temp_min_c: String(climate.temp_min_c),
        temp_max_c: String(climate.temp_max_c),
        temp_min_night_c: String(climate.temp_min_night_c),
        rain_prob_pct: String(climate.rain_prob_pct),
      }
    : EMPTY_CLIMATE;

const sameClimate = (a: ConfirmedClimate | null | undefined, b: ConfirmedClimate | null | undefined) =>
  Boolean(a && b) && CLIMATE_FIELDS.every(([key]) => Number(a?.[key]) === Number(b?.[key]));

const climateSummary = (climate: ConfirmedClimate) =>
  `${climate.temp_min_c}–${climate.temp_max_c}°C ban ngày · đêm ${climate.temp_min_night_c}°C · mưa ${climate.rain_prob_pct}%`;

/** Vị trí 0..1 trên thanh đo: nhiệt độ -10..40°C, mưa 0..100%. */
function climateGauge(key: keyof ConfirmedClimate, raw: string) {
  const value = Number(raw.replace(",", "."));
  if (raw.trim() === "" || !Number.isFinite(value)) return 0;
  return key === "rain_prob_pct" ? Math.min(1, Math.max(0, value / 100)) : Math.min(1, Math.max(0, (value + 10) / 50));
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function GearAdvisorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const { accessToken } = useAuth();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const stepOffsets = useRef<Record<number, number>>({});
  const [trips, setTrips] = useState<GearTripCandidate[]>([]);
  const [items, setItems] = useState<UserGearItem[]>([]);
  const [tripId, setTripId] = useState("");
  const [prefill, setPrefill] = useState<GearPlanPrefill | null>(null);
  const [tripBlocked, setTripBlocked] = useState("");
  const [plan, setPlan] = useState<GearPlan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [gearSearch, setGearSearch] = useState("");
  const [climate, setClimate] = useState<ClimateDraft>(EMPTY_CLIMATE);
  const [climateOrigin, setClimateOrigin] = useState<ClimateOrigin>("NONE");
  const [climateConfirmed, setClimateConfirmed] = useState(false);
  const [guidance, setGuidance] = useState<PlanGuidance | null>(null);
  const [checklist, setChecklist] = useState<PackingChecklistItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    Promise.all([gearAdvisorApi.listTripCandidates(accessToken), gearApi.listMyGear(accessToken)])
      .then(([tripList, gear]) => {
        if (cancelled) return;
        setTrips(tripList);
        setItems(gear.items);
      })
      .catch((loadError: unknown) => !cancelled && setError(gearErrorMessage(loadError)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const loadGuidance = useCallback(
    async (planId: string) => {
      if (!accessToken) return null;
      const latest = await gearAdvisorApi.getPlan(planId, accessToken);
      if (latest.evaluatedRevision) {
        const [nextGuidance, nextChecklist] = await Promise.all([
          gearAdvisorApi.guidance(planId, latest.evaluatedRevision, accessToken),
          gearAdvisorApi.checklist(planId, latest.evaluatedRevision, accessToken).catch(() => []),
        ]);
        setGuidance(nextGuidance);
        setChecklist(nextChecklist);
      } else {
        setGuidance(null);
        setChecklist([]);
      }
      setPlan(latest);
      return latest;
    },
    [accessToken],
  );

  const openTrip = useCallback(
    async (nextTripId: string) => {
      if (!accessToken) return;
      setTripId(nextTripId);
      setPrefill(null);
      setTripBlocked("");
      setPlan(null);
      setGuidance(null);
      setChecklist([]);
      setAnswers({});
      setClimate(EMPTY_CLIMATE);
      setClimateOrigin("NONE");
      setClimateConfirmed(false);
      setError("");
      setNotice("");
      setBusy("trip");
      try {
        let nextPrefill: GearPlanPrefill;
        try {
          nextPrefill = await gearAdvisorApi.prefill(nextTripId, accessToken);
        } catch (prefillError: unknown) {
          setTripBlocked(gearErrorMessage(prefillError));
          return;
        }
        setPrefill(nextPrefill);
        const plans = await gearAdvisorApi.listPlans(accessToken);
        const existing = plans
          .filter((candidate) => candidate.tripId === nextTripId)
          .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
        const latest = existing ? await loadGuidance(existing.id) : null;
        setSelected(latest?.selectedItemIds ?? []);
        // Kế hoạch đã đánh giá: hiện đúng thời tiết đã dùng, không thay bằng gợi ý mới.
        const confirmed = latest?.canonicalContext?.confirmedClimate;
        if (confirmed) {
          setClimate(toDraft(confirmed));
          setClimateOrigin("PLAN");
          setClimateConfirmed(true);
        } else if (nextPrefill.suggestedClimate) {
          setClimate(toDraft(nextPrefill.suggestedClimate));
          setClimateOrigin("SUGGESTED");
        }
      } catch (tripError: unknown) {
        setError(gearErrorMessage(tripError));
      } finally {
        setBusy(null);
      }
    },
    [accessToken, loadGuidance],
  );

  // Mở thẳng chuyến khi đi từ Tủ đồ (?tripId=).
  const openedFromParam = useRef(false);
  useEffect(() => {
    if (openedFromParam.current || loading || !params.tripId) return;
    openedFromParam.current = true;
    void openTrip(params.tripId);
  }, [loading, openTrip, params.tripId]);

  const selectedTrip = trips.find((trip) => trip.id === tripId);
  const itemsById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const itemNames = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item.name])), [items]);
  const itemPhotos = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item.photoUrl])), [items]);
  const itemsByCategory = useMemo(() => {
    const query = gearSearch.trim().toLocaleLowerCase("vi-VN");
    return CATEGORIES.map(([category, label]) => ({
      category,
      label,
      items: items.filter(
        (item) => item.category === category && `${item.name} ${item.brand ?? ""}`.toLocaleLowerCase("vi-VN").includes(query),
      ),
    })).filter((group) => group.items.length > 0);
  }, [gearSearch, items]);

  const climateValue: ConfirmedClimate | null = useMemo(() => {
    if (CLIMATE_FIELDS.some(([key]) => climate[key].trim() === "")) return null;
    const [tempMin, tempMax, tempNight, rain] = CLIMATE_FIELDS.map(([key]) => Number(climate[key].replace(",", ".")));
    if ([tempMin, tempMax, tempNight, rain].some((value) => !Number.isFinite(value))) return null;
    if (tempMin > tempMax || rain < 0 || rain > 100) return null;
    return { temp_min_c: tempMin, temp_max_c: tempMax, temp_min_night_c: tempNight, rain_prob_pct: rain };
  }, [climate]);

  const evaluatedClimate = plan?.evaluatedRevision ? plan.canonicalContext?.confirmedClimate ?? null : null;
  const climateChanged = Boolean(evaluatedClimate) && !sameClimate(climateValue, evaluatedClimate);
  const selectionChanged =
    plan !== null && (selected.length !== plan.selectedItemIds.length || selected.some((id) => !plan.selectedItemIds.includes(id)));
  const resultOutdated =
    selectionChanged ||
    climateChanged ||
    Boolean(plan?.isStale) ||
    Boolean(guidance?.needsReevaluation) ||
    (Boolean(plan?.evaluatedRevision) && plan?.inputRevision !== plan?.evaluatedRevision);

  function scrollToStep(step: number) {
    const y = stepOffsets.current[step];
    if (typeof y === "number") setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }), 80);
  }

  async function evaluate() {
    if (!accessToken || !tripId || !climateValue || !climateConfirmed) return;
    setBusy("evaluate");
    setError("");
    setNotice("");
    let planId = plan?.id ?? null;
    try {
      let current = plan;
      if (!current) {
        current = await gearAdvisorApi.createPlan(
          { title: `Chuẩn bị đồ · ${selectedTrip?.title ?? "Chuyến đi"}`.slice(0, 220), tripId, selectedItemIds: selected },
          accessToken,
        );
        planId = current.id;
        setPlan(current);
      } else if (selectionChanged) {
        current = await gearAdvisorApi.updatePlan(current.id, { expectedInputRevision: current.inputRevision, selectedItemIds: selected }, accessToken);
        setPlan(current);
      }
      await gearAdvisorApi.evaluate(current.id, { expectedInputRevision: current.inputRevision, confirmedClimate: climateValue }, accessToken);
      await loadGuidance(current.id);
      setClimateOrigin("PLAN");
      setAnswers({});
      setNotice("Đã đánh giá xong. Xem kết quả theo từng yêu cầu bên dưới.");
      scrollToStep(4);
    } catch (evaluateError: unknown) {
      const code = gearErrorCode(evaluateError);
      setError(
        code === "GEAR_PLAN_CAS_CONFLICT"
          ? "Kế hoạch vừa được cập nhật ở nơi khác. Đã tải lại, hãy đánh giá lần nữa."
          : gearErrorMessage(evaluateError),
      );
      if (code === "GEAR_PLAN_CAS_CONFLICT" && planId) await loadGuidance(planId).catch(() => null);
    } finally {
      setBusy(null);
    }
  }

  /** Bật/tắt "Tôi tự chuẩn bị" cho một yêu cầu rồi đánh giá lại với thời tiết đã xác nhận. */
  async function toggleSelfProvided(requirementId: string) {
    if (!accessToken || !plan || !evaluatedClimate) return;
    setBusy(`self:${requirementId}`);
    setError("");
    setNotice("");
    try {
      const current = selfProvidedOf(plan);
      const enabling = !current.includes(requirementId);
      const next = enabling ? [...current, requirementId] : current.filter((id) => id !== requirementId);
      const updated = await gearAdvisorApi.updatePlan(
        plan.id,
        { expectedInputRevision: plan.inputRevision, selfProvidedRequirementIds: next },
        accessToken,
      );
      await gearAdvisorApi.evaluate(updated.id, { expectedInputRevision: updated.inputRevision, confirmedClimate: evaluatedClimate }, accessToken);
      await loadGuidance(plan.id);
      setNotice(enabling ? "Đã ghi nhận bạn tự chuẩn bị món này. Kết quả đã được cập nhật." : "Đã bỏ đánh dấu tự chuẩn bị. Kết quả đã được cập nhật.");
    } catch (toggleError: unknown) {
      setError(
        gearErrorCode(toggleError) === "GEAR_PLAN_CAS_CONFLICT"
          ? "Kế hoạch vừa được cập nhật ở nơi khác. Đã tải lại, hãy thử lại."
          : gearErrorMessage(toggleError),
      );
      await loadGuidance(plan.id).catch(() => null);
    } finally {
      setBusy(null);
    }
  }

  const questionsByItem = useMemo(() => {
    const map = new Map<string, { name: string; category: string; questions: GuidanceQuestion[] }>();
    const add = (itemId: string, name: string | null, category: string, questions: GuidanceQuestion[]) => {
      const entry = map.get(itemId) ?? { name: name ?? itemNames[itemId] ?? "Món đồ", category, questions: [] };
      for (const question of questions) {
        if (question.valueType === "unknown" || question.field === "attributes") continue;
        if (!entry.questions.some((existing) => existing.field === question.field)) entry.questions.push(question);
      }
      map.set(itemId, entry);
    };
    guidance?.items?.forEach((item) => add(item.itemId, item.nameAtEvaluation, item.category, item.questions ?? []));
    if (guidance?.contextQuestions?.available) {
      guidance.contextQuestions.items.forEach((item) => add(item.itemId, item.nameAtEvaluation, item.category, item.questions));
    }
    return [...map.entries()].filter(([, entry]) => entry.questions.length > 0);
  }, [guidance, itemNames]);

  const answeredCount = Object.values(answers).filter((value) => value !== "").length;

  async function saveAnswers() {
    if (!accessToken) return;
    setBusy("answers");
    setError("");
    setNotice("");
    try {
      const byItem = new Map<string, Record<string, unknown>>();
      for (const [key, raw] of Object.entries(answers)) {
        if (raw === "") continue; // "Không biết": giữ nguyên, không tự điền
        const [itemId, field] = key.split("::");
        const question = questionsByItem.find(([id]) => id === itemId)?.[1].questions.find((q) => q.field === field);
        if (!question) continue;
        const value =
          question.valueType === "number" ? Number(raw.replace(",", ".")) : question.valueType === "boolean" ? raw === "true" : raw;
        if (question.valueType === "number" && !Number.isFinite(value as number)) throw new Error(`"${raw}" không phải số.`);
        byItem.set(itemId, { ...(byItem.get(itemId) ?? {}), [field]: value });
      }
      for (const [itemId, attributes] of byItem) {
        const version = await gearAdvisorApi.itemVersion(itemId, accessToken);
        await gearAdvisorApi.patchItemAttributes(itemId, version, attributes, accessToken);
      }
      setAnswers({});
      setNotice(`Đã lưu thông tin cho ${byItem.size} món vào Tủ đồ. Bấm "Đánh giá lại" để cập nhật kết quả.`);
      if (plan) await loadGuidance(plan.id);
    } catch (saveError: unknown) {
      setError(gearErrorMessage(saveError));
    } finally {
      setBusy(null);
    }
  }

  const requirementTitles = useMemo(
    () =>
      Object.fromEntries(
        (guidance?.requirements ?? []).map((requirement) => [
          requirement.requirementId,
          checklist.find((item) => item.requirementId === requirement.requirementId)?.title ?? categoryLabel(String(requirement.category)),
        ]),
      ),
    [checklist, guidance],
  );

  const stats = useMemo(() => {
    const required = (guidance?.requirements ?? []).filter((requirement) => requirement.priority !== "OPTIONAL");
    const ready = required.filter((r) => r.status === "COVERED_BY_OWNED" || r.status === "USER_DECLARED_PROVISION").length;
    const needInfo = required.filter((r) => r.status === "UNKNOWN").length;
    return { total: required.length, ready, needInfo, needGear: required.length - ready - needInfo };
  }, [guidance]);
  const requiredIds = useMemo(
    () => (guidance?.requirements ?? []).filter((r) => r.priority !== "OPTIONAL").map((r) => r.requirementId),
    [guidance],
  );
  const needsRental = (guidance?.requirements ?? []).some((r) => r.priority !== "OPTIONAL" && (r.remainingQuantity ?? 0) > 0);
  const selfProvided = selfProvidedOf(plan);
  const allReady = Boolean(guidance?.available) && stats.total > 0 && stats.ready === stats.total && !resultOutdated;
  const stepDone = [Boolean(prefill), climateConfirmed, Boolean(plan?.evaluatedRevision) && !resultOutdated, allReady];
  const firstOpen = stepDone.findIndex((done) => !done);
  const trailSteps = ["Chuyến đi", "Thời tiết", "Đồ mang", "Kết quả", "Đóng gói"].map((label, index) => ({
    label,
    state: (index < stepDone.length && stepDone[index]
      ? "done"
      : index === (firstOpen === -1 ? 4 : firstOpen)
        ? "current"
        : "todo") as TrailStepState,
  }));
  const showSteps = Boolean(tripId) && busy !== "trip" && !tripBlocked;
  const canEvaluate = Boolean(climateValue) && climateConfirmed && busy === null;
  function rememberOffset(step: number, y: number) {
    stepOffsets.current[step] = y;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} accessibilityLabel="Quay lại">
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.eyebrow}>GEAR ADVISOR</Text>
          <Text style={styles.title}>Kế hoạch đồ</Text>
        </View>
        <TouchableOpacity style={styles.headerChip} onPress={() => router.push("/wardrobe" as Href)}>
          <Ionicons name="file-tray-full-outline" size={16} color={Trek.trail} />
          <Text style={styles.headerChipText}>Tủ đồ</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <MountainHero
          eyebrow="Gear advisor"
          title="Chuẩn bị đồ đúng cho"
          highlight="từng cung đường."
          description="Đối chiếu đồ trong tủ với thời tiết và độ khó của chuyến, chỉ ra món đạt, món thiếu, rồi gợi ý thuê hoặc để bạn tự chuẩn bị."
        >
          {selectedTrip ? (
            <PopIn style={styles.heroCard}>
              <Text style={styles.heroCardLabel}>ĐANG CHUẨN BỊ CHO</Text>
              <Text style={styles.heroCardTitle} numberOfLines={2}>{selectedTrip.title}</Text>
              {guidance?.available && stats.total ? (
                <>
                  <SummitProgress value={stats.ready} total={stats.total} dark height={70} />
                  <Text style={styles.heroCardText}>
                    {allReady ? "Đã tới đỉnh — mọi yêu cầu bắt buộc đã sẵn sàng." : `Yêu cầu bắt buộc đã sẵn sàng: ${stats.ready}/${stats.total}`}
                  </Text>
                </>
              ) : (
                <Text style={styles.heroCardText}>Xác nhận thời tiết và chọn đồ để bắt đầu leo.</Text>
              )}
            </PopIn>
          ) : (
            <View style={styles.heroCta}>
              <View style={styles.heroCtaDot} />
              <Text style={styles.heroCtaText}>Bắt đầu bằng cách chọn chuyến đi bên dưới</Text>
            </View>
          )}
        </MountainHero>

        <View style={styles.stepperCard}>
          <TrailStepper steps={trailSteps} />
        </View>

        {error ? <Banner tone="error" text={error} onClose={() => setError("")} /> : null}
        {notice ? <Banner tone="ok" text={notice} onClose={() => setNotice("")} /> : null}

        <Step number={1} title="Chọn chuyến đi" done={stepDone[0]} onMeasure={rememberOffset}>
          {loading ? (
            <CompassLoader label="Đang tải chuyến đi và tủ đồ..." />
          ) : trips.length === 0 ? (
            <Text style={styles.muted}>Chưa có chuyến nào. Bạn cần vé đã xác nhận hoặc tham gia một chuyến riêng trước.</Text>
          ) : (
            trips.map((trip, index) => {
              const active = trip.id === tripId;
              return (
                <FadeInUp key={trip.id} delay={index * 60}>
                  <TouchableOpacity
                    style={[styles.tripCard, active && styles.tripCardActive]}
                    disabled={busy !== null}
                    onPress={() => void openTrip(trip.id)}
                  >
                    <View style={[styles.tripIcon, active && styles.tripIconActive]}>
                      <Ionicons name="trail-sign" size={20} color={active ? "#ffffff" : Trek.trail} />
                    </View>
                    <View style={styles.flexOne}>
                      <Text style={styles.tripTitle} numberOfLines={2}>{trip.title}</Text>
                      <View style={styles.tripMeta}>
                        <Text style={styles.hint}>{trip.startAt ? formatDate(trip.startAt) : "Chưa có ngày"}</Text>
                        <Text style={[styles.typeBadge, trip.type === "PRIVATE" ? styles.typePrivate : styles.typePublic]}>
                          {trip.type === "PRIVATE" ? "Chuyến riêng" : "Có vé"}
                        </Text>
                      </View>
                    </View>
                    {active ? (
                      <PopIn style={styles.tripCheck}>
                        <Ionicons name="checkmark" size={14} color="#ffffff" />
                      </PopIn>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceMuted} />
                    )}
                  </TouchableOpacity>
                </FadeInUp>
              );
            })
          )}
          {busy === "trip" ? <CompassLoader label="Đang tải thông tin cung đường..." /> : null}
          {plan && !tripBlocked ? (
            <Text style={styles.hint}>
              {plan.evaluatedRevision ? `Kế hoạch đã lưu · đánh giá lần ${plan.evaluatedRevision}` : "Kế hoạch đã lưu, chưa đánh giá"}
            </Text>
          ) : null}
          {prefill && !tripBlocked ? <TripFacts prefill={prefill} /> : null}
          {tripBlocked ? (
            <View style={styles.warnBox}>
              <Text style={styles.warnTitle}>Chưa thể tư vấn đồ cho chuyến này</Text>
              <Text style={styles.warnText}>{tripBlocked}</Text>
              <Text style={styles.warnText}>Hãy chọn chuyến khác hoặc liên hệ TrekGo để bổ sung thông tin cung đường.</Text>
            </View>
          ) : null}
        </Step>

        {showSteps ? (
          <>
            <Step number={2} title="Xác nhận thời tiết" done={stepDone[1]} onMeasure={rememberOffset}>
              <ClimateSource
                origin={climateOrigin}
                prefill={prefill}
                current={climateValue}
                onApply={(next) => {
                  setClimate(toDraft(next));
                  setClimateOrigin("SUGGESTED");
                  setClimateConfirmed(false);
                }}
              />
              <View style={styles.climateGrid}>
                {CLIMATE_FIELDS.map(([key, label, unit, kind], index) => (
                  <FadeInUp key={key} delay={index * 80} style={styles.climateCell}>
                    <WeatherTile
                      kind={kind}
                      label={label}
                      unit={unit}
                      value={climate[key]}
                      gauge={climateGauge(key, climate[key])}
                      onChange={(text) => {
                        setClimate((current) => ({ ...current, [key]: text }));
                        setClimateConfirmed(false);
                        setClimateOrigin("MANUAL");
                      }}
                    />
                  </FadeInUp>
                ))}
              </View>
              {!climateValue && CLIMATE_FIELDS.every(([key]) => climate[key] !== "") ? (
                <Text style={styles.errorText}>Nhiệt độ thấp nhất không được cao hơn cao nhất; khả năng mưa từ 0 đến 100%.</Text>
              ) : null}
              <View style={styles.confirmRow}>
                <Switch
                  value={climateConfirmed}
                  disabled={!climateValue}
                  onValueChange={setClimateConfirmed}
                  trackColor={{ true: Trek.trail, false: Colors.surfaceContainerHighest }}
                  thumbColor="#ffffff"
                />
                <Text style={styles.confirmText}>Tôi đã kiểm tra và xác nhận thời tiết này</Text>
              </View>
            </Step>

            <Step number={3} title="Chọn đồ bạn sẽ mang" done={stepDone[2]} onMeasure={rememberOffset}>
              <View style={styles.rowBetween}>
                <Text style={[styles.muted, styles.flexOne]}>Chọn món trong Tủ đồ bạn định mang để kiểm tra độ phù hợp.</Text>
                <Text style={styles.countPill}>{selected.length} món</Text>
              </View>
              {items.length === 0 ? (
                <TouchableOpacity style={styles.emptyGear} onPress={() => router.push("/wardrobe" as Href)}>
                  <Ionicons name="file-tray-outline" size={28} color={Trek.trail} />
                  <Text style={styles.muted}>
                    Tủ đồ đang trống. <Text style={styles.link}>Thêm đồ vào Tủ đồ</Text> hoặc đánh giá luôn để xem chuyến cần gì.
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={16} color={Colors.onSurfaceMuted} />
                    <TextInput
                      value={gearSearch}
                      onChangeText={setGearSearch}
                      placeholder="Tìm theo tên hoặc thương hiệu..."
                      placeholderTextColor={Colors.onSurfaceMuted}
                      style={styles.searchInput}
                    />
                  </View>
                  {itemsByCategory.length === 0 ? <Text style={styles.hint}>Không tìm thấy món đồ phù hợp.</Text> : null}
                  {itemsByCategory.map((group) => (
                    <View key={group.category} style={styles.group}>
                      <View style={styles.groupHead}>
                        <GearThumb category={group.category} size={26} radius={8} />
                        <Text style={[styles.groupLabel, styles.flexOne]}>{group.label}</Text>
                        <Text style={styles.hint}>
                          {group.items.filter((item) => selected.includes(item.id)).length}/{group.items.length}
                        </Text>
                      </View>
                      {group.items.map((item) => {
                        const checked = selected.includes(item.id);
                        const completeness = specCompleteness(item);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.gearRow, checked && styles.gearRowActive]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked }}
                            onPress={() =>
                              setSelected((current) => (checked ? current.filter((id) => id !== item.id) : [...current, item.id]))
                            }
                          >
                            <GearThumb url={item.photoUrl} category={item.category} size={50} />
                            <View style={styles.flexOne}>
                              <Text style={styles.gearName} numberOfLines={2}>{item.name}</Text>
                              <Text style={styles.hint} numberOfLines={1}>{item.brand || "Chưa rõ hãng"}</Text>
                              <View style={styles.gearBar}>
                                <CompletenessBar known={completeness.known} total={completeness.total} />
                              </View>
                            </View>
                            <View style={[styles.checkCircle, checked && styles.checkCircleOn]}>
                              {checked ? (
                                <PopIn>
                                  <Ionicons name="checkmark" size={14} color="#ffffff" />
                                </PopIn>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                  <Text style={styles.hint}>Thiếu món nào cứ để trống — kết quả sẽ chỉ ra loại đồ còn cần chuẩn bị.</Text>
                </>
              )}
              <TouchableOpacity
                style={[styles.primaryButton, !canEvaluate && styles.disabled]}
                disabled={!canEvaluate}
                onPress={() => void evaluate()}
              >
                <Ionicons name={guidance ? "refresh" : "flag"} size={18} color="#ffffff" />
                <Text style={styles.primaryButtonText}>
                  {busy === "evaluate" ? "Đang đánh giá..." : guidance ? "Đánh giá lại" : "Đánh giá kế hoạch"}
                </Text>
              </TouchableOpacity>
              {busy === "evaluate" ? (
                <CompassLoader label="Đang đối chiếu đồ với cung đường..." />
              ) : !climateConfirmed ? (
                <Text style={styles.hint}>Cần xác nhận thời tiết ở bước 2.</Text>
              ) : resultOutdated && guidance ? (
                <Text style={styles.outdatedHint}>Có thay đổi chưa được đánh giá.</Text>
              ) : null}
            </Step>

            {guidance ? (
              <Step number={4} title="Kết quả theo từng yêu cầu" done={allReady} onMeasure={rememberOffset}>
                {resultOutdated ? (
                  <View style={styles.warnBox}>
                    <Text style={styles.warnText}>
                      Thời tiết, đồ đã chọn hoặc thông tin chuyến đã thay đổi. Đây là kết quả lần trước; xác nhận thời tiết và bấm “Đánh giá lại”.
                    </Text>
                  </View>
                ) : null}
                {!guidance.available ? (
                  <Text style={styles.muted}>{guidance.message ?? "Phiên bản này không có dữ liệu đánh giá chi tiết."}</Text>
                ) : (
                  <>
                    {evaluatedClimate ? <Text style={styles.hint}>Đánh giá với thời tiết: {climateSummary(evaluatedClimate)}</Text> : null}
                    <ResultSummary stats={stats} />

                    {(guidance.requirements ?? []).map((requirement, index) => (
                      <FadeInUp key={requirement.requirementId} delay={index * 70}>
                        <RequirementCard
                          requirement={requirement}
                          title={requirementTitles[requirement.requirementId]}
                          itemsById={itemsById}
                          selfProvided={selfProvided.includes(requirement.requirementId)}
                          toggleDisabled={busy !== null || resultOutdated || !evaluatedClimate}
                          toggling={busy === `self:${requirement.requirementId}`}
                          onToggleSelfProvided={() => void toggleSelfProvided(requirement.requirementId)}
                        />
                      </FadeInUp>
                    ))}

                    {needsRental && plan?.evaluatedRevision && !resultOutdated && accessToken ? (
                      <GearRentalOptionsCard
                        key={`${plan.id}:${plan.evaluatedRevision}`}
                        planId={plan.id}
                        tripId={tripId}
                        evaluatedRevision={plan.evaluatedRevision}
                        accessToken={accessToken}
                        requirementTitles={requirementTitles}
                        requiredIds={requiredIds}
                      />
                    ) : null}

                    {questionsByItem.length ? (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Bổ sung thông số để đánh giá chính xác hơn</Text>
                        <Text style={styles.hint}>Câu trả lời được lưu vào Tủ đồ. Không chắc thì để “Không biết” — hệ thống không tự điền thay bạn.</Text>
                        {questionsByItem.map(([itemId, entry]) => (
                          <View key={itemId} style={styles.questionCard}>
                            <View style={styles.rowStart}>
                              <GearThumb url={itemPhotos[itemId]} category={entry.category} size={36} radius={10} />
                              <View style={styles.flexOne}>
                                <Text style={styles.gearName}>{entry.name}</Text>
                                <Text style={styles.hint}>{categoryLabel(entry.category)}</Text>
                              </View>
                            </View>
                            {entry.questions.map((question) => {
                              const key = `${itemId}::${question.field}`;
                              return (
                                <View key={key} style={styles.question}>
                                  <Text style={styles.label}>
                                    {question.question}
                                    {question.unit ? ` (${question.unit})` : ""}
                                  </Text>
                                  <QuestionInput
                                    question={question}
                                    value={answers[key] ?? ""}
                                    onChange={(value) => setAnswers((current) => ({ ...current, [key]: value }))}
                                  />
                                </View>
                              );
                            })}
                          </View>
                        ))}
                        <TouchableOpacity
                          style={[styles.secondaryButton, (answeredCount === 0 || busy !== null) && styles.disabled]}
                          disabled={answeredCount === 0 || busy !== null}
                          onPress={() => void saveAnswers()}
                        >
                          <Text style={styles.secondaryButtonText}>
                            {busy === "answers" ? "Đang lưu..." : `Lưu ${answeredCount || ""} câu trả lời vào Tủ đồ`}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Đồ bạn đã chọn</Text>
                      {guidance.items?.length ? (
                        guidance.items.map((item) => {
                          const status = ITEM_STATUS[item.displayStatus] ?? ITEM_STATUS.NEEDS_ATTENTION;
                          return (
                            <View key={item.itemId} style={styles.resultItem}>
                              <GearThumb url={itemPhotos[item.itemId]} category={item.category} size={46} />
                              <View style={styles.flexOne}>
                                <View style={styles.rowBetween}>
                                  <Text style={[styles.gearName, styles.flexOne]} numberOfLines={2}>
                                    {item.nameAtEvaluation ?? itemNames[item.itemId] ?? "Món đồ"}
                                  </Text>
                                  <Text style={[styles.badge, { color: status.color, backgroundColor: status.bg }]}>{status.label}</Text>
                                </View>
                                <Text style={styles.hint}>{categoryLabel(item.category)}</Text>
                                {(item.reasons ?? []).map((reason) => (
                                  <Text key={reason} style={styles.reason}>• {reason}</Text>
                                ))}
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.muted}>Lần đánh giá này chưa chọn món nào trong Tủ đồ.</Text>
                      )}
                    </View>
                  </>
                )}
              </Step>
            ) : null}

            {plan && guidance?.available && checklist.length > 0 && accessToken ? (
              <Step number={5} title="Checklist của chuyến" done={false} onMeasure={rememberOffset}>
                <PackingChecklistCard
                  key={`${plan.id}:${plan.evaluatedRevision}`}
                  plan={plan}
                  checklist={checklist}
                  itemNames={itemNames}
                  itemPhotos={itemPhotos}
                  stale={resultOutdated}
                  accessToken={accessToken}
                  onPlanChange={setPlan}
                />
              </Step>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({
  number,
  title,
  done,
  children,
  onMeasure,
}: {
  number: number;
  title: string;
  done: boolean;
  children: ReactNode;
  onMeasure?: (step: number, y: number) => void;
}) {
  return (
    <View onLayout={(event: LayoutChangeEvent) => onMeasure?.(number, event.nativeEvent.layout.y)}>
      <FadeInUp style={[styles.step, done && styles.stepDone]}>
        <View style={[styles.stepEdge, done && styles.stepEdgeDone]} />
        <View style={styles.stepHead}>
          <TrailSign number={number} done={done} />
          <Text style={[styles.stepTitle, styles.flexOne]}>{title}</Text>
          {done ? (
            <PopIn>
              <Text style={styles.stepDoneBadge}>Đã qua chặng</Text>
            </PopIn>
          ) : null}
        </View>
        {children}
      </FadeInUp>
    </View>
  );
}

function Banner({ tone, text, onClose }: { tone: "error" | "ok"; text: string; onClose: () => void }) {
  return (
    <PopIn style={[styles.banner, tone === "error" ? styles.bannerError : styles.bannerOk]}>
      <Ionicons
        name={tone === "error" ? "alert-circle" : "checkmark-circle"}
        size={18}
        color={tone === "error" ? Colors.error : Trek.trail}
      />
      <Text style={[styles.bannerText, { color: tone === "error" ? Colors.onErrorContainer : Trek.ink }]}>{text}</Text>
      <TouchableOpacity onPress={onClose} accessibilityLabel="Đóng thông báo">
        <Ionicons name="close" size={18} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>
    </PopIn>
  );
}

const FACT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "Điểm đến": "location-outline",
  "Khởi hành": "calendar-outline",
  "Thời gian": "time-outline",
  "Độ khó": "trending-up-outline",
  "Địa hình": "map-outline",
  "Điểm cao nhất": "flag-outline",
};

/** Thông tin chuyến mà các yêu cầu dựa vào: số ngày, độ khó, địa hình. */
function TripFacts({ prefill }: { prefill: GearPlanPrefill }) {
  const facts: [string, ReactNode][] = [];
  if (prefill.destination) facts.push(["Điểm đến", prefill.destination]);
  if (prefill.startAt) facts.push(["Khởi hành", formatDate(prefill.startAt)]);
  if (prefill.days) facts.push(["Thời gian", `${prefill.days} ngày${prefill.days >= 2 ? ` · ${prefill.days - 1} đêm` : ""}`]);
  if (prefill.difficulty) {
    facts.push([
      "Độ khó",
      <View key="d" style={styles.rowStart}>
        <DifficultyPeaks level={prefill.difficulty} />
        <Text style={styles.factValue}>{prefill.difficulty}/5</Text>
      </View>,
    ]);
  }
  if (prefill.terrain?.length) facts.push(["Địa hình", prefill.terrain.map((t) => TERRAIN_LABELS[t.toLowerCase()] ?? t).join(", ")]);
  if (prefill.highestElevationM) facts.push(["Điểm cao nhất", `${prefill.highestElevationM.toLocaleString("vi-VN")} m`]);
  if (!facts.length) return null;
  return (
    <View style={styles.facts}>
      <View style={styles.factGrid}>
        {facts.map(([label, value], index) => (
          <FadeInUp key={label} delay={index * 70} style={styles.fact}>
            <View style={styles.factIcon}>
              <Ionicons name={FACT_ICONS[label]} size={16} color={Trek.trail} />
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.hint}>{label}</Text>
              {typeof value === "string" ? <Text style={styles.factValue}>{value}</Text> : value}
            </View>
          </FadeInUp>
        ))}
      </View>
      <Text style={styles.hint}>Số ngày, độ khó, địa hình và độ cao quyết định đồ cần mang (độ ấm của áo và túi ngủ, dung tích balo, giày có cổ...).</Text>
    </View>
  );
}

function suggestionLabel(suggestion: ClimateSuggestion, destination: string | null) {
  if (suggestion.source !== "FORECAST") return `Ước tính theo mùa${destination ? ` tại ${destination}` : ""}`;
  return suggestion.atElevationM
    ? `Dự báo tại điểm cao nhất (${suggestion.atElevationM.toLocaleString("vi-VN")} m)`
    : "Dự báo cho ngày đi";
}

/** Cho biết số trên form lấy từ đâu và cho đổi sang gợi ý khác. */
function ClimateSource({
  origin,
  prefill,
  current,
  onApply,
}: {
  origin: ClimateOrigin;
  prefill: GearPlanPrefill | null;
  current: ConfirmedClimate | null;
  onApply: (climate: ConfirmedClimate) => void;
}) {
  const suggested = prefill?.suggestedClimate ?? null;
  const forecast = prefill?.forecastClimate ?? null;
  const alternatives = [suggested, forecast].filter(
    (candidate, index, list): candidate is ClimateSuggestion =>
      Boolean(candidate) && !sameClimate(candidate, current) && list.findIndex((other) => sameClimate(other, candidate)) === index,
  );
  const headline =
    origin === "PLAN"
      ? "Đây là thời tiết bạn đã xác nhận ở lần đánh giá gần nhất."
      : origin === "SUGGESTED" && suggested
        ? `${suggestionLabel(suggested, prefill?.destination ?? null)}. Hãy đối chiếu với dự báo thực tế trước khi xác nhận.`
        : origin === "MANUAL"
          ? "Bạn đang tự nhập thời tiết."
          : "Chưa có gợi ý thời tiết cho chuyến này. Hãy nhập theo dự báo bạn tham khảo — hệ thống không tự đoán.";
  const activeNote = origin === "SUGGESTED" && suggested ? suggested.noteVi ?? suggested.sourceReference : null;
  return (
    <View style={styles.sourceWrap}>
      <Text style={styles.muted}>{headline}</Text>
      {activeNote ? <Text style={styles.hint}>{activeNote}</Text> : null}
      {alternatives.map((alternative) => (
        <View key={alternative.source} style={styles.altCard}>
          <Ionicons name={alternative.source === "FORECAST" ? "cloudy-night-outline" : "leaf-outline"} size={18} color={Trek.skyInk} />
          <View style={styles.flexOne}>
            <Text style={styles.altTitle}>{suggestionLabel(alternative, prefill?.destination ?? null)}</Text>
            <Text style={styles.altText}>{climateSummary(alternative)}</Text>
          </View>
          <TouchableOpacity style={styles.altButton} onPress={() => onApply(alternative)}>
            <Text style={styles.altButtonText}>Dùng số này</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function WeatherTile({
  kind,
  label,
  unit,
  value,
  gauge,
  onChange,
}: {
  kind: WeatherKind;
  label: string;
  unit: string;
  value: string;
  gauge: number;
  onChange: (value: string) => void;
}) {
  const rain = kind === "rain";
  return (
    <View style={styles.weatherTile}>
      <View style={styles.rowBetween}>
        <Text style={[styles.weatherLabel, styles.flexOne]}>{label}</Text>
        <WeatherGlyph kind={kind} size={36} />
      </View>
      <View style={styles.weatherValueRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numbers-and-punctuation"
          placeholder="—"
          placeholderTextColor="#c4ccc6"
          style={styles.weatherInput}
        />
        <Text style={styles.weatherUnit}>{unit}</Text>
      </View>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeFill, { width: `${Math.round(gauge * 100)}%`, backgroundColor: rain ? "#3b82f6" : gauge > 0.6 ? "#f59e0b" : "#34a37a" }]} />
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.gaugeLabel}>{rain ? "0%" : "-10°C"}</Text>
        <Text style={styles.gaugeLabel}>{rain ? "100%" : "40°C"}</Text>
      </View>
    </View>
  );
}

function ResultSummary({ stats }: { stats: { total: number; ready: number; needInfo: number; needGear: number } }) {
  if (!stats.total) return null;
  const done = stats.ready === stats.total;
  return (
    <FadeInUp style={[styles.summary, done ? styles.summaryDone : styles.summaryProgress]}>
      <Text style={[styles.summaryEyebrow, { color: done ? Trek.trail : "#b45309" }]}>
        {done ? "ĐỈNH ĐÃ CHINH PHỤC" : "ĐANG TRÊN ĐƯỜNG LÊN ĐỈNH"}
      </Text>
      <Text style={styles.summaryTitle}>{done ? "Sẵn sàng lên đường!" : `${stats.ready}/${stats.total} yêu cầu bắt buộc đã sẵn sàng`}</Text>
      <Text style={styles.muted}>
        {done
          ? "Mọi yêu cầu bắt buộc đã có đồ phù hợp hoặc bạn tự chuẩn bị."
          : [stats.needGear ? `${stats.needGear} yêu cầu còn thiếu đồ phù hợp` : "", stats.needInfo ? `${stats.needInfo} yêu cầu cần thêm thông số` : ""]
              .filter(Boolean)
              .join(" · ")}
      </Text>
      <SummitProgress value={stats.ready} total={stats.total} height={86} />
    </FadeInUp>
  );
}

function RequirementCard({
  requirement,
  title,
  itemsById,
  selfProvided,
  toggleDisabled,
  toggling,
  onToggleSelfProvided,
}: {
  requirement: GuidanceRequirement;
  title: string;
  itemsById: Record<string, UserGearItem>;
  selfProvided: boolean;
  toggleDisabled: boolean;
  toggling: boolean;
  onToggleSelfProvided: () => void;
}) {
  const optional = requirement.priority === "OPTIONAL";
  const status =
    requirement.status === "MISSING" && optional
      ? { label: "Không bắt buộc", color: "#55625a", bg: "#eef1ef", hint: undefined }
      : REQUIREMENT_STATUS[String(requirement.status)] ?? { label: "Xem chi tiết", color: "#55625a", bg: "#eef1ef", hint: undefined };
  const ready = requirement.status === "COVERED_BY_OWNED" || requirement.status === "USER_DECLARED_PROVISION";
  const criteria = requirement.criteria ?? [];
  const assigned = requirement.assignedItemIds ?? [];
  const canToggle = requirement.status !== "COVERED_BY_OWNED";
  const bandColor = ready ? Trek.trail : optional ? "#cfd6d1" : "#f59e0b";
  return (
    <View style={[styles.reqCard, { borderColor: ready ? "#bcdcc6" : optional ? Trek.line : "#f1d6a3" }]}>
      <View style={[styles.reqBand, { backgroundColor: bandColor }]} />
      <View style={styles.rowStart}>
        <GearThumb category={String(requirement.category)} size={42} />
        <View style={styles.flexOne}>
          <Text style={styles.gearName}>{title}</Text>
          <Text style={styles.hint}>
            {categoryLabel(String(requirement.category))}
            {optional ? " · không bắt buộc" : " · bắt buộc"}
            {requirement.quantity && requirement.quantity > 1 ? ` · cần ${requirement.quantity} món` : ""}
          </Text>
        </View>
        <Text style={[styles.badge, { color: status.color, backgroundColor: status.bg }]}>
          {status.label}
          {(requirement.remainingQuantity ?? 0) > 0 && (requirement.quantity ?? 1) > 1 ? ` (${requirement.remainingQuantity})` : ""}
        </Text>
      </View>

      {assigned.length ? (
        <View style={styles.assignedRow}>
          {assigned.map((id) => {
            const item = itemsById[id];
            return (
              <View key={id} style={styles.assignedChip}>
                <GearThumb url={item?.photoUrl} category={String(requirement.category)} size={22} radius={6} />
                <Text style={styles.assignedText} numberOfLines={1}>{item?.name ?? "Món không còn trong Tủ đồ"}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {criteria.length ? (
        criteria.map((criterion) => (
          <View key={`${criterion.field}:${criterion.text}`} style={styles.criterion}>
            <Ionicons name="checkmark-done-outline" size={14} color={Trek.trail} />
            <View style={styles.flexOne}>
              <Text style={styles.criterionText}>{criterion.text}</Text>
              {criterion.reason ? <Text style={styles.hint}>Vì: {criterion.reason}</Text> : null}
            </View>
          </View>
        ))
      ) : requirement.status !== "USER_DECLARED_PROVISION" ? (
        <Text style={styles.hint}>Không có tiêu chí kỹ thuật riêng — chỉ cần mang đúng loại đồ.</Text>
      ) : null}

      {(requirement.warnings ?? []).map((warning) => (
        <Text key={warning} style={styles.warningLine}>• {warning}</Text>
      ))}
      {status.hint && !(optional && requirement.status === "MISSING") ? <Text style={styles.hint}>{status.hint}</Text> : null}

      {canToggle ? (
        <TouchableOpacity
          style={[styles.selfButton, selfProvided ? styles.selfButtonOn : null, toggleDisabled && styles.disabled]}
          disabled={toggleDisabled}
          onPress={onToggleSelfProvided}
        >
          <Ionicons name={selfProvided ? "close-circle-outline" : "hand-left-outline"} size={15} color={selfProvided ? "#55625a" : Trek.indigoInk} />
          <Text style={[styles.selfButtonText, selfProvided && { color: "#55625a" }]}>
            {toggling ? "Đang cập nhật..." : selfProvided ? "Bỏ tự chuẩn bị" : "Tôi tự chuẩn bị (mượn, mua...)"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function QuestionInput({ question, value, onChange }: { question: GuidanceQuestion; value: string; onChange: (value: string) => void }) {
  if (question.valueType === "boolean" || question.valueType === "enum") {
    const choices: [string, string][] =
      question.valueType === "boolean"
        ? [["", "Không biết"], ["true", "Có"], ["false", "Không"]]
        : [["", "Không biết"], ...(question.options ?? []).map((option): [string, string] => [option, COVERAGE_LABELS[option] ?? option])];
    return (
      <View style={styles.chipRow}>
        {choices.map(([choice, label]) => {
          const active = value === choice;
          return (
            <TouchableOpacity key={choice || "unknown"} style={[styles.chip, active && styles.chipActive]} onPress={() => onChange(choice)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
  return (
    <TextInput
      value={value}
      placeholder="Không biết"
      placeholderTextColor={Colors.mute}
      keyboardType="numbers-and-punctuation"
      onChangeText={onChange}
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Trek.paper },
  flexOne: { flex: 1 },
  disabled: { opacity: 0.45 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowStart: { flexDirection: "row", alignItems: "center", gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  headerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Trek.mintPale,
  },
  headerChipText: { color: Trek.trail, fontSize: 12, fontWeight: "800" },
  eyebrow: { color: Trek.trail, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: Trek.ink, fontSize: 19, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 56, gap: 14 },
  heroCard: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(255,255,255,0.1)" },
  heroCardLabel: { color: Trek.mint, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroCardTitle: { marginTop: 3, color: "#ffffff", fontSize: 16, fontWeight: "800" },
  heroCardText: { marginTop: 4, color: "rgba(236,253,245,0.8)", fontSize: 12 },
  heroCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Trek.sun,
  },
  heroCtaDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ffffff" },
  heroCtaText: { color: "#3b2302", fontSize: 12, fontWeight: "800" },
  stepperCard: { paddingVertical: 14, paddingHorizontal: 6, borderRadius: Radius.lg, backgroundColor: "#ffffff", ...Shadows.card },
  step: {
    overflow: "hidden",
    padding: 16,
    paddingLeft: 18,
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Trek.line,
    backgroundColor: "#ffffff",
    ...Shadows.card,
  },
  stepDone: { borderColor: "#bcdcc6" },
  stepEdge: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: Trek.wood },
  stepEdgeDone: { backgroundColor: Trek.trail },
  stepHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepTitle: { color: Trek.ink, fontSize: 16, fontWeight: "800" },
  stepDoneBadge: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    color: Trek.trail,
    backgroundColor: Trek.mintPale,
    fontSize: 10,
    fontWeight: "800",
  },
  muted: { color: "#55625a", fontSize: 13, lineHeight: 19 },
  hint: { color: Trek.muted, fontSize: 11, lineHeight: 16 },
  link: { color: Trek.trail, fontWeight: "800" },
  label: { color: "#55625a", fontSize: 12, fontWeight: "600" },
  errorText: { color: Colors.error, fontSize: 12 },
  tripCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eae4",
    backgroundColor: "#ffffff",
  },
  tripCardActive: { borderColor: Trek.trail, backgroundColor: "#edf7ee" },
  tripIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#eef4ee" },
  tripIconActive: { backgroundColor: Trek.trail },
  tripTitle: { color: Colors.onSurface, fontSize: 14, fontWeight: "700" },
  tripMeta: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 6 },
  typeBadge: { overflow: "hidden", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, fontSize: 9, fontWeight: "800" },
  typePrivate: { color: "#6d28d9", backgroundColor: "#f3eefe" },
  typePublic: { color: "#0369a1", backgroundColor: "#e8f4fb" },
  tripCheck: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: Trek.trail },
  warnBox: { gap: 4, padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: "#f1d6a3", backgroundColor: Trek.amberBg },
  warnTitle: { color: "#6b4500", fontSize: 13, fontWeight: "800" },
  warnText: { color: "#6b4500", fontSize: 12, lineHeight: 18 },
  facts: { gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "#e4eae4", backgroundColor: "#fbfcfa" },
  factGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  fact: { width: "50%", flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 6 },
  factIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e4eae4",
    backgroundColor: "#ffffff",
  },
  factValue: { color: Colors.onSurface, fontSize: 13, fontWeight: "700" },
  sourceWrap: { gap: 8 },
  altCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#cfe6f5",
    backgroundColor: "#f2f9fd",
  },
  altTitle: { color: Trek.skyInk, fontSize: 12, fontWeight: "800" },
  altText: { marginTop: 1, color: "#24546f", fontSize: 11 },
  altButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.sm, borderWidth: 1, borderColor: "#9fcbe6", backgroundColor: "#ffffff" },
  altButtonText: { color: Trek.skyInk, fontSize: 11, fontWeight: "800" },
  climateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  climateCell: { width: "48%", flexGrow: 1 },
  weatherTile: { padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "#e4eae4", backgroundColor: "#fbfcfa" },
  weatherLabel: { color: "#55625a", fontSize: 11, fontWeight: "700", lineHeight: 15 },
  weatherValueRow: { flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 4 },
  weatherInput: { flex: 1, minWidth: 0, paddingVertical: 2, color: Trek.ink, fontSize: 28, fontWeight: "800" },
  weatherUnit: { color: Trek.muted, fontSize: 13, fontWeight: "700" },
  gaugeTrack: { height: 5, marginTop: 6, overflow: "hidden", borderRadius: 3, backgroundColor: "#e6ece7" },
  gaugeFill: { height: "100%", borderRadius: 3 },
  gaugeLabel: { marginTop: 2, color: "#9aa69e", fontSize: 9 },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#dbe9dd",
    backgroundColor: "#f4f9f4",
  },
  confirmText: { flex: 1, color: "#315543", fontSize: 13, fontWeight: "600" },
  countPill: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    color: Trek.trail,
    backgroundColor: Trek.mintPale,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyGear: { alignItems: "center", gap: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: "#bcdcc6" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    backgroundColor: "#ffffff",
  },
  searchInput: { flex: 1, height: 42, color: Colors.onSurface, fontSize: 13 },
  group: { gap: 8, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: "#e4eae4", backgroundColor: "#fbfcfa" },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupLabel: { color: "#294436", fontSize: 13, fontWeight: "800" },
  gearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5ebe5",
    backgroundColor: "#ffffff",
  },
  gearRowActive: { borderColor: Trek.trail, backgroundColor: "#edf7ee" },
  gearName: { color: Colors.onSurface, fontSize: 13, fontWeight: "700" },
  gearBar: { marginTop: 5 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#c9d6cc" },
  checkCircleOn: { borderColor: Trek.trail, backgroundColor: Trek.trail },
  primaryButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: Trek.forestMid,
  },
  primaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  outdatedHint: { color: "#b45309", fontSize: 12, fontWeight: "700" },
  summary: { gap: 4, padding: 14, borderRadius: 20, borderWidth: 1 },
  summaryDone: { borderColor: "#bcdcc6", backgroundColor: "#f0f9f1" },
  summaryProgress: { borderColor: "#f1d6a3", backgroundColor: "#fffaf0" },
  summaryEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  summaryTitle: { color: Trek.ink, fontSize: 18, fontWeight: "800" },
  reqCard: { overflow: "hidden", gap: 8, padding: 12, paddingTop: 15, borderRadius: 16, borderWidth: 1, backgroundColor: "#ffffff" },
  reqBand: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  badge: { overflow: "hidden", maxWidth: 130, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, fontSize: 10, fontWeight: "800", textAlign: "center" },
  assignedRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  assignedChip: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 10,
    borderRadius: 10,
    backgroundColor: Trek.mintPale,
  },
  assignedText: { flexShrink: 1, color: "#1f5135", fontSize: 11, fontWeight: "600" },
  criterion: { flexDirection: "row", gap: 6, padding: 8, borderRadius: 10, backgroundColor: "#f6f8f6" },
  criterionText: { color: Colors.onSurface, fontSize: 12, fontWeight: "600" },
  warningLine: { color: "#8a4b00", fontSize: 12, lineHeight: 17 },
  selfButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d5d8fb",
    backgroundColor: Trek.indigoBg,
  },
  selfButtonOn: { borderColor: "#d3d9d5", backgroundColor: "#ffffff" },
  selfButtonText: { color: Trek.indigoInk, fontSize: 12, fontWeight: "800" },
  section: { gap: 8 },
  sectionTitle: { marginTop: 4, color: Trek.ink, fontSize: 14, fontWeight: "800" },
  questionCard: { gap: 6, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#e4eae4", backgroundColor: "#ffffff" },
  question: { marginTop: 6, gap: 6 },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    backgroundColor: "#ffffff",
    color: Colors.onSurface,
    fontSize: 14,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#dde4de" },
  chipActive: { borderColor: Trek.trail, backgroundColor: Trek.mintPale },
  chipText: { color: "#55625a", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: Trek.trail, fontWeight: "800" },
  secondaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Trek.trail,
  },
  secondaryButtonText: { color: Trek.trail, fontSize: 13, fontWeight: "800" },
  resultItem: { flexDirection: "row", gap: 10, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: "#e4eae4", backgroundColor: "#ffffff" },
  reason: { marginTop: 2, color: "#454745", fontSize: 12, lineHeight: 17 },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: Radius.md, borderWidth: 1 },
  bannerError: { borderColor: "#f3c2bd", backgroundColor: Colors.errorContainer },
  bannerOk: { borderColor: "#cfe5d4", backgroundColor: "#eef8ef" },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
