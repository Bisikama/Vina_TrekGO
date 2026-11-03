"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  Button,
  SurfaceCard,
  ErrorAlert,
  Textarea,
  FormField,
} from "@/components/ui";
import {
  bookingApiService,
  getBookingErrorMessage,
  formatMoneyVND,
  type CancellationPreview,
} from "../services/booking.api";

export function BookingCancellation({
  bookingId,
  onCancelled,
}: {
  bookingId: string;
  onCancelled: () => void;
}) {
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const key = useRef<string | null>(null);
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
      const value = await bookingApiService.cancelBooking(
        bookingId,
        reason.trim(),
        key.current,
      );
      setResult(value.refundableAmount);
      setPreview(null);
      onCancelled();
    } catch (e) {
      setError(getBookingErrorMessage(e).message);
      // Require a fresh preview after a conflict; keep the key for ambiguous network outcomes.
      setPreview(null);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <SurfaceCard className="w-full space-y-3">
      {result !== null ? (
        <p role="status">
          Đã hủy đặt chỗ. Khoản hoàn {formatMoneyVND(result)} được xử lý riêng
          qua cổng thanh toán.
        </p>
      ) : (
        <>
          <Button
            variant="danger"
            size="sm"
            loading={busy}
            onClick={() => void check()}
          >
            {preview ? "Kiểm tra lại đơn thuê và tiền hoàn" : "Hủy đặt chỗ"}
          </Button>
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
                      disabled={busy}
                      onChange={(e) => {
                        setReason(e.target.value);
                        key.current = null;
                      }}
                    />
                  </FormField>
                  <Button
                    variant="danger"
                    loading={busy}
                    disabled={!reason.trim()}
                    onClick={() => void cancel()}
                  >
                    Xác nhận hủy toàn bộ đặt chỗ
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                disabled={busy}
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
