"use client";

import { useCallback, useState } from "react";
import { 
  privateTripMembershipApi, 
  PrivateTripInvitation, 
  PrivateTripRoom, 
  TripMember 
} from "../services/private-trip-membership.api";

export function usePrivateTripMembership() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [invitation, setInvitation] = useState<PrivateTripInvitation | null>(null);
  const [room, setRoom] = useState<PrivateTripRoom | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);

  // Lấy chi tiết lời mời
  const loadInvitation = useCallback(async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      const data = await privateTripMembershipApi.getInvitation(code);
      setInvitation(data);
      return data;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || "Không thể tải thông tin lời mời.";
      setError(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  // Tham gia chuyến đi
  const joinTrip = async (code: string, expectedTripVersion?: number) => {
    setBusy(true);
    setError(null);
    try {
      const result = await privateTripMembershipApi.join(code, expectedTripVersion);
      return result;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || "Không thể tham gia chuyến đi.";
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  // Xem phòng chờ
  const loadRoom = useCallback(async (tripId: string) => {
    setBusy(true);
    setError(null);
    try {
      const data = await privateTripMembershipApi.getRoom(tripId);
      setRoom(data);
      return data;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || "Không thể tải thông tin phòng chờ.";
      setError(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  // Lấy danh sách thành viên
  const loadMembers = useCallback(async (tripId: string, params?: { page?: number; status?: string; role?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const data = await privateTripMembershipApi.getMembers(tripId, params);
      // Bạn có thể xử lý nối mảng nếu đang dùng infinite scroll, tạm thời gán luôn mảng mới
      setMembers(data.items || data as unknown as TripMember[]);
      return data;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || "Không thể tải danh sách thành viên.";
      setError(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  // Rời nhóm
  const leaveTrip = async (tripId: string) => {
    setBusy(true);
    setError(null);
    try {
      await privateTripMembershipApi.leave(tripId);
      // Cập nhật state nội bộ nếu cần (ví dụ clear room)
      setRoom(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || "Không thể rời chuyến đi.";
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  // Host kick thành viên
  const removeMember = async (tripId: string, memberId: string) => {
    setBusy(true);
    setError(null);
    try {
      await privateTripMembershipApi.removeMember(tripId, memberId);
      // Refresh list members sau khi kick
      setMembers(prev => prev.filter(m => m.userId !== memberId && m.id !== memberId));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || "Không thể loại thành viên này.";
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    error,
    invitation,
    room,
    members,
    loadInvitation,
    joinTrip,
    loadRoom,
    loadMembers,
    leaveTrip,
    removeMember,
  };
}
