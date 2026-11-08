import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Colors, Radius } from "@/constants/theme";
import {
  gearAdvisorApi,
  gearErrorCode,
  gearErrorMessage,
  progressOf,
  type ChecklistProgressEntry,
  type GearPlan,
  type PackingChecklistItem,
} from "@/features/gear/advisor-api";
import { BackpackMeter } from "@/features/gear/BackpackMeter";
import { GearThumb, PopIn, Trek } from "@/features/gear/TrekKit";

const COVERAGE_LABELS: Record<string, string> = {
  COVERED_BY_OWNED: "Đồ đã chọn đáp ứng",
  PLANNED_RENTAL: "Dự kiến thuê",
  USER_DECLARED_PROVISION: "Tự chuẩn bị",
  NEEDS_REPLACEMENT: "Cần thay thế",
  MISSING: "Cần chuẩn bị thêm",
  UNKNOWN: "Cần thêm thông tin",
  ESSENTIAL: "Đồ thiết yếu",
};

const draftFrom = (checklist: PackingChecklistItem[], stored: ChecklistProgressEntry[]) =>
  checklist.map((item) => {
    const saved = stored.find((entry) => entry.requirementId === item.requirementId);
    return { requirementId: item.requirementId, isChecked: saved?.isChecked ?? false, note: saved?.note ?? "" };
  });

