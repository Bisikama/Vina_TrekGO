import { Colors, Radius, Shadows } from "@/constants/theme";
import type { BookingDetail } from "@/features/bookings/types";
import {
  buildCheckInQrValue,
  buildShortCode,
  formatDayMonth,
  getCheckInWindow,
} from "@/features/check-in/utils/checkInQr";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

export interface CheckInQrCardProps {
  booking: BookingDetail;
}

/**
 * Thẻ QR điểm danh hiển thị trên màn hình chi tiết đặt chỗ của Trekker.
 * Mỗi thành viên trong booking có 1 mã QR riêng để Leader quét tại điểm tập kết.
 */
export function CheckInQrCard({ booking }: CheckInQrCardProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const participants = useMemo(() => {
    const list = booking.participants?.length
      ? booking.participants
      : [{ fullName: "Trekker" } as BookingDetail["participants"][number]];
    return list.map((p, idx) => {
      const participantId = p.id || `${booking.id}-${idx + 1}`;
      return {
        key: participantId,
        name: p.fullName || `Thành viên #${idx + 1}`,
        shortCode: buildShortCode(booking.id, participantId),
        qrValue: buildCheckInQrValue({
          tripId: booking.trip?.id || "",
          bookingId: booking.id,
          participantId,
          name: p.fullName || `Thành viên #${idx + 1}`,
        }),
      };
    });
  }, [booking]);

  const checkInWindow = getCheckInWindow(booking.trip?.startAt, booking.trip?.endAt);
  const active = participants[Math.min(activeIdx, participants.length - 1)];

  const status = checkInWindow.isOpen
    ? { label: "ĐANG MỞ ĐIỂM DANH", bg: "#dcfce7", color: "#166534", icon: "radio-button-on" as const }
    : checkInWindow.isBefore
      ? { label: `MỞ NGÀY ${formatDayMonth(checkInWindow.opensAt)}`, bg: "#fff7d6", color: "#7a5b00", icon: "time-outline" as const }
      : { label: "ĐÃ KẾT THÚC", bg: Colors.surfaceContainer, color: Colors.onSurfaceMuted, icon: "checkmark-done" as const };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="qr-code" size={18} color="#ffffff" />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.title}>Mã QR điểm danh</Text>
          <Text style={styles.subtitle}>Xuất trình cho Leader tại điểm tập kết</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={10} color={status.color} />
          <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Participant switcher */}
      {participants.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {participants.map((p, idx) => {
            const selected = idx === activeIdx;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setActiveIdx(idx)}
                activeOpacity={0.8}
              >
                <View style={[styles.chipAvatar, selected && styles.chipAvatarActive]}>
                  <Text style={[styles.chipAvatarText, selected && styles.chipAvatarTextActive]}>
                    {p.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={[styles.chipText, selected && styles.chipTextActive]}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {/* QR */}
      <TouchableOpacity
        style={styles.qrWrap}
        activeOpacity={0.9}
        onPress={() => setFullscreen(true)}
      >
        <View style={styles.qrFrame}>
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />
          <QRCode
            value={active.qrValue}
            size={176}
            color={Colors.ink}
            backgroundColor="#FFFFFF"
            ecl="M"
          />
        </View>
        <View style={styles.expandHint}>
          <Ionicons name="expand-outline" size={12} color={Colors.onSurfaceMuted} />
          <Text style={styles.expandHintText}>Chạm để phóng to</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.memberName}>{active.name}</Text>
      <Text style={styles.shortCode}>{active.shortCode}</Text>

      {/* Tips */}
      <View style={styles.tipBox}>
        <Ionicons name="sunny-outline" size={16} color="#7a5b00" />
        <Text style={styles.tipText}>
          Tăng độ sáng màn hình khi quét. Mỗi thành viên có mã riêng — không chia sẻ mã cho người khác.
        </Text>
      </View>

      {/* Fullscreen modal */}
      <Modal
        visible={fullscreen}
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
      >
        <SafeAreaView style={styles.fsSafe}>
          <View style={styles.fsHeader}>
            <TouchableOpacity style={styles.fsClose} onPress={() => setFullscreen(false)}>
              <Ionicons name="close" size={22} color={Colors.ink} />
            </TouchableOpacity>
            <Text style={styles.fsHeaderTitle}>Điểm danh</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.fsBody}>
            <Text style={styles.fsTrip} numberOfLines={2}>
              {booking.trip?.title}
            </Text>
            <View style={styles.fsQrCard}>
              <QRCode
                value={active.qrValue}
                size={260}
                color={Colors.ink}
                backgroundColor="#FFFFFF"
                ecl="M"
              />
            </View>
            <Text style={styles.fsName}>{active.name}</Text>
            <Text style={styles.fsCode}>{active.shortCode}</Text>

            {participants.length > 1 ? (
              <View style={styles.fsNav}>
                <TouchableOpacity
                  style={[styles.fsNavBtn, activeIdx === 0 && styles.fsNavBtnDisabled]}
                  disabled={activeIdx === 0}
                  onPress={() => setActiveIdx((i) => Math.max(0, i - 1))}
                >
                  <Ionicons name="chevron-back" size={20} color={Colors.ink} />
                </TouchableOpacity>
                <Text style={styles.fsNavText}>
                  {activeIdx + 1} / {participants.length}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.fsNavBtn,
                    activeIdx === participants.length - 1 && styles.fsNavBtnDisabled,
                  ]}
                  disabled={activeIdx === participants.length - 1}
                  onPress={() =>
                    setActiveIdx((i) => Math.min(participants.length - 1, i + 1))
                  }
                >
                  <Ionicons name="chevron-forward" size={20} color={Colors.ink} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const LIME = "#9fe870";

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadows.hover,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.inkDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "900", color: Colors.onSurface },
  subtitle: { fontSize: 11, color: Colors.onSurfaceMuted, marginTop: 2 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusPillText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  chipsRow: { gap: 8, paddingTop: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    maxWidth: 170,
  },
  chipActive: { backgroundColor: Colors.inkDeep, borderColor: Colors.inkDeep },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  chipAvatarActive: { backgroundColor: LIME },
  chipAvatarText: { fontSize: 11, fontWeight: "900", color: Colors.onSurfaceVariant },
  chipAvatarTextActive: { color: Colors.inkDeep },
  chipText: { fontSize: 12, fontWeight: "700", color: Colors.onSurfaceVariant, flexShrink: 1 },
  chipTextActive: { color: "#ffffff" },
  qrWrap: { alignItems: "center", marginTop: 18 },
  qrFrame: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  corner: { position: "absolute", width: 22, height: 22, borderColor: LIME },
  cTL: { top: -1, left: -1, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 20 },
  cTR: { top: -1, right: -1, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 20 },
  cBL: { bottom: -1, left: -1, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 20 },
  cBR: { bottom: -1, right: -1, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 20 },
  expandHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  expandHintText: { fontSize: 11, color: Colors.onSurfaceMuted },
  memberName: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 17,
    fontWeight: "900",
    color: Colors.onSurface,
  },
  shortCode: {
    textAlign: "center",
    marginTop: 2,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: Colors.secondary,
  },
  tipBox: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: "#fff7d6",
  },
  tipText: { flex: 1, fontSize: 11, lineHeight: 16, color: "#6b5200" },
  // Fullscreen
  fsSafe: { flex: 1, backgroundColor: "#ffffff" },
  fsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fsClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  fsHeaderTitle: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  fsBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  fsTrip: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.onSurfaceMuted,
    textAlign: "center",
    marginBottom: 20,
  },
  fsQrCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: LIME,
    ...Shadows.hover,
  },
  fsName: { marginTop: 22, fontSize: 24, fontWeight: "900", color: Colors.ink },
  fsCode: { marginTop: 4, fontSize: 16, fontWeight: "800", letterSpacing: 2, color: Colors.secondary },
  fsNav: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 28 },
  fsNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  fsNavBtnDisabled: { opacity: 0.35 },
  fsNavText: { fontSize: 14, fontWeight: "800", color: Colors.onSurfaceVariant },
});
