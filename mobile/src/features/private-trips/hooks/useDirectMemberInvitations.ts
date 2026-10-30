import { readStoredAuth } from "@/features/auth/storage";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  createDirectMemberInvitation,
  getHostSentMemberInvitations,
  revokeMemberInvitation,
} from "../services/private-member-invitations.api";
import type { InvitationStatus, PrivateMemberInvitationItem } from "../types";

export function useDirectMemberInvitations(tripId?: string) {
  const [sentInvitations, setSentInvitations] = useState<
    PrivateMemberInvitationItem[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSentInvitations = useCallback(
    async (status?: InvitationStatus) => {
      if (!tripId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getHostSentMemberInvitations(tripId, {
          page: 1,
          pageSize: 50,
          status,
        });
        setSentInvitations(res.items || []);
      } catch (err: any) {
        setError(err?.message || "Không thể tải danh sách lời mời đã gửi.");
      } finally {
        setLoading(false);
      }
    },
    [tripId],
  );

  useEffect(() => {
    if (tripId) {
      void fetchSentInvitations();
    }
  }, [tripId, fetchSentInvitations]);

  const sendDirectInvite = async (
    recipientEmail: string,
    expiresAt?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!tripId) return { success: false, error: "Thiếu mã chuyến đi." };

    const email = recipientEmail.trim();
    if (!email || !email.includes("@")) {
      return { success: false, error: "Vui lòng nhập địa chỉ email hợp lệ." };
    }

    const storedAuth = await readStoredAuth();
    if (
      storedAuth?.user?.email &&
      storedAuth.user.email.trim().toLowerCase() === email.toLowerCase()
    ) {
      return {
        success: false,
        error:
          "Đây là email của bạn (Host chuyến đi). Bạn đã có mặt trong đoàn rồi, không thể tự gửi lời mời cho chính mình.",
      };
    }

    setSending(true);
    try {
      const created = await createDirectMemberInvitation(tripId, {
        recipientEmail: email,
        expiresAt,
      });

      // Update local sentInvitations state immediately
      setSentInvitations((prev) => [
        created,
        ...prev.filter((i) => i.id !== created.id),
      ]);
      setSending(false);
      return { success: true };
    } catch (err: any) {
      setSending(false);
      const code =
        err?.code ||
        err?.details?.code ||
        err?.error?.code ||
        "";
      const message = String(err?.message || "");

      console.warn("[sendDirectInvite] Failed to send invite:", {
        code,
        message,
        details: err?.details,
      });

      let errorMsg = message || "Không thể gửi lời mời lúc này.";

      if (
        code === "INVITATION_RECIPIENT_UNAVAILABLE" ||
        message.includes("INVITATION_RECIPIENT_UNAVAILABLE")
      ) {
        errorMsg =
          "Không tìm thấy tài khoản TrekGO với email này (tài khoản cần đăng nhập TrekGO ít nhất một lần để khởi tạo) hoặc tài khoản đã tham gia đoàn.";
      } else if (
        code === "PENDING_INVITATION_EXISTS" ||
        message.includes("PENDING_INVITATION_EXISTS")
      ) {
        errorMsg =
          "Đã có một lời mời đang chờ phản hồi được gửi tới email này trước đó.";
      } else if (
        code === "INVITATION_HOST_SELF_INVITE" ||
        message.includes("SELF")
      ) {
        errorMsg =
          "Bạn là Host của chuyến đi, không thể tự gửi lời mời cho chính mình.";
      } else if (
        code === "FORBIDDEN" ||
        err?.status === 403
      ) {
        errorMsg = "Chỉ Host của chuyến đi mới có quyền gửi lời mời thành viên.";
      } else if (
        code === "TRIP_NOT_FOUND" ||
        err?.status === 404
      ) {
        errorMsg = "Không tìm thấy thông tin chuyến đi.";
      } else if (
        message === "Dữ liệu đầu vào không hợp lệ" ||
        message === "Dữ liệu gửi lên không hợp lệ."
      ) {
        errorMsg =
          "Không tìm thấy tài khoản TrekGO với email này hoặc thông tin không hợp lệ.";
      }

      return { success: false, error: errorMsg };
    }
  };

  const revokeInvite = async (invitationId: string): Promise<boolean> => {
    setRevokingId(invitationId);
    try {
      const revoked = await revokeMemberInvitation(invitationId);
      setSentInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: "REVOKED" } : i)),
      );
      setRevokingId(null);
      return true;
    } catch (err: any) {
      setRevokingId(null);
      Alert.alert(
        "Lỗi thu hồi",
        err?.message || "Không thể thu hồi lời mời này lúc này.",
      );
      return false;
    }
  };

  return {
    sentInvitations,
    loading,
    sending,
    revokingId,
    error,
    fetchSentInvitations,
    sendDirectInvite,
    revokeInvite,
  };
}
