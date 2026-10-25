import axios from "axios";
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
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface TrailPurchaseCheckout {
  type: "QR" | "REDIRECT";
  url: string | null;
  qrData: string | null;
}

export interface TrailPurchaseResponse {
  trailAccessId: string;
  accessStatus: "PENDING_PAYMENT" | "ACTIVE" | string;
  paymentId: string | null;
  invoiceId: string | null;
  status?: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | string;
  amount: string;
  currency: string;
  expiresAt?: string;
  providerEnvironment?: string;
  gateway?: "vnpay" | "momo" | string;
  reconciliationRequired?: boolean;
  checkout: TrailPurchaseCheckout | null;
  checkoutUrl?: string;
  qrCode?: string;
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
  paymentMethod: "QR" | "REDIRECT" = "REDIRECT",
  gateway: "vnpay" | "momo" = "vnpay",
  idempotencyKey?: string
): Promise<TrailPurchaseResponse> => {
  const key = idempotencyKey || crypto.randomUUID();
  const response = await apiClient.post<TrailPurchaseResponse>(
    `/api/proxy/trails/${trailId}/purchase`,
    {
      paymentMethod,
      gateway,
      idempotencyKey: key,
    },
    {
      baseURL: "/", // Gọi qua Next.js API Route proxy để truyền Idempotency-Key và IP an toàn
    }
  );
  return response.data;
};

export function getTrailPurchaseErrorMessage(error: unknown): {
  message: string;
  code?: string;
} {
  if (axios.isAxiosError(error)) {
    const errObj = error.response?.data?.error;
    const code = errObj?.code;

    const messages: Record<string, string> = {
      UNAUTHENTICATED: "Vui lòng đăng nhập tài khoản để mở khóa cung đường.",
      FORBIDDEN: "Bạn không có quyền thực hiện giao dịch này.",
      NOT_FOUND: "Không tìm thấy cung đường cần mở khóa.",
      PAYMENT_INVALID_STATE:
        "Bạn đã sở hữu quyền truy cập cung đường này hoặc cung đường hiện không khả dụng để mua.",
      PAYMENT_ATTEMPT_IN_PROGRESS:
        "Giao dịch thanh toán đang được xử lý. Vui lòng hoàn tất trên cửa sổ VNPAY hoặc đợi ít phút.",
      PAYMENT_PROVIDER_UNAVAILABLE:
        "Cổng thanh toán VNPAY tạm thời không khả dụng (Lưu ý: Giá cung đường phải từ 5.000đ trở lên cho VNPAY Sandbox).",
      IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD:
        "Phiên thanh toán đã thay đổi phương thức, vui lòng bấm thử lại.",
    };

    return {
      message:
        messages[code] ||
        errObj?.message ||
        error.response?.data?.message ||
        "Không thể khởi tạo giao dịch thanh toán VNPAY. Vui lòng thử lại.",
      code,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "Có lỗi xảy ra khi tạo thanh toán. Vui lòng thử lại." };
}

export const checkTrailAccess = async (trailId: string): Promise<{ hasAccess: boolean; expiresAt?: string | null }> => {
  const response = await apiClient.get<{ hasAccess: boolean; expiresAt?: string | null }>(`/api/v1/trails/${trailId}/access`);
  return response.data;
};
