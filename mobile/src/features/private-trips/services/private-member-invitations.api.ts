import { apiRequest } from "@/lib/api-client";
import type {
  AcceptInvitationResponse,
  CreateMemberInvitationPayload,
  DeclineReason,
  InvitationStatus,
  MemberInvitationsListResponse,
  PrivateMemberInvitationItem,
} from "../types";

// ─── UUID Helper for Idempotency ──────────────────────────────────────────────

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Direct Member Invitations API (PR #86 / M1–M4) ──────────────────────────

/**
 * 1. POST /api/v1/private-trips/:id/member-invitations (M1)
 * Host gửi lời mời trực tiếp qua Email tài khoản TrekGO (kèm Header Idempotency-Key)
 */
export async function createDirectMemberInvitation(
  tripId: string,
  payload: CreateMemberInvitationPayload,
  idempotencyKey?: string,
): Promise<PrivateMemberInvitationItem> {
  const key = idempotencyKey || generateUUID();
  return apiRequest<PrivateMemberInvitationItem>(
    `/api/v1/private-trips/${tripId}/member-invitations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        recipientEmail: payload.recipientEmail.trim().toLowerCase(),
        ...(payload.expiresAt ? { expiresAt: payload.expiresAt } : {}),
      }),
    },
  );
}

/**
 * 2. GET /api/v1/private-trips/:id/member-invitations (M1)
 * Host xem lịch sử các lời mời đã gửi của chuyến đi
 */
export async function getHostSentMemberInvitations(
  tripId: string,
  params: {
    page?: number;
    pageSize?: number;
    status?: InvitationStatus;
  } = {},
): Promise<MemberInvitationsListResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page || 1));
  query.set("pageSize", String(params.pageSize || 20));
  if (params.status) query.set("status", params.status);

  return apiRequest<MemberInvitationsListResponse>(
    `/api/v1/private-trips/${tripId}/member-invitations?${query.toString()}`,
  );
}

/**
 * 3. POST /api/v1/private-trip-member-invitations/:id/revoke (M4)
 * Host thu hồi lời mời đang chờ phản hồi (PENDING)
 */
export async function revokeMemberInvitation(
  invitationId: string,
): Promise<PrivateMemberInvitationItem> {
  return apiRequest<PrivateMemberInvitationItem>(
    `/api/v1/private-trip-member-invitations/${invitationId}/revoke`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

/**
 * 4. GET /api/v1/me/private-trip-member-invitations (M2)
 * Hộp thư đến: Lấy danh sách các lời mời người dùng hiện tại nhận được
 */
export async function getMyReceivedInvitations(
  params: {
    page?: number;
    pageSize?: number;
    status?: InvitationStatus;
  } = {},
): Promise<MemberInvitationsListResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page || 1));
  query.set("pageSize", String(params.pageSize || 20));
  if (params.status) query.set("status", params.status);

  return apiRequest<MemberInvitationsListResponse>(
    `/api/v1/me/private-trip-member-invitations?${query.toString()}`,
  );
}

/**
 * 5. GET /api/v1/private-trip-member-invitations/:id (M2)
 * Xem chi tiết xem trước (preview) lời mời
 */
export async function previewMemberInvitation(
  invitationId: string,
): Promise<PrivateMemberInvitationItem> {
  return apiRequest<PrivateMemberInvitationItem>(
    `/api/v1/private-trip-member-invitations/${invitationId}`,
  );
}

/**
 * 6. POST /api/v1/private-trip-member-invitations/:id/accept (M3)
 * Chấp nhận lời mời tham gia chuyến đi (tự động cấp quyền phòng chờ)
 */
export async function acceptMemberInvitation(
  invitationId: string,
): Promise<AcceptInvitationResponse> {
  return apiRequest<AcceptInvitationResponse>(
    `/api/v1/private-trip-member-invitations/${invitationId}/accept`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

/**
 * 7. POST /api/v1/private-trip-member-invitations/:id/decline (M4)
 * Từ chối lời mời tham gia chuyến đi
 */
export async function declineMemberInvitation(
  invitationId: string,
  reason: DeclineReason = "NOT_INTERESTED",
): Promise<PrivateMemberInvitationItem> {
  return apiRequest<PrivateMemberInvitationItem>(
    `/api/v1/private-trip-member-invitations/${invitationId}/decline`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
}
