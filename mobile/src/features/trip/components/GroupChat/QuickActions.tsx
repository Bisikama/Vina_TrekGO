import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const QuickActions = () => {
  const { groupChatData } = TRIP_MOCK_DATA;
  return (
    <View style={styles.container}>
      <View style={styles.pinnedBox}>
        <View style={styles.pinHeader}>
          <Text style={styles.pinIcon}>📢</Text>
          <View style={styles.pinTitleBox}>
            <Text style={styles.pinTag}>GHIM KHẨN CẤP</Text>
            <Text style={styles.pinSender}>{groupChatData.pinnedMessage.sender}</Text>
          </View>
          <Text style={styles.pinTime}>{groupChatData.pinnedMessage.time}</Text>
        </View>
        <Text style={styles.pinContent}>{groupChatData.pinnedMessage.content}</Text>
      </View>

      <View style={styles.actionHeader}>
        <Text style={styles.actionTitle}>⚡ BÁO CÁO NHANH 1 CHẠM</Text>
        <Text style={styles.actionSub}>Cập nhật tức thì</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {groupChatData.quickActions.map((action, index) => (
          <TouchableOpacity key={index} style={styles.actionBtn}>
            <Text style={styles.actionText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.radarBox}>
        <Text style={styles.radarText}>🌧️ <Text style={styles.radarBold}>Cảnh báo Radar:</Text> {groupChatData.radarWarning.split(': ')[1]}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  pinnedBox: {
    backgroundColor: '#FF8A65',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pinIcon: {
    marginRight: 8,
  },
  pinTitleBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinTag: {
    backgroundColor: '#D84315',
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  pinSender: {
    color: '#3E2723',
    fontWeight: 'bold',
    fontSize: 12,
  },
  pinTime: {
    color: '#5D4037',
    fontSize: 10,
  },
  pinContent: {
    color: '#3E2723',
    fontSize: 12,
    lineHeight: 18,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
  },
  actionSub: {
    fontSize: 10,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  scroll: {
    marginBottom: 12,
  },
  actionBtn: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  radarBox: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  radarText: {
    fontSize: 12,
    color: '#424242',
  },
  radarBold: {
    fontWeight: 'bold',
  },
});
