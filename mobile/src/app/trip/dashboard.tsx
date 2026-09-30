import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LeaderDashboardFeature } from '../../features/trip/components/LeaderDashboard';

export default function DashboardScreen() {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <LeaderDashboardFeature />
      <TouchableOpacity 
        style={styles.navButton} 
        onPress={() => router.push('/trip/map' as any)}
      >
        <Text style={styles.navText}>Go to Map ➔</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  navText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
