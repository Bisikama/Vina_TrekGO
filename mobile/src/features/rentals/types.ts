export type RentalDepositPolicy = {
  type: string;
  amount?: number;
  referenceValue?: number;
  percentage?: number;
};

export type RentalCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
};

export type RentalProduct = {
  id: string;
  sku: string;
  name: string;
  category: {
    id: string;
    name: string;
    status: string;
  };
  description: string | null;
  dailyPrice: number;
  depositPolicy: RentalDepositPolicy;
  currency: string;
  replacementValue: number;
  /** Tiền cọc mỗi món do server tính theo quy tắc báo giá; null nếu dữ liệu cũ không tính được. */
  depositPerUnit?: number | null;
  /** Tỷ lệ cọc / giá trị thay thế do server tính; chỉ để hiển thị, không dùng tính tiền. */
  depositExplanation?: { percentageOfReplacementValue: number | null; formula?: string | null } | null;
  /** Hạng sản phẩm; sản phẩm thường là null. */
  grade?: "LIKE_NEW" | "GOOD_USED" | null;
  gradeGroupId?: string | null;
  status: string;
  version: number;
  imageMediaIds: string[];
  imageUrl?: string;
  imageUrls?: string[];
  spec: unknown;
  recommendationTags: string[];
};

export type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  items: T[];
  pagination: Pagination;
};

export type RentalTripType = "PUBLIC" | "PRIVATE";

export type RentalTripOption = {
  id: string;
  title: string;
  type: RentalTripType;
  startAt: string;
  endAt: string;
  sourceStatus: string;
  eligible: boolean;
  eligibilityReason?: string;
  rentalCutoffAt?: string;
  membershipRef?: string;
  contextVersion?: number;
};

export type RentalAvailability = {
  tripId: string;
  productId: string;
  availableCount: number;
  rentalWindow: unknown;
  checkedAt: string;
};

export type RentalQuoteItem = {
  productId: string;
  name: string;
  quantity: number;
  availableCount: number;
  dailyPrice: number;
  feeAmount: number;
  depositPerUnit: number;
  depositAmount: number;
  replacementValue?: number | null;
  depositExplanation?: RentalDepositExplanationInfo | null;
};

export type RentalDepositExplanationInfo = {
  percentageOfReplacementValue: number | null;
  formula?: string | null;
};

export type RentalQuote = {
  id: string;
  bookingId?: string;
  membershipRef: string;
  membershipSnapshot: unknown;
  pickupPointId: string;
  returnPointId: string;
  returnOptionSnapshot: unknown;
  recipient: {
    memberId: string;
    displayName: string;
  };
  chargedDays: number;
  items: RentalQuoteItem[];
  amounts: {
    feeAmount: number;
    depositAmount: number;
    totalAmount: number;
    currency: string;
  };
  pickup: {
    id: string;
    name: string;
    scheduledAt: string;
  };
  dropoff: {
    id: string;
    name: string;
    scheduledAt: string;
  };
  expiresAt: string;
  contextVersion: number;
  policyVersion: string;
};

export type RentalOrderCreated = {
  order: {
    id: string;
    quoteId: string;
    bookingId?: string;
    tripId: string;
    status: string;
    exceptionStatus?: string;
    financialStatus?: string;
    rentalFee: number;
    totalDeposit: number;
    totalAmount: number;
    currency: string;
    paymentExpiresAt?: string;
    dueAt?: string;
    version: number;
    createdAt: string;
  };
  quantityReservations: {
    id: string;
    orderLineId: string;
    productId: string;
    quantity: number;
    occupiedFrom: string;
    occupiedUntil: string;
    status: string;
    holdExpiresAt?: string;
  }[];
};

export type RentalOrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "READY_FOR_HANDOVER"
  | "ACTIVE"
  | "RETURN_PENDING"
  | "RETURN_PROCESSING"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
  | string;

export type RentalOrderSummary = {
  id: string;
  orderCode?: string | null;
  bookingId?: string;
  tripId: string;
  status: RentalOrderStatus;
  exceptionStatus?: string | null;
  financialStatus?: string | null;
  rentalFee: number;
  totalDeposit: number;
  totalAmount: number;
  currency: string;
  paymentExpiresAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  version: number;
  trip?: {
    id?: string;
    title?: string;
    type?: RentalTripType;
    startAt?: string;
    endAt?: string;
  } | null;
};

