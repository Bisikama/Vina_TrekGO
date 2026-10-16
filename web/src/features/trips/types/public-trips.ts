import { TripStatus } from "@/features/leaders/types/leader-trips";

export interface PublicTripItem {
  id: string;
  title: string;
  description: string | null;
  destinationId: string;
  startAt: string;
  endAt: string;
  capacity: number;
  price: string | null;
  pickupPointId: string | null;
  status: TripStatus;
  publishedAt: string | null;
  systemTrailId?: string | null;
}

export interface PublicTripListQuery {
  page?: number;
  pageSize?: number;
  destinationId?: string;
}
