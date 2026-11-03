import { Colors, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { TripMember } from "../types";

export interface TripRoomMemberItemProps {
  member: TripMember;
  canRemove: boolean;
  tripStatus?: string;
  onRemove?: (member: TripMember) => void;
}

function formatJoinedDate(joinedAt?: string) {
  if (!joinedAt) return "";
  try {
    const d = new Date(joinedAt);
    if (isNaN(d.getTime())) return joinedAt;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return joinedAt;
  }
}

export function TripRoomMemberItem({
  member,
  canRemove,
  tripStatus = "OPEN",
  onRemove,
}: TripRoomMemberItemProps) {
  const isHost = member.role === "HOST" || member.isHost;
  const isTripOpen = tripStatus === "OPEN";

  // Account name according to specification:
  // member.displayName || "Tài khoản #" + member.userId.slice(0, 8)
  const shortUserId = member.userId ? member.userId.slice(0, 8) : "";
  const displayName = member.displayName || (shortUserId ? `Tài khoản #${shortUserId}` : "Tài khoản thành viên");
  const initialChar = (displayName || shortUserId || "U").charAt(0).toUpperCase();

  // Show "Loại" button if:
  // viewer is HOST, trip is OPEN, member is not host, and member is ACTIVE
  const showRemoveButton =
    canRemove &&
    isTripOpen &&
    !isHost &&
    member.status === "ACTIVE";

  return (
    <View style={styles.container}>
      {/* Avatar initial */}
      <View style={styles.avatarBox}>
        {member.avatarUrl ? (
          <Image source={{ uri: member.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{initialChar}</Text>
          </View>
        )}
      </View>

      {/* Account Info */}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>

          {/* Role Badge */}
          {isHost ? (
            <View style={styles.hostBadge}>
              <Ionicons name="shield-checkmark" size={10} color="#725C00" />
              <Text style={styles.hostBadgeText}>Trưởng đoàn (HOST)</Text>
            </View>
          ) : (
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>Thành viên (MEMBER)</Text>
            </View>
          )}

          {/* Status Badge if not ACTIVE */}
          {member.status === "LEFT" && (
            <View style={styles.leftBadge}>
              <Text style={styles.leftBadgeText}>Đã rời</Text>
            </View>
          )}
          {member.status === "REMOVED" && (
            <View style={styles.removedBadge}>
              <Text style={styles.removedBadgeText}>Đã xóa</Text>
            </View>
          )}
        </View>

        {/* Short ID and JoinedAt */}
        <View style={styles.subRow}>
          {Boolean(shortUserId) && (
            <Text style={styles.shortIdText}>ID: #{shortUserId}</Text>
          )}
          {Boolean(shortUserId) && Boolean(member.joinedAt) && (
            <Text style={styles.dotSeparator}>•</Text>
          )}
          {Boolean(member.joinedAt) && (
            <Text style={styles.joinedAt}>
              Tham gia: {formatJoinedDate(member.joinedAt)}
            </Text>
          )}
        </View>
      </View>

      {/* "Loại" button for HOST when trip is OPEN */}
      {showRemoveButton ? (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove?.(member)}
          activeOpacity={0.8}
        >
          <Ionicons name="person-remove-outline" size={13} color="#DC2626" />
          <Text style={styles.removeButtonText}>Loại</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eff4ff",
  },
  avatarBox: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: "#eff4ff",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: "#e6eeff",
    borderWidth: 1.5,
    borderColor: "#125238",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "800",
    color: "#125238",
  },
  content: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  hostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: "#FEF3C7",
    borderWidth: 0.8,
    borderColor: "#FDE68A",
  },
  hostBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#725C00",
    letterSpacing: 0.2,
  },
  memberBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: "#eff4ff",
    borderWidth: 0.8,
    borderColor: "#dee9fc",
  },
  memberBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#125238",
    letterSpacing: 0.2,
  },
  leftBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: "#f3f4f6",
  },
  leftBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6b7280",
  },
  removedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: "#fee2e2",
  },
  removedBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#dc2626",
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  shortIdText: {
    fontSize: 11,
    color: "#125238",
    fontWeight: "700",
    backgroundColor: "#eff4ff",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dotSeparator: {
    color: "#94a3b8",
    fontSize: 11,
  },
  joinedAt: {
    fontSize: 11,
    color: "#64748b",
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    marginLeft: 8,
  },
  removeButtonText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#dc2626",
  },
});
