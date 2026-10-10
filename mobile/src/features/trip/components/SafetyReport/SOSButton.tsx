import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export const SOSButton = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>🚨</Text>
        <View style={styles.titleContainer}>
          <Text style={styles.tag}>KÊNH KHẨN CẤP BÁO CÁO NHẤT</Text>
          <Text style={styles.title}>PHÁT TÍN HIỆU CỨU NẠN KHẨN CẤP</Text>
        </View>
      </View>
      <Text style={styles.desc}>
        Chỉ kích hoạt khi đe dọa tính mạng, chấn thương sọ não, gãy xương hở hoặc lạc đoàn quá 2 giờ trong rừng rậm Fansipan.
      </Text>
      
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>🔒 KHÓA AN TOÀN BẬT</Text>
        <Text style={styles.statusText}>GIỮ 3 GIÂY ĐỂ ĐIỀU ĐỘNG TRỰC THĂNG</Text>
      </View>

      <TouchableOpacity style={styles.sosBtn}>
        <Text style={styles.sosBtnText}>🚨 GIỮ 3S ĐỂ PHÁT SOS TRỰC THĂNG</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#B71C1C',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 32,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  tag: {
    color: '#FFCDD2',
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  desc: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusText: {
    color: '#FFCDD2',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sosBtn: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sosBtnText: {
    color: '#C62828',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
