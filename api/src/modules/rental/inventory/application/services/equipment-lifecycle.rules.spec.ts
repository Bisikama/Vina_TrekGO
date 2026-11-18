import {
  assertExpiryInFuture,
  isExpiryExtension,
  isUnitExpired,
  returnedUnitDisposition,
  vnCalendarDate,
  wearPercent,
} from './equipment-lifecycle.rules'

const date = (value: string) => new Date(`${value}T00:00:00.000Z`)

describe('equipment shelf life and wear', () => {
  it('takes the calendar day in Vietnam, not in UTC', () => {
    // 18:00 UTC on the 19th is already 01:00 on the 20th in Vietnam.
    expect(vnCalendarDate(new Date('2026-11-19T18:00:00.000Z'))).toEqual(date('2026-11-20'))
    expect(vnCalendarDate(new Date('2026-11-19T16:59:00.000Z'))).toEqual(date('2026-11-19'))
  })

  it('expires a unit on its expiry day, not before', () => {
    const expiresAt = date('2026-11-20')
    expect(isUnitExpired(expiresAt, new Date('2026-11-19T16:59:00.000Z'))).toBe(false)
    expect(isUnitExpired(expiresAt, new Date('2026-11-19T17:00:00.000Z'))).toBe(true)
    expect(isUnitExpired(null, new Date('2030-01-01T00:00:00.000Z'))).toBe(false)
  })

  it('reports wear only for products with a limit', () => {
    expect(wearPercent(3, null)).toBeNull()
    expect(wearPercent(3, 12)).toBe(25)
    expect(wearPercent(15, 12)).toBe(100)
  })

  describe('where a unit goes after a rental', () => {
    const now = new Date('2026-11-20T03:00:00.000Z')

    it('goes back on the shelf while within shelf life and wear limit', () => {
      expect(returnedUnitDisposition({ expiresAt: date('2027-01-01'), rentalCount: 4, maxRentalCycles: 5, now })).toBe(
        'AVAILABLE',
      )
      expect(returnedUnitDisposition({ expiresAt: null, rentalCount: 99, maxRentalCycles: null, now })).toBe(
        'AVAILABLE',
      )
    })

    it('waits for a maintenance check once the wear limit is reached', () => {
      expect(returnedUnitDisposition({ expiresAt: null, rentalCount: 5, maxRentalCycles: 5, now })).toBe('MAINTENANCE')
    })

    it('is withdrawn for good when expired, even if also worn out', () => {
      expect(returnedUnitDisposition({ expiresAt: date('2026-11-20'), rentalCount: 5, maxRentalCycles: 5, now })).toBe(
        'RETIRED',
      )
    })
  })

  it('refuses a new unit whose shelf life ends today or earlier (Vietnam calendar)', () => {
    const now = new Date('2026-11-19T18:00:00.000Z') // already 20/11 in Vietnam
    expect(() => assertExpiryInFuture('2026-11-20', now)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
    expect(() => assertExpiryInFuture('2026-11-21', now)).not.toThrow()
    expect(() => assertExpiryInFuture(undefined, now)).not.toThrow()
  })

  it('treats only a later date or removing the date as extending shelf life', () => {
    const current = date('2026-12-01')
    expect(isExpiryExtension(current, '2026-12-02')).toBe(true)
    expect(isExpiryExtension(current, null)).toBe(true)
    expect(isExpiryExtension(current, '2026-11-20')).toBe(false)
    expect(isExpiryExtension(current, '2026-12-01')).toBe(false)
    expect(isExpiryExtension(current, undefined)).toBe(false)
    // Setting a date on a unit that had none shortens its life.
    expect(isExpiryExtension(null, '2027-01-01')).toBe(false)
  })
})
