import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { DELIVERY_MOCK_DATA } from '../../mockData';

export const QRVerifyFeature = () => {
  const { qrVerify } = DELIVERY_MOCK_DATA;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerTop}>
        <Text style={styles.backBtn}>←</Text>
        <Text style={styles.headerTitle}>XÁC THỰC ĐƠN HÀNG</Text>
        <Text style={styles.sosBtn}>SOS</Text>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>🟢 HUD FIELD OPS • PROTOCOL V4</Text>
        <Text style={styles.statusText}>☁️ OFFLINE CACHE READY</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.customerCard}>
          <View style={styles.avatarBox}><Text style={styles.avatarIcon}>👤</Text></View>
          <View style={styles.customerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.customerName}>{qrVerify.customer}</Text>
              <Text style={styles.cccdBadge}>CCCD CHÍP OK</Text>
            </View>
            <View style={styles.tourRow}>
              <Text style={styles.tourId}>{qrVerify.id}</Text>
              <Text style={styles.tourName}> • {qrVerify.tour}</Text>
            </View>
            <View style={styles.locRow}>
              <Text style={styles.locIcon}>📍</Text>
              <Text style={styles.locName}>{qrVerify.location}</Text>
              <Text style={styles.locSub}>(Hub Sa Pa giao)</Text>
              <Text style={styles.earlyBadge}>BÀN GIAO SỚM</Text>
            </View>
          </View>
        </View>

        <View style={styles.scannerCard}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>📷 RADAR SCANNER FIELD</Text>
            <View style={styles.scannerActions}>
              <TouchableOpacity style={styles.iconBtn}><Text style={styles.iconText}>🔦</Text></TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}><Text style={styles.iconText}>🔄</Text></TouchableOpacity>
            </View>
          </View>
          <View style={styles.scannerBox}>
            <View style={styles.frameCornerTL} />
            <View style={styles.frameCornerTR} />
            <View style={styles.frameCornerBL} />
            <View style={styles.frameCornerBR} />
            <View style={styles.scanLine} />
            <Text style={styles.scanText}>CĂN MÃ VÀO KHUNG</Text>
          </View>
          <Text style={styles.scannerDesc}>Yêu cầu Trekker mở <Text style={styles.linkText}>Thẻ Thuê Đồ</Text> trên app Vina_TrekGo để quét mã QR nhận thiết bị.</Text>
        </View>

        <View style={styles.otpCard}>
          <View style={styles.otpHeaderRow}>
            <Text style={styles.otpIcon}>🔢</Text>
            <Text style={styles.otpTitle}>Mã Nhận Khẩn Cấp (Handover OTP)</Text>
            <Text style={styles.otpLimit}>Còn 3/5 lần nhập</Text>
          </View>
          <Text style={styles.otpDesc}>Áp dụng khi camera mờ sương đọng nước hoặc màn hình khách bị nứt vỡ trên địa hình.</Text>
          <View style={styles.otpInputs}>
            {qrVerify.otp.split('').map((char, idx) => (
              <View key={idx} style={styles.otpBox}><Text style={styles.otpChar}>{char}</Text></View>
            ))}
          </View>
          <View style={styles.otpFooter}>
            <Text style={styles.otpLockText}>🔒 Khóa mã đồng bộ vệ tinh</Text>
            <Text style={styles.otpCheckBtn}>Kiểm tra mã</Text>
          </View>
        </View>

        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✅</Text>
          <View style={styles.successContent}>
            <Text style={styles.successSub}>TIÊU CHUẨN AN TOÀN VFRS #2F6B4F</Text>
            <Text style={styles.successTitle}>ĐÃ XÁC MINH ĐÚNG NGƯỜI NHẬN</Text>
            <View style={styles.successLockBox}>
              <Text style={styles.successLockText}>🔒 Xác thực bằng khóa chữ ký Offline (Cập nhật lúc {qrVerify.verifiedTime}).</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.continueBtn}><Text style={styles.continueBtnText}>TIẾP TỤC BÀN GIAO THIẾT BỊ ➔</Text></TouchableOpacity>
        
        <View style={styles.helpBox}>
          <Text style={styles.helpIcon}>👥</Text>
          <Text style={styles.helpText}>Khách nhờ người nhận hộ (Cần xác thực CCCD & ủy quyền)</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 16, backgroundColor: 'white' },
  backBtn: { fontSize: 24 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  sosBtn: { backgroundColor: '#FFEBEE', color: '#C62828', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontWeight: 'bold' },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F5F5F5', padding: 8 },
  statusText: { color: '#1B5E20', fontSize: 10, fontWeight: 'bold' },
  content: { padding: 16 },
  customerCard: { flexDirection: 'row', backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 16, elevation: 1 },
  avatarBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarIcon: { fontSize: 24 },
  customerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  customerName: { fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  cccdBadge: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 8, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  tourRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  tourId: { color: '#D84315', fontWeight: 'bold', fontSize: 12 },
  tourName: { color: '#666', fontSize: 12 },
  locRow: { flexDirection: 'row', alignItems: 'center' },
  locIcon: { fontSize: 12, marginRight: 4 },
  locName: { fontWeight: 'bold', fontSize: 12 },
  locSub: { color: '#666', fontSize: 12, marginLeft: 4 },
  earlyBadge: { backgroundColor: '#E0F2F1', color: '#00695C', fontSize: 8, fontWeight: 'bold', padding: 4, borderRadius: 4, marginLeft: 'auto' },
  scannerCard: { backgroundColor: '#263238', padding: 16, borderRadius: 8, marginBottom: 16 },
  scannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  scannerTitle: { color: '#80CBC4', fontWeight: 'bold', fontSize: 12 },
  scannerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { backgroundColor: '#37474F', padding: 8, borderRadius: 4 },
  iconText: { color: 'white', fontSize: 12 },
  scannerBox: { height: 200, alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 16 },
  frameCornerTL: { position: 'absolute', top: 20, left: 20, width: 20, height: 20, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#80CBC4' },
  frameCornerTR: { position: 'absolute', top: 20, right: 20, width: 20, height: 20, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#80CBC4' },
  frameCornerBL: { position: 'absolute', bottom: 20, left: 20, width: 20, height: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#80CBC4' },
  frameCornerBR: { position: 'absolute', bottom: 20, right: 20, width: 20, height: 20, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#80CBC4' },
  scanLine: { width: '80%', height: 2, backgroundColor: '#80CBC4', marginBottom: 8, shadowColor: '#80CBC4', shadowOpacity: 1, shadowRadius: 5 },
  scanText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  scannerDesc: { color: '#B0BEC5', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  linkText: { color: '#80CBC4', textDecorationLine: 'underline' },
  otpCard: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 16, elevation: 1 },
  otpHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  otpIcon: { fontSize: 16, marginRight: 8 },
  otpTitle: { fontSize: 12, fontWeight: 'bold', flex: 1 },
  otpLimit: { backgroundColor: '#FFEBEE', color: '#C62828', fontSize: 8, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  otpDesc: { fontSize: 10, color: '#666', marginBottom: 16 },
  otpInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  otpBox: { width: 40, height: 48, backgroundColor: '#E3F2FD', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  otpChar: { fontSize: 20, fontWeight: 'bold' },
  otpFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  otpLockText: { color: '#2E7D32', fontSize: 10, fontWeight: 'bold' },
  otpCheckBtn: { color: '#1B5E20', fontSize: 12, fontWeight: 'bold' },
  successCard: { flexDirection: 'row', backgroundColor: '#2E7D32', padding: 16, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
  successIcon: { fontSize: 32, marginRight: 12 },
  successContent: { flex: 1 },
  successSub: { color: '#A5D6A7', fontSize: 8, fontWeight: 'bold', marginBottom: 4 },
  successTitle: { color: 'white', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  successLockBox: { backgroundColor: '#1B5E20', padding: 8, borderRadius: 4 },
  successLockText: { color: '#E8F5E9', fontSize: 10 },
  continueBtn: { backgroundColor: '#1B5E20', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  continueBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  helpBox: { flexDirection: 'row', backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 32 },
  helpIcon: { fontSize: 16, marginRight: 12 },
  helpText: { fontSize: 12, color: '#333', fontWeight: 'bold' },
});
