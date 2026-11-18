/**
 * Shelf life and wear of a physical unit.
 * - `expiresAt` is a calendar date (Vietnam time): from that day on the unit may no longer be rented.
 * - Wear is `rentalCount` (completed rental cycles) against the product's `maxRentalCycles`.
 */

import { AppError, COMMON_ERROR_CODES } from '../../../../../shared/errors'

const VN_OFFSET_MS = 7 * 3600_000

/** Today's calendar date in Vietnam as a UTC-midnight Date, comparable with a `@db.Date` column. */
export function vnCalendarDate(now: Date): Date {
  const shifted = new Date(now.getTime() + VN_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

/** The unit can no longer be rented at `at` (expiry day included). */
export function isUnitExpired(expiresAt: Date | null | undefined, at: Date): boolean {
  return !!expiresAt && expiresAt.getTime() <= vnCalendarDate(at).getTime()
}

export function wearPercent(rentalCount: number, maxRentalCycles: number | null | undefined): number | null {
  if (!maxRentalCycles || maxRentalCycles <= 0) return null
  return Math.min(100, Math.round((rentalCount / maxRentalCycles) * 100))
}

export function isWearLimitReached(rentalCount: number, maxRentalCycles: number | null | undefined): boolean {
  return !!maxRentalCycles && maxRentalCycles > 0 && rentalCount >= maxRentalCycles
}

export type ReturnedUnitDisposition = 'AVAILABLE' | 'RETIRED' | 'MAINTENANCE'

/**
 * Where a unit goes once Inventory releases it after a rental (`rentalCount` already includes that rental).
 * Expiry wins over wear: an expired unit is withdrawn for good, a worn one waits for a maintenance check.
 */
export function returnedUnitDisposition(input: {
  expiresAt: Date | null | undefined
  rentalCount: number
  maxRentalCycles: number | null | undefined
  now: Date
}): ReturnedUnitDisposition {
  if (isUnitExpired(input.expiresAt, input.now)) return 'RETIRED'
  if (isWearLimitReached(input.rentalCount, input.maxRentalCycles)) return 'MAINTENANCE'
  return 'AVAILABLE'
}

export const WEAR_LIMIT_MAINTENANCE_REASON = 'WEAR_LIMIT_REACHED'

/**
 * Editing shelf life: inventory staff may only shorten it (or set one on a unit that had none).
 * Pushing the date later or removing it puts a unit back into service, so only ADMIN may do it.
 * `next`: undefined = not edited, null = removed, 'YYYY-MM-DD' = new date.
 */
export function isExpiryExtension(current: Date | null | undefined, next: string | null | undefined): boolean {
  if (next === undefined || !current) return false
  if (next === null) return true
  return new Date(`${next}T00:00:00.000Z`).getTime() > current.getTime()
}

/** New units must still be usable tomorrow (YYYY-MM-DD, Vietnam calendar). */
export function assertExpiryInFuture(expiresAt: string | undefined, now: Date) {
  if (expiresAt && isUnitExpired(new Date(`${expiresAt}T00:00:00.000Z`), now)) {
    throw AppError.fromCode(COMMON_ERROR_CODES.VALIDATION_ERROR, {
      details: { field: 'expiresAt', message: 'Hạn dùng phải sau hôm nay.' },
    })
  }
}
