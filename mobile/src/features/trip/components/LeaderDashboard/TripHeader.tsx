import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const TripHeader = () => {
  return (
    <View style={styles.container}>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}># {TRIP_MOCK_DATA.tripId}</Text>
        </View>
        <Text style={styles.timeText}>{TRIP_MOCK_DATA.startTime}</Text>
      </View>
      <Text style={styles.title}>{TRIP_MOCK_DATA.tripName}</Text>
      <Text style={styles.location}>📍 {TRIP_MOCK_DATA.location}</Text>
      <Text style={styles.leader}>TRƯỞNG ĐOÀN: {TRIP_MOCK_DATA.leader}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#F0F4F8',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#1B5E20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 12,
    color: '#555',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  leader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
  },
});
