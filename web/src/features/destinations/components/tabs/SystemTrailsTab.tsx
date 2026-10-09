"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SystemTrailSummary, SystemTrailDetail, DifficultyLevel } from "../../types/system-trail.types";
import { Destination } from "../../types/destination.types";
import { systemTrailApi } from "../../services/system-trail.api";
import { SystemTrailModal } from "../modals/SystemTrailModal";
import { ConfirmDeleteModal } from "../modals/ConfirmDeleteModal";

interface SystemTrailsTabProps {
  destinations: Destination[];
  filterDestinationId?: string | null;
  onSelectDestination?: (id: string | null) => void;
}

export const SystemTrailsTab: React.FC<SystemTrailsTabProps> = ({
  destinations,
  filterDestinationId,
  onSelectDestination,
}) => {
  const [localDestId, setLocalDestId] = useState<string>("");
  const selectedDestId =
    filterDestinationId !== undefined && filterDestinationId !== null
      ? filterDestinationId
      : localDestId;

  const [trails, setTrails] = useState<SystemTrailSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrail, setEditingTrail] = useState<SystemTrailDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    systemTrailApi
      .getTrails({
        page,
        pageSize: 12,
        destinationId: selectedDestId || undefined,
        keyword: keyword.trim() || undefined,
        difficulty: (difficultyFilter as DifficultyLevel) || undefined,
      })
      .then((res) => {
        if (!isCancelled) {
          setTrails(res.items);
          setTotalPages(res.pagination.totalPages);
          setTotalItems(res.pagination.totalItems);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!isCancelled) {
          console.error("Lỗi khi tải danh sách cung đường:", err.response?.data?.error || err.response?.data || err);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedDestId, page, keyword, difficultyFilter, refreshTrigger]);

  const handleEditClick = async (trailId: string) => {
    try {
      setLoadingDetail(true);
      const detail = await systemTrailApi.getTrailDetail(trailId);
      setEditingTrail(detail);
      setIsModalOpen(true);
    } catch (err) {
      alert("Không thể tải thông tin chi tiết cung đường");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await systemTrailApi.deleteTrail(deleteTarget.id);
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const getDifficultyBadge = (level: DifficultyLevel) => {
    switch (level) {
      case "EASY":
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center justify-center">Dễ</span>;
      case "MEDIUM":
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center justify-center">Trung bình</span>;
      case "HARD":
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center justify-center">Khó</span>;
      case "EXTREME":
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center justify-center">Cực khó</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Bộ lọc & Tìm kiếm */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
        <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
          {/* Dropdown chọn Destination (Tùy chọn) */}
          <div className="w-full md:w-56">
            <select
              value={selectedDestId}
              onChange={(e) => {
                setLocalDestId(e.target.value);
                onSelectDestination?.(e.target.value || null);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
            >
              <option value="">Tất cả Địa danh</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  📍 {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Tìm kiếm cung đường theo tên, mã..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
            />
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <select
            value={difficultyFilter}
            onChange={(e) => {
              setDifficultyFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
          >
            <option value="">Tất cả Độ khó</option>
            <option value="EASY">Dễ </option>
            <option value="MEDIUM">Trung bình </option>
            <option value="HARD">Khó </option>
            <option value="EXTREME">Cực khó </option>
          </select>
        </div>

        <button
          onClick={() => {
            setEditingTrail(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B5E41] hover:bg-[#144731] text-white text-sm font-semibold rounded-lg shadow-2xs transition shrink-0 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Thêm Cung đường
        </button>
      </div>

      {/* Danh sách Trails */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="w-8 h-8 border-3 border-[#1B5E41] border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-sm">Đang tải danh sách cung đường...</span>
        </div>
      ) : trails.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#1B5E41] flex items-center justify-center mx-auto mb-3">
            ⛰️
          </div>
          <h4 className="font-semibold text-gray-800 text-sm">Chưa có cung đường nào</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Hãy bắt đầu tạo tuyến đường trekking chính thức đầu tiên cho hệ thống.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {trails.map((trail) => (
            <div
              key={trail.id}
              className="bg-white rounded-xl border border-gray-100 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0 pr-1">
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                      {trail.code}
                    </span>
                    <h3 className="font-bold text-gray-900 text-base group-hover:text-[#1B5E41] transition leading-snug">
                      {trail.name}
                    </h3>
                  </div>
                  <div className="shrink-0">
                    {getDifficultyBadge(trail.difficulty)}
                  </div>
                </div>

                <div className="text-xs font-medium text-emerald-800 bg-emerald-50/60 inline-flex items-center gap-1 px-2 py-0.5 rounded mb-3">
                  📍 {trail.destination?.name || "Chưa gán địa danh"}
                </div>

                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4 min-h-8">
                  {trail.description || "Chưa có mô tả cung đường."}
                </p>

                {/* Grid thông số kỹ thuật */}
                <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-gray-50 rounded-lg text-center text-xs">
                  <div>
                    <span className="block font-bold text-gray-800">{trail.distanceKm} km</span>
                    <span className="text-[10px] text-gray-500">Quãng đường</span>
                  </div>
                  <div>
                    <span className="block font-bold text-gray-800">{trail.elevationGainM || 0} m</span>
                    <span className="text-[10px] text-gray-500">Độ cao dốc</span>
                  </div>
                  <div>
                    <span className="block font-bold text-gray-800">{trail.checkpointCount}</span>
                    <span className="text-[10px] text-gray-500">Trạm mốc</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-gray-50/70 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <div className="text-gray-500 font-medium">
                  {trail.estimatedDurationMinutes ? `${Math.round(trail.estimatedDurationMinutes / 60)}h dự kiến` : "—"}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditClick(trail.id)}
                    disabled={loadingDetail}
                    className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
                  >
                    Sửa
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    onClick={() => handleDelete(trail.id, trail.name)}
                    className="text-red-500 hover:text-red-700 font-medium cursor-pointer"
                  >
                    Vô hiệu hóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-500">
          <div>Tổng số: {totalItems} cung đường</div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-40 hover:bg-gray-50"
            >
              Trang trước
            </button>
            <span className="font-semibold text-gray-800">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-40 hover:bg-gray-50"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      <SystemTrailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setLoading(true);
          setRefreshTrigger((prev) => prev + 1);
        }}
        initialData={editingTrail}
        destinations={destinations}
        defaultDestinationId={selectedDestId || null}
      />

      {/* Modal xác nhận vô hiệu hóa cung đường */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Xác nhận vô hiệu hóa cung đường"
        itemTypeLabel="Cung đường trekking"
        itemName={deleteTarget?.name}
        description="Cung đường này sẽ được chuyển sang trạng thái ngưng hoạt động (INACTIVE) và không hiển thị cho các chuyến đi mới."
        confirmText="Vô hiệu hóa"
        confirmVariant="danger"
      />
    </div>
  );
};
