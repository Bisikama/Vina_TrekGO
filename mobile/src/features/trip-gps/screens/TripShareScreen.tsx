import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { FieldModal } from '@/components/FieldModal';
import { Button, ErrorAlert, LoadingState } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { getMyActualRoute } from '../services/trip-gps.api';
import type { ActualRouteResponse } from '../types';
import { TripShareCard, type TripShareStatsPosition } from '../components/TripShareCard';

const ROUTE_COLORS = ['#9fe870', '#ff7a45', '#38c8ff', '#ffffff'];

export function TripShareScreen({ tripId }: { tripId: string }) {
  const router = useRouter();
  const cardRef = useRef<any>(null);
  const [route, setRoute] = useState<ActualRouteResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [routeColor, setRouteColor] = useState(ROUTE_COLORS[0]);
  const [statsPosition, setStatsPosition] = useState<TripShareStatsPosition>('bottom');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSucceeded, setSaveSucceeded] = useState(false);

  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    getMyActualRoute(tripId).then(
      result => {
        if (!current) return;
        if (result.resultStatus === 'READY' && result.pointCount >= 2) setRoute(result);
        else setLoadError('Cung đường của chuyến này chưa sẵn sàng.');
      },
      () => {
        if (current) setLoadError('Không tải được cung đường. Vui lòng kiểm tra kết nối và thử lại.');
      },
    );
    return () => { current = false; };
  }, [tripId, loadAttempt]);

  const retry = () => {
    setLoadError(null);
    setLoadAttempt(attempt => attempt + 1);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets?.[0]) setPhotoUri(result.assets[0].uri);
  };

  const cycleColor = () => {
    setRouteColor(current => ROUTE_COLORS[(ROUTE_COLORS.indexOf(current) + 1) % ROUTE_COLORS.length]);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const permission = await requestPermissionsAsync(true);
      if (!permission.granted) {
        setSaveError('Hãy cho phép TrekGo lưu ảnh trong phần Cài đặt của máy.');
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Asset.create(uri);
      setSaveSucceeded(true);
    } catch {
      setSaveError('Không lưu được ảnh. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Đóng">
          <Ionicons name="close" size={26} color={Colors.ink} />
        </Pressable>
        <Text style={styles.title}>Chia sẻ chuyến đi</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loadError ? (
        <View style={styles.state}><ErrorAlert message={loadError} onRetry={retry} /></View>
      ) : !route ? (
        <LoadingState label="Đang tải cung đường..." style={styles.state} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View ref={cardRef} collapsable={false}>
            <TripShareCard route={route} photoUri={photoUri} routeColor={routeColor} statsPosition={statsPosition} />
          </View>

          <View style={styles.tools}>
            <Tool label="Đổi ảnh" onPress={pickPhoto}>
              <Ionicons name="image-outline" size={22} color={Colors.ink} />
            </Tool>
            <Tool label="Màu đường" onPress={cycleColor}>
              <View style={[styles.colorDot, { backgroundColor: routeColor }]} />
            </Tool>
            <Tool label="Vị trí" onPress={() => setStatsPosition(p => (p === 'bottom' ? 'top' : 'bottom'))}>
              <Ionicons name="swap-vertical" size={22} color={Colors.ink} />
            </Tool>
          </View>

          <Button
            label="Tải xuống"
            fullWidth
            loading={saving}
            disabled={saving}
            leftIcon={<Ionicons name="download-outline" size={18} color={Colors.onPrimary} />}
            onPress={save}
          />
          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
        </ScrollView>
      )}

      <FieldModal
        visible={saveSucceeded}
        title="Đã tải ảnh thành công"
        message="Ảnh chuyến đi đã được lưu vào thư viện ảnh của máy."
        hideSecondary
        onClose={() => setSaveSucceeded(false)}
      />
    </SafeAreaView>
  );
}

function Tool({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable style={styles.tool} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.toolIcon}>{children}</View>
      <Text style={styles.toolLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerSpacer: { width: 26 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.ink },
  state: { flex: 1, padding: 16, justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  tools: { flexDirection: 'row', backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.surfaceContainerHigh, paddingVertical: 10 },
  tool: { flex: 1, alignItems: 'center', gap: 6 },
  toolIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceContainer },
  toolLabel: { fontSize: 12, fontWeight: '600', color: Colors.body },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: Colors.surfaceContainerHighest },
  saveError: { textAlign: 'center', fontSize: 14, color: Colors.negative },
});
