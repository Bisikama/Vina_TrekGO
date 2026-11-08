import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Colors, Radius } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { gearErrorCode, gearErrorMessage } from "@/features/gear/advisor-api";
import {
  createGearQuoteIntent,
  generateGearAdvice,
  generateGearRentalOptions,
  lineDepositAmount,
  type GearPlanAdvice,
  type GearRentalOption,
  type GearRentalOptionSet,
} from "@/features/gear/rental-options-api";
import { FadeInUp, GearThumb, PopIn, Trek } from "@/features/gear/TrekKit";
import { rentalApi } from "@/features/rentals/api";
import { reasonText } from "@/features/rentals/display";
import { GradeBadge } from "@/features/rentals/GradeBadge";
import { useRentalSelection } from "@/features/rentals/RentalSelectionContext";
import { calculateProductDeposit, rentalProductSpecs, type RentalProduct } from "@/features/rentals/types";
import type { EquipmentItem } from "@/types";

const OPTION_LABELS: Record<string, string> = { opt_min_fee: "Tiết kiệm chi phí nhất", opt_min_weight: "Nhẹ nhất" };
const OPTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = { opt_min_fee: "wallet-outline", opt_min_weight: "barbell-outline" };

const vnd = (value: number) => `${Math.round(value).toLocaleString("vi-VN")}đ`;

function stripGradeSuffix(name: string) {
  return name.replace(/\s*[-–—:]\s*(rất mới|như mới|mới|đã sử dụng tốt|sử dụng tốt|đã qua sử dụng)\s*$/i, "").trim();
}

function toCartItem(product: RentalProduct, stock: number): EquipmentItem {
  return {
    id: product.id,
    name: product.name,
    category: "Accessories",
    dailyRate: product.dailyPrice,
    deposit: calculateProductDeposit(product),
    stock,
    imageUrl: product.imageUrl ?? "",
    specs: rentalProductSpecs(product),
    description: product.description ?? "",
    rating: 0,
  };
}

const lineKey = (option: GearRentalOption) =>
  option.rentalLines.map((line) => `${line.productId}x${line.quantity}`).sort().join("|");

/** Hai phương án trùng món thì gộp làm một thẻ. */
function distinctOptions(options: GearRentalOption[]) {
  const groups: { option: GearRentalOption; labels: string[] }[] = [];
  for (const option of options) {
    const label = OPTION_LABELS[option.id] ?? option.label ?? "Phương án";
    const same = groups.find((group) => lineKey(group.option) === lineKey(option));
    if (same) same.labels.push(label);
    else groups.push({ option, labels: [label] });
  }
  return groups;
}

