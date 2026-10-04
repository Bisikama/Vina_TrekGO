import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const RouteOptions = () => {
  const { options } = TRIP_MOCK_DATA.rerouteData;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TUYẾN THAY THẾ KHẢ DỤNG (3 LỰA CHỌN)</Text>
      
      {options.map((opt, idx) => (
        <View key={opt.id} style={[styles.optionCard, opt.recommended && styles.recommendedCard]}>
          <View style={styles.optionHeader}>
            <View style={[styles.radio, opt.recommended && styles.radioSelected]} />
            <Text style={styles.optionName}>{opt.name}</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>CỰ LY / TG</Text>
              <Text style={styles.statValue}>{opt.distance}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ĐỘ DỐC BÙ</Text>
              <Text style={styles.statValue}>{opt.elevation}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>NGUỒN NƯỚC</Text>
              <Text style={styles.statValue}>{opt.water}</Text>
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.confirmBtn}>
        <Text style={styles.confirmText}>✔️ XÁC NHẬN ĐỔI TUYẾN</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  recommendedCard: {
    borderColor: '#2E7D32',
    backgroundColor: '#F1F8E9',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#999',
    marginRight: 12,
  },
  radioSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#4CAF50',
  },
  optionName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  confirmBtn: {
    backgroundColor: '#1B5E20',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
