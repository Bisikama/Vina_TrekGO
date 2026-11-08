import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { gearAdvisorApi, type GearPlan, type PlanGuidance } from "@/features/gear/advisor-api";
import { gearApi } from "@/features/gear/api";
import {
  ATTRIBUTE_SOURCE_LABELS,
  categoryInfo,
  conditionLabel,
  DISPLAY_STATUS_LABELS,
  formatGearAttribute,
  gearAttributes,
  loadGearAttributeSchema,
  GEAR_CATEGORIES,
  GEAR_CONDITIONS,
  sourceLabel,
} from "@/features/gear/gear-meta";
import type {
  CreateUserGearInput,
  GearCapabilities,
  GearCapabilityStatus,
  GearCatalogEntry,
  GearCategory,
  GearCondition,
  GearExtractionDraft,
  UserGearItem,
} from "@/features/gear/types";
import { BackpackMeter } from "@/features/gear/BackpackMeter";
import {
  CATEGORY_TONE,
  CompassLoader,
  CompletenessBar,
  FadeInUp,
  GearThumb,
  MountainHero,
  Trek,
  specCompleteness,
} from "@/features/gear/TrekKit";
import { ApiError } from "@/lib/api-client";

type EditorContext = { item?: UserGearItem; draft?: GearExtractionDraft; photoRef?: string; photoPreview?: string };
type WardrobeFilter = GearCategory | "ALL" | "INCOMPLETE";

const isIncomplete = (item: UserGearItem) => {
  const { known, total } = specCompleteness(item);
  return known < total;
};

const MAX_ITEMS = 50;

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** 409 trùng món: hỏi người dùng có muốn vẫn lưu không. */
function isDuplicate(error: unknown) {
  return error instanceof ApiError && error.code === "GEAR_ITEM_POSSIBLE_DUPLICATE";
}

function askSaveDuplicate(error: unknown, onConfirm: () => void) {
  const details = (error instanceof ApiError ? error.details : undefined) as
    | { similarItem?: { name?: string }; matchedFields?: string[] }
    | undefined;
  const similar = details?.similarItem?.name ?? "một món đã lưu";
  const matched = Array.isArray(details?.matchedFields) ? details.matchedFields.join(", ") : "các thông số kỹ thuật";
  Alert.alert(
    "Tủ đã có món tương tự",
    `Giống “${similar}” ở: ${matched}. Đây chỉ là so sánh thông số, không khẳng định là cùng một món.`,
    [
      { text: "Quay lại", style: "cancel" },
      { text: "Vẫn lưu thêm", onPress: onConfirm },
    ],
  );
}

