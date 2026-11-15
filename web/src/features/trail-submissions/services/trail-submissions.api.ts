import axios from "axios";
import { apiClient } from "@/lib/axios";

export type SubmissionFilter = "PENDING" | "APPROVED" | "REJECTED";
export type ReviewDecision = "APPROVE" | "REJECT";

export interface TrailSubmission {
  id: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  submissionNote: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  submittedBy: { id: string; fullName: string; email: string; avatarUrl: string | null };
  reviewedBy: { id: string; fullName: string } | null;
  trail: {
    id: string;
    title: string;
    difficulty: string | null;
    distanceKm: number;
    elevationGainM: number | null;
    elevationLossM: number | null;
    duration: string | null;
  };
}

export interface TrailSubmissionPage {
  data: TrailSubmission[];
  pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

const BASE = "/api/v1/admin/trail-submissions";

export async function listTrailSubmissions(params: {
  status: SubmissionFilter;
  page: number;
  limit: number;
}): Promise<TrailSubmissionPage> {
  const { data } = await apiClient.get<TrailSubmissionPage>(BASE, { params });
  return data;
}

export interface TrailSubmissionCheckpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sequence: number;
}

export interface TrailSubmissionDetail extends Omit<TrailSubmission, "trail"> {
  trail: TrailSubmission["trail"] & {
    description: string | null;
    /** MultiLineString coordinates: segments of [lng, lat, elevation?]. */
    gpsSegments: number[][][];
    checkpoints: TrailSubmissionCheckpoint[];
  };
}

export async function getTrailSubmissionDetail(id: string): Promise<TrailSubmissionDetail> {
  const { data } = await apiClient.get<{ data: TrailSubmissionDetail }>(`${BASE}/${id}`);
  return data.data;
}

export async function reviewTrailSubmission(
  id: string,
  body: { decision: ReviewDecision; reviewNote?: string },
): Promise<void> {
  await apiClient.patch(`${BASE}/${id}/review`, body);
}

const MESSAGES: Record<string, string> = {
  TRAIL_SUBMISSION_NOT_FOUND: "Yêu cầu kiểm duyệt không còn tồn tại hoặc cung đường đã bị xóa.",
  TRAIL_SUBMISSION_ALREADY_REVIEWED: "Yêu cầu này đã được xử lý trước đó. Danh sách sẽ được tải lại.",
  PERSONAL_TRAIL_STORAGE_BUSY: "Cung đường đang được cập nhật. Vui lòng thử lại sau giây lát.",
  FORBIDDEN: "Bạn không có quyền kiểm duyệt cung đường.",
  UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
};

export function getTrailSubmissionError(error: unknown): { message: string; code?: string } {
  if (axios.isAxiosError(error)) {
    const err = error.response?.data?.error;
    const code: string | undefined = err?.code;
    return {
      code,
      message: (code && MESSAGES[code]) || err?.message || "Không thể kết nối máy chủ. Vui lòng thử lại.",
    };
  }
  return { message: error instanceof Error ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại." };
}
