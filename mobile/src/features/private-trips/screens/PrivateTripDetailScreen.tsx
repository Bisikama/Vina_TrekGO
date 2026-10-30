import { Colors, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CancelTripModal } from "../components/CancelTripModal";
import { DirectInviteModal } from "../components/DirectInviteModal";
import { EditPrivateTripModal } from "../components/EditPrivateTripModal";
import { InviteShareModal } from "../components/InviteShareModal";
import { PrivateTripHero } from "../components/PrivateTripHero";
import { PrivateTripPickupCard } from "../components/PrivateTripPickupCard";
import { PrivateTripRouteTimeline } from "../components/PrivateTripRouteTimeline";
import { TripRoomMemberList } from "../components/TripRoomMemberList";
import { useCancelPrivateTrip } from "../hooks/useCancelPrivateTrip";
import { usePrivateTripDetail } from "../hooks/usePrivateTripDetail";
import { usePrivateTripMembers } from "../hooks/usePrivateTripMembers";
import { useTripInvitation } from "../hooks/useTripInvitation";

export interface PrivateTripDetailScreenProps {
  tripId?: string;
  isHost?: boolean;
}

export function PrivateTripDetailScreen({
  tripId: propTripId,
  isHost: propIsHost,
}: PrivateTripDetailScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tripId =
    propTripId || (Array.isArray(params.id) ? params.id[0] : params.id);

  // Use custom hooks for real API integration
  const { trip, setTrip, loading, error, refetch } = usePrivateTripDetail(tripId);
  const { activeCount, refetch: refetchMembers } = usePrivateTripMembers(tripId);
  const { cancelTrip, loading: cancelling } = useCancelPrivateTrip();
  const {
    inviteData,
    loading: generatingInvite,
    generateInvite,
    revokeInvite,
  } = useTripInvitation();

  // Modals state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDirectInviteModal, setShowDirectInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [revokingInvite, setRevokingInvite] = useState(false);

  async function handleOpenInviteModal() {
    if (!trip) return;
    setShowInviteModal(true);

    // If trip already has an active invite code, reuse it without regenerating
    if (trip.inviteCode || inviteData?.inviteCode) {
      return;
    }

    try {
      const res = await generateInvite(trip.id, trip.version);
      setTrip((prev) =>
        prev
          ? { ...prev, inviteCode: res.inviteCode, version: res.tripVersion }
          : prev,
      );
    } catch (err: any) {
      const isConflict =
        err?.code === "PRIVATE_TRIP_VERSION_CONFLICT" ||
        err?.message?.includes("reload") ||
        err?.message?.includes("version");
      if (isConflict) {
        void refetch();
      }
      Alert.alert(
        "Lỗi tạo mã mời",
        err?.message || "Không thể tạo mã mời lúc này.",
      );
    }
  }

  async function handleRegenerateInvite() {
    if (!trip) return;
    try {
      const res = await generateInvite(trip.id, trip.version);
      setTrip((prev) =>
        prev
          ? { ...prev, inviteCode: res.inviteCode, version: res.tripVersion }
          : prev,
      );
    } catch (err: any) {
      const isConflict =
        err?.code === "PRIVATE_TRIP_VERSION_CONFLICT" ||
        err?.message?.includes("reload") ||
        err?.message?.includes("version");
      if (isConflict) {
        void refetch();
      }
      Alert.alert(
        "Lỗi tạo lại mã",
        err?.message || "Không thể tạo mã mới lúc này.",
      );
    }
  }

  async function handleRevokeInvite() {
    if (!trip) return;

    Alert.alert(
      "Xác nhận thu hồi",
      "Bạn có chắc chắn muốn thu hồi link mời hiện tại? Bạn bè sẽ không thể dùng link này để tham gia nữa.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Thu hồi ngay",
          style: "destructive",
          onPress: async () => {
            setRevokingInvite(true);
            try {
              const res = await revokeInvite(trip.id, trip.version);
              setTrip((prev) =>
                prev
                  ? { ...prev, inviteCode: undefined, version: res.tripVersion }
                  : prev,
              );
              setShowInviteModal(false);
              Alert.alert(
                "Đã thu hồi",
                "Mã mời hiện tại đã được thu hồi thành công.",
              );
            } catch (err: any) {
              const isConflict =
                err?.code === "PRIVATE_TRIP_VERSION_CONFLICT" ||
                err?.message?.includes("reload") ||
                err?.message?.includes("version");
              if (isConflict) {
                void refetch();
              }
              Alert.alert(
                "Lỗi thu hồi",
                err?.message || "Không thể thu hồi mã mời lúc này.",
              );
            } finally {
              setRevokingInvite(false);
            }
          },
        },
      ],
    );
  }

  async function handleConfirmCancel(reason: string) {
    if (!trip) return;
    try {
      const updated = await cancelTrip(trip.id, trip.version, reason);
      setShowCancelModal(false);
      setTrip(updated);
      Alert.alert("Đã hủy chuyến", "Chuyến đi riêng của bạn đã được hủy thành công.");
    } catch (err: any) {
      if (err?.code === "PRIVATE_TRIP_VERSION_CONFLICT") {
        Alert.alert(
          "Xung đột phiên bản",
          "Thông tin chuyến đi vừa được cập nhật bởi thao tác khác. Đang tải lại dữ liệu...",
          [{ text: "Tải lại", onPress: () => void refetch() }],
        );
      } else {
        Alert.alert("Lỗi hủy chuyến", err?.message || "Không thể hủy chuyến.");
      }
    }
  }

  function handleGoToRoom() {
    if (!tripId) return;
    router.push({
      pathname: "/private-trips/[id]/room",
      params: { id: tripId },
    } as any);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
          <Text style={styles.loadingText}>Đang tải chi tiết chuyến đi...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết chuyến đi</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={44} color="#DC2626" />
          <Text style={styles.errorTitle}>Không tìm thấy chuyến đi</Text>
          <Text style={styles.errorSubtitle}>
            {error || "Chuyến đi có thể đã bị xóa hoặc bạn không có quyền truy cập."}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.replace("/(tabs)/trips")}
          >
            <Text style={styles.retryButtonText}>Về Chuyến của tôi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isHost = propIsHost ?? (trip.viewer?.isHost ?? true);
  const isCancelled = trip.status === "CANCELLED";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {trip.title}
        </Text>

        {!isCancelled && isHost ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleOpenInviteModal}
          >
            <Ionicons
              name="share-social-outline"
              size={20}
              color={Colors.primaryDark}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <PrivateTripHero trip={trip} activeMemberCount={activeCount || 1} />

        {/* Pickup Point Card */}
        <PrivateTripPickupCard pickupPoint={trip.pickupPoint} />

        {/* Route / Checkpoints Timeline */}
        {trip.tripCheckpointsViaTripId && trip.tripCheckpointsViaTripId.length > 0 ? (
          <PrivateTripRouteTimeline
            checkpoints={trip.tripCheckpointsViaTripId}
            trailName={trip.tripTrailPlansViaTripId?.[0]?.snapshotName}
          />
        ) : null}

        {/* Participant Members List */}
        <TripRoomMemberList
          tripId={tripId}
          tripStatus={trip.status}
          maxPax={trip.maxPax}
          activeMemberCount={activeCount}
          canRemoveMembers={isHost}
          onMemberRemoved={() => {
            void refetch();
            void refetchMembers();
          }}
        />

        {/* Primary Action Buttons */}
        {!isCancelled ? (
          <View style={styles.actionGroup}>
            <TouchableOpacity
              style={styles.roomButton}
              onPress={handleGoToRoom}
              activeOpacity={0.88}
            >
              <Ionicons name="chatbubbles-outline" size={19} color="#FFFFFF" />
              <Text style={styles.roomButtonText}>Vào phòng chờ chuyến đi</Text>
            </TouchableOpacity>

            {/* Direct Member Invitation via Email (M1–M4) */}
            {isHost && trip.status === "OPEN" ? (
              <View style={styles.inviteButtonRow}>
                <TouchableOpacity
                  style={styles.directInviteButton}
                  onPress={() => setShowDirectInviteModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="mail" size={17} color="#FFFFFF" />
                  <Text style={styles.directInviteButtonText}>
                    ✉️ Mời bạn bè qua Email
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareCodeButton}
                  onPress={handleOpenInviteModal}
                  activeOpacity={0.85}
                >
                  <Ionicons name="link-outline" size={17} color="#054D28" />
                  <Text style={styles.shareCodeButtonText}>Link / Mã Code</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {isHost && trip.status === "OPEN" && new Date(trip.startAt).getTime() > Date.now() ? (
              <TouchableOpacity
                style={styles.editTripButton}
                onPress={() => setShowEditModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="create-outline" size={18} color={Colors.primaryDark} />
                <Text style={styles.editTripButtonText}>Chỉnh sửa thông tin chuyến</Text>
              </TouchableOpacity>
            ) : null}

            {isHost ? (
              <TouchableOpacity
                style={styles.cancelTripButton}
                onPress={() => setShowCancelModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                <Text style={styles.cancelTripButtonText}>Hủy chuyến đi này</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Modals */}
      <CancelTripModal
        visible={showCancelModal}
        loading={cancelling}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
      />

      <InviteShareModal
        visible={showInviteModal}
        inviteCode={inviteData?.inviteCode || trip.inviteCode}
        expiresAt={inviteData?.expiresAt}
        tripTitle={trip.title}
        tripId={trip.id}
        expectedVersion={trip.version}
        loading={generatingInvite}
        revoking={revokingInvite}
        onClose={() => setShowInviteModal(false)}
        onGenerateNewCode={handleRegenerateInvite}
        onRevoke={isHost ? handleRevokeInvite : undefined}
      />

      {/* Direct Email Invite Modal (M1–M4) */}
      <DirectInviteModal
        visible={showDirectInviteModal}
        tripId={trip.id}
        tripTitle={trip.title}
        onClose={() => setShowDirectInviteModal(false)}
        onInviteSentSuccess={() => void refetchMembers()}
      />

      {showEditModal && (
        <EditPrivateTripModal
          visible={showEditModal}
          trip={trip}
          activeMemberCount={1}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updated) => setTrip(updated)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  headerBar: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
    textAlign: "center",
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 38,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.onSurface,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionGroup: {
    marginTop: 8,
    gap: 12,
  },
  roomButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  roomButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cancelTripButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: "#FEE2E2",
  },
  cancelTripButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },
  editTripButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
  },
  editTripButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  inviteButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  directInviteButton: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: Radius.full,
    backgroundColor: "#054D28",
  },
  directInviteButtonText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  shareCodeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: Radius.full,
    backgroundColor: "#E2F6D5",
    borderWidth: 1,
    borderColor: "#A3E635",
  },
  shareCodeButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#054D28",
  },
});
