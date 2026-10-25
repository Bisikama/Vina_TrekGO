import { apiClient } from "@/lib/axios";

type Envelope<T> = T | { data: T };
const unwrap = <T,>(payload: Envelope<T>) =>
  payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: T }).data
    : (payload as T);

export type GearCategory = "JACKET" | "FOOTWEAR" | "PANTS" | "BACKPACK" | "SLEEPING_BAG" | "TENT" | "TREKKING_POLE" | "RAIN_GEAR";
export type GearCondition = "NEW" | "GOOD" | "WORN" | "POOR";
export type UserGearItem = {
  id: string;
  name: string;
  category: GearCategory;
  brand: string | null;
  condition: GearCondition;
  photoRef: string | null;
  source: string;
  createdAt: string;
};

export async function listMyGear() {
  const response = await apiClient.get<Envelope<{ items: UserGearItem[] }>>("/api/v1/gear/items");
  return unwrap(response.data);
}

export async function createMyGear(input: { name: string; category: GearCategory; brand?: string; condition: GearCondition }) {
  const response = await apiClient.post<Envelope<UserGearItem>>("/api/v1/gear/items", input);
  return unwrap(response.data);
}

export async function deleteMyGear(itemId: string) {
  await apiClient.delete(`/api/v1/gear/items/${encodeURIComponent(itemId)}`);
}
