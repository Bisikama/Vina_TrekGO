// Nhãn tiếng Việt và màu trạng thái dùng chung cho các màn admin thuê thiết bị.
// `status` trả về là một khoá có sẵn trong StatusBadge (@/components/ui) để lấy đúng tông màu.

type BadgeTone = { status: string; label: string };

const TONE_KEY = {
  neutral: "DRAFT",
  progress: "PENDING",
  success: "CONFIRMED",
  done: "COMPLETED",
  danger: "CANCELLED",
} as const;

export const TASK_TYPE_LABELS: Record<string, string> = {
  PREPARATION: "Chuẩn bị kho",
  WAREHOUSE: "Chuẩn bị kho",
  OUTBOUND: "Giao đồ",
  RETURN: "Thu hồi",
};

const TASK_STATUS: Record<string, [string, keyof typeof TONE_KEY]> = {
  // Việc kho
  OPEN: ["Chờ xử lý", "neutral"],
  PICKING: ["Đang lấy đồ", "progress"],
  CONDITION_CAPTURED: ["Đã ghi tình trạng", "progress"],
  PACKED: ["Đã đóng gói", "progress"],
  READY: ["Sẵn sàng giao", "success"],
  TRANSFERRED: ["Đã chuyển giao", "done"],
  RETURN_RECEIVED: ["Đã nhận trả", "done"],
  // Việc giao nhận
  SCHEDULED: ["Đã lên lịch", "neutral"],
  PACKAGE_RECEIVED: ["Đã nhận kiện", "progress"],
  RECIPIENT_VERIFIED: ["Đã xác minh người nhận", "progress"],
  HANDED_OVER: ["Đã bàn giao", "success"],
  COLLECTING: ["Đang thu hồi", "progress"],
  RETURNED: ["Đã thu hồi", "success"],
  INVENTORY_RECEIVED: ["Kho đã nhận", "done"],
  NO_SHOW: ["Khách vắng mặt", "danger"],
  REFUSED: ["Khách từ chối", "danger"],
  // Chung
  CLOSED: ["Đã đóng", "done"],
  BLOCKED: ["Bị chặn", "danger"],
  CANCELLED: ["Đã huỷ", "danger"],
};

export function taskStatusBadge(status: string): BadgeTone {
  const entry = TASK_STATUS[status];
  return entry ? { status: TONE_KEY[entry[1]], label: entry[0] } : { status: TONE_KEY.neutral, label: status };
}

const ORDER_STATUS: Record<string, [string, keyof typeof TONE_KEY]> = {
  PENDING_PAYMENT: ["Chờ thanh toán", "progress"],
  PAID: ["Đã thanh toán", "success"],
  PREPARING: ["Kho đang chuẩn bị", "progress"],
  READY_FOR_HANDOVER: ["Sẵn sàng bàn giao", "success"],
  ACTIVE: ["Đang sử dụng", "success"],
  RETURN_PENDING: ["Chờ thu hồi", "progress"],
  RETURN_PROCESSING: ["Đang xử lý trả", "progress"],
  COMPLETED: ["Hoàn tất", "done"],
  CANCELLED: ["Đã huỷ", "danger"],
  EXPIRED: ["Đã hết hạn", "neutral"],
};

export function orderStatusBadge(status: string): BadgeTone {
  const entry = ORDER_STATUS[status];
  return entry ? { status: TONE_KEY[entry[1]], label: entry[0] } : { status: TONE_KEY.neutral, label: status };
}

export const FINANCIAL_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PAYMENT_PENDING: "Đang chờ thanh toán",
  PAID: "Đã thanh toán",
  REFUND_PENDING: "Chờ hoàn tiền",
  PARTIALLY_REFUNDED: "Đã hoàn một phần",
  REFUNDED: "Đã hoàn tiền",
  SETTLED: "Đã quyết toán",
};

export const EXCEPTION_STATUS_LABELS: Record<string, string> = {
  NONE: "Không có",
  ACTION_REQUIRED: "Cần xử lý",
  OVERDUE: "Quá hạn trả",
  RETURN_INCOMPLETE: "Trả thiếu",
};

export const UNIT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Sẵn sàng",
  PICKED: "Đã lấy",
  PACKED: "Đã đóng gói",
  RENTED: "Đang cho thuê",
  RETURN_PENDING: "Chờ trả",
  CLEANING: "Đang vệ sinh",
  MAINTENANCE: "Đang bảo trì",
  DAMAGED: "Hư hỏng",
  LOST: "Thất lạc",
  RETIRED: "Đã thanh lý",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING_PAYMENT: "Chờ thanh toán",
  PENDING: "Đang chờ",
  PROCESSING: "Đang xử lý",
  SUCCEEDED: "Thành công",
  PAID: "Đã thanh toán",
  PARTIALLY_REFUNDED: "Đã hoàn một phần",
  REFUNDED: "Đã hoàn tiền",
  FAILED: "Thất bại",
  CANCELLED: "Đã huỷ",
  EXPIRED: "Hết hạn",
};

export const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang mở",
  PARTIALLY_SETTLED: "Quyết toán một phần",
  ACTION_REQUIRED: "Cần xử lý",
  SETTLED: "Đã quyết toán",
};

export const PACKAGE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang soạn",
  PACKED: "Đã đóng gói",
  READY: "Sẵn sàng",
  TRANSFERRED_TO_DELIVERY: "Đã chuyển giao nhận",
  HANDED_OVER: "Đã bàn giao",
  RETURNING: "Đang thu hồi",
  RETURNED_TO_INVENTORY: "Đã về kho",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã huỷ",
};

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Đã gán",
  PACKED: "Đã đóng gói",
  HANDED_OVER: "Đã bàn giao",
  RETURNED: "Đã trả",
  CLOSED: "Đã đóng",
  REPLACED: "Đã thay",
  UNASSIGNED: "Đã bỏ gán",
};

export const INSPECTION_OUTCOME_LABELS: Record<string, string> = {
  NORMAL: "Đạt",
  ISSUE: "Có vấn đề",
  MISSING_PENDING_REVIEW: "Thiếu, chờ xác minh",
  DAMAGE_CONFIRMED: "Xác nhận hư hại",
  LOST_CONFIRMED: "Xác nhận thất lạc",
};

export const label = (map: Record<string, string>, value: string | null | undefined) =>
  value ? map[value] ?? value : "—";

export function orderCode(id: string) {
  return `#${id.replace(/-/g, "").slice(-6).toUpperCase()}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatMoney(value: number | null | undefined, currency = "VND") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} ${currency === "VND" ? "₫" : currency}`;
}
