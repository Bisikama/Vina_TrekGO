import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import {
  CheckInScannerModal,
  type ScanResult,
} from "@/features/check-in/components/CheckInScannerModal";
import {
  buildShortCode,
  formatDayMonth,
  getCheckInWindow,
  parseCheckInCode,
} from "@/features/check-in/utils/checkInQr";
import {
  fetchTripParticipants,
  performCheckIn,
  type CheckInStatus,
  type LeaderParticipantItem,
  type LeaderRosterSummary,
  type LeaderRosterTrip,
} from "@/features/check-in/services/leader-checkin.api";
import {
  getLeaderPublicTripById,
  type LeaderPublicTrip,
} from "@/features/leaders/services/leader-public-trips.api";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Filter = "ALL" | CheckInStatus;

function formatTime(d?: Date) {
  if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatStart(dateStr?: string) {
  if (!dateStr) return "Chưa cập nhật";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Chưa cập nhật";
  return `${formatTime(d)} · ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function LeaderCheckInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = params.tripId || "";
  const { accessToken } = useAuth();

  const [trip, setTrip] = useState<LeaderRosterTrip | LeaderPublicTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [members, setMembers] = useState<LeaderParticipantItem[]>([]);
  const [summary, setSummary] = useState<LeaderRosterSummary | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!tripId) {
      setErrorMessage("Không tìm thấy thông tin ID chuyến đi.");
      setLoading(false);
      return;
    }
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      // 1. Gọi API lấy danh sách đoàn theo chuẩn Backend M6
      const rosterRes = await fetchTripParticipants(tripId);
      setMembers(rosterRes.items || []);
      setSummary(rosterRes.summary || null);
      if (rosterRes.trip) {
        setTrip(rosterRes.trip);
      } else if (accessToken) {
        // Fallback lấy thông tin chuyến từ leader API nếu roster không có trip
        const tripDetail = await getLeaderPublicTripById(tripId, accessToken).catch(() => null);
        if (tripDetail) setTrip(tripDetail);
      }
    } catch (err: any) {
      console.warn("Lỗi khi tải danh sách đoàn:", err);
      // Nếu có lỗi, thử fallback lấy trip detail
      if (accessToken) {
        const tripDetail = await getLeaderPublicTripById(tripId, accessToken).catch(() => null);
        if (tripDetail) setTrip(tripDetail);
      }
      setErrorMessage(err?.message || "Không thể tải danh sách đoàn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [tripId, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkInWindow = getCheckInWindow(trip?.startAt, trip?.endAt);
  const canOperate = checkInWindow.isOpen || devUnlocked || !trip;

  // Thống kê tiến độ dựa trên danh sách members trong state
  const stats = useMemo(() => {
    const checked = members.filter((m) => m.checkinStatus === "CHECKED_IN").length;
    const noShow = members.filter((m) => m.checkinStatus === "NO_SHOW").length;
    const notCheckedIn = members.filter((m) => m.checkinStatus === "NOT_CHECKED_IN").length;
    const total = members.length;
    return {
      checked,
      noShow,
      notCheckedIn,
      total,
      progressPercent: total > 0 ? Math.round((checked / total) * 100) : 0,
    };
  }, [members]);

  const visibleMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => filter === "ALL" || m.checkinStatus === filter)
      .filter((m) => {
        if (!q) return true;
        const nameMatch = m.fullName.toLowerCase().includes(q);
        const phoneMatch = m.phone ? m.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) : false;
        const shortCode = buildShortCode(m.bookingId, m.id).toLowerCase();
        const codeMatch = shortCode.includes(q);
        return nameMatch || phoneMatch || codeMatch;
      })
      .sort((a, b) => {
        // Thứ tự hiển thị: Chưa điểm danh -> Vắng mặt -> Đã điểm danh
        const order = { NOT_CHECKED_IN: 0, NO_SHOW: 1, CHECKED_IN: 2 } as const;
        return order[a.checkinStatus] - order[b.checkinStatus];
      });
  }, [members, filter, query]);

  // Quét QR Code thực địa
  const handleScan = useCallback(
    async (raw: string): Promise<ScanResult> => {
      const checkinCode = parseCheckInCode(raw);
      if (!checkinCode) {
        Vibration.vibrate([0, 80, 60, 80]);
        return {
          kind: "error",
          title: "Mã QR không hợp lệ",
          message: "Không tìm thấy mã điểm danh TrekGo hợp lệ trong mã QR này.",
        };
      }

      try {
        const res = await performCheckIn(tripId, {
          checkinCode,
          method: "QR",
        });

        // 1. Nếu vé đã được quét trước đó
        if (res.alreadyCheckedIn) {
          Vibration.vibrate([0, 60, 40, 60]);
          setMembers((prev) =>
            prev.map((m) =>
              m.id === res.participant.id ? { ...m, ...res.participant } : m,
            ),
          );
          if (res.summary) setSummary(res.summary);
          const checkedTime = res.participant.checkedInAt
            ? formatTime(new Date(res.participant.checkedInAt))
            : "";
          return {
            kind: "duplicate",
            title: `${res.participant.fullName} đã điểm danh`,
            message: checkedTime
              ? `Điểm danh lúc ${checkedTime} · Vé đã được quét trước đó.`
              : "Vé này đã được quét trước đó.",
          };
        }

        // 2. Điểm danh thành công
        Vibration.vibrate(60);
        setMembers((prev) => {
          const exists = prev.some((m) => m.id === res.participant.id);
          if (exists) {
            return prev.map((m) =>
              m.id === res.participant.id ? { ...m, ...res.participant } : m,
            );
          }
          return [res.participant, ...prev];
        });
        if (res.summary) setSummary(res.summary);

        const currentChecked = stats.checked + 1;
        const total = stats.total || (res.summary?.totalParticipants ?? currentChecked);
        const shortCode = buildShortCode(res.participant.bookingId, res.participant.id);

        return {
          kind: "success",
          title: `Đã điểm danh ${res.participant.fullName}`,
          message: `${shortCode} · ${currentChecked}/${total} thành viên có mặt.`,
        };
      } catch (err: any) {
        Vibration.vibrate([0, 80, 60, 80]);
        return {
          kind: "error",
          title: "Điểm danh thất bại",
          message: err?.message || "Vé không hợp lệ hoặc không thuộc chuyến đi này.",
        };
      }
    },
    [tripId, stats.checked, stats.total],
  );

  // Mô phỏng quét QR trong môi trường DEV
  const handleSimulate = useCallback(async (): Promise<ScanResult | null> => {
    const pending = members.filter((m) => m.checkinStatus === "NOT_CHECKED_IN");
    if (pending.length === 0) {
      return {
        kind: "duplicate",
        title: "Không còn ai chờ",
        message: "Tất cả thành viên trong đoàn đã được xử lý.",
      };
    }
    const pick = pending[Math.floor(Math.random() * pending.length)];
    try {
      const res = await performCheckIn(tripId, {
        participantId: pick.id,
        method: "MANUAL",
        checkinStatus: "CHECKED_IN",
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === pick.id ? { ...m, ...res.participant } : m)),
      );
      if (res.summary) setSummary(res.summary);
      Vibration.vibrate(60);
      return {
        kind: "success",
        title: `Đã điểm danh ${res.participant.fullName}`,
        message: `${buildShortCode(res.participant.bookingId, res.participant.id)} · Mô phỏng DEV thành công.`,
      };
    } catch (err: any) {
      return {
        kind: "error",
        title: "Lỗi mô phỏng",
        message: err?.message || "Không thể thực hiện mô phỏng.",
      };
    }
  }, [members, tripId]);

  // Điểm danh thủ công
  const handleManualCheckIn = (m: LeaderParticipantItem) => {
    const shortCode = buildShortCode(m.bookingId, m.id);
    Alert.alert(
      "Điểm danh thủ công",
      `Dùng khi thành viên không xuất trình được mã QR.\nXác nhận ${m.fullName} (${shortCode}) đã có mặt tại điểm tập kết?`,
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Xác nhận có mặt",
          onPress: async () => {
            try {
              const res = await performCheckIn(tripId, {
                participantId: m.id,
                method: "MANUAL",
                checkinStatus: "CHECKED_IN",
              });
              setMembers((prev) =>
                prev.map((item) => (item.id === m.id ? { ...item, ...res.participant } : item)),
              );
              if (res.summary) setSummary(res.summary);
              Vibration.vibrate(60);
            } catch (err: any) {
              Alert.alert("Lỗi điểm danh", err?.message || "Không thể điểm danh thủ công.");
            }
          },
        },
      ],
    );
  };

  // Đánh dấu vắng mặt
  const handleMarkNoShow = (m: LeaderParticipantItem) => {
    Alert.alert(
      "Đánh dấu vắng mặt",
      `Xác nhận thành viên ${m.fullName} không có mặt khi xuất phát?`,
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Đánh dấu vắng",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await performCheckIn(tripId, {
                participantId: m.id,
                method: "MANUAL",
                checkinStatus: "NO_SHOW",
              });
              setMembers((prev) =>
                prev.map((item) => (item.id === m.id ? { ...item, ...res.participant } : item)),
              );
              if (res.summary) setSummary(res.summary);
            } catch (err: any) {
              Alert.alert("Lỗi", err?.message || "Không thể cập nhật trạng thái vắng mặt.");
            }
          },
        },
      ],
    );
  };

  const handleFinish = () => {
    if (stats.notCheckedIn > 0) {
      Alert.alert(
        "Chưa xử lý hết danh sách",
        `Vẫn còn ${stats.notCheckedIn} thành viên chưa được điểm danh hoặc đánh dấu vắng mặt. Vui lòng hoàn tất trước khi tiếp tục.`,
      );
      return;
    }
    Alert.alert(
      "Hoàn tất điểm danh",
      `${stats.checked} có mặt · ${stats.noShow} vắng mặt.\nChuyển sang bước kiểm tra trước khởi hành?`,
      [
        { text: "Xem lại", style: "cancel" },
        {
          text: "Tiếp tục",
          onPress: () =>
            router.push({ pathname: "/field-operations/leader-pretrip" as any, params: { tripId } }),
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.inkDeep} />
          <Text style={styles.loadingText}>Đang tải danh sách đoàn từ máy chủ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "ALL", label: "Tất cả", count: stats.total },
    { key: "NOT_CHECKED_IN", label: "Chưa đến", count: stats.notCheckedIn },
    { key: "CHECKED_IN", label: "Có mặt", count: stats.checked },
    { key: "NO_SHOW", label: "Vắng", count: stats.noShow },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/field-operations" as any);
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>Điểm danh xuất phát</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {trip?.title || "Chuyến đi"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => void load(true)}
          activeOpacity={0.7}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={Colors.ink} />
          ) : (
            <Ionicons name="refresh" size={19} color={Colors.ink} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Error notification banner if any */}
        {errorMessage ? (
          <View style={[styles.banner, styles.bannerDanger]}>
            <Ionicons name="alert-circle" size={18} color="#dc2626" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: "#991b1b" }]}>Không thể đồng bộ dữ liệu</Text>
              <Text style={[styles.bannerText, { color: "#b91c1c" }]}>{errorMessage}</Text>
            </View>
            <TouchableOpacity onPress={() => void load()} style={styles.retryLink}>
              <Text style={styles.retryLinkText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Check-in window banner */}
        {!checkInWindow.isOpen && trip ? (
          <View style={[styles.banner, checkInWindow.isAfter ? styles.bannerMuted : styles.bannerWarn]}>
            <Ionicons
              name={checkInWindow.isAfter ? "checkmark-done" : "lock-closed"}
              size={18}
              color={checkInWindow.isAfter ? Colors.onSurfaceMuted : "#7a5b00"}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>
                {checkInWindow.isAfter
                  ? "Chuyến đi đã kết thúc"
                  : `Điểm danh mở vào ngày ${formatDayMonth(checkInWindow.opensAt)}`}
              </Text>
              <Text style={styles.bannerText}>
                {checkInWindow.isAfter
                  ? "Danh sách chỉ ở chế độ xem lịch sử."
                  : "Bạn có thể xem trước danh sách đoàn. Quét QR sẽ mở vào ngày khởi hành."}
              </Text>
              {__DEV__ && !checkInWindow.isAfter && !devUnlocked ? (
                <TouchableOpacity onPress={() => setDevUnlocked(true)} style={styles.devLink}>
                  <Ionicons name="flask-outline" size={12} color="#7a5b00" />
                  <Text style={styles.devLinkText}>Mở thử điểm danh (DEV)</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Empty state info */}
        {members.length === 0 && !loading && !errorMessage ? (
          <View style={[styles.banner, styles.bannerInfo]}>
            <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
            <Text style={[styles.bannerText, { flex: 1, color: "#075985" }]}>
              Chưa có thành viên nào đặt chỗ cho chuyến đi này.
            </Text>
          </View>
        ) : null}

        {/* Hero progress card */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>TIẾN ĐỘ ĐIỂM DANH</Text>
              <Text style={styles.heroCount}>
                {stats.checked}
                <Text style={styles.heroTotal}> / {stats.total}</Text>
              </Text>
              <Text style={styles.heroMeta}>
                <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.7)" />{" "}
                Khởi hành {formatStart(trip?.startAt)}
              </Text>
            </View>
            <View style={styles.ring}>
              <Text style={styles.ringText}>{stats.progressPercent}%</Text>
            </View>
          </View>

          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${stats.progressPercent}%` }]} />
          </View>

          <View style={styles.heroStats}>
            <HeroStat dot="#9fe870" label="Có mặt" value={stats.checked} />
            <HeroStat dot="#fed018" label="Chưa đến" value={stats.notCheckedIn} />
            <HeroStat dot="#ff8a80" label="Vắng" value={stats.noShow} />
          </View>
        </View>

        {/* Scan QR CTA Button */}
        <TouchableOpacity
          style={[styles.scanCta, !canOperate && styles.scanCtaDisabled]}
          onPress={() => setScannerOpen(true)}
          disabled={!canOperate}
          activeOpacity={0.88}
        >
          <View style={styles.scanCtaIcon}>
            <Ionicons name="scan" size={26} color={canOperate ? Colors.inkDeep : "#8a8f86"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.scanCtaTitle, !canOperate && { color: "#6b7066" }]}>
              Quét mã QR điểm danh
            </Text>
            <Text style={[styles.scanCtaSub, !canOperate && { color: "#8a8f86" }]}>
              {canOperate
                ? "Quét mã QR cá nhân của từng thành viên tại điểm tập kết"
                : `Khả dụng từ ngày ${formatDayMonth(checkInWindow.opensAt)}`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={canOperate ? Colors.inkDeep : "#8a8f86"} />
        </TouchableOpacity>

        {/* Status Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
                <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                    {f.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.onSurfaceMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm theo tên, SĐT hoặc mã vé CK-..."
            placeholderTextColor={Colors.mute}
            style={styles.searchInput}
            autoCapitalize="characters"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={16} color={Colors.mute} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Member list */}
        {visibleMembers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={32} color={Colors.mute} />
            <Text style={styles.emptyText}>Không tìm thấy thành viên nào phù hợp.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleMembers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                disabled={!canOperate}
                onManual={() => handleManualCheckIn(m)}
                onNoShow={() => handleMarkNoShow(m)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer */}
      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerLabel}>
            {stats.notCheckedIn > 0
              ? `Còn ${stats.notCheckedIn} người chưa điểm danh`
              : "Đã xử lý toàn bộ danh sách đoàn"}
          </Text>
          <Text style={styles.footerSub}>
            {stats.checked} có mặt · {stats.noShow} vắng mặt
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.finishBtn, stats.notCheckedIn > 0 && styles.finishBtnDisabled]}
          disabled={stats.notCheckedIn > 0}
          onPress={handleFinish}
          activeOpacity={0.85}
        >
          <Text style={styles.finishBtnText}>Hoàn tất</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* QR Scanner Camera Modal */}
      <CheckInScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        checkedCount={stats.checked}
        totalCount={stats.total}
        onSimulate={__DEV__ ? handleSimulate : undefined}
      />
    </SafeAreaView>
  );
}

