// ==========================================
// 1. CORE: IDENTITY, AUTHENTICATION & PROFILES
// ==========================================

export enum UserRole {
  USER = 'USER',
  LEADER = 'LEADER',
  USER_LEADER = 'USER_LEADER',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
  PENDING = 'PENDING',
}

export enum IdentityProvider {
  GOOGLE = 'GOOGLE',
  FACEBOOK = 'FACEBOOK',
  APPLE = 'APPLE',
}

export enum LeaderType {
  COMMUNITY = 'COMMUNITY',
  SYSTEM = 'SYSTEM',
}

export enum LeaderVerifyStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

// ==========================================
// 2. TOURS, LOGISTICS & CHECKPOINTS
// ==========================================

export enum TourType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum TourDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  EXTREME = 'EXTREME',
}

export enum TourStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum LocationType {
  PICKUP = 'PICKUP',
  DROPOFF = 'DROPOFF',
  CHECKPOINT = 'CHECKPOINT',
}

export enum TourLocationRole {
  START = 'START',
  CHECKPOINT = 'CHECKPOINT',
  END = 'END',
  PICKUP = 'PICKUP',
  DROPOFF = 'DROPOFF',
}

// ==========================================
// 3. BOOKINGS & PARTICIPANTS
// ==========================================

export enum BookingStatus {
  PENDING = 'PENDING',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum BookingParticipantStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum CheckInStatus {
  PRESENT = 'PRESENT',
  NO_SHOW = 'NO_SHOW',
}

// ==========================================
// 4. INSURANCE & RISK MANAGEMENT
// ==========================================

export enum BookingInsuranceStatus {
  ACTIVE = 'ACTIVE',
  CLAIMED = 'CLAIMED',
  CANCELLED = 'CANCELLED',
}

export enum InsuranceClaimStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum IncidentType {
  MEDICAL = 'MEDICAL',
  WEATHER = 'WEATHER',
  LOST_PERSON = 'LOST_PERSON',
  ACCIDENT = 'ACCIDENT',
  OTHER = 'OTHER',
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

// ==========================================
// 5. E-COMMERCE, INVENTORY & RENTAL
// ==========================================

export enum EquipmentStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  RENTED = 'RENTED',
  MAINTENANCE = 'MAINTENANCE',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

export enum EquipmentCondition {
  GOOD = 'GOOD',
  USED = 'USED',
  DAMAGED = 'DAMAGED',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum RentalDepositStatus {
  HOLDING = 'HOLDING',
  REFUNDED = 'REFUNDED',
  PARTIAL_REFUNDED = 'PARTIAL_REFUNDED',
}

export enum RentalContractStatus {
  PENDING_HANDOVER = 'PENDING_HANDOVER',
  IN_USE = 'IN_USE',
  RETURNED = 'RETURNED',
  DISPUTED = 'DISPUTED',
  CANCELLED = 'CANCELLED',
}

export enum RentalItemReturnStatus {
  GOOD = 'GOOD',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

// ==========================================
// 6. FINANCE: INVOICE, PAYMENT & REFUND
// ==========================================

export enum InvoiceSourceType {
  TOUR_BOOKING = 'TOUR_BOOKING',
  SHOP_ORDER = 'SHOP_ORDER',
  MIXED = 'MIXED',
}

export enum InvoiceStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum InvoiceLineItemType {
  TOUR_FEE = 'TOUR_FEE',
  INSURANCE = 'INSURANCE',
  BUY_ITEM = 'BUY_ITEM',
  RENT_FEE = 'RENT_FEE',
  RENT_DEPOSIT = 'RENT_DEPOSIT',
  PENALTY = 'PENALTY',
  DISCOUNT = 'DISCOUNT',
}

export enum PaymentMethod {
  VNPAY = 'VNPAY',
  MOMO = 'MOMO',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum RefundType {
  CANCEL_TOUR = 'CANCEL_TOUR',
  RETURN_DEPOSIT = 'RETURN_DEPOSIT',
  ORDER_REFUND = 'ORDER_REFUND',
  PARTIAL_REFUND = 'PARTIAL_REFUND',
}

export enum RefundStatus {
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  REJECTED = 'REJECTED',
}

// ==========================================
// 7. GAMIFICATION & REWARD
// ==========================================

export enum PointTransactionType {
  EARN = 'EARN',
  SPEND = 'SPEND',
  PENALTY = 'PENALTY',
}

// ==========================================
// 8. NOTIFICATIONS & AUDIT LOGS
// ==========================================

export enum NotificationType {
  ALERT = 'ALERT',
  PROMO = 'PROMO',
  SYSTEM = 'SYSTEM',
}

export enum AuditEntityType {
  BOOKING = 'BOOKING',
  PAYMENT = 'PAYMENT',
  ORDER = 'ORDER',
  USER = 'USER',
  TOUR = 'TOUR',
  INVOICE = 'INVOICE',
  RENTAL_CONTRACT = 'RENTAL_CONTRACT',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}
