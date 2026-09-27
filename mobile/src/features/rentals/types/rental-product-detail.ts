import type {
  RentalCategory,
  RentalRecommendation,
} from './rental-catalog';

export type RentalDepositPolicy = {
  type: string;
  amount: number;
  referenceValue: number | null;
  percentage: number | null;
};

export type RentalProductDetail = {
  id: string;
  sku: string;
  name: string;
  category: RentalCategory;
  description: string;
  dailyPrice: number;
  depositPolicy: RentalDepositPolicy;
  currency: string;
  status: string;
  imageUrls: string[];
  spec: Record<string, unknown>;
  recommendationTags: string[];
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

export type RentalProductDetailData = {
  product: RentalProductDetail;
  availability: RentalAvailability;
  recommendation: RentalRecommendation | null;
  tripSummary: RentalTripSummary;
};