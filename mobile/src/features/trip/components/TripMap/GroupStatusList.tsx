import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const GroupStatusList = () => {
  const { groups } = TRIP_MOCK_DATA.mapData;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Giám Sát Đội Hình & Đèn Tín Hiệu</Text>
      
      {groups.map((group) => (
        <View key={group.id} style={styles.groupCard}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>{group.icon === 'walk' ? '🚶' : group.icon === 'person' ? '🧑' : '🎒'}</Text>
          </View>
          <View style={styles.infoContainer}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupDesc}>{group.members} • {group.status}</Text>
          </View>
          <View style={[styles.actionBadge, group.action === 'ĐÃ ĐẾN' ? styles.badgeSuccess : styles.badgeDefault]}>
            <Text style={[styles.actionText, group.action === 'ĐÃ ĐẾN' ? styles.textSuccess : styles.textDefault]}>
              {group.action}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  infoContainer: {
    flex: 1,
  },
  groupName: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  groupDesc: {
    fontSize: 12,
    color: '#666',
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeDefault: {
    backgroundColor: '#F5F5F5',
  },
  badgeSuccess: {
    backgroundColor: '#E3F2FD',
  },
  actionText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  textDefault: {
    color: '#333',
  },
  textSuccess: {
    color: '#1565C0',
  },
});
