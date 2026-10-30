import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type {
  DeclineReason,
  InvitationStatus,
  PrivateMemberInvitationItem,
} from "../types";

export interface DirectInviteCardProps {
  invitation: PrivateMemberInvitationItem;
  onAccept: (invitationId: string) => Promise<void>;
  onDecline: (invitationId: string, reason: DeclineReason) => Promise<void>;
  onEnterRoom?: (tripId: string) => void;
  isAccepting?: boolean;
  isDeclining?: boolean;
}

export function DirectInviteCard({
  invitation,
  onAccept,
  onDecline,
  onEnterRoom,
  isAccepting = false,
  isDeclining = false,
}: DirectInviteCardProps) {
  const router = useRouter();
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<DeclineReason>("NOT_INTERESTED");

  const isPending = invitation.status === "PENDING";
  const isAccepted = invitation.status === "ACCEPTED";
  const trip = invitation.trip;

  const handleEnterRoom = (targetTripId: string) => {
    if (typeof onEnterRoom === "function") {
      onEnterRoom(targetTripId);
    } else {
      router.push({
        pathname: "/private-trips/[id]/room",
        params: { id: targetTripId },
      } as any);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "---";
    try {
      const d = new Date(isoString);
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    } catch {
      return isoString;
    }
  };

  const renderStatusBadge = (status: InvitationStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <View style={[styles.badge, styles.badgePending]}>
            <Ionicons name="time-outline" size={12} color="#9A3412" />
            <Text style={[styles.badgeText, styles.badgeTextPending]}>
              Chờ bạn phản hồi
            </Text>
          </View>
        );
      case "ACCEPTED":
        return (
          <View style={[styles.badge, styles.badgeAccepted]}>
            <Ionicons name="checkmark-circle" size={12} color="#054D28" />
            <Text style={[styles.badgeText, styles.badgeTextAccepted]}>
              Đã tham gia
            </Text>
          </View>
        );
      case "DECLINED":
        return (
          <View style={[styles.badge, styles.badgeDeclined]}>
            <Ionicons name="close-circle" size={12} color="#991B1B" />
            <Text style={[styles.badgeText, styles.badgeTextDeclined]}>
              Đã từ chối
            </Text>
          </View>
        );
      case "REVOKED":
        return (
          <View style={[styles.badge, styles.badgeRevoked]}>
            <Ionicons name="ban-outline" size={12} color="#475569" />
            <Text style={[styles.badgeText, styles.badgeTextRevoked]}>
              Host đã thu hồi
            </Text>
          </View>
        );
      case "EXPIRED":
        return (
          <View style={[styles.badge, styles.badgeRevoked]}>
            <Ionicons name="alert-circle-outline" size={12} color="#64748B" />
            <Text style={[styles.badgeText, styles.badgeTextRevoked]}>
              Đã hết hạn
            </Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, styles.badgeRevoked]}>
            <Text style={[styles.badgeText, styles.badgeTextRevoked]}>
              {status}
            </Text>
          </View>
        );
    }
  };

  const handleConfirmDecline = async () => {
    setShowDeclineModal(false);
    await onDecline(invitation.id, selectedReason);
  };

  return (
    <View style={styles.card}>
      {/* Header: Sender & Status */}
      <View style={styles.cardHeader}>
        <View style={styles.hostRow}>
          <View style={styles.hostAvatar}>
            <Ionicons name="person" size={16} color="#054D28" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hostLabel}>Lời mời từ Host</Text>
            <Text style={styles.hostName} numberOfLines={1}>
              {invitation.senderDisplay || "Host chuyến đi"}
            </Text>
          </View>
        </View>

        {renderStatusBadge(invitation.status)}
      </View>

      {/* Trip Info */}
      <View style={styles.tripContent}>
        <Text style={styles.tripTitle} numberOfLines={2}>
          {trip?.title || "Chuyến đi riêng tư TrekGO"}
        </Text>

        <View style={styles.tripMetaRow}>
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text style={styles.tripMetaText}>
            Khởi hành: {formatDate(trip?.startAt)} → {formatDate(trip?.endAt)}
          </Text>
        </View>

        {Boolean(invitation.expiresAt) && isPending && (
          <View style={styles.expiresRow}>
            <Ionicons name="hourglass-outline" size={13} color="#D97706" />
            <Text style={styles.expiresText}>
              Hạn phản hồi: {formatDate(invitation.expiresAt)}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {isPending && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.declineBtn, isDeclining && styles.btnDisabled]}
            onPress={() => setShowDeclineModal(true)}
            disabled={isDeclining || isAccepting}
            activeOpacity={0.8}
          >
            {isDeclining ? (
              <ActivityIndicator size="small" color="#991B1B" />
            ) : (
              <>
                <Ionicons name="close" size={16} color="#991B1B" />
                <Text style={styles.declineBtnText}>Từ chối</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptBtn, isAccepting && styles.btnDisabled]}
            onPress={() => void onAccept(invitation.id)}
            disabled={isAccepting || isDeclining}
            activeOpacity={0.88}
          >
            {isAccepting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.acceptBtnText}>Chấp nhận tham gia</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* If Accepted, provide quick access to room */}
      {isAccepted && (
        <TouchableOpacity
          style={styles.roomLinkBtn}
          onPress={() => handleEnterRoom(invitation.tripId)}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubbles-outline" size={16} color="#054D28" />
          <Text style={styles.roomLinkText}>Vào phòng chờ chuyến đi ngay</Text>
          <Ionicons name="chevron-forward" size={14} color="#054D28" />
        </TouchableOpacity>
      )}

      {/* Decline Reason Modal */}
      <Modal
        visible={showDeclineModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeclineModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Từ chối lời mời</Text>
              <Text style={styles.modalSubtitle}>
                Vui lòng chọn lý do để thông báo đến Host chuyến đi:
              </Text>
            </View>

            <View style={styles.reasonList}>
              {[
                { key: "NOT_INTERESTED", label: "Không quan tâm chuyến đi này" },
                { key: "SCHEDULE_CONFLICT", label: "Bận lịch trình cá nhân" },
                { key: "OTHER", label: "Lý do khác" },
              ].map((r) => {
                const isSelected = selectedReason === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.reasonItem,
                      isSelected && styles.reasonItemSelected,
                    ]}
                    onPress={() => setSelectedReason(r.key as DeclineReason)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isSelected ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={isSelected ? "#054D28" : "#94A3B8"}
                    />
                    <Text
                      style={[
                        styles.reasonItemText,
                        isSelected && styles.reasonItemTextSelected,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDeclineModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmDecline}
              >
                <Text style={styles.modalConfirmBtnText}>Xác nhận từ chối</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  hostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2F6D5",
    alignItems: "center",
    justifyContent: "center",
  },
  hostLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  hostName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0E0F0C",
  },
  tripContent: {
    paddingVertical: 12,
    gap: 6,
  },
  tripTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0E0F0C",
    lineHeight: 20,
  },
  tripMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  tripMetaText: {
    fontSize: 12,
    color: "#475569",
  },
  expiresRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  expiresText: {
    fontSize: 11.5,
    color: "#D97706",
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991B1B",
  },
  acceptBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: "#054D28",
    ...Shadows.hover,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  roomLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: Radius.md,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  roomLinkText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#054D28",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgePending: {
    backgroundColor: "#FFEDD5",
  },
  badgeTextPending: {
    color: "#9A3412",
  },
  badgeAccepted: {
    backgroundColor: "#DCFCE7",
  },
  badgeTextAccepted: {
    color: "#166534",
  },
  badgeDeclined: {
    backgroundColor: "#FEE2E2",
  },
  badgeTextDeclined: {
    color: "#991B1B",
  },
  badgeRevoked: {
    backgroundColor: "#F1F5F9",
  },
  badgeTextRevoked: {
    color: "#475569",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(14, 15, 12, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.xl,
    padding: 20,
    ...Shadows.card,
  },
  modalHeader: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0E0F0C",
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
  },
  reasonList: {
    gap: 10,
    marginBottom: 20,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  reasonItemSelected: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  reasonItemText: {
    fontSize: 13,
    color: "#334155",
  },
  reasonItemTextSelected: {
    color: "#054D28",
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  modalConfirmBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
