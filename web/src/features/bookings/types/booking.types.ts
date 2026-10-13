export interface Participant {
  id?: string;
  fullName: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
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

export type PaymentMethod = 'QR' | 'REDIRECT';

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

export interface RefundItem {
  refundId: string;
  status: string;
  amount: string;
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
}
