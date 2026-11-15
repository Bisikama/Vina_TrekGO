"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Button, LoadingState, ErrorAlert, DifficultyBadge, EmptyState } from "@/components/ui";
import { SystemTrailMap } from "@/features/routes/components/SystemTrailMap";
import type { SystemTrail } from "@/features/routes/services/system-trails.api";
import {
  getTrailSubmissionDetail,
  getTrailSubmissionError,
  type TrailSubmissionDetail,
} from "../services/trail-submissions.api";

/** Adapts a personal trail to the shape SystemTrailMap renders (route, checkpoints, bounds). */
function toMapTrail(detail: TrailSubmissionDetail): SystemTrail | null {
  const segments = detail.trail.gpsSegments.filter((segment) => segment.length > 0);
  const points = segments.flat();
  if (points.length === 0) return null;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return {
    id: detail.trail.id,
    code: "",
    name: detail.trail.title,
    difficulty: (detail.trail.difficulty ?? "MEDIUM") as SystemTrail["difficulty"],
    distanceKm: detail.trail.distanceKm,
    elevationGainM: detail.trail.elevationGainM ?? 0,
    status: "ACTIVE",
    routeGeojson: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: segments } },
    checkpoints: detail.trail.checkpoints,
    bounds: {
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    },
    initialCamera: {
      center: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2],
      zoom: 13,
      pitch: 45,
      bearing: 0,
    },
  };
}

export function TrailSubmissionDetailModal({
  submissionId,
  onClose,
}: {
  submissionId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<TrailSubmissionDetail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setDetail(null);
      setError("");
      getTrailSubmissionDetail(submissionId)
        .then((data) => !cancelled && setDetail(data))
        .catch((e) => !cancelled && setError(getTrailSubmissionError(e).message));
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [submissionId, attempt]);

  const mapTrail = useMemo(() => (detail ? toMapTrail(detail) : null), [detail]);

  return (
    <Modal
      isOpen={submissionId !== null}
      onClose={onClose}
      maxWidth="lg"
      title={detail?.trail.title ?? "Chi tiết cung đường"}
      subtitle={detail ? `Gửi bởi ${detail.submittedBy.fullName}` : undefined}
      footer={<Button variant="ghost" onClick={onClose}>Đóng</Button>}
    >
      {error ? (
        <ErrorAlert message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !detail ? (
        <LoadingState label="Đang tải tuyến GPS…" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#6B7280]">
            <DifficultyBadge difficulty={detail.trail.difficulty} />
            <span className="tabular-nums">{detail.trail.distanceKm.toFixed(2)} km</span>
            <span>·</span>
            <span className="tabular-nums">+{detail.trail.elevationGainM ?? 0} m</span>
            <span>·</span>
            <span className="tabular-nums">{detail.trail.checkpoints.length} checkpoint</span>
          </div>

          {mapTrail ? (
            <div className="h-[420px] overflow-hidden rounded-xl border border-[#E5E7EB]">
              <SystemTrailMap trail={mapTrail} />
            </div>
          ) : (
            <EmptyState title="Cung đường chưa có dữ liệu GPS" description="Không có tọa độ nào để hiển thị trên bản đồ." />
          )}

          {detail.trail.description && (
            <p className="whitespace-pre-line text-sm text-[#1F2937]">{detail.trail.description}</p>
          )}

          {detail.trail.checkpoints.length > 0 && (
            <ol className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
              {detail.trail.checkpoints.map((cp, index) => (
                <li key={cp.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 break-words">
                    <span className="mr-2 font-bold tabular-nums text-[#2F6B4F]">{cp.sequence ?? index + 1}.</span>
                    {cp.name}
                  </span>
                  <span className="shrink-0 text-xs text-[#6B7280] tabular-nums">
                    {cp.latitude.toFixed(5)}, {cp.longitude.toFixed(5)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Modal>
  );
}
