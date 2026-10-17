import { Injectable } from '@nestjs/common';
import {
  DeliveryTaskStatus, DeliveryTaskType, InvoiceStatus, PaymentStatus, Prisma,
  RentalExtensionStatus, RentalOrderStatus, ReservationStatus,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from 'src/shared/services/prisma.service';
import { AppError } from 'src/shared/errors/app-error';
import { calculateChargedDays, parseWholeVnd, resolveRentalReturn, toPrismaDecimalVnd, toSafeNumber } from '../application/services/rental-ordering.rules';
import { RENTAL_CONTEXT_PORT, type RentalContextPort } from '../application/ports/rental-context.port';
import { Inject } from '@nestjs/common';
import { getAvailableCountWithTx } from '../infrastructure/adapters/prisma-rental-availability-tx.helper';
import { resolveActivePrimaryRentalLocation } from '../../shared/primary-inventory-location';
import { effectiveDueAt } from './rental-extension.policy';
import { issueExtensionAppendixTx } from '../../documents/application/rental-document-events';

/**
 * Transactional B2 extension workflow. A quote never holds equipment.
 * Confirm locks product rows in sorted order and holds ALL delta windows or none.
 * Payment ingress calls consumeExtensionPaymentWithTx so application never optimistically extends dueAt.
 */
@Injectable()
export class RentalExtensionService {
  constructor(private readonly prisma: PrismaService, @Inject(RENTAL_CONTEXT_PORT) private readonly context: RentalContextPort) {}

  async quote(userId: string, orderId: string, returnAt: Date, returnOptionId: string, now = new Date()) {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { id: orderId },
      include: {
        rentalOrderLinesViaOrderId: { include: { product: true } },
        deliveryTasksViaOrderId: { where: { taskType: DeliveryTaskType.RETURN } },
        returnInspectionsViaOrderId: { take: 1 },
      },
    });
    if (!order || order.userId !== userId) throw AppError.fromCode('FORBIDDEN');
    checkExtendable(order, now);
    const context = await this.context.getByTripId(order.tripId, userId, now);
    if (!context || context.membershipRef !== order.membershipRef) throw AppError.fromCode('FORBIDDEN');
    const policy = jsonObject(order.policySnapshot);
    const appliedExtensions = await this.prisma.rentalExtensionRequest.count({ where: { orderId, status: RentalExtensionStatus.APPLIED } });
    if (appliedExtensions >= (policy.maxExtensionCount ?? 2)) throw error('EXTENSION_LIMIT_EXCEEDED');
    if (policy.maxTotalRentalDays && returnAt.getTime() - order.rentalStartAt.getTime() > policy.maxTotalRentalDays * 86400000) throw error('RENTAL_DURATION_NOT_ALLOWED');

    // The order's frozen policy, not today's policy, determines maximum rental duration.
    const maxExtraHours = requiredPolicyInt(policy.maxRentalAfterTripHours, 'maxRentalAfterTripHours');
    if (returnAt > context.trip.endAt && returnAt.getTime() > context.trip.endAt.getTime() + maxExtraHours * 3_600_000) throw error('RENTAL_DURATION_NOT_ALLOWED');
    const chosen = resolveRentalReturn({ ...context, activePolicy: { ...context.activePolicy, maxRentalAfterTripHours: maxExtraHours } }, returnAt, returnOptionId);
    if (!chosen.returnOptionSnapshot) throw error('RENTAL_RETURN_OPTION_UNAVAILABLE');
    if (returnAt <= order.rentalEndAt) throw error('EXTENSION_END_NOT_LATER');
    // Configuration belongs to the historical order, not mutable live policy.
    const cutoff = requiredPolicyInt(policy.extensionRequestCutoffMinutes, 'extensionRequestCutoffMinutes');
    const ttl = requiredPolicyInt(policy.extensionHoldMinutes, 'extensionHoldMinutes');
    const due = effectiveDueAt(order.rentalEndAt, order.operationalReturnDueAt);
    if (now.getTime() + cutoff * 60000 >= due.getTime()) throw error('EXTENSION_TOO_LATE');
    if (ttl <= 0) throw error('EXTENSION_NOT_CONFIGURED');

    // Operational return due preservation & RB-POL-30 buffer per product
    const finalOperationalReturnDueAt = order.operationalReturnDueAt && order.operationalReturnDueAt > returnAt ? order.operationalReturnDueAt : returnAt;
    const effectiveReturnDue = effectiveDueAt(returnAt, finalOperationalReturnDueAt);

    const postReturnBufferHours = policy.postReturnBufferHours ?? (policy.occupiedPostReturnBufferMinutes ? Math.round(policy.occupiedPostReturnBufferMinutes / 60) : 24);
    const deepInspectionBufferHours = policy.deepInspectionBufferHours ?? 48;
    const lineOccupiedUntilDates = order.rentalOrderLinesViaOrderId.map((line: any) => {
      const requiresDeep = line.product?.requiresDeepReturnInspection === true;
      const bufferHours = requiresDeep ? deepInspectionBufferHours : postReturnBufferHours;
      return new Date(effectiveReturnDue.getTime() + bufferHours * 3600000);
    });
    const nextOccupiedUntil = new Date(Math.max(order.occupiedEndAt.getTime(), ...lineOccupiedUntilDates.map((d: Date) => d.getTime())));

    const chargedDays = calculateChargedDays(order.rentalStartAt, returnAt);
    const lineAmounts = order.rentalOrderLinesViaOrderId.map((line: any) => {
      const newFee = parseWholeVnd(line.dailyPriceSnapshot.toString()) * BigInt(line.quantity) * BigInt(chargedDays);
      const previousFee = parseWholeVnd(line.lineRentalFee.toString());
      const amount = newFee > previousFee ? newFee - previousFee : 0n;
      return { line, amount };
    });
    const additionalFee = lineAmounts.reduce((a: bigint, v: { amount: bigint }) => a + v.amount, 0n);
    // Expired quotes need not block future quotes; only held extensions are unique.
    const quoteExpiresAt = new Date(now.getTime() + requiredPolicyInt(policy.quoteTtlMinutes, 'quoteTtlMinutes') * 60000);
    const quotedTermsVersion = String(policy.termsVersion ?? policy.extensionTermsVersion ?? 'v1.5.2');
    const termsPayload = JSON.stringify({
      orderId,
      currentDueAt: order.rentalEndAt.toISOString(),
      requestedReturnAt: returnAt.toISOString(),
      returnOptionId,
      returnOption: chosen.returnOptionSnapshot,
      additionalFee: additionalFee.toString(),
      currency: order.currency,
      chargedDays,
      policySnapshot: order.policySnapshot,
      termsVersion: quotedTermsVersion,
    });
    const termsHash = digest(termsPayload);

    const record = await this.prisma.rentalExtensionRequest.create({ data: {
      orderId, userId, status: RentalExtensionStatus.QUOTED,
      previousRentalEndAt: order.rentalEndAt, requestedRentalEndAt: returnAt,
      previousOccupiedUntil: order.occupiedEndAt, requestedOccupiedUntil: nextOccupiedUntil,
      returnOptionSnapshot: chosen.returnOptionSnapshot,
      additionalFee: toPrismaDecimalVnd(additionalFee), currency: order.currency,
      policySnapshot: order.policySnapshot as Prisma.InputJsonValue,
      quotedOrderVersion: order.version, quoteExpiresAt,
      termsHash,
      lines: { create: lineAmounts.map(({ line, amount }: { line: any; amount: bigint }) => ({
        orderLineId: line.id, previousChargedDays: line.chargedDays, newChargedDays: chargedDays,
        additionalFee: toPrismaDecimalVnd(amount),
      })) },
    } });
    return { extensionQuoteId: record.id, orderId, currentDueAt: order.rentalEndAt, requestedReturnAt: returnAt,
      returnOption: chosen.returnOptionSnapshot, additionalFee: toSafeNumber(additionalFee), currency: order.currency,
      chargedDays, expiresAt: quoteExpiresAt, expectedVersion: order.version, termsVersion: quotedTermsVersion, termsHash };
  }

  async confirm(
    userId: string,
    orderId: string,
    quoteId: string,
    expectedVersion: number,
    key: string,
    acceptedTermsVersion?: string,
    suppliedTermsHashOrNow?: string | Date,
    maybeNow?: Date,
  ) {
    const suppliedTermsHash = typeof suppliedTermsHashOrNow === 'string' ? suppliedTermsHashOrNow : undefined;
    const now = suppliedTermsHashOrNow instanceof Date ? suppliedTermsHashOrNow : (maybeNow ?? new Date());
    if (!acceptedTermsVersion) throw error('TERMS_NOT_ACCEPTED');
    const raw = await this.prisma.rentalExtensionRequest.findUnique({ where: { id: quoteId }, include: { order: true } });
    if (!raw || raw.orderId !== orderId || raw.userId !== userId) throw AppError.fromCode('FORBIDDEN');
    const snap = jsonObject(raw.policySnapshot);
    const expectedTermsVersion = String(snap.termsVersion ?? snap.extensionTermsVersion ?? 'v1.5.2');
    if (acceptedTermsVersion !== expectedTermsVersion) throw error('TERMS_VERSION_MISMATCH');
    if (suppliedTermsHash && raw.termsHash && suppliedTermsHash !== raw.termsHash) throw error('TERMS_HASH_MISMATCH');
    const termsHash = raw.termsHash ?? suppliedTermsHash ?? digest(JSON.stringify({
      orderId,
      currentDueAt: raw.previousRentalEndAt.toISOString(),
      requestedRentalEndAt: raw.requestedRentalEndAt.toISOString(),
      additionalFee: raw.additionalFee.toString(),
      currency: raw.currency,
      termsVersion: acceptedTermsVersion,
    }));
    const hash = digest(JSON.stringify({ orderId, quoteId, expectedVersion, acceptedTermsVersion }));
    // Idempotent replay must precede live-Trip and state checks: the first request may already be APPLIED.
    const existing = await this.prisma.idempotencyRecord.findUnique({ where: { scope_userId_idempotencyKey: { scope: 'RENTAL_EXTENSION_CONFIRM', userId, idempotencyKey: key } } });
    if (existing) {
      if (existing.requestHash !== hash) throw error('IDEMPOTENCY_KEY_REUSED');
      if (existing.responseBody) return existing.responseBody as any;
      throw error('OPERATION_CONFLICT');
    }
    const ctx = await this.context.getByTripId(raw.order.tripId, userId, now);
    if (!ctx || ctx.membershipRef !== raw.order.membershipRef) throw AppError.fromCode('FORBIDDEN');
    // Revalidate server-issued option at confirmation: a stale quote cannot invent delivery capacity.
    const option = jsonObject(raw.returnOptionSnapshot);
    const max = requiredPolicyInt(snap.maxRentalAfterTripHours, 'maxRentalAfterTripHours');
    resolveRentalReturn({ ...ctx, activePolicy: { ...ctx.activePolicy, maxRentalAfterTripHours: max } }, raw.requestedRentalEndAt, String(option.id));
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
        const cached = await tx.idempotencyRecord.findUnique({ where: { scope_userId_idempotencyKey: { scope: 'RENTAL_EXTENSION_CONFIRM', userId, idempotencyKey: key } } });
        if (cached) {
          if (cached.requestHash !== hash) throw error('IDEMPOTENCY_KEY_REUSED');
          if (cached.responseBody) return cached.responseBody as any;
          throw error('OPERATION_CONFLICT');
        }
        const order = await tx.rentalOrder.findUnique({
          where: { id: orderId },
          include: {
            rentalOrderLinesViaOrderId: { include: { product: true } },
            deliveryTasksViaOrderId: { where: { taskType: DeliveryTaskType.RETURN } },
            returnInspectionsViaOrderId: { take: 1 },
          },
        });
        if (!order || order.userId !== userId) throw AppError.fromCode('FORBIDDEN');
        checkExtendable(order, now);
        if (order.version !== expectedVersion || raw.quotedOrderVersion !== order.version || raw.previousRentalEndAt.getTime() !== order.rentalEndAt.getTime()) throw error('VERSION_CONFLICT');
        if (raw.quoteExpiresAt <= now || raw.status !== RentalExtensionStatus.QUOTED) throw error('EXTENSION_QUOTE_EXPIRED');
        if ((await tx.rentalExtensionRequest.count({ where: { orderId, status: RentalExtensionStatus.PENDING_PAYMENT } })) > 0) throw error('EXTENSION_ALREADY_PENDING');
        const holdMinutes = requiredPolicyInt(jsonObject(order.policySnapshot).extensionHoldMinutes, 'extensionHoldMinutes');
        if (holdMinutes <= 0) throw error('EXTENSION_NOT_CONFIGURED');
        await tx.idempotencyRecord.create({ data: { scope: 'RENTAL_EXTENSION_CONFIRM', userId, idempotencyKey: key, requestHash: hash } });

        // RB-POL-33: Primary location scoping
        const primaryLocationId = await resolveActivePrimaryRentalLocation(tx);
        for (const productId of [...new Set(order.rentalOrderLinesViaOrderId.map((l: any) => l.productId))].sort()) {
          await tx.$queryRaw`SELECT id FROM rental_products WHERE id = ${productId}::uuid FOR UPDATE`;
        }
        const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60000);
        const nextCycle = (await tx.rentalQuantityReservation.aggregate({ where: { orderLineId: { in: order.rentalOrderLinesViaOrderId.map((l: any) => l.id) } }, _max: { reservationCycle: true } }))._max.reservationCycle ?? 1;

        const finalOperationalReturnDueAt = order.operationalReturnDueAt && order.operationalReturnDueAt > raw.requestedRentalEndAt
          ? order.operationalReturnDueAt
          : raw.requestedRentalEndAt;
        const effectiveReturnDue = effectiveDueAt(raw.requestedRentalEndAt, finalOperationalReturnDueAt);

        const postReturnBufferHours = snap.postReturnBufferHours ?? (snap.occupiedPostReturnBufferMinutes ? Math.round(snap.occupiedPostReturnBufferMinutes / 60) : 24);
        const deepInspectionBufferHours = snap.deepInspectionBufferHours ?? 48;

        for (const line of order.rentalOrderLinesViaOrderId) {
          const requiresDeep = line.product?.requiresDeepReturnInspection === true;
          const lineBufferHours = requiresDeep ? deepInspectionBufferHours : postReturnBufferHours;
          const lineRequestedOccupiedUntil = new Date(effectiveReturnDue.getTime() + lineBufferHours * 3600000);

          // Find this line's previous confirmed reservation occupiedUntil to establish contiguous window
          const latestConfirmed = tx.rentalQuantityReservation.findFirst
            ? await tx.rentalQuantityReservation.findFirst({
                where: { orderLineId: line.id, status: ReservationStatus.CONFIRMED },
                orderBy: { reservationCycle: 'desc' },
              })
            : (await tx.rentalQuantityReservation.findMany({
                where: { orderLineId: line.id, status: ReservationStatus.CONFIRMED },
                orderBy: { reservationCycle: 'desc' },
                take: 1,
              }))[0];
          const linePreviousOccupiedUntil = latestConfirmed?.occupiedUntil ?? new Date(order.rentalEndAt.getTime() + lineBufferHours * 3600000);

          if (lineRequestedOccupiedUntil > linePreviousOccupiedUntil) {
            const availableCount = await getAvailableCountWithTx(tx, {
              productId: line.productId,
              inventoryLocationId: primaryLocationId,
              occupiedFrom: linePreviousOccupiedUntil,
              occupiedUntil: lineRequestedOccupiedUntil,
              now,
            });
            const assignedOwnUnits = await tx.rentalUnitAssignment.count({ where: { orderLineId: line.id, status: { in: ['ASSIGNED', 'PACKED', 'HANDED_OVER'] } } });
            // The delta does not overlap our original reservation. Add back the order's own physically
            // assigned units (counted as blocked by the generic availability helper).
            if (line.quantity > availableCount + assignedOwnUnits) throw error('EXTENSION_CAPACITY_CONFLICT');
            await tx.rentalQuantityReservation.create({
              data: {
                orderLineId: line.id,
                productId: line.productId,
                quantity: line.quantity,
                reservationCycle: nextCycle + 1,
                occupiedFrom: linePreviousOccupiedUntil,
                occupiedUntil: lineRequestedOccupiedUntil,
                status: ReservationStatus.HELD,
                holdExpiresAt,
              },
            });
          }
        }
        const updated = await tx.rentalExtensionRequest.update({
          where: { id: raw.id },
          data: {
            status: RentalExtensionStatus.PENDING_PAYMENT,
            holdExpiresAt,
            acceptedByUserId: userId,
            acceptedAt: now,
            acceptedTermsVersion,
            termsHash,
            version: { increment: 1 },
          },
        });
        if (parseWholeVnd(updated.additionalFee.toString()) === 0n) await applyExtensionWithTx(tx, updated.id, now);
        const result = { extensionId: updated.id, status: parseWholeVnd(updated.additionalFee.toString()) === 0n ? 'APPLIED' : 'PENDING_PAYMENT', additionalFee: Number(updated.additionalFee), holdExpiresAt };
        await tx.idempotencyRecord.update({ where: { scope_userId_idempotencyKey: { scope: 'RENTAL_EXTENSION_CONFIRM', userId, idempotencyKey: key } }, data: { responseBody: result, completedAt: now } });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw error('EXTENSION_ALREADY_PENDING');
      throw e;
    }
  }

  async list(userId: string, orderId: string) {
    const order = await this.prisma.rentalOrder.findUnique({ where: { id: orderId }, select: { userId: true } });
    if (!order || order.userId !== userId) throw AppError.fromCode('FORBIDDEN');
    const rows = await this.prisma.rentalExtensionRequest.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' }, include: { lines: true } });
    return { items: rows.map(r => ({ ...r, additionalFee: Number(r.additionalFee), lines: r.lines.map(l => ({ ...l, additionalFee: Number(l.additionalFee) })) })) };
  }

  async expire(now = new Date()) {
    const expired = await this.prisma.rentalExtensionRequest.findMany({ where: { status: RentalExtensionStatus.PENDING_PAYMENT, holdExpiresAt: { lte: now } }, select: { id: true, orderId: true }, take: 100 });
    for (const item of expired) await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${item.orderId}::uuid FOR UPDATE`;
      const current = await tx.rentalExtensionRequest.findUnique({ where: { id: item.id } });
      if (!current || current.status !== RentalExtensionStatus.PENDING_PAYMENT || !current.holdExpiresAt || current.holdExpiresAt > now) return;
      await releaseExtensionWithTx(tx, current, RentalExtensionStatus.EXPIRED, now);
    });
    return expired.length;
  }
}

function error(code: string): AppError { return new AppError({ code, message: code }); }
function requiredPolicyInt(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new AppError({ code: 'EXTENSION_POLICY_NOT_CONFIGURED', message: `Missing approved extension policy value: ${field}` });
  return Number(value);
}
function jsonObject(v: unknown): Record<string, any> { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {}; }
function digest(v: string) { return createHash('sha256').update(v).digest('hex'); }
function checkExtendable(order: any, now: Date) {
  if (![RentalOrderStatus.ACTIVE].includes(order.status)) throw error('EXTENSION_INVALID_ORDER_STATE');
  const due = effectiveDueAt(order.rentalEndAt, order.operationalReturnDueAt);
  if (now >= due || order.exceptionStatus === 'OVERDUE') throw error('EXTENSION_TOO_LATE');
  if (order.returnInspectionsViaOrderId?.length) throw error('EXTENSION_RETURN_STARTED');
  // Invariant: Return delivery task in SCHEDULED (including when staff is claimed or assigned in target 1.3.3)
  // does NOT block valid extension. Only physical collection/return (COLLECTING, RETURNED, INVENTORY_RECEIVED) blocks.
  if (order.deliveryTasksViaOrderId?.some((t: any) => ![DeliveryTaskStatus.SCHEDULED, DeliveryTaskStatus.BLOCKED].includes(t.status))) throw error('EXTENSION_RETURN_TASK_STARTED');
}
export async function releaseExtensionWithTx(tx: Prisma.TransactionClient, ext: { id: string; orderId: string }, status: RentalExtensionStatus, now: Date) {
  const actual = await tx.rentalExtensionRequest.findUnique({
    where: { id: ext.id },
    include: { lines: true },
  });
  if (!actual) return;
  const lineIds = (actual as any).lines?.map((l: any) => l.orderLineId)
    ?? (await tx.rentalExtensionLine.findMany({ where: { extensionId: ext.id }, select: { orderLineId: true } })).map(l => l.orderLineId);
  await tx.rentalQuantityReservation.updateMany({
    where: {
      orderLineId: { in: lineIds },
      status: ReservationStatus.HELD,
      ...(actual.holdExpiresAt ? { holdExpiresAt: actual.holdExpiresAt } : {}),
    },
    data: { status: ReservationStatus.RELEASED, releasedAt: now, version: { increment: 1 } },
  });
  await tx.rentalExtensionRequest.update({ where: { id: ext.id }, data: { status, version: { increment: 1 } } });
}

export async function applyExtensionWithTx(tx: Prisma.TransactionClient, id: string, now: Date, effectiveAt?: Date) {
  const ext = await tx.rentalExtensionRequest.findUnique({ where: { id }, include: { lines: true } });
  if (!ext || ext.status === RentalExtensionStatus.APPLIED) return;
  const checkTime = effectiveAt ?? now;
  if (ext.status !== RentalExtensionStatus.PENDING_PAYMENT || !ext.holdExpiresAt || ext.holdExpiresAt < checkTime) throw error('EXTENSION_NOT_APPLICABLE');

  // Row lock on rental_orders to serialize concurrent operations (e.g. Trip reschedule vs Extension APPLIED)
  await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${ext.orderId}::uuid FOR UPDATE`;

  const order = await tx.rentalOrder.findUnique({
    where: { id: ext.orderId },
    include: {
      rentalOrderLinesViaOrderId: { include: { product: true } },
      deliveryTasksViaOrderId: { where: { taskType: DeliveryTaskType.RETURN } },
      returnInspectionsViaOrderId: { take: 1 },
    },
  });
  if (!order) throw error('RENTAL_ORDER_NOT_FOUND');
  checkExtendable(order, checkTime);
  if (order.rentalEndAt.getTime() !== ext.previousRentalEndAt.getTime() || order.occupiedEndAt.getTime() !== ext.previousOccupiedUntil.getTime()) throw error('VERSION_CONFLICT');
  const pointId = String(jsonObject(ext.returnOptionSnapshot).pointId ?? '');
  if (!pointId) throw error('RENTAL_RETURN_OPTION_UNAVAILABLE');

  const reservedLines = await tx.rentalQuantityReservation.findMany({
    where: {
      orderLineId: { in: ext.lines.map(l => l.orderLineId) },
      status: ReservationStatus.HELD,
      holdExpiresAt: ext.holdExpiresAt,
    },
  });
  if (reservedLines.some(r => r.holdExpiresAt && r.holdExpiresAt < checkTime)) throw error('EXTENSION_HOLD_EXPIRED');

  for (const line of ext.lines) {
    const current = await tx.rentalOrderLine.findUnique({ where: { id: line.orderLineId } });
    if (!current) throw error('EXTENSION_LINE_MISSING');
    await tx.rentalOrderLine.update({
      where: { id: line.orderLineId },
      data: { chargedDays: line.newChargedDays, lineRentalFee: { increment: line.additionalFee } },
    });
  }

  if (reservedLines.length > 0) {
    await tx.rentalQuantityReservation.updateMany({
      where: { id: { in: reservedLines.map(r => r.id) } },
      data: { status: ReservationStatus.CONFIRMED, confirmedAt: now, version: { increment: 1 } },
    });
  }

  const finalOperationalReturnDueAt = order.operationalReturnDueAt && order.operationalReturnDueAt > ext.requestedRentalEndAt
    ? order.operationalReturnDueAt
    : ext.requestedRentalEndAt;
  const finalEffectiveDueAt = effectiveDueAt(ext.requestedRentalEndAt, finalOperationalReturnDueAt);
  const finalOccupiedEndAt = new Date(Math.max(order.occupiedEndAt.getTime(), ext.requestedOccupiedUntil.getTime()));

  // Capture original effective operational due before order is updated
  const oldEffectiveOperationalDueAt = order.operationalReturnDueAt && order.operationalReturnDueAt > order.rentalEndAt
    ? order.operationalReturnDueAt
    : (ext.previousRentalEndAt ?? order.rentalEndAt);

  await tx.rentalOrder.update({
    where: { id: order.id },
    data: {
      rentalEndAt: ext.requestedRentalEndAt,
      plannedReturnAt: finalEffectiveDueAt,
      operationalReturnDueAt: finalOperationalReturnDueAt,
      occupiedEndAt: finalOccupiedEndAt,
      returnPointId: pointId,
      returnOptionSnapshot: ext.returnOptionSnapshot as Prisma.InputJsonValue,
      rentalFee: { increment: ext.additionalFee },
      totalAmount: { increment: ext.additionalFee },
      version: { increment: 1 },
    },
  });

  for (const task of order.deliveryTasksViaOrderId) {
    if (!([DeliveryTaskStatus.SCHEDULED, DeliveryTaskStatus.BLOCKED] as string[]).includes(task.status)) throw error('EXTENSION_RETURN_TASK_STARTED');
    await tx.deliveryTask.update({ where: { id: task.id }, data: { servicePointId: pointId, scheduledAt: finalEffectiveDueAt, version: { increment: 1 } } });
  }

  await tx.rentalExtensionRequest.update({ where: { id }, data: { status: RentalExtensionStatus.APPLIED, appliedAt: now, version: { increment: 1 } } });

  // SOT RB-FR-1002, RB-AC-DOC-03/04: Exactly one immutable EXTENSION_APPENDIX must be issued
  // in the same transaction. Fail closed: missing root or issue error rolls back APPLIED.
  const appliedExt = {
    ...ext,
    status: RentalExtensionStatus.APPLIED,
    appliedAt: now,
    order: {
      ...order,
      rentalEndAt: ext.requestedRentalEndAt,
      operationalReturnDueAt: finalOperationalReturnDueAt,
      plannedReturnAt: finalEffectiveDueAt,
      occupiedEndAt: finalOccupiedEndAt,
    },
    oldEffectiveOperationalDueAt,
    newEffectiveOperationalDueAt: finalEffectiveDueAt,
    occupiedUntil: finalOccupiedEndAt,
    quoteId: (ext as any).quoteId ?? ext.id,
  };
  const appendixDoc = await issueExtensionAppendixTx(tx, id, now, appliedExt);

  await tx.rentalOutboxEvent.upsert({
    where: { deduplicationKey: `rental-extension-applied:${id}` },
    update: {},
    create: {
      deduplicationKey: `rental-extension-applied:${id}`,
      eventType: 'RENTAL_EXTENSION_APPLIED',
      aggregateType: 'RentalOrder',
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        extensionId: id,
        newDueAt: ext.requestedRentalEndAt.toISOString(),
        effectiveOperationalDueAt: finalEffectiveDueAt.toISOString(),
        returnPointId: pointId,
        appendixDocumentId: appendixDoc.id,
        sourcePaymentId: ext.paymentRef ?? null,
        appliedAt: now.toISOString(),
      },
    },
  });
}

