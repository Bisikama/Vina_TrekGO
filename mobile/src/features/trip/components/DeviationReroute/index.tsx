import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { RerouteHeader } from './RerouteHeader';
import { RerouteWarning } from './RerouteWarning';
import { RouteOptions } from './RouteOptions';

export const DeviationRerouteFeature = () => {
  return (
    <ScrollView style={styles.container}>
      <RerouteHeader />
      <RerouteWarning />
      <RouteOptions />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});
