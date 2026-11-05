// Hiển thị gọn cho màn thuê thiết bị: mã ngắn 6 ký tự, tên sản phẩm bỏ đuôi hạng, số chứng từ ngắn.

/** 6 ký tự cuối (chữ/số) của một mã dài, viết hoa. Dùng chung quy ước với web: "#" + 6 ký tự cuối của id. */
export function shortId(value?: string | null) {
  if (!value) return "";
  return value.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
}

export function orderShortCode(orderId?: string | null) {
  const code = shortId(orderId);
  return code ? `#${code}` : "";
}

const GRADE_SUFFIX = /\s*[-–—:]\s*(rất mới|như mới|mới|đã sử dụng tốt|sử dụng tốt|đã qua sử dụng)\s*$/i;

/** Tách tên sản phẩm có hạng ("Balo 55L – Rất mới") thành tên gốc + nhãn hạng hiện hành. */
export function splitGradeName(name: string): { base: string; grade: "Như mới" | "Sử dụng tốt" | null } {
  const match = name.match(GRADE_SUFFIX);
  if (!match || match.index === undefined) return { base: name.trim(), grade: null };
  const suffix = match[1].toLocaleLowerCase("vi");
  return {
    base: name.slice(0, match.index).trim(),
    grade: suffix.includes("sử dụng") ? "Sử dụng tốt" : "Như mới",
  };
}

/** Tên sản phẩm kèm hạng dạng "Balo 55L · Như mới" cho màn nội bộ cần biết hạng. */
export function productLabel(name: string) {
  const { base, grade } = splitGradeName(name);
  return grade ? `${base} · ${grade}` : base;
}

const DOCUMENT_PREFIX: Record<string, string> = {
  HANDOVER: "BG",
  EXTENSION_APPENDIX: "GH",
  RETURN_RECEIPT: "TR",
  SCHEDULE_NOTICE: "LH",
  CORRECTION_NOTICE: "DC",
};

/** "TG-HANDOVER-046c5a…" → "TG-BG-046C5A". Số đầy đủ vẫn nằm trong PDF. */
export function shortDocumentNo(documentNo: string, type?: string) {
  const match = documentNo.match(/^TG-([A-Z_]+)-([0-9a-f]+)$/i);
  if (!match) return documentNo.length > 16 ? `…${documentNo.slice(-8).toUpperCase()}` : documentNo;
  const prefix = DOCUMENT_PREFIX[type ?? match[1].toUpperCase()] ?? DOCUMENT_PREFIX[match[1].toUpperCase()] ?? "CT";
  return `TG-${prefix}-${match[2].slice(0, 6).toUpperCase()}`;
}
