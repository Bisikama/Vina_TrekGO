"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button, ErrorAlert, FormField, InfoBanner, Modal, Textarea } from "@/components/ui";
import { cancelLeaderTripRequest, getLeaderPublicTripDetail, getLeaderTripErrorMessage } from "../../services/leader-public-trips.api";
import type { LeaderTripView } from "../../types/leader-trips";

function canRequestCancellation(trip: LeaderTripView) {
  return trip.tripType === "PUBLIC" && !trip.startedAt && !trip.completedAt
    && ["DRAFT", "OPEN", "FULL", "CLOSED"].includes(trip.status);
}

export function LeaderTripCancellation({ trip, onRequested, disabled = false, size = "sm" }: {
  trip: LeaderTripView;
  onRequested?: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const formId = useId();
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submittedTrip, setSubmittedTrip] = useState<{ id: string; version: number } | null>(null);
  const requested = trip.status === "CANCEL_PENDING" || (submittedTrip?.id === trip.id && submittedTrip.version === trip.version);

  function close() {
    if (!pending.current) setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !reason.trim() || disabled) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const latest = await getLeaderPublicTripDetail(trip.id);
      if (latest.status !== "CANCEL_PENDING") {
        if (!canRequestCancellation(latest)) {
          setError("Trạng thái chuyến đã thay đổi, không thể gửi yêu cầu hủy. Hãy tải lại trang để kiểm tra.");
          return;
        }
        await cancelLeaderTripRequest(trip.id, {
          expectedVersion: latest.version,
          reason: reason.trim(),
          evidenceUrls: [],
        });
      }
      setSubmittedTrip({ id: trip.id, version: trip.version });
      setOpen(false);
      onRequested?.();
    } catch (cause) {
      setError(getLeaderTripErrorMessage(cause, "Không thể gửi yêu cầu hủy chuyến. Bạn có thể thử lại."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (requested) return <Link href="/leader/trip-cancellation-requests" className={`inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 font-semibold text-amber-800 ${size === "sm" ? "h-9 text-xs" : "h-11 text-sm"}`}>Chờ Admin duyệt hủy</Link>;
  if (!canRequestCancellation(trip)) return null;

  return <>
    <Button variant="danger" size={size} disabled={disabled} onClick={() => { setError(""); setOpen(true); }}>Yêu cầu hủy chuyến</Button>
    <Modal isOpen={open} onClose={close} title="Gửi yêu cầu hủy cả chuyến" subtitle={trip.title} maxWidth="md" footer={<>
      <Button variant="secondary" disabled={busy} onClick={close}>Quay lại</Button>
      <Button variant="danger" type="submit" form={formId} loading={busy} disabled={disabled || !reason.trim()}>Gửi yêu cầu hủy</Button>
    </>}>
      <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-4">
        <InfoBanner tone="warning">Yêu cầu cần Admin xét duyệt. Khi được duyệt, hệ thống hủy các booking còn hiệu lực và xử lý khoản hoàn liên quan.</InfoBanner>
        <FormField label="Lý do hủy chuyến" required>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={2000} rows={4} disabled={busy} placeholder="Nhập lý do cần hủy cả chuyến đi..." />
        </FormField>
        {error && <ErrorAlert message={error} />}
      </form>
    </Modal>
  </>;
}
