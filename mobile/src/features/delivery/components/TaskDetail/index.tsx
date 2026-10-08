import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { DELIVERY_MOCK_DATA } from '../../mockData';

export const TaskDetailFeature = () => {
  const { taskDetail } = DELIVERY_MOCK_DATA;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerTop}>
        <Text style={styles.backBtn}>←</Text>
        <Text style={styles.headerTitle}>XÁC THỰC ĐƠN HÀNG</Text>
        <Text style={styles.sosBtn}>SOS</Text>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>🟢 GPS ACTIVE • TRẠM TÔN BASE</Text>
        <Text style={styles.statusText}>🛰 LOCK: 14 SV</Text>
        <Text style={styles.statusText}>🔋 96%</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.orderHeaderRow}>
          <Text style={styles.orderTag}>LỆNH ĐIỀU PHỐI</Text>
          <Text style={styles.orderId}>{taskDetail.id}</Text>
          <Text style={styles.orderStatus}>SẴN SÀNG GIAO</Text>
        </View>
        <Text style={styles.tourName}>🧗 Tour: {taskDetail.tour}</Text>

        <View style={styles.customerCard}>
          <View style={styles.customerHeader}>
            <View style={styles.avatarBox}><Text style={styles.avatarIcon}>🪪</Text></View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{taskDetail.customer}</Text>
              <Text style={styles.customerPhone}>{taskDetail.phone}</Text>
            </View>
            <Text style={styles.cccdBadge}>ĐÃ XÁC THỰC CCCD</Text>
          </View>
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactBtn}><Text style={styles.contactText}>📞 GỌI KHẨN</Text></TouchableOpacity>
            <TouchableOpacity style={styles.contactBtn}><Text style={styles.contactText}>💬 SMS / ZALO</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.timeLocRow}>
          <View style={styles.locBox}>
            <Text style={styles.boxLabel}>📍 ĐIỂM HẸN NHẬN</Text>
            <Text style={styles.boxValue}>{taskDetail.receiveLocation}</Text>
            <Text style={styles.boxSub}>{taskDetail.distance}</Text>
          </View>
          <View style={styles.timeBox}>
            <Text style={styles.boxLabel}>⏱ KHUNG GIỜ GIAO</Text>
            <Text style={styles.boxValue}>{taskDetail.timeFrame}</Text>
            <Text style={styles.boxSubDark}>{taskDetail.travelTime}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>📍 TUYẾN ĐƯỜNG DÃ CHIẾN</Text>
            <Text style={styles.routeTag}>ĐÈO Ô QUY HỒ</Text>
          </View>
          <View style={styles.mapMock}>
            <View style={styles.mapRouteLabel}><Text style={styles.mapRouteText}>📍 Tuyến Sa Pa ➔ Trạm Tôn</Text></View>
            <View style={styles.mapOverlay}>
              <View>
                <Text style={styles.mapOverlayTitle}>TRẠNG THÁI MẶT ĐƯỜNG</Text>
                <Text style={styles.mapOverlayDesc}>{taskDetail.roadStatus}</Text>
              </View>
              <TouchableOpacity style={styles.mapNavBtn}><Text style={styles.mapNavText}>🗺 CHỈ ĐƯỜNG</Text></TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteIcon}>📝</Text>
          <View style={styles.noteContent}>
            <Text style={styles.noteLabel}>GHI CHÚ TỪ KHÁCH HÀNG</Text>
            <Text style={styles.noteText}>{taskDetail.note}</Text>
          </View>
        </View>

        <View style={styles.escrowBox}>
          <Text style={styles.escrowIcon}>🛡</Text>
          <View style={styles.escrowContent}>
            <Text style={styles.escrowLabel}>KÝ QUỸ VFRS ESCROW</Text>
            <Text style={styles.escrowValue}>{taskDetail.deposit}</Text>
          </View>
          <View style={styles.escrowLock}>
            <Text style={styles.escrowLockText}>🔒 CHỈ XEM (LOCKED)</Text>
            <Text style={styles.escrowLockSub}>Đã phong tỏa bảo lãnh</Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>📦 THIẾT BỊ BÀN GIAO</Text>
          <Text style={styles.eqCount}>04 / 04 THIẾT BỊ</Text>
        </View>

        {taskDetail.equipments.map((eq, idx) => (
          <View key={idx} style={styles.eqCard}>
            <View style={styles.eqImgMock} />
            <View style={styles.eqInfo}>
              <View style={styles.eqTopRow}>
                <Text style={styles.eqId}>{eq.id}</Text>
                <Text style={styles.eqQty}>SL: {eq.qty < 10 ? `0${eq.qty}` : eq.qty} {eq.name.includes('Áo') ? 'BỘ' : eq.name.includes('Gậy') ? 'GẬY' : 'CÁI'}</Text>
              </View>
              <Text style={styles.eqName}>{eq.name}</Text>
              <Text style={styles.eqDesc}>{eq.desc}</Text>
              <Text style={styles.eqStatus}>● {eq.status}</Text>
            </View>
          </View>
        ))}

        <View style={styles.standardBox}>
          <Text style={styles.standardIcon}>✅</Text>
          <View>
            <Text style={styles.standardTitle}>Quy chuẩn bàn giao dã ngoại</Text>
            <Text style={styles.standardDesc}>Yêu cầu đối kiểm trực tiếp từng món cùng trưởng đoàn trước khi ký nhận kỹ thuật số.</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.warnBtn}><Text style={styles.warnBtnText}>⚠ BÁO SỰ CỐ GIAO HÀNG</Text></TouchableOpacity>
          <View style={styles.waitBtn}><Text style={styles.waitBtnText}>🚴 ĐANG CHỜ XUẤT PHÁT</Text></View>
        </View>
        
        <TouchableOpacity style={styles.startBtn}><Text style={styles.startBtnText}>🚴 BẮT ĐẦU DI CHUYỂN 🚴</Text></TouchableOpacity>
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
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1B5E20', padding: 8 },
  statusText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  content: { padding: 16 },
  orderHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  orderTag: { backgroundColor: '#1B5E20', color: 'white', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4, marginRight: 8 },
  orderId: { fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  orderStatus: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  tourName: { fontSize: 12, color: '#666', marginBottom: 16 },
  customerCard: { backgroundColor: '#F5F9FF', padding: 12, borderRadius: 8, marginBottom: 16 },
  customerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarBox: { width: 40, height: 40, backgroundColor: 'white', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarIcon: { fontSize: 20 },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: 'bold' },
  customerPhone: { fontSize: 12, color: '#666' },
  cccdBadge: { backgroundColor: '#E3F2FD', color: '#1565C0', fontSize: 8, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  contactRow: { flexDirection: 'row', gap: 8 },
  contactBtn: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  contactText: { color: '#1B5E20', fontWeight: 'bold', fontSize: 12 },
  timeLocRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  locBox: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
  timeBox: { flex: 1, backgroundColor: '#F9FBE7', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F0F4C3' },
  boxLabel: { fontSize: 10, color: '#666', fontWeight: 'bold', marginBottom: 4 },
  boxValue: { fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  boxSub: { fontSize: 10, color: '#D84315', fontWeight: 'bold' },
  boxSubDark: { fontSize: 10, color: '#33691E', fontWeight: 'bold' },
  section: { marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginRight: 8 },
  routeTag: { backgroundColor: '#FFEBEE', color: '#C62828', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  mapMock: { height: 150, backgroundColor: '#B2DFDB', borderRadius: 8, justifyContent: 'space-between', padding: 12 },
  mapRouteLabel: { backgroundColor: 'white', alignSelf: 'flex-start', padding: 4, borderRadius: 4 },
  mapRouteText: { fontSize: 10, fontWeight: 'bold' },
  mapOverlay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  mapOverlayTitle: { color: 'white', fontSize: 10, fontWeight: 'bold', textShadowColor: 'black', textShadowRadius: 2 },
  mapOverlayDesc: { color: 'white', fontSize: 12, fontWeight: 'bold', textShadowColor: 'black', textShadowRadius: 2 },
  mapNavBtn: { backgroundColor: '#1B5E20', padding: 8, borderRadius: 4 },
  mapNavText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  noteBox: { flexDirection: 'row', backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginBottom: 16 },
  noteIcon: { fontSize: 24, marginRight: 12 },
  noteContent: { flex: 1 },
  noteLabel: { fontSize: 10, fontWeight: 'bold', color: '#E65100', marginBottom: 4 },
  noteText: { fontSize: 12, color: '#4E342E', fontStyle: 'italic' },
  escrowBox: { flexDirection: 'row', backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginBottom: 24, alignItems: 'center' },
  escrowIcon: { fontSize: 24, marginRight: 12 },
  escrowContent: { flex: 1 },
  escrowLabel: { fontSize: 10, fontWeight: 'bold', color: '#2E7D32' },
  escrowValue: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  escrowLock: { alignItems: 'flex-end' },
  escrowLockText: { fontSize: 10, fontWeight: 'bold', color: '#1565C0' },
  escrowLockSub: { fontSize: 8, color: '#666' },
  eqCount: { backgroundColor: '#E3F2FD', color: '#1565C0', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  eqCard: { flexDirection: 'row', backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#EEE' },
  eqImgMock: { width: 60, height: 60, backgroundColor: '#CFD8DC', borderRadius: 4, marginRight: 12 },
  eqInfo: { flex: 1 },
  eqTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  eqId: { backgroundColor: '#E3F2FD', color: '#1565C0', fontSize: 8, fontWeight: 'bold', padding: 2, borderRadius: 2 },
  eqQty: { fontSize: 10, fontWeight: 'bold', color: '#2E7D32' },
  eqName: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  eqDesc: { fontSize: 10, color: '#666', marginBottom: 4 },
  eqStatus: { fontSize: 10, color: '#1B5E20', fontWeight: 'bold' },
  standardBox: { flexDirection: 'row', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
  standardIcon: { fontSize: 24, marginRight: 12 },
  standardTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  standardDesc: { fontSize: 10, color: '#666', flexShrink: 1 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  warnBtn: { flex: 1, backgroundColor: '#FFEBEE', padding: 12, borderRadius: 8, alignItems: 'center' },
  warnBtnText: { color: '#C62828', fontSize: 10, fontWeight: 'bold' },
  waitBtn: { flex: 1, backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, alignItems: 'center' },
  waitBtnText: { color: '#1565C0', fontSize: 10, fontWeight: 'bold' },
  startBtn: { backgroundColor: '#1B5E20', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 32 },
  startBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
