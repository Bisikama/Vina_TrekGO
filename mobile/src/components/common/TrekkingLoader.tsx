import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { Colors, Radius, Shadows } from "@/constants/theme";

export function TrekkingLoader({
  label = "Đang nối tuyến hành trình...",
  hint = "Dữ liệu đang được đồng bộ an toàn",
  compact = false,
}: {
  label?: string;
  hint?: string;
  compact?: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const routeAnimation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1850,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    routeAnimation.start();
    pulseAnimation.start();
    return () => {
      routeAnimation.stop();
      pulseAnimation.stop();
    };
  }, [progress, pulse]);

  const routeX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, compact ? 34 : 46],
  });
  const beaconScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.25],
  });

  return (
    <View
      style={[styles.wrap, compact && styles.compact]}
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
    >
      <View style={[styles.landmark, compact && styles.landmarkCompact]}>
        <View style={styles.contourOne} />
        <View style={styles.contourTwo} />
        <Ionicons
          name="trail-sign-outline"
          size={compact ? 20 : 25}
          color={Colors.primary}
        />
        <Animated.View
          style={[
            styles.beacon,
            { opacity: pulse, transform: [{ scale: beaconScale }] },
          ]}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.kicker}>TREKGO · ĐANG ĐỒNG BỘ</Text>
        <Text style={styles.label}>{label}</Text>
        {!compact ? <Text style={styles.hint}>{hint}</Text> : null}
        <View style={styles.route}>
          <View style={styles.routeLine} />
          <View style={[styles.waypoint, styles.waypointStart]} />
          <View style={[styles.waypoint, styles.waypointMiddle]} />
          <View style={[styles.waypoint, styles.waypointEnd]} />
          <Animated.View
            style={[styles.traveller, { transform: [{ translateX: routeX }] }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 92,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#D9E6D0",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    overflow: "hidden",
    ...Shadows.card,
  },
  compact: { minHeight: 70, paddingVertical: 9, borderRadius: Radius.lg },
  landmark: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
    backgroundColor: Colors.inkDeep,
    overflow: "hidden",
  },
  landmarkCompact: { width: 50, height: 50, borderRadius: Radius.md },
  contourOne: {
    position: "absolute",
    width: 54,
    height: 32,
    borderWidth: 1,
    borderColor: "rgba(159,232,112,0.24)",
    borderRadius: Radius.full,
    transform: [{ rotate: "-18deg" }],
  },
  contourTwo: {
    position: "absolute",
    width: 76,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(159,232,112,0.14)",
    borderRadius: Radius.full,
    transform: [{ rotate: "22deg" }],
  },
  beacon: {
    position: "absolute",
    top: 11,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  copy: { flex: 1 },
  kicker: {
    color: Colors.primaryDark,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "800",
    letterSpacing: 1.15,
  },
  label: {
    marginTop: 3,
    color: Colors.inkDeep,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  hint: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    lineHeight: 14,
  },
  route: { width: 58, height: 10, marginTop: 7, justifyContent: "center" },
  routeLine: {
    position: "absolute",
    left: 4,
    right: 4,
    height: 1,
    backgroundColor: "#C7D7BD",
  },
  waypoint: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: "#AFC3A3",
  },
  waypointStart: { left: 2 },
  waypointMiddle: { left: 27 },
  waypointEnd: { right: 2 },
  traveller: {
    position: "absolute",
    left: 3,
    width: 9,
    height: 9,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.surfaceContainerLowest,
    backgroundColor: Colors.primaryDark,
  },
});
