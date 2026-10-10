import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const SummaryHeader = () => {
  const { summaryData } = TRIP_MOCK_DATA;
  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>MÃ TOUR: #TG-8924-VN</Text>
        </View>
        <Text style={styles.timeText}>🕒 18:30 • 20/11/2024</Text>
      </View>
      <Text style={styles.title}>{summaryData.title}</Text>
      
      <View style={styles.statusBox}>
        <Text style={styles.statusText}>{summaryData.status}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 16,
    backgroundColor: '#1B5E20',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#388E3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  timeText: {
    color: 'white',
    fontSize: 10,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statusBox: {
    backgroundColor: '#2E7D32',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
