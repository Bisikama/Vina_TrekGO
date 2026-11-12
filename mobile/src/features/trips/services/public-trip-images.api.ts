import { File as DeviceFile, UploadType } from "expo-file-system";
import type { ImagePickerAsset } from "expo-image-picker";
import { fetch } from "expo/fetch";
import { Platform } from "react-native";
import { ApiError, apiRequest } from "@/lib/api-client";

export interface PublicTripImage {
  mediaId: string;
  position: number;
  url: string;
  width: number;
  height: number;
}

export interface PublicTripImageFields {
  images?: PublicTripImage[];
  coverImage?: PublicTripImage | null;
  imageCount?: number;
}

interface UploadIntent {
  mediaId: string;
  upload: { uploadUrl: string; method: "POST"; formFields: Record<string, string | number | boolean> };
}

interface UploadReceipt {
  public_id: string;
  version: number;
  signature: string;
}

interface GallerySaveResult extends Required<PublicTripImageFields> {
  tripId: string;
  version: number;
}

const imageFormats: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

async function openPickedImage(asset: ImagePickerAsset, signal: AbortSignal): Promise<Blob> {
  if (Platform.OS === "web") {
    if (asset.file) return asset.file;
    const response = await fetch(asset.uri, { signal });
    if (response.ok) return response.blob();
  } else {
    try {
      const file = new DeviceFile(asset.uri);
      if (file.exists) return file;
    } catch {
      // The picker URI may no longer be accessible on the device.
    }
  }
  throw new Error("Không mở được ảnh đã chọn. Hãy gỡ ảnh này và chọn lại từ thư viện.");
}

async function sendSignedImage(
  image: Blob,
  fileName: string,
  contentType: string,
  upload: UploadIntent["upload"],
  signal: AbortSignal,
) {
  const fields = Object.entries(upload.formFields).map(([key, value]) => [key, String(value)] as const);
  if (image instanceof DeviceFile) {
    return image.upload(upload.uploadUrl, {
      httpMethod: upload.method,
      uploadType: UploadType.MULTIPART,
      fieldName: "file",
      mimeType: contentType,
      parameters: Object.fromEntries(fields),
      sessionType: "foreground",
      signal,
    });
  }

  const form = new FormData();
  for (const [key, value] of fields) form.append(key, value);
  form.append("file", image.type === contentType ? image : image.slice(0, image.size, contentType), fileName);
  const response = await fetch(upload.uploadUrl, { method: upload.method, body: form, signal });
  return { status: response.status, body: await response.text() };
}

function parseUploadReceipt(body: string): UploadReceipt {
  let receipt: Partial<UploadReceipt> | null = null;
  try {
    receipt = JSON.parse(body);
  } catch {
    // Report an invalid upload response instead of sending it to the media API.
  }
  if (!receipt || typeof receipt.public_id !== "string" || !receipt.public_id ||
    typeof receipt.version !== "number" || !Number.isSafeInteger(receipt.version) ||
    typeof receipt.signature !== "string" || !receipt.signature) {
    throw new Error("Kho ảnh trả về kết quả tải lên không hợp lệ. Vui lòng thử lại.");
  }
  return { public_id: receipt.public_id, version: receipt.version, signature: receipt.signature };
}

export function isGalleryEditable(status: string) {
  return ["DRAFT", "OPEN", "FULL", "CLOSED"].includes(status);
}

export function galleryRequiresReload(error: unknown) {
  return error instanceof ApiError && (
    error.code === "PUBLIC_TRIP_IMAGES_VERSION_CONFLICT" ||
    error.code === "PUBLIC_TRIP_IMAGES_LOCKED" ||
    error.status === 0 || error.status >= 500
  );
}

export function getPublicTripImages(tripId: string) {
  return apiRequest<PublicTripImageFields>(`/api/v1/public-trips/${encodeURIComponent(tripId)}`);
}

export function savePublicTripImages(tripId: string, expectedVersion: number, mediaIds: string[], accessToken: string) {
  return apiRequest<GallerySaveResult>(`/api/v1/leader/public-trips/${encodeURIComponent(tripId)}/images`, {
    method: "PUT",
    accessToken,
    body: JSON.stringify({ expectedVersion, mediaIds }),
  });
}

export async function uploadPublicTripImage(asset: ImagePickerAsset, accessToken: string, signal: AbortSignal) {
  const image = await openPickedImage(asset, signal);
  const sizeBytes = image.size;
  if (!sizeBytes) throw new Error("Ảnh đã chọn không có dữ liệu. Hãy chọn lại ảnh.");

  const extension = (asset.fileName ?? asset.uri).split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  const inferredType = Object.keys(imageFormats).find((type) => imageFormats[type] === extension);
  const pickedType = asset.mimeType?.trim().toLowerCase();
  const contentType = pickedType && pickedType !== "application/octet-stream"
    ? pickedType
    : inferredType ?? (extension === "jpeg" ? "image/jpeg" : image.type);
  if (!Object.hasOwn(imageFormats, contentType)) throw new Error("Chọn ảnh JPEG, PNG, WebP, HEIC hoặc HEIF.");
  const fileName = asset.fileName || `trip-photo.${imageFormats[contentType]}`;
  if (signal.aborted) throw new Error("Đã hủy tải ảnh.");

  const intent = await apiRequest<UploadIntent>("/api/v1/media/upload-intents", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ scope: "PUBLIC_TRIP", resourceType: "IMAGE", fileName, contentType, sizeBytes, captureSource: "GALLERY" }),
  });

  const response = await sendSignedImage(image, fileName, contentType, intent.upload, signal);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Kho ảnh từ chối tải lên (HTTP ${response.status}). Vui lòng thử lại.`);
  }
  const uploaded = parseUploadReceipt(response.body);
  if (signal.aborted) throw new Error("Đã hủy tải ảnh.");
  const completed = await apiRequest<{ status: string }>(`/api/v1/media/${encodeURIComponent(intent.mediaId)}/complete`, {
    method: "POST",
    accessToken,
    timeoutMs: 30_000,
    body: JSON.stringify({ publicId: uploaded.public_id, version: uploaded.version, signature: uploaded.signature }),
  });
  if (completed.status !== "READY") throw new Error("Ảnh chưa sẵn sàng. Vui lòng thử lại.");
  return intent.mediaId;
}
