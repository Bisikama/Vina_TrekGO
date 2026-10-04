import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ReportHeader } from './ReportHeader';
import { IncidentForm } from './IncidentForm';
import { SOSButton } from './SOSButton';

export const SafetyReportFeature = () => {
  return (
    <ScrollView style={styles.container}>
      <ReportHeader />
      <IncidentForm />
      <SOSButton />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});
