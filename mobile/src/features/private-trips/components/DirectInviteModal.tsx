import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/features/auth/AuthContext";
import { useDirectMemberInvitations } from "../hooks/useDirectMemberInvitations";
import type { InvitationStatus, PrivateMemberInvitationItem } from "../types";

export interface DirectInviteModalProps {
  visible: boolean;
  tripId: string;
  tripTitle?: string;
  onClose: () => void;
  onInviteSentSuccess?: () => void;
}

export function DirectInviteModal({
  visible,
  tripId,
  tripTitle,
  onClose,
  onInviteSentSuccess,
}: DirectInviteModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"SEND" | "HISTORY">("SEND");
  const [emailInput, setEmailInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    sentInvitations,
    loading,
    sending,
    revokingId,
    sendDirectInvite,
    revokeInvite,
    fetchSentInvitations,
  } = useDirectMemberInvitations(tripId);

  const pendingCount = sentInvitations.filter((i) => i.status === "PENDING").length;

  const handleSend = async () => {
    setLocalError(null);
    const email = emailInput.trim();
    if (!email) {
      setLocalError("Vui lòng nhập email tài khoản bạn bè.");
      return;
    }
    if (!email.includes("@") || !email.includes(".")) {
      setLocalError("Email không đúng định dạng.");
      return;
    }

    if (user?.email && user.email.trim().toLowerCase() === email.toLowerCase()) {
      setLocalError(
        "Đây là email của bạn (Host chuyến đi). Bạn đã có mặt trong đoàn rồi, không thể tự gửi lời mời cho chính mình.",
      );
      return;
    }

    const result = await sendDirectInvite(email);
    if (result.success) {
      setEmailInput("");
      Alert.alert(
        "Gửi lời mời thành công! ✉️",
        `Đã gửi lời mời tham gia chuyến đi tới tài khoản ${email}. Lời mời đã xuất hiện trong Hộp thư của bạn bè.`,
        [
          {
            text: "Xem danh sách đã gửi",
            onPress: () => setActiveTab("HISTORY"),
          },
          { text: "Đóng", onPress: onClose },
        ],
      );
      if (onInviteSentSuccess) onInviteSentSuccess();
    } else {
      setLocalError(result.error || "Gửi lời mời thất bại.");
    }
  };

  const handleRevoke = (invitation: PrivateMemberInvitationItem) => {
    Alert.alert(
      "Thu hồi lời mời",
      `Bạn có chắc chắn muốn thu hồi lời mời gửi tới ${invitation.recipientDisplay || "thành viên này"}?`,
      [
        { text: "Không", style: "cancel" },
        {
          text: "Thu hồi ngay",
          style: "destructive",
          onPress: async () => {
            const ok = await revokeInvite(invitation.id);
            if (ok) {
              Alert.alert("Đã thu hồi", "Lời mời đã được thu hồi thành công.");
            }
          },
        },
      ],
    );
  };

  const renderStatusBadge = (status: InvitationStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <View style={[styles.badge, styles.badgePending]}>
            <Ionicons name="time-outline" size={12} color="#9A3412" />
            <Text style={[styles.badgeText, styles.badgeTextPending]}>
              Chờ phản hồi
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
              Đã thu hồi
            </Text>
          </View>
        );
      case "EXPIRED":
        return (
          <View style={[styles.badge, styles.badgeRevoked]}>
            <Ionicons name="alert-circle-outline" size={12} color="#64748B" />
            <Text style={[styles.badgeText, styles.badgeTextRevoked]}>
              Hết hạn
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

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d
        .getHours()
        .toString()
        .padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    } catch {
      return isoString;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerIcon}>
                <Ionicons name="mail" size={20} color="#054D28" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Mời Bạn Bè Qua Email</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {tripTitle || "Chuyến đi riêng tư"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Segmented Control / Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "SEND" && styles.tabBtnActive]}
              onPress={() => setActiveTab("SEND")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="send-outline"
                size={15}
                color={activeTab === "SEND" ? "#054D28" : "#64748B"}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "SEND" && styles.tabBtnTextActive,
                ]}
              >
                Gửi lời mời mới
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "HISTORY" && styles.tabBtnActive,
              ]}
              onPress={() => {
                setActiveTab("HISTORY");
                void fetchSentInvitations();
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="list-outline"
                size={15}
                color={activeTab === "HISTORY" ? "#054D28" : "#64748B"}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "HISTORY" && styles.tabBtnTextActive,
                ]}
              >
                Đã gửi ({sentInvitations.length})
              </Text>
              {pendingCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Tab 1: SEND INVITATION */}
          {activeTab === "SEND" && (
            <ScrollView
              style={styles.tabBody}
              contentContainerStyle={styles.tabBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.inputLabel}>
                Email tài khoản TrekGO của bạn bè{" "}
                <Text style={{ color: "#DC2626" }}>*</Text>
              </Text>

              <View
                style={[
                  styles.inputWrap,
                  Boolean(localError) && styles.inputWrapError,
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={localError ? "#DC2626" : "#64748B"}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="nhap-email-ban-be@example.com"
                  placeholderTextColor="#94A3B8"
                  value={emailInput}
                  onChangeText={(val) => {
                    setEmailInput(val);
                    setLocalError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                />
                {emailInput.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setEmailInput("");
                      setLocalError(null);
                    }}
                  >
                    <Ionicons name="close-circle" size={17} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {Boolean(localError) && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorBannerText}>{localError}</Text>
                </View>
              )}

              <View style={styles.noteCard}>
                <View style={styles.noteItem}>
                  <Ionicons name="mail" size={14} color="#054D28" />
                  <Text style={styles.noteItemText}>
                    Lời mời sẽ gửi đích danh tới mục Hộp thư lời mời của tài khoản bạn bè.
                  </Text>
                </View>
                <View style={styles.noteItem}>
                  <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                  <Text style={styles.noteItemText}>
                    Không trừ giới hạn thành viên (capacity) cho đến khi người nhận bấm chấp nhận.
                  </Text>
                </View>
                <View style={styles.noteItem}>
                  <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                  <Text style={styles.noteItemText}>
                    Hạn phản hồi: 7 ngày kể từ lúc gửi. Host có thể thu hồi bất cứ lúc nào.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primarySubmitBtn, sending && styles.btnDisabled]}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.88}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={17} color="#FFFFFF" />
                    <Text style={styles.primarySubmitBtnText}>
                      Gửi Lời Mời Ngay
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Tab 2: HISTORY */}
          {activeTab === "HISTORY" && (
            <View style={styles.tabBody}>
              {loading && sentInvitations.length === 0 ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="small" color="#054D28" />
                  <Text style={styles.centerSubText}>
                    Đang tải danh sách lời mời đã gửi...
                  </Text>
                </View>
              ) : sentInvitations.length === 0 ? (
                <View style={styles.centerBox}>
                  <Ionicons name="mail-open-outline" size={42} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>Chưa có lời mời trực tiếp nào</Text>
                  <Text style={styles.centerSubText}>
                    Bấm sang tab &ldquo;Gửi lời mời mới&rdquo; để mời bạn bè bằng
                    email tài khoản TrekGO.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={styles.historyList}
                  showsVerticalScrollIndicator={false}
                >
                  {sentInvitations.map((inv) => {
                    const isPending = inv.status === "PENDING";
                    const isRevoking = revokingId === inv.id;

                    return (
                      <View key={inv.id} style={styles.historyCard}>
                        <View style={styles.historyCardHeader}>
                          <View style={styles.recipientInfo}>
                            <Ionicons
                              name="person-circle-outline"
                              size={22}
                              color="#054D28"
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.recipientName} numberOfLines={1}>
                                {inv.recipientDisplay || "Thành viên TrekGO"}
                              </Text>
                              <Text style={styles.createdDate}>
                                Đã gửi: {formatDate(inv.createdAt)}
                              </Text>
                            </View>
                          </View>

                          {renderStatusBadge(inv.status)}
                        </View>

                        {isPending && (
                          <View style={styles.historyCardFooter}>
                            <Text style={styles.expiresText}>
                              Hạn phản hồi: {formatDate(inv.expiresAt)}
                            </Text>

                            <TouchableOpacity
                              style={styles.revokeBtn}
                              onPress={() => handleRevoke(inv)}
                              disabled={isRevoking}
                              activeOpacity={0.8}
                            >
                              {isRevoking ? (
                                <ActivityIndicator size="small" color="#DC2626" />
                              ) : (
                                <>
                                  <Ionicons
                                    name="ban-outline"
                                    size={14}
                                    color="#DC2626"
                                  />
                                  <Text style={styles.revokeBtnText}>Thu hồi</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(14, 15, 12, 0.55)",
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    minHeight: 440,
    overflow: "hidden",
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    ...Shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: "#E2F6D5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#0E0F0C",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: "#F1F5F9",
  },
  tabBtnActive: {
    backgroundColor: "#E2F6D5",
    borderWidth: 1,
    borderColor: "#A3E635",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: "#054D28",
    fontWeight: "700",
  },
  tabBadge: {
    backgroundColor: "#EA580C",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  tabBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  tabBodyContent: {
    paddingBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginTop: 2,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    height: 50,
  },
  inputWrapError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: "#0E0F0C",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 10,
    borderRadius: Radius.sm,
    marginTop: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },
  noteCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  noteItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  noteItemText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    color: "#475569",
  },
  primarySubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#054D28",
    height: 50,
    borderRadius: Radius.full,
    marginTop: 22,
    ...Shadows.hover,
  },
  primarySubmitBtnText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    marginTop: 4,
  },
  centerSubText: {
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  historyList: {
    paddingBottom: 24,
    gap: 10,
  },
  historyCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: Radius.lg,
    padding: 14,
  },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recipientInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  recipientName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0E0F0C",
  },
  createdDate: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  historyCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  expiresText: {
    fontSize: 11,
    color: "#64748B",
    flex: 1,
  },
  revokeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  revokeBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#DC2626",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
});
