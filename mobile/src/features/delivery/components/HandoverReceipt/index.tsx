import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { DELIVERY_MOCK_DATA } from '../../mockData';

export const HandoverReceiptFeature = () => {
  const { handoverReceipt } = DELIVERY_MOCK_DATA;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.headerTop}>
          <Text style={styles.backBtn}>←</Text>
          <Text style={styles.headerTitle}>HOÀN TẤT NHIỆM VỤ</Text>
          <Text style={styles.sosBtn}>SOS</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.successBadge}>
            <View style={styles.successIconBox}>
              <Text style={styles.successCheck}>✅</Text>
              <Text style={styles.vfrsText}>VFRS SECURE</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusDot}>●</Text>
            <Text style={styles.statusText}>XÁC THỰC HIỆN TRƯỜNG THÀNH CÔNG</Text>
          </View>
          <Text style={styles.mainTitle}>BÀN GIAO THÀNH CÔNG!</Text>
          <Text style={styles.desc}>Thiết bị đã được bàn giao và dữ liệu chuyến đi của Trekker đã được kích hoạt thành công trên hệ thống.</Text>

          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <View>
                <Text style={styles.receiptLabel}>BIÊN NHẬN ĐIỆN TỬ VẬN HÀNH</Text>
                <Text style={styles.receiptId}>{handoverReceipt.id} • {handoverReceipt.receiptId}</Text>
              </View>
              <Text style={styles.meshTag}>☁ MESH SYNC OK</Text>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>NGƯỜI NHẬN THIẾT BỊ</Text>
                <Text style={styles.infoValue}>{handoverReceipt.customer}</Text>
                <Text style={styles.infoSub}>CCCD: {handoverReceipt.cccd}</Text>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>THỜI GIAN HOÀN TẤT</Text>
                <Text style={styles.infoValue}>{handoverReceipt.time}</Text>
                <Text style={styles.infoSub}>{handoverReceipt.date}</Text>
              </View>
            </View>

            <View style={styles.gpsBox}>
              <Text style={styles.gpsIcon}>🛰</Text>
              <View style={styles.gpsContent}>
                <View style={styles.gpsHeader}><Text style={styles.gpsLabel}>TỌA ĐỘ VỆ TINH GPS</Text><Text style={styles.gpsVerified}>ĐÃ XÁC THỰC</Text></View>
                <Text style={styles.gpsLoc}>{handoverReceipt.gps.split('\n')[0]}</Text>
                <Text style={styles.gpsCoords}>{handoverReceipt.gps.split('\n')[1]}</Text>
              </View>
            </View>

            <View style={styles.eqHeader}>
              <Text style={styles.eqLabel}>DANH MỤC THIẾT BỊ BÀN GIAO (04 MÓN)</Text>
              <Text style={styles.eqDone}>HOÀN TẤT 100%</Text>
            </View>
            <View style={styles.eqGrid}>
              <View style={styles.eqItem}><Text style={styles.eqText}>🎒 Balo Trợ Lực 45L Pro</Text></View>
              <View style={styles.eqItem}><Text style={styles.eqText}>🦯 02 Gậy Black Diam...</Text></View>
              <View style={styles.eqItem}><Text style={styles.eqText}>🧥 Áo Mưa Bộ Gore-Tex</Text></View>
              <View style={styles.eqItem}><Text style={styles.eqText}>🔦 Đèn Pin Đội Đầu Fe...</Text></View>
            </View>

            <View style={styles.evidenceBox}>
              <Text style={styles.evidenceIcon}>✍</Text>
              <View style={styles.evidenceContent}>
                <Text style={styles.evidenceLabel}>BẰNG CHỨNG XÁC THỰC</Text>
                <Text style={styles.evidenceValue}>Chữ ký số • 02 Ảnh hiện trường</Text>
              </View>
              <View style={styles.evidenceThumbMock} />
            </View>
          </View>

          <View style={styles.nextPlanCard}>
            <View style={styles.nextPlanHeader}>
              <Text style={styles.planIcon}>🔄</Text>
              <Text style={styles.planTitle}>KẾ HOẠCH THU HỒI SẮP TỚI</Text>
              <Text style={styles.planBadge}>NEXT OPERATION</Text>
            </View>
            
            <View style={styles.planContentBox}>
              <View style={styles.planTimeRow}>
                <View style={styles.planTimeLeft}>
                  <Text style={styles.planTimeLabel}>THỜI GIAN THU HỒI DỰ KIẾN</Text>
                  <Text style={styles.planTimeValue}>{handoverReceipt.nextPlan.time}</Text>
                  <Text style={styles.planTimeSub}>{handoverReceipt.nextPlan.desc}</Text>
                </View>
                <View style={styles.planQtyBox}>
                  <Text style={styles.planQtyLabel}>SỐ LƯỢNG</Text>
                  <Text style={styles.planQtyValue}>0{handoverReceipt.nextPlan.qty}</Text>
                  <Text style={styles.planQtyLabel}>món</Text>
                </View>
              </View>

              <View style={styles.planLocRow}>
                <Text style={styles.planLocIcon}>📍</Text>
                <View>
                  <Text style={styles.planLocLabel}>ĐIỂM HẸN ĐÓN TRẢ</Text>
                  <Text style={styles.planLocValue}>{handoverReceipt.nextPlan.location}</Text>
                </View>
              </View>
              <View style={styles.planHubRow}>
                <Text style={styles.planHubIcon}>🏢</Text>
                <View style={styles.planHubInfo}>
                  <Text style={styles.planHubText}>Hub Sa Pa • Đội cơ động tiếp nhận</Text>
                </View>
                <Text style={styles.planAutoBadge}>TỰ ĐỘNG LÊN LỊCH</Text>
              </View>
            </View>
          </View>

          <View style={styles.autoNoteBox}>
            <Text style={styles.autoNoteIcon}>💾</Text>
            <Text style={styles.autoNoteText}>Dữ liệu biên nhận đã lưu an toàn trên máy, tự động tạo lịch hẹn thu hồi thiết bị.</Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.pdfBtn}><Text style={styles.pdfBtnText}>📄 Biên nhận PDF</Text></TouchableOpacity>
            <TouchableOpacity style={styles.zaloBtn}><Text style={styles.zaloBtnText}>💬 Gửi qua Zalo</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.returnBtn}>
            <Text style={styles.returnBtnText}>QUAY LẠI DANH SÁCH NHIỆM VỤ ➔</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  container: { flex: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 16, backgroundColor: 'white' },
  backBtn: { fontSize: 24 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  sosBtn: { backgroundColor: '#FFEBEE', color: '#C62828', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontWeight: 'bold' },
  content: { padding: 16, alignItems: 'center' },
  successBadge: { marginBottom: 12 },
  successIconBox: { backgroundColor: '#00695C', padding: 16, borderRadius: 12, alignItems: 'center' },
  successCheck: { fontSize: 24, color: 'white' },
  vfrsText: { color: 'white', fontSize: 10, fontWeight: 'bold', marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, marginBottom: 8 },
  statusDot: { color: '#1B5E20', fontSize: 10, marginRight: 4 },
  statusText: { color: '#1B5E20', fontSize: 10, fontWeight: 'bold' },
  mainTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  desc: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 24, paddingHorizontal: 16 },
  receiptCard: { width: '100%', backgroundColor: 'white', borderRadius: 12, padding: 16, elevation: 2, marginBottom: 16, borderWidth: 1, borderColor: '#EEE' },
  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  receiptLabel: { fontSize: 10, color: '#666', fontWeight: 'bold', marginBottom: 2 },
  receiptId: { fontSize: 12, fontWeight: 'bold', color: '#1B5E20' },
  meshTag: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  infoBox: { flex: 1, backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8 },
  infoLabel: { fontSize: 10, color: '#666', marginBottom: 4 },
  infoValue: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  infoSub: { fontSize: 10, color: '#666' },
  gpsBox: { flexDirection: 'row', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
  gpsIcon: { fontSize: 20, marginRight: 12 },
  gpsContent: { flex: 1 },
  gpsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  gpsLabel: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  gpsVerified: { fontSize: 10, color: '#1B5E20', fontWeight: 'bold' },
  gpsLoc: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  gpsCoords: { fontSize: 10, color: '#666', fontFamily: 'monospace' },
  eqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  eqLabel: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  eqDone: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  eqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  eqItem: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 4, width: '48%' },
  eqText: { fontSize: 10, color: '#1565C0' },
  evidenceBox: { flexDirection: 'row', backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, alignItems: 'center' },
  evidenceIcon: { fontSize: 20, marginRight: 12 },
  evidenceContent: { flex: 1 },
  evidenceLabel: { fontSize: 10, color: '#666' },
  evidenceValue: { fontSize: 12, fontWeight: 'bold' },
  evidenceThumbMock: { width: 40, height: 24, backgroundColor: '#B0BEC5', borderRadius: 4 },
  nextPlanCard: { width: '100%', backgroundColor: 'white', borderRadius: 12, padding: 16, elevation: 2, marginBottom: 16 },
  nextPlanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  planIcon: { fontSize: 16, color: '#D84315', marginRight: 8 },
  planTitle: { fontSize: 12, fontWeight: 'bold', flex: 1 },
  planBadge: { backgroundColor: '#FFCCBC', color: '#D84315', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  planContentBox: { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12 },
  planTimeRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 12, marginBottom: 12 },
  planTimeLeft: { flex: 1 },
  planTimeLabel: { fontSize: 10, color: '#666', fontWeight: 'bold', marginBottom: 4 },
  planTimeValue: { fontSize: 14, fontWeight: 'bold', color: '#D84315' },
  planTimeSub: { fontSize: 10, color: '#666' },
  planQtyBox: { backgroundColor: '#E3F2FD', padding: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  planQtyLabel: { fontSize: 10, color: '#1565C0', fontWeight: 'bold' },
  planQtyValue: { fontSize: 18, fontWeight: 'bold', color: '#1565C0' },
  planLocRow: { flexDirection: 'row', marginBottom: 12 },
  planLocIcon: { fontSize: 16, marginRight: 8 },
  planLocLabel: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  planLocValue: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  planHubRow: { flexDirection: 'row', alignItems: 'center' },
  planHubIcon: { fontSize: 16, marginRight: 8 },
  planHubInfo: { flex: 1 },
  planHubText: { fontSize: 10, color: '#666' },
  planAutoBadge: { color: '#1B5E20', fontSize: 10, fontWeight: 'bold' },
  autoNoteBox: { flexDirection: 'row', backgroundColor: '#E0F2F1', padding: 12, borderRadius: 8, marginBottom: 16, width: '100%', alignItems: 'center' },
  autoNoteIcon: { fontSize: 20, marginRight: 12, color: '#00695C' },
  autoNoteText: { fontSize: 10, color: '#00695C', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 16 },
  pdfBtn: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  pdfBtnText: { color: '#1B5E20', fontWeight: 'bold' },
  zaloBtn: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  zaloBtnText: { color: '#333', fontWeight: 'bold' },
  returnBtn: { width: '100%', backgroundColor: '#1B5E20', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 32 },
  returnBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
});
