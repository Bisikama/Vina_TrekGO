export type RentalTrip = {
  id: string;
  name: string;
  status?: string;
  startAt: string;
  endAt: string;
  timezone: string;
};

export type RentalRecipientOption = {
  id: string;
  displayName: string;
  userId: string | null;
  status: string;
};

export type RentalLogisticsPoint = {
  id: string;
  name: string;
  address: string;
  scheduledAt: string;
};

export type RentalEligibility = {
  bookingId: string;
  eligible: boolean;
  reason: string | null;
  recipientOptions: RentalRecipientOption[];
  trip: RentalTrip;
  pickup: RentalLogisticsPoint | null;
  dropoff: RentalLogisticsPoint | null;
  rentalCutoffAt: string;
  contextVersion: number;
  existingOpenOrderId: string | null;
  allowedActions: string[];
};

export type RentalPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type RentalCategory = {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  status?: string;
};

export type RentalDepositPolicyType =
  | "FIXED"
  | "PERCENT_REPLACEMENT_VALUE";

export type RentalDepositPolicy = {
  type: string;
  amount: number;
  referenceValue: number | null;
  percentage: number | null;
};

export type RentalRecommendation = {
  productId: string;
  score: number;
  reasons: string[];
  source: "RULE" | "AI";
};

export type RentalProduct = {
  id: string;
  sku?: string;
  name: string;
  category: RentalCategory;
  description: string;
  dailyPrice: number;
  depositPolicy: RentalDepositPolicy;
  currency: string;
  replacementValue?: number;
  status?: string;
  version?: number;
  imageMediaIds?: string[];
  imageUrls: string[];
  spec: Record<string, unknown>;
  recommendationTags?: string[];
};

export type RentalAvailability = {
  bookingId: string;
  productId: string;
  availableCount: number;
  rentalWindow: {
    occupiedFrom: string;
    occupiedUntil: string;
  };
  checkedAt: string;
};

export type RentalTripSummary = {
  tripId: string;
  name: string;
  durationDays: number;
  difficulty: string;
  weatherSummary: string | null;
};

export type RentalRecommendationsData = {
  tripSummary: RentalTripSummary;
  recommendations: RentalRecommendation[];
  generatedAt: string;
};

export type RentalCatalogItem = RentalProduct & {
  availableCount: number | null;
  recommendation: RentalRecommendation | null;
};

export type RentalCatalogData = {
  eligibility: RentalEligibility;
  categories: RentalCategory[];
  items: RentalCatalogItem[];
  pagination: RentalPagination;
};

export type RentalProductDetailData = {
  product: RentalProduct;
  eligibility: RentalEligibility;
  availability: RentalAvailability;
  recommendation: RentalRecommendation | null;
  tripSummary: RentalTripSummary;
};

