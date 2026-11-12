"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicTripImage } from "@/features/trips/types/public-trip-images";
import { galleryErrorMessage, uploadPublicTripImage } from "../services/public-trip-images.api";

const imageTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export const publicTripImageAccept = [...new Set(Object.values(imageTypes)), ".heic", ".heif"].join(",");
export const publicTripImageLimit = 10;

interface GalleryItem {
  key: string;
  url: string;
  mediaId?: string;
  file?: File;
  contentType?: string;
  uploading?: boolean;
  error?: string;
}

interface GalleryDraft {
  items: GalleryItem[];
  originalIds: string[];
}

export function usePublicTripGallery(savedImages: PublicTripImage[] = []) {
  const [draft, setDraft] = useState<GalleryDraft | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const objectUrls = useRef(new Set<string>());
  const uploadController = useRef<AbortController | null>(null);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      uploadController.current?.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const savedIds = savedImages.map((image) => image.mediaId);
  const savedItems: GalleryItem[] = savedImages.map(({ mediaId, url }) => ({ key: mediaId, mediaId, url }));
  const items = draft?.items ?? savedItems;
  const originalIds = draft?.originalIds ?? savedIds;
  const changed = items.length !== originalIds.length || items.some((item, index) => item.mediaId !== originalIds[index]);
  const hasServerChanges = changed && (originalIds.length !== savedIds.length || originalIds.some((id, index) => id !== savedIds[index]));

  function edit(next: GalleryItem[]) {
    const unchanged = next.length === originalIds.length && next.every((item, index) => item.mediaId === originalIds[index]);
    setDraft(unchanged ? null : { items: next, originalIds });
  }

  function addFiles(files: FileList) {
    const next: GalleryItem[] = [...items];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (next.length >= publicTripImageLimit) {
        errors.push(`Mỗi chuyến được chọn tối đa ${publicTripImageLimit} ảnh.`);
        break;
      }
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      const contentType = Object.values(imageTypes).includes(file.type) ? file.type : imageTypes[extension];
      if (!contentType || file.size === 0) {
        errors.push(`${file.name} cần là ảnh JPEG, PNG, WebP, HEIC hoặc HEIF hợp lệ.`);
        continue;
      }

      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      next.push({ key: url, url, file, contentType });
    }

    if (next.length !== items.length) edit(next);
    setSelectionError(errors.join(" "));
  }

  function remove(key: string) {
    if (objectUrls.current.delete(key)) URL.revokeObjectURL(key);
    edit(items.filter((item) => item.key !== key));
    setSelectionError("");
  }

  function move(index: number, offset: number) {
    const next = [...items];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    edit(next);
  }

  function reset() {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
    setDraft(null);
    setSelectionError("");
  }

  async function upload(selection: GalleryItem[]) {
    const pending = selection.filter((item) => !item.mediaId);
    if (!pending.length) return selection.map((item) => item.mediaId!);
    if (uploadController.current) return null;

    const controller = new AbortController();
    uploadController.current = controller;
    setIsUploading(true);
    const uploaded = new Map<string, string>();

    function updateItem(key: string, updates: Partial<GalleryItem>) {
      setDraft((current) => current && {
        ...current,
        items: current.items.map((item) => item.key === key ? { ...item, ...updates } : item),
      });
    }

    try {
      for (let index = 0; index < pending.length && !controller.signal.aborted; index += 3) {
        await Promise.all(pending.slice(index, index + 3).map(async (item) => {
          updateItem(item.key, { uploading: true, error: undefined });
          try {
            const mediaId = await uploadPublicTripImage(item.file!, item.contentType!, controller.signal);
            uploaded.set(item.key, mediaId);
            updateItem(item.key, { mediaId, uploading: false });
          } catch (error) {
            if (!controller.signal.aborted) {
              updateItem(item.key, { uploading: false, error: galleryErrorMessage(error, "Không thể tải ảnh lên.") });
            }
          }
        }));
      }
      const ids = selection.map((item) => item.mediaId ?? uploaded.get(item.key));
      return ids.every((id): id is string => Boolean(id)) ? ids : null;
    } finally {
      uploadController.current = null;
      if (!controller.signal.aborted) setIsUploading(false);
    }
  }

  return {
    items,
    savedItems,
    changed,
    hasServerChanges,
    selectionError,
    isUploading,
    addFiles,
    remove,
    move,
    reset,
    prepare: () => upload(items),
    retry: (item: GalleryItem) => upload([item]),
  };
}
