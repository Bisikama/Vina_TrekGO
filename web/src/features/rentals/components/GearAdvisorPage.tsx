"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Button, EmptyState, ErrorAlert, InfoBanner, Input, LoadingState, Select, SurfaceCard } from "@/components/ui";

import {
  listMyGear,
  type GearCategory,
  type UserGearItem,
} from "@/features/rentals/services/gear.api";
import {
  createGearPlan,
  evaluateGearPlan,
  findSuggestedClimate,
  getGearAdvisorErrorCode,
  getGearAdvisorErrorMessage,
  getGearItemVersion,
  getGearPlan,
  getGearPlanGuidance,
  getGearPlanChecklist,
  getGearPlanPrefill,
  getPreparationSelections,
  listGearPlans,
  listGearTripCandidates,
  patchGearItemAttributes,
  putPreparationSelections,
  updateGearPlan,
  type ConfirmedClimate,
  type GearPlan,
  type GearTripCandidate,
  type GuidanceQuestion,
  type PlanGuidance,
  type PreparationSelections,
  type PreparationStatus,
  type PackingChecklistItem,
} from "@/features/rentals/services/gear-advisor.api";
import { GearRentalOptions } from "./GearRentalOptions";
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

const PREP_LABELS: Array<[PreparationStatus, string]> = [
  ["HAVE", "Đã có"],
  ["NOT_HAVE", "Chưa có"],
  ["CHECK_LATER", "Kiểm tra sau"],
];

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  SUITABLE: { label: "Phù hợp", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  NEEDS_INFORMATION: { label: "Cần bổ sung thông tin", className: "bg-sky-50 text-sky-800 ring-sky-200" },
  NEEDS_ATTENTION: { label: "Cần chuẩn bị thêm", className: "bg-amber-50 text-amber-800 ring-amber-200" },
};

const CLIMATE_FIELDS: Array<[keyof ConfirmedClimate, string, string]> = [
  ["temp_min_c", "Nhiệt độ ban ngày thấp nhất", "°C"],
  ["temp_max_c", "Nhiệt độ ban ngày cao nhất", "°C"],
  ["temp_min_night_c", "Nhiệt độ ban đêm thấp nhất", "°C"],
  ["rain_prob_pct", "Khả năng mưa", "%"],
];

const COVERAGE_LABELS: Record<string, string> = { UPPER_BODY: "Thân trên", FULL_BODY: "Toàn thân" };

type ClimateDraft = Record<keyof ConfirmedClimate, string>;
type AnswerDraft = Record<string, string>; // key = `${itemId}::${field}`, "" = chưa biết

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

