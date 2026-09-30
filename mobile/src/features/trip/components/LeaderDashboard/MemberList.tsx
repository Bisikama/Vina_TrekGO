import React from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const MemberList = () => {
  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberHeader}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{item.initials}</Text>
          </View>
        )}
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberTime}>{item.time}</Text>
        </View>
        <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.tagsContainer}>
        {item.tags.map((tag: string, index: number) => (
          <Text key={index} style={styles.tagText}>• {tag}</Text>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Danh sách Quân số</Text>
      <FlatList
        data={TRIP_MOCK_DATA.members}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={false}
      />
    </View>
  );
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'ĐÃ CHECK-IN': return { backgroundColor: '#1B5E20' };
    case 'CẢNH BÁO Y TẾ': return { backgroundColor: '#FFEB3B' };
    case 'THIẾU THIẾT BỊ': return { backgroundColor: '#E0E0E0' };
    case 'CHƯA ĐẾN': return { backgroundColor: '#C62828' };
    default: return { backgroundColor: '#999' };
  }
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  memberCard: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontWeight: 'bold',
    color: '#666',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  memberTime: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  tagsContainer: {
    marginTop: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#444',
    marginBottom: 2,
  },
});
