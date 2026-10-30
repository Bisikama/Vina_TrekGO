/**
 * Tiện ích chuẩn hóa và xử lý mã lỗi từ API Thư mời Private Trip (Vina_TrekGO)
 */

export const INVITE_CODE_REGEX = /^[A-Z0-9]{6}$/;

/**
 * Chuẩn hóa chuỗi nhập thành mã mời 6 ký tự in hoa và số
 */
export function normalizeInviteCode(text: string): string {
  if (!text) return "";
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

/**
 * Kiểm tra mã mời có đúng 6 ký tự hợp lệ hay không
 */
export function isValidInviteCode(code: string): boolean {
  return INVITE_CODE_REGEX.test(code.trim());
}

/**
 * Đọc mã lỗi từ error.response?.data?.error?.code (hoặc ApiError)
 * và ánh xạ sang thông báo chuẩn tiếng Việt theo tài liệu hệ thống.
 */
export function getInviteErrorMessage(err: unknown): string {
  const anyErr = err as any;
  const code =
    anyErr?.response?.data?.error?.code ??
    anyErr?.code ??
    anyErr?.data?.error?.code ??
    anyErr?.details?.code;
  const status = anyErr?.response?.status ?? anyErr?.status;

  if (code === "VALIDATION_ERROR" || (status === 400 && code === "VALIDATION_ERROR")) {
    return "Mã mời phải gồm đúng 6 ký tự chữ in hoa và số.";
  }
  if (code === "NOT_FOUND" || status === 404) {
    return "Không tìm thấy chuyến đi tương ứng với mã mời này.";
  }
  if (code === "INVITE_EXPIRED" || (status === 410 && code === "INVITE_EXPIRED")) {
    return "Mã mời đã hết hạn tham gia.";
  }
  if (code === "INVITE_REVOKED" || (status === 410 && code === "INVITE_REVOKED")) {
    return "Mã mời đã bị trưởng đoàn thu hồi hoặc tạo mã mới.";
  }
  if (code === "CAPACITY_CONFLICT" || (status === 409 && code === "CAPACITY_CONFLICT")) {
    return "Chuyến đi này đã đủ số lượng thành viên tối đa.";
  }
  if (code === "INVITE_RATE_LIMITED" || status === 429) {
    return "Bạn đã thử nhập mã quá số lần quy định. Vui lòng thử lại sau ít phút.";
  }
  if (code === "CONFLICT" || (status === 409 && code === "CONFLICT")) {
    return "Bạn đã tham gia chuyến đi này rồi.";
  }

  // Fallback nếu có message cụ thể từ backend
  if (anyErr?.message && typeof anyErr.message === "string") {
    return anyErr.message;
  }

  return "Không thể xử lý mã mời lúc này. Vui lòng thử lại.";
}
