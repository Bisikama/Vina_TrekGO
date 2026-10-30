"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/axios";
import {
  PageShell,
  PageHeader,
  SurfaceCard,
  Button,
  ErrorAlert,
  LoadingState,
  EmptyState,
  Textarea,
  FormField,
  ConfirmModal,
  PaginationBar,
  Select,
} from "@/components/ui";
import { getBookingErrorMessage } from "@/features/bookings/services/booking.api";
type Request = {
  id: string;
  tripId: string;
  reason: string;
  status: string;
  version: number;
  requestedAt: string;
  reviewNote: string | null;
  evidenceUrls?: string[];
  trip: { title: string; status: string; version: number; startAt: string };
};
type Detail = Request & {
  executionStatus: string;
  remainingBookings: number;
  actionRequiredRentals: number;
  workerEnabled: boolean;
  refunds: {
    status: string;
    _count: { _all: number };
    _sum: { amount: string | null };
  }[];
  deliveries: {
    eventId: string;
    eventType: string;
    consumer: string | null;
    status: string | null;
    attempts: number | null;
    lastError: string | null;
  }[];
};
const labels: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
  PENDING_REVIEW: "Chờ duyệt",
  PROCESSING: "Đã duyệt, đang xử lý",
  COMPLETED: "Đã xử lý",
  ACTION_REQUIRED: "Cần hỗ trợ",
  FAILED: "Thất bại",
  RUNNING: "Đang xử lý",
  SUCCEEDED: "Hoàn thành",
};
export function TripCancellationRequests({
  admin = false,
}: {
  admin?: boolean;
}) {
  const base = `/api/v1/${admin ? "admin" : "leader"}/trip-cancellation-requests`;
  const [items, setItems] = useState<Request[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [decision, setDecision] = useState<"approve" | "reject" | null>(null),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [status, setStatus] = useState("");
  const pending = useRef(false),
    reviewKey = useRef<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(base, {
        params: { page, pageSize: 20, ...(status ? { status } : {}) },
      });
      setItems(data.items);
      setTotal(data.total);
      setError("");
    } catch (e) {
      setError(getBookingErrorMessage(e).message);
    } finally {
      setLoading(false);
    }
  }, [base, page, status]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function open(id: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      setDetail((await apiClient.get<Detail>(`${base}/${id}`)).data);
      setNote("");
      reviewKey.current = null;
      setError("");
    } catch (e) {
      setError(getBookingErrorMessage(e).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function review() {
    if (!detail || !decision || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      reviewKey.current ??= crypto.randomUUID();
      await apiClient.post(
        `${base}/${detail.id}/${decision}`,
        {
          expectedTripVersion: detail.trip.version,
          expectedRequestVersion: detail.version,
          note,
        },
        { headers: { "Idempotency-Key": reviewKey.current } },
      );
      setDecision(null);
      setDetail((await apiClient.get<Detail>(`${base}/${detail.id}`)).data);
      reviewKey.current = null;
      await load();
    } catch (e) {
      setError(getBookingErrorMessage(e).message);
      setDecision(null);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function retry(eventId: string, consumer: string) {
    if (pending.current || !note.trim()) return;
    pending.current = true;
    setBusy(true);
    try {
      await apiClient.post(`${base}/deliveries/${eventId}/retry`, {
        consumer,
        note,
      });
      if (detail)
        setDetail((await apiClient.get<Detail>(`${base}/${detail.id}`)).data);
    } catch (e) {
      setError(getBookingErrorMessage(e).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <PageShell maxWidth="xl">
      <PageHeader
        title={
          admin ? "Duyệt yêu cầu hủy chuyến" : "Tiến độ yêu cầu hủy chuyến"
        }
        subtitle="Đơn khách đã tự hủy giữ nguyên kết quả hoàn tiền. Chỉ đơn còn hiệu lực được xử lý khi duyệt hủy."
        actions={
          <Button disabled={busy} onClick={() => void load()}>
            Cập nhật danh sách
          </Button>
        }
      />
      <Select
        aria-label="Trạng thái yêu cầu"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
      >
        <option value="">Tất cả</option>
        <option value="PENDING">Chờ duyệt</option>
        <option value="APPROVED">Đã duyệt</option>
        <option value="REJECTED">Bị từ chối</option>
      </Select>
      {error && <ErrorAlert message={error} />}
      {loading ? (
        <LoadingState message="Đang tải yêu cầu..." />
      ) : !items.length ? (
        <EmptyState title="Chưa có yêu cầu hủy chuyến" />
      ) : (
        items.map((item) => (
          <SurfaceCard key={item.id} className="mt-3">
            <h2 className="font-bold">{item.trip.title}</h2>
            <p>
              {labels[item.status]} ·{" "}
              {new Date(item.requestedAt).toLocaleString("vi-VN")}
            </p>
            <p>{item.reason}</p>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void open(item.id)}
            >
              Xem chi tiết và tiến độ
            </Button>
          </SurfaceCard>
        ))
      )}
      <PaginationBar
        page={page}
        pageSize={20}
        total={total}
        onPageChange={setPage}
      />
      {detail && (
        <SurfaceCard className="mt-5 space-y-3">
          <h2 className="text-lg font-bold">{detail.trip.title}</h2>
          <p>
            Trạng thái:{" "}
            {labels[detail.executionStatus] ?? detail.executionStatus}
          </p>
          <p>Lý do yêu cầu: {detail.reason}</p>
          {detail.reviewNote && <p>Ghi chú duyệt: {detail.reviewNote}</p>}
          {!detail.workerEnabled && (
            <p role="status">
              Worker hủy chuyến chưa được bật. Chức năng duyệt đang tạm ngừng.
            </p>
          )}
          {detail.status === "APPROVED" && (
            <>
              <p>
                Booking còn chờ xử lý: {detail.remainingBookings}. Đơn thuê cần
                vận hành xử lý: {detail.actionRequiredRentals}.
              </p>
              <h3 className="font-bold">Hoàn tiền liên quan</h3>
              {detail.refunds.length ? (
                detail.refunds.map((r) => (
                  <p key={r.status}>
                    {(
                      {
                        PENDING: "Chờ hoàn tiền",
                        PROCESSING: "Đang hoàn tiền",
                        SUCCEEDED: "Đã hoàn tiền",
                        FAILED: "Hoàn tiền thất bại",
                      } as Record<string, string>
                    )[r.status] ?? r.status}
                    : {r._count._all} khoản ·{" "}
                    {Number(r._sum.amount ?? 0).toLocaleString("vi-VN")} ₫
                  </p>
                ))
              ) : (
                <p>Chưa có yêu cầu hoàn tiền được ghi nhận.</p>
              )}
              <p>Đã xử lý hủy đơn không đồng nghĩa tiền đã về tài khoản.</p>
            </>
          )}
          {admin && (
            <FormField label="Ghi chú / lý do từ chối / lý do thử lại">
              <Textarea
                maxLength={500}
                value={note}
                disabled={busy}
                onChange={(e) => {
                  setNote(e.target.value);
                  reviewKey.current = null;
                }}
              />
            </FormField>
          )}
          {admin && detail.status === "PENDING" && (
            <div className="flex gap-2">
              <Button
                disabled={busy || !detail.workerEnabled}
                onClick={() => {
                  reviewKey.current = null;
                  setDecision("approve");
                }}
              >
                Duyệt hủy chuyến
              </Button>
              <Button
                variant="danger"
                disabled={busy || !note.trim() || !detail.workerEnabled}
                onClick={() => {
                  reviewKey.current = null;
                  setDecision("reject");
                }}
              >
                Từ chối
              </Button>
            </div>
          )}
          {admin &&
            detail.deliveries.map((d, i) => (
              <div
                key={`${d.eventId}-${d.consumer ?? i}`}
                className="border-t pt-2 text-sm"
              >
                <p>
                  {d.eventType} · {d.consumer ?? "Chờ tiếp nhận"} ·{" "}
                  {labels[d.status ?? ""] ?? d.status ?? "Chờ xử lý"} · Lần thử:{" "}
                  {d.attempts ?? 0}
                </p>
                {d.lastError && <p>{d.lastError}</p>}
                {admin && d.status === "FAILED" && d.consumer && (
                  <Button
                    size="sm"
                    disabled={busy || !note.trim()}
                    onClick={() => void retry(d.eventId, d.consumer!)}
                  >
                    Thử lại sau khi kiểm tra
                  </Button>
                )}
              </div>
            ))}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void open(detail.id)}
          >
            Cập nhật tiến độ
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setDetail(null)}
          >
            Đóng chi tiết
          </Button>
        </SurfaceCard>
      )}
      <ConfirmModal
        isOpen={Boolean(decision)}
        title={
          decision === "approve" ? "Duyệt hủy chuyến?" : "Từ chối yêu cầu hủy?"
        }
        description={
          decision === "approve"
            ? "Hệ thống sẽ hủy các đơn còn hiệu lực. Đơn đã tự hủy giữ nguyên mức hoàn tiền trước đó."
            : "Chuyến được khôi phục theo thời gian và số chỗ hiện tại. Các đơn khách đã hủy không được khôi phục."
        }
        loading={busy}
        onClose={() => {
          if (!busy) setDecision(null);
        }}
        onConfirm={() => void review()}
      />
    </PageShell>
  );
}
