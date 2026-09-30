import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const CheckInProgress = () => {
  const { checkIn } = TRIP_MOCK_DATA;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>TIẾN TRÌNH TẬP KẾT</Text>
          <Text style={styles.mainCount}>
            {checkIn.checkedIn}/{checkIn.total} <Text style={styles.subText}>Đã Check-in ({checkIn.percentage}%)</Text>
          </Text>
        </View>
        <View style={styles.percentageBadge}>
          <Text style={styles.percentageText}>{checkIn.percentage}%</Text>
        </View>
      </View>
      
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${checkIn.percentage}%` }]} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#2E7D32' }]}>{checkIn.valid}</Text>
          <Text style={styles.statLabel}>HỢP LỆ</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#E65100' }]}>{checkIn.equipmentCheck}</Text>
          <Text style={styles.statLabel}>KIỂM TRA CỤ</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#C62828' }]}>{checkIn.notArrived}</Text>
          <Text style={styles.statLabel}>CHƯA TỚI</Text>
        </View>
      </View>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>⏳ CHỜ STAFF DUYỆT XUẤT BẾN - Quy chế VFRS</Text>
        <Text style={styles.warningSub}>Phụ trách: Trần Minh Quân (Trưởng Hub)</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  mainCount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#666',
  },
  percentageBadge: {
    backgroundColor: '#C8E6C9',
    padding: 8,
    borderRadius: 8,
  },
  percentageText: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 16,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#2E7D32',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 4,
  },
  warningText: {
    color: '#E65100',
    fontWeight: 'bold',
    fontSize: 12,
  },
  warningSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});