export type RentalOrderLine = {
  id: string;
  productId: string;
  name?: string;
  sku?: string;
  quantity: number;
  dailyPrice?: number;
  feeAmount?: number;
  depositAmount?: number;
  depositPerUnit?: number;
  replacementValue?: number | null;
  depositExplanation?: RentalDepositExplanationInfo | null;
  imageUrl?: string;
  product?: {
    id?: string;
    name?: string;
    sku?: string;
    imageUrl?: string;
    grade?: "LIKE_NEW" | "GOOD_USED" | null;
  } | null;
};

export type RentalAssignedUnit = {
  id?: string;
  assignmentId?: string;
  unitId: string;
  assetCode?: string;
  status?: string;
  condition?: string;
  productName?: string;
};

export type DeliveryTaskSummary = {
  id: string;
  type: "OUTBOUND" | "RETURN";
  status: string;
  scheduledAt?: string | null;
  point: { id: string; name: string; address?: string | null };
  package: { id: string; code: string; status: string };
  orderSummary: {
    orderId: string;
    bookingId?: string | null;
    tripId: string;
    orderStatus: string;
    recipient?: { displayName?: string; fullName?: string; name?: string };
  };
  version: number;
  allowedActions: string[];
};

export type DeliveryTaskUnit = {
  unitId: string;
  assetCode: string;
  product?: { id?: string; name?: string };
  condition?: string;
  physicalStatus?: string;
  assignmentStatus?: string;
};

export type DeliveryTaskDetail = {
  task: {
    id: string;
    type: "OUTBOUND" | "RETURN";
    status: string;
    scheduledAt?: string | null;
    point: { id: string; name: string; address?: string | null };
    version: number;
    allowedActions: string[];
  };
  package: { id: string; code: string; status: string; version: number } | null;
  custodyTransfer: { id: string; status: string; requestedAt: string } | null;
  units: DeliveryTaskUnit[];
  recipient: { displayName?: string; fullName?: string; name?: string };
  verificationStatus: Record<string, unknown>;
};

export type RentalReturnScanResult = {
  returnId: string;
  returnSessionId: string;
  receivedUnits: { unitId: string; assetCode: string; receivedAt: string; duplicate: boolean }[];
  missingUnits: { unitId: string; assetCode: string }[];
  duplicates: string[];
  version: number;
  taskVersion: number;
};

export type RentalReturnObservationResult = {
  returnSessionId?: string | null;
  observations: { unitId: string; observationOnly: true }[];
  requiresInventoryInspection: boolean;
  refundEligible: false;
  discrepancies: { unitId: string; reason: string }[];
};

export type RentalReturnTransferResult = {
  pendingTransferId: string | null;
  unitIds: string[];
  missingInCustodyUnitIds?: string[];
  status: string;
  transferStartedAt?: string | null;
  transferWatchAt?: string | null;
  monitoringStatus?: string;
};

export type RentalReturnReceipt = {
  receiptDocumentId: string;
  documentId: string;
  documentType: "RETURN_RECEIPT";
  documentNumber: string;
  returnSessionId: string;
  receivedUnitCount: number;
  notReturnedUnitIds: string[];
  renderStatus: string;
  downloadReady: boolean;
  orderId: string;
  issuedAt?: string;
  snapshotHash: string;
  version: number;
};

export type RentalOrderTimelineItem = {
  id?: string;
  status?: string;
  title?: string;
  description?: string;
  occurredAt?: string;
  createdAt?: string;
};

export type RentalOrderDetail = {
  order: RentalOrderSummary;
  items: RentalOrderLine[];
  quantityReservations: {
    id: string;
    orderLineId: string;
    productId: string;
    quantity: number;
    occupiedFrom: string;
    occupiedUntil: string;
    status: string;
    holdExpiresAt?: string | null;
  }[];
  assignedUnits?: RentalAssignedUnit[];
  payment?: RentalPaymentStatus | null;
  deposit?: RentalDepositStatus | null;
  timeline?: RentalOrderTimelineItem[];
};

export type RentalPaymentGateway = "momo" | "vnpay";

