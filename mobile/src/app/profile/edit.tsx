import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import type { TrekkerAccount } from "@/types";

const genders: { value: TrekkerAccount["gender"]; label: string }[] = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "OTHER", label: "Khác" },
];

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, trekkerAccount, updateUserProfile, updateTrekkerAccount } = useApp();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(trekkerAccount.phone);
  const [dateOfBirth, setDateOfBirth] = useState(trekkerAccount.dateOfBirth);
  const [gender, setGender] = useState<TrekkerAccount["gender"]>(trekkerAccount.gender);
  const [address, setAddress] = useState(trekkerAccount.address);
  const [bio, setBio] = useState(trekkerAccount.bio);

  function saveProfile() {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      Alert.alert("Thiếu thông tin", "Họ tên, email và số điện thoại không được để trống.");
      return;
    }

    updateUserProfile({ name: name.trim(), email: email.trim() });
    updateTrekkerAccount({
      phone: phone.trim(),
      dateOfBirth: dateOfBirth.trim(),
      gender,
      address: address.trim(),
      bio: bio.trim(),
    });

    Alert.alert("Đã lưu hồ sơ", "Thông tin cá nhân mock đã được cập nhật.", [
      { text: "Xong", onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerEyebrow}>TÀI KHOẢN TREKKER</Text>
            <Text style={styles.headerTitle}>Thông tin cá nhân</Text>
          </View>
          <TouchableOpacity style={styles.saveHeaderButton} onPress={saveProfile}>
            <Text style={styles.saveHeaderButtonText}>Lưu</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.avatarCard}>
            <View style={styles.avatarWrap}>
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
              <View style={styles.cameraButton}>
                <Ionicons name="camera" size={16} color={Colors.onPrimaryDark} />
              </View>
            </View>
            <View style={styles.avatarInfo}>
              <Text style={styles.avatarTitle}>Ảnh đại diện</Text>
              <Text style={styles.avatarDescription}>
                Ảnh mock hiện tại sẽ được thay bằng Media API sau.
              </Text>
              <TouchableOpacity
                style={styles.demoPhotoButton}
                onPress={() => Alert.alert("Ảnh demo", "Chức năng chọn ảnh sẽ nối Media API sau.")}
              >
                <Text style={styles.demoPhotoButtonText}>Đổi ảnh demo</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FormSection title="Thông tin định danh" icon="person-outline">
            <Field label="Họ và tên" value={name} onChangeText={setName} placeholder="Nhập họ và tên" />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Số điện thoại"
              value={phone}
              onChangeText={setPhone}
              placeholder="0900 000 000"
              keyboardType="phone-pad"
            />
            <Field
              label="Ngày sinh"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="DD/MM/YYYY"
            />

            <Text style={styles.fieldLabel}>Giới tính</Text>
            <View style={styles.choiceRow}>
              {genders.map((item) => {
                const selected = gender === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.choiceButton, selected && styles.choiceButtonSelected]}
                    onPress={() => setGender(item.value)}
                  >
                    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormSection>

          <FormSection title="Giới thiệu Trekker" icon="trail-sign-outline">
            <Field
              label="Khu vực sinh sống"
              value={address}
              onChangeText={setAddress}
              placeholder="Tỉnh/Thành phố"
            />
            <Field
              label="Giới thiệu ngắn"
              value={bio}
              onChangeText={setBio}
              placeholder="Chia sẻ phong cách trekking của bạn..."
              multiline
              maxLength={180}
            />
            <Text style={styles.characterCount}>{bio.length}/180 ký tự</Text>
          </FormSection>

          <View style={styles.noticeCard}>
            <Ionicons name="information-circle" size={20} color={Colors.primaryDark} />
            <Text style={styles.noticeText}>
              Thông tin sức khỏe và liên hệ khẩn cấp được quản lý ở mục riêng để dễ cập nhật trước mỗi chuyến.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={saveProfile} activeOpacity={0.86}>
            <Ionicons name="checkmark-circle" size={19} color={Colors.onPrimaryDark} />
            <Text style={styles.primaryButtonText}>Lưu thông tin cá nhân</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormSection({ children, title, icon }: { children: ReactNode; title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.formCard}>
      <View style={styles.formHeader}>
        <View style={styles.formHeaderIcon}>
          <Ionicons name={icon} size={18} color={Colors.primaryDark} />
        </View>
        <Text style={styles.formTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, multiline, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={Colors.onSurfaceMuted}
        style={[styles.input, multiline && styles.textArea]}
      />
    </View>
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
  avatarCard: { padding: 14, flexDirection: "row", alignItems: "center", gap: 14, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.card },
  avatarWrap: { position: "relative" },
  avatar: { width: 78, height: 78, borderWidth: 3, borderColor: Colors.primary, borderRadius: Radius.full },
  cameraButton: { position: "absolute", right: -2, bottom: 0, width: 29, height: 29, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.inkDeep, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  avatarInfo: { flex: 1 },
  avatarTitle: { color: Colors.onPrimaryDark, fontSize: 13, fontWeight: "900" },
  avatarDescription: { marginTop: 4, color: "#D9E8CF", fontSize: 8, lineHeight: 12 },
  demoPhotoButton: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.primary },
  demoPhotoButtonText: { color: Colors.ink, fontSize: 8, fontWeight: "900" },
  formCard: { marginTop: 12, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  formHeader: { marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 9 },
  formHeaderIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  formTitle: { color: Colors.onSurface, fontSize: 13, fontWeight: "900" },
  fieldGroup: { marginBottom: 13 },
  fieldLabel: { marginBottom: 6, color: Colors.onSurfaceVariant, fontSize: 9, fontWeight: "800" },
  input: { minHeight: 46, paddingHorizontal: 13, color: Colors.onSurface, fontSize: 11, borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLow },
  textArea: { minHeight: 104, paddingTop: 12, textAlignVertical: "top" },
  characterCount: { marginTop: -7, color: Colors.onSurfaceMuted, fontSize: 8, textAlign: "right" },
  choiceRow: { flexDirection: "row", gap: 8 },
  choiceButton: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  choiceButtonSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  choiceText: { color: Colors.onSurfaceVariant, fontSize: 9, fontWeight: "800" },
  choiceTextSelected: { color: Colors.primaryDark },
  noticeCard: { marginTop: 12, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: Radius.lg, backgroundColor: Colors.primaryPale },
  noticeText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 9, lineHeight: 14 },
  primaryButton: { minHeight: 50, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark, ...Shadows.hover },
  primaryButtonText: { color: Colors.onPrimaryDark, fontSize: 11, fontWeight: "900" },
});
