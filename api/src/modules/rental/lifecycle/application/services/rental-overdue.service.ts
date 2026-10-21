import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  RentalOrderStatus,
  RentalOrderExceptionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import { effectiveDueAt } from '../../../ordering/extension/rental-extension.policy';
import { ensureReturnTaskWithTx, returnTaskScheduleAt } from './rental-return-task';

export interface OverdueEvaluationResult {
  isOverdue: boolean;
  hoursOverdue: number;
  effectiveOperationalDueAt: Date;
  missingReviewRequired: boolean;
  adminLostReviewEligible: boolean;
}

export interface OverdueScanResult {
  scannedCount: number;
  overdueOrderIds: string[];
}

function jsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * RentalOverdueService:
 * Implements SOT-compliant Overdue lifecycle based on effectiveOperationalDueAt.
 * Invariants:
 * 1. effectiveOperationalDueAt = max(rentalEndAt, operationalReturnDueAt).
 * 2. Overdue transition sets exceptionStatus = OVERDUE.
 * 3. Invariant: NEVER auto-declares EquipmentUnit as LOST. Customer custody is preserved.
 * 4. Invariant: NEVER auto-deducts deposits or charges arbitrary fines without manual review.
 * 5. +2h mark flags missing review per unit (MISSING_PENDING_REVIEW).
 * 6. >=48h mark flags ADMIN lost review eligibility (requires audit evidence, never automated).
 */
@Injectable()
export class RentalOverdueService {
  private readonly logger = new Logger(RentalOverdueService.name);
  private returnTaskCursor: string | undefined;
  private readonly returnTaskFailures = new Map<string, { attempts: number; retryAt: number }>();
  private overdueCandidateCursor: string | undefined;
  private overdueMilestoneCursor: string | undefined;

  constructor(private readonly prisma: PrismaService) {}

