import { COMMON_ERROR_CODES } from './codes/common.error-codes';
import { RENTAL_ERROR_CODES } from './codes/rental.error-codes';
import { MEDIA_ERROR_CODES } from './codes/media.error-codes';
import { BOOKING_ERROR_CODES as B } from './codes/booking.error-codes';

export interface ErrorDefinition {
  status: number;
  message: string;
  retryable: boolean;
}

export const ERROR_DEFINITIONS: Record<string, ErrorDefinition> = {
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
  [MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR]: { status: 502, message: 'Media provider error', retryable: true },
};
