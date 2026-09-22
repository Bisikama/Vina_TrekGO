// =============================================================================
// TREKGO PLATFORM - SYSTEM ENUMS & CONSTANTS (v2.0)
// Consolidated Reference from docs/master.md, bao.md, luat.md, quan.md & DBML v2.0
// =============================================================================

// =============================================================================
// 1. CORE: IDENTITY, AUTHENTICATION & PROFILES (Shared Platform / Supabase)
// =============================================================================

export enum UserRole {
  USER = 'USER',
  LEADER = 'LEADER',
  STAFF_WAREHOUSE = 'STAFF_WAREHOUSE',
  STAFF_LOGISTICS = 'STAFF_LOGISTICS',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export enum LeaderVerifyStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum LeaderTestStatus {
  NOT_TAKEN = 'NOT_TAKEN',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
}

// =============================================================================
// 2. DESTINATIONS, TRAILS & CHECKPOINTS (Area A - Bảo & Area C - Luật)
// =============================================================================

export enum DestinationRegion {
  NORTH = 'NORTH',
  CENTRAL = 'CENTRAL',
  SOUTH = 'SOUTH',
}

export enum DestinationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum TrailDifficulty {
  EASY = 'EASY',
  MODERATE = 'MODERATE',
  HARD = 'HARD',
  EXTREME = 'EXTREME',
}

export enum SystemTrailStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum PersonalTrailStatus {
  DRAFT = 'DRAFT',
  READY = 'READY',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum TrailAccessSourceType {
  PURCHASED = 'PURCHASED',
  PROMO = 'PROMO',
  SYSTEM_FREE = 'SYSTEM_FREE',
}

export enum TrailAccessStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

export enum CheckpointType {
  START = 'START',
  CAMPSITE = 'CAMPSITE',
  SUMMIT = 'SUMMIT',
  WATER_SOURCE = 'WATER_SOURCE',
  VIEWPOINT = 'VIEWPOINT',
  END = 'END',
}

export enum CheckpointStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

// =============================================================================
// 3. TRIPS, BOOKINGS & PRIVATE MEMBERSHIPS (Area A - Bảo)
// =============================================================================

export enum TripType {
  PUBLIC = 'PUBLIC', // Tour thương mại do Leader dẫn đoàn, đặt qua Booking
  PRIVATE = 'PRIVATE', // Nhóm tự tổ chức do Host tạo, join qua invite code
}

export enum TripTrailType {
  SYSTEM = 'SYSTEM',
  PERSONAL = 'PERSONAL',
}

export enum TripStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  REGISTRATION_OPEN = 'REGISTRATION_OPEN',
  REGISTRATION_CLOSED = 'REGISTRATION_CLOSED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCEL_PENDING = 'CANCEL_PENDING',
  CANCELLED = 'CANCELLED',
  INTERRUPTED = 'INTERRUPTED',
}

export enum TripCheckpointStatus {
  PENDING = 'PENDING',
  ARRIVED = 'ARRIVED',
  REACHED = 'REACHED',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  OVERRIDDEN = 'OVERRIDDEN',
}

export enum CheckpointMissionType {
  QUIZ = 'QUIZ',
  PHOTO_EVIDENCE = 'PHOTO_EVIDENCE',
  CHECKIN_ONLY = 'CHECKIN_ONLY',
  QR_CODE = 'QR_CODE',
  GPS_LOCATION = 'GPS_LOCATION',
}

export enum TripTransportType {
  PICKUP = 'PICKUP',
  DROPOFF = 'DROPOFF',
}

export enum VehicleType {
  SEATER_16 = '16_SEATER',
  SEATER_29 = '29_SEATER',
  SEATER_45 = '45_SEATER',
}

export enum BookingStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum BookingParticipantStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum ParticipantCheckinStatus {
  PENDING = 'PENDING',
  CHECKED_IN = 'CHECKED_IN',
}

export enum PrivateTripInviteStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum TripMemberRole {
  HOST = 'HOST',
  MEMBER = 'MEMBER',
}

export enum TripMemberStatus {
  ACTIVE = 'ACTIVE',
  LEFT = 'LEFT',
  REMOVED = 'REMOVED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

export enum TripMemberAttendanceStatus {
  PENDING = 'PENDING',
  PRESENT = 'PRESENT',
  NO_SHOW = 'NO_SHOW',
}

// =============================================================================
// 4. EQUIPMENT RENTAL, INVENTORY & LOGISTICS (Area B - Quân)
// =============================================================================

export enum EquipmentUnitStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  PICKED = 'PICKED',
  PACKED = 'PACKED',
  RENTED = 'RENTED',
  RETURN_PENDING = 'RETURN_PENDING',
  MAINTENANCE = 'MAINTENANCE',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

export enum EquipmentCondition {
  NEW = 'NEW',
  GOOD = 'GOOD',
  USED = 'USED',
  DAMAGED = 'DAMAGED',
}

export enum RentalOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  READY_FOR_HANDOVER = 'READY_FOR_HANDOVER',
  ACTIVE = 'ACTIVE',
  RETURN_PENDING = 'RETURN_PENDING',
  INSPECTED = 'INSPECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum EquipmentReservationStatus {
  RESERVED = 'RESERVED',
  RELEASED = 'RELEASED',
  FULFILLED = 'FULFILLED',
}

export enum PackageStatus {
  PACKED = 'PACKED',
  IN_TRANSIT = 'IN_TRANSIT',
  HANDED_OVER = 'HANDED_OVER',
  RETURNED = 'RETURNED',
  DISBANDED = 'DISBANDED',
}

export enum WarehouseTaskStatus {
  OPEN = 'OPEN',
  PICKING = 'PICKING',
  CONDITION_CAPTURED = 'CONDITION_CAPTURED',
  PACKED = 'PACKED',
  READY = 'READY',
  TRANSFERRED = 'TRANSFERRED',
  CLOSED = 'CLOSED',
}

export enum LogisticsTaskType {
  HANDOVER = 'HANDOVER',
  RETURN_COLLECT = 'RETURN_COLLECT',
}

export enum LogisticsTaskStatus {
  SCHEDULED = 'SCHEDULED',
  PACKAGE_RECEIVED = 'PACKAGE_RECEIVED',
  USER_VERIFIED = 'USER_VERIFIED',
  HANDED_OVER = 'HANDED_OVER',
  RETURN_DUE = 'RETURN_DUE',
  RETURNED = 'RETURNED',
  NO_SHOW = 'NO_SHOW',
  CLOSED = 'CLOSED',
}

export enum ConditionSnapshotStage {
  PRE_HANDOVER = 'PRE_HANDOVER',
  POST_RETURN = 'POST_RETURN',
}

export enum ConditionGrade {
  GOOD = 'GOOD',
  SCRATCHED = 'SCRATCHED',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

export enum ReturnInspectionStage {
  LOGISTICS_PRELIMINARY = 'LOGISTICS_PRELIMINARY',
  WAREHOUSE_FINAL = 'WAREHOUSE_FINAL',
}

export enum ReturnInspectionStatus {
  NORMAL = 'NORMAL',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

export enum DepositSettlementStatus {
  PENDING = 'PENDING',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  FORFEITED = 'FORFEITED',
}

export enum MaintenanceStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

// =============================================================================
// 5. GPS TRACKING, MAPLIBRE 3D & WEATHER (Area C - Luật)
// =============================================================================

export enum GpsSessionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
}

export enum RouteDeviationStatus {
  DEVIATED = 'DEVIATED',
  RECOVERED = 'RECOVERED',
}

export enum CheckpointEventStatus {
  ARRIVED = 'ARRIVED',
  VALIDATED = 'VALIDATED',
}

export enum CheckpointMissionStatus {
  LOCKED = 'LOCKED',
  UNLOCKED = 'UNLOCKED',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

export enum WeatherProvider {
  OPENWEATHER = 'OPENWEATHER',
  TOMORROW_IO = 'TOMORROW_IO',
}

export enum WeatherCondition {
  SUNNY = 'SUNNY',
  RAIN = 'RAIN',
  FOG = 'FOG',
  THUNDERSTORM = 'THUNDERSTORM',
}

export enum WeatherRiskSummary {
  SAFE = 'SAFE',
  MODERATE_RAIN = 'MODERATE_RAIN',
  HIGH_WIND = 'HIGH_WIND',
  STORM_DANGER = 'STORM_DANGER',
}

export enum TrailRecordingStatus {
  RECORDING = 'RECORDING',
  STOPPED = 'STOPPED',
  PROCESSED = 'PROCESSED',
  SUBMITTED = 'SUBMITTED',
}

// =============================================================================
// 6. SHARED FINANCE: INVOICES, PAYMENTS & REFUNDS
// =============================================================================

export enum InvoiceType {
  TRIP_BOOKING = 'TRIP_BOOKING',
  RENTAL_FEE = 'RENTAL_FEE',
  TRAIL_PURCHASE = 'TRAIL_PURCHASE',
  DEPOSIT_DEDUCTION = 'DEPOSIT_DEDUCTION',
}

export enum InvoiceStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentGateway {
  VNPAY = 'VNPAY',
  MOMO = 'MOMO',
  PAYOS = 'PAYOS',
  STRIPE = 'STRIPE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum RefundType {
  CANCEL_BOOKING = 'CANCEL_BOOKING',
  DEPOSIT_RETURN = 'DEPOSIT_RETURN',
  RENTAL_CANCEL = 'RENTAL_CANCEL',
}

export enum RefundStatus {
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

// =============================================================================
// 7. GAMIFICATION, REVIEWS & AUDIT LOGS
// =============================================================================

export enum RankLevel {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

export enum PointTransactionType {
  EARN_CHECKPOINT = 'EARN_CHECKPOINT',
  EARN_TRIP = 'EARN_TRIP',
  SPEND_RENTAL = 'SPEND_RENTAL',
  PENALTY = 'PENALTY',
}

export enum NotificationType {
  TRIP_ALERT = 'TRIP_ALERT',
  DEVIATION_WARNING = 'DEVIATION_WARNING',
  RENTAL_REMINDER = 'RENTAL_REMINDER',
  SYSTEM = 'SYSTEM',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  OVERRIDE = 'OVERRIDE',
}

export enum AuditEntityType {
  BOOKING = 'BOOKING',
  RENTAL_ORDER = 'RENTAL_ORDER',
  TRIP = 'TRIP',
  CHECKPOINT = 'CHECKPOINT',
  USER = 'USER',
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
}
