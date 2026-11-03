"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePrivateTripMembership } from "../hooks/usePrivateTripMembership";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { PrivateTripDirectInviteModal } from "./PrivateTripDirectInviteModal";
import {
  PageShell,
  PageHeader,
  TripSummaryBanner,
  SurfaceCard,
  SurfaceSectionHeader,
  Button,
  StatusBadge,
  LoadingState,
  ErrorAlert,
  EmptyState,
  ConfirmModal,
  InfoBanner,
} from "@/components/ui";

export function PrivateTripRoom({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const {
    loadRoom,
    loadMembers,
    leaveTrip,
    removeMember,
    room,
    members,
    activeMemberCount,
    busy,
    error,
  } = usePrivateTripMembership();

  useEffect(() => {
    if (tripId) {
      loadRoom(tripId);
      loadMembers(tripId, { status: "ACTIVE", pageSize: 50 });
    }
  }, [tripId, loadRoom, loadMembers]);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [kickTarget, setKickTarget] = useState<{
    id: string;
    name: string;
    version?: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isHost = Boolean(
    room?.viewer?.isHost || room?.myMembership?.role === "HOST"
  );

  const handleConfirmLeave = async () => {
    try {
      await leaveTrip(tripId, room?.viewer?.membershipVersion ?? 1);
      setConfirmLeaveOpen(false);
      router.push("/my-trips");
    } catch {
      setConfirmLeaveOpen(false);
    }
  };

  const handleConfirmKick = async () => {
    if (!kickTarget) return;
    try {
      await removeMember(tripId, kickTarget.id, kickTarget.version ?? 1);
      setNotice(`Đã loại ${kickTarget.name} khỏi chuyến đi.`);
      setKickTarget(null);
    } catch {
      setKickTarget(null);
    }
  };

  if (busy && !room) {
    return (
      <PageShell maxWidth="lg">
        <LoadingState message="Đang tải thông tin phòng chờ chuyến đi..." />
      </PageShell>
    );
  }

  if (error && !room) {
    return (
      <PageShell maxWidth="lg">
        <PageHeader
          backHref="/my-trips"
          backLabel="Quay lại Chuyến đi của tôi"
          eyebrow="Vina TrekGO · Phòng Chờ Chuyến Đi"
          title="Không thể truy cập phòng chờ"
        />
        <ErrorAlert
          message={error}
          onRetry={() => {
            loadRoom(tripId);
            loadMembers(tripId, { status: "ACTIVE", pageSize: 50 });
          }}
        />
      </PageShell>
    );
  }

  if (!room) {
    return (
      <PageShell maxWidth="lg">
        <EmptyState
          title="Không tìm thấy thông tin phòng chờ"
          description="Phòng chờ có thể đã bị hủy hoặc bạn không còn trong danh sách thành viên."
          action={
            <Button variant="primary" onClick={() => router.push("/my-trips")}>
              Về Chuyến đi của tôi
            </Button>
          }
        />
      </PageShell>
    );
  }

  const title = room.trip?.title ?? room.title ?? "Chuyến đi riêng tư";
  const status = room.trip?.status ?? room.status ?? "OPEN";
  const startAt =
    room.trip?.startAt ?? room.startAt ?? new Date().toISOString();
  const endAt = room.trip?.endAt ?? room.endAt ?? new Date().toISOString();
  const capacity = room.trip?.capacity ?? room.maxPax ?? 0;
  const pickupName = room.trip?.pickupPoint?.name || "Theo lịch trình nhóm";

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        backHref="/my-trips"
        backLabel="Quay lại Chuyến đi của tôi"
        eyebrow="Vina TrekGO · Phòng Chờ Nhóm Riêng Tư"
        title={title}
        badge={<StatusBadge status={status} />}
        actions={
          <>
            {!isHost && (
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmLeaveOpen(true)}
              >
                Rời chuyến đi
              </Button>
            )}
            {isHost && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsInviteModalOpen(true)}
                >
                  ✉️ Mời bạn bè (Email)
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/my-trips/${tripId}`)}
                >
                  Cài đặt chuyến đi (Host)
                </Button>
              </>
            )}
          </>
        }
      />

      {error && <ErrorAlert message={error} />}
      {!isHost && room?.permissions?.canLeave && <InfoBanner tone="warning">Trước khi rời chuyến, vui lòng hủy đơn thuê liên quan hoặc hoàn tất trả thiết bị. Sau đó quay lại xác nhận rời chuyến. <Link className="underline" href="/rentals/orders">Xem đơn thuê của tôi</Link></InfoBanner>}
      {notice && (
        <InfoBanner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </InfoBanner>
      )}

      <TripSummaryBanner
        title="Thông tin lịch trình & điểm hẹn"
        subtitle={
          isHost ? "Vai trò: Trưởng đoàn (Host)" : "Vai trò: Thành viên tham gia"
        }
        metaItems={[
          {
            label: "Khởi hành",
            value: new Date(startAt).toLocaleString("vi-VN"),
          },
          {
            label: "Kết thúc",
            value: new Date(endAt).toLocaleString("vi-VN"),
          },
          {
            label: "Quân số hiện tại",
            value: `${activeMemberCount || members.length} / ${capacity} người`,
            highlight: true,
          },
          {
            label: "Điểm tập kết",
            value: pickupName,
          },
        ]}
      />

      <SurfaceCard padding="md">
        <SurfaceSectionHeader
          title={`Danh sách thành viên tham gia (${members.length})`}
          subtitle="Các thành viên đang hoạt động trong đoàn leo núi"
        />

        {members.length === 0 ? (
          <EmptyState
            title="Chưa có thành viên nào"
            description="Hãy gửi lời mời qua email hoặc chia sẻ mã QR để bạn bè cùng tham gia."
          />
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const accountName =
                member.displayName ||
                member.user?.fullName ||
                `Tài khoản #${member.userId?.slice(0, 8)}`;

              return (
                <div
                  key={member.id}
                  className="flex flex-wrap justify-between items-center gap-3 p-3.5 hover:bg-[#F7F7F4] rounded-xl border border-[#E5E7EB] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#DCFCE7] text-[#166534] font-bold rounded-full flex items-center justify-center overflow-hidden shrink-0">
                      {member.user?.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt="avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm">
                          {accountName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1F2937]">
                          {accountName}
                        </p>
                        {member.userId === user?.id && (
                          <span className="text-[11px] font-bold text-[#125238] bg-[#DCFCE7] px-2 py-0.5 rounded-full">
                            Bạn
                          </span>
                        )}
                        <StatusBadge
                          status={member.role === "HOST" ? "OPEN" : "ACTIVE"}
                          customLabel={
                            member.role === "HOST" ? "Trưởng đoàn" : "Thành viên"
                          }
                          showDot={false}
                        />
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5 tabular-nums">
                        ID: <span className="font-mono">{member.userId?.slice(0, 8)}</span>{" "}
                        • Tham gia{" "}
                        {new Date(member.joinedAt).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                  </div>

                  {isHost &&
                    member.userId !== user?.id &&
                    member.role !== "HOST" && (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          setKickTarget({
                            id: member.id,
                            name: accountName,
                            version: member.version,
                          })
                        }
                      >
                        Loại khỏi nhóm
                      </Button>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      <ConfirmModal
        isOpen={confirmLeaveOpen}
        onClose={() => setConfirmLeaveOpen(false)}
        onConfirm={handleConfirmLeave}
        title="Rời khỏi chuyến đi?"
        description="Bạn có chắc chắn muốn rời khỏi nhóm trekking này không? Bạn sẽ cần lời mời mới từ Trưởng đoàn nếu muốn tham gia lại."
        confirmLabel="Xác nhận rời nhóm"
        confirmVariant="danger"
        loading={busy}
      />

      <ConfirmModal
        isOpen={Boolean(kickTarget)}
        onClose={() => setKickTarget(null)}
        onConfirm={handleConfirmKick}
        title="Loại thành viên khỏi chuyến đi"
        description={
          <>
            Bạn có chắc chắn muốn loại{" "}
            <strong className="text-[#1F2937]">{kickTarget?.name}</strong> khỏi
            chuyến đi này không?
          </>
        }
        confirmLabel="Loại thành viên"
        confirmVariant="danger"
        loading={busy}
      />

      <PrivateTripDirectInviteModal
        tripId={tripId}
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onMemberJoined={() =>
          loadMembers(tripId, { status: "ACTIVE", pageSize: 50 })
        }
      />
    </PageShell>
  );
}
