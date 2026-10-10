import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export const ReportHeader = () => {
  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>FANSIPAN 3N2Đ</Text>
        </View>
        <Text style={styles.subText}>#TG-8924-VN</Text>
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Thông Tin & Báo Cáo An Toàn</Text>
        <View style={styles.wfaBadge}>
          <Text style={styles.wfaText}>WFA V-CERT</Text>
        </View>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <View style={[styles.tab, styles.activeTab]}>
          <Text style={styles.activeTabText}>👥 Kênh Chung (14)</Text>
        </View>
        <View style={styles.tab}>
          <Text style={styles.tabText}>☁️ VFRS Thời Tiết</Text>
        </View>
        <View style={styles.tab}>
          <Text style={styles.tabText}>🚁 Sa Pa Hub</Text>
        </View>
      </ScrollView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 10,
    color: '#666',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  wfaBadge: {
    borderWidth: 1,
    borderColor: '#2E7D32',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  wfaText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  activeTab: {
    backgroundColor: '#E8F5E9',
  },
  activeTabText: {
    color: '#1B5E20',
    fontWeight: 'bold',
    fontSize: 12,
  },
  tabText: {
    color: '#666',
    fontSize: 12,
  },
});
