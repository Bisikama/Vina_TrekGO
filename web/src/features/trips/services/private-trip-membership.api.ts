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
  tripId: string;
  role: 'HOST' | 'MEMBER';
  status: 'ACTIVE' | 'CANCELLED' | 'REMOVED';
  joinedAt: string;
  user?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
}

export interface PrivateTripRoom extends PrivateTrip {
  members: TripMember[];
  myMembership?: TripMember;
  // Các field khác cho phần route/checkpoints nếu cần
  tripTrailPlansViaTripId?: any[];
  tripCheckpointsViaTripId?: any[];
}

export const privateTripMembershipApi = {
  // Lấy chi tiết lời mời công khai
  getInvitation: async (code: string) => {
    const { data } = await apiClient.get<PrivateTripInvitation>(`/api/v1/private-trip-invitations/${code}`);
    return data;
  },

  // Tham gia / Tham gia lại chuyến đi thông qua mã mời
  join: async (code: string, expectedTripVersion?: number) => {
    const payload = expectedTripVersion !== undefined ? { expectedTripVersion } : {};
    const { data } = await apiClient.post<{ memberId: string; tripId: string; tripVersion: number }>(
      `/api/v1/private-trip-invitations/${code}/join`,
      payload
    );
    return data;
  },

  // Xem phòng chờ chuyến đi dành cho Host và Member ACTIVE
  getRoom: async (tripId: string) => {
    const { data } = await apiClient.get<PrivateTripRoom>(`/api/v1/private-trips/${tripId}/room`);
    return data;
  },

  // Lấy danh sách thành viên (có phân trang)
  getMembers: async (tripId: string, params: { page?: number; status?: string; role?: string } = {}) => {
    const { data } = await apiClient.get<{ items: TripMember[]; total: number; page: number }>(
      `/api/v1/private-trips/${tripId}/members`,
      { params }
    );
    return data;
  },

  // Thành viên tự rời nhóm trước khi khởi hành
  leave: async (tripId: string) => {
    const { data } = await apiClient.post(`/api/v1/private-trips/${tripId}/leave`);
    return data;
  },

  // Host kick (loại) thành viên khỏi chuyến đi
  removeMember: async (tripId: string, memberId: string) => {
    const { data } = await apiClient.delete(`/api/v1/private-trips/${tripId}/members/${memberId}`);
    return data;
  }
};
