import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  acceptMemberInvitation,
  declineMemberInvitation,
  getMyReceivedInvitations,
} from "../services/private-member-invitations.api";
import type {
  AcceptInvitationResponse,
  DeclineReason,
  InvitationStatus,
  PrivateMemberInvitationItem,
} from "../types";

export function useMyReceivedInvitations() {
  const [invitations, setInvitations] = useState<PrivateMemberInvitationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (status?: InvitationStatus) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyReceivedInvitations({
        page: 1,
        pageSize: 50,
        status,
      });
      setInvitations(res.items || []);
    } catch (err: any) {
      setError(err?.message || "Không thể tải danh sách lời mời nhận được.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const accept = async (
    invitationId: string,
  ): Promise<AcceptInvitationResponse | null> => {
    setAcceptingId(invitationId);
    try {
      const res = await acceptMemberInvitation(invitationId);
      // Mark as accepted locally
      setInvitations((prev) =>
        prev.map((i) =>
          i.id === invitationId ? { ...i, status: "ACCEPTED" } : i,
        ),
      );
      setAcceptingId(null);
      return res;
    } catch (err: any) {
      setAcceptingId(null);
      const code = err?.code || "";
      let errorMsg = err?.message || "Không thể chấp nhận lời mời.";

      if (code === "TRIP_CAPACITY_EXCEEDED") {
        errorMsg = "Rất tiếc! Chuyến đi đã đủ số lượng thành viên tối đa.";
      } else if (code === "INVITATION_NOT_PENDING") {
        errorMsg = "Lời mời này đã được xử lý, đã hết hạn hoặc bị thu hồi.";
      } else if (code === "INVITATION_EXPIRED") {
        errorMsg = "Lời mời này đã quá thời hạn phản hồi.";
      }

      Alert.alert("Thông báo", errorMsg);
      // Refresh to update status
      void refetch();
      return null;
    }
  };

  const decline = async (
    invitationId: string,
    reason: DeclineReason = "NOT_INTERESTED",
  ): Promise<boolean> => {
    setDecliningId(invitationId);
    try {
      await declineMemberInvitation(invitationId, reason);
      // Mark as declined locally
      setInvitations((prev) =>
        prev.map((i) =>
          i.id === invitationId ? { ...i, status: "DECLINED" } : i,
        ),
      );
      setDecliningId(null);
      return true;
    } catch (err: any) {
      setDecliningId(null);
      Alert.alert(
        "Lỗi từ chối",
        err?.message || "Không thể gửi phản hồi từ chối lúc này.",
      );
      return false;
    }
  };

  return {
    invitations,
    loading,
    acceptingId,
    decliningId,
    error,
    refetch,
    accept,
    decline,
  };
}
