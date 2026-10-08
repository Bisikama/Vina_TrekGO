import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { DELIVERY_MOCK_DATA } from '../../mockData';

export const ReturnChecklistFeature = () => {
  const { returnChecklist } = DELIVERY_MOCK_DATA;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.headerTop}>
          <Text style={styles.backBtn}>←</Text>
          <Text style={styles.headerTitle}>XÁC THỰC ĐƠN HÀNG</Text>
          <Text style={styles.sosBtn}>SOS</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.statusBox}>
            <Text style={styles.statusIcon}>🧗</Text>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>{returnChecklist.status}</Text>
              <Text style={styles.statusSub}>Khung giờ thu hồi: <Text style={styles.boldText}>{returnChecklist.timeWindow}</Text></Text>
            </View>
            <Text style={styles.statusBadge}>HẸN 30P</Text>
          </View>

          <View style={styles.customerCard}>
            <View style={styles.customerInfo}>
              <View style={styles.tagsRow}>
                <Text style={styles.idTag}>{returnChecklist.id}</Text>
                <Text style={styles.tourTag}>{returnChecklist.tour}</Text>
              </View>
              <Text style={styles.customerName}>{returnChecklist.customer}</Text>
              <Text style={styles.customerPhone}>SĐT: {returnChecklist.phone}</Text>
            </View>
            <View style={styles.actionBtns}>
              <TouchableOpacity style={styles.iconBtn}><Text>📞</Text></TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}><Text>💬</Text></TouchableOpacity>
            </View>
          </View>

          <View style={styles.locBox}>
            <Text style={styles.locIcon}>📍</Text>
            <View>
              <Text style={styles.locTitle}>{returnChecklist.location} <Text style={styles.locDist}>{returnChecklist.distance}</Text></Text>
              <Text style={styles.locDesc}>Đoàn đang nghỉ chân uống nước & giãn cơ tại...</Text>
            </View>
          </View>

          <View style={styles.mapMock}>
            <View style={styles.mapGpsBadge}><Text style={styles.mapGpsText}>● GPS: 22.3481° N, 103.8295° E</Text></View>
            <View style={styles.mapFooter}>
              <View style={styles.mapWalkBadge}><Text style={styles.mapWalkText}>🚶 Đi bộ 4 phút theo lối bậc đá</Text></View>
              <View style={styles.mapExpandBtn}><Text style={styles.mapExpandText}>Xem bản đồ lớn ↗</Text></View>
            </View>
          </View>

          <View style={styles.eqHeader}>
            <Text style={styles.eqTitle}>Thiết bị thu hồi</Text>
            <Text style={styles.eqCountBadge}>3 / 4 ĐÃ NHẬN</Text>
            <Text style={styles.eqFilter}>Đối soát trực quan</Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
            <View style={[styles.tab, styles.activeTab]}><Text style={styles.activeTabText}>Tất cả (4)</Text></View>
            <View style={styles.tab}><Text style={styles.tabText}>Đã nhận (3)</Text></View>
            <View style={styles.tab}><Text style={styles.tabText}>Chưa nhận (1)</Text></View>
          </ScrollView>

          {returnChecklist.items.map((item, idx) => (
            <View key={idx} style={[styles.itemCard, item.type === 'warn' && styles.itemCardWarn, item.type === 'danger' && styles.itemCardDanger]}>
              <View style={styles.itemHeader}>
                <View style={styles.itemImgMock} />
                <View style={styles.itemInfo}>
                  <View style={styles.itemTags}>
                    <Text style={styles.itemCode}>{item.id}</Text>
                    <Text style={styles.itemQtyBadge}>SL: 0{item.qty}</Text>
                  </View>
                  <Text style={styles.itemName}>{item.name}</Text>
                </View>
              </View>

              <View style={styles.itemFooter}>
                {item.type === 'danger' ? (
                  <>
                    <View style={styles.statusDangerBox}><Text style={styles.statusDangerText}>⏳ {item.status}</Text></View>
                    <TouchableOpacity style={styles.actionBtnGreen}><Text style={styles.actionBtnGreenText}>✓ Nhận ngay</Text></TouchableOpacity>
                  </>
                ) : item.type === 'warn' ? (
                  <>
                    <View style={styles.statusWarnBox}><Text style={styles.statusWarnText}>💧 {item.status}</Text></View>
                    <TouchableOpacity style={styles.actionBtnGrey}><Text style={styles.actionBtnGreyText}>⚐ Báo sấy kho</Text></TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.statusSafeBox}><Text style={styles.statusSafeText}>✓ {item.status}</Text></View>
                    <TouchableOpacity style={styles.actionBtnGrey}><Text style={styles.actionBtnGreyText}>📷 Chụp ảnh (1)</Text></TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}

          <View style={styles.noteBox}>
            <Text style={styles.noteIcon}>🛡</Text>
            <Text style={styles.noteText}>Khách hạ sơn có thể gửi balo phụ trước tại xe ôm hoặc người dẫn đường địa phương. Hãy đối soát đúng mã vạch hoặc tem QR dán trên thân thiết bị trước khi chốt biên bản.</Text>
          </View>
          
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.reportBtn}><Text style={styles.reportBtnText}>⏱ BÁO KHÁCH TRỄ GIỜ HẠ SƠN</Text></TouchableOpacity>
            <TouchableOpacity style={styles.verifyBtn}><Text style={styles.verifyBtnText}>📷 XÁC MINH KHÁCH HÀNG & KIẾM ĐỒ ➔</Text></TouchableOpacity>
          </View>
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
  content: { padding: 16 },
  statusBox: { flexDirection: 'row', backgroundColor: '#E0F2F1', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  statusIcon: { fontSize: 24, marginRight: 12 },
  statusInfo: { flex: 1 },
  statusTitle: { color: '#00695C', fontSize: 12, fontWeight: 'bold' },
  statusSub: { color: '#00695C', fontSize: 10 },
  boldText: { fontWeight: 'bold' },
  statusBadge: { backgroundColor: '#FFCCBC', color: '#D84315', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  customerCard: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  customerInfo: { flex: 1 },
  tagsRow: { flexDirection: 'row', marginBottom: 4 },
  idTag: { backgroundColor: '#F5F5F5', color: '#666', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  tourTag: { backgroundColor: '#E8F5E9', color: '#2E7D32', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  customerName: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  customerPhone: { fontSize: 12, color: '#666' },
  actionBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, backgroundColor: '#F5F5F5', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  locBox: { flexDirection: 'row', backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
  locIcon: { fontSize: 20, color: '#D84315', marginRight: 12 },
  locTitle: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  locDist: { color: '#D84315' },
  locDesc: { fontSize: 10, color: '#666' },
  mapMock: { height: 120, backgroundColor: '#B2DFDB', borderRadius: 8, marginBottom: 16, padding: 8, justifyContent: 'space-between' },
  mapGpsBadge: { backgroundColor: '#263238', alignSelf: 'flex-start', padding: 4, borderRadius: 4 },
  mapGpsText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  mapFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  mapWalkBadge: { backgroundColor: '#1B5E20', padding: 6, borderRadius: 4 },
  mapWalkText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  mapExpandBtn: { backgroundColor: 'white', padding: 6, borderRadius: 4 },
  mapExpandText: { color: '#333', fontSize: 10, fontWeight: 'bold' },
  eqHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eqTitle: { fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  eqCountBadge: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4, marginRight: 'auto' },
  eqFilter: { fontSize: 10, color: '#666' },
  tabs: { marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E0E0E0', marginRight: 8 },
  activeTab: { backgroundColor: '#1B5E20' },
  activeTabText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  tabText: { color: '#666', fontSize: 10, fontWeight: 'bold' },
  itemCard: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 12, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#1B5E20' },
  itemCardWarn: { borderLeftColor: '#F57C00' },
  itemCardDanger: { borderLeftColor: '#C62828' },
  itemHeader: { flexDirection: 'row', marginBottom: 12 },
  itemImgMock: { width: 50, height: 50, backgroundColor: '#CFD8DC', borderRadius: 4, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTags: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemCode: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  itemQtyBadge: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  itemName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusSafeBox: { backgroundColor: '#E8F5E9', padding: 6, borderRadius: 4 },
  statusSafeText: { color: '#2E7D32', fontSize: 10, fontWeight: 'bold' },
  statusWarnBox: { backgroundColor: '#FBE9E7', padding: 6, borderRadius: 4 },
  statusWarnText: { color: '#D84315', fontSize: 10, fontWeight: 'bold' },
  statusDangerBox: { backgroundColor: '#FFEBEE', padding: 6, borderRadius: 4 },
  statusDangerText: { color: '#C62828', fontSize: 10, fontWeight: 'bold' },
  actionBtnGrey: { backgroundColor: '#F5F5F5', padding: 6, borderRadius: 4 },
  actionBtnGreyText: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  actionBtnGreen: { backgroundColor: '#1B5E20', padding: 6, borderRadius: 4 },
  actionBtnGreenText: { fontSize: 10, fontWeight: 'bold', color: 'white' },
  noteBox: { flexDirection: 'row', backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, marginBottom: 24, alignItems: 'center' },
  noteIcon: { fontSize: 16, marginRight: 12 },
  noteText: { fontSize: 10, color: '#666', flex: 1, lineHeight: 14 },
  bottomActions: { gap: 12 },
  reportBtn: { backgroundColor: '#F5F5F5', padding: 16, borderRadius: 8, alignItems: 'center' },
  reportBtnText: { color: '#C62828', fontSize: 12, fontWeight: 'bold' },
  verifyBtn: { backgroundColor: '#1B5E20', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 32 },
  verifyBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
});
