import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { authApi } from "@/features/auth/api";
import type { AuthUser } from "@/features/auth/types";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export function LeaderProfileScreen({ onLogout }: { onLogout?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accessToken, signOut: authSignOut } = useAuth();

  const [leaderUser, setLeaderUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const res = await authApi.me(accessToken);
      setLeaderUser(res);
    } catch (err: any) {
      setError(err?.message || "Không thể tải thông tin hồ sơ Leader.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất tài khoản Mountain Leader?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: () => {
          if (onLogout) {
            onLogout();
          } else {
            void authSignOut();
            router.replace("/");
          }
        },
      },
    ]);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            paddingLeft: Math.max(0, insets.left),
            paddingRight: Math.max(0, insets.right),
          },
        ]}
      >
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#125238" />
          <Text style={styles.loadingText}>Đang tải thông tin Mountain Leader...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = leaderUser?.fullName || leaderUser?.name || "Mountain Leader";
  const email = leaderUser?.email || "Chưa cập nhật";
  const phone = leaderUser?.phone || "Chưa cập nhật SĐT";
  const role = leaderUser?.role || "LEADER";
  const status = leaderUser?.status || "ACTIVE";
  const createdAt = leaderUser?.createdAt
    ? new Date(leaderUser.createdAt).toLocaleDateString("vi-VN")
    : "Chưa cập nhật";

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          paddingLeft: Math.max(0, insets.left),
          paddingRight: Math.max(0, insets.right),
        },
      ]}
      edges={["top", "left", "right"]}
    >
      {/* 1. Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hồ sơ Mountain Leader</Text>
        <TouchableOpacity style={styles.logoutHeaderBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#ba1a1a" />
          <Text style={styles.logoutHeaderText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(40, insets.bottom + 28) },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#125238"]} />
        }
      >
        {/* 2. Thẻ Thông tin cá nhân chính (Avatar, Tên, Role) */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            {leaderUser?.avatarUrl || leaderUser?.avatar ? (
              <Image
                source={{ uri: (leaderUser.avatarUrl || leaderUser.avatar)! }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#ffffff" />
            </View>
          </View>

          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileEmail}>{email}</Text>

          <View style={styles.roleBadgeRow}>
            <View style={styles.roleBadge}>
              <Ionicons name="ribbon-outline" size={12} color="#002113" />
              <Text style={styles.roleBadgeText}>{role}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                status === "ACTIVE" ? styles.statusActive : styles.statusInactive,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  status === "ACTIVE" ? styles.statusActiveText : styles.statusInactiveText,
                ]}
              >
                {status === "ACTIVE" ? "ĐANG HOẠT ĐỘNG" : status}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Khối Chi tiết Hồ sơ (/api/v1/auth/me) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="id-card-outline" size={18} color="#125238" />
            <Text style={styles.sectionTitle}>THÔNG TIN TÀI KHOẢN VẬN HÀNH</Text>
          </View>

          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Mã định danh (User ID)</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {leaderUser?.id || "Chưa có"}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Auth User ID</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {(leaderUser as any)?.authUserId || leaderUser?.id || "Chưa có"}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Số điện thoại</Text>
              <Text style={styles.infoValue}>{phone}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Ngày gia nhập TrekGo</Text>
              <Text style={styles.infoValue}>{createdAt}</Text>
            </View>
          </View>
        </View>

        {/* 4. Khối Chứng chỉ & Tiêu chuẩn VFRS */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="medal-outline" size={18} color="#125238" />
            <Text style={styles.sectionTitle}>CHỨNG NHẬN VẬN HÀNH VFRS</Text>
          </View>
          <View style={styles.vfrsBadgeBox}>
            <Ionicons name="checkmark-done-circle" size={20} color="#125238" />
            <View style={{ flex: 1 }}>
              <Text style={styles.vfrsBadgeTitle}>Mountain Leader Cấp 2 (VFRS Level 2)</Text>
              <Text style={styles.vfrsBadgeSub}>
                Đủ điều kiện xuất bản và chỉ huy Public Trips có độ khó Medium / Hard, chịu trách nhiệm an toàn lộ trình.
              </Text>
            </View>
          </View>
        </View>

        {/* 5. Nút Đăng xuất chính */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.84}>
          <Ionicons name="log-out-outline" size={18} color="#ffffff" />
          <Text style={styles.logoutBtnText}>Đăng xuất tài khoản</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e8ebe6",
  },
  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#707972",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e9e2",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#121c2a",
    letterSpacing: 0.3,
  },
  logoutHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  logoutHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ba1a1a",
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  profileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d6dbd2",
    ...Shadows.card,
    gap: 6,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 6,
  },
  avatarImg: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#9fe870",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#9fe870",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#121c2a",
  },
  profileEmail: {
    fontSize: 12.5,
    color: "#707972",
  },
  roleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#b1f0cd",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10.5,
    fontWeight: "900",
    color: "#002113",
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: "#dcfce7",
  },
  statusInactive: {
    backgroundColor: "#fee2e2",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  statusActiveText: {
    color: "#166534",
  },
  statusInactiveText: {
    color: "#991b1b",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d6dbd2",
    ...Shadows.card,
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#121c2a",
    letterSpacing: 0.4,
  },
  infoList: {
    gap: 10,
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f8faf7",
  },
  infoLabel: {
    fontSize: 11.5,
    color: "#707972",
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#121c2a",
    maxWidth: "60%",
    textAlign: "right",
  },
  vfrsBadgeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#d1e8d5",
    padding: 12,
    borderRadius: 20,
  },
  vfrsBadgeTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#166534",
    marginBottom: 2,
  },
  vfrsBadgeSub: {
    fontSize: 11,
    color: "#166534",
    lineHeight: 15,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ba1a1a",
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
    ...Shadows.card,
  },
  logoutBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});