export type RentalPaymentState =
  | "NOT_STARTED"
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type RentalPaymentStatus = {
  paymentRef: string;
  status: RentalPaymentState;
  nextAction: {
    type: "CREATE_PAYMENT" | "AWAIT_PAYMENT_RESULT" | "RETRY_PAYMENT";
  } | null;
  expiresAt: string | null;
  amount: number;
  refundedAmount: number;
  paidAt?: string | null;
  invoiceStatus: string | null;
  applicationStatus: "PENDING" | "APPLIED" | "REJECTED" | null;
  applicationReasonCode: string | null;
  reconciliationStatus: string | null;
  reconciliationRequired: boolean;
  gateway: RentalPaymentGateway | null;
  providerEnvironment: string | null;
  paymentMethod: "QR" | "REDIRECT" | null;
  orderStatus: string;
  financialStatus: string;
};

export type RentalPaymentOptions = {
  defaultGateway?: RentalPaymentGateway;
  gateways: {
    gateway: RentalPaymentGateway;
    environment: "MOCK" | "SANDBOX" | "PRODUCTION" | string;
    methods?: ("QR" | "REDIRECT")[];
  }[];
};

export type RentalPaymentCheckout = {
  paymentId: string;
  invoiceId: string;
  invoiceType: "RENTAL";
  status:
    | "PENDING"
    | "PROCESSING"
    | "SUCCEEDED"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED";
  amount: string;
  currency: string;
  providerEnvironment: string;
  gateway: RentalPaymentGateway;
  checkout: {
    type: "QR" | "REDIRECT";
    url: string | null;
    qrData: string | null;
  } | null;
  expiresAt: string | null;
  reconciliationRequired: boolean;
};

export type RentalPickupCode = {
  pickupCode: string;
  expiresAt: string;
  orderId: string;
  recipient?: { memberId?: string; displayName?: string };
  pickupPoint?: { id?: string; name?: string; address?: string };
};

export type RentalHandoverPreview = {
  package?: { id?: string; code?: string; packageCode?: string } | null;
  conditionSnapshots?: {
    unitId?: string;
    assetCode?: string;
    condition?: string;
    notes?: string;
  }[];
  status?: string;
};

export type RentalDepositItem = {
  unitId: string;
  assetCode?: string;
  depositAmount?: number;
  amount?: number;
  status: string;
  inspectionStatus?: string | null;
  refundRef?: string | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
  heldReason?: string | null;
  deduction?: number | null;
  reason?: string | null;
  /** Khiếu nại khoản trừ (web/docs/RENTAL_DEPOSIT_DISPUTE_FRONTEND_HANDOFF.md). */
  assessmentId?: string | null;
  exceptionCaseId?: string | null;
  reviewCaseId?: string | null;
  evidenceAccessibleAt?: string | null;
  evidenceAccessBlockedAt?: string | null;
  evidenceAccessCustomerConfirmationRequired?: boolean;
  reviewWindowEndsAt?: string | null;
  reviewStatus?: "NOT_SUBMITTED" | "SUBMITTED" | "RESOLVED" | string;
  canSubmitReview?: boolean;
  cannotSubmitReviewReason?: string | null;
  approvedDeduction?: number | null;
};

export type RentalDepositStatus = {
  collectedAmount: number;
  heldAmount: number;
  refundedAmount: number;
  refundPendingAmount?: number;
  deductionAmount: number;
  items: RentalDepositItem[];
  groupedRefunds?: Record<string, unknown>[];
};

export type RentalCancellationPreview = {
  canCancel: boolean;
  feeRefund: number;
  depositRefund: number;
  reason: string;
  previewVersion: string;
};

export type RentalCancellationResult = {
  order: RentalOrderSummary;
  refund: {
    refundRef: string;
    amount: number;
    status: string;
  } | null;
  quantityReleaseStatus: string;
};

export function calculateProductDeposit(product: RentalProduct) {
  // Ưu tiên số server đã tính; chỉ dùng cách tính cũ cho dữ liệu chưa có depositPerUnit.
  if (typeof product.depositPerUnit === "number") {
    return product.depositPerUnit;
  }

  if (typeof product.depositPolicy.amount === "number") {
    return product.depositPolicy.amount;
  }

  if (typeof product.depositPolicy.percentage === "number") {
    return Math.round(
      product.replacementValue * (product.depositPolicy.percentage / 100),
    );
  }

  return 0;
}

export function rentalProductSpecs(product: RentalProduct) {
  if (!product.spec || typeof product.spec !== "object") return [];

  if (Array.isArray(product.spec)) {
    return product.spec.map(String);
  }

  return Object.entries(product.spec as Record<string, unknown>)
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    )
    .map(([key, value]) => `${key}: ${String(value)}`);
}
