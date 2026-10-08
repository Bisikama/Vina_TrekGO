import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const RerouteWarning = () => {
  const { rerouteData } = TRIP_MOCK_DATA;
  return (
    <View style={styles.container}>
      <View style={styles.warningCard}>
        <View style={styles.headerRow}>
          <Text style={styles.icon}>⚠️</Text>
          <View style={styles.titleContainer}>
            <Text style={styles.tag}>CẢNH BÁO LỆCH TUYẾN</Text>
            <Text style={styles.title}>{rerouteData.message}</Text>
          </View>
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>+{rerouteData.deviationDistance}</Text>
          </View>
        </View>
        <Text style={styles.reason}><Text style={styles.boldReason}>Nguy cơ thực địa:</Text> {rerouteData.reason}</Text>
      </View>
      
      <View style={styles.mapMock}>
        <Text style={styles.mapMockText}>RADAR TÁC CHIẾN TUYẾN ĐƯỜNG</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  warningCard: {
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  tag: {
    color: '#C62828',
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    color: '#B71C1C',
    fontSize: 16,
    fontWeight: 'bold',
  },
  distanceBadge: {
    backgroundColor: '#C62828',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  distanceText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  reason: {
    color: '#D32F2F',
    fontSize: 12,
    lineHeight: 18,
  },
  boldReason: {
    fontWeight: 'bold',
  },
  mapMock: {
    height: 180,
    backgroundColor: '#CFD8DC',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMockText: {
    color: '#78909C',
    fontWeight: 'bold',
  },
});
