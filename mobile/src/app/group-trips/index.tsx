import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
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
import type { DifficultyLevel, GroupTrip, GroupTripJoinStatus } from "@/types";

type DifficultyFilter = "Tất cả" | DifficultyLevel;

const difficultyFilters: DifficultyFilter[] = [
  "Tất cả",
  "Dễ",
  "Trung bình",
  "Khó",
];

const joinStatusMeta: Record<
  GroupTripJoinStatus,
  { label: string; color: string; background: string }
> = {
  NONE: {
    label: "Còn chỗ",
    color: Colors.primaryDark,
    background: Colors.primaryPale,
  },
  PENDING: {
    label: "Đang chờ duyệt",
    color: Colors.warningDeep,
    background: Colors.tertiaryFixed,
  },
  JOINED: {
    label: "Đã tham gia",
    color: Colors.onPrimaryDark,
    background: Colors.primaryDark,
  },
};

export default function GroupTripsScreen() {
  const router = useRouter();
  const { groupTrips } = useApp();
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("Tất cả");
  const [onlyFollowing, setOnlyFollowing] = useState(false);

  const filteredTrips = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return groupTrips.filter((trip) => {
      const matchesQuery =
        !normalizedQuery ||
        trip.title.toLowerCase().includes(normalizedQuery) ||
        trip.destination.toLowerCase().includes(normalizedQuery) ||
        trip.province.toLowerCase().includes(normalizedQuery);
      const matchesDifficulty =
        difficulty === "Tất cả" || trip.difficulty === difficulty;
      const matchesFollowing =
        !onlyFollowing || trip.joinStatus !== "NONE";

      return matchesQuery && matchesDifficulty && matchesFollowing;
    });
  }, [difficulty, groupTrips, onlyFollowing, query]);

  const joinedCount = groupTrips.filter(
    (trip) => trip.joinStatus === "JOINED",
  ).length;
  const pendingCount = groupTrips.filter(
    (trip) => trip.joinStatus === "PENDING",
  ).length;

  function openDetail(groupTripId: string) {
    router.push({
      pathname: "/group-trips/[id]",
      params: { id: groupTripId },
    } as unknown as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>TREKKER MATCHING</Text>
          <Text style={styles.headerTitle}>Tìm chuyến ghép đoàn</Text>
        </View>
        <View style={styles.headerButton}>
          <Ionicons name="people" size={20} color={Colors.primaryDark} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroIcon}>
            <Ionicons name="people-circle" size={30} color={Colors.primary} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.heroTitle}>Không cần đi trek một mình</Text>
            <Text style={styles.heroText}>
              Tìm nhóm phù hợp lịch, thể lực và phong cách trải nghiệm của bạn.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard
            icon="checkmark-circle-outline"
            value={String(joinedCount)}
            label="Đã tham gia"
          />
          <SummaryCard
            icon="time-outline"
            value={String(pendingCount)}
            label="Chờ duyệt"
          />
          <SummaryCard
            icon="compass-outline"
            value={String(groupTrips.length)}
            label="Đang mở"
          />
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.onSurfaceMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm địa điểm hoặc tên chuyến..."
              placeholderTextColor={Colors.onSurfaceMuted}
              style={styles.searchInput}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color={Colors.onSurfaceMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {difficultyFilters.map((item) => {
              const selected = difficulty === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.filterChip, selected && styles.filterChipSelected]}
                  onPress={() => setDifficulty(item)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected && styles.filterChipTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.followingFilter, onlyFollowing && styles.followingFilterSelected]}
            onPress={() => setOnlyFollowing((current) => !current)}
          >
            <Ionicons
              name={onlyFollowing ? "checkbox" : "square-outline"}
              size={18}
              color={onlyFollowing ? Colors.primaryDark : Colors.onSurfaceMuted}
            />
            <Text style={styles.followingFilterText}>
              Chỉ hiện chuyến tôi đã tham gia hoặc đang chờ duyệt
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>GỢI Ý PHÙ HỢP</Text>
            <Text style={styles.sectionTitle}>Các nhóm đang tìm thành viên</Text>
          </View>
          <Text style={styles.resultCount}>{filteredTrips.length} kết quả</Text>
        </View>

        {filteredTrips.length ? (
          filteredTrips.map((trip) => (
            <GroupTripCard key={trip.id} trip={trip} onPress={() => openDetail(trip.id)} />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="search-outline" size={30} color={Colors.onSurfaceMuted} />
            <Text style={styles.emptyTitle}>Chưa tìm thấy chuyến phù hợp</Text>
            <Text style={styles.emptyText}>Thử đổi từ khóa hoặc bộ lọc độ khó.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={18} color={Colors.primaryDark} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function GroupTripCard({ trip, onPress }: { trip: GroupTrip; onPress: () => void }) {
  const status = joinStatusMeta[trip.joinStatus];
  const remaining = trip.maxMembers - trip.currentMembers;

  return (
    <TouchableOpacity style={styles.tripCard} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: trip.imageUrl }} style={styles.tripImage} />
        <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
          <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
        </View>
        <View style={styles.difficultyBadge}>
          <Ionicons name="pulse" size={12} color={Colors.onPrimaryDark} />
          <Text style={styles.difficultyText}>{trip.difficulty}</Text>
        </View>
      </View>

      <View style={styles.tripBody}>
        <Text style={styles.tripTitle}>{trip.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={Colors.primaryDark} />
          <Text style={styles.metaText}>{trip.destination} · {trip.province}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={Colors.primaryDark} />
          <Text style={styles.metaText}>{trip.startDate} · {trip.duration}</Text>
        </View>

        <View style={styles.organizerRow}>
          <Image source={{ uri: trip.organizer.avatar }} style={styles.organizerAvatar} />
          <View style={styles.flexOne}>
            <View style={styles.organizerNameRow}>
              <Text style={styles.organizerName}>{trip.organizer.name}</Text>
              {trip.organizer.verified ? (
                <Ionicons name="checkmark-circle" size={13} color={Colors.primaryDark} />
              ) : null}
            </View>
            <Text style={styles.organizerRole}>
              {trip.organizer.role === "LEADER" ? "Leader hệ thống" : "Trưởng nhóm Trekker"}
            </Text>
          </View>
          <View style={styles.memberCounter}>
            <Ionicons name="people" size={14} color={Colors.primaryDark} />
            <Text style={styles.memberCounterText}>{trip.currentMembers}/{trip.maxMembers}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.remainingText}>Còn {remaining} vị trí</Text>
            <Text style={styles.priceText}>{trip.priceEstimate.toLocaleString("vi-VN")}đ dự kiến</Text>
          </View>
          <View style={styles.detailButton}>
            <Text style={styles.detailButtonText}>Xem nhóm</Text>
            <Ionicons name="arrow-forward" size={15} color={Colors.onPrimaryDark} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
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
  content: { padding: 14, paddingBottom: 44 },
  heroCard: { overflow: "hidden", padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.card },
  heroGlow: { position: "absolute", right: -35, top: -50, width: 140, height: 140, borderRadius: Radius.full, backgroundColor: "rgba(159,232,112,0.12)" },
  heroIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: "rgba(159,232,112,0.12)" },
  heroTitle: { color: Colors.onPrimaryDark, fontSize: 14, fontWeight: "900" },
  heroText: { marginTop: 4, color: "#D9E8CF", fontSize: 9, lineHeight: 14 },
  summaryRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, minHeight: 82, padding: 10, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  summaryValue: { marginTop: 4, color: Colors.onSurface, fontSize: 16, fontWeight: "900" },
  summaryLabel: { marginTop: 2, color: Colors.onSurfaceMuted, fontSize: 7, fontWeight: "700", textAlign: "center" },
  searchCard: { marginTop: 12, padding: 12, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  searchBar: { minHeight: 46, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  searchInput: { flex: 1, color: Colors.onSurface, fontSize: 10 },
  filterRow: { paddingTop: 10, gap: 7 },
  filterChip: { minHeight: 35, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  filterChipSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  filterChipText: { color: Colors.onSurfaceVariant, fontSize: 8, fontWeight: "800" },
  filterChipTextSelected: { color: Colors.primaryDark },
  followingFilter: { marginTop: 10, paddingTop: 10, flexDirection: "row", alignItems: "center", gap: 7, borderTopWidth: 1, borderTopColor: Colors.surfaceContainer },
  followingFilterSelected: { opacity: 1 },
  followingFilterText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 8, lineHeight: 12 },
  sectionHeader: { marginTop: 20, marginBottom: 10, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionEyebrow: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  sectionTitle: { marginTop: 3, color: Colors.onSurface, fontSize: 14, fontWeight: "900" },
  resultCount: { color: Colors.onSurfaceMuted, fontSize: 8 },
  tripCard: { marginBottom: 13, overflow: "hidden", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  imageWrap: { height: 172, backgroundColor: Colors.surfaceContainer },
  tripImage: { width: "100%", height: "100%" },
  statusBadge: { position: "absolute", top: 11, left: 11, paddingHorizontal: 9, paddingVertical: 6, borderRadius: Radius.full },
  statusBadgeText: { fontSize: 7, fontWeight: "900" },
  difficultyBadge: { position: "absolute", top: 11, right: 11, paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: Radius.full, backgroundColor: "rgba(8,28,21,0.78)" },
  difficultyText: { color: Colors.onPrimaryDark, fontSize: 7, fontWeight: "900" },
  tripBody: { padding: 14 },
  tripTitle: { color: Colors.onSurface, fontSize: 14, fontWeight: "900", lineHeight: 19 },
  metaRow: { marginTop: 7, flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 8 },
  organizerRow: { marginTop: 13, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: 1, borderTopColor: Colors.surfaceContainer },
  organizerAvatar: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer },
  organizerNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  organizerName: { color: Colors.onSurface, fontSize: 9, fontWeight: "900" },
  organizerRole: { marginTop: 2, color: Colors.onSurfaceMuted, fontSize: 7 },
  memberCounter: { paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  memberCounterText: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900" },
  cardFooter: { marginTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  remainingText: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900" },
  priceText: { marginTop: 2, color: Colors.onSurfaceMuted, fontSize: 7 },
  detailButton: { minHeight: 38, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  detailButtonText: { color: Colors.onPrimaryDark, fontSize: 8, fontWeight: "900" },
  emptyCard: { minHeight: 190, padding: 20, alignItems: "center", justifyContent: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  emptyTitle: { marginTop: 10, color: Colors.onSurface, fontSize: 12, fontWeight: "900" },
  emptyText: { marginTop: 4, color: Colors.onSurfaceMuted, fontSize: 8 },
});
