import 'dotenv/config'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { Prisma, PrismaClient } from '@prisma/client'
import { updateSettlementProgress } from '../src/modules/rental/payments/settlement-progress'

export type RepairClassification =
  | 'EARLY_PROJECTION_AUTO_REPAIR'
  | 'MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL'
  | 'REPLAY_SHARED_SUCCESS_EVENT'
  | 'MANUAL_REVIEW_UNSAFE_SOURCE'
  | 'NOT_A_CANDIDATE'

export type AuditCandidate = {
  refundId: string
  refundVersion: number
  refundStatus: string
  providerEnvironment: string | null
  orderId: string | null
  refundOrderId: string | null
  settlementId: string | null
  orderStatus: string | null
  orderFinancialStatus: string | null
  issuedDocumentCount: number
  hasSimulationMarker: boolean
  relationConsistent: boolean
  allocatedItems: Array<{
    id: string
    status: string
    settledAt: string | null
    hasLegacySimulationMarker: boolean
  }>
}

export type ClassifiedCandidate = AuditCandidate & {
  classification: RepairClassification
  reasons: string[]
  snapshotHash: string
}

export type RepairCliOptions = {
  apply: boolean
  limit: number
  refundIds: Set<string>
  orderIds: Set<string>
  snapshotIn?: string
  snapshotOut?: string
}

export function parseRepairArgs(args: string[]): RepairCliOptions {
  const value = (prefix: string) => args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  const list = (prefix: string) =>
    new Set(
      args
        .filter((arg) => arg.startsWith(prefix))
        .flatMap((arg) => arg.slice(prefix.length).split(','))
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
  const limit = Number(value('--limit=') ?? 500)
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000)
    throw new Error('--limit must be an integer from 1 to 5000')
  return {
    apply: args.includes('--apply'),
    limit,
    refundIds: list('--refund-id='),
    orderIds: list('--order-id='),
    snapshotIn: value('--snapshot-in='),
    snapshotOut: value('--snapshot-out='),
  }
}

export function candidateSnapshotHash(candidate: AuditCandidate): string {
  return createHash('sha256').update(JSON.stringify(candidate)).digest('hex')
}

export function classifyCandidate(candidate: AuditCandidate): ClassifiedCandidate {
  const reasons: string[] = []
  let classification: RepairClassification = 'NOT_A_CANDIDATE'
  const hasPendingProjection = candidate.allocatedItems.some((item) => item.status !== 'SETTLED')
  const allSettledEarly =
    candidate.allocatedItems.length > 0 && candidate.allocatedItems.every((item) => item.status === 'SETTLED')
  const allItemsProven = candidate.allocatedItems.every((item) => item.hasLegacySimulationMarker)

  if (!candidate.hasSimulationMarker) {
    reasons.push('NO_SANDBOX_SIMULATION_MARKER')
  } else if (candidate.providerEnvironment !== 'SANDBOX' || !candidate.relationConsistent) {
    classification = 'MANUAL_REVIEW_UNSAFE_SOURCE'
    reasons.push(candidate.providerEnvironment !== 'SANDBOX' ? 'SOURCE_NOT_SANDBOX' : 'RELATION_MISMATCH')
  } else if (candidate.refundStatus === 'SUCCEEDED' && hasPendingProjection) {
    classification = 'REPLAY_SHARED_SUCCESS_EVENT'
    reasons.push('PAYMENT_SUCCEEDED_RENTAL_PROJECTION_INCOMPLETE')
  } else if (candidate.refundStatus === 'PROCESSING' && allSettledEarly) {
    if (candidate.orderStatus === 'COMPLETED' || candidate.issuedDocumentCount > 0) {
      classification = 'MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL'
      reasons.push(candidate.orderStatus === 'COMPLETED' ? 'ORDER_COMPLETED' : 'IMMUTABLE_DOCUMENT_ISSUED')
    } else if (!allItemsProven) {
      classification = 'MANUAL_REVIEW_UNSAFE_SOURCE'
      reasons.push('ITEM_SIMULATION_PROVENANCE_INCOMPLETE')
    } else {
      classification = 'EARLY_PROJECTION_AUTO_REPAIR'
      reasons.push('PROCESSING_REFUND_WITH_EARLY_SETTLED_PROJECTION')
    }
  }

  return { ...candidate, classification, reasons, snapshotHash: candidateSnapshotHash(candidate) }
}

