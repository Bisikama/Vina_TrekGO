import { Colors, Radius, Shadows } from "@/constants/theme";
import {
  invitationsApiService,
  type InvitationItem,
  type InvitationStatus,
} from "@/features/invitations/services/invitations.api";
import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type FilterTab = "PENDING" | "ALL";

function formatDate(dateStr?: string) {
  if (!dateStr) return "Chưa cập nhật";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Chưa cập nhật";
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const day = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${time} · ${day}`;
}

function getExpiresText(expiresStr?: string) {
  if (!expiresStr) return "";
  const exp = new Date(expiresStr).getTime();
  const now = Date.now();
  const diffHours = Math.round((exp - now) / (1000 * 3600));
  if (diffHours <= 0) return "Đã hết hạn xác nhận";
  if (diffHours < 24) return `Hết hạn sau ${diffHours} giờ`;
  const diffDays = Math.round(diffHours / 24);
  return `Hết hạn sau ${diffDays} ngày`;
}

export function InvitationsInboxScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("PENDING");
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await invitationsApiService.fetchMyInvitations(
        activeTab === "PENDING" ? { status: "PENDING" } : undefined,
      );
      setInvitations(res.items || []);
    } catch (err: any) {
      Alert.alert(
        "Lỗi tải dữ liệu",
        err?.message || "Không thể tải danh sách lời mời nhận vé.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pendingCount = useMemo(() => {
    return invitations.filter((i) => i.status === "PENDING").length;
  }, [invitations]);

  const handleAccept = useCallback(
    (item: InvitationItem) => {
      Alert.alert(
        "Chấp nhận vé tham gia",
        `Xác nhận nhận vé cho chuyến đi "${item.trip?.title}"?\nBạn sẽ trở thành thành viên chính thức và có vé điện tử cá nhân.`,
        [
          { text: "Để sau", style: "cancel" },
          {
            text: "Đồng ý nhận vé",
            onPress: async () => {
              setActionLoadingId(item.id);
              try {
                const res = await invitationsApiService.acceptInvitation(item.id);
                Alert.alert(
                  "Chúc mừng! 🎉",
                  "Bạn đã nhận vé thành công! Bạn có muốn mở vé cá nhân ngay không?",
                  [
                    {
                      text: "Xem danh sách",
                      onPress: () => void loadData(),
                    },
                    {
                      text: "Xem vé ngay",
                      onPress: () => {
                        const targetId = res.ticketId || item.participantId || item.trip?.id;
                        router.push({
                          pathname: "/trips/[id]/ticket",
                          params: { id: targetId },
                        } as unknown as Href);
                      },
                    },
                  ],
                );
              } catch (err: any) {
                Alert.alert(
                  "Không thể nhận vé",
                  err?.message || "Có lỗi xảy ra khi xử lý lời mời.",
                );
              } finally {
                setActionLoadingId(null);
              }
            },
          },
        ],
      );
    },
    [loadData, router],
  );

  const handleDecline = useCallback(
    (item: InvitationItem) => {
      Alert.alert(
        "Từ chối lời mời vé",
        `Bạn có chắc chắn muốn từ chối vé chuyến "${item.trip?.title}" do ${item.senderDisplay || "người gửi"} tặng?`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Từ chối",
            style: "destructive",
            onPress: async () => {
              setActionLoadingId(item.id);
              try {
                await invitationsApiService.declineInvitation(item.id, "NOT_INTERESTED");
                Alert.alert("Đã từ chối", "Bạn đã từ chối nhận vé thành công.");
                void loadData();
              } catch (err: any) {
                Alert.alert("Lỗi", err?.message || "Không thể từ chối vé.");
              } finally {
                setActionLoadingId(null);
              }
            },
          },
        ],
      );
    },
    [loadData],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flex1}>
          <Text style={styles.headerTitle}>Hộp thư Lời mời Vé</Text>
          <Text style={styles.headerSub}>Vé chuyến đi công khai bạn bè gửi tặng</Text>
        </View>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => void loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={Colors.ink} />
          ) : (
            <Ionicons name="refresh" size={18} color={Colors.onSurface} />
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "PENDING" && styles.tabItemActive]}
          onPress={() => setActiveTab("PENDING")}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.tabText, activeTab === "PENDING" && styles.tabTextActive]}
          >
            Chờ xác nhận
          </Text>
          {pendingCount > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "ALL" && styles.tabItemActive]}
          onPress={() => setActiveTab("ALL")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === "ALL" && styles.tabTextActive]}>
            Tất cả lịch sử
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} />
        }
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Colors.primaryDark} />
            <Text style={styles.loadingText}>Đang tải danh sách lời mời...</Text>
          </View>
        ) : invitations.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="mail-open-outline" size={42} color={Colors.onSurfaceMuted} />
            </View>
            <Text style={styles.emptyTitle}>Không có lời mời nào</Text>
            <Text style={styles.emptySub}>
              {activeTab === "PENDING"
                ? "Hiện tại bạn không có lời mời nhận vé nào đang chờ xác nhận."
                : "Lịch sử nhận vé của bạn đang trống."}
            </Text>
          </View>
        ) : (
          invitations.map((item) => {
            const isPending = item.status === "PENDING";
            const isWorking = actionLoadingId === item.id;
            const expText = getExpiresText(item.expiresAt);

            return (
              <View key={item.id} style={styles.card}>
                {/* Header card */}
                <View style={styles.cardTop}>
                  <View style={styles.senderAvatar}>
                    <Text style={styles.senderAvatarText}>
                      {(item.senderDisplay || "B")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.senderTitle}>
                      <Text style={styles.senderNameBold}>{item.senderDisplay}</Text> đã gửi tặng bạn 1 vé
                    </Text>
                    <Text style={styles.createdAtText}>
                      Gửi lúc {formatDate(item.createdAt)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      isPending ? styles.statusPillWarn : styles.statusPillMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isPending ? styles.statusPillTextWarn : styles.statusPillTextMuted,
                      ]}
                    >
                      {item.status === "PENDING"
                        ? "Chờ nhận"
                        : item.status === "ACCEPTED"
                          ? "Đã nhận"
                          : item.status === "DECLINED"
                            ? "Đã từ chối"
                            : item.status === "REVOKED"
                              ? "Đã thu hồi"
                              : "Hết hạn"}
                    </Text>
                  </View>
                </View>

                {/* Trip detail inside invitation */}
                <View style={styles.tripSection}>
                  <Text style={styles.tripEyebrow}>CHUYẾN ĐI</Text>
                  <Text style={styles.tripTitle}>{item.trip?.title}</Text>

                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={15} color={Colors.primaryDark} />
                    <Text style={styles.metaText}>{item.trip?.destination?.name}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={15} color={Colors.primaryDark} />
                    <Text style={styles.metaText}>{formatDate(item.trip?.startAt)}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="person-outline" size={15} color={Colors.primaryDark} />
                    <Text style={styles.metaText}>Tên trên vé: {item.participantName}</Text>
                  </View>
                </View>

                {/* Expiry badge / help */}
                {isPending && expText ? (
                  <View style={styles.expiryRow}>
                    <Ionicons name="time-outline" size={14} color="#b45309" />
                    <Text style={styles.expiryText}>{expText}</Text>
                  </View>
                ) : null}

                {/* Action buttons */}
                {isPending ? (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.declineBtn, isWorking && { opacity: 0.6 }]}
                      onPress={() => handleDecline(item)}
                      disabled={isWorking}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.declineBtnText}>Từ chối</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.acceptBtn, isWorking && { opacity: 0.6 }]}
                      onPress={() => handleAccept(item)}
                      disabled={isWorking}
                      activeOpacity={0.85}
                    >
                      {isWorking ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
                          <Text style={styles.acceptBtnText}>Chấp nhận vé</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.ink,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.onSurfaceMuted,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: Colors.inkDeep,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: Colors.inkDeep,
    fontWeight: "900",
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: Colors.inkDeep,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  emptyBox: {
    paddingVertical: 60,
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.ink,
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: Colors.onSurfaceMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    gap: 12,
    ...Shadows.card,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  senderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryPale,
    alignItems: "center",
    justifyContent: "center",
  },
  senderAvatarText: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.inkDeep,
  },
  senderTitle: {
    fontSize: 13,
    color: Colors.onSurface,
  },
  senderNameBold: {
    fontWeight: "800",
    color: Colors.ink,
  },
  createdAtText: {
    fontSize: 11,
    color: Colors.onSurfaceMuted,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusPillWarn: {
    backgroundColor: "#fef3c7",
  },
  statusPillMuted: {
    backgroundColor: Colors.surfaceContainer,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  statusPillTextWarn: {
    color: "#92400e",
  },
  statusPillTextMuted: {
    color: Colors.onSurfaceMuted,
  },
  tripSection: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
    gap: 6,
  },
  tripEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primaryDark,
    letterSpacing: 0.6,
  },
  tripTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.ink,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b45309",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  acceptBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.inkDeep,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
