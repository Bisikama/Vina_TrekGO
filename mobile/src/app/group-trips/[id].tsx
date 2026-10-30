import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import type { GroupTripJoinStatus, TrekkerFitnessLevel } from "@/types";

const statusMeta: Record<
  GroupTripJoinStatus,
  { title: string; description: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  NONE: {
    title: "Bạn chưa tham gia nhóm",
    description: "Kiểm tra lịch, yêu cầu thể lực và điểm tập trung trước khi gửi yêu cầu.",
    icon: "person-add-outline",
  },
  PENDING: {
    title: "Yêu cầu đang chờ duyệt",
    description: "Trưởng nhóm sẽ xem hồ sơ trekking và phản hồi trong bản demo.",
    icon: "time-outline",
  },
  JOINED: {
    title: "Bạn đã ở trong nhóm",
    description: "Thông tin tập trung đã được giữ trong hồ sơ chuyến ghép đoàn.",
    icon: "checkmark-circle-outline",
  },
};

export default function GroupTripDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const groupTripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const {
    groupTrips,
    joinGroupTrip,
    cancelGroupTripRequest,
    leaveGroupTrip,
  } = useApp();
  const trip = groupTrips.find((item) => item.id === groupTripId);

  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFoundCard}>
          <Ionicons name="alert-circle-outline" size={34} color={Colors.warningDeep} />
          <Text style={styles.notFoundTitle}>Không tìm thấy chuyến ghép đoàn</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = statusMeta[trip.joinStatus];
  const remaining = trip.maxMembers - trip.currentMembers;
  const selectedTripId = trip.id;

  function handleJoin() {
    const result = joinGroupTrip(selectedTripId);
    Alert.alert(
      result.ok ? "Đã cập nhật" : "Không thể tham gia",
      result.message,
    );
  }

  function handleCancelRequest() {
    Alert.alert(
      "Rút yêu cầu tham gia?",
      "Bạn có thể gửi yêu cầu lại nếu chuyến vẫn còn chỗ.",
      [
        { text: "Giữ yêu cầu", style: "cancel" },
        {
          text: "Rút yêu cầu",
          style: "destructive",
          onPress: () => {
            const result = cancelGroupTripRequest(selectedTripId);
            Alert.alert("Đã cập nhật", result.message);
          },
        },
      ],
    );
  }

  function handleLeave() {
    Alert.alert(
      "Rời chuyến ghép đoàn?",
      "Vị trí của bạn sẽ được mở lại cho thành viên khác.",
      [
        { text: "Ở lại", style: "cancel" },
        {
          text: "Rời nhóm",
          style: "destructive",
          onPress: () => {
            const result = leaveGroupTrip(selectedTripId);
            Alert.alert("Đã rời nhóm", result.message);
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
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>GROUP TRIP DETAIL</Text>
          <Text style={styles.headerTitle}>Chi tiết nhóm</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => Alert.alert("Chia sẻ chuyến", "Đã sao chép liên kết mock của nhóm.")}
        >
          <Ionicons name="share-social-outline" size={20} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroWrap}>
          <Image source={{ uri: trip.imageUrl }} style={styles.heroImage} />
          <View style={styles.heroShade} />
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="pulse" size={12} color={Colors.onPrimaryDark} />
              <Text style={styles.heroBadgeText}>{trip.difficulty}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="people" size={12} color={Colors.onPrimaryDark} />
              <Text style={styles.heroBadgeText}>{trip.currentMembers}/{trip.maxMembers}</Text>
            </View>
          </View>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroLocation}>{trip.destination} · {trip.province}</Text>
            <Text style={styles.heroTitleText}>{trip.title}</Text>
          </View>
        </View>

        <View style={styles.quickInfoRow}>
          <QuickInfo icon="calendar-outline" value={trip.startDate} label="Khởi hành" />
          <QuickInfo icon="time-outline" value={trip.duration} label="Thời lượng" />
          <QuickInfo icon="wallet-outline" value={`${Math.round(trip.priceEstimate / 1000)}K`} label="Dự kiến" />
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons name={status.icon} size={23} color={Colors.primaryDark} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.statusTitle}>{status.title}</Text>
            <Text style={styles.statusDescription}>{status.description}</Text>
          </View>
        </View>

        <Section title="Về chuyến đi" icon="trail-sign-outline">
          <Text style={styles.description}>{trip.description}</Text>
          <View style={styles.tagRow}>
            {trip.tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Trưởng nhóm" icon="ribbon-outline">
          <View style={styles.organizerRow}>
            <Image source={{ uri: trip.organizer.avatar }} style={styles.organizerAvatar} />
            <View style={styles.flexOne}>
              <View style={styles.organizerNameRow}>
                <Text style={styles.organizerName}>{trip.organizer.name}</Text>
                {trip.organizer.verified ? (
                  <Ionicons name="checkmark-circle" size={15} color={Colors.primaryDark} />
                ) : null}
              </View>
              <Text style={styles.organizerRole}>
                {trip.organizer.role === "LEADER"
                  ? trip.organizer.badge || "Verified Leader"
                  : "Trekker tổ chức nhóm"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => Alert.alert("Nhắn trưởng nhóm", "Chat ghép đoàn sẽ được nối API sau.")}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.primaryDark} />
            </TouchableOpacity>
          </View>
        </Section>

        <Section title="Kế hoạch tập trung" icon="location-outline">
          <InfoRow icon="navigate-outline" label="Điểm tập trung" value={trip.meetingPoint} />
          <InfoRow icon="calendar-number-outline" label="Ngày đi" value={`${trip.startDate} – ${trip.endDate}`} />
          <InfoRow icon="cash-outline" label="Chi phí dự kiến" value={`${trip.priceEstimate.toLocaleString("vi-VN")}đ/người`} last />
        </Section>

        <Section title="Yêu cầu thành viên" icon="shield-checkmark-outline">
          {trip.requirements.map((requirement) => (
            <View key={requirement} style={styles.requirementRow}>
              <View style={styles.requirementCheck}>
                <Ionicons name="checkmark" size={13} color={Colors.onPrimaryDark} />
              </View>
              <Text style={styles.requirementText}>{requirement}</Text>
            </View>
          ))}
        </Section>

        <Section title={`Thành viên (${trip.currentMembers}/${trip.maxMembers})`} icon="people-outline">
          <View style={styles.memberGrid}>
            {trip.members.map((member) => (
              <View key={member.id} style={styles.memberCard}>
                <Image source={{ uri: member.avatar }} style={styles.memberAvatar} />
                <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
                <Text style={styles.memberLevel}>{fitnessLabel(member.fitnessLevel)}</Text>
              </View>
            ))}
            {remaining > 0 ? (
              <View style={[styles.memberCard, styles.openSlotCard]}>
                <View style={styles.openSlotIcon}>
                  <Ionicons name="add" size={20} color={Colors.primaryDark} />
                </View>
                <Text style={styles.memberName}>{remaining} chỗ trống</Text>
                <Text style={styles.memberLevel}>Đang tuyển</Text>
              </View>
            ) : null}
          </View>
        </Section>

        {trip.joinStatus === "NONE" ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleJoin} activeOpacity={0.86}>
            <Ionicons name="person-add" size={19} color={Colors.onPrimaryDark} />
            <Text style={styles.primaryButtonText}>
              {trip.joinMode === "INSTANT" ? "Tham gia nhóm ngay" : "Gửi yêu cầu tham gia"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {trip.joinStatus === "PENDING" ? (
          <TouchableOpacity style={styles.pendingButton} onPress={handleCancelRequest} activeOpacity={0.86}>
            <Ionicons name="close-circle-outline" size={19} color={Colors.warningDeep} />
            <Text style={styles.pendingButtonText}>Rút yêu cầu đang chờ</Text>
          </TouchableOpacity>
        ) : null}

        {trip.joinStatus === "JOINED" ? (
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeave} activeOpacity={0.86}>
            <Ionicons name="exit-outline" size={19} color={Colors.error} />
            <Text style={styles.leaveButtonText}>Rời chuyến ghép đoàn</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.demoNotice}>
          Flow đang dùng mock data. Trạng thái sẽ reset khi reload toàn bộ ứng dụng.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function fitnessLabel(value: TrekkerFitnessLevel) {
  if (value === "BEGINNER") return "Cơ bản";
  if (value === "ADVANCED") return "Nâng cao";
  return "Trung bình";
}

function QuickInfo({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.quickInfoCard}>
      <Ionicons name={icon} size={18} color={Colors.primaryDark} />
      <Text style={styles.quickInfoValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.quickInfoLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={18} color={Colors.primaryDark} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Ionicons name={icon} size={17} color={Colors.primaryDark} />
      <View style={styles.flexOne}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: { paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  headerTextBlock: { flex: 1 },
  headerEyebrow: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 17, fontWeight: "900" },
  content: { padding: 14, paddingBottom: 46 },
  notFoundCard: { flex: 1, margin: 20, alignItems: "center", justifyContent: "center" },
  notFoundTitle: { marginTop: 10, color: Colors.onSurface, fontSize: 15, fontWeight: "900" },
  secondaryButton: { minHeight: 42, marginTop: 16, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  secondaryButtonText: { color: Colors.primaryDark, fontSize: 9, fontWeight: "900" },
  heroWrap: { height: 260, overflow: "hidden", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainer, ...Shadows.card },
  heroImage: { width: "100%", height: "100%" },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8,28,21,0.34)" },
  heroBadgeRow: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" },
  heroBadge: { paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: Radius.full, backgroundColor: "rgba(8,28,21,0.76)" },
  heroBadgeText: { color: Colors.onPrimaryDark, fontSize: 7, fontWeight: "900" },
  heroTextBlock: { position: "absolute", left: 15, right: 15, bottom: 15 },
  heroLocation: { color: Colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  heroTitleText: { marginTop: 4, color: Colors.onPrimaryDark, fontSize: 20, fontWeight: "900", lineHeight: 25 },
  quickInfoRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  quickInfoCard: { flex: 1, minHeight: 88, padding: 10, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  quickInfoValue: { width: "100%", marginTop: 5, color: Colors.onSurface, fontSize: 9, fontWeight: "900", textAlign: "center" },
  quickInfoLabel: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 7 },
  statusCard: { marginTop: 10, padding: 13, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: Radius.xl, backgroundColor: Colors.primaryPale },
  statusIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest },
  statusTitle: { color: Colors.inkDeep, fontSize: 11, fontWeight: "900" },
  statusDescription: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 8, lineHeight: 12 },
  sectionCard: { marginTop: 12, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  sectionHeader: { marginBottom: 11, flexDirection: "row", alignItems: "center", gap: 9 },
  sectionIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  sectionTitle: { color: Colors.onSurface, fontSize: 13, fontWeight: "900" },
  description: { color: Colors.onSurfaceVariant, fontSize: 9, lineHeight: 15 },
  tagRow: { marginTop: 11, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  tagText: { color: Colors.primaryDark, fontSize: 7, fontWeight: "800" },
  organizerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  organizerAvatar: { width: 52, height: 52, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer },
  organizerNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  organizerName: { color: Colors.onSurface, fontSize: 11, fontWeight: "900" },
  organizerRole: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8 },
  messageButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  infoRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  infoLabel: { color: Colors.onSurfaceMuted, fontSize: 7, fontWeight: "800" },
  infoValue: { marginTop: 3, color: Colors.onSurface, fontSize: 9, fontWeight: "800" },
  requirementRow: { marginBottom: 9, flexDirection: "row", alignItems: "center", gap: 9 },
  requirementCheck: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  requirementText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 9 },
  memberGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memberCard: { width: "31.7%", minHeight: 112, padding: 9, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLow },
  memberAvatar: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer },
  memberName: { width: "100%", marginTop: 7, color: Colors.onSurface, fontSize: 8, fontWeight: "900", textAlign: "center" },
  memberLevel: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 7 },
  openSlotCard: { borderWidth: 1, borderColor: Colors.primaryNeutral, borderStyle: "dashed", backgroundColor: Colors.primaryPale },
  openSlotIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLowest },
  primaryButton: { minHeight: 52, marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark, ...Shadows.hover },
  primaryButtonText: { color: Colors.onPrimaryDark, fontSize: 11, fontWeight: "900" },
  pendingButton: { minHeight: 52, marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: Colors.tertiaryFixed, borderRadius: Radius.full, backgroundColor: "#FFF8E8" },
  pendingButtonText: { color: Colors.warningDeep, fontSize: 11, fontWeight: "900" },
  leaveButton: { minHeight: 52, marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: Colors.errorContainer, borderRadius: Radius.full, backgroundColor: "#FEF2F2" },
  leaveButtonText: { color: Colors.error, fontSize: 11, fontWeight: "900" },
  demoNotice: { marginTop: 12, color: Colors.onSurfaceMuted, fontSize: 7, lineHeight: 11, textAlign: "center" },
});
