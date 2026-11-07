import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";

import { Trek, useReducedMotion } from "@/features/gear/TrekKit";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Thân balo trong khung 0..60 x 0..72; vùng chứa từ y=18 tới y=68.
const BODY = "M14 18 Q14 10 22 10 L38 10 Q46 10 46 18 L48 62 Q48 68 42 68 L18 68 Q12 68 12 62 Z";
const TOP = 18;
const BOTTOM = 68;

/** Balo được "đổ đầy" theo tỷ lệ value/total. */
export function BackpackMeter({ value, total, size = 72 }: { value: number; total: number; size?: number }) {
  const reduced = useReducedMotion();
  const ratio = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const [level] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(level, { toValue: ratio, duration: reduced ? 0 : 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [level, ratio, reduced]);
  const fillHeight = level.interpolate({ inputRange: [0, 1], outputRange: [0, BOTTOM - TOP] });
  const fillY = level.interpolate({ inputRange: [0, 1], outputRange: [BOTTOM, TOP] });
  const full = ratio >= 1;
  return (
    <View style={{ width: size, height: size * 1.2 }}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 60 72">
        <Defs>
          <ClipPath id="pack">
            <Path d={BODY} />
          </ClipPath>
        </Defs>
        <Path d="M22 10 Q22 3 30 3 Q38 3 38 10" stroke={Trek.woodDeep} strokeWidth={3} fill="none" />
        <Path d={BODY} fill="#f1ede4" />
        <AnimatedRect x={0} y={fillY} width={60} height={fillHeight} fill={full ? Trek.trail : "#7fb38f"} clipPath="url(#pack)" />
        <Path d={BODY} stroke={Trek.woodDeep} strokeWidth={2.4} fill="none" />
        <Path d="M20 40 L40 40 L40 52 Q40 55 37 55 L23 55 Q20 55 20 52 Z" stroke={Trek.woodDeep} strokeWidth={1.6} fill="rgba(255,255,255,0.25)" />
        <Path d="M14 26 L46 26" stroke={Trek.woodDeep} strokeWidth={1.4} strokeOpacity={0.6} />
      </Svg>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{total ? Math.round(ratio * 100) : 0}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: -4,
    bottom: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: Trek.forestMid,
  },
  badgeText: { color: "#ffffff", fontSize: 9, fontWeight: "900" },
});
