import { apiRequest } from "@/lib/api-client";
import { readStoredAuth } from "@/features/auth/storage";
import {
  DifficultyLevel,
  PersonalTrail,
  PersonalTrailVerificationStatus,
  PersonalTrailVisibility,
} from "@/types";
import { Platform } from "react-native";

// ==================== TYPES & CONTRACTS ====================

export type BackendDifficulty = "EASY" | "MODERATE" | "HARD" | "VERY_HARD";

export interface DeviceInfoDto {
  platform: string;
  osVersion: string;
  deviceModel?: string;
}

export interface StartRecordingRequest {
  clientRecordingId: string;
  startedAt: string;
  deviceInfo?: DeviceInfoDto;
}

export interface StartRecordingResponseData {
  serverRecordingId: string;
  clientRecordingId: string;
  status: string;
  startedAt: string;
}

export interface RawGpsSampleDto {
  clientSampleId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  accuracyM?: number | null;
  altitudeM?: number | null;
  altitudeAccuracyM?: number | null;
  speedMps?: number | null;
  headingDeg?: number | null;
  segmentId: number;
  accepted: boolean;
  rejectReason?: string | null;
}

export interface UploadRawSamplesRequest {
  clientRecordingId: string;
  samples: RawGpsSampleDto[];
}

export interface UploadRawSamplesResponseData {
  receivedCount: number;
  insertedCount: number;
  duplicatedCount: number;
}

export interface UpdateRecordingStatusRequest {
  clientRecordingId: string;
  status: "PAUSED" | "RECORDING";
  timestamp: string;
  currentSegmentId?: number;
}

export interface UpdateRecordingStatusResponseData {
  status: string;
  updatedAt: string;
}

export interface PersonalCheckpointInput {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  info?: string | null;
}

export interface PersonalCheckpointDto extends PersonalCheckpointInput {
  id: string;
  sequence: number;
}

export interface FinishRecordingRequest {
  checkpoints?: PersonalCheckpointInput[];
  clientRecordingId: string;
  endedAt: string;
  trailMetadata: {
    title: string;
    description?: string;
    region?: string;
    difficulty: BackendDifficulty;
    terrainType?: string;
    visibility?: "PRIVATE" | "PUBLIC" | "SHARED";
  };
  provisionalTelemetry?: {
    distanceKm: number;
    elevationGainM: number;
    duration: string;
    elapsedSeconds: number;
  };
}

export interface FinishRecordingResponseData {
  serverRecordingId: string;
  serverPersonalTrailId: string;
  status: "READY" | "PROCESSING";
  estimatedProcessTimeSec?: number;
}

export interface RecordingStatusResponseData {
  status: string;
  serverPersonalTrailId?: string;
  officialTelemetry?: {
    distanceKm: number;
    elevationGainM: number;
    elevationLossM: number;
    maxElevationM: number;
    minElevationM: number;
  };
  processedGeojson?: {
    type: "MultiLineString";
    coordinates: [number, number, number?][][];
  };
}

export interface BackendElevationPoint {
  distanceKm: number;
  elevationM: number;
}

export interface PersonalTrailDto {
  id: string;
  ownerId?: string;
  name?: string;
  title?: string;
  description?: string;
  region?: string;
  difficulty?: string;
  distanceKm?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  duration?: string;
  terrainType?: string;
  visibility?: string;
  verificationStatus?: string;
  demStatus?: string;
  rejectionReason?: string;
  gpsSegments?: [number, number, number?][][];
  checkpoints?: any[];
  elevationProfile?: BackendElevationPoint[];
  clientRecordingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyPersonalTrailsResponse {
  success: boolean;
  pagination?: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  data: PersonalTrailDto[];
}

export interface BackendResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface UpdatePersonalTrailRequest {
  title?: string;
  description?: string;
  duration?: string;
  visibility?: "PRIVATE" | "PUBLIC" | "SHARED";
  difficulty?: BackendDifficulty;
}

export interface SubmitVerificationRequest {
  noteToAdmin?: string;
}

export interface SubmitVerificationResponseData {
  trailId: string;
  verificationStatus: string;
  submittedAt: string;
}

// ==================== HELPER MAPPERS ====================

export function mapDifficultyToBackend(diff: DifficultyLevel): BackendDifficulty {
  switch (diff) {
    case "Dễ":
      return "EASY";
    case "Trung bình":
      return "MODERATE";
    case "Khó":
      return "HARD";
    case "Thách thức":
      return "VERY_HARD";
    default:
      return "MODERATE";
  }
}

export function mapDifficultyFromBackend(beDiff?: string): DifficultyLevel {
  switch (beDiff?.toUpperCase()) {
    case "EASY":
      return "Dễ";
    case "MEDIUM":
    case "MODERATE":
      return "Trung bình";
    case "HARD":
      return "Khó";
    case "VERY_HARD":
    case "CHALLENGING":
    case "EXTREME":
      return "Thách thức";
    default:
      return "Trung bình";
  }
}

export function isUUID(str?: string): boolean {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str,
  );
}

