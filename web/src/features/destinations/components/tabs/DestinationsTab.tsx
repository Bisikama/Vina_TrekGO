"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Destination } from "../../types/destination.types";
import { destinationApi } from "../../services/destination.api";
import { DestinationModal } from "../modals/DestinationModal";
import { ConfirmDeleteModal } from "../modals/ConfirmDeleteModal";

interface DestinationsTabProps {
  onViewTrails: (destinationId: string) => void;
  onViewCheckpoints: (destinationId: string) => void;
}

export const DestinationsTab: React.FC<DestinationsTabProps> = ({
  onViewTrails,
  onViewCheckpoints,
}) => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    destinationApi
      .getDestinations({
        page,
        pageSize: 12,
        keyword: keyword.trim() || undefined,
        region: regionFilter || undefined,
      })
      .then((res) => {
        if (!isCancelled) {
          setDestinations(res.items);
          setTotalPages(res.pagination.totalPages);
          setTotalItems(res.pagination.totalItems);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Lỗi khi tải danh sách địa danh:", err);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [page, keyword, regionFilter, refreshTrigger]);

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await destinationApi.deleteDestination(deleteTarget.id);
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const getRegionBadge = (region?: string | null) => {
    switch (region) {
      case "NORTH":
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0 inline-flex items-center">Miền Bắc</span>;
      case "CENTRAL":
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shrink-0 inline-flex items-center">Miền Trung</span>;
      case "SOUTH":
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0 inline-flex items-center">Miền Nam</span>;
      default:
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 whitespace-nowrap shrink-0 inline-flex items-center">{region || "Chưa rõ"}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Thanh công cụ Tìm kiếm & Lọc */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Tìm kiếm địa danh trekking theo tên..."
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
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
          >
            <option value="">Tất cả Vùng miền</option>
            <option value="NORTH">Miền Bắc</option>
            <option value="CENTRAL">Miền Trung</option>
            <option value="SOUTH">Miền Nam</option>
          </select>
        </div>

        <button
          onClick={() => {
            setEditingDestination(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B5E41] hover:bg-[#144731] text-white text-sm font-semibold rounded-lg shadow-2xs transition shrink-0 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Thêm Địa danh
        </button>
      </div>

      {/* Hiển thị danh sách */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="w-8 h-8 border-3 border-[#1B5E41] border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-sm">Đang tải danh sách địa danh...</span>
        </div>
      ) : destinations.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#1B5E41] flex items-center justify-center mx-auto mb-3">
            📍
          </div>
          <h4 className="font-semibold text-gray-800 text-sm">Chưa có địa danh nào</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Hệ thống chưa có dữ liệu địa danh hoặc không tìm thấy kết quả phù hợp với bộ lọc.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {destinations.map((dest) => (
            <div
              key={dest.id}
              className="bg-white rounded-xl border border-gray-100 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-gray-900 text-base group-hover:text-[#1B5E41] transition flex-1 min-w-0 pr-1 leading-snug">
                    {dest.name}
                  </h3>
                  <div className="shrink-0">
                    {getRegionBadge(dest.region)}
                  </div>
                </div>

                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4 min-h-8">
                  {dest.description || "Chưa có mô tả chi tiết về địa danh này."}
                </p>

                <div className="flex items-center gap-3 text-xs text-gray-500 py-2 border-y border-gray-50 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-800">{dest.trailCount ?? 0}</span>
                    <span>cung đường</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-800">{dest.pickupPointCount ?? 0}</span>
                    <span>điểm đón</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        dest.status === "ACTIVE" ? "bg-emerald-500" : "bg-gray-400"
                      }`}
                    ></span>
                    <span>{dest.status}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-gray-50/70 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onViewTrails(dest.id)}
                    className="font-semibold text-[#1B5E41] hover:underline cursor-pointer"
                  >
                    ⛰️ Cung đường
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    onClick={() => onViewCheckpoints(dest.id)}
                    className="font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    🚩 Trạm dừng
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingDestination(dest);
                      setIsModalOpen(true);
                    }}
                    className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
                  >
                    Sửa
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    onClick={() => handleDelete(dest.id, dest.name)}
                    className="text-red-500 hover:text-red-700 font-medium cursor-pointer"
                  >
                    Xóa
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
          <div>Tổng số: {totalItems} địa danh</div>
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

      {/* Modal CRUD */}
      <DestinationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setLoading(true);
          setRefreshTrigger((prev) => prev + 1);
        }}
        initialData={editingDestination}
      />

      {/* Modal xác nhận vô hiệu hóa / xóa */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Xác nhận vô hiệu hóa địa danh"
        itemTypeLabel="Địa danh trekking"
        itemName={deleteTarget?.name}
        description="Địa danh này sẽ được chuyển sang trạng thái ngưng hoạt động (INACTIVE). Các dữ liệu liên quan sẽ không hiển thị trên danh sách công khai."
        confirmText="Vô hiệu hóa"
        confirmVariant="danger"
      />
    </div>
  );
};
