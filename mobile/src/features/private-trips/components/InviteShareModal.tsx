import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useTripInvitation } from "../hooks/useTripInvitation";

export interface InviteShareModalProps {
  visible: boolean;
  tripId?: string;
  expectedVersion?: number;
  inviteCode?: string;
  expiresAt?: string;
  inviteUrl?: string;
  tripTitle?: string;
  loading?: boolean;
  revoking?: boolean;
  onClose: () => void;
  onGenerateNewCode?: () => void;
  onRevoke?: () => void;
  onInviteGenerated?: (inviteCode: string, tripVersion: number) => void;
}

export function InviteShareModal({
  visible,
  tripId,
  expectedVersion,
  inviteCode: propInviteCode,
  expiresAt: propExpiresAt,
  inviteUrl: _propInviteUrl,
  tripTitle,
  loading: propLoading = false,
  revoking = false,
  onClose,
  onGenerateNewCode,
  onRevoke,
  onInviteGenerated,
}: InviteShareModalProps) {
  const {
    inviteData,
    loading: hookLoading,
    generateInvite,
  } = useTripInvitation();

  const inviteCode = (propInviteCode || inviteData?.inviteCode || "").trim().toUpperCase();
  const expiresAt = propExpiresAt || inviteData?.expiresAt;
  const loading = propLoading || hookLoading;

  const [copied, setCopied] = useState(false);

  // Payload for QR: chỉ truyền đúng chuỗi inviteCode (6 ký tự)
  const qrPayload = inviteCode;

  function handleCopyCode() {
    if (!inviteCode) return;
    Clipboard.setString(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // Auto generate invite via hook ONLY IF parent didn't manage it (no onGenerateNewCode and not already loading)
  useEffect(() => {
    if (
      visible &&
      tripId &&
      expectedVersion !== undefined &&
      !propInviteCode &&
      !inviteData &&
      !propLoading &&
      !onGenerateNewCode
    ) {
      void (async () => {
        try {
          const res = await generateInvite(tripId, expectedVersion);
          onInviteGenerated?.(res.inviteCode, res.tripVersion);
        } catch (err: any) {
          Alert.alert("Lỗi", err?.message || "Không thể tạo mã mời.");
        }
      })();
    }
  }, [
    visible,
    tripId,
    expectedVersion,
    propInviteCode,
    inviteData,
    propLoading,
    onGenerateNewCode,
    generateInvite,
    onInviteGenerated,
  ]);

  async function handleShare() {
    if (!inviteCode) return;
    try {
      await Share.share({
        title: `Mã mời Private Trip: ${tripTitle || "TrekGo"}`,
        message: `Tham gia chuyến đi "${tripTitle || "Private Trip"}" cùng mình trên TrekGo nhé!\nMã mời: ${inviteCode}`,
      });
    } catch {
      // Ignored
    }
  }

  async function handleRegenerate() {
    if (onGenerateNewCode) {
      onGenerateNewCode();
      return;
    }

    if (tripId && expectedVersion !== undefined) {
      try {
        const res = await generateInvite(tripId, expectedVersion);
        onInviteGenerated?.(res.inviteCode, res.tripVersion);
      } catch (err: any) {
        Alert.alert("Lỗi", err?.message || "Không thể tạo mã mời mới.");
      }
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={20} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Ionicons name="share-social" size={24} color={Colors.primaryDark} />
          </View>

          <Text style={styles.title}>Mã mời bạn bè</Text>
          <Text style={styles.subtitle}>
            Chia sẻ mã mời 6 ký tự này để bạn bè nhập mã hoặc quét QR tham gia đoàn.
          </Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Colors.primaryDark} />
              <Text style={styles.loadingText}>Đang tạo mã mời...</Text>
            </View>
          ) : (
            <View style={styles.contentWrapper}>
              {/* QR Code Container */}
              {qrPayload ? (
                <View style={styles.qrCard}>
                  <View style={styles.qrInner}>
                    <QRCode
                      value={qrPayload}
                      size={180}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.qrHint}>
                    Quét mã QR để nhận mã mời 6 ký tự
                  </Text>
                </View>
              ) : null}

              {/* Code Container */}
              <View style={styles.codeContainer}>
                <View style={styles.codeHeaderRow}>
                  <Text style={styles.codeLabel}>MÃ MỜI THAM GIA (6 KÝ TỰ)</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={handleCopyCode}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={copied ? "checkmark-circle" : "copy-outline"}
                      size={14}
                      color={copied ? "#059669" : Colors.primaryDark}
                    />
                    <Text
                      style={[
                        styles.copyText,
                        copied && { color: "#059669", fontWeight: "700" },
                      ]}
                    >
                      {copied ? "Đã chép" : "Sao chép"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Big Monospace Code Display */}
                <View style={styles.codeBox}>
                  <Text style={styles.codeText} selectable>
                    {inviteCode || "------"}
                  </Text>
                </View>

                {/* Expiration date if present */}
                {expiresAt ? (
                  <View style={styles.expiresRow}>
                    <Ionicons
                      name="time-outline"
                      size={13}
                      color={Colors.onSurfaceVariant}
                    />
                    <Text style={styles.expiresText}>
                      Hết hạn:{" "}
                      {new Date(expiresAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {new Date(expiresAt).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                ) : null}

                {/* Feedback Toast */}
                {copied ? (
                  <View style={styles.copiedToast}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.copiedToastText}>
                      Đã sao chép mã mời!
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              disabled={!inviteCode || loading}
            >
              <Ionicons name="share-outline" size={18} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Chia sẻ ngay</Text>
            </TouchableOpacity>

            {(onGenerateNewCode || (tripId && expectedVersion !== undefined)) ? (
              <TouchableOpacity
                style={styles.regenerateButton}
                onPress={handleRegenerate}
                disabled={loading}
              >
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color={Colors.primaryDark}
                />
                <Text style={styles.regenerateButtonText}>Tạo mã mới</Text>
              </TouchableOpacity>
            ) : null}

            {onRevoke ? (
              <TouchableOpacity
                style={styles.revokeButton}
                onPress={onRevoke}
                disabled={loading || revoking}
              >
                {revoking ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <View style={styles.buttonInner}>
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color="#DC2626"
                    />
                    <Text style={styles.revokeButtonText}>Thu hồi link mời</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 22,
    alignItems: "center",
    position: "relative",
    ...Shadows.hover,
  },
  closeIcon: {
    position: "absolute",
    top: 14,
    right: 14,
    padding: 6,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.onSurface,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  contentWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  qrCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    marginBottom: 14,
    ...Shadows.card,
  },
  qrInner: {
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
  },
  qrHint: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 8,
    fontWeight: "600",
  },
  codeContainer: {
    width: "100%",
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    gap: 8,
  },
  codeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.8,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  copyText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  codeBox: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: Colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  codeText: {
    fontSize: 28,
    fontWeight: "900",
    color: Colors.primaryDark,
    letterSpacing: 6,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textTransform: "uppercase",
  },
  expiresRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 2,
  },
  expiresText: {
    fontSize: 11.5,
    color: Colors.onSurfaceVariant,
    fontWeight: "500",
  },
  copiedToast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    alignSelf: "center",
    marginTop: 2,
  },
  copiedToastText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  actionButtons: {
    width: "100%",
    gap: 10,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  regenerateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  regenerateButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primaryDark,
  },
  revokeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: "#FEE2E2",
    marginTop: 2,
  },
  revokeButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
