import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import {
  findSuggestedClimate,
  gearAdvisorApi,
  gearErrorCode,
  gearErrorMessage,
  type ConfirmedClimate,
  type GearPlan,
  type GearTripCandidate,
  type GuidanceQuestion,
  type PlanGuidance,
  type PreparationSelections,
  type PreparationStatus,
} from "@/features/gear/advisor-api";
import { gearApi } from "@/features/gear/api";
import {
  generateGearRentalOptions,
  lineDepositAmount,
  type GearRentalOptionSet,
} from "@/features/gear/rental-options-api";
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

const PREP: [PreparationStatus, string][] = [
  ["HAVE", "Đã có"],
  ["NOT_HAVE", "Chưa có"],
  ["CHECK_LATER", "Để sau"],
];

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  SUITABLE: { label: "Phù hợp", color: Colors.positiveDeep, bg: Colors.primaryPale },
  NEEDS_INFORMATION: { label: "Cần bổ sung thông tin", color: "#0b5c86", bg: "#e3f2fb" },
  NEEDS_ATTENTION: { label: "Cần chuẩn bị thêm", color: "#8A5A00", bg: "#FFF6E0" },
};

const CLIMATE_FIELDS: [keyof ConfirmedClimate, string][] = [
  ["temp_min_c", "Ban ngày thấp nhất (°C)"],
  ["temp_max_c", "Ban ngày cao nhất (°C)"],
  ["temp_min_night_c", "Ban đêm thấp nhất (°C)"],
  ["rain_prob_pct", "Khả năng mưa (%)"],
];

const COVERAGE_LABELS: Record<string, string> = { UPPER_BODY: "Thân trên", FULL_BODY: "Toàn thân" };

type ClimateDraft = Record<keyof ConfirmedClimate, string>;
const EMPTY_CLIMATE: ClimateDraft = { temp_min_c: "", temp_max_c: "", temp_min_night_c: "", rain_prob_pct: "" };

