import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const SummaryStats = () => {
  const { stats } = TRIP_MOCK_DATA.summaryData;
  return (
    <View style={styles.container}>
      <View style={styles.statBox}>
        <Text style={styles.statValue}>{stats.records}</Text>
        <Text style={styles.statLabel}>Hồ sơ đủ</Text>
      </View>
      <View style={[styles.statBox, styles.statCenter]}>
        <Text style={styles.statValue}>{stats.accidents}</Text>
        <Text style={styles.statLabel}>Tai nạn lớn</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statValue}>{stats.equipment}</Text>
        <Text style={styles.statLabel}>Thiết bị Hub</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#EEE',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
});
