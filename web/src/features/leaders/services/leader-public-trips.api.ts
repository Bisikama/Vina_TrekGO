import axios from "axios";
import { apiClient } from "@/lib/axios";
import type {
  CancelTripInput,
  CreateLeaderPublicTripInput,
  LeaderCheckpointOption,
  LeaderTrailDetail,
  LeaderTripPaginationQuery,
  LeaderTripView,
  PublishTripInput,
  ScheduleConflictQuery,
  ScheduleConflictResult,
  SetTripCheckpointsInput,
  SetTripTrailsInput,
  TrailSuggestion,
  TripOptionItem,
  TripReadinessResult,
  UpdateLeaderPublicTripInput,
} from "../types/leader-trips";

/**
 * Trích xuất thông báo lỗi chuẩn từ CF01 backend
 */
export function getLeaderTripErrorMessage(
  error: unknown,
  fallback = "Đã có lỗi xảy ra khi thực hiện thao tác."
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      // 1. Nếu có issues cụ thể từ validation / readiness
      if (Array.isArray((data as { issues?: Array<{ message: string }> }).issues)) {
        const issues = (data as { issues: Array<{ message: string }> }).issues;
        if (issues.length > 0) {
          return issues.map((i) => i.message).join(" • ");
        }
      }

      // 2. Nếu có message dạng chuỗi
      if (typeof (data as { message?: string }).message === "string") {
        return (data as { message: string }).message;
      }

      // 3. Nếu là nested error envelope
      if (typeof (data as { error?: { message?: string } }).error?.message === "string") {
        return (data as { error: { message: string } }).error.message;
      }
    }

    if (error.response?.status === 401) {
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    }
    if (error.response?.status === 403) {
      return "Tài khoản của bạn không có quyền thực hiện thao tác này.";
    }
    if (error.response?.status === 404) {
      return "Không tìm thấy dữ liệu chuyến đi hoặc tài nguyên yêu cầu.";
    }
    if (error.response?.status === 409) {
      return "Dữ liệu chuyến đi đã được thay đổi hoặc bị xung đột lịch. Vui lòng tải lại trang.";
    }
    if (error.response?.status === 422) {
      return "Chuyến đi chưa đủ điều kiện xuất bản hoặc lộ trình không hợp lệ.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

// ==========================================
// 1. CF01 LEADER PUBLIC TRIPS APIS
// ==========================================

/**
 * POST /api/v1/leader/public-trips
 * AAPI-PTR-01: Tạo chuyến đi nháp (DRAFT)
 */
export async function createLeaderPublicTrip(
  input: CreateLeaderPublicTripInput,
  signal?: AbortSignal
): Promise<LeaderTripView> {
  const { minCapacity, ...rest } = input;
  const payload = {
    ...rest,
    ...(minCapacity !== undefined ? { minPax: minCapacity } : {}),
  };
  const response = await apiClient.post<LeaderTripView>(
    "/api/v1/leader/public-trips",
    payload,
    { signal }
  );
  return response.data;
}

/**
 * GET /api/v1/leader/public-trips
 * Lấy danh sách các chuyến đi do Leader quản lý
 */
export async function listLeaderPublicTrips(
  query?: LeaderTripPaginationQuery,
  signal?: AbortSignal
): Promise<LeaderTripView[]> {
  const response = await apiClient.get<LeaderTripView[]>(
    "/api/v1/leader/public-trips",
    {
      params: {
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
        destinationId: query?.destinationId,
      },
      signal,
    }
  );
  return response.data;
}

/**
 * GET /api/v1/leader/public-trips/{id}
 * Lấy thông tin chi tiết của một chuyến đi
 */
export async function getLeaderPublicTripDetail(
  tripId: string,
  signal?: AbortSignal
): Promise<LeaderTripView> {
  const response = await apiClient.get<LeaderTripView>(
    `/api/v1/leader/public-trips/${tripId}`,
    { signal }
  );
  return response.data;
}

/**
 * PATCH /api/v1/leader/public-trips/{id}
 * Cập nhật thông tin cơ bản của chuyến đi nháp
 */
export async function updateLeaderPublicTrip(
  tripId: string,
  input: UpdateLeaderPublicTripInput,
  signal?: AbortSignal
): Promise<LeaderTripView> {
  const { minCapacity, ...rest } = input;
  const payload = {
    ...rest,
    ...(minCapacity !== undefined ? { minPax: minCapacity } : {}),
  };
  const response = await apiClient.patch<LeaderTripView>(
    `/api/v1/leader/public-trips/${tripId}`,
    payload,
    { signal }
  );
  return response.data;
}

/**
 * PUT /api/v1/leader/public-trips/{id}/checkpoints
 * Thiết lập / thay thế danh sách Checkpoint bắt buộc của chuyến đi
 */
export async function setLeaderTripCheckpoints(
  tripId: string,
  input: SetTripCheckpointsInput,
  signal?: AbortSignal
): Promise<LeaderTripView> {
  const response = await apiClient.put<LeaderTripView>(
    `/api/v1/leader/public-trips/${tripId}/checkpoints`,
    input,
    { signal }
  );
  return response.data;
}

/**
 * PUT /api/v1/leader/public-trips/{id}/trails
 * Thiết lập / thay thế danh sách Cung đường (System Trails) của chuyến đi
 */
export async function setLeaderTripTrails(
  tripId: string,
  input: SetTripTrailsInput,
  signal?: AbortSignal
): Promise<LeaderTripView> {
  const response = await apiClient.put<LeaderTripView>(
    `/api/v1/leader/public-trips/${tripId}/trails`,
    input,
    { signal }
  );
  return response.data;
}

/**
 * GET /api/v1/leader/public-trips/{id}/trail-suggestions
 * Lấy danh sách cung đường gợi ý tiếp nối khả dụng
 */
export async function getLeaderTrailSuggestions(
  tripId: string,
  query?: LeaderTripPaginationQuery,
  signal?: AbortSignal
): Promise<TrailSuggestion[]> {
  const response = await apiClient.get<TrailSuggestion[]>(
    `/api/v1/leader/public-trips/${tripId}/trail-suggestions`,
    {
      params: {
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
      },
      signal,
    }
  );
  return response.data;
}

/**
 * GET /api/v1/leader/public-trips/{id}/readiness
 * Kiểm tra tính sẵn sàng xuất bản của chuyến đi
 */
export async function getLeaderTripReadiness(
  tripId: string,
  signal?: AbortSignal
): Promise<TripReadinessResult> {
  const response = await apiClient.get<TripReadinessResult>(
    `/api/v1/leader/public-trips/${tripId}/readiness`,
    { signal }
  );
  return response.data;
}

/**
 * POST /api/v1/leader/public-trips/{id}/publish
 * Xuất bản chuyến đi sang trạng thái OPEN để mở đăng ký
 */
export async function publishLeaderTrip(
  tripId: string,
  input: PublishTripInput,
  signal?: AbortSignal
): Promise<LeaderTripView> {
  const response = await apiClient.post<LeaderTripView>(
    `/api/v1/leader/public-trips/${tripId}/publish`,
    input,
    { signal }
  );
  return response.data;
}

/**
 * POST /api/v1/leader/public-trips/{id}/cancellation-requests
 * Gửi yêu cầu hủy chuyến đi kèm lý do và minh chứng
 */
export async function cancelLeaderTripRequest(
  tripId: string,
  input: CancelTripInput,
  signal?: AbortSignal
): Promise<LeaderTripView> {
  const response = await apiClient.post<LeaderTripView>(
    `/api/v1/leader/public-trips/${tripId}/cancellation-requests`,
    input,
    { signal }
  );
  return response.data;
}

// ==========================================
// 2. CF01 TRIP OPTIONS APIS
// ==========================================

/**
 * GET /api/v1/leaders/me/schedule-conflicts
 * Kiểm tra xem Leader có bị trùng lịch với chuyến đi khác không
 */
export async function checkLeaderScheduleConflicts(
  query: ScheduleConflictQuery,
  signal?: AbortSignal
): Promise<ScheduleConflictResult> {
  const response = await apiClient.get<ScheduleConflictResult>(
    "/api/v1/leaders/me/schedule-conflicts",
    {
      params: {
        startAt: query.startAt,
        endAt: query.endAt,
        excludeTripId: query.excludeTripId,
      },
      signal,
    }
  );
  return response.data;
}

/**
 * GET /api/v1/leader/trip-options/destinations
 * Lấy danh sách các Điểm đến (Destinations)
 */
export async function getLeaderDestinationOptions(
  query?: LeaderTripPaginationQuery,
  signal?: AbortSignal
): Promise<TripOptionItem[]> {
  const response = await apiClient.get<TripOptionItem[]>(
    "/api/v1/leader/trip-options/destinations",
    {
      params: {
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
      },
      signal,
    }
  );
  return response.data;
}

/**
 * GET /api/v1/leader/trip-options/pickup-points
 * Lấy danh sách các Điểm tập kết / đón xe của một Destination
 */
export async function getLeaderPickupPointOptions(
  destinationId: string,
  query?: LeaderTripPaginationQuery,
  signal?: AbortSignal
): Promise<TripOptionItem[]> {
  const response = await apiClient.get<TripOptionItem[]>(
    "/api/v1/leader/trip-options/pickup-points",
    {
      params: {
        destinationId,
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
      },
      signal,
    }
  );
  return response.data;
}

/**
 * GET /api/v1/leader/trip-options/checkpoints
 * Lấy danh sách các Checkpoint chính thức của một Destination
 */
export async function getLeaderCheckpointOptions(
  destinationId: string,
  query?: LeaderTripPaginationQuery,
  signal?: AbortSignal
): Promise<LeaderCheckpointOption[]> {
  const response = await apiClient.get<LeaderCheckpointOption[]>(
    "/api/v1/leader/trip-options/checkpoints",
    {
      params: {
        destinationId,
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
      },
      signal,
    }
  );
  return response.data;
}

/**
 * GET /api/v1/leader/trip-options/system-trails/{id}
 * Lấy thông tin chi tiết về tuyến đường System Trail
 */
export async function getLeaderSystemTrailOption(
  trailId: string,
  signal?: AbortSignal
): Promise<LeaderTrailDetail> {
  const response = await apiClient.get<LeaderTrailDetail>(
    `/api/v1/leader/trip-options/system-trails/${trailId}`,
    { signal }
  );
  return response.data;
}
