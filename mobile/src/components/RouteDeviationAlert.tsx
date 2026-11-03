import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';

interface RouteDeviationAlertProps {
  deviationMeters: number;
  trailName?: string;
  onViewRoute: () => void;
  onDismiss: () => void;
}

export const RouteDeviationAlert: React.FC<RouteDeviationAlertProps> = ({
  deviationMeters = 120,
  trailName = 'Tà Năng – Phan Dũng',
  onViewRoute,
  onDismiss,
}) => {
  return (
    <View style={styles.container}>
      {/* Amber/Red Banner Header */}
      <View style={styles.header}>
        <View style={styles.alertIconBadge}>
          <Ionicons name="warning" size={18} color="#ba1a1a" />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.badgeText}>NGUY CƠ LẠC ĐƯỜNG</Text>
          <Text style={styles.headlineText}>⚠ BẠN ĐÃ ĐI LỆCH TUYẾN!</Text>
        </View>
      </View>

      {/* Description text */}
      <Text style={styles.bodyText}>
        Hệ thống GPS phát hiện bạn đang cách tuyến đường dự kiến{' '}
        <Text style={styles.distanceHighlight}>{deviationMeters}m</Text>. Địa hình vực dốc
        và rừng rậm phía trước có thể mất tín hiệu di động.
      </Text>

      {/* Trajectory Guide Info */}
      <View style={styles.infoRow}>
        <Ionicons name="compass-outline" size={16} color="#725c00" />
        <Text style={styles.infoText}>
          Hướng quay lại khuyến nghị: <Text style={styles.boldText}>Bắc - Tây Bắc (310°)</Text>
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.reconnectButton}
          onPress={onViewRoute}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={16} color={Colors.onPrimary} />
          <Text style={styles.reconnectButtonText}>Xem đường quay lại</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          activeOpacity={0.8}
        >
          <Text style={styles.dismissButtonText}>Bỏ qua (Tuyến nhánh)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff9e6',
    borderWidth: 1.5,
    borderColor: '#fed018',
    borderRadius: Radius.xl, // 24px rounded card
    padding: 16,
    marginHorizontal: 16,
    ...Shadows.hover,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  alertIconBadge: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: '#ffdad6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ba1a1a',
    letterSpacing: 0.5,
  },
  headlineText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4a3b1c',
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#41493a',
    marginBottom: 10,
  },
  distanceHighlight: {
    fontWeight: '800',
    color: '#ba1a1a',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(254, 208, 24, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    marginBottom: 14,
  },
  infoText: {
    fontSize: 12,
    color: '#564500',
  },
  boldText: {
    fontWeight: '700',
    color: '#231b00',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reconnectButton: {
    flex: 3,
    height: 44,
    borderRadius: Radius.full, // signature pill
    backgroundColor: Colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reconnectButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.onPrimary,
  },
  dismissButton: {
    flex: 2,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#41493a',
  },
});
