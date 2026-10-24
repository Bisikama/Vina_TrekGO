import { create } from "zustand";
import { getPricingConfig } from "../services/leader-pricing.api";
import type { FeePolicyConfig } from "../types/leader-pricing";

interface PricingConfigState {
  config: FeePolicyConfig | null;
  isLoading: boolean;
  hasFetched: boolean;
  error: string | null;
  fetchPricingConfig: () => Promise<FeePolicyConfig | null>;
}

export const DEFAULT_FALLBACK_FEE_POLICY: FeePolicyConfig = {
  policyVersion: "fee-2026-v1",
  platformFeeBps: 800, // 8%
  paymentFeeBps: 200,  // 2%
  totalFeeBps: 1000,   // 10%
  defaultContingencyBps: 500, // 5%
  defaultTargetMarginBps: 1200, // 12%
  roundingStepVnd: "10000",
  currency: "VND",
};

export const usePricingConfigStore = create<PricingConfigState>((set, get) => ({
  config: null,
  isLoading: false,
  hasFetched: false,
  error: null,
  fetchPricingConfig: async () => {
    if (get().hasFetched && get().config) {
      return get().config;
    }
    if (get().isLoading) {
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const data = await getPricingConfig();
      set({
        config: data,
        isLoading: false,
        hasFetched: true,
      });
      return data;
    } catch (err: unknown) {
      console.warn("Lỗi khi tải cấu hình định giá hệ thống, sử dụng cấu hình mặc định:", err);
      set({
        config: DEFAULT_FALLBACK_FEE_POLICY,
        isLoading: false,
        hasFetched: true,
        error: "Không thể kết nối đến máy chủ cấu hình định giá",
      });
      return DEFAULT_FALLBACK_FEE_POLICY;
    }
  },
}));

