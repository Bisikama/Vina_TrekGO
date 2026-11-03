import { useCallback, useEffect, useRef, useState } from "react";
import type { DifficultyLevel, Trail } from "@/types";
import {
  getSystemTrailAccesses,
  getSystemTrailDetail,
  getSystemTrails,
} from "@/features/private-trips/services/private-trips.api";

const DEFAULT_TRAIL_PHOTOS = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=800&q=80",
];

function mapDifficulty(d?: string): DifficultyLevel {
  switch (d) {
    case "EASY":
      return "Dễ";
    case "MEDIUM":
      return "Trung bình";
    case "HARD":
      return "Khó";
    case "EXTREME":
      return "Thách thức";
    default:
      return "Trung bình";
  }
}

export function formatDuration(mins?: number | null): string {
  if (!mins || mins <= 0) return "1 Ngày";
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return `${days}N${Math.max(1, days - 1)}Đ`;
  }
  if (rem > 0) return `${hours}h ${rem}p`;
  return `${hours} giờ`;
}

/**
 * Trích xuất mảng toạ độ chuẩn [lng, lat, elevation?] từ đối tượng GeoJSON trả về bởi backend.
 * Hỗ trợ cả LineString trực tiếp, Feature và FeatureCollection.
 */
export function extractRouteCoordinates(
  routeGeojson: any,
): [number, number, number?][] {
  if (!routeGeojson) return [];

  // Dạng 1: LineString trực tiếp { type: "LineString", coordinates: [...] }
  if (Array.isArray(routeGeojson.coordinates)) {
    return routeGeojson.coordinates;
  }

  // Dạng 2: Feature { type: "Feature", geometry: { coordinates: [...] } }
  if (Array.isArray(routeGeojson.geometry?.coordinates)) {
    return routeGeojson.geometry.coordinates;
  }

  // Dạng 3: FeatureCollection { type: "FeatureCollection", features: [{ geometry: { coordinates: [...] } }] }
  if (Array.isArray(routeGeojson.features)) {
    for (const f of routeGeojson.features) {
      if (Array.isArray(f?.geometry?.coordinates)) {
        return f.geometry.coordinates;
      }
    }
  }

  return [];
}

export function useExploreSystemTrails(autoFetch = true) {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [selectedTrailDetail, setSelectedTrailDetail] = useState<any | null>(null);
  const detailCacheRef = useRef<Record<string, any>>({});
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(autoFetch);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hàm tải chi tiết 1 cung đường (GPS, checkpoints, camera, ...)
  const loadTrailDetail = useCallback(async (trailId: string) => {
    if (!trailId) {
      setSelectedTrailDetail(null);
      return null;
    }

    if (detailCacheRef.current[trailId]) {
      const cached = detailCacheRef.current[trailId];
      setSelectedTrailDetail(cached);
      return cached;
    }

    setLoadingDetail(true);
    try {
      const detail = await getSystemTrailDetail(trailId);
      if (detail) {
        detailCacheRef.current[trailId] = detail;
        setSelectedTrailDetail(detail);
        return detail;
      }
    } catch (err) {
      console.warn(`[useExploreSystemTrails] Không thể tải chi tiết trail ${trailId}:`, err);
    } finally {
      setLoadingDetail(false);
    }
    return null;
  }, []);

  const selectTrail = useCallback((trail: Trail) => {
    setSelectedTrail(trail);
    if (trail?.id) {
      void loadTrailDetail(trail.id);
    }
  }, [loadTrailDetail]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Tải danh sách cung đường hệ thống và danh sách cung đường user đã mua song song
      const [trailsRes, accessesRes] = await Promise.allSettled([
        getSystemTrails({ page: 1, pageSize: 50 }),
        getSystemTrailAccesses(1),
      ]);

      const systemItems =
        trailsRes.status === "fulfilled" && trailsRes.value?.items
          ? trailsRes.value.items
          : [];

      const accessesList =
        accessesRes.status === "fulfilled" && Array.isArray(accessesRes.value)
          ? accessesRes.value
          : [];

      // 2. Lập Set các systemTrailId đã được mua / active
      const ownedSet = new Set<string>(
        accessesList
          .filter((a: any) => a.status === "ACTIVE" || !a.status)
          .map((a: any) => a.systemTrailId),
      );
      setOwnedIds(ownedSet);

      // 3. Chuẩn hóa dữ liệu sang giao diện Trail dùng trong UI Explore
      const mapped: Trail[] = systemItems.map((st: any, idx: number) => {
        const isOwned = ownedSet.has(st.id);
        return {
          id: st.id,
          name: st.name || "Cung đường hệ thống",
          region: st.destination?.name || "Khu vực núi rừng",
          difficulty: mapDifficulty(st.difficulty),
          distanceKm: Number(st.distanceKm) || 0,
          elevationGainM: Number(st.elevationGainM) || 0,
          duration: formatDuration(st.estimatedDurationMinutes),
          price: Number(st.price) || 0,
          isUnlocked: isOwned,
          rating: 4.9,
          reviewCount: 120 + ((idx * 19) % 250),
          imageUrl: DEFAULT_TRAIL_PHOTOS[idx % DEFAULT_TRAIL_PHOTOS.length],
          description:
            st.description ||
            "Cung đường trekking chính thức đã được khảo sát địa hình, số hoá toạ độ GPS độ nét cao và kiểm duyệt các trạm an toàn.",
          highlights: [
            "Bản đồ 3D vệ tinh độ chính xác cao",
            "Trạm kiểm soát an toàn dọc tuyến",
            "Điều hướng GPS offline",
          ],
          terrainType:
            st.difficulty === "HARD" ? "Núi đá & Rừng rậm" : "Đồi dốc tự nhiên",
          checkpoints: [],
        };
      });

      setTrails(mapped);

      // Chọn trail đầu tiên hoặc giữ lại trail cũ và kích hoạt tải chi tiết ngay
      if (mapped.length > 0) {
        setSelectedTrail((prev) => {
          const current = (prev ? mapped.find((t) => t.id === prev.id) : null) || mapped[0];
          if (current?.id) {
            void loadTrailDetail(current.id);
          }
          return current;
        });
      }
    } catch (err: any) {
      setError(err?.message || "Không thể tải danh sách cung đường hệ thống.");
    } finally {
      setLoading(false);
    }
  }, [loadTrailDetail]);

  useEffect(() => {
    if (autoFetch) {
      void fetchAll();
    }
  }, [autoFetch, fetchAll]);

  return {
    trails,
    selectedTrail,
    setSelectedTrail: selectTrail,
    selectedTrailDetail,
    loadTrailDetail,
    ownedTrailIds: ownedIds,
    loading,
    loadingDetail,
    error,
    refetch: fetchAll,
  };
}
