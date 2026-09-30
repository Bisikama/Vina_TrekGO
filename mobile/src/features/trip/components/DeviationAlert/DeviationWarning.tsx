import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const DeviationWarning = () => {
  const { deviationData } = TRIP_MOCK_DATA;
  return (
    <View style={styles.container}>
      <View style={styles.warningCard}>
        <View style={styles.warningHeader}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>⚠️</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.tag}>CẢNH BÁO LỆCH TUYẾN LỆCH {deviationData.deviationDistance}</Text>
            <Text style={styles.title}>{deviationData.message}</Text>
          </View>
        </View>
        <Text style={styles.description}>{deviationData.description}</Text>
        
        <TouchableOpacity style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>↩ QUAY LẠI TUYẾN CHUẨN Góc 145° Đ-Nam</Text>
        </TouchableOpacity>
        
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>📏 Đường cắt ngắn</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>📻 Bộ đàm Leader Nam</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  warningCard: {
    backgroundColor: '#C62828',
    borderRadius: 12,
    padding: 16,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  headerText: {
    flex: 1,
  },
  tag: {
    color: '#FFCDD2',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  primaryAction: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryActionText: {
    color: '#C62828',
    fontWeight: 'bold',
    fontSize: 14,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
