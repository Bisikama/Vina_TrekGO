import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Rect, Defs, RadialGradient, Stop, Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { Checkpoint } from '@/types';

interface TacticalMapProps {
  isOnRoute: boolean;
  deviationMeters?: number;
  checkpoints?: Checkpoint[];
  onCheckpointPress?: (checkpoint: Checkpoint) => void;
  height?: number;
  interactive?: boolean;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  isOnRoute,
  deviationMeters = 120,
  checkpoints = [],
  onCheckpointPress,
  height = 360,
  interactive = true,
}) => {
  const [mapMode, setMapMode] = useState<'TOPO' | 'SATELLITE'>('TOPO');
  const [compassBearing] = useState<number>(315); // NW

  // User coordinates on canvas
  const userX = isOnRoute ? 180 : 238;
  const userY = isOnRoute ? 180 : 205;

  return (
    <View style={[styles.container, { height }]}>
      {/* 1. Tactical Vector Map Canvas */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 360" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="topomap" cx="60%" cy="40%" r="70%">
            <Stop offset="0%" stopColor={mapMode === 'TOPO' ? '#213320' : '#142013'} stopOpacity="1" />
            <Stop offset="100%" stopColor="#081008" stopOpacity="1" />
          </RadialGradient>
        </Defs>

        {/* Background Canvas */}
        <Rect width="100%" height="100%" fill="url(#topomap)" />

        {/* Topographic Contour Rings */}
        <Path d="M-20,180 Q100,120 220,190 T420,140" fill="none" stroke="#9fe870" strokeWidth="1" strokeDasharray="3,3" opacity="0.25" />
        <Path d="M-20,220 Q120,150 250,230 T420,190" fill="none" stroke="#9fe870" strokeWidth="1.2" opacity="0.35" />
        <Path d="M-20,260 Q140,200 270,270 T420,240" fill="none" stroke="#9fe870" strokeWidth="1" strokeDasharray="2,2" opacity="0.25" />
        <Path d="M-20,300 Q160,240 300,310 T420,280" fill="none" stroke="#9fe870" strokeWidth="1.5" opacity="0.45" />
        <Path d="M30,50 Q150,20 280,70 T440,30" fill="none" stroke="#9fe870" strokeWidth="1" opacity="0.2" />
        <Path d="M10,90 Q170,60 300,110 T430,80" fill="none" stroke="#9fe870" strokeWidth="1.2" opacity="0.3" />

        {/* Planned Route (White Dash) */}
        <Path
          d="M 40,310 C 90,260 140,240 180,180 C 220,120 250,110 320,80"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeDasharray="6,5"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Actual Traveled Path (Neon Emerald) */}
        <Path
          d={
            isOnRoute
              ? "M 40,310 C 90,260 140,240 180,180"
              : "M 40,310 C 90,260 140,240 178,182 C 190,165 210,170 238,205"
          }
          fill="none"
          stroke="#38ef7d"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Projected Reconnect Trajectory (Visible when OFF ROUTE) */}
        {!isOnRoute && (
          <Path
            d="M 238,205 L 205,145"
            fill="none"
            stroke="#fed018"
            strokeWidth="2.5"
            strokeDasharray="4,4"
            strokeLinecap="round"
          />
        )}

        {/* Checkpoint CP1: Trạm Kiểm Lâm (Completed) */}
        <G>
          <Circle cx="38" cy="292" r="10" fill="#c8eea5" />
          <Circle cx="38" cy="292" r="5" fill="#0c2000" />
        </G>

        {/* Checkpoint CP2: Đồi Lính (Target Checkpoint) */}
        <G>
          <Circle cx="205" cy="145" r="14" fill="rgba(254, 208, 24, 0.3)" />
          <Circle cx="205" cy="145" r="10" fill="#fed018" />
          <Circle cx="205" cy="145" r="4" fill="#6f5900" />
        </G>

        {/* Checkpoint CP3: Đỉnh 986m */}
        <G>
          <Circle cx="320" cy="80" r="8" fill="#eae8e2" opacity="0.8" />
          <Circle cx="320" cy="80" r="3" fill="#1b1c19" />
        </G>

        {/* Live GPS Location Marker & Radar Ping */}
        <G>
          {/* Radar Waves */}
          <Circle 
            cx={userX} 
            cy={userY} 
            r="20" 
            fill={isOnRoute ? "rgba(159, 232, 112, 0.25)" : "rgba(254, 208, 24, 0.25)"} 
          />
          <Circle 
            cx={userX} 
            cy={userY} 
            r="12" 
            fill={isOnRoute ? Colors.primary : Colors.tertiaryContainer} 
          />
          <Circle 
            cx={userX} 
            cy={userY} 
            r="5" 
            fill={Colors.onPrimary} 
          />
        </G>
      </Svg>

      {/* 2. Interactive Markers Overlay (Tap-target layer) */}
      {/* CP1 Badge */}
      <View style={[styles.markerTag, { left: 16, top: 255 }]}>
        <View style={styles.completedBadge}>
          <Ionicons name="checkmark" size={10} color="#0c2000" />
          <Text style={styles.completedText}>CP1: Hoàn thành</Text>
        </View>
      </View>

      {/* CP2 Target Badge */}
      <TouchableOpacity 
        style={[styles.markerTag, { left: 140, top: 110 }]}
        activeOpacity={0.8}
        onPress={() => onCheckpointPress && onCheckpointPress({
          id: 'cp-2',
          order: 2,
          name: 'Cột mốc Đồi Lính',
          elevation: 840,
          distanceFromStartKm: 8.4,
          status: 'PENDING',
          coords: { x: 205, y: 145 },
        })}
      >
        <View style={styles.targetBadge}>
          <Ionicons name="flag" size={12} color="#6f5900" />
          <Text style={styles.targetBadgeText}>CP2: Đồi Lính (180m)</Text>
        </View>
      </TouchableOpacity>

      {/* CP3 Summit Badge */}
      <View style={[styles.markerTag, { left: 240, top: 50 }]}>
        <View style={styles.neutralBadge}>
          <Ionicons name="triangle" size={9} color="#f2f1eb" />
          <Text style={styles.neutralBadgeText}>Đỉnh 986m</Text>
        </View>
      </View>

      {/* User Position Beacon Tooltip */}
      <View style={[styles.markerTag, { left: userX - 45, top: userY - 48 }]}>
        <View style={[styles.userBadge, !isOnRoute && styles.userBadgeWarning]}>
          <Ionicons 
            name={isOnRoute ? 'navigate' : 'alert-circle'} 
            size={11} 
            color={isOnRoute ? Colors.onPrimaryContainer : '#6f5900'} 
          />
          <Text style={[styles.userBadgeText, !isOnRoute && styles.userBadgeTextWarning]}>
            {isOnRoute ? 'Vị trí của bạn' : `Lệch ${deviationMeters}m`}
          </Text>
        </View>
      </View>

      {/* 3. Tactical Floating HUD Overlays */}
      <View style={styles.hudTopRight}>
        {/* Compass Dial */}
        <View style={styles.hudButton}>
          <Text style={styles.compassLabel}>N</Text>
          <Ionicons 
            name="navigate" 
            size={14} 
            color={Colors.primary} 
            style={{ transform: [{ rotate: `${compassBearing}deg` }] }} 
          />
        </View>

        {/* Center My Location */}
        <TouchableOpacity style={styles.hudButton} activeOpacity={0.8}>
          <Ionicons name="locate" size={16} color="#f2f1eb" />
        </TouchableOpacity>

        {/* Layers switch (Topo / Satellite) */}
        <TouchableOpacity 
          style={[styles.hudButton, mapMode === 'SATELLITE' && styles.hudButtonActive]} 
          onPress={() => setMapMode(m => m === 'TOPO' ? 'SATELLITE' : 'TOPO')}
          activeOpacity={0.8}
        >
          <Ionicons name="layers" size={16} color={mapMode === 'SATELLITE' ? Colors.primary : "#f2f1eb"} />
        </TouchableOpacity>
      </View>

      {/* Bottom Coordinates & Watermark */}
      <View style={styles.hudBottomLeft}>
        <Text style={styles.coordsText}>
          LAT: 11.5831° N | LON: 108.5290° E | ELEV: 840M
        </Text>
      </View>

      <View style={styles.hudBottomRight}>
        <View style={styles.syncChip}>
          <Ionicons name="sync-circle" size={12} color={Colors.primary} />
          <Text style={styles.syncText}>Offline Map Ready</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#0d150c',
    overflow: 'hidden',
  },
  markerTag: {
    position: 'absolute',
    zIndex: 10,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 238, 165, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    ...Shadows.tactical,
  },
  completedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0c2000',
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fed018',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    ...Shadows.tactical,
  },
  targetBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#382b00',
  },
  neutralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(48, 49, 45, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  neutralBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#f2f1eb',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    ...Shadows.tactical,
  },
  userBadgeWarning: {
    backgroundColor: '#fed018',
  },
  userBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.onPrimaryContainer,
  },
  userBadgeTextWarning: {
    color: '#564500',
  },
  hudTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8,
    zIndex: 20,
  },
  hudButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(30, 35, 28, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hudButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(30, 45, 28, 0.95)',
  },
  compassLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#fed018',
    marginBottom: -2,
  },
  hudBottomLeft: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    backgroundColor: 'rgba(20, 25, 18, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  coordsText: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#c5eba3',
    letterSpacing: 0.5,
  },
  hudBottomRight: {
    position: 'absolute',
    bottom: 8,
    right: 12,
  },
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(20, 25, 18, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  syncText: {
    fontSize: 9,
    color: '#e4e2dd',
    fontWeight: '600',
  },
});
