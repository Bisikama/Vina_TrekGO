import { apiClient } from '@/lib/axios';
import { PrivateTrip } from './private-trips.api';

export interface PrivateTripInvitation {
  trip: {
    id: string;
    tripType: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    host: { displayName: string };
    activeMemberCount: number;
    capacity: number;
    remainingSlots: number;
  };
  invite: { expiresAt: string; status: string };
  joinable: boolean;
  joinDisabledReason: string | null;
}

export interface TripMember {
  id: string;
  userId: string;
  tripId?: string;
  role: 'HOST' | 'MEMBER';
  status: 'ACTIVE' | 'LEFT' | 'REMOVED' | 'COMPLETED' | 'NO_SHOW';
  joinedAt: string;
  version: number;
  displayName: string;
  isHost: boolean;
  user?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
}

export interface TripMembersResponse {
  items: TripMember[];
  page: number;
  pageSize: number;
  total: number;
  activeMemberCount: number;
  capacity: number;
}

export interface PrivateTripRoom {
  trip: {
    id: string;
    tripType: string;
    title: string;
    description: string | null;
    status: string;
    version: number;
    startAt: string;
    endAt: string;
    capacity: number;
    activeMemberCount: number;
    pickupPoint: {
      id: string;
      name: string;
      address?: string | null;
      latitude?: string | number | null;
      longitude?: string | number | null;
    } | null;
  };
  viewer: {
    isHost: boolean;
    membershipId: string | null;
    membershipVersion: number | null;
    membershipStatus: string | null;
  };
  permissions: {
    canInvite: boolean;
    canRemoveMembers: boolean;
    canLeave: boolean;
    canRent: boolean;
  };
  plannedRoutes?: any[];
  requiredCheckpoints?: any[];
  // Backwards compatibility fields
  title?: string;
  status?: string;
  startAt?: string;
  endAt?: string;
  maxPax?: number;
  myMembership?: TripMember;
}

export const privateTripMembershipApi = {
  // Lấy chi tiết lời mời công khai
  getInvitation: async (code: string) => {
    const { data } = await apiClient.get<PrivateTripInvitation>(`/api/v1/private-trip-invitations/${code}`);
    return data;
  },

  // Tham gia / Tham gia lại chuyến đi thông qua mã mời
  join: async (code: string) => {
    const { data } = await apiClient.post<{
      tripId: string;
      membership: { id: string; role: string; status: string; joinedAt: string; version: number } | null;
      alreadyMember: boolean;
      rejoined: boolean;
      isHost: boolean;
      activeMemberCount: number;
      capacity: number;
      tripVersion: number;
      redirectTo: string;
    }>(`/api/v1/private-trip-invitations/${code}/join`, {});
    return data;
  },

  // Xem phòng chờ chuyến đi dành cho Host và Member ACTIVE
  getRoom: async (tripId: string) => {
    const { data } = await apiClient.get<PrivateTripRoom>(`/api/v1/private-trips/${tripId}/room`);
    return data;
  },

  // Lấy danh sách thành viên (có phân trang)
  getMembers: async (
    tripId: string,
    params: { page?: number; pageSize?: number; status?: 'ACTIVE' | 'LEFT' | 'REMOVED' | 'COMPLETED' | 'NO_SHOW' | 'ALL' } = {}
  ) => {
    const { data } = await apiClient.get<TripMembersResponse>(
      `/api/v1/private-trips/${tripId}/members`,
      { params }
    );
    return data;
  },

  // Thành viên tự rời nhóm trước khi khởi hành
  leave: async (tripId: string, expectedMemberVersion = 1) => {
    const { data } = await apiClient.post(`/api/v1/private-trips/${tripId}/leave`, {
      expectedMemberVersion,
    });
    return data;
  },

  // Host kick (loại) thành viên khỏi chuyến đi
  removeMember: async (tripId: string, memberId: string, expectedMemberVersion = 1) => {
    const { data } = await apiClient.delete(`/api/v1/private-trips/${tripId}/members/${memberId}`, {
      params: { expectedMemberVersion },
    });
    return data;
  },
};
