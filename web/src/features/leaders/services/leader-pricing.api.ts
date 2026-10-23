import { apiClient } from "@/lib/axios";
import type {
  CostPlanSaveInput,
  FeePolicyConfig,
  PricingConfirmInput,
  PricingEvaluationResult,
  PricingPreviewInput,
  TripCostPlanResponse,
} from "../types/leader-pricing";

/**
 * GET /api/v1/leader/pricing-config
 * Đọc cấu hình biểu phí sàn, phí thanh toán, dự phòng và bước làm tròn giá vé
 */
export async function getPricingConfig(signal?: AbortSignal): Promise<FeePolicyConfig> {
  const response = await apiClient.get<FeePolicyConfig>("/api/v1/leader/pricing-config", { signal });
  return response.data;
}

/**
 * GET /api/v1/leader/public-trips/:tripId/cost-plan
 * Lấy bảng chi phí và kết quả mô phỏng hiện tại của chuyến đi
 */
export async function getTripCostPlan(
  tripId: string,
  signal?: AbortSignal
): Promise<TripCostPlanResponse> {
  const response = await apiClient.get<TripCostPlanResponse>(
    `/api/v1/leader/public-trips/${tripId}/cost-plan`,
    { signal }
  );
  return response.data;
}

/**
 * PUT /api/v1/leader/public-trips/:tripId/cost-plan
 * Lưu danh mục các dòng chi phí (FIXED/VARIABLE/STEP) và thông số mô phỏng
 */
export async function saveTripCostPlan(
  tripId: string,
  input: CostPlanSaveInput,
  signal?: AbortSignal
): Promise<{ tripId: string; tripVersion: number; costPlanStatus: string }> {
  const response = await apiClient.put(
    `/api/v1/leader/public-trips/${tripId}/cost-plan`,
    input,
    { signal }
  );
  return response.data;
}

/**
 * POST /api/v1/leader/public-trips/:tripId/pricing/preview
 * Chạy Trekking Pricing Simulator trên RAM từ dữ liệu thanh trượt (không lưu DB)
 */
export async function previewTripPricing(
  tripId: string,
  input: PricingPreviewInput,
  signal?: AbortSignal
): Promise<PricingEvaluationResult & { tripId: string; tripVersion: number }> {
  const response = await apiClient.post(
    `/api/v1/leader/public-trips/${tripId}/pricing/preview`,
    input,
    { signal }
  );
  return response.data;
}

/**
 * POST /api/v1/leader/public-trips/:tripId/pricing/confirm
 * Chốt giá vé (selectedPrice) và số khách tối thiểu (selectedMinPax) vào chuyến đi
 */
export async function confirmTripPricing(
  tripId: string,
  input: PricingConfirmInput,
  signal?: AbortSignal
): Promise<{
  tripId: string;
  tripVersion: number;
  selectedPrice: string;
  selectedMinPax: number;
}> {
  const response = await apiClient.post(
    `/api/v1/leader/public-trips/${tripId}/pricing/confirm`,
    input,
    { signal }
  );
  return response.data;
}

