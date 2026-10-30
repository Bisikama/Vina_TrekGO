import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
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

import { TopHeader } from "@/components/TopHeader";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  route: Href;
  badge?: string;
  accent?: "GREEN" | "ORANGE" | "RED";
};

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const {
    user,
    trekkerAccount,
    trips,
    personalTrails,
    rentalOrders,
    communityPosts,
    groupTrips,
    userNotifications,
    savedTrailIds,
  } = useApp();

  const completedTrips = trips.filter((trip) => trip.status === "COMPLETED").length;
  const upcomingTrips = trips.filter((trip) => trip.status === "UPCOMING").length;
  const ownPosts = communityPosts.filter((post) => post.author.id === user.id).length;
  const accountFields = [
    user.name,
    user.email,
    trekkerAccount.phone,
    trekkerAccount.dateOfBirth,
    trekkerAccount.address,
    trekkerAccount.bloodType,
    trekkerAccount.emergencyContact.name,
    trekkerAccount.emergencyContact.phone,
  ];
  const profileCompletion = Math.round(
    (accountFields.filter((value) => value.trim().length > 0).length /
      accountFields.length) *
      100,
  );

  const menuItems: MenuItem[] = [
    {
      icon: "person-outline",
      title: "Thông tin cá nhân",
      subtitle: "Tên, số điện thoại, ngày sinh và địa chỉ",
      route: "/profile/edit" as Href,
      badge: `${profileCompletion}%`,
      accent: "GREEN",
    },
    {
      icon: "heart-outline",
      title: "Sức khỏe trekking",
      subtitle: `${trekkerAccount.bloodType} · ${fitnessLabel(trekkerAccount.fitnessLevel)}`,
      route: "/profile/health" as Href,
      accent: "RED",
    },
    {
      icon: "call-outline",
      title: "Liên hệ khẩn cấp",
      subtitle: `${trekkerAccount.emergencyContact.name} · ${trekkerAccount.emergencyContact.relationship}`,
      route: "/profile/emergency" as Href,
      accent: "ORANGE",
    },
    {
      icon: "settings-outline",
      title: "Cài đặt tài khoản",
      subtitle: "Thông báo, quyền riêng tư và bảo mật",
      route: "/profile/settings" as Href,
    },
    {
      icon: "notifications-outline",
      title: "Thông báo",
      subtitle: "Booking, rental, ghép đoàn và xác minh Trail",
      route: "/notifications" as Href,
      badge: String(userNotifications.filter((item) => !item.isRead).length),
      accent: "ORANGE",
    },
    {
      icon: "bookmark-outline",
      title: "Cung đường đã lưu",
      subtitle: "Bộ sưu tập Trail muốn trải nghiệm",
      route: "/saved-trails" as Href,
      badge: String(savedTrailIds.length),
      accent: "GREEN",
    },
    {
      icon: "trophy-outline",
      title: "Thành tích & Cấp độ",
      subtitle: "Huy hiệu, điểm và tiến độ Trekker",
      route: "/achievements" as Href,
    },
    {
      icon: "help-circle-outline",
      title: "Trợ giúp & Hỗ trợ",
      subtitle: "FAQ, chính sách và gửi yêu cầu",
      route: "/help" as Href,
    },
  ];

  function openCommunityProfile() {
    router.push({
      pathname: "/community/profiles/[userId]",
      params: { userId: user.id },
    } as unknown as Href);
  }

  function confirmLogout() {
    Alert.alert(
      "Đăng xuất tài khoản",
      "Phiên đăng nhập trên thiết bị sẽ được xóa. Bạn có chắc muốn đăng xuất?",
      [
        { text: "Ở lại", style: "cancel" },
        {
          text: "Đăng xuất",
          style: "destructive",
          onPress: () => void signOut(),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopHeader subtitle="Profile" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
              <View style={styles.onlineDot} />
            </View>

            <View style={styles.identityBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.userName}>{user.name}</Text>
                <Ionicons name="checkmark-circle" size={17} color={Colors.primary} />
              </View>
              <Text style={styles.userEmail}>{user.email}</Text>
              <View style={styles.levelPill}>
                <Ionicons name="footsteps" size={12} color={Colors.ink} />
                <Text style={styles.levelPillText}>MOUNTAIN EXPLORER · LV.3</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push("/profile/edit" as Href)}
            >
              <Ionicons name="create-outline" size={19} color={Colors.onPrimaryDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.completionRow}>
            <View style={styles.completionTextBlock}>
              <Text style={styles.completionTitle}>Hồ sơ đã hoàn thiện {profileCompletion}%</Text>
              <Text style={styles.completionDescription}>
                Hồ sơ đầy đủ giúp Leader hỗ trợ bạn tốt hơn khi đi trek.
              </Text>
            </View>
            <View style={styles.completionBadge}>
              <Text style={styles.completionBadgeText}>{profileCompletion}%</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${profileCompletion}%` as `${number}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatCard icon="flag" value={String(user.completedTripsCount || completedTrips)} label="Chuyến hoàn thành" />
          <StatCard icon="navigate" value={`${user.totalDistanceKm}`} label="Kilômét trekking" />
          <StatCard icon="trail-sign" value={String(personalTrails.length)} label="Cung cá nhân" />
          <StatCard icon="ribbon" value={String(user.savedPoints)} label="Điểm thành tích" />
        </View>

        <View style={styles.safetyCard}>
          <View style={styles.safetyHeader}>
            <View style={styles.safetyIcon}>
              <Ionicons name="shield-checkmark" size={23} color={Colors.primaryDark} />
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.safetyTitle}>Hồ sơ an toàn đã sẵn sàng</Text>
              <Text style={styles.safetySubtitle}>
                Nhóm máu và liên hệ khẩn cấp đã được cập nhật.
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={Colors.primaryDark} />
          </View>
          <View style={styles.safetyInfoRow}>
            <View style={styles.safetyInfoItem}>
              <Text style={styles.safetyInfoLabel}>NHÓM MÁU</Text>
              <Text style={styles.safetyInfoValue}>{trekkerAccount.bloodType}</Text>
            </View>
            <View style={styles.safetyDivider} />
            <View style={styles.safetyInfoItem}>
              <Text style={styles.safetyInfoLabel}>THỂ LỰC</Text>
              <Text style={styles.safetyInfoValue}>{fitnessLabel(trekkerAccount.fitnessLevel)}</Text>
            </View>
            <View style={styles.safetyDivider} />
            <View style={styles.safetyInfoItem}>
              <Text style={styles.safetyInfoLabel}>KHẨN CẤP</Text>
              <Text style={styles.safetyInfoValue} numberOfLines={1}>
                {trekkerAccount.emergencyContact.name}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tài khoản & An toàn</Text>
          <Text style={styles.sectionEyebrow}>TREKKER PROFILE</Text>
        </View>

        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.title}
              style={[styles.menuRow, index < menuItems.length - 1 && styles.menuRowBorder]}
              onPress={() => router.push(item.route)}
              activeOpacity={0.82}
            >
              <View
                style={[
                  styles.menuIcon,
                  item.accent === "GREEN" && styles.menuIconGreen,
                  item.accent === "ORANGE" && styles.menuIconOrange,
                  item.accent === "RED" && styles.menuIconRed,
                ]}
              >
                <Ionicons name={item.icon} size={19} color={Colors.primaryDark} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle} numberOfLines={1}>{item.subtitle}</Text>
              </View>
              {item.badge ? (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{item.badge}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hoạt động của tôi</Text>
          <Text style={styles.sectionCount}>{upcomingTrips} chuyến sắp tới</Text>
        </View>

        <View style={styles.activityGrid}>
          <ActivityButton
            icon="ticket-outline"
            title="Chuyến đi"
            detail={`${trips.length} hồ sơ`}
            onPress={() => router.push("/(tabs)/trips" as Href)}
          />
          <ActivityButton
            icon="map-outline"
            title="Cung cá nhân"
            detail={`${personalTrails.length} cung`}
            onPress={() => router.push("/personal-trails" as Href)}
          />
          <ActivityButton
            icon="cube-outline"
            title="Đơn thuê"
            detail={`${rentalOrders.length} đơn`}
            onPress={() => router.push("/(tabs)/rental" as Href)}
          />
          <ActivityButton
            icon="person-add-outline"
            title="Ghép đoàn"
            detail={`${groupTrips.filter((trip) => trip.joinStatus !== "NONE").length} đang theo dõi`}
            onPress={() => router.push("/group-trips" as Href)}
          />
          <ActivityButton
            icon="people-outline"
            title="Community"
            detail={`${ownPosts} bài viết`}
            onPress={openCommunityProfile}
          />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout} activeOpacity={0.84}>
          <Ionicons name="log-out-outline" size={19} color={Colors.error} />
          <Text style={styles.logoutText}>Đăng xuất tài khoản</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>TrekGo Mobile · Demo User UI v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function fitnessLabel(value: "BEGINNER" | "INTERMEDIATE" | "ADVANCED") {
  if (value === "BEGINNER") return "Cơ bản";
  if (value === "ADVANCED") return "Nâng cao";
  return "Trung bình";
}

function StatCard({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={17} color={Colors.primaryDark} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityButton({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.activityButton} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.activityIcon}>
        <Ionicons name={icon} size={20} color={Colors.primaryDark} />
      </View>
      <Text style={styles.activityTitle}>{title}</Text>
      <Text style={styles.activityDetail}>{detail}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  scrollContent: { padding: 14, paddingBottom: 96 },
  flexOne: { flex: 1 },
  heroCard: { overflow: "hidden", padding: 16, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.card },
  heroGlowOne: { position: "absolute", top: -70, right: -40, width: 170, height: 170, borderRadius: Radius.full, backgroundColor: "rgba(159, 232, 112, 0.12)" },
  heroGlowTwo: { position: "absolute", bottom: -80, left: -45, width: 150, height: 150, borderRadius: Radius.full, backgroundColor: "rgba(159, 232, 112, 0.08)" },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  avatar: { width: 72, height: 72, borderWidth: 3, borderColor: Colors.primary, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer },
  onlineDot: { position: "absolute", right: 2, bottom: 3, width: 14, height: 14, borderWidth: 2, borderColor: Colors.inkDeep, borderRadius: Radius.full, backgroundColor: Colors.primary },
  identityBlock: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  userName: { flexShrink: 1, color: Colors.onPrimaryDark, fontSize: 18, fontWeight: "900" },
  userEmail: { marginTop: 3, color: "#D9E8CF", fontSize: 9 },
  levelPill: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: Radius.full, backgroundColor: Colors.primary },
  levelPillText: { color: Colors.ink, fontSize: 7, fontWeight: "900", letterSpacing: 0.4 },
  editButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: "rgba(255,255,255,0.12)" },
  completionRow: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  completionTextBlock: { flex: 1 },
  completionTitle: { color: Colors.onPrimaryDark, fontSize: 10, fontWeight: "900" },
  completionDescription: { marginTop: 3, color: "#D9E8CF", fontSize: 8, lineHeight: 12 },
  completionBadge: { width: 44, height: 30, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: "rgba(159,232,112,0.16)" },
  completionBadgeText: { color: Colors.primary, fontSize: 9, fontWeight: "900" },
  progressTrack: { height: 6, marginTop: 10, overflow: "hidden", borderRadius: Radius.full, backgroundColor: "rgba(255,255,255,0.12)" },
  progressFill: { height: "100%", borderRadius: Radius.full, backgroundColor: Colors.primary },
  statGrid: { marginTop: 12, flexDirection: "row", gap: 8 },
  statCard: { flex: 1, minHeight: 92, padding: 10, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  statValue: { marginTop: 5, color: Colors.onSurface, fontSize: 15, fontWeight: "900" },
  statLabel: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 7, lineHeight: 10, textAlign: "center" },
  safetyCard: { marginTop: 12, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.primaryPale },
  safetyHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  safetyIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest },
  safetyTitle: { color: Colors.inkDeep, fontSize: 11, fontWeight: "900" },
  safetySubtitle: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 8, lineHeight: 12 },
  safetyInfoRow: { marginTop: 13, paddingTop: 12, flexDirection: "row", borderTopWidth: 1, borderTopColor: Colors.primaryNeutral },
  safetyInfoItem: { flex: 1, alignItems: "center" },
  safetyInfoLabel: { color: Colors.onSurfaceMuted, fontSize: 6, fontWeight: "900", letterSpacing: 0.5 },
  safetyInfoValue: { marginTop: 4, color: Colors.inkDeep, fontSize: 9, fontWeight: "900" },
  safetyDivider: { width: 1, height: 28, backgroundColor: Colors.primaryNeutral },
  sectionHeader: { marginTop: 20, marginBottom: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: Colors.onSurface, fontSize: 14, fontWeight: "900" },
  sectionEyebrow: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  sectionCount: { color: Colors.onSurfaceMuted, fontSize: 8 },
  menuCard: { overflow: "hidden", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  menuRow: { minHeight: 68, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  menuIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLow },
  menuIconGreen: { backgroundColor: Colors.primaryPale },
  menuIconOrange: { backgroundColor: Colors.tertiaryFixed },
  menuIconRed: { backgroundColor: Colors.errorContainer },
  menuInfo: { flex: 1 },
  menuTitle: { color: Colors.onSurface, fontSize: 11, fontWeight: "900" },
  menuSubtitle: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8 },
  menuBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  menuBadgeText: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900" },
  activityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  activityButton: { width: "48.8%", minHeight: 112, padding: 13, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  activityIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  activityTitle: { marginTop: 10, color: Colors.onSurface, fontSize: 11, fontWeight: "900" },
  activityDetail: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8 },
  logoutButton: { minHeight: 48, marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: Colors.errorContainer, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLowest },
  logoutText: { color: Colors.error, fontSize: 10, fontWeight: "900" },
  versionText: { marginTop: 14, color: Colors.onSurfaceMuted, fontSize: 8, textAlign: "center" },
});
