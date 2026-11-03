import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPublicTripById,
  type PublicTrip,
} from "@/features/trips/services/public-trips.api";
import {
  getSystemTrailById,
  getSystemTrailDetail,
  type SystemTrailDetail,
} from "@/features/leaders/services/leader-public-trips.api";
import { ApiError } from "@/lib/api-client";

export function usePublicTripDetail(
  tripId?: string,
  accessToken?: string | null,
) {
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [trailData, setTrailData] = useState<SystemTrailDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [trailLoading, setTrailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchTripDetail = useCallback(async () => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getPublicTripById(tripId);
      if (!isMountedRef.current) return;
      setTrip(data);

      // Attempt to load trail details for 3D map if routes exist
      const firstRoute = data.routes?.[0];
      if (firstRoute) {
        setTrailLoading(true);
        try {
          // First attempt: try public system-trails endpoint by route identifier/name
          let trail: SystemTrailDetail | null = null;
          try {
            trail = await getSystemTrailDetail(firstRoute.snapshotName);
          } catch {
            // Second attempt: if user is logged in, try leader option trail by ID
            if (accessToken) {
              trail = await getSystemTrailById(firstRoute.snapshotName, accessToken);
            }
          }
          if (isMountedRef.current && trail) {
            setTrailData(trail);
          }
        } catch {
          // Map trail data is optional, failure should not break trip detail
        } finally {
          if (isMountedRef.current) {
            setTrailLoading(false);
          }
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const msg =
        err instanceof ApiError
          ? err.message
          : "Không thể tải thông tin chuyến đi.";
      setError(msg);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [tripId, accessToken]);

  useEffect(() => {
    void fetchTripDetail();
  }, [fetchTripDetail]);

  return {
    trip,
    trailData,
    loading,
    trailLoading,
    error,
    refetch: fetchTripDetail,
  };
}
