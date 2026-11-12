import { Button } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/designTokens";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import type { PublicTripImage } from "../services/public-trip-images.api";

const defaultPhoto = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=720&q=80";

export function PublicTripPhoto({ uri = defaultPhoto, label, style, fit = "cover", onDimensions }: {
  uri?: string;
  label: string;
  style?: StyleProp<ViewStyle>;
  fit?: "cover" | "contain";
  onDimensions?: (width: number, height: number) => void;
}) {
  const [failed, setFailed] = useState<string>();
  return (
    <View style={[styles.frame, style]}>
      {failed === uri ? (
        <View style={styles.placeholder} accessible accessibilityLabel={`${label} · Ảnh không hiển thị`}>
          <Ionicons name="image-outline" size={24} color={Colors.textSecondary} />
        </View>
      ) : (
        <Image
          source={uri}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          accessibilityLabel={label}
          recyclingKey={uri}
          onLoad={onDimensions ? ({ source }) => onDimensions(source.width, source.height) : undefined}
          onError={() => setFailed(uri)}
        />
      )}
    </View>
  );
}

export function PublicTripGallery({ images, title, fallback }: {
  images?: PublicTripImage[];
  title: string;
  fallback?: string;
}) {
  const [selected, setSelected] = useState(0);
  const [loadedSize, setLoadedSize] = useState<{ uri: string; ratio: number }>();
  const [availableWidth, setAvailableWidth] = useState(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const count = images?.length ?? 0;
  const index = Math.min(selected, Math.max(0, count - 1));
  const photo = images?.[index];
  const uri = photo?.url ?? fallback ?? defaultPhoto;
  const initialRatio = photo && photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 16 / 9;
  const aspectRatio = loadedSize?.uri === uri ? loadedSize.ratio : initialRatio;
  const galleryWidth = Math.min(availableWidth, windowWidth);
  const maxPhotoHeight = Math.min(windowHeight * 0.7, 600);
  const photoWidth = Math.min(galleryWidth, maxPhotoHeight * aspectRatio);
  const stageWidth = Math.min(galleryWidth, count > 1 ? Math.max(220, photoWidth + 88) : photoWidth);
  const nextUrl = count > 1 ? images?.[(index + 1) % count]?.url : undefined;
  useEffect(() => {
    if (nextUrl) void Image.prefetch(nextUrl).catch(() => {});
  }, [nextUrl]);

  return (
    <View style={styles.gallery} onLayout={({ nativeEvent }) => setAvailableWidth(nativeEvent.layout.width)}>
      <View style={[styles.stage, { width: stageWidth }]}>
        <PublicTripPhoto
          key={uri}
          uri={uri}
          label={photo ? `${title} · Ảnh ${index + 1}/${count}` : title}
          fit="contain"
          style={{ width: photoWidth, height: photoWidth / aspectRatio, aspectRatio: undefined }}
          onDimensions={(width, height) => {
            if (width > 0 && height > 0 && width / height !== aspectRatio) {
              setLoadedSize({ uri, ratio: width / height });
            }
          }}
        />
        {count > 1 && (
          <View pointerEvents="box-none" style={styles.controls}>
            <Button label="Ảnh trước" size="sm" variant="secondary" onPress={() => setSelected((index + count - 1) % count)} />
            <Button label="Ảnh sau" size="sm" variant="secondary" onPress={() => setSelected((index + 1) % count)} />
          </View>
        )}
      </View>
      {count > 1 && (
        <View style={styles.dots}>
          {images?.map((image, position) => (
            <Pressable
              key={image.mediaId}
              accessibilityRole="button"
              accessibilityLabel={`Xem ảnh ${position + 1}`}
              accessibilityState={{ selected: position === index }}
              onPress={() => setSelected(position)}
              style={styles.dotTarget}
            >
              <View style={[styles.dot, position === index && styles.activeDot]} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gallery: { width: "100%" },
  stage: { alignSelf: "center", alignItems: "center", justifyContent: "center", minHeight: 44 },
  frame: { aspectRatio: 16 / 9, overflow: "hidden", borderRadius: Radius.md, backgroundColor: Colors.canvas },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  controls: { position: "absolute", left: Spacing.sm, right: Spacing.sm, top: 0, bottom: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dots: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  dotTarget: { width: 28, height: 36, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  activeDot: { backgroundColor: Colors.primary },
});
