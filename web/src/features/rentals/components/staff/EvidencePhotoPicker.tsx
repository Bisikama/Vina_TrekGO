/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";

export type EvidencePhoto = {
  id: string;
  previewUrl: string;
  fileName: string;
  status: "uploading" | "done" | "error";
  mediaId?: string;
  error?: string;
};

type Props = {
  photos: EvidencePhoto[];
  disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

/**
 * Chọn/chụp nhiều ảnh hiện trạng, xem lại ngay dạng ô nhỏ.
 * Mỗi ảnh tải lên nền độc lập (do cha xử lý); ô lỗi bấm để thử lại, ✕ để bỏ.
 */
export function EvidencePhotoPicker({ photos, disabled, onAdd, onRemove, onRetry }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<EvidencePhoto | null>(null);
  const done = photos.filter((photo) => photo.status === "done").length;
  const uploading = photos.filter((photo) => photo.status === "uploading").length;
  const failed = photos.filter((photo) => photo.status === "error");

  useEffect(() => {
    if (!viewing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">Ảnh hiện trạng</p>
        <p className={`text-xs ${done === 0 && !uploading ? "text-red-700" : "text-slate-500"}`}>
          {done} ảnh đã tải
          {uploading ? ` · đang tải ${uploading}` : ""}
          {failed.length ? ` · ${failed.length} lỗi` : ""}
          {done === 0 && !uploading ? " · cần ít nhất 1 ảnh" : ""}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative h-20 w-20">
            <button
              type="button"
              title={photo.status === "error" ? "Bấm để tải lại" : "Xem ảnh"}
              onClick={() => (photo.status === "error" ? onRetry(photo.id) : setViewing(photo))}
              className="h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <img src={photo.previewUrl} alt={photo.fileName} className="h-full w-full object-cover" />
              {photo.status === "uploading" ? (
                <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/35">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </span>
              ) : null}
              {photo.status === "error" ? (
                <span className="absolute inset-0 grid place-items-center rounded-lg bg-red-700/60 text-[11px] font-semibold text-white">
                  ↻ Thử lại
                </span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label="Bỏ ảnh này"
              onClick={() => onRemove(photo.id)}
              className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-slate-900/80 text-[11px] text-white"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-emerald-500 bg-emerald-50/50 text-center text-[11px] font-semibold text-emerald-800 disabled:opacity-50"
        >
          <span>
            <span className="block text-lg leading-none">＋</span>
            {photos.length ? "Thêm ảnh" : "Chụp / chọn ảnh"}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) onAdd(files);
          }}
        />
      </div>
      {failed.length ? (
        <p className="mt-2 text-xs text-red-700">
          Lỗi tải ảnh: {failed[0].error ?? "không rõ"}. Bấm vào ảnh đỏ để thử lại.
        </p>
      ) : null}

      {viewing ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setViewing(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6"
        >
          <img src={viewing.previewUrl} alt={viewing.fileName} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(viewing.id);
                setViewing(null);
              }}
              className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white"
            >
              Bỏ ảnh
            </button>
            <button type="button" className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
              Đóng
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
