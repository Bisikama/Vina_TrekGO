import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Path, Polygon, Polyline } from "react-native-svg";

import { categoryInfo, gearAttributes } from "@/features/gear/gear-meta";
import type { GearCategory, UserGearItem } from "@/features/gear/types";

// Bộ hình ảnh "trekking" dùng chung cho Tủ đồ và Kế hoạch đồ: núi, đường mòn, thời tiết, la bàn.
// Chuyển động dùng Animated của React Native và tắt khi máy bật "Giảm chuyển động".

export const Trek = {
  forest: "#0b2e22",
  forestMid: "#123f30",
  forestLight: "#1f5c44",
  trail: "#2f6b4f",
  mint: "#bfe9c9",
  mintPale: "#eaf4eb",
  sun: "#f59e0b",
  sunPale: "#fde68a",
  wood: "#e8d9c2",
  woodDeep: "#8a5a33",
  paper: "#f4f6f1",
  line: "#e2eae3",
  ink: "#203c2d",
  muted: "#6b7d72",
  amberBg: "#fff7e6",
  amberInk: "#8a5a00",
  skyBg: "#e8f4fb",
  skyInk: "#0b5c86",
  indigoBg: "#eef0ff",
  indigoInk: "#3f3d9e",
};

/** true khi người dùng bật "Giảm chuyển động" trong cài đặt máy. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => active && setReduced(value))
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** Vòng lặp Animated chạy mãi (trôi mây, mặt trời, la bàn); dừng khi giảm chuyển động. */
function useLoop(duration: number, options: { reverse?: boolean; easing?: (value: number) => number } = {}) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(0));
  const { reverse = true, easing = Easing.inOut(Easing.sin) } = options;
  useEffect(() => {
    if (reduced) {
      value.setValue(0);
      return;
    }
    const step = Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true });
    const loop = Animated.loop(
      reverse
        ? Animated.sequence([step, Animated.timing(value, { toValue: 0, duration, easing, useNativeDriver: true })])
        : step,
    );
    loop.start();
    return () => loop.stop();
  }, [duration, easing, reduced, reverse, value]);
  return value;
}

/** Hiện dần từ dưới lên khi gắn vào màn hình. */
export function FadeInUp({ delay = 0, children, style }: { delay?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : 480,
      delay: reduced ? 0 : delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** "Bật" nhẹ khi xuất hiện (dấu tích, nhãn trạng thái). */
export function PopIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(0.6));
  useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      return;
    }
    const animation = Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [reduced, scale]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** Đường đồng mức mờ làm nền. */
export function TopoLines({ color = "#ffffff", opacity = 0.08 }: { color?: string; opacity?: number }) {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <Path
          key={index}
          d={`M-20 ${40 + index * 34} C 60 ${10 + index * 34}, 120 ${70 + index * 34}, 200 ${40 + index * 34} S 340 ${10 + index * 34}, 420 ${46 + index * 34}`}
          stroke={color}
          strokeOpacity={opacity}
          strokeWidth={1.2}
          fill="none"
        />
      ))}
      <Path d="M300 60 a40 26 0 1 0 1 0 M300 72 a26 16 0 1 0 1 0" stroke={color} strokeOpacity={opacity} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

