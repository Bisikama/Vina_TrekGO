import { Colors, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type EvidencePreview = {
  id: string;
  uri: string;
  kind: "image" | "video";
  durationMs?: number | null;
  /** Mặc định "done". "uploading" hiện vòng xoay, "error" hiện nút thử lại. */
  status?: "uploading" | "done" | "error";
  mediaId?: string;
  errorMessage?: string;
};

type Props = {
  items: EvidencePreview[];
  busy?: boolean;
  required?: boolean;
  onAddPhoto: () => void;
  onAddVideo: () => void;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
};

const formatDuration = (ms?: number | null) => {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Dải ảnh/video vừa chụp (kiểu màn đánh giá sản phẩm):
 * ô nhỏ có nút ✕ để bỏ, chạm để xem lớn, ô cuối để chụp thêm.
 */
export function EvidenceThumbStrip({
  items,
  busy,
  required,
  onAddPhoto,
  onAddVideo,
  onRemove,
  onRetry,
}: Props) {
  const [viewing, setViewing] = useState<EvidencePreview | null>(null);
  const isDone = (item: EvidencePreview) => (item.status ?? "done") === "done";
  const imageCount = items.filter((item) => item.kind === "image" && isDone(item)).length;
  const videoCount = items.filter((item) => item.kind === "video" && isDone(item)).length;
  const uploading = items.filter((item) => item.status === "uploading").length;
  const failed = items.filter((item) => item.status === "error").length;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Ảnh hiện trạng</Text>
        <Text style={[styles.count, required && imageCount === 0 && styles.countWarn]}>
          {imageCount} ảnh · {videoCount} video
          {uploading ? ` · đang tải ${uploading}` : ""}
          {failed ? ` · ${failed} lỗi` : ""}
          {required && imageCount === 0 && !uploading ? " · cần ít nhất 1 ảnh" : ""}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((item) => (
          <View key={item.id} style={styles.thumb}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.thumbInner}
              onPress={() => {
                if (item.status === "error") onRetry?.(item.id);
                else if (item.kind === "image") setViewing(item);
              }}
            >
              {item.kind === "image" ? (
                <Image source={{ uri: item.uri }} style={styles.thumbImage} />
              ) : (
                <View style={styles.videoTile}>
                  <Ionicons name="play-circle" size={28} color="#fff" />
                  {item.durationMs ? (
                    <Text style={styles.videoDuration}>
                      {formatDuration(item.durationMs)}
                    </Text>
                  ) : null}
                </View>
              )}
              {item.status === "uploading" ? (
                <View style={styles.overlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              ) : item.status === "error" ? (
                <View style={[styles.overlay, styles.overlayError]}>
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.overlayText}>Thử lại</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Bỏ ảnh này"
              hitSlop={8}
              style={styles.removeBadge}
              onPress={() => onRemove(item.id)}
            >
              <Ionicons name="close" size={12} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          disabled={busy}
          style={[styles.addTile, busy && styles.disabled]}
          onPress={onAddPhoto}
        >
          <Ionicons name="camera-outline" size={22} color={Colors.primaryDark} />
          <Text style={styles.addText}>{items.length ? "Chụp thêm" : "Chụp ảnh"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={busy}
          style={[styles.addTile, busy && styles.disabled]}
          onPress={onAddVideo}
        >
          <Ionicons name="videocam-outline" size={22} color={Colors.primaryDark} />
          <Text style={styles.addText}>Quay video</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={Boolean(viewing)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <Pressable style={styles.viewer} onPress={() => setViewing(null)}>
          {viewing ? (
            <Image
              source={{ uri: viewing.uri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.viewerActions}>
            <TouchableOpacity
              style={styles.viewerButton}
              onPress={() => {
                if (viewing) onRemove(viewing.id);
                setViewing(null);
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <Text style={styles.viewerButtonText}>Bỏ ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.viewerButton}
              onPress={() => setViewing(null)}
            >
              <Ionicons name="close" size={16} color="#fff" />
              <Text style={styles.viewerButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const TILE = 72;

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { color: Colors.ink, fontSize: 14, fontWeight: "600" },
  count: { color: Colors.onSurfaceVariant, fontSize: 13 },
  countWarn: { color: Colors.error },
  row: { gap: 8, paddingTop: 6, paddingRight: 6 },
  thumb: { width: TILE, height: TILE },
  thumbInner: {
    width: TILE,
    height: TILE,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.primaryPale,
  },
  thumbImage: { width: "100%", height: "100%" },
  videoTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2a1c",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  overlayError: { backgroundColor: "rgba(185,28,28,0.6)" },
  overlayText: { color: "#fff", fontSize: 12, fontWeight: "600", marginTop: 2 },
  videoDuration: { color: "#fff", fontSize: 12, marginTop: 2 },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(20,24,18,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    width: TILE,
    height: TILE,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#fafcf7",
  },
  addText: { color: Colors.primaryDark, fontSize: 12, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  viewer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  viewerImage: { width: "100%", height: "75%" },
  viewerActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  viewerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  viewerButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
