/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getRentalProductDetail } from "@/features/rentals/services/rental.api";
import type { RentalProductDetailData } from "@/features/rentals/types/rental";

type RentalProductDetailPageProps = {
  productId: string;
  bookingId: string;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: currency || "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatSpecValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Có" : "Không";
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Không thể tải thông tin sản phẩm.";
}

export function RentalProductDetailPage({
  productId,
  bookingId,
}: RentalProductDetailPageProps) {
  const [data, setData] =
    useState<RentalProductDetailData | null>(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await getRentalProductDetail(
          productId,
          bookingId,
          controller.signal,
        );

        setData(result);
        setSelectedImage(result.product.imageUrls[0] ?? "");
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [bookingId, productId]);

  const specificationEntries = useMemo(
    () => Object.entries(data?.product.spec ?? {}),
    [data],
  );

  if (loading) {
    return (
      <div className="min-h-[650px] bg-[#F7F7F4] px-4 py-12">
        <div className="mx-auto grid max-w-7xl animate-pulse gap-8 lg:grid-cols-2">
          <div className="h-[480px] rounded-3xl bg-gray-200" />
          <div className="h-[480px] rounded-3xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[650px] bg-[#F7F7F4] px-4 py-20">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-gray-900">
            Không thể mở sản phẩm
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            {error}
          </p>

          <Link
            href={`/rentals?bookingId=${encodeURIComponent(
              bookingId,
            )}`}
            className="mt-6 inline-flex rounded-xl bg-[#1B5E41] px-5 py-3 text-sm font-bold text-white"
          >
            Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  const {
    product,
    availability,
    recommendation,
    tripSummary,
  } = data;

  const available = availability.availableCount > 0;

  return (
    <div className="min-h-screen bg-[#F7F7F4]">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
          <Link href="/" className="hover:text-[#1B5E41]">
            Trang chủ
          </Link>

          <span>/</span>

          <Link
            href={`/rentals?bookingId=${encodeURIComponent(
              bookingId,
            )}`}
            className="hover:text-[#1B5E41]"
          >
            Thuê thiết bị
          </Link>

          <span>/</span>

          <span className="text-gray-900">
            {product.name}
          </span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <section>
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="h-full w-full object-contain p-8"
                />
              ) : (
                <span className="text-sm font-semibold text-gray-400">
                  Chưa có ảnh thiết bị
                </span>
              )}
            </div>

            {product.imageUrls.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {product.imageUrls.map((imageUrl, index) => (
                  <button
                    key={`${imageUrl}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(imageUrl)}
                    className={`h-20 w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${
                      selectedImage === imageUrl
                        ? "border-[#1B5E41]"
                        : "border-transparent"
                    }`}
                  >
                    <img
                      src={imageUrl}
                      alt={`${product.name} ${index + 1}`}
                      className="h-full w-full object-contain p-2"
                    />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                {product.category.name}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  available
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {available
                  ? `Còn ${availability.availableCount} sản phẩm`
                  : "Tạm hết hàng"}
              </span>
            </div>

            <h1 className="mt-5 text-3xl font-black text-gray-950">
              {product.name}
            </h1>

            {product.sku && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                SKU: {product.sku}
              </p>
            )}

            <p className="mt-5 text-sm leading-7 text-gray-600">
              {product.description}
            </p>

            {recommendation && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
                  <span>✦</span>
                  Được đề xuất cho chuyến đi
                </div>

                <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-800">
                  {recommendation.reasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-7 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[#F7F7F4] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Giá thuê mỗi ngày
                </p>

                <p className="mt-2 text-2xl font-black text-[#1B5E41]">
                  {formatMoney(
                    product.dailyPrice,
                    product.currency,
                  )}
                </p>
              </div>

              <div className="rounded-2xl bg-[#F7F7F4] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Tiền đặt cọc
                </p>

                <p className="mt-2 text-xl font-black text-gray-900">
                  {formatMoney(
                    product.depositPolicy.amount,
                    product.currency,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 p-4">
              <p className="text-sm font-extrabold text-gray-900">
                Áp dụng cho chuyến đi
              </p>

              <p className="mt-2 text-sm font-bold text-[#1B5E41]">
                {tripSummary.name}
              </p>

              <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                <p>
                  Thời lượng:{" "}
                  <strong>
                    {tripSummary.durationDays} ngày
                  </strong>
                </p>

                <p>
                  Độ khó:{" "}
                  <strong>{tripSummary.difficulty}</strong>
                </p>

                {tripSummary.weatherSummary && (
                  <p className="sm:col-span-2">
                    Thời tiết:{" "}
                    <strong>
                      {tripSummary.weatherSummary}
                    </strong>
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={!available}
              className={`mt-6 w-full rounded-xl px-6 py-4 text-sm font-extrabold transition ${
                available
                  ? "bg-[#1B5E41] text-white hover:bg-[#154B36]"
                  : "cursor-not-allowed bg-gray-200 text-gray-500"
              }`}
            >
              {available
                ? "Chọn thiết bị này"
                : "Thiết bị đang tạm hết"}
            </button>

            <p className="mt-3 text-center text-[11px] leading-5 text-gray-500">
              Việc chọn thiết bị chưa tạo thanh toán. Chi phí
              được xác nhận ở bước hoàn tất đơn thuê.
            </p>
          </section>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-gray-900">
              Thông số thiết bị
            </h2>

            {specificationEntries.length > 0 ? (
              <dl className="mt-5 divide-y divide-gray-100">
                {specificationEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="grid grid-cols-2 gap-4 py-3 text-sm"
                  >
                    <dt className="font-semibold capitalize text-gray-500">
                      {key.replaceAll("_", " ")}
                    </dt>

                    <dd className="text-right font-bold text-gray-900">
                      {formatSpecValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                Chưa có thông số chi tiết.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-gray-900">
              Thời gian giữ thiết bị
            </h2>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl bg-[#F7F7F4] p-4">
                <p className="text-xs font-bold text-gray-500">
                  Bắt đầu
                </p>

                <p className="mt-1 text-sm font-extrabold text-gray-900">
                  {formatDate(
                    availability.rentalWindow.occupiedFrom,
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-[#F7F7F4] p-4">
                <p className="text-xs font-bold text-gray-500">
                  Kết thúc
                </p>

                <p className="mt-1 text-sm font-extrabold text-gray-900">
                  {formatDate(
                    availability.rentalWindow.occupiedUntil,
                  )}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}