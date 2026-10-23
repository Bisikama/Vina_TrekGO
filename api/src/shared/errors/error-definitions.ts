import { COMMON_ERROR_CODES } from './codes/common.error-codes'
import { TRIP_TRANSPORT_ERROR_CODES as TT } from './codes/trip-transport.error-codes'
import { LEADER_ERROR_CODES as L } from './codes/leader.error-codes'
import { RENTAL_ERROR_CODES } from './codes/rental.error-codes'
import { MEDIA_ERROR_CODES } from './codes/media.error-codes'
import { BOOKING_ERROR_CODES as B } from './codes/booking.error-codes'
import { PAYMENT_ERROR_CODES as P } from './codes/payment.error-codes'
import { NOTIFICATION_ERROR_CODES } from './codes/notification.error-codes'
import { RENTAL_ORDERING_ERROR_CODES as RO } from './codes/rental-ordering.error-codes'
import { PREPARATION_ERROR_CODES as PR } from './codes/preparation.error-codes'
import { DELIVERY_ERROR_CODES as DL } from './codes/delivery.error-codes'
import { RENTAL_RETURN_ERROR_CODES as RR } from './codes/rental-return.error-codes'
import { RENTAL_DOCUMENT_ERROR_CODES as RD } from './codes/rental-document.error-codes'
import { RENTAL_LIFECYCLE_ERROR_CODES as LC } from './codes/rental-lifecycle.error-codes'
import { PersonalTrailErrorCode as PT } from './codes/personal-trail.error-codes'
import { GEAR_ERROR_CODES as G } from './codes/gear.error-codes'

export interface ErrorDefinition {
  status: number
  message: string
  retryable: boolean
}

