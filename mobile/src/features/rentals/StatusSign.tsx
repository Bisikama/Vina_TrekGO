import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

// Nhãn trạng thái đơn thuê dạng biển gỗ chỉ đường (cùng màu với web /rentals/orders):
// đầu nhọn, vân gỗ, viền khắc, đinh bên trái. Hình biển vẽ bằng SVG theo kích thước chữ.

type SignTone = { top: string; bottom: string; ink: string };

const TONES: Record<string, SignTone> = {
  PENDING_PAYMENT: { top: "#B97A12", bottom: "#94600A", ink: "#FFF6E2" },
  PAID: { top: "#46799A", bottom: "#355F7B", ink: "#FFFFFF" },
  PREPARING: { top: "#46799A", bottom: "#355F7B", ink: "#FFFFFF" },
  READY_FOR_HANDOVER: { top: "#46799A", bottom: "#355F7B", ink: "#FFFFFF" },
  ACTIVE: { top: "#2A7177", bottom: "#1E575C", ink: "#FFFFFF" },
  RETURN_PENDING: { top: "#8A5A33", bottom: "#6B4122", ink: "#FBEFD9" },
  RETURN_PROCESSING: { top: "#8A5A33", bottom: "#6B4122", ink: "#FBEFD9" },
  COMPLETED: { top: "#3A9A4B", bottom: "#2A7A39", ink: "#FFFFFF" },
  CANCELLED: { top: "#C04E39", bottom: "#9C3826", ink: "#FFFFFF" },
  EXPIRED: { top: "#7D776F", bottom: "#615C55", ink: "#FFFFFF" },
};

const FALLBACK: SignTone = { top: "#7D776F", bottom: "#615C55", ink: "#FFFFFF" };
const TIP = 9;
const RADIUS = 3;

function signPath(width: number, height: number, inset = 0) {
  const w = width - inset;
  const h = height - inset;
  const s = inset;
  return `M${s + RADIUS} ${s} H${w - TIP} L${w} ${height / 2} L${w - TIP} ${h} H${s + RADIUS} Q${s} ${h} ${s} ${h - RADIUS} V${s + RADIUS} Q${s} ${s} ${s + RADIUS} ${s}Z`;
}

let signCounter = 0;

export function StatusSign({ status, label, style }: { status: string; label: string; style?: StyleProp<ViewStyle> }) {
  const tone = TONES[status] ?? FALLBACK;
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [id] = useState(() => `sign-${++signCounter}`);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!size || Math.abs(size.width - width) > 0.5 || Math.abs(size.height - height) > 0.5) {
      setSize({ width, height });
    }
  };

  const grain: number[] = [];
  if (size) for (let x = 4; x < size.width - TIP; x += 6) grain.push(x);

  return (
    <View style={[styles.sign, style]} onLayout={onLayout}>
      {size ? (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tone.top} />
              <Stop offset="1" stopColor={tone.bottom} />
            </LinearGradient>
            <ClipPath id={`${id}-shape`}>
              <Path d={signPath(size.width, size.height)} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${id}-shape)`}>
            <Rect width={size.width} height={size.height} fill={`url(#${id}-wood)`} />
            {grain.map((x) => (
              <Rect key={x} x={x} y={1} width={1.2} height={size.height - 2} fill="rgba(255,255,255,0.05)" />
            ))}
            <Rect width={size.width} height={1} fill="rgba(255,255,255,0.22)" />
            <Rect y={size.height - 2} width={size.width} height={2} fill="rgba(0,0,0,0.18)" />
          </G>
          <Path d={signPath(size.width, size.height, 0.5)} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
          <Circle cx={9} cy={size.height / 2} r={2.5} fill="rgba(0,0,0,0.3)" />
          <Circle cx={9} cy={size.height / 2 - 0.8} r={1} fill="rgba(255,255,255,0.25)" />
        </Svg>
      ) : null}
      <Text style={[styles.label, { color: tone.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sign: {
    alignSelf: "flex-start",
    flexShrink: 0,
    paddingLeft: 17,
    paddingRight: 17,
    paddingVertical: 5,
  },
  label: { fontSize: 11, fontWeight: "500", letterSpacing: 0.1 },
});
