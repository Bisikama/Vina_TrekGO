import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { gearApi } from "@/features/gear/api";
import type {
  GearCategory,
  GearCondition,
  UserGearItem,
} from "@/features/gear/types";

const CATEGORIES: { value: GearCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "JACKET", label: "Áo khoác", icon: "shirt-outline" },
  { value: "FOOTWEAR", label: "Giày", icon: "footsteps-outline" },
  { value: "PANTS", label: "Quần", icon: "body-outline" },
  { value: "BACKPACK", label: "Balo", icon: "bag-outline" },
  { value: "SLEEPING_BAG", label: "Túi ngủ", icon: "bed-outline" },
  { value: "TENT", label: "Lều", icon: "triangle-outline" },
  { value: "TREKKING_POLE", label: "Gậy trekking", icon: "git-branch-outline" },
  { value: "RAIN_GEAR", label: "Đồ đi mưa", icon: "rainy-outline" },
];

const CONDITIONS: { value: GearCondition; label: string }[] = [
  { value: "NEW", label: "Mới" },
  { value: "GOOD", label: "Tốt" },
  { value: "WORN", label: "Đã qua sử dụng" },
  { value: "POOR", label: "Cần thay thế" },
];

export default function WardrobeScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [items, setItems] = useState<UserGearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [formVisible, setFormVisible] = useState(false);

  const loadItems = useCallback(async (isRefresh = false) => {
    if (!accessToken) {
      setError("Phiên đăng nhập không hợp lệ.");
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(undefined);

    try {
      const result = await gearApi.listMyGear(accessToken);
      setItems(result.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không tải được tủ đồ của bạn.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function deleteItem(item: UserGearItem) {
    if (!accessToken) return;

    Alert.alert(
      "Xóa khỏi tủ đồ?",
      `“${item.name}” sẽ không còn được dùng khi hệ thống đánh giá hành trang.`,
      [
        { text: "Giữ lại", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await gearApi.deleteMyGear(item.id, accessToken);
                setItems((current) => current.filter((entry) => entry.id !== item.id));
              } catch (requestError) {
                Alert.alert(
                  "Chưa xóa được",
                  requestError instanceof Error ? requestError.message : "Vui lòng thử lại.",
                );
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CHUẨN BỊ ĐỒ</Text>
          <Text style={styles.title}>Tủ đồ của bạn</Text>
        </View>
        <TouchableOpacity style={styles.addHeaderButton} onPress={() => setFormVisible(true)}>
          <Ionicons name="add" size={22} color={Colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadItems(true)}
            tintColor={Colors.primaryDark}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="shield-checkmark-outline" size={25} color={Colors.primaryDark} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.introTitle}>Đồ cá nhân dùng cho mọi chuyến</Text>
            <Text style={styles.introDescription}>
              TrekGo dùng danh sách này để kiểm tra bạn đã có gì và chỉ gợi ý thuê phần còn thiếu.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={Colors.primaryDark} />
            <Text style={styles.stateDescription}>Đang mở tủ đồ...</Text>
          </View>
        ) : error ? (
          <StateCard
            icon="cloud-offline-outline"
            title="Chưa kết nối được tủ đồ"
            description={error}
            actionLabel="Thử lại"
            onAction={() => void loadItems()}
          />
        ) : items.length === 0 ? (
          <StateCard
            icon="bag-add-outline"
            title="Tủ đồ đang trống"
            description="Thêm món đồ trekking đầu tiên để hệ thống đánh giá hành trang chính xác hơn."
            actionLabel="Thêm đồ"
            onAction={() => setFormVisible(true)}
          />
        ) : (
          <View style={styles.list}>
            <View style={styles.listHeadingRow}>
              <Text style={styles.listHeading}>{items.length} món đồ</Text>
              <Text style={styles.listHint}>Kéo xuống để cập nhật</Text>
            </View>
            {items.map((item) => {
              const category = categoryInfo(item.category);
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemIcon}>
                    <Ionicons name={category.icon} size={24} color={Colors.primaryDark} />
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.itemCategory}>{category.label}</Text>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {[item.brand, conditionLabel(item.condition)].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel={`Xóa ${item.name}`}
                    style={styles.deleteButton}
                    onPress={() => void deleteItem(item)}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AddGearModal
        visible={formVisible}
        accessToken={accessToken}
        onClose={() => setFormVisible(false)}
        onCreated={(item) => {
          setItems((current) => [item, ...current]);
          setFormVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

function AddGearModal({
  visible,
  accessToken,
  onClose,
  onCreated,
}: {
  visible: boolean;
  accessToken?: string | null;
  onClose: () => void;
  onCreated: (item: UserGearItem) => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<GearCategory>("BACKPACK");
  const [condition, setCondition] = useState<GearCondition>("GOOD");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert("Thiếu tên đồ", "Nhập tên món đồ trước khi lưu.");
      return;
    }
    if (!accessToken) {
      Alert.alert("Phiên đăng nhập đã hết hạn", "Đăng nhập lại để cập nhật tủ đồ.");
      return;
    }

    setSaving(true);
    try {
      const item = await gearApi.createMyGear(
        {
          name: cleanName,
          brand: brand.trim() || undefined,
          category,
          condition,
        },
        accessToken,
      );
      setName("");
      setBrand("");
      setCategory("BACKPACK");
      setCondition("GOOD");
      onCreated(item);
    } catch (requestError) {
      Alert.alert(
        "Chưa lưu được",
        requestError instanceof Error ? requestError.message : "Vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <View style={styles.modalTitleRow}>
            <View>
              <Text style={styles.eyebrow}>TỦ ĐỒ CÁ NHÂN</Text>
              <Text style={styles.modalTitle}>Thêm món đồ</Text>
            </View>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Ionicons name="close" size={21} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Tên món đồ</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ví dụ: Balo Naturehike 45L"
            placeholderTextColor={Colors.onSurfaceMuted}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Thương hiệu (không bắt buộc)</Text>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder="Naturehike, The North Face..."
            placeholderTextColor={Colors.onSurfaceMuted}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Loại đồ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map((entry) => (
              <ChoiceChip
                key={entry.value}
                label={entry.label}
                selected={category === entry.value}
                onPress={() => setCategory(entry.value)}
              />
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Tình trạng</Text>
          <View style={styles.wrapRow}>
            {CONDITIONS.map((entry) => (
              <ChoiceChip
                key={entry.value}
                label={entry.label}
                selected={condition === entry.value}
                onPress={() => setCondition(entry.value)}
              />
            ))}
          </View>

          <TouchableOpacity disabled={saving} style={styles.saveButton} onPress={() => void submit()}>
            {saving ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark" size={19} color={Colors.onPrimary} />
                <Text style={styles.saveButtonText}>Lưu vào tủ đồ</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StateCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={34} color={Colors.primaryDark} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      <TouchableOpacity style={styles.stateButton} onPress={onAction}>
        <Text style={styles.stateButtonText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function categoryInfo(category: GearCategory) {
  return CATEGORIES.find((entry) => entry.value === category) ?? CATEGORIES[0];
}

function conditionLabel(condition: GearCondition) {
  return CONDITIONS.find((entry) => entry.value === condition)?.label ?? condition;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1 },
  headerButton: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLowest, alignItems: "center", justifyContent: "center" },
  addHeaderButton: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.primaryDark, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  title: { marginTop: 2, color: Colors.onSurface, fontSize: 22, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 48 },
  introCard: { padding: 15, flexDirection: "row", gap: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primaryNeutral, backgroundColor: Colors.primaryPale },
  introIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLowest },
  introTitle: { color: Colors.onSurface, fontSize: 14, fontWeight: "700" },
  introDescription: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18 },
  centerState: { paddingVertical: 70, alignItems: "center", gap: 12 },
  list: { marginTop: 20, gap: 11 },
  listHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  listHeading: { color: Colors.onSurface, fontSize: 16, fontWeight: "800" },
  listHint: { color: Colors.onSurfaceMuted, fontSize: 10 },
  itemCard: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  itemIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  itemCategory: { color: Colors.primaryDark, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  itemName: { marginTop: 3, color: Colors.onSurface, fontSize: 14, fontWeight: "700" },
  itemMeta: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 11 },
  deleteButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.errorContainer },
  stateCard: { marginTop: 24, padding: 24, alignItems: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  stateIcon: { width: 66, height: 66, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  stateTitle: { marginTop: 15, color: Colors.onSurface, fontSize: 17, fontWeight: "800" },
  stateDescription: { marginTop: 7, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, textAlign: "center" },
  stateButton: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  stateButtonText: { color: Colors.onPrimary, fontSize: 12, fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(14,15,12,0.45)" },
  modalCard: { maxHeight: "90%", padding: 20, paddingBottom: 30, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, backgroundColor: Colors.surface },
  modalHandle: { width: 42, height: 4, alignSelf: "center", marginBottom: 18, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHighest },
  modalTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 20, fontWeight: "800" },
  fieldLabel: { marginTop: 18, marginBottom: 7, color: Colors.onSurface, fontSize: 12, fontWeight: "700" },
  input: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: Radius.md, color: Colors.onSurface, backgroundColor: Colors.surfaceContainerLowest },
  chipRow: { gap: 8, paddingRight: 20 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer },
  chipSelected: { backgroundColor: Colors.inkDeep },
  chipText: { color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: "600" },
  chipTextSelected: { color: Colors.onPrimaryDark },
  saveButton: { minHeight: 50, marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  saveButtonText: { color: Colors.onPrimary, fontSize: 13, fontWeight: "800" },
});
