"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Button, EmptyState, ErrorAlert, InfoBanner, Input, SurfaceCard } from "@/components/ui";

import {
  listMyGear,
  type GearCategory,
  type UserGearItem,
} from "@/features/rentals/services/gear.api";
import {
  createGearPlan,
  evaluateGearPlan,
  getGearAdvisorErrorCode,
  getGearAdvisorErrorMessage,
  getGearItemVersion,
  getGearPlan,
  getGearPlanGuidance,
  getGearPlanChecklist,
  getGearPlanPrefill,
  listGearPlans,
  listGearTripCandidates,
  patchGearItemAttributes,
  selfProvidedOf,
  updateGearPlan,
  type ClimateSuggestion,
  type ConfirmedClimate,
  type GearPlan,
  type GearPlanPrefill,
  type GearTripCandidate,
  type GuidanceQuestion,
  type GuidanceRequirement,
  type PlanGuidance,
  type PackingChecklistItem,
} from "@/features/rentals/services/gear-advisor.api";
import { GearRentalOptions } from "./GearRentalOptions";
import { CompletenessBar, GearThumb, specCompleteness } from "./wardrobe/GearVisuals";
import {
  CompassLoader,
  MountainScene,
  Reveal,
  SummitProgress,
  TopoOverlay,
  TrailSign,
  TrailStepper,
  WeatherGlyph,
  type TrailStep,
  type WeatherKind,
} from "./trek/TrekKit";
import { GearPackingChecklist } from "./GearPackingChecklist";
import { RentalSectionNav } from "./RentalSectionNav";

const CATEGORIES: Array<[GearCategory, string]> = [
  ["JACKET", "Áo khoác"],
  ["PANTS", "Quần"],
  ["FOOTWEAR", "Giày"],
  ["BACKPACK", "Balo"],
  ["SLEEPING_BAG", "Túi ngủ"],
  ["TENT", "Lều"],
  ["TREKKING_POLE", "Gậy trekking"],
  ["RAIN_GEAR", "Đồ đi mưa"],
];
const categoryLabel = (category: string) =>
  CATEGORIES.find(([key]) => key === category)?.[1] ?? category;

