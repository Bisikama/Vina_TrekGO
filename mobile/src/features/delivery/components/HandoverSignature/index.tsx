import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { DELIVERY_MOCK_DATA } from '../../mockData';

export const HandoverSignatureFeature = () => {
  const { handover } = DELIVERY_MOCK_DATA;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerTop}>
        <Text style={styles.backBtn}>←</Text>
        <Text style={styles.headerTitle}>BẰNG CHỨNG GIAO HÀNG</Text>
        <Text style={styles.sosBtn}>SOS</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderIcon}>✅</Text>
            <Text style={styles.orderTitle}>ĐƠN BÀN GIAO {handover.id}</Text>
            <Text style={styles.orderStatus}>SẴN SÀNG KÝ DUYỆT</Text>
          </View>
          <View style={styles.orderDetailRow}>
            <Text style={styles.detailLabel}>Khách hàng nhận:</Text>
            <Text style={styles.detailValueName}>{handover.customer}</Text>
          </View>
          <View style={styles.orderDetailRow}>
            <Text style={styles.detailLabel}>Điểm bàn giao:</Text>
            <Text style={styles.detailValue}>{handover.location}</Text>
          </View>
          <View style={styles.orderDetailRow}>
            <Text style={styles.detailLabel}>Thời gian thực địa:</Text>
            <Text style={styles.detailValueTime}>{handover.time}</Text>
          </View>
          <View style={styles.orderDetailRow}>
            <Text style={styles.detailLabel}>Kiểm kê thiết bị:</Text>
            <Text style={styles.detailValueGreen}>04 món dã ngoại (Đã đối soát 100%)</Text>
          </View>

          <View style={styles.escrowBox}>
            <View style={styles.escrowHeader}>
              <Text style={styles.escrowLockIcon}>🔒</Text>
              <Text style={styles.escrowTitle}>Ký quỹ Escrow VFRS: <Text style={styles.escrowAmount}>{handover.escrow}</Text></Text>
            </View>
            <Text style={styles.escrowDesc}>Đã phong tỏa bảo lãnh tự động qua cổng VFRS. Chi phục vụ tra cứu thực địa, nhân viên không xử lý hoàn/nhận tiền mặt tại đây.</Text>
          </View>
        </View>



        <View style={styles.evidenceSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📷</Text>
            <Text style={styles.sectionTitle}>Bằng Chứng Hiện Trường</Text>
            <Text style={styles.countBadge}>2/2 ẢNH ĐẠT</Text>
          </View>
          <Text style={styles.sectionDesc}>Ảnh chụp góc rộng người nhận kèm mã thiết bị tại trạm kiểm lâm:</Text>
          
          <View style={styles.photosGrid}>
            <View style={styles.photoCard}>
              <View style={[styles.photoMock, { backgroundColor: '#B0BEC5' }]}>
                <Text style={styles.photoTag}>ẢNH 1: BALO 45L</Text>
                <Text style={styles.photoCheck}>✓</Text>
              </View>
              <Text style={styles.photoLabel}>Khách đeo thử balo</Text>
            </View>
            <View style={styles.photoCard}>
              <View style={[styles.photoMock, { backgroundColor: '#CFD8DC' }]}>
                <Text style={styles.photoTag}>ẢNH 2: GẬY TREK</Text>
                <Text style={styles.photoCheck}>✓</Text>
              </View>
              <Text style={styles.photoLabel}>Hướng dẫn khóa gậy</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.addPhotoBtn}><Text style={styles.addPhotoText}>📷 + Thêm ảnh hiện trường</Text></TouchableOpacity>
        </View>

        <View style={styles.gpsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🔗</Text>
            <Text style={styles.sectionTitleGPS}>DẤU TEM ĐỊNH VỊ & THỜI GIAN THỰC ĐỊA</Text>
          </View>
          <View style={styles.gpsRow}><Text style={styles.gpsLabel}>Tọa độ GPS Trạm Tôn:</Text><Text style={styles.gpsValue}>{handover.gps}</Text></View>
          <View style={styles.gpsRow}><Text style={styles.gpsLabel}>Độ chính xác vệ tinh:</Text><Text style={styles.gpsValue}>{handover.gpsAcc}</Text></View>
          <View style={styles.gpsRow}><Text style={styles.gpsLabel}>Đóng dấu VFRS Server:</Text><Text style={styles.gpsValue}>{handover.timestamp}</Text></View>
        </View>

        <View style={styles.termsBox}>
          <View style={styles.termsHeader}>
            <View style={styles.checkboxChecked}><Text style={styles.checkIcon}>✓</Text></View>
            <Text style={styles.termsTitle}>Tuyên bố xác nhận tiêu chuẩn VFRS</Text>
          </View>
          <Text style={styles.termsDesc}>Khách hàng <Text style={styles.boldText}>{handover.customer}</Text> xác nhận đã nhận đủ <Text style={styles.boldText}>04 thiết bị dã ngoại</Text>, thiết bị nguyên vẹn, hoạt động bình thường và cam kết bảo quản theo quy định Vina_TrekGo.</Text>
          
          <View style={styles.noteBox}>
            <Text style={styles.noteIcon}>📝</Text>
            <View>
              <Text style={styles.noteLabel}>GHI CHÚ NHÂN VIÊN GIAO:</Text>
              <Text style={styles.noteText}>{handover.note}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.finishBtn}>
          <Text style={styles.finishBtnIcon}>☑</Text>
          <Text style={styles.finishBtnText}>HOÀN TẤT BÀN GIAO THIẾT BỊ</Text>
          <Text style={styles.finishBtnCheck}>✓</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.recheckBtn}>
          <Text style={styles.recheckBtnText}>✓ Kiểm tra lại danh sách</Text>
        </TouchableOpacity>
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
  content: { padding: 16 },
  orderCard: { backgroundColor: 'white', padding: 16, borderRadius: 8, elevation: 1, marginBottom: 16 },
  orderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  orderIcon: { fontSize: 16, marginRight: 8 },
  orderTitle: { fontSize: 12, fontWeight: 'bold', flex: 1 },
  orderStatus: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  orderDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  detailLabel: { fontSize: 10, color: '#666' },
  detailValueName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  detailValue: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  detailValueTime: { fontSize: 10, fontWeight: 'bold', color: '#1B5E20' },
  detailValueGreen: { fontSize: 10, fontWeight: 'bold', color: '#1B5E20' },
  escrowBox: { backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginTop: 12 },
  escrowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  escrowLockIcon: { fontSize: 12, marginRight: 8 },
  escrowTitle: { fontSize: 10, fontWeight: 'bold', color: '#1565C0' },
  escrowAmount: { color: '#0D47A1' },
  escrowDesc: { fontSize: 10, color: '#1565C0', lineHeight: 14 },
  signatureSection: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionIcon: { fontSize: 16, marginRight: 8 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', flex: 1 },
  sectionTitleGPS: { fontSize: 12, fontWeight: 'bold', flex: 1, color: '#2E7D32' },
  reqBadge: { backgroundColor: '#FFEBEE', color: '#C62828', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  countBadge: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  sectionDesc: { fontSize: 10, color: '#666', marginBottom: 12 },
  signaturePad: { backgroundColor: '#F9F9F9', height: 160, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  padStatus: { position: 'absolute', top: 12, left: 12, color: '#1B5E20', fontSize: 8, fontWeight: 'bold' },
  padCurveMock: { width: '80%', height: 40, borderBottomWidth: 4, borderBottomColor: 'black', borderRadius: 20, transform: [{ rotate: '-10deg' }] },
  padName: { fontSize: 14, fontWeight: 'bold', letterSpacing: 2, marginTop: 16 },
  padId: { fontSize: 10, color: '#666', position: 'absolute', bottom: 12, right: 12 },
  signatureFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  signatureTime: { fontSize: 10, color: '#666' },
  resignBtn: { backgroundColor: '#E3F2FD', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  resignBtnText: { color: '#1565C0', fontSize: 10, fontWeight: 'bold' },
  evidenceSection: { marginBottom: 24 },
  photosGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  photoCard: { flex: 1 },
  photoMock: { height: 100, borderRadius: 8, position: 'relative', marginBottom: 4 },
  photoTag: { position: 'absolute', top: 4, left: 4, backgroundColor: '#37474F', color: 'white', fontSize: 8, fontWeight: 'bold', padding: 2, borderRadius: 2 },
  photoCheck: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#1B5E20', color: 'white', width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20, fontSize: 10, fontWeight: 'bold' },
  photoLabel: { fontSize: 10, color: '#333' },
  addPhotoBtn: { backgroundColor: '#F5F5F5', padding: 16, borderRadius: 8, alignItems: 'center' },
  addPhotoText: { color: '#1B5E20', fontSize: 12, fontWeight: 'bold' },
  gpsSection: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 24, borderWidth: 1, borderColor: '#EEE' },
  gpsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  gpsLabel: { fontSize: 10, color: '#666' },
  gpsValue: { fontSize: 10, fontWeight: 'bold', color: '#333', fontFamily: 'monospace' },
  termsBox: { marginBottom: 24 },
  termsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkboxChecked: { width: 20, height: 20, backgroundColor: '#1B5E20', borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkIcon: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  termsTitle: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  termsDesc: { fontSize: 10, color: '#666', lineHeight: 16, marginLeft: 32, marginBottom: 12 },
  boldText: { fontWeight: 'bold', color: '#333' },
  noteBox: { flexDirection: 'row', backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginLeft: 32 },
  noteIcon: { fontSize: 16, marginRight: 8, color: '#1565C0' },
  noteLabel: { fontSize: 10, fontWeight: 'bold', color: '#1565C0', marginBottom: 2 },
  noteText: { fontSize: 10, color: '#1565C0', fontStyle: 'italic' },
  finishBtn: { backgroundColor: '#388E3C', padding: 16, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  finishBtnIcon: { color: 'white', fontSize: 18, marginRight: 8 },
  finishBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold', marginRight: 8 },
  finishBtnCheck: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  recheckBtn: { backgroundColor: '#F5F5F5', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 32 },
  recheckBtnText: { color: '#1B5E20', fontSize: 12, fontWeight: 'bold' },
});
