"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { RentalProduct } from "@/features/rentals/types/rental";

export type RentalCartItem = {
  product: RentalProduct;
  quantity: number;
  availableCount: number;
};

const CART_EVENT = "trekgo:rental-cart-change";

function storageKey(tripId: string) {
  return `trekgo:rental-cart:${tripId}`;
}

function readCart(tripId: string): RentalCartItem[] {
  if (!tripId || typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (!raw) return [];

    const parsed = JSON.parse(raw) as RentalCartItem[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item) =>
            item?.product?.id &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0,
        )
      : [];
  } catch {
    return [];
  }
}

function writeCart(tripId: string, items: RentalCartItem[]) {
  if (!tripId || typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(tripId), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { tripId } }));
}

export function useRentalCart(tripId: string) {
  const [items, setItems] = useState<RentalCartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setItems(readCart(tripId));
      setHydrated(true);
    };

    sync();
    const onCartChange = (event: Event) => {
      const changedTripId = (event as CustomEvent<{ tripId?: string }>).detail
        ?.tripId;
      if (!changedTripId || changedTripId === tripId) sync();
    };

    window.addEventListener(CART_EVENT, onCartChange);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, onCartChange);
      window.removeEventListener("storage", sync);
    };
  }, [tripId]);

  const replace = useCallback(
    (next: RentalCartItem[]) => {
      const normalized = next
        .map((item) => ({
          ...item,
          availableCount: Math.max(0, Math.floor(item.availableCount)),
          quantity: Math.min(
            Math.max(0, Math.floor(item.quantity)),
            Math.max(0, Math.floor(item.availableCount)),
          ),
        }))
        .filter((item) => item.quantity > 0);

      setItems(normalized);
      writeCart(tripId, normalized);
    },
    [tripId],
  );

  const setQuantity = useCallback(
    (product: RentalProduct, availableCount: number, quantity: number) => {
      const next = items.filter((item) => item.product.id !== product.id);
      const safeQuantity = Math.min(
        Math.max(0, Math.floor(quantity)),
        Math.max(0, Math.floor(availableCount)),
      );

      if (safeQuantity > 0) {
        next.push({ product, quantity: safeQuantity, availableCount });
      }
      replace(next);
    },
    [items, replace],
  );

  const clear = useCallback(() => replace([]), [replace]);
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  const dailyTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.product.dailyPrice * item.quantity,
        0,
      ),
    [items],
  );

  return {
    items,
    hydrated,
    totalQuantity,
    dailyTotal,
    setQuantity,
    clear,
  };
}
