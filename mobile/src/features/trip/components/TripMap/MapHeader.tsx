import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const MapHeader = () => {
  const { mapData } = TRIP_MOCK_DATA;
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.statusBadge}>
          <View style={styles.dot} />
          <Text style={styles.statusText}>ĐANG DIỄN RA • NGÀY 1</Text>
        </View>
        <View style={styles.sosButton}>
          <Text style={styles.sosText}>SOS (GIỮ 3S)</Text>
        </View>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.location}>📍 {mapData.currentCheckpoint}</Text>
        <View style={styles.safeBadge}>
          <Text style={styles.safeText}>👥 {mapData.safeCount}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#2c3e50',
    paddingTop: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sosButton: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sosText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  location: {
    color: 'white',
    fontSize: 14,
  },
  safeBadge: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  safeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