export function GearAdvisorPage({ initialTripId }: { initialTripId?: string }) {
  const [trips, setTrips] = useState<GearTripCandidate[]>([]);
  const [tripId, setTripId] = useState(initialTripId ?? "");
  const [items, setItems] = useState<UserGearItem[]>([]);
  const [gearSearch, setGearSearch] = useState("");
  const [plan, setPlan] = useState<GearPlan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [climate, setClimate] = useState<ClimateDraft>({ temp_min_c: "", temp_max_c: "", temp_min_night_c: "", rain_prob_pct: "" });
  const [climateSuggested, setClimateSuggested] = useState(false);
  const [climateConfirmed, setClimateConfirmed] = useState(false);
  const [guidance, setGuidance] = useState<PlanGuidance | null>(null);
  const [checklist, setChecklist] = useState<PackingChecklistItem[]>([]);
  const [climateEdited, setClimateEdited] = useState(false);
  const [answers, setAnswers] = useState<AnswerDraft>({});
  const [selections, setSelections] = useState<PreparationSelections | null>(null);
  const [prepDraft, setPrepDraft] = useState<Partial<Record<GearCategory, PreparationStatus>>>({});
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
      const [nextGuidance, nextChecklist] = await Promise.all([getGearPlanGuidance(planId, latest.evaluatedRevision), getGearPlanChecklist(planId, latest.evaluatedRevision)]);
      setGuidance(nextGuidance);
      setChecklist(nextChecklist);
    } else {
      setGuidance(null);
      setChecklist([]);
    }
    setPlan(latest);
    return latest;
  }, []);

  // Khi đổi chuyến: lấy gợi ý khí hậu, kế hoạch đã có (nếu có) và trạng thái chuẩn bị.
  const openTrip = useCallback(
    async (nextTripId: string) => {
      setTripId(nextTripId);
      setPlan(null);
      setGuidance(null);
      setChecklist([]);
      setClimateEdited(false);
      setSelections(null);
      setPrepDraft({});
      setAnswers({});
      setClimateConfirmed(false);
      setClimateSuggested(false);
      setTripBlocked("");
      setError("");
      setNotice("");
      if (!nextTripId) return;
      setBusy("trip");
      try {
        let prefill: Record<string, unknown>;
        try {
          prefill = await getGearPlanPrefill(nextTripId);
        } catch (prefillError: unknown) {
          setTripBlocked(getGearAdvisorErrorMessage(prefillError));
          return;
        }
        const plans = await listGearPlans();
        const suggested = findSuggestedClimate(prefill);
        setClimate({
          temp_min_c: suggested?.temp_min_c?.toString() ?? "",
          temp_max_c: suggested?.temp_max_c?.toString() ?? "",
          temp_min_night_c: suggested?.temp_min_night_c?.toString() ?? "",
          rain_prob_pct: suggested?.rain_prob_pct?.toString() ?? "",
        });
        setClimateSuggested(Boolean(suggested));
        const existing = plans
          .filter((candidate) => candidate.tripId === nextTripId)
          .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
        if (existing) {
          const latest = await loadGuidance(existing.id);
          setSelected(latest.selectedItemIds ?? []);
          const prep = await getPreparationSelections(existing.id);
          setSelections(prep);
          setPrepDraft(Object.fromEntries(prep.choices.map((choice) => [choice.category, choice.status])));
        } else {
          setSelected([]);
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

  const climateValue: ConfirmedClimate | null = useMemo(() => {
    const values = CLIMATE_FIELDS.map(([key]) => Number(climate[key]));
    if (CLIMATE_FIELDS.some(([key]) => climate[key].trim() === "") || values.some((value) => !Number.isFinite(value))) return null;
    const [tempMin, tempMax, tempNight, rain] = values;
    if (tempMin > tempMax || rain < 0 || rain > 100) return null;
    return { temp_min_c: tempMin, temp_max_c: tempMax, temp_min_night_c: tempNight, rain_prob_pct: rain };
  }, [climate]);

  const selectionChanged =
    plan !== null &&
    (selected.length !== plan.selectedItemIds.length || selected.some((id) => !plan.selectedItemIds.includes(id)));
  const resultOutdated = selectionChanged || climateEdited || !!plan?.isStale || !!guidance?.needsReevaluation || (!!plan?.evaluatedRevision && plan.inputRevision !== plan.evaluatedRevision);

  async function savePlanAndEvaluate() {
    if (!tripId || !climateValue || !climateConfirmed) return;
    setBusy("evaluate");
    setError("");
    setNotice("");
    try {
      let current = plan;
      if (!current) {
        current = await createGearPlan({
          title: `Chuẩn bị đồ · ${selectedTrip?.title ?? "Chuyến đi"}`.slice(0, 220),
          tripId,
          selectedItemIds: selected,
        });
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
      setClimateEdited(false);
      if (!selections) {
        const prep = await getPreparationSelections(current.id);
        setSelections(prep);
        setPrepDraft(Object.fromEntries(prep.choices.map((choice) => [choice.category, choice.status])));
      }
      setAnswers({});
      setNotice("Đã đánh giá xong. Xem hướng dẫn bên dưới.");
    } catch (evaluateError: unknown) {
      const code = getGearAdvisorErrorCode(evaluateError);
      setError(
        code === "GEAR_PLAN_CAS_CONFLICT"
          ? "Kế hoạch vừa được cập nhật ở nơi khác. Đã tải lại, hãy bấm đánh giá lần nữa."
          : getGearAdvisorErrorMessage(evaluateError),
      );
      if (code === "GEAR_PLAN_CAS_CONFLICT" && plan) await loadGuidance(plan.id).catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  // Gộp câu hỏi từ guidance.items và contextQuestions theo món + field.
  const questionsByItem = useMemo(() => {
    const map = new Map<string, { name: string; category: string; questions: GuidanceQuestion[] }>();
    const add = (itemId: string, name: string | null, category: string, questions: GuidanceQuestion[]) => {
      const entry = map.get(itemId) ?? {
        name: name ?? items.find((item) => item.id === itemId)?.name ?? "Món đồ",
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
  }, [guidance, items]);

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
      setNotice(`Đã lưu thông tin cho ${byItem.size} món. Bấm "Đánh giá lại" để cập nhật kết quả.`);
      if (plan) await loadGuidance(plan.id);
    } catch (saveError: unknown) {
      setError(getGearAdvisorErrorMessage(saveError));
    } finally {
      setBusy(null);
    }
  }

  async function savePreparation() {
    if (!plan || !selections) return;
    setBusy("prep");
    setError("");
    try {
      const choices = CATEGORIES.flatMap(([category]) =>
        prepDraft[category] ? [{ category, status: prepDraft[category] as PreparationStatus }] : [],
      );
      const saved = await putPreparationSelections(plan.id, { expectedVersion: selections.version, choices });
      setSelections(saved);
      setNotice("Đã lưu trạng thái chuẩn bị.");
    } catch (prepError: unknown) {
      if (getGearAdvisorErrorCode(prepError) === "GEAR_PROGRESS_CAS_CONFLICT") {
        const fresh = await getPreparationSelections(plan.id);
        setSelections(fresh);
        setPrepDraft(Object.fromEntries(fresh.choices.map((choice) => [choice.category, choice.status])));
        setError("Trạng thái chuẩn bị vừa được cập nhật ở nơi khác. Đã tải lại bản mới nhất.");
      } else {
        setError(getGearAdvisorErrorMessage(prepError));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-[700px] bg-[#F7F7F4] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-[1440px] space-y-5">
        <RentalSectionNav active="/rentals/gear-advisor" />
        <header className="relative overflow-hidden rounded-[28px] bg-[#143f30] px-6 py-8 text-white sm:px-10 sm:py-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-48 h-[460px] w-[460px] rounded-full border border-white/10 shadow-[0_0_0_45px_rgba(255,255,255,0.025),0_0_0_90px_rgba(255,255,255,0.025),0_0_0_135px_rgba(255,255,255,0.02)]" />
          <div className="relative max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#a8d9b8]">VinaTrekGO / Gear advisor</p><h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Sẵn sàng cho<br />chuyến đi tiếp theo.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-emerald-50/80">Chọn chuyến, kiểm tra trang bị và sắp xếp hành lý với checklist dành riêng cho hành trình của bạn.</p><div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-emerald-50"><span className="h-2 w-2 rounded-full bg-[#9bd8a9]" />{selectedTrip ? `Đang chuẩn bị · ${selectedTrip.title}` : "Bắt đầu bằng cách chọn chuyến đi"}</div></div>
        </header>

        {error ? (
          <ErrorAlert message={error} />
        ) : null}
        {notice ? (
          <InfoBanner title="Cập nhật kế hoạch">{notice}</InfoBanner>
        ) : null}

        <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <div className="rounded-2xl border border-[#e0e9df] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#8b9b90]">Hành trình chuẩn bị</p><nav aria-label="Các bước chuẩn bị" className="mt-4 space-y-1">{[["step-1", "01", "Chọn chuyến"], ["step-2", "02", "Thời tiết"], ["step-3", "03", "Đồ sẽ mang"], ["step-4", "04", "Kết quả đánh giá"], ["packing-checklist", "05", "Checklist đóng gói"]].map(([id, number, label]) => <a key={id} href={`#${id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#52665a] transition hover:bg-[#f0f6f0] hover:text-[#174b36]"><span className="text-xs font-bold text-[#8aaa94]">{number}</span>{label}</a>)}</nav><div className="mt-4 border-t border-[#e8eee8] pt-4 text-xs leading-5 text-[#829188]">Đánh giá dựa trên thông tin chuyến và đồ bạn chọn.</div></div>
        </aside>
        <div className="min-w-0 space-y-5">
        {/* Bước 1: chuyến đi */}
        <Step number={1} title="Chọn chuyến đi">
          {loading ? (
            <LoadingState message="Đang tải chuyến đi và tủ đồ..." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block text-sm font-bold text-slate-700">
                Chuyến đi
                <Select
                  value={tripId}
                  disabled={busy !== null}
                  onChange={(event) => void openTrip(event.target.value)}
                  className={`${inputClass} mt-2`}
                >
                  <option value="">Chọn chuyến bạn sẽ tham gia</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                      {trip.startAt ? ` · ${formatDate(trip.startAt)}` : ""}
                    </option>
                  ))}
                </Select>
              </label>
              {plan ? (
                <p className="text-xs text-slate-500">
                  Kế hoạch đã lưu · phiên bản {plan.inputRevision}
                  {plan.evaluatedRevision ? ` · đã đánh giá bản ${plan.evaluatedRevision}` : " · chưa đánh giá"}
                </p>
              ) : null}
            </div>
          )}
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
            <EmptyState className="mt-3" title="Chưa có chuyến đi" description="Bạn cần đặt vé hoặc tham gia một chuyến trước." />
          ) : null}
        </Step>

        {tripId && busy !== "trip" && !tripBlocked ? (
          <>
            {/* Bước 2: thời tiết */}
            <Step number={2} title="Xác nhận thời tiết">
              <p className="text-sm text-slate-500">
                {climateSuggested
                  ? "Số liệu dưới đây là gợi ý ước tính cho chuyến. Hãy kiểm tra lại với dự báo thực tế trước khi xác nhận."
                  : "Chưa có gợi ý thời tiết cho chuyến này. Hãy nhập theo dự báo bạn tham khảo — hệ thống không tự đoán."}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {CLIMATE_FIELDS.map(([key, label, unit]) => (
                  <label key={key} className="block text-sm font-bold text-slate-700">
                    {label} ({unit})
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={climate[key]}
                      onChange={(event) => {
                        setClimate((current) => ({ ...current, [key]: event.target.value }));
                        setClimateConfirmed(false);
                        setClimateEdited(true);
                      }}
                      className={`${inputClass} mt-2`}
                    />
                  </label>
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
            <Step number={3} title="Chọn đồ bạn sẽ mang">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm leading-6 text-slate-500">Chọn những món trong Tủ đồ bạn dự định mang để hệ thống kiểm tra độ phù hợp.</p><span className="rounded-full bg-[#eaf4eb] px-3 py-1.5 text-xs font-bold text-[#2f6b4f]">{selected.length} món đã chọn</span></div>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Tủ đồ đang trống.{" "}
                  <Link href="/rentals/wardrobe" className="font-bold text-emerald-700 underline">
                    Thêm đồ vào Tủ đồ
                  </Link>{" "}
                  trước, rồi quay lại đây.
                </p>
              ) : (
                <div className="space-y-2">
                  <Input aria-label="Tìm đồ trong tủ" placeholder="Tìm theo tên hoặc thương hiệu..." value={gearSearch} onChange={(event) => setGearSearch(event.target.value)} className="mb-3" />
                  {!itemsByCategory.length && <p className="py-4 text-sm text-slate-500">Không tìm thấy món đồ phù hợp.</p>}
                  {itemsByCategory.map((group) => (
                    <details key={group.category} open={gearSearch.trim() ? true : undefined} className="group rounded-2xl border border-[#e4eae4] bg-[#fbfcfa]">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4"><span className="font-semibold text-[#294436]">{group.label}</span><span className="flex items-center gap-3 text-xs text-[#819187]">{group.items.filter((item) => selected.includes(item.id)).length}/{group.items.length} đã chọn <span className="text-base transition group-open:rotate-180">⌄</span></span></summary>
                      <div className="grid gap-2 border-t border-[#edf1ec] p-3 sm:grid-cols-2">
                        {group.items.map((item) => {
                          const checked = selected.includes(item.id);
                          return (
                            <label
                              key={item.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${checked ? "border-[#79ac87] bg-[#edf7ee]" : "border-[#e5ebe5] bg-white hover:border-[#9ec7a9]"}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  setSelected((current) =>
                                    event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                                  )
                                }
                                className="mt-1 h-4 w-4 shrink-0 accent-emerald-700"
                              />
                              <span className="min-w-0">
                                <span className="block break-words font-semibold text-slate-900">{item.name}</span>
                                {item.brand ? <span className="block truncate text-xs text-slate-500">{item.brand}</span> : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </details>
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
                >
                  {busy === "evaluate" ? "Đang đánh giá..." : guidance ? "Đánh giá lại" : "Đánh giá kế hoạch"}
                </Button>
                {!climateConfirmed ? (
                  <span className="text-xs text-slate-500">Cần xác nhận thời tiết ở bước 2.</span>
                ) : null}
              </div>
            </Step>

            {/* Bước 4: kết quả */}
            {guidance ? (
              <Step number={4} title="Kết quả và hướng dẫn">
                {resultOutdated ? (
                  <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Đầu vào hoặc thông tin chuyến đã thay đổi. Đây là kết quả của lần đánh giá trước; xác nhận thời tiết và bấm “Đánh giá lại” để cập nhật.
                  </p>
                ) : null}
                {guidance.isLatestEvaluation === false ? (
                  <p className="mb-4 text-xs text-slate-500">Bạn đang xem một lần đánh giá cũ.</p>
                ) : null}
                {!guidance.available ? (
                  <p className="text-sm text-slate-500">
                    {guidance.message ?? "Phiên bản này không có dữ liệu đánh giá chi tiết."}
                  </p>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Đồ bạn đã chọn</h3>
                      {guidance.items?.length ? (
                        <ul className="mt-3 space-y-2">
                          {guidance.items.map((item) => {
                            const style = STATUS_STYLE[item.displayStatus] ?? STATUS_STYLE.NEEDS_ATTENTION;
                            return (
                              <li key={item.itemId} className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-semibold text-slate-900">
                                    {item.nameAtEvaluation ?? items.find((gear) => gear.id === item.itemId)?.name ?? "Món đồ"}
                                    <span className="ml-2 text-xs font-normal text-slate-500">{categoryLabel(item.category)}</span>
                                  </p>
                                  <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${style.className}`}>
                                    {style.label}
                                  </span>
                                </div>
                                {item.reasons?.length ? (
                                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                                    {item.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                                  </ul>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">Lần đánh giá này chưa có món đồ cá nhân được chọn.</p>
                      )}
                    </div>

                    {guidance.requirements?.length ? (
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Yêu cầu của chuyến</h3>
                        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                          {guidance.requirements.map((requirement) => (
                            <li key={requirement.requirementId} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-slate-900">{categoryLabel(String(requirement.category))}</p>
                                {typeof requirement.remainingQuantity === "number" ? (
                                  <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${requirement.remainingQuantity === 0 && requirement.status === "COVERED_BY_OWNED" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
                                  >
                                    {requirement.remainingQuantity > 0 ? `Còn thiếu ${requirement.remainingQuantity}` : requirement.status === "COVERED_BY_OWNED" ? "Đã đáp ứng" : "Xem chi tiết"}
                                  </span>
                                ) : null}
                              </div>
                              {requirement.warnings?.length ? (
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
                                  {requirement.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                                </ul>
                              ) : null}
                              {requirement.questions?.some((question) => question.valueType !== "unknown") ? (
                                <p className="mt-2 text-xs text-slate-500">
                                  Cần thêm thông tin:{" "}
                                  {requirement.questions
                                    .filter((question) => question.valueType !== "unknown")
                                    .map((question) => question.question)
                                    .join(" · ")}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        {guidance.requirements.some((requirement) => (requirement.remainingQuantity ?? 0) > 0) &&
                        plan?.evaluatedRevision &&
                        !resultOutdated ? (
                          <div className="mt-4">
                            <GearRentalOptions planId={plan.id} evaluatedRevision={plan.evaluatedRevision} />
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {questionsByItem.length ? (
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Bổ sung thông tin để đánh giá chính xác hơn</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Không chắc thì để “Không biết” — hệ thống không tự điền giá trị thay bạn.
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
                  </div>
                )}
              </Step>
            ) : null}

            {plan && guidance?.available && checklist.length > 0 && <GearPackingChecklist key={`${plan.id}:${plan.evaluatedRevision}`} plan={plan} checklist={checklist} itemNames={Object.fromEntries(items.map((item) => [item.id, item.name]))} tripTitle={selectedTrip?.title ?? "Chuyến đi"} tripDate={formatDate(selectedTrip?.startAt)} stale={resultOutdated} onPlanChange={setPlan} />}

            {/* Bước 5: trạng thái chuẩn bị */}
            {plan && selections ? (
              <Step number={5} title="Ghi chú theo nhóm đồ">
                <p className="text-sm text-slate-500">
                  Ghi nhớ bạn đã có, chưa có hoặc cần kiểm tra từng nhóm. Đây là ghi chú riêng, không phải checklist đóng gói và không thay đổi kết quả đánh giá.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {CATEGORIES.map(([category, label]) => (
                    <div key={category} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="text-sm font-semibold text-slate-800">{label}</span>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                        {PREP_LABELS.map(([status, statusLabel]) => {
                          const active = prepDraft[category] === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                setPrepDraft((current) => ({ ...current, [category]: active ? undefined : status }))
                              }
                              className={`rounded-md px-2 py-1 text-xs font-semibold transition ${active ? "bg-white text-[#174B36] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                            >
                              {statusLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void savePreparation()}
                  className="mt-4 h-11 rounded-xl bg-[#174B36] px-5 text-sm font-bold text-white transition hover:bg-[#0F5A3B] disabled:bg-slate-300"
                >
                  {busy === "prep" ? "Đang lưu..." : "Lưu tình trạng chuẩn bị"}
                </button>
              </Step>
            ) : null}
          </>
        ) : null}
        {busy === "trip" ? <p className="text-sm text-slate-500">Đang tải thông tin chuyến...</p> : null}
        </div></div>
      </section>
    </main>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <SurfaceCard id={`step-${number}`} padding="lg" className="scroll-mt-24 rounded-2xl border-[#e2eae3] shadow-[0_8px_30px_rgba(26,59,39,.04)]">
      <h2 className="flex items-center gap-3 text-lg font-bold tracking-tight text-[#203c2d]">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf4eb] text-sm font-bold text-[#2f6b4f]">{String(number).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </SurfaceCard>
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
