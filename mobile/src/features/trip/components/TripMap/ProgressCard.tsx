import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const ProgressCard = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.stageBadge}>
          <Text style={styles.stageText}>CHẶNG 1</Text>
        </View>
        <Text style={styles.title}>Cổng Trạm Tôn ➔ Suối Lạnh</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>ĐÚNG TIẾN ĐỘ</Text>
        </View>
      </View>
      
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>CÒN LẠI</Text>
          <Text style={styles.statValue}>1.2 <Text style={styles.statUnit}>km</Text></Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>CHÊNH CAO</Text>
          <Text style={styles.statValue}>+320 <Text style={styles.statUnit}>m</Text></Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>ETA ĐẾN</Text>
          <Text style={[styles.statValue, { color: '#E65100' }]}>11:30</Text>
        </View>
      </View>
      
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          Cảnh báo vi khí hậu: Gió giật cấp 5 tại sườn đón gió. Mưa phùn nhẹ lúc 13:00. Khuyến cáo mặc Windbreaker trước km 5.0.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    margin: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stageBadge: {
    backgroundColor: '#1B5E20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  stageText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#1B5E20',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: 'normal',
  },
  warningBox: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
  },
  warningText: {
    color: '#C62828',
    fontSize: 12,
  },
});
