"use client";

import React, { useState, useEffect } from "react";
import {
  SystemTrailDetail,
  CreateSystemTrailPayload,
  DifficultyLevel,
} from "../../types/system-trail.types";
import { Destination } from "../../types/destination.types";
import { Checkpoint } from "../../types/checkpoint.types";
import { systemTrailApi } from "../../services/system-trail.api";
import { checkpointApi } from "../../services/checkpoint.api";

interface SystemTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: SystemTrailDetail | null;
  destinations: Destination[];
  defaultDestinationId?: string | null;
}

const SystemTrailModalContent: React.FC<Omit<SystemTrailModalProps, "isOpen">> = ({
  onClose,
  onSuccess,
  initialData,
  destinations,
  defaultDestinationId,
}) => {
  const [destinationId, setDestinationId] = useState<string>(() => {
    return initialData?.destination?.id || defaultDestinationId || destinations[0]?.id || "";
  });

  const [code, setCode] = useState(() => initialData?.code || "");
  const [name, setName] = useState(() => initialData?.name || "");
  const [description, setDescription] = useState(() => initialData?.description || "");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(
    () => initialData?.difficulty || "MEDIUM"
  );
  const [distanceKm, setDistanceKm] = useState<number>(() => initialData?.distanceKm ?? 5);
  const [elevationGainM, setElevationGainM] = useState<number>(() => initialData?.elevationGainM ?? 500);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number>(
    () => initialData?.estimatedDurationMinutes ?? 240
  );
  const [price, setPrice] = useState<number>(() => initialData?.price ?? 0);

  const [geoJsonText, setGeoJsonText] = useState<string>(() => {
    if (initialData?.routeGeojson) {
      return typeof initialData.routeGeojson === "string"
        ? initialData.routeGeojson
        : JSON.stringify(initialData.routeGeojson, null, 2);
    }
    return JSON.stringify(
      {
        type: "LineString",
        coordinates: [
          [106.1785, 11.3652, 0],
          [106.1698, 11.3838, 0],
        ],
      },
      null,
      2
    );
  });

  const [availableCheckpoints, setAvailableCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<
    { checkpointId: string; sequence: number; isRequired: boolean }[]
  >(() => {
    if (initialData?.checkpoints) {
      return initialData.checkpoints.map((cp) => ({
        checkpointId: cp.id,
        sequence: cp.sequence,
        isRequired: cp.isRequired,
      }));
    }
    return [];
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load checkpoints khi destinationId thay đổi (chỉ khi chỉnh sửa cung đường)
  useEffect(() => {
    if (!initialData || !destinationId) return;
    let isCancelled = false;

    checkpointApi
      .getCheckpoints({ destinationId, pageSize: 100 })
      .then((res) => {
        if (!isCancelled) {
          setAvailableCheckpoints(res.items);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Không tải được danh sách checkpoints:", err);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [initialData, destinationId]);

  const toggleCheckpoint = (cpId: string) => {
    const exists = selectedCheckpoints.find((x) => x.checkpointId === cpId);
    if (exists) {
      setSelectedCheckpoints(selectedCheckpoints.filter((x) => x.checkpointId !== cpId));
    } else {
      setSelectedCheckpoints([
        ...selectedCheckpoints,
        {
          checkpointId: cpId,
          sequence: selectedCheckpoints.length + 1,
          isRequired: true,
        },
      ]);
    }
  };

  const handleSequenceChange = (cpId: string, seq: number) => {
    setSelectedCheckpoints(
      selectedCheckpoints.map((x) => (x.checkpointId === cpId ? { ...x, sequence: seq } : x))
    );
  };

  const handleRequiredChange = (cpId: string, isRequired: boolean) => {
    setSelectedCheckpoints(
      selectedCheckpoints.map((x) => (x.checkpointId === cpId ? { ...x, isRequired } : x))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationId) {
      setErrorMessage("Vui lòng chọn Địa danh.");
      return;
    }
    if (!code.trim()) {
      setErrorMessage("Mã cung đường là bắt buộc.");
      return;
    }
    if (!name.trim()) {
      setErrorMessage("Tên cung đường không được để trống.");
      return;
    }

    let parsedGeoJson: any;
    try {
      parsedGeoJson = JSON.parse(geoJsonText);
    } catch {
      setErrorMessage("Dữ liệu routeGeojson không đúng định dạng JSON hợp lệ.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload: CreateSystemTrailPayload = {
        destinationId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        difficulty,
        distanceKm: Number(distanceKm),
        elevationGainM: Number(elevationGainM) || undefined,
        estimatedDurationMinutes: Number(estimatedDurationMinutes) || undefined,
        price: Number(price) || 0,
        routeGeojson: parsedGeoJson,
        checkpoints: initialData && selectedCheckpoints.length > 0 ? selectedCheckpoints : undefined,
        status: "ACTIVE",
      };

      if (initialData?.id) {
        await systemTrailApi.updateTrail(initialData.id, payload);
      } else {
        await systemTrailApi.createTrail(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        "Có lỗi xảy ra khi lưu cung đường.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              {initialData ? "Chỉnh sửa Cung đường Hệ thống" : "Thêm mới Cung đường Hệ thống"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Thiết lập thông số kỹ thuật, lộ trình GeoJSON và gán trạm mốc
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Thuộc Địa danh <span className="text-red-500">*</span>
            </label>
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
            >
              <option value="" disabled>-- Chọn địa danh --</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.region || "Chưa phân vùng"})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tên cung đường <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Tuyến Cột Điện - Đỉnh Bà Đen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mã cung (Code) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: TRAIL_BADEN_01"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Độ khó (Difficulty)
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              >
                <option value="EASY">Dễ</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HARD">Khó</option>
                <option value="EXTREME">Cực khó</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Độ dài (km) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={distanceKm}
                onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Độ dốc leo (m)
              </label>
              <input
                type="number"
                min="0"
                value={elevationGainM}
                onChange={(e) => setElevationGainM(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Thời gian ước tính (phút)
              </label>
              <input
                type="number"
                min="10"
                value={estimatedDurationMinutes}
                onChange={(e) => setEstimatedDurationMinutes(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Giá bản đồ (VND)
              </label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>
          </div>

          {/* Gán Checkpoints cho cung đường (Chỉ hiển thị khi chỉnh sửa cung đường đã có) */}
          {Boolean(initialData) && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Gán Trạm dừng (Checkpoints) vào Cung đường
                </label>
                <span className="text-[11px] text-gray-400">
                  Đã chọn: {selectedCheckpoints.length} trạm
                </span>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-gray-50/50">
                {availableCheckpoints.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-2">
                    Địa danh này chưa có trạm dừng nào. Bạn có thể thêm sau ở Tab Checkpoints.
                  </p>
                ) : (
                  availableCheckpoints.map((cp) => {
                    const sel = selectedCheckpoints.find((x) => x.checkpointId === cp.id);
                    const isChecked = Boolean(sel);
                    return (
                      <div
                        key={cp.id}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs transition ${
                          isChecked
                            ? "bg-emerald-50/80 border-emerald-200 text-gray-900"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheckpoint(cp.id)}
                            className="rounded text-[#1B5E41] focus:ring-[#1B5E41]"
                          />
                          <span className="font-medium">{cp.name}</span>
                          {cp.code && (
                            <span className="text-[10px] bg-gray-200 px-1 py-0.2 rounded font-mono">
                              {cp.code}
                            </span>
                          )}
                        </label>

                        {isChecked && (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-500">Thứ tự:</span>
                              <input
                                type="number"
                                min={1}
                                value={sel?.sequence || 1}
                                onChange={(e) =>
                                  handleSequenceChange(cp.id, parseInt(e.target.value) || 1)
                                }
                                className="w-12 px-1.5 py-0.5 border rounded text-center text-xs bg-white"
                              />
                            </div>

                            <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-600">
                              <input
                                type="checkbox"
                                checked={sel?.isRequired || false}
                                onChange={(e) => handleRequiredChange(cp.id, e.target.checked)}
                                className="rounded text-[#1B5E41]"
                              />
                              Bắt buộc
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700">
                Tọa độ Lộ trình (routeGeojson) <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-gray-400">Định dạng JSON (LineString/FeatureCollection)</span>
            </div>
            <textarea
              rows={20}
              required
              value={geoJsonText}
              onChange={(e) => setGeoJsonText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono bg-gray-900 text-emerald-400 focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Mô tả cung đường
            </label>
            <textarea
              rows={2}
              placeholder="Ghi chú về địa hình, suối đá, thời tiết..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm text-white bg-[#1B5E41] hover:bg-[#144731] font-medium rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {submitting ? "Đang lưu..." : initialData ? "Cập nhật" : "Tạo mới"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SystemTrailModal: React.FC<SystemTrailModalProps> = ({ isOpen, ...props }) => {
  if (!isOpen) return null;
  return <SystemTrailModalContent key={props.initialData?.id || "create"} {...props} />;
};
