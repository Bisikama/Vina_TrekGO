import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { CheckpointHeader } from './CheckpointHeader';
import { LocationStatus } from './LocationStatus';
import { SafetyInstructions } from './SafetyInstructions';

export const CheckpointFeature = () => {
  return (
    <ScrollView style={styles.container}>
      <CheckpointHeader />
      <LocationStatus />
      <SafetyInstructions />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});
