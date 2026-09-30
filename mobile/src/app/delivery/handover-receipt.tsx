import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { HandoverReceiptFeature } from '../../features/delivery/components/HandoverReceipt';

export default function HandoverReceiptScreen() {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <HandoverReceiptFeature />
      <TouchableOpacity 
        style={styles.navButton} 
        onPress={() => router.push('/delivery/return-checklist' as any)}
      >
        <Text style={styles.navText}>Go to Return Checklist ➔</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navButton: {
    position: 'absolute', bottom: 90, right: 20,
    backgroundColor: '#000', padding: 12, borderRadius: 24,
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  navText: { color: 'white', fontWeight: 'bold' },
});
