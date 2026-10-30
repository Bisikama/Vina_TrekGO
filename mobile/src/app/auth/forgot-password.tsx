import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Vui lòng nhập email hợp lệ.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      setMessage(result.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Chưa thể gửi hướng dẫn đặt lại mật khẩu.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="ACCOUNT RECOVERY"
      title="Khôi phục quyền truy cập tài khoản"
      description="TrekGo sẽ gửi hướng dẫn đặt lại mật khẩu thông qua email đã đăng ký."
      footer={
        <View style={authStyles.footerRow}>
          <TouchableOpacity onPress={() => router.replace("/auth/login" as Href)}>
            <Text style={authStyles.footerLink}>Quay lại đăng nhập</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={authStyles.formTitle}>Quên mật khẩu</Text>
      <Text style={authStyles.formDescription}>
        Nhập email của bạn để bắt đầu quy trình khôi phục.
      </Text>

      {message ? (
        <View style={authStyles.noticeCard}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.primaryDark} />
          <Text style={authStyles.noticeText}>{message}</Text>
        </View>
      ) : null}
      <AuthError message={error} />
      <AuthField
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <AuthSubmitButton
        label="Gửi hướng dẫn khôi phục"
        loadingLabel="Đang gửi email..."
        isLoading={isSubmitting}
        onPress={() => void handleReset()}
      />
    </AuthScaffold>
  );
}
