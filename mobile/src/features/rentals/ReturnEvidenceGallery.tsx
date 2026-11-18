import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors, Radius } from "@/constants/theme";
import { deductionReviewApi, type EvidenceMedia } from "@/features/rentals/deduction-review-api";

/**
 * Ảnh/video bằng chứng đã có (giao hàng chụp khi nhận, hoặc lúc giao cho khách).
 * `autoLoad` để tải ngay (món giao hàng báo có vấn đề); không thì chạm để tải.
 */
export function ReturnEvidenceGallery({
  ids,
  label,
  accessToken,
  autoLoad = false,
}: {
  ids: string[];
  label: string;
  accessToken?: string | null;
  autoLoad?: boolean;
}) {
  const [open, setOpen] = useState(autoLoad);
  const [media, setMedia] = useState<EvidenceMedia[]>();
  const [failed, setFailed] = useState(0);

  // Chuỗi ổn định: mảng `ids` là mảng mới mỗi lần cha render.
  const idsKey = ids.join(",");

  useEffect(() => {
    if (!open || media || !accessToken || !idsKey) return;
    let active = true;
    void Promise.allSettled(
      idsKey.split(",").map((id) => deductionReviewApi.getEvidenceMedia(id, accessToken)),
    ).then((settled) => {
      if (!active) return;
      setMedia(settled.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : [])));
      setFailed(settled.filter((entry) => entry.status === "rejected").length);
    });
    return () => {
      active = false;
    };
  }, [open, media, accessToken, idsKey]);

  if (!ids.length) return <Text style={styles.muted}>{label}: không có ảnh.</Text>;

  return (
    <View>
      <TouchableOpacity onPress={() => setOpen((current) => !current)}>
        <Text style={styles.link}>{open ? `Ẩn ${label.toLowerCase()}` : `${label} (${ids.length})`}</Text>
      </TouchableOpacity>
      {open ? (
        !media ? (
          <ActivityIndicator style={styles.loader} color={Colors.primaryDark} />
        ) : (
          <View style={styles.grid}>
            {media.map((entry) =>
              entry.resourceType === "VIDEO" ? (
                <TouchableOpacity key={entry.mediaId} style={styles.video} onPress={() => void Linking.openURL(entry.url)}>
                  <Text style={styles.videoText}>▶ Video</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity key={entry.mediaId} onPress={() => void Linking.openURL(entry.url)}>
                  <Image source={{ uri: entry.url }} style={styles.thumb} />
                </TouchableOpacity>
              ),
            )}
            {failed > 0 ? <Text style={styles.warn}>{failed} tệp không tải được.</Text> : null}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { color: Colors.primaryDark, fontSize: 13, fontWeight: "600", textDecorationLine: "underline", marginTop: 6 },
  muted: { color: Colors.onSurfaceMuted, fontSize: 12, marginTop: 6 },
  loader: { marginTop: 8, alignSelf: "flex-start" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  thumb: { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainer },
  video: { width: 72, height: 72, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", backgroundColor: Colors.inkDeep },
  videoText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  warn: { color: "#7A4B00", fontSize: 12 },
});
