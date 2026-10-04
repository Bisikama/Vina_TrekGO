export type RentalTrip = {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  timezone: string;
};

export type RentalEligibility = {
  bookingId: string;
  eligible: boolean;
  reason: string | null;
  trip: RentalTrip;
  rentalCutoffAt: string;
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

export type RentalDepositPolicy = {
  type: string;
  amount: number;
  referenceValue: number | null;
  percentage: number | null;
};

export type RentalRecommendation = {
  productId: string;
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

export type RentalCatalogItem = RentalProduct & {
  availableCount: number;
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
  availability: RentalAvailability;
  recommendation: RentalRecommendation | null;
  tripSummary: RentalTripSummary;
};

export type StaffRentalProductStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ARCHIVED";

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

export type EquipmentCondition =
  | "NEW"
  | "GOOD"
  | "FAIR"
  | "DAMAGED"
  | "LOST";

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