export default function GearAdvisorScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [trips, setTrips] = useState<GearTripCandidate[]>([]);
  const [items, setItems] = useState<UserGearItem[]>([]);
  const [tripId, setTripId] = useState("");
  const [tripBlocked, setTripBlocked] = useState("");
  const [plan, setPlan] = useState<GearPlan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [climate, setClimate] = useState<ClimateDraft>(EMPTY_CLIMATE);
  const [climateSuggested, setClimateSuggested] = useState(false);
  const [climateConfirmed, setClimateConfirmed] = useState(false);
  const [guidance, setGuidance] = useState<PlanGuidance | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selections, setSelections] = useState<PreparationSelections | null>(null);
  const [prepDraft, setPrepDraft] = useState<Partial<Record<GearCategory, PreparationStatus>>>({});
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
      setPlan(latest);
      setGuidance(latest.evaluatedRevision ? await gearAdvisorApi.guidance(planId, latest.evaluatedRevision, accessToken) : null);
      return latest;
    },
    [accessToken],
  );

  async function openTrip(nextTripId: string) {
    if (!accessToken) return;
    setTripId(nextTripId);
    setTripBlocked("");
    setPlan(null);
    setGuidance(null);
    setSelections(null);
    setPrepDraft({});
    setAnswers({});
    setClimate(EMPTY_CLIMATE);
    setClimateSuggested(false);
    setClimateConfirmed(false);
    setError("");
    setNotice("");
    setBusy("trip");
    try {
      let prefill: Record<string, unknown>;
      try {
        prefill = await gearAdvisorApi.prefill(nextTripId, accessToken);
      } catch (prefillError: unknown) {
        setTripBlocked(gearErrorMessage(prefillError));
        return;
      }
      const suggested = findSuggestedClimate(prefill);
      setClimate({
        temp_min_c: suggested?.temp_min_c?.toString() ?? "",
        temp_max_c: suggested?.temp_max_c?.toString() ?? "",
        temp_min_night_c: suggested?.temp_min_night_c?.toString() ?? "",
        rain_prob_pct: suggested?.rain_prob_pct?.toString() ?? "",
      });
      setClimateSuggested(Boolean(suggested));
      const plans = await gearAdvisorApi.listPlans(accessToken);
      const existing = plans
        .filter((candidate) => candidate.tripId === nextTripId)
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
      if (existing) {
        const latest = await loadGuidance(existing.id);
        setSelected(latest?.selectedItemIds ?? []);
        const prep = await gearAdvisorApi.getSelections(existing.id, accessToken);
        setSelections(prep);
        setPrepDraft(Object.fromEntries(prep.choices.map((choice) => [choice.category, choice.status])));
      } else {
        setSelected([]);
      }
    } catch (tripError: unknown) {
      setError(gearErrorMessage(tripError));
    } finally {
      setBusy(null);
    }
  }

  const climateValue: ConfirmedClimate | null = useMemo(() => {
    if (CLIMATE_FIELDS.some(([key]) => climate[key].trim() === "")) return null;
    const [tempMin, tempMax, tempNight, rain] = CLIMATE_FIELDS.map(([key]) => Number(climate[key].replace(",", ".")));
    if ([tempMin, tempMax, tempNight, rain].some((value) => !Number.isFinite(value))) return null;
    if (tempMin > tempMax || rain < 0 || rain > 100) return null;
    return { temp_min_c: tempMin, temp_max_c: tempMax, temp_min_night_c: tempNight, rain_prob_pct: rain };
  }, [climate]);

  async function evaluate() {
    if (!accessToken || !tripId || !climateValue || !climateConfirmed) return;
    setBusy("evaluate");
    setError("");
    setNotice("");
    try {
      let current = plan;
      const trip = trips.find((candidate) => candidate.id === tripId);
      if (!current) {
        current = await gearAdvisorApi.createPlan(
          { title: `Chuẩn bị đồ · ${trip?.title ?? "Chuyến đi"}`.slice(0, 220), tripId, selectedItemIds: selected },
          accessToken,
        );
      } else if (selected.length !== current.selectedItemIds.length || selected.some((id) => !current?.selectedItemIds.includes(id))) {
        current = await gearAdvisorApi.updatePlan(
          current.id,
          { expectedInputRevision: current.inputRevision, selectedItemIds: selected },
          accessToken,
        );
      }
      await gearAdvisorApi.evaluate(current.id, { expectedInputRevision: current.inputRevision, confirmedClimate: climateValue }, accessToken);
      await loadGuidance(current.id);
      if (!selections) {
        const prep = await gearAdvisorApi.getSelections(current.id, accessToken);
        setSelections(prep);
        setPrepDraft(Object.fromEntries(prep.choices.map((choice) => [choice.category, choice.status])));
      }
      setAnswers({});
      setNotice("Đã đánh giá xong. Xem hướng dẫn bên dưới.");
    } catch (evaluateError: unknown) {
      if (gearErrorCode(evaluateError) === "GEAR_PLAN_CAS_CONFLICT" && plan) {
        await loadGuidance(plan.id).catch(() => null);
        setError("Kế hoạch vừa được cập nhật ở nơi khác. Đã tải lại, hãy đánh giá lần nữa.");
      } else {
        setError(gearErrorMessage(evaluateError));
      }
    } finally {
      setBusy(null);
    }
  }

  const questionsByItem = useMemo(() => {
    const map = new Map<string, { name: string; category: string; questions: GuidanceQuestion[] }>();
    const add = (itemId: string, name: string | null, category: string, questions: GuidanceQuestion[]) => {
      const entry = map.get(itemId) ?? {
        name: name ?? items.find((item) => item.id === itemId)?.name ?? "Món đồ",
        category,
        questions: [],
      };
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
  }, [guidance, items]);

  const answeredCount = Object.values(answers).filter((value) => value !== "").length;

  async function saveAnswers() {
    if (!accessToken) return;
    setBusy("answers");
    setError("");
    try {
      const byItem = new Map<string, Record<string, unknown>>();
      for (const [key, raw] of Object.entries(answers)) {
        if (raw === "") continue; // "Không biết": giữ nguyên
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
      setNotice(`Đã lưu thông tin cho ${byItem.size} món. Bấm "Đánh giá lại" để cập nhật kết quả.`);
      if (plan) await loadGuidance(plan.id);
    } catch (saveError: unknown) {
      setError(gearErrorMessage(saveError));
    } finally {
      setBusy(null);
    }
  }

  async function savePreparation() {
    if (!accessToken || !plan || !selections) return;
    setBusy("prep");
    setError("");
    try {
      const choices = CATEGORIES.flatMap(([category]) => {
        const status = prepDraft[category];
        return status ? [{ category, status }] : [];
      });
      const saved = await gearAdvisorApi.putSelections(plan.id, { expectedVersion: selections.version, choices }, accessToken);
      setSelections(saved);
      setNotice("Đã lưu tình trạng chuẩn bị.");
    } catch (prepError: unknown) {
      if (gearErrorCode(prepError) === "GEAR_PROGRESS_CAS_CONFLICT") {
        const fresh = await gearAdvisorApi.getSelections(plan.id, accessToken);
        setSelections(fresh);
        setPrepDraft(Object.fromEntries(fresh.choices.map((choice) => [choice.category, choice.status])));
        setError("Tình trạng chuẩn bị vừa được cập nhật ở nơi khác. Đã tải lại bản mới nhất.");
      } else {
        setError(gearErrorMessage(prepError));
      }
    } finally {
      setBusy(null);
    }
  }

  const showSteps = Boolean(tripId) && busy !== "trip" && !tripBlocked;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} accessibilityLabel="Quay lại">
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.eyebrow}>GEAR ADVISOR</Text>
          <Text style={styles.title}>Kế hoạch chuẩn bị đồ</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Banner tone="error" text={error} onClose={() => setError("")} /> : null}
        {notice ? <Banner tone="ok" text={notice} onClose={() => setNotice("")} /> : null}

        <Step number={1} title="Chọn chuyến đi">
          {loading ? (
            <ActivityIndicator color={Colors.primaryDark} />
          ) : trips.length === 0 ? (
            <Text style={styles.muted}>Chưa thấy chuyến nào. Bạn cần đặt vé hoặc tham gia một chuyến trước.</Text>
          ) : (
            trips.map((trip) => {
              const active = trip.id === tripId;
              return (
                <TouchableOpacity
                  key={trip.id}
                  style={[styles.option, active && styles.optionActive]}
                  disabled={busy !== null}
                  onPress={() => void openTrip(trip.id)}
                >
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={active ? Colors.primaryDark : Colors.mute}
                  />
                  <Text style={styles.optionText} numberOfLines={2}>
                    {trip.title}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
          {busy === "trip" ? <ActivityIndicator style={styles.spacer} color={Colors.primaryDark} /> : null}
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
            <Step number={2} title="Xác nhận thời tiết">
              <Text style={styles.muted}>
                {climateSuggested
                  ? "Đây là gợi ý ước tính. Hãy đối chiếu với dự báo thực tế trước khi xác nhận."
                  : "Chưa có gợi ý thời tiết. Hãy nhập theo dự báo bạn tham khảo — hệ thống không tự đoán."}
              </Text>
              <View style={styles.climateGrid}>
                {CLIMATE_FIELDS.map(([key, label]) => (
                  <View key={key} style={styles.climateCell}>
                    <Text style={styles.label}>{label}</Text>
                    <TextInput
                      value={climate[key]}
                      keyboardType="numbers-and-punctuation"
                      onChangeText={(text) => {
                        setClimate((current) => ({ ...current, [key]: text }));
                        setClimateConfirmed(false);
                      }}
                      style={styles.input}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.switchRow}>
                <Switch
                  value={climateConfirmed}
                  disabled={!climateValue}
                  onValueChange={setClimateConfirmed}
                  trackColor={{ true: Colors.primary, false: Colors.surfaceContainerHighest }}
                />
                <Text style={styles.switchText}>Tôi đã kiểm tra và xác nhận thời tiết này</Text>
              </View>
              {!climateValue && CLIMATE_FIELDS.every(([key]) => climate[key] !== "") ? (
                <Text style={styles.errorText}>
                  Nhiệt độ thấp nhất không được cao hơn cao nhất; khả năng mưa từ 0 đến 100%.
                </Text>
              ) : null}
            </Step>

            <Step number={3} title="Chọn đồ bạn sẽ mang">
              {items.length === 0 ? (
                <TouchableOpacity onPress={() => router.push("/wardrobe" as Href)}>
                  <Text style={styles.muted}>
                    Tủ đồ đang trống. <Text style={styles.link}>Thêm đồ vào Tủ đồ</Text> rồi quay lại đây.
                  </Text>
                </TouchableOpacity>
              ) : (
                CATEGORIES.map(([category, label]) => {
                  const group = items.filter((item) => item.category === category);
                  if (!group.length) return null;
                  return (
                    <View key={category} style={styles.group}>
                      <Text style={styles.groupLabel}>{label}</Text>
                      {group.map((item) => {
                        const checked = selected.includes(item.id);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.option, checked && styles.optionActive]}
                            onPress={() =>
                              setSelected((current) =>
                                checked ? current.filter((id) => id !== item.id) : [...current, item.id],
                              )
                            }
                          >
                            <Ionicons
                              name={checked ? "checkbox" : "square-outline"}
                              size={19}
                              color={checked ? Colors.primaryDark : Colors.mute}
                            />
                            <Text style={styles.optionText} numberOfLines={1}>
                              {item.name}
                              {item.brand ? ` · ${item.brand}` : ""}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })
              )}
              <TouchableOpacity
                style={[styles.primaryButton, (!climateValue || !climateConfirmed || busy !== null) && styles.buttonDisabled]}
                disabled={!climateValue || !climateConfirmed || busy !== null}
                onPress={() => void evaluate()}
              >
                <Text style={styles.primaryButtonText}>
                  {busy === "evaluate" ? "Đang đánh giá..." : guidance ? "Đánh giá lại" : "Đánh giá kế hoạch"}
                </Text>
              </TouchableOpacity>
              {!climateConfirmed ? <Text style={styles.hint}>Cần xác nhận thời tiết ở bước 2.</Text> : null}
            </Step>

            {guidance ? (
              <Step number={4} title="Kết quả và hướng dẫn">
                {guidance.needsReevaluation || plan?.isStale ? (
                  <View style={styles.warnBox}>
                    <Text style={styles.warnText}>
                      Đồ hoặc thông tin chuyến đã thay đổi sau lần đánh giá này. Bấm “Đánh giá lại” để có kết quả hiện tại.
                    </Text>
                  </View>
                ) : null}
                {!guidance.available ? (
                  <Text style={styles.muted}>{guidance.message ?? "Phiên bản này không có dữ liệu đánh giá chi tiết."}</Text>
                ) : (
                  <>
                    <Text style={styles.sectionTitle}>Đồ bạn đã chọn</Text>
                    {guidance.items?.length ? (
                      guidance.items.map((item) => {
                        const status = STATUS[item.displayStatus] ?? STATUS.NEEDS_ATTENTION;
                        return (
                          <View key={item.itemId} style={styles.resultCard}>
                            <View style={styles.resultHead}>
                              <Text style={styles.resultName} numberOfLines={2}>
                                {item.nameAtEvaluation ?? items.find((gear) => gear.id === item.itemId)?.name ?? "Món đồ"}
                              </Text>
                              <Text style={[styles.badge, { color: status.color, backgroundColor: status.bg }]}>{status.label}</Text>
                            </View>
                            <Text style={styles.hint}>{categoryLabel(item.category)}</Text>
                            {(item.reasons ?? []).map((reason) => (
                              <Text key={reason} style={styles.reason}>• {reason}</Text>
                            ))}
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.muted}>Chưa chọn món nào trong 5 nhóm đồ chính.</Text>
                    )}

                    {guidance.requirements?.length ? (
                      <>
                        <Text style={styles.sectionTitle}>Yêu cầu của chuyến</Text>
                        {guidance.requirements.map((requirement) => {
                          const missing = (requirement.remainingQuantity ?? 0) > 0;
                          return (
                            <View key={requirement.requirementId} style={styles.resultCard}>
                              <View style={styles.resultHead}>
                                <Text style={styles.resultName}>{categoryLabel(requirement.category)}</Text>
                                {typeof requirement.remainingQuantity === "number" ? (
                                  <Text
                                    style={[
                                      styles.badge,
                                      missing
                                        ? { color: "#8A5A00", backgroundColor: "#FFF6E0" }
                                        : { color: Colors.positiveDeep, backgroundColor: Colors.primaryPale },
                                    ]}
                                  >
                                    {missing ? `Còn thiếu ${requirement.remainingQuantity}` : "Đã đủ"}
                                  </Text>
                                ) : null}
                              </View>
                              {(requirement.warnings ?? []).map((warning) => (
                                <Text key={warning} style={styles.reason}>• {warning}</Text>
                              ))}
                            </View>
                          );
                        })}
                        {guidance.requirements.some((requirement) => (requirement.remainingQuantity ?? 0) > 0) &&
                        plan?.evaluatedRevision &&
                        !guidance.needsReevaluation &&
                        accessToken ? (
                          <RentalOptions
                            planId={plan.id}
                            evaluatedRevision={plan.evaluatedRevision}
                            accessToken={accessToken}
                            onOpenCatalog={() => router.push("/rental" as Href)}
                          />
                        ) : null}
                      </>
                    ) : null}

                    {questionsByItem.length ? (
                      <>
                        <Text style={styles.sectionTitle}>Bổ sung thông tin</Text>
                        <Text style={styles.hint}>Không chắc thì để “Không biết” — hệ thống không tự điền thay bạn.</Text>
                        {questionsByItem.map(([itemId, entry]) => (
                          <View key={itemId} style={styles.resultCard}>
                            <Text style={styles.resultName}>{entry.name}</Text>
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
                          style={[styles.secondaryButton, (answeredCount === 0 || busy !== null) && styles.buttonDisabled]}
                          disabled={answeredCount === 0 || busy !== null}
                          onPress={() => void saveAnswers()}
                        >
                          <Text style={styles.secondaryButtonText}>
                            {busy === "answers" ? "Đang lưu..." : "Lưu câu trả lời vào Tủ đồ"}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </>
                )}
              </Step>
            ) : null}

            {plan && selections ? (
              <Step number={5} title="Tình trạng chuẩn bị">
                <Text style={styles.muted}>Ghi chú cho riêng bạn. Phần này không thay đổi kết quả đánh giá.</Text>
                {CATEGORIES.map(([category, label]) => (
                  <View key={category} style={styles.prepRow}>
                    <Text style={styles.prepLabel}>{label}</Text>
                    <View style={styles.segment}>
                      {PREP.map(([status, statusLabel]) => {
                        const active = prepDraft[category] === status;
                        return (
                          <TouchableOpacity
                            key={status}
                            style={[styles.segmentItem, active && styles.segmentItemActive]}
                            onPress={() =>
                              setPrepDraft((current) => ({ ...current, [category]: active ? undefined : status }))
                            }
                          >
                            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{statusLabel}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.primaryButton, busy !== null && styles.buttonDisabled]}
                  disabled={busy !== null}
                  onPress={() => void savePreparation()}
                >
                  <Text style={styles.primaryButtonText}>{busy === "prep" ? "Đang lưu..." : "Lưu tình trạng chuẩn bị"}</Text>
                </TouchableOpacity>
              </Step>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const vnd = (value: number) => `${value.toLocaleString("vi-VN")}đ`;
const OPTION_LABELS: Record<string, string> = { opt_min_fee: "Tiết kiệm chi phí nhất", opt_min_weight: "Nhẹ nhất" };

/** Phương án thuê đồ còn thiếu — chỉ là ước tính, chưa giữ hàng hay tạo đơn. */
function RentalOptions({
  planId,
  evaluatedRevision,
  accessToken,
  onOpenCatalog,
}: {
  planId: string;
  evaluatedRevision: number;
  accessToken: string;
  onOpenCatalog: () => void;
}) {
  const [optionSet, setOptionSet] = useState<GearRentalOptionSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setOptionSet(await generateGearRentalOptions(planId, evaluatedRevision, accessToken));
    } catch (loadError: unknown) {
      setError(gearErrorMessage(loadError, "Không tạo được phương án thuê."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.optionsBox}>
      <Text style={styles.sectionTitle}>Phương án thuê đồ còn thiếu</Text>
      <Text style={styles.hint}>Giá và tiền cọc là ước tính theo giá hiện tại; số chính thức có ở báo giá.</Text>
      <TouchableOpacity style={[styles.secondaryButton, loading && styles.buttonDisabled]} disabled={loading} onPress={() => void load()}>
        <Text style={styles.secondaryButtonText}>{loading ? "Đang tìm..." : optionSet ? "Tìm lại" : "Xem phương án thuê"}</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {optionSet && optionSet.options.length === 0 ? (
        <Text style={styles.muted}>Hiện chưa có sản phẩm cho thuê phù hợp với phần còn thiếu.</Text>
      ) : null}
      {optionSet?.options.map((option) => {
        const deposits = option.rentalLines.map(lineDepositAmount);
        const feeTotal = option.rentalLines.reduce((sum, line) => sum + (line.rentalFee ?? 0), 0);
        const depositTotal = deposits.every((value) => value !== null)
          ? deposits.reduce<number>((sum, value) => sum + (value ?? 0), 0)
          : null;
        return (
          <View key={option.id} style={styles.resultCard}>
            <View style={styles.resultHead}>
              <Text style={styles.resultName}>{OPTION_LABELS[option.id] ?? "Phương án"}</Text>
              <Text style={[styles.badge, { color: "#8A5A00", backgroundColor: "#FFF6E0" }]}>Ước tính</Text>
            </View>
            {option.rentalLines.map((line) => {
              const lineDeposit = lineDepositAmount(line);
              const percent = line.depositExplanation?.percentageOfReplacementValue;
              return (
                <View key={`${line.productId}-${line.requirementId ?? ""}`} style={styles.optionLine}>
                  <Text style={styles.optionLineName}>
                    {line.productName} × {line.quantity}
                    {line.grade ? ` · ${line.grade === "LIKE_NEW" ? "Mới" : "Đã qua sử dụng"}` : ""}
                  </Text>
                  <Text style={styles.hint}>
                    {typeof line.rentalFee === "number" ? `Phí thuê ${vnd(line.rentalFee)}` : ""}
                    {lineDeposit !== null
                      ? ` · Cọc ${typeof line.depositPerUnit === "number" ? `${vnd(line.depositPerUnit)}/món × ${line.quantity} = ` : ""}${vnd(lineDeposit)}`
                      : ""}
                    {typeof percent === "number" ? ` · ≈ ${percent.toLocaleString("vi-VN")}%` : ""}
                  </Text>
                </View>
              );
            })}
            <Text style={styles.optionTotal}>Phí thuê (ước tính): {vnd(feeTotal)}</Text>
            {depositTotal !== null ? (
              <Text style={styles.optionTotal}>Tiền cọc (ước tính, hoàn lại): {vnd(depositTotal)}</Text>
            ) : null}
          </View>
        );
      })}
      {optionSet ? (
        <TouchableOpacity onPress={onOpenCatalog}>
          <Text style={styles.link}>Phương án chưa giữ hàng. Mở danh mục thuê để chọn các món trên ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHead}>
        <Text style={styles.stepNumber}>{number}</Text>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Banner({ tone, text, onClose }: { tone: "error" | "ok"; text: string; onClose: () => void }) {
  return (
    <View style={[styles.banner, tone === "error" ? styles.bannerError : styles.bannerOk]}>
      <Text style={[styles.bannerText, tone === "error" ? styles.bannerTextError : styles.bannerTextOk]}>{text}</Text>
      <TouchableOpacity onPress={onClose} accessibilityLabel="Đóng thông báo">
        <Ionicons name="close" size={18} color={tone === "error" ? Colors.error : Colors.positiveDeep} />
      </TouchableOpacity>
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
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceContainer,
  },
  flexOne: { flex: 1 },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: Colors.onSurface, fontSize: 20, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  step: { padding: 16, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, gap: 10, ...Shadows.card },
  stepHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 28,
    color: Colors.onPrimary,
    backgroundColor: Colors.primary,
    fontWeight: "800",
  },
  stepTitle: { color: Colors.onSurface, fontSize: 16, fontWeight: "800" },
  muted: { color: Colors.onSurfaceVariant, fontSize: 13, lineHeight: 19 },
  hint: { color: Colors.onSurfaceMuted, fontSize: 12 },
  link: { color: Colors.primaryDark, fontWeight: "700" },
  spacer: { marginTop: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  optionActive: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  optionText: { flex: 1, color: Colors.onSurface, fontSize: 13, fontWeight: "600" },
  warnBox: { padding: 12, borderRadius: Radius.md, backgroundColor: "#FFF6E0", gap: 4 },
  warnTitle: { color: "#6b4500", fontSize: 13, fontWeight: "800" },
  warnText: { color: "#6b4500", fontSize: 12, lineHeight: 18 },
  climateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  climateCell: { width: "47%", gap: 4 },
  label: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: "600" },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    backgroundColor: Colors.surfaceContainerLowest,
    color: Colors.onSurface,
    fontSize: 14,
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  switchText: { flex: 1, color: Colors.onSurface, fontSize: 13 },
  errorText: { color: Colors.error, fontSize: 12 },
  group: { gap: 6 },
  groupLabel: { color: Colors.onSurfaceMuted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  primaryButton: {
    marginTop: 4,
    height: 48,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  primaryButtonText: { color: Colors.onPrimary, fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    marginTop: 4,
    height: 46,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
  },
  secondaryButtonText: { color: Colors.primaryDark, fontSize: 14, fontWeight: "800" },
  buttonDisabled: { opacity: 0.45 },
  sectionTitle: { marginTop: 6, color: Colors.onSurface, fontSize: 14, fontWeight: "800" },
  resultCard: {
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    gap: 4,
  },
  resultHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  resultName: { flex: 1, color: Colors.onSurface, fontSize: 14, fontWeight: "700" },
  badge: { overflow: "hidden", paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.full, fontSize: 11, fontWeight: "700" },
  reason: { color: Colors.body, fontSize: 12, lineHeight: 18 },
  question: { marginTop: 8, gap: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
  },
  chipActive: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  chipText: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: Colors.primaryDark, fontWeight: "800" },
  prepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  prepLabel: { color: Colors.onSurface, fontSize: 13, fontWeight: "600" },
  segment: { flexDirection: "row", gap: 3, padding: 3, borderRadius: 9, backgroundColor: Colors.surfaceContainerHigh },
  segmentItem: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 7 },
  segmentItemActive: { backgroundColor: "#fff" },
  segmentText: { color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: "600" },
  segmentTextActive: { color: Colors.primaryDark, fontWeight: "800" },
  optionsBox: { marginTop: 8, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLow, gap: 8 },
  optionLine: { marginTop: 6, gap: 2 },
  optionLineName: { color: Colors.onSurface, fontSize: 13, fontWeight: "600" },
  optionTotal: { marginTop: 4, color: Colors.onSurface, fontSize: 12, fontWeight: "700" },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: Radius.md },
  bannerError: { backgroundColor: Colors.errorContainer },
  bannerOk: { backgroundColor: Colors.primaryPale },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  bannerTextError: { color: Colors.onErrorContainer },
  bannerTextOk: { color: Colors.positiveDeep },
});
