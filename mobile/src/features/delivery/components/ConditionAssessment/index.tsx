import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { DELIVERY_MOCK_DATA } from '../../mockData';

export const ConditionAssessmentFeature = () => {
  const { conditionAssessment } = DELIVERY_MOCK_DATA;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.headerTop}>
          <Text style={styles.backBtn}>←</Text>
          <Text style={styles.headerTitle}>HOÀN TẤT NHIỆM VỤ</Text>
          <Text style={styles.sosBtn}>SOS</Text>
        </View>

        <View style={styles.statusBar}>
          <Text style={styles.statusText}>● VFRS FIELD DISPATCH ONLINE</Text>
          <Text style={styles.statusId}>BIÊN BẢN #RET-7892</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.customerCard}>
            <View style={styles.customerHeader}>
              <Text style={styles.customerName}>{conditionAssessment.customer}</Text>
              <Text style={styles.customerBadge}>THU HỒI TẠI CHỖ</Text>
            </View>
            <View style={styles.tourRow}>
              <Text style={styles.tourId}>{conditionAssessment.id}</Text>
              <Text style={styles.tourName}> • Trek Fansipan Trạm Tôn</Text>
            </View>
            <View style={styles.locTimeRow}>
              <View style={styles.locBox}><Text style={styles.locIcon}>📍</Text><Text style={styles.locText}>{conditionAssessment.location}</Text></View>
              <View style={styles.timeBox}><Text style={styles.timeIcon}>⏱</Text><Text style={styles.timeText}>{conditionAssessment.time}</Text></View>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionIcon}>☑</Text>
            <Text style={styles.sectionTitle}>HIỆN TRẠNG THỰC TẾ TỪNG THIẾT BỊ</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>4 thiết bị</Text></View>
          </View>

          {conditionAssessment.items.map((item, idx) => (
            <View key={idx} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTags}>
                  <Text style={styles.itemCode}>{item.id}</Text>
                  <Text style={[styles.itemTagBadge, item.danger && styles.itemTagDanger]} >{item.tag}</Text>
                </View>
                <View style={[styles.itemIconBox, item.danger && styles.itemIconDanger]}>
                  <Text style={styles.itemIcon}>{item.name.includes('Balo') ? '🎒' : item.name.includes('Gậy') ? '🦯' : item.name.includes('Áo') ? '🧥' : '🔦'}</Text>
                </View>
              </View>
              <Text style={styles.itemName}>{item.name}</Text>

              <View style={styles.chipRow}>
                {item.danger ? (
                  <>
                    <View style={styles.chip}><Text style={styles.chipText}>Bình thường</Text></View>
                    <View style={styles.chip}><Text style={styles.chipText}>Hỏng hóc</Text></View>
                    <View style={styles.chipActiveDanger}><Text style={styles.chipActiveDangerText}>⚠ Mất dây sạc Type-C</Text></View>
                  </>
                ) : (
                  <>
                    <View style={styles.chipActiveSafe}><Text style={styles.chipActiveSafeText}>✓ Bình thường</Text></View>
                    {item.name.includes('Balo') && <View style={styles.chipActiveWarn}><Text style={styles.chipActiveWarnText}>✓ Bẩn bùn nhẹ (VFRS Chấp nhận)</Text></View>}
                    {item.name.includes('Gậy') && <View style={styles.chip}><Text style={styles.chipText}>Trầy xước thâm</Text></View>}
                    {item.name.includes('Áo') && <View style={styles.chip}><Text style={styles.chipText}>Rách vải</Text></View>}
                  </>
                )}
              </View>

              <View style={styles.descBox}>
                <Text style={styles.descLabel}>[THỰC ĐỊA]: <Text style={styles.descText}>{item.desc}</Text></Text>
              </View>
              
              {(item.name.includes('Balo') || item.name.includes('Đèn')) && (
                <View style={styles.photoRow}>
                  <View style={styles.photoMock}><Text style={styles.photoCount}>1/1</Text></View>
                  <View style={styles.photoInfo}>
                    <Text style={styles.photoTitle}>Ảnh kiểm chứng đính kèm</Text>
                    <Text style={styles.photoSub}>Chụp lúc {item.time} • Đã đồng bộ GPS</Text>
                  </View>
                </View>
              )}
            </View>
          ))}

          <View style={styles.summaryBox}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryIcon}>📊</Text>
              <Text style={styles.summaryTitle}>TỔNG KẾT KIỂM ĐẾM HIỆN TRƯỜNG</Text>
              <Text style={styles.summaryCount}>04 / 04</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumSafe}>03</Text>
                <Text style={styles.summaryLabel}>Nguyên vẹn</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumWarn}>01</Text>
                <Text style={styles.summaryLabel}>Thiếu cáp sạc</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumDanger}>00</Text>
                <Text style={styles.summaryLabel}>Hỏng / Thất lạc</Text>
              </View>
            </View>
          </View>

          <View style={styles.rulesBox}>
            <View style={styles.rulesHeader}>
              <Text style={styles.rulesIcon}>🛡</Text>
              <Text style={styles.rulesTitle}>Lưu ý phân quyền & Bảo mật cọc</Text>
              <Text style={styles.rulesBadge}>VFRS RULE</Text>
            </View>
            <Text style={styles.rulesDesc}>Nhân viên Giao nhận <Text style={styles.boldText}>(Staff Delivery)</Text> chỉ ghi nhận hiện trạng khách quan tại hiện trường. Kho thiết bị Sa Pa <Text style={styles.boldText}>(Staff Inventory)</Text> sẽ kiểm định kỹ thuật chuyên sâu và xử lý bảo lưu/hoàn tiền cọc theo quy chế.</Text>
            <View style={styles.rulesStatusRow}>
              <Text style={styles.rulesStatusLabel}>TRẠNG THÁI XỬ LÝ TIỀN CỌC:</Text>
              <Text style={styles.rulesStatusBadge}>CHỜ KIỂM ĐỊNH TẠI KHO</Text>
            </View>
            <Text style={styles.rulesNote}>* Ứng dụng Delivery không hỗ trợ thao tác trừ/hoàn tiền để đảm bảo tính minh bạch độc lập giữa các bộ phận.</Text>
          </View>

          <View style={styles.signatureBox}>
            <View style={styles.signatureHeader}>
              <Text style={styles.signatureIcon}>✍</Text>
              <Text style={styles.signatureTitle}>CHỮ KÝ XÁC NHẬN THỰC ĐỊA</Text>
              <Text style={styles.signatureBadge}>🔒 Đã mã hóa</Text>
            </View>
            <Text style={styles.signatureDesc}>Khách hàng <Text style={styles.boldText}>{conditionAssessment.customer}</Text> đã đối soát và ký xác nhận đúng biên bản 4 thiết bị trên:</Text>
            <View style={styles.padMock}>
              <View style={styles.padCurve} />
              <View style={styles.padDetails}>
                <Text style={styles.padName}>Tuấn Anh (Ký điện tử)</Text>
                <Text style={styles.padHash}>HASH: 9a8b..f42e</Text>
              </View>
            </View>
            <View style={styles.staffSignRow}>
              <Text style={styles.staffSignText}>Nhân viên thu hồi: <Text style={styles.boldText}>Lê Hoàng Nam (DEL-04)</Text></Text>
              <Text style={styles.staffSignBadge}>GPS Khớp Lên</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.viewPdfBtn}><Text style={styles.viewPdfText}>📄 XEM BIÊN NHẬN HOÀN TRẢ SƠ BỘ</Text></TouchableOpacity>
          <TouchableOpacity style={styles.finishBtn}><Text style={styles.finishBtnText}>☑ HOÀN TẤT THU HỒI & CHUYỂN VỀ KHO ✓</Text></TouchableOpacity>
          <Text style={styles.footerNote}>Dữ liệu và hình ảnh hiện trường sẽ được gửi ngay đến Kho Sa Pa qua vệ tinh/4G.</Text>
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
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E3F2FD', padding: 8 },
  statusText: { color: '#1B5E20', fontSize: 10, fontWeight: 'bold' },
  statusId: { color: '#666', fontSize: 10, fontWeight: 'bold' },
  content: { padding: 16 },
  customerCard: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 24, elevation: 1 },
  customerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  customerName: { fontSize: 18, fontWeight: 'bold' },
  customerBadge: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  tourRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tourId: { fontSize: 12, fontWeight: 'bold', color: '#1B5E20' },
  tourName: { fontSize: 12, color: '#666' },
  locTimeRow: { flexDirection: 'row', gap: 12 },
  locBox: { flexDirection: 'row', alignItems: 'center' },
  locIcon: { fontSize: 12, marginRight: 4 },
  locText: { fontSize: 10, color: '#666' },
  timeBox: { flexDirection: 'row', alignItems: 'center' },
  timeIcon: { fontSize: 12, marginRight: 4 },
  timeText: { fontSize: 10, color: '#666' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionIcon: { fontSize: 16, marginRight: 8 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', flex: 1 },
  countBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  countText: { color: '#1565C0', fontSize: 10, fontWeight: 'bold' },
  itemCard: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 12, elevation: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemTags: { flexDirection: 'row', alignItems: 'center' },
  itemCode: { backgroundColor: '#F5F5F5', fontSize: 10, fontWeight: 'bold', padding: 2, borderRadius: 4, marginRight: 8 },
  itemTagBadge: { backgroundColor: '#E8F5E9', color: '#2E7D32', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  itemTagDanger: { backgroundColor: '#FFEBEE', color: '#C62828' },
  itemIconBox: { backgroundColor: '#C8E6C9', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  itemIconDanger: { backgroundColor: '#FFCCBC' },
  itemIcon: { fontSize: 16 },
  itemName: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  chip: { backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  chipText: { fontSize: 10, color: '#666' },
  chipActiveSafe: { backgroundColor: '#1B5E20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  chipActiveSafeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  chipActiveWarn: { backgroundColor: '#D84315', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  chipActiveWarnText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  chipActiveDanger: { backgroundColor: '#C62828', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  chipActiveDangerText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  descBox: { backgroundColor: '#FAFAFA', padding: 8, borderRadius: 4, marginBottom: 8 },
  descLabel: { fontSize: 10, fontWeight: 'bold', color: '#C62828' },
  descText: { fontWeight: 'normal', color: '#333' },
  photoRow: { flexDirection: 'row', alignItems: 'center' },
  photoMock: { width: 40, height: 40, backgroundColor: '#CFD8DC', borderRadius: 4, marginRight: 8, justifyContent: 'flex-end', padding: 2 },
  photoCount: { backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 8, alignSelf: 'flex-start', padding: 2, borderRadius: 2 },
  photoTitle: { fontSize: 10, fontWeight: 'bold' },
  photoSub: { fontSize: 10, color: '#666' },
  summaryBox: { backgroundColor: '#F0F8FF', padding: 16, borderRadius: 8, marginBottom: 16 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  summaryIcon: { fontSize: 16, marginRight: 8 },
  summaryTitle: { fontSize: 12, fontWeight: 'bold', flex: 1 },
  summaryCount: { fontSize: 16, fontWeight: 'bold', color: '#1B5E20' },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { backgroundColor: 'white', padding: 12, borderRadius: 8, flex: 1, marginHorizontal: 4, alignItems: 'center' },
  summaryNumSafe: { fontSize: 20, fontWeight: 'bold', color: '#2E7D32' },
  summaryNumWarn: { fontSize: 20, fontWeight: 'bold', color: '#D84315' },
  summaryNumDanger: { fontSize: 20, fontWeight: 'bold', color: '#666' },
  summaryLabel: { fontSize: 10, fontWeight: 'bold', color: '#333', marginTop: 4, textAlign: 'center' },
  rulesBox: { backgroundColor: '#E8F5E9', padding: 16, borderRadius: 8, marginBottom: 16 },
  rulesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rulesIcon: { fontSize: 16, marginRight: 8, color: '#1B5E20' },
  rulesTitle: { fontSize: 12, fontWeight: 'bold', color: '#1B5E20', flex: 1 },
  rulesBadge: { backgroundColor: '#1B5E20', color: 'white', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  rulesDesc: { fontSize: 10, color: '#333', lineHeight: 16, marginBottom: 12 },
  boldText: { fontWeight: 'bold' },
  rulesStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 8, borderRadius: 8, marginBottom: 12 },
  rulesStatusLabel: { fontSize: 10, color: '#C62828', fontWeight: 'bold' },
  rulesStatusBadge: { backgroundColor: '#FFEBEE', color: '#C62828', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  rulesNote: { fontSize: 10, color: '#666', fontStyle: 'italic' },
  signatureBox: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 24, elevation: 1 },
  signatureHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  signatureIcon: { fontSize: 16, marginRight: 8 },
  signatureTitle: { fontSize: 12, fontWeight: 'bold', flex: 1 },
  signatureBadge: { color: '#2E7D32', fontSize: 10, fontWeight: 'bold' },
  signatureDesc: { fontSize: 10, color: '#666', marginBottom: 12 },
  padMock: { height: 120, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#EEE', position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  padCurve: { width: '80%', height: 40, borderBottomWidth: 2, borderBottomColor: 'black', borderRadius: 20, transform: [{ rotate: '-5deg' }] },
  padDetails: { position: 'absolute', bottom: 8, right: 8, alignItems: 'flex-end' },
  padName: { fontSize: 10, color: '#333' },
  padHash: { fontSize: 10, color: '#666', fontFamily: 'monospace' },
  staffSignRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  staffSignText: { fontSize: 10, color: '#666' },
  staffSignBadge: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  viewPdfBtn: { backgroundColor: '#E3F2FD', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  viewPdfText: { color: '#1565C0', fontSize: 12, fontWeight: 'bold' },
  finishBtn: { backgroundColor: '#1B5E20', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  finishBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  footerNote: { fontSize: 10, color: '#666', textAlign: 'center', marginBottom: 32 },
});