export const ERROR_DEFINITIONS: Record<string, ErrorDefinition> = {
  [B.PENDING_INVITATION_EXISTS]: {
    status: 409,
    message: 'An unexpired invitation is already pending',
    retryable: false,
  },
  [B.INVITATION_NOT_ACTIONABLE]: { status: 409, message: 'Invitation no longer allows this action', retryable: false },
  [B.INVITATION_RECIPIENT_UNAVAILABLE]: { status: 422, message: 'This account cannot be invited', retryable: false },
  [RD.INTEGRITY_FAILED]: { status: 409, message: 'Document integrity verification failed', retryable: false },
  [RD.CORRECTION_NOT_ALLOWED]: { status: 409, message: 'Document correction is not allowed', retryable: false },
  [RD.RENDER_RETRY_EXHAUSTED]: { status: 409, message: 'Document render retry limit reached', retryable: false },
  [RD.STORAGE_UNAVAILABLE]: { status: 503, message: 'Private document storage unavailable', retryable: true },
  [RD.AUDIT_UNAVAILABLE]: { status: 503, message: 'Document access audit unavailable', retryable: true },
  [TT.NOT_FOUND]: {
    status: 404,
    message: 'Không tìm thấy chuyến public, nhà xe hoặc xe của chuyến.',
    retryable: false,
  },
  [TT.PROVIDER_UNAVAILABLE]: { status: 409, message: 'Nhà xe không tồn tại hoặc đã ngừng hợp tác.', retryable: false },
  [TT.LOCKED]: {
    status: 409,
    message: 'Không được sửa xe đã hủy hoặc chuyến đã bắt đầu/kết thúc/hủy.',
    retryable: false,
  },
  [TT.VERSION_CONFLICT]: { status: 409, message: 'Thông tin xe đã thay đổi. Hãy tải lại.', retryable: false },
  [B.BOOKING_POLICY_INVALID]: {
    status: 503,
    message: 'Booking policy configuration is invalid or ambiguous',
    retryable: false,
  },
  [B.BOOKING_POLICY_NOT_FOUND]: { status: 404, message: 'Booking policy not found', retryable: false },
  [B.BOOKING_POLICY_IMMUTABLE]: {
    status: 409,
    message: 'Published policies cannot be edited or deleted; create a new draft',
    retryable: false,
  },
  [B.BOOKING_POLICY_VERSION_CONFLICT]: {
    status: 409,
    message: 'Policy changed or a newer version was published; reload or create a new draft',
    retryable: false,
  },
  [L.LEADER_CANNOT_APPLY]: { status: 403, message: 'Leader accounts cannot submit applications', retryable: false },
  [L.APPLICATION_NOT_FOUND]: { status: 404, message: 'Application not found', retryable: false },
  [L.DOCUMENT_NOT_FOUND]: { status: 404, message: 'Private document not found', retryable: false },
  [L.APPLICATION_ALREADY_PENDING]: { status: 409, message: 'An application is already pending', retryable: false },
  [L.APPLICATION_NOT_REVIEWABLE]: { status: 409, message: 'Application is no longer reviewable', retryable: false },
  [L.CERTIFICATE_REQUIRED]: { status: 422, message: 'At least one certificate is required', retryable: false },
  [L.INVALID_CERTIFICATE_TYPE]: {
    status: 422,
    message: 'Invalid certificate type or OTHER description',
    retryable: false,
  },
  [L.INVALID_CERTIFICATE_FILE]: {
    status: 422,
    message: 'Certificate file must be ready, private, unused and owned by the applicant',
    retryable: false,
  },
  [L.INVALID_CERTIFICATE_REVIEW]: {
    status: 422,
    message: 'Certificate reviews must be unique and belong to this application',
    retryable: false,
  },
  [L.CERTIFICATE_EXPIRED]: { status: 422, message: 'No verified certificate is currently valid', retryable: false },
  [L.REJECTION_REASON_REQUIRED]: { status: 422, message: 'A rejection reason is required', retryable: false },
  [L.NO_VALID_CERTIFICATE]: {
    status: 422,
    message: 'Review all pending certificates and verify at least one valid certificate',
    retryable: false,
  },
  [B.ACTIVE_BOOKING_EXISTS]: {
    status: 409,
    message: 'An active booking already exists for this trip',
    retryable: false,
  },
  [B.BOOKING_VERSION_CONFLICT]: {
    status: 409,
    message: 'Booking changed; reload before updating participants',
    retryable: false,
  },
  [B.BOOKING_POLICY_UNAVAILABLE]: { status: 503, message: 'An effective booking policy is required', retryable: true },
  [B.BOOKING_CANCELLATION_NOT_ALLOWED]: {
    status: 409,
    message: 'Booking cannot be cancelled in its current state',
    retryable: false,
  },
  [B.BOOKING_CANCELLATION_POLICY_INVALID]: {
    status: 422,
    message: 'Booking cancellation policy snapshot is missing or invalid',
    retryable: false,
  },
  [P.REFUND_SOURCE_INVALID]: {
    status: 422,
    message: 'Refund source does not match an approved payment decision',
    retryable: false,
  },
  [P.REFUND_AMOUNT_EXCEEDED]: {
    status: 409,
    message: 'Refund exceeds the approved remaining amount',
    retryable: false,
  },
  [P.PAYMENT_WEBHOOK_INVALID_SIGNATURE]: {
    status: 401,
    message: 'Invalid payment webhook signature',
    retryable: false,
  },
  [P.PAYMENT_WEBHOOK_STORAGE_UNAVAILABLE]: {
    status: 503,
    message: 'Payment webhook storage is temporarily unavailable',
    retryable: true,
  },
  [B.BOOKING_HOLD_EXPIRED]: { status: 410, message: 'Booking hold has expired', retryable: false },
  [P.PAYMENT_NOT_FOUND]: { status: 404, message: 'Payment resource not found', retryable: false },
  [P.PAYMENT_INVALID_STATE]: { status: 409, message: 'Invoice is not payable', retryable: false },
  [P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD]: {
    status: 409,
    message: 'Idempotency key was used for a different request',
    retryable: false,
  },
  [P.PAYMENT_ATTEMPT_IN_PROGRESS]: { status: 409, message: 'A payment attempt is still unresolved', retryable: false },
  [P.PAYMENT_AMOUNT_MISMATCH]: { status: 422, message: 'Payment amount or currency does not match', retryable: false },
  [P.PAYMENT_PROVIDER_UNAVAILABLE]: {
    status: 503,
    message: 'Payment provider is temporarily unavailable',
    retryable: true,
  },
  [B.INVITE_RATE_LIMITED]: { status: 429, message: 'Too many invite requests; retry later', retryable: true },
  [B.CAPACITY_CONFLICT]: { status: 409, message: 'Trip has no remaining slots', retryable: false },
  [B.MEMBERSHIP_VERSION_CONFLICT]: { status: 409, message: 'Reload membership before retrying', retryable: false },
  [B.INVITE_USAGE_LIMIT_REACHED]: { status: 409, message: 'Invite usage limit reached', retryable: false },
  [B.INVITE_EXPIRED]: { status: 410, message: 'Invite has expired', retryable: false },
  [B.INVITE_REVOKED]: { status: 410, message: 'Invite has been revoked', retryable: false },
  [B.TRAIL_ACCESS_REQUIRED]: { status: 403, message: 'Active trail access required', retryable: false },
  [B.LEADER_CANNOT_CREATE_PRIVATE_TRIP]: {
    status: 403,
    message: 'Leaders cannot create private trips',
    retryable: false,
  },
  [B.NOT_FOUND]: { status: 404, message: 'Resource not found', retryable: false },
  [B.INVALID_STATE_TRANSITION]: {
    status: 409,
    message: 'Operation requires an OPEN trip before start',
    retryable: false,
  },
  [B.INVALID_TRAIL_FOR_TRIP_TYPE]: { status: 422, message: 'Invalid trail or checkpoint context', retryable: false },
  [B.PRIVATE_TRIP_VERSION_CONFLICT]: { status: 409, message: 'Reload the trip before retrying', retryable: false },
  // Common
  [COMMON_ERROR_CODES.VALIDATION_ERROR]: { status: 400, message: 'Validation failed', retryable: false },
  [COMMON_ERROR_CODES.UNAUTHENTICATED]: { status: 401, message: 'Unauthenticated access', retryable: false },
  [COMMON_ERROR_CODES.FORBIDDEN]: { status: 403, message: 'Forbidden access', retryable: false },
  [COMMON_ERROR_CODES.INTERNAL_ERROR]: { status: 500, message: 'Internal server error', retryable: true },

  // Rental
  [RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND]: { status: 404, message: 'Rental product not found', retryable: false },
  [RENTAL_ERROR_CODES.RENTAL_PRODUCT_ARCHIVED]: {
    status: 422,
    message: 'Rental product is archived and cannot be instantiated',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.RENTAL_CATEGORY_NOT_FOUND]: {
    status: 404,
    message: 'Rental category not found',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.RENTAL_CATEGORY_INACTIVE]: {
    status: 422,
    message: 'Rental category is inactive',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.RENTAL_PRODUCT_SKU_EXISTS]: {
    status: 409,
    message: 'Rental product SKU already exists',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.INVALID_DAILY_PRICE]: { status: 422, message: 'Invalid daily price', retryable: false },
  [RENTAL_ERROR_CODES.INVALID_REPLACEMENT_VALUE]: {
    status: 422,
    message: 'Invalid replacement value',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.INVALID_DEPOSIT_POLICY]: { status: 422, message: 'Invalid deposit policy', retryable: false },
  [RENTAL_ERROR_CODES.VERSION_CONFLICT]: {
    status: 409,
    message: 'Version conflict. The resource was updated by another transaction.',
    retryable: true,
  },
  [RENTAL_ERROR_CODES.INVENTORY_LOCATION_NOT_FOUND]: {
    status: 404,
    message: 'Inventory location not found',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.INVENTORY_LOCATION_INACTIVE]: {
    status: 422,
    message: 'Inventory location is inactive',
    retryable: false,
  },

  [RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND]: { status: 404, message: 'Equipment unit not found', retryable: false },
  [RENTAL_ERROR_CODES.EQUIPMENT_ASSET_CODE_EXISTS]: {
    status: 409,
    message: 'Equipment asset code already exists',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.EQUIPMENT_QR_CODE_EXISTS]: {
    status: 409,
    message: 'Equipment QR code already exists',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.INVALID_EQUIPMENT_CONDITION]: {
    status: 422,
    message: 'Invalid equipment condition',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.INVALID_EQUIPMENT_STATE_TRANSITION]: {
    status: 409,
    message: 'Invalid equipment state transition',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.EQUIPMENT_UNIT_RENTED]: {
    status: 409,
    message: 'Equipment unit is currently rented',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_MAINTAINABLE]: {
    status: 409,
    message: 'Equipment unit state is not maintainable',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.BATCH_QUANTITY_INVALID]: {
    status: 400,
    message: 'Batch quantity must be greater than 0',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.BATCH_ASSET_CODE_COUNT_MISMATCH]: {
    status: 400,
    message: 'Number of provided asset codes does not match quantity',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.BATCH_ASSET_CODE_DUPLICATE]: {
    status: 400,
    message: 'Duplicate asset codes provided in batch',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_NOT_ACTIVE]: {
    status: 409,
    message: 'Equipment maintenance is not active',
    retryable: false,
  },
  [RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_STATE_CONFLICT]: {
    status: 409,
    message: 'Multiple active maintenance records found',
    retryable: false,
  },
  // --- MEDIA ---
  [MEDIA_ERROR_CODES.MEDIA_NOT_FOUND]: { status: 404, message: 'Media asset not found', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_INVALID_SCOPE]: { status: 422, message: 'Invalid media scope', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_INVALID_RESOURCE_TYPE]: {
    status: 422,
    message: 'Invalid media resource type',
    retryable: false,
  },
  [MEDIA_ERROR_CODES.MEDIA_FILE_TOO_LARGE]: { status: 413, message: 'Media file too large', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_MIME_TYPE]: {
    status: 422,
    message: 'Unsupported media MIME type',
    retryable: false,
  },
  [MEDIA_ERROR_CODES.MEDIA_UPLOAD_EXPIRED]: { status: 410, message: 'Media upload intent expired', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_UPLOAD_SIGNATURE_INVALID]: {
    status: 422,
    message: 'Invalid upload signature',
    retryable: false,
  },
  [MEDIA_ERROR_CODES.MEDIA_PROVIDER_MISMATCH]: { status: 409, message: 'Provider metadata mismatch', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_INVALID_STATE]: {
    status: 409,
    message: 'Invalid media state for this operation',
    retryable: false,
  },
  [MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR]: { status: 502, message: 'Media provider error', retryable: true },
  [MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED_FORMAT]: { status: 422, message: 'Unsupported media format', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_INVALID_DIMENSIONS]: { status: 422, message: 'Invalid media dimensions', retryable: false },
  [MEDIA_ERROR_CODES.MEDIA_VIDEO_TOO_LONG]: {
    status: 422,
    message: 'Video duration exceeds maximum allowed',
    retryable: false,
  },
  [MEDIA_ERROR_CODES.MEDIA_INVALID_MEDIA_METADATA]: {
    status: 422,
    message: 'Invalid or missing media metadata from provider',
    retryable: false,
  },
  // --- NOTIFICATION ---
  [NOTIFICATION_ERROR_CODES.NOTIFICATION_NOT_FOUND]: {
    status: 404,
    message: 'Notification not found or access denied',
    retryable: false,
  },
  [RO.INSUFFICIENT_AVAILABLE_QUANTITY]: {
    status: 400,
    message: 'Insufficient available quantity for rental',
    retryable: false,
  },
  [RO.QUOTE_NOT_ACTIVE]: { status: 400, message: 'Quote is no longer active', retryable: false },
  [RO.QUOTE_EXPIRED]: { status: 400, message: 'Quote has expired', retryable: false },
  [RO.QUOTE_NOT_FOUND]: { status: 404, message: 'Rental quote not found', retryable: false },
  [RO.OPEN_ORDER_EXISTS]: {
    status: 409,
    message: 'An open rental order already exists for this trip',
    retryable: false,
  },
  [RO.OPERATION_CONFLICT]: { status: 409, message: 'Operation conflict', retryable: false },
  [RO.IDEMPOTENCY_KEY_REUSED]: {
    status: 409,
    message: 'Idempotency key reused with different payload',
    retryable: false,
  },
  [RO.STALE_CONTEXT]: { status: 409, message: 'Rental context is stale', retryable: false },
  [RO.EQUIPMENT_NOT_AVAILABLE]: { status: 409, message: 'Equipment not available', retryable: false },
  [RO.RENTAL_ORDER_NOT_FOUND]: { status: 404, message: 'Rental order not found', retryable: false },
  [RO.INVENTORY_LOCATION_NOT_CONFIGURED]: {
    status: 500,
    message: 'Primary rental inventory location is not configured or inactive',
    retryable: false,
  },
  [RO.TERMS_NOT_ACCEPTED]: { status: 400, message: 'Extension terms must be accepted', retryable: false },
  [RO.TERMS_VERSION_MISMATCH]: {
    status: 409,
    message: 'Accepted terms version does not match quoted terms',
    retryable: false,
  },
  [RO.TERMS_HASH_MISMATCH]: {
    status: 409,
    message: 'Terms hash does not match issued extension quote',
    retryable: false,
  },
  [RO.EXTENSION_CAPACITY_CONFLICT]: {
    status: 409,
    message: 'Insufficient warehouse capacity for requested extension period',
    retryable: false,
  },
  [RO.EXTENSION_QUOTE_EXPIRED]: { status: 410, message: 'Extension quote has expired', retryable: false },
  [RO.EXTENSION_ALREADY_PENDING]: {
    status: 409,
    message: 'An extension request is already pending payment',
    retryable: false,
  },
  [RO.EXTENSION_HOLD_EXPIRED]: { status: 410, message: 'Extension capacity hold has expired', retryable: false },
  [RO.EXTENSION_NOT_APPLICABLE]: {
    status: 409,
    message: 'Extension is not in a valid state to apply',
    retryable: false,
  },
  [RO.EXTENSION_LIMIT_EXCEEDED]: { status: 422, message: 'Maximum extension count reached', retryable: false },
  [RO.EXTENSION_TOO_LATE]: { status: 422, message: 'Extension requested after cutoff deadline', retryable: false },
  [RO.EXTENSION_END_NOT_LATER]: {
    status: 422,
    message: 'Requested return date must be later than current return date',
    retryable: false,
  },
  [RO.EXTENSION_INVALID_ORDER_STATE]: {
    status: 409,
    message: 'Order is not in active state for extension',
    retryable: false,
  },
  [RO.EXTENSION_RETURN_STARTED]: { status: 409, message: 'Return inspection has already started', retryable: false },
  [RO.EXTENSION_RETURN_TASK_STARTED]: {
    status: 409,
    message: 'Return collection task is already in progress',
    retryable: false,
  },
  [RO.EXTENSION_LINE_MISSING]: { status: 404, message: 'Extension order line not found', retryable: false },
  [RO.EXTENSION_PAYMENT_MISMATCH]: {
    status: 422,
    message: 'Payment does not match extension invoice',
    retryable: false,
  },

  // Preparation (Phase 05)
  [PR.TASK_NOT_FOUND]: { status: 404, message: 'Preparation task not found', retryable: false },
  [PR.TASK_ALREADY_ASSIGNED]: { status: 409, message: 'Task already assigned to another staff', retryable: false },
  [PR.TASK_NOT_CLAIMED]: { status: 409, message: 'Task is not claimed by current staff', retryable: false },
  [PR.TASK_NOT_PICKABLE]: { status: 409, message: 'Task state is not pickable', retryable: false },
  [PR.INVALID_TASK_STATE]: { status: 409, message: 'Invalid preparation task state', retryable: false },
  [PR.UNIT_NOT_ELIGIBLE_FOR_PICK]: {
    status: 422,
    message: 'Equipment unit is not eligible for pick',
    retryable: false,
  },
  [PR.UNIT_NOT_ASSIGNED_TO_TASK]: {
    status: 409,
    message: 'Equipment unit is not assigned to this task',
    retryable: false,
  },
  [PR.ASSIGNMENT_NOT_FOUND]: { status: 404, message: 'Rental unit assignment not found', retryable: false },
  [PR.CONDITION_SNAPSHOT_EXISTS]: {
    status: 409,
    message: 'Condition snapshot already captured for this unit',
    retryable: false,
  },
  [PR.EVIDENCE_NOT_READY]: { status: 422, message: 'Evidence media is not ready or verified', retryable: false },
  [PR.EVIDENCE_INCOMPLETE]: { status: 422, message: 'Evidence media is incomplete for all items', retryable: false },
  [PR.PACKAGE_NOT_FOUND]: { status: 404, message: 'Rental package not found', retryable: false },
  [PR.PACKAGE_MISMATCH]: { status: 409, message: 'Package does not match task or order', retryable: false },
  [PR.PACKAGE_INCOMPLETE]: { status: 409, message: 'Package items are incomplete', retryable: false },
  [PR.DELIVERY_STAFF_INVALID]: {
    status: 422,
    message: 'Target delivery staff is invalid or inactive',
    retryable: false,
  },
  [PR.CUSTODY_MISMATCH]: { status: 409, message: 'Custody mismatch detected', retryable: false },
  [PR.CUSTODY_TRANSFER_ALREADY_PENDING]: {
    status: 409,
    message: 'A custody transfer is already pending',
    retryable: false,
  },
  [PR.IDEMPOTENCY_KEY_REQUIRED]: { status: 400, message: 'Idempotency key is required', retryable: false },

  // Delivery (Phase 06)
  [DL.TASK_NOT_FOUND]: { status: 404, message: 'Delivery task not found', retryable: false },
  [DL.TASK_NOT_CLAIMED]: { status: 409, message: 'Delivery task is not claimed by current staff', retryable: false },
  [DL.INVALID_TASK_STATE]: { status: 409, message: 'Invalid delivery task state', retryable: false },
  [DL.PICKUP_CODE_INVALID_OR_EXPIRED]: { status: 400, message: 'Pickup code is invalid or expired', retryable: false },
  [DL.PICKUP_VERIFICATION_INVALID]: {
    status: 400,
    message: 'Pickup verification reference is invalid',
    retryable: false,
  },
  [DL.PICKUP_VERIFICATION_EXPIRED]: {
    status: 410,
    message: 'Pickup verification reference has expired',
    retryable: false,
  },
  [DL.PICKUP_CODE_CONFIG_ERROR]: { status: 500, message: 'Pickup code policy configuration error', retryable: false },
  [DL.PACKAGE_VERSION_CHANGED]: {
    status: 409,
    message: 'Package version changed during verification',
    retryable: false,
  },
  [DL.RECIPIENT_CONTEXT_INVALID]: { status: 422, message: 'Recipient context is invalid', retryable: false },
  [DL.PAYMENT_RECONCILIATION_REQUIRED]: {
    status: 409,
    message: 'Payment reconciliation required before operation',
    retryable: false,
  },
  [DL.ASSIGNEE_INVALID]: { status: 422, message: 'Assignee is invalid for rental task', retryable: false },
  [DL.CUSTODY_TRANSFER_NOT_FOUND]: { status: 404, message: 'Custody transfer not found', retryable: false },

  // Return Delivery (RB-API-603)
  [RR.RENTAL_NOT_FOUND]: { status: 404, message: 'Rental order not found', retryable: false },
  [RR.RETURN_TASK_NOT_FOUND]: { status: 404, message: 'Return task not found', retryable: false },
  [RR.RETURN_NOT_READY]: { status: 409, message: 'Return inspection/custody not ready', retryable: false },
  [RR.INVALID_RENTAL_STATE]: { status: 409, message: 'Invalid rental order state for return', retryable: false },
  [RR.INVALID_RETURN_STATE]: { status: 409, message: 'Invalid return task state', retryable: false },
  [RR.UNIT_NOT_RETURNED]: { status: 409, message: 'Unit has not been scanned as returned', retryable: false },
  [RR.UNIT_NOT_IN_RENTAL]: { status: 404, message: 'Unit is not part of this rental order', retryable: false },
  [RR.CONDITION_BASELINE_MISSING]: { status: 422, message: 'Condition baseline is missing', retryable: false },
  [RR.POLICY_CONFIG_REQUIRED]: { status: 500, message: 'Return policy configuration required', retryable: false },
  [RR.HANDOVER_DOCUMENT_REQUIRED]: {
    status: 409,
    message: 'Handover root document required to issue return receipt',
    retryable: false,
  },
  [RR.RETURN_SESSION_NOT_FOUND]: { status: 404, message: 'Return session not found', retryable: false },
  [RR.DOCUMENT_NOT_FOUND]: { status: 404, message: 'Rental document not found', retryable: false },
  [RR.DOCUMENT_NOT_READY]: { status: 409, message: 'Rental document not ready for download', retryable: false },

  // Lifecycle (Phase 07A)
  [LC.INVALID_EVENT_PAYLOAD]: { status: 400, message: 'Invalid rental lifecycle event payload', retryable: false },
  [LC.UNSUPPORTED_EVENT]: { status: 422, message: 'Unsupported rental lifecycle event type', retryable: false },
  [LC.RETURN_TASK_NOT_CREATABLE]: {
    status: 409,
    message: 'Return task cannot be created in current state',
    retryable: false,
  },
  [LC.RESCHEDULE_CAPACITY_CONFLICT]: { status: 409, message: 'Capacity conflict on trip reschedule', retryable: false },
  [LC.OUT_OF_ORDER_EVENT]: { status: 409, message: 'Out of order lifecycle event ignored', retryable: false },
  [LC.API_KEY_INVALID]: { status: 401, message: 'Invalid rental integration API key', retryable: false },

  // Personal Trail & Elevation
  [PT.INSUFFICIENT_GPS_POINTS]: {
    status: 400,
    message: 'Cung đường cần tối thiểu 2 điểm GPS hợp lệ',
    retryable: false,
  },
  [PT.INVALID_GEOJSON_COORDINATES]: { status: 400, message: 'Tọa độ GeoJSON không hợp lệ', retryable: false },
  [PT.RECORDING_CHANGED]: {
    status: 409,
    message: 'Dữ liệu phiên ghi đã thay đổi, vui lòng thử hoàn tất lại',
    retryable: true,
  },
  [PT.RECORDING_NOT_FOUND]: { status: 404, message: 'Không tìm thấy phiên ghi hành trình', retryable: false },
  [PT.RECORDING_ALREADY_FINISHED]: {
    status: 409,
    message: 'Phiên ghi hành trình đã kết thúc trước đó',
    retryable: false,
  },
  [PT.TRAIL_ACCESS_DENIED]: {
    status: 403,
    message: 'Không có quyền truy cập hoặc chỉnh sửa cung đường này',
    retryable: false,
  },
  [PT.PERSONAL_TRAIL_NOT_FOUND]: { status: 404, message: 'Không tìm thấy cung đường cá nhân', retryable: false },
  [PT.TRAIL_TOO_SHORT_FOR_VERIFY]: {
    status: 422,
    message: 'Cung đường phải dài tối thiểu 500m để gửi kiểm duyệt',
    retryable: false,
  },
  [PT.DEM_NOT_READY]: { status: 422, message: 'Độ cao vệ tinh DEM chưa xử lý xong', retryable: false },
  [PT.DEM_PROCESSING_FAILED]: {
    status: 500,
    message: 'Lỗi trong quá trình xử lý mô hình độ cao vệ tinh DEM',
    retryable: true,
  },
  [PT.CANNOT_MODIFY_VERIFIED_TRAIL]: {
    status: 400,
    message: 'Không thể chỉnh sửa cung đường đang xét duyệt hoặc đã được xác minh',
    retryable: false,
  },
  [G.GEAR_ITEM_NOT_FOUND]: { status: 404, message: 'Không tìm thấy món đồ cá nhân', retryable: false },
  [G.GEAR_ITEM_VERSION_CONFLICT]: { status: 409, message: 'Xung đột phiên bản món đồ cá nhân', retryable: true },
  [G.GEAR_PLAN_NOT_FOUND]: { status: 404, message: 'Không tìm thấy kế hoạch trang bị', retryable: false },
  [G.GEAR_REVISION_NOT_FOUND]: { status: 404, message: 'Không tìm thấy phiên bản kế hoạch trang bị', retryable: false },
  [G.GEAR_EXTRACTION_DRAFT_NOT_FOUND]: { status: 404, message: 'Không tìm thấy bản nháp trích xuất trang bị', retryable: false },
  [G.GEAR_DRAFT_EXPIRED]: { status: 410, message: 'Bản nháp trích xuất trang bị đã hết hạn', retryable: false },
  [G.GEAR_DRAFT_PAYLOAD_MISMATCH]: { status: 409, message: 'Dữ liệu xác nhận không khớp với bản nháp ban đầu', retryable: false },
  [G.GEAR_DRAFT_ALREADY_CONFIRMED]: { status: 409, message: 'Bản nháp đã được xác nhận', retryable: false },
  [G.GEAR_PLAN_CAS_CONFLICT]: { status: 409, message: 'Xung đột phiên bản ngữ cảnh kế hoạch trang bị (CAS conflict)', retryable: true },
  [G.GEAR_PROGRESS_CAS_CONFLICT]: { status: 409, message: 'Xung đột phiên bản tiến độ kế hoạch trang bị', retryable: true },
  [G.GEAR_CONCURRENCY_CONFLICT]: { status: 409, message: 'Xung đột khóa xử lý tác vụ đồng thời', retryable: true },
  [G.GEAR_CATEGORY_REQUIRES_PLAN]: { status: 400, message: 'Danh mục trang bị mở rộng yêu cầu sử dụng tính năng Kế hoạch trang bị (Gear Plan)', retryable: false },
  [G.GEAR_CATEGORY_MISMATCH]: { status: 400, message: 'Danh mục trang bị không khớp với thuộc tính kỹ thuật', retryable: false },
  [G.GEAR_QUOTE_NOT_FOUND]: { status: 404, message: 'Không tìm thấy báo giá thuê liên kết', retryable: false },
  [G.GEAR_QUOTE_NOT_OWNED]: { status: 403, message: 'Không có quyền liên kết báo giá của người dùng khác', retryable: false },
  [G.GEAR_TRIP_NOT_FOUND]: { status: 404, message: 'Không tìm thấy chuyến đi tương ứng', retryable: false },
  [G.GEAR_TRIP_NOT_ELIGIBLE]: { status: 400, message: 'Chuyến đi không đủ điều kiện lập kế hoạch trang bị', retryable: false },
  [G.GEAR_FORBIDDEN]: { status: 403, message: 'Không có quyền truy cập tài nguyên trang bị này', retryable: false },
  [G.GEAR_EXTRACTION_FAILED]: { status: 502, message: 'Không thể trích xuất dữ liệu từ nguồn đã cung cấp', retryable: true },
  [G.GEAR_DRAFT_NOT_READY]: { status: 400, message: 'Bản nháp chưa sẵn sàng để xác nhận', retryable: false },
  [G.GEAR_PROFILE_VERSION_CONFLICT]: { status: 409, message: 'Xung đột phiên bản hồ sơ kỹ thuật sản phẩm', retryable: true },
  [G.GEAR_QUOTE_NOT_ELIGIBLE]: { status: 400, message: 'Báo giá thuê không đủ điều kiện liên kết (hết hạn hoặc trạng thái không hợp lệ)', retryable: false },
}

