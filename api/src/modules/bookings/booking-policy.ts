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
