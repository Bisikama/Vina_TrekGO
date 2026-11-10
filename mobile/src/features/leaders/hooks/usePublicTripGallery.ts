import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadPublicTripImage, type PublicTripImage } from "@/features/trips/services/public-trip-images.api";

const IMAGE_LIMIT = 10;

interface GalleryItem {
  key: string;
  uri: string;
  mediaId?: string;
  asset?: ImagePicker.ImagePickerAsset;
  uploading?: boolean;
  error?: string;
}

export function usePublicTripGallery(accessToken?: string | null) {
  const [images, setImages] = useState<PublicTripImage[]>([]);
  const [selection, setSelection] = useState<GalleryItem[] | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const nextKey = useRef(0);
  const picking = useRef(false);
  const upload = useRef<AbortController | null>(null);

  useEffect(() => () => upload.current?.abort(), []);

  const savedItems: GalleryItem[] = images.map((image) => ({ key: image.mediaId, mediaId: image.mediaId, uri: image.url }));
  const items = selection ?? savedItems;
  const changed = items.length !== images.length || items.some((item, index) => item.mediaId !== images[index]?.mediaId);

  const reset = useCallback((saved: PublicTripImage[] = []) => {
    setImages(saved);
    setSelection(null);
    setPickerError(null);
  }, []);

  async function pick() {
    const remaining = IMAGE_LIMIT - items.length;
    if (remaining <= 0 || picking.current || upload.current) return;
    picking.current = true;
    setIsPicking(true);
    setPickerError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });
      if (result.canceled) return;
      const added = result.assets.slice(0, remaining).map((asset) => ({
        key: `picked-${nextKey.current++}`,
        uri: asset.uri,
        asset,
      }));
      setSelection([...items, ...added]);
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : "Không thể mở thư viện ảnh.");
    } finally {
      picking.current = false;
      setIsPicking(false);
    }
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setSelection(next);
  }

  async function prepare(selected: GalleryItem[]) {
    if (!accessToken || picking.current || upload.current) return null;
    const pending = selected.filter((item) => item.asset && !item.mediaId);
    if (!pending.length) return selected.map((item) => item.mediaId!);

    const controller = new AbortController();
    upload.current = controller;
    setIsUploading(true);
    const uploaded = new Map<string, string>();
    const patch = (key: string, fields: Partial<GalleryItem>) => {
      setSelection((current) => current?.map((item) => item.key === key ? { ...item, ...fields } : item) ?? null);
    };

    try {
      for (let index = 0; index < pending.length && !controller.signal.aborted; index += 3) {
        await Promise.all(pending.slice(index, index + 3).map(async (item) => {
          patch(item.key, { uploading: true, error: undefined });
          try {
            const mediaId = await uploadPublicTripImage(item.asset!, accessToken, controller.signal);
            uploaded.set(item.key, mediaId);
            if (!controller.signal.aborted) patch(item.key, { mediaId, uploading: false });
          } catch (error) {
            if (!controller.signal.aborted) patch(item.key, {
              uploading: false,
              error: error instanceof Error ? error.message : "Không thể tải ảnh lên.",
            });
          }
        }));
      }
      const ids = selected.map((item) => item.mediaId ?? uploaded.get(item.key));
      return !controller.signal.aborted && ids.every((id): id is string => !!id) ? ids : null;
    } finally {
      upload.current = null;
      if (!controller.signal.aborted) setIsUploading(false);
    }
  }

  return {
    images, items, savedItems, changed, pickerError, isPicking, isUploading,
    canAdd: items.length < IMAGE_LIMIT,
    pick, move, reset,
    remove: (key: string) => setSelection(items.filter((item) => item.key !== key)),
    prepare: () => prepare(items),
    retry: (item: GalleryItem) => prepare([item]),
  };
}
