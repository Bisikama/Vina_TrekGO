import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

// Explicit operator choices only. Never silently invent or replace a refund policy.
const input = z.object({
  CF02_POLICY_CODE: z.string().min(1).max(80),
  CF02_HOLD_TTL_MINUTES: z.coerce.number().int().min(1).max(1440),
  CF02_CANCELLATION_RULES: z.string().transform((value, ctx) => {
    try { return JSON.parse(value) as unknown } catch { ctx.addIssue({ code: 'custom', message: 'Expected JSON' }); return z.NEVER }
  }).pipe(z.union([
    z.object({}).strict(), // Explicitly not enabled until a refund policy is agreed.
    z.object({ version: z.literal(1), tiers: z.array(z.object({
      minHoursBeforeStart: z.number().nonnegative(), refundPercent: z.number().min(0).max(100),
    }).strict()).min(1).refine((tiers) => new Set(tiers.map((t) => t.minHoursBeforeStart)).size === tiers.length) }).strict(),
  ])),
}).parse(process.env)
const db = new PrismaClient()
async function main() {
  const policy = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`cf02-policy:${input.CF02_POLICY_CODE}`}, 0))::text`
    const previous = await tx.bookingPolicy.findFirst({ where: { policyCode: input.CF02_POLICY_CODE }, orderBy: { versionNo: 'desc' } })
    if (previous?.isActive && previous.holdTtlMinutes === input.CF02_HOLD_TTL_MINUTES && JSON.stringify(previous.cancellationRules) === JSON.stringify(input.CF02_CANCELLATION_RULES)) return previous
    return tx.bookingPolicy.create({ data: {
      policyCode: input.CF02_POLICY_CODE, versionNo: (previous?.versionNo ?? 0) + 1,
      holdTtlMinutes: input.CF02_HOLD_TTL_MINUTES, cancellationRules: input.CF02_CANCELLATION_RULES,
      effectiveFrom: new Date(),
    } })
  })
  console.log(JSON.stringify({ policyCode: policy.policyCode, versionNo: policy.versionNo, holdTtlMinutes: policy.holdTtlMinutes }))
}
main().catch(() => { console.error('CF02 policy configuration failed; check explicit policy inputs and database access.'); process.exitCode = 1 }).finally(() => db.$disconnect())
