import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

export default function TrailDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const trailId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { trails, savedTrailIds, toggleSavedTrail } = useApp();
  const trail = trails.find((item) => item.id === trailId);

  if (!trail) return <SafeAreaView style={styles.safeArea}><View style={styles.notFound}><Text style={styles.notFoundTitle}>Không tìm thấy cung đường</Text><TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}><Text style={styles.primaryButtonText}>Quay lại</Text></TouchableOpacity></View></SafeAreaView>;

  const selectedTrailId = trail.id;
  const saved = savedTrailIds.includes(selectedTrailId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={21} color={Colors.onSurface} /></TouchableOpacity>
        <View style={styles.flexOne}><Text style={styles.headerEyebrow}>TRAIL DETAIL</Text><Text style={styles.headerTitle}>Thông tin cung đường</Text></View>
        <TouchableOpacity style={[styles.headerButton, saved && styles.savedButton]} onPress={() => toggleSavedTrail(selectedTrailId)}><Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={20} color={saved ? Colors.onPrimaryDark : Colors.primaryDark} /></TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}><Image source={{ uri: trail.imageUrl }} style={styles.heroImage} /><View style={styles.heroShade} /><View style={styles.heroText}><Text style={styles.heroRegion}>{trail.region}</Text><Text style={styles.heroTitleText}>{trail.name}</Text><View style={styles.rating}><Ionicons name="star" size={14} color="#F4A261" /><Text style={styles.ratingText}>{trail.rating} · {trail.reviewCount} đánh giá</Text></View></View></View>
        <View style={styles.statRow}><Stat icon="walk-outline" value={`${trail.distanceKm} km`} label="Quãng đường" /><Stat icon="trending-up-outline" value={`+${trail.elevationGainM} m`} label="Độ cao" /><Stat icon="time-outline" value={trail.duration} label="Thời lượng" /></View>
        <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Giới thiệu</Text><Text style={styles.description}>{trail.description}</Text><View style={styles.chipRow}><View style={styles.chip}><Text style={styles.chipText}>{trail.difficulty}</Text></View><View style={styles.chip}><Text style={styles.chipText}>{trail.terrainType}</Text></View></View></View>
        <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Điểm nổi bật</Text>{trail.highlights.map((item) => <View key={item} style={styles.listRow}><Ionicons name="checkmark-circle-outline" size={16} color={Colors.primaryDark} /><Text style={styles.listText}>{item}</Text></View>)}</View>
        <View style={styles.sectionCard}><Text style={styles.sectionTitle}>Checkpoint dự kiến</Text>{trail.checkpoints.map((checkpoint, index) => <View key={checkpoint.id} style={styles.checkpointRow}><View style={styles.checkpointNumber}><Text style={styles.checkpointNumberText}>{index + 1}</Text></View><View style={styles.flexOne}><Text style={styles.checkpointName}>{checkpoint.name}</Text><Text style={styles.checkpointMeta}>{checkpoint.distanceFromStartKm} km{checkpoint.elevation != null ? ` · cao ${checkpoint.elevation} m` : ""}</Text></View></View>)}</View>
        <TouchableOpacity style={styles.primaryButton} onPress={() => { toggleSavedTrail(selectedTrailId); Alert.alert(saved ? "Đã bỏ lưu" : "Đã lưu cung đường", saved ? "Cung đường đã được xóa khỏi bộ sưu tập." : "Bạn có thể xem lại trong Cung đường đã lưu."); }}><Ionicons name={saved ? "bookmark-outline" : "bookmark"} size={19} color={Colors.onPrimaryDark} /><Text style={styles.primaryButtonText}>{saved ? "Bỏ lưu cung đường" : "Lưu cung đường"}</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) { return <View style={styles.statCard}><Ionicons name={icon} size={18} color={Colors.primaryDark} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface }, flexOne: { flex: 1 }, header: { paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer }, headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow }, savedButton: { backgroundColor: Colors.primaryDark }, headerEyebrow: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 }, headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 17, fontWeight: "900" }, content: { padding: 14, paddingBottom: 44 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center" }, notFoundTitle: { color: Colors.onSurface, fontSize: 15, fontWeight: "900" }, heroWrap: { height: 280, overflow: "hidden", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainer, ...Shadows.card }, heroImage: { width: "100%", height: "100%" }, heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8,28,21,0.35)" }, heroText: { position: "absolute", left: 16, right: 16, bottom: 16 }, heroRegion: { color: Colors.primary, fontSize: 8, fontWeight: "900" }, heroTitleText: { marginTop: 4, color: Colors.onPrimaryDark, fontSize: 23, fontWeight: "900" }, rating: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 5 }, ratingText: { color: Colors.onPrimaryDark, fontSize: 8 },
  statRow: { marginTop: 10, flexDirection: "row", gap: 8 }, statCard: { flex: 1, minHeight: 84, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card }, statValue: { marginTop: 5, color: Colors.onSurface, fontSize: 10, fontWeight: "900" }, statLabel: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 7 }, sectionCard: { marginTop: 12, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card }, sectionTitle: { color: Colors.onSurface, fontSize: 13, fontWeight: "900" }, description: { marginTop: 8, color: Colors.onSurfaceVariant, fontSize: 9, lineHeight: 15 }, chipRow: { marginTop: 11, flexDirection: "row", gap: 7 }, chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.primaryPale }, chipText: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900" }, listRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 9 }, listText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 9 }, checkpointRow: { minHeight: 61, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer }, checkpointNumber: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark }, checkpointNumberText: { color: Colors.onPrimaryDark, fontSize: 9, fontWeight: "900" }, checkpointName: { color: Colors.onSurface, fontSize: 9, fontWeight: "900" }, checkpointMeta: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 7 }, primaryButton: { minHeight: 50, marginTop: 15, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark, ...Shadows.hover }, primaryButtonText: { color: Colors.onPrimaryDark, fontSize: 10, fontWeight: "900" },
});
