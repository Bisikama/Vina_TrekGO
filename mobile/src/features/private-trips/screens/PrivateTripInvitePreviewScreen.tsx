import { QRScannerModal } from "@/components/common/QRScannerModal";
import { Button, FormField, Input, SurfaceCard } from "@/components/ui";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InvitePreviewCard } from "../components";

export interface PrivateTripInvitePreviewScreenProps {
  inviteCode?: string;
  isLoggedIn?: boolean;
}

export function PrivateTripInvitePreviewScreen({
  inviteCode: propCode,
  isLoggedIn: propIsLoggedIn,
}: PrivateTripInvitePreviewScreenProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const isLoggedIn = propIsLoggedIn !== undefined ? propIsLoggedIn : isAuthenticated;
  const params = useLocalSearchParams<{ code?: string | string[] }>();

  const rawCode =
    propCode || (Array.isArray(params.code) ? params.code[0] : params.code) || "";

  // Chuẩn hóa mã 6 ký tự
  const initialNormalized = rawCode
    ? rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
    : "";

  const [inputCode, setInputCode] = useState(initialNormalized);
  const [activeCode, setActiveCode] = useState(
    initialNormalized.length === 6 ? initialNormalized : "",
  );
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    if (initialNormalized.length === 6) {
      setInputCode(initialNormalized);
      setActiveCode(initialNormalized);
    }
  }, [initialNormalized]);

  const handleCodeChange = (text: string) => {
    const normalized = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setInputCode(normalized);
  };

  const handleSubmitCode = () => {
    if (inputCode.length === 6) {
      setActiveCode(inputCode);
    }
  };

  function handleJoinSuccess(res: any) {
    router.replace({
      pathname: "/private-trips/[id]/room",
      params: { id: res.tripId },
    } as any);
  }

  function handleLogin() {
    router.push("/auth/login" as any);
  }

  const handleScanSuccess = (scannedCode: string) => {
    const normalized = scannedCode
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    setInputCode(normalized);
    if (normalized.length === 6) {
      setActiveCode(normalized);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Thư mời Private Trip</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeCode && activeCode.length === 6 ? (
          <View style={styles.previewSection}>
            <View style={styles.activeCodeBar}>
              <View style={styles.activeCodeInfo}>
                <Text style={styles.activeCodeLabel}>MÃ MỜI ĐANG XEM:</Text>
                <Text style={styles.activeCodeText}>{activeCode}</Text>
              </View>
              <TouchableOpacity
                style={styles.changeCodeBtn}
                onPress={() => setActiveCode("")}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.changeCodeBtnText}>Đổi mã</Text>
              </TouchableOpacity>
            </View>

            <InvitePreviewCard
              inviteCode={activeCode}
              isLoggedIn={isLoggedIn}
              onLogin={handleLogin}
              onJoinSuccess={handleJoinSuccess}
            />
          </View>
        ) : (
          <SurfaceCard padding="lg" style={styles.inputCard}>
            <View style={styles.inputIconCircle}>
              <Ionicons name="key-outline" size={28} color={Colors.primaryDark} />
            </View>

            <Text style={styles.cardTitle}>Nhập mã mời vào phòng</Text>
            <Text style={styles.cardSubtitle}>
              Nhập mã 6 ký tự gồm chữ in hoa và số do Trưởng đoàn chia sẻ để xem thông tin và tham gia chuyến đi.
            </Text>

            <FormField label="Mã mời Private Trip" required style={styles.fieldWrapper}>
              <Input
                placeholder="Ví dụ: K7X9P2"
                value={inputCode}
                onChangeText={handleCodeChange}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.codeInput}
              />
            </FormField>

            <View style={styles.btnColumn}>
              <Button
                variant="primary"
                label="Tham gia / Tìm phòng"
                onPress={handleSubmitCode}
                disabled={inputCode.length !== 6}
                fullWidth
              />

              <TouchableOpacity
                style={styles.qrScanBtn}
                onPress={() => setShowQRScanner(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="camera-outline" size={18} color={Colors.primaryDark} />
                <Text style={styles.qrScanBtnText}>Quét mã QR từ thiết bị khác</Text>
              </TouchableOpacity>
            </View>
          </SurfaceCard>
        )}
      </ScrollView>

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanSuccess={handleScanSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  headerBar: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  headerSpacer: {
    width: 38,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  previewSection: {
    gap: 12,
  },
  activeCodeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  activeCodeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeCodeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  activeCodeText: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.primaryDark,
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  changeCodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  changeCodeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  inputCard: {
    alignItems: "center",
    marginTop: 10,
  },
  inputIconCircle: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    ...Shadows.card,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.onSurface,
    textAlign: "center",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  fieldWrapper: {
    width: "100%",
    marginBottom: 16,
  },
  codeInput: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.primaryDark,
    textAlign: "center",
    letterSpacing: 6,
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  btnColumn: {
    width: "100%",
    gap: 12,
  },
  submitBtn: {
    width: "100%",
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  qrScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "#e7f6e3",
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: "#c4e3b7",
  },
  qrScanBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
});
