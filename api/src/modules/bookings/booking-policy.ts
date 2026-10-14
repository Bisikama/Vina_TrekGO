import { z } from 'zod'

export const bookingCancellationPolicySchema = z
  .object({
    cancellationRules: z
      .object({
        version: z.literal(1),
        tiers: z
          .array(
            z
              .object({
                minHoursBeforeStart: z.number().finite().nonnegative(),
                refundPercent: z.number().finite().min(0).max(100),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
  })
  .passthrough()

export const PUBLIC_BOOKING_POLICY_CODE = 'PUBLIC_BOOKING_DEFAULT'

// New publications are strict; legacy snapshots keep their existing interpretation.
export const policyContentSchema = z
  .object({
    holdTtlMinutes: z.number().int().min(1).max(1440),
    cancellationRules: bookingCancellationPolicySchema.shape.cancellationRules.superRefine((rules, ctx) => {
      const thresholds = rules.tiers.map((tier) => tier.minHoursBeforeStart)
      if (new Set(thresholds).size !== thresholds.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate refund thresholds' })
      if (!thresholds.includes(0)) ctx.addIssue({ code: 'custom', message: 'A zero-hour tier is required' })
    }),
  })
  .strict()

export type PolicyContent = z.infer<typeof policyContentSchema>
export const policyUpdateSchema = policyContentSchema.extend({ expectedRevision: z.number().int().positive() })
export const policyRevisionSchema = z.object({ expectedRevision: z.number().int().positive() }).strict()
export const policyPageSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    state: z.enum(['DRAFT', 'CURRENT', 'RETIRED', 'ALL']).default('ALL'),
  })
  .strict()

export function canonicalPolicy(input: PolicyContent): PolicyContent {
  const parsed = policyContentSchema.parse(input)
  return {
    ...parsed,
    cancellationRules: {
      version: 1,
      tiers: [...parsed.cancellationRules.tiers].sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart),
    },
  }
}

// Null means invalid/uncovered snapshot or cancellation at/after departure, never an invented percentage.
export function refundPercentAt(snapshot: unknown, startAt: Date, now: Date): number | null {
  const parsed = bookingCancellationPolicySchema.safeParse(snapshot)
  if (!parsed.success || startAt <= now) return null
  const tiers = parsed.data.cancellationRules.tiers
  if (new Set(tiers.map((tier) => tier.minHoursBeforeStart)).size !== tiers.length) return null
  const hours = (startAt.getTime() - now.getTime()) / 3_600_000
  return (
    [...tiers]
      .sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart)
      .find((tier) => hours >= tier.minHoursBeforeStart)?.refundPercent ?? null
  )
}
