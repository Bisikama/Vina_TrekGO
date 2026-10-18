import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  RentalOrderStatus,
  RentalOrderExceptionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import { effectiveDueAt } from '../../../ordering/extension/rental-extension.policy';

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

  constructor(private readonly prisma: PrismaService) {}

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
    const activeOrders = await this.prisma.rentalOrder.findMany({
      where: {
        status: RentalOrderStatus.ACTIVE,
        exceptionStatus: RentalOrderExceptionStatus.NONE,
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
    });

    const overdueOrderIds: string[] = [];

    for (const order of activeOrders) {
      const effectiveOperationalDueAt = effectiveDueAt(order.rentalEndAt, order.operationalReturnDueAt);

      if (now <= effectiveOperationalDueAt) {
        continue;
      }

      await this.prisma.$transaction(
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
            return;
          }

          const currentEffectiveDue = effectiveDueAt(current.rentalEndAt, current.operationalReturnDueAt);
          if (now <= currentEffectiveDue) {
            return;
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

          overdueOrderIds.push(current.id);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    }

    if (overdueOrderIds.length > 0) {
      this.logger.log(`Marked ${overdueOrderIds.length} rental order(s) as OVERDUE at ${now.toISOString()}`);
    }

    // 3. Follow-up milestone scan for orders already marked OVERDUE (+2h customer contact, >=48h admin review)
    const existingOverdueOrders = await this.prisma.rentalOrder.findMany({
      where: {
        status: RentalOrderStatus.ACTIVE,
        exceptionStatus: RentalOrderExceptionStatus.OVERDUE,
      },
      select: {
        id: true,
        userId: true,
        tripId: true,
        rentalStartAt: true,
        rentalEndAt: true,
        operationalReturnDueAt: true,
      },
    });

    for (const order of existingOverdueOrders) {
      const evaluation = this.evaluateOverdueThresholds(order, now);

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
    }

    return {
      scannedCount: activeOrders.length + existingOverdueOrders.length,
      overdueOrderIds,
    };
  }
}