/** Inside existing verified payment webhook transaction. Never resurrect expired extension. */
export async function consumeExtensionPaymentWithTx(
  tx: Prisma.TransactionClient,
  extensionId: string,
  payment: { id: string; invoiceId: string; amount: Prisma.Decimal; currency: string; transactionRef: string | null; paidAt?: Date | null },
  status: 'SUCCEEDED' | 'FAILED',
  providerRef: string | null | undefined,
  now: Date,
): Promise<{ applied: boolean; reasonCode?: string }> {
  // Row lock extension and order to prevent race conditions with background expiry scheduler
  await tx.$queryRaw`SELECT id FROM rental_extension_requests WHERE id = ${extensionId}::uuid FOR UPDATE`;
  const ext = await tx.rentalExtensionRequest.findUnique({ where: { id: extensionId } });
  if (!ext || ext.invoiceId !== payment.invoiceId || ext.paymentRef !== payment.id) throw error('EXTENSION_PAYMENT_MISMATCH');
  if (payment.currency !== ext.currency || payment.amount.toFixed(2) !== ext.additionalFee.toFixed(2)) throw error('PAYMENT_AMOUNT_MISMATCH');
  if (status === 'FAILED') {
    if (ext.status === RentalExtensionStatus.APPLIED) return { applied: true }; // Do not downgrade a settled payment on a late failure event.
    await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED, transactionRef: providerRef ?? payment.transactionRef, version: { increment: 1 } } });
    if (ext.status === RentalExtensionStatus.PENDING_PAYMENT) await releaseExtensionWithTx(tx, ext, RentalExtensionStatus.PAYMENT_FAILED, now);
    return { applied: false, reasonCode: 'PAYMENT_FAILED' };
  }
  if (payment.paidAt === null) {
    // Payment succeeded at provider, but explicitly lacks trusted paidAt timestamp.
    // Preserve payment ledger as SUCCEEDED; never downgrade confirmed payment to FAILED.
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        transactionRef: providerRef ?? payment.transactionRef,
        version: { increment: 1 },
      },
    });
    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        version: { increment: 1 },
      },
    });
    if (ext.status === RentalExtensionStatus.PENDING_PAYMENT) {
      await releaseExtensionWithTx(tx, ext, RentalExtensionStatus.EXPIRED, now);
    }
    await tx.rentalOutboxEvent.upsert({
      where: { deduplicationKey: `rental-extension-refund-required:${ext.id}:${payment.id}` },
      update: {},
      create: {
        deduplicationKey: `rental-extension-refund-required:${ext.id}:${payment.id}`,
        eventType: 'RENTAL_EXTENSION_REFUND_REQUIRED',
        aggregateType: 'RentalExtensionRequest',
        aggregateId: ext.id,
        payload: {
          extensionId: ext.id,
          orderId: ext.orderId,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          amount: payment.amount.toString(),
          reason: 'PAYMENT_TIMESTAMP_UNTRUSTED',
          paidAt: now.toISOString(),
        },
      },
    });
    if ((tx as any).paymentOutboxEvent?.upsert) {
      await (tx as any).paymentOutboxEvent.upsert({
        where: { deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1` },
        create: {
          deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1`,
          eventType: 'TECHNICAL_REVERSAL_REQUESTED',
          aggregateType: 'Payment',
          aggregateId: payment.id,
          payload: {
            schemaVersion: 1,
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            reasonCode: 'PAYMENT_TIMESTAMP_UNTRUSTED',
          },
        },
        update: {},
      });
    }
    return { applied: false, reasonCode: 'PAYMENT_TIMESTAMP_UNTRUSTED' };
  }

  const effectivePaidAt = payment.paidAt ?? now;
  await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCEEDED, paidAt: effectivePaidAt, transactionRef: providerRef ?? payment.transactionRef, version: { increment: 1 } } });
  await tx.invoice.update({ where: { id: payment.invoiceId }, data: { status: InvoiceStatus.PAID, paidAt: effectivePaidAt, version: { increment: 1 } } });
  if (ext.status === RentalExtensionStatus.APPLIED) return { applied: true };

  // Authoritative timeliness check:
  // Payment is timely if provider confirmed it before hold expired, AND extension was still in PENDING_PAYMENT.
  const isTimely = ext.status === RentalExtensionStatus.PENDING_PAYMENT
    && !!ext.holdExpiresAt
    && effectivePaidAt <= ext.holdExpiresAt;

  if (!isTimely) {
    let rejectionReason = 'LATE_PAYMENT';
    if (ext.status === RentalExtensionStatus.EXPIRED && ext.holdExpiresAt && effectivePaidAt <= ext.holdExpiresAt) {
      rejectionReason = 'HOLD_EXPIRED_BEFORE_PROCESSING';
    } else if (ext.status !== RentalExtensionStatus.PENDING_PAYMENT) {
      rejectionReason = 'EXTENSION_NOT_APPLICABLE';
    }

    if (ext.status === RentalExtensionStatus.PENDING_PAYMENT)
      await releaseExtensionWithTx(tx, ext, RentalExtensionStatus.EXPIRED, now);
    await tx.rentalOutboxEvent.upsert({
      where: { deduplicationKey: `rental-extension-refund-required:${ext.id}:${payment.id}` },
      update: {},
      create: {
        deduplicationKey: `rental-extension-refund-required:${ext.id}:${payment.id}`,
        eventType: 'RENTAL_EXTENSION_REFUND_REQUIRED',
        aggregateType: 'RentalExtensionRequest',
        aggregateId: ext.id,
        payload: {
          extensionId: ext.id,
          orderId: ext.orderId,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          amount: payment.amount.toString(),
          reason: 'EXTENSION_HOLD_EXPIRED',
          paidAt: effectivePaidAt.toISOString(),
        },
      },
    });
    if ((tx as any).paymentOutboxEvent?.upsert) {
      await (tx as any).paymentOutboxEvent.upsert({
        where: { deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1` },
        create: {
          deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1`,
          eventType: 'TECHNICAL_REVERSAL_REQUESTED',
          aggregateType: 'Payment',
          aggregateId: payment.id,
          payload: {
            schemaVersion: 1,
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            reasonCode: rejectionReason,
          },
        },
        update: {},
      });
    }
    return { applied: false, reasonCode: rejectionReason };
  }

  try {
    await applyExtensionWithTx(tx, ext.id, now, effectivePaidAt);
    return { applied: true };
  } catch (err: any) {
    if (ext.status === RentalExtensionStatus.PENDING_PAYMENT) {
      await releaseExtensionWithTx(tx, ext, RentalExtensionStatus.EXPIRED, now);
    }
    const rejectionReason = err?.code === 'EXTENSION_TOO_LATE' ? 'POST_DUE_PAYMENT' : 'EXTENSION_NOT_APPLICABLE';
    await tx.rentalOutboxEvent.upsert({
      where: { deduplicationKey: `rental-extension-refund-required:${ext.id}:${payment.id}` },
      update: {},
      create: {
        deduplicationKey: `rental-extension-refund-required:${ext.id}:${payment.id}`,
        eventType: 'RENTAL_EXTENSION_REFUND_REQUIRED',
        aggregateType: 'RentalExtensionRequest',
        aggregateId: ext.id,
        payload: {
          extensionId: ext.id,
          orderId: ext.orderId,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          amount: payment.amount.toString(),
          reason: rejectionReason,
          paidAt: effectivePaidAt.toISOString(),
        },
      },
    });
    if ((tx as any).paymentOutboxEvent?.upsert) {
      await (tx as any).paymentOutboxEvent.upsert({
        where: { deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1` },
        create: {
          deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1`,
          eventType: 'TECHNICAL_REVERSAL_REQUESTED',
          aggregateType: 'Payment',
          aggregateId: payment.id,
          payload: {
            schemaVersion: 1,
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            reasonCode: rejectionReason,
          },
        },
        update: {},
      });
    }
    return { applied: false, reasonCode: rejectionReason };
  }
}
