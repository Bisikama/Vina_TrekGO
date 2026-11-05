import { apiClient } from "@/lib/axios";

// Admin: phân công việc kho / giao nhận (RB-API-408, 411) và chi tiết đơn thuê.

function unwrap<T>(payload: unknown): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function idempotencyKey(scope: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${scope}-${suffix}`;
}

export type AdminRentalTaskType = "PREPARATION" | "WAREHOUSE" | "OUTBOUND" | "RETURN";

export type AdminRentalTask = {
  id: string;
  type: AdminRentalTaskType;
  status: string;
  assignee: { id: string; displayName: string | null } | null;
  orderId: string;
  tripId: string;
  point?: { id: string; name: string } | null;
  scheduledAt: string | null;
  version: number;
};

export type AdminRentalTaskQuery = {
  type?: AdminRentalTaskType;
  date?: string;
  assignment?: "UNASSIGNED" | "ASSIGNED";
  page?: number;
  pageSize?: number;
};

/** GET /api/v1/admin/rental-tasks */
export async function listAdminRentalTasks(query: AdminRentalTaskQuery, signal?: AbortSignal) {
  const response = await apiClient.get<unknown>("/api/v1/admin/rental-tasks", {
    params: {
      type: query.type || undefined,
      date: query.date || undefined,
      assignment: query.assignment || undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    },
    signal,
  });
  const data = unwrap<{ items: AdminRentalTask[]; pagination?: { totalItems?: number } }>(response.data);
  return { items: data.items ?? [], totalItems: data.pagination?.totalItems ?? data.items?.length ?? 0 };
}

/** POST /api/v1/admin/rental-tasks/:id/assign */
export async function assignAdminRentalTask(input: {
  taskId: string;
  taskType: AdminRentalTaskType;
  assigneeId: string;
  reason: string;
  expectedVersion: number;
}) {
  const response = await apiClient.post<unknown>(
    `/api/v1/admin/rental-tasks/${encodeURIComponent(input.taskId)}/assign`,
    {
      taskType: input.taskType,
      assigneeId: input.assigneeId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    },
    { headers: { "Idempotency-Key": idempotencyKey("admin-assign") } },
  );
  return unwrap<{ assignee: { id: string; displayName: string | null }; taskVersion: number }>(response.data);
}

export type AdminRentalOrderDetail = {
  order: {
    id: string;
    tripId: string;
    bookingId: string | null;
    status: string;
    financialStatus: string;
    exceptionStatus: string;
    rentalFee: number;
    totalDeposit: number;
    totalAmount: number;
    currency: string;
    rentalStartAt: string;
    rentalEndAt: string;
    paymentExpiresAt: string;
    paidAt: string | null;
    cancelledAt: string | null;
    completedAt: string | null;
    version: number;
    createdAt: string;
    customer: { id: string; email: string | null; fullName: string | null; phone: string | null } | null;
    pickupPoint: { id: string; name: string; address: string | null } | null;
    returnPoint: { id: string; name: string; address: string | null } | null;
    lines: Array<{
      id: string;
      productId: string;
      product: { id: string; sku: string | null; name: string } | null;
      quantity: number;
      dailyPriceSnapshot: number;
      depositPerUnitSnapshot: number;
      lineRentalFee: number;
      lineDeposit: number;
      assignedUnits: Array<{
        assignmentId: string;
        status: string;
        equipmentUnit: { id: string; assetCode: string; status: string; condition: string } | null;
      }>;
    }>;
  };
  packages: null | {
    id: string;
    packageCode: string;
    status: string;
    sealedAt: string | null;
    items: Array<{ id: string; equipmentUnitId: string; assetCode: string }>;
  };
  tasks: {
    inventoryTask: null | {
      id: string;
      status: string;
      staffId: string | null;
      deadline: string | null;
      startedAt: string | null;
      completedAt: string | null;
    };
    deliveryTasks: Array<{
      id: string;
      taskType: string;
      status: string;
      staffId: string | null;
      scheduledAt: string | null;
      handoverAt: string | null;
      returnedAt: string | null;
    }>;
    handover: null | { id: string; staffId: string | null; recipientNotes: string | null; handedOverAt: string };
    returnInspections: Array<{
      id: string;
      stage: string;
      outcome: string | null;
      notes: string | null;
      createdAt: string;
    }>;
  };
  financialSummary: {
    rentalFee: number;
    totalDeposit: number;
    totalAmount: number;
    currency: string;
    financialStatus: string;
    invoices: Array<{
      id: string;
      invoiceNo: string;
      status: string;
      totalAmount: number;
      payments: Array<{ id: string; amount: number; currency: string; status: string; paymentGateway: string | null }>;
    }>;
    depositSettlement: null | {
      id: string;
      status: string;
      totalDeposit: number;
      totalDeduction: number;
      refundAmount: number;
    };
    refunds: Array<{ id: string; amount: number; currency: string; status: string }>;
  };
};

/** GET /api/v1/admin/rental-orders/:orderId */
export async function getAdminRentalOrder(orderId: string, signal?: AbortSignal) {
  const response = await apiClient.get<unknown>(`/api/v1/admin/rental-orders/${encodeURIComponent(orderId)}`, { signal });
  return unwrap<AdminRentalOrderDetail>(response.data);
}

export type SystemFaultReasonCode =
  | "GRADE_DOWNGRADE_CAPACITY_SHORTAGE"
  | "SYSTEM_MISSING_EQUIPMENT"
  | "SYSTEM_DAMAGED_EQUIPMENT"
  | "OTHER_SYSTEM_FAULT";

/** POST /api/v1/admin/rental-orders/:orderId/system-fault-cancellation — huỷ do lỗi TrekGo, hoàn 100%. */
export async function cancelRentalOrderSystemFault(input: {
  orderId: string;
  reasonCode: SystemFaultReasonCode;
  note: string;
  expectedVersion: number;
}) {
  const response = await apiClient.post<unknown>(
    `/api/v1/admin/rental-orders/${encodeURIComponent(input.orderId)}/system-fault-cancellation`,
    { reasonCode: input.reasonCode, note: input.note, expectedVersion: input.expectedVersion },
    { headers: { "Idempotency-Key": idempotencyKey("sysfault") } },
  );
  return unwrap<unknown>(response.data);
}
