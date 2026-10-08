import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, ScrollView, Switch, Image, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        
        {/* Header Section (Dark Green) */}
        <View style={styles.headerBackground}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTopInfo}>
              <View style={styles.statusIndicator}>
                <View style={styles.dotOnline} />
                <Text style={styles.headerTopText}>MẠNG TRẠM VFRS: TRỰC TUYẾN</Text>
              </View>
              <View style={styles.gpsIndicator}>
                <Text style={styles.headerTopText}>GPS: Sẵn sàng</Text>
              </View>
            </View>

            <View style={styles.headerTitleContainer}>
              <Text style={styles.logoText}>Vina_TrekGO</Text>
              <Text style={styles.logoSub}>TACTICAL FIELD & SAFETY</Text>

              <Text style={styles.mainTitle}>HỆ THỐNG QUẢN LÝ THỰC ĐỊA & AN TOÀN DÃ NGOẠI VFRS</Text>
              <Text style={styles.subTitle}>Cấp phép Quốc gia • Độ cao cơ sở: 1,420m</Text>
            </View>
          </SafeAreaView>
        </View>

        {/* Form Container (Floating White Card) */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.formWrapper}
        >
          <View style={styles.formContainer}>
            
            {/* VFRS Version Info */}
            <View style={styles.infoBox}>
              <View style={styles.shieldIconPlaceholder}>
                <Text style={{color: '#FFF', fontWeight: 'bold'}}>V</Text>
              </View>
              <View style={styles.infoBoxTextContainer}>
                <Text style={styles.infoBoxTitle}>PHIÊN AN TOÀN VFRS 3.4</Text>
                <Text style={styles.infoBoxDesc}>
                  Vui lòng kết nối GPS & xác thực 2 bước cho tài khoản Mountain Leader khi khởi tạo chuyến đi.
                </Text>
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Email hoặc Số định danh CCCD / VNeID</Text>
                <Text style={styles.labelRequired}>BẮT BUỘC</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="vidu@vinatrekgo.vn"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Mật khẩu bảo mật</Text>
                <Text style={styles.labelForgot}>Quên mật khẩu?</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mật khẩu an toàn"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            {/* Remember Me */}
            <View style={styles.rememberRow}>
              <Switch 
                value={rememberMe} 
                onValueChange={setRememberMe}
                trackColor={{ false: '#e5e7eb', true: '#1F563B' }}
                thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
              />
              <Text style={styles.rememberText}>
                Ghi nhớ thiết bị an toàn 30 ngày (Khuyến nghị thực địa)
              </Text>
            </View>

            {/* Login Button */}
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>ĐĂNG NHẬP HỆ THỐNG →</Text>
            </Pressable>

            <View style={styles.syncStatus}>
              <Text style={styles.syncStatusText}>Sẵn sàng đồng bộ ngoại tuyến khi mất sóng 4G/LTE</Text>
            </View>
            
          </View>

          {/* Alternative Login Methods */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>HOẶC ĐĂNG NHẬP PHƯƠNG THỨC AN TOÀN</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* New Custom Account Buttons */}
          <View style={styles.alternativeButtons}>
            <Pressable 
              style={styles.altButton} 
              onPress={() => router.replace('/delivery/task-list' as any)}
            >
              <View style={[styles.altIconPlaceholder, { backgroundColor: '#FF8A65' }]}>
                <Text style={{color: '#FFF', fontWeight: 'bold'}}>D</Text>
              </View>
              <Text style={styles.altButtonText}>Tài khoản Staff Delivery</Text>
            </Pressable>

            <Pressable 
              style={styles.altButton}
              onPress={() => router.replace('/trip/dashboard' as any)}
            >
              <View style={[styles.altIconPlaceholder, { backgroundColor: '#4CAF50' }]}>
                <Text style={{color: '#FFF', fontWeight: 'bold'}}>L</Text>
              </View>
              <Text style={styles.altButtonText}>Tài khoản Leader</Text>
            </Pressable>
          </View>

          {/* Register Info */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Chưa có mã hiệu Vina_TrekGo?</Text>
            <Pressable style={styles.registerButton}>
              <Text style={styles.registerButtonText}>TẠO HỒ SƠ</Text>
            </Pressable>
          </View>

        </KeyboardAvoidingView>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerBold}>Chính sách Bảo hộ An toàn VFRS & Điều phối Cứu hộ Quốc gia</Text>
        <Text style={styles.footerSmall}>Phiên bản ứng dụng v4.8.2-field-pro • Trung tâm Chỉ huy Vina_TrekGo</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA', // Light greyish blue background
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerBackground: {
    backgroundColor: '#1E4631', // Dark green matching VFRS theme
    paddingBottom: 40,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTopInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dotOnline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTopText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
  },
  logoText: {
    color: '#E06C3A', // Orange from the logo
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoSub: {
    color: '#9CA3AF',
    fontSize: 8,
    marginBottom: 16,
  },
  mainTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  subTitle: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  formWrapper: {
    paddingHorizontal: 16,
    marginTop: -20, // Negative margin to overlap the header
  },
  formContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4', // Very light green
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  shieldIconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  infoBoxTextContainer: {
    flex: 1,
  },
  infoBoxTitle: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#1F2937',
    marginBottom: 4,
  },
  infoBoxDesc: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  labelRequired: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B91C1C',
  },
  labelForgot: {
    fontSize: 12,
    color: '#991B1B', // Dark red
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberText: {
    fontSize: 12,
    color: '#4B5563',
    marginLeft: 10,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#1E4631',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  syncStatus: {
    alignItems: 'center',
  },
  syncStatusText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    paddingHorizontal: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6B7280',
    paddingHorizontal: 12,
  },
  alternativeButtons: {
    gap: 12,
  },
  altButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  altIconPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  altButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
    marginBottom: 20,
  },
  registerText: {
    fontSize: 13,
    color: '#4B5563',
  },
  registerButton: {
    backgroundColor: '#A03A21', // Dark reddish brown
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  registerButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  footerBold: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
    textAlign: 'center',
  },
  footerSmall: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  }
});
