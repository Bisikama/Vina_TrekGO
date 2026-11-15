import * as ImagePicker from "expo-image-picker";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import type { EvidencePreview } from "./EvidenceThumbStrip";
import { uploadInventoryEvidence } from "./staff-inventory-api";

type EvidenceScope = "CONDITION_EVIDENCE" | "RETURN_EVIDENCE";

type UploadItem = EvidencePreview & {
  unitId: string;
  asset: ImagePicker.ImagePickerAsset;
};

let localCounter = 0;
const nextLocalId = () => `local-${Date.now()}-${(localCounter += 1)}`;

function uploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Video metadata missing duration")) {
    return "Không đọc được thông tin video, hãy quay lại.";
  }
  return message || "Tải lên thất bại.";
}

/**
 * Chụp/quay bằng chứng cho nhiều món cùng lúc.
 * Mỗi ảnh tải lên nền và độc lập: vừa chụp món A xong có thể chụp ngay món B,
 * không phải chờ ảnh A tải xong. Ảnh lỗi hiện nút thử lại riêng.
 */
export function useEvidenceUploads(
  accessToken: string | null | undefined,
  scope?: EvidenceScope,
) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const removed = useRef(new Set<string>());

  const patch = useCallback((id: string, update: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  }, []);

  const startUpload = useCallback(
    async (item: UploadItem) => {
      if (!accessToken) return;
      patch(item.id, { status: "uploading", errorMessage: undefined });
      try {
        const mediaId = await uploadInventoryEvidence(
          item.asset,
          accessToken,
          scope ? { scope } : undefined,
        );
        if (!removed.current.has(item.id)) {
          patch(item.id, { status: "done", mediaId });
        }
      } catch (error) {
        if (!removed.current.has(item.id)) {
          patch(item.id, { status: "error", errorMessage: uploadErrorMessage(error) });
        }
      }
    },
    [accessToken, patch, scope],
  );

  const capture = useCallback(
    async (unitId: string, kind: "image" | "video") => {
      if (!accessToken || cameraOpen) return;
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Cần quyền camera", "Hãy cấp quyền để ghi lại hiện trạng thiết bị.");
        return;
      }
      setCameraOpen(true);
      try {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: kind === "video" ? ["videos"] : ["images"],
          allowsEditing: false,
          quality: kind === "image" ? 0.8 : 0.7,
          videoMaxDuration: kind === "video" ? 20 : undefined,
        });
        const asset = result.canceled ? undefined : result.assets[0];
        if (!asset) return;
        const item: UploadItem = {
          id: nextLocalId(),
          unitId,
          uri: asset.uri,
          kind,
          durationMs: asset.duration,
          status: "uploading",
          asset,
        };
        setItems((current) => [...current, item]);
        // Không await: tải nền để chụp tiếp món khác ngay.
        void startUpload(item);
      } finally {
        setCameraOpen(false);
      }
    },
    [accessToken, cameraOpen, startUpload],
  );

  const remove = useCallback((id: string) => {
    removed.current.add(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const retry = useCallback(
    (id: string) => {
      const item = items.find((entry) => entry.id === id);
      if (item) void startUpload(item);
    },
    [items, startUpload],
  );

  const previewsFor = useCallback(
    (unitId: string): EvidencePreview[] => items.filter((item) => item.unitId === unitId),
    [items],
  );

  /** Chỉ lấy media đã tải xong, dùng khi gửi API. */
  const idsFor = useCallback(
    (unitId: string) => {
      const done = items.filter(
        (item) => item.unitId === unitId && item.status === "done" && item.mediaId,
      );
      return {
        imageIds: done.filter((item) => item.kind === "image").map((item) => item.mediaId as string),
        videoIds: done.filter((item) => item.kind === "video").map((item) => item.mediaId as string),
      };
    },
    [items],
  );

  const clearUnit = useCallback((unitId: string) => {
    setItems((current) => current.filter((item) => item.unitId !== unitId));
  }, []);

  const uploadingCount = useMemo(
    () => items.filter((item) => item.status === "uploading").length,
    [items],
  );
  const failedCount = useMemo(
    () => items.filter((item) => item.status === "error").length,
    [items],
  );

  return {
    capture,
    cameraOpen,
    remove,
    retry,
    previewsFor,
    idsFor,
    clearUnit,
    uploadingCount,
    failedCount,
  };
}
