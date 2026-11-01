import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';
import type { ActualRouteResponse, LocalSyncStatus } from '../types';
import { TripGpsRouteArt } from './TripGpsRouteArt';
import { TripShareButton } from './TripShareButton';
import { getTripGpsResult } from '../services/trip-gps.result';

interface TripGpsResultModalProps {
  tripId?: string;
  syncStatus?: LocalSyncStatus;
  rejectedSampleCount?: number;
  visible: boolean;
  actualRoute: ActualRouteResponse | null;
  liveRouteCoords?: [number, number][];
  stats?: {
    recordingTime?: string;
    distanceKm?: string;
    speedKmh?: string;
    altitudeM?: number | string;
  };
  onClose: () => void;
}

export function TripGpsResultModal({
  tripId,
  visible,
  actualRoute,
  liveRouteCoords,
  stats,
  onClose,
  syncStatus,
  rejectedSampleCount = 0,
}: TripGpsResultModalProps) {
  const { distanceKm, pointCount, isReady, routeCoords } = getTripGpsResult(actualRoute, syncStatus, liveRouteCoords, stats?.distanceKm);
  const duration = stats?.recordingTime || '--:--:--';
  const syncBusy = syncStatus === 'SYNCING' || syncStatus === 'PROCESSING';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Trophy Badge with Wise Primary Accent */}
            <View style={styles.iconCircleOuter}>
              <View style={styles.iconCircleInner}>
                <Ionicons name="trophy" size={32} color={Colors.inkDeep} />
              </View>
            </View>

            <Text style={styles.title}>Hành Trình Hoàn Tất!</Text>
            <Text style={styles.subtitle}>
              Đã kết thúc ghi. Tổng kết từ dữ liệu GPS đã lưu trên máy.
            </Text>

            {/* Strava Minimalist GPS Route Art Canvas */}
            <View style={styles.routeArtWrapper}>
              <TripGpsRouteArt
                coordinates={routeCoords}
                distanceKm={distanceKm}
                height={165}
                theme="dark"
              />
            </View>

            {/* Wise 2x2 Metric Grid */}
            <View style={styles.metricsGrid}>
              {/* Tile 1: Quãng đường */}
              <View style={styles.metricTile}>
                <View style={styles.metricHeader}>
                  <Ionicons name="navigate-circle-outline" size={14} color={Colors.mute} />
                  <Text style={styles.metricLabel}>QUÃNG ĐƯỜNG TẠM TÍNH</Text>
                </View>
                <View style={styles.metricValRow}>
                  <Text style={styles.metricVal}>{distanceKm}</Text>
                  <Text style={styles.metricUnit}>km</Text>
                </View>
              </View>

              {/* Tile 2: Thời gian ghi */}
              <View style={styles.metricTile}>
                <View style={styles.metricHeader}>
                  <Ionicons name="time-outline" size={14} color={Colors.mute} />
                  <Text style={styles.metricLabel}>THỜI GIAN GHI</Text>
                </View>
                <View style={styles.metricValRow}>
                  <Text style={styles.metricVal}>{duration}</Text>
                </View>
              </View>

              {/* Points persisted locally, independent of server validation. */}
              <View style={[styles.metricTile, { width: '100%' }]}>
                <View style={styles.metricHeader}>
                  <Ionicons name="analytics-outline" size={14} color={Colors.mute} />
                  <Text style={styles.metricLabel}>ĐIỂM GPS ĐÃ LƯU</Text>
                </View>
                <View style={styles.metricValRow}>
                  <Text style={styles.metricVal}>{pointCount}</Text>
                  <Text style={styles.metricUnit}>mẫu</Text>
                </View>
              </View>
            </View>

            {/* Status Badge according to Wise Badge Tokens */}
            <View style={[styles.statusBadge, isReady ? styles.statusBadgeReady : styles.statusBadgeProcessing]}>
              {isReady ? (
                <Ionicons name="checkmark-circle" size={16} color={Colors.positiveDeep} />
              ) : syncBusy ? (
                <ActivityIndicator size="small" color={Colors.tertiary} style={{ marginRight: 2 }} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={16} color={Colors.tertiary} />
              )}
              <Text style={[styles.statusText, isReady ? styles.statusTextReady : styles.statusTextProcessing]}>
                {isReady ? 'Đã đồng bộ lịch sử' : syncStatus === 'WAITING_NETWORK' ? 'Chờ kết nối để đồng bộ lịch sử' : syncStatus === 'NEEDS_ATTENTION' ? 'Cần kiểm tra và đồng bộ lại' : syncStatus === 'PENDING' ? 'Lịch sử đang chờ đồng bộ' : 'Đang đồng bộ và xử lý tuyến đường...'}
              </Text>
            </View>

            {rejectedSampleCount > 0 && <Text style={styles.subtitle}>{rejectedSampleCount} điểm không được máy chủ chấp nhận. Dữ liệu gốc vẫn được giữ trên máy.</Text>}

            {/* Wise Signature Primary CTA Button */}
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.primaryBtnText}>Hoàn Tất & Xem Bản Đồ</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.onPrimary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
            <TripShareButton tripId={tripId} expectRoute onBeforeOpen={onClose} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 15, 12, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: Radius.xl, // 24px signature Wise card radius
    paddingHorizontal: 20,
    paddingVertical: 18,
    ...Shadows.modal,
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  routeArtWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  iconCircleOuter: {
    width: 76,
    height: 76,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale, // #e2f6d5
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircleInner: {
    width: 58,
    height: 58,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary, // Wise #9fe870
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.ink,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.body,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  metricsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  metricTile: {
    width: '48%',
    backgroundColor: '#f5f7f4', // Canvas-soft tint
    borderRadius: Radius.lg, // 16px
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e4e7e1',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.mute,
    letterSpacing: 0.6,
  },
  metricValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricVal: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.ink,
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.body,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    marginBottom: 22,
    width: '100%',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusBadgeReady: {
    backgroundColor: Colors.primaryPale, // #e2f6d5
    borderColor: Colors.primaryNeutral,
  },
  statusBadgeProcessing: {
    backgroundColor: '#f5f7f4',
    borderColor: '#e4e7e1',
  },
  statusText: {
    fontSize: 12,
    flexShrink: 1,
  },
  statusTextReady: {
    fontWeight: '800',
    color: Colors.inkDeep,
  },
  statusTextProcessing: {
    fontWeight: '600',
    color: Colors.body,
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: Radius.xl, // 24px signature Wise pill-rectangle
    backgroundColor: Colors.primary, // Wise #9fe870
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.onPrimary, // #0e0f0c
  },
});
