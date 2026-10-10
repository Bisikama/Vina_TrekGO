"use client";

import React, { useState } from "react";
import { Destination, CreateDestinationPayload } from "../../types/destination.types";
import { destinationApi } from "../../services/destination.api";

interface DestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Destination | null;
}

const DestinationModalContent: React.FC<Omit<DestinationModalProps, "isOpen">> = ({
  onClose,
  onSuccess,
  initialData,
}) => {
  const [formData, setFormData] = useState<CreateDestinationPayload>(() => {
    if (initialData) {
      return {
        name: initialData.name,
        region: initialData.region || "NORTH",
        description: initialData.description || "",
        centerLat: initialData.centerLat ?? undefined,
        centerLng: initialData.centerLng ?? undefined,
        status: initialData.status,
      };
    }
    return {
      name: "",
      region: "NORTH",
      description: "",
      centerLat: undefined,
      centerLng: undefined,
      status: "ACTIVE",
    };
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage("Tên địa danh không được để trống.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload: CreateDestinationPayload = {
        name: formData.name.trim(),
        region: formData.region || undefined,
        description: formData.description?.trim() || undefined,
        centerLat:
          formData.centerLat !== undefined &&
          formData.centerLat !== null &&
          !isNaN(Number(formData.centerLat))
            ? Number(formData.centerLat)
            : undefined,
        centerLng:
          formData.centerLng !== undefined &&
          formData.centerLng !== null &&
          !isNaN(Number(formData.centerLng))
            ? Number(formData.centerLng)
            : undefined,
        status: formData.status,
      };

      if (initialData?.id) {
        await destinationApi.updateDestination(initialData.id, payload);
      } else {
        await destinationApi.createDestination(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        "Có lỗi xảy ra khi lưu địa danh.";
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
              {initialData ? "Chỉnh sửa Địa danh" : "Thêm mới Địa danh"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Khai báo thông tin vùng núi / điểm đến trekking
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
              Tên địa danh <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Fansipan, Núi Bà Đen, Tà Xùa..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Khu vực (Vùng miền)
              </label>
              <select
                value={formData.region || "NORTH"}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              >
                <option value="NORTH">Miền Bắc (NORTH)</option>
                <option value="CENTRAL">Miền Trung (CENTRAL)</option>
                <option value="SOUTH">Miền Nam (SOUTH)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Trạng thái
              </label>
              <select
                value={formData.status || "ACTIVE"}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              >
                <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                <option value="INACTIVE">Tạm đóng (INACTIVE)</option>
                <option value="ARCHIVED">Lưu trữ (ARCHIVED)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Vĩ độ tâm (Center Lat)
              </label>
              <input
                type="number"
                step="any"
                placeholder="VD: 21.2833"
                value={formData.centerLat ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    centerLat: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Kinh độ tâm (Center Lng)
              </label>
              <input
                type="number"
                step="any"
                placeholder="VD: 104.3833"
                value={formData.centerLng ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    centerLng: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Mô tả chi tiết
            </label>
            <textarea
              rows={3}
              placeholder="Giới thiệu về địa danh, hệ sinh thái, độ cao đỉnh..."
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

export const DestinationModal: React.FC<DestinationModalProps> = ({ isOpen, ...props }) => {
  if (!isOpen) return null;
  return <DestinationModalContent key={props.initialData?.id || "create"} {...props} />;
};