export function assertApplyEligible(
  candidate: ClassifiedCandidate,
  options: RepairCliOptions,
  expectedHashes: Map<string, string>,
): void {
  if (!options.apply) throw new Error('Apply was not explicitly enabled')
  if (candidate.classification !== 'EARLY_PROJECTION_AUTO_REPAIR') throw new Error('Candidate requires manual handling')
  if (!candidate.orderId || !options.refundIds.has(candidate.refundId) || !options.orderIds.has(candidate.orderId))
    throw new Error('Refund and order must both be allowlisted')
  if (expectedHashes.get(candidate.refundId) !== candidate.snapshotHash)
    throw new Error('Snapshot hash changed or is missing')
}

const candidateInclude = {
  depositSettlement: {
    include: {
      order: { include: { rentalDocumentsViaOrderId: { select: { id: true } } } },
    },
  },
  depositSettlementItem: true,
  depositRefundItems: { include: { item: true } },
} satisfies Prisma.RefundInclude

type RefundCandidateRow = Prisma.RefundGetPayload<{ include: typeof candidateInclude }>

function asObject(value: Prisma.JsonValue | null): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : null
}

function toCandidate(row: RefundCandidateRow): AuditCandidate {
  const settlementOrderId = row.depositSettlement?.orderId ?? null
  const itemRows = row.depositRefundItems.length
    ? row.depositRefundItems.map((allocation) => allocation.item)
    : row.depositSettlementItem
      ? [row.depositSettlementItem]
      : []
  const providerPayload = asObject(row.providerPayload)
  return {
    refundId: row.id,
    refundVersion: row.version,
    refundStatus: row.status,
    providerEnvironment: row.providerEnvironment,
    orderId: settlementOrderId,
    refundOrderId: row.rentalOrderId,
    settlementId: row.depositSettlementId,
    orderStatus: row.depositSettlement?.order.status ?? null,
    orderFinancialStatus: row.depositSettlement?.order.financialStatus ?? null,
    issuedDocumentCount: row.depositSettlement?.order.rentalDocumentsViaOrderId.length ?? 0,
    hasSimulationMarker: Boolean(providerPayload?.sandboxSimulation),
    relationConsistent: Boolean(
      settlementOrderId && (!row.rentalOrderId || row.rentalOrderId === settlementOrderId) && itemRows.length,
    ),
    allocatedItems: itemRows.map((item) => ({
      id: item.id,
      status: item.status,
      settledAt: item.settledAt?.toISOString() ?? null,
      hasLegacySimulationMarker: asObject(item.decisionSnapshot)?.settlementMode === 'SANDBOX_SIMULATED',
    })),
  }
}

function assertNonProductionSandbox(): void {
  if (process.env.NODE_ENV === 'production') throw new Error('Repair apply is forbidden in production')
  if (process.env.PAYMENT_PROVIDER_ENVIRONMENT !== 'SANDBOX')
    throw new Error('Repair apply requires PAYMENT_PROVIDER_ENVIRONMENT=SANDBOX')
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL is required')
  const host = new URL(raw).hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!['localhost', '127.0.0.1', '::1'].includes(host))
    throw new Error('Repair apply requires an isolated local database')
}

async function audit(db: PrismaClient, limit: number): Promise<ClassifiedCandidate[]> {
  const rows = await db.refund.findMany({
    where: { purpose: 'DEPOSIT', status: { in: ['PROCESSING', 'SUCCEEDED'] } },
    include: candidateInclude,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  })
  return rows
    .map(toCandidate)
    .map(classifyCandidate)
    .filter((row) => row.classification !== 'NOT_A_CANDIDATE')
}

