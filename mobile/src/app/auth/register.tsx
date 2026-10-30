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

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (fullName.trim().length < 2) {
      setError("Họ và tên phải có ít nhất 2 ký tự.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Email không đúng định dạng.");
      return;
    }
    if (phone.trim() && !/^(0|\+84)[0-9]{9}$/.test(phone.trim())) {
      setError("Số điện thoại phải gồm 10 số và bắt đầu bằng 0, hoặc dùng +84.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa trùng khớp.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await register({ fullName, email, phone, password });
      router.push({
        pathname: "/auth/verify-otp",
        params: { email: result.email },
      } as unknown as Href);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Chưa thể tạo tài khoản.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="CREATE TREKKER ACCOUNT"
      title="Bắt đầu hành trình của riêng bạn"
      description="Tạo tài khoản User, xác thực email bằng OTP và vào ngay hệ sinh thái TrekGo."
      footer={
        <View style={authStyles.footerRow}>
          <Text style={authStyles.footerText}>Đã có tài khoản?</Text>
          <TouchableOpacity onPress={() => router.replace("/auth/login" as Href)}>
            <Text style={authStyles.footerLink}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={authStyles.formTitle}>Tạo tài khoản Trekker</Text>
      <Text style={authStyles.formDescription}>
        Tài khoản mới được tạo với vai trò USER theo đúng API hiện tại.
      </Text>

      <AuthError message={error} />
      <AuthField
        label="Họ và tên"
        icon="person-outline"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Nguyễn Văn A"
        autoCapitalize="words"
        textContentType="name"
      />
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
        label="Số điện thoại (không bắt buộc)"
        icon="call-outline"
        value={phone}
        onChangeText={setPhone}
        placeholder="0912345678"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
      />
      <AuthField
        label="Mật khẩu"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        placeholder="Tối thiểu 6 ký tự"
        secureTextEntry
        textContentType="newPassword"
      />
      <AuthField
        label="Xác nhận mật khẩu"
        icon="shield-checkmark-outline"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Nhập lại mật khẩu"
        secureTextEntry
        textContentType="newPassword"
      />

      <AuthSubmitButton
        label="Tạo tài khoản"
        loadingLabel="Đang gửi OTP..."
        isLoading={isSubmitting}
        onPress={() => void handleRegister()}
      />
    </AuthScaffold>
  );
}
