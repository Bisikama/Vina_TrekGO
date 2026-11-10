import { Button, ErrorAlert, InfoBanner, SurfaceCard, SurfaceSectionHeader } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/designTokens";
import { PublicTripPhoto } from "@/features/trips/components/PublicTripGallery";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { usePublicTripGallery } from "../hooks/usePublicTripGallery";

export function PublicTripGalleryEditor({ gallery, disabled, locked, children }: {
  gallery: ReturnType<typeof usePublicTripGallery>;
  disabled?: boolean;
  locked?: boolean;
  children?: ReactNode;
}) {
  const busy = disabled || gallery.isPicking || gallery.isUploading;
  const items = locked ? gallery.savedItems : gallery.items;

  return (
    <SurfaceCard>
      <SurfaceSectionHeader title="Ảnh chuyến đi" subtitle="Tối đa 10 ảnh. Ảnh đầu tiên là ảnh bìa." />
      <View style={styles.content}>
        {locked ? (
          <InfoBanner message="Chuyến ở trạng thái hiện tại chỉ cho xem ảnh đã lưu." />
        ) : (
          <>
            <Text style={styles.help}>Ảnh có thể xem công khai sau khi tải lên. Bạn có thể tiếp tục mà không chọn ảnh.</Text>
            <Button label={`Chọn ảnh (${items.length}/10)`} variant="secondary" disabled={busy || !gallery.canAdd} onPress={() => void gallery.pick()} />
            {gallery.pickerError && <ErrorAlert message={gallery.pickerError} />}
          </>
        )}
        {items.length === 0 && <Text style={styles.help}>Chưa có ảnh. Chuyến đi sẽ dùng ảnh mặc định.</Text>}
        {items.map((item, index) => (
          <View key={item.key} style={styles.item}>
            <PublicTripPhoto uri={item.uri} label={index === 0 ? "Ảnh bìa" : `Ảnh chuyến đi ${index + 1}`} />
            <Text style={styles.label}>{index === 0 ? "Ảnh bìa" : `Ảnh ${index + 1}`}</Text>
            {!locked && (
              <>
                {item.asset && (
                  <Text style={styles.help} accessibilityLiveRegion="polite">
                    {item.uploading ? "Đang tải…" : item.mediaId ? "Đã tải lên" : item.error ? "Tải thất bại" : "Chờ tải lên"}
                  </Text>
                )}
                {item.error && <ErrorAlert message={item.error} onRetry={busy ? undefined : () => void gallery.retry(item)} />}
                <View style={styles.actions}>
                  <Button label="Lên" variant="secondary" size="sm" disabled={busy || index === 0} onPress={() => gallery.move(index, -1)} />
                  <Button label="Xuống" variant="secondary" size="sm" disabled={busy || index === items.length - 1} onPress={() => gallery.move(index, 1)} />
                  <Button label="Gỡ" variant="ghost" size="sm" disabled={busy} onPress={() => gallery.remove(item.key)} />
                </View>
              </>
            )}
          </View>
        ))}
        {children}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.sm },
  help: { color: Colors.textSecondary, fontSize: 13 },
  item: { padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, gap: Spacing.xs },
  label: { color: Colors.primaryDeep, fontSize: 13, fontWeight: "700" },
  actions: { flexDirection: "row", gap: Spacing.xs, flexWrap: "wrap" },
});
