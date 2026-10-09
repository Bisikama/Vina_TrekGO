"use client";

import React, { useState } from "react";
import { Checkpoint, CreateCheckpointPayload, CheckpointType } from "../../types/checkpoint.types";
import { Destination } from "../../types/destination.types";
import { checkpointApi } from "../../services/checkpoint.api";

interface CheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Checkpoint | null;
  initialCoordinates?: { latitude: number; longitude: number } | null;
  destinations: Destination[];
  defaultDestinationId?: string | null;
}

const CheckpointModalContent: React.FC<Omit<CheckpointModalProps, "isOpen">> = ({
  onClose,
  onSuccess,
  initialData,
  initialCoordinates,
  destinations,
  defaultDestinationId,
}) => {
  const [formData, setFormData] = useState<CreateCheckpointPayload>(() => {
    if (initialData) {
      return {
        destinationId: initialData.destinationId,
        code: initialData.code || "",
        name: initialData.name,
        description: initialData.description || "",
        latitude: initialData.latitude,
        longitude: initialData.longitude,
        defaultRadiusMeters: initialData.defaultRadiusMeters || 50,
        checkpointType: initialData.checkpointType || "CAMPSITE",
        status: initialData.status,
      };
    }
    return {
      destinationId: defaultDestinationId || (destinations[0]?.id ?? ""),
      code: "",
      name: "",
      description: "",
      latitude: initialCoordinates ? Number(initialCoordinates.latitude.toFixed(6)) : 0,
      longitude: initialCoordinates ? Number(initialCoordinates.longitude.toFixed(6)) : 0,
      defaultRadiusMeters: 50,
      checkpointType: "CAMPSITE",
      status: "ACTIVE",
    };
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.destinationId) {
      setErrorMessage("Vui lòng chọn Địa danh.");
      return;
    }
    if (!formData.name.trim()) {
      setErrorMessage("Tên trạm dừng không được để trống.");
      return;
    }
    if (isNaN(Number(formData.latitude)) || isNaN(Number(formData.longitude))) {
      setErrorMessage("Tọa độ vĩ độ và kinh độ phải là số hợp lệ.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload: CreateCheckpointPayload = {
        destinationId: formData.destinationId,
        code: formData.code?.trim().toUpperCase() || undefined,
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        defaultRadiusMeters: Number(formData.defaultRadiusMeters) || 50,
        checkpointType: formData.checkpointType || undefined,
        status: formData.status,
      };

      if (initialData?.id) {
        await checkpointApi.updateCheckpoint(initialData.id, payload);
      } else {
        await checkpointApi.createCheckpoint(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        "Có lỗi xảy ra khi lưu trạm kiểm soát.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              {initialData ? "Chỉnh sửa Trạm dừng / Mốc" : "Thêm mới Trạm dừng / Mốc"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Khai báo điểm kiểm soát, lán trại, mốc ngắm cảnh trên cung đường
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              value={formData.destinationId}
              onChange={(e) => setFormData({ ...formData, destinationId: e.target.value })}
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
                Tên trạm dừng / mốc <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Lán nghỉ 2800m, Cột mốc Đỉnh..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mã trạm (Code)
              </label>
              <input
                type="text"
                placeholder="VD: CP_FN_01"
                value={formData.code || ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Phân loại trạm (Type)
              </label>
              <select
                value={formData.checkpointType || "CAMPSITE"}
                onChange={(e) => setFormData({ ...formData, checkpointType: e.target.value as CheckpointType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              >
                <option value="START">🏁 Điểm xuất phát (START)</option>
                <option value="CAMPSITE">⛺ Lán nghỉ / Cắm trại (CAMPSITE)</option>
                <option value="SUMMIT">🏔️ Đỉnh núi (SUMMIT)</option>
                <option value="WATER_SOURCE">💧 Nguồn nước (WATER_SOURCE)</option>
                <option value="VIEWPOINT">📸 Điểm ngắm cảnh (VIEWPOINT)</option>
                <option value="END">🏁 Điểm kết thúc (END)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Bán kính GPS (mét)
              </label>
              <input
                type="number"
                min={5}
                max={2000}
                value={formData.defaultRadiusMeters || 50}
                onChange={(e) => setFormData({ ...formData, defaultRadiusMeters: parseInt(e.target.value) || 50 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Vĩ độ (Latitude) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="VD: 22.3033"
                value={formData.latitude || ""}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Kinh độ (Longitude) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="VD: 103.7758"
                value={formData.longitude || ""}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Mô tả / Ghi chú an toàn
            </label>
            <textarea
              rows={2}
              placeholder="VD: Có sóng 4G Viettel, có bể chứa nước mưa 3000L..."
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

export const CheckpointModal: React.FC<CheckpointModalProps> = ({ isOpen, ...props }) => {
  if (!isOpen) return null;
  const keyStr = props.initialData?.id || (props.initialCoordinates ? `${props.initialCoordinates.latitude}_${props.initialCoordinates.longitude}` : "create");
  return <CheckpointModalContent key={keyStr} {...props} />;
};
