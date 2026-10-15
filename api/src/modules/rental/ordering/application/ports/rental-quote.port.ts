export interface CreateRentalQuoteLineRecord {
  productId: string;
  occupiedFrom: Date;
  occupiedUntil: Date;
  quantity: number;
  dailyPriceSnapshot: string;
  depositPerUnitSnapshot: string;
  replacementValueSnapshot: string;
  chargedDays: number;
  lineRentalFee: string;
  lineDeposit: string;
}

export interface CreateRentalQuoteRecord {
  userId: string;
  tripId: string;
  bookingId: string | null;
  membershipRef: string;
  membershipSnapshot: Record<string, unknown>;
  pickupPointId: string;
  returnPointId: string;
  returnOptionSnapshot: Record<string, unknown> | null;
  recipientUserId: string;
  recipientParticipantId: string | null;
  recipientSnapshot: Record<string, unknown>;
  contextVersion: number;
  rentalPolicyId: string;
  rentalStartAt: Date;
  rentalEndAt: Date;
  plannedHandoverAt: Date;
  plannedReturnAt: Date;
  occupiedStartAt: Date;
  occupiedEndAt: Date;
  rentalFee: string;
  totalDeposit: string;
  totalAmount: string;
  currency: string;
  policySnapshot: Record<string, unknown>;
  expiresAt: Date;
  lines: CreateRentalQuoteLineRecord[];
}

export interface PersistedRentalQuote {
  id: string;
  expiresAt: Date;
  createdAt: Date;
}

export const RENTAL_QUOTE_PORT = Symbol('RENTAL_QUOTE_PORT');

export interface RentalQuotePort {
  createQuote(data: CreateRentalQuoteRecord): Promise<PersistedRentalQuote>;
}