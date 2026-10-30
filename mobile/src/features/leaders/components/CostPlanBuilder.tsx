import { Colors, Radius, Shadows } from "@/constants/theme";
import {
  STANDARD_COST_TEMPLATE,
  saveTripCostPlan,
  type CostBasis,
  type CostCategory,
  type CostItem,
  type CostKind,
} from "@/features/leaders/services/leader-pricing.api";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface CostPlanBuilderProps {
  tripId: string;
  expectedVersion: number;
  accessToken: string;
  targetPax: number;
  items: CostItem[];
  onChangeItems: (newItems: CostItem[]) => void;
  onSavedSuccess?: (newVersion: number) => void;
}

const CATEGORY_ICONS: Record<CostCategory, { icon: any; color: string; label: string; emoji: string }> = {
  TRANSPORT: { icon: "bus-outline", color: "#0369a1", label: "Di chuyển", emoji: "🚌" },
  FOOD: { icon: "restaurant-outline", color: "#b45309", label: "Ẩm thực", emoji: "🍱" },
  SAFETY: { icon: "shield-checkmark-outline", color: "#15803d", label: "An toàn & Bảo hiểm", emoji: "🛡️" },
  STAFF: { icon: "people-outline", color: "#6b21a8", label: "Porter & Dẫn đường", emoji: "🎒" },
  ACCOMMODATION: { icon: "bed-outline", color: "#4338ca", label: "Lán trại & Nghỉ đêm", emoji: "⛺" },
  PERMIT: { icon: "ticket-outline", color: "#c2410c", label: "Giấy phép VQG", emoji: "🎫" },
  EQUIPMENT: { icon: "cube-outline", color: "#0f766e", label: "Thiết bị dùng chung", emoji: "🧭" },
  OTHER: { icon: "ellipsis-horizontal-circle-outline", color: "#475569", label: "Khoản chi khác", emoji: "📦" },
};

const KIND_LABELS: Record<CostKind, string> = {
  FIXED: "Cố định / đoàn",
  VARIABLE: "Biến phí / khách",
  STEP: "Nhảy bậc / chuyến",
};

