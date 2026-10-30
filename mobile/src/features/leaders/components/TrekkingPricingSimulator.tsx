import { Radius } from "@/constants/theme";
import {
  confirmTripPricing,
  type CostItem,
} from "@/features/leaders/services/leader-pricing.api";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface TrekkingPricingSimulatorProps {
  tripId: string;
  expectedVersion: number;
  accessToken: string;
  minPax: number;
  maxPax: number;
  initialPrice: number;
  items: CostItem[];
  onPriceConfirmed: (
    confirmedPrice: number,
    minPax: number,
    explanation: string,
    newVersion: number,
  ) => void;
  isConfirmed?: boolean;
  /** Phí sàn + phí thanh toán (bps). Mặc định 1000 = 10% */
  feeBps?: number;
  /** Dự phòng chi phí (bps). Mặc định 500 = 5% */
  contingencyBps?: number;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Định dạng tiền VNĐ dạng 2.850.000đ (không phụ thuộc Intl của Hermes) */
function vnd(n: number): string {
  if (!Number.isFinite(n)) return "0đ";
  const sign = n < 0 ? "-" : "";
  const abs = Math.round(Math.abs(n)).toString();
  return `${sign}${abs.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;
}

function pct(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  return `${(Math.round(n * 10) / 10).toString().replace(".", ",")}%`;
}

/** Tách chi phí cố định (gồm STEP theo số khách) và biến phí / khách */
function costBreakdown(items: CostItem[], pax: number) {
  let fixed = 0;
  let variablePerPax = 0;
  items
    .filter((it) => it.isEnabled && it.includedInPrice)
    .forEach((it) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const dur = Math.max(1, Number(it.durationUnits) || 1);
      const price = Number(it.unitPrice) || 0;
      if (it.kind === "VARIABLE") {
        variablePerPax += price * qty * dur;
      } else if (it.kind === "STEP") {
        const cap = Math.max(1, Number(it.capacityPerUnit) || 15);
        const headcount = pax + Math.max(0, Number(it.extraNonPayingPax) || 0);
        fixed += price * Math.max(1, Math.ceil(headcount / cap)) * dur;
      } else {
        fixed += price * qty * dur;
      }
    });
  return { fixed, variablePerPax };
}

interface PaxRow {
  pax: number;
  revenue: number;
  totalCost: number;
  profit: number;
  marginPct: number;
  status: "LOSS" | "BREAKEVEN" | "TARGET";
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export function TrekkingPricingSimulator({
  tripId,
  expectedVersion,
  accessToken,
  minPax,
  maxPax,
  initialPrice,
  items,
  onPriceConfirmed,
  isConfirmed = false,
  feeBps = 1000,
  contingencyBps = 500,
}: TrekkingPricingSimulatorProps) {
  const safeMax = Math.max(1, maxPax || 15);
  const safeMin = Math.max(1, Math.min(minPax || 1, safeMax));

  const [targetPax, setTargetPax] = useState<number>(safeMax);
  const [targetProfitPct, setTargetProfitPct] = useState<number>(12);
  const [selectedPrice, setSelectedPrice] = useState<number>(
    initialPrice > 0 ? initialPrice : 2850000,
  );
  const [priceText, setPriceText] = useState<string>(String(selectedPrice));
  const [showTable, setShowTable] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(isConfirmed);

  useEffect(() => setConfirmedSuccess(isConfirmed), [isConfirmed]);
  useEffect(() => {
    setTargetPax((p) => Math.max(1, Math.min(safeMax, p)));
  }, [safeMax]);

  const feeRate = feeBps / 10000;
  const contRate = contingencyBps / 10000;
  const targetRate = targetProfitPct / 100;

  const calc = useMemo(() => {
    const rows: PaxRow[] = [];
    for (let n = 1; n <= safeMax; n++) {
      const { fixed, variablePerPax } = costBreakdown(items, n);
      const totalCost = (fixed + variablePerPax * n) * (1 + contRate);
      const revenue = selectedPrice * n;
      const profit = revenue * (1 - feeRate) - totalCost;
      const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
      rows.push({
        pax: n,
        revenue,
        totalCost,
        profit,
        marginPct,
        status:
          profit < 0 ? "LOSS" : marginPct >= targetProfitPct ? "TARGET" : "BREAKEVEN",
      });
    }

    const atTarget = rows[targetPax - 1] ?? rows[rows.length - 1];
    const breakEvenPax = rows.find((r) => r.profit >= 0)?.pax ?? null;
    const targetReachedPax = rows.find((r) => r.status === "TARGET")?.pax ?? null;

    // Giá đề xuất: lợi nhuận / doanh thu = tỷ lệ mục tiêu tại số khách dự kiến
    const divisor = Math.max(0.05, 1 - feeRate - targetRate);
    const suggestedPrice =
      Math.ceil(atTarget.totalCost / divisor / Math.max(1, targetPax) / 10000) * 10000;

    const headerCost = costBreakdown(items, targetPax);
    return { rows, atTarget, breakEvenPax, targetReachedPax, suggestedPrice, headerCost };
  }, [items, safeMax, selectedPrice, feeRate, contRate, targetRate, targetProfitPct, targetPax]);

  const markDirty = () => setConfirmedSuccess(false);

  const updatePrice = (next: number) => {
    const v = Math.max(0, Math.min(50_000_000, Math.round(next)));
    setSelectedPrice(v);
    setPriceText(String(v));
    markDirty();
  };

  const changePax = (d: number) => {
    setTargetPax((p) => Math.max(1, Math.min(safeMax, p + d)));
    markDirty();
  };

  const changeTarget = (d: number) => {
    setTargetProfitPct((p) => Math.max(0, Math.min(50, p + d)));
    markDirty();
  };

  const buildLocalExplanation = () => {
    const { fixed, variablePerPax } = calc.headerCost;
    return [
      `Giá vé ${vnd(selectedPrice)}/người được tính cho đoàn dự kiến ${targetPax} khách.`,
      `• Chi phí cố định (xe, porter, dẫn đường...): ${vnd(fixed)}.`,
      `• Chi phí theo đầu người (ăn uống, vé, bảo hiểm...): ${vnd(variablePerPax)}/người.`,
      `• Dự phòng phát sinh ${pct(contingencyBps / 100)}, phí nền tảng & thanh toán ${pct(feeBps / 100)}.`,
      calc.breakEvenPax
        ? `• Đoàn bắt đầu có lãi từ ${calc.breakEvenPax} khách.`
        : "• Với mức giá này đoàn chưa thể có lãi trong giới hạn số khách.",
      `• Lợi nhuận dự kiến tại ${targetPax} khách: ${vnd(calc.atTarget.profit)} (${pct(calc.atTarget.marginPct)} doanh thu).`,
    ].join("\n");
  };

  const handleConfirm = async () => {
    if (!tripId || !accessToken) {
      Alert.alert("Chưa lưu chuyến", "Vui lòng hoàn tất lưu chuyến trước khi chốt giá vé.");
      return;
    }
    if (selectedPrice <= 0) {
      Alert.alert("Giá vé không hợp lệ", "Vui lòng nhập giá vé lớn hơn 0.");
      return;
    }
    setIsConfirming(true);
    try {
      const res: any = await confirmTripPricing(
        tripId,
        { expectedVersion, selectedPrice, selectedMinPax: safeMin, targetPax },
        accessToken,
      );
      const explanation: string =
        res?.priceExplanation ||
        res?.trip?.priceExplanation ||
        res?.explanation ||
        buildLocalExplanation();
      const newVersion: number =
        res?.version ?? res?.tripVersion ?? res?.trip?.version ?? expectedVersion + 1;

      setConfirmedSuccess(true);
      onPriceConfirmed?.(selectedPrice, safeMin, explanation, newVersion);
      Alert.alert(
        "Đã chốt giá vé",
        `Giá ${vnd(selectedPrice)}/người cho đoàn tối thiểu ${safeMin} khách.`,
      );
    } catch (err: any) {
      Alert.alert("Không thể chốt giá vé", err?.message || "Đã xảy ra lỗi khi xác nhận giá vé.");
    } finally {
      setIsConfirming(false);
    }
  };

  const { atTarget, breakEvenPax, targetReachedPax, suggestedPrice, headerCost } = calc;
  const profitColor = atTarget.profit < 0 ? C.red : C.green;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Ionicons name="receipt-outline" size={16} color={C.green} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={styles.title}>Trekking Pricing Simulator</Text>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>Mô phỏng thời gian thực</Text>
            </View>
          </View>
          <Text style={styles.headerMeta}>
            Cố định: <Text style={styles.headerMetaStrong}>{vnd(headerCost.fixed)}</Text>
            {"  •  "}Biến phí:{" "}
            <Text style={styles.headerMetaStrong}>{vnd(headerCost.variablePerPax)}/người</Text>
          </Text>
          <Text style={styles.headerMeta}>
            Phí sàn & TT: <Text style={styles.headerMetaStrong}>{pct(feeBps / 100)}</Text>
            {"  •  "}Dự phòng:{" "}
            <Text style={styles.headerMetaStrong}>{pct(contingencyBps / 100)}</Text>
          </Text>
        </View>
      </View>

      {/* Control 1: số khách */}
      <View style={styles.control}>
        <View style={styles.controlHead}>
          <Text style={styles.controlLabel}>Số khách dự kiến thanh toán (targetPax)</Text>
          <Text style={styles.controlValue}>
            {targetPax} người <Text style={styles.controlValueMute}>/ tối đa {safeMax}</Text>
          </Text>
        </View>
        <View style={styles.stepRow}>
          <StepBtn icon="remove" onPress={() => changePax(-1)} />
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${(targetPax / safeMax) * 100}%` }]} />
          </View>
          <StepBtn icon="add" onPress={() => changePax(1)} />
        </View>
        <View style={styles.hintRow}>
          <Text style={styles.hint}>1 khách</Text>
          <Text style={styles.hint}>Tối thiểu khởi hành: {safeMin}</Text>
          <Text style={styles.hint}>Tối đa: {safeMax}</Text>
        </View>
      </View>

      {/* Control 2: giá vé */}
      <View style={styles.control}>
        <View style={styles.controlHead}>
          <Text style={styles.controlLabel}>Giá vé thu mỗi người (selectedPrice)</Text>
          <View style={styles.priceInputWrap}>
            <TextInput
              style={styles.priceInput}
              value={priceText}
              keyboardType="numeric"
              onChangeText={(v) => {
                const digits = v.replace(/[^0-9]/g, "");
                setPriceText(digits);
                setSelectedPrice(parseInt(digits, 10) || 0);
                markDirty();
              }}
              onBlur={() => setPriceText(String(selectedPrice))}
            />
            <Text style={styles.priceUnit}>đ/người</Text>
          </View>
        </View>
        <View style={styles.chipRow}>
          {[-100000, -10000, 10000, 100000].map((d) => (
            <TouchableOpacity
              key={d}
              style={styles.chip}
              onPress={() => updatePrice(selectedPrice + d)}
              activeOpacity={0.75}
            >
              <Text style={styles.chipText}>
                {d > 0 ? "+" : "-"}
                {Math.abs(d) / 1000}K
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.hintRow}>
          <Text style={styles.hint}>100.000đ</Text>
          <Text style={styles.hint}>Bước chỉnh: 10.000đ</Text>
          <Text style={styles.hint}>5.000.000đ</Text>
        </View>
      </View>

      {/* Control 3: tỷ lệ lãi mong muốn (Biên lợi nhuận ròng) */}
      <View style={styles.control}>
        <View style={styles.controlHead}>
          <Text style={styles.controlLabel}>Biên lợi nhuận ròng mục tiêu (Lãi dự kiến)</Text>
          <Text style={styles.controlValue}>{targetProfitPct}% doanh thu</Text>
        </View>
        <View style={styles.stepRow}>
          <StepBtn icon="remove" onPress={() => changeTarget(-1)} />
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${(targetProfitPct / 50) * 100}%` }]} />
          </View>
          <StepBtn icon="add" onPress={() => changeTarget(1)} />
        </View>
        <View style={styles.hintRow}>
          <Text style={styles.hint}>0% (Hòa vốn)</Text>
          <Text style={styles.hint}>Khuyên dùng: 12% - 20%</Text>
          <Text style={styles.hint}>50%</Text>
        </View>
      </View>

      {/* KPI grid */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Lợi nhuận tại {targetPax} khách</Text>
          <Text style={[styles.kpiValue, { color: profitColor }]} numberOfLines={1} adjustsFontSizeToFit>
            {vnd(atTarget.profit)}
          </Text>
          <Text style={styles.kpiSub}>{pct(atTarget.marginPct)} doanh thu</Text>
        </View>

        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Giá đề xuất ({targetProfitPct}%)</Text>
          <Text style={[styles.kpiValue, { color: C.yellow }]} numberOfLines={1} adjustsFontSizeToFit>
            {vnd(suggestedPrice)}
          </Text>
          <TouchableOpacity onPress={() => updatePrice(suggestedPrice)} hitSlop={8}>
            <Text style={styles.kpiAction}>↳ Áp dụng giá này</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Hòa vốn sớm nhất</Text>
          <Text style={[styles.kpiValue, { color: C.blue }]}>
            {breakEvenPax ? `${breakEvenPax} khách` : "Chưa đạt"}
          </Text>
          <Text style={styles.kpiSub}>
            {breakEvenPax ? "Không bị lỗ vốn" : `Cần tăng giá vé`}
          </Text>
        </View>

        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Đạt mục tiêu {targetProfitPct}%</Text>
          <Text style={[styles.kpiValue, { color: C.purple }]}>
            {targetReachedPax ? `${targetReachedPax} khách` : "Chưa đạt"}
          </Text>
          <Text style={styles.kpiSub}>Đạt biên kỳ vọng</Text>
        </View>
      </View>

      {atTarget.profit < 0 && (
        <View style={styles.lossBanner}>
          <Ionicons name="warning-outline" size={16} color={C.red} />
          <Text style={styles.lossText}>
            Với {targetPax} khách, giá {vnd(selectedPrice)} đang lỗ {vnd(-atTarget.profit)}. Hãy tăng giá
            vé hoặc bấm "Áp dụng giá này".
          </Text>
        </View>
      )}

      {/* Bảng chi tiết */}
      <TouchableOpacity
        style={styles.tableToggle}
        onPress={() => setShowTable((s) => !s)}
        activeOpacity={0.7}
      >
        <Ionicons name={showTable ? "caret-up" : "caret-down"} size={12} color={C.mute} />
        <Text style={styles.tableToggleText}>
          {showTable ? "▲ Ẩn" : "▼ Xem"} bảng tính chi tiết từng mức khách (1 .. {safeMax})
        </Text>
      </TouchableOpacity>

      {showTable && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableWrap}>
          <View>
            <View style={[styles.tr, styles.thRow]}>
              {COLS.map((c) => (
                <Text key={c.key} style={[styles.th, { width: c.w }]}>
                  {c.label}
                </Text>
              ))}
            </View>
            {calc.rows.map((r) => {
              const active = r.pax === targetPax;
              const statusText =
                r.status === "LOSS" ? "Lỗ vốn" : r.status === "TARGET" ? "Đạt mục tiêu" : "Có lãi";
              const statusColor =
                r.status === "LOSS" ? C.red : r.status === "TARGET" ? C.purple : C.blue;
              return (
                <TouchableOpacity
                  key={r.pax}
                  style={[styles.tr, active && styles.trActive]}
                  onPress={() => {
                    setTargetPax(r.pax);
                    markDirty();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.td, { width: COLS[0].w }, active && styles.tdActive]}>
                    {r.pax} khách
                  </Text>
                  <Text style={[styles.td, { width: COLS[1].w }, active && styles.tdActive]}>
                    {vnd(r.revenue)}
                  </Text>
                  <Text style={[styles.td, { width: COLS[2].w }, active && styles.tdActive]}>
                    {vnd(r.totalCost)}
                  </Text>
                  <Text
                    style={[
                      styles.td,
                      styles.tdBold,
                      { width: COLS[3].w, color: r.profit < 0 ? C.red : C.green },
                    ]}
                  >
                    {vnd(r.profit)}
                  </Text>
                  <Text style={[styles.td, { width: COLS[4].w }, active && styles.tdActive]}>
                    {pct(r.marginPct)}
                  </Text>
                  <Text style={[styles.td, { width: COLS[5].w, color: statusColor }]}>
                    {statusText}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Confirm */}
      {confirmedSuccess && (
        <View style={styles.confirmedBadge}>
          <Ionicons name="checkmark-circle" size={15} color={C.green} />
          <Text style={styles.confirmedText}>Đã chốt giá vé: {vnd(selectedPrice)}/người</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.confirmBtn, isConfirming && { opacity: 0.6 }]}
        onPress={handleConfirm}
        disabled={isConfirming}
        activeOpacity={0.85}
      >
        {isConfirming ? (
          <ActivityIndicator size="small" color="#04120c" />
        ) : (
          <Text style={styles.confirmBtnText}>
            ✓ {confirmedSuccess ? "Cập nhật & chốt lại" : "Lưu dự toán & Chốt"} giá vé ({vnd(selectedPrice)})
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function StepBtn({ icon, onPress }: { icon: "add" | "remove"; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.stepBtn} onPress={onPress} activeOpacity={0.7} hitSlop={6}>
      <Ionicons name={icon} size={18} color="#ffffff" />
    </TouchableOpacity>
  );
}

const COLS = [
  { key: "pax", label: "Số khách", w: 70 },
  { key: "rev", label: "Doanh thu", w: 100 },
  { key: "cost", label: "Tổng chi phí", w: 100 },
  { key: "profit", label: "Lợi nhuận", w: 100 },
  { key: "margin", label: "Tỷ lệ lãi", w: 70 },
  { key: "status", label: "Trạng thái", w: 90 },
];

const C = {
  bg: "#0b1220",
  panel: "#111a2b",
  border: "#1f2a3d",
  text: "#e5e7eb",
  mute: "#8b95a7",
  green: "#10b981",
  yellow: "#f5b301",
  blue: "#60a5fa",
  purple: "#c084fc",
  red: "#f43f5e",
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.bg,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#0f2a22",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "800", color: "#ffffff" },
  liveBadge: {
    backgroundColor: "#163300",
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#9fe870",
  },
  headerMeta: { fontSize: 11, color: C.mute, lineHeight: 16 },
  headerMetaStrong: { color: "#ffffff", fontWeight: "700" },

  control: { marginBottom: 16 },
  controlHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  controlLabel: { flex: 1, fontSize: 12.5, fontWeight: "700", color: C.text },
  controlValue: { fontSize: 13, fontWeight: "800", color: C.green },
  controlValueMute: { color: C.mute, fontWeight: "600", fontSize: 11 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1c2740",
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#253149",
    overflow: "hidden",
  },
  trackFill: { height: "100%", backgroundColor: C.green, borderRadius: 4 },
  hintRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  hint: { fontSize: 10, color: C.mute },

  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: "#2b3a55",
    borderRadius: 8,
    paddingHorizontal: 10,
    minWidth: 130,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: "800",
    color: C.green,
    textAlign: "right",
  },
  priceUnit: { marginLeft: 4, fontSize: 12, color: C.mute, fontWeight: "700" },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1c2740",
  },
  chipText: { fontSize: 12, fontWeight: "700", color: "#ffffff" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  kpi: {
    width: "48.5%",
    flexGrow: 1,
    flexBasis: "46%",
    backgroundColor: C.panel,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  kpiLabel: { fontSize: 11, color: C.mute, marginBottom: 6 },
  kpiValue: { fontSize: 18, fontWeight: "900" },
  kpiSub: { fontSize: 10.5, color: C.mute, marginTop: 4 },
  kpiAction: { fontSize: 11, color: C.yellow, fontWeight: "700", marginTop: 4 },

  lossBanner: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#2a0f17",
    borderWidth: 1,
    borderColor: "#5b1a2a",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  lossText: { flex: 1, fontSize: 11, color: "#fecdd3", lineHeight: 16 },

  tableToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  tableToggleText: { fontSize: 11.5, color: C.mute, fontWeight: "600" },
  tableWrap: {
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: "#0d1526",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#18223a",
  },
  thRow: { backgroundColor: C.panel },
  trActive: { backgroundColor: "#0c2a22" },
  th: { fontSize: 10.5, fontWeight: "700", color: C.mute },
  td: { fontSize: 11, color: C.text },
  tdBold: { fontWeight: "800" },
  tdActive: { color: "#6ee7b7", fontWeight: "700" },

  confirmedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0c2a22",
    borderRadius: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  confirmedText: { fontSize: 12, fontWeight: "800", color: C.green },
  confirmBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.green,
    paddingVertical: 14,
    borderRadius: 10,
  },
  confirmBtnText: { fontSize: 13, fontWeight: "800", color: "#04120c" },
});
