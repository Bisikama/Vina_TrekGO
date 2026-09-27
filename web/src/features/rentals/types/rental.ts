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

export type RentalCategory = {
  id: string;
  name: string;
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
  status?: string;
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
};

export type RentalProductDetailData = {
  product: RentalProduct;
  availability: RentalAvailability;
  recommendation: RentalRecommendation | null;
  tripSummary: RentalTripSummary;
};