import axios from "axios";
import { apiClient } from "@/lib/axios";
import type { SavedPublicTripGallery } from "@/features/trips/types/public-trip-images";

interface UploadIntent {
  mediaId: string;
  upload: {
    uploadUrl: string;
    method: string;
    formFields: Record<string, string | number | boolean>;
  };
}

interface CloudinaryUpload {
  public_id: string;
  version: number;
  signature: string;
}

interface GalleryErrorBody {
  error?: { code?: string; message?: string };
}

export function galleryErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<GalleryErrorBody>(error)) {
    return error.response?.data?.error?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export function galleryRequiresReload(error: unknown) {
  if (!axios.isAxiosError<GalleryErrorBody>(error)) return false;
  const code = error.response?.data?.error?.code;
  return code === "PUBLIC_TRIP_IMAGES_VERSION_CONFLICT" || code === "PUBLIC_TRIP_IMAGES_LOCKED";
}

export async function uploadPublicTripImage(file: File, contentType: string, signal: AbortSignal) {
  const { data: intent } = await apiClient.post<UploadIntent>("/api/v1/media/upload-intents", {
    scope: "PUBLIC_TRIP",
    resourceType: "IMAGE",
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
    captureSource: "GALLERY",
  }, { signal });

  const form = new FormData();
  for (const [key, value] of Object.entries(intent.upload.formFields)) {
    form.append(key, String(value));
  }
  form.append("file", file);

  const response = await fetch(intent.upload.uploadUrl, {
    method: intent.upload.method,
    body: form,
    signal,
  });
  if (!response.ok) throw new Error("Không thể tải ảnh lên kho lưu trữ. Vui lòng thử lại.");

  const uploaded: CloudinaryUpload = await response.json();
  const { data: completed } = await apiClient.post<{ status: string }>(
    `/api/v1/media/${intent.mediaId}/complete`,
    { publicId: uploaded.public_id, version: uploaded.version, signature: uploaded.signature },
    { signal },
  );
  if (completed.status !== "READY") throw new Error("Ảnh chưa sẵn sàng. Vui lòng thử tải lại ảnh.");
  return intent.mediaId;
}

export async function savePublicTripGallery(tripId: string, expectedVersion: number, mediaIds: string[]) {
  const { data } = await apiClient.put<SavedPublicTripGallery>(
    `/api/v1/leader/public-trips/${tripId}/images`,
    { expectedVersion, mediaIds },
  );
  return data;
}
