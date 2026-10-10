import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AlertHeader } from './AlertHeader';
import { DeviationWarning } from './DeviationWarning';
import { MapPreview } from './MapPreview';
import { StatsGrid } from './StatsGrid';

export const DeviationAlertFeature = () => {
  return (
    <ScrollView style={styles.container}>
      <AlertHeader />
      <DeviationWarning />
      <MapPreview />
      <StatsGrid />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});
