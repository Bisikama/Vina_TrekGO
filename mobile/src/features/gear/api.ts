import { apiRequest } from "@/lib/api-client";

import type { CreateUserGearInput, UserGearItem } from "@/features/gear/types";

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

export const gearApi = {
  async listMyGear(accessToken: string) {
    const response = await apiRequest<Envelope<{ items: UserGearItem[] }>>(
      "/api/v1/gear/items",
      { method: "GET", accessToken },
    );

    return unwrap(response);
  },

  async createMyGear(input: CreateUserGearInput, accessToken: string) {
    const response = await apiRequest<Envelope<UserGearItem>>(
      "/api/v1/gear/items",
      {
        method: "POST",
        accessToken,
        body: JSON.stringify(input),
      },
    );

    return unwrap(response);
  },

  async deleteMyGear(itemId: string, accessToken: string) {
    await apiRequest<void>(`/api/v1/gear/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      accessToken,
    });
  },
};
