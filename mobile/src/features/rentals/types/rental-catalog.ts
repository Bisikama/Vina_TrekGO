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

export type RentalProduct = {
  id: string;
  name: string;
  description: string;
  category: RentalCategory;
  dailyPrice: number;
  depositAmount: number;
  currency: string;
  imageUrl: string | null;
  spec: Record<string, unknown>;
};

export type RentalRecommendation = {
  productId: string;
  reasons: string[];
  source: 'RULE' | 'AI';
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