export type CreateRentalQuoteInput = {
  tripId: string;
  bookingId: string;
  recipientParticipantId?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

export type RentalQuote = {
  id: string;
  bookingId: string;
  recipient: {
    participantId: string;
    displayName: string;
  };
  chargedDays: number;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    availableCount: number;
    dailyPrice: number;
    feeAmount: number;
    depositPerUnit: number;
    depositAmount: number;
  }>;
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

export type RentalOrderSummary = {
  id: string;
  quoteId: string;
  bookingId: string | null;
  tripId: string;
  status: string;
  exceptionStatus: string;
  financialStatus: string;
  rentalFee: number;
  totalDeposit: number;
  totalAmount: number;
  currency: string;
  paymentExpiresAt: string;
  dueAt: string;
  version: number;
  createdAt: string;
};

export type RentalQuantityReservation = {
  id: string;
  orderLineId: string;
  productId: string;
  quantity: number;
  occupiedFrom: string;
  occupiedUntil: string;
  status: string;
  holdExpiresAt: string | null;
};

export type CreateRentalOrderResult = {
  order: RentalOrderSummary;
  quantityReservations: RentalQuantityReservation[];
};

export type RentalPaymentGateway = "momo" | "vnpay";
export type RentalPaymentMethod = "QR" | "REDIRECT";

export type RentalPaymentOptions = {
  gateways: Array<{
    gateway: RentalPaymentGateway;
    environment: string;
  }>;
};

export type RentalPaymentCheckout = {
  type: RentalPaymentMethod;
  url: string | null;
  qrData: string | null;
};

export type RentalPaymentCheckoutResponse = {
  paymentId: string;
  invoiceId: string;
  invoiceType: "RENTAL";
  status: string;
  amount: string;
  currency: string;
  providerEnvironment: string | null;
  gateway: string;
  checkout: RentalPaymentCheckout | null;
  expiresAt: string | null;
  reconciliationRequired: boolean;
};

export type StaffRentalProductStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type CreateStaffRentalProductInput = {
  categoryId: string;
  sku: string;
  name: string;
  description?: string | null;
  dailyPrice: number;
  currency: string;
  replacementValue: number;
  depositPolicy: {
    type: RentalDepositPolicyType;
    amount?: number | null;
    percentage?: number | null;
  };
  imageMediaIds?: string[];
  spec?: Record<string, unknown>;
  recommendationTags?: string[];
  requiresDeepInspectionAfterReturn?: boolean;
};

export type UpdateStaffRentalProductInput = {
  expectedVersion: number;
  name?: string;
  description?: string | null;
  dailyPrice?: number;
  replacementValue?: number;
  depositPolicy?: {
    type: RentalDepositPolicyType;
    amount?: number | null;
    percentage?: number | null;
  };
  imageMediaIds?: string[];
  spec?: Record<string, unknown>;
  recommendationTags?: string[];
  requiresDeepInspectionAfterReturn?: boolean;
};

export type ChangeStaffRentalProductStatusInput = {
  expectedVersion: number;
  status: StaffRentalProductStatus;
};

export type EquipmentUnitStatus =
  | "AVAILABLE"
  | "PICKED"
  | "PACKED"
  | "RENTED"
  | "RETURN_PENDING"
  | "CLEANING"
  | "MAINTENANCE"
  | "DAMAGED"
  | "LOST"
  | "RETIRED";

export type EquipmentCondition = "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "LOST";

export type InventoryLocation = {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED" | string;
};

export type EquipmentUnit = {
  id: string;
  assetCode: string;
  qrCode: string | null;
  serialNumber: string | null;
  product: {
    id: string;
    sku: string;
    name: string;
  };
  homeInventoryLocation: {
    id: string;
    code: string;
    name: string;
  };
  currentInventoryLocation: {
    id: string;
    code: string;
    name: string;
  } | null;
  status: EquipmentUnitStatus;
  condition: EquipmentCondition;
  expectedReadyAt: string | null;
  acquiredAt: string | null;
  retiredAt: string | null;
  version: number;
};

export type EquipmentUnitCounts = {
  total: number;
  available: number;
  picked: number;
  packed: number;
  rented: number;
  returnPending: number;
  cleaning: number;
  maintenance: number;
  damaged: number;
  lost: number;
  retired: number;
};

export type EquipmentUnitHistoryEvent = {
  type: string;
  occurredAt: string;
  actor?: string;
  details?: Record<string, unknown>;
};

export type EquipmentUnitDetail = {
  unit: EquipmentUnit;
  history: EquipmentUnitHistoryEvent[];
};

export type EquipmentLabel = {
  unitId: string;
  assetCode: string;
  qrPayload: string;
  printText: string;
};

export type ListEquipmentUnitsOptions = {
  page?: number;
  pageSize?: number;
  productId?: string;
  status?: EquipmentUnitStatus;
  condition?: EquipmentCondition;
  inventoryLocationId?: string;
  q?: string;
  signal?: AbortSignal;
};

export type CreateEquipmentUnitInput = {
  productId: string;
  homeInventoryLocationId: string;
  assetCode?: string;
  serialNumber?: string;
  condition?: "NEW" | "GOOD" | "FAIR";
  acquiredAt?: string;
};

export type BatchCreateEquipmentUnitsInput = {
  productId: string;
  homeInventoryLocationId: string;
  quantity: number;
  assetCodeMode: "AUTO" | "PROVIDED";
  assetCodes?: string[];
  condition?: "NEW" | "GOOD" | "FAIR";
  acquiredAt?: string;
};

export type UpdateEquipmentUnitInput = {
  expectedVersion: number;
  homeInventoryLocationId?: string;
  serialNumber?: string | null;
  acquiredAt?: string | null;
};

export type ChangeEquipmentMaintenanceInput =
  | {
      action: "START";
      reason: string;
      notes?: string;
      expectedVersion: number;
    }
  | {
      action: "COMPLETE";
      resultingCondition: EquipmentCondition;
      expectedVersion: number;
    };

export type StaffRentalDepositPolicyInput =
  | {
      type: "FIXED";
      amount: number;
    }
  | {
      type: "PERCENT_REPLACEMENT_VALUE";
      percentage: number;
    };
