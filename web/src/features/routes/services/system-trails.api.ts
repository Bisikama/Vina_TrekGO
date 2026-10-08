import { apiClient } from "@/lib/axios";

export interface SystemTrail {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXTREME";
  distanceKm: number;
  elevationGainM: number;
  estimatedDurationMinutes?: number;
  price?: number;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  version?: number;
  destination?: {
    id: string;
    name: string;
    region: string;
    centerLat: number;
    centerLng: number;
  };
  routeGeojson?: any;
  checkpoints?: any[];
  bounds?: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  initialCamera?: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  };
}

export interface PaginatedSystemTrails {
  items: SystemTrail[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getSystemTrails = async (params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  difficulty?: string;
}): Promise<PaginatedSystemTrails> => {
  const response = await apiClient.get<PaginatedSystemTrails>("/api/v1/system-trails", { params });
  return response.data;
};

export const purchaseTrail = async (
  trailId: string, 
  paymentMethod: "QR" | "REDIRECT"
): Promise<{ paymentId: string; checkoutUrl?: string; qrCode?: string }> => {
  const response = await apiClient.post(`/api/proxy/trails/${trailId}/purchase`, {
    paymentMethod,
    idempotencyKey: crypto.randomUUID()
  }, {
    baseURL: '/' // Đảm bảo request gọi về Next.js thay vì gọi sang Backend
  });
  return response.data;
};

export const checkTrailAccess = async (trailId: string): Promise<{ hasAccess: boolean; expiresAt?: string | null }> => {
  const response = await apiClient.get<{ hasAccess: boolean; expiresAt?: string | null }>(`/api/v1/trails/${trailId}/access`);
  return response.data;
};