export default function WardrobeScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [items, setItems] = useState<UserGearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [filter, setFilter] = useState<WardrobeFilter>("ALL");
  const [capabilities, setCapabilities] = useState<GearCapabilities | null>(null);
  const [editor, setEditor] = useState<EditorContext | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState<"IMAGE" | "LINK" | null>(null);
  const aiLock = useRef(false);
  const [, setSchemaTick] = useState(0);

  // Bộ thông số lấy từ backend (GET /gear/attribute-schema); lỗi thì giữ bộ dự phòng.
  useEffect(() => {
    let active = true;
    loadGearAttributeSchema()
      .then((updated) => {
        if (updated && active) setSchemaTick((tick) => tick + 1);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
      setError(errorText(requestError, "Không tải được tủ đồ của bạn."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => void loadItems(), 0);
    return () => clearTimeout(timer);
  }, [loadItems]);

  useEffect(() => {
    if (!accessToken) return;
    // Chỉ để hiển thị trạng thái; thiếu dữ liệu này thì các nút vẫn dùng được.
    gearApi.getCapabilities(accessToken).then(setCapabilities).catch(() => undefined);
  }, [accessToken]);

  const visibleItems = useMemo(
    () =>
      filter === "ALL"
        ? items
        : filter === "INCOMPLETE"
          ? items.filter(isIncomplete)
          : items.filter((item) => item.category === filter),
    [filter, items],
  );
  const incompleteCount = useMemo(() => items.filter(isIncomplete).length, [items]);

  function upsertItem(saved: UserGearItem) {
    setItems((current) =>
      current.some((item) => item.id === saved.id)
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...current],
    );
  }

  async function analyzeImage() {
    if (!accessToken || aiLock.current) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần quyền thư viện ảnh", "Hãy cho phép truy cập ảnh để chọn ảnh tem/mác của món đồ.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: false });
    if (picked.canceled || !picked.assets[0]) return;
    aiLock.current = true;
    setAiBusy("IMAGE");
    setError(undefined);
    setNotice(undefined);
    try {
      const uploadId = await gearApi.uploadGearPhoto(picked.assets[0], accessToken);
      const draft = await gearApi.createExtraction({ source: "IMAGE", uploadId }, accessToken);
      if (draft.status !== "READY") throw new Error("AI chưa tạo được bản nháp. Bạn vẫn có thể nhập tay.");
      setEditor({ draft, photoRef: uploadId, photoPreview: picked.assets[0].uri });
    } catch (requestError) {
      if (requestError instanceof ApiError && (requestError.status === 409 || requestError.code === "GEAR_CONCURRENCY_CONFLICT")) {
        setNotice("Ảnh này đang được AI phân tích. Chờ tác vụ hiện tại xong rồi thử lại.");
      } else {
        setError(errorText(requestError, "Không đọc được ảnh bằng AI."));
      }
    } finally {
      aiLock.current = false;
      setAiBusy(null);
    }
  }

  async function analyzeLink(url: string) {
    if (!accessToken || aiLock.current) return;
    aiLock.current = true;
    setAiBusy("LINK");
    setError(undefined);
    setNotice(undefined);
    try {
      const draft = await gearApi.createExtraction({ source: "LINK", url }, accessToken);
      setLinkOpen(false);
      setEditor({ draft });
    } catch (requestError) {
      setLinkOpen(false);
      if (requestError instanceof ApiError && (requestError.status === 409 || requestError.code === "GEAR_CONCURRENCY_CONFLICT")) {
        setNotice("Link này đang được AI phân tích. Chờ tác vụ hiện tại xong rồi thử lại.");
      } else {
        setError(errorText(requestError, "Không đọc được link sản phẩm."));
      }
    } finally {
      aiLock.current = false;
      setAiBusy(null);
    }
  }

  function deleteItem(item: UserGearItem) {
    if (!accessToken) return;
    Alert.alert("Xóa khỏi tủ đồ?", `“${item.name}” sẽ bị xóa hẳn. Lịch sử kiểm tra theo chuyến vẫn được giữ.`, [
      { text: "Giữ lại", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await gearApi.deleteMyGear(item.id, accessToken);
              setItems((current) => current.filter((entry) => entry.id !== item.id));
              setEditor(null);
            } catch (requestError) {
              Alert.alert("Chưa xóa được", errorText(requestError, "Vui lòng thử lại."));
            }
          })();
        },
      },
    ]);
  }

  const full = items.length >= MAX_ITEMS;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} accessibilityLabel="Quay lại">
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CHUẨN BỊ ĐỒ</Text>
          <Text style={styles.title}>Tủ đồ</Text>
        </View>
        <Text style={styles.counter}>{items.length}/{MAX_ITEMS}</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadItems(true)} tintColor={Trek.trail} />}
        contentContainerStyle={styles.content}
      >
        <MountainHero
          eyebrow="Tủ đồ của bạn"
          icon="file-tray-full-outline"
          title="Trạm trang bị"
          highlight="trước mỗi cung đường."
          description="Lưu đồ bạn đang có kèm thông số để TrekGo kiểm tra theo thời tiết và độ khó từng chuyến."
        >
          <TouchableOpacity style={styles.heroAction} onPress={() => router.push("/gear-advisor" as Href)}>
            <Ionicons name="compass" size={16} color="#3b2302" />
            <Text style={styles.heroActionText}>Kiểm tra đồ cho chuyến đi</Text>
            <Ionicons name="arrow-forward" size={15} color="#3b2302" />
          </TouchableOpacity>
        </MountainHero>

        {!loading && items.length ? (
          <WardrobeOverview items={items} incomplete={incompleteCount} onShowIncomplete={() => setFilter("INCOMPLETE")} />
        ) : null}

        <Text style={styles.sectionLabel}>THÊM ĐỒ VÀO TỦ</Text>
        <View style={styles.actionGrid}>
          <ActionButton icon="sparkles-outline" label={aiBusy === "IMAGE" ? "Đang đọc ảnh..." : "Chụp nhãn"} disabled={full || Boolean(aiBusy)} onPress={() => void analyzeImage()} />
          <ActionButton icon="link-outline" label={aiBusy === "LINK" ? "Đang đọc link..." : "Từ đường dẫn"} disabled={full || Boolean(aiBusy)} onPress={() => setLinkOpen(true)} />
          <ActionButton icon="ribbon-outline" label="Chọn có sẵn" disabled={full || Boolean(aiBusy)} onPress={() => setCatalogOpen(true)} />
          <ActionButton icon="add-circle-outline" label="Tự nhập" primary disabled={full} onPress={() => setEditor({})} />
        </View>
        <Text style={styles.quotaNote}>Đọc ảnh và đường dẫn tự động: tối đa 20 lượt/ngày · tủ tối đa {MAX_ITEMS} món</Text>

        {aiBusy ? (
          <View style={styles.progressCard}>
            <CompassLoader label={aiBusy === "IMAGE" ? "AI đang đọc ảnh tem/mác, có thể mất một lúc..." : "AI đang đọc trang sản phẩm, có thể mất một lúc..."} />
          </View>
        ) : null}
        {notice ? <Banner tone="warn" text={notice} onClose={() => setNotice(undefined)} /> : null}
        {error && !loading ? <Banner tone="error" text={error} onClose={() => setError(undefined)} /> : null}

        <CapabilityPanel capabilities={capabilities} onOpenAdvisor={() => router.push("/gear-advisor" as Href)} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.filterRow}>
          <ChoiceChip label={`Tất cả ${items.length}`} selected={filter === "ALL"} onPress={() => setFilter("ALL")} />
          {incompleteCount ? (
            <ChoiceChip label={`Thiếu thông số ${incompleteCount}`} selected={filter === "INCOMPLETE"} warn onPress={() => setFilter("INCOMPLETE")} />
          ) : null}
          {GEAR_CATEGORIES.map((entry) => (
            <ChoiceChip
              key={entry.value}
              label={`${entry.label} ${items.filter((item) => item.category === entry.value).length}`}
              selected={filter === entry.value}
              onPress={() => setFilter(entry.value)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.centerState}>
            <CompassLoader label="Đang mở tủ đồ..." />
          </View>
        ) : visibleItems.length === 0 ? (
          <StateCard
            icon="bag-add-outline"
            title={items.length ? (filter === "INCOMPLETE" ? "Mọi món đã đủ thông số" : "Không có món thuộc loại này") : "Tủ đồ đang trống"}
            description={items.length ? "Chọn loại khác để xem." : "Thêm món đầu tiên bằng cách chụp nhãn, dán đường dẫn, chọn có sẵn hoặc tự nhập."}
            actionLabel={items.length ? "Xem tất cả" : "Tự nhập"}
            onAction={() => (items.length ? setFilter("ALL") : setEditor({}))}
          />
        ) : (
          <View style={styles.list}>
            {visibleItems.map((item, index) => (
              <FadeInUp key={item.id} delay={Math.min(index, 8) * 60}>
                <GearCard item={item} onPress={() => setEditor({ item })} />
              </FadeInUp>
            ))}
          </View>
        )}

        {accessToken ? <TripReviewSection accessToken={accessToken} items={items} /> : null}
      </ScrollView>

      {editor ? (
        <GearEditorModal
          context={editor}
          accessToken={accessToken}
          onClose={() => setEditor(null)}
          onDelete={editor.item ? () => deleteItem(editor.item as UserGearItem) : undefined}
          onSaved={(saved) => {
            upsertItem(saved);
            setEditor(null);
          }}
        />
      ) : null}
      <LinkModal visible={linkOpen} busy={aiBusy === "LINK"} onClose={() => !aiLock.current && setLinkOpen(false)} onSubmit={(url) => void analyzeLink(url)} />
      {catalogOpen && accessToken ? (
        <CatalogModal
          accessToken={accessToken}
          onClose={() => setCatalogOpen(false)}
          onAdded={(saved) => {
            upsertItem(saved);
            setCatalogOpen(false);
            setNotice(`Đã thêm “${saved.name}” từ danh mục đã duyệt.`);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const CORE_CATEGORIES: GearCategory[] = ["JACKET", "FOOTWEAR", "BACKPACK", "SLEEPING_BAG", "RAIN_GEAR"];

/** Tổng quan tủ: balo đầy theo số nhóm đồ chính đã có, số món thiếu thông số, số món theo loại. */
function WardrobeOverview({ items, incomplete, onShowIncomplete }: { items: UserGearItem[]; incomplete: number; onShowIncomplete: () => void }) {
  const coveredCore = CORE_CATEGORIES.filter((category) => items.some((item) => item.category === category)).length;
  const withPhoto = items.filter((item) => item.photoUrl).length;
  return (
    <FadeInUp style={styles.overview}>
      <View style={styles.overviewTop}>
        <BackpackMeter value={coveredCore} total={CORE_CATEGORIES.length} size={60} />
        <View style={styles.flexOne}>
          <Text style={styles.overviewTitle}>{coveredCore}/{CORE_CATEGORIES.length} nhóm đồ chính đã có</Text>
          <Text style={styles.hint}>Áo khoác, giày, balo, túi ngủ, đồ đi mưa là những nhóm hay được yêu cầu nhất.</Text>
          <View style={styles.overviewStats}>
            <Text style={styles.overviewStat}>{items.length} món</Text>
            <Text style={styles.overviewStat}>{withPhoto} có ảnh</Text>
            {incomplete ? (
              <TouchableOpacity onPress={onShowIncomplete}>
                <Text style={[styles.overviewStat, styles.overviewWarn]}>{incomplete} thiếu thông số ›</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.overviewStat, styles.overviewOk]}>Đủ thông số</Text>
            )}
          </View>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
        {GEAR_CATEGORIES.map((entry) => {
          const count = items.filter((item) => item.category === entry.value).length;
          const tone = CATEGORY_TONE[entry.value];
          return (
            <View key={entry.value} style={[styles.categoryTile, { backgroundColor: count ? tone.bg : "#f3f5f3" }]}>
              <Ionicons name={entry.icon} size={18} color={count ? tone.fg : "#a3ada6"} />
              <Text style={[styles.categoryCount, { color: count ? tone.fg : "#a3ada6" }]}>{count}</Text>
              <Text style={styles.categoryName} numberOfLines={1}>{entry.label}</Text>
            </View>
          );
        })}
      </ScrollView>
    </FadeInUp>
  );
}

function ActionButton({ icon, label, primary, disabled, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; primary?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.actionButton, primary && styles.actionButtonPrimary, disabled && styles.disabled]}>
      <Ionicons name={icon} size={18} color={primary ? Colors.onPrimary : Colors.primaryDark} />
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Banner({ tone, text, onClose }: { tone: "warn" | "error"; text: string; onClose: () => void }) {
  return (
    <View style={[styles.banner, tone === "error" ? styles.bannerError : styles.bannerWarn]}>
      <Text style={[styles.bannerText, tone === "error" && { color: Colors.error }]}>{text}</Text>
      <TouchableOpacity onPress={onClose}>
        <Ionicons name="close" size={16} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
}

/** Trạng thái tiện ích: là thông tin, KHÔNG phải nút. Mỗi dòng chỉ chỗ để dùng. */
function CapabilityPanel({ capabilities, onOpenAdvisor }: { capabilities: GearCapabilities | null; onOpenAdvisor: () => void }) {
  const [open, setOpen] = useState(false);
  const rows: { label: string; status?: GearCapabilityStatus; hint: string; onHint?: () => void }[] = [
    { label: "Đọc từ ảnh tem/mác", status: capabilities?.imageExtraction, hint: "Nút “Chụp nhãn” ở trên" },
    { label: "Đọc từ đường dẫn", status: capabilities?.linkExtraction, hint: "Nút “Từ đường dẫn” ở trên" },
    { label: "Tư vấn theo bộ quy tắc", status: capabilities?.ruleBasedAdvice, hint: "Dùng trong Kế hoạch đồ ›", onHint: onOpenAdvisor },
    { label: "Tư vấn bổ sung bằng AI", status: capabilities?.aiAdvice, hint: "Trong Kế hoạch đồ → phương án thuê ›", onHint: onOpenAdvisor },
  ];
  return (
    <View style={styles.panel}>
      <TouchableOpacity style={styles.panelHead} onPress={() => setOpen((value) => !value)}>
        <Text style={styles.panelTitle}>Mẹo thêm đồ nhanh và đúng thông số</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>
      {open ? (
        <View style={styles.panelBody}>
          {rows.map((row) => {
            const ready = Boolean(row.status?.enabled && row.status.configured);
            const stateLabel = !row.status ? "Đang kiểm tra" : ready ? "Đang bật" : !row.status.enabled ? "Đang tắt" : "Chưa cấu hình";
            const dotColor = !row.status ? Colors.onSurfaceMuted : ready ? "#2E9E5B" : "#C98A00";
            return (
              <View key={row.label} style={styles.capabilityRow}>
                <View style={styles.capabilityHead}>
                  <Text style={styles.capabilityLabel}>{row.label}</Text>
                  <View style={styles.capabilityState}>
                    <View style={[styles.dot, { backgroundColor: dotColor }]} />
                    <Text style={styles.capabilityStateText}>{stateLabel}</Text>
                  </View>
                </View>
                {row.status?.messageVi ? <Text style={styles.hint}>{row.status.messageVi}</Text> : null}
                <TouchableOpacity disabled={!row.onHint} onPress={row.onHint}>
                  <Text style={[styles.hint, row.onHint && styles.link]}>{row.hint}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <Text style={styles.hint}>
            Ảnh: chụp rõ tem/mác ghi thông số. Link: trang sản phẩm có bảng thông số. TrekGo tạo bản nháp để bạn kiểm tra trước khi lưu. Hết lượt AI vẫn nhận bản nháp để nhập tay.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function GearCard({ item, onPress }: { item: UserGearItem; onPress: () => void }) {
  const category = categoryInfo(item.category);
  const stats = gearAttributes(item.category)
    .filter(([key]) => item.attributes?.[key] !== null && item.attributes?.[key] !== undefined)
    .slice(0, 3);
  const completeness = specCompleteness(item);
  const tone = CATEGORY_TONE[item.category];
  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.itemBand, { backgroundColor: tone.fg }]} />
      <View style={styles.itemTop}>
        <View>
          <GearThumb url={item.photoUrl} category={item.category} size={72} radius={16} />
          {!item.photoUrl ? (
            <View style={styles.photoHint}>
              <Ionicons name="camera" size={11} color="#ffffff" />
            </View>
          ) : null}
        </View>
        <View style={styles.flexOne}>
          <Text style={[styles.itemCategory, { color: tone.fg }]}>{category.label.toUpperCase()} · {sourceLabel(item.source)}</Text>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemMeta}>{[item.brand, conditionLabel(item.condition)].filter(Boolean).join(" · ")}</Text>
          <View style={styles.itemBar}>
            <CompletenessBar known={completeness.known} total={completeness.total} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceMuted} />
      </View>
      {stats.length ? (
        <View style={styles.statRow}>
          {stats.map(([key, label, unit]) => (
            <View key={key} style={styles.stat}>
              <Text style={styles.statLabel}>{label}</Text>
              <Text style={styles.statValue}>{formatGearAttribute(item.attributes[key], unit)}</Text>
              {item.attributeProvenance?.[key]?.source ? (
                <Text style={styles.statSource}>{ATTRIBUTE_SOURCE_LABELS[item.attributeProvenance[key].source] ?? item.attributeProvenance[key].source}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.missingStats}>Chưa có thông số kỹ thuật · chạm để bổ sung</Text>
      )}
    </TouchableOpacity>
  );
}

/** Form dùng chung: thêm tay, sửa món, xác nhận bản nháp AI. */
function GearEditorModal({
  context,
  accessToken,
  onClose,
  onSaved,
  onDelete,
}: {
  context: EditorContext;
  accessToken?: string | null;
  onClose: () => void;
  onSaved: (item: UserGearItem) => void;
  onDelete?: () => void;
}) {
  const seed = context.item ?? context.draft?.extractedData;
  const [name, setName] = useState(seed?.name ?? "");
  const [brand, setBrand] = useState(seed?.brand ?? "");
  // Không đoán loại đồ khi AI không nhận ra: người dùng tự chọn.
  const [category, setCategory] = useState<GearCategory | "">(seed?.category ?? "");
  const [condition, setCondition] = useState<GearCondition>(
    (String(seed?.condition ?? "good").toLowerCase() as GearCondition) || "good",
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const attributes = (seed?.attributes ?? {}) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(attributes)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );
  });
  const [saving, setSaving] = useState(false);
  // Ảnh món: giữ ảnh hiện có, đổi sang ảnh mới (tải lên ngay khi chọn) hoặc xoá (null).
  const [photoRef, setPhotoRef] = useState<string | null>(context.photoRef ?? context.item?.photoRef ?? null);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(context.photoPreview ?? context.item?.photoUrl);
  const [photoBusy, setPhotoBusy] = useState(false);
  const manualEntry = context.draft?.manualEntry?.required ? context.draft.manualEntry : null;

  async function pickPhoto() {
    if (!accessToken) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần quyền thư viện ảnh", "Hãy cho phép truy cập ảnh để chọn ảnh món đồ.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (picked.canceled || !picked.assets[0]) return;
    setPhotoBusy(true);
    try {
      const uploadId = await gearApi.uploadGearPhoto(picked.assets[0], accessToken);
      setPhotoRef(uploadId);
      setPhotoPreview(picked.assets[0].uri);
    } catch (uploadError) {
      Alert.alert("Chưa tải được ảnh", errorText(uploadError, "Vui lòng thử lại."));
    } finally {
      setPhotoBusy(false);
    }
  }
  const warnings = context.draft && !manualEntry ? (context.draft.extractedData.warnings ?? []).filter(Boolean) : [];

  const fieldBadge = (key: string) => {
    if (context.draft) {
      const map = context.draft.extractionFieldProvenance;
      if (!map || category !== (context.draft.extractedData.category ?? "")) return null;
      const status = map[key] ?? map[`attributes.${key}`];
      return status === "FOUND" ? "AI đọc được" : status === "MISSING" ? "AI không thấy" : null;
    }
    const source = context.item?.attributeProvenance?.[key]?.source;
    return source ? ATTRIBUTE_SOURCE_LABELS[source] ?? source : null;
  };

  function buildAttributes() {
    if (!category) return {};
    const result: Record<string, unknown> = {};
    for (const [key, , unit] of gearAttributes(category)) {
      const raw = values[key];
      if (raw === undefined || raw === "") {
        // Sửa món: gửi null để xoá giá trị cũ; thêm mới thì bỏ trống.
        if (context.item && context.item.attributes?.[key] !== undefined && context.item.attributes?.[key] !== null) result[key] = null;
        continue;
      }
      if (unit === "bool") result[key] = raw === "true";
      else if (unit === "coverage") result[key] = raw;
      else {
        const number = Number(raw.replace(",", "."));
        if (!Number.isFinite(number)) throw new Error(`“${raw}” không phải số hợp lệ.`);
        result[key] = number;
      }
    }
    return result;
  }

  async function save(acknowledgeDuplicate = false) {
    if (!accessToken) return;
    if (!name.trim()) {
      Alert.alert("Thiếu tên", "Nhập tên món đồ trước khi lưu.");
      return;
    }
    if (!category) {
      Alert.alert("Chưa chọn loại đồ", "Chọn loại đồ để TrekGo kiểm tra đúng thông số.");
      return;
    }
    let attributes: Record<string, unknown>;
    try {
      attributes = buildAttributes();
    } catch (parseError) {
      Alert.alert("Thông số chưa hợp lệ", errorText(parseError, "Kiểm tra lại các ô số."));
      return;
    }
    const input: CreateUserGearInput = {
      name: name.trim(),
      brand: brand.trim() || null,
      category,
      condition,
      attributes,
      photoRef,
    };
    setSaving(true);
    try {
      let saved: UserGearItem;
      if (context.draft) {
        saved = (await gearApi.confirmExtraction(context.draft.id, { expectedVersion: context.draft.version, item: input, acknowledgeDuplicate }, accessToken)).item;
      } else if (context.item) {
        saved = await gearApi.updateMyGear(context.item.id, { ...input, expectedVersion: context.item.version }, accessToken);
      } else {
        saved = await gearApi.createMyGear({ ...input, acknowledgeDuplicate }, accessToken);
      }
      onSaved(saved);
    } catch (saveError) {
      if (isDuplicate(saveError)) askSaveDuplicate(saveError, () => void save(true));
      else Alert.alert("Chưa lưu được", errorText(saveError, "Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  }

  const title = context.draft ? "Kiểm tra bản nháp AI" : context.item ? "Sửa món đồ" : "Thêm món đồ";

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <View style={styles.modalTitleRow}>
            <View style={styles.flexOne}>
              <Text style={styles.eyebrow}>TỦ ĐỒ CÁ NHÂN</Text>
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Ionicons name="close" size={21} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
            {manualEntry ? <Text style={styles.draftNote}>{manualEntry.messageVi} Bạn có thể nhập tay các thông số.</Text> : null}
            {context.draft?.extractedData._cacheHit ? <Text style={styles.hint}>Dùng lại kết quả đọc trước đó, không tính thêm lượt AI.</Text> : null}
            {warnings.map((warning) => <Text key={warning} style={styles.draftNote}>{warning}</Text>)}
            {context.draft ? <Text style={styles.hint}>AI chỉ gợi ý. Hãy kiểm tra và sửa trước khi lưu.</Text> : null}

            <View style={styles.photoEditor}>
              {photoPreview && photoRef ? (
                <Image source={{ uri: photoPreview }} style={styles.photoLarge} />
              ) : (
                <GearThumb category={category || "BACKPACK"} size={96} radius={18} />
              )}
              <View style={styles.flexOne}>
                <Text style={styles.photoTitle}>Ảnh món đồ</Text>
                <Text style={styles.hint}>Ảnh giúp bạn nhận ra món đồ nhanh khi chọn cho chuyến đi.</Text>
                <View style={styles.photoActions}>
                  <TouchableOpacity style={[styles.photoButton, photoBusy && styles.disabled]} disabled={photoBusy} onPress={() => void pickPhoto()}>
                    {photoBusy ? <ActivityIndicator size="small" color={Trek.trail} /> : <Ionicons name="image-outline" size={15} color={Trek.trail} />}
                    <Text style={styles.photoButtonText}>{photoBusy ? "Đang tải..." : photoRef ? "Đổi ảnh" : "Thêm ảnh"}</Text>
                  </TouchableOpacity>
                  {photoRef && !photoBusy ? (
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => {
                        setPhotoRef(null);
                        setPhotoPreview(undefined);
                      }}
                    >
                      <Ionicons name="trash-outline" size={15} color={Colors.error} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Tên món đồ</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Ví dụ: Balo Naturehike 45L" placeholderTextColor={Colors.onSurfaceMuted} style={styles.input} />
            <Text style={styles.fieldLabel}>Thương hiệu (không bắt buộc)</Text>
            <TextInput value={brand ?? ""} onChangeText={setBrand} placeholder="Naturehike, The North Face..." placeholderTextColor={Colors.onSurfaceMuted} style={styles.input} />

            <Text style={styles.fieldLabel}>Loại đồ</Text>
            <View style={styles.wrapRow}>
              {GEAR_CATEGORIES.map((entry) => (
                <ChoiceChip key={entry.value} label={entry.label} selected={category === entry.value} onPress={() => setCategory(entry.value)} />
              ))}
            </View>
            <Text style={styles.fieldLabel}>Tình trạng</Text>
            <View style={styles.wrapRow}>
              {GEAR_CONDITIONS.map((entry) => (
                <ChoiceChip key={entry.value} label={entry.label} selected={condition === entry.value} onPress={() => setCondition(entry.value)} />
              ))}
            </View>

            {category ? (
              <>
                <Text style={styles.fieldLabel}>Thông số kỹ thuật (để trống nếu không biết)</Text>
                {gearAttributes(category).map(([key, label, unit]) => (
                  <View key={key} style={styles.attrRow}>
                    <View style={styles.attrHead}>
                      <Text style={styles.attrLabel}>{label}{unit !== "bool" && unit !== "coverage" ? ` (${unit})` : ""}</Text>
                      {fieldBadge(key) ? <Text style={styles.attrBadge}>{fieldBadge(key)}</Text> : null}
                    </View>
                    {unit === "bool" ? (
                      <View style={styles.wrapRow}>
                        {[["", "Chưa biết"], ["true", "Có"], ["false", "Không"]].map(([value, text]) => (
                          <ChoiceChip key={value || "unknown"} label={text} selected={(values[key] ?? "") === value} onPress={() => setValues((current) => ({ ...current, [key]: value }))} />
                        ))}
                      </View>
                    ) : unit === "coverage" ? (
                      <View style={styles.wrapRow}>
                        {[["", "Chưa biết"], ["UPPER_BODY", "Thân trên"], ["FULL_BODY", "Toàn thân"]].map(([value, text]) => (
                          <ChoiceChip key={value || "unknown"} label={text} selected={(values[key] ?? "") === value} onPress={() => setValues((current) => ({ ...current, [key]: value }))} />
                        ))}
                      </View>
                    ) : (
                      <TextInput
                        value={values[key] ?? ""}
                        onChangeText={(text) => setValues((current) => ({ ...current, [key]: text }))}
                        keyboardType="numeric"
                        placeholder="Chưa biết"
                        placeholderTextColor={Colors.onSurfaceMuted}
                        style={styles.input}
                      />
                    )}
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.hint}>Chọn loại đồ để hiện các thông số cần nhập.</Text>
            )}

            <TouchableOpacity disabled={saving || photoBusy} style={[styles.saveButton, (saving || photoBusy) && styles.disabled]} onPress={() => void save()}>
              {saving ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={styles.saveButtonText}>{context.draft ? "Xác nhận và lưu vào tủ" : "Lưu"}</Text>}
            </TouchableOpacity>
            {onDelete ? (
              <TouchableOpacity style={styles.deleteLink} onPress={onDelete}>
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
                <Text style={styles.deleteLinkText}>Xóa món này</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function LinkModal({ visible, busy, onClose, onSubmit }: { visible: boolean; busy: boolean; onClose: () => void; onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.centerBackdrop}>
        <View style={styles.dialog}>
          <Text style={styles.modalTitle}>Đọc từ đường dẫn</Text>
          <Text style={styles.hint}>Dán một đường dẫn sản phẩm trekking. Bạn luôn được xem và sửa bản nháp trước khi lưu.</Text>
          <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="https://..." placeholderTextColor={Colors.onSurfaceMuted} style={[styles.input, { marginTop: 14 }]} />
          <View style={styles.dialogActions}>
            <TouchableOpacity style={styles.ghostButton} onPress={onClose}><Text style={styles.ghostButtonText}>Huỷ</Text></TouchableOpacity>
            <TouchableOpacity
              disabled={busy || !/^https?:\/\//i.test(url.trim())}
              style={[styles.smallPrimary, (busy || !/^https?:\/\//i.test(url.trim())) && styles.disabled]}
              onPress={() => onSubmit(url.trim())}
            >
              <Text style={styles.smallPrimaryText}>{busy ? "Đang đọc..." : "Tạo bản nháp"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Tìm trong danh mục sản phẩm đã được TrekGo kiểm duyệt, thêm bản sao vào tủ. */
function CatalogModal({ accessToken, onClose, onAdded }: { accessToken: string; onClose: () => void; onAdded: (item: UserGearItem) => void }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<GearCategory | undefined>();
  const [results, setResults] = useState<GearCatalogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<GearCatalogEntry | null>(null);
  const [condition, setCondition] = useState<GearCondition>("good");
  const [adding, setAdding] = useState(false);

  const search = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await gearApi.searchCatalog({ q, category, cursor }, accessToken);
      setResults((current) => (cursor ? [...current, ...result.items] : result.items));
      setNextCursor(result.nextCursor);
    } catch (searchError) {
      setError(errorText(searchError, "Không tải được danh mục."));
    } finally {
      setLoading(false);
    }
  }, [accessToken, category, q]);

  // Đổi loại đồ → tìm lại từ đầu (không dùng cursor cũ).
  useEffect(() => {
    const timer = setTimeout(() => void search(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function add(acknowledgeDuplicate = false) {
    if (!selected) return;
    setAdding(true);
    try {
      onAdded(await gearApi.addFromCatalog(selected.id, { condition, acknowledgeDuplicate }, accessToken));
    } catch (addError) {
      if (isDuplicate(addError)) askSaveDuplicate(addError, () => void add(true));
      else Alert.alert("Chưa thêm được", errorText(addError, "Vui lòng thử lại."));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <View style={styles.modalTitleRow}>
            <View style={styles.flexOne}>
              <Text style={styles.eyebrow}>DANH MỤC ĐÃ DUYỆT</Text>
              <Text style={styles.modalTitle}>{selected ? "Thêm vào tủ" : "Tìm sản phẩm"}</Text>
            </View>
            <TouchableOpacity style={styles.headerButton} onPress={selected ? () => setSelected(null) : onClose}>
              <Ionicons name={selected ? "arrow-back" : "close"} size={21} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>
          {selected ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <CatalogEntryView entry={selected} expanded />
              <Text style={styles.fieldLabel}>Tình trạng món của bạn</Text>
              <View style={styles.wrapRow}>
                {GEAR_CONDITIONS.map((entry) => (
                  <ChoiceChip key={entry.value} label={entry.label} selected={condition === entry.value} onPress={() => setCondition(entry.value)} />
                ))}
              </View>
              <Text style={styles.hint}>
                Thông số được TrekGo kiểm duyệt theo nguồn của nhà sản xuất, không đảm bảo tình trạng thực tế của món bạn đang có.
              </Text>
              <TouchableOpacity disabled={adding} style={[styles.saveButton, adding && styles.disabled]} onPress={() => void add()}>
                {adding ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={styles.saveButtonText}>Thêm vào tủ đồ</Text>}
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <>
              <View style={styles.searchRow}>
                <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => void search()} returnKeyType="search" placeholder="Tên hoặc thương hiệu..." placeholderTextColor={Colors.onSurfaceMuted} style={[styles.input, styles.flexOne]} />
                <TouchableOpacity style={styles.searchButton} onPress={() => void search()}>
                  <Ionicons name="search" size={18} color={Colors.onPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={{ marginTop: 10, flexGrow: 0 }}>
                <ChoiceChip label="Tất cả" selected={!category} onPress={() => setCategory(undefined)} />
                {GEAR_CATEGORIES.map((entry) => (
                  <ChoiceChip key={entry.value} label={entry.label} selected={category === entry.value} onPress={() => setCategory(entry.value)} />
                ))}
              </ScrollView>
              <ScrollView contentContainerStyle={{ paddingVertical: 12, gap: 10 }}>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {!loading && !error && results.length === 0 ? <Text style={styles.hint}>Chưa có sản phẩm đã duyệt phù hợp.</Text> : null}
                {results.map((entry) => (
                  <TouchableOpacity key={entry.id} onPress={() => setSelected(entry)}>
                    <CatalogEntryView entry={entry} />
                  </TouchableOpacity>
                ))}
                {loading ? <ActivityIndicator color={Colors.primaryDark} /> : null}
                {nextCursor && !loading ? (
                  <TouchableOpacity style={styles.ghostButton} onPress={() => void search(nextCursor)}>
                    <Text style={styles.ghostButtonText}>Tải thêm</Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function CatalogEntryView({ entry, expanded }: { entry: GearCatalogEntry; expanded?: boolean }) {
  const fields = gearAttributes(entry.category).filter(([key]) => entry.attributes?.[key] !== null && entry.attributes?.[key] !== undefined);
  return (
    <View style={styles.catalogCard}>
      <Text style={styles.itemCategory}>{categoryInfo(entry.category).label.toUpperCase()} · ĐÃ KIỂM DUYỆT</Text>
      <Text style={styles.itemName}>{entry.name}</Text>
      {entry.brand ? <Text style={styles.itemMeta}>{entry.brand}</Text> : null}
      <Text style={styles.catalogStats}>
        {fields.map(([key, label, unit]) => `${label}: ${formatGearAttribute(entry.attributes[key], unit)}`).join(" · ") || "Chưa có thông số"}
      </Text>
      {expanded
        ? fields.map(([key, label]) =>
            entry.evidence?.[key] ? <Text key={key} style={styles.hint}>Nguồn {label.toLowerCase()}: {entry.evidence[key]}</Text> : null,
          )
        : null}
    </View>
  );
}

/** Xem lại kết quả kiểm tra theo chuyến: lấy từ bản đánh giá mới nhất của từng kế hoạch, không đánh giá lại. */
function TripReviewSection({ accessToken, items }: { accessToken: string; items: UserGearItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [rows, setRows] = useState<{ plan: GearPlan; tripTitle: string; guidance: PlanGuidance | null }[] | null>(null);

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const [plans, trips] = await Promise.all([
        gearAdvisorApi.listPlans(accessToken),
        gearAdvisorApi.listTripCandidates(accessToken).catch(() => []),
      ]);
      const evaluated = plans.filter((plan) => plan.evaluatedRevision);
      const guidances = await Promise.all(
        evaluated.map((plan) => gearAdvisorApi.guidance(plan.id, plan.evaluatedRevision as number, accessToken).catch(() => null)),
      );
      setRows(
        evaluated.map((plan, index) => ({
          plan,
          tripTitle: trips.find((trip) => trip.id === plan.tripId)?.title ?? plan.title,
          guidance: guidances[index],
        })),
      );
    } catch (loadError) {
      setError(errorText(loadError, "Không tải được lịch sử kiểm tra."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.panel, { marginTop: 20 }]}>
      <TouchableOpacity
        style={styles.panelHead}
        onPress={() => {
          const next = !open;
          setOpen(next);
          if (next && !rows) void load();
        }}
      >
        <Text style={styles.panelTitle}>Đã kiểm tra theo chuyến</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>
      {open ? (
        <View style={styles.panelBody}>
          {loading ? <ActivityIndicator color={Colors.primaryDark} /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {rows && rows.length === 0 ? <Text style={styles.hint}>Chưa có chuyến nào được đánh giá. Tạo kế hoạch trong Kế hoạch đồ.</Text> : null}
          {rows?.map(({ plan, tripTitle, guidance }) => (
            <View key={plan.id} style={styles.tripCard}>
              <TouchableOpacity
                onPress={() =>
                  router.push((plan.tripId ? `/gear-advisor?tripId=${encodeURIComponent(plan.tripId)}` : "/gear-advisor") as Href)
                }
              >
                <Text style={styles.itemName}>{tripTitle} ›</Text>
                <Text style={styles.hint}>
                  Lần đánh giá #{plan.evaluatedRevision}
                  {plan.isStale || guidance?.needsReevaluation ? " · cần đánh giá lại vì dữ liệu đã đổi" : ""}
                </Text>
              </TouchableOpacity>
              {!guidance || !guidance.available ? (
                <Text style={styles.hint}>Bản đánh giá này không có chi tiết từng món.</Text>
              ) : (
                (guidance.items ?? []).map((entry) => {
                  const status = DISPLAY_STATUS_LABELS[entry.displayStatus] ?? { label: entry.displayStatus, tone: "info" as const };
                  const current = items.find((item) => item.id === entry.itemId);
                  return (
                    <View key={entry.itemId} style={styles.tripItem}>
                      <Text style={styles.tripItemName}>{entry.nameAtEvaluation ?? current?.name ?? "Món đã xoá"}</Text>
                      <Text style={[styles.tripStatus, status.tone === "ok" ? styles.toneOk : status.tone === "warn" ? styles.toneWarn : styles.toneInfo]}>
                        {status.label}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          ))}
          {rows ? (
            <TouchableOpacity onPress={() => void load()}>
              <Text style={[styles.hint, styles.link]}>Tải lại</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ChoiceChip({ label, selected, warn, onPress }: { label: string; selected: boolean; warn?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, warn && !selected && styles.chipWarn, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StateCard({ icon, title, description, actionLabel, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; actionLabel: string; onAction: () => void }) {
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Trek.paper },
  heroAction: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Trek.sun,
  },
  heroActionText: { color: "#3b2302", fontSize: 12, fontWeight: "800" },
  sectionLabel: { marginTop: 18, marginBottom: 8, color: Trek.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  overview: { marginTop: 14, gap: 12, padding: 14, borderRadius: 22, borderWidth: 1, borderColor: Trek.line, backgroundColor: "#ffffff", ...Shadows.card },
  overviewTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  overviewTitle: { color: Trek.ink, fontSize: 15, fontWeight: "800" },
  overviewStats: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  overviewStat: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    color: "#55625a",
    backgroundColor: "#f1f4f1",
    fontSize: 11,
    fontWeight: "700",
  },
  overviewWarn: { color: Trek.amberInk, backgroundColor: Trek.amberBg },
  overviewOk: { color: Trek.trail, backgroundColor: Trek.mintPale },
  categoryStrip: { gap: 8 },
  categoryTile: { width: 76, alignItems: "center", gap: 2, paddingVertical: 9, borderRadius: 14 },
  categoryCount: { fontSize: 16, fontWeight: "900" },
  categoryName: { color: "#55625a", fontSize: 10, fontWeight: "600" },
  chipWarn: { backgroundColor: Trek.amberBg },
  itemBand: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  itemBar: { marginTop: 6 },
  photoHint: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: Trek.trail,
  },
  photoEditor: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: Radius.lg, backgroundColor: "#ffffff" },
  photoLarge: { width: 96, height: 96, borderRadius: 18, backgroundColor: Colors.surfaceContainer },
  photoTitle: { color: Colors.onSurface, fontSize: 13, fontWeight: "700" },
  photoActions: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bcdcc6",
    backgroundColor: Trek.mintPale,
  },
  photoButtonText: { color: Trek.trail, fontSize: 12, fontWeight: "800" },
  photoRemove: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#fdecea" },
  flexOne: { flex: 1 },
  disabled: { opacity: 0.5 },
  header: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1 },
  headerButton: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLowest, alignItems: "center", justifyContent: "center" },
  counter: { color: Colors.primaryDark, fontSize: 13, fontWeight: "600" },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: "600", letterSpacing: 0.7 },
  title: { marginTop: 2, color: Colors.onSurface, fontSize: 22, fontWeight: "600" },
  content: { padding: 16, paddingBottom: 48 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: { flexBasis: "48%", flexGrow: 1, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primaryNeutral, backgroundColor: Colors.surfaceContainerLowest },
  actionButtonPrimary: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryDark },
  actionText: { color: Colors.primaryDark, fontSize: 12, fontWeight: "600" },
  actionTextPrimary: { color: Colors.onPrimary },
  quotaNote: { marginTop: 8, color: Colors.onSurfaceMuted, fontSize: 10 },
  progressCard: { marginTop: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  progressText: { flex: 1, color: Colors.primaryDark, fontSize: 12 },
  banner: { marginTop: 12, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: Radius.md, borderWidth: 1 },
  bannerWarn: { borderColor: "#F2D49B", backgroundColor: "#FFF6E0" },
  bannerError: { borderColor: "#F3AAA7", backgroundColor: "#FFE5E2" },
  bannerText: { flex: 1, color: "#7A4B00", fontSize: 12, lineHeight: 17 },
  panel: { marginTop: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, backgroundColor: Colors.surfaceContainerLowest },
  panelHead: { padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  panelTitle: { flex: 1, color: Colors.onSurface, fontSize: 13, fontWeight: "600" },
  panelBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  capabilityRow: { padding: 10, gap: 4, borderRadius: Radius.md, backgroundColor: Colors.surface },
  capabilityHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  capabilityLabel: { flex: 1, color: Colors.onSurface, fontSize: 12, fontWeight: "600" },
  capabilityState: { flexDirection: "row", alignItems: "center", gap: 5 },
  capabilityStateText: { color: Colors.onSurfaceVariant, fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hint: { color: Colors.onSurfaceVariant, fontSize: 11, lineHeight: 16 },
  link: { color: Colors.primaryDark, fontWeight: "600" },
  errorText: { color: Colors.error, fontSize: 12 },
  filterRow: { marginTop: 16, flexGrow: 0 },
  chipRow: { gap: 8, paddingRight: 20 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer },
  chipSelected: { backgroundColor: Colors.inkDeep },
  chipText: { color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: "600" },
  chipTextSelected: { color: Colors.onPrimaryDark },
  centerState: { paddingVertical: 60, alignItems: "center", gap: 12 },
  list: { marginTop: 14, gap: 11 },
  itemCard: { overflow: "hidden", padding: 14, paddingLeft: 16, gap: 10, borderRadius: 20, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  itemIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  itemPhoto: { width: 52, height: 52, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainer },
  itemCategory: { color: Colors.primaryDark, fontSize: 9, fontWeight: "600", letterSpacing: 0.5 },
  itemName: { marginTop: 3, color: Colors.onSurface, fontSize: 14, fontWeight: "600" },
  itemMeta: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 11 },
  statRow: { flexDirection: "row", gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.surfaceContainer },
  stat: { flex: 1, minWidth: 0 },
  statLabel: { color: Colors.onSurfaceMuted, fontSize: 9, fontWeight: "600" },
  statValue: { marginTop: 2, color: Colors.onSurface, fontSize: 12, fontWeight: "600" },
  statSource: { marginTop: 1, color: Colors.onSurfaceMuted, fontSize: 9 },
  missingStats: { color: "#8A5A00", fontSize: 11 },
  stateCard: { marginTop: 18, padding: 24, alignItems: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  stateIcon: { width: 66, height: 66, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  stateTitle: { marginTop: 15, color: Colors.onSurface, fontSize: 17, fontWeight: "600" },
  stateDescription: { marginTop: 7, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, textAlign: "center" },
  stateButton: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  stateButtonText: { color: Colors.onPrimary, fontSize: 12, fontWeight: "600" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(14,15,12,0.45)" },
  modalCard: { maxHeight: "92%", padding: 20, paddingBottom: 24, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, backgroundColor: Colors.surface },
  modalHandle: { width: 42, height: 4, alignSelf: "center", marginBottom: 14, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHighest },
  modalTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 },
  modalTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 20, fontWeight: "600" },
  draftNote: { marginTop: 8, padding: 10, borderRadius: Radius.md, backgroundColor: "#FFF6E0", color: "#7A4B00", fontSize: 12, lineHeight: 17 },
  fieldLabel: { marginTop: 16, marginBottom: 7, color: Colors.onSurface, fontSize: 12, fontWeight: "600" },
  input: { minHeight: 46, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: Radius.md, color: Colors.onSurface, backgroundColor: Colors.surfaceContainerLowest },
  attrRow: { marginTop: 10, gap: 6 },
  attrHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  attrLabel: { color: Colors.onSurface, fontSize: 12 },
  attrBadge: { color: Colors.primaryDark, fontSize: 10, fontWeight: "600" },
  saveButton: { minHeight: 50, marginTop: 22, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  saveButtonText: { color: Colors.onPrimary, fontSize: 13, fontWeight: "600" },
  deleteLink: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  deleteLinkText: { color: Colors.error, fontSize: 12, fontWeight: "600" },
  centerBackdrop: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "rgba(14,15,12,0.45)" },
  dialog: { padding: 20, borderRadius: Radius.xl, backgroundColor: Colors.surface, gap: 6 },
  dialogActions: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  ghostButton: { paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.surfaceContainerHighest },
  ghostButtonText: { color: Colors.onSurface, fontSize: 12, fontWeight: "600" },
  smallPrimary: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  smallPrimaryText: { color: Colors.onPrimary, fontSize: 12, fontWeight: "600" },
  searchRow: { marginTop: 8, flexDirection: "row", gap: 8 },
  searchButton: { width: 46, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryDark },
  catalogCard: { padding: 12, gap: 2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, backgroundColor: Colors.surfaceContainerLowest },
  catalogStats: { marginTop: 4, color: Colors.onSurface, fontSize: 11 },
  tripCard: { padding: 12, gap: 6, borderRadius: Radius.md, backgroundColor: Colors.surface },
  tripItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tripItemName: { flex: 1, color: Colors.onSurface, fontSize: 12 },
  tripStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, fontSize: 10, fontWeight: "600", overflow: "hidden" },
  toneOk: { color: "#1E6B3F", backgroundColor: "#E2F4E8" },
  toneWarn: { color: "#8C1D18", backgroundColor: "#FDE7E5" },
  toneInfo: { color: "#7A4B00", backgroundColor: "#FFF3D6" },
});
