import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function HomeRoute() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <ThemedText type="title">Demo App</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Màn hình Home cũ gọi API gây lỗi mạng, tôi đã thay thế bằng Menu Demo để bạn truy cập nhanh vào 2 tính năng mới!
        </ThemedText>

        <Pressable
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/leader/pre-trip-checkin' as any)}
        >
          <ThemedText type="default" themeColor="onPrimary" style={styles.buttonText}>
            🔥 Mở luồng Leader (Pre-trip Checkin)
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/delivery/task-list' as any)}
        >
          <ThemedText type="default" themeColor="onPrimary" style={styles.buttonText}>
            📦 Mở luồng Delivery (Task List)
          </ThemedText>
        </Pressable>

        {/* Demo buttons to see the other screens */}
        <ThemedText type="subtitle" style={{ marginTop: 24 }}>Tất cả màn hình</ThemedText>
        
        <ThemedText type="smallBold">Leader Screens (Vina TrekGO):</ThemedText>
        <Pressable style={styles.subButton} onPress={() => router.push('/trip/dashboard' as any)}><ThemedText>1. Dashboard</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/trip/map' as any)}><ThemedText>2. Trip Map</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/trip/deviation' as any)}><ThemedText>3. Deviation Alert</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/trip/reroute' as any)}><ThemedText>4. Deviation Reroute</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/trip/checkpoint' as any)}><ThemedText>5. Checkpoint Verify</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/trip/safety-report' as any)}><ThemedText>6. Safety Report</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/trip/group-chat' as any)}><ThemedText>7. Group Chat</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/trip/summary' as any)}><ThemedText>8. Trip Summary</ThemedText></Pressable>

        <ThemedText type="smallBold" style={{ marginTop: 12 }}>Delivery Screens (Vina TrekGO):</ThemedText>
        <Pressable style={styles.subButton} onPress={() => router.push('/delivery/task-list' as any)}><ThemedText>1. Task List</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/delivery/task-detail' as any)}><ThemedText>2. Task Detail</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/delivery/qr-verify' as any)}><ThemedText>3. QR Verify</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/delivery/equipment-checklist' as any)}><ThemedText>4. Equipment Checklist</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/delivery/handover-signature' as any)}><ThemedText>5. Handover Signature</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/delivery/handover-receipt' as any)}><ThemedText>6. Handover Receipt</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/delivery/return-checklist' as any)}><ThemedText>7. Return Checklist</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/delivery/return-detail' as any)}><ThemedText>8. Return Detail</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/delivery/condition-assessment' as any)}><ThemedText>9. Condition Assessment</ThemedText></Pressable>
        <Pressable style={styles.subButton} onPress={() => router.push('/delivery/task-history' as any)}><ThemedText>10. Task History</ThemedText></Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 4,
  },
  buttonText: {
    fontWeight: 'bold',
  },
  subButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  }
});
