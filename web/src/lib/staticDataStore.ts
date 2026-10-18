"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { apiClient } from "./axios";
import {
  privateTripsApi,
  type PrivateSource,
} from "@/features/trips/services/private-trips.api";

export interface SystemTrailSummaryItem {
  id: string;
  code: string;
  name: string;
  difficulty: string;
  distanceKm: number;
  elevationGainM?: number | null;
  estimatedDurationMinutes?: number | null;
  destination?: {
    name: string;
  } | null;
}

interface StaticDataState {
  systemTrails: SystemTrailSummaryItem[];
  systemTrailsLoaded: boolean;
  systemTrailsLoading: boolean;

  privateSources: PrivateSource[];
  privateSourcesLoaded: boolean;
  privateSourcesLoading: boolean;

  pickupsByDestination: Record<string, { id: string; name: string }[]>;

  loadSystemTrails: (force?: boolean) => Promise<SystemTrailSummaryItem[]>;
  loadPrivateSources: (force?: boolean) => Promise<PrivateSource[]>;
  loadPickupsForDestination: (
    destinationId: string,
    force?: boolean
  ) => Promise<{ id: string; name: string }[]>;
  prefetchAllStaticData: () => void;
  clearStaticCache: () => void;
}

export const useStaticDataStore = create<StaticDataState>()(
  persist(
    (set, get) => ({
      systemTrails: [],
      systemTrailsLoaded: false,
      systemTrailsLoading: false,

      privateSources: [],
      privateSourcesLoaded: false,
      privateSourcesLoading: false,

      pickupsByDestination: {},

      loadSystemTrails: async (force = false) => {
        const state = get();
        if (state.systemTrailsLoaded && !force) {
          return state.systemTrails;
        }
        if (state.systemTrailsLoading) {
          return state.systemTrails;
        }

        set({ systemTrailsLoading: true });
        try {
          const { data } = await apiClient.get<{
            items: SystemTrailSummaryItem[];
          }>("/api/v1/system-trails?page=1&pageSize=20&status=ACTIVE");
          const items = data?.items || [];
          set({
            systemTrails: items,
            systemTrailsLoaded: true,
            systemTrailsLoading: false,
          });
          return items;
        } catch (err) {
          set({ systemTrailsLoading: false });
          return get().systemTrails;
        }
      },

      loadPrivateSources: async (force = false) => {
        const state = get();
        if (state.privateSourcesLoaded && !force) {
          return state.privateSources;
        }
        if (state.privateSourcesLoading) {
          return state.privateSources;
        }

        set({ privateSourcesLoading: true });
        try {
          const sources = await privateTripsApi.sources();
          set({
            privateSources: sources,
            privateSourcesLoaded: true,
            privateSourcesLoading: false,
          });
          return sources;
        } catch (err) {
          set({ privateSourcesLoading: false });
          return get().privateSources;
        }
      },

      loadPickupsForDestination: async (destinationId: string, force = false) => {
        if (!destinationId) return [];
        const cached = get().pickupsByDestination[destinationId];
        if (cached && !force) {
          return cached;
        }

        try {
          const pickups = await privateTripsApi.pickups(destinationId);
          set((state) => ({
            pickupsByDestination: {
              ...state.pickupsByDestination,
              [destinationId]: pickups,
            },
          }));
          return pickups;
        } catch {
          return cached || [];
        }
      },

      prefetchAllStaticData: () => {
        void get().loadSystemTrails();
        void get().loadPrivateSources();
      },

      clearStaticCache: () => {
        set({
          privateSources: [],
          privateSourcesLoaded: false,
          privateSourcesLoading: false,
          pickupsByDestination: {},
        });
      },
    }),
    {
      name: "vina_trekgo_static_store",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        systemTrails: state.systemTrails,
        systemTrailsLoaded: state.systemTrailsLoaded,
        privateSources: state.privateSources,
        privateSourcesLoaded: state.privateSourcesLoaded,
        pickupsByDestination: state.pickupsByDestination,
      }),
    }
  )
);

