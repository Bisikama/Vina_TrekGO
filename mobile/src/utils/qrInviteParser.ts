/**
 * Parser giải mã nội dung từ mã QR do web app (hoặc các kênh chia sẻ) tạo ra.
 * Hỗ trợ:
 * 1. URL đầy đủ: https://trekgo.vn/invite/{code} hoặc http://.../private-trips/invite/{code}
 * 2. Deep link: trekgo://invite/{code}
 * 3. Query param: ?code={code} hoặc ?inviteCode={code}
 * 4. Chuỗi JSON: {"code": "...", ...} hoặc {"inviteCode": "..."}
 * 5. Mã code thô dạng chuỗi: "abc123xyz" hoặc "TRIP-8821"
 */
export function parsePrivateTripInviteCode(rawContent: string): string | null {
  if (!rawContent || typeof rawContent !== "string") {
    return null;
  }

  const trimmed = rawContent.trim();
  if (!trimmed) return null;

  let extracted: string | null = null;

  // 1. Kiểm tra nếu là chuỗi JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.code && typeof parsed.code === "string") {
        extracted = parsed.code.trim();
      } else if (parsed.inviteCode && typeof parsed.inviteCode === "string") {
        extracted = parsed.inviteCode.trim();
      }
    } catch {
      // Bỏ qua lỗi parse JSON nếu không hợp lệ
    }
  }

  // 2. Kiểm tra nếu là URL chứa đường dẫn invite: /invite/{code} hoặc /invitations/{code}
  if (!extracted) {
    const pathRegex = /(?:invite|invitations)\/([a-zA-Z0-9_\-\.]+)/i;
    const pathMatch = trimmed.match(pathRegex);
    if (pathMatch && pathMatch[1]) {
      extracted = pathMatch[1].split(/[?#]/)[0].trim();
    }
  }

  // 3. Kiểm tra query param: ?code={code} hoặc ?inviteCode={code}
  if (!extracted) {
    const queryRegex = /[?&](?:code|inviteCode)=([a-zA-Z0-9_\-\.]+)/i;
    const queryMatch = trimmed.match(queryRegex);
    if (queryMatch && queryMatch[1]) {
      extracted = queryMatch[1].split(/[&#]/)[0].trim();
    }
  }

  // 4. Nếu là mã code đơn thuần
  if (!extracted) {
    extracted = trimmed;
  }

  // Chuẩn hóa và kiểm tra mã 6 ký tự
  const normalized = extracted.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length === 6) {
    return normalized;
  }

  // Nếu là mã cũ hoặc định dạng khác hợp lệ (3-64 ký tự)
  if (/^[a-zA-Z0-9_\-\.]{3,64}$/.test(extracted)) {
    return extracted;
  }

  return null;
}
