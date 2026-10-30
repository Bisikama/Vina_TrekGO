import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

export default function ProfileEmergencyScreen() {
  const router = useRouter();
  const { trekkerAccount, updateTrekkerAccount } = useApp();
  const [name, setName] = useState(trekkerAccount.emergencyContact.name);
  const [relationship, setRelationship] = useState(
    trekkerAccount.emergencyContact.relationship,
  );
  const [phone, setPhone] = useState(trekkerAccount.emergencyContact.phone);

  function saveEmergencyContact() {
    if (!name.trim() || !relationship.trim() || !phone.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập đủ tên, mối quan hệ và số điện thoại.");
      return;
    }

    updateTrekkerAccount({
      emergencyContact: {
        name: name.trim(),
        relationship: relationship.trim(),
        phone: phone.trim(),
      },
    });

    Alert.alert("Đã lưu liên hệ", "Người liên hệ khẩn cấp mock đã được cập nhật.", [
      { text: "Xong", onPress: () => router.back() },
    ]);
  }

  function testCall() {
    Alert.alert("Gọi thử liên hệ", `Mở trình gọi điện tới ${phone}?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Mở trình gọi",
        onPress: () => Linking.openURL(`tel:${phone.replaceAll(" ", "")}`),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>SAFETY CONTACT</Text>
          <Text style={styles.headerTitle}>Liên hệ khẩn cấp</Text>
        </View>
        <TouchableOpacity style={styles.saveHeaderButton} onPress={saveEmergencyContact}>
          <Text style={styles.saveHeaderButtonText}>Lưu</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="call" size={26} color={Colors.ink} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.heroTitle}>Một người luôn có thể liên lạc</Text>
            <Text style={styles.heroText}>
              Leader hoặc đội cứu hộ sử dụng liên hệ này khi không thể kết nối trực tiếp với bạn.
            </Text>
          </View>
        </View>

        <View style={styles.contactPreview}>
          <View style={styles.contactAvatar}>
            <Text style={styles.contactInitial}>{name.trim().charAt(0).toUpperCase() || "?"}</Text>
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.contactName}>{name || "Chưa nhập tên"}</Text>
            <Text style={styles.contactMeta}>{relationship || "Chưa nhập mối quan hệ"}</Text>
            <Text style={styles.contactPhone}>{phone || "Chưa nhập số điện thoại"}</Text>
          </View>
          <TouchableOpacity style={styles.callButton} onPress={testCall}>
            <Ionicons name="call-outline" size={20} color={Colors.onPrimaryDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <View style={styles.formHeaderIcon}>
              <Ionicons name="person-add-outline" size={19} color={Colors.primaryDark} />
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.formTitle}>Thông tin người liên hệ</Text>
              <Text style={styles.formSubtitle}>Nên chọn người thân biết rõ tình trạng sức khỏe của bạn.</Text>
            </View>
          </View>

          <Field label="Họ và tên" value={name} onChangeText={setName} placeholder="Nguyễn Văn A" />
          <Field
            label="Mối quan hệ"
            value={relationship}
            onChangeText={setRelationship}
            placeholder="Bố, mẹ, anh/chị/em, bạn đời..."
          />
          <Field
            label="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            placeholder="0900 000 000"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.processCard}>
          <Text style={styles.processTitle}>Khi nào TrekGo dùng liên hệ này?</Text>
          <ProcessRow icon="warning-outline" text="Trekker gặp sự cố và không thể phản hồi." />
          <ProcessRow icon="navigate-outline" text="Đội vận hành cần xác minh tình huống cứu hộ." />
          <ProcessRow icon="medkit-outline" text="Cơ sở y tế cần thông tin người thân." />
        </View>

        <View style={styles.noticeCard}>
          <Ionicons name="shield-checkmark" size={19} color={Colors.primaryDark} />
          <Text style={styles.noticeText}>
            Liên hệ khẩn cấp không hiển thị công khai trên Community hoặc hồ sơ Trekker.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={saveEmergencyContact} activeOpacity={0.86}>
          <Ionicons name="checkmark-circle" size={19} color={Colors.onPrimaryDark} />
          <Text style={styles.primaryButtonText}>Lưu liên hệ khẩn cấp</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={Colors.onSurfaceMuted}
        style={styles.input}
      />
    </View>
  );
}

function ProcessRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.processRow}>
      <View style={styles.processIcon}>
        <Ionicons name={icon} size={16} color={Colors.warningDeep} />
      </View>
      <Text style={styles.processText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: { paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  headerTextBlock: { flex: 1 },
  headerEyebrow: { color: Colors.warningDeep, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 17, fontWeight: "900" },
  saveHeaderButton: { minHeight: 36, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  saveHeaderButtonText: { color: Colors.onPrimaryDark, fontSize: 9, fontWeight: "900" },
  content: { padding: 14, paddingBottom: 40 },
  heroCard: { padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.card },
  heroIcon: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.tertiaryFixed },
  heroTitle: { color: Colors.onPrimaryDark, fontSize: 13, fontWeight: "900" },
  heroText: { marginTop: 4, color: "#D9E8CF", fontSize: 8, lineHeight: 13 },
  contactPreview: { marginTop: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  contactAvatar: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  contactInitial: { color: Colors.primaryDark, fontSize: 20, fontWeight: "900" },
  contactName: { color: Colors.onSurface, fontSize: 12, fontWeight: "900" },
  contactMeta: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8 },
  contactPhone: { marginTop: 5, color: Colors.primaryDark, fontSize: 10, fontWeight: "900" },
  callButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  formCard: { marginTop: 12, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  formHeader: { marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 9 },
  formHeaderIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  formTitle: { color: Colors.onSurface, fontSize: 12, fontWeight: "900" },
  formSubtitle: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8, lineHeight: 12 },
  fieldGroup: { marginBottom: 13 },
  fieldLabel: { marginBottom: 6, color: Colors.onSurfaceVariant, fontSize: 9, fontWeight: "800" },
  input: { minHeight: 46, paddingHorizontal: 13, color: Colors.onSurface, fontSize: 11, borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLow },
  processCard: { marginTop: 12, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  processTitle: { marginBottom: 10, color: Colors.onSurface, fontSize: 11, fontWeight: "900" },
  processRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 9 },
  processIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.tertiaryFixed },
  processText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 9, lineHeight: 14 },
  noticeCard: { marginTop: 12, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: Radius.lg, backgroundColor: Colors.primaryPale },
  noticeText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 9, lineHeight: 14 },
  primaryButton: { minHeight: 50, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark, ...Shadows.hover },
  primaryButtonText: { color: Colors.onPrimaryDark, fontSize: 11, fontWeight: "900" },
});
