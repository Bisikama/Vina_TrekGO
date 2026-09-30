import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { DELIVERY_MOCK_DATA } from '../../mockData';

export const EquipmentChecklistFeature = () => {
  const { checklist } = DELIVERY_MOCK_DATA;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerTop}>
        <Text style={styles.backBtn}>←</Text>
        <Text style={styles.headerTitle}>KIỂM TRA THIẾT BỊ</Text>
        <Text style={styles.sosBtn}>SOS</Text>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>📡 Chế độ kiểm tra Offline: Đã sẵn sàng</Text>
        <Text style={styles.gpsFixed}>GPS CỐ ĐỊNH</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.orderHeaderRow}>
          <Text style={styles.orderTag}>ĐƠN GIAO</Text>
          <Text style={styles.orderId}>{checklist.id}</Text>
          <View style={styles.countBadge}><Text style={styles.countText}>☑ 3/4</Text></View>
        </View>

        <View style={styles.customerRow}>
          <Text style={styles.customerIcon}>👤</Text>
          <Text style={styles.customerName}>{checklist.customer}</Text>
          <Text style={styles.tourTag}>Đoàn A5</Text>
          <Text style={styles.approvedText}>THIẾT BỊ DUYỆT</Text>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>TIẾN ĐỘ KIỂM ĐẾM HIỆN TRƯỜNG</Text>
          <Text style={styles.progressVal}>{checklist.progress}</Text>
        </View>
        <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: checklist.progress }]} /></View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>DANH SÁCH THIẾT BỊ BÀN GIAO</Text>
          <Text style={styles.tourTagRight}>Quy chuẩn Camp-A5</Text>
        </View>

        {checklist.items.map((item, idx) => (
          <View key={idx} style={[styles.itemCard, !item.checked && styles.itemCardPending]}>
            <View style={styles.itemHeader}>
              <View style={styles.itemImgMock} />
              <View style={styles.itemInfo}>
                <View style={styles.itemTags}>
                  <Text style={styles.itemNumBadge}>MÓN {item.id}</Text>
                  <Text style={styles.itemCode}>#EQ-XXX</Text>
                </View>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.checked ? (
                  <Text style={styles.itemStatusSafe}>☑ Tình trạng: Bình thường, nguyên vẹn</Text>
                ) : (
                  <Text style={styles.itemStatusWait}>⚠ CHỜ KIỂM TRA</Text>
                )}
              </View>
            </View>

            {item.warning && (
              <Text style={styles.warningSubText}>⚠ {item.warning}</Text>
            )}

            {item.warningText && (
              <View style={styles.warningBox}>
                <Text style={styles.warningBoxTitle}>❗ CẢNH BÁO AN TOÀN KIỂM ĐẾM</Text>
                <Text style={styles.warningBoxDesc}>{item.warningText}</Text>
              </View>
            )}

            <View style={styles.checkRows}>
              <View style={styles.checkRow}>
                <View style={[styles.checkbox, item.checked ? styles.checked : styles.unchecked]}><Text style={styles.checkIcon}>{item.checked ? '✓' : ''}</Text></View>
                <Text style={[styles.checkLabel, !item.checked && styles.labelPending]}>Đã đối chiếu mã barcode/QR thiết bị</Text>
              </View>
              {!item.checked && <Text style={styles.pendingSub}>Chưa quét đối chiếu</Text>}

              {item.note && (
                <View style={styles.checkRow}>
                  <View style={[styles.checkbox, item.checked ? styles.checked : styles.unchecked]}><Text style={styles.checkIcon}>{item.checked ? '✓' : ''}</Text></View>
                  <Text style={[styles.checkLabel, !item.checked && styles.labelPending]}>{item.note}</Text>
                </View>
              )}
              {!item.checked && <Text style={styles.pendingSub}>Chờ khách thao tác</Text>}
            </View>

            {item.hasImage && (
              <View style={styles.imageRow}>
                <View style={styles.imageThumb} />
                <View style={styles.imageInfo}>
                  <Text style={styles.imageTitle}>1 ảnh ghi nhận tình trạng</Text>
                  <Text style={styles.imageSub}>Xước lớp sơn bảo vệ mũi gậy</Text>
                </View>
                <Text style={styles.eyeIcon}>👁</Text>
              </View>
            )}

            {item.scanTime && (
              <View style={styles.scanSuccessBox}>
                <Text style={styles.scanSuccessText}>💠 ĐÃ QUÉT XÁC THỰC THÀNH CÔNG</Text>
                <Text style={styles.scanTimeText}>{item.scanTime} ICT</Text>
              </View>
            )}

            {!item.checked && (
              <View style={styles.actionGroup}>
                <TouchableOpacity style={styles.confirmBtn}><Text style={styles.confirmBtnText}>☑ BẤM XÁC NHẬN MÓN NÀY</Text></TouchableOpacity>
                <TouchableOpacity style={styles.reportBtn}><Text style={styles.reportBtnText}>⚠ GHI NHẬN THIẾT BỊ LỖI / ĐỔI CÁI KHÁC</Text></TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        <View style={styles.supportBox}>
          <View style={styles.supportHeader}>
            <Text style={styles.supportTitle}>HỖ TRỢ GHI NHẬN HIỆN TRƯỜNG</Text>
            <Text style={styles.supportIcon}>📷</Text>
          </View>
          <View style={styles.photoUploadRow}>
            <View style={styles.photoIconBox}><Text style={styles.photoIconText}>📷</Text></View>
            <View style={styles.photoInfoBox}>
              <Text style={styles.photoTitle}>Chụp ảnh tình trạng phát sinh</Text>
              <Text style={styles.photoSub}>Đã lưu: 01 ảnh gậy xước nhẹ</Text>
            </View>
            <Text style={styles.addBtn}>+ Thêm</Text>
          </View>
          <Text style={styles.noteLabel}>Ghi chú bàn giao hiện trường:</Text>
          <View style={styles.noteInputBox}>
            <Text style={styles.noteInputText}>Khách kiểm tra kỹ balo và áo mưa, hài lòng.</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.finalBtn}>
          <Text style={styles.finalBtnText}>☑ XÁC NHẬN DANH SÁCH BÀN GIAO</Text>
        </TouchableOpacity>
        <Text style={styles.finalSubText}>🔒 CẦN XÁC NHẬN ĐỦ 4/4 MÓN HOẶC GHI NHẬN SỰ CỐ ĐỂ HOÀN TẤT</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 16, backgroundColor: 'white' },
  backBtn: { fontSize: 24 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  sosBtn: { backgroundColor: '#FFEBEE', color: '#C62828', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontWeight: 'bold' },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F5F5F5', padding: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  statusText: { color: '#666', fontSize: 10, fontWeight: 'bold' },
  gpsFixed: { backgroundColor: '#1B5E20', color: 'white', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  content: { padding: 16 },
  orderHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  orderTag: { backgroundColor: '#E8F5E9', color: '#2E7D32', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4, marginRight: 8 },
  orderId: { fontSize: 14, fontWeight: 'bold', flex: 1 },
  countBadge: { backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16 },
  countText: { fontSize: 12, fontWeight: 'bold' },
  customerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  customerIcon: { fontSize: 12, marginRight: 4 },
  customerName: { fontSize: 14, fontWeight: 'bold', marginRight: 8 },
  tourTag: { fontSize: 10, color: '#666', marginRight: 'auto' },
  approvedText: { fontSize: 10, fontWeight: 'bold', color: '#666' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 10, fontWeight: 'bold', color: '#666' },
  progressVal: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  progressBarBg: { height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, marginBottom: 24 },
  progressBarFill: { height: '100%', backgroundColor: '#1B5E20', borderRadius: 2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold' },
  tourTagRight: { backgroundColor: '#E3F2FD', color: '#1565C0', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  itemCard: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 16, elevation: 1 },
  itemCardPending: { borderWidth: 2, borderColor: '#FFEBEE' },
  itemHeader: { flexDirection: 'row', marginBottom: 12 },
  itemImgMock: { width: 60, height: 60, backgroundColor: '#CFD8DC', borderRadius: 4, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTags: { flexDirection: 'row', marginBottom: 4 },
  itemNumBadge: { backgroundColor: '#1B5E20', color: 'white', fontSize: 8, fontWeight: 'bold', padding: 2, borderRadius: 4, marginRight: 8 },
  itemCode: { fontSize: 8, color: '#666', fontWeight: 'bold' },
  itemName: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  itemStatusSafe: { fontSize: 10, color: '#2E7D32', fontWeight: 'bold' },
  itemStatusWait: { fontSize: 10, color: '#C62828', fontWeight: 'bold' },
  warningSubText: { fontSize: 10, color: '#D84315', fontWeight: 'bold', marginBottom: 8 },
  warningBox: { backgroundColor: '#FFEBEE', padding: 12, borderRadius: 8, marginBottom: 12 },
  warningBoxTitle: { color: '#C62828', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  warningBoxDesc: { color: '#C62828', fontSize: 10 },
  checkRows: { marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  checkbox: { width: 16, height: 16, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checked: { backgroundColor: '#1B5E20' },
  unchecked: { backgroundColor: '#E3F2FD' },
  checkIcon: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  checkLabel: { fontSize: 12, color: '#333' },
  labelPending: { color: '#1565C0', fontWeight: 'bold' },
  pendingSub: { fontSize: 10, color: '#C62828', marginLeft: 24, marginBottom: 8 },
  imageRow: { flexDirection: 'row', backgroundColor: '#F5F5F5', padding: 8, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  imageThumb: { width: 40, height: 40, backgroundColor: '#CFD8DC', borderRadius: 4, marginRight: 8 },
  imageInfo: { flex: 1 },
  imageTitle: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  imageSub: { fontSize: 10, color: '#666' },
  eyeIcon: { fontSize: 16 },
  scanSuccessBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E0F2F1', padding: 8, borderRadius: 8 },
  scanSuccessText: { color: '#00695C', fontSize: 10, fontWeight: 'bold' },
  scanTimeText: { color: '#00695C', fontSize: 10 },
  actionGroup: { gap: 8 },
  confirmBtn: { backgroundColor: '#1B5E20', padding: 12, borderRadius: 8, alignItems: 'center' },
  confirmBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  reportBtn: { backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, alignItems: 'center' },
  reportBtnText: { color: '#C62828', fontSize: 12, fontWeight: 'bold' },
  supportBox: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 16, elevation: 1 },
  supportHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  supportTitle: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  supportIcon: { fontSize: 16 },
  photoUploadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  photoIconBox: { backgroundColor: '#FFEBEE', padding: 8, borderRadius: 8, marginRight: 12 },
  photoIconText: { fontSize: 16 },
  photoInfoBox: { flex: 1 },
  photoTitle: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  photoSub: { fontSize: 10, color: '#666' },
  addBtn: { backgroundColor: '#E3F2FD', color: '#1565C0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, fontSize: 10, fontWeight: 'bold' },
  noteLabel: { fontSize: 12, color: '#333', marginBottom: 8 },
  noteInputBox: { borderWidth: 1, borderColor: '#EEE', borderRadius: 8, padding: 12 },
  noteInputText: { fontSize: 12, color: '#333' },
  finalBtn: { backgroundColor: '#E0E0E0', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  finalBtnText: { color: '#666', fontSize: 14, fontWeight: 'bold' },
  finalSubText: { color: '#C62828', fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
});
