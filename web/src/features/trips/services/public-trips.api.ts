import { apiClient } from "@/lib/axios";
import type { PublicTripItem, PublicTripListQuery } from "../types/public-trips";

/**
 * GET /api/v1/public-trips
 * Lấy danh sách các chuyến đi trekking công khai đã xuất bản
 */
export async function listPublicTrips(
  query?: PublicTripListQuery,
  signal?: AbortSignal
): Promise<PublicTripItem[]> {
  const response = await apiClient.get<PublicTripItem[]>("/api/v1/public-trips", {
    params: {
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      destinationId: query?.destinationId,
    },
    signal,
  });
  return response.data;
}

/**
 * GET /api/v1/public-trips/{id}
 * Lấy thông tin chi tiết của một chuyến đi công khai
 */
export async function getPublicTripDetail(
  tripId: string,
  signal?: AbortSignal
): Promise<PublicTripItem> {
  const response = await apiClient.get<PublicTripItem>(
    `/api/v1/public-trips/${tripId}`,
    { signal }
  );
  return response.data;
}
