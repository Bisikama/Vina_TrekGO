import { COMMON_ERROR_CODES } from './codes/common.error-codes';
import { LEADER_ERROR_CODES as L } from './codes/leader.error-codes';
import { RENTAL_ERROR_CODES } from './codes/rental.error-codes';
import { MEDIA_ERROR_CODES } from './codes/media.error-codes';
import { BOOKING_ERROR_CODES as B } from './codes/booking.error-codes';
import { PAYMENT_ERROR_CODES as P } from './codes/payment.error-codes';
import { NOTIFICATION_ERROR_CODES } from './codes/notification.error-codes';
import { RENTAL_ORDERING_ERROR_CODES as RO } from './codes/rental-ordering.error-codes';

export interface ErrorDefinition {
  status: number;
  message: string;
  retryable: boolean;
}

export const ERROR_DEFINITIONS: Record<string, ErrorDefinition> = {
  [L.LEADER_CANNOT_APPLY]: { status: 403, message: 'Leader accounts cannot submit applications', retryable: false },
  [L.APPLICATION_NOT_FOUND]: { status: 404, message: 'Application not found', retryable: false },
  [L.DOCUMENT_NOT_FOUND]: { status: 404, message: 'Private document not found', retryable: false },
  [L.APPLICATION_ALREADY_PENDING]: { status: 409, message: 'An application is already pending', retryable: false },
  [L.APPLICATION_NOT_REVIEWABLE]: { status: 409, message: 'Application is no longer reviewable', retryable: false },
  [L.CERTIFICATE_REQUIRED]: { status: 422, message: 'At least one certificate is required', retryable: false },
  [L.INVALID_CERTIFICATE_TYPE]: { status: 422, message: 'Invalid certificate type or OTHER description', retryable: false },
  [L.INVALID_CERTIFICATE_FILE]: { status: 422, message: 'Certificate file must be ready, private, unused and owned by the applicant', retryable: false },
  [L.INVALID_CERTIFICATE_REVIEW]: { status: 422, message: 'Certificate reviews must be unique and belong to this application', retryable: false },
  [L.CERTIFICATE_EXPIRED]: { status: 422, message: 'No verified certificate is currently valid', retryable: false },
  [L.REJECTION_REASON_REQUIRED]: { status: 422, message: 'A rejection reason is required', retryable: false },
  [L.NO_VALID_CERTIFICATE]: { status: 422, message: 'Review all pending certificates and verify at least one valid certificate', retryable: false },
  [B.ACTIVE_BOOKING_EXISTS]: { status: 409, message: 'An active booking already exists for this trip', retryable: false },
  [B.BOOKING_VERSION_CONFLICT]: { status: 409, message: 'Booking changed; reload before updating participants', retryable: false },
  [B.BOOKING_POLICY_UNAVAILABLE]: { status: 503, message: 'An effective booking policy is required', retryable: true },
  [B.BOOKING_CANCELLATION_NOT_ALLOWED]: { status: 409, message: 'Booking cannot be cancelled in its current state', retryable: false },
  [B.BOOKING_CANCELLATION_POLICY_INVALID]: { status: 422, message: 'Booking cancellation policy snapshot is missing or invalid', retryable: false },
  [P.REFUND_SOURCE_INVALID]: { status: 422, message: 'Refund source does not match an approved payment decision', retryable: false },
  [P.REFUND_AMOUNT_EXCEEDED]: { status: 409, message: 'Refund exceeds the approved remaining amount', retryable: false },
  [P.PAYMENT_WEBHOOK_INVALID_SIGNATURE]: { status: 401, message: 'Invalid payment webhook signature', retryable: false },
  [P.PAYMENT_WEBHOOK_STORAGE_UNAVAILABLE]: { status: 503, message: 'Payment webhook storage is temporarily unavailable', retryable: true },
  [B.BOOKING_HOLD_EXPIRED]: { status: 410, message: 'Booking hold has expired', retryable: false },
  [P.PAYMENT_NOT_FOUND]: { status: 404, message: 'Payment resource not found', retryable: false },
  [P.PAYMENT_INVALID_STATE]: { status: 409, message: 'Invoice is not payable', retryable: false },
  [P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD]: { status: 409, message: 'Idempotency key was used for a different request', retryable: false },
  [P.PAYMENT_ATTEMPT_IN_PROGRESS]: { status: 409, message: 'A payment attempt is still unresolved', retryable: false },
  [P.PAYMENT_AMOUNT_MISMATCH]: { status: 422, message: 'Payment amount or currency does not match', retryable: false },
  [P.PAYMENT_PROVIDER_UNAVAILABLE]: { status: 503, message: 'Payment provider is temporarily unavailable', retryable: true },
  [B.INVITE_RATE_LIMITED]: { status: 429, message: 'Too many invite requests; retry later', retryable: true },
  [B.CAPACITY_CONFLICT]: { status: 409, message: 'Trip has no remaining slots', retryable: false },
  [B.MEMBERSHIP_VERSION_CONFLICT]: { status: 409, message: 'Reload membership before retrying', retryable: false },
  [B.INVITE_USAGE_LIMIT_REACHED]: { status: 409, message: 'Invite usage limit reached', retryable: false },
  [B.INVITE_EXPIRED]: { status: 410, message: 'Invite has expired', retryable: false },
  [B.INVITE_REVOKED]: { status: 410, message: 'Invite has been revoked', retryable: false },
  [B.TRAIL_ACCESS_REQUIRED]: { status: 403, message: 'Active trail access required', retryable: false },
  [B.LEADER_CANNOT_CREATE_PRIVATE_TRIP]: { status: 403, message: 'Leaders cannot create private trips', retryable: false },
  [B.NOT_FOUND]: { status: 404, message: 'Resource not found', retryable: false },
  [B.INVALID_STATE_TRANSITION]: { status: 409, message: 'Operation requires an OPEN trip before start', retryable: false },
  [B.INVALID_TRAIL_FOR_TRIP_TYPE]: { status: 422, message: 'Invalid trail or checkpoint context', retryable: false },
  [B.PRIVATE_TRIP_VERSION_CONFLICT]: { status: 409, message: 'Reload the trip before retrying', retryable: false },
  // Common
  [COMMON_ERROR_CODES.VALIDATION_ERROR]: { status: 400, message: 'Validation failed', retryable: false },
  [COMMON_ERROR_CODES.UNAUTHENTICATED]: { status: 401, message: 'Unauthenticated access', retryable: false },
  [COMMON_ERROR_CODES.FORBIDDEN]: { status: 403, message: 'Forbidden access', retryable: false },
  [COMMON_ERROR_CODES.INTERNAL_ERROR]: { status: 500, message: 'Internal server error', retryable: true },

  // Rental
  [RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND]: { status: 404, message: 'Rental product not found', retryable: false },
  [RENTAL_ERROR_CODES.RENTAL_PRODUCT_ARCHIVED]: { status: 422, message: 'Rental product is archived and cannot be instantiated', retryable: false },
  [RENTAL_ERROR_CODES.RENTAL_CATEGORY_NOT_FOUND]: { status: 404, message: 'Rental category not found', retryable: false },
  [RENTAL_ERROR_CODES.RENTAL_CATEGORY_INACTIVE]: { status: 422, message: 'Rental category is inactive', retryable: false },
  [RENTAL_ERROR_CODES.RENTAL_PRODUCT_SKU_EXISTS]: { status: 409, message: 'Rental product SKU already exists', retryable: false },
  [RENTAL_ERROR_CODES.INVALID_DAILY_PRICE]: { status: 422, message: 'Invalid daily price', retryable: false },
  [RENTAL_ERROR_CODES.INVALID_REPLACEMENT_VALUE]: { status: 422, message: 'Invalid replacement value', retryable: false },
  [RENTAL_ERROR_CODES.INVALID_DEPOSIT_POLICY]: { status: 422, message: 'Invalid deposit policy', retryable: false },
  [RENTAL_ERROR_CODES.VERSION_CONFLICT]: { status: 409, message: 'Version conflict. The resource was updated by another transaction.', retryable: true },
  [RENTAL_ERROR_CODES.INVENTORY_LOCATION_NOT_FOUND]: { status: 404, message: 'Inventory location not found', retryable: false },
  [RENTAL_ERROR_CODES.INVENTORY_LOCATION_INACTIVE]: { status: 422, message: 'Inventory location is inactive', retryable: false },
  
  [RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND]: { status: 404, message: 'Equipment unit not found', retryable: false },
  [RENTAL_ERROR_CODES.EQUIPMENT_ASSET_CODE_EXISTS]: { status: 409, message: 'Equipment asset code already exists', retryable: false },
  [RENTAL_ERROR_CODES.EQUIPMENT_QR_CODE_EXISTS]: { status: 409, message: 'Equipment QR code already exists', retryable: false },
  [RENTAL_ERROR_CODES.INVALID_EQUIPMENT_CONDITION]: { status: 422, message: 'Invalid equipment condition', retryable: false },
  [RENTAL_ERROR_CODES.INVALID_EQUIPMENT_STATE_TRANSITION]: { status: 409, message: 'Invalid equipment state transition', retryable: false },
  [RENTAL_ERROR_CODES.EQUIPMENT_UNIT_RENTED]: { status: 409, message: 'Equipment unit is currently rented', retryable: false },
  [RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_MAINTAINABLE]: { status: 409, message: 'Equipment unit state is not maintainable', retryable: false },
  [RENTAL_ERROR_CODES.BATCH_QUANTITY_INVALID]: { status: 400, message: 'Batch quantity must be greater than 0', retryable: false },
  [RENTAL_ERROR_CODES.BATCH_ASSET_CODE_COUNT_MISMATCH]: { status: 400, message: 'Number of provided asset codes does not match quantity', retryable: false },
  [RENTAL_ERROR_CODES.BATCH_ASSET_CODE_DUPLICATE]: { status: 400, message: 'Duplicate asset codes provided in batch', retryable: false },
  [RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_NOT_ACTIVE]: { status: 409, message: 'Equipment maintenance is not active', retryable: false },
  [RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_STATE_CONFLICT]: { status: 409, message: 'Multiple active maintenance records found', retryable: false },
  // --- MEDIA ---
  [MEDIA_ERROR_CODES.MEDIA_NOT_FOUND]: { status: 404, message: 'Media asset not found', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_INVALID_SCOPE]: { status: 422, message: 'Invalid media scope', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_INVALID_RESOURCE_TYPE]: { status: 422, message: 'Invalid media resource type', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_FILE_TOO_LARGE]: { status: 413, message: 'Media file too large', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_MIME_TYPE]: { status: 422, message: 'Unsupported media MIME type', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_UPLOAD_EXPIRED]: { status: 410, message: 'Media upload intent expired', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_UPLOAD_SIGNATURE_INVALID]: { status: 422, message: 'Invalid upload signature', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH]: { status: 409, message: 'Provider metadata mismatch', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_INVALID_STATE]: { status: 409, message: 'Invalid media state for this operation', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR]: { status: 502, message: 'Media provider error', retryable: true },
  [MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_FORMAT]: { status: 422, message: 'Unsupported media format', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_INVALID_DIMENSIONS]: { status: 422, message: 'Invalid media dimensions', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_VIDEO_TOO_LONG]: { status: 422, message: 'Video duration exceeds maximum allowed', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_INVALID_MEDIA_METADATA]: { status: 422, message: 'Invalid or missing media metadata from provider', retryable: false },
  // --- NOTIFICATION ---
  [NOTIFICATION_ERROR_CODES.NOTIFICATION_NOT_FOUND]: { status: 404, message: 'Notification not found or access denied', retryable: false },
  [RO.INSUFFICIENT_AVAILABLE_QUANTITY]: { status: 400, message: 'Insufficient available quantity for rental', retryable: false },
  [RO.QUOTE_NOT_ACTIVE]: { status: 400, message: 'Quote is no longer active', retryable: false },
  [RO.QUOTE_EXPIRED]: { status: 400, message: 'Quote has expired', retryable: false },
};
