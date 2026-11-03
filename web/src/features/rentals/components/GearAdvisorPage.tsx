"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

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
} from "@/features/rentals/services/gear-advisor.api";
import { GearRentalOptions } from "./GearRentalOptions";
import { RentalPageHeader } from "./RentalSectionNav";

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
  const [plan, setPlan] = useState<GearPlan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [climate, setClimate] = useState<ClimateDraft>({ temp_min_c: "", temp_max_c: "", temp_min_night_c: "", rain_prob_pct: "" });
  const [climateSuggested, setClimateSuggested] = useState(false);
  const [climateConfirmed, setClimateConfirmed] = useState(false);
  const [guidance, setGuidance] = useState<PlanGuidance | null>(null);
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
    setPlan(latest);
    if (latest.evaluatedRevision) {
      setGuidance(await getGearPlanGuidance(planId, latest.evaluatedRevision));
    } else {
      setGuidance(null);
    }
    return latest;
  }, []);

  // Khi đổi chuyến: lấy gợi ý khí hậu, kế hoạch đã có (nếu có) và trạng thái chuẩn bị.
  const openTrip = useCallback(
    async (nextTripId: string) => {
      setTripId(nextTripId);
      setPlan(null);
      setGuidance(null);
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
        items: items.filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0),
    [items],
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
      } else if (selectionChanged) {
        current = await updateGearPlan(current.id, {
          expectedInputRevision: current.inputRevision,
          selectedItemIds: selected,
        });
      }
      await evaluateGearPlan(current.id, {
        expectedInputRevision: current.inputRevision,
        confirmedClimate: climateValue,
      });
      // evaluatedRevision thực tế lấy lại từ kế hoạch (đánh giá lại có thể tăng phiên bản).
      await loadGuidance(current.id);
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
    <main className="min-h-[700px] bg-[#f4f7fb] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-5">
        <RentalPageHeader
          eyebrow="Gear Advisor"
          title="Kế hoạch chuẩn bị đồ"
          description="Chọn chuyến đi, xác nhận thời tiết và đồ trong tủ. TrekGo kiểm tra từng món theo quy tắc an toàn và chỉ ra thông tin còn thiếu."
          active="/rentals/gear-advisor"
        />

        {error ? (
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="font-bold">Đóng</button>
          </div>
        ) : null}
        {notice ? (
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} className="font-bold">Đóng</button>
          </div>
        ) : null}

        {/* Bước 1: chuyến đi */}
        <Step number={1} title="Chọn chuyến đi">
          {loading ? (
            <p className="text-sm text-slate-500">Đang tải...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block text-sm font-bold text-slate-700">
                Chuyến đi
                <select
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
                </select>
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
            <p className="mt-3 text-sm text-slate-500">
              Chưa thấy chuyến nào. Bạn cần đặt vé hoặc tham gia một chuyến trước.
            </p>
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
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CLIMATE_FIELDS.map(([key, label, unit]) => (
                  <label key={key} className="block text-sm font-bold text-slate-700">
                    {label} ({unit})
                    <input
                      type="number"
                      inputMode="decimal"
                      value={climate[key]}
                      onChange={(event) => {
                        setClimate((current) => ({ ...current, [key]: event.target.value }));
                        setClimateConfirmed(false);
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
              <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
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
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Tủ đồ đang trống.{" "}
                  <Link href="/rentals/wardrobe" className="font-bold text-emerald-700 underline">
                    Thêm đồ vào Tủ đồ
                  </Link>{" "}
                  trước, rồi quay lại đây.
                </p>
              ) : (
                <div className="space-y-4">
                  {itemsByCategory.map((group) => (
                    <div key={group.category}>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{group.label}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {group.items.map((item) => {
                          const checked = selected.includes(item.id);
                          return (
                            <label
                              key={item.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${checked ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  setSelected((current) =>
                                    event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                                  )
                                }
                                className="h-4 w-4 accent-emerald-700"
                              />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-slate-900">{item.name}</span>
                                {item.brand ? <span className="block truncate text-xs text-slate-500">{item.brand}</span> : null}
                              </span>
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
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!climateValue || !climateConfirmed || busy !== null}
                  onClick={() => void savePlanAndEvaluate()}
                  className="h-11 rounded-xl bg-[#174B36] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0F5A3B] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {busy === "evaluate" ? "Đang đánh giá..." : guidance ? "Đánh giá lại" : "Đánh giá kế hoạch"}
                </button>
                {!climateConfirmed ? (
                  <span className="text-xs text-slate-500">Cần xác nhận thời tiết ở bước 2.</span>
                ) : null}
              </div>
            </Step>

            {/* Bước 4: kết quả */}
            {guidance ? (
              <Step number={4} title="Kết quả và hướng dẫn">
                {guidance.needsReevaluation || plan?.isStale ? (
                  <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Đồ hoặc thông tin chuyến đã thay đổi sau lần đánh giá này. Bấm “Đánh giá lại” để có kết quả hiện tại.
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
                        <p className="mt-2 text-sm text-slate-500">Chưa chọn món nào trong 5 nhóm đồ chính.</p>
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
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${requirement.remainingQuantity > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
                                  >
                                    {requirement.remainingQuantity > 0 ? `Còn thiếu ${requirement.remainingQuantity}` : "Đã đủ"}
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
                        !guidance.needsReevaluation ? (
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

            {/* Bước 5: trạng thái chuẩn bị */}
            {plan && selections ? (
              <Step number={5} title="Đánh dấu tình trạng chuẩn bị">
                <p className="text-sm text-slate-500">
                  Ghi chú cho riêng bạn theo từng loại đồ. Phần này không thay đổi kết quả đánh giá.
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
      </section>
    </main>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_28px_rgba(15,23,42,.05)]">
      <h2 className="flex items-center gap-3 text-lg font-bold text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#174B36] text-sm font-bold text-white">{number}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
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
