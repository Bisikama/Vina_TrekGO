import { apiRequest } from "@/lib/api-client";

export type InvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "REVOKED"
  | "EXPIRED"
  | "INVALIDATED";

export interface InvitationTrip {
  id: string;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  destination: {
    id: string;
    name: string;
  };
}

export interface InvitationItem {
  id: string;
  participantId: string;
  status: InvitationStatus;
  reason: string | null;
  version: number;
  expiresAt: string;
  createdAt: string;
  recipientDisplay: string;
  senderDisplay: string;
  participantName: string;
  participantStatus: string;
  checkinStatus: string;
  bookingStatus: string;
  trip: InvitationTrip;
  actions?: {
    canAccept?: boolean;
    canDecline?: boolean;
    canRevoke?: boolean;
  };
  ticketId?: string | null;
}

export interface InvitationsResponse {
  items: InvitationItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PersonalTicket {
  id: string;
  participantName: string;
  participantStatus: string;
  checkinStatus: "NOT_CHECKED_IN" | "CHECKED_IN" | "NO_SHOW";
  checkinMethod: "QR" | "MANUAL" | null;
  checkedInAt: string | null;
  checkinCode: string | null;
  bookingStatus: string;
  pickupPoint?: {
    id: string;
    name: string;
    address: string;
  } | null;
  trip: InvitationTrip;
}

export interface PersonalTicketsResponse {
  items: PersonalTicket[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const invitationsApiService = {
  /**
   * GET /api/v1/me/booking-participant-invitations
   * Lấy danh sách lời mời nhận vé của tài khoản hiện tại
   */
  fetchMyInvitations: async (params?: {
    status?: InvitationStatus;
    page?: number;
    pageSize?: number;
  }): Promise<InvitationsResponse> => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));

    const qs = query.toString();
    const url = `/api/v1/me/booking-participant-invitations${qs ? `?${qs}` : "?status=PENDING"}`;

    return apiRequest<InvitationsResponse>(url, {
      method: "GET",
    });
  },

  /**
   * GET /api/v1/booking-participant-invitations/:id
   * Xem trước chi tiết một lời mời vé
   */
  previewInvitation: async (invitationId: string): Promise<InvitationItem> => {
    return apiRequest<InvitationItem>(
      `/api/v1/booking-participant-invitations/${encodeURIComponent(invitationId)}`,
      {
        method: "GET",
      },
    );
  },

  /**
   * POST /api/v1/booking-participant-invitations/:id/accept
   * Người nhận chấp nhận vé và liên kết vào tài khoản cá nhân
   */
  acceptInvitation: async (
    invitationId: string,
  ): Promise<{
    id: string;
    participantId: string;
    status: InvitationStatus;
    ticketId: string | null;
    trip: InvitationTrip;
  }> => {
    return apiRequest(
      `/api/v1/booking-participant-invitations/${encodeURIComponent(invitationId)}/accept`,
      {
        method: "POST",
        body: JSON.stringify({ confirmParticipantIdentity: true }),
      },
    );
  },

  /**
   * POST /api/v1/booking-participant-invitations/:id/decline
   * Người nhận từ chối lời mời vé
   */
  declineInvitation: async (
    invitationId: string,
    reason?: "IDENTITY_MISMATCH" | "NOT_INTERESTED" | "SCHEDULE_CONFLICT" | "OTHER" | string,
  ): Promise<{
    id: string;
    status: InvitationStatus;
    reason: string | null;
  }> => {
    return apiRequest(
      `/api/v1/booking-participant-invitations/${encodeURIComponent(invitationId)}/decline`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason || "NOT_INTERESTED" }),
      },
    );
  },

  /**
   * GET /api/v1/me/tickets
   * Danh sách vé cá nhân đã liên kết với tài khoản hiện tại
   */
  fetchMyTickets: async (params?: {
    page?: number;
    pageSize?: number;
  }): Promise<PersonalTicketsResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));

    const qs = query.toString();
    const url = `/api/v1/me/tickets${qs ? `?${qs}` : ""}`;

    return apiRequest<PersonalTicketsResponse>(url, {
      method: "GET",
    });
  },

  /**
   * GET /api/v1/me/tickets/:id
   * Chi tiết vé cá nhân kèm checkinCode
   */
  fetchTicketDetail: async (ticketOrParticipantId: string): Promise<PersonalTicket> => {
    return apiRequest<PersonalTicket>(
      `/api/v1/me/tickets/${encodeURIComponent(ticketOrParticipantId)}`,
      {
        method: "GET",
      },
    );
  },
};
