"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivateTripMembership } from "../hooks/usePrivateTripMembership";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function PrivateTripRoom({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { loadRoom, loadMembers, leaveTrip, removeMember, room, members, activeMemberCount, busy, error } = usePrivateTripMembership();

  useEffect(() => {
    if (tripId) {
      loadRoom(tripId);
      loadMembers(tripId, { status: 'ACTIVE', pageSize: 50 }); // Load danh sách thành viên ACTIVE
    }
  }, [tripId, loadRoom, loadMembers]);

  const isHost = Boolean(room?.viewer?.isHost || room?.myMembership?.role === 'HOST');

  const handleLeave = async () => {
    if (confirm("Bạn có chắc chắn muốn rời khỏi chuyến đi này không?")) {
      try {
        await leaveTrip(tripId, room?.viewer?.membershipVersion ?? 1);
        alert("Đã rời nhóm thành công.");
        router.push("/my-trips");
      } catch (e) {
        // Error handled
      }
    }
  };

  const handleKick = async (memberId: string, memberName: string, version?: number) => {
    if (confirm(`Bạn muốn loại ${memberName} khỏi chuyến đi?`)) {
      try {
        await removeMember(tripId, memberId, version ?? 1);
        alert("Đã loại thành viên.");
      } catch (e) {}
    }
  };

  if (busy && !room) return <div className="p-8 text-center">Đang tải phòng chờ...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!room) return <div className="p-8 text-center">Không tìm thấy thông tin phòng chờ.</div>;

  const title = room.trip?.title ?? room.title ?? "";
  const status = room.trip?.status ?? room.status ?? "";
  const startAt = room.trip?.startAt ?? room.startAt ?? new Date().toISOString();
  const endAt = room.trip?.endAt ?? room.endAt ?? new Date().toISOString();
  const capacity = room.trip?.capacity ?? room.maxPax ?? 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-gray-500 text-sm mt-1">Trạng thái: <span className="font-semibold text-blue-600">{status}</span></p>
          </div>
          <div className="flex gap-2">
            {!isHost && (
              <button 
                onClick={handleLeave}
                disabled={busy}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition"
              >
                Rời chuyến đi
              </button>
            )}
            {isHost && (
              <button 
                onClick={() => router.push(`/my-trips/${tripId}`)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
              >
                Cài đặt chuyến đi (Host)
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Khởi hành:</span> {new Date(startAt).toLocaleString('vi-VN')}</div>
          <div><span className="text-gray-500">Kết thúc:</span> {new Date(endAt).toLocaleString('vi-VN')}</div>
          <div><span className="text-gray-500">Số lượng tham gia:</span> {activeMemberCount || members.length} / {capacity}</div>
          <div><span className="text-gray-500">Vai trò của bạn:</span> {isHost ? "Host (Trưởng đoàn)" : "Thành viên"}</div>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h2 className="text-xl font-bold mb-4">Danh Sách Tài Khoản Tham Gia ({members.length})</h2>
        <div className="space-y-3">
          {members.map(member => {
            const accountName = member.displayName || member.user?.fullName || `Tài khoản #${member.userId?.slice(0, 8)}`;
            return (
              <div key={member.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-800 font-bold rounded-full flex items-center justify-center overflow-hidden">
                    {member.user?.avatarUrl ? (
                      <img src={member.user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm">{accountName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {accountName}
                      {member.userId === user?.id && <span className="ml-2 text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded">Bạn</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {member.role === 'HOST' ? "Trưởng đoàn" : "Thành viên"} • ID: <span className="font-mono">{member.userId?.slice(0, 8)}</span> • Tham gia {new Date(member.joinedAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
                
                {/* Host có thể kick người khác (trừ chính mình) */}
                {isHost && member.userId !== user?.id && member.role !== 'HOST' && (
                  <button 
                    onClick={() => handleKick(member.id, accountName, member.version)}
                    disabled={busy}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded border border-red-200"
                  >
                    Xóa
                  </button>
                )}
              </div>
            );
          })}
          {members.length === 0 && <p className="text-center text-gray-500 py-4">Chưa có thành viên nào.</p>}
        </div>
      </div>

      {/* Có thể bổ sung Lộ trình (Trail Plans), Checkpoints ở đây dựa vào room.tripTrailPlansViaTripId */}
    </div>
  );
}
