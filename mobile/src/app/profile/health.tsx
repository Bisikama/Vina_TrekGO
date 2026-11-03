import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { useState } from "react";
import {
  Alert,
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
import type { TrekkerFitnessLevel } from "@/types";

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const fitnessLevels: { value: TrekkerFitnessLevel; label: string; description: string }[] = [
  { value: "BEGINNER", label: "Cơ bản", description: "Mới bắt đầu, ưu tiên cung ngắn" },
  { value: "INTERMEDIATE", label: "Trung bình", description: "Đi đều, chịu tải 1–2 ngày" },
  { value: "ADVANCED", label: "Nâng cao", description: "Tuyến dài và địa hình khó" },
];

export default function ProfileHealthScreen() {
  const router = useRouter();
  const { trekkerAccount, updateTrekkerAccount } = useApp();
  const [bloodType, setBloodType] = useState(trekkerAccount.bloodType);
  const [fitnessLevel, setFitnessLevel] = useState<TrekkerFitnessLevel>(trekkerAccount.fitnessLevel);
  const [allergies, setAllergies] = useState(trekkerAccount.allergies);
  const [medicalConditions, setMedicalConditions] = useState(trekkerAccount.medicalConditions);
  const [medications, setMedications] = useState(trekkerAccount.medications);

  function saveHealth() {
    updateTrekkerAccount({
      bloodType,
      fitnessLevel,
      allergies: allergies.trim(),
      medicalConditions: medicalConditions.trim(),
      medications: medications.trim(),
    });

    Alert.alert("Đã lưu hồ sơ sức khỏe", "Thông tin mock đã được cập nhật cho các chuyến tiếp theo.", [
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
          <Text style={styles.headerEyebrow}>AN TOÀN TREKKING</Text>
          <Text style={styles.headerTitle}>Hồ sơ sức khỏe</Text>
        </View>
        <TouchableOpacity style={styles.saveHeaderButton} onPress={saveHealth}>
          <Text style={styles.saveHeaderButtonText}>Lưu</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="heart" size={27} color={Colors.onPrimaryDark} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.heroTitle}>Thông tin hỗ trợ an toàn</Text>
            <Text style={styles.heroText}>
              Dữ liệu này giúp Leader và đội cứu hộ phản ứng phù hợp trong tình huống khẩn cấp.
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <SectionHeader icon="water-outline" title="Nhóm máu" />
          <View style={styles.bloodGrid}>
            {bloodTypes.map((item) => {
              const selected = item === bloodType;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.bloodButton, selected && styles.bloodButtonSelected]}
                  onPress={() => setBloodType(item)}
                >
                  <Text style={[styles.bloodText, selected && styles.bloodTextSelected]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.formCard}>
          <SectionHeader icon="fitness-outline" title="Mức thể lực hiện tại" />
          {fitnessLevels.map((item) => {
            const selected = item.value === fitnessLevel;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.fitnessCard, selected && styles.fitnessCardSelected]}
                onPress={() => setFitnessLevel(item.value)}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected ? <View style={styles.radioInner} /> : null}
                </View>
                <View style={styles.flexOne}>
                  <Text style={styles.fitnessTitle}>{item.label}</Text>
                  <Text style={styles.fitnessDescription}>{item.description}</Text>
                </View>
                <Ionicons
                  name={item.value === "BEGINNER" ? "leaf-outline" : item.value === "ADVANCED" ? "flame-outline" : "walk-outline"}
                  size={20}
                  color={selected ? Colors.primaryDark : Colors.onSurfaceMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.formCard}>
          <SectionHeader icon="medkit-outline" title="Lưu ý y tế" />
          <HealthField
            label="Dị ứng"
            hint="Thực phẩm, thuốc, côn trùng hoặc ghi Không ghi nhận"
            value={allergies}
            onChangeText={setAllergies}
          />
          <HealthField
            label="Bệnh nền / Tiền sử"
            hint="Tim mạch, huyết áp, hen suyễn..."
            value={medicalConditions}
            onChangeText={setMedicalConditions}
          />
          <HealthField
            label="Thuốc đang sử dụng"
            hint="Tên thuốc và liều dùng định kỳ"
            value={medications}
            onChangeText={setMedications}
          />
        </View>

        <View style={styles.privacyNotice}>
          <Ionicons name="lock-closed" size={18} color={Colors.primaryDark} />
          <Text style={styles.privacyText}>
            Dữ liệu sức khỏe chỉ dùng cho vận hành chuyến và tình huống an toàn. Bản demo chưa gửi dữ liệu ra máy chủ.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={saveHealth} activeOpacity={0.86}>
          <Ionicons name="shield-checkmark" size={19} color={Colors.onPrimaryDark} />
          <Text style={styles.primaryButtonText}>Lưu hồ sơ sức khỏe</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={Colors.primaryDark} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function HealthField({ label, hint, ...props }: ComponentProps<typeof TextInput> & { label: string; hint: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldHint}>{hint}</Text>
      <TextInput
        {...props}
        multiline
        placeholderTextColor={Colors.onSurfaceMuted}
        style={styles.textArea}
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
  headerEyebrow: { color: Colors.error, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 17, fontWeight: "900" },
  saveHeaderButton: { minHeight: 36, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  saveHeaderButtonText: { color: Colors.onPrimaryDark, fontSize: 9, fontWeight: "900" },
  content: { padding: 14, paddingBottom: 40 },
  heroCard: { padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.card },
  heroIcon: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: Colors.error },
  heroTitle: { color: Colors.onPrimaryDark, fontSize: 13, fontWeight: "900" },
  heroText: { marginTop: 4, color: "#D9E8CF", fontSize: 8, lineHeight: 13 },
  formCard: { marginTop: 12, padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  sectionHeader: { marginBottom: 13, flexDirection: "row", alignItems: "center", gap: 9 },
  sectionIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  sectionTitle: { color: Colors.onSurface, fontSize: 13, fontWeight: "900" },
  bloodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bloodButton: { width: "22.9%", minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLow },
  bloodButtonSelected: { borderColor: Colors.error, backgroundColor: Colors.errorContainer },
  bloodText: { color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: "900" },
  bloodTextSelected: { color: Colors.error },
  fitnessCard: { minHeight: 64, marginBottom: 8, padding: 11, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLow },
  fitnessCardSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  radioOuter: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.onSurfaceMuted, borderRadius: Radius.full },
  radioOuterSelected: { borderColor: Colors.primaryDark },
  radioInner: { width: 10, height: 10, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  fitnessTitle: { color: Colors.onSurface, fontSize: 10, fontWeight: "900" },
  fitnessDescription: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8 },
  fieldGroup: { marginBottom: 13 },
  fieldLabel: { color: Colors.onSurface, fontSize: 10, fontWeight: "900" },
  fieldHint: { marginTop: 3, marginBottom: 6, color: Colors.onSurfaceMuted, fontSize: 8 },
  textArea: { minHeight: 76, padding: 11, color: Colors.onSurface, fontSize: 10, textAlignVertical: "top", borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLow },
  privacyNotice: { marginTop: 12, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: Radius.lg, backgroundColor: Colors.primaryPale },
  privacyText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 9, lineHeight: 14 },
  primaryButton: { minHeight: 50, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark, ...Shadows.hover },
  primaryButtonText: { color: Colors.onPrimaryDark, fontSize: 11, fontWeight: "900" },
});
