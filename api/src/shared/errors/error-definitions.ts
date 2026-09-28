import { COMMON_ERROR_CODES } from './codes/common.error-codes';
import { RENTAL_ERROR_CODES } from './codes/rental.error-codes';

export interface ErrorDefinition {
  status: number;
  message: string;
  retryable: boolean;
}

export const ERROR_DEFINITIONS: Record<string, ErrorDefinition> = {
  // Common
  [COMMON_ERROR_CODES.VALIDATION_ERROR]: { status: 400, message: 'Validation failed', retryable: false },
  [COMMON_ERROR_CODES.UNAUTHENTICATED]: { status: 401, message: 'Unauthenticated access', retryable: false },
  [COMMON_ERROR_CODES.FORBIDDEN]: { status: 403, message: 'Forbidden access', retryable: false },
  [COMMON_ERROR_CODES.INTERNAL_ERROR]: { status: 500, message: 'Internal server error', retryable: true },

  // Rental
  [RENTAL_ERROR_CODES.RENTAL_PRODUCT_NOT_FOUND]: { status: 404, message: 'Rental product not found', retryable: false },
  [RENTAL_ERROR_CODES.RENTAL_CATEGORY_NOT_FOUND]: { status: 404, message: 'Rental category not found', retryable: false },
  [RENTAL_ERROR_CODES.RENTAL_CATEGORY_INACTIVE]: { status: 422, message: 'Rental category is inactive', retryable: false },
  [RENTAL_ERROR_CODES.RENTAL_PRODUCT_SKU_EXISTS]: { status: 409, message: 'Rental product SKU already exists', retryable: false },
  [RENTAL_ERROR_CODES.INVALID_DAILY_PRICE]: { status: 422, message: 'Invalid daily price', retryable: false },
  [RENTAL_ERROR_CODES.INVALID_REPLACEMENT_VALUE]: { status: 422, message: 'Invalid replacement value', retryable: false },
  [RENTAL_ERROR_CODES.INVALID_DEPOSIT_POLICY]: { status: 422, message: 'Invalid deposit policy', retryable: false },
  [RENTAL_ERROR_CODES.VERSION_CONFLICT]: { status: 409, message: 'Version conflict. The resource was updated by another transaction.', retryable: true },
};
