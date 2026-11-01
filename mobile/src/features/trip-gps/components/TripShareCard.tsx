import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Typography } from '@/components/ui';
import type { ActualRouteResponse } from '../types';
import {
  formatRouteDate,
  formatRouteDistanceKm,
  formatRouteDuration,
  formatRoutePace,
  projectCoordinates,
  splitAtGaps,
  toSvgPath,
  type RouteCoordinate,
} from '../services/trip-share';

export type TripShareStatsPosition = 'top' | 'bottom';

interface TripShareCardProps {
  route: ActualRouteResponse;
  photoUri: string | null;
  routeColor: string;
  statsPosition: TripShareStatsPosition;
}

const HEADER_SPACE = 64;
const STATS_SPACE = 96;
const EDGE_SPACE = 28;

export function TripShareCard({ route, photoUri, routeColor, statsPosition }: TripShareCardProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const statsOnTop = statsPosition === 'top';

  const drawing = useMemo(() => {
    const coordinates = (route.routeGeojson?.coordinates ?? []) as RouteCoordinate[];
    if (!size.width || coordinates.length < 2) return null;
    const points = projectCoordinates(coordinates, size.width, size.height, {
      top: statsOnTop ? HEADER_SPACE + STATS_SPACE : HEADER_SPACE,
      bottom: statsOnTop ? EDGE_SPACE : STATS_SPACE + EDGE_SPACE,
      left: EDGE_SPACE,
      right: EDGE_SPACE,
    });
    return {
      paths: splitAtGaps(points, route.gapConnections).map(toSvgPath),
      start: points[0],
      end: points[points.length - 1],
    };
  }, [route, size, statsOnTop]);

  const stats = [
    { label: 'QUÃNG ĐƯỜNG', value: formatRouteDistanceKm(route.totalDistanceMeters), unit: 'km' },
    { label: 'TỐC ĐỘ TB', value: formatRoutePace(route.totalDistanceMeters, route.movingDurationSeconds), unit: '/km' },
    { label: 'THỜI GIAN', value: formatRouteDuration(route.movingDurationSeconds), unit: '' },
  ];

  return (
    <View
      style={styles.card}
      collapsable={false}
      onLayout={e => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <View style={[StyleSheet.absoluteFill, photoUri ? styles.photoScrim : null]} />

      {drawing ? (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          {drawing.paths.map((d, i) => (
            <React.Fragment key={i}>
              <Path d={d} fill="none" stroke="#0e0f0c" strokeOpacity={0.35} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
              <Path d={d} fill="none" stroke={routeColor} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            </React.Fragment>
          ))}
          <Circle cx={drawing.start.x} cy={drawing.start.y} r={6} fill="#ffffff" stroke={routeColor} strokeWidth={3} />
          <Circle cx={drawing.end.x} cy={drawing.end.y} r={12} fill={routeColor} fillOpacity={0.35} />
          <Circle cx={drawing.end.x} cy={drawing.end.y} r={6} fill={routeColor} />
        </Svg>
      ) : null}

      <View style={styles.header}>
        <Text style={styles.brand}>TREKGO</Text>
        <Text style={[styles.date, Typography.tabularNums]}>{formatRouteDate(route.startedAt ?? route.generatedAt)}</Text>
      </View>

      <View style={[styles.stats, statsOnTop ? styles.statsTop : styles.statsBottom]}>
        {stats.map(stat => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
            <Text style={styles.statLine} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={[styles.statValue, Typography.tabularNums]}>{stat.value}</Text>
              {stat.unit && stat.value !== '--' ? <Text style={styles.statUnit}> {stat.unit}</Text> : null}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const textShadow = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 };

const styles = StyleSheet.create({
  card: { width: '100%', aspectRatio: 0.64, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0e0f0c' },
  photoScrim: { backgroundColor: 'rgba(14, 15, 12, 0.18)' },
  header: { position: 'absolute', top: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#ffffff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5, ...textShadow },
  date: { color: '#ffffff', fontSize: 12, fontWeight: '700', ...textShadow },
  stats: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 8 },
  statsBottom: { bottom: 20 },
  statsTop: { top: HEADER_SPACE },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statLabel: { color: '#ffffff', fontSize: 10, fontWeight: '700', letterSpacing: 0.4, ...textShadow },
  statLine: { color: '#ffffff', ...textShadow },
  statValue: { color: '#ffffff', fontSize: 24, fontWeight: '900', ...textShadow },
  statUnit: { color: '#ffffff', fontSize: 12, fontWeight: '700', ...textShadow },
});
