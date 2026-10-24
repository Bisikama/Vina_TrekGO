import { TripStatus } from "@/features/leaders/types/leader-trips";

export interface PublicTripItem {
  id: string;
  title: string;
  description: string | null;
  destinationId: string;
  startAt: string;
  endAt: string;
  registrationOpenAt?: string | null;
  registrationDeadlineAt?: string | null;
  capacity: number;
  price: string | null;
  pickupPointId: string | null;
  status: TripStatus;
  publishedAt: string | null;
  closedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  systemTrailId?: string | null;
}

export interface PublicTripListQuery {
  page?: number;
  pageSize?: number;
  destinationId?: string;
}
