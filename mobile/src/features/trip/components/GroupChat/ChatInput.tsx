import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

export const ChatInput = () => {
  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>🟢 Mesh P2P Radio: 433MHz Ch.04</Text>
        <Text style={styles.alertText}>🚨 BÁO ĐỘNG KHẨN</Text>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Gửi tin nhắn nội bộ đoàn..."
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.iconBtn}>
          <Text style={styles.icon}>📷</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Text style={styles.icon}>📍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sendBtn}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#1B5E20',
    fontWeight: 'bold',
  },
  alertText: {
    fontSize: 10,
    color: '#C62828',
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  iconBtn: {
    padding: 8,
  },
  icon: {
    fontSize: 18,
  },
  sendBtn: {
    backgroundColor: '#1B5E20',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendIcon: {
    color: 'white',
    fontSize: 14,
  },
});
