import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { DELIVERY_MOCK_DATA } from '../../mockData';

export const TaskListFeature = () => {
  const { staff, taskStats, tasks } = DELIVERY_MOCK_DATA;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>🚚</Text>
          </View>
          <View style={styles.headerTitleBox}>
            <Text style={styles.brandText}>VINA_TREKGO</Text>
            <Text style={styles.roleText}>STAFF DELIVERY</Text>
          </View>
          <View style={styles.rightBadges}>
            <Text style={styles.gpsBadge}>📍 GPS ON</Text>
            <Text style={styles.syncBadge}>● SYNC</Text>
          </View>
        </View>
        <View style={styles.offlineBox}>
          <Text style={styles.offlineText}>☁️ Offline-Ready: Dữ liệu đã lưu máy</Text>
          <Text style={styles.readyBadge}>100% SẴN SÀNG</Text>
        </View>
      </View>

      <View style={styles.staffCard}>
        <View style={styles.staffInfo}>
          <View style={styles.avatar} />
          <View>
            <Text style={styles.staffName}>{staff.name} <Text style={styles.checkIcon}>☑️</Text></Text>
            <Text style={styles.staffRole}>{staff.role}</Text>
          </View>
          <View style={styles.onlineBadge}>
            <Text style={styles.onlineText}>● TRỰC TUYẾN</Text>
          </View>
        </View>
        <View style={styles.shiftRow}>
          <Text style={styles.shiftItem}>⏱ CA LÀM VIỆC: {staff.shift}</Text>
          <Text style={styles.shiftItem}>🏪 ĐIỂM ĐIỀU PHỐI: {staff.location}</Text>
        </View>
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>CHỈ SỐ NHIỆM VỤ CA NÀY</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>02</Text>
            <Text style={styles.statLabel}>Chờ tiếp nhận</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumWarn}>03</Text>
            <Text style={styles.statLabel}>Đang giao đèo</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>04</Text>
            <Text style={styles.statLabel}>Chờ thu hồi</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumSafe}>05</Text>
            <Text style={styles.statLabel}>Đã xong tốt</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        <View style={[styles.tab, styles.activeTab]}>
          <Text style={styles.activeTabText}>Tất cả (14)</Text>
        </View>
        <View style={styles.tab}><Text style={styles.tabText}>Giao thiết bị (5)</Text></View>
        <View style={styles.tab}><Text style={styles.tabText}>Thu hồi (4)</Text></View>
      </ScrollView>

      <View style={styles.taskList}>
        {tasks.map((task, idx) => (
          <View key={idx} style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <View style={styles.taskTags}>
                <Text style={styles.typeTag}>{task.type}</Text>
                {task.urgent && <Text style={styles.urgentTag}>🚨 GẤP (XUẤT PHÁT 06:30)</Text>}
              </View>
              <Text style={styles.taskId}>{task.id}</Text>
            </View>
            
            <View style={styles.customerRow}>
              <Text style={styles.customerName}>{task.customerName}</Text>
              {task.phone && <View style={styles.phoneBadge}><Text style={styles.phoneText}>📞 {task.phone}</Text></View>}
            </View>
            <Text style={styles.tourName}>🧗 {task.tour}</Text>

            <View style={styles.locationBox}>
              <Text style={styles.locationTitle}>📍 {task.location} {task.distance && <Text style={styles.distBadge}>{task.distance}</Text>}</Text>
              <Text style={styles.locationDesc}>{task.desc}</Text>
            </View>

            <View style={styles.timeEqRow}>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>⏱ GIỜ HẸN</Text>
                <Text style={styles.timeValue}>{task.time}</Text>
              </View>
              <View style={styles.eqBox}>
                <Text style={styles.eqLabel}>📦 KIỂM ĐẾM</Text>
                <Text style={styles.eqValue}>{task.equipmentCount} Thiết bị</Text>
              </View>
            </View>

            {task.items && <Text style={styles.itemsList}>📋 {task.items}</Text>}
            {task.status && <Text style={styles.statusWait}>⏳ {task.status}</Text>}

            {!task.status && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.navBtn}><Text style={styles.navText}>🗺️ Chỉ đường</Text></TouchableOpacity>
                <TouchableOpacity style={styles.mainBtn}><Text style={styles.mainBtnText}>BẮT ĐẦU BÀN GIAO ➔</Text></TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#1B5E20', padding: 16, paddingTop: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoBox: { backgroundColor: 'white', padding: 8, borderRadius: 8, marginRight: 12 },
  logoText: { fontSize: 20 },
  headerTitleBox: { flex: 1 },
  brandText: { color: '#A5D6A7', fontSize: 10, fontWeight: 'bold' },
  roleText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  rightBadges: { flexDirection: 'row' },
  gpsBadge: { backgroundColor: '#E3F2FD', color: '#1565C0', fontSize: 10, padding: 4, borderRadius: 4, marginRight: 4, fontWeight: 'bold' },
  syncBadge: { backgroundColor: '#C8E6C9', color: '#1B5E20', fontSize: 10, padding: 4, borderRadius: 4, fontWeight: 'bold' },
  offlineBox: { backgroundColor: '#E8F5E9', flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderRadius: 4 },
  offlineText: { color: '#2E7D32', fontSize: 10, fontWeight: 'bold' },
  readyBadge: { backgroundColor: '#4CAF50', color: 'white', fontSize: 10, paddingHorizontal: 4, borderRadius: 4, fontWeight: 'bold' },
  staffCard: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 8, elevation: 2 },
  staffInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0E0E0', marginRight: 12 },
  staffName: { fontWeight: 'bold', fontSize: 16 },
  checkIcon: { color: '#4CAF50' },
  staffRole: { fontSize: 10, color: '#666' },
  onlineBadge: { marginLeft: 'auto', backgroundColor: '#E8F5E9', padding: 4, borderRadius: 12 },
  onlineText: { color: '#2E7D32', fontSize: 10, fontWeight: 'bold' },
  shiftRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 12 },
  shiftItem: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  statsSection: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 8 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { backgroundColor: 'white', padding: 12, borderRadius: 8, flex: 1, marginHorizontal: 4, alignItems: 'center', elevation: 1 },
  statNum: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  statNumWarn: { fontSize: 20, fontWeight: 'bold', color: '#D84315' },
  statNumSafe: { fontSize: 20, fontWeight: 'bold', color: '#2E7D32' },
  statLabel: { fontSize: 10, color: '#666', marginTop: 4, textAlign: 'center' },
  tabs: { paddingHorizontal: 16, marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E0E0E0', marginRight: 8 },
  activeTab: { backgroundColor: '#1B5E20' },
  activeTabText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  tabText: { color: '#666', fontSize: 12 },
  taskList: { paddingHorizontal: 16 },
  taskCard: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 16, elevation: 2 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  taskTags: { flexDirection: 'row' },
  typeTag: { backgroundColor: '#E8F5E9', color: '#2E7D32', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4, marginRight: 4 },
  urgentTag: { backgroundColor: '#FFEBEE', color: '#C62828', fontSize: 10, fontWeight: 'bold', padding: 4, borderRadius: 4 },
  taskId: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  customerName: { fontSize: 18, fontWeight: 'bold' },
  phoneBadge: { backgroundColor: '#E3F2FD', padding: 4, borderRadius: 4 },
  phoneText: { color: '#1565C0', fontSize: 10, fontWeight: 'bold' },
  tourName: { fontSize: 12, color: '#666', marginBottom: 12 },
  locationBox: { backgroundColor: '#F9F9F9', padding: 12, borderRadius: 8, marginBottom: 12 },
  locationTitle: { fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  distBadge: { backgroundColor: '#D84315', color: 'white', fontSize: 8, padding: 2, borderRadius: 4 },
  locationDesc: { fontSize: 10, color: '#666' },
  timeEqRow: { flexDirection: 'row', marginBottom: 12 },
  timeBox: { flex: 1, borderRightWidth: 1, borderRightColor: '#EEE' },
  timeLabel: { fontSize: 10, color: '#666', marginBottom: 2 },
  timeValue: { fontSize: 12, fontWeight: 'bold', color: '#D84315' },
  eqBox: { flex: 1, paddingLeft: 12 },
  eqLabel: { fontSize: 10, color: '#666', marginBottom: 2 },
  eqValue: { fontSize: 12, fontWeight: 'bold' },
  itemsList: { fontSize: 10, color: '#666', backgroundColor: '#F5F5F5', padding: 8, borderRadius: 4, marginBottom: 12 },
  statusWait: { fontSize: 10, color: '#666', backgroundColor: '#F5F5F5', padding: 8, borderRadius: 4 },
  actionRow: { flexDirection: 'row', gap: 8 },
  navBtn: { flex: 1, backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, alignItems: 'center' },
  navText: { color: '#1565C0', fontWeight: 'bold' },
  mainBtn: { flex: 2, backgroundColor: '#1B5E20', padding: 12, borderRadius: 8, alignItems: 'center' },
  mainBtnText: { color: 'white', fontWeight: 'bold' },
});