export function convertBackendTrailToPersonalTrail(
  dto: PersonalTrailDto,
  currentUserId?: string,
): PersonalTrail {
  let gpsSegments: [number, number, number?][][] = [];
  if (dto.gpsSegments && dto.gpsSegments.length > 0) {
    gpsSegments = dto.gpsSegments;
  } else if ((dto as any).routeGeojson?.coordinates) {
    const coords = (dto as any).routeGeojson.coordinates;
    const type = (dto as any).routeGeojson.type;
    if (type === "MultiLineString" || (Array.isArray(coords[0]) && Array.isArray(coords[0][0]))) {
      gpsSegments = coords;
    } else if (type === "LineString" || Array.isArray(coords[0])) {
      gpsSegments = [coords];
    }
  }
  const gpsRoute: [number, number, number?][] = [];
  for (const seg of gpsSegments) {
    if (Array.isArray(seg)) {
      gpsRoute.push(...seg);
    }
  }

  const visibility: PersonalTrailVisibility =
    dto.visibility === "PUBLIC" || dto.visibility === "SHARED"
      ? "PUBLIC"
      : "PRIVATE";

  let verificationStatus: PersonalTrailVerificationStatus = "DRAFT";
  if (dto.verificationStatus === "SUBMITTED" || dto.verificationStatus === "UNDER_REVIEW") {
    verificationStatus = "PENDING";
  } else if (dto.verificationStatus === "APPROVED") {
    verificationStatus = "VERIFIED";
  }
  if (
    dto.verificationStatus === "PENDING" ||
    dto.verificationStatus === "VERIFIED" ||
    dto.verificationStatus === "REJECTED"
  ) {
    verificationStatus = dto.verificationStatus;
  }

  let duration = dto.duration;
  if (!duration) {
    if (dto.createdAt && dto.updatedAt) {
      const start = new Date(dto.createdAt).getTime();
      const end = new Date(dto.updatedAt).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        const sec = Math.floor((end - start) / 1000);
        const mins = Math.round(sec / 60);
        duration =
          mins >= 60
            ? `${Math.floor(mins / 60)} giờ ${mins % 60} phút`
            : `${Math.max(1, mins)} phút`;
      }
    }
  }
  if (!duration) {
    duration = "1 phút";
  }

  return {
    id: dto.id,
    ownerId: dto.ownerId || currentUserId || "",
    name: dto.title || dto.name || "Cung đường cá nhân",
    region: dto.region || "Lâm Đồng",
    difficulty: mapDifficultyFromBackend(dto.difficulty),
    distanceKm: Number(dto.distanceKm || 0),
    elevationGainM: Math.round(dto.elevationGainM || 0),
    duration,
    terrainType: dto.terrainType || "Rừng & Đồi dốc",
    description: dto.description || "",
    visibility,
    verificationStatus,
    rejectionReason: dto.rejectionReason,
    gpsSegments,
    gpsRoute,
    checkpoints: dto.checkpoints || [],
    clientRecordingId: dto.clientRecordingId || undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

async function resolveToken(explicitToken?: string): Promise<string | undefined> {
  if (explicitToken) return explicitToken;
  const auth = await readStoredAuth();
  return auth?.accessToken;
}

// ==================== API CLIENT ====================

export const personalTrailApi = {
  /**
   * 4.1. Khởi Tạo Phiên Ghi (Start Recording Session)
   * POST /api/v1/trail-recordings/start
   */
  async startRecording(
    payload: StartRecordingRequest,
    accessToken?: string,
  ): Promise<BackendResponse<StartRecordingResponseData>> {
    const token = await resolveToken(accessToken);
    const body: StartRecordingRequest = {
      ...payload,
      deviceInfo: payload.deviceInfo || {
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        deviceModel: Platform.select({
          ios: "iOS Device",
          android: "Android Device",
          default: "Mobile",
        }),
      },
    };

    return apiRequest<BackendResponse<StartRecordingResponseData>>(
      "/api/v1/trail-recordings/start",
      {
        method: "POST",
        accessToken: token,
        body: JSON.stringify(body),
        fallbackMessages: {
          400: "Thông tin phiên ghi không hợp lệ.",
          401: "Vui lòng đăng nhập để bắt đầu phiên ghi.",
        },
      },
    );
  },

  /**
   * 4.2. Gửi Lô Mẫu GPS Thô (Upload Raw GPS Samples Batch)
   * POST /api/v1/trail-recordings/:recordingId/raw-samples
   */
  async uploadRawSamples(
    recordingId: string,
    payload: UploadRawSamplesRequest,
    accessToken?: string,
  ): Promise<BackendResponse<UploadRawSamplesResponseData>> {
    const token = await resolveToken(accessToken);
    return apiRequest<BackendResponse<UploadRawSamplesResponseData>>(
      `/api/v1/trail-recordings/${recordingId}/raw-samples`,
      {
        method: "POST",
        accessToken: token,
        body: JSON.stringify(payload),
        fallbackMessages: {
          400: "Lô toạ độ GPS gửi lên không hợp lệ.",
          404: "Không tìm thấy phiên ghi trên máy chủ.",
          409: "Phiên ghi đã hoàn tất trước đó.",
        },
      },
    );
  },

  /**
   * 4.3. Cập Nhật Trạng Thái Phiên Ghi (Pause / Resume)
   * PATCH /api/v1/trail-recordings/:recordingId/status
   */
  async updateRecordingStatus(
    recordingId: string,
    payload: UpdateRecordingStatusRequest,
    accessToken?: string,
  ): Promise<BackendResponse<UpdateRecordingStatusResponseData>> {
    const token = await resolveToken(accessToken);
    return apiRequest<BackendResponse<UpdateRecordingStatusResponseData>>(
      `/api/v1/trail-recordings/${recordingId}/status`,
      {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify(payload),
        fallbackMessages: {
          400: "Trạng thái phiên ghi không hợp lệ.",
          404: "Không tìm thấy phiên ghi trên máy chủ.",
          409: "Phiên ghi đã hoàn tất, không thể thay đổi trạng thái.",
        },
      },
    );
  },

  /**
   * 4.4. Hoàn Tất Phiên Ghi & Nắn Chuẩn Độ Cao DEM (Finish & Create Trail)
   * POST /api/v1/trail-recordings/:recordingId/finish
   */
  async finishRecording(
    recordingId: string,
    payload: FinishRecordingRequest,
    accessToken?: string,
  ): Promise<BackendResponse<FinishRecordingResponseData>> {
    const token = await resolveToken(accessToken);
    return apiRequest<BackendResponse<FinishRecordingResponseData>>(
      `/api/v1/trail-recordings/${recordingId}/finish`,
      {
        method: "POST",
        accessToken: token,
        body: JSON.stringify(payload),
        timeoutMs: 30_000, // DEM raster download & processing có thể mất vài giây
        fallbackMessages: {
          400: "Chưa đủ toạ độ GPS hợp lệ để hoàn tất cung đường.",
          404: "Không tìm thấy phiên ghi trên máy chủ.",
          409: "Phiên ghi này đã được hoàn tất trước đó.",
        },
      },
    );
  },

  /**
   * 4.5. Polling Kiểm Tra Trạng Thái & Telemetry Phiên Ghi
   * GET /api/v1/trail-recordings/:recordingId/status
   */
  async getRecordingStatus(
    recordingId: string,
    accessToken?: string,
  ): Promise<BackendResponse<RecordingStatusResponseData>> {
    const token = await resolveToken(accessToken);
    return apiRequest<BackendResponse<RecordingStatusResponseData>>(
      `/api/v1/trail-recordings/${recordingId}/status`,
      {
        method: "GET",
        accessToken: token,
        fallbackMessages: {
          404: "Không tìm thấy phiên ghi trên máy chủ.",
        },
      },
    );
  },

  /**
   * 4.6. Danh Sách Cung Đường Của Tôi (Get My Personal Trails)
   * GET /api/v1/personal-trails/my-trails?page=1&limit=20&verificationStatus=...
   */
  async getAllMyTrails(accessToken?: string): Promise<PersonalTrailDto[]> {
    const trails: PersonalTrailDto[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const response = await this.getMyTrails({ page, limit: 50 }, accessToken);
      if (!response.success || !Array.isArray(response.data)) throw new Error("Danh sách cung đường không hợp lệ.");
      trails.push(...response.data);
      totalPages = response.pagination?.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);
    return trails;
  },

  async getMyTrails(
    params?: {
      page?: number;
      limit?: number;
      verificationStatus?: string;
    },
    accessToken?: string,
  ): Promise<MyPersonalTrailsResponse> {
    const token = await resolveToken(accessToken);
    const query = new URLSearchParams();
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));
    if (params?.verificationStatus && params.verificationStatus !== "ALL") {
      query.append("verificationStatus", params.verificationStatus);
    }
    const queryString = query.toString() ? `?${query.toString()}` : "";

    return apiRequest<MyPersonalTrailsResponse>(
      `/api/v1/personal-trails/my-trails${queryString}`,
      {
        method: "GET",
        accessToken: token,
        fallbackMessages: {
          401: "Vui lòng đăng nhập để xem cung đường cá nhân.",
        },
      },
    );
  },

  /**
   * 4.7. Lấy Chi Tiết Cung Đường Cá Nhân (Get Personal Trail Detail)
   * GET /api/v1/personal-trails/:id
   */
  async getTrailDetail(
    trailId: string,
    accessToken?: string,
  ): Promise<BackendResponse<PersonalTrailDto>> {
    const token = await resolveToken(accessToken);
    const response = await apiRequest<BackendResponse<PersonalTrailDto>>(
      `/api/v1/personal-trails/${trailId}`,
      {
        method: "GET",
        accessToken: token,
        fallbackMessages: {
          404: "Không tìm thấy cung đường yêu cầu.",
          403: "Bạn không có quyền truy cập cung đường này.",
        },
      },
    );
    if (response.success && response.data) {
      const checkpoints = await this.getTrailCheckpoints(trailId, token);
      if (!checkpoints.success || !Array.isArray(checkpoints.data)) {
        throw new Error("Máy chủ chưa trả về danh sách checkpoint hợp lệ.");
      }
      response.data.checkpoints = checkpoints.data.map((point) => ({
        id: point.id,
        order: point.sequence,
        name: point.name,
        status: "PENDING",
        distanceFromStartKm: 0,
        coords: { x: 0, y: 0 },
        realCoords: { lat: point.latitude, lon: point.longitude },
      }));
    }
    return response;
  },

  async getTrailCheckpoints(
    trailId: string,
    accessToken?: string,
  ): Promise<BackendResponse<PersonalCheckpointDto[]>> {
    const token = await resolveToken(accessToken);
    return apiRequest(`/api/v1/personal-trails/${trailId}/checkpoints`, {
      method: "GET",
      accessToken: token,
    });
  },

  /**
   * 4.8. Cập Nhật Thông Tin Cung Đường (Update Personal Trail)
   * PUT /api/v1/personal-trails/:id
   */
  async updateTrail(
    trailId: string,
    payload: UpdatePersonalTrailRequest,
    accessToken?: string,
  ): Promise<BackendResponse<PersonalTrailDto>> {
    const token = await resolveToken(accessToken);
    return apiRequest<BackendResponse<PersonalTrailDto>>(
      `/api/v1/personal-trails/${trailId}`,
      {
        method: "PUT",
        accessToken: token,
        body: JSON.stringify(payload),
        fallbackMessages: {
          400: "Không thể chỉnh sửa cung đường đã được duyệt hoặc dữ liệu không hợp lệ.",
          404: "Không tìm thấy cung đường cần cập nhật.",
          403: "Bạn không có quyền chỉnh sửa cung đường này.",
        },
      },
    );
  },

  /**
   * 4.9. Xóa Cung Đường Cá Nhân (Soft Delete)
   * DELETE /api/v1/personal-trails/:id
   */
  async deleteTrail(
    trailId: string,
    accessToken?: string,
  ): Promise<{ success: boolean; message?: string }> {
    const token = await resolveToken(accessToken);
    return apiRequest<{ success: boolean; message?: string }>(
      `/api/v1/personal-trails/${trailId}`,
      {
        method: "DELETE",
        accessToken: token,
        fallbackMessages: {
          404: "Không tìm thấy cung đường cần xóa.",
          403: "Bạn không có quyền xóa cung đường này.",
        },
      },
    );
  },

  /**
   * 4.10. Gửi Yêu Cầu Kiểm Duyệt Cung Đường (Submit For Verification)
   * POST /api/v1/personal-trails/:id/submit-verification
   */
  async submitVerification(
    trailId: string,
    payload?: SubmitVerificationRequest,
    accessToken?: string,
  ): Promise<BackendResponse<SubmitVerificationResponseData>> {
    const token = await resolveToken(accessToken);
    return apiRequest<BackendResponse<SubmitVerificationResponseData>>(
      `/api/v1/personal-trails/${trailId}/submit-verification`,
      {
        method: "POST",
        accessToken: token,
        body: JSON.stringify(payload || {}),
        fallbackMessages: {
          400: "Cung đường không hợp lệ hoặc đã được gửi duyệt trước đó.",
          422: "Cung đường phải dài ít nhất 500m (0.5km) và hoàn tất chuẩn hóa độ cao để gửi duyệt.",
          404: "Không tìm thấy cung đường cần gửi duyệt.",
        },
      },
    );
  },

  /**
   * 4.11. Tra Cứu Nhanh Độ Cao Vệ Tinh (DEM Elevation Lookup)
   * POST /api/v1/elevation/lookup
   */
  async lookupElevation(
    coordinates: { latitude: number; longitude: number }[],
  ): Promise<number[]> {
    const res = await apiRequest<{ success: boolean; data: number[] }>(
      "/api/v1/elevation/lookup",
      {
        method: "POST",
        body: JSON.stringify({ coordinates }),
        fallbackMessages: {
          400: "Danh sách toạ độ tra cứu không hợp lệ.",
        },
      },
    );
    return res.data || [];
  },
};
