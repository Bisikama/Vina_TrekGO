import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePrivateTripMembers } from "../hooks/usePrivateTripMembers";
import { useRemoveTripMember } from "../hooks/useRemoveTripMember";
import type { TripMember } from "../types";
import { TripRoomMemberItem } from "./TripRoomMemberItem";

export interface TripRoomMemberListProps {
  tripId?: string;
  members?: TripMember[];
  canRemoveMembers?: boolean;
  tripStatus?: string;
  maxPax?: number;
  activeMemberCount?: number;
  onRemoveMember?: (member: TripMember) => void;
  onMemberRemoved?: (member: TripMember) => void;
}

export function TripRoomMemberList({
  tripId,
  members: propMembers,
  canRemoveMembers = false,
  tripStatus = "OPEN",
  maxPax,
  activeMemberCount: propActiveCount,
  onRemoveMember,
  onMemberRemoved,
}: TripRoomMemberListProps) {
  const [filter, setFilter] = useState<"ACTIVE" | "ALL">("ACTIVE");

  // If members not provided, fetch via hook with status filter
  const shouldFetch = !propMembers && Boolean(tripId);
  const {
    members: apiMembers,
    activeCount: hookActiveCount,
    capacity: hookCapacity,
    loading: loadingMembers,
    refetch,
  } = usePrivateTripMembers(
    tripId,
    { status: filter },
    shouldFetch,
  );

  const { removeMember, loading: removing } = useRemoveTripMember();

  const rawMembers = propMembers || apiMembers || [];
  const displayMembers =
    filter === "ACTIVE"
      ? rawMembers.filter((m) => m && m.status === "ACTIVE")
      : rawMembers;

  const totalActive =
    propActiveCount !== undefined
      ? propActiveCount
      : hookActiveCount || rawMembers.filter((m) => m && m.status === "ACTIVE").length;
  const capacity = maxPax !== undefined ? maxPax : hookCapacity || 0;

  const handleFilterChange = (nextFilter: "ACTIVE" | "ALL") => {
    setFilter(nextFilter);
    if (shouldFetch) {
      void refetch(tripId, nextFilter);
    }
  };

  async function handleRemove(member: TripMember) {
    if (onRemoveMember) {
      onRemoveMember(member);
      return;
    }

    if (!tripId) return;

    const shortId = member.userId ? ` (ID: #${member.userId.slice(0, 8)})` : "";
    Alert.alert(
      "Xác nhận loại thành viên",
      `Bạn có chắc chắn muốn loại "${member.displayName || "Thành viên"}"${shortId} khỏi chuyến đi?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Loại khỏi đoàn",
          style: "destructive",
          onPress: async () => {
            try {
              // member.id is membership ID, expectedMemberVersion is member.version
              await removeMember(tripId, member.id, member.version);
              onMemberRemoved?.(member);
              void refetch(tripId, filter);
              Alert.alert(
                "Đã loại thành viên",
                `Đã xóa ${member.displayName || "thành viên"} khỏi danh sách đoàn.`,
              );
            } catch (err: any) {
              if (err?.code === "MEMBERSHIP_VERSION_CONFLICT") {
                Alert.alert(
                  "Xung đột phiên bản",
                  "Dữ liệu thành viên vừa thay đổi trên máy chủ. Đang tải lại danh sách...",
                  [{ text: "Tải lại", onPress: () => void refetch(tripId, filter) }],
                );
              } else {
                Alert.alert(
                  "Lỗi",
                  err?.message || "Không thể loại thành viên này.",
                );
              }
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.card}>
      {/* Header with Title and Scale */}
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <Ionicons name="people" size={18} color={Colors.primaryDark} />
        </View>

        <View style={styles.headerContent}>
          <Text style={styles.title}>Danh sách tài khoản tham gia</Text>
          <Text style={styles.subtitle}>
            Quy mô nhóm:{" "}
            <Text style={styles.scaleHighlight}>
              {totalActive}{capacity > 0 ? ` / ${capacity}` : ""} người
            </Text>
          </Text>
        </View>
      </View>

      {/* Filter Tabs: Đang tham gia / Tất cả */}
      <View style={styles.filterTabsRow}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "ACTIVE" && styles.filterTabActive,
          ]}
          onPress={() => handleFilterChange("ACTIVE")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === "ACTIVE" && styles.filterTabTextActive,
            ]}
          >
            Đang tham gia ({totalActive})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "ALL" && styles.filterTabActive,
          ]}
          onPress={() => handleFilterChange("ALL")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === "ALL" && styles.filterTabTextActive,
            ]}
          >
            Tất cả tài khoản
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {loadingMembers ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={Colors.primaryDark} />
          <Text style={styles.loadingText}>Đang tải danh sách thành viên...</Text>
        </View>
      ) : displayMembers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={32} color="#94a3b8" />
          <Text style={styles.emptyText}>
            {filter === "ACTIVE"
              ? "Chưa có tài khoản nào đang tham gia."
              : "Chưa có tài khoản nào tham gia."}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {displayMembers.map((member) => (
            <TripRoomMemberItem
              key={member.id}
              member={member}
              canRemove={canRemoveMembers && !removing}
              tripStatus={tripStatus}
              onRemove={handleRemove}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadows.card,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  scaleHighlight: {
    color: Colors.primaryDark,
    fontWeight: "800",
  },
  filterTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 12,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: "#eff4ff",
    borderWidth: 1,
    borderColor: "#dee9fc",
  },
  filterTabActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#125238",
  },
  filterTabTextActive: {
    color: "#ffffff",
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 6,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  list: {
    marginTop: 4,
  },
});
