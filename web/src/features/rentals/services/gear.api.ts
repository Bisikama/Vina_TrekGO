import { apiClient } from "@/lib/axios";

type Envelope<T> = T | { data: T };
const unwrap = <T,>(payload: Envelope<T>) =>
  payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: T }).data
    : (payload as T);

export type GearCategory = "JACKET" | "FOOTWEAR" | "PANTS" | "BACKPACK" | "SLEEPING_BAG" | "TENT" | "TREKKING_POLE" | "RAIN_GEAR";
export type GearCondition = "new" | "good" | "worn" | "poor";
export type GearSource = "manual" | "ai_image" | "ai_link";
export type UserGearPhoto = { id: string; storageRef: string; position: number };
export type UserGearItem = {
  id: string; name: string; category: GearCategory; brand: string | null;
  condition: GearCondition; attributes: Record<string, unknown>;
  photoRef: string | null; photos?: UserGearPhoto[]; photoUrl?: string;
  source: GearSource; version: number; createdAt: string; updatedAt: string;
};
export type GearItemInput = {
  name: string; category: GearCategory; brand?: string | null;
  condition: GearCondition; attributes?: Record<string, unknown>;
  photoRef?: string | null; acknowledgeDuplicate?: boolean;
};
export type GearExtractionDraft = {
  id: string; sourceType: "IMAGE" | "LINK";
  status: "PENDING" | "READY" | "FAILED" | "CONFIRMED";
  extractedData: Partial<GearItemInput> & { attributes?: Record<string, unknown> };
  version: number; expiresAt: string;
};

async function resolvePhoto(item: UserGearItem): Promise<UserGearItem> {
  if (!item.photoRef) return item;
  try {
    const response = await apiClient.get<Envelope<{ url: string }>>(
      `/api/v1/media/${encodeURIComponent(item.photoRef)}/delivery`,
      { params: { variant: "CATALOG_CARD", format: "WEBP" } },
    );
    return { ...item, photoUrl: unwrap(response.data).url };
  } catch { return item; }
}

export async function listMyGear() {
  const response = await apiClient.get<Envelope<{ items: UserGearItem[]; meta?: { total: number } }>>(
    "/api/v1/gear/items", { params: { page: 1, limit: 100 } },
  );
  const result = unwrap(response.data);
  return { ...result, items: await Promise.all((result.items ?? []).map(resolvePhoto)) };
}
export async function createMyGear(input: GearItemInput) {
  const response = await apiClient.post<Envelope<UserGearItem>>("/api/v1/gear/items", input);
  return resolvePhoto(unwrap(response.data));
}
export async function updateMyGear(itemId: string, input: Partial<GearItemInput> & { expectedVersion: number }) {
  const response = await apiClient.patch<Envelope<UserGearItem>>(`/api/v1/gear/items/${encodeURIComponent(itemId)}`, input);
  return resolvePhoto(unwrap(response.data));
}
export async function deleteMyGear(itemId: string) {
  await apiClient.delete(`/api/v1/gear/items/${encodeURIComponent(itemId)}`);
}
export async function uploadUserGearPhoto(file: File) {
  const intentResponse = await apiClient.post<Envelope<{
    mediaId: string;
    upload: { uploadUrl: string; method: string; formFields: Record<string, string | number> };
  }>>("/api/v1/media/upload-intents", {
    scope: "USER_GEAR", resourceType: "IMAGE", fileName: file.name || `gear-${Date.now()}.jpg`,
    contentType: file.type || "image/jpeg", sizeBytes: file.size, captureSource: "FILE",
    clientCapturedAt: new Date().toISOString(),
  });
  const intent = unwrap(intentResponse.data);
  const data = new FormData();
  Object.entries(intent.upload.formFields).forEach(([key, value]) => data.append(key, String(value)));
  data.append("file", file);
  const uploadResponse = await fetch(intent.upload.uploadUrl, { method: intent.upload.method || "POST", body: data });
  if (!uploadResponse.ok) throw new Error("Không thể tải ảnh trang bị lên kho media.");
  const uploaded = (await uploadResponse.json()) as { public_id: string; version: number; signature: string };
  await apiClient.post(`/api/v1/media/${intent.mediaId}/complete`, {
    publicId: uploaded.public_id, version: uploaded.version, signature: uploaded.signature,
  });
  return intent.mediaId;
}
export async function createGearExtraction(source: { source: "IMAGE"; uploadId: string } | { source: "LINK"; url: string }) {
  // AI extraction can legitimately take longer than the shared 10-second API timeout.
  // Keep the longer timeout scoped to this request so normal API failures still surface quickly.
  const response = await apiClient.post<Envelope<GearExtractionDraft>>(
    "/api/v1/gear/extractions",
    source,
    { timeout: 120_000 },
  );
  return unwrap(response.data);
}
export async function confirmGearExtraction(draftId: string, input: { expectedVersion: number; item: GearItemInput; acknowledgeDuplicate?: boolean }) {
  const response = await apiClient.post<Envelope<{ item: UserGearItem; replayed: boolean }>>(
    `/api/v1/gear/extractions/${encodeURIComponent(draftId)}/confirm`, input,
  );
  const result = unwrap(response.data);
  return { ...result, item: await resolvePhoto(result.item) };
}
