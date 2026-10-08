import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const LocationStatus = () => {
  const { checkpointData } = TRIP_MOCK_DATA;
  return (
    <View style={styles.container}>
      <View style={styles.statusBox}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusIcon}>🛰️</Text>
          <View>
            <Text style={styles.statusTitle}>HỢP LỆ ĐỊNH VỊ</Text>
            <Text style={styles.statusValue}>{checkpointData.locationStatus}</Text>
          </View>
          <View style={styles.validBadge}>
            <Text style={styles.validText}>TRONG BÁN KÍNH</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Khoảng cách hiện tại</Text>
            <Text style={styles.progressValue}>12m / Tối đa 50m</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '24%' }]} />
          </View>
          <View style={styles.progressFooter}>
            <Text style={styles.progressLimit}>0m (Tâm mốc)</Text>
            <Text style={styles.progressLimit}>Ngưỡng quét 50m</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>SAI SỐ GPS</Text>
            <Text style={styles.statValue}>{checkpointData.gpsAccuracy}</Text>
            <Text style={styles.statSub}>Tín hiệu cực tốt</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>BÁN KÍNH CHUẨN</Text>
            <Text style={styles.statValue}>{checkpointData.radius}</Text>
            <Text style={styles.statSub}>Đạt điều kiện</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>CHẠM MỐC LÚC</Text>
            <Text style={styles.statValue}>{checkpointData.time}</Text>
            <Text style={styles.statSub}>Ngày thứ 2</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  statusBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  statusTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  validBadge: {
    marginLeft: 'auto',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  validText: {
    color: '#1B5E20',
    fontSize: 10,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
  },
  progressValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: 6,
    backgroundColor: '#2E7D32',
    borderRadius: 3,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLimit: {
    fontSize: 10,
    color: '#999',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statSub: {
    fontSize: 10,
    color: '#2E7D32',
  },
});
