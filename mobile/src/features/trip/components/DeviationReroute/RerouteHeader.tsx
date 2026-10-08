import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const RerouteHeader = () => {
  return (
    <View style={styles.container}>
      <View style={styles.topInfo}>
        <Text style={styles.title}>Cảnh Báo Lệch Tuyến</Text>
        <Text style={styles.subtitle}>21°34'N 103°36'E</Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.gpsLock}>🟢 GPS KHÓA CHUẨN XÁC</Text>
        <Text style={styles.cacheCount}>11.5204° N, 108.5412° E</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    padding: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  topInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 4,
  },
  gpsLock: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  cacheCount: {
    fontSize: 12,
    color: '#666',
  },
});
