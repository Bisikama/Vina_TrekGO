import { policyContentSchema, refundPercentAt } from './booking-policy'

const rules = {
  version: 1,
  tiers: [
    { minHoursBeforeStart: 168, refundPercent: 100 },
    { minHoursBeforeStart: 72, refundPercent: 80 },
    { minHoursBeforeStart: 24, refundPercent: 50 },
    { minHoursBeforeStart: 0, refundPercent: 0 },
  ],
}
describe('Booking policy rules', () => {
  const start = new Date('2035-01-01T00:00:00Z')
  it.each([
    [168, 100],
    [168 - 1 / 3600000, 80],
    [168 + 1 / 3600000, 100],
    [72, 80],
    [72 - 1 / 3600000, 50],
    [72 + 1 / 3600000, 80],
    [24, 50],
    [24 - 1 / 3600000, 0],
    [24 + 1 / 3600000, 50],
    [0, null],
    [-1, null],
  ])('evaluates %s hours without rounding at boundaries', (hours, expected) => {
    expect(refundPercentAt({ cancellationRules: rules }, start, new Date(start.getTime() - hours * 3600000))).toBe(
      expected,
    )
  })
  it('validates new policy coverage, finite thresholds, uniqueness, rates, and TTL', () => {
    expect(policyContentSchema.safeParse({ holdTtlMinutes: 15, cancellationRules: rules }).success).toBe(true)
    for (const holdTtlMinutes of [0, -1, 1.5, 1441])
      expect(policyContentSchema.safeParse({ holdTtlMinutes, cancellationRules: rules }).success).toBe(false)
    for (const tiers of [
      rules.tiers.slice(0, 3),
      [...rules.tiers, rules.tiers[0]],
      [{ minHoursBeforeStart: 0, refundPercent: 101 }],
      [{ minHoursBeforeStart: Infinity, refundPercent: 0 }],
    ])
      expect(
        policyContentSchema.safeParse({ holdTtlMinutes: 15, cancellationRules: { version: 1, tiers } }).success,
      ).toBe(false)
  })
  it('never invents a refund rule for invalid legacy snapshots', () => {
    const now = new Date(start.getTime() - 3600000)
    expect(refundPercentAt({ cancellationRules: {} }, start, now)).toBeNull()
    expect(
      refundPercentAt({ cancellationRules: { version: 1, tiers: rules.tiers.slice(0, 3) } }, start, now),
    ).toBeNull()
    expect(
      refundPercentAt({ cancellationRules: { ...rules, tiers: [...rules.tiers, rules.tiers[0]] } }, start, now),
    ).toBeNull()
  })
})
