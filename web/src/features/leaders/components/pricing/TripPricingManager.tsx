"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CostPlanBuilder } from "./CostPlanBuilder";
import { TrekkingPricingSimulator } from "./TrekkingPricingSimulator";
import {
  confirmTripPricing,
  getTripCostPlan,
  previewTripPricing,
  saveTripCostPlan,
} from "../../services/leader-pricing.api";
import { usePricingConfigStore } from "../../store/usePricingConfigStore";
import { getLeaderTripErrorMessage } from "../../services/leader-public-trips.api";
import type {
  CostItemInput,
  PricingEvaluationResult,
} from "../../types/leader-pricing";

interface TripPricingManagerProps {
  tripId?: string;
  tripVersion?: number;
  capacity: number;
  minPax?: number;
  durationDays?: number;
  initialPrice?: string;
  onPriceConfirmed?: (data: {
    selectedPrice: string;
    selectedMinPax: number;
    includedServices: string[];
    excludedServices: string[];
    costPlanStatus: "CONFIRMED" | "PUBLISHED";
  }) => void;
  disabled?: boolean;
}

export function TripPricingManager({
  tripId,
  tripVersion = 1,
  capacity,
  minPax = 5,
  durationDays = 2,
  initialPrice,
  onPriceConfirmed,
  disabled = false,
}: TripPricingManagerProps) {
  const { config, fetchPricingConfig } = usePricingConfigStore();

  const [items, setItems] = useState<CostItemInput[]>([]);
  const [targetPax, setTargetPax] = useState<number>(Math.min(15, Math.max(1, capacity)));
  const [selectedPrice, setSelectedPrice] = useState<string>(initialPrice || "2850000");
  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(12);
  const [contingencyPercent, setContingencyPercent] = useState<number>(5);
  const [selectedMinPax, setSelectedMinPax] = useState<number>(minPax);

  const [evaluation, setEvaluation] = useState<PricingEvaluationResult | null>(null);
  const [costPlanStatus, setCostPlanStatus] = useState<string | null>(null);
  const [currentTripVersion, setCurrentTripVersion] = useState<number>(tripVersion);

  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Khởi tạo & nạp cấu hình hệ thống
  useEffect(() => {
    fetchPricingConfig();
  }, [fetchPricingConfig]);

  // Đồng bộ currentTripVersion khi prop tripVersion từ trang cha tăng lên (VD: sau khi lưu mô tả)
  useEffect(() => {
    if (tripVersion && tripVersion > currentTripVersion) {
      setCurrentTripVersion(tripVersion);
    }
  }, [tripVersion, currentTripVersion]);

  // Đồng bộ targetPax & selectedMinPax khi capacity/minPax của chuyến đi thay đổi
  useEffect(() => {
    const safeCap = Math.max(1, capacity);
    setTargetPax((prev) => {
      if (prev > safeCap || prev === 15) {
        return Math.min(15, safeCap);
      }
      return Math.max(1, Math.min(prev, safeCap));
    });
    setSelectedMinPax((prev) => Math.max(1, Math.min(minPax || prev, safeCap)));
  }, [capacity, minPax]);

  // 2. Nạp Bảng chi phí & mô phỏng hiện có nếu có tripId
  useEffect(() => {
    if (!tripId) return;

    let cancelled = false;
    async function loadPlan() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getTripCostPlan(tripId!);
        if (cancelled) return;

        setCurrentTripVersion(res.tripVersion);
        setCostPlanStatus(res.costPlanStatus);

        const effectiveCap = Math.max(1, res.tripContext?.maxPax || capacity);
        const effectiveMin = Math.max(
          1,
          Math.min(effectiveCap, res.tripContext?.minPax || minPax)
        );

        if (res.plan && res.plan.items.length > 0) {
          setItems(res.plan.items);
          setTargetPax(
            Math.min(effectiveCap, Math.max(1, res.plan.targetPax || effectiveCap))
          );
          setTargetMarginPercent(Math.round((res.plan.targetMarginBps || 1200) / 100));
          setContingencyPercent(Math.round((res.plan.contingencyBps || 500) / 100));
          if (res.plan.selectedPrice) {
            setSelectedPrice(res.plan.selectedPrice);
          }
          if (res.plan.selectedMinPax) {
            setSelectedMinPax(
              Math.min(effectiveCap, Math.max(1, res.plan.selectedMinPax))
            );
          } else {
            setSelectedMinPax(effectiveMin);
          }
        } else {
          setTargetPax(Math.min(15, effectiveCap));
          setSelectedMinPax(effectiveMin);
          if (res.tripContext?.pricePerPax) {
            setSelectedPrice(res.tripContext.pricePerPax);
          }
        }

        if (res.evaluation) {
          setEvaluation(res.evaluation);
        }
        if (res.costPlanStatus === "CONFIRMED" || res.costPlanStatus === "PUBLISHED") {
          setIsConfirmed(true);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.warn("Lỗi tải cost-plan:", err);
          setError(getLeaderTripErrorMessage(err, "Không thể tải bảng chi phí"));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPlan();
    return () => {
      cancelled = true;
    };
  }, [tripId, capacity, minPax]);

  // 3. Hàm kích hoạt Preview (chạy Simulator)
  const triggerPreview = useCallback(
    async (
      customItems: CostItemInput[],
      pax: number,
      price: string,
      marginPct: number
    ) => {
      if (!tripId) return;
      const activeItems = customItems.filter((i) => i.isEnabled);
      if (activeItems.length === 0) return;

      try {
        const result = await previewTripPricing(tripId, {
          targetPax: pax,
          targetMarginBps: Math.round(marginPct * 100),
          contingencyBps: Math.round(contingencyPercent * 100),
          selectedPrice: price || null,
          selectedMinPax,
          items: customItems,
        });
        setEvaluation(result);
        setCurrentTripVersion((prev) => Math.max(prev, result.tripVersion));
        setError(null);
      } catch (err: unknown) {
        console.warn("Lỗi preview pricing:", err);
      }
    },
    [tripId, contingencyPercent, selectedMinPax]
  );

  // 4. Debounce preview khi người dùng thay đổi dữ liệu bảng tính
  const schedulePreview = useCallback(
    (
      newItems: CostItemInput[],
      newPax: number,
      newPrice: string,
      newMargin: number
    ) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        triggerPreview(newItems, newPax, newPrice, newMargin);
      }, 350);
    },
    [triggerPreview]
  );

  const handleItemsChange = (newItems: CostItemInput[]) => {
    setItems(newItems);
    setIsConfirmed(false);
    schedulePreview(newItems, targetPax, selectedPrice, targetMarginPercent);
  };

  const handleTargetPaxChange = (pax: number) => {
    setTargetPax(pax);
    schedulePreview(items, pax, selectedPrice, targetMarginPercent);
  };

  const handlePriceChange = (price: string) => {
    setSelectedPrice(price);
    setIsConfirmed(false);
    schedulePreview(items, targetPax, price, targetMarginPercent);
  };

  const handleMarginChange = (margin: number) => {
    setTargetMarginPercent(margin);
    schedulePreview(items, targetPax, selectedPrice, margin);
  };

  const handleApplySuggestedPrice = (suggested: string) => {
    setSelectedPrice(suggested);
    setIsConfirmed(false);
    schedulePreview(items, targetPax, suggested, targetMarginPercent);
  };

  // 5. Lưu bảng chi phí và chốt giá vé (Confirm)
  const handleConfirm = async () => {
    if (!tripId) {
      setError("Cần lưu thông tin cơ bản của chuyến đi trước khi chốt giá vé.");
      return;
    }

    if (items.length === 0) {
      setError("Vui lòng thêm ít nhất một khoản chi phí trước khi chốt giá vé.");
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsConfirming(true);
    setError(null);

    try {
      const savePayloadBase = {
        targetPax,
        targetMarginBps: Math.round(targetMarginPercent * 100),
        contingencyBps: Math.round(contingencyPercent * 100),
        selectedPrice,
        selectedMinPax,
        items,
      };

      // Bước A: Lưu Cost Plan xuống DB (tự động đồng bộ lại version nếu bị lệch 409)
      let saveRes: { tripId: string; tripVersion: number; costPlanStatus: string };
      try {
        saveRes = await saveTripCostPlan(tripId, {
          expectedVersion: currentTripVersion,
          ...savePayloadBase,
        });
      } catch (firstErr: unknown) {
        const status = (firstErr as { response?: { status?: number } })?.response?.status;
        if (status === 409) {
          const latest = await getTripCostPlan(tripId);
          setCurrentTripVersion(latest.tripVersion);
          saveRes = await saveTripCostPlan(tripId, {
            expectedVersion: latest.tripVersion,
            ...savePayloadBase,
          });
        } else {
          throw firstErr;
        }
      }

      // Cập nhật ngay currentTripVersion sau Bước A để nếu Bước B báo lỗi (VD: lỗ vốn), version không bị lệch
      setCurrentTripVersion(saveRes.tripVersion);

      // Bước B: Gọi Confirm Pricing để chốt giá vé vào Trip
      const confirmRes = await confirmTripPricing(tripId, {
        expectedVersion: saveRes.tripVersion,
        selectedPrice,
        selectedMinPax,
        targetPax,
      });

      setCurrentTripVersion(confirmRes.tripVersion);
      setIsConfirmed(true);
      setCostPlanStatus("CONFIRMED");

      // Trích xuất các dịch vụ
      const activeItems = items.filter((i) => i.isEnabled);
      const inc = activeItems.filter((i) => i.includedInPrice).map((i) => i.name);
      const exc = activeItems
        .filter((i) => !i.includedInPrice)
        .map((i) => (i.sourceNote?.trim() ? `${i.name} (${i.sourceNote.trim()})` : i.name));

      onPriceConfirmed?.({
        selectedPrice: confirmRes.selectedPrice,
        selectedMinPax: confirmRes.selectedMinPax,
        includedServices: inc,
        excludedServices: exc,
        costPlanStatus: "CONFIRMED",
      });
    } catch (err: unknown) {
      console.warn("Lỗi khi chốt bảng giá:", err);
      setError(getLeaderTripErrorMessage(err, "Không thể chốt mức giá vé này. Vui lòng thử lại."));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-800 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="mt-2 text-xs font-semibold text-gray-500">Đang tải bảng dự toán chi phí...</p>
        </div>
      ) : (
        <>
          {/* Phần A: Bảng kê chi phí */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
            <CostPlanBuilder
              items={items}
              durationDays={durationDays}
              capacity={capacity}
              onChange={handleItemsChange}
              disabled={disabled || isConfirming}
            />
          </div>

          {/* Phần B: Trekking Pricing Simulator */}
          <TrekkingPricingSimulator
            evaluation={evaluation}
            capacity={capacity}
            minPax={selectedMinPax}
            targetPax={targetPax}
            selectedPrice={selectedPrice}
            targetMarginPercent={targetMarginPercent}
            contingencyPercent={contingencyPercent}
            onTargetPaxChange={handleTargetPaxChange}
            onSelectedPriceChange={handlePriceChange}
            onTargetMarginChange={handleMarginChange}
            onApplySuggestedPrice={handleApplySuggestedPrice}
            onConfirm={handleConfirm}
            isConfirming={isConfirming}
            isConfirmed={isConfirmed}
            disabled={disabled}
          />
        </>
      )}
    </div>
  );
}

