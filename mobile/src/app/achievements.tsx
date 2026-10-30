import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

const achievements = [
  { id: "first-trip", icon: "flag", title: "Bước chân đầu tiên", description: "Hoàn thành chuyến trekking đầu tiên", required: 1, metric: "TRIPS" },
  { id: "five-trips", icon: "trail-sign", title: "Trail Explorer", description: "Hoàn thành 5 chuyến trekking", required: 5, metric: "TRIPS" },
  { id: "distance-100", icon: "navigate", title: "Centurion", description: "Tích lũy 100 km trekking", required: 100, metric: "DISTANCE" },
  { id: "trail-maker", icon: "map", title: "Trail Maker", description: "Tạo ít nhất 1 cung đường cá nhân", required: 1, metric: "TRAILS" },
  { id: "community", icon: "people", title: "Community Voice", description: "Đăng ít nhất 3 bài chia sẻ", required: 3, metric: "POSTS" },
  { id: "points-1000", icon: "ribbon", title: "Mountain Legend", description: "Đạt 1.000 điểm thành tích", required: 1000, metric: "POINTS" },
] as const;

export default function TrekkerAchievementsScreen() {
  const router = useRouter();
  const { user, trips, personalTrails, communityPosts } = useApp();
  const completedTrips = Math.max(user.completedTripsCount, trips.filter((trip) => trip.status === "COMPLETED").length);

  function metricValue(metric: (typeof achievements)[number]["metric"]) {
    if (metric === "TRIPS") return completedTrips;
    if (metric === "DISTANCE") return user.totalDistanceKm;
    if (metric === "TRAILS") return personalTrails.length;
    if (metric === "POSTS") return communityPosts.filter((post) => post.author.id === user.id).length;
    return user.savedPoints;
  }

  const unlockedCount = achievements.filter((item) => metricValue(item.metric) >= item.required).length;
  const levelProgress = Math.min(100, Math.round((user.savedPoints / 1000) * 100));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}><TouchableOpacity style={styles.headerButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={21} color={Colors.onSurface} /></TouchableOpacity><View style={styles.flexOne}><Text style={styles.headerEyebrow}>TREKKER PROGRESS</Text><Text style={styles.headerTitle}>Thành tích & Cấp độ</Text></View><View style={styles.headerButton}><Ionicons name="trophy" size={20} color={Colors.primaryDark} /></View></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}><View style={styles.levelCircle}><Text style={styles.levelNumber}>3</Text><Text style={styles.levelLabel}>LEVEL</Text></View><View style={styles.flexOne}><Text style={styles.heroEyebrow}>MOUNTAIN EXPLORER</Text><Text style={styles.heroTitle}>{user.name}</Text><Text style={styles.heroText}>{user.savedPoints} / 1.000 điểm để đạt Mountain Legend</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${levelProgress}%` as `${number}%` }]} /></View></View></View>

        <View style={styles.statRow}><Stat icon="flag" value={String(completedTrips)} label="Chuyến" /><Stat icon="navigate" value={`${user.totalDistanceKm}`} label="Kilômét" /><Stat icon="trophy" value={`${unlockedCount}/${achievements.length}`} label="Huy hiệu" /></View>

        <View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>BADGE COLLECTION</Text><Text style={styles.sectionTitle}>Huy hiệu của bạn</Text></View><Text style={styles.sectionCount}>{unlockedCount} đã mở</Text></View>

        <View style={styles.badgeGrid}>
          {achievements.map((achievement) => {
            const current = metricValue(achievement.metric);
            const unlocked = current >= achievement.required;
            const progress = Math.min(100, Math.round((current / achievement.required) * 100));
            return <View key={achievement.id} style={[styles.badgeCard, !unlocked && styles.badgeLocked]}><View style={[styles.badgeIcon, unlocked && styles.badgeIconUnlocked]}><Ionicons name={achievement.icon} size={27} color={unlocked ? Colors.onPrimaryDark : Colors.onSurfaceMuted} /></View><Text style={styles.badgeTitle}>{achievement.title}</Text><Text style={styles.badgeDescription}>{achievement.description}</Text>{unlocked ? <View style={styles.unlockedPill}><Ionicons name="checkmark-circle" size={12} color={Colors.primaryDark} /><Text style={styles.unlockedText}>ĐÃ MỞ KHÓA</Text></View> : <><View style={styles.smallProgress}><View style={[styles.smallProgressFill, { width: `${progress}%` as `${number}%` }]} /></View><Text style={styles.progressText}>{current}/{achievement.required}</Text></>}</View>;
          })}
        </View>

        <View style={styles.nextLevelCard}><View style={styles.nextLevelIcon}><Ionicons name="trail-sign-outline" size={26} color={Colors.primaryDark} /></View><View style={styles.flexOne}><Text style={styles.nextLevelTitle}>Cấp tiếp theo: Mountain Legend</Text><Text style={styles.nextLevelText}>Hoàn thành thêm chuyến, tạo cung đường và chia sẻ Community để tích điểm.</Text></View></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) { return <View style={styles.statCard}><Ionicons name={icon} size={18} color={Colors.primaryDark} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface }, flexOne: { flex: 1 }, header: { paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer }, headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow }, headerEyebrow: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 }, headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 17, fontWeight: "900" }, content: { padding: 14, paddingBottom: 44 },
  heroCard: { overflow: "hidden", padding: 17, flexDirection: "row", alignItems: "center", gap: 14, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.card }, levelCircle: { width: 76, height: 76, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: Colors.primary, borderRadius: Radius.full, backgroundColor: "rgba(159,232,112,0.12)" }, levelNumber: { color: Colors.onPrimaryDark, fontSize: 26, fontWeight: "900" }, levelLabel: { color: Colors.primary, fontSize: 6, fontWeight: "900", letterSpacing: 1 }, heroEyebrow: { color: Colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 }, heroTitle: { marginTop: 4, color: Colors.onPrimaryDark, fontSize: 16, fontWeight: "900" }, heroText: { marginTop: 5, color: "#D9E8CF", fontSize: 8 }, progressTrack: { height: 6, marginTop: 10, overflow: "hidden", borderRadius: Radius.full, backgroundColor: "rgba(255,255,255,0.12)" }, progressFill: { height: "100%", borderRadius: Radius.full, backgroundColor: Colors.primary },
  statRow: { marginTop: 10, flexDirection: "row", gap: 8 }, statCard: { flex: 1, minHeight: 84, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card }, statValue: { marginTop: 4, color: Colors.onSurface, fontSize: 15, fontWeight: "900" }, statLabel: { marginTop: 2, color: Colors.onSurfaceMuted, fontSize: 7 }, sectionHeader: { marginTop: 20, marginBottom: 10, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }, sectionEyebrow: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 }, sectionTitle: { marginTop: 3, color: Colors.onSurface, fontSize: 14, fontWeight: "900" }, sectionCount: { color: Colors.onSurfaceMuted, fontSize: 8 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, badgeCard: { width: "48.8%", minHeight: 205, padding: 13, alignItems: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card }, badgeLocked: { opacity: 0.64 }, badgeIcon: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow }, badgeIconUnlocked: { backgroundColor: Colors.primaryDark }, badgeTitle: { marginTop: 10, color: Colors.onSurface, fontSize: 10, fontWeight: "900", textAlign: "center" }, badgeDescription: { minHeight: 34, marginTop: 5, color: Colors.onSurfaceMuted, fontSize: 7, lineHeight: 11, textAlign: "center" }, unlockedPill: { marginTop: 12, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: Radius.full, backgroundColor: Colors.primaryPale }, unlockedText: { color: Colors.primaryDark, fontSize: 6, fontWeight: "900" }, smallProgress: { width: "100%", height: 5, marginTop: 13, overflow: "hidden", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer }, smallProgressFill: { height: "100%", backgroundColor: Colors.primaryDark }, progressText: { marginTop: 5, color: Colors.onSurfaceMuted, fontSize: 7 }, nextLevelCard: { marginTop: 13, padding: 14, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: Radius.xl, backgroundColor: Colors.primaryPale }, nextLevelIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest }, nextLevelTitle: { color: Colors.inkDeep, fontSize: 11, fontWeight: "900" }, nextLevelText: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 8, lineHeight: 13 },
});
