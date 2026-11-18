/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";

import { getEvidenceMedia, type EvidenceMedia } from "@/features/rentals/services/deduction-review.api";

/**
 * Ảnh/video bằng chứng (giao hàng chụp khi nhận, hoặc lúc giao cho khách).
 * `autoLoad` để tải ngay (dùng cho món giao hàng báo có vấn đề); không thì bấm mới tải.
 */
export function ReturnEvidenceGallery({
  ids,
  label,
  autoLoad = false,
}: {
  ids: string[];
  label: string;
  autoLoad?: boolean;
}) {
  const [open, setOpen] = useState(autoLoad);
  const [media, setMedia] = useState<EvidenceMedia[]>();
  const [failed, setFailed] = useState(0);
  const [loading, setLoading] = useState(false);

  // Chuỗi ổn định: mảng `ids` là mảng mới mỗi lần cha render.
  const idsKey = ids.join(",");

  const load = useCallback(async () => {
    setLoading(true);
    const settled = await Promise.allSettled(idsKey.split(",").map((id) => getEvidenceMedia(id)));
    setMedia(settled.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : [])));
    setFailed(settled.filter((entry) => entry.status === "rejected").length);
    setLoading(false);
  }, [idsKey]);

  useEffect(() => {
    if (!open || media || loading || !idsKey) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [open, media, loading, idsKey, load]);

  if (!ids.length) return <p className="text-[11px] text-slate-500">{label}: không có ảnh.</p>;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="text-[11px] font-semibold text-emerald-800 underline"
      >
        {open ? `Ẩn ${label.toLowerCase()}` : `${label} (${ids.length})`}
      </button>
      {open ? (
        loading || !media ? (
          <p className="mt-1 text-[11px] text-slate-500">Đang tải ảnh...</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {media.map((entry) =>
              entry.resourceType === "VIDEO" ? (
                <video key={entry.mediaId} src={entry.url} controls className="h-20 w-20 rounded-lg bg-black object-cover" />
              ) : (
                <a key={entry.mediaId} href={entry.url} target="_blank" rel="noreferrer">
                  <img src={entry.url} alt={label} className="h-20 w-20 rounded-lg object-cover" />
                </a>
              ),
            )}
            {failed > 0 ? <p className="text-[11px] text-amber-800">{failed} tệp không tải được.</p> : null}
          </div>
        )
      ) : null}
    </div>
  );
}
