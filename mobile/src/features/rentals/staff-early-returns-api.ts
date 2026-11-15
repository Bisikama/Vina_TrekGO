import { apiRequest } from "@/lib/api-client";

type Envelope<T> = T | { data: T };

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) return (payload as { data: T }).data;
  return payload as T;
}

export type StaffEarlyReturnFilter = "PENDING" | "CONFIRMED";

export type StaffEarlyReturn = {
  id: string;
  orderId: string;
  status: string;
  version: number;
  requestedAt: string;
  requestedSlotAt: string;
  confirmedSlotAt: string | null;
  /** Có giá trị khi lịch đã xác nhận bị đổi chuyến đưa về chờ xác nhận lại. */
  supersededAt: string | null;
  requester: { fullName: string; phone: string | null };
  task: { id: string; status: string; scheduledAt: string | null; staff: { fullName: string } | null } | null;
  order: {
    status: string;
    effectiveDueAt: string;
    outstandingUnits: number;
    returnPoint: { name: string; address: string } | null;
  };
};

const newKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Xếp lịch trả đồ sớm (RB: nhân viên kho / Admin). Không động tới phí thuê hay tiền cọc. */
export const staffEarlyReturnsApi = {
  async list(accessToken: string, status: StaffEarlyReturnFilter = "PENDING") {
    return unwrap(
      await apiRequest<Envelope<StaffEarlyReturn[]>>(
        `/api/v1/staff/rental-early-returns?status=${status}`,
        { method: "GET", accessToken },
      ),
    );
  },

  async confirm(request: StaffEarlyReturn, accessToken: string, idempotencyKey = newKey("early-return-confirm")) {
    return unwrap(
      await apiRequest<Envelope<StaffEarlyReturn>>(
        `/api/v1/staff/rental-early-returns/${encodeURIComponent(request.id)}/confirm`,
        {
          method: "POST",
          accessToken,
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ expectedVersion: request.version }),
        },
      ),
    );
  },

  async reject(
    request: StaffEarlyReturn,
    reason: string,
    accessToken: string,
    idempotencyKey = newKey("early-return-reject"),
  ) {
    return unwrap(
      await apiRequest<Envelope<StaffEarlyReturn>>(
        `/api/v1/staff/rental-early-returns/${encodeURIComponent(request.id)}/reject`,
        {
          method: "POST",
          accessToken,
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ expectedVersion: request.version, reason }),
        },
      ),
    );
  },
};
