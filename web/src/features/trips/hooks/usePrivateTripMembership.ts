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
  const [activeMemberCount, setActiveMemberCount] = useState<number>(0);
  const [totalMembers, setTotalMembers] = useState<number>(0);

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
  const joinTrip = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await privateTripMembershipApi.join(code);
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
      if (typeof data?.trip?.activeMemberCount === 'number') {
        setActiveMemberCount(data.trip.activeMemberCount);
      }
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
  const loadMembers = useCallback(
    async (
      tripId: string,
      params?: { page?: number; pageSize?: number; status?: 'ACTIVE' | 'LEFT' | 'REMOVED' | 'COMPLETED' | 'NO_SHOW' | 'ALL' }
    ) => {
      setBusy(true);
      setError(null);
      try {
        const data = await privateTripMembershipApi.getMembers(tripId, params);
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? (data as unknown as TripMember[]) : [];
        setMembers(list);
        if (typeof data?.activeMemberCount === 'number') {
          setActiveMemberCount(data.activeMemberCount);
        } else {
          setActiveMemberCount(list.filter((m) => m.status === 'ACTIVE').length);
        }
        if (typeof data?.total === 'number') {
          setTotalMembers(data.total);
        } else {
          setTotalMembers(list.length);
        }
        return data;
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.response?.data?.error?.message || "Không thể tải danh sách thành viên.";
        setError(msg);
        return null;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  // Rời nhóm
  const leaveTrip = async (tripId: string, expectedMemberVersion = 1) => {
    setBusy(true);
    setError(null);
    try {
      await privateTripMembershipApi.leave(tripId, expectedMemberVersion);
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
  const removeMember = async (tripId: string, memberId: string, expectedMemberVersion = 1) => {
    setBusy(true);
    setError(null);
    try {
      await privateTripMembershipApi.removeMember(tripId, memberId, expectedMemberVersion);
      setMembers((prev) => prev.filter((m) => m.id !== memberId && m.userId !== memberId));
      setActiveMemberCount((prev) => Math.max(0, prev - 1));
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
    activeMemberCount,
    totalMembers,
    loadInvitation,
    joinTrip,
    loadRoom,
    loadMembers,
    leaveTrip,
    removeMember,
  };
}
