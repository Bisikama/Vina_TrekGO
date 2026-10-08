import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const CheckpointHeader = () => {
  const { checkpointData } = TRIP_MOCK_DATA;
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>TRẠM KIỂM SOÁT {checkpointData.id}</Text>
        </View>
        <Text style={styles.progress}>🚩 Tiến độ: {checkpointData.status}</Text>
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{checkpointData.name}</Text>
        <Text style={styles.ref}>VFRS-REF: 103.6°E</Text>
      </View>
      <View style={styles.imageMock}>
        <Text style={styles.imageText}>CỘT MỐC THỰC ĐỊA CHUẨN VFRS</Text>
        <Text style={styles.imageSub}>Cột mốc gỗ gắn phiến đồng định danh tọa độ tại tâm Đồi Cỏ.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 16,
    backgroundColor: 'white',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#1B5E20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  progress: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  ref: {
    fontSize: 12,
    color: '#666',
  },
  imageMock: {
    height: 150,
    backgroundColor: '#263238',
    borderRadius: 12,
    justifyContent: 'flex-end',
    padding: 16,
  },
  imageText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  imageSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
});
