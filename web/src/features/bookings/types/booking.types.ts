export interface ParticipantActions {
  canSelfClaim?: boolean;
  canInvite?: boolean;
  canRevoke?: boolean;
}

export interface Participant {
  id?: string;
  fullName: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  checkinStatus?: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'NO_SHOW';
  checkinMethod?: 'QR' | 'MANUAL' | null;
  checkedInAt?: string | null;
  checkinCode?: string | null;
  linkageStatus?: 'CLAIMED' | 'INVITATION_PENDING' | 'UNLINKED';
  pendingInvitationId?: string | null;
  recipientDisplay?: string | null;
  actions?: ParticipantActions;
}

export interface PublicTripRoute {
  id: string;
  snapshotName: string;
  snapshotDifficulty: string | null;
  snapshotDistanceKm: string | null;
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
  registrationOpenAt?: string | null;
  registrationDeadlineAt?: string | null;
  publishedAt?: string | null;
  closedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
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
  minCapacity?: number;
  minPax?: number;
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

export type PublicTrip = PublicBookingTrip;
export type PaymentMethod = 'QR' | 'REDIRECT';


export type PaymentGateway = 'momo' | 'vnpay' | 'payos';

export interface PaymentOption {
  gateway: PaymentGateway;
  environment: string;
  methods: PaymentMethod[];
  refundMode?: 'MANUAL_BANK_TRANSFER';
}

export interface PaymentOptionsResponse {
  defaultGateway: PaymentGateway | null;
  gateways: PaymentOption[];
}

export interface Checkout {
  type: PaymentMethod;
  url: string | null;
  qrData: string | null;
}

export interface PaymentSummary {
  paymentId: string;
  status: string;
  applicationStatus: string | null;
  applicationReasonCode: string | null;
  reconciliationRequired: boolean;
  checkout: Checkout | null;
  providerEnvironment: string | null;
}

export interface BookingRefund {
  refundId: string;
  paymentId: string;
  purpose: string;
  status: string;
  amount: string;
  currency: string;
  executionMode: string;
  confirmationSource: string | null;
  refundedAt: string | null;
  reconciliationRequired: boolean;
  reasonCode?: string | null;
  settlementMode?: string | null;
  warnings?: string[];
}

export type RefundItem = BookingRefund;

export interface CancelBookingResponse {
  bookingId: string;
  cancellationId: string;
  status: 'CANCELLED';
  refundableAmount: string;
  currency: string;
  refundProcessingStatus: 'COMPLETED' | 'PENDING' | 'NOT_REQUIRED';
  refund: BookingRefund | null;
}

export interface BookingTransaction {
  id: string;
  kind: 'PAYMENT' | 'REFUND';
  source: 'BOOKING';
  sourceId: string | null;
  paymentId: string;
  refundId: string | null;
  invoiceId: string;
  amount: string;
  currency: string;
  status: string;
  financialEffect: 'DEBIT' | 'CREDIT' | 'NONE';
  executionMode?: string | null;
  confirmationSource?: string | null;
  settlementMode?: string | null;
  warnings?: string[];
  description: string;
  paymentMethod: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface BookingTransactionsResponse {
  items: BookingTransaction[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface BookingDetail {
  id: string;
  status: string;
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
  };
  participants: Participant[];
  transport: {
    vehicleType: string;
    plateNumber?: string | null;
    driverName?: string | null;
    driverPhone?: string | null;
    meetingAt?: string;
  }[];
  paymentSummary: PaymentSummary | null;
  refunds: RefundItem[];
}

export type BookingSummary = Pick<
  BookingDetail,
  'id' | 'status' | 'participantCount' | 'totalAmount' | 'currency' | 'expiresAt' | 'trip'
>;

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicTripsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  difficulty?: string;
  dateFrom?: string;
  dateTo?: string;
  priceMax?: number;
  destinationId?: string;
}

export interface BookingListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
}

export interface PaymentCheckoutResponse {
  checkout: Checkout | null;
  status: string;
  providerEnvironment: string;
  gateway?: string;
}
