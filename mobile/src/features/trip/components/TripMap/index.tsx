import React from 'react';
import { ScrollView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MapHeader } from './MapHeader';
import { ProgressCard } from './ProgressCard';
import { GroupStatusList } from './GroupStatusList';

export const TripMapFeature = () => {
  return (
    <ScrollView style={styles.container}>
      <MapHeader />
      <View style={styles.mapMock}>
        <Text style={styles.mapMockText}>BẢN ĐỒ MÔ PHỎNG</Text>
      </View>
      <View style={styles.contentOverlay}>
        <ProgressCard />
        <GroupStatusList />
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.radioBtn}>
            <Text style={styles.radioText}>📻 KÊNH ĐÀM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportBtn}>
            <Text style={styles.reportText}>⚠️ BÁO CÁO SỰ CỐ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  mapMock: {
    height: 250,
    backgroundColor: '#CFD8DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMockText: {
    color: '#78909C',
    fontWeight: 'bold',
    fontSize: 18,
  },
  contentOverlay: {
    marginTop: -40,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
  },
  radioBtn: {
    backgroundColor: '#263238',
    padding: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  radioText: {
    color: 'white',
    fontWeight: 'bold',
  },
  reportBtn: {
    flex: 1,
    backgroundColor: '#C62828',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  reportText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
