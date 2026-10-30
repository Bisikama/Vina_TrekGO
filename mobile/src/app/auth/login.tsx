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
import { useAuth } from "@/features/auth/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Vui lòng nhập email và mật khẩu.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const loggedUser = await signIn(email, password);
      if (loggedUser.role === "STAFF_INVENTORY") {
        router.replace("/inventory-operations" as Href);
      } else if (loggedUser.role === "STAFF_DELIVERY" || loggedUser.role === "LEADER") {
        router.replace("/field-operations" as Href);
      } else {
        router.replace("/(tabs)" as Href);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Đăng nhập chưa thành công.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="TREKGO MEMBER ACCESS"
      title="Sẵn sàng cho hành trình tiếp theo?"
      description="Đăng nhập để quản lý chuyến đi, thuê thiết bị và lưu lại từng cung đường của bạn."
      footer={
        <View style={authStyles.footerRow}>
          <Text style={authStyles.footerText}>Chưa có tài khoản?</Text>
          <TouchableOpacity onPress={() => router.push("/auth/register" as Href)}>
            <Text style={authStyles.footerLink}>Tạo tài khoản</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={authStyles.formTitle}>Đăng nhập</Text>
      <Text style={authStyles.formDescription}>
        Sử dụng tài khoản Trekker đã được kích hoạt.
      </Text>

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
      <AuthField
        label="Mật khẩu"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        placeholder="Nhập mật khẩu"
        secureTextEntry
        textContentType="password"
      />

      <TouchableOpacity
        style={authStyles.linkButton}
        onPress={() => router.push("/auth/forgot-password" as Href)}
      >
        <Text style={authStyles.linkText}>Quên mật khẩu?</Text>
      </TouchableOpacity>

      <AuthSubmitButton
        label="Đăng nhập TrekGo"
        loadingLabel="Đang xác thực..."
        isLoading={isSubmitting}
        onPress={() => void handleLogin()}
      />
    </AuthScaffold>
  );
}
