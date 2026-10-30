import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/features/auth/AuthContext";
import { useJoinPrivateTrip } from "../hooks/useJoinPrivateTrip";
import { usePreviewTripInvite } from "../hooks/usePreviewTripInvite";
import type { InvitePreviewData } from "../types";
import { getInviteErrorMessage } from "../utils/inviteErrorUtils";
import { PrivateStatusBadge } from "./PrivateStatusBadge";

export interface InvitePreviewCardProps {
  inviteCode?: string;
  data?: InvitePreviewData;
  isLoggedIn?: boolean;
  loading?: boolean;
  onJoin?: () => void;
  onLogin?: () => void;
  onJoinSuccess?: (result: any) => void;
}

export function InvitePreviewCard({
  inviteCode,
  data: propData,
  isLoggedIn: propIsLoggedIn,
  loading: propLoading = false,
  onJoin,
  onLogin,
  onJoinSuccess,
}: InvitePreviewCardProps) {
  const { isAuthenticated, accessToken } = useAuth();
  const isLoggedIn = propIsLoggedIn !== undefined ? propIsLoggedIn : isAuthenticated;

  // If data not provided, fetch via hook
  const shouldFetch = !propData && Boolean(inviteCode);
  const { preview: apiPreview, loading: loadingPreview, error: previewError } =
    usePreviewTripInvite(inviteCode, shouldFetch);

  const { joinTrip, loading: joining } = useJoinPrivateTrip(accessToken);

  const data = propData || apiPreview;
  const loading = propLoading || loadingPreview || joining;

  if (loadingPreview && !data) {
    return (
      <View style={[styles.card, styles.centerCard]}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
        <Text style={styles.loadingText}>Đang tải thông tin thư mời...</Text>
      </View>
    );
  }

  if (previewError && !data) {
    return (
      <View style={[styles.card, styles.centerCard]}>
        <Ionicons name="alert-circle-outline" size={38} color="#DC2626" />
        <Text style={styles.errorTitle}>Không thể xem thư mời</Text>
        <Text style={styles.errorText}>{previewError}</Text>
      </View>
    );
  }

  if (!data) {
    return null;
  }

  const { trip, joinable, joinDisabledReason } = data;
  const startDate = new Date(trip.startAt);
  const formattedStart = !isNaN(startDate.getTime())
    ? startDate.toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : trip.startAt;

  async function handleJoinClick() {
    if (onJoin) {
      onJoin();
      return;
    }

    if (!inviteCode) return;

    try {
      const res = await joinTrip(inviteCode);
      onJoinSuccess?.(res);
      Alert.alert(
        "Tham gia thành công!",
        res.alreadyMember
          ? "Bạn đã là thành viên của chuyến đi này."
          : "Chào mừng bạn đã gia nhập đoàn!",
      );
    } catch (err: any) {
      const errorMsg = getInviteErrorMessage(err);
      Alert.alert("Không thể tham gia", errorMsg);
    }
  }

  return (
    <View style={styles.card}>
      {/* Top Banner */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-open" size={26} color={Colors.primaryDark} />
        </View>
        <Text style={styles.invitationHeading}>LỜI MỜI THAM GIA</Text>
        <Text style={styles.tripTitle}>{trip.title}</Text>
        <View style={styles.badgeRow}>
          <PrivateStatusBadge status={trip.status} />
        </View>
      </View>

      {/* Host Information */}
      <View style={styles.hostBox}>
        <View style={styles.hostAvatarBox}>
          {trip.host.avatarUrl ? (
            <Image
              source={{ uri: trip.host.avatarUrl }}
              style={styles.hostAvatar}
            />
          ) : (
            <View style={styles.hostAvatarPlaceholder}>
              <Text style={styles.hostAvatarText}>
                {trip.host.displayName?.charAt(0)?.toUpperCase() || "H"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.hostInfo}>
          <Text style={styles.hostLabel}>Người tổ chức (Host)</Text>
          <Text style={styles.hostName}>{trip.host.displayName}</Text>
        </View>
      </View>

      {/* Trip Details Grid */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailRow}>
          <Ionicons
            name="calendar-outline"
            size={18}
            color={Colors.primaryDark}
          />
          <View style={styles.detailTextContainer}>
            <Text style={styles.detailLabel}>Thời gian khởi hành</Text>
            <Text style={styles.detailValue}>{formattedStart}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Ionicons
            name="people-outline"
            size={18}
            color={Colors.primaryDark}
          />
          <View style={styles.detailTextContainer}>
            <Text style={styles.detailLabel}>Tình trạng chỗ</Text>
            <Text style={styles.detailValue}>
              Đã có {trip.activeMemberCount}/{trip.capacity} thành viên · Còn{" "}
              {trip.remainingSlots} slot
            </Text>
          </View>
        </View>
      </View>

      {/* Disabled reason notice */}
      {!joinable && joinDisabledReason ? (
        <View style={styles.warningBox}>
          <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
          <Text style={styles.warningText}>{joinDisabledReason}</Text>
        </View>
      ) : null}

      {/* Action CTA */}
      <View style={styles.actionContainer}>
        {!isLoggedIn ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onLogin}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Đăng nhập để tham gia</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!joinable || loading) && styles.disabledButton,
            ]}
            onPress={handleJoinClick}
            disabled={!joinable || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>
                  {joinable ? "Xác nhận tham gia chuyến đi" : "Không thể tham gia"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    padding: 20,
    ...Shadows.hover,
  },
  centerCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  errorText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  invitationHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.onSurfaceVariant,
    letterSpacing: 1,
    marginBottom: 4,
  },
  tripTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.onSurface,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 8,
  },
  badgeRow: {
    marginTop: 2,
  },
  hostBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    marginBottom: 16,
  },
  hostAvatarBox: {
    marginRight: 12,
  },
  hostAvatar: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
  },
  hostAvatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  hostAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  hostInfo: {
    flex: 1,
  },
  hostLabel: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: "600",
  },
  hostName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  detailsGrid: {
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.surfaceContainerLow,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: "500",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: "#FEF3C7",
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#B45309",
    lineHeight: 16,
  },
  actionContainer: {
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