const ITEM_STATUS: Record<string, { label: string; className: string }> = {
  SUITABLE: { label: "Phù hợp", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  NEEDS_INFORMATION: { label: "Cần bổ sung thông tin", className: "bg-sky-50 text-sky-800 ring-sky-200" },
  NEEDS_ATTENTION: { label: "Chưa đạt", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  NOT_ASSESSED: { label: "Chuyến không yêu cầu", className: "bg-slate-100 text-slate-600 ring-slate-200" },
};

const REQUIREMENT_STATUS: Record<string, { label: string; className: string; hint?: string }> = {
  COVERED_BY_OWNED: { label: "Đã đủ", className: "bg-emerald-50 text-emerald-800" },
  USER_DECLARED_PROVISION: { label: "Bạn tự chuẩn bị", className: "bg-indigo-50 text-indigo-800", hint: "Không tính vào phương án thuê." },
  UNKNOWN: {
    label: "Cần thêm thông tin",
    className: "bg-sky-50 text-sky-800",
    hint: "Đồ bạn chọn thiếu thông số để kiểm tra. Trả lời câu hỏi ở mục bên dưới rồi đánh giá lại.",
  },
  NEEDS_REPLACEMENT: {
    label: "Đồ hiện có chưa đạt",
    className: "bg-amber-50 text-amber-800",
    hint: "Chọn món khác trong tủ, thuê ở bên dưới hoặc tự chuẩn bị.",
  },
  MISSING: { label: "Còn thiếu", className: "bg-amber-50 text-amber-800", hint: "Chọn đồ trong tủ, thuê ở bên dưới hoặc tự chuẩn bị." },
};

const CLIMATE_FIELDS: Array<[keyof ConfirmedClimate, string, string]> = [
  ["temp_min_c", "Nhiệt độ ban ngày thấp nhất", "°C"],
  ["temp_max_c", "Nhiệt độ ban ngày cao nhất", "°C"],
  ["temp_min_night_c", "Nhiệt độ ban đêm thấp nhất", "°C"],
  ["rain_prob_pct", "Khả năng mưa", "%"],
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

const CLIMATE_GLYPH: Record<keyof ConfirmedClimate, WeatherKind> = {
  temp_min_c: "cloud-sun",
  temp_max_c: "sun",
  temp_min_night_c: "moon",
  rain_prob_pct: "rain",
};

/** Vị trí 0..1 trên thanh đo: nhiệt độ từ -10°C đến 40°C, mưa từ 0 đến 100%. */
function climateGauge(key: keyof ConfirmedClimate, raw: string) {
  const value = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(value)) return null;
  return key === "rain_prob_pct" ? Math.min(1, Math.max(0, value / 100)) : Math.min(1, Math.max(0, (value + 10) / 50));
}

type ClimateDraft = Record<keyof ConfirmedClimate, string>;
type AnswerDraft = Record<string, string>; // key = `${itemId}::${field}`, "" = chưa biết
type ClimateOrigin = "PLAN" | "SUGGESTED" | "MANUAL" | "NONE";

const EMPTY_CLIMATE: ClimateDraft = { temp_min_c: "", temp_max_c: "", temp_min_night_c: "", rain_prob_pct: "" };

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

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
  Boolean(a && b) && CLIMATE_FIELDS.every(([key]) => Number(a![key]) === Number(b![key]));

const climateSummary = (climate: ConfirmedClimate) =>
  `${climate.temp_min_c}–${climate.temp_max_c}°C ban ngày · đêm ${climate.temp_min_night_c}°C · mưa ${climate.rain_prob_pct}%`;

export function GearAdvisorPage({ initialTripId }: { initialTripId?: string }) {
  const [trips, setTrips] = useState<GearTripCandidate[]>([]);
  const [tripId, setTripId] = useState(initialTripId ?? "");
  const [prefill, setPrefill] = useState<GearPlanPrefill | null>(null);
  const [items, setItems] = useState<UserGearItem[]>([]);
  const [gearSearch, setGearSearch] = useState("");
  const [plan, setPlan] = useState<GearPlan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [climate, setClimate] = useState<ClimateDraft>(EMPTY_CLIMATE);
  const [climateOrigin, setClimateOrigin] = useState<ClimateOrigin>("NONE");
  const [climateConfirmed, setClimateConfirmed] = useState(false);
  const [guidance, setGuidance] = useState<PlanGuidance | null>(null);
  const [checklist, setChecklist] = useState<PackingChecklistItem[]>([]);
  const [answers, setAnswers] = useState<AnswerDraft>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Backend từ chối chuyến (thiếu dữ liệu cung đường, không phải thành viên...): không cho đi tiếp.
  const [tripBlocked, setTripBlocked] = useState("");
  const [notice, setNotice] = useState("");

  // Tải danh sách chuyến + tủ đồ một lần.
  useEffect(() => {
    let cancelled = false;
    Promise.all([listGearTripCandidates(), listMyGear()])
      .then(([tripList, gear]) => {
        if (cancelled) return;
        setTrips(tripList);
        setItems(gear.items);
      })
      .catch((loadError: unknown) => !cancelled && setError(getGearAdvisorErrorMessage(loadError)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const loadGuidance = useCallback(async (planId: string) => {
    const latest = await getGearPlan(planId);
    if (latest.evaluatedRevision) {
      const [nextGuidance, nextChecklist] = await Promise.all([
        getGearPlanGuidance(planId, latest.evaluatedRevision),
        getGearPlanChecklist(planId, latest.evaluatedRevision),
      ]);
      setGuidance(nextGuidance);
      setChecklist(nextChecklist);
    } else {
      setGuidance(null);
      setChecklist([]);
    }
    setPlan(latest);
    return latest;
  }, []);

  // Khi đổi chuyến: lấy thông tin chuyến + gợi ý thời tiết, mở kế hoạch đã có (nếu có).
  const openTrip = useCallback(
    async (nextTripId: string) => {
      setTripId(nextTripId);
      setPrefill(null);
      setPlan(null);
      setGuidance(null);
      setChecklist([]);
      setAnswers({});
      setClimate(EMPTY_CLIMATE);
      setClimateOrigin("NONE");
      setClimateConfirmed(false);
      setTripBlocked("");
      setError("");
      setNotice("");
      if (!nextTripId) return;
      setBusy("trip");
      try {
        let nextPrefill: GearPlanPrefill;
        try {
          nextPrefill = await getGearPlanPrefill(nextTripId);
        } catch (prefillError: unknown) {
          setTripBlocked(getGearAdvisorErrorMessage(prefillError));
          return;
        }
        setPrefill(nextPrefill);
        const plans = await listGearPlans();
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
        setError(getGearAdvisorErrorMessage(tripError));
      } finally {
        setBusy(null);
      }
    },
    [loadGuidance],
  );

  useEffect(() => {
    if (!initialTripId) return;
    const timer = window.setTimeout(() => void openTrip(initialTripId), 0);
    return () => window.clearTimeout(timer);
  }, [initialTripId, openTrip]);

  const selectedTrip = trips.find((trip) => trip.id === tripId);
  const itemsByCategory = useMemo(
    () =>
      CATEGORIES.map(([category, label]) => ({
        category,
        label,
        items: items.filter((item) => item.category === category && `${item.name} ${item.brand ?? ""}`.toLocaleLowerCase("vi-VN").includes(gearSearch.trim().toLocaleLowerCase("vi-VN"))),
      })).filter((group) => group.items.length > 0),
    [items, gearSearch],
  );
  const itemNames = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item.name])), [items]);
  const itemsById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);

  const climateValue: ConfirmedClimate | null = useMemo(() => {
    const values = CLIMATE_FIELDS.map(([key]) => Number(climate[key]));
    if (CLIMATE_FIELDS.some(([key]) => climate[key].trim() === "") || values.some((value) => !Number.isFinite(value))) return null;
    const [tempMin, tempMax, tempNight, rain] = values;
    if (tempMin > tempMax || rain < 0 || rain > 100) return null;
    return { temp_min_c: tempMin, temp_max_c: tempMax, temp_min_night_c: tempNight, rain_prob_pct: rain };
  }, [climate]);

  const evaluatedClimate = plan?.evaluatedRevision ? plan.canonicalContext?.confirmedClimate ?? null : null;
  const climateChanged = Boolean(evaluatedClimate) && !sameClimate(climateValue, evaluatedClimate);
  const selectionChanged =
    plan !== null &&
    (selected.length !== plan.selectedItemIds.length || selected.some((id) => !plan.selectedItemIds.includes(id)));
  const resultOutdated =
    selectionChanged || climateChanged || !!plan?.isStale || !!guidance?.needsReevaluation ||
    (!!plan?.evaluatedRevision && plan.inputRevision !== plan.evaluatedRevision);

  function applyClimate(next: ConfirmedClimate, origin: ClimateOrigin) {
    setClimate(toDraft(next));
    setClimateOrigin(origin);
    setClimateConfirmed(false);
  }

  async function savePlanAndEvaluate() {
    if (!tripId || !climateValue || !climateConfirmed) return;
    setBusy("evaluate");
    setError("");
    setNotice("");
    let planId = plan?.id ?? null;
    try {
      let current = plan;
      if (!current) {
        current = await createGearPlan({
          title: `Chuẩn bị đồ · ${selectedTrip?.title ?? "Chuyến đi"}`.slice(0, 220),
          tripId,
          selectedItemIds: selected,
        });
        planId = current.id;
        setPlan(current);
      } else if (selectionChanged) {
        current = await updateGearPlan(current.id, {
          expectedInputRevision: current.inputRevision,
          selectedItemIds: selected,
        });
        setPlan(current);
      }
      await evaluateGearPlan(current.id, {
        expectedInputRevision: current.inputRevision,
        confirmedClimate: climateValue,
      });
      // evaluatedRevision thực tế lấy lại từ kế hoạch (đánh giá lại có thể tăng phiên bản).
      await loadGuidance(current.id);
      setClimateOrigin("PLAN");
      setAnswers({});
      setNotice("Đã đánh giá xong. Xem kết quả theo từng yêu cầu bên dưới.");
      window.setTimeout(() => document.getElementById("step-4")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (evaluateError: unknown) {
      const code = getGearAdvisorErrorCode(evaluateError);
      setError(
        code === "GEAR_PLAN_CAS_CONFLICT"
          ? "Kế hoạch vừa được cập nhật ở nơi khác. Đã tải lại, hãy bấm đánh giá lần nữa."
          : getGearAdvisorErrorMessage(evaluateError),
      );
      if (code === "GEAR_PLAN_CAS_CONFLICT" && planId) await loadGuidance(planId).catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  /** Bật/tắt "Tôi tự chuẩn bị" cho một yêu cầu rồi đánh giá lại với thời tiết đã xác nhận. */
  async function toggleSelfProvided(requirementId: string) {
    if (!plan || !evaluatedClimate) return;
    setBusy(`self:${requirementId}`);
    setError("");
    setNotice("");
    try {
      const current = selfProvidedOf(plan);
      const enabling = !current.includes(requirementId);
      const next = enabling ? [...current, requirementId] : current.filter((id) => id !== requirementId);
      const updated = await updateGearPlan(plan.id, {
        expectedInputRevision: plan.inputRevision,
        selfProvidedRequirementIds: next,
      });
      await evaluateGearPlan(updated.id, {
        expectedInputRevision: updated.inputRevision,
        confirmedClimate: evaluatedClimate,
      });
      await loadGuidance(plan.id);
      setNotice(enabling ? "Đã ghi nhận bạn tự chuẩn bị món này. Kết quả đã được cập nhật." : "Đã bỏ đánh dấu tự chuẩn bị. Kết quả đã được cập nhật.");
    } catch (toggleError: unknown) {
      setError(
        getGearAdvisorErrorCode(toggleError) === "GEAR_PLAN_CAS_CONFLICT"
          ? "Kế hoạch vừa được cập nhật ở nơi khác. Đã tải lại, hãy thử lại."
          : getGearAdvisorErrorMessage(toggleError),
      );
      await loadGuidance(plan.id).catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  // Gộp câu hỏi từ guidance.items và contextQuestions theo món + field.
  const questionsByItem = useMemo(() => {
    const map = new Map<string, { name: string; category: string; questions: GuidanceQuestion[] }>();
    const add = (itemId: string, name: string | null, category: string, questions: GuidanceQuestion[]) => {
      const entry = map.get(itemId) ?? {
        name: name ?? itemNames[itemId] ?? "Món đồ",
        category,
        questions: [],
      };
      for (const question of questions) {
        // "attributes"/unknown là hướng dẫn chung, không phải ô PATCH được.
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
        const value = question.valueType === "number" ? Number(raw) : question.valueType === "boolean" ? raw === "true" : raw;
        if (question.valueType === "number" && !Number.isFinite(value as number)) throw new Error(`Giá trị "${raw}" không phải số.`);
        byItem.set(itemId, { ...(byItem.get(itemId) ?? {}), [field]: value });
      }
      for (const [itemId, attributes] of byItem) {
        const version = await getGearItemVersion(itemId); // luôn lấy version mới nhất
        await patchGearItemAttributes(itemId, version, attributes);
      }
      setAnswers({});
      setNotice(`Đã lưu thông tin cho ${byItem.size} món vào Tủ đồ. Bấm "Đánh giá lại" để cập nhật kết quả.`);
      if (plan) await loadGuidance(plan.id);
    } catch (saveError: unknown) {
      setError(getGearAdvisorErrorMessage(saveError));
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
    [guidance, checklist],
  );

  const requirementStats = useMemo(() => {
    const required = (guidance?.requirements ?? []).filter((requirement) => requirement.priority !== "OPTIONAL");
    const ready = required.filter((r) => r.status === "COVERED_BY_OWNED" || r.status === "USER_DECLARED_PROVISION").length;
    const needInfo = required.filter((r) => r.status === "UNKNOWN").length;
    return { total: required.length, ready, needInfo, needGear: required.length - ready - needInfo };
  }, [guidance]);
  // Chỉ yêu cầu bắt buộc mới đưa vào phương án thuê (bộ ghép đồ không thuê cho yêu cầu không bắt buộc).
  const requiredIds = useMemo(
    () => (guidance?.requirements ?? []).filter((r) => r.priority !== "OPTIONAL").map((r) => r.requirementId),
    [guidance],
  );
  const needsRental = (guidance?.requirements ?? []).some(
    (requirement) => requirement.priority !== "OPTIONAL" && (requirement.remainingQuantity ?? 0) > 0,
  );
  const selfProvided = selfProvidedOf(plan);
  const allReady = Boolean(guidance?.available) && requirementStats.total > 0 && requirementStats.ready === requirementStats.total && !resultOutdated;
  const stepDone = [Boolean(prefill), climateConfirmed, Boolean(plan?.evaluatedRevision) && !resultOutdated, allReady];
  const firstOpen = stepDone.findIndex((done) => !done);
  const trailSteps: TrailStep[] = [
    { id: "step-1", label: "Chọn chuyến", hint: selectedTrip?.title },
    { id: "step-2", label: "Thời tiết", hint: climateConfirmed ? "Đã xác nhận" : "Kiểm tra gợi ý" },
    { id: "step-3", label: "Đồ sẽ mang", hint: `${selected.length} món đã chọn` },
    { id: "step-4", label: "Kết quả", hint: guidance?.available ? `${requirementStats.ready}/${requirementStats.total} yêu cầu sẵn sàng` : undefined },
    { id: "packing-checklist", label: "Đóng gói", hint: "Checklist trước ngày đi" },
  ].map((step, index) => ({
    ...step,
    state: (index < stepDone.length && stepDone[index] ? "done" : index === (firstOpen === -1 ? 4 : firstOpen) ? "current" : "todo") as TrailStep["state"],
  }));

  return (
    <main className="relative min-h-[700px] bg-[#F4F6F1] px-4 py-8 sm:px-6 lg:px-8">
      <TopoOverlay dark className="opacity-[0.06]" />
      <section className="relative mx-auto max-w-[1440px] space-y-5">
        <RentalSectionNav active="/rentals/gear-advisor" />
        <AdvisorHero
          tripTitle={selectedTrip?.title ?? null}
          stats={guidance?.available ? requirementStats : null}
          allReady={allReady}
        />

        {error ? <ErrorAlert message={error} /> : null}
        {notice ? <div className="trek-pop"><InfoBanner title="Cập nhật kế hoạch">{notice}</InfoBanner></div> : null}

        <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <div className="relative overflow-hidden rounded-2xl border border-[#e0e9df] bg-white p-5">
            <TopoOverlay dark className="opacity-[0.07]" />
            <p className="relative text-[11px] font-bold uppercase tracking-[.16em] text-[#8b9b90]">Lộ trình chuẩn bị</p>
            <nav aria-label="Các bước chuẩn bị" className="relative mt-4"><TrailStepper steps={trailSteps} /></nav>
            {guidance?.available && requirementStats.total ? (
              <div className="relative mt-5 border-t border-[#e8eee8] pt-4">
                <SummitProgress value={requirementStats.ready} total={requirementStats.total} />
                <p className="mt-1 text-center text-xs font-semibold text-[#2f6b4f]">{allReady ? "Đã tới đỉnh — sẵn sàng lên đường!" : `Còn ${requirementStats.total - requirementStats.ready} chặng nữa`}</p>
              </div>
            ) : (
              <p className="relative mt-5 border-t border-[#e8eee8] pt-4 text-xs leading-5 text-[#829188]">Đánh giá dựa trên thông tin chuyến, thời tiết bạn xác nhận và đồ bạn chọn.</p>
            )}
          </div>
        </aside>
        <div className="min-w-0 space-y-5">
        {/* Bước 1: chuyến đi */}
        <Step number={1} title="Chọn chuyến đi" done={stepDone[0]}>
          {loading ? (
            <CompassLoader label="Đang tải chuyến đi và tủ đồ..." />
          ) : (
            <>
              <div className="grid max-h-[340px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {trips.map((trip, index) => {
                  const active = trip.id === tripId;
                  return (
                    <Reveal key={trip.id} delay={index * 60}>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void openTrip(trip.id)}
                        className={`trek-lift relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left disabled:cursor-wait ${active ? "border-[#2f6b4f] bg-[#edf7ee] ring-2 ring-[#2f6b4f]/20" : "border-[#e4eae4] bg-white"}`}
                      >
                        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${active ? "bg-[#2f6b4f] text-white" : "bg-[#eef4ee] text-[#2f6b4f]"}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><path d="M3 20l6-11 4 6 2-3 6 8z M14 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" /></svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-semibold text-slate-900">{trip.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            {trip.startAt ? formatDate(trip.startAt) : "Chưa có ngày"}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${trip.type === "PRIVATE" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"}`}>{trip.type === "PRIVATE" ? "Chuyến riêng" : "Có vé"}</span>
                          </span>
                        </span>
                        {active ? <span className="trek-pop absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#2f6b4f] text-[11px] font-bold text-white">✓</span> : null}
                      </button>
                    </Reveal>
                  );
                })}
              </div>
              {plan ? (
                <p className="mt-3 text-xs text-slate-500">
                  {plan.evaluatedRevision ? `Kế hoạch đã lưu · đánh giá lần ${plan.evaluatedRevision}` : "Kế hoạch đã lưu, chưa đánh giá"}
                </p>
              ) : null}
            </>
          )}
          {prefill && !tripBlocked ? <TripFacts prefill={prefill} /> : null}
          {tripBlocked ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-bold">Chưa thể tư vấn đồ cho chuyến này</p>
              <p className="mt-1">{tripBlocked}</p>
              <p className="mt-1 text-amber-800">
                Hãy chọn chuyến khác hoặc liên hệ TrekGo để bổ sung thông tin cung đường.
              </p>
            </div>
          ) : null}
          {!loading && trips.length === 0 ? (
            <EmptyState className="mt-3" title="Chưa có chuyến đi" description="Bạn cần có vé đã xác nhận hoặc tham gia một chuyến riêng trước." />
          ) : null}
        </Step>

        {tripId && busy !== "trip" && !tripBlocked ? (
          <>
            {/* Bước 2: thời tiết */}
            <Step number={2} title="Xác nhận thời tiết" done={stepDone[1]}>
              <ClimateSource
                origin={climateOrigin}
                prefill={prefill}
                current={climateValue}
                onApply={(next) => applyClimate(next, "SUGGESTED")}
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {CLIMATE_FIELDS.map(([key, label, unit], index) => (
                  <Reveal key={key} delay={index * 80}>
                    <WeatherTile
                      kind={CLIMATE_GLYPH[key]}
                      label={label}
                      unit={unit}
                      value={climate[key]}
                      gauge={climateGauge(key, climate[key])}
                      onChange={(value) => {
                        setClimate((current) => ({ ...current, [key]: value }));
                        setClimateConfirmed(false);
                        setClimateOrigin("MANUAL");
                      }}
                    />
                  </Reveal>
                ))}
              </div>
              {climateValue === null && CLIMATE_FIELDS.every(([key]) => climate[key] !== "") ? (
                <p className="mt-2 text-xs text-red-600">
                  Kiểm tra lại: nhiệt độ thấp nhất không được cao hơn cao nhất, khả năng mưa từ 0 đến 100%.
                </p>
              ) : null}
              <label className="mt-5 flex items-center gap-3 rounded-xl border border-[#dbe9dd] bg-[#f4f9f4] px-4 py-3 text-sm font-medium text-[#315543]">
                <input
                  type="checkbox"
                  checked={climateConfirmed}
                  disabled={!climateValue}
                  onChange={(event) => setClimateConfirmed(event.target.checked)}
                  className="h-4 w-4 accent-emerald-700"
                />
                Tôi đã kiểm tra và xác nhận thời tiết này
              </label>
            </Step>

            {/* Bước 3: chọn đồ */}
            <Step number={3} title="Chọn đồ bạn sẽ mang" done={stepDone[2]}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm leading-6 text-slate-500">Chọn những món trong Tủ đồ bạn dự định mang để hệ thống kiểm tra độ phù hợp.</p><span className="rounded-full bg-[#eaf4eb] px-3 py-1.5 text-xs font-bold text-[#2f6b4f]">{selected.length} món đã chọn</span></div>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Tủ đồ đang trống.{" "}
                  <Link href="/rentals/wardrobe" className="font-bold text-emerald-700 underline">
                    Thêm đồ vào Tủ đồ
                  </Link>{" "}
                  trước, hoặc đánh giá luôn để xem chuyến cần những gì.
                </p>
              ) : (
                <div className="space-y-2">
                  <Input aria-label="Tìm đồ trong tủ" placeholder="Tìm theo tên hoặc thương hiệu..." value={gearSearch} onChange={(event) => setGearSearch(event.target.value)} className="mb-3" />
                  {!itemsByCategory.length && <p className="py-4 text-sm text-slate-500">Không tìm thấy món đồ phù hợp.</p>}
                  {itemsByCategory.map((group) => (
                    <div key={group.category} className="rounded-2xl border border-[#e4eae4] bg-[#fbfcfa] p-3">
                      <div className="mb-3 flex items-center justify-between gap-3 px-1">
                        <span className="flex items-center gap-2.5 font-semibold text-[#294436]">
                          <GearThumb category={group.category} name={group.label} size="xs" />
                          {group.label}
                        </span>
                        <span className="text-xs text-[#819187]">{group.items.filter((item) => selected.includes(item.id)).length}/{group.items.length} đã chọn</span>
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                        {group.items.map((item) => {
                          const checked = selected.includes(item.id);
                          const completeness = specCompleteness(item);
                          return (
                            <label
                              key={item.id}
                              className={`relative flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-sm transition ${checked ? "border-[#2f6b4f] bg-[#edf7ee] ring-2 ring-[#2f6b4f]/15" : "border-[#e5ebe5] bg-white hover:border-[#9ec7a9]"}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  setSelected((current) =>
                                    event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                                  )
                                }
                                className="sr-only"
                              />
                              <GearThumb url={item.photoUrl} category={item.category} name={item.name} size="md" />
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 font-semibold leading-5 text-slate-900">{item.name}</span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500">{item.brand || "Chưa rõ hãng"}</span>
                                <span className="mt-1.5 block"><CompletenessBar known={completeness.known} total={completeness.total} /></span>
                              </span>
                              <span className={`absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${checked ? "bg-[#2f6b4f] text-white" : "border border-slate-300 bg-white text-transparent"}`}>✓</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-slate-500">
                    Thiếu món nào thì cứ để trống — kết quả sẽ chỉ ra loại đồ còn cần chuẩn bị.
                  </p>
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#edf1ec] pt-5">
                <Button
                  disabled={!climateValue || !climateConfirmed || busy !== null}
                  onClick={() => void savePlanAndEvaluate()}
                  className={climateValue && climateConfirmed && busy === null && (!guidance || resultOutdated) ? "relative overflow-hidden" : ""}
                >
                  {climateValue && climateConfirmed && busy === null && (!guidance || resultOutdated) ? <span aria-hidden="true" className="trek-shimmer pointer-events-none absolute inset-0" /> : null}
                  <span className="relative">{busy === "evaluate" ? "Đang đánh giá..." : guidance ? "Đánh giá lại" : "Đánh giá kế hoạch"}</span>
                </Button>
                {busy === "evaluate" ? <CompassLoader label="Đang đối chiếu đồ với cung đường..." /> : !climateConfirmed ? (
                  <span className="text-xs text-slate-500">Cần xác nhận thời tiết ở bước 2.</span>
                ) : resultOutdated && guidance ? (
                  <span className="text-xs font-semibold text-amber-700">Có thay đổi chưa được đánh giá.</span>
                ) : null}
              </div>
            </Step>

            {/* Bước 4: kết quả */}
            {guidance ? (
              <Step number={4} title="Kết quả theo từng yêu cầu" done={allReady}>
                {resultOutdated ? (
                  <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Thời tiết, đồ đã chọn hoặc thông tin chuyến đã thay đổi. Đây là kết quả của lần đánh giá trước; xác nhận thời tiết và bấm “Đánh giá lại” để cập nhật.
                  </p>
                ) : null}
                {!guidance.available ? (
                  <p className="text-sm text-slate-500">
                    {guidance.message ?? "Phiên bản này không có dữ liệu đánh giá chi tiết."}
                  </p>
                ) : (
                  <div className="space-y-6">
                    {evaluatedClimate ? (
                      <p className="text-xs text-slate-500">Đánh giá với thời tiết: {climateSummary(evaluatedClimate)}</p>
                    ) : null}
                    <ResultSummary stats={requirementStats} />

                    {guidance.requirements?.length ? (
                      <ul className="grid gap-3 md:grid-cols-2">
                        {guidance.requirements.map((requirement, index) => (
                          <RequirementCard
                            key={requirement.requirementId}
                            delay={index * 70}
                            requirement={requirement}
                            title={requirementTitles[requirement.requirementId]}
                            itemsById={itemsById}
                            selfProvided={selfProvided.includes(requirement.requirementId)}
                            toggleDisabled={busy !== null || resultOutdated || !evaluatedClimate}
                            toggling={busy === `self:${requirement.requirementId}`}
                            onToggleSelfProvided={() => void toggleSelfProvided(requirement.requirementId)}
                          />
                        ))}
                      </ul>
                    ) : null}

                    {needsRental && plan?.evaluatedRevision && !resultOutdated ? (
                      <GearRentalOptions
                        key={`${plan.id}:${plan.evaluatedRevision}`}
                        planId={plan.id}
                        tripId={tripId}
                        evaluatedRevision={plan.evaluatedRevision}
                        requirementTitles={requirementTitles}
                        requiredIds={requiredIds}
                      />
                    ) : null}

                    {questionsByItem.length ? (
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Bổ sung thông số để đánh giá chính xác hơn</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Câu trả lời được lưu vào Tủ đồ. Không chắc thì để “Không biết” — hệ thống không tự điền giá trị thay bạn.
                        </p>
                        <div className="mt-3 space-y-3">
                          {questionsByItem.map(([itemId, entry]) => (
                            <div key={itemId} className="rounded-xl border border-slate-200 bg-white p-4">
                              <p className="font-semibold text-slate-900">
                                {entry.name}
                                <span className="ml-2 text-xs font-normal text-slate-500">{categoryLabel(entry.category)}</span>
                              </p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {entry.questions.map((question) => {
                                  const key = `${itemId}::${question.field}`;
                                  return (
                                    <label key={key} className="block text-sm text-slate-700">
                                      {question.question}
                                      {question.unit ? ` (${question.unit})` : ""}
                                      <QuestionInput
                                        question={question}
                                        value={answers[key] ?? ""}
                                        onChange={(value) => setAnswers((current) => ({ ...current, [key]: value }))}
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={answeredCount === 0 || busy !== null}
                          onClick={() => void saveAnswers()}
                          className="mt-4 h-11 rounded-xl border border-[#174B36] px-5 text-sm font-bold text-[#174B36] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                        >
                          {busy === "answers" ? "Đang lưu..." : `Lưu ${answeredCount || ""} câu trả lời vào Tủ đồ`}
                        </button>
                      </div>
                    ) : null}

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Đồ bạn đã chọn</h3>
                      {guidance.items?.length ? (
                        <ul className="mt-3 grid gap-2 md:grid-cols-2">
                          {guidance.items.map((item) => {
                            const style = ITEM_STATUS[item.displayStatus] ?? ITEM_STATUS.NEEDS_ATTENTION;
                            return (
                              <li key={item.itemId} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                                <GearThumb url={itemsById[item.itemId]?.photoUrl} category={item.category} name={item.nameAtEvaluation ?? "Món đồ"} size="md" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <p className="font-semibold text-slate-900">
                                      {item.nameAtEvaluation ?? itemNames[item.itemId] ?? "Món đồ"}
                                      <span className="block text-xs font-normal text-slate-500">{categoryLabel(item.category)}</span>
                                    </p>
                                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${style.className}`}>
                                      {style.label}
                                    </span>
                                  </div>
                                  {item.reasons?.length ? (
                                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
                                      {item.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                                    </ul>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">Lần đánh giá này chưa chọn món nào trong Tủ đồ.</p>
                      )}
                    </div>
                  </div>
                )}
              </Step>
            ) : null}

            {plan && guidance?.available && checklist.length > 0 && <GearPackingChecklist key={`${plan.id}:${plan.evaluatedRevision}`} plan={plan} checklist={checklist} itemNames={itemNames} tripTitle={selectedTrip?.title ?? "Chuyến đi"} tripDate={formatDate(selectedTrip?.startAt)} stale={resultOutdated} onPlanChange={setPlan} />}
          </>
        ) : null}
        {busy === "trip" ? <CompassLoader label="Đang tải thông tin cung đường..." /> : null}
        </div></div>
      </section>
    </main>
  );
}

function Step({ number, title, done = false, children }: { number: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <Reveal>
      <SurfaceCard id={`step-${number}`} padding="lg" className={`relative scroll-mt-24 overflow-hidden rounded-3xl shadow-[0_10px_30px_rgba(26,59,39,.05)] transition-colors duration-500 ${done ? "border-[#bcdcc6]" : "border-[#e2eae3]"}`}>
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 transition-colors duration-500 ${done ? "bg-[#2f6b4f]" : "bg-[#e8d9c2]"}`} />
        <h2 className="flex items-center gap-3 text-lg font-bold tracking-tight text-[#203c2d]">
          <TrailSign number={number} done={done} />
          {title}
          {done ? <span className="trek-pop rounded-full bg-[#eaf4eb] px-2.5 py-0.5 text-[11px] font-bold text-[#2f6b4f]">Đã qua chặng</span> : null}
        </h2>
        <div className="mt-5">{children}</div>
      </SurfaceCard>
    </Reveal>
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
  gauge: number | null;
  onChange: (value: string) => void;
}) {
  const rain = kind === "rain";
  return (
    <label className="trek-lift block h-full rounded-2xl border border-[#e4eae4] bg-gradient-to-b from-white to-[#f7faf6] p-4">
      <span className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold leading-4 text-slate-600">{label}</span>
        <WeatherGlyph kind={kind} className="h-11 w-11 shrink-0" />
      </span>
      <span className="mt-2 flex items-baseline gap-1">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          placeholder="—"
          onChange={(event) => onChange(event.target.value)}
          className="w-full min-w-0 bg-transparent text-3xl font-bold tracking-tight text-[#1f3d2e] outline-none placeholder:text-slate-300"
        />
        <span className="text-sm font-semibold text-slate-500">{unit}</span>
      </span>
      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-gradient-to-r from-slate-100 to-slate-100">
        <span
          className={`block h-full rounded-full transition-all duration-700 ${rain ? "bg-gradient-to-r from-sky-300 to-sky-600" : "bg-gradient-to-r from-sky-400 via-emerald-400 to-orange-400"}`}
          style={{ width: `${Math.round((gauge ?? 0) * 100)}%` }}
        />
      </span>
      <span className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{rain ? "0%" : "-10°C"}</span>
        <span>{rain ? "100%" : "40°C"}</span>
      </span>
    </label>
  );
}

function DifficultyPeaks({ level }: { level: number }) {
  return (
    <span className="flex items-end gap-0.5" aria-label={`Độ khó ${level}/5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <svg key={step} viewBox="0 0 10 10" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M0 10 L5 1 L10 10 Z" fill={step <= level ? (level >= 4 ? "#b45309" : "#2f6b4f") : "#dbe3dc"} />
        </svg>
      ))}
    </span>
  );
}

const FACT_ICONS: Record<string, ReactNode> = {
  "Điểm đến": <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
  "Khởi hành": <path d="M5 6h14v14H5z M5 10h14 M9 3v4 M15 3v4" />,
  "Thời gian": <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2" />,
  "Độ khó": <path d="M3 20l6-11 4 6 2-3 6 8z" />,
  "Địa hình": <path d="M3 17c3-3 5-3 8 0s5 3 10-1 M3 12c3-3 5-3 8 0s5 3 10-1" />,
  "Điểm cao nhất": <path d="M3 20l7-13 3 5 2-3 6 11z M10 7V3l4 1.5L10 6" />,
};

/** Thông tin chuyến mà các yêu cầu dựa vào: số ngày, độ khó, địa hình. */
function TripFacts({ prefill }: { prefill: GearPlanPrefill }) {
  const facts: Array<[string, ReactNode]> = [];
  if (prefill.destination) facts.push(["Điểm đến", prefill.destination]);
  if (prefill.startAt) facts.push(["Khởi hành", formatDate(prefill.startAt)]);
  if (prefill.days) facts.push(["Thời gian", `${prefill.days} ngày${prefill.days >= 2 ? ` · ${prefill.days - 1} đêm` : ""}`]);
  if (prefill.difficulty) facts.push(["Độ khó", <span key="d" className="flex items-center gap-2"><DifficultyPeaks level={prefill.difficulty} />{prefill.difficulty}/5</span>]);
  if (prefill.terrain?.length) facts.push(["Địa hình", prefill.terrain.map((t) => TERRAIN_LABELS[t.toLowerCase()] ?? t).join(", ")]);
  if (prefill.highestElevationM) facts.push(["Điểm cao nhất", `${prefill.highestElevationM.toLocaleString("vi-VN")} m`]);
  if (!facts.length) return null;
  return (
    <dl className="relative mt-4 grid gap-3 overflow-hidden rounded-2xl border border-[#e4eae4] bg-[#fbfcfa] p-4 text-sm sm:grid-cols-3 xl:grid-cols-6">
      <TopoOverlay dark className="opacity-[0.06]" />
      {facts.map(([label, value], index) => (
        <Reveal key={label} delay={index * 70} className="relative flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#2f6b4f] shadow-sm ring-1 ring-[#e4eae4]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">{FACT_ICONS[label]}</svg>
          </span>
          <span className="min-w-0">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="font-semibold text-slate-900">{value}</dd>
          </span>
        </Reveal>
      ))}
      <p className="text-xs text-slate-500 sm:col-span-3 xl:col-span-6">Số ngày, độ khó, địa hình và độ cao quyết định đồ cần mang (ví dụ dung tích balo, giày có cổ, độ ấm của áo và túi ngủ).</p>
    </dl>
  );
}

function suggestionLabel(suggestion: ClimateSuggestion, destination: string | null) {
  return suggestion.source === "FORECAST"
    ? suggestion.atElevationM
      ? `Dự báo tại điểm cao nhất (${suggestion.atElevationM.toLocaleString("vi-VN")} m)`
      : "Dự báo thời tiết cho ngày đi"
    : `Ước tính theo mùa${destination ? ` tại ${destination}` : ""}`;
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
    <div className="space-y-2">
      <p className="text-sm text-slate-600">{headline}</p>
      {activeNote ? <p className="text-xs text-slate-500">{activeNote}</p> : null}
      {alternatives.map((alternative) => (
        <div key={alternative.source} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-sky-900">{suggestionLabel(alternative, prefill?.destination ?? null)}: {climateSummary(alternative)}</p>
            {alternative.noteVi || alternative.sourceReference ? (
              <p className="mt-0.5 text-xs text-sky-800/80">{alternative.noteVi ?? alternative.sourceReference}</p>
            ) : null}
          </div>
          <button type="button" onClick={() => onApply(alternative)} className="h-9 rounded-lg border border-sky-300 bg-white px-3 text-xs font-bold text-sky-900 hover:bg-sky-100">
            Dùng số này
          </button>
        </div>
      ))}
    </div>
  );
}

function ResultSummary({ stats }: { stats: { total: number; ready: number; needInfo: number; needGear: number } }) {
  if (!stats.total) return null;
  const done = stats.ready === stats.total;
  return (
    <Reveal>
      <div className={`relative grid items-center gap-4 overflow-hidden rounded-3xl border p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] ${done ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" : "border-amber-200 bg-gradient-to-br from-amber-50/80 to-white"}`}>
        <TopoOverlay dark className="opacity-[0.05]" />
        <div className="relative">
          <p className={`text-[11px] font-bold uppercase tracking-[.18em] ${done ? "text-emerald-700" : "text-amber-700"}`}>{done ? "Đỉnh đã chinh phục" : "Đang trên đường lên đỉnh"}</p>
          <p className={`mt-1 text-2xl font-bold tracking-tight ${done ? "text-emerald-900" : "text-amber-950"}`}>
            {done ? "Sẵn sàng lên đường!" : `${stats.ready}/${stats.total} yêu cầu bắt buộc đã sẵn sàng`}
          </p>
          <p className={`mt-1 text-sm ${done ? "text-emerald-900/80" : "text-amber-900/80"}`}>
            {done
              ? "Mọi yêu cầu bắt buộc của chuyến đã có đồ phù hợp hoặc bạn tự chuẩn bị."
              : [stats.needGear ? `${stats.needGear} yêu cầu còn thiếu đồ phù hợp` : "", stats.needInfo ? `${stats.needInfo} yêu cầu cần thêm thông số` : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        <SummitProgress value={stats.ready} total={stats.total} className="relative max-h-36" />
      </div>
    </Reveal>
  );
}

const HERO_FEATURES: Array<{ title: string; text: string; icon: ReactNode }> = [
  { title: "Bộ quy tắc an toàn", text: "Kiểm từng món theo mưa, lạnh, độ khó, số ngày", icon: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4" /> },
  { title: "Thời tiết theo chuyến", text: "Ước tính theo mùa và dự báo gần ngày đi", icon: <path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-1 9z M9 21l1-2 M13 21l1-2" /> },
  { title: "Ghép đồ thuê tối ưu", text: "Hai phương án: rẻ nhất hoặc nhẹ nhất", icon: <path d="M4 7h16l-1.5 11a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z M9 7V5a3 3 0 0 1 6 0v2" /> },
  { title: "Lời khuyên có kiểm chứng", text: "AI chỉ được chọn ý từ dữ kiện đã xác thực", icon: <path d="M12 3v3 M5.6 5.6l2.1 2.1 M3 12h3 M18 12h3 M16.3 7.7l2.1-2.1 M9 18h6 M10 21h4 M12 8a4 4 0 0 0-2 7.5V18h4v-2.5A4 4 0 0 0 12 8z" /> },
];

function AdvisorHero({
  tripTitle,
  stats,
  allReady,
}: {
  tripTitle: string | null;
  stats: { total: number; ready: number } | null;
  allReady: boolean;
}) {
  return (
    <header className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0b2e22] via-[#123f30] to-[#1f5c44] px-6 pb-24 pt-8 text-white shadow-[0_20px_60px_rgba(11,46,34,.25)] sm:px-10 sm:pt-10">
      <TopoOverlay className="opacity-[0.09]" />
      <div aria-hidden="true" className="trek-float pointer-events-none absolute right-[12%] top-8 h-24 w-24 rounded-full bg-[radial-gradient(circle,#fde68a_0%,#f59e0b_45%,transparent_70%)] opacity-70 blur-[1px]" />
      <MountainScene className="h-32 sm:h-40" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.2em] text-[#bfe9c9]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15.5 8.5l-2 5-5 2 2-5z" /></svg>
            Gear advisor
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-[42px]">
            Chuẩn bị đồ đúng cho<br />
            <span className="bg-gradient-to-r from-[#bfe9c9] to-[#fde68a] bg-clip-text text-transparent">từng cung đường.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-emerald-50/80">
            TrekGo đối chiếu đồ trong tủ của bạn với thời tiết và độ khó của chuyến, chỉ ra món nào đạt, món nào thiếu, rồi gợi ý thuê hoặc để bạn tự chuẩn bị.
          </p>
          {tripTitle ? (
            <div className="trek-pop mt-6 max-w-md rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a8d9b8]">Đang chuẩn bị cho</p>
              <p className="mt-1 text-lg font-semibold">{tripTitle}</p>
              {stats ? (
                <>
                  <SummitProgress value={stats.ready} total={stats.total} tone="dark" className="mt-2 max-h-24" />
                  <p className="text-xs text-emerald-50/80">
                    {allReady ? "Đã tới đỉnh — mọi yêu cầu bắt buộc đã sẵn sàng." : `Yêu cầu bắt buộc đã sẵn sàng: ${stats.ready}/${stats.total}`}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-emerald-50/70">Xác nhận thời tiết và chọn đồ để bắt đầu leo.</p>
              )}
            </div>
          ) : (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#f59e0b] px-4 py-2 text-xs font-bold text-[#3b2302] shadow-lg">
              <span className="h-2 w-2 rounded-full bg-white trek-twinkle" /> Bắt đầu bằng cách chọn chuyến đi bên dưới
            </p>
          )}
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2">
          {HERO_FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={150 + index * 110}>
              <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.12]">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#9bd8a9]/15 text-[#bfe9c9] transition duration-300 group-hover:scale-110 group-hover:bg-[#f59e0b]/25 group-hover:text-[#fde68a]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">{feature.icon}</svg>
                </span>
                <p className="mt-3 text-sm font-semibold">{feature.title}</p>
                <p className="mt-1 text-xs leading-5 text-emerald-50/70">{feature.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </header>
  );
}

function RequirementCard({
  requirement,
  delay = 0,
  title,
  itemsById,
  selfProvided,
  toggleDisabled,
  toggling,
  onToggleSelfProvided,
}: {
  requirement: GuidanceRequirement;
  delay?: number;
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
      ? { label: "Không bắt buộc", className: "bg-slate-100 text-slate-600" }
      : REQUIREMENT_STATUS[String(requirement.status)] ?? { label: "Xem chi tiết", className: "bg-slate-100 text-slate-700" };
  const assigned = (requirement.assignedItemIds ?? []).map((id) => ({ id, item: itemsById[id] }));
  const canToggle = requirement.status !== "COVERED_BY_OWNED";
  const criteria = requirement.criteria ?? [];
  const ready = requirement.status === "COVERED_BY_OWNED" || requirement.status === "USER_DECLARED_PROVISION";
  return (
    <Reveal as="li" delay={delay} className={`trek-lift relative flex flex-col overflow-hidden rounded-2xl border bg-white p-4 text-sm ${ready ? "border-emerald-200" : optional ? "border-slate-200" : "border-amber-200"}`}>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${ready ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : optional ? "bg-slate-200" : "bg-gradient-to-r from-amber-300 to-orange-500"}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <GearThumb category={String(requirement.category)} name={title} size="sm" />
          <div className="min-w-0">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            {categoryLabel(String(requirement.category))}
            {optional ? " · không bắt buộc" : " · bắt buộc"}
            {requirement.quantity && requirement.quantity > 1 ? ` · cần ${requirement.quantity} món` : ""}
          </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>
          {status.label}
          {(requirement.remainingQuantity ?? 0) > 0 && (requirement.quantity ?? 1) > 1 ? ` (${requirement.remainingQuantity})` : ""}
        </span>
      </div>

      {assigned.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {assigned.map(({ id, item }) => (
            <span key={id} className="flex items-center gap-2 rounded-xl bg-emerald-50 py-1 pl-1 pr-3 text-xs font-medium text-emerald-900">
              <GearThumb url={item?.photoUrl} category={String(requirement.category)} name={item?.name ?? "Món đồ"} size="xs" />
              {item?.name ?? "Món không còn trong Tủ đồ"}
            </span>
          ))}
        </div>
      ) : null}

      {criteria.length ? (
        <ul className="mt-3 space-y-1.5">
          {criteria.map((criterion) => (
            <li key={`${criterion.field}:${criterion.text}`} className="rounded-lg bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">{criterion.text}</span>
              {criterion.reason ? <span className="block text-xs text-slate-500">Vì: {criterion.reason}</span> : null}
            </li>
          ))}
        </ul>
      ) : requirement.status !== "USER_DECLARED_PROVISION" ? (
        <p className="mt-2 text-xs text-slate-500">Không có tiêu chí kỹ thuật riêng cho chuyến này — chỉ cần mang đúng loại đồ.</p>
      ) : null}

      {requirement.warnings?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
          {requirement.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}

      {status.hint && !(optional && requirement.status === "MISSING") ? (
        <p className="mt-2 text-xs text-slate-500">{status.hint}</p>
      ) : null}

      {canToggle ? (
        <div className="mt-auto pt-3">
          <button
            type="button"
            disabled={toggleDisabled}
            onClick={onToggleSelfProvided}
            title={toggleDisabled ? "Đánh giá lại trước khi thay đổi" : undefined}
            className={`h-9 rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${selfProvided ? "border border-slate-300 text-slate-700 hover:bg-slate-50" : "border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"}`}
          >
            {toggling ? "Đang cập nhật..." : selfProvided ? "Bỏ tự chuẩn bị" : "Tôi tự chuẩn bị (mượn, mua...)"}
          </button>
        </div>
      ) : null}
    </Reveal>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: GuidanceQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  if (question.valueType === "boolean") {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} mt-2`}>
        <option value="">Không biết</option>
        <option value="true">Có</option>
        <option value="false">Không</option>
      </select>
    );
  }
  if (question.valueType === "enum") {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} mt-2`}>
        <option value="">Không biết</option>
        {(question.options ?? []).map((option) => (
          <option key={option} value={option}>{COVERAGE_LABELS[option] ?? option}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      min={question.min}
      max={question.max}
      step={question.isInteger ? 1 : "any"}
      value={value}
      placeholder="Không biết"
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} mt-2`}
    />
  );
}
