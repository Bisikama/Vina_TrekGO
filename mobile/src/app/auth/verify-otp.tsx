import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import {
  AuthError,
  AuthField,
  AuthScaffold,
  AuthSubmitButton,
  authStyles,
} from "@/components/auth/AuthScaffold";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const { verifyOtp, resendOtp } = useAuth();
  const initialEmail = useMemo(
    () => (Array.isArray(params.email) ? params.email[0] : params.email) ?? "",
    [params.email],
  );
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [notice, setNotice] = useState("Mã OTP gồm 6 số đã được gửi tới email đăng ký.");
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Vui lòng nhập đúng mã OTP gồm 6 chữ số.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await verifyOtp(email, otp);
      router.replace("/(tabs)" as Href);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Xác thực OTP chưa thành công.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      setError("Vui lòng nhập email đăng ký.");
      return;
    }

    setError(null);
    setIsResending(true);
    try {
      const result = await resendOtp(email);
      setNotice(result.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Chưa thể gửi lại OTP.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="EMAIL VERIFICATION"
      title="Xác nhận email để kích hoạt TrekGo"
      description="Nhập đúng mã trong email. Xác thực thành công sẽ tạo phiên đăng nhập thật từ API."
      footer={
        <View style={authStyles.footerRow}>
          <Text style={authStyles.footerText}>Sai tài khoản?</Text>
          <TouchableOpacity onPress={() => router.replace("/auth/register" as Href)}>
            <Text style={authStyles.footerLink}>Đăng ký lại</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={authStyles.formTitle}>Nhập mã OTP</Text>
      <Text style={authStyles.formDescription}>
        Không dán kèm ký tự Ctrl+V; ô mã chỉ nhận đúng 6 chữ số.
      </Text>

      <View style={authStyles.noticeCard}>
        <Ionicons name="mail-unread-outline" size={18} color={Colors.primaryDark} />
        <Text style={authStyles.noticeText}>{notice}</Text>
      </View>
      <AuthError message={error} />
      <AuthField
        label="Email đăng ký"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!initialEmail}
      />
      <AuthField
        label="Mã OTP 6 số"
        icon="keypad-outline"
        value={otp}
        onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={6}
      />

      <TouchableOpacity
        style={authStyles.linkButton}
        onPress={() => void handleResend()}
        disabled={isResending}
      >
        <Text style={authStyles.linkText}>
          {isResending ? "Đang gửi lại..." : "Gửi lại mã OTP"}
        </Text>
      </TouchableOpacity>

      <AuthSubmitButton
        label="Xác thực và đăng nhập"
        loadingLabel="Đang xác thực..."
        isLoading={isSubmitting}
        disabled={otp.length !== 6}
        onPress={() => void handleVerify()}
      />
    </AuthScaffold>
  );
}
