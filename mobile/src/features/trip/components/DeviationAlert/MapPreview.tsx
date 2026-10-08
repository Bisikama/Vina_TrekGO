import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const MapPreview = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧭 Bản Đồ Sai Lệch Địa Hình</Text>
        <Text style={styles.scale}>Tỷ lệ 1:2000</Text>
      </View>
      <View style={styles.mapMock}>
        <Text style={styles.mapMockText}>BẢN ĐỒ</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scale: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  mapMock: {
    height: 150,
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
