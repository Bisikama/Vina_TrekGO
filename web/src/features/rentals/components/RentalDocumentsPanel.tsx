"use client";

import { useCallback, useEffect, useState } from "react";

import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import {
  getRentalDocumentDownload,
  listRentalOrderDocuments,
  verifyRentalDocument,
  type RentalDocumentSummary,
  type RentalDocumentVerification,
} from "@/features/rentals/services/user-rental.api";

import { dateTime } from "./RentalSectionNav";

// Chứng từ của đơn thuê: biên bản bàn giao, phụ lục gia hạn, biên nhận trả đồ...
// Danh sách: GET /rental-orders/:id/documents; tải PDF: /rental-documents/:id/download;
// xác minh toàn vẹn: /rental-documents/:id/verification.

const TYPE_LABELS: Record<string, string> = {
  HANDOVER: "Biên bản bàn giao",
  EXTENSION_APPENDIX: "Phụ lục gia hạn",
  RETURN_RECEIPT: "Biên nhận trả đồ",
  SCHEDULE_NOTICE: "Thông báo lịch giao nhận",
  CORRECTION_NOTICE: "Thông báo đính chính",
};

const VERIFY_LABELS: Record<string, { text: string; tone: string }> = {
  VERIFIED: { text: "Đã xác minh: nội dung và tệp PDF khớp bản gốc", tone: "text-emerald-700" },
  SNAPSHOT_ONLY: { text: "Nội dung khớp bản gốc, tệp PDF chưa sẵn sàng để đối chiếu", tone: "text-amber-700" },
  FAILED: { text: "Không khớp bản gốc, vui lòng liên hệ TrekGo", tone: "text-red-700" },
};

export function RentalDocumentsPanel({ orderId }: { orderId: string }) {
  const [documents, setDocuments] = useState<RentalDocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<Record<string, RentalDocumentVerification>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      setDocuments(await listRentalOrderDocuments(orderId));
    } catch (reason) {
      setError(getRentalApiErrorMessage(reason, "Không tải được chứng từ của đơn."));
      setDocuments([]);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download(document: RentalDocumentSummary) {
    setActionError(null);
    setDownloading(document.id);
    // Mở tab ngay khi bấm để trình duyệt không chặn cửa sổ bật lên.
    const tab = window.open("", "_blank");
    try {
      const result = await getRentalDocumentDownload(document.id);
      if (tab) tab.location.href = result.downloadUrl;
      else window.location.href = result.downloadUrl;
    } catch (reason) {
      tab?.close();
      setActionError(getRentalApiErrorMessage(reason, "Chưa tải được chứng từ."));
    } finally {
      setDownloading(null);
    }
  }

  async function verify(document: RentalDocumentSummary) {
    setActionError(null);
    setVerifying(document.id);
    try {
      const result = await verifyRentalDocument(document.id);
      setVerifications((current) => ({ ...current, [document.id]: result }));
    } catch (reason) {
      setActionError(getRentalApiErrorMessage(reason, "Chưa xác minh được chứng từ."));
    } finally {
      setVerifying(null);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Chứng từ</h2>
          <p className="mt-1 text-sm text-gray-500">Biên bản và biên nhận được tạo tự động theo từng bước của đơn.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Tải lại
        </button>
      </div>

      {actionError ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p> : null}

      {documents === null ? (
        <p className="mt-4 text-sm text-gray-500">Đang tải chứng từ...</p>
      ) : error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : documents.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          Chưa có chứng từ. Biên bản bàn giao sẽ có sau khi bạn nhận đồ.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {documents.map((document) => {
            const verification = verifications[document.id];
            const verifyLabel = verification ? VERIFY_LABELS[verification.verificationStatus] : null;
            return (
              <li key={document.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{TYPE_LABELS[document.type] ?? document.type}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Số <span className="font-mono">{document.documentNo}</span>
                    {document.issuedAt ? ` · ${dateTime(document.issuedAt)}` : ""}
                    {document.rootDocumentId ? " · bản đính chính" : ""}
                  </p>
                  {verifyLabel ? <p className={`mt-1 text-xs ${verifyLabel.tone}`}>{verifyLabel.text}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {document.renderStatus === "PENDING_RENDER" ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">Đang tạo PDF</span>
                  ) : document.renderStatus === "RENDER_FAILED" ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">Tạo PDF lỗi</span>
                  ) : null}
                  <button
                    type="button"
                    disabled={verifying === document.id}
                    onClick={() => void verify(document)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {verifying === document.id ? "Đang kiểm tra..." : "Xác minh"}
                  </button>
                  <button
                    type="button"
                    disabled={!document.downloadReady || downloading === document.id}
                    onClick={() => void download(document)}
                    className="rounded-xl bg-[#1B5E41] px-3 py-2 text-xs font-medium text-white hover:bg-[#144a33] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    {downloading === document.id ? "Đang mở..." : "Tải PDF"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
