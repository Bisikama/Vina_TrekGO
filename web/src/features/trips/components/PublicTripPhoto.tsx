"use client";

import Image from "next/image";
import { useState } from "react";

export function PublicTripPhoto({ src, alt, eager = false, priority = false, className = "", fit = "cover", onDimensions }: {
  src: string;
  alt: string;
  eager?: boolean;
  priority?: boolean;
  className?: string;
  fit?: "cover" | "contain";
  onDimensions?: (width: number, height: number) => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();

  if (failedSrc === src) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-stone-100 px-3 text-center text-xs text-stone-600" role="img" aria-label={`${alt} · Ảnh không hiển thị`}>
        Ảnh không hiển thị
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      className={`${fit === "contain" ? "object-contain" : "object-cover"} ${className}`}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      onLoad={onDimensions ? ({ currentTarget }) => onDimensions(currentTarget.naturalWidth, currentTarget.naturalHeight) : undefined}
      onError={() => setFailedSrc(src)}
    />
  );
}
