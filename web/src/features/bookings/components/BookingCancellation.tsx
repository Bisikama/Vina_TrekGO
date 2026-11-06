"use client";
import Link from "next/link";
import axios from 'axios';
import { useSWRConfig } from 'swr';
import { useRef, useState } from "react";
import { useAuth } from '@/features/auth';
import {
  Button,
  SurfaceCard,
  ErrorAlert,
  Textarea,
  FormField,
  InfoBanner,
} from "@/components/ui";
import {
  bookingApiService,
  getBookingErrorMessage,
  formatMoneyVND,
  type CancellationPreview,
} from "../services/booking.api";
import type { CancelBookingResponse } from '../types/booking.types';
import { BookingCancellationResult } from './BookingCancellationResult';

export function BookingCancellation({
  bookingId,
  onCancelled,
  onRefresh,
}: {
  bookingId: string;
  onCancelled: (result: CancelBookingResponse) => void;
  onRefresh?: () => void;
}) {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<CancelBookingResponse | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const key = useRef<string | null>(null);
  const submittedReason = useRef<string | null>(null);
  const pending = useRef(false);
  async function check() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      setPreview(await bookingApiService.cancellationPreview(bookingId));
    } catch (e) {
      setError(getBookingErrorMessage(e).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function cancel() {
    if (pending.current || !reason.trim()) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      key.current ??= crypto.randomUUID();
      submittedReason.current ??= reason.trim();
      const value = await bookingApiService.cancelBooking(
        bookingId,
        submittedReason.current,
        key.current,
      );
      setResult(value);
      setUncertain(false);
      setPreview(null);
      void mutate((cacheKey) => Array.isArray(cacheKey) && (cacheKey[0] === 'my-bookings' || (cacheKey[0] === 'booking-transactions' && cacheKey[1] === user?.id)));
      onCancelled(value);
    } catch (e) {
      setError(getBookingErrorMessage(e).message);
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      if (status && status >= 400 && status < 500) {
        onRefresh?.();
        setPreview(null);
        setUncertain(false);
        key.current = null;
        submittedReason.current = null;
        if ([400, 409, 422].includes(status)) {
          try { setPreview(await bookingApiService.cancellationPreview(bookingId)); } catch { /* A fresh preview is required before starting another cancellation. */ }
        }
      } else setUncertain(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <SurfaceCard className="w-full space-y-3">
      {result !== null ? (
        <BookingCancellationResult result={result} />
      ) : (
        <>
          <Button
            variant="danger"
            size="sm"
            loading={busy}
            disabled={uncertain}
            onClick={() => void check()}
          >
            {preview ? "Kiểm tra lại đơn thuê và tiền hoàn" : "Hủy đặt chỗ"}
          </Button>
          {uncertain && <InfoBanner tone="warning">Chưa nhận được kết quả hủy. Giữ nguyên lý do để thử lại cùng yêu cầu.
            <Button className="mt-2" size="sm" variant="outline" loading={busy} onClick={() => void cancel()}>Thử lại cùng yêu cầu hủy</Button>
          </InfoBanner>}
          {preview && (
            <>
              {preview.tripCancellationPending && (
                <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">
                  Chuyến đang chờ duyệt hủy. Nếu bạn tự hủy lúc này, số tiền
                  hoàn được tính theo chính sách hiện hành. Nếu chuyến được
                  duyệt hủy sau đó, đơn đã tự hủy sẽ không được hoàn bổ sung.
                </p>
              )}
              {!preview.canCancel ? (
                <>
                  <p className="text-sm">
                    Vui lòng xử lý các đơn thuê dưới đây trước, sau đó quay lại
                    kiểm tra để hủy đặt chỗ. Không cần chờ tiền hoàn về tài
                    khoản.
                  </p>
                  {preview.rentals.map((r, i) => (
                    <div key={r.orderId ?? i} className="text-sm">
                      {r.ownedByViewer && r.orderId ? (
                        <Link
                          className="underline"
                          href={`/rentals/orders/${r.orderId}?returnBookingId=${encodeURIComponent(bookingId)}`}
                        >
                          Xử lý đơn thuê #{r.orderId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span>
                          Đơn thuê của người tham gia khác: vui lòng nhờ chủ đơn
                          xử lý.
                        </span>
                      )}
                      <span>
                        {" "}
                        · {r.status}. Đã nhận thiết bị hoặc đang thu hồi hàng:
                        cần hỗ trợ trả đồ.
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <p>
                    Tiền vé dự kiến được hoàn:{" "}
                    <strong>{formatMoneyVND(preview.refundableAmount)}</strong>.
                    Số tiền được tính lại khi xác nhận hủy theo chính sách tại
                    thời điểm đó.
                  </p>
                  <p className="text-sm">
                    Hủy toàn bộ đặt chỗ sẽ hủy vé của tất cả người tham gia
                    trong đơn.
                  </p>
                  <FormField label="Lý do hủy">
                    <Textarea
                      maxLength={500}
                      value={reason}
                      disabled={busy || uncertain}
                      onChange={(e) => {
                        setReason(e.target.value);
                        key.current = null;
                        submittedReason.current = null;
                      }}
                    />
                  </FormField>
                  <Button
                    variant="danger"
                    loading={busy}
                    disabled={!reason.trim() || uncertain}
                    onClick={() => void cancel()}
                  >
                    Xác nhận hủy toàn bộ đặt chỗ
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                disabled={busy || uncertain}
                onClick={() => setPreview(null)}
              >
                Đóng
              </Button>
            </>
          )}
        </>
      )}
      {error && <ErrorAlert message={error} />}
    </SurfaceCard>
  );
}
