import { create } from "zustand";
import { getSystemTrails, SystemTrail } from "../services/system-trails.api";

interface SystemTrailsState {
  items: SystemTrail[];
  isLoading: boolean;
  hasFetched: boolean;
  error: string | null;
  fetchSystemTrails: () => Promise<void>;
}

export const useSystemTrailsStore = create<SystemTrailsState>((set, get) => ({
  items: [],
  isLoading: false,
  hasFetched: false,
  error: null,
  fetchSystemTrails: async () => {
    // Prevent fetching if already fetched (caching logic)
    if (get().hasFetched || get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const data = await getSystemTrails({ page: 1, pageSize: 20 });
      set({
        items: data.items,
        isLoading: false,
        hasFetched: true,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.response?.data?.message || "Lỗi khi tải danh sách cung đường",
      });
    }
  },
}));
