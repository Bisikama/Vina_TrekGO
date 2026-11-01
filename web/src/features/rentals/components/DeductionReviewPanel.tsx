/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";

import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import {
  confirmEvidenceAccessRestored,
  evidenceIdsOf,
  getApiErrorReason,
  getEvidenceMedia,
  getRentalAssessment,
  isUnknownOutcome,
  newIdempotencyKey,
  reportEvidenceAccessProblem,
  reviewReasonMessages,
  submitAssessmentReview,
  uploadDisputeEvidence,
  type EvidenceMedia,
  type RentalAssessmentItem,
} from "@/features/rentals/services/deduction-review.api";
import type { RentalDepositItem } from "@/features/rentals/services/user-rental.api";

import { dateTime, money } from "./RentalSectionNav";

const MAX_EVIDENCE_FILES = 10;

function remainingText(endsAt: string, now: number) {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Đã hết hạn";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `Còn ${hours} giờ ${minutes} phút` : `Còn ${minutes} phút`;
}

/**
 * Khối "Khoản trừ cọc" cho một thiết bị: xem chứng cứ, thời hạn phản hồi và gửi phản đối (RB-API-609).
 * Chỉ hiển thị khi ADMIN đã duyệt khoản trừ > 0. Mọi quyền gửi lấy từ `canSubmitReview` của 607.
 */