/** Dãy núi nhiều lớp ở chân banner. */
function MountainLayers() {
  return (
    <Svg pointerEvents="none" style={styles.mountains} viewBox="0 0 400 110" preserveAspectRatio="none">
      <Polygon points="0,110 0,70 50,40 90,62 140,22 190,58 230,34 280,64 330,28 400,60 400,110" fill="#ffffff" fillOpacity={0.06} />
      <Polygon points="0,110 0,84 60,58 110,80 170,50 220,78 270,56 330,82 400,64 400,110" fill="#ffffff" fillOpacity={0.09} />
      <Polygon points="0,110 0,96 70,80 130,94 200,74 260,92 320,80 400,92 400,110" fill="#0a2a1f" fillOpacity={0.55} />
      <Polyline points="140,22 133,30 140,28 147,32" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.5} fill="none" />
      <Polyline points="330,28 323,36 330,34 337,38" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

/** Banner núi rừng dùng cho đầu màn Tủ đồ và Kế hoạch đồ. */
export function MountainHero({
  eyebrow,
  title,
  highlight,
  description,
  icon = "compass-outline",
  children,
}: {
  eyebrow: string;
  title: string;
  highlight?: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children?: ReactNode;
}) {
  const sun = useLoop(3200);
  const cloud = useLoop(9000);
  return (
    <LinearGradient colors={[Trek.forest, Trek.forestMid, Trek.forestLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <TopoLines opacity={0.09} />
      <Animated.View
        pointerEvents="none"
        style={[styles.sun, { transform: [{ translateY: sun.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }]}
      >
        <View style={styles.sunGlow} />
        <View style={styles.sunCore} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.cloud, { transform: [{ translateX: cloud.interpolate({ inputRange: [0, 1], outputRange: [-24, 30] }) }] }]}
      >
        <Ionicons name="cloud" size={42} color="rgba(255,255,255,0.18)" />
      </Animated.View>
      <MountainLayers />
      <FadeInUp>
        <View style={styles.heroPill}>
          <Ionicons name={icon} size={12} color={Trek.mint} />
          <Text style={styles.heroPillText}>{eyebrow.toUpperCase()}</Text>
        </View>
        <Text style={styles.heroTitle}>
          {title}
          {highlight ? <Text style={styles.heroHighlight}>{`\n${highlight}`}</Text> : null}
        </Text>
        {description ? <Text style={styles.heroDescription}>{description}</Text> : null}
      </FadeInUp>
      {children ? <View style={styles.heroExtra}>{children}</View> : null}
    </LinearGradient>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const TRAIL: [number, number][] = [
  [10, 92], [56, 80], [92, 86], [136, 62], [172, 68], [212, 42], [248, 48], [286, 14],
];

function trailGeometry() {
  const lengths = [0];
  for (let index = 1; index < TRAIL.length; index += 1) {
    const [x0, y0] = TRAIL[index - 1];
    const [x1, y1] = TRAIL[index];
    lengths.push(lengths[index - 1] + Math.hypot(x1 - x0, y1 - y0));
  }
  const total = lengths[lengths.length - 1];
  return lengths.map((length) => length / total);
}

const STOPS = trailGeometry();

/** Đường mòn lên đỉnh: số yêu cầu đã sẵn sàng / tổng. Người leo đi tới vị trí tương ứng. */
export function SummitProgress({ value, total, dark = false, height = 96 }: { value: number; total: number; dark?: boolean; height?: number }) {
  const reduced = useReducedMotion();
  const ratio = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const stops = STOPS;
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, {
      toValue: ratio,
      duration: reduced ? 0 : 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, ratio, reduced]);

  const donePoints = useMemo(() => {
    const points: string[] = [];
    for (let index = 0; index < TRAIL.length; index += 1) {
      if (stops[index] <= ratio) {
        points.push(TRAIL[index].join(","));
        continue;
      }
      const [x0, y0] = TRAIL[index - 1];
      const [x1, y1] = TRAIL[index];
      const local = (ratio - stops[index - 1]) / (stops[index] - stops[index - 1]);
      points.push(`${x0 + (x1 - x0) * local},${y0 + (y1 - y0) * local}`);
      break;
    }
    return points.join(" ");
  }, [ratio, stops]);

  const cx = progress.interpolate({ inputRange: stops, outputRange: TRAIL.map(([x]) => x) });
  const cy = progress.interpolate({ inputRange: stops, outputRange: TRAIL.map(([, y]) => y - 6) });
  const reached = total > 0 && value >= total;
  const ridge = dark ? "rgba(255,255,255,0.12)" : "#e3ece4";
  return (
    <Svg width="100%" height={height} viewBox="0 -6 300 108" accessibilityLabel={`Đã sẵn sàng ${value}/${total}`}>
      <Polygon points={`0,102 ${TRAIL.map((point) => point.join(",")).join(" ")} 300,40 300,102`} fill={ridge} />
      <Polyline
        points={TRAIL.map((point) => point.join(",")).join(" ")}
        stroke={dark ? "rgba(255,255,255,0.45)" : "#c9d6cc"}
        strokeWidth={2.2}
        strokeDasharray="4 5"
        strokeLinecap="round"
        fill="none"
      />
      {ratio > 0 ? (
        <Polyline points={donePoints} stroke={dark ? Trek.sunPale : Trek.trail} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ) : null}
      <Path d="M286 14 L286 -4 L300 1 L286 6" stroke={dark ? "#ffffff" : Trek.ink} strokeWidth={1.6} fill={reached ? Trek.sun : dark ? "rgba(255,255,255,0.5)" : "#c9d6cc"} />
      <AnimatedCircle cx={cx} cy={cy} r={9} fill={dark ? Trek.sun : Trek.trail} fillOpacity={0.22} />
      <AnimatedCircle cx={cx} cy={cy} r={5.5} fill={dark ? Trek.sunPale : Trek.trail} stroke="#ffffff" strokeWidth={1.8} />
    </Svg>
  );
}

export type TrailStepState = "done" | "current" | "todo";

/** Các chặng chuẩn bị nối với nhau bằng đường mòn; chặng hiện tại có vòng sáng. */
export function TrailStepper({ steps }: { steps: { label: string; state: TrailStepState }[] }) {
  const pulse = useLoop(1100, { reverse: false, easing: Easing.out(Easing.quad) });
  return (
    <View style={styles.stepper}>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.stepperItem}>
          {index > 0 ? (
            <View style={[styles.stepperLine, steps[index - 1].state === "done" ? styles.stepperLineDone : null]} />
          ) : null}
          <View style={styles.stepperDotWrap}>
            {step.state === "current" ? (
              <Animated.View
                style={[
                  styles.stepperRing,
                  {
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
                  },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.stepperDot,
                step.state === "done" ? styles.stepperDotDone : step.state === "current" ? styles.stepperDotCurrent : null,
              ]}
            >
              {step.state === "done" ? (
                <Ionicons name="checkmark" size={13} color="#ffffff" />
              ) : (
                <Text style={[styles.stepperNumber, step.state === "current" && { color: "#ffffff" }]}>{index + 1}</Text>
              )}
            </View>
          </View>
          <Text numberOfLines={2} style={[styles.stepperLabel, step.state !== "todo" && { color: Trek.ink, fontWeight: "700" }]}>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Biển chỉ đường đánh số bước; đã xong thì đổi thành dấu tích xanh. */
export function TrailSign({ number, done }: { number: number; done: boolean }) {
  return (
    <View style={[styles.sign, done ? styles.signDone : null]}>
      {done ? (
        <PopIn>
          <Ionicons name="checkmark" size={15} color="#ffffff" />
        </PopIn>
      ) : (
        <Text style={styles.signText}>{number}</Text>
      )}
    </View>
  );
}

export type WeatherKind = "sun" | "cloud-sun" | "moon" | "rain";

const WEATHER: Record<WeatherKind, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  sun: { icon: "sunny", color: "#f59e0b", bg: "#fff4d6" },
  "cloud-sun": { icon: "partly-sunny", color: "#0ea5e9", bg: "#e6f5fd" },
  moon: { icon: "moon", color: "#6366f1", bg: "#eef0ff" },
  rain: { icon: "rainy", color: "#2563eb", bg: "#e6efff" },
};

export function WeatherGlyph({ kind, size = 40 }: { kind: WeatherKind; size?: number }) {
  const float = useLoop(kind === "rain" ? 900 : 2600);
  const meta = WEATHER[kind];
  return (
    <View style={[styles.glyph, { width: size, height: size, borderRadius: size / 2, backgroundColor: meta.bg }]}>
      <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, kind === "rain" ? 2 : -2] }) }] }}>
        <Ionicons name={meta.icon} size={size * 0.55} color={meta.color} />
      </Animated.View>
    </View>
  );
}

