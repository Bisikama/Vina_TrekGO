// ─── Domain Types for Public Trip Bookings (CF02) ──────────────────────────

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED"
  | "CHECKED_IN"
  | "PARTIAL_CHECKIN"
  | "COMPLETED"
  | "NO_SHOW";

export type PaymentMethod = "QR" | "REDIRECT";
export type PaymentGateway = "momo" | "vnpay";

export type CheckInStatus = "NOT_CHECKED_IN" | "CHECKED_IN" | "NO_SHOW";
export type LinkageStatus = "UNLINKED" | "INVITATION_PENDING" | "CLAIMED";
export type InvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "REVOKED"
  | "EXPIRED"
  | "INVALIDATED";

export interface ParticipantInvitation {
  id: string;
  status: InvitationStatus;
  reason?: string | null;
  version?: number;
  expiresAt?: string;
  recipientDisplay?: string;
}

export interface ParticipantActions {
  canSelfClaim?: boolean;
  canInvite?: boolean;
  canRevoke?: boolean;
}

export interface Participant {
  id?: string;
  fullName: string;
  phone?: string | null;
  dateOfBirth?: string | null; // "YYYY-MM-DD"
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  // Trạng thái điểm danh & mã QR thực tế
  checkinStatus?: CheckInStatus;
  checkinCode?: string | null; // Chỉ có giá trị nếu Buyer được phép xem QR (chưa bị người khác nhận)
  checkinMethod?: string | null;
  checkedInAt?: string | null;
  // Trạng thái liên kết tài khoản
  linkageStatus?: LinkageStatus;
  pendingInvitationId?: string | null;
  recipientDisplay?: string | null;
  invitations?: ParticipantInvitation[];
  actions?: ParticipantActions;
}

export interface PublicTripRoute {
  id: string;
  snapshotName: string;
  snapshotDifficulty?: string | null;
  snapshotDistanceKm?: string | null;
}

export interface PublicTripCheckpoint {
  id: string;
  name: string;
  isRequired: boolean;
}

export interface PublicBookingTrip {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startAt: string;
  endAt: string;
  destination: {
    id: string;
    name: string;
  };
  leader: {
    id: string;
    fullName: string;
  } | null;
  pricePerPax: string | null;
  currency: string;
  capacity: number;
  remainingSlots: number;
  pickup: {
    id: string;
    name: string;
    address: string;
  } | null;
  routes: PublicTripRoute[];
  checkpoints: PublicTripCheckpoint[];
  transportAvailable: boolean;
  transport: { vehicleType: string }[];
}

export interface Checkout {
  type: PaymentMethod;
  url: string | null;
  qrData: string | null;
  expiresAt?: string;
}

export interface PaymentSummary {
  paymentId: string;
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | string;
  applicationStatus: "APPLIED" | "REJECTED" | null;
  applicationReasonCode: string | null;
  reconciliationRequired: boolean;
  checkout: Checkout | null;
  providerEnvironment?: string | null;
  gateway?: PaymentGateway | string;
}

export interface RefundItem {
  refundId: string;
  paymentId?: string;
  purpose?: string;
  reasonCode?: string | null;
  amount: string;
  currency?: string;
  status: string;
  refundedAt?: string;
  reconciliationRequired?: boolean;
}

export interface BookingTransport {
  vehicleType: string;
  plateNumber?: string | null; // Chỉ có khi CONFIRMED
  driverName?: string | null;
  driverPhone?: string | null;
  meetingAt?: string;
}

export interface BookingDetail {
  id: string;
  bookingCode?: string | null;
  status: BookingStatus;
  version: number;
  participantCount: number;
  expiresAt: string;
  confirmedAt: string | null;
  pricePerPax: string;
  totalAmount: string;
  currency: string;
  canEditParticipants: boolean;
  canCancel: boolean;
  rentalEligible: boolean;
  trip: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
  };
  pickup: {
    id: string;
    name: string;
    address: string;
    latitude?: string | number;
    longitude?: string | number;
  };
  returnPoint?: {
    id: string;
    name: string;
    address: string;
    latitude?: string | number;
    longitude?: string | number;
  };
  participants: Participant[];
  transport: BookingTransport[];
  paymentSummary: PaymentSummary | null;
  refunds: RefundItem[];
}

export type BookingSummary = Pick<
  BookingDetail,
  "id" | "status" | "participantCount" | "totalAmount" | "currency" | "expiresAt" | "trip"
> & {
  version?: number;
};

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicTripsQuery {
  page?: number;
  pageSize?: number;
  destinationId?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "EXTREME" | string;
  dateFrom?: string;
  dateTo?: string;
  price?: number;
}

export interface BookingListQuery {
  page?: number;
  pageSize?: number;
  status?: BookingStatus | string;
}

export interface PaymentOption {
  gateway: PaymentGateway;
  environment: string;
}

export interface PaymentOptionsResponse {
  gateways: PaymentOption[];
}

export interface PaymentCheckoutResponse {
  paymentId: string;
  invoiceId?: string;
  status: string;
  amount: string;
  currency: string;
  gateway?: string;
  providerEnvironment?: string;
  checkout: Checkout | null;
}

export interface CancelBookingResponse {
  bookingId: string;
  cancellationId: string;
  status: BookingStatus;
  refundableAmount: string;
  currency: string;
}
