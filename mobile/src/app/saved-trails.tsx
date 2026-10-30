import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import type { Trail } from "@/types";

export default function SavedTrailsScreen() {
  const router = useRouter();
  const { trails, savedTrailIds, toggleSavedTrail } = useApp();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const visibleTrails = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return trails.filter((trail) => {
      const matchesMode = showAll || savedTrailIds.includes(trail.id);
      const matchesQuery = !normalized || trail.name.toLowerCase().includes(normalized) || trail.region.toLowerCase().includes(normalized);
      return matchesMode && matchesQuery;
    });
  }, [query, savedTrailIds, showAll, trails]);

  function openTrail(trailId: string) {
    router.push({ pathname: "/trails/[id]", params: { id: trailId } } as unknown as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.headerEyebrow}>TRAIL COLLECTION</Text>
          <Text style={styles.headerTitle}>Cung đường đã lưu</Text>
        </View>
        <View style={styles.countBadge}><Text style={styles.countText}>{savedTrailIds.length}</Text></View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}><Ionicons name="bookmark" size={27} color={Colors.primary} /></View>
          <View style={styles.flexOne}>
            <Text style={styles.heroTitle}>Bộ sưu tập trekking của bạn</Text>
            <Text style={styles.heroText}>Lưu lại các cung muốn trải nghiệm để chuẩn bị lịch và thiết bị sau.</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.onSurfaceMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Tìm tên cung hoặc khu vực..." placeholderTextColor={Colors.onSurfaceMuted} style={styles.searchInput} />
        </View>

        <View style={styles.segmentRow}>
          <TouchableOpacity style={[styles.segmentButton, !showAll && styles.segmentSelected]} onPress={() => setShowAll(false)}>
            <Text style={[styles.segmentText, !showAll && styles.segmentTextSelected]}>Đã lưu ({savedTrailIds.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentButton, showAll && styles.segmentSelected]} onPress={() => setShowAll(true)}>
            <Text style={[styles.segmentText, showAll && styles.segmentTextSelected]}>Khám phá thêm</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{showAll ? "Tất cả cung đường" : "Danh sách yêu thích"}</Text>
          <Text style={styles.resultText}>{visibleTrails.length} kết quả</Text>
        </View>

        {visibleTrails.length ? visibleTrails.map((trail) => (
          <TrailCard key={trail.id} trail={trail} saved={savedTrailIds.includes(trail.id)} onToggle={() => toggleSavedTrail(trail.id)} onOpen={() => openTrail(trail.id)} />
        )) : (
          <View style={styles.emptyCard}>
            <Ionicons name="bookmark-outline" size={34} color={Colors.onSurfaceMuted} />
            <Text style={styles.emptyTitle}>Chưa có cung đường đã lưu</Text>
            <Text style={styles.emptyText}>Chuyển sang Khám phá thêm và bấm biểu tượng bookmark.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setShowAll(true)}><Text style={styles.primaryButtonText}>Khám phá cung đường</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TrailCard({ trail, saved, onToggle, onOpen }: { trail: Trail; saved: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <TouchableOpacity style={styles.trailCard} onPress={onOpen} activeOpacity={0.86}>
      <Image source={{ uri: trail.imageUrl }} style={styles.trailImage} />
      <View style={styles.trailInfo}>
        <View style={styles.trailTitleRow}>
          <View style={styles.flexOne}>
            <Text style={styles.trailName} numberOfLines={1}>{trail.name}</Text>
            <Text style={styles.trailRegion}>{trail.region}</Text>
          </View>
          <TouchableOpacity style={[styles.bookmarkButton, saved && styles.bookmarkSelected]} onPress={(event) => { event.stopPropagation(); onToggle(); }}>
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={19} color={saved ? Colors.onPrimaryDark : Colors.primaryDark} />
          </TouchableOpacity>
        </View>
        <View style={styles.metaRow}>
          <Meta icon="pulse-outline" text={trail.difficulty} />
          <Meta icon="walk-outline" text={`${trail.distanceKm} km`} />
          <Meta icon="trending-up-outline" text={`+${trail.elevationGainM} m`} />
        </View>
        <View style={styles.footerRow}>
          <View style={styles.ratingRow}><Ionicons name="star" size={13} color="#F4A261" /><Text style={styles.ratingText}>{trail.rating} · {trail.reviewCount} đánh giá</Text></View>
          <Ionicons name="chevron-forward" size={18} color={Colors.primaryDark} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.metaItem}><Ionicons name={icon} size={13} color={Colors.primaryDark} /><Text style={styles.metaText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface }, flexOne: { flex: 1 },
  header: { paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  headerEyebrow: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 }, headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 17, fontWeight: "900" },
  countBadge: { minWidth: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale }, countText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "900" },
  content: { padding: 14, paddingBottom: 42 }, heroCard: { padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.card },
  heroIcon: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: "rgba(159,232,112,0.12)" }, heroTitle: { color: Colors.onPrimaryDark, fontSize: 13, fontWeight: "900" }, heroText: { marginTop: 4, color: "#D9E8CF", fontSize: 8, lineHeight: 13 },
  searchBar: { minHeight: 46, marginTop: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLowest }, searchInput: { flex: 1, color: Colors.onSurface, fontSize: 10 },
  segmentRow: { marginTop: 10, padding: 4, flexDirection: "row", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow }, segmentButton: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.full }, segmentSelected: { backgroundColor: Colors.primaryDark }, segmentText: { color: Colors.onSurfaceVariant, fontSize: 8, fontWeight: "900" }, segmentTextSelected: { color: Colors.onPrimaryDark },
  sectionHeader: { marginTop: 18, marginBottom: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: Colors.onSurface, fontSize: 14, fontWeight: "900" }, resultText: { color: Colors.onSurfaceMuted, fontSize: 8 },
  trailCard: { marginBottom: 11, overflow: "hidden", flexDirection: "row", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card }, trailImage: { width: 112, minHeight: 154, backgroundColor: Colors.surfaceContainer }, trailInfo: { flex: 1, padding: 12 }, trailTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, trailName: { color: Colors.onSurface, fontSize: 12, fontWeight: "900" }, trailRegion: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8 },
  bookmarkButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale }, bookmarkSelected: { backgroundColor: Colors.primaryDark }, metaRow: { marginTop: 13, flexDirection: "row", flexWrap: "wrap", gap: 7 }, metaItem: { paddingHorizontal: 7, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow }, metaText: { color: Colors.onSurfaceVariant, fontSize: 7, fontWeight: "800" },
  footerRow: { marginTop: 13, paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: Colors.surfaceContainer }, ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 }, ratingText: { color: Colors.onSurfaceMuted, fontSize: 7 },
  emptyCard: { minHeight: 230, padding: 20, alignItems: "center", justifyContent: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card }, emptyTitle: { marginTop: 10, color: Colors.onSurface, fontSize: 12, fontWeight: "900" }, emptyText: { marginTop: 5, color: Colors.onSurfaceMuted, fontSize: 8, textAlign: "center" }, primaryButton: { minHeight: 42, marginTop: 14, paddingHorizontal: 17, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark }, primaryButtonText: { color: Colors.onPrimaryDark, fontSize: 9, fontWeight: "900" },
});