/** Độ khó dạng các đỉnh núi nhỏ. */
export function DifficultyPeaks({ level }: { level: number }) {
  return (
    <View style={styles.peaks} accessibilityLabel={`Độ khó ${level}/5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <Svg key={step} width={12} height={12} viewBox="0 0 10 10">
          <Path d="M0 10 L5 1 L10 10 Z" fill={step <= level ? (level >= 4 ? "#b45309" : Trek.trail) : "#dbe3dc"} />
        </Svg>
      ))}
    </View>
  );
}

/** Loader la bàn quay, dùng khi đang tải hoặc đang đánh giá. */
export function CompassLoader({ label }: { label: string }) {
  const spin = useLoop(1600, { reverse: false, easing: Easing.linear });
  return (
    <View style={styles.loader}>
      <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
        <Ionicons name="compass" size={26} color={Trek.trail} />
      </Animated.View>
      <Text style={styles.loaderText}>{label}</Text>
    </View>
  );
}

export const CATEGORY_TONE: Record<GearCategory, { bg: string; fg: string }> = {
  JACKET: { bg: "#e6f1fb", fg: "#1d5f8f" },
  PANTS: { bg: "#efeaf8", fg: "#5b4294" },
  FOOTWEAR: { bg: "#f6ece2", fg: "#8a5a33" },
  BACKPACK: { bg: "#e7f3ea", fg: "#2f6b4f" },
  SLEEPING_BAG: { bg: "#eceefb", fg: "#3f4aa0" },
  TENT: { bg: "#fbf0dc", fg: "#9a6400" },
  TREKKING_POLE: { bg: "#edf0f2", fg: "#475563" },
  RAIN_GEAR: { bg: "#e3f2f7", fg: "#11708a" },
};

const toneOf = (category: string) => CATEGORY_TONE[category as GearCategory] ?? CATEGORY_TONE.BACKPACK;

/** Ảnh món đồ; chưa có ảnh thì hiện ô màu theo loại đồ với icon. */
export function GearThumb({ url, category, size = 48, radius = 12 }: { url?: string | null; category: string; size?: number; radius?: number }) {
  const tone = toneOf(category);
  const icon = categoryInfo(category as GearCategory)?.icon ?? "cube-outline";
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: tone.bg }} />;
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: radius, backgroundColor: tone.bg }]}>
      <Ionicons name={icon} size={size * 0.46} color={tone.fg} />
    </View>
  );
}

/** Số thông số kỹ thuật đã biết / tổng số thông số của loại đồ. */
export function specCompleteness(item: Pick<UserGearItem, "category" | "attributes">) {
  const fields = gearAttributes(item.category);
  const known = fields.filter(([key]) => item.attributes?.[key] !== null && item.attributes?.[key] !== undefined && item.attributes?.[key] !== "").length;
  return { known, total: fields.length };
}

export function CompletenessBar({ known, total, showLabel = true }: { known: number; total: number; showLabel?: boolean }) {
  const ratio = total ? known / total : 0;
  const color = ratio >= 1 ? Trek.trail : ratio >= 0.5 ? "#d48a0a" : "#c2410c";
  return (
    <View style={styles.completeness}>
      <View style={styles.completenessTrack}>
        <View style={[styles.completenessFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
      </View>
      {showLabel ? <Text style={[styles.completenessText, { color }]}>{known}/{total} thông số</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", borderRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 64 },
  mountains: { position: "absolute", left: 0, right: 0, bottom: 0, height: 74 },
  sun: { position: "absolute", top: 18, right: 26, width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  sunGlow: { position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(253,230,138,0.22)" },
  sunCore: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fbbf24", opacity: 0.85 },
  cloud: { position: "absolute", top: 54, right: 60 },
  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  heroPillText: { color: Trek.mint, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  heroTitle: { marginTop: 12, paddingRight: 56, color: "#ffffff", fontSize: 25, lineHeight: 31, fontWeight: "800" },
  heroHighlight: { color: Trek.sunPale },
  heroDescription: { marginTop: 8, color: "rgba(236,253,245,0.8)", fontSize: 13, lineHeight: 19 },
  heroExtra: { marginTop: 16 },
  stepper: { flexDirection: "row" },
  stepperItem: { flex: 1, alignItems: "center" },
  stepperLine: { position: "absolute", top: 13, right: "50%", width: "100%", height: 2, backgroundColor: Trek.wood },
  stepperLineDone: { backgroundColor: Trek.trail },
  stepperDotWrap: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  stepperRing: { position: "absolute", width: 28, height: 28, borderRadius: 14, backgroundColor: Trek.trail },
  stepperDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Trek.wood,
    backgroundColor: "#ffffff",
  },
  stepperDotDone: { borderColor: Trek.trail, backgroundColor: Trek.trail },
  stepperDotCurrent: { borderColor: Trek.trail, backgroundColor: Trek.trail },
  stepperNumber: { color: Trek.muted, fontSize: 11, fontWeight: "800" },
  stepperLabel: { marginTop: 6, paddingHorizontal: 2, color: Trek.muted, fontSize: 10, textAlign: "center" },
  sign: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: Trek.wood },
  signDone: { backgroundColor: Trek.trail },
  signText: { color: Trek.woodDeep, fontSize: 14, fontWeight: "900" },
  glyph: { alignItems: "center", justifyContent: "center" },
  peaks: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  loader: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  loaderText: { flex: 1, color: Trek.muted, fontSize: 12, fontWeight: "600" },
  thumb: { alignItems: "center", justifyContent: "center" },
  completeness: { flexDirection: "row", alignItems: "center", gap: 8 },
  completenessTrack: { flex: 1, height: 5, overflow: "hidden", borderRadius: 3, backgroundColor: "#e6ece7" },
  completenessFill: { height: "100%", borderRadius: 3 },
  completenessText: { fontSize: 10, fontWeight: "700" },
});
