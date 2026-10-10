import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const StatsGrid = () => {
  const { stats } = TRIP_MOCK_DATA.deviationData;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>⏱ Chỉ Số Di Chuyển Thực Địa</Text>
      <View style={styles.grid}>
        <View style={styles.statBox}>
          <Text style={styles.label}>THỜI GIAN GHI</Text>
          <Text style={styles.value}>{stats.time} <Text style={styles.unit}>giờ:phút</Text></Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.label}>QUÃNG ĐƯỜNG</Text>
          <Text style={styles.value}>{stats.distance} <Text style={styles.unit}>km</Text></Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.label}>TỐC ĐỘ VẬN ĐỘNG</Text>
          <Text style={styles.value}>{stats.speed} <Text style={styles.unit}>km/h</Text></Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.label}>ĐỘ CAO HIỆN TẠI</Text>
          <Text style={styles.value}>{stats.elevation} <Text style={styles.unit}>m</Text></Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
  },
  label: {
    fontSize: 10,
    color: '#666',
    marginBottom: 8,
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
  },
});
