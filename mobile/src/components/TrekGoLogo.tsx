import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/theme';

interface TrekGoLogoProps {
  size?: number;
  showText?: boolean;
}

export const TrekGoLogo: React.FC<TrekGoLogoProps> = ({ size = 32, showText = true }) => {
  const scale = size / 32;
  const height = 36 * scale;

  return (
    <View style={styles.container}>
      <Svg width={36 * scale} height={height} viewBox="0 0 36 36" fill="none">
        {/* Mountain Silhouette */}
        <Path d="M4 30L16 10L28 30H4Z" fill={Colors.ink} />
        {/* Alpine Path Accent */}
        <Path d="M16 10L22 20L28 30H19L16 18L11 26L8 22L16 10Z" fill={Colors.primary} />
        {/* Summit Beacon Dot */}
        <Circle cx="24" cy="12" r="3" fill={Colors.primary} />
      </Svg>
      {showText && (
        <View style={styles.textContainer}>
          <Text style={styles.trekText}>
            Trek<Text style={styles.goText}>Go</Text>
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  textContainer: {
    justifyContent: 'center',
  },
  trekText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.ink,
    letterSpacing: -0.5,
  },
  goText: {
    color: Colors.primaryDark,
  },
});
