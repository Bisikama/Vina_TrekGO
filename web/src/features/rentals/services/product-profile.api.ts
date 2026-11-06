import axios from "axios";

import { apiClient } from "@/lib/axios";
import type { GearCategory } from "@/features/rentals/services/gear.api";

// Hồ sơ thông số kỹ thuật của sản phẩm thuê (Staff kho / Admin).
// GET/PUT /api/v1/staff/gear/product-profiles/:productId

function unwrap<T>(payload: unknown): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export type ProductTechnicalProfile = {
  id: string;
  productId: string;
  category: GearCategory;
  attributes: Record<string, unknown>;
  schemaVersion?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** Trả về null khi sản phẩm chưa có hồ sơ (API trả 404). */
export async function getProductProfile(productId: string, signal?: AbortSignal) {
  try {
    const response = await apiClient.get<unknown>(
      `/api/v1/staff/gear/product-profiles/${encodeURIComponent(productId)}`,
      { signal },
    );
    return unwrap<ProductTechnicalProfile>(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

/** expectedVersion = 0 khi tạo mới lần đầu. */
export async function saveProductProfile(
  productId: string,
  input: { category: GearCategory; attributes: Record<string, unknown>; expectedVersion: number },
) {
  const response = await apiClient.put<unknown>(
    `/api/v1/staff/gear/product-profiles/${encodeURIComponent(productId)}`,
    input,
  );
  return unwrap<ProductTechnicalProfile>(response.data);
}

export type GearAttributeDefinition = {
  key: string;
  label?: string;
  unit?: string | null;
  schema?: {
    type?: string | string[];
    anyOf?: Array<{ type?: string | string[]; enum?: string[]; minimum?: number; maximum?: number }>;
    enum?: string[];
    minimum?: number;
    maximum?: number;
  };
  options?: Array<{ value: string; label: string }>;
};

export type GearAttributeCategory = {
  category: GearCategory;
  label: string;
  attributes: GearAttributeDefinition[];
};

/** GET /api/v1/gear/attribute-schema — bộ thông số theo loại đồ do backend công bố. */
export async function getGearAttributeSchema(signal?: AbortSignal) {
  const response = await apiClient.get<unknown>("/api/v1/gear/attribute-schema", { signal });
  return unwrap<{ categories: GearAttributeCategory[] }>(response.data).categories ?? [];
}
