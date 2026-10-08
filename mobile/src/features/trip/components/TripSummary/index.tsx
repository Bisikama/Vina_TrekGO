import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SummaryHeader } from './SummaryHeader';
import { SummaryStats } from './SummaryStats';
import { SummaryList } from './SummaryList';

export const TripSummaryFeature = () => {
  return (
    <ScrollView style={styles.container}>
      <SummaryHeader />
      <SummaryStats />
      <SummaryList />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});