function HeroStat({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <View style={styles.heroStat}>
      <View style={[styles.heroDot, { backgroundColor: dot }]} />
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function MemberRow({
  member,
  disabled,
  onManual,
  onNoShow,
}: {
  member: LeaderParticipantItem;
  disabled: boolean;
  onManual: () => void;
  onNoShow: () => void;
}) {
  const s = member.checkinStatus;
  const shortCode = buildShortCode(member.bookingId, member.id);
  const checkedAtTime = member.checkedInAt ? formatTime(new Date(member.checkedInAt)) : "";

  const pill = useMemo(() => {
    if (s === "CHECKED_IN") {
      const methodLabel = member.checkinMethod === "MANUAL" ? "Thủ công" : "QR";
      return {
        label: checkedAtTime ? `${methodLabel} · ${checkedAtTime}` : "Đã điểm danh",
        bg: "#dcfce7",
        color: "#166534",
        icon: "checkmark-circle" as const,
      };
    }
    if (s === "NO_SHOW") {
      return {
        label: "Vắng mặt",
        bg: Colors.errorContainer,
        color: Colors.onErrorContainer,
        icon: "close-circle" as const,
      };
    }
    return {
      label: "Chưa đến",
      bg: "#fff7d6",
      color: "#7a5b00",
      icon: "time-outline" as const,
    };
  }, [s, member.checkinMethod, checkedAtTime]);

  return (
    <View
      style={[
        styles.row,
        s === "CHECKED_IN" && styles.rowChecked,
        s === "NO_SHOW" && styles.rowNoShow,
      ]}
    >
      <View
        style={[
          styles.avatar,
          s === "CHECKED_IN" && { backgroundColor: "#9fe870" },
          s === "NO_SHOW" && { backgroundColor: Colors.errorContainer },
        ]}
      >
        {s === "CHECKED_IN" ? (
          <Ionicons name="checkmark" size={20} color={Colors.inkDeep} />
        ) : (
          <Text style={[styles.avatarText, s === "NO_SHOW" && { color: Colors.onErrorContainer }]}>
            {member.fullName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.nameRow}>
          <Text style={styles.rowName} numberOfLines={1}>
            {member.fullName}
          </Text>
          {member.isLinkedAccount ? (
            <View style={styles.linkedBadge}>
              <Text style={styles.linkedBadgeText}>Chính chủ</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.rowMeta} numberOfLines={1}>
          {shortCode} · {member.phone || (member.buyerPhone ? `Người mua: ${member.buyerPhone}` : "Không có SĐT")}
        </Text>

        {member.pickupPoint?.name ? (
          <Text style={styles.pickupMeta} numberOfLines={1}>
            <Ionicons name="location-outline" size={11} color={Colors.onSurfaceMuted} /> {member.pickupPoint.name}
          </Text>
        ) : null}

        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <Ionicons name={pill.icon} size={11} color={pill.color} />
          <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
        </View>
      </View>

      {/* Action buttons */}
      {s === "NOT_CHECKED_IN" ? (
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[styles.actBtn, styles.actBtnPrimary, disabled && styles.actDisabled]}
            onPress={onManual}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Ionicons name="hand-left-outline" size={16} color={Colors.inkDeep} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actBtn, styles.actBtnDanger, disabled && styles.actDisabled]}
            onPress={onNoShow}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Ionicons name="person-remove-outline" size={16} color={Colors.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.rowActions}>
          {s === "NO_SHOW" ? (
            <TouchableOpacity
              style={[styles.actBtn, styles.actBtnPrimary, disabled && styles.actDisabled]}
              onPress={onManual}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-outline" size={16} color={Colors.inkDeep} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actBtn, styles.actBtnDanger, disabled && styles.actDisabled]}
              onPress={onNoShow}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Ionicons name="close-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  loadingText: { marginTop: 12, color: Colors.onSurfaceVariant, fontSize: 13 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "900", color: Colors.ink },
  headerSub: { fontSize: 11, color: Colors.onSurfaceMuted, marginTop: 2, maxWidth: 230 },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  banner: { flexDirection: "row", gap: 10, padding: 12, borderRadius: Radius.md },
  bannerWarn: { backgroundColor: "#fff7d6" },
  bannerMuted: { backgroundColor: Colors.surfaceContainer },
  bannerInfo: { backgroundColor: "#e0f2fe", alignItems: "center" },
  bannerDanger: { backgroundColor: "#fee2e2", alignItems: "center" },
  bannerTitle: { fontSize: 13, fontWeight: "800", color: "#1c1d1a" },
  bannerText: { fontSize: 12, color: Colors.onSurfaceMuted, marginTop: 2 },
  retryLink: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fca5a5", borderRadius: 8 },
  retryLinkText: { fontSize: 12, fontWeight: "800", color: "#7f1d1d" },
  devLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingVertical: 3,
  },
  devLinkText: { fontSize: 11, color: "#7a5b00", fontWeight: "700" },
  hero: {
    backgroundColor: Colors.inkDeep,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadows.card,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#9fe870",
  },
  heroCount: { fontSize: 28, fontWeight: "900", color: "#ffffff", marginTop: 2 },
  heroTotal: { fontSize: 18, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  heroMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: "#9fe870",
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  heroTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
    marginTop: 12,
    overflow: "hidden",
  },
  heroFill: { height: "100%", backgroundColor: "#9fe870", borderRadius: 3 },
  heroStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  heroStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroDot: { width: 8, height: 8, borderRadius: 4 },
  heroStatValue: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  heroStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  scanCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: "#eefbe4",
    borderWidth: 1.5,
    borderColor: "#c5edab",
    ...Shadows.card,
  },
  scanCtaDisabled: {
    backgroundColor: Colors.surfaceContainerLow,
    borderColor: Colors.surfaceContainer,
  },
  scanCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#d5f4b8",
    alignItems: "center",
    justifyContent: "center",
  },
  scanCtaTitle: { fontSize: 14, fontWeight: "800", color: Colors.inkDeep },
  scanCtaSub: { fontSize: 11, color: Colors.onSurfaceMuted, marginTop: 2 },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  filterChipActive: { backgroundColor: Colors.inkDeep },
  filterText: { fontSize: 12, fontWeight: "700", color: Colors.onSurfaceVariant },
  filterTextActive: { color: "#ffffff" },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.surfaceContainer,
  },
  filterBadgeActive: { backgroundColor: "#9fe870" },
  filterBadgeText: { fontSize: 10, fontWeight: "800", color: Colors.ink },
  filterBadgeTextActive: { color: Colors.inkDeep },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink, padding: 0 },
  list: { gap: 8 },
  emptyBox: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { fontSize: 13, color: Colors.onSurfaceMuted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  rowChecked: { borderColor: "#c5edab", backgroundColor: "#f9fef5" },
  rowNoShow: { borderColor: "#fed7d7", backgroundColor: "#fff5f5" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowName: { fontSize: 14, fontWeight: "800", color: Colors.ink, flexShrink: 1 },
  linkedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#e0f2fe",
  },
  linkedBadgeText: { fontSize: 9, fontWeight: "700", color: "#0369a1" },
  rowMeta: { fontSize: 11, color: Colors.onSurfaceMuted, marginTop: 2 },
  pickupMeta: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  pillText: { fontSize: 10, fontWeight: "700" },
  rowActions: { flexDirection: "row", gap: 6 },
  actBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actBtnPrimary: { backgroundColor: "#eefbe4", borderColor: "#c5edab" },
  actBtnDanger: { backgroundColor: "#fff1f0", borderColor: "#fecaca" },
  actDisabled: { opacity: 0.4 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
  },
  footerLabel: { fontSize: 13, fontWeight: "800", color: Colors.onSurface },
  footerSub: { fontSize: 11, color: Colors.onSurfaceMuted, marginTop: 2 },
  finishBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: Radius.full,
    backgroundColor: Colors.inkDeep,
  },
  finishBtnDisabled: { backgroundColor: "#aab3a5" },
  finishBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
