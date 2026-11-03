"use client";
import Link from "next/link";
import axios from "axios";
import { useRef, useState } from "react";
import {
  Button,
  SurfaceCard,
  ErrorAlert,
  FormField,
  Textarea,
} from "@/components/ui";
import {
  getMyRentalOrder,
  previewRentalCancellation,
  cancelRentalOrder,
  type RentalCancellationPreview,
} from "../services/user-rental.api";
import { getRentalApiErrorMessage } from "../services/rental.api";
import { money } from "./RentalSectionNav";

export function RentalCancellation({
  orderId,
  status,
  onCancelled,
}: {
  orderId: string;
  status: string;
  onCancelled: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<RentalCancellationPreview | null>(
    null,
  );
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const pending = useRef(false);
  const [returnId] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("returnBookingId"),
  );
  const returnBookingId =
    returnId && /^[0-9a-f-]{36}$/i.test(returnId) ? returnId : null;
  async function run(confirm: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (confirm && preview) {
        await cancelRentalOrder(orderId, {
          reason: reason.trim(),
          previewVersion: preview.previewVersion,
          expectedVersion: version,
        });
        setDone(true);
        setPreview(null);
        await onCancelled();
      } else {
        const detail = await getMyRentalOrder(orderId);
        setVersion(detail.order.version);
        setPreview(await previewRentalCancellation(orderId));
      }
    } catch (e) {
      setPreview(null);
      const code = axios.isAxiosError(e)
        ? e.response?.data?.error?.code
        : undefined;
      const messages: Record<string, string> = {
        CANCELLATION_REQUIRES_CUSTODY_RETURN:
          "Hàng đã chuyển cho giao nhận. Vui lòng liên hệ hỗ trợ thu hồi hàng về kho trước khi hủy đơn.",
        EXTENSION_CANCELLATION_REVIEW_REQUIRED:
          "Đơn đã có gia hạn được áp dụng. Vui lòng liên hệ hỗ trợ đối soát và xử lý hủy.",
        VERSION_CONFLICT:
          "Thông tin đơn hoặc tiền hoàn đã thay đổi. Vui lòng xem lại tiền hoàn trước khi xác nhận.",
      };
      setError(
        messages[code] ??
          getRentalApiErrorMessage(
            e,
            "Không thể hủy đơn. Vui lòng kiểm tra lại hoặc liên hệ hỗ trợ.",
          ),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <SurfaceCard className="mt-6 space-y-3">
      {done || status === "CANCELLED" ? (
        <p role="status">
          Đơn thuê đã hủy. Hoàn tiền được xử lý riêng; bạn có thể quay lại hủy
          đặt chỗ.
        </p>
      ) : [
          "PENDING_PAYMENT",
          "PAID",
          "PREPARING",
          "READY_FOR_HANDOVER",
        ].includes(status) ? (
        <>
          <Button
            variant="danger"
            loading={busy}
            onClick={() => void run(false)}
          >
            Xem tiền hoàn và hủy đơn thuê
          </Button>
          {preview?.tripCancellationPending && (
            <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">
              Chuyến đang chờ duyệt hủy. Nếu tự hủy đơn thuê lúc này, bạn nhận
              tiền hoàn theo chính sách hiện hành và không được hoàn bổ sung khi
              chuyến được duyệt hủy sau đó.
            </p>
          )}
          {preview &&
            (preview.canCancel ? (
              <>
                <p>
                  Phí thuê được hoàn: {money(preview.feeRefund, "VND")}. Cọc
                  được hoàn: {money(preview.depositRefund, "VND")}.
                </p>
                <p>
                  Tiền hoàn phụ thuộc chính sách và thời điểm xác nhận. Hủy đơn
                  thuê vẫn giữ nguyên đặt chỗ chuyến đi.
                </p>
                <FormField label="Lý do hủy">
                  <Textarea
                    maxLength={500}
                    disabled={busy}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </FormField>
                <Button
                  variant="danger"
                  disabled={!reason.trim()}
                  loading={busy}
                  onClick={() => void run(true)}
                >
                  Xác nhận hủy đơn thuê
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setPreview(null)}
                >
                  Đóng
                </Button>
              </>
            ) : (
              <p>
                Đơn không thể tự hủy. Vui lòng liên hệ hỗ trợ để thu hồi hoặc
                trả thiết bị.
              </p>
            ))}
        </>
      ) : (
        !["COMPLETED", "EXPIRED"].includes(status) && (
          <p>
            Vui lòng liên hệ hỗ trợ để trả thiết bị và hoàn tất xử lý đơn trước
            khi hủy đặt chỗ.
          </p>
        )
      )}
      {error && <ErrorAlert message={error} />}
      {returnBookingId && (
        <Link className="block underline" href={`/bookings/${returnBookingId}`}>
          Quay lại kiểm tra và hủy đặt chỗ
        </Link>
      )}
    </SurfaceCard>
  );
}
