import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { DELIVERY_MOCK_DATA } from '../../mockData';

export const TaskHistoryFeature = () => {
  const { taskHistory } = DELIVERY_MOCK_DATA;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>TREKOPS DELIVERY</Text>
          <Text style={styles.headerSub}>Lịch Sử Nhiệm Vụ</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.staffHeader}>
            <View>
              <Text style={styles.staffRole}>● BIÊN BẢN THỰC ĐỊA ĐIỂM GIAO</Text>
              <View style={styles.staffNameRow}>
                <Text style={styles.staffIcon}>🧑‍💼</Text>
                <Text style={styles.staffName}>{taskHistory.staff}</Text>
                <Text style={styles.staffIdBadge}>ID: {taskHistory.id}</Text>
              </View>
            </View>
            <View style={styles.networkStatus}>
              <Text style={styles.networkLabel}>TRẠNG THÁI MẠNG</Text>
              <Text style={styles.networkOnline}>☁ ONLINE</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <View style={styles.statHeader}><Text style={styles.statIconSafe}>✓</Text><Text style={styles.statLabel}> HOÀN TẤT</Text></View>
              <Text style={styles.statValue}>{taskHistory.stats.total}</Text>
              <Text style={styles.statSub}>Đơn tuần này</Text>
            </View>
            <View style={styles.statBoxWarn}>
              <View style={styles.statHeader}><Text style={styles.statIconWarn}>⚠</Text><Text style={styles.statLabelWarn}> GHI CHÚ</Text></View>
              <Text style={styles.statValueWarn}>0{taskHistory.stats.issues}</Text>
              <Text style={styles.statSubWarn}>Sự cố thiết bị</Text>
            </View>
            <View style={styles.statBox}>
              <View style={styles.statHeader}><Text style={styles.statIconSync}>🔄</Text><Text style={styles.statLabel}> ĐỒNG BỘ</Text></View>
              <Text style={styles.statValueSync}>{taskHistory.stats.sync}</Text>
              <Text style={styles.statSub}>Máy chủ Hub</Text>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput style={styles.searchInput} placeholder="Tìm theo mã đơn (#BK-...), tên khách..." />
            <Text style={styles.scanIcon}>[ ]</Text>
          </View>

          <View style={styles.timeFilter}>
            <View style={styles.timeTab}><Text style={styles.timeTabText}>Hôm nay <Text style={styles.badge}>4</Text></Text></View>
            <View style={styles.timeTabActive}><Text style={styles.timeTabActiveText}>Tuần này <Text style={styles.badgeActive}>16</Text></Text></View>
            <View style={styles.timeTab}><Text style={styles.timeTabText}>Tất cả <Text style={styles.badge}>142</Text></Text></View>
          </View>

          <View style={styles.typeFilter}>
            <View style={styles.typeTabActive}><Text style={styles.typeTabActiveText}>Tất cả loại</Text></View>
            <View style={styles.typeTab}><Text style={styles.typeTabText}>☑ Chỉ Bàn giao (10)</Text></View>
            <View style={styles.typeTab}><Text style={styles.typeTabText}>☑ Chỉ Thu hồi (6)</Text></View>
          </View>

          {taskHistory.history.map((item, idx) => (
            <View key={idx} style={[styles.taskCard, item.danger ? styles.taskCardDanger : item.type.includes('THU HỒI') ? styles.taskCardInfo : styles.taskCardSuccess]}>
              <View style={styles.taskHeader}>
                <View style={styles.taskTypeRow}>
                  <View style={[styles.taskTypeIconBox, item.danger ? styles.taskTypeIconBoxDanger : item.type.includes('THU HỒI') ? styles.taskTypeIconBoxInfo : styles.taskTypeIconBoxSuccess]}>
                    <Text style={styles.taskTypeIcon}>{item.type.includes('BÀN GIAO') ? '🚚' : '📥'}</Text>
                  </View>
                  <View>
                    <Text style={[styles.taskType, item.danger ? styles.taskTypeDanger : item.type.includes('THU HỒI') ? styles.taskTypeInfo : styles.taskTypeSuccess]}>{item.type}</Text>
                    <Text style={styles.taskId}>{item.id}</Text>
                  </View>
                </View>
                <View style={styles.taskTimeBox}>
                  <Text style={[styles.taskTime, item.danger && styles.taskTimeDanger]}>{item.time.split(',')[0]}</Text>
                  <Text style={styles.taskLocSub}>{item.time.split(',')[1] || item.loc.split(' — ')[1] || item.loc}</Text>
                </View>
              </View>

              <View style={styles.taskBody}>
                <View style={styles.customerRow}>
                  <Text style={styles.customerIcon}>🧑</Text>
                  <Text style={styles.taskCustomer}>{item.customer}</Text>
                  {item.phone && <Text style={styles.taskPhone}>📞 {item.phone}</Text>}
                </View>
                <View style={styles.locRow}>
                  <Text style={styles.locIcon}>📍</Text>
                  <Text style={styles.taskLoc}>{item.loc}</Text>
                </View>
              </View>

              <View style={styles.eqBox}>
                <Text style={styles.eqLabel}>{item.type.includes('BÀN GIAO') ? 'THIẾT BỊ KIỂM KÊ THỰC NHẬN:' : 'THIẾT BỊ THU GỌN:'}</Text>
                <View style={styles.eqTags}>
                  {item.items.split(', ').map((eq, i) => (
                    <View key={i} style={styles.eqTag}><Text style={styles.eqTagText}>{eq}</Text></View>
                  ))}
                </View>
              </View>

              <View style={styles.taskFooter}>
                {item.danger ? (
                  <View style={styles.dangerBox}>
                    <Text style={styles.dangerTitle}>⚑ {item.status}</Text>
                    <Text style={styles.dangerDesc}>Đã chụp 03 ảnh hiện trạng: Bếp móp cụm van áp suất do va chạm đá. Tạm giữ cọc chờ Staff Inventory Web thẩm định.</Text>
                  </View>
                ) : (
                  <View style={styles.successRow}>
                    <View style={styles.statusBadgeSafe}><Text style={styles.statusSafeText}>✓ {item.status}</Text></View>
                    <Text style={styles.syncId}>{item.type.includes('BÀN GIAO') ? '#HAND-9024-OK' : '#RET-8790-OK'}</Text>
                  </View>
                )}
                
                <TouchableOpacity style={[styles.viewBtn, item.danger && styles.viewBtnDanger]}>
                  <Text style={[styles.viewBtnText, item.danger && styles.viewBtnTextDanger]}>📄 Xem chi tiết biên bản {item.danger && 'ghi nhận'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  container: { flex: 1 },
  headerTop: { padding: 16, paddingTop: 16, backgroundColor: 'white' },
  headerTitle: { fontSize: 10, fontWeight: 'bold', color: '#1B5E20' },
  headerSub: { fontSize: 18, fontWeight: 'bold' },
  content: { padding: 16 },
  staffHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  staffRole: { fontSize: 10, color: '#1B5E20', fontWeight: 'bold', marginBottom: 4 },
  staffNameRow: { flexDirection: 'row', alignItems: 'center' },
  staffIcon: { fontSize: 16, marginRight: 8 },
  staffName: { fontSize: 14, fontWeight: 'bold', marginRight: 8 },
  staffIdBadge: { backgroundColor: '#E3F2FD', color: '#1565C0', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  networkStatus: { alignItems: 'flex-end' },
  networkLabel: { fontSize: 8, color: '#666', fontWeight: 'bold', marginBottom: 2 },
  networkOnline: { fontSize: 10, color: '#2E7D32', fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
  statBoxWarn: { flex: 1, backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FFE0B2' },
  statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statIconSafe: { color: '#2E7D32', fontSize: 12 },
  statIconWarn: { color: '#D84315', fontSize: 12 },
  statIconSync: { color: '#1565C0', fontSize: 12 },
  statLabel: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  statLabelWarn: { fontSize: 10, fontWeight: 'bold', color: '#D84315' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  statValueWarn: { fontSize: 20, fontWeight: 'bold', color: '#D84315' },
  statValueSync: { fontSize: 20, fontWeight: 'bold', color: '#1565C0' },
  statSub: { fontSize: 10, color: '#666' },
  statSubWarn: { fontSize: 10, color: '#D84315' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', marginBottom: 16 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, height: 40, fontSize: 12 },
  scanIcon: { fontSize: 16, color: '#666' },
  timeFilter: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  timeTab: { flex: 1, backgroundColor: '#E3F2FD', paddingVertical: 8, borderRadius: 4, alignItems: 'center' },
  timeTabActive: { flex: 1, backgroundColor: '#1B5E20', paddingVertical: 8, borderRadius: 4, alignItems: 'center' },
  timeTabText: { fontSize: 10, color: '#1565C0', fontWeight: 'bold' },
  timeTabActiveText: { fontSize: 10, color: 'white', fontWeight: 'bold' },
  badge: { backgroundColor: '#BBDEFB', color: '#1565C0', paddingHorizontal: 4, borderRadius: 8 },
  badgeActive: { backgroundColor: '#4CAF50', color: 'white', paddingHorizontal: 4, borderRadius: 8 },
  typeFilter: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeTabActive: { backgroundColor: '#1B5E20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  typeTabActiveText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  typeTab: { backgroundColor: '#F5F5F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  typeTabText: { color: '#333', fontSize: 10 },
  taskCard: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 12, elevation: 1, borderLeftWidth: 4 },
  taskCardSuccess: { borderLeftColor: '#2E7D32' },
  taskCardInfo: { borderLeftColor: '#1565C0' },
  taskCardDanger: { borderLeftColor: '#D84315' },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  taskTypeRow: { flexDirection: 'row', alignItems: 'center' },
  taskTypeIconBox: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  taskTypeIconBoxSuccess: { backgroundColor: '#E8F5E9' },
  taskTypeIconBoxInfo: { backgroundColor: '#E3F2FD' },
  taskTypeIconBoxDanger: { backgroundColor: '#FBE9E7' },
  taskTypeIcon: { fontSize: 16 },
  taskType: { fontSize: 10, fontWeight: 'bold' },
  taskTypeSuccess: { color: '#2E7D32' },
  taskTypeInfo: { color: '#1565C0' },
  taskTypeDanger: { color: '#D84315' },
  taskId: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  taskTimeBox: { alignItems: 'flex-end' },
  taskTime: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  taskTimeDanger: { color: '#D84315' },
  taskLocSub: { fontSize: 10, color: '#666' },
  taskBody: { marginBottom: 12 },
  customerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  customerIcon: { fontSize: 12, marginRight: 8 },
  taskCustomer: { fontSize: 12, fontWeight: 'bold', marginRight: 12 },
  taskPhone: { fontSize: 10, color: '#2E7D32', fontWeight: 'bold' },
  locRow: { flexDirection: 'row', alignItems: 'center' },
  locIcon: { fontSize: 12, marginRight: 8, color: '#D84315' },
  taskLoc: { fontSize: 10, color: '#666' },
  eqBox: { marginBottom: 12 },
  eqLabel: { fontSize: 10, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  eqTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  eqTag: { backgroundColor: '#E3F2FD', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  eqTagText: { fontSize: 10, color: '#1565C0' },
  taskFooter: { borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 12 },
  successRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadgeSafe: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusSafeText: { color: '#2E7D32', fontSize: 10, fontWeight: 'bold' },
  syncId: { fontSize: 8, color: '#666', fontFamily: 'monospace' },
  dangerBox: { backgroundColor: '#FBE9E7', padding: 12, borderRadius: 8, marginBottom: 12 },
  dangerTitle: { color: '#D84315', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  dangerDesc: { color: '#D84315', fontSize: 10 },
  viewBtn: { backgroundColor: '#E3F2FD', paddingVertical: 12, borderRadius: 4, alignItems: 'center' },
  viewBtnDanger: { backgroundColor: '#D84315' },
  viewBtnText: { color: '#1565C0', fontSize: 10, fontWeight: 'bold' },
  viewBtnTextDanger: { color: 'white' },
});
