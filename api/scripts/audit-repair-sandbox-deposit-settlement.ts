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
  refundReconcileStatus: string
  refundAmount: string
  refundCurrency: string
  refundPaymentId: string
  refundedAt: string | null
  refundTransactionRef: string | null
  providerEnvironment: string | null
  paymentGateway: string | null
  simulationProvenanceHash: string | null
  orderId: string | null
  refundOrderId: string | null
  settlementId: string | null
  orderStatus: string | null
  orderFinancialStatus: string | null
  orderExceptionStatus: string | null
  orderVersion: number | null
  orderCompletedAt: string | null
  settlementStatus: string | null
  settlementOutcome: string | null
  settlementVersion: number | null
  settlementSettledAt: string | null
  issuedDocumentCount: number
  hasSimulationMarker: boolean
  relationConsistent: boolean
  sourcePayment: {
    id: string
    status: string
    amount: string
    currency: string
    version: number
    depositAllocations: Array<{ id: string; orderLineId: string; amount: string }>
  }
  refundAllocations: Array<{ paymentAllocationId: string; amount: string }>
  sourceRefundReservations: Array<{
    refundId: string
    status: string
    purpose: string
    amount: string
    version: number
    reconcileStatus: string
    refundedAt: string | null
    allocations: Array<{ paymentAllocationId: string; amount: string }>
  }>
  cases: Array<{
    id: string
    status: string
    version: number
    updatedAt: string
    resolvedAt: string | null
    evidenceHash: string | null
  }>
  documents: Array<{
    id: string
    documentType: string
    snapshotHash: string
    issuedAt: string
    version: number
  }>
  durableEvents: Array<{
    id: string
    eventType: string
    status: string
    processedAt: string | null
    payloadHash: string
    receipts: Array<{ consumerName: string; processedAt: string }>
  }>
  allocatedItems: Array<{
    id: string
    status: string
    settledAt: string | null
    version: number
    depositAmount: string
    deductionAmount: string
    refundAmount: string
    approvedAt: string | null
    decisionSnapshotHash: string | null
    inspection: {
      id: string
      stage: string
      outcome: string
      version: number
      evidenceHash: string | null
    } | null
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
  return createHash('sha256').update(canonical(candidate)).digest('hex')
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
    .join(',')}}`
}

function jsonHash(value: unknown): string | null {
  return value === null || value === undefined ? null : createHash('sha256').update(canonical(value)).digest('hex')
}

export function classifyCandidate(candidate: AuditCandidate): ClassifiedCandidate {
  const reasons: string[] = []
  let classification: RepairClassification = 'NOT_A_CANDIDATE'
  const hasPendingProjection = candidate.allocatedItems.some((item) => item.status !== 'SETTLED')
  const allSettledEarly =
    candidate.allocatedItems.length > 0 && candidate.allocatedItems.every((item) => item.status === 'SETTLED')
  const allItemsProven = candidate.allocatedItems.every((item) => item.hasLegacySimulationMarker)
  const hasCommittedSuccess = candidate.durableEvents.some(
    (event) => event.eventType === 'REFUND_SUCCEEDED' || event.receipts.length > 0,
  )
  const successEvents = candidate.durableEvents.filter((event) => event.eventType === 'REFUND_SUCCEEDED')
  const hasRentalReceipt = successEvents.some((event) =>
    event.receipts.some((receipt) => receipt.consumerName === 'rental-deposit-v1'),
  )

  if (!candidate.hasSimulationMarker) {
    reasons.push('NO_SANDBOX_SIMULATION_MARKER')
  } else if (candidate.providerEnvironment !== 'SANDBOX' || !candidate.relationConsistent) {
    classification = 'MANUAL_REVIEW_UNSAFE_SOURCE'
    reasons.push(candidate.providerEnvironment !== 'SANDBOX' ? 'SOURCE_NOT_SANDBOX' : 'RELATION_MISMATCH')
  } else if (candidate.refundStatus === 'SUCCEEDED' && hasPendingProjection) {
    if (!successEvents.length || hasRentalReceipt) {
      classification = 'MANUAL_REVIEW_UNSAFE_SOURCE'
      reasons.push(!successEvents.length ? 'DURABLE_SUCCESS_EVENT_MISSING' : 'RECEIPT_EXISTS_BUT_PROJECTION_INCOMPLETE')
    } else {
      classification = 'REPLAY_SHARED_SUCCESS_EVENT'
      reasons.push('PAYMENT_SUCCEEDED_RENTAL_PROJECTION_INCOMPLETE')
    }
  } else if (candidate.refundStatus === 'PROCESSING' && allSettledEarly) {
    if (candidate.orderStatus === 'COMPLETED' || candidate.issuedDocumentCount > 0) {
      classification = 'MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL'
      reasons.push(candidate.orderStatus === 'COMPLETED' ? 'ORDER_COMPLETED' : 'IMMUTABLE_DOCUMENT_ISSUED')
    } else if (
      !allItemsProven ||
      candidate.refundReconcileStatus === 'NEEDS_REVIEW' ||
      candidate.cases.length > 0 ||
      hasCommittedSuccess
    ) {
      classification = 'MANUAL_REVIEW_UNSAFE_SOURCE'
      if (!allItemsProven) reasons.push('ITEM_SIMULATION_PROVENANCE_INCOMPLETE')
      if (candidate.refundReconcileStatus === 'NEEDS_REVIEW') reasons.push('REFUND_RECONCILIATION_REQUIRED')
      if (candidate.cases.length > 0) reasons.push('ORDER_CASE_ACTIVITY_PRESENT')
      if (hasCommittedSuccess) reasons.push('DURABLE_SUCCESS_OR_RECEIPT_PRESENT')
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
  payment: {
    include: {
      allocations: true,
      refundsViaPaymentId: { include: { allocations: true } },
    },
  },
  allocations: { include: { paymentAllocation: { include: { rentalOrderLine: true } } } },
  depositSettlement: {
    include: {
      order: {
        include: {
          rentalDocumentsViaOrderId: true,
          rentalExceptionCasesViaOrderId: true,
        },
      },
    },
  },
  depositSettlementItem: { include: { inspection: true } },
  depositRefundItems: { include: { item: { include: { inspection: true } } } },
} satisfies Prisma.RefundInclude

type RefundCandidateRow = Prisma.RefundGetPayload<{ include: typeof candidateInclude }>

function asObject(value: Prisma.JsonValue | null): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : null
}

type DurableEventFact = Prisma.PaymentOutboxEventGetPayload<{ include: { receipts: true } }>

function toCandidate(row: RefundCandidateRow, eventRows: DurableEventFact[] = []): AuditCandidate {
  const settlementOrderId = row.depositSettlement?.orderId ?? null
  const itemRows = row.depositRefundItems.length
    ? row.depositRefundItems.map((allocation) => allocation.item)
    : row.depositSettlementItem
      ? [row.depositSettlementItem]
      : []
  const providerPayload = asObject(row.providerPayload)
  const simulation = asObject(providerPayload?.sandboxSimulation ?? null)
  const order = row.depositSettlement?.order ?? null
  const paymentDepositAllocations = row.payment.allocations
    .filter((allocation) => allocation.component === 'RENTAL_DEPOSIT')
    .sort((left, right) => left.id.localeCompare(right.id))
  const refundAllocations = row.allocations
    .map((allocation) => ({
      paymentAllocationId: allocation.paymentAllocationId,
      amount: allocation.amount.toFixed(),
    }))
    .sort((left, right) => left.paymentAllocationId.localeCompare(right.paymentAllocationId))
  const itemAllocationTotal = row.depositRefundItems.length
    ? row.depositRefundItems.reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0))
    : row.depositSettlementItem
      ? row.amount
      : new Prisma.Decimal(0)
  const refundAllocationTotal = row.allocations.reduce(
    (sum, allocation) => sum.plus(allocation.amount),
    new Prisma.Decimal(0),
  )
  const reservedByAllocation = new Map<string, Prisma.Decimal>()
  for (const refund of row.payment.refundsViaPaymentId) {
    if (!['PENDING', 'PROCESSING', 'SUCCEEDED'].includes(refund.status)) continue
    for (const allocation of refund.allocations) {
      reservedByAllocation.set(
        allocation.paymentAllocationId,
        (reservedByAllocation.get(allocation.paymentAllocationId) ?? new Prisma.Decimal(0)).plus(allocation.amount),
      )
    }
  }
  const allocationBudgetValid = paymentDepositAllocations.every((allocation) =>
    (reservedByAllocation.get(allocation.id) ?? new Prisma.Decimal(0)).lte(allocation.amount),
  )
  return {
    refundId: row.id,
    refundVersion: row.version,
    refundStatus: row.status,
    refundReconcileStatus: row.reconcileStatus,
    refundAmount: row.amount.toFixed(),
    refundCurrency: row.currency,
    refundPaymentId: row.paymentId,
    refundedAt: row.refundedAt?.toISOString() ?? null,
    refundTransactionRef: row.refundTransactionRef,
    providerEnvironment: row.providerEnvironment,
    paymentGateway: row.paymentGateway,
    simulationProvenanceHash: jsonHash(simulation),
    orderId: settlementOrderId,
    refundOrderId: row.rentalOrderId,
    settlementId: row.depositSettlementId,
    orderStatus: order?.status ?? null,
    orderFinancialStatus: order?.financialStatus ?? null,
    orderExceptionStatus: order?.exceptionStatus ?? null,
    orderVersion: order?.version ?? null,
    orderCompletedAt: order?.completedAt?.toISOString() ?? null,
    settlementStatus: row.depositSettlement?.status ?? null,
    settlementOutcome: row.depositSettlement?.outcome ?? null,
    settlementVersion: row.depositSettlement?.version ?? null,
    settlementSettledAt: row.depositSettlement?.settledAt?.toISOString() ?? null,
    issuedDocumentCount: order?.rentalDocumentsViaOrderId.length ?? 0,
    hasSimulationMarker: simulation?.origin === 'ADMIN_SANDBOX_SIMULATION' && simulation?.environment === 'SANDBOX',
    relationConsistent: Boolean(
      settlementOrderId &&
      (!row.rentalOrderId || row.rentalOrderId === settlementOrderId) &&
      itemRows.length &&
      refundAllocationTotal.equals(row.amount) &&
      itemAllocationTotal.equals(row.amount) &&
      row.allocations.every(
        (allocation) =>
          allocation.paymentAllocation.paymentId === row.paymentId &&
          allocation.paymentAllocation.component === 'RENTAL_DEPOSIT' &&
          allocation.paymentAllocation.rentalOrderLine.orderId === settlementOrderId,
      ) &&
      allocationBudgetValid,
    ),
    sourcePayment: {
      id: row.payment.id,
      status: row.payment.status,
      amount: row.payment.amount.toFixed(),
      currency: row.payment.currency,
      version: row.payment.version,
      depositAllocations: paymentDepositAllocations.map((allocation) => ({
        id: allocation.id,
        orderLineId: allocation.rentalOrderLineId,
        amount: allocation.amount.toFixed(),
      })),
    },
    refundAllocations,
    sourceRefundReservations: row.payment.refundsViaPaymentId
      .filter((refund) => ['PENDING', 'PROCESSING', 'SUCCEEDED'].includes(refund.status))
      .map((refund) => ({
        refundId: refund.id,
        status: refund.status,
        purpose: refund.purpose,
        amount: refund.amount.toFixed(),
        version: refund.version,
        reconcileStatus: refund.reconcileStatus,
        refundedAt: refund.refundedAt?.toISOString() ?? null,
        allocations: refund.allocations
          .map((allocation) => ({
            paymentAllocationId: allocation.paymentAllocationId,
            amount: allocation.amount.toFixed(),
          }))
          .sort((left, right) => left.paymentAllocationId.localeCompare(right.paymentAllocationId)),
      }))
      .sort((left, right) => left.refundId.localeCompare(right.refundId)),
    cases: (order?.rentalExceptionCasesViaOrderId ?? [])
      .map((item) => ({
        id: item.id,
        status: item.status,
        version: item.version,
        updatedAt: item.updatedAt.toISOString(),
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
        evidenceHash: jsonHash(item.evidenceIds),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    documents: (order?.rentalDocumentsViaOrderId ?? [])
      .map((document) => ({
        id: document.id,
        documentType: document.documentType,
        snapshotHash: document.snapshotHash,
        issuedAt: document.issuedAt.toISOString(),
        version: document.version,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    durableEvents: eventRows
      .map((event) => ({
        id: event.id,
        eventType: event.eventType,
        status: event.status,
        processedAt: event.processedAt?.toISOString() ?? null,
        payloadHash: jsonHash(event.payload)!,
        receipts: event.receipts
          .map((receipt) => ({
            consumerName: receipt.consumerName,
            processedAt: receipt.processedAt.toISOString(),
          }))
          .sort((left, right) => left.consumerName.localeCompare(right.consumerName)),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    allocatedItems: itemRows
      .map((item) => ({
        id: item.id,
        status: item.status,
        settledAt: item.settledAt?.toISOString() ?? null,
        version: item.version,
        depositAmount: item.depositAmount.toFixed(),
        deductionAmount: item.deductionAmount.toFixed(),
        refundAmount: item.refundAmount.toFixed(),
        approvedAt: item.approvedAt?.toISOString() ?? null,
        decisionSnapshotHash: jsonHash(item.decisionSnapshot),
        inspection: item.inspection
          ? {
              id: item.inspection.id,
              stage: item.inspection.stage,
              outcome: item.inspection.outcome,
              version: item.inspection.version,
              evidenceHash: jsonHash(item.inspection.evidenceIds),
            }
          : null,
        hasLegacySimulationMarker: asObject(item.decisionSnapshot)?.settlementMode === 'SANDBOX_SIMULATED',
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
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
  const events = rows.length
    ? await db.paymentOutboxEvent.findMany({
        where: { aggregateType: 'Refund', aggregateId: { in: rows.map((row) => row.id) } },
        include: { receipts: true },
      })
    : []
  return rows
    .map((row) =>
      toCandidate(
        row,
        events.filter((event) => event.aggregateId === row.id),
      ),
    )
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
    await tx.$queryRaw`SELECT id FROM refunds WHERE payment_id=${candidate.refundPaymentId}::uuid ORDER BY id FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM payment_allocations WHERE payment_id=${candidate.refundPaymentId}::uuid ORDER BY id FOR UPDATE`
    await tx.$queryRaw`SELECT ra.id FROM refund_allocations ra JOIN refunds r ON r.id=ra.refund_id WHERE r.payment_id=${candidate.refundPaymentId}::uuid ORDER BY ra.id FOR UPDATE OF ra`
    await tx.$queryRaw`SELECT a.id FROM deposit_refund_item_allocations a JOIN deposit_settlement_items i ON i.id=a.deposit_settlement_item_id WHERE i.settlement_id=${candidate.settlementId}::uuid ORDER BY a.id FOR UPDATE OF a`
    await tx.$queryRaw`SELECT id FROM return_inspections WHERE order_id=${candidate.orderId}::uuid ORDER BY id FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM rental_exception_cases WHERE order_id=${candidate.orderId}::uuid ORDER BY id FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM rental_documents WHERE order_id=${candidate.orderId}::uuid ORDER BY id FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM payment_outbox_events WHERE aggregate_type='Refund' AND aggregate_id=${candidate.refundId}::uuid ORDER BY id FOR UPDATE`
    await tx.$queryRaw`SELECT r.event_id FROM payment_consumer_receipts r JOIN payment_outbox_events e ON e.id=r.event_id WHERE e.aggregate_type='Refund' AND e.aggregate_id=${candidate.refundId}::uuid ORDER BY r.event_id,r.consumer_name FOR UPDATE OF r`
    const current = await tx.refund.findUniqueOrThrow({ where: { id: candidate.refundId }, include: candidateInclude })
    const currentEvents = await tx.paymentOutboxEvent.findMany({
      where: { aggregateType: 'Refund', aggregateId: candidate.refundId },
      include: { receipts: true },
    })
    const rechecked = classifyCandidate(toCandidate(current, currentEvents))
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
