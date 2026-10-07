"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Checkpoint, CheckpointType } from "../../types/checkpoint.types";
import { Destination } from "../../types/destination.types";
import { SystemTrailDetail } from "../../types/system-trail.types";
import { checkpointApi } from "../../services/checkpoint.api";
import { systemTrailApi } from "../../services/system-trail.api";
import { CheckpointModal } from "../modals/CheckpointModal";
import { ConfirmDeleteModal } from "../modals/ConfirmDeleteModal";
import { Checkpoint3DMap } from "../Checkpoint3DMap";

interface CheckpointsTabProps {
  destinations: Destination[];
  filterDestinationId?: string | null;
  onSelectDestination?: (id: string | null) => void;
}

export const CheckpointsTab: React.FC<CheckpointsTabProps> = ({
  destinations,
  filterDestinationId,
  onSelectDestination,
}) => {
  const [localDestId, setLocalDestId] = useState<string>("");
  const selectedDestId =
    filterDestinationId !== undefined && filterDestinationId !== null && filterDestinationId !== ""
      ? filterDestinationId
      : localDestId || destinations[0]?.id || "";

  const currentDestination = destinations.find((d) => d.id === selectedDestId) || null;

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [trails, setTrails] = useState<SystemTrailDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrails, setLoadingTrails] = useState(false);

  // Bộ lọc & phân trang
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Chế độ xem: "both" (Map 3D + Bảng), "map" (Chỉ Map 3D), "table" (Chỉ Bảng)
  const [viewMode, setViewMode] = useState<"both" | "map" | "table">("both");

  // Chế độ Click-To-Add trên bản đồ 3D
  const [isAddMode, setIsAddMode] = useState(false);
  const [clickedCoords, setClickedCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCheckpoint, setEditingCheckpoint] = useState<Checkpoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 1. Tải danh sách Checkpoints
  useEffect(() => {
    if (!selectedDestId) {
      return;
    }

    let isCancelled = false;

    checkpointApi
      .getCheckpoints({
        destinationId: selectedDestId,
        page,
        pageSize: 50, // Lấy nhiều hơn để hiển thị đầy đủ trên Map 3D
        keyword: keyword.trim() || undefined,
        checkpointType: (typeFilter as CheckpointType) || undefined,
      })
      .then((res) => {
        if (!isCancelled) {
          setCheckpoints(res.items);
          setTotalPages(res.pagination.totalPages);
          setTotalItems(res.pagination.totalItems);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Lỗi khi tải danh sách checkpoints:", err);
          setCheckpoints([]);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedDestId, page, keyword, typeFilter, refreshTrigger]);

  // 2. Tải TẤT CẢ các Trails thuộc Địa danh được chọn (kèm GeoJSON để render lên 3D Map)
  useEffect(() => {
    if (!selectedDestId) {
      return;
    }

    let isCancelled = false;

    systemTrailApi
      .getTrails({ destinationId: selectedDestId, pageSize: 50 })
      .then(async (res) => {
        if (isCancelled) return;
        // Tải chi tiết từng trail để lấy routeGeojson và bounds
        const detailedTrails = await Promise.all(
          res.items.map((t) =>
            systemTrailApi.getTrailDetail(t.id).catch((err) => {
              console.warn(`Không thể nạp chi tiết trail ${t.id}:`, err);
              return null;
            })
          )
        );

        if (!isCancelled) {
          setTrails(detailedTrails.filter((t): t is SystemTrailDetail => t !== null));
          setLoadingTrails(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Lỗi khi tải danh sách trails cho địa danh:", err);
          setTrails([]);
          setLoadingTrails(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedDestId, refreshTrigger]);

  const handleDelete = useCallback((id: string, name: string) => {
    setDeleteTarget({ id, name });
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await checkpointApi.deleteCheckpoint(deleteTarget.id);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleEdit = (cp: Checkpoint) => {
    setEditingCheckpoint(cp);
    setClickedCoords(null);
    setIsModalOpen(true);
  };

  // Callback khi người dùng nhấp chuột trên bản đồ để thêm trạm
  const handleMapClickToAdd = useCallback((coords: { latitude: number; longitude: number }) => {
    setClickedCoords(coords);
    setEditingCheckpoint(null);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCheckpoint(null);
    setClickedCoords(null);
    setIsAddMode(false);
  };

  const handleModalSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
    setIsAddMode(false);
    setClickedCoords(null);
  };

  const getTypeBadge = (type?: CheckpointType | string | null) => {
    switch (type) {
      case "START":
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center">🏁 Bắt đầu</span>;
      case "CAMPSITE":
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center">⛺ Lán trại</span>;
      case "SUMMIT":
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center">🏔️ Đỉnh núi</span>;
      case "WATER_SOURCE":
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center">💧 Nguồn nước</span>;
      case "VIEWPOINT":
        return <span className="bg-pink-100 text-pink-800 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center">📸 Điểm ngắm</span>;
      case "END":
        return <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center">🏁 Kết thúc</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center">Trạm mốc</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Bộ lọc theo Destination + Tìm kiếm + Chuyển đổi giao diện */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
        <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
          {/* Dropdown chọn Destination */}
          <div className="w-full sm:w-64">
            <select
              value={selectedDestId}
              onChange={(e) => {
                const newId = e.target.value;
                setLocalDestId(newId);
                onSelectDestination?.(newId || null);
                setCheckpoints([]);
                setTrails([]);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm font-semibold border border-[#1B5E41]/30 bg-emerald-50/40 text-emerald-950 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
            >
              {destinations.length === 0 ? (
                <option value="">(Chưa có địa danh nào)</option>
              ) : (
                destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    📍 {d.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <input
              type="text"
              placeholder="Tìm kiếm trạm dừng..."
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
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
          >
            <option value="">Tất cả phân loại</option>
            <option value="START">Điểm xuất phát</option>
            <option value="CAMPSITE">Lán trại / Cắm trại</option>
            <option value="SUMMIT">Đỉnh núi</option>
            <option value="WATER_SOURCE">Nguồn nước</option>
            <option value="VIEWPOINT">Điểm ngắm cảnh</option>
            <option value="END">Điểm kết thúc</option>
          </select>
        </div>

        {/* Nút chuyển chế độ xem & Thêm trạm */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Nút chuyển chế độ hiển thị */}
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setViewMode("both")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                viewMode === "both"
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="Hiện cả Bản đồ 3D và Bảng dữ liệu"
            >
              🗺️+📋 Cả hai
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                viewMode === "map"
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="Chỉ xem Bản đồ 3D địa hình"
            >
              🏔️ Bản đồ 3D
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="Chỉ xem Bảng danh sách"
            >
              📋 Dạng bảng
            </button>
          </div>

          <button
            onClick={() => {
              setEditingCheckpoint(null);
              setClickedCoords(null);
              setIsModalOpen(true);
            }}
            disabled={!selectedDestId}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1B5E41] hover:bg-[#144731] text-white text-xs font-bold rounded-lg shadow-2xs transition shrink-0 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nhập tay
          </button>
        </div>
      </div>

      {/* 1. KHU VỰC BẢN ĐỒ 3D TƯƠNG TÁC (Render tất cả Trails và Checkpoints, hỗ trợ Click-to-Add) */}
      {viewMode !== "table" && (
        <Checkpoint3DMap
          key={selectedDestId || "default"}
          destination={currentDestination}
          trails={trails}
          checkpoints={checkpoints}
          isAddMode={isAddMode}
          onToggleAddMode={() => setIsAddMode((prev) => !prev)}
          onMapClickToAdd={handleMapClickToAdd}
          onEditCheckpoint={handleEdit}
          onDeleteCheckpoint={handleDelete}
        />
      )}

      {/* 2. KHU VỰC BẢNG DANH SÁCH CHECKPOINTS */}
      {viewMode !== "map" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <span>📋</span>
              <span>Danh sách Trạm dừng & Mốc GPS ({checkpoints.length})</span>
            </h4>
            <span className="text-xs text-gray-500">
              {loadingTrails ? "Đang tải cung đường..." : `${trails.length} cung đường đang kết nối`}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
              <div className="w-7 h-7 border-3 border-[#1B5E41] border-t-transparent rounded-full animate-spin mb-3"></div>
              <span className="text-xs">Đang tải danh sách trạm dừng...</span>
            </div>
          ) : checkpoints.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#1B5E41] flex items-center justify-center mx-auto mb-2 text-base">
                🚩
              </div>
              <h5 className="font-semibold text-gray-800 text-xs">Chưa có trạm kiểm soát nào</h5>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Bật nút <b>&ldquo;Click Map để Thêm Trạm&rdquo;</b> ở bản đồ phía trên rồi nhấp vào vị trí bất kỳ trên sườn núi để tạo trạm nhanh.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50/70 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Tên trạm / Mốc</th>
                      <th className="py-3 px-4">Phân loại</th>
                      <th className="py-3 px-4">Tọa độ GPS (Lat, Lng)</th>
                      <th className="py-3 px-4">Bán kính</th>
                      <th className="py-3 px-4">Ghi chú</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {checkpoints.map((cp) => (
                      <tr key={cp.id} className="hover:bg-gray-50/60 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{cp.name}</span>
                            {cp.code && (
                              <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                {cp.code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">{getTypeBadge(cp.checkpointType)}</td>
                        <td className="py-3.5 px-4 text-xs font-mono text-gray-600">
                          {Number(cp.latitude).toFixed(5)}, {Number(cp.longitude).toFixed(5)}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-600">
                          {cp.defaultRadiusMeters || 50}m
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-500 max-w-xs truncate">
                          {cp.description || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-3 text-xs">
                            <button
                              onClick={() => handleEdit(cp)}
                              className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => handleDelete(cp.id, cp.name)}
                              className="font-medium text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
              <div>Tổng số: {totalItems} trạm mốc</div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Trang trước
                </button>
                <span className="font-semibold text-gray-800">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Trang sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Thêm / Cập nhật Trạm mốc (Có nhận toạ độ từ Click trên bản đồ) */}
      <CheckpointModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        initialData={editingCheckpoint}
        initialCoordinates={clickedCoords}
        destinations={destinations}
        defaultDestinationId={selectedDestId}
      />

      {/* Modal xác nhận xóa Trạm mốc */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xóa trạm mốc"
        itemTypeLabel="Trạm mốc / Checkpoint"
        itemName={deleteTarget?.name}
        description="Hành động này sẽ gỡ bỏ trạm mốc này khỏi hệ thống cơ sở dữ liệu và lớp hiển thị trên bản đồ số 3D."
        confirmText="Xóa trạm mốc"
        confirmVariant="danger"
      />
    </div>
  );
};