export function CostPlanBuilder({
  tripId,
  expectedVersion,
  accessToken,
  targetPax,
  items,
  onChangeItems,
  onSavedSuccess,
}: CostPlanBuilderProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New item form state
  const [newCategory, setNewCategory] = useState<CostCategory>("TRANSPORT");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<CostKind>("VARIABLE");
  const [newBasis, setNewBasis] = useState<CostBasis>("PER_PERSON");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newCapacity, setNewCapacity] = useState("15");
  const [newNote, setNewNote] = useState("");

  const handleApplyStandardTemplate = () => {
    Alert.alert(
      "Áp dụng bộ chi phí chuẩn",
      "Hệ thống sẽ nạp 4 khoản chi phí cơ sở VFRS (Xe 16 chỗ, Suất ăn dã ngoại, Vé VQG & Bảo hiểm, Phụ cấp Porter). Bạn có muốn áp dụng không?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Áp dụng ngay",
          onPress: () => {
            onChangeItems([...STANDARD_COST_TEMPLATE]);
            setSaveSuccess(false);
          },
        },
      ],
    );
  };

  const handleToggleItem = (index: number) => {
    const updated = items.map((it, idx) =>
      idx === index ? { ...it, isEnabled: !it.isEnabled } : it,
    );
    onChangeItems(updated);
    setSaveSuccess(false);
  };

  const handleDeleteItem = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    onChangeItems(updated);
    setSaveSuccess(false);
  };

  const handleSaveCostPlan = async () => {
    if (!tripId || !accessToken) return;
    setIsSaving(true);
    try {
      const res = await saveTripCostPlan(
        tripId,
        {
          expectedVersion,
          currency: "VND",
          targetPax: Math.max(3, targetPax || 10),
          targetMarginBps: 2000, // 20%
          contingencyBps: 500, // 5%
          items,
        },
        accessToken,
      );
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      if (onSavedSuccess) {
        onSavedSuccess((res as any).tripVersion || (res as any).version || expectedVersion + 1);
      }
    } catch (err: any) {
      setIsSaving(false);
      Alert.alert("Lỗi lưu chi phí", err?.message || "Không thể lưu bảng dự toán chi phí.");
    }
  };

  const handleAddItem = () => {
    if (!newName.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên khoản chi phí.");
      return;
    }
    const price = parseInt(newUnitPrice.replace(/[^0-9]/g, ""), 10) || 0;
    if (price <= 0) {
      Alert.alert("Thiếu đơn giá", "Vui lòng nhập đơn giá hợp lệ.");
      return;
    }

    const newItem: CostItem = {
      category: newCategory,
      name: newName.trim(),
      kind: newKind,
      basis: newBasis,
      unitPrice: price,
      quantity: 1,
      durationUnits: 1,
      capacityPerUnit: newKind === "STEP" ? parseInt(newCapacity, 10) || 15 : undefined,
      includedInPrice: true,
      isEnabled: true,
      sourceNote: newNote.trim() || undefined,
      sortOrder: items.length + 1,
    };

    onChangeItems([...items, newItem]);
    setShowAddModal(false);
    // Reset form
    setNewName("");
    setNewUnitPrice("");
    setNewNote("");
    setSaveSuccess(false);
  };

  // Calculations for summary card
  const totalFixedCost = items
    .filter((it) => it.isEnabled && (it.kind === "FIXED" || it.kind === "STEP"))
    .reduce((sum, it) => {
      const units = it.kind === "STEP" ? Math.ceil(targetPax / (it.capacityPerUnit || 15)) : 1;
      return sum + (it.unitPrice || 0) * units;
    }, 0);

  const totalVariableCostPerPax = items
    .filter((it) => it.isEnabled && it.kind === "VARIABLE")
    .reduce((sum, it) => sum + (it.unitPrice || 0), 0);

  return (
    <View style={styles.cardContainer}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="receipt-outline" size={20} color="#163300" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>BẢNG KÊ CHI PHÍ THỰC TẾ (COST PLAN)</Text>
            <Text style={styles.headerSubtitle}>
              Liệt kê minh bạch chi phí vận hành theo định dạng chuẩn TG-PTR-PRICING-01
            </Text>
          </View>
        </View>
      </View>

      {/* Add Item Button */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.addItemBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color="#0e0f0c" />
          <Text style={styles.addItemBtnText}>Thêm khoản chi</Text>
        </TouchableOpacity>
      </View>

      {/* Items List */}
      {items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="cube-outline" size={32} color="#868685" />
          <Text style={styles.emptyText}>Chưa có dòng chi phí nào trong bảng dự toán.</Text>
          <Text style={styles.emptySubText}>
            Nhấn &ldquo;Thêm khoản chi&rdquo; ở trên để bắt đầu lập danh sách chi phí.
          </Text>
        </View>
      ) : (
        <View style={styles.itemsList}>
          {items.map((item, idx) => {
            const cat = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.OTHER;
            return (
              <View
                key={idx}
                style={[
                  styles.itemCard,
                  !item.isEnabled && styles.itemCardDisabled,
                ]}
              >
                <TouchableOpacity
                  style={styles.checkboxTouch}
                  onPress={() => handleToggleItem(idx)}
                >
                  <Ionicons
                    name={item.isEnabled ? "checkbox" : "square-outline"}
                    size={20}
                    color={item.isEnabled ? "#2ead4b" : "#868685"}
                  />
                </TouchableOpacity>

                <View style={styles.itemMain}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemEmoji}>{cat.emoji}</Text>
                    <Text
                      style={[
                        styles.itemName,
                        !item.isEnabled && styles.textDisabled,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>

                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.kindBadge,
                        item.kind === "FIXED"
                          ? styles.badgeFixed
                          : item.kind === "VARIABLE"
                          ? styles.badgeVariable
                          : styles.badgeStep,
                      ]}
                    >
                      <Text style={styles.kindBadgeText}>{KIND_LABELS[item.kind]}</Text>
                    </View>

                    {item.sourceNote ? (
                      <Text style={styles.itemNote} numberOfLines={1}>
                        • {item.sourceNote}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.itemPriceCol}>
                  <Text style={styles.itemPrice}>
                    {Number(item.unitPrice).toLocaleString("vi-VN")} đ
                  </Text>
                  <Text style={styles.itemPriceUnit}>
                    {item.kind === "VARIABLE" ? "/ khách" : "/ khoản"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteItem(idx)}
                >
                  <Ionicons name="trash-outline" size={17} color="#d03238" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Subtotal summary card */}
      <View style={styles.summaryBox}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tổng chi phí cố định (Xe + Porter):</Text>
          <Text style={styles.summaryVal}>
            {totalFixedCost.toLocaleString("vi-VN")} đ
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tổng biến phí theo khách (Ăn + Vé + BH):</Text>
          <Text style={styles.summaryVal}>
            {totalVariableCostPerPax.toLocaleString("vi-VN")} đ / khách
          </Text>
        </View>
      </View>

      {/* Save Button */}
      <View style={styles.saveContainer}>
        {saveSuccess && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#054d28" />
            <Text style={styles.successBannerText}>
              Đã lưu bảng dự toán chi phí thành công lên máy chủ!
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.btnDisabled]}
          onPress={handleSaveCostPlan}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#0e0f0c" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={17} color="#0e0f0c" />
              <Text style={styles.saveBtnText}>LƯU BẢNG DỰ TOÁN CHI PHÍ</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal: Thêm khoản chi */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm khoản chi mới</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={22} color="#0e0f0c" />
              </TouchableOpacity>
            </View>

            {/* Category selector */}
            <Text style={styles.inputLabel}>Danh mục chi phí *</Text>
            <View style={styles.catGrid}>
              {(Object.keys(CATEGORY_ICONS) as CostCategory[]).slice(0, 4).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.catChip,
                    newCategory === c && styles.catChipActive,
                  ]}
                  onPress={() => setNewCategory(c)}
                >
                  <Text style={styles.catChipText}>
                    {CATEGORY_ICONS[c].emoji} {CATEGORY_ICONS[c].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Name */}
            <Text style={styles.inputLabel}>Tên khoản chi *</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="VD: Thuê lều trại chống mưa"
              placeholderTextColor="#868685"
            />

            {/* Kind */}
            <Text style={styles.inputLabel}>Hình thức tính chi phí *</Text>
            <View style={styles.kindRow}>
              {(["VARIABLE", "FIXED", "STEP"] as CostKind[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.kindChip, newKind === k && styles.kindChipActive]}
                  onPress={() => {
                    setNewKind(k);
                    if (k === "FIXED") setNewBasis("PER_TRIP");
                    else if (k === "VARIABLE") setNewBasis("PER_PERSON");
                    else setNewBasis("PER_CAPACITY_UNIT");
                  }}
                >
                  <Text
                    style={[
                      styles.kindChipText,
                      newKind === k && styles.kindChipTextActive,
                    ]}
                  >
                    {KIND_LABELS[k]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Unit Price */}
            <Text style={styles.inputLabel}>Đơn giá (VNĐ) *</Text>
            <TextInput
              style={styles.modalInput}
              value={newUnitPrice}
              onChangeText={(v) => setNewUnitPrice(v.replace(/[^0-9]/g, ""))}
              placeholder="150000"
              placeholderTextColor="#868685"
              keyboardType="numeric"
            />

            {/* Note */}
            <Text style={styles.inputLabel}>Ghi chú nguồn chi (Tùy chọn)</Text>
            <TextInput
              style={styles.modalInput}
              value={newNote}
              onChangeText={setNewNote}
              placeholder="VD: Thuê từ đối tác địa phương có hóa đơn"
              placeholderTextColor="#868685"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleAddItem}
              >
                <Text style={styles.modalSubmitText}>Thêm vào bảng kê</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e8ebe6",
    marginBottom: 16,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e2f6d5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0e0f0c",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#454745",
    marginTop: 2,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  templateBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#e2f6d5",
    borderWidth: 1,
    borderColor: "#c5edab",
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  templateBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#054d28",
  },
  addItemBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#e8ebe6",
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  addItemBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0e0f0c",
  },
  emptyBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fbf9f3",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "#e8ebe6",
    borderStyle: "dashed",
    marginVertical: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0e0f0c",
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 11,
    color: "#868685",
    textAlign: "center",
    marginTop: 4,
    maxWidth: 260,
  },
  itemsList: {
    gap: 8,
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#fbf9f3",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#e8ebe6",
    gap: 8,
  },
  itemCardDisabled: {
    opacity: 0.5,
    backgroundColor: "#f5f4ee",
  },
  checkboxTouch: {
    padding: 2,
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemEmoji: {
    fontSize: 14,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0e0f0c",
    flex: 1,
  },
  textDisabled: {
    textDecorationLine: "line-through",
    color: "#868685",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  kindBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeFixed: {
    backgroundColor: "#f1f5f9",
  },
  badgeVariable: {
    backgroundColor: "#e2f6d5",
  },
  badgeStep: {
    backgroundColor: "#fef3c7",
  },
  kindBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#163300",
  },
  itemNote: {
    fontSize: 10,
    color: "#868685",
    flex: 1,
  },
  itemPriceCol: {
    alignItems: "flex-end",
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#163300",
  },
  itemPriceUnit: {
    fontSize: 9,
    color: "#868685",
  },
  deleteBtn: {
    padding: 6,
  },
  summaryBox: {
    backgroundColor: "#f5f4ee",
    borderRadius: Radius.md,
    padding: 12,
    gap: 6,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#454745",
    fontWeight: "600",
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  saveContainer: {
    marginTop: 4,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e2f6d5",
    padding: 8,
    borderRadius: Radius.sm,
    marginBottom: 8,
  },
  successBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#054d28",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#9fe870",
    paddingVertical: 12,
    borderRadius: Radius.xl,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0e0f0c",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#454745",
    marginTop: 10,
    marginBottom: 4,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: "#f5f4ee",
    borderWidth: 1,
    borderColor: "#e8ebe6",
  },
  catChipActive: {
    backgroundColor: "#e2f6d5",
    borderColor: "#9fe870",
  },
  catChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0e0f0c",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e8ebe6",
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0e0f0c",
    backgroundColor: "#fbf9f3",
  },
  kindRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  kindChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: "#f5f4ee",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e8ebe6",
  },
  kindChipActive: {
    backgroundColor: "#163300",
    borderColor: "#163300",
  },
  kindChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#454745",
  },
  kindChipTextActive: {
    color: "#9fe870",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.xl,
    backgroundColor: "#f5f4ee",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#454745",
  },
  modalSubmitBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: Radius.xl,
    backgroundColor: "#9fe870",
    alignItems: "center",
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0e0f0c",
  },
});
