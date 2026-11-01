import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '@/constants/theme';
import { projectCoordinates, toSvgPath } from '../services/trip-share';

interface TripGpsRouteArtProps {
  /** Array of [longitude, latitude] coordinates */
  coordinates?: [number, number][];
  distanceKm?: string;
  height?: number;
  theme?: 'dark' | 'light';
}

export function TripGpsRouteArt({
  coordinates = [],
  distanceKm,
  height = 170,
  theme = 'dark',
}: TripGpsRouteArtProps) {
  const [layoutWidth, setLayoutWidth] = useState<number>(320);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - layoutWidth) > 2) {
      setLayoutWidth(w);
    }
  };

  const isDark = theme === 'dark';

  // Tính toán bounds và toạ độ SVG chiếu theo Mercator
  const routeData = useMemo(() => {
    if (!coordinates || coordinates.length < 2) {
      return null;
    }

    const padding = 22;
    // Dùng toàn bộ toạ độ đã ghi để đường đi qua đúng từng điểm GPS
    const mapped = projectCoordinates(coordinates, layoutWidth || 320, height, {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding,
    });
    const pathD = toSvgPath(mapped);

    return {
      pathD,
      startPoint: mapped[0],
      endPoint: mapped[mapped.length - 1],
      totalPoints: coordinates.length,
    };
  }, [coordinates, layoutWidth, height]);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        { height },
        isDark ? styles.containerDark : styles.containerLight,
      ]}
    >
      {/* Header Eyebrow Tag */}
      <View style={styles.topBar}>
        <View style={styles.badgePill}>
          <Ionicons
            name="trail-sign-outline"
            size={11}
            color={isDark ? Colors.primary : Colors.inkDeep}
          />
          <Text style={[styles.badgeText, isDark ? styles.badgeTextDark : styles.badgeTextLight]}>
            GPS ROUTE ART
          </Text>
        </View>

        {distanceKm && (
          <View style={styles.distanceBadge}>
            <Text style={[styles.distanceText, isDark ? styles.distanceTextDark : styles.distanceTextLight]}>
              {distanceKm} km
            </Text>
          </View>
        )}
      </View>

      {/* SVG Canvas Area */}
      {routeData ? (
        <Svg width={layoutWidth} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#2ead4b" />
              <Stop offset="100%" stopColor={Colors.primary} />
            </LinearGradient>
          </Defs>

          {/* Đường thẳng nối các toạ độ theo thứ tự đã ghi */}
          <Path
            d={routeData.pathD}
            fill="none"
            stroke={isDark ? 'url(#routeGradient)' : '#163300'}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Start Point Marker (Green Dot with White Core) */}
          <Circle
            cx={routeData.startPoint.x}
            cy={routeData.startPoint.y}
            r={5.5}
            fill="#2ead4b"
            stroke={isDark ? '#0e0f0c' : '#ffffff'}
            strokeWidth={1.8}
          />
          <Circle
            cx={routeData.startPoint.x}
            cy={routeData.startPoint.y}
            r={2}
            fill="#ffffff"
          />

          {/* End Point Marker (Wise Lime Dot with Deep Ring) */}
          <Circle
            cx={routeData.endPoint.x}
            cy={routeData.endPoint.y}
            r={6.5}
            fill={Colors.primary}
            stroke={isDark ? '#0e0f0c' : '#163300'}
            strokeWidth={2}
          />
          <Circle
            cx={routeData.endPoint.x}
            cy={routeData.endPoint.y}
            r={2.5}
            fill={isDark ? '#0e0f0c' : '#163300'}
          />
        </Svg>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="map-outline"
            size={28}
            color={isDark ? '#454745' : '#868685'}
          />
          <Text style={[styles.emptyText, isDark ? styles.emptyTextDark : styles.emptyTextLight]}>
            Chưa có toạ độ thực tế để dựng hình cung đường
          </Text>
        </View>
      )}

      {/* Legend Footer */}
      {routeData && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2ead4b' }]} />
            <Text style={[styles.legendLabel, isDark ? styles.legendLabelDark : styles.legendLabelLight]}>
              Bắt đầu
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
            <Text style={[styles.legendLabel, isDark ? styles.legendLabelDark : styles.legendLabelLight]}>
              Về đích
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: Radius.lg, // 16px Wise card inner tile
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    padding: 12,
  },
  containerDark: {
    backgroundColor: '#0e0f0c', // Wise Ink (#0e0f0c) polarity flip
    borderWidth: 1,
    borderColor: '#262923',
  },
  containerLight: {
    backgroundColor: '#f5f7f4', // Wise Canvas-soft
    borderWidth: 1,
    borderColor: '#e2e6df',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(14, 15, 12, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  badgeTextDark: {
    color: Colors.primary,
  },
  badgeTextLight: {
    color: Colors.inkDeep,
  },
  distanceBadge: {
    backgroundColor: 'rgba(14, 15, 12, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  distanceText: {
    fontSize: 10,
    fontWeight: '900',
  },
  distanceTextDark: {
    color: '#ffffff',
  },
  distanceTextLight: {
    color: Colors.ink,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
  legendLabelDark: {
    color: '#a0a39c',
  },
  legendLabelLight: {
    color: Colors.body,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 6,
  },
  emptyText: {
    fontSize: 11,
    textAlign: 'center',
  },
  emptyTextDark: {
    color: '#6e7368',
  },
  emptyTextLight: {
    color: Colors.mute,
  },
});