  /** Job fallback: event đến muộn vẫn tạo được đúng một ReturnTask khi hết quyền thuê. */
  async openDueReturnTasks(now = new Date()): Promise<number> {
    let opened = 0;
    let failures = 0;
    // Keyset paging prevents a failing first order from starving every later order.
    // The cursor rotates across scheduler ticks; each tick has a bounded workload.
    for (let page = 0; page < 10; page++) {
    const candidates = await this.prisma.rentalOrder.findMany({
      where: {
        ...(this.returnTaskCursor ? { id: { gt: this.returnTaskCursor } } : {}),
        status: RentalOrderStatus.ACTIVE,
        rentalEndAt: { lte: now },
        OR: [{ operationalReturnDueAt: null }, { operationalReturnDueAt: { lte: now } }],
        rentalHandoverViaOrderId: { isNot: null },
        packageViaOrderId: { isNot: null },
        deliveryTasksViaOrderId: { none: { taskType: 'RETURN' } },
      },
      select: { id: true }, orderBy: { id: 'asc' }, take: 100,
    });
    if (!candidates.length) {
      this.returnTaskCursor = undefined;
      break;
    }
    for (const candidate of candidates) {
      this.returnTaskCursor = candidate.id;
      const previousFailure = this.returnTaskFailures.get(candidate.id);
      if (previousFailure && previousFailure.retryAt > now.getTime()) continue;
      try {
      const taskId = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${candidate.id}::uuid FOR UPDATE`;
        const current = await tx.rentalOrder.findUnique({
          where: { id: candidate.id },
          select: { status: true, rentalEndAt: true, operationalReturnDueAt: true, returnOptionSnapshot: true },
        });
        if (!current || current.status !== RentalOrderStatus.ACTIVE ||
            effectiveDueAt(current.rentalEndAt, current.operationalReturnDueAt) > now) return null;
        const due = effectiveDueAt(current.rentalEndAt, current.operationalReturnDueAt);
        return ensureReturnTaskWithTx(tx, candidate.id,
          returnTaskScheduleAt(current.returnOptionSnapshot, due), 'DUE');
      });
      if (taskId) opened += 1;
      this.returnTaskFailures.delete(candidate.id);
      } catch (error) {
        failures += 1;
        const reason = error instanceof Error ? error.message.slice(0, 120) : 'UNKNOWN_ERROR';
        const attempts = (previousFailure?.attempts ?? 0) + 1;
        this.returnTaskFailures.set(candidate.id, { attempts,
          retryAt: now.getTime() + Math.min(3_600_000, 30_000 * 2 ** Math.min(attempts - 1, 7)) });
        this.logger.error(`ReturnTask creation failed for order ${candidate.id}, attempt ${attempts}: ${reason}`);
        try {
          await this.prisma.auditLog.create({ data: { action: 'RENTAL_RETURN_TASK_OPEN_FAILED',
            entityType: 'RentalOrder', entityId: candidate.id,
            newValues: { attempts, reason, retryAt: new Date(this.returnTaskFailures.get(candidate.id)!.retryAt).toISOString() } } });
        } catch (auditError) {
          this.logger.error(`ReturnTask failure audit unavailable for ${candidate.id}: ${auditError instanceof Error ? auditError.message : String(auditError)}`);
        }
      }
    }
    if (candidates.length < 100) { this.returnTaskCursor = undefined; break; }
    }
    if (failures) this.logger.error(`${failures} ReturnTask candidate(s) failed this tick; they remain eligible for retry.`);
    return opened;
  }

  /**
   * Evaluates overdue thresholds for a given rental order according to Policy 1.5.2 & Business Flow 1.3.2.
   */
  evaluateOverdueThresholds(
    order: {
      rentalEndAt: Date;
      operationalReturnDueAt?: Date | null;
      exceptionStatus?: RentalOrderExceptionStatus | null;
    },
    now = new Date(),
  ): OverdueEvaluationResult {
    const effectiveOperationalDueAt = effectiveDueAt(order.rentalEndAt, order.operationalReturnDueAt);
    const isOverdue = now > effectiveOperationalDueAt || order.exceptionStatus === RentalOrderExceptionStatus.OVERDUE;
    const diffMs = now.getTime() - effectiveOperationalDueAt.getTime();
    const hoursOverdue = isOverdue && diffMs > 0 ? diffMs / 3600000 : 0;

    return {
      isOverdue,
      hoursOverdue,
      effectiveOperationalDueAt,
      // SOT: Sau 2 giờ từ effectiveOperationalDueAt chưa có scan nhận: mở MISSING_PENDING_REVIEW riêng từng unit
      missingReviewRequired: hoursOverdue >= 2,
      // SOT: Trước khi ADMIN xác nhận LOST (chỉ từ ≥48 giờ): đối chiếu bằng chứng; không tự động
      adminLostReviewEligible: hoursOverdue >= 48,
    };
  }

  /**
   * Scans all ACTIVE orders past their effectiveOperationalDueAt and transitions their
   * exceptionStatus to OVERDUE with transactional concurrency safety and idempotent outbox emission.
   */
  async scanAndMarkOverdue(now = new Date()): Promise<OverdueScanResult> {
    const overdueOrderIds: string[] = [];
    let scannedCount = 0;
    for (let page = 0; page < 10; page++) {
    const activeOrders = await this.prisma.rentalOrder.findMany({
      where: {
        ...(this.overdueCandidateCursor ? { id: { gt: this.overdueCandidateCursor } } : {}),
        status: RentalOrderStatus.ACTIVE,
        exceptionStatus: RentalOrderExceptionStatus.NONE,
        rentalEndAt: { lt: now },
        OR: [{ operationalReturnDueAt: null }, { operationalReturnDueAt: { lt: now } }],
      },
      select: {
        id: true,
        userId: true,
        tripId: true,
        rentalStartAt: true,
        rentalEndAt: true,
        operationalReturnDueAt: true,
        version: true,
      },
      orderBy: { id: 'asc' }, take: 100,
    });
    if (!activeOrders.length) { this.overdueCandidateCursor = undefined; break; }
    scannedCount += activeOrders.length;

    for (const order of activeOrders) {
      this.overdueCandidateCursor = order.id;
      const effectiveOperationalDueAt = effectiveDueAt(order.rentalEndAt, order.operationalReturnDueAt);

      if (now <= effectiveOperationalDueAt) {
        continue;
      }

      try { const transitioned = await this.prisma.$transaction(
        async (tx) => {
          // Lock order row to prevent concurrent race conditions
          await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${order.id}::uuid FOR UPDATE`;

          const current = await tx.rentalOrder.findUnique({
            where: { id: order.id },
            select: {
              id: true,
              userId: true,
              tripId: true,
              status: true,
              exceptionStatus: true,
              rentalStartAt: true,
              rentalEndAt: true,
              operationalReturnDueAt: true,
              version: true,
            },
          });

          if (
            !current ||
            current.status !== RentalOrderStatus.ACTIVE ||
            current.exceptionStatus !== RentalOrderExceptionStatus.NONE
          ) {
            return false;
          }

          const currentEffectiveDue = effectiveDueAt(current.rentalEndAt, current.operationalReturnDueAt);
          if (now <= currentEffectiveDue) {
            return false;
          }

          // 1. Transition exceptionStatus to OVERDUE
          // Invariant: Status remains ACTIVE; equipment units are NOT changed to LOST; NO deposit deducted.
          await tx.rentalOrder.update({
            where: { id: current.id, version: current.version },
            data: {
              exceptionStatus: RentalOrderExceptionStatus.OVERDUE,
              version: { increment: 1 },
            },
          });

          // 2. Emit RENTAL_ORDER_OVERDUE outbox event
          await tx.rentalOutboxEvent.upsert({
            where: {
              deduplicationKey: `rental-order-overdue:${current.id}:${currentEffectiveDue.toISOString()}`,
            },
            update: {},
            create: {
              deduplicationKey: `rental-order-overdue:${current.id}:${currentEffectiveDue.toISOString()}`,
              eventType: 'RENTAL_ORDER_OVERDUE',
              aggregateType: 'RentalOrder',
              aggregateId: current.id,
              payload: jsonValue({
                orderId: current.id,
                userId: current.userId,
                tripId: current.tripId,
                rentalStartAt: current.rentalStartAt.toISOString(),
                rentalEndAt: current.rentalEndAt.toISOString(),
                operationalReturnDueAt: current.operationalReturnDueAt?.toISOString() ?? null,
                effectiveOperationalDueAt: currentEffectiveDue.toISOString(),
                overdueAt: now.toISOString(),
                equipmentStatus: 'RENTED',
                depositDeductionApplied: false,
              }),
            },
          });

          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
      if (transitioned) overdueOrderIds.push(order.id);
      } catch (error) {
        this.logger.error(`Overdue transition failed for order ${order.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (activeOrders.length < 100) { this.overdueCandidateCursor = undefined; break; }
    }

    if (overdueOrderIds.length > 0) {
      this.logger.log(`Marked ${overdueOrderIds.length} rental order(s) as OVERDUE at ${now.toISOString()}`);
    }

    // 3. Follow-up milestone scan for orders already marked OVERDUE (+2h customer contact, >=48h admin review)
    for (let page = 0; page < 10; page++) {
    const existingOverdueOrders = await this.prisma.rentalOrder.findMany({
      where: {
        ...(this.overdueMilestoneCursor ? { id: { gt: this.overdueMilestoneCursor } } : {}),
        status: RentalOrderStatus.ACTIVE,
        exceptionStatus: RentalOrderExceptionStatus.OVERDUE,
        rentalEndAt: { lt: now },
      },
      select: {
        id: true,
        userId: true,
        tripId: true,
        rentalStartAt: true,
        rentalEndAt: true,
        operationalReturnDueAt: true,
      },
      orderBy: { id: 'asc' }, take: 100,
    });
    if (!existingOverdueOrders.length) { this.overdueMilestoneCursor = undefined; break; }
    scannedCount += existingOverdueOrders.length;

    for (const order of existingOverdueOrders) {
      this.overdueMilestoneCursor = order.id;
      const evaluation = this.evaluateOverdueThresholds(order, now);

      try {
      if (evaluation.missingReviewRequired) {
        // SOT: At +2h mark without return receipt, trigger operational contact required
        await this.prisma.rentalOutboxEvent.upsert({
          where: { deduplicationKey: `rental-order-overdue-contact:${order.id}` },
          update: {},
          create: {
            deduplicationKey: `rental-order-overdue-contact:${order.id}`,
            eventType: 'RENTAL_ORDER_OVERDUE_CONTACT_REQUIRED',
            aggregateType: 'RentalOrder',
            aggregateId: order.id,
            payload: jsonValue({
              orderId: order.id,
              userId: order.userId,
              tripId: order.tripId,
              hoursOverdue: evaluation.hoursOverdue,
              effectiveOperationalDueAt: evaluation.effectiveOperationalDueAt.toISOString(),
              missingReviewRequired: true,
              customerContactRequired: true,
              equipmentStatus: 'RENTED',
            }),
          },
        });
      }

      if (evaluation.adminLostReviewEligible) {
        // SOT: At >=48h mark, flag eligible for manual Admin lost review (never automated)
        await this.prisma.rentalOutboxEvent.upsert({
          where: { deduplicationKey: `rental-order-overdue-admin-lost:${order.id}` },
          update: {},
          create: {
            deduplicationKey: `rental-order-overdue-admin-lost:${order.id}`,
            eventType: 'RENTAL_ORDER_OVERDUE_ADMIN_LOST_ELIGIBLE',
            aggregateType: 'RentalOrder',
            aggregateId: order.id,
            payload: jsonValue({
              orderId: order.id,
              userId: order.userId,
              tripId: order.tripId,
              hoursOverdue: evaluation.hoursOverdue,
              effectiveOperationalDueAt: evaluation.effectiveOperationalDueAt.toISOString(),
              adminLostReviewEligible: true,
              manualReviewRequired: true,
              equipmentStatus: 'RENTED',
            }),
          },
        });
      }
      } catch (error) {
        this.logger.error(`Overdue milestone failed for order ${order.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (existingOverdueOrders.length < 100) { this.overdueMilestoneCursor = undefined; break; }
    }

    return {
      scannedCount,
      overdueOrderIds,
    };
  }
}
