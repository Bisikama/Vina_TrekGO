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
  StatusBadge,
  InfoBanner,
  SurfaceSectionHeader,
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

const iconPaths = {
  calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 10 6 6m0-6-6 6",
  clock: "M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  check: "m8 12 3 3 5-6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  close: "m6 6 12 12M6 18 18 6",
  refresh: "M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  refund: "M3 8h18v12H3V8Zm0 0V5h15v3M16 12h5v4h-5v-4Z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8m-8 4h5",
};
function CancellationIcon({ name, className = "h-5 w-5" }: { name: keyof typeof iconPaths; className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name]} /></svg>;
}
function CancellationStatus({ status }: { status: string }) {
  const tone = ["APPROVED", "COMPLETED", "SUCCEEDED"].includes(status) ? "ACTIVE"
    : ["REJECTED", "FAILED"].includes(status) ? "CANCELLED" : "PENDING";
  return <StatusBadge status={tone} customLabel={labels[status] ?? status} />;
}
function requestDate(value: string, withTime = true) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", ...(withTime ? { timeStyle: "short" as const } : {}) }).format(new Date(value));
}
function CancellationTimeline({ detail }: { detail: Detail }) {
  const reviewed = detail.status !== "PENDING";
  const rejected = detail.status === "REJECTED";
  const completed = detail.status === "APPROVED" && detail.executionStatus === "COMPLETED";
  const steps = [
    { label: "Tiếp nhận", description: requestDate(detail.requestedAt), done: true, current: false, failed: false },
    { label: "Xét duyệt", description: rejected ? "Đã từ chối" : reviewed ? "Đã chấp nhận" : "Chờ Admin", done: reviewed, current: !reviewed, failed: rejected },
    { label: "Xử lý hủy", description: rejected ? "Không thực hiện" : labels[detail.executionStatus] ?? detail.executionStatus, done: completed, current: detail.status === "APPROVED" && !completed, failed: false },
  ];
  return <ol aria-label="Tiến độ yêu cầu" className="grid grid-cols-3 gap-2 rounded-xl bg-[#F5F8F6] p-4">
    {steps.map((step, index) => <li key={step.label} className="min-w-0">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.failed ? "bg-red-100 text-red-700" : step.done ? "bg-[#2F6B4F] text-white" : step.current ? "bg-amber-100 text-amber-800 ring-2 ring-amber-200" : "border border-gray-200 bg-white text-gray-400"}`}>
          {step.done ? <CancellationIcon name={step.failed ? "close" : "check"} className="h-4 w-4" /> : index + 1}
        </span>
        {index < steps.length - 1 && <span aria-hidden="true" className={`h-px flex-1 ${step.done ? "bg-emerald-200" : "bg-gray-200"}`} />}
      </div>
      <p className="text-xs font-bold text-[#1F2937]">{step.label}</p>
      <p className="mt-1 break-words text-[11px] leading-relaxed text-[#6B7280]">{step.description}</p>
    </li>)}
  </ol>;
}

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
  const detailRegion = useRef<HTMLElement>(null);
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
      requestAnimationFrame(() => {
        if (window.matchMedia("(max-width: 1279px)").matches) {
          detailRegion.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
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
    <PageShell maxWidth="2xl" withTopOffset={false}>
      <section className="relative overflow-hidden rounded-2xl bg-[#125238] p-6 shadow-sm sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full border border-white/10 ring-[36px] ring-white/5" />
        <div className="relative">
          <div className="mb-5 flex items-center gap-2 text-xs font-semibold tracking-wide text-emerald-200">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/10"><CancellationIcon name="calendar" className="h-4 w-4" /></span>
            QUẢN LÝ CHUYẾN ĐI
          </div>
          <PageHeader
            className="[&_h1]:text-white [&_p]:text-emerald-100/80"
            title={admin ? "Duyệt yêu cầu hủy chuyến" : "Tiến độ yêu cầu hủy chuyến"}
            subtitle={admin ? "Xem xét từng yêu cầu, theo dõi xử lý và các khoản hoàn trong cùng một nơi." : "Theo dõi phản hồi của Admin và tiến độ xử lý yêu cầu của bạn."}
            actions={<Button variant="secondary" loading={loading} disabled={busy} leftIcon={<CancellationIcon name="refresh" className="h-4 w-4" />} onClick={() => void load()} className="text-[#125238]">Cập nhật danh sách</Button>}
          />
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-4 text-xs text-emerald-100">
            {["Tiếp nhận yêu cầu", "Xét duyệt hủy chuyến", "Theo dõi xử lý & hoàn tiền"].map((step, index) => <span key={step} className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold">{index + 1}</span>{step}</span>)}
          </div>
        </div>
      </section>

      <SurfaceCard padding="sm" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#2F6B4F]"><CancellationIcon name="file" /></span>
          <div><h2 className="font-bold">Danh sách yêu cầu</h2><p className="mt-0.5 text-xs text-[#6B7280]">{loading ? "Đang cập nhật..." : `${total} yêu cầu${status ? ` · ${labels[status]}` : " trong danh sách"}`}</p></div>
        </div>
        <FormField label={<span className="sr-only">Trạng thái yêu cầu</span>}>
          <Select aria-label="Trạng thái yêu cầu" className="min-w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tất cả trạng thái</option><option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Bị từ chối</option>
          </Select>
        </FormField>
      </SurfaceCard>
      {error && <ErrorAlert message={error} />}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
        <section aria-label="Các yêu cầu hủy chuyến" className="min-w-0 space-y-4">
          {loading ? <LoadingState message="Đang tải yêu cầu..." /> : !items.length ? <EmptyState icon={<CancellationIcon name="calendar" />} title="Chưa có yêu cầu hủy chuyến" description="Các yêu cầu phù hợp với bộ lọc sẽ xuất hiện tại đây." /> : items.map((item) => {
            const selected = detail?.id === item.id;
            return <SurfaceCard key={item.id} as="article" interactive padding="none" className={`overflow-hidden ${selected ? "border-[#2F6B4F] ring-2 ring-[#2F6B4F]/10" : ""}`}>
              <div className={`h-1 ${item.status === "PENDING" ? "bg-amber-400" : item.status === "APPROVED" ? "bg-[#2F6B4F]" : "bg-rose-300"}`} />
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><CancellationStatus status={item.status} /><span className="font-mono text-[10px] text-[#6B7280]">#{item.id.slice(0, 8).toUpperCase()}</span></div>
                <div><h3 className="break-words text-lg font-bold text-[#125238]">{item.trip.title}</h3><p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#6B7280]"><CancellationIcon name="clock" className="h-3.5 w-3.5" />Gửi lúc {requestDate(item.requestedAt)}</p></div>
                <p className="line-clamp-2 break-words rounded-lg bg-[#F7F7F4] px-3 py-2.5 text-sm leading-relaxed text-[#4B5563]">{item.reason}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB] pt-3">
                  <span className="text-[11px] text-[#6B7280]">Khởi hành {requestDate(item.trip.startAt, false)}</span>
                  <Button variant={selected ? "primary" : "outline"} size="sm" disabled={busy} rightIcon={<CancellationIcon name="arrow" className="h-3.5 w-3.5" />} onClick={() => void open(item.id)} aria-pressed={selected} aria-controls="cancellation-request-detail">{selected ? "Đang xem" : "Xem chi tiết"}</Button>
                </div>
              </div>
            </SurfaceCard>;
          })}
          <PaginationBar page={page} pageSize={20} total={total} onPageChange={setPage} disabled={loading || busy} itemLabel="yêu cầu" className="flex-wrap" />
        </section>

        <section ref={detailRegion} id="cancellation-request-detail" aria-label="Chi tiết yêu cầu hủy chuyến" className="min-w-0 scroll-mt-24">
          {!detail ? <SurfaceCard className="overflow-hidden" padding="none">
            <div className="border-b border-[#E5E7EB] bg-emerald-50/60 px-6 py-4"><p className="text-sm font-bold text-[#125238]">Chi tiết & tiến độ xử lý</p></div>
            <EmptyState icon={<CancellationIcon name="file" className="h-6 w-6" />} title="Chọn một yêu cầu để xem" description="Thông tin chuyến đi, lý do hủy, kết quả xét duyệt và khoản hoàn sẽ hiển thị tại đây." className="border-0 shadow-none sm:py-20" />
          </SurfaceCard> : <SurfaceCard padding="none" className="overflow-hidden">
            <div className="border-b border-emerald-100 bg-emerald-50/70 p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-3"><span className="text-[11px] font-bold uppercase tracking-widest text-[#2F6B4F]">Chi tiết yêu cầu · #{detail.id.slice(0, 8).toUpperCase()}</span><Button variant="ghost" size="sm" disabled={busy} onClick={() => setDetail(null)} aria-label="Đóng chi tiết" className="h-8 w-8 px-0"><CancellationIcon name="close" className="h-4 w-4" /></Button></div>
              <h2 className="break-words text-xl font-bold text-[#125238]">{detail.trip.title}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3"><CancellationStatus status={detail.status} /><span className="flex items-center gap-1.5 text-xs text-[#6B7280]"><CancellationIcon name="calendar" className="h-3.5 w-3.5" />Khởi hành {requestDate(detail.trip.startAt)}</span></div>
            </div>
            <div className="space-y-6 p-5 sm:p-6">
              <CancellationTimeline detail={detail} />
              <dl className="space-y-4 text-sm"><div><dt className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#6B7280]">Lý do yêu cầu hủy</dt><dd className="whitespace-pre-wrap break-words leading-relaxed">{detail.reason}</dd></div>{detail.reviewNote && <div className="rounded-xl border-l-4 border-[#2F6B4F] bg-[#F5F8F6] p-4"><dt className="mb-1 text-xs font-bold text-[#2F6B4F]">Phản hồi xét duyệt</dt><dd className="whitespace-pre-wrap break-words leading-relaxed">{detail.reviewNote}</dd></div>}</dl>
              {!detail.workerEnabled && <InfoBanner tone="warning" title="Tạm ngừng xét duyệt">Hệ thống xử lý hủy chuyến chưa được bật. Vui lòng kiểm tra cấu hình trước khi duyệt yêu cầu.</InfoBanner>}

              {detail.status === "APPROVED" && <section className="space-y-4">
                <SurfaceSectionHeader title="Xử lý & hoàn tiền" subtitle="Các khoản hoàn vé và thuê thiết bị liên quan đến chuyến." />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F7F4] p-4"><p className="text-2xl font-bold tabular-nums text-[#125238]">{detail.remainingBookings}</p><p className="mt-1 text-xs text-[#6B7280]">Đặt chỗ chờ xử lý</p></div>
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F7F4] p-4"><p className={`text-2xl font-bold tabular-nums ${detail.actionRequiredRentals ? "text-amber-700" : "text-[#125238]"}`}>{detail.actionRequiredRentals}</p><p className="mt-1 text-xs text-[#6B7280]">Đơn thuê cần hỗ trợ</p></div>
                </div>
                {detail.refunds.length ? <div className="grid gap-3 sm:grid-cols-2">{detail.refunds.map((refund) => {
                  const refundLabel = ({ PENDING: "Chờ hoàn tiền", PROCESSING: "Đang hoàn tiền", SUCCEEDED: "Đã ghi nhận hoàn", FAILED: "Hoàn tiền thất bại" } as Record<string, string>)[refund.status] ?? refund.status;
                  return <div key={refund.status} className={`rounded-xl border p-4 ${refund.status === "SUCCEEDED" ? "border-emerald-200 bg-emerald-50/70 text-[#125238]" : refund.status === "FAILED" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    <p className="flex items-center gap-2 text-xs font-semibold"><CancellationIcon name="refund" className="h-4 w-4" />{refundLabel}</p><p className="mt-3 text-xl font-bold tabular-nums">{Number(refund._sum.amount ?? 0).toLocaleString("vi-VN")} <span className="text-sm">₫</span></p><p className="mt-1 text-xs opacity-80">{refund._count._all} khoản hoàn</p>
                  </div>;
                })}</div> : <InfoBanner>Chưa có yêu cầu hoàn tiền được ghi nhận.</InfoBanner>}
                <p className="text-xs leading-relaxed text-[#6B7280]">Xem chi tiết đặt chỗ để theo dõi riêng khoản hoàn tiền vé. Trạng thái hủy đơn và trạng thái hoàn tiền được cập nhật riêng.</p>
              </section>}

              {admin && (detail.status === "PENDING" || detail.deliveries.some((delivery) => delivery.status === "FAILED")) && <FormField label={detail.status === "PENDING" ? "Ghi chú xét duyệt" : "Lý do xử lý lại"} hint={detail.status === "PENDING" ? "Bắt buộc nhập lý do khi từ chối yêu cầu." : "Nhập lý do trước khi thử xử lý lại tác vụ thất bại."}>
                <Textarea maxLength={500} rows={3} placeholder="Nhập nội dung để Leader và đội vận hành theo dõi..." value={note} disabled={busy} onChange={(e) => { setNote(e.target.value); reviewKey.current = null; }} />
              </FormField>}
              {admin && detail.status === "PENDING" && <div className="flex flex-wrap gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <Button disabled={busy || !detail.workerEnabled} leftIcon={<CancellationIcon name="check" className="h-4 w-4" />} onClick={() => { reviewKey.current = null; setDecision("approve"); }}>Duyệt hủy chuyến</Button>
                <Button variant="danger" disabled={busy || !note.trim() || !detail.workerEnabled} onClick={() => { reviewKey.current = null; setDecision("reject"); }}>Từ chối yêu cầu</Button>
              </div>}

              {admin && detail.deliveries.length > 0 && <section>
                <SurfaceSectionHeader title="Tiến độ thực hiện" subtitle="Trạng thái từng tác vụ sau khi yêu cầu được tiếp nhận." />
                <div className="space-y-3">{detail.deliveries.map((delivery, index) => {
                  const done = ["COMPLETED", "SUCCEEDED"].includes(delivery.status ?? "");
                  const failed = delivery.status === "FAILED";
                  const title = delivery.eventType === "TRIP_BOOKING_CANCELLATION" ? "Xử lý hủy đặt chỗ" : delivery.consumer === "rental-lifecycle-v1" ? "Xử lý đơn thuê liên quan" : delivery.eventType === "TRIP_CANCELLED" ? "Đồng bộ trạng thái hủy chuyến" : "Xử lý yêu cầu liên quan";
                  return <div key={`${delivery.eventId}-${delivery.consumer ?? index}`} className="flex gap-3 rounded-xl border border-[#E5E7EB] p-3.5">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-100 text-[#2F6B4F]" : failed ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}><CancellationIcon name={done ? "check" : failed ? "close" : "clock"} className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{title}</p><CancellationStatus status={delivery.status ?? "PENDING"} /></div><p className="mt-1 text-xs text-[#6B7280]">Số lần xử lý: <span className="tabular-nums">{delivery.attempts ?? 0}</span></p>
                      {delivery.lastError && <p className="mt-2 break-words text-xs text-red-700">{delivery.lastError}</p>}
                      <details className="mt-2 text-[11px] text-[#6B7280]"><summary className="cursor-pointer hover:text-[#125238]">Thông tin kỹ thuật</summary><p className="mt-1 break-all font-mono">{delivery.eventType} · {delivery.consumer ?? "Chờ tiếp nhận"}</p></details>
                      {failed && delivery.consumer && <Button size="sm" variant="outline" className="mt-3" disabled={busy || !note.trim()} onClick={() => void retry(delivery.eventId, delivery.consumer!)}>Thử lại sau khi kiểm tra</Button>}
                    </div>
                  </div>;
                })}</div>
              </section>}
              <InfoBanner title="Chính sách xử lý">Chỉ các đơn còn hiệu lực được xử lý khi duyệt hủy chuyến. Đơn khách đã tự hủy giữ nguyên kết quả hoàn tiền trước đó.</InfoBanner>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-4"><Button variant="outline" disabled={busy} leftIcon={<CancellationIcon name="refresh" className="h-4 w-4" />} onClick={() => void open(detail.id)}>Cập nhật tiến độ</Button><Button variant="ghost" disabled={busy} onClick={() => setDetail(null)}>Đóng chi tiết</Button></div>
            </div>
          </SurfaceCard>}
        </section>
      </div>
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
