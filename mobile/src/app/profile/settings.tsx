import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import type { ProfileVisibility, TrekkerNotificationSettings } from "@/types";

const visibilityOptions: { value: ProfileVisibility; label: string }[] = [
  { value: "PUBLIC", label: "Công khai" },
  { value: "FOLLOWERS", label: "Người theo dõi" },
  { value: "PRIVATE", label: "Riêng tư" },
];

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { trekkerAccount, updateTrekkerAccount } = useApp();
  const [notifications, setNotifications] = useState(trekkerAccount.notifications);
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>(
    trekkerAccount.privacy.profileVisibility,
  );
  const [activityVisibility, setActivityVisibility] = useState<ProfileVisibility>(
    trekkerAccount.privacy.activityVisibility,
  );
  const [allowFollowRequests, setAllowFollowRequests] = useState(
    trekkerAccount.privacy.allowFollowRequests,
  );

  function toggleNotification(key: keyof TrekkerNotificationSettings) {
    setNotifications((current) => ({ ...current, [key]: !current[key] }));
  }

  function saveSettings() {
    updateTrekkerAccount({
      notifications,
      privacy: {
        profileVisibility,
        activityVisibility,
        allowFollowRequests,
      },
    });

    Alert.alert("Đã lưu cài đặt", "Tùy chọn tài khoản mock đã được cập nhật.", [
      { text: "Xong", onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>ACCOUNT PREFERENCES</Text>
          <Text style={styles.headerTitle}>Cài đặt tài khoản</Text>
        </View>
        <TouchableOpacity style={styles.saveHeaderButton} onPress={saveSettings}>
          <Text style={styles.saveHeaderButtonText}>Lưu</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="options" size={24} color={Colors.onPrimaryDark} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.heroTitle}>Cá nhân hóa TrekGo</Text>
            <Text style={styles.heroText}>
              Các thay đổi chỉ tồn tại trong phiên chạy mock và sẽ được nối API sau.
            </Text>
          </View>
        </View>

        <SettingsSection title="Thông báo" icon="notifications-outline">
          <ToggleRow
            icon="calendar-outline"
            title="Cập nhật chuyến đi"
            subtitle="Lịch khởi hành, thay đổi địa điểm và check-in"
            value={notifications.tripUpdates}
            onValueChange={() => toggleNotification("tripUpdates")}
          />
          <ToggleRow
            icon="warning-outline"
            title="Cảnh báo an toàn"
            subtitle="Thời tiết, thay đổi tuyến và thông báo khẩn"
            value={notifications.safetyAlerts}
            onValueChange={() => toggleNotification("safetyAlerts")}
            locked
          />
          <ToggleRow
            icon="people-outline"
            title="Hoạt động Community"
            subtitle="Lượt thích, bình luận và người theo dõi mới"
            value={notifications.communityActivities}
            onValueChange={() => toggleNotification("communityActivities")}
          />
          <ToggleRow
            icon="pricetag-outline"
            title="Ưu đãi & Gợi ý"
            subtitle="Chuyến đi và thiết bị phù hợp với bạn"
            value={notifications.promotions}
            onValueChange={() => toggleNotification("promotions")}
            last
          />
        </SettingsSection>

        <SettingsSection title="Quyền riêng tư" icon="lock-closed-outline">
          <Text style={styles.optionLabel}>Ai có thể xem hồ sơ Community?</Text>
          <VisibilitySelector value={profileVisibility} onChange={setProfileVisibility} />

          <Text style={[styles.optionLabel, styles.optionLabelSpaced]}>
            Ai có thể xem lịch sử hoạt động?
          </Text>
          <VisibilitySelector value={activityVisibility} onChange={setActivityVisibility} />

          <View style={styles.followRequestRow}>
            <View style={styles.flexOne}>
              <Text style={styles.toggleTitle}>Cho phép yêu cầu theo dõi</Text>
              <Text style={styles.toggleSubtitle}>Người khác có thể gửi yêu cầu kết nối.</Text>
            </View>
            <Switch
              value={allowFollowRequests}
              onValueChange={setAllowFollowRequests}
              trackColor={{ false: Colors.surfaceContainerHighest, true: Colors.primaryNeutral }}
              thumbColor={allowFollowRequests ? Colors.primaryDark : Colors.onSurfaceMuted}
            />
          </View>
        </SettingsSection>

        <SettingsSection title="Bảo mật" icon="shield-checkmark-outline">
          <ActionRow icon="key-outline" title="Đổi mật khẩu" subtitle="Chưa nối Auth API" />
          <ActionRow icon="phone-portrait-outline" title="Thiết bị đăng nhập" subtitle="1 thiết bị đang hoạt động" />
          <ActionRow icon="download-outline" title="Tải dữ liệu cá nhân" subtitle="Xuất bản sao dữ liệu tài khoản" last />
        </SettingsSection>

        <View style={styles.dangerCard}>
          <View style={styles.dangerIcon}>
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.dangerTitle}>Xóa tài khoản</Text>
            <Text style={styles.dangerText}>Chức năng nguy hiểm được khóa trong bản demo.</Text>
          </View>
          <Ionicons name="lock-closed" size={17} color={Colors.onSurfaceMuted} />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={saveSettings} activeOpacity={0.86}>
          <Ionicons name="checkmark-circle" size={19} color={Colors.onPrimaryDark} />
          <Text style={styles.primaryButtonText}>Lưu cài đặt</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsSection({ children, title, icon }: { children: ReactNode; title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={18} color={Colors.primaryDark} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ToggleRow({ icon, title, subtitle, value, onValueChange, locked, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; value: boolean; onValueChange: () => void; locked?: boolean; last?: boolean }) {
  return (
    <View style={[styles.toggleRow, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={17} color={Colors.primaryDark} />
      </View>
      <View style={styles.flexOne}>
        <View style={styles.toggleTitleRow}>
          <Text style={styles.toggleTitle}>{title}</Text>
          {locked ? <Ionicons name="lock-closed" size={11} color={Colors.warningDeep} /> : null}
        </View>
        <Text style={styles.toggleSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={locked}
        trackColor={{ false: Colors.surfaceContainerHighest, true: Colors.primaryNeutral }}
        thumbColor={value ? Colors.primaryDark : Colors.onSurfaceMuted}
      />
    </View>
  );
}

function VisibilitySelector({ value, onChange }: { value: ProfileVisibility; onChange: (value: ProfileVisibility) => void }) {
  return (
    <View style={styles.visibilityRow}>
      {visibilityOptions.map((item) => {
        const selected = value === item.value;
        return (
          <TouchableOpacity
            key={item.value}
            style={[styles.visibilityButton, selected && styles.visibilityButtonSelected]}
            onPress={() => onChange(item.value)}
          >
            <Text style={[styles.visibilityText, selected && styles.visibilityTextSelected]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ActionRow({ icon, title, subtitle, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; last?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, !last && styles.rowBorder]}
      onPress={() => Alert.alert(title, `${subtitle}. Chức năng sẽ được nối API sau.`)}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={17} color={Colors.primaryDark} />
      </View>
      <View style={styles.flexOne}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: { paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  headerTextBlock: { flex: 1 },
  headerEyebrow: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 17, fontWeight: "900" },
  saveHeaderButton: { minHeight: 36, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  saveHeaderButtonText: { color: Colors.onPrimaryDark, fontSize: 9, fontWeight: "900" },
  content: { padding: 14, paddingBottom: 40 },
  heroCard: { padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.card },
  heroIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.primaryDark },
  heroTitle: { color: Colors.onPrimaryDark, fontSize: 13, fontWeight: "900" },
  heroText: { marginTop: 4, color: "#D9E8CF", fontSize: 8, lineHeight: 13 },
  sectionCard: { marginTop: 12, paddingHorizontal: 14, paddingTop: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  sectionHeader: { marginBottom: 7, flexDirection: "row", alignItems: "center", gap: 9 },
  sectionIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  sectionTitle: { color: Colors.onSurface, fontSize: 13, fontWeight: "900" },
  toggleRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10 },
  actionRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  rowIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLow },
  toggleTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  toggleTitle: { color: Colors.onSurface, fontSize: 10, fontWeight: "900" },
  toggleSubtitle: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8, lineHeight: 12 },
  optionLabel: { marginTop: 9, color: Colors.onSurfaceVariant, fontSize: 9, fontWeight: "800" },
  optionLabelSpaced: { marginTop: 17 },
  visibilityRow: { marginTop: 8, flexDirection: "row", gap: 7 },
  visibilityButton: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  visibilityButtonSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  visibilityText: { color: Colors.onSurfaceVariant, fontSize: 8, fontWeight: "800" },
  visibilityTextSelected: { color: Colors.primaryDark },
  followRequestRow: { minHeight: 72, marginTop: 11, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: Colors.surfaceContainer },
  dangerCard: { marginTop: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: Colors.errorContainer, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest },
  dangerIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.errorContainer },
  dangerTitle: { color: Colors.error, fontSize: 11, fontWeight: "900" },
  dangerText: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8 },
  primaryButton: { minHeight: 50, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark, ...Shadows.hover },
  primaryButtonText: { color: Colors.onPrimaryDark, fontSize: 11, fontWeight: "900" },
});
