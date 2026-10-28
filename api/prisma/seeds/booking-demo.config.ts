import { z } from 'zod'
import { evaluateTripPricing, CostItemInput } from '../../src/modules/trips/pricing/pricing-calculator'

export const SOURCE = 'BOOKING_DEMO_V2'
export const DAY = 86400000
export const scenarios = [
  { key: 'PUBLIC_D7', days: 7, type: 'PUBLIC', capacity: 12 },
  { key: 'PUBLIC_D14', days: 14, type: 'PUBLIC', capacity: 12 },
  { key: 'PUBLIC_D21', days: 21, type: 'PUBLIC', capacity: 12 },
  { key: 'PUBLIC_D28', days: 28, type: 'PUBLIC', capacity: 6 },
  { key: 'PRIVATE_D10', days: 10, type: 'PRIVATE', capacity: 8 },
  { key: 'PRIVATE_D17', days: 17, type: 'PRIVATE', capacity: 8 },
] as const
export type ScenarioKey = (typeof scenarios)[number]['key']
const uuid = z.string().uuid()
const routeSchema = z
  .object({
    destinationId: uuid,
    systemTrailId: uuid,
    pickupPointId: uuid,
    returnPointId: uuid,
  })
  .strict()
export const demoConfigSchema = z
  .object({
    batch: z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/),
    actors: z
      .object({
        admin: uuid,
        leader: uuid,
        booker1: uuid,
        booker2: uuid,
        host: uuid,
        claimedMember: uuid,
        invitedMember: uuid,
      })
      .strict()
      .refine((actors) => new Set(Object.values(actors)).size === 7, 'All seven actors must be different users'),
    routes: z
      .object({
        PUBLIC_D7: routeSchema,
        PUBLIC_D14: routeSchema,
        PUBLIC_D21: routeSchema,
        PUBLIC_D28: routeSchema,
        PRIVATE_D10: routeSchema,
        PRIVATE_D17: routeSchema,
      })
      .strict(),
    certificateMediaId: uuid.optional(),
    replaceLegacyBatches: z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/)).default([]),
    workersStopped: z.literal(true),
  })
  .strict()
export type DemoConfig = z.infer<typeof demoConfigSchema>

/** 07:00 Vietnam on D+n. Vietnam has no DST; UTC midnight is 07:00 local. */
export function startTime(now: Date, days: number) {
  const local = new Date(now.getTime() + 7 * 3600000)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days))
}

export function demoPricing(capacity: number) {
  const items: CostItemInput[] = [
    {
      category: 'TRANSPORT',
      name: 'Xe đưa đón (demo)',
      kind: 'FIXED',
      basis: 'PER_TRIP',
      unitPrice: '300000',
      quantity: 1,
      durationUnits: 1,
      extraNonPayingPax: 0,
      includedInPrice: true,
      isEnabled: true,
    },
    {
      category: 'FOOD',
      name: 'Ăn trưa và nước uống (demo)',
      kind: 'VARIABLE',
      basis: 'PER_PERSON',
      unitPrice: '100000',
      quantity: 1,
      durationUnits: 1,
      extraNonPayingPax: 0,
      includedInPrice: true,
      isEnabled: true,
    },
  ]
  const input = {
    maxPax: capacity,
    targetPax: capacity,
    targetMarginBps: 1200,
    contingencyBps: 500,
    selectedPrice: '450000',
    selectedMinPax: 2,
    items,
    feePolicy: {
      policyVersion: 'fee-2026-v1',
      platformFeeBps: 800,
      paymentFeeBps: 200,
      defaultContingencyBps: 500,
      defaultTargetMarginBps: 1200,
      roundingStepVnd: '10000',
    },
  }
  const evaluation = evaluateTripPricing(input)
  if (evaluation.riskIntervals.some((r) => r.type === 'LOSS_IN_OPERATING_RANGE'))
    throw new Error('Demo pricing has a loss interval')
  return { input, evaluation }
}
