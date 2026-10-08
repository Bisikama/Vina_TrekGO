import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const SummaryList = () => {
  const { summaryData } = TRIP_MOCK_DATA;
  
  return (
    <View style={styles.container}>
      {/* Item 1 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>1. BÁO CÁO QUÂN SỐ & HẠ SƠN</Text>
          <View style={styles.badgeSafe}><Text style={styles.badgeSafeText}>100% AN TOÀN</Text></View>
        </View>
        <View style={styles.attendanceGrid}>
          <View style={styles.attItem}><Text style={styles.attLabel}>Đăng ký</Text><Text style={styles.attVal}>12</Text></View>
          <View style={styles.attItem}><Text style={styles.attLabel}>Xuất phát</Text><Text style={styles.attVal}>12</Text></View>
          <View style={styles.attItem}><Text style={styles.attLabel}>Chạm đỉnh</Text><Text style={styles.attVal}>12</Text></View>
          <View style={[styles.attItem, styles.attItemDark]}><Text style={styles.attLabelDark}>Về Hub</Text><Text style={styles.attValDark}>12</Text></View>
        </View>
        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>🚑 LƯU TÂM Y TẾ NHẸ:</Text>
          <Text style={styles.noteDesc}>{summaryData.attendance.note}</Text>
        </View>
      </View>

      {/* Item 2 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>2. NHẬT KÝ TRẠM DỪNG THỰC TẾ</Text>
        </View>
        {summaryData.checkpoints.map((cp, idx) => (
          <View key={cp.id} style={styles.cpRow}>
            <View style={[styles.cpNum, cp.warning && styles.cpNumWarn]}>
              <Text style={styles.cpNumText}>{cp.id}</Text>
            </View>
            <View style={styles.cpInfo}>
              <View style={styles.cpHeader}>
                <Text style={styles.cpName}>{cp.name}</Text>
                <Text style={[styles.cpTime, cp.warning && styles.cpTimeWarn]}>{cp.time}</Text>
              </View>
              <Text style={styles.cpSub}>{cp.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Item 3 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>3. GIÁM SÁT GPS & SAI LỆCH</Text>
        </View>
        <View style={styles.gpsGrid}>
          <View style={styles.gpsBox}>
            <Text style={styles.gpsLabel}>Tổng cự ly đi:</Text>
            <Text style={styles.gpsVal}>{summaryData.gps.distance}</Text>
            <Text style={styles.gpsSub}>Sai lệch: {summaryData.gps.deviation}</Text>
          </View>
          <View style={styles.gpsBox}>
            <Text style={styles.gpsLabel}>Độ cao tích lũy:</Text>
            <Text style={styles.gpsVal}>{summaryData.gps.elevation}</Text>
            <Text style={styles.gpsSub}>Độ dốc TB: {summaryData.gps.incline}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.submitBtn}>
        <Text style={styles.submitText}>➤ GỬI BÁO CÁO TỔNG KẾT</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
  },
  badgeSafe: {
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeSafeText: {
    color: '#1B5E20',
    fontSize: 10,
    fontWeight: 'bold',
  },
  attendanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  attItem: {
    alignItems: 'center',
  },
  attLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  attVal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  attItemDark: {
    backgroundColor: '#1B5E20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    justifyContent: 'center',
  },
  attLabelDark: {
    fontSize: 10,
    color: 'white',
    marginBottom: 4,
  },
  attValDark: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  noteBox: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 4,
  },
  noteDesc: {
    fontSize: 12,
    color: '#BF360C',
    lineHeight: 18,
  },
  cpRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  cpNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1B5E20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cpNumWarn: {
    backgroundColor: '#FF7043',
  },
  cpNumText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cpInfo: {
    flex: 1,
  },
  cpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cpName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  cpTime: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  cpTimeWarn: {
    color: '#D84315',
  },
  cpSub: {
    fontSize: 12,
    color: '#666',
  },
  gpsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gpsBox: {
    flex: 1,
  },
  gpsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  gpsVal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  gpsSub: {
    fontSize: 10,
    color: '#D84315',
  },
  submitBtn: {
    backgroundColor: '#1B5E20',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  submitText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
