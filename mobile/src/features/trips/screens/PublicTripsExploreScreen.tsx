/**
 * PublicTripsExploreScreen — feed khám phá chuyến công khai.
 * UI: ScreenHeader + ErrorAlert/LoadingState/EmptyState theo bộ @/components/ui.
 * Logic (usePublicTrips, filter, phân trang) giữ nguyên.
 */
import {
  EmptyState,
  ErrorAlert,
  LoadingState,
  ScreenHeader,
} from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/designTokens";
import { TripCard } from "@/features/trips/components";
import { usePublicTrips } from "@/features/trips/hooks";
import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DIFFICULTY_FILTERS = ["Tất cả", "EASY", "MEDIUM", "HARD", "EXTREME"];
const DIFFICULTY_LABELS: Record<string, string> = {
  "Tất cả": "Tất cả",
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
  EXTREME: "Thách thức",
};

export function PublicTripsExploreScreen() {
  const router = useRouter();

  const {
    trips,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
    setDifficulty,
    filter,
  } = usePublicTrips();

  const [search, setSearch] = useState("");

  const currentDifficulty = filter.difficulty || "Tất cả";

  const filteredTrips = useMemo(() => {
    if (!search.trim()) return trips;
    const query = search.toLowerCase();
    return trips.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.destination.name.toLowerCase().includes(query),
    );
  }, [trips, search]);

  const handleTripPress = useCallback(
    (id: string) => {
      router.push({
        pathname: "/trips/[id]",
        params: { id },
      } as unknown as Href);
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <ScreenHeader
        onBack={() => router.back()}
        eyebrow="Vina TrekGO · Khám phá"
        title="Chuyến công khai"
        subtitle="Khám phá & đặt chỗ theo đoàn"
      />

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={16}
            color={Colors.textSecondary}
            style={{ marginRight: Spacing.sm }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm chuyến, địa danh..."
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Difficulty Filters */}
      <View style={styles.filterRow}>
        {DIFFICULTY_FILTERS.map((d) => (
          <Pressable
            key={d}
            style={({ pressed }) => [
              styles.filterPill,
              currentDifficulty === d && styles.filterPillActive,
              pressed && styles.filterPillPressed,
            ]}
            onPress={() => setDifficulty(d)}
          >
            <Text
              style={[
                styles.filterPillText,
                currentDifficulty === d && styles.filterPillTextActive,
              ]}
            >
              {DIFFICULTY_LABELS[d]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Error Banner with Retry */}
      {error ? (
        <ErrorAlert
          message={error}
          onRetry={refresh}
          style={styles.errorBox}
        />
      ) : null}

      {/* Trips List */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard trip={item} onPress={() => handleTripPress(item.id)} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={refresh}
        refreshing={refreshing}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          loading ? (
            <LoadingState label="Đang tải danh sách chuyến…" style={styles.stateBlock} />
          ) : (
            <EmptyState
              icon={
                <View style={styles.emptyIcon}>
                  <Ionicons name="map-outline" size={34} color={Colors.primary} />
                </View>
              }
              title="Chưa có chuyến nào"
              description="Kéo xuống để làm mới hoặc thử bộ lọc khác"
              style={styles.stateBlock}
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.canvas },

  searchSection: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  searchBar: {
    minHeight: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: Spacing.sm },

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillPressed: { backgroundColor: Colors.surfaceMuted },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterPillTextActive: { color: "#FFFFFF" },

  errorBox: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },

  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 30,
    gap: Spacing.md,
  },
  stateBlock: { marginTop: Spacing.xl },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  footerLoader: { paddingVertical: Spacing.xl, alignItems: "center" },
});