async function applyCandidate(
  db: PrismaClient,
  candidate: ClassifiedCandidate,
  options: RepairCliOptions,
  expectedHashes: Map<string, string>,
) {
  return db.$transaction(async (tx) => {
    if (!candidate.orderId || !candidate.settlementId) throw new Error('Candidate relation is incomplete')
    await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${candidate.orderId}::uuid FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM deposit_settlements WHERE id=${candidate.settlementId}::uuid FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM deposit_settlement_items WHERE settlement_id=${candidate.settlementId}::uuid ORDER BY id FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM refunds WHERE id=${candidate.refundId}::uuid FOR UPDATE`
    const current = await tx.refund.findUniqueOrThrow({ where: { id: candidate.refundId }, include: candidateInclude })
    const rechecked = classifyCandidate(toCandidate(current))
    assertApplyEligible(rechecked, options, expectedHashes)

    for (const item of rechecked.allocatedItems) {
      await tx.depositSettlementItem.update({
        where: { id: item.id },
        data: { status: 'REFUND_PENDING', settledAt: null, version: { increment: 1 } },
      })
    }
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
    await updateSettlementProgress(tx, candidate.settlementId, now)
    const succeeded = await tx.refund.aggregate({
      where: { rentalOrderId: candidate.orderId, purpose: 'DEPOSIT', status: 'SUCCEEDED' },
      _sum: { amount: true },
    })
    await tx.rentalOrder.update({
      where: { id: candidate.orderId },
      data: {
        financialStatus: succeeded._sum.amount?.gt(0) ? 'PARTIALLY_REFUNDED' : 'REFUND_PENDING',
        version: { increment: 1 },
      },
    })
    await tx.auditLog.create({
      data: {
        action: 'SANDBOX_DEPOSIT_EARLY_PROJECTION_REPAIRED',
        entityType: 'Refund',
        entityId: candidate.refundId,
        oldValues: candidate,
        newValues: {
          classification: rechecked.classification,
          restoredItemIds: rechecked.allocatedItems.map((item) => item.id),
          refundStatusPreserved: current.status,
          source: 'AUDIT_REPAIR_SCRIPT',
        },
      },
    })
    return { refundId: candidate.refundId, orderId: candidate.orderId, result: 'REPAIRED' }
  })
}

async function main() {
  const options = parseRepairArgs(process.argv.slice(2))
  const db = new PrismaClient()
  try {
    const candidates = await audit(db, options.limit)
    const report = { mode: options.apply ? 'APPLY' : 'DRY_RUN', generatedAt: new Date().toISOString(), candidates }
    if (options.snapshotOut) writeFileSync(options.snapshotOut, JSON.stringify(report, null, 2), { flag: 'wx' })
    if (!options.apply) {
      console.log(JSON.stringify(report, null, 2))
      return
    }

    assertNonProductionSandbox()
    if (!options.snapshotIn) throw new Error('--snapshot-in is required for apply')
    const snapshot = JSON.parse(readFileSync(options.snapshotIn, 'utf8')) as { candidates?: ClassifiedCandidate[] }
    const expectedHashes = new Map((snapshot.candidates ?? []).map((row) => [row.refundId, row.snapshotHash]))
    const selected = candidates.filter(
      (candidate) =>
        options.refundIds.has(candidate.refundId) &&
        Boolean(candidate.orderId && options.orderIds.has(candidate.orderId)),
    )
    if (!selected.length) throw new Error('No current candidate matched both allowlists')
    const results: Array<{ refundId: string; orderId: string; result: string }> = []
    for (const candidate of selected) results.push(await applyCandidate(db, candidate, options, expectedHashes))
    console.log(JSON.stringify({ mode: 'APPLY', results }, null, 2))
  } finally {
    await db.$disconnect()
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Sandbox deposit repair failed')
    process.exitCode = 1
  })
}
