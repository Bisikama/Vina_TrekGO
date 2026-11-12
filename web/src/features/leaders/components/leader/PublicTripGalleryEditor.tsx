"use client";

import type { ReactNode } from "react";
import { Button, EmptyState, ErrorAlert, FormField, InfoBanner, Input, SurfaceCard, SurfaceSectionHeader } from "@/components/ui";
import { PublicTripPhoto } from "@/features/trips/components/PublicTripPhoto";
import { publicTripImageAccept, publicTripImageLimit, type usePublicTripGallery } from "../../hooks/usePublicTripGallery";

export function PublicTripGalleryEditor({ gallery, disabled = false, locked = false, children }: {
  gallery: ReturnType<typeof usePublicTripGallery>;
  disabled?: boolean;
  locked?: boolean;
  children?: ReactNode;
}) {
  const busy = disabled || gallery.isUploading;
  const items = locked ? gallery.savedItems : gallery.items;

  return (
    <SurfaceCard as="section" padding="lg">
      <SurfaceSectionHeader
        title="Ảnh chuyến đi"
        subtitle="Tối đa 10 ảnh. Ảnh đầu tiên là ảnh bìa và hiển thị trên danh sách chuyến đi."
      />
      <div className="space-y-4">
        {locked ? (
          <InfoBanner>Chuyến ở trạng thái hiện tại chỉ cho xem ảnh đã lưu.</InfoBanner>
        ) : (
          <FormField hint="Ảnh công khai ngay khi tải lên. Chọn JPEG, PNG, WebP, HEIC hoặc HEIF. Giới hạn mặc định là 20 MiB mỗi ảnh.">
            <Input
              type="file"
              aria-label="Chọn ảnh chuyến đi"
              accept={publicTripImageAccept}
              multiple
              disabled={busy || items.length >= publicTripImageLimit}
              className="file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:py-2.5 file:font-semibold file:text-[#125238]"
              onChange={(event) => {
                if (event.target.files) gallery.addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </FormField>
        )}
        {!locked && gallery.selectionError && <ErrorAlert message={gallery.selectionError} />}
        {items.length === 0 && (
          <EmptyState title="Chưa có ảnh chuyến đi" description="Chuyến đi sẽ hiển thị ảnh mặc định." />
        )}
        {items.length > 0 && (
          <ol className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {items.map((item, index) => (
              <li key={item.key} className="min-w-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
                <div className="relative aspect-video bg-stone-100">
                  <PublicTripPhoto src={item.url} alt={item.file?.name ?? `Ảnh chuyến đi ${index + 1}`} />
                  {index === 0 && <span className="absolute left-2 top-2 rounded-md bg-[#125238] px-2 py-1 text-xs font-bold text-white">Ảnh bìa</span>}
                </div>
                {!locked && (
                  <div className="space-y-2 p-2">
                    {item.file && (
                      <p className="break-words text-xs text-[#6B7280]" role="status">
                        {item.uploading ? "Đang tải ảnh…" : item.mediaId ? "Đã tải lên" : item.error ? "Tải ảnh thất bại" : "Chờ tải lên"}
                      </p>
                    )}
                    {item.error && (
                      <ErrorAlert message={item.error} onRetry={busy ? undefined : () => { void gallery.retry(item); }} />
                    )}
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="secondary" disabled={busy || index === 0} aria-label={`Chuyển ảnh ${index + 1} lên`} onClick={() => gallery.move(index, -1)}>↑</Button>
                      <Button size="sm" variant="secondary" disabled={busy || index === items.length - 1} aria-label={`Chuyển ảnh ${index + 1} xuống`} onClick={() => gallery.move(index, 1)}>↓</Button>
                      <Button size="sm" variant="ghost" disabled={busy} aria-label={`Gỡ ảnh ${index + 1}`} onClick={() => gallery.remove(item.key)}>Gỡ</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {children}
      </div>
    </SurfaceCard>
  );
}
