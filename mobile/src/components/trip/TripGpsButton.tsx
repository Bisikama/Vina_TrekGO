import { Colors, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { endGpsTrip, getGpsContext } from "@/features/trip-gps/services/trip-gps.api";

interface TripGpsButtonProps {
  tripId: string;
  tripType: "PUBLIC" | "PRIVATE";
  tripTitle: string;
  tripStatus: string;
}

const isEnded = (status: string) => ['COMPLETED', 'INTERRUPTED', 'CANCELLED'].includes(status);

export function TripGpsButton({ tripId, tripType, tripTitle, tripStatus }: TripGpsButtonProps) {
  const router = useRouter();
  const [canEnd, setCanEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [serverTrip, setServerTrip] = useState<{ id: string; status: string } | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setCanEnd(false);
    const refresh = () => getGpsContext(tripId).then(ctx => {
      if (active) {
        setServerTrip(previous => previous?.id === tripId && isEnded(previous.status)
          ? previous : { id: tripId, status: ctx.tripStatus });
        setCanEnd(ctx.permissions.canManageTrip && ctx.tripStatus === 'IN_PROGRESS');
      }
    }).catch(() => {
      if (active) {
        setCanEnd(false);
      }
    });
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => { active = false; clearInterval(timer); };
  }, [tripId]));
  const confirmEnd = () => Alert.alert('Kết thúc chuyến đi?',
    'Chuyến sẽ chuyển sang hoàn thành. Thành viên có phiên GPS đang mở được phép ghi tiếp sẽ tự kết thúc phiên cá nhân.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Kết thúc chuyến', style: 'destructive', onPress: async () => {
        if (ending) return;
        setEnding(true);
        try {
          await endGpsTrip(tripId);
          setCanEnd(false);
          setServerTrip({ id: tripId, status: 'COMPLETED' });
          Alert.alert('Đã kết thúc chuyến', 'Chuyến đã hoàn thành. Hãy kết thúc phiên GPS cá nhân khi bạn đã dừng ghi.');
        } catch (err) {
          Alert.alert('Không thể kết thúc chuyến', err instanceof Error ? err.message : 'Vui lòng thử lại.');
        } finally { setEnding(false); }
      } },
    ]);
  // Render immediately from the detail screen, then reconcile with the API in the background.
  const status = serverTrip?.id === tripId ? serverTrip.status : tripStatus;
  if (['INTERRUPTED', 'CANCELLED'].includes(status)) return null;

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.button, { flex: 1 }]}
      activeOpacity={0.85}
      onPress={() => router.push({
        pathname: "/navigation",
        params: { tripId, tripType, tripTitle },
      })}
    >
      <Ionicons name="navigate-circle-outline" size={23} color="#FFFFFF" />
      <Text style={styles.label}>Vào chế độ GPS</Text>
      <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
    </TouchableOpacity>
    {canEnd && <TouchableOpacity accessibilityRole="button" disabled={ending} onPress={confirmEnd}
      style={[styles.button, { backgroundColor: '#a83232', flex: 1, opacity: ending ? 0.6 : 1 }]}>
      <Ionicons name="flag-outline" size={20} color="#FFFFFF" />
      <Text style={styles.label}>{ending ? 'Đang kết thúc...' : 'Kết thúc chuyến'}</Text>
    </TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDark,
  },
  label: { flex: 1, color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
