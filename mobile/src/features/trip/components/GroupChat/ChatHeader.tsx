import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const ChatHeader = () => {
  const { groupChatData } = TRIP_MOCK_DATA;
  return (
    <View style={styles.container}>
      <View style={styles.topInfo}>
        <View>
          <View style={styles.tagRow}>
            <Text style={styles.tag}>VINA_TREKGO</Text>
            <Text style={styles.id}>#TG-TNPD-2024</Text>
          </View>
          <Text style={styles.title}>Trò Chuyện Nhóm</Text>
        </View>
        <View style={styles.avatarMock} />
      </View>

      <View style={styles.statusBox}>
        <View style={styles.statusRow}>
          <Text style={styles.statusName}>🟢 {groupChatData.status}</Text>
          <View style={styles.activeBadge}>
            <Text style={styles.activeText}>MESH ACTIVE</Text>
          </View>
        </View>
        <View style={styles.subStatusRow}>
          <View style={styles.meshInfo}>
            <Text style={styles.meshIcon}>⚛️</Text>
            <Text style={styles.meshText}>{groupChatData.meshNetwork}</Text>
          </View>
          <View style={styles.membersBox}>
            <Text style={styles.membersText}>👥 {groupChatData.members}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  topInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tag: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: 'bold',
    marginRight: 8,
  },
  id: {
    color: '#666',
    fontSize: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  avatarMock: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1B5E20',
  },
  statusBox: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  activeBadge: {
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeText: {
    color: '#1B5E20',
    fontSize: 10,
    fontWeight: 'bold',
  },
  subStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meshInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meshIcon: {
    marginRight: 4,
  },
  meshText: {
    fontSize: 10,
    color: '#666',
    width: 100,
  },
  membersBox: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  membersText: {
    fontSize: 10,
    color: '#333',
  },
});
