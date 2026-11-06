import { apiRequest } from '@/lib/api-client';

export interface TripCancellationRequest {
  id: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  reviewNote: string | null;
  trip: { id: string; title: string; status: string; startAt: string };
}
export interface TripCancellationDetail extends TripCancellationRequest {
  executionStatus: string;
  remainingBookings: number;
  actionRequiredRentals: number;
  refunds: { status: string; _count: { _all: number }; _sum: { amount: string | null } }[];
}
export const listTripCancellations = (token: string, page: number, status: string) => apiRequest<{ items: TripCancellationRequest[]; total: number; page: number; pageSize: number }>(
  '/api/v1/leader/trip-cancellation-requests?page=' + page + '&pageSize=20' + (status ? '&status=' + status : ''), { accessToken: token, timeoutMs: 8000 });
export const getTripCancellation = (token: string, id: string) => apiRequest<TripCancellationDetail>('/api/v1/leader/trip-cancellation-requests/' + encodeURIComponent(id), { accessToken: token, timeoutMs: 8000 });
