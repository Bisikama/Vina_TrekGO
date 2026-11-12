"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type { PublicTripImage } from "../types/public-trip-images";
import { PublicTripPhoto } from "./PublicTripPhoto";

export function PublicTripCarousel({ images, fallback, title, maxHeight = "min(70svh, 42rem)", priority = false }: {
  images: PublicTripImage[];
  fallback: string;
  title: string;
  maxHeight?: string;
  priority?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [loadedSize, setLoadedSize] = useState<{ src: string; ratio: number }>();
  const index = Math.min(selected, Math.max(images.length - 1, 0));
  const active = images[index];
  const src = active?.url ?? fallback;
  const initialRatio = active && active.width > 0 && active.height > 0 ? active.width / active.height : 16 / 9;
  const aspectRatio = loadedSize?.src === src ? loadedSize.ratio : initialRatio;
  const photoWidth = `calc(${maxHeight} * ${aspectRatio})`;
  const multiple = images.length > 1;
  const nextUrl = multiple ? images[(index + 1) % images.length].url : undefined;

  useEffect(() => {
    if (!nextUrl) return;
    const nextImage = new window.Image();
    nextImage.fetchPriority = "low";
    nextImage.src = nextUrl;
  }, [nextUrl]);

  function move(offset: number) {
    setSelected((index + offset + images.length) % images.length);
  }

  return (
    <section
      aria-label={`Bộ ảnh chuyến đi ${title}`}
      aria-roledescription={multiple ? "bộ ảnh" : undefined}
      tabIndex={multiple ? 0 : undefined}
      className="min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F6B4F]"
      onKeyDown={(event) => {
        if (!multiple || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }}
    >
      <div
        className="relative mx-auto flex min-h-10 w-full items-center justify-center"
        style={{ maxWidth: multiple ? `calc(${photoWidth} + 5rem)` : photoWidth }}
      >
        <div className="relative w-full overflow-hidden rounded-xl bg-stone-100 shadow-sm" style={{ aspectRatio, maxWidth: photoWidth }}>
          <PublicTripPhoto
            key={src}
            src={src}
            alt={active ? `${title} · Ảnh ${index + 1}` : title}
            fit="contain"
            eager={priority || index > 0}
            priority={priority && index === 0}
            onDimensions={(width, height) => {
              if (width > 0 && height > 0 && width / height !== aspectRatio) {
                setLoadedSize({ src, ratio: width / height });
              }
            }}
          />
        </div>
        {multiple && (
          <div className="pointer-events-none absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between">
            <Button size="sm" variant="secondary" className="pointer-events-auto shadow-sm" aria-label="Ảnh trước" onClick={() => move(-1)}>‹</Button>
            <Button size="sm" variant="secondary" className="pointer-events-auto shadow-sm" aria-label="Ảnh tiếp theo" onClick={() => move(1)}>›</Button>
          </div>
        )}
      </div>
      {multiple && (
        <div className="mt-2 flex flex-wrap justify-center" aria-label="Chọn ảnh">
          {images.map((image, position) => (
            <Button
              key={image.mediaId}
              size="sm"
              variant="ghost"
              className="h-7 w-7 px-0"
              aria-label={`Xem ảnh ${position + 1}`}
              aria-current={position === index ? "true" : undefined}
              onClick={() => setSelected(position)}
            >
              <span className={`block h-2 w-2 rounded-full ${position === index ? "bg-[#2F6B4F]" : "bg-[#2F6B4F]/30"}`} />
            </Button>
          ))}
          <span className="sr-only" aria-live="polite">Ảnh {index + 1} trên {images.length}</span>
        </div>
      )}
    </section>
  );
}