/** Phương án thuê đồ còn thiếu: ước tính, lời khuyên, đưa vào giỏ thuê để tạo báo giá chính thức. */
export function GearRentalOptionsCard({
  planId,
  tripId,
  evaluatedRevision,
  accessToken,
  requirementTitles,
  requiredIds,
}: {
  planId: string;
  tripId: string;
  evaluatedRevision: number;
  accessToken: string;
  requirementTitles: Record<string, string>;
  /** Yêu cầu bắt buộc; phần thiếu ở yêu cầu không bắt buộc không làm phương án "chưa đủ". */
  requiredIds: string[];
}) {
  const router = useRouter();
  const { setCartQuantity } = useApp();
  const { selectTrip } = useRentalSelection();
  const [optionSet, setOptionSet] = useState<GearRentalOptionSet | null>(null);
  const [products, setProducts] = useState<Record<string, RentalProduct>>({});
  const [budget, setBudget] = useState("");
  const [usedBudget, setUsedBudget] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [busyOption, setBusyOption] = useState<string | null>(null);
  const [advice, setAdvice] = useState<Record<string, GearPlanAdvice>>({});
  const [error, setError] = useState("");

  // Ảnh sản phẩm của các món trong phương án; lỗi thì vẫn hiện icon loại đồ.
  useEffect(() => {
    if (!optionSet) return;
    const ids = [...new Set(optionSet.options.flatMap((option) => option.rentalLines.map((line) => line.productId)))];
    let active = true;
    void Promise.all(ids.map((id) => rentalApi.getProduct(id).then((product) => [id, product] as const).catch(() => null))).then((entries) => {
      if (active) setProducts(Object.fromEntries(entries.filter((entry): entry is readonly [string, RentalProduct] => entry !== null)));
    });
    return () => {
      active = false;
    };
  }, [optionSet]);

  const budgetValue = budget.trim() === "" ? undefined : Number(budget.replace(/[.,\s]/g, ""));
  const budgetInvalid = budgetValue !== undefined && (!Number.isInteger(budgetValue) || budgetValue < 0);

  async function load() {
    if (budgetInvalid) return;
    setLoading(true);
    setError("");
    setAdvice({});
    try {
      setOptionSet(await generateGearRentalOptions(planId, evaluatedRevision, accessToken, budgetValue));
      setUsedBudget(budgetValue);
    } catch (loadError) {
      setError(gearErrorMessage(loadError, "Không tạo được phương án thuê."));
    } finally {
      setLoading(false);
    }
  }

  function handleOptionError(optionError: unknown, fallback: string) {
    const code = gearErrorCode(optionError);
    if (code === "GEAR_OPTION_SET_EXPIRED" || code === "GEAR_OPTION_SET_NOT_FOUND") {
      setOptionSet(null);
      setError("Phương án đã hết hạn (giữ 15 phút). Bấm “Xem phương án thuê” để tính lại theo tồn kho mới.");
    } else if (code === "GEAR_PLAN_STALE") {
      setOptionSet(null);
      setError("Kế hoạch đã thay đổi. Hãy đánh giá lại trước khi chọn phương án thuê.");
    } else {
      setError(gearErrorMessage(optionError, fallback));
    }
  }

  async function loadAdvice(option: GearRentalOption) {
    if (!optionSet) return;
    setBusyOption(`advice:${option.id}`);
    setError("");
    try {
      const result = await generateGearAdvice(planId, evaluatedRevision, { setId: optionSet.setId, optionId: option.id }, accessToken);
      setAdvice((current) => ({ ...current, [option.id]: result }));
    } catch (adviceError) {
      handleOptionError(adviceError, "Không lấy được lời khuyên.");
    } finally {
      setBusyOption(null);
    }
  }

  async function rent(option: GearRentalOption) {
    if (!optionSet) return;
    setBusyOption(`rent:${option.id}`);
    setError("");
    try {
      const intent = await createGearQuoteIntent(planId, evaluatedRevision, { setId: optionSet.setId, optionId: option.id }, accessToken);
      const targetTripId = intent.prefillRentalQuote.tripId || tripId;
      // Server là nơi quyết định chuyến có thuê được không (hạn chót thuê, trạng thái vé...).
      const tripOptions = await rentalApi.listTripOptions(accessToken);
      const trip = tripOptions.find((candidate) => candidate.id === targetTripId);
      if (!trip) throw new Error("Chuyến này không nằm trong danh sách chuyến có thể thuê đồ.");
      if (!trip.eligible) throw new Error(reasonText(trip.eligibilityReason, "Chuyến đi hiện chưa đủ điều kiện thuê thiết bị."));
      const entries = await Promise.all(
        intent.prefillRentalQuote.items.map(async (item) => {
          const line = option.rentalLines.find((candidate) => candidate.productId === item.productId);
          const product = products[item.productId] ?? (await rentalApi.getProduct(item.productId));
          return { item: toCartItem(product, Math.max(item.quantity, line?.availableCount ?? item.quantity)), quantity: item.quantity };
        }),
      );
      entries.forEach(({ item, quantity }) => setCartQuantity(item, quantity));
      selectTrip(trip);
      router.push("/rental-checkout" as Href);
    } catch (rentError) {
      handleOptionError(rentError, "Không đưa được phương án vào giỏ thuê.");
    } finally {
      setBusyOption(null);
    }
  }

  const groups = optionSet ? distinctOptions(optionSet.options.filter((option) => option.rentalLines.length > 0)) : [];

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <Ionicons name="bag-handle" size={18} color={Trek.trail} />
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.title}>Thuê phần còn thiếu</Text>
          <Text style={styles.hint}>TrekGo ghép đồ trong kho cho các yêu cầu bắt buộc còn thiếu. Giá và cọc là ước tính; số chính thức có ở báo giá.</Text>
        </View>
      </View>

      <Text style={styles.label}>Ngân sách phí thuê (không bắt buộc)</Text>
      <View style={styles.budgetRow}>
        <TextInput
          value={budget}
          onChangeText={setBudget}
          keyboardType="number-pad"
          placeholder="VD: 300000"
          placeholderTextColor={Colors.onSurfaceMuted}
          style={[styles.input, styles.flexOne]}
        />
        <TouchableOpacity style={[styles.loadButton, (loading || budgetInvalid) && styles.disabled]} disabled={loading || budgetInvalid} onPress={() => void load()}>
          {loading ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name="search" size={16} color="#ffffff" />}
          <Text style={styles.loadButtonText}>{optionSet ? "Tính lại" : "Xem phương án"}</Text>
        </TouchableOpacity>
      </View>
      {budgetInvalid ? <Text style={styles.error}>Ngân sách phải là số nguyên không âm (VND).</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {optionSet && groups.length === 0 ? (
        <Text style={styles.hint}>
          Kho hiện chưa có đồ cho thuê phù hợp trong thời gian chuyến đi. Bạn có thể bấm “Tôi tự chuẩn bị” ở yêu cầu tương ứng.
        </Text>
      ) : null}

      {groups.map(({ option, labels }, index) => (
        <FadeInUp key={option.id} delay={index * 90}>
          <OptionCard
            option={option}
            title={labels.join(" · ")}
            icon={OPTION_ICONS[option.id] ?? "pricetags-outline"}
            budget={usedBudget}
            requirementTitles={requirementTitles}
            requiredIds={requiredIds}
            products={products}
            advice={advice[option.id]}
            busy={busyOption}
            onAdvice={() => void loadAdvice(option)}
            onRent={() => void rent(option)}
          />
        </FadeInUp>
      ))}

      {optionSet && groups.length ? (
        <Text style={styles.hint}>
          Phương án chưa giữ hàng. “Thuê phương án này” đưa các món vào giỏ thuê và chọn đúng chuyến; tồn kho và tiền được kiểm lại khi tạo báo giá.
        </Text>
      ) : null}
    </View>
  );
}