export function DeductionReviewPanel({
  orderId,
  item,
  currency,
  onChanged,
}: {
  orderId: string;
  item: RentalDepositItem;
  currency: string;
  onChanged: () => Promise<void> | void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [assessment, setAssessment] = useState<RentalAssessmentItem>();
  const [media, setMedia] = useState<EvidenceMedia[]>([]);
  const [mediaFailed, setMediaFailed] = useState(0);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const reviewKey = useRef<string | null>(null);
  const uploadedIds = useRef<Map<File, string>>(new Map());
  const expiredRefetched = useRef(false);

  const approved = item.approvedDeduction ?? 0;
  const assessmentId = item.assessmentId ?? null;
  const reasonCode = item.cannotSubmitReviewReason ?? null;
  const published = Boolean(item.exceptionCaseId && item.evidenceAccessibleAt);

  useEffect(() => {
    if (!item.reviewWindowEndsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [item.reviewWindowEndsAt]);

  // Hết hạn khi người dùng đang mở trang: hỏi lại server thay vì tự quyết.
  useEffect(() => {
    if (!item.canSubmitReview || !item.reviewWindowEndsAt || expiredRefetched.current) return;
    if (new Date(item.reviewWindowEndsAt).getTime() <= now) {
      expiredRefetched.current = true;
      setFormOpen(false);
      void onChanged();
    }
  }, [item.canSubmitReview, item.reviewWindowEndsAt, now, onChanged]);

  if (approved <= 0 || !assessmentId) return null;

  async function loadEvidence() {
    if (!assessmentId) return;
    setEvidenceLoading(true);
    setEvidenceError(undefined);
    try {
      const result = await getRentalAssessment(orderId);
      const match = result.items.find((entry) => entry.inspectionId === assessmentId);
      setAssessment(match);
      const ids = evidenceIdsOf(match);
      const settled = await Promise.allSettled(ids.map((id) => getEvidenceMedia(id)));
      setMedia(settled.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : [])));
      setMediaFailed(settled.filter((entry) => entry.status === "rejected").length);
    } catch (reasonError) {
      setEvidenceError(getRentalApiErrorMessage(reasonError, "Không tải được chứng cứ."));
    } finally {
      setEvidenceLoading(false);
    }
  }

  function toggleEvidence() {
    const next = !evidenceOpen;
    setEvidenceOpen(next);
    if (next && !assessment) void loadEvidence();
  }

  async function reportProblem() {
    if (!assessmentId) return;
    setBusy("report");
    setError(undefined);
    try {
      await reportEvidenceAccessProblem(orderId, assessmentId, newIdempotencyKey("evidence-report"));
      setNotice("Đã ghi nhận. TrekGo giữ nguyên khoản liên quan và sẽ khôi phục quyền xem chứng cứ cho bạn.");
      await onChanged();
    } catch (reasonError) {
      const code = getApiErrorReason(reasonError);
      setError((code && reviewReasonMessages[code]) || getRentalApiErrorMessage(reasonError, "Không gửi được báo cáo."));
    } finally {
      setBusy(undefined);
    }
  }

  async function confirmRestored() {
    if (!assessmentId) return;
    setBusy("confirm");
    setError(undefined);
    try {
      await confirmEvidenceAccessRestored(orderId, assessmentId, newIdempotencyKey("evidence-confirm"));
      setNotice("Đã gửi xác nhận. Hệ thống đang kiểm tra lại; khi xong bạn sẽ có đủ 48 giờ mới để phản hồi.");
      await onChanged();
    } catch (reasonError) {
      setError(getRentalApiErrorMessage(reasonError, "Không gửi được xác nhận."));
    } finally {
      setBusy(undefined);
    }
  }

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/"),
    );
    setFiles((current) => [...current, ...picked].slice(0, MAX_EVIDENCE_FILES));
    reviewKey.current = null; // nội dung đổi → ý định mới
  }

  async function submit() {
    if (!assessmentId) return;
    const text = reason.trim();
    if (text.length < 3) {
      setError("Lý do cần ít nhất 3 ký tự.");
      return;
    }
    setBusy("submit");
    setError(undefined);
    try {
      const evidenceIds: string[] = [];
      for (const file of files) {
        let id = uploadedIds.current.get(file);
        if (!id) {
          id = await uploadDisputeEvidence(file);
          uploadedIds.current.set(file, id);
        }
        evidenceIds.push(id);
      }
      if (!reviewKey.current) reviewKey.current = newIdempotencyKey("assessment-review");
      await submitAssessmentReview(orderId, { assessmentId, reason: text, evidenceIds }, reviewKey.current);
      reviewKey.current = null;
      setFormOpen(false);
      setReason("");
      setFiles([]);
      setNotice(undefined); // khối trạng thái vàng phía trên đã báo "Admin đang xem xét"
      await onChanged();
    } catch (reasonError) {
      if (isUnknownOutcome(reasonError)) {
        // Giữ nguyên key: bấm gửi lại sẽ retry đúng yêu cầu cũ, không tạo khiếu nại trùng.
        setError("Mất kết nối khi gửi. Bấm “Gửi phản đối” lần nữa để thử lại an toàn.");
        return;
      }
      reviewKey.current = null;
      const code = getApiErrorReason(reasonError);
      if (code === "REVIEW_ALREADY_SUBMITTED" || code === "USER_REVIEW_WINDOW_EXPIRED") setFormOpen(false);
      setError((code && reviewReasonMessages[code]) || getRentalApiErrorMessage(reasonError, "Không gửi được phản đối."));
      await onChanged();
    } finally {
      setBusy(undefined);
    }
  }

  const status = (() => {
    if (item.reviewStatus === "SUBMITTED")
      return { tone: "amber", text: "Bạn đã gửi phản đối. Admin đang xem xét, khoản cọc được giữ tới khi có kết quả." };
    if (item.reviewStatus === "RESOLVED")
      return { tone: "slate", text: "Phản đối của bạn đã được Admin xử lý. Theo dõi kết quả hoàn cọc ở trên." };
    if (item.canSubmitReview && item.reviewWindowEndsAt)
      return {
        tone: "emerald",
        text: `${remainingText(item.reviewWindowEndsAt, now)} để phản đối · hạn ${dateTime(item.reviewWindowEndsAt)}. Hết hạn mà không phản đối, khoản trừ sẽ được quyết toán.`,
      };
    if (reasonCode === "EVIDENCE_ACCESS_INTERRUPTED" && item.evidenceAccessCustomerConfirmationRequired)
      return { tone: "amber", text: "Bạn đã báo không xem được chứng cứ. Hãy mở lại chứng cứ; nếu xem được, bấm “Tôi đã xem được chứng cứ”." };
    if (reasonCode && reviewReasonMessages[reasonCode] && reasonCode !== "NO_APPROVED_DEDUCTION")
      return { tone: reasonCode === "USER_REVIEW_WINDOW_EXPIRED" || reasonCode === "SETTLEMENT_ALREADY_STARTED" ? "slate" : "amber", text: reviewReasonMessages[reasonCode] };
    return null;
  })();

  const tones: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div className="mt-3 rounded-2xl border border-red-100 bg-red-50/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-red-800">Khoản trừ cọc đã duyệt</p>
        <p className="text-base font-black text-red-800">{money(approved, currency)}</p>
      </div>

      {status ? (
        <p className={`mt-3 rounded-xl border p-3 text-xs leading-5 ${tones[status.tone]}`}>{status.text}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {published ? (
          <button
            type="button"
            onClick={toggleEvidence}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
          >
            {evidenceOpen ? "Ẩn chứng cứ" : "Xem chứng cứ"}
          </button>
        ) : null}
        {item.canSubmitReview && !formOpen ? (
          <button
            type="button"
            onClick={() => {
              setFormOpen(true);
              setNotice(undefined);
              setError(undefined);
            }}
            className="rounded-xl bg-red-700 px-3 py-2 text-xs font-extrabold text-white"
          >
            Phản đối khoản trừ
          </button>
        ) : null}
        {item.canSubmitReview ? (
          <button
            type="button"
            onClick={() => void reportProblem()}
            disabled={busy === "report"}
            className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 underline disabled:opacity-50"
          >
            {busy === "report" ? "Đang gửi..." : "Tôi không xem được chứng cứ"}
          </button>
        ) : null}
        {item.evidenceAccessCustomerConfirmationRequired ? (
          <button
            type="button"
            onClick={() => void confirmRestored()}
            disabled={busy === "confirm"}
            className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
          >
            {busy === "confirm" ? "Đang gửi..." : "Tôi đã xem được chứng cứ"}
          </button>
        ) : null}
      </div>

      {evidenceOpen ? (
        <div className="mt-3 rounded-xl bg-white p-3">
          {evidenceLoading ? (
            <p className="text-xs text-slate-500">Đang tải chứng cứ...</p>
          ) : evidenceError ? (
            <p className="text-xs text-red-700">
              {evidenceError}{" "}
              <button type="button" onClick={() => void loadEvidence()} className="font-bold underline">
                Thử lại
              </button>
            </p>
          ) : (
            <>
              {assessment?.findings?.length ? (
                <ul className="mb-3 space-y-1 text-xs text-slate-700">
                  {assessment.findings.map((finding, index) => (
                    <li key={`${finding.ruleId}-${index}`}>
                      • Lỗi ghi nhận × {finding.quantity}: {money(finding.amount, currency)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {media.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {media.map((entry) =>
                    entry.resourceType === "VIDEO" ? (
                      <video key={entry.mediaId} src={entry.url} controls className="aspect-square w-full rounded-lg bg-black object-cover" />
                    ) : (
                      <a key={entry.mediaId} href={entry.url} target="_blank" rel="noreferrer">
                        <img src={entry.url} alt="Chứng cứ kiểm định" className="aspect-square w-full rounded-lg object-cover" />
                      </a>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Chưa có tệp chứng cứ hiển thị được.</p>
              )}
              {mediaFailed > 0 ? (
                <p className="mt-2 text-xs text-amber-800">
                  {mediaFailed} tệp chưa tải được. Nếu vẫn không xem được, bấm “Tôi không xem được chứng cứ”.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {formOpen ? (
        <div className="mt-3 rounded-xl bg-white p-3">
          <label className="text-xs font-bold text-slate-800" htmlFor={`review-${assessmentId}`}>
            Lý do phản đối
          </label>
          <textarea
            id={`review-${assessmentId}`}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              reviewKey.current = null;
            }}
            maxLength={3000}
            rows={4}
            placeholder="Ví dụ: Vết xước này đã có từ khi tôi nhận thiết bị, có ảnh lúc nhận kèm theo."
            className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-emerald-600"
          />
          <p className="text-right text-[10px] text-slate-400">{reason.trim().length}/3000</p>
          <label className="mt-2 block text-xs font-bold text-slate-800">
            Ảnh/video minh chứng (không bắt buộc, tối đa {MAX_EVIDENCE_FILES})
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(event) => {
                pickFiles(event.target.files);
                event.target.value = "";
              }}
              className="mt-1 block w-full text-xs"
            />
          </label>
          {files.length ? (
            <ul className="mt-2 space-y-1">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between text-xs text-slate-600">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFiles((current) => current.filter((_, i) => i !== index));
                      reviewKey.current = null;
                    }}
                    className="ml-2 font-bold text-red-700"
                  >
                    Bỏ
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy === "submit"}
              className="rounded-xl bg-red-700 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
            >
              {busy === "submit" ? "Đang gửi..." : "Gửi phản đối"}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={busy === "submit"}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
            >
              Huỷ
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <p className="mt-3 text-xs font-semibold text-emerald-800">{notice}</p> : null}
      {error ? <p className="mt-3 text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
