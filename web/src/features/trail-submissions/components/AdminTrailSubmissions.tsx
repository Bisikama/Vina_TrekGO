"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PageShell,
  PageHeader,
  SurfaceCard,
  Button,
  StatusBadge,
  DifficultyBadge,
  LoadingState,
  EmptyState,
  ErrorAlert,
  InfoBanner,
  Modal,
  FormField,
  Textarea,
  PaginationBar,
} from "@/components/ui";
import {
  getTrailSubmissionError,
  listTrailSubmissions,
  reviewTrailSubmission,
  type ReviewDecision,
  type SubmissionFilter,
  type TrailSubmission,
} from "../services/trail-submissions.api";
import { TrailSubmissionDetailModal } from "./TrailSubmissionDetailModal";

const PAGE_SIZE = 20;

const TABS: { key: SubmissionFilter; label: string }[] = [
  { key: "PENDING", label: "Chờ duyệt" },
  { key: "APPROVED", label: "Đã duyệt" },
  { key: "REJECTED", label: "Đã từ chối" },
];

const STATUS_VIEW: Record<TrailSubmission["status"], { tone: string; label: string }> = {
  SUBMITTED: { tone: "PENDING", label: "Chờ duyệt" },
  UNDER_REVIEW: { tone: "PENDING", label: "Đang xem xét" },
  APPROVED: { tone: "ACTIVE", label: "Đã duyệt" },
  REJECTED: { tone: "CANCELLED", label: "Đã từ chối" },
  WITHDRAWN: { tone: "CLOSED", label: "Đã rút" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-[#1F2937] tabular-nums">{value}</p>
    </div>
  );
}

export function AdminTrailSubmissions() {
  const [filter, setFilter] = useState<SubmissionFilter>("PENDING");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TrailSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [target, setTarget] = useState<TrailSubmission | null>(null);
  const [decision, setDecision] = useState<ReviewDecision>("APPROVE");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listTrailSubmissions({ status: filter, page, limit: PAGE_SIZE });
      setItems(result.data);
      setTotal(result.pagination.totalItems);
      setError("");
    } catch (e) {
      setError(getTrailSubmissionError(e).message);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  function changeFilter(next: SubmissionFilter) {
    setFilter(next);
    setPage(1);
    setNotice("");
  }

  function openReview(item: TrailSubmission, next: ReviewDecision) {
    setTarget(item);
    setDecision(next);
    setNote("");
    setNoteError("");
  }

  function closeReview() {
    if (submitting) return;
    setTarget(null);
  }

  async function submitReview() {
    if (!target) return;
    const reviewNote = note.trim();
    if (decision === "REJECT" && !reviewNote) {
      setNoteError("Vui lòng nhập lý do từ chối để người dùng biết cần chỉnh sửa gì.");
      return;
    }
    setSubmitting(true);
    try {
      await reviewTrailSubmission(target.id, { decision, ...(reviewNote ? { reviewNote } : {}) });
      setNotice(
        decision === "APPROVE"
          ? `Đã duyệt cung đường "${target.trail.title}".`
          : `Đã từ chối cung đường "${target.trail.title}".`,
      );
      setTarget(null);
      setError("");
      await load();
    } catch (e) {
      const { message, code } = getTrailSubmissionError(e);
      if (code === "TRAIL_SUBMISSION_ALREADY_REVIEWED" || code === "TRAIL_SUBMISSION_NOT_FOUND") {
        setTarget(null);
        setError(message);
        await load();
      } else {
        setNoteError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell maxWidth="xl" withTopOffset={false}>
      <PageHeader
        eyebrow="Quản trị · Kiểm duyệt dữ liệu"
        title="Duyệt cung đường cá nhân"
        description="Xem xét cung đường do trekker ghi lại và gửi lên. Cung đường được duyệt sẽ chuyển sang trạng thái đã xác minh."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Tải lại
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Lọc theo trạng thái">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={filter === tab.key}
            onClick={() => changeFilter(tab.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === tab.key
                ? "border-[#2F6B4F] bg-[#2F6B4F] text-white"
                : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#2F6B4F]/40 hover:text-[#1F2937]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mb-4">
          <InfoBanner tone="success">{notice}</InfoBanner>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} onRetry={() => void load()} onDismiss={() => setError("")} />
        </div>
      )}

      {loading ? (
        <LoadingState label="Đang tải danh sách yêu cầu kiểm duyệt…" />
      ) : items.length === 0 ? (
        <EmptyState
          title={filter === "PENDING" ? "Không có yêu cầu nào đang chờ duyệt" : "Chưa có yêu cầu nào"}
          description={
            filter === "PENDING"
              ? "Khi trekker gửi cung đường lên, yêu cầu sẽ xuất hiện tại đây."
              : "Các yêu cầu đã xử lý sẽ được liệt kê tại đây."
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const view = STATUS_VIEW[item.status];
            const pending = item.status === "SUBMITTED" || item.status === "UNDER_REVIEW";
            return (
              <SurfaceCard key={item.id} padding="md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-[#1F2937] break-words">{item.trail.title}</h2>
                      <StatusBadge status={view.tone} customLabel={view.label} />
                      <DifficultyBadge difficulty={item.trail.difficulty} />
                    </div>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      Gửi bởi <span className="font-semibold text-[#1F2937]">{item.submittedBy.fullName}</span>
                      {" · "}
                      {item.submittedBy.email}
                      {" · "}
                      <span className="tabular-nums">{formatDate(item.submittedAt)}</span>
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Metric label="Quãng đường" value={`${item.trail.distanceKm.toFixed(2)} km`} />
                      <Metric label="Leo lên" value={`+${item.trail.elevationGainM ?? 0} m`} />
                      <Metric label="Xuống dốc" value={`-${item.trail.elevationLossM ?? 0} m`} />
                      <Metric label="Thời gian" value={item.trail.duration || "—"} />
                    </div>

                    {item.submissionNote && (
                      <p className="mt-3 rounded-lg bg-[#F7F7F4] px-3 py-2 text-sm text-[#1F2937]">
                        <span className="font-semibold">Ghi chú của trekker: </span>
                        {item.submissionNote}
                      </p>
                    )}
                    {!pending && (
                      <p className="mt-3 text-xs text-[#6B7280]">
                        Xử lý bởi{" "}
                        <span className="font-semibold text-[#1F2937]">{item.reviewedBy?.fullName ?? "—"}</span>
                        {item.reviewedAt && (
                          <>
                            {" · "}
                            <span className="tabular-nums">{formatDate(item.reviewedAt)}</span>
                          </>
                        )}
                        {item.reviewNote && (
                          <span className="mt-1 block text-sm text-[#1F2937]">
                            <span className="font-semibold">Ghi chú admin: </span>
                            {item.reviewNote}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setViewingId(item.id)}>
                      Xem cung đường
                    </Button>
                    {pending && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openReview(item, "REJECT")}>
                          Từ chối
                        </Button>
                        <Button size="sm" onClick={() => openReview(item, "APPROVE")}>
                          Duyệt
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-5">
          <PaginationBar
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            itemLabel="yêu cầu"
            disabled={loading}
          />
        </div>
      )}

      <TrailSubmissionDetailModal submissionId={viewingId} onClose={() => setViewingId(null)} />

      <Modal
        isOpen={target !== null}
        onClose={closeReview}
        title={decision === "APPROVE" ? "Duyệt cung đường?" : "Từ chối cung đường?"}
        subtitle={target?.trail.title}
        footer={
          <>
            <Button variant="ghost" onClick={closeReview} disabled={submitting}>
              Quay lại
            </Button>
            <Button
              variant={decision === "APPROVE" ? "primary" : "danger"}
              loading={submitting}
              onClick={() => void submitReview()}
            >
              {decision === "APPROVE" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
            </Button>
          </>
        }
      >
        <p className="mb-4 text-[#6B7280]">
          {decision === "APPROVE"
            ? "Cung đường sẽ được đánh dấu đã xác minh. Người dùng không thể chỉnh sửa hoặc gửi lại sau khi duyệt."
            : "Người dùng sẽ thấy lý do từ chối và có thể chỉnh sửa rồi gửi lại."}
        </p>
        <FormField
          label={decision === "APPROVE" ? "Ghi chú (không bắt buộc)" : "Lý do từ chối"}
          required={decision === "REJECT"}
          error={noteError}
        >
          <Textarea
            rows={4}
            maxLength={1000}
            value={note}
            hasError={Boolean(noteError)}
            placeholder={
              decision === "APPROVE" ? "Ví dụ: Dữ liệu GPS đầy đủ, cung đường an toàn." : "Ví dụ: Đoạn cuối bị lệch tọa độ, vui lòng ghi lại."
            }
            onChange={(e) => {
              setNote(e.target.value);
              if (noteError) setNoteError("");
            }}
          />
        </FormField>
      </Modal>
    </PageShell>
  );
}