function OptionCard({
  option,
  title,
  icon,
  budget,
  requirementTitles,
  requiredIds,
  products,
  advice,
  busy,
  onAdvice,
  onRent,
}: {
  option: GearRentalOption;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  budget: number | undefined;
  requirementTitles: Record<string, string>;
  requiredIds: string[];
  products: Record<string, RentalProduct>;
  advice: GearPlanAdvice | undefined;
  busy: string | null;
  onAdvice: () => void;
  onRent: () => void;
}) {
  const summary = option.summary ?? {};
  const deposits = option.rentalLines.map(lineDepositAmount);
  const feeTotal = summary.totalRentalFee ?? option.rentalLines.reduce((sum, line) => sum + (line.rentalFee ?? 0), 0);
  const depositTotal =
    summary.totalDeposit ?? (deposits.every((value) => value !== null) ? deposits.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null);
  const missing = (summary.missingRequirements ?? []).filter((id) => requiredIds.includes(id)).map((id) => requirementTitles[id] ?? "Một yêu cầu");
  const overBudget = budget !== undefined && feeTotal > budget;
  const complete = missing.length === 0;
  const weightKg =
    summary.weightStatus && summary.weightStatus !== "UNKNOWN" && summary.totalKnownWeightG
      ? (summary.totalKnownWeightG / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })
      : null;

  return (
    <View style={[styles.card, complete ? styles.cardComplete : styles.cardPartial]}>
      <View style={styles.cardHead}>
        <Ionicons name={icon} size={18} color={Trek.trail} />
        <Text style={[styles.cardTitle, styles.flexOne]}>{title}</Text>
        <Text style={[styles.badge, complete ? styles.badgeOk : styles.badgeWarn]}>
          {complete ? "Đủ phần thiếu" : overBudget ? "Vượt ngân sách" : "Chưa đủ"}
        </Text>
      </View>
      {missing.length ? (
        <Text style={styles.missing}>
          {summary.searchStatus === "INFEASIBLE" ? "Kho không đủ hàng cho: " : "Chưa tìm được đồ thuê cho: "}
          <Text style={styles.bold}>{missing.join(", ")}</Text>
        </Text>
      ) : null}

      {option.rentalLines.map((line) => {
        const lineDeposit = lineDepositAmount(line);
        const product = products[line.productId];
        return (
          <View key={`${line.productId}-${line.requirementId ?? ""}`} style={styles.line}>
            <GearThumb url={product?.imageUrl ?? product?.imageUrls?.[0]} category={line.category ?? "BACKPACK"} size={52} />
            <View style={styles.flexOne}>
              <Text style={styles.lineName} numberOfLines={2}>
                {line.grade ? stripGradeSuffix(line.productName) : line.productName} × {line.quantity}
              </Text>
              {line.grade ? <GradeBadge grade={line.grade} style={styles.grade} /> : null}
              <Text style={styles.lineMeta}>
                {line.requirementId && requirementTitles[line.requirementId] ? `Cho: ${requirementTitles[line.requirementId]} · ` : ""}
                {typeof line.rentalFee === "number" ? `Phí ${vnd(line.rentalFee)}` : ""}
                {lineDeposit !== null ? ` · Cọc ${vnd(lineDeposit)}` : ""}
                {typeof line.weight_g === "number" ? ` · ${line.weight_g.toLocaleString("vi-VN")} g` : ""}
              </Text>
            </View>
          </View>
        );
      })}

      <View style={styles.totals}>
        <Total label="Phí thuê (ước tính)" value={vnd(feeTotal)} />
        {depositTotal !== null ? <Total label="Tiền cọc (hoàn lại)" value={vnd(depositTotal)} /> : null}
        {weightKg ? <Total label="Trọng lượng đồ thuê" value={`≈ ${weightKg} kg${summary.weightStatus === "PARTIAL" ? "*" : ""}`} /> : null}
      </View>

      {advice ? (
        <PopIn style={styles.advice}>
          <Text style={styles.adviceLabel}>{advice.source === "AI" ? "LỜI KHUYÊN · AI CHỌN TỪ DỮ KIỆN ĐÃ KIỂM CHỨNG" : "LỜI KHUYÊN · THEO BỘ QUY TẮC TREKGO"}</Text>
          <Text style={styles.adviceText}>{advice.narrativeVi}</Text>
          {advice.disclaimerVi ? <Text style={styles.hint}>{advice.disclaimerVi}</Text> : null}
        </PopIn>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.rentButton, busy !== null && styles.disabled]} disabled={busy !== null} onPress={onRent}>
          {busy === `rent:${option.id}` ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name="cart" size={16} color="#ffffff" />}
          <Text style={styles.rentButtonText}>{busy === `rent:${option.id}` ? "Đang chuẩn bị giỏ..." : "Thuê phương án này"}</Text>
        </TouchableOpacity>
        {!advice ? (
          <TouchableOpacity style={[styles.adviceButton, busy !== null && styles.disabled]} disabled={busy !== null} onPress={onAdvice}>
            {busy === `advice:${option.id}` ? (
              <ActivityIndicator size="small" color={Trek.trail} />
            ) : (
              <Ionicons name="bulb-outline" size={16} color={Trek.trail} />
            )}
            <Text style={styles.adviceButtonText}>Lời khuyên</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  bold: { fontWeight: "800" },
  disabled: { opacity: 0.5 },
  box: { gap: 10, padding: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: Trek.line, backgroundColor: "#fafbf8" },
  head: { flexDirection: "row", gap: 10 },
  headIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Trek.mintPale },
  title: { color: Trek.ink, fontSize: 15, fontWeight: "800" },
  hint: { marginTop: 2, color: Trek.muted, fontSize: 11, lineHeight: 16 },
  label: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: "600" },
  budgetRow: { flexDirection: "row", gap: 8 },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    backgroundColor: "#ffffff",
    color: Colors.onSurface,
  },
  loadButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: Trek.trail },
  loadButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  error: { color: Colors.error, fontSize: 12 },
  card: { gap: 8, padding: 12, borderRadius: Radius.lg, borderWidth: 1, backgroundColor: "#ffffff" },
  cardComplete: { borderColor: "#bcdcc6" },
  cardPartial: { borderColor: "#f1d6a3" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { color: Trek.ink, fontSize: 14, fontWeight: "800" },
  badge: { overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, fontSize: 10, fontWeight: "800" },
  badgeOk: { color: Trek.trail, backgroundColor: Trek.mintPale },
  badgeWarn: { color: Trek.amberInk, backgroundColor: Trek.amberBg },
  missing: { padding: 8, borderRadius: Radius.sm, backgroundColor: Trek.amberBg, color: Trek.amberInk, fontSize: 11, lineHeight: 16 },
  line: { flexDirection: "row", gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#eef2ee" },
  lineName: { color: Colors.onSurface, fontSize: 13, fontWeight: "700" },
  grade: { alignSelf: "flex-start", marginTop: 4 },
  lineMeta: { marginTop: 3, color: Trek.muted, fontSize: 11, lineHeight: 16 },
  totals: { gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#eef2ee" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  totalLabel: { color: Trek.muted, fontSize: 12 },
  totalValue: { color: Trek.ink, fontSize: 13, fontWeight: "800" },
  advice: { gap: 4, padding: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: "#d5ebdb", backgroundColor: "#f1f9f2" },
  adviceLabel: { color: Trek.trail, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  adviceText: { color: Colors.onSurface, fontSize: 12, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 8 },
  rentButton: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, backgroundColor: Trek.forestMid },
  rentButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  adviceButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bcdcc6",
    backgroundColor: "#ffffff",
  },
  adviceButtonText: { color: Trek.trail, fontSize: 12, fontWeight: "800" },
});
