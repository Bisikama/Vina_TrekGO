import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { DifficultyLevel } from "@/types";
import { ApiError } from "@/lib/api-client";
import { isUUID } from "@/services/api/personalTrailApi";

const difficultyOptions: DifficultyLevel[] = [
  "Dễ",
  "Trung bình",
  "Khó",
  "Thách thức",
];

export default function PersonalTrailEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const trailId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { personalTrails, updatePersonalTrail } = useApp();
  const trail = useMemo(() => {
    if (!trailId) return personalTrails[0];
    const exact = personalTrails.find((current) => current.id === trailId);
    if (exact) return exact;

    if (!isUUID(trailId)) {
      const matched = personalTrails.find(
        (t) =>
          (t.clientRecordingId && trailId.includes(t.clientRecordingId)) ||
          (t.clientRecordingId && t.clientRecordingId === trailId),
      );
      if (matched) return matched;

      const tsMatch = trailId.match(/personal-trail-(\d+)/);
      if (tsMatch) {
        const localTs = Number(tsMatch[1]);
        const matchedByTime = personalTrails.find((t) => {
          if (!t.createdAt) return false;
          const tTime = new Date(t.createdAt).getTime();
          return !isNaN(tTime) && Math.abs(tTime - localTs) < 30 * 60 * 1000;
        });
        if (matchedByTime) return matchedByTime;
      }
    }

    return personalTrails.find((current) => current.id === trailId);
  }, [personalTrails, trailId]);

  const [name, setName] = useState(trail?.name ?? "");
  const [region, setRegion] = useState(trail?.region ?? "");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(
    trail?.difficulty ?? "Trung bình",
  );
  const [duration, setDuration] = useState(trail?.duration ?? "1 ngày");
  const [terrainType, setTerrainType] = useState(
    trail?.terrainType ?? "Rừng & Đồi dốc",
  );
  const [description, setDescription] = useState(trail?.description ?? "");

  const [prevTrailId, setPrevTrailId] = useState<string | undefined>(trail?.id);
  if (trail && trail.id !== prevTrailId) {
    setPrevTrailId(trail.id);
    setName(trail.name ?? "");
    setRegion(trail.region ?? "");
    setDifficulty(trail.difficulty ?? "Trung bình");
    setDuration(trail.duration ?? "1 ngày");
    setTerrainType(trail.terrainType ?? "Rừng & Đồi dốc");
    setDescription(trail.description ?? "");
  }

  const canEdit =
    trail?.verificationStatus === "DRAFT" ||
    trail?.verificationStatus === "REJECTED";

  function validate() {
    if (!name.trim() || !region.trim()) {
      Alert.alert(
        "Thiếu thông tin",
        "Hãy nhập tên Trail và khu vực trước khi lưu.",
      );
      return false;
    }

    if (!duration.trim() || !terrainType.trim() || !description.trim()) {
      Alert.alert(
        "Chưa đủ mô tả",
        "Hãy điền thời lượng, địa hình và mô tả hành trình.",
      );
      return false;
    }

    return true;
  }

  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  async function saveTrail(submitForVerification: boolean) {
    if (savingRef.current || !trail || !canEdit || !validate()) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await updatePersonalTrail(trail.id, {
        name,
        region,
        difficulty,
        distanceKm: trail.distanceKm,
        elevationGainM: trail.elevationGainM,
        duration,
        terrainType,
        description,
        gpsSegments: trail.gpsSegments,
        gpsRoute: trail.gpsRoute,
        checkpoints: trail.checkpoints || [],
        submitForVerification,
      });

      Alert.alert(
        submitForVerification ? "Đã gửi lại Trail" : "Đã lưu bản nháp",
        submitForVerification
          ? "Trail đã chuyển sang trạng thái chờ Admin xác minh."
          : isUUID(trail.id)
            ? "Các thay đổi đã được cập nhật trên máy chủ."
            : "Các thay đổi đã được lưu trên thiết bị.",
        [
          {
            text: "Xem chi tiết",
            onPress: () =>
              router.dismissTo({
                pathname: "/personal-trails/[id]",
                params: {
                  id: trail.id,
                },
              } as unknown as Href),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        error instanceof ApiError && error.status === 0 ? "Network error" : "Không thể hoàn tất",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!trail) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chỉnh sửa Personal Trail</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.missingCard}>
          <Ionicons
            name="alert-circle-outline"
            size={34}
            color={Colors.primaryDark}
          />
          <Text style={styles.missingTitle}>Không tìm thấy cung đường</Text>
          <Text style={styles.missingDescription}>
            Cung đường có thể đã bị xóa khỏi thiết bị.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/personal-trails" as Href)}
          >
            <Text style={styles.backButtonText}>Quay lại danh sách</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pointCount =
    trail.gpsSegments && trail.gpsSegments.length > 0
      ? trail.gpsSegments.reduce((sum, seg) => sum + seg.length, 0)
      : (trail.gpsRoute?.length || 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Chỉnh sửa Trail</Text>
          <Text style={styles.headerSubtitle}>
            {canEdit ? "Chế độ chỉnh sửa" : "Chỉ xem (đang chờ duyệt)"}
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {trail.verificationStatus === "REJECTED" &&
          trail.rejectionReason ? (
            <View style={styles.rejectionCard}>
              <Ionicons name="alert-circle" size={20} color="#B91C1C" />
              <View style={styles.flexOne}>
                <Text style={styles.rejectionTitle}>Yêu cầu chỉnh sửa từ Admin</Text>
                <Text style={styles.rejectionText}>{trail.rejectionReason}</Text>
              </View>
            </View>
          ) : null}

          {/* Vệt GPS thực tế (Bất biến) */}
          <View style={styles.sectionCard}>
            <SectionHeading
              icon="locate-outline"
              title="Thông số GPS thực địa"
              subtitle="Thu nhận từ vệ tinh WGS84 ngoài thực tế"
            />

            <View style={styles.gpsGrid}>
              <View style={styles.gpsGridItem}>
                <Text style={styles.gpsGridValue}>{trail.distanceKm} km</Text>
                <Text style={styles.gpsGridLabel}>Quãng đường</Text>
              </View>
              <View style={styles.gpsGridItem}>
                <Text style={styles.gpsGridValue}>+{trail.elevationGainM} m</Text>
                <Text style={styles.gpsGridLabel}>Độ cao tích lũy</Text>
              </View>
              <View style={styles.gpsGridItem}>
                <Text style={styles.gpsGridValue}>{pointCount}</Text>
                <Text style={styles.gpsGridLabel}>Điểm GPS</Text>
              </View>
            </View>

            <View style={styles.gpsNoticeBox}>
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={Colors.primaryDark}
              />
              <Text style={styles.gpsNoticeText}>
                Vệt GPS là dữ liệu gốc được ghi ngoài thực địa và được bảo toàn nguyên vẹn nhằm đảm bảo tính minh bạch khi xét duyệt.
              </Text>
            </View>
          </View>

          {/* Thông tin chỉnh sửa được */}
          <View style={styles.sectionCard}>
            <SectionHeading
              icon="create-outline"
              title="Thông tin mô tả"
              subtitle="Cập nhật chi tiết để cộng đồng dễ tiếp cận"
            />

            <FieldLabel text="Tên cung đường" required />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              editable={canEdit}
              placeholder="VD: Sống núi Langbiang phía Bắc"
              placeholderTextColor={Colors.onSurfaceVariant}
            />

            <FieldLabel text="Khu vực" required />
            <TextInput
              style={styles.input}
              value={region}
              onChangeText={setRegion}
              editable={canEdit}
              placeholder="VD: Lạc Dương, Lâm Đồng"
              placeholderTextColor={Colors.onSurfaceVariant}
            />

            <FieldLabel text="Độ khó" required />
            <View style={styles.optionWrap}>
              {difficultyOptions.map((option) => {
                const selected = difficulty === option;

                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionChip,
                      selected && styles.optionChipSelected,
                      !canEdit && styles.optionChipDisabled,
                    ]}
                    onPress={() => canEdit && setDifficulty(option)}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        selected && styles.optionChipTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FieldLabel text="Thời lượng dự kiến" required />
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              editable={canEdit}
              placeholder="VD: 1 ngày hoặc 6 giờ"
              placeholderTextColor={Colors.onSurfaceVariant}
            />

            <FieldLabel text="Địa hình" required />
            <TextInput
              style={styles.input}
              value={terrainType}
              onChangeText={setTerrainType}
              editable={canEdit}
              placeholder="VD: Rừng thông & Đồi dốc"
              placeholderTextColor={Colors.onSurfaceVariant}
            />

            <FieldLabel text="Mô tả hành trình" required />
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={description}
              onChangeText={setDescription}
              editable={canEdit}
              multiline
              textAlignVertical="top"
              placeholder="Mô tả đường đi, điểm nổi bật và lưu ý an toàn..."
              placeholderTextColor={Colors.onSurfaceVariant}
            />
          </View>

          {canEdit ? (
            <View style={styles.actionCard}>
              <TouchableOpacity
                style={styles.draftButton}
                disabled={saving}
                onPress={() => saveTrail(false)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="save-outline"
                  size={19}
                  color={Colors.primaryDark}
                />
                <Text style={styles.draftButtonText}>Lưu bản nháp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitButton}
                disabled={saving}
                onPress={() => saveTrail(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="send" size={19} color={Colors.onPrimary} />
                <Text style={styles.submitButtonText}>
                  {trail.verificationStatus === "REJECTED"
                    ? "Gửi lại Admin"
                    : "Lưu và gửi xác minh"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({
  text,
  required = false,
}: {
  text: string;
  required?: boolean;
}) {
  return (
    <Text style={styles.fieldLabel}>
      {text}
      {required ? <Text style={styles.requiredMark}> *</Text> : null}
    </Text>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={19} color={Colors.primaryDark} />
      </View>
      <View style={styles.flexOne}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  flexOne: {
    flex: 1,
  },
  headerBar: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  headerSpacer: {
    width: 38,
  },
  headerTitleBox: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: "900",
  },
  headerSubtitle: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  rejectionCard: {
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: Radius.lg,
    backgroundColor: "#FEF2F2",
  },
  rejectionTitle: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "900",
  },
  rejectionText: {
    marginTop: 4,
    color: "#991B1B",
    fontSize: 11,
    lineHeight: 16,
  },
  sectionCard: {
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  sectionHeader: {
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
  },
  sectionTitle: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: "900",
  },
  sectionSubtitle: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  gpsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  gpsGridItem: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  gpsGridValue: {
    color: Colors.primaryDark,
    fontSize: 16,
    fontWeight: "900",
  },
  gpsGridLabel: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: "600",
  },
  gpsNoticeBox: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
  },
  gpsNoticeText: {
    flex: 1,
    color: Colors.primaryDark,
    fontSize: 10,
    lineHeight: 15,
  },
  fieldLabel: {
    marginTop: 12,
    marginBottom: 6,
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: "800",
  },
  requiredMark: {
    color: "#B91C1C",
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
    color: Colors.onSurface,
    fontSize: 12,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  optionChipSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  optionChipDisabled: {
    opacity: 0.6,
  },
  optionChipText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: "700",
  },
  optionChipTextSelected: {
    color: Colors.onPrimary,
  },
  actionCard: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  draftButton: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  draftButtonText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
  submitButton: {
    flex: 1.2,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    ...Shadows.card,
  },
  submitButtonText: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  missingCard: {
    marginTop: 60,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  missingTitle: {
    marginTop: 12,
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: "900",
  },
  missingDescription: {
    marginTop: 6,
    textAlign: "center",
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  backButtonText: {
    color: Colors.onPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
});
