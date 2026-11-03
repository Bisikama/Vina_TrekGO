import { apiRequest } from "@/lib/api-client";

export type RentalTransactionKind = "PAYMENT" | "REFUND" | string;

export type RentalTransaction = {
  id: string;
  kind: RentalTransactionKind;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  orderId?: string;
  reference?: string;
  purpose?: string;
};

export type RentalTransactionPage = {
  items: RentalTransaction[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrap(payload: unknown): unknown {
  if (isRecord(payload) && "data" in payload) return payload.data;
  return payload;
}

function readString(record: RecordValue, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function normalizeTransaction(value: unknown, index: number): RentalTransaction | null {
  if (!isRecord(value)) return null;

  const metadata = isRecord(value.metadata)
    ? value.metadata
    : isRecord(value.context)
      ? value.context
      : {};
  const kind = (readString(value, "kind", "type", "transactionType") || "PAYMENT").toUpperCase();
  const amountValue = value.amount ?? value.totalAmount ?? value.refundAmount ?? 0;
  const amount = typeof amountValue === "number" ? amountValue : Number(amountValue);
  const createdAt = readString(value, "createdAt", "paidAt", "refundedAt", "updatedAt") || "";
  const id = readString(value, "id", "transactionId", "paymentId", "refundId") || `${kind}-${createdAt}-${index}`;

  return {
    id,
    kind,
    status: (readString(value, "status", "paymentStatus", "refundStatus") || "UNKNOWN").toUpperCase(),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: readString(value, "currency") || "VND",
    createdAt,
    orderId:
      readString(value, "rentalOrderId", "orderId", "sourceId") ||
      readString(metadata, "rentalOrderId", "orderId", "sourceId"),
    reference: readString(value, "reference", "paymentRef", "refundRef", "transactionRef"),
    purpose: readString(value, "purpose", "description", "label"),
  };
}

function normalizePage(payload: unknown, requestedPage: number, requestedPageSize: number): RentalTransactionPage {
  const root = unwrap(payload);
  const rootRecord = isRecord(root) ? root : {};
  const rawItems = Array.isArray(root)
    ? root
    : Array.isArray(rootRecord.items)
      ? rootRecord.items
      : Array.isArray(rootRecord.transactions)
        ? rootRecord.transactions
        : [];
  const pagination = isRecord(rootRecord.pagination)
    ? rootRecord.pagination
    : isRecord(rootRecord.meta)
      ? rootRecord.meta
      : {};
  const items = rawItems
    .map(normalizeTransaction)
    .filter((item): item is RentalTransaction => item !== null);
  const page = Number(pagination.page ?? rootRecord.page ?? requestedPage);
  const pageSize = Number(pagination.pageSize ?? rootRecord.pageSize ?? requestedPageSize);
  const total = Number(pagination.total ?? rootRecord.total ?? items.length);
  const totalPages = Number(
    pagination.totalPages ?? rootRecord.totalPages ?? Math.max(1, Math.ceil(total / Math.max(pageSize, 1))),
  );

  return { items, page, pageSize, total, totalPages };
}

export const rentalTransactionsApi = {
  async list(
    accessToken: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<RentalTransactionPage> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const query = new URLSearchParams({
      source: "RENTAL",
      page: String(page),
      pageSize: String(pageSize),
    });
    const response = await apiRequest<unknown>(`/api/v1/user/transactions?${query.toString()}`, {
      accessToken,
    });

    return normalizePage(response, page, pageSize);
  },
};
