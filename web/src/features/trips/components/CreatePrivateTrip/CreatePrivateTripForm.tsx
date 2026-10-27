"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivateTrips } from "../../hooks/usePrivateTrips";
import Link from "next/link";
import { SystemTrailMap } from "@/features/routes/components/SystemTrailMap";
import { apiClient } from "@/lib/axios";
import {
  PageHeader,
  SurfaceCard,
  SurfaceSectionHeader,
  Button,
  FormField,
  Input,
  Select,
  ErrorAlert,
} from "@/components/ui";

export const CreatePrivateTripForm = () => {
  const router = useRouter();
  const { busy, error, sources, pickups, loadSources, loadPickups, create } = usePrivateTrips();

  const [sourceKey, setSourceKey] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    capacity: 5,
    pickupPointId: "",
  });

  const getMinStartAt = () => {
    // Thời gian khởi hành phải cách thời điểm tạo ít nhất 2 ngày (48 giờ)
    const minDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    minDate.setMinutes(minDate.getMinutes() - minDate.getTimezoneOffset());
    return minDate.toISOString().slice(0, 16);
  };

  const getMinEndAt = () => {
    if (formData.startAt) {
      return formData.startAt;
    }
    return getMinStartAt();
  };

  const [trailDetail, setTrailDetail] = useState<any>(null);
  const [loadingMap, setLoadingMap] = useState(false);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const selectedSource = sources.find((s) => `${s.type}:${s.id}` === sourceKey);

  useEffect(() => {
    // Reset pickupPointId when trail source changes to prevent 404 destination mismatch
    setFormData((prev) => ({ ...prev, pickupPointId: "" }));
    setValidationError(null);
    if (selectedSource?.destinationId) {
      loadPickups(selectedSource.destinationId);
    }

    // Fetch 3D Map Data for SYSTEM trails
    if (selectedSource && selectedSource.type === "SYSTEM") {
      setLoadingMap(true);
      apiClient
        .get(`/api/v1/system-trails/${selectedSource.id}`)
        .then((res) => setTrailDetail(res.data))
        .catch((err) => console.error("Failed to load trail 3D data:", err))
        .finally(() => setLoadingMap(false));
    } else {
      setTrailDetail(null);
    }
  }, [selectedSource, loadPickups]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setValidationError(null);
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!selectedSource) {
      setValidationError("Vui lòng chọn một tuyến đường trekking.");
      return;
    }
    if (!selectedSource.destinationId) {
      setValidationError(
        "Tuyến đường này chưa được gán Điểm đến (Destination). Vui lòng cập nhật điểm đến cho tuyến đường hoặc chọn tuyến đường khác."
      );
      return;
    }

    if (!formData.pickupPointId) {
      setValidationError("Vui lòng chọn một điểm tập kết hợp lệ.");
      return;
    }

    const filteredPoints = selectedSource.points.filter(
      (p) =>
        selectedSource.type === "PERSONAL" ||
        (p as any).destinationId === selectedSource.destinationId ||
        true
    );

    if (filteredPoints.length === 0) {
      setValidationError("Tuyến đường này không có trạm nghỉ hợp lệ nào. Yêu cầu ít nhất 1 trạm nghỉ.");
      return;
    }

    const now = new Date();
    const startDate = new Date(formData.startAt);
    const endDate = new Date(formData.endAt);
    const minAllowedStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    if (startDate < minAllowedStart) {
      setValidationError("Thời gian khởi hành phải cách thời điểm hiện tại ít nhất 2 ngày (48 giờ).");
      return;
    }

    if (endDate <= startDate) {
      setValidationError("Thời gian kết thúc chuyến đi phải sau thời gian khởi hành.");
      return;
    }

    try {
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      const created = await create({
        title: formData.title,
        description: formData.description,
        startAt: startIso,
        endAt: endIso,
        capacity: Number(formData.capacity),
        pickupPointId: formData.pickupPointId,
        type: selectedSource.type as "PERSONAL" | "SYSTEM",
        trailRef: selectedSource.id,
        destinationId: selectedSource.destinationId,
        checkpointIds: selectedSource.points.map((p) => p.id),
      });

      if (created) {
        router.push(`/my-trips`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
      <PageHeader
        eyebrow="Vina TrekGO · Chuyến Đi Cá Nhân"
        title="Tổ chức chuyến đi mới"
        description="Điền thông tin bên dưới để tạo nhóm và mời bạn bè cùng tham gia trekking."
        backHref="/my-trips"
        backLabel="Quay lại danh sách"
      />

      <form onSubmit={handleSubmit} className="flex flex-col space-y-8">
        {(validationError || error) && (
          <ErrorAlert message={validationError || error || ""} />
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-stretch">
          {/* Cung đường */}
          <SurfaceCard padding="none" className="overflow-hidden w-full lg:w-1/2 flex flex-col">
            <div className="border-b border-[#E5E7EB] px-6 py-5 bg-[#F7F7F4]/60">
              <SurfaceSectionHeader
                title="1. Tuyến Đường Trekking"
                subtitle="Chọn tuyến đường hệ thống hoặc tuyến đường cá nhân đã mở khóa."
                className="mb-0 pb-0 border-b-0"
              />
            </div>
            <div className="p-6">
              <FormField label="Chọn Tuyến Đường" required>
                <Select
                  value={sourceKey}
                  onChange={(e) => setSourceKey(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    -- Bấm để chọn tuyến đường --
                  </option>
                  {sources.map((s) => (
                    <option key={`${s.type}:${s.id}`} value={`${s.type}:${s.id}`}>
                      {s.name} ({s.type === "SYSTEM" ? "Hệ thống" : "Cá nhân"})
                    </option>
                  ))}
                </Select>
              </FormField>

              {selectedSource && (
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-[#1F2937] mb-3">
                    Các Trạm Nghỉ Dự Kiến (Checkpoints)
                  </label>
                  <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedSource.points.map((p, index) => (
                      <div
                        key={p.id}
                        className="flex items-start gap-3 p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F7F7F4]/70"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#125238]">
                            Trạm {index + 1}: {p.name}
                          </p>
                        </div>
                      </div>
                    ))}
                    {selectedSource.points.length === 0 && (
                      <div className="p-4 rounded-xl bg-[#F7F7F4] text-center text-[#6B7280] text-sm">
                        Không có trạm nghỉ nào trên tuyến đường này.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </SurfaceCard>

          {/* 3D Map Area */}
          <SurfaceCard
            padding="none"
            className="overflow-hidden w-full lg:w-1/2 flex flex-col min-h-[400px]"
          >
            <div className="border-b border-[#E5E7EB] px-6 py-5 bg-[#F7F7F4]/60 flex items-center justify-between">
              <SurfaceSectionHeader
                title="Bản đồ 3D Hành Trình"
                subtitle="Xem trước địa hình và các trạm nghỉ."
                className="mb-0 pb-0 border-b-0"
              />
            </div>
            <div className="flex-1 relative bg-[#F7F7F4]">
              {!selectedSource ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#6B7280] p-8 text-center">
                  <svg
                    className="w-16 h-16 mb-4 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  <p className="font-medium">Vui lòng chọn tuyến đường để xem bản đồ 3D</p>
                </div>
              ) : loadingMap ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[#F7F7F4]/80 backdrop-blur-sm z-10">
                  <svg
                    className="animate-spin h-8 w-8 text-[#2F6B4F]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </div>
              ) : trailDetail ? (
                <div className="absolute inset-0">
                  <SystemTrailMap trail={trailDetail} />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#6B7280] p-8 text-center bg-[#F7F7F4]">
                  <svg
                    className="w-12 h-12 mb-3 opacity-50 text-amber-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="font-medium text-[#1F2937]">
                    Bản đồ 3D chưa khả dụng cho tuyến đường này
                  </p>
                </div>
              )}
            </div>
          </SurfaceCard>
        </div>

        {/* Thông tin chuyến đi */}
        <SurfaceCard padding="none" className="overflow-hidden w-full">
          <div className="border-b border-[#E5E7EB] px-6 py-5 bg-[#F7F7F4]/60">
            <SurfaceSectionHeader
              title="2. Lịch Trình & Thông Tin"
              subtitle="Khai báo thời gian khởi hành, sức chứa đoàn và điểm tập kết."
              className="mb-0 pb-0 border-b-0"
            />
          </div>

          <div className="p-6 space-y-6">
            <FormField label="Tên chuyến đi" required>
              <Input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Ví dụ: Leo núi cuối tuần cùng hội bạn thân"
                required
                maxLength={220}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField
                label="Khởi hành"
                required
                hint="Phải cách thời điểm hiện tại ít nhất 2 ngày (48 giờ)"
              >
                <Input
                  type="datetime-local"
                  name="startAt"
                  value={formData.startAt}
                  onChange={handleChange}
                  min={getMinStartAt()}
                  required
                />
              </FormField>
              <FormField
                label="Kết thúc"
                required
                hint="Thời gian kết thúc phải sau thời gian khởi hành"
              >
                <Input
                  type="datetime-local"
                  name="endAt"
                  value={formData.endAt}
                  onChange={handleChange}
                  min={getMinEndAt()}
                  required
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label="Quy mô nhóm" required>
                <Input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  min={1}
                  required
                />
              </FormField>

              <FormField label="Điểm tập kết" required>
                <Select
                  name="pickupPointId"
                  value={formData.pickupPointId}
                  onChange={handleChange}
                  required
                  disabled={!selectedSource || pickups.length === 0}
                >
                  <option value="" disabled>
                    {pickups.length > 0 ? "-- Chọn điểm hẹn --" : "Chưa có địa điểm"}
                  </option>
                  {pickups.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </div>
        </SurfaceCard>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-4 pt-4">
          <Link
            href="/my-trips"
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-[#6B7280] hover:bg-[#EFEFE9] transition-colors text-center"
          >
            Hủy bỏ
          </Link>
          <Button
            type="submit"
            size="lg"
            loading={busy}
            disabled={busy || !selectedSource}
          >
            Tạo Chuyến Đi →
          </Button>
        </div>
      </form>
    </div>
  );
};
