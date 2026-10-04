import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TripHeader } from './TripHeader';
import { CheckInProgress } from './CheckInProgress';
import { MemberList } from './MemberList';

export const LeaderDashboardFeature = () => {
  return (
    <ScrollView style={styles.container}>
      <TripHeader />
      <CheckInProgress />
      <MemberList />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});
