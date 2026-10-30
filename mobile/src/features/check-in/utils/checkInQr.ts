/**
 * Định dạng payload QR điểm danh (check-in) thực địa theo chuẩn Backend M6.
 *
 * Mã QR thực tế là chuỗi UUID nguyên bản (`checkinCode`) do hệ thống sinh ra
 * cho từng vé tham gia chuyến đi công khai (Public Trip).
 */

export const CHECK_IN_QR_PREFIX = "TREKGO-CHECKIN:";

export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const LOOSE_UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export interface CheckInQrPayload {
  v: 1;
  t: string;
  b: string;
  p: string;
  n: string;
  c: string;
}

/**
 * Rút trích mã `checkinCode` từ chuỗi quét QR thô
 */
export function parseCheckInCode(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // 1. Chuỗi UUID v4 chuẩn
  if (UUID_V4_REGEX.test(trimmed)) {
    return trimmed;
  }

  // 2. Chuỗi chứa UUID (trong URL hoặc chuỗi ghép)
  const match = trimmed.match(LOOSE_UUID_REGEX);
  if (match) {
    return match[0];
  }

  // 3. Fallback chuỗi JSON hoặc legacy format
  try {
    const jsonStr = trimmed.startsWith(CHECK_IN_QR_PREFIX)
      ? trimmed.slice(CHECK_IN_QR_PREFIX.length)
      : trimmed;
    const parsed = JSON.parse(jsonStr);
    if (parsed?.checkinCode && typeof parsed.checkinCode === "string") {
      return parsed.checkinCode.trim();
    }
    if (parsed?.p && typeof parsed.p === "string") {
      return parsed.p.trim();
    }
  } catch {
    // Không phải JSON
  }

  // 4. Nếu là chuỗi ký tự hợp lệ từ 8-64 ký tự không chứa khoảng trắng
  if (/^[A-Za-z0-9_-]{8,64}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function buildShortCode(bookingId: string, participantKey: string): string {
  const b = bookingId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  const p = participantKey.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase();
  return `CK-${b}-${p.padStart(3, "0")}`;
}

export function buildCheckInQrValue(input: {
  tripId: string;
  bookingId: string;
  participantId: string;
  name: string;
}): string {
  const payload: CheckInQrPayload = {
    v: 1,
    t: input.tripId,
    b: input.bookingId,
    p: input.participantId,
    n: input.name,
    c: buildShortCode(input.bookingId, input.participantId),
  };
  return `${CHECK_IN_QR_PREFIX}${JSON.stringify(payload)}`;
}

export function parseCheckInQrValue(raw: string): CheckInQrPayload | null {
  if (!raw || !raw.startsWith(CHECK_IN_QR_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(CHECK_IN_QR_PREFIX.length));
    if (
      parsed?.v === 1 &&
      typeof parsed.t === "string" &&
      typeof parsed.b === "string" &&
      typeof parsed.p === "string"
    ) {
      return {
        v: 1,
        t: parsed.t,
        b: parsed.b,
        p: parsed.p,
        n: typeof parsed.n === "string" ? parsed.n : "Trekker",
        c: typeof parsed.c === "string" ? parsed.c : buildShortCode(parsed.b, parsed.p),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/** Cửa sổ điểm danh: mở từ 00:00 ngày khởi hành đến khi chuyến kết thúc. */
export function getCheckInWindow(startAt?: string, endAt?: string) {
  const start = startAt ? new Date(startAt) : null;
  if (!start || isNaN(start.getTime())) {
    return { isOpen: false, isBefore: false, isAfter: false, opensAt: null as Date | null };
  }
  const opensAt = new Date(start);
  opensAt.setHours(0, 0, 0, 0);
  const end = endAt ? new Date(endAt) : null;
  const closesAt = end && !isNaN(end.getTime()) ? end : new Date(start.getTime() + 24 * 3600 * 1000);
  const now = Date.now();
  const isBefore = now < opensAt.getTime();
  const isAfter = now > closesAt.getTime();
  return { isOpen: !isBefore && !isAfter, isBefore, isAfter, opensAt };
}

export function formatDayMonth(date: Date | null): string {
  if (!date) return "--/--";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}
