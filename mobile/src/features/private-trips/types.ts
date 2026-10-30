// ─── Domain Types for Private Trips (CF03 & CF04) ───────────────────────────

export type TripStatus =
  | "DRAFT"
  | "OPEN"
  | "FULL"
  | "CLOSED"
  | "CANCEL_PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "INTERRUPTED";

export type MemberRole = "HOST" | "MEMBER";

export type MemberStatus =
  | "ACTIVE"
  | "LEFT"
  | "REMOVED"
  | "COMPLETED"
  | "NO_SHOW";

export interface CheckpointItem {
  id: string;
  name: string;
  sequence: number;
  latitude?: number;
  longitude?: number;
}

export interface PrivateTrailSource {
  id: string; // personal trail ID hoặc systemTrailId
  type: "PERSONAL" | "SYSTEM";
  name: string;
  destinationId: string;
  points: CheckpointItem[];
}

export interface PickupPointOption {
  id: string;
  name: string;
  address?: string;
}

export interface PrivateTrip {
  id: string;
  title: string;
  description: string | null;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
  maxPax: number; // capacity bao gồm cả Host
  pickupPointId: string;
  destinationId: string;
  status: TripStatus;
  version: number;
  inviteCode?: string;
  pickupPoint?: PickupPointOption;
  tripCheckpointsViaTripId?: CheckpointItem[];
  tripTrailPlansViaTripId?: Array<{
    snapshotName: string;
    snapshotGeojson?: any;
  }>;
  activeMemberCount?: number;
  viewer?: {
    isHost: boolean;
    membershipId: string;
    membershipVersion: number;
    membershipStatus: MemberStatus;
  };
  permissions?: TripRoomPermissions;
}

export interface MyPrivateTripsResponse {
  items: PrivateTrip[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TripMember {
  id: string; // membership ID (dùng khi xóa thành viên)
  userId: string; // ID tài khoản user
  displayName: string; // Tên hiển thị của tài khoản
  role: "HOST" | "MEMBER";
  status: "ACTIVE" | "LEFT" | "REMOVED" | MemberStatus;
  joinedAt: string;
  leftAt?: string | null;
  version: number; // version của membership (bắt buộc khi xóa thành viên)
  isHost?: boolean;
  avatarUrl?: string | null;
}

export interface TripMembersResponse {
  items: TripMember[];
  page: number;
  pageSize: number;
  total: number;
  activeMemberCount: number;
  capacity: number;
}

export interface TripRoomViewer {
  isHost: boolean;
  membershipId: string;
  membershipVersion: number;
  membershipStatus: MemberStatus;
}

export interface TripRoomPermissions {
  canInvite: boolean;
  canRemoveMembers: boolean;
  canLeave: boolean;
  canRent: boolean;
}

export interface TripRoomData {
  trip: {
    id: string;
    tripType: "PRIVATE";
    title: string;
    description: string | null;
    status: TripStatus;
    version: number;
    startAt: string;
    endAt: string;
    capacity: number;
    activeMemberCount: number;
    pickupPoint?: PickupPointOption & {
      latitude?: string;
      longitude?: string;
    };
  };
  viewer: TripRoomViewer;
  permissions: TripRoomPermissions;
  rental?: {
    eligible: boolean;
    reason: string;
  };
  plannedRoutes?: any[];
  requiredCheckpoints?: CheckpointItem[];
}

export interface InvitePreviewData {
  trip: {
    id: string;
    tripType: "PRIVATE";
    title: string;
    startAt: string;
    endAt: string;
    status: TripStatus;
    host: {
      displayName: string;
      avatarUrl?: string | null;
    };
    activeMemberCount: number;
    capacity: number;
    remainingSlots: number;
  };
  invite: {
    expiresAt?: string;
    status: "ACTIVE" | "EXPIRED" | "REVOKED";
  };
  joinable: boolean;
  joinDisabledReason: string | null;
}

export interface CreatePrivateTripPayload {
  type: "PERSONAL" | "SYSTEM";
  trailRef: string;
  destinationId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  pickupPointId: string;
  capacity: number;
  checkpointIds: string[];
}

export interface UpdatePrivateTripPayload {
  expectedVersion: number;
  title?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  capacity?: number;
  pickupPointId?: string;
}

export interface CreateInviteResponse {
  inviteId: string;
  inviteCode: string;
  inviteUrl: string;
  expiresAt?: string;
  status: "ACTIVE";
  tripVersion: number;
}

export interface JoinTripResponse {
  tripId: string;
  membership: {
    id: string;
    role: MemberRole;
    status: MemberStatus;
    joinedAt: string;
    version: number;
  };
  alreadyMember: boolean;
  rejoined: boolean;
  isHost: boolean;
  activeMemberCount: number;
  capacity: number;
  tripVersion: number;
  redirectTo: string;
}

export interface LeaveTripResponse {
  tripId: string;
  membershipId: string;
  status: "LEFT";
  memberVersion: number;
  tripVersion: number;
  changed: boolean;
}

export interface RemoveMemberResponse {
  tripId: string;
  membershipId: string;
  status: "REMOVED";
  memberVersion: number;
  tripVersion: number;
  changed: boolean;
}

// ─── Trail Access & Purchase Types ──────────────────────────────────────────

export interface TrailAccessResponse {
  hasAccess: boolean;
  accessId: string | null;
  purchasedAt: string | null;
}

export interface PurchaseTrailPayload {
  paymentMethod: "QR" | "REDIRECT";
  gateway?: "momo" | "vnpay";
}

export interface PurchaseTrailResponse {
  trailAccessId: string;
  accessStatus: "ACTIVE" | "PENDING_PAYMENT";
  paymentId: string | null;
  invoiceId: string | null;
  amount: string;
  currency: string;
  expiresAt?: string;
  checkout: {
    url?: string;
    paymentUrl?: string;
    qrCode?: string;
    qrData?: string;
    expiresAt?: string;
    type?: string;
  } | null;
}

// ─── Direct Member Invitation Types (PR #86 / M1–M4) ─────────────────────────

export type InvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "REVOKED"
  | "EXPIRED"
  | "INVALIDATED";

export type DeclineReason =
  | "NOT_INTERESTED"
  | "SCHEDULE_CONFLICT"
  | "OTHER";

export interface PrivateMemberInvitationItem {
  id: string;
  tripId: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  reason: string | null;
  version: number;
  reservesCapacity: boolean;
  recipientDisplay: string;
  senderDisplay?: string;
  trip?: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    maxPax?: number;
  };
  actions?: {
    canAccept: boolean;
    canEnterRoom: boolean;
    canDecline: boolean;
    canRevoke: boolean;
  };
}

export interface MemberInvitationsListResponse {
  items: PrivateMemberInvitationItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CreateMemberInvitationPayload {
  recipientEmail: string;
  expiresAt?: string;
}

export interface AcceptInvitationResponse {
  invitationStatus: InvitationStatus;
  resolutionReason: string | null;
  tripId: string;
  memberId: string | null;
  membershipStatus: string | null;
  membershipVersion: number | null;
  canEnterRoom: boolean;
  alreadyMember: boolean;
  rejoined: boolean;
}

