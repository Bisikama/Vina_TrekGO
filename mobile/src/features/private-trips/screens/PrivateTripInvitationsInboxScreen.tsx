import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DirectInviteCard } from "../components/DirectInviteCard";
import { useMyReceivedInvitations } from "../hooks/useMyReceivedInvitations";
import type {
  DeclineReason,
  InvitationStatus,
  PrivateMemberInvitationItem,
} from "../types";

type InboxFilter = "ALL" | "PENDING" | "ACCEPTED" | "ARCHIVED";

export function PrivateTripInvitationsInboxScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<InboxFilter>("ALL");

  const {
    invitations,
    loading,
    acceptingId,
    decliningId,
    error,
    refetch,
    accept,
    decline,
  } = useMyReceivedInvitations();

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "PENDING":
        return invitations.filter((i) => i.status === "PENDING");
      case "ACCEPTED":
        return invitations.filter((i) => i.status === "ACCEPTED");
      case "ARCHIVED":
        return invitations.filter((i) =>
          ["DECLINED", "REVOKED", "EXPIRED", "INVALIDATED"].includes(i.status),
        );
      default:
        return invitations;
    }
  }, [invitations, filter]);

  const pendingCount = useMemo(
    () => invitations.filter((i) => i.status === "PENDING").length,
    [invitations],
  );

  const handleSafeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/trips" as any);
    }
  };

  const handleAccept = async (invitationId: string) => {
    const res = await accept(invitationId);
    if (res && res.canEnterRoom && res.tripId) {
      Alert.alert(
        "Gia nhập đoàn thành công! 🎉",
        "Chào mừng bạn đã tham gia chuyến đi. Hệ thống sẽ chuyển hướng bạn vào phòng chờ ngay bây giờ.",
        [
          {
            text: "Vào phòng chờ ngay",
            onPress: () => {
              router.push({
                pathname: "/private-trips/[id]/room",
                params: { id: res.tripId },
              } as any);
            },
          },
        ],
      );
    }
  };

  const handleDecline = async (
    invitationId: string,
    reason: DeclineReason,
  ) => {
    const ok = await decline(invitationId, reason);
    if (ok) {
      Alert.alert("Đã từ chối", "Bạn đã từ chối lời mời tham gia chuyến đi này.");
    }
  };

  const handleEnterRoom = (tripId: string) => {
    router.push({
      pathname: "/private-trips/[id]/room",
      params: { id: tripId },
    } as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleSafeBack}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Hộp Thư Lời Mời</Text>
          <Text style={styles.headerSubtitle}>
            Lời mời Private Trip gửi đích danh tới email của bạn
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => void refetch()}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={18} color="#054D28" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, filter === "ALL" && styles.filterChipActive]}
          onPress={() => setFilter("ALL")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === "ALL" && styles.filterChipTextActive,
            ]}
          >
            Tất cả ({invitations.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filter === "PENDING" && styles.filterChipActive,
          ]}
          onPress={() => setFilter("PENDING")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === "PENDING" && styles.filterChipTextActive,
            ]}
          >
            Chờ phản hồi
          </Text>
          {pendingCount > 0 && (
            <View style={styles.chipBadge}>
              <Text style={styles.chipBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filter === "ACCEPTED" && styles.filterChipActive,
          ]}
          onPress={() => setFilter("ACCEPTED")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === "ACCEPTED" && styles.filterChipTextActive,
            ]}
          >
            Đã tham gia
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filter === "ARCHIVED" && styles.filterChipActive,
          ]}
          onPress={() => setFilter("ARCHIVED")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === "ARCHIVED" && styles.filterChipTextActive,
            ]}
          >
            Khác
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <DirectInviteCard
              invitation={item}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onEnterRoom={handleEnterRoom}
              isAccepting={acceptingId === item.id}
              isDeclining={decliningId === item.id}
            />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refetch()}
            colors={["#054D28"]}
            tintColor="#054D28"
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#054D28" />
              <Text style={styles.emptySubText}>Đang tải hộp thư lời mời...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="mail-open-outline" size={38} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>Không có lời mời nào</Text>
              <Text style={styles.emptySubText}>
                {filter === "PENDING"
                  ? "Bạn không có lời mời nào đang chờ phản hồi."
                  : filter === "ACCEPTED"
                  ? "Bạn chưa tham gia chuyến đi nào từ lời mời trực tiếp."
                  : "Hộp thư lời mời trực tiếp qua Email hiện đang trống."}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAF7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0E0F0C",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 1,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E2F6D5",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: "#F1F5F9",
  },
  filterChipActive: {
    backgroundColor: "#054D28",
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748B",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  chipBadge: {
    backgroundColor: "#EA580C",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    gap: 14,
    flexGrow: 1,
  },
  cardWrapper: {
    marginBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 30,
    gap: 10,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  emptySubText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
});
