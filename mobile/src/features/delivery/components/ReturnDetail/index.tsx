import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { DELIVERY_MOCK_DATA } from '../../mockData';

export const ReturnDetailFeature = () => {
  const { returnDetail } = DELIVERY_MOCK_DATA;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.headerTop}>
          <Text style={styles.backBtn}>←</Text>
          <Text style={styles.headerTitle}>XÁC THỰC ĐƠN HÀNG</Text>
          <Text style={styles.sosBtn}>SOS</Text>
        </View>

        <View style={styles.statusBar}>
          <Text style={styles.statusText}>🟢 GPS: 22°20'14"N  103°49'32"E</Text>
          <Text style={styles.statusText}>ALT 1,480M</Text>
          <Text style={styles.statusText}>☁️ OFFLINE SYNC</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.timeCard}>
            <View style={styles.timeHeader}>
              <View style={styles.moveBadge}><Text style={styles.moveText}>🚴 ĐANG DI CHUYỂN ĐẾN ĐIỂM ĐÓN</Text></View>
              <Text style={styles.taskId}>NHIỆM VỤ: #RET-7892</Text>
            </View>
            <View style={styles.timeBody}>
              <View>
                <Text style={styles.timeLabel}>KHUNG GIỜ HẸN THU HỒI</Text>
                <Text style={styles.timeValue}>{returnDetail.time}</Text>
              </View>
              <View style={styles.dateBadge}><Text style={styles.dateText}>{returnDetail.date}</Text></View>
            </View>
          </View>

          <View style={styles.customerCard}>
            <View style={styles.customerInfoRow}>
              <View style={styles.avatarMock}><Text style={styles.avatarText}>TA</Text></View>
              <View style={styles.customerDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.customerName}>{returnDetail.customer}</Text>
                  <Text style={styles.leaderBadge}>✓ TRƯỞNG ĐOÀN</Text>
                </View>
                <Text style={styles.customerCccd}>CCCD: {returnDetail.cccd}</Text>
              </View>
            </View>
            <View style={styles.tourRow}>
              <Text style={styles.tourIcon}>🧗</Text>
              <View>
                <Text style={styles.tourLabel}>TOUR LIÊN KẾT</Text>
                <Text style={styles.tourName}>{returnDetail.tour}</Text>
              </View>
              <Text style={styles.tourStatusBadge}>HẠ SƠN VỀ</Text>
            </View>
            <View style={styles.actionBtns}>
              <TouchableOpacity style={styles.contactBtn}><Text style={styles.contactText}>📞 GỌI ĐIỆN KHẨN</Text></TouchableOpacity>
              <TouchableOpacity style={styles.contactBtnWhite}><Text style={styles.contactTextDark}>💬 NHẮN SMS / ZALO</Text></TouchableOpacity>
            </View>
          </View>

          <View style={styles.mapCard}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapDistance}>● {returnDetail.distance}</Text>
            </View>
            <View style={styles.mapMock} />
            <View style={styles.mapFooter}>
              <Text style={styles.locLabel}>ĐIỂM HẸN THU HỒI</Text>
              <View style={styles.locRow}>
                <Text style={styles.locName}>{returnDetail.location}</Text>
                <Text style={styles.locIcon}>📍</Text>
              </View>
            </View>
          </View>

          <View style={styles.roadStatusRow}>
            <Text style={styles.roadIcon}>🛣</Text>
            <Text style={styles.roadLabel}>Mặt đường: Bê tông bậc thang dã ngoại</Text>
            <Text style={styles.roadBadge}>KHÔ RÁO</Text>
          </View>
          <TouchableOpacity style={styles.mapOpenBtn}><Text style={styles.mapOpenText}>🗺 MỞ CHỈ ĐƯỜNG BẢN ĐỒ DÃ NGOẠI</Text></TouchableOpacity>

          <View style={styles.eqHeader}>
            <Text style={styles.eqTitle}>Thiết Bị Cần Thu Hồi</Text>
            <Text style={styles.eqCount}>04 MÓN</Text>
            <Text style={styles.eqFilter}>KIỂM ĐẾM TẠI CHỖ</Text>
          </View>

          {returnDetail.items.map((item, idx) => (
            <View key={idx} style={[styles.itemCard, item.danger && styles.itemCardDanger]}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTags}>
                  <Text style={styles.itemCode}>{item.id}</Text>
                  <Text style={styles.itemQty}>SL: 01</Text>
                </View>
                {item.danger ? (
                  <View style={styles.statusDangerBadge}><Text style={styles.statusDangerText}>⚠ CHƯA NHẬN</Text></View>
                ) : (
                  <View style={styles.statusSafeBadge}><Text style={styles.statusSafeText}>✓ ĐÃ NHẬN LẠI</Text></View>
                )}
              </View>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.note && <Text style={styles.itemNoteText}>⚠ {item.note}</Text>}
              <View style={styles.itemFooterRow}>
                <Text style={styles.itemDesc}>Lúc giao: Mới 98%</Text>
                <Text style={[styles.itemStatus, item.danger && styles.itemStatusDanger]}>{item.danger ? item.status : `Hiện trạng: ${item.status}`}</Text>
              </View>
            </View>
          ))}

          <View style={styles.sopBox}>
            <View style={styles.sopHeader}>
              <Text style={styles.sopIcon}>🛡</Text>
              <Text style={styles.sopTitle}>QUY CHUẨN NGHIỆP VỤ THỰC ĐỊA (SOP)</Text>
            </View>
            <Text style={styles.sopDesc}>Staff Delivery <Text style={styles.boldText}>chỉ ghi nhận hiện trạng bàn giao thực tế</Text> tại hiện trường. Nhân viên <Text style={styles.redText}>KHÔNG có quyền</Text> duyệt khấu trừ, định giá hư hỏng hay hoàn tiền cọc. Bộ phận Staff Inventory (Kho Sa Pa) sẽ kiểm định kỹ thuật chính thức trên Web và hệ thống sẽ tự động hoàn cọc sau đó.</Text>
          </View>

          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.reportBtn}><Text style={styles.reportBtnText}>⏱ Báo khách trễ hẹn hạ sơn</Text></TouchableOpacity>
            <TouchableOpacity style={styles.reportBtn}><Text style={styles.reportBtnText}>⚠ Báo sự cố điểm đón</Text></TouchableOpacity>
          </View>

          <View style={styles.footerInfo}>
            <Text style={styles.footerHub}>● Trạm Hub: Sa Pa Central (Cách 3.2km)</Text>
            <Text style={styles.footerStep}>BƯỚC 1/3</Text>
          </View>

          <TouchableOpacity style={styles.arriveBtn}><Text style={styles.arriveBtnText}>📍 TÔI ĐÃ ĐẾN ĐIỂM HẸN</Text></TouchableOpacity>
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
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F5F5F5', padding: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  statusText: { color: '#333', fontSize: 10, fontWeight: 'bold' },
  content: { padding: 16 },
  timeCard: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#F57C00', elevation: 1 },
  timeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  moveBadge: { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  moveText: { color: '#E65100', fontSize: 10, fontWeight: 'bold' },
  taskId: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  timeBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeLabel: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  timeValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  dateBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  dateText: { color: '#1565C0', fontSize: 10, fontWeight: 'bold' },
  customerCard: { backgroundColor: 'white', borderRadius: 8, padding: 16, marginBottom: 16, elevation: 1 },
  customerInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarMock: { width: 48, height: 48, backgroundColor: '#E3F2FD', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: '#1565C0' },
  customerDetails: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  customerName: { fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  leaderBadge: { backgroundColor: '#E8F5E9', color: '#2E7D32', fontSize: 8, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  customerCccd: { fontSize: 12, color: '#666' },
  tourRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 8, borderRadius: 8, marginBottom: 16 },
  tourIcon: { fontSize: 20, marginRight: 12 },
  tourLabel: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  tourName: { fontSize: 12, fontWeight: 'bold' },
  tourStatusBadge: { backgroundColor: '#E3F2FD', color: '#1565C0', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4, marginLeft: 'auto' },
  actionBtns: { flexDirection: 'row', gap: 12 },
  contactBtn: { flex: 1, backgroundColor: '#1B5E20', padding: 12, borderRadius: 8, alignItems: 'center' },
  contactText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  contactBtnWhite: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  contactTextDark: { color: '#333', fontSize: 12, fontWeight: 'bold' },
  mapCard: { backgroundColor: 'white', borderRadius: 8, overflow: 'hidden', marginBottom: 12, elevation: 1 },
  mapHeader: { padding: 8, backgroundColor: 'white', position: 'absolute', top: 8, left: 8, zIndex: 10, borderRadius: 4 },
  mapDistance: { fontSize: 10, fontWeight: 'bold' },
  mapMock: { height: 120, backgroundColor: '#B2DFDB' },
  mapFooter: { padding: 12, backgroundColor: 'white' },
  locLabel: { fontSize: 10, color: '#666', fontWeight: 'bold', marginBottom: 4 },
  locRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locName: { fontSize: 14, fontWeight: 'bold' },
  locIcon: { fontSize: 16, color: '#D84315' },
  roadStatusRow: { flexDirection: 'row', backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  roadIcon: { fontSize: 16, marginRight: 8 },
  roadLabel: { fontSize: 10, color: '#666', flex: 1 },
  roadBadge: { backgroundColor: '#E3F2FD', color: '#1565C0', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  mapOpenBtn: { backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 24 },
  mapOpenText: { color: '#1565C0', fontSize: 12, fontWeight: 'bold' },
  eqHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eqTitle: { fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  eqCount: { backgroundColor: '#F5F5F5', color: '#333', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4, marginRight: 'auto' },
  eqFilter: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  itemCard: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#2E7D32', elevation: 1 },
  itemCardDanger: { borderLeftColor: '#C62828' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTags: { flexDirection: 'row' },
  itemCode: { fontSize: 10, color: '#666', fontWeight: 'bold', marginRight: 8 },
  itemQty: { backgroundColor: '#F5F5F5', color: '#333', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 4, borderRadius: 4 },
  statusSafeBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusSafeText: { color: '#2E7D32', fontSize: 10, fontWeight: 'bold' },
  statusDangerBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusDangerText: { color: '#C62828', fontSize: 10, fontWeight: 'bold' },
  itemName: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  itemNoteText: { fontSize: 10, color: '#D84315', marginBottom: 4 },
  itemFooterRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemDesc: { fontSize: 10, color: '#666' },
  itemStatus: { fontSize: 10, color: '#2E7D32' },
  itemStatusDanger: { color: '#C62828', fontWeight: 'bold' },
  sopBox: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#EEE' },
  sopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sopIcon: { fontSize: 16, color: '#2E7D32', marginRight: 8 },
  sopTitle: { fontSize: 12, fontWeight: 'bold', color: '#2E7D32' },
  sopDesc: { fontSize: 10, color: '#666', lineHeight: 16 },
  boldText: { fontWeight: 'bold', color: '#333' },
  redText: { fontWeight: 'bold', color: '#C62828' },
  bottomActions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  reportBtn: { flex: 1, backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, alignItems: 'center' },
  reportBtnText: { color: '#C62828', fontSize: 10, fontWeight: 'bold' },
  footerInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  footerHub: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  footerStep: { fontSize: 10, color: '#333', fontWeight: 'bold' },
  arriveBtn: { backgroundColor: '#1B5E20', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 32 },
  arriveBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
});