/** Checklist đóng gói trước ngày đi. Tiến độ không ảnh hưởng đánh giá hay giữ chỗ thuê. */
export function PackingChecklistCard({
  plan,
  checklist,
  itemNames,
  itemPhotos,
  stale,
  accessToken,
  onPlanChange,
}: {
  plan: GearPlan;
  checklist: PackingChecklistItem[];
  itemNames: Record<string, string>;
  itemPhotos: Record<string, string | undefined>;
  stale: boolean;
  accessToken: string;
  onPlanChange: (plan: GearPlan) => void;
}) {
  const [draft, setDraft] = useState(() => draftFrom(checklist, progressOf(plan)));
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const packed = draft.filter((entry) => entry.isChecked).length;
  const saved = progressOf(plan);
  const dirty = draft.some((entry) => {
    const before = saved.find((item) => item.requirementId === entry.requirementId);
    return (before?.isChecked ?? false) !== entry.isChecked || (before?.note ?? "") !== (entry.note ?? "");
  });

  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await gearAdvisorApi.saveChecklistProgress(
        plan.id,
        plan.progressVersion ?? 1,
        draft.map((entry) => ({ ...entry, note: entry.note?.trim() || undefined })),
        accessToken,
      );
      onPlanChange({ ...plan, ...updated, isStale: plan.isStale });
      setNotice("Đã lưu tiến độ đóng gói.");
    } catch (saveError) {
      if (gearErrorCode(saveError) === "GEAR_PROGRESS_CAS_CONFLICT") {
        try {
          const latest = await gearAdvisorApi.getPlan(plan.id, accessToken);
          setDraft(draftFrom(checklist, progressOf(latest)));
          onPlanChange(latest);
          setError("Tiến độ đã thay đổi ở nơi khác. Đã tải bản mới; vui lòng kiểm tra và đánh dấu lại.");
        } catch (reloadError) {
          setError(gearErrorMessage(reloadError));
        }
      } else {
        setError(gearErrorMessage(saveError));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <BackpackMeter value={packed} total={checklist.length} size={64} />
        <View style={styles.flexOne}>
          <Text style={styles.title}>Đóng gói trước ngày đi</Text>
          <Text style={styles.hint}>Chạm để đánh dấu món đã vào balo. Phần này không thay đổi kết quả đánh giá.</Text>
          <Text style={styles.count}>
            {packed}/{checklist.length} món đã xếp
          </Text>
        </View>
      </View>
      {stale ? (
        <Text style={styles.warn}>Checklist thuộc lần đánh giá trước. Hãy đánh giá lại để cập nhật yêu cầu.</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {checklist.map((item, index) => {
        const value = draft[index];
        const firstAssigned = item.assignedItemIds?.[0];
        return (
          <View key={item.requirementId} style={[styles.row, value.isChecked && styles.rowDone]}>
            <TouchableOpacity
              style={styles.rowMain}
              disabled={stale}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: value.isChecked }}
              onPress={() => setDraft((old) => old.map((entry, i) => (i === index ? { ...entry, isChecked: !entry.isChecked } : entry)))}
            >
              {item.status === "ESSENTIAL" ? (
                <View style={styles.essentialIcon}>
                  <Ionicons name="flashlight-outline" size={20} color={Trek.woodDeep} />
                </View>
              ) : (
                <GearThumb url={firstAssigned ? itemPhotos[firstAssigned] : undefined} category={item.category} size={44} />
              )}
              <View style={styles.flexOne}>
                <Text style={[styles.rowTitle, value.isChecked && styles.rowTitleDone]}>{item.title || item.category}</Text>
                <Text style={styles.rowMeta}>
                  {item.priority === "REQUIRED" ? "Bắt buộc" : item.status === "ESSENTIAL" ? "Nên mang" : "Tùy chọn"} ·{" "}
                  {item.status === "ESSENTIAL" ? "" : `SL ${item.quantity} · `}
                  {COVERAGE_LABELS[item.status] ?? item.status}
                  {item.remainingQuantity > 0 ? ` · thiếu ${item.remainingQuantity}` : ""}
                </Text>
                {item.reason ? <Text style={styles.rowReason}>{item.reason}</Text> : null}
                {item.assignedItemIds?.length ? (
                  <Text style={styles.rowAssigned} numberOfLines={1}>
                    {item.assignedItemIds.map((id) => itemNames[id] ?? "Món không còn trong Tủ đồ").join(", ")}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.check, value.isChecked && styles.checkDone]}>
                {value.isChecked ? (
                  <PopIn>
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  </PopIn>
                ) : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOpenNote((current) => (current === item.requirementId ? null : item.requirementId))}>
              <Text style={styles.noteToggle}>{value.note ? `Ghi chú: ${value.note}` : "+ Thêm ghi chú"}</Text>
            </TouchableOpacity>
            {openNote === item.requirementId ? (
              <TextInput
                value={value.note ?? ""}
                maxLength={500}
                placeholder="Ghi chú khi chuẩn bị (không bắt buộc)"
                placeholderTextColor={Colors.onSurfaceMuted}
                onChangeText={(text) => setDraft((old) => old.map((entry, i) => (i === index ? { ...entry, note: text } : entry)))}
                style={styles.noteInput}
              />
            ) : null}
          </View>
        );
      })}

      <TouchableOpacity style={[styles.save, (busy || stale || !dirty) && styles.disabled]} disabled={busy || stale || !dirty} onPress={() => void save()}>
        {busy ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name="save-outline" size={16} color="#ffffff" />}
        <Text style={styles.saveText}>{dirty ? "Lưu tiến độ đóng gói" : "Đã lưu"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  disabled: { opacity: 0.5 },
  wrap: { gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: Trek.ink, fontSize: 15, fontWeight: "800" },
  hint: { marginTop: 2, color: Trek.muted, fontSize: 11, lineHeight: 16 },
  count: { marginTop: 4, color: Trek.trail, fontSize: 12, fontWeight: "800" },
  warn: { padding: 10, borderRadius: Radius.md, backgroundColor: Trek.amberBg, color: Trek.amberInk, fontSize: 12, lineHeight: 17 },
  error: { color: Colors.error, fontSize: 12 },
  notice: { color: Trek.trail, fontSize: 12, fontWeight: "700" },
  row: { padding: 10, gap: 6, borderRadius: Radius.md, borderWidth: 1, borderColor: Trek.line, backgroundColor: "#ffffff" },
  rowDone: { borderColor: "#cfe5d4", backgroundColor: "#f5faf4" },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowTitle: { color: Colors.onSurface, fontSize: 13, fontWeight: "700" },
  rowTitleDone: { color: Trek.trail },
  rowMeta: { marginTop: 2, color: Trek.muted, fontSize: 11 },
  rowReason: { marginTop: 2, color: "#55625a", fontSize: 11, lineHeight: 15 },
  essentialIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#f4ece0" },
  rowAssigned: { marginTop: 2, color: Trek.trail, fontSize: 11 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: "#c9d6cc", alignItems: "center", justifyContent: "center" },
  checkDone: { borderColor: Trek.trail, backgroundColor: Trek.trail },
  noteToggle: { marginLeft: 54, color: "#6b8875", fontSize: 11, fontWeight: "600" },
  noteInput: {
    marginLeft: 54,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    color: Colors.onSurface,
    fontSize: 12,
  },
  save: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, backgroundColor: Trek.trail },
  saveText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
});
