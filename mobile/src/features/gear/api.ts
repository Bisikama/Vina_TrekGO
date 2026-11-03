import { apiRequest } from "@/lib/api-client";

import type {
  CreateUserGearInput,
  GearCapabilities,
  GearCatalogEntry,
  GearCategory,
  GearCondition,
  GearExtractionDraft,
  UserGearItem,
} from "@/features/gear/types";

type Envelope<T> = T | { data: T };

function unwrap<T>(payload: Envelope<T>): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: T }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

/** Ảnh món đồ (USER_GEAR) lấy URL qua media delivery; lỗi thì bỏ qua, chỉ không có ảnh. */
async function resolvePhoto(item: UserGearItem, accessToken: string): Promise<UserGearItem> {
  if (!item.photoRef) return item;
  try {
    const result = unwrap(
      await apiRequest<Envelope<{ url: string }>>(
        `/api/v1/media/${encodeURIComponent(item.photoRef)}/delivery?variant=CATALOG_CARD&format=JPEG`,
        { method: "GET", accessToken },
      ),
    );
    return { ...item, photoUrl: result.url };
  } catch {
    return item;
  }
}

export type PickedImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
};

export const gearApi = {
  async listMyGear(accessToken: string) {
    const result = unwrap(
      await apiRequest<Envelope<{ items: UserGearItem[] }>>("/api/v1/gear/items?page=1&limit=100", {
        method: "GET",
        accessToken,
      }),
    );
    return { ...result, items: await Promise.all((result.items ?? []).map((item) => resolvePhoto(item, accessToken))) };
  },

  async createMyGear(input: CreateUserGearInput, accessToken: string) {
    const item = unwrap(
      await apiRequest<Envelope<UserGearItem>>("/api/v1/gear/items", {
        method: "POST",
        accessToken,
        body: JSON.stringify(input),
      }),
    );
    return resolvePhoto(item, accessToken);
  },

  async updateMyGear(itemId: string, input: Partial<CreateUserGearInput> & { expectedVersion: number }, accessToken: string) {
    const item = unwrap(
      await apiRequest<Envelope<UserGearItem>>(`/api/v1/gear/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        accessToken,
        body: JSON.stringify(input),
      }),
    );
    return resolvePhoto(item, accessToken);
  },

  async deleteMyGear(itemId: string, accessToken: string) {
    await apiRequest<void>(`/api/v1/gear/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      accessToken,
    });
  },

  async getCapabilities(accessToken: string) {
    return unwrap(await apiRequest<Envelope<GearCapabilities>>("/api/v1/gear/capabilities", { method: "GET", accessToken }));
  },

  /** Tải ảnh (scope USER_GEAR) lên kho media, trả mediaId để tạo bản nháp AI hoặc làm ảnh món. */
  async uploadGearPhoto(asset: PickedImage, accessToken: string) {
    const fileName = asset.fileName || `gear-${Date.now()}.jpg`;
    const local = await fetch(asset.uri);
    if (!local.ok) throw new Error("Không đọc được ảnh trên thiết bị.");
    const blob = await local.blob();
    const intent = unwrap(
      await apiRequest<Envelope<{ mediaId: string; upload: { uploadUrl: string; method: string; formFields: Record<string, string | number> } }>>(
        "/api/v1/media/upload-intents",
        {
          method: "POST",
          accessToken,
          body: JSON.stringify({
            scope: "USER_GEAR",
            resourceType: "IMAGE",
            fileName,
            contentType: asset.mimeType || "image/jpeg",
            sizeBytes: asset.fileSize || blob.size,
            captureSource: "GALLERY",
            clientCapturedAt: new Date().toISOString(),
          }),
        },
      ),
    );
    const form = new FormData();
    Object.entries(intent.upload.formFields).forEach(([key, value]) => form.append(key, String(value)));
    form.append("file", blob, fileName);
    const uploaded = await fetch(intent.upload.uploadUrl, { method: intent.upload.method || "POST", body: form });
    if (!uploaded.ok) throw new Error("Không tải được ảnh lên kho media.");
    const result = (await uploaded.json()) as { public_id: string; version: number; signature: string };
    await apiRequest(`/api/v1/media/${encodeURIComponent(intent.mediaId)}/complete`, {
      method: "POST",
      accessToken,
      body: JSON.stringify({ publicId: result.public_id, version: result.version, signature: result.signature }),
    });
    return intent.mediaId;
  },

  /** AI đọc ảnh/link → bản nháp. Có thể mất lâu nên nới thời gian chờ. */
  async createExtraction(source: { source: "IMAGE"; uploadId: string } | { source: "LINK"; url: string }, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<GearExtractionDraft>>("/api/v1/gear/extractions", {
        method: "POST",
        accessToken,
        timeoutMs: 120_000,
        body: JSON.stringify(source),
      }),
    );
  },

  async confirmExtraction(
    draftId: string,
    input: { expectedVersion: number; item: CreateUserGearInput; acknowledgeDuplicate?: boolean },
    accessToken: string,
  ) {
    const result = unwrap(
      await apiRequest<Envelope<{ item: UserGearItem; replayed: boolean }>>(
        `/api/v1/gear/extractions/${encodeURIComponent(draftId)}/confirm`,
        { method: "POST", accessToken, body: JSON.stringify(input) },
      ),
    );
    return { ...result, item: await resolvePhoto(result.item, accessToken) };
  },

  /** Danh mục sản phẩm cá nhân đã được kiểm duyệt. Đổi bộ lọc thì bỏ cursor cũ. */
  async searchCatalog(query: { q?: string; category?: GearCategory; cursor?: string }, accessToken: string) {
    const params = new URLSearchParams({ limit: "20" });
    if (query.q?.trim()) params.set("q", query.q.trim());
    if (query.category) params.set("category", query.category);
    if (query.cursor) params.set("cursor", query.cursor);
    return unwrap(
      await apiRequest<Envelope<{ items: GearCatalogEntry[]; nextCursor: string | null }>>(
        `/api/v1/gear/personal-catalog?${params.toString()}`,
        { method: "GET", accessToken },
      ),
    );
  },

  async addFromCatalog(catalogId: string, input: { condition: GearCondition; acknowledgeDuplicate?: boolean }, accessToken: string) {
    const item = unwrap(
      await apiRequest<Envelope<UserGearItem>>(`/api/v1/gear/personal-catalog/${encodeURIComponent(catalogId)}/items`, {
        method: "POST",
        accessToken,
        body: JSON.stringify(input),
      }),
    );
    return resolvePhoto(item, accessToken);
  },
};
