"use client";

import React, { useState, useEffect } from "react";
import { Destination, CreateDestinationPayload, PickupPointItem } from "../../types/destination.types";
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

  const [pickupPoints, setPickupPoints] = useState<PickupPointItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Khi mở modal edit, tải chi tiết để lấy danh sách pickup points đầy đủ
  useEffect(() => {
    if (initialData?.id) {
      if (initialData.pickupPoints && initialData.pickupPoints.length > 0) {
        setPickupPoints(initialData.pickupPoints);
      } else {
        setLoadingDetail(true);
        destinationApi
          .getDestinationDetail(initialData.id)
          .then((detail) => {
            if (detail.pickupPoints) {
              setPickupPoints(detail.pickupPoints);
            }
          })
          .catch((err) => {
            console.error("Lỗi khi tải chi tiết điểm đón:", err);
          })
          .finally(() => {
            setLoadingDetail(false);
          });
      }
    }
  }, [initialData?.id]);

  const handleAddPickupPoint = () => {
    setPickupPoints((prev) => [
      ...prev,
      {
        name: "",
        address: "",
        latitude: formData.centerLat ?? 21.0,
        longitude: formData.centerLng ?? 105.0,
        note: "",
        status: "ACTIVE",
      },
    ]);
  };

  const handleRemovePickupPoint = (index: number) => {
    setPickupPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePickupPoint = (
    index: number,
    field: keyof PickupPointItem,
    value: any
  ) => {
    setPickupPoints((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage("Tên địa danh không được để trống.");
      return;
    }

    // Validate danh sách pickup points
    for (let i = 0; i < pickupPoints.length; i++) {
      const p = pickupPoints[i];
      if (!p.name.trim()) {
        setErrorMessage(`Điểm đón #${i + 1}: Vui lòng nhập Tên điểm đón.`);
        return;
      }
      if (!p.address.trim()) {
        setErrorMessage(`Điểm đón #${i + 1} (${p.name}): Vui lòng nhập Địa chỉ.`);
        return;
      }
      if (isNaN(Number(p.latitude)) || isNaN(Number(p.longitude))) {
        setErrorMessage(`Điểm đón #${i + 1} (${p.name}): Tọa độ (Vĩ độ / Kinh độ) không hợp lệ.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const formattedPickups: PickupPointItem[] = pickupPoints.map((p) => ({
        id: p.id,
        name: p.name.trim(),
        address: p.address.trim(),
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        code: p.code?.trim() || undefined,
        note: p.note?.trim() || undefined,
        status: p.status || "ACTIVE",
      }));

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
        pickupPoints: formattedPickups,
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
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              {initialData ? "Chỉnh sửa Địa danh" : "Thêm mới Địa danh"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Quản lý đồng thời thông tin địa danh trekking và các điểm tập kết đón khách
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body - scrollable */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Section: Thông tin cơ bản */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B5E41] flex items-center gap-1.5">
              <span>📍</span>
              <span>Thông tin địa danh</span>
            </h4>

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
                rows={2}
                placeholder="Giới thiệu về địa danh, hệ sinh thái, độ cao đỉnh..."
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E41]/20 focus:border-[#1B5E41]"
              />
            </div>
          </div>

          {/* Section: Điểm tập kết / Pickup Points */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B5E41] flex items-center gap-1.5">
                  <span>🚌</span>
                  <span>Điểm tập kết đón khách ({pickupPoints.length})</span>
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Các điểm đón / trả khách tập trung được chọn khi tạo chuyến đi
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddPickupPoint}
                className="px-3 py-1.5 text-xs font-semibold text-[#1B5E41] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <span>+ Thêm điểm đón</span>
              </button>
            </div>

            {loadingDetail && (
              <div className="text-xs text-gray-400 italic py-2 text-center">
                Đang tải danh sách điểm đón hiện có...
              </div>
            )}

            {pickupPoints.length === 0 && !loadingDetail ? (
              <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center text-xs text-gray-400">
                Chưa có điểm tập kết nào được gán cho địa danh này. Nhấn <strong>"+ Thêm điểm đón"</strong> để thêm mới.
              </div>
            ) : (
              <div className="space-y-3">
                {pickupPoints.map((point, idx) => (
                  <div
                    key={point.id || idx}
                    className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-200 space-y-2.5 relative group hover:border-gray-300 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#1B5E41] text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-gray-700">
                          {point.name || "Điểm đón mới"}
                        </span>
                        {point.code && (
                          <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                            {point.code}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePickupPoint(idx)}
                        className="text-gray-400 hover:text-red-500 text-xs px-2 py-0.5 rounded hover:bg-red-50 transition cursor-pointer"
                        title="Xóa điểm đón này"
                      >
                        ✕ Xóa
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                          Tên điểm đón <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="VD: Bến xe Mỹ Đình, Sân bay Nội Bài..."
                          value={point.name}
                          onChange={(e) =>
                            handleUpdatePickupPoint(idx, "name", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1B5E41]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                          Địa chỉ đón <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="VD: 20 Phạm Hùng, Mỹ Đình, Hà Nội"
                          value={point.address}
                          onChange={(e) =>
                            handleUpdatePickupPoint(idx, "address", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1B5E41]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                          Vĩ độ (Lat) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          placeholder="VD: 21.0285"
                          value={point.latitude ?? ""}
                          onChange={(e) =>
                            handleUpdatePickupPoint(
                              idx,
                              "latitude",
                              e.target.value ? parseFloat(e.target.value) : 0
                            )
                          }
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1B5E41]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                          Kinh độ (Lng) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          placeholder="VD: 105.7781"
                          value={point.longitude ?? ""}
                          onChange={(e) =>
                            handleUpdatePickupPoint(
                              idx,
                              "longitude",
                              e.target.value ? parseFloat(e.target.value) : 0
                            )
                          }
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1B5E41]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                          Mã điểm (tùy chọn)
                        </label>
                        <input
                          type="text"
                          placeholder="Tự sinh nếu để trống"
                          value={point.code || ""}
                          onChange={(e) =>
                            handleUpdatePickupPoint(idx, "code", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white uppercase focus:outline-none focus:ring-1 focus:ring-[#1B5E41]"
                        />
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Ghi chú thêm (vd: Cổng số 2 lúc 5h30 sáng...)"
                        value={point.note || ""}
                        onChange={(e) =>
                          handleUpdatePickupPoint(idx, "note", e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1B5E41]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm text-white bg-[#1B5E41] hover:bg-[#144731] font-medium rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
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
