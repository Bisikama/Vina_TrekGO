import { Colors, Radius } from "@/constants/theme";
import { TripGpsButton } from "@/components/trip/TripGpsButton";
import { TripShareButton } from "@/features/trip-gps";
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
import { DirectInviteModal } from "../components/DirectInviteModal";
import { InviteShareModal } from "../components/InviteShareModal";
import { TripRoomActions } from "../components/TripRoomActions";
import { TripRoomHeader } from "../components/TripRoomHeader";
import { TripRoomMemberList } from "../components/TripRoomMemberList";
import { useLeavePrivateTrip } from "../hooks/useLeavePrivateTrip";
import { usePrivateTripMembers } from "../hooks/usePrivateTripMembers";
import { usePrivateTripRoom } from "../hooks/usePrivateTripRoom";
import { useRemoveTripMember } from "../hooks/useRemoveTripMember";
import { useTripInvitation } from "../hooks/useTripInvitation";
import type { TripMember } from "../types";

export interface PrivateTripRoomScreenProps {
  tripId?: string;
}

export function PrivateTripRoomScreen({
  tripId: propTripId,
}: PrivateTripRoomScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tripId =
    propTripId || (Array.isArray(params.id) ? params.id[0] : params.id);

  // Use custom hooks for real API integration
  const {
    roomData,
    setRoomData,
    loading: loadingRoom,
    error: roomError,
    refetch: refetchRoom,
  } = usePrivateTripRoom(tripId);

  const {
    members,
    loading: loadingMembers,
    refetch: refetchMembers,
  } = usePrivateTripMembers(tripId);

  const { removeMember } = useRemoveTripMember();
  const { leaveTrip, loading: leavingTrip } = useLeavePrivateTrip();
  const {
    inviteData,
    loading: generatingInvite,
    generateInvite,
    revokeInvite,
  } = useTripInvitation();

  const [revokingInvite, setRevokingInvite] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDirectInviteModal, setShowDirectInviteModal] = useState(false);

  const loading = loadingRoom || loadingMembers;

  function reloadAll() {
    void refetchRoom();
    void refetchMembers();
  }

  // Host loại thành viên (Kick member)
  function handleRemoveMember(member: TripMember) {
    if (!tripId) return;

    Alert.alert(
      "Xác nhận loại thành viên",
      `Bạn có chắc chắn muốn loại "${member.displayName}" khỏi chuyến đi? Thành viên này sẽ không thể tự join lại qua link mời.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Loại khỏi đoàn",
          style: "destructive",
          onPress: async () => {
            try {
              await removeMember(tripId, member.id, member.version);
              Alert.alert(
                "Đã loại thành viên",
                `Đã xóa ${member.displayName} khỏi danh sách đoàn.`,
              );
              reloadAll();
            } catch (err: any) {
              if (err?.code === "MEMBERSHIP_VERSION_CONFLICT") {
                Alert.alert(
                  "Xung đột phiên bản",
                  "Dữ liệu thành viên vừa thay đổi. Đang tải lại danh sách...",
                  [{ text: "Tải lại", onPress: reloadAll }],
                );
              } else {
                Alert.alert(
                  "Không thể loại thành viên",
                  err?.message || "Có lỗi xảy ra khi thực hiện.",
                );
              }
            }
          },
        },
      ],
    );
  }

  // Member tự rời nhóm (Leave trip)
  function handleLeaveTrip() {
    if (!tripId || !roomData) return;

    Alert.alert(
      "Rời khỏi chuyến đi",
      "Bạn có chắc chắn muốn rời khỏi chuyến đi này? Bạn sẽ không còn quyền truy cập thông tin phòng chờ.",
      [
        { text: "Ở lại", style: "cancel" },
        {
          text: "Rời chuyến",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveTrip(tripId, roomData.viewer.membershipVersion);
              Alert.alert("Đã rời chuyến", "Bạn đã rời khỏi đoàn thành công.", [
                {
                  text: "Về Chuyến của tôi",
                  onPress: () => router.replace("/(tabs)/trips"),
                },
              ]);
            } catch (err: any) {
              if (err?.code === "MEMBERSHIP_VERSION_CONFLICT") {
                Alert.alert(
                  "Xung đột phiên bản",
                  "Trạng thái thành viên vừa thay đổi. Đang tải lại...",
                  [{ text: "Tải lại", onPress: reloadAll }],
                );
              } else {
                Alert.alert("Không thể rời chuyến", err?.message || "Lỗi xảy ra.");
              }
            }
          },
        },
      ],
    );
  }

  async function handleOpenInvite() {
    if (!tripId || !roomData) return;
    setShowInviteModal(true);

    if (inviteData?.inviteCode) {
      return;
    }

    try {
      const res = await generateInvite(tripId, roomData.trip.version);
      setRoomData((prev) =>
        prev
          ? {
              ...prev,
              trip: {
                ...prev.trip,
                version: res.tripVersion,
              },
            }
          : prev,
      );
    } catch (err: any) {
      const isConflict =
        err?.code === "PRIVATE_TRIP_VERSION_CONFLICT" ||
        err?.message?.includes("reload") ||
        err?.message?.includes("version");
      if (isConflict) {
        reloadAll();
      }
      Alert.alert("Lỗi", err?.message || "Không thể tạo mã mời.");
    }
  }

  async function handleRegenerateInvite() {
    if (!tripId || !roomData) return;
    try {
      const res = await generateInvite(tripId, roomData.trip.version);
      setRoomData((prev) =>
        prev
          ? {
              ...prev,
              trip: {
                ...prev.trip,
                version: res.tripVersion,
              },
            }
          : prev,
      );
    } catch (err: any) {
      const isConflict =
        err?.code === "PRIVATE_TRIP_VERSION_CONFLICT" ||
        err?.message?.includes("reload") ||
        err?.message?.includes("version");
      if (isConflict) {
        reloadAll();
      }
      Alert.alert("Lỗi tạo lại mã", err?.message || "Không thể tạo mã mới.");
    }
  }

  async function handleRevokeInvite() {
    if (!tripId || !roomData) return;

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
              const res = await revokeInvite(tripId, roomData.trip.version);
              setRoomData((prev) =>
                prev
                  ? { ...prev, trip: { ...prev.trip, version: res.tripVersion } }
                  : prev,
              );
              setShowInviteModal(false);
              Alert.alert(
                "Đã thu hồi",
                "Mã mời hiện tại đã được thu hồi thành công.",
              );
            } catch (err: any) {
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

  if (loading && !roomData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
          <Text style={styles.loadingText}>Đang tải phòng chờ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (roomError || !roomData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Phòng chờ</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={44} color="#DC2626" />
          <Text style={styles.errorTitle}>Không thể truy cập phòng chờ</Text>
          <Text style={styles.errorSubtitle}>
            {roomError || "Bạn không thuộc danh sách thành viên của chuyến đi này."}
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
          Phòng chờ: {roomData.trip.title}
        </Text>

        <TouchableOpacity style={styles.backButton} onPress={reloadAll}>
          <Ionicons name="refresh" size={18} color={Colors.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Summary */}
        <TripRoomHeader roomData={roomData} />

        {tripId && roomData.trip.status !== "CANCELLED" && (
          <View style={{ marginVertical: 16 }}>
            <TripGpsButton
              tripStatus={roomData.trip.status}
              tripId={tripId}
              tripType="PRIVATE"
              tripTitle={roomData.trip.title}
            />
          </View>
        )}

        <TripShareButton tripId={tripId} style={{ marginBottom: 16 }} />

        {/* Member List */}
        <TripRoomMemberList
          tripId={tripId}
          tripStatus={roomData.trip.status}
          maxPax={roomData.trip.capacity}
          activeMemberCount={roomData.trip.activeMemberCount}
          canRemoveMembers={roomData.permissions.canRemoveMembers}
          onRemoveMember={handleRemoveMember}
          onMemberRemoved={reloadAll}
        />

        {/* Action Buttons */}
        <TripRoomActions
          isHost={roomData.viewer.isHost}
          permissions={roomData.permissions}
          leaving={leavingTrip}
          onInvite={handleOpenInvite}
          onDirectInvite={() => setShowDirectInviteModal(true)}
          onLeave={handleLeaveTrip}
        />
      </ScrollView>

      {/* Invite Modal (Link / Code) */}
      <InviteShareModal
        visible={showInviteModal}
        inviteCode={inviteData?.inviteCode}
        expiresAt={inviteData?.expiresAt}
        tripTitle={roomData.trip.title}
        tripId={tripId}
        expectedVersion={roomData.trip.version}
        loading={generatingInvite}
        revoking={revokingInvite}
        onClose={() => setShowInviteModal(false)}
        onGenerateNewCode={handleRegenerateInvite}
        onRevoke={roomData.viewer.isHost ? handleRevokeInvite : undefined}
      />

      {/* Direct Email Invite Modal (M1–M4) */}
      <DirectInviteModal
        visible={showDirectInviteModal}
        tripId={tripId || roomData.trip.id}
        tripTitle={roomData.trip.title}
        onClose={() => setShowDirectInviteModal(false)}
        onInviteSentSuccess={reloadAll}
      />
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
});
