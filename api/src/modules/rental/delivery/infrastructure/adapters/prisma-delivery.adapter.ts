import envconfig from 'src/shared/config';
import { issueHandoverDocumentTx } from '../../../documents/application/rental-document-events';
import { reserveRentalCancellationRefundWithTx } from '../../../payments/rental-cancellation-refund';
import { confirmedPublicBookingOwnerId, VALID_PUBLIC_BOOKING_STATUSES } from '../../../shared/public-booking-membership';
import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  CustodyActorType,
  CustodyEventType,
  CustodyTransferStatus,
  DeliveryTaskStatus,
  DeliveryTaskType,
  DepositItemStatus,
  DepositSettlementStatus,
  EquipmentUnitStatus,
  InventoryTaskStatus,
  MediaScope,
  MediaStatus,
  PackageStatus,
  PaymentStatus,
  Prisma,
  RefundPurpose,
  RefundStatus,
  RentalFinancialStatus,
  RentalOrderExceptionStatus,
  RentalOrderStatus,
  RentalUnitAssignmentStatus,
  ReservationStatus,
  SnapshotStage,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import { AppError } from 'src/shared/errors/app-error';
import { DELIVERY_ERROR_CODES as DL, LOGISTICS_ERROR_CODES as LG } from 'src/shared/errors/codes/delivery.error-codes';
import type {
  AssignRentalTaskCommand,
  AssignRentalTaskResult,
  ClaimDeliveryTaskCommand,
  ClaimDeliveryTaskResult,
  CommitHandoverCommand,
  CommitHandoverResult,
  GetHandoverPreviewQuery,
  GetDeliveryTaskQuery,
  GetPickupCodeQuery,
  HandoverPreviewResult,
  ListAdminRentalTasksQuery,
  ListDeliveryTasksQuery,
  ListRentalAssigneesQuery,
  DeliveryPort,
  DeliveryTaskDetailResult,
  DeliveryTaskListResult,
  MarkNoShowCommand,
  MarkNoShowResult,
  PickupCodeResult,
  ReceivePackageCommand,
  ReceivePackageResult,
  RentalAssigneeListResult,
  VerifyRecipientCommand,
  VerifyRecipientResult,
} from '../../application/ports/delivery.port';

const ACTIVE_ASSIGNMENT_STATUSES: RentalUnitAssignmentStatus[] = [
  RentalUnitAssignmentStatus.ASSIGNED,
  RentalUnitAssignmentStatus.PACKED,
  RentalUnitAssignmentStatus.HANDED_OVER,
];

const HANDOVER_TASK_MUTABLE_STATUSES: DeliveryTaskStatus[] = [
  DeliveryTaskStatus.SCHEDULED,
  DeliveryTaskStatus.PACKAGE_RECEIVED,
  DeliveryTaskStatus.RECIPIENT_VERIFIED,
];

const USER_FAULT_REASONS = new Set([
  'NO_SHOW',
  'USER_NO_SHOW',
  'USER_CHANGED_MIND',
  'USER_REFUSED_DISCLOSED_CONDITION',
]);

@Injectable()
export class PrismaDeliveryAdapter implements DeliveryPort {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // RB-API-401
  // ---------------------------------------------------------------------------
  async listTasks(query: ListDeliveryTasksQuery): Promise<DeliveryTaskListResult> {
    const dateWindow = query.date ? vietnamBusinessDayUtcWindow(query.date) : null;
    const where: Prisma.DeliveryTaskWhereInput = {
      OR: [{ staffId: null }, { staffId: query.actorUserId }],
      taskType: query.type ? publicTaskTypeToDeliveryTaskType(query.type) : undefined,
      status: query.status ? (query.status as DeliveryTaskStatus) : undefined,
      scheduledAt: dateWindow ? { gte: dateWindow.start, lt: dateWindow.end } : undefined,
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.deliveryTask.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
        include: {
          package: { select: { id: true, packageCode: true, status: true } },
          servicePoint: { select: { id: true, name: true, address: true } },
          order: { select: { id: true, bookingId: true, tripId: true, status: true, recipientSnapshot: true } },
        },
      }),
      this.prisma.deliveryTask.count({ where }),
    ]);

    return {
      items: items.map((task) => ({
        id: task.id,
        type: deliveryTaskTypeToPublicType(task.taskType),
        status: task.status,
        scheduledAt: task.scheduledAt?.toISOString() ?? null,
        point: { id: task.servicePoint.id, name: task.servicePoint.name, address: task.servicePoint.address },
        package: { id: task.package.id, code: task.package.packageCode, status: task.package.status },
        orderSummary: {
          orderId: task.order.id,
          bookingId: task.order.bookingId,
          tripId: task.order.tripId,
          orderStatus: task.order.status,
          recipient: jsonObject(task.order.recipientSnapshot),
        },
        version: task.version,
        allowedActions: deliveryAllowedActions(task.status),
      })),
      pagination: pagination(query.page, query.pageSize, totalItems),
    };
  }

  // ---------------------------------------------------------------------------
  // RB-API-410
  // ---------------------------------------------------------------------------
  async getTask(query: GetDeliveryTaskQuery): Promise<DeliveryTaskDetailResult> {
    const task = await this.prisma.deliveryTask.findUnique({
      where: { id: query.taskId },
      include: deliveryTaskDetailInclude,
    });
    if (!task) throw AppError.fromCode(LG.TASK_NOT_FOUND);
    assertDeliveryTaskActor(task.staffId, query.actorUserId);
    return mapDeliveryTaskDetail(task);
  }

  // ---------------------------------------------------------------------------
  // RB-API-406
  // ---------------------------------------------------------------------------
  async claimTask(command: ClaimDeliveryTaskCommand): Promise<ClaimDeliveryTaskResult> {
    return this.runIdempotentMutation(
      'RB-API-406:logistics-claim',
      command.actorUserId,
      command.idempotencyKey,
      { taskId: command.taskId, expectedVersion: command.expectedVersion },
      async (tx) => {
        const task = await lockDeliveryTask(tx, command.taskId);
        assertExpectedVersion(task.version, command.expectedVersion);
        if (![DeliveryTaskStatus.SCHEDULED, DeliveryTaskStatus.BLOCKED].includes(task.status as any)) {
          if (task.staffId === command.actorUserId && HANDOVER_TASK_MUTABLE_STATUSES.includes(task.status)) {
            const actor = await getActiveStaffDelivery(tx, command.actorUserId);
            return { assignee: { id: actor.id, displayName: actor.fullName }, version: task.version };
          }
          throw AppError.fromCode(LG.INVALID_TASK_STATE);
        }
        if (task.staffId && task.staffId !== command.actorUserId) throw AppError.fromCode(LG.TASK_ALREADY_ASSIGNED);

        const actor = await getActiveStaffDelivery(tx, command.actorUserId);
        const updated = await tx.deliveryTask.update({
          where: { id: task.id },
          data: { staffId: command.actorUserId, status: DeliveryTaskStatus.SCHEDULED, version: { increment: 1 } },
        });
        await writeDeliveryAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'LOGISTICS_TASK_CLAIMED',
          entityType: 'DeliveryTask',
          entityId: task.id,
          oldValues: { staffId: task.staffId, status: task.status, version: task.version },
          newValues: { staffId: command.actorUserId, status: updated.status, version: updated.version },
          requestId: command.idempotencyKey,
        });
        return { assignee: { id: actor.id, displayName: actor.fullName }, version: updated.version };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-402
  // ---------------------------------------------------------------------------
  async receivePackage(command: ReceivePackageCommand): Promise<ReceivePackageResult> {
    return this.runIdempotentMutation(
      'RB-API-402:receive-package',
      command.actorUserId,
      command.idempotencyKey,
      {
        taskId: command.taskId,
        custodyTransferId: command.custodyTransferId,
        packageCode: command.packageCode,
        expectedVersion: command.expectedVersion,
      },
      async (tx) => {
        const task = await lockDeliveryTask(tx, command.taskId);
        assertExpectedVersion(task.version, command.expectedVersion);
        assertDeliveryTaskActor(task.staffId, command.actorUserId);
        if (task.taskType !== DeliveryTaskType.HANDOVER || task.status !== DeliveryTaskStatus.SCHEDULED) {
          throw AppError.fromCode(LG.INVALID_TASK_STATE);
        }

        const transfer = await tx.custodyTransfer.findUnique({ where: { id: command.custodyTransferId } });
        if (!transfer) throw AppError.fromCode(LG.CUSTODY_TRANSFER_NOT_FOUND);
        if (
          transfer.deliveryTaskId !== task.id ||
          transfer.orderId !== task.orderId ||
          transfer.packageId !== task.packageId ||
          transfer.toStaffId !== command.actorUserId ||
          transfer.status !== CustodyTransferStatus.PENDING_RECEIPT
        ) {
          throw AppError.fromCode(LG.CUSTODY_MISMATCH);
        }

        const pkg = await tx.package.findUnique({
          where: { id: task.packageId },
          include: { packageItemsViaPackageId: { select: { equipmentUnitId: true } } },
        });
        if (!pkg) throw AppError.fromCode(LG.PACKAGE_NOT_FOUND);
        if (pkg.packageCode !== command.packageCode || pkg.status !== PackageStatus.READY) {
          throw AppError.fromCode(LG.PACKAGE_MISMATCH);
        }

        const updatedTransfer = await tx.custodyTransfer.update({
          where: { id: transfer.id },
          data: { status: CustodyTransferStatus.RECEIVED, receivedAt: command.now, version: { increment: 1 } },
        });
        const updatedTask = await tx.deliveryTask.update({
          where: { id: task.id },
          data: { status: DeliveryTaskStatus.PACKAGE_RECEIVED, packageReceivedAt: command.now, version: { increment: 1 } },
        });
        await tx.package.update({
          where: { id: pkg.id },
          data: { status: PackageStatus.TRANSFERRED_TO_DELIVERY, version: { increment: 1 } },
        });
        await tx.inventoryTask.update({
          where: { id: transfer.inventoryTaskId },
          data: { status: InventoryTaskStatus.TRANSFERRED, completedAt: command.now, version: { increment: 1 } },
        });
        if (pkg.packageItemsViaPackageId.length > 0) {
          await tx.equipmentUnit.updateMany({
            where: { id: { in: pkg.packageItemsViaPackageId.map((item) => item.equipmentUnitId) } },
            data: { currentInventoryLocationId: null, version: { increment: 1 } },
          });
        }

        await writeCustodyPackageAndUnits(tx, {
          idempotencyKey: command.idempotencyKey,
          orderId: task.orderId,
          packageId: pkg.id,
          deliveryTaskId: task.id,
          unitIds: pkg.packageItemsViaPackageId.map((item) => item.equipmentUnitId),
          eventType: CustodyEventType.INVENTORY_TO_DELIVERY,
          fromActorType: CustodyActorType.INVENTORY_LOCATION,
          fromInventoryLocationId: transfer.fromInventoryLocationId,
          toActorType: CustodyActorType.DELIVERY_STAFF,
          toUserId: command.actorUserId,
          packageStatusBefore: pkg.status,
          packageStatusAfter: PackageStatus.TRANSFERRED_TO_DELIVERY,
          unitStatusBefore: EquipmentUnitStatus.PACKED,
          unitStatusAfter: EquipmentUnitStatus.PACKED,
          deliveryStatusBefore: task.status,
          deliveryStatusAfter: DeliveryTaskStatus.PACKAGE_RECEIVED,
          performedBy: command.actorUserId,
          occurredAt: command.now,
        });
        await writeDeliveryAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'LOGISTICS_PACKAGE_RECEIVED',
          entityType: 'CustodyTransfer',
          entityId: transfer.id,
          oldValues: { transferStatus: transfer.status, taskStatus: task.status, packageStatus: pkg.status },
          newValues: {
            transferStatus: updatedTransfer.status,
            taskStatus: updatedTask.status,
            packageStatus: PackageStatus.TRANSFERRED_TO_DELIVERY,
          },
          requestId: command.idempotencyKey,
        });

        return {
          task: {
            id: updatedTask.id,
            status: updatedTask.status,
            packageReceivedAt: updatedTask.packageReceivedAt?.toISOString() ?? null,
            version: updatedTask.version,
          },
          custody: {
            id: updatedTransfer.id,
            status: updatedTransfer.status,
            receivedAt: updatedTransfer.receivedAt?.toISOString() ?? null,
            fromInventoryLocationId: updatedTransfer.fromInventoryLocationId,
            toStaffId: updatedTransfer.toStaffId,
          },
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-403
  // ---------------------------------------------------------------------------
  async verifyRecipient(command: VerifyRecipientCommand): Promise<VerifyRecipientResult> {
    return this.runIdempotentMutation(
      'RB-API-403:verify-recipient',
      command.actorUserId,
      command.idempotencyKey,
      { taskId: command.taskId, pickupCodeFingerprint: fingerprintPickupCode(command.pickupCode), expectedVersion: command.expectedVersion },
      async (tx) => {
        const task = await lockDeliveryTask(tx, command.taskId);
        assertExpectedVersion(task.version, command.expectedVersion);
        assertDeliveryTaskActor(task.staffId, command.actorUserId);
        if (task.taskType !== DeliveryTaskType.HANDOVER || ![DeliveryTaskStatus.PACKAGE_RECEIVED, DeliveryTaskStatus.RECIPIENT_VERIFIED].includes(task.status as any)) {
          throw AppError.fromCode(LG.INVALID_TASK_STATE);
        }

        const order = await tx.rentalOrder.findUnique({
          where: { id: task.orderId },
          include: {
            rentalPolicy: true,
            pickupPoint: { select: { id: true, name: true, address: true } },
            packageViaOrderId: { select: { id: true, packageCode: true, status: true, version: true } },
          },
        });
        if (!order || order.status !== RentalOrderStatus.READY_FOR_HANDOVER) throw AppError.fromCode(LG.INVALID_RENTAL_STATE);
        const expectedPackage = order.packageViaOrderId;
        if (!expectedPackage || task.servicePointId !== order.pickupPointId || task.packageId !== expectedPackage.id) throw AppError.fromCode(LG.CUSTODY_MISMATCH);
        if (expectedPackage.status !== PackageStatus.TRANSFERRED_TO_DELIVERY) throw AppError.fromCode(LG.CUSTODY_MISMATCH);

        await assertCurrentRentalContext(tx, order, command.now);
        const codeHash = hashPickupCode(order.id, command.pickupCode);
        const pickupCode = await tx.rentalPickupCode.findFirst({
          where: {
            orderId: order.id,
            codeHash,
            revokedAt: null,
            usedAt: null,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!pickupCode || pickupCode.expiresAt <= command.now) throw AppError.fromCode(LG.PICKUP_CODE_INVALID_OR_EXPIRED);

        if (!order.rentalPolicy.pickupVerificationTtlMinutes || order.rentalPolicy.pickupVerificationTtlMinutes <= 0) throw AppError.fromCode(LG.PICKUP_CODE_CONFIG_ERROR);
        const verificationRef = randomUUID();
        const verificationExpiresAt = new Date(command.now.getTime() + order.rentalPolicy.pickupVerificationTtlMinutes * 60_000);
        await tx.rentalPickupCode.update({
          where: { id: pickupCode.id },
          data: {
            verificationRef,
            packageVersionSnapshot: expectedPackage.version,
            verifiedAt: command.now,
            verifiedBy: command.actorUserId,
          },
        });
        const updatedTask = await tx.deliveryTask.update({
          where: { id: task.id },
          data: { status: DeliveryTaskStatus.RECIPIENT_VERIFIED, recipientVerifiedAt: command.now, version: { increment: 1 } },
        });
        await writeDeliveryAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'LOGISTICS_RECIPIENT_VERIFIED',
          entityType: 'DeliveryTask',
          entityId: task.id,
          oldValues: { status: task.status },
          newValues: { status: updatedTask.status, verificationRef, verificationExpiresAt: verificationExpiresAt.toISOString() },
          requestId: command.idempotencyKey,
        });

        return {
          verificationRef,
          recipient: jsonObject(order.recipientSnapshot),
          expectedPackage: {
            id: expectedPackage.id,
            code: expectedPackage.packageCode,
            version: expectedPackage.version,
          },
          expiresAt: verificationExpiresAt.toISOString(),
          taskVersion: updatedTask.version,
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-404
  // ---------------------------------------------------------------------------
  async commitHandover(command: CommitHandoverCommand): Promise<CommitHandoverResult> {
    return this.runIdempotentMutation(
      'RB-API-404:handover',
      command.actorUserId,
      command.idempotencyKey,
      {
        orderId: command.orderId,
        packageId: command.packageId,
        verificationRef: command.verificationRef,
        recipientNotes: command.recipientNotes ?? null,
        reportedIssues: command.reportedIssues ?? [],
        expectedVersion: command.expectedVersion,
      },
      async (tx) => {
        const order = await lockRentalOrder(tx, command.orderId);
        assertExpectedVersion(order.version, command.expectedVersion);
        if (order.status !== RentalOrderStatus.READY_FOR_HANDOVER) throw AppError.fromCode(LG.INVALID_RENTAL_STATE);

        const task = await tx.deliveryTask.findUnique({
          where: { orderId_taskType: { orderId: order.id, taskType: DeliveryTaskType.HANDOVER } },
        });
        if (!task) throw AppError.fromCode(LG.TASK_NOT_FOUND);
        assertDeliveryTaskActor(task.staffId, command.actorUserId);
        if (task.status !== DeliveryTaskStatus.RECIPIENT_VERIFIED || task.packageId !== command.packageId) {
          throw AppError.fromCode(LG.INVALID_TASK_STATE);
        }

        const pkg = await tx.package.findUnique({
          where: { id: command.packageId },
          include: {
            packageItemsViaPackageId: {
              include: {
                assignment: { include: { orderLine: true } },
                equipmentUnit: true,
              },
            },
          },
        });
        if (!pkg) throw AppError.fromCode(LG.PACKAGE_NOT_FOUND);
        if (pkg.orderId !== order.id || pkg.status !== PackageStatus.TRANSFERRED_TO_DELIVERY) throw AppError.fromCode(LG.PACKAGE_MISMATCH);
        if (pkg.packageItemsViaPackageId.length === 0) throw AppError.fromCode(LG.PACKAGE_INCOMPLETE);
        const expectedUnitCount = await tx.rentalOrderLine.aggregate({ where: { orderId: order.id }, _sum: { quantity: true } });
        if ((expectedUnitCount._sum.quantity ?? 0) !== pkg.packageItemsViaPackageId.length) {
          throw AppError.fromCode(LG.PACKAGE_INCOMPLETE, { details: { expected: expectedUnitCount._sum.quantity ?? 0, actual: pkg.packageItemsViaPackageId.length } });
        }

        const pickupCode = await tx.rentalPickupCode.findFirst({
          where: {
            orderId: order.id,
            verificationRef: command.verificationRef,
            verifiedBy: command.actorUserId,
            revokedAt: null,
            usedAt: null,
          },
          orderBy: { verifiedAt: 'desc' },
        });
        if (!pickupCode || !pickupCode.verifiedAt) throw AppError.fromCode(LG.PICKUP_VERIFICATION_INVALID);
        const policy = await tx.rentalPolicy.findUnique({ where: { id: order.rentalPolicyId } });
        if (!policy?.pickupVerificationTtlMinutes || policy.pickupVerificationTtlMinutes <= 0) throw AppError.fromCode(LG.PICKUP_CODE_CONFIG_ERROR);
        const verificationExpiresAt = new Date(pickupCode.verifiedAt.getTime() + policy.pickupVerificationTtlMinutes * 60_000);
        if (verificationExpiresAt <= command.now || pickupCode.expiresAt <= command.now) throw AppError.fromCode(LG.PICKUP_VERIFICATION_EXPIRED);
        if (pickupCode.packageVersionSnapshot !== pkg.version) throw AppError.fromCode(LG.PACKAGE_VERSION_CHANGED);

        await assertCurrentRentalContext(tx, { ...order, rentalPolicy: policy }, command.now);

        const beforeSnapshots = await tx.conditionSnapshot.findMany({
          where: {
            orderId: order.id,
            snapshotStage: SnapshotStage.PRE_HANDOVER,
            assignmentId: { in: pkg.packageItemsViaPackageId.map((item) => item.assignmentId) },
          },
          select: { assignmentId: true },
        });
        if (beforeSnapshots.length !== pkg.packageItemsViaPackageId.length) throw AppError.fromCode(LG.PACKAGE_INCOMPLETE);

        const issueUnitIds = new Set((command.reportedIssues ?? []).map((issue) => issue.unitId).filter(Boolean) as string[]);
        const packageUnitIds = new Set(pkg.packageItemsViaPackageId.map((item) => item.equipmentUnitId));
        for (const unitId of issueUnitIds) {
          if (!packageUnitIds.has(unitId)) throw AppError.fromCode(LG.PACKAGE_MISMATCH, { details: { unitId, reason: 'ISSUE_UNIT_NOT_IN_PACKAGE' } });
        }

        const handover = await tx.rentalHandover.create({
          data: {
            orderId: order.id,
            packageId: pkg.id,
            deliveryTaskId: task.id,
            pickupCodeId: pickupCode.id,
            staffId: command.actorUserId,
            verificationRef: command.verificationRef,
            recipientSnapshot: jsonValue(order.recipientSnapshot),
            recipientNotes: command.recipientNotes ?? null,
            reportedIssues: jsonValue(command.reportedIssues ?? []),
            idempotencyKey: command.idempotencyKey,
            handedOverAt: command.now,
          },
        });

        // Document business snapshot shares the same transaction, not the asynchronous PDF lifecycle.
        await issueHandoverDocumentTx(tx, order.id, handover.id, command.now);
        await tx.rentalPickupCode.update({ where: { id: pickupCode.id }, data: { usedAt: command.now } });
        await tx.package.update({ where: { id: pkg.id }, data: { status: PackageStatus.HANDED_OVER, version: { increment: 1 } } });
        const updatedTask = await tx.deliveryTask.update({
          where: { id: task.id },
          data: { status: DeliveryTaskStatus.HANDED_OVER, handoverAt: command.now, version: { increment: 1 } },
        });
        const updatedOrder = await tx.rentalOrder.update({
          where: { id: order.id },
          data: { status: RentalOrderStatus.ACTIVE, exceptionStatus: RentalOrderExceptionStatus.NONE, version: { increment: 1 } },
        });

        for (const item of pkg.packageItemsViaPackageId) {
          if (item.assignment.orderLine.orderId !== order.id || item.assignment.status !== RentalUnitAssignmentStatus.PACKED || item.equipmentUnit.status !== EquipmentUnitStatus.PACKED) {
            throw AppError.fromCode(LG.PACKAGE_INCOMPLETE, { details: { unitId: item.equipmentUnitId, reason: 'UNIT_NOT_PACKED_FOR_ORDER' } });
          }
          await tx.rentalUnitAssignment.update({
            where: { id: item.assignmentId },
            data: { status: RentalUnitAssignmentStatus.HANDED_OVER, handedOverAt: command.now, version: { increment: 1 } },
          });
          await tx.equipmentUnit.update({
            where: { id: item.equipmentUnitId },
            data: { status: EquipmentUnitStatus.RENTED, currentInventoryLocationId: null, expectedReadyAt: order.occupiedEndAt, version: { increment: 1 } },
          });
        }

        await ensurePerUnitDepositLedger(tx, order, pkg.packageItemsViaPackageId);
        const recipientUserId = recipientUserIdFromSnapshot(order.recipientSnapshot) ?? order.userId;
        await writeCustodyPackageAndUnits(tx, {
          idempotencyKey: command.idempotencyKey,
          orderId: order.id,
          packageId: pkg.id,
          deliveryTaskId: task.id,
          unitIds: pkg.packageItemsViaPackageId.map((item) => item.equipmentUnitId),
          eventType: CustodyEventType.DELIVERY_TO_USER,
          fromActorType: CustodyActorType.DELIVERY_STAFF,
          fromUserId: command.actorUserId,
          toActorType: CustodyActorType.USER,
          toUserId: recipientUserId,
          orderStatusBefore: order.status,
          orderStatusAfter: RentalOrderStatus.ACTIVE,
          packageStatusBefore: pkg.status,
          packageStatusAfter: PackageStatus.HANDED_OVER,
          unitStatusBefore: EquipmentUnitStatus.PACKED,
          unitStatusAfter: EquipmentUnitStatus.RENTED,
          deliveryStatusBefore: task.status,
          deliveryStatusAfter: updatedTask.status,
          performedBy: command.actorUserId,
          occurredAt: command.now,
        });
        await tx.rentalOutboxEvent.upsert({
          where: { deduplicationKey: `rental-handover:${order.id}` },
          update: {},
          create: {
            deduplicationKey: `rental-handover:${order.id}`,
            eventType: 'RENTAL_HANDOVER_COMPLETED',
            aggregateType: 'RentalOrder',
            aggregateId: order.id,
            payload: jsonValue({ orderId: order.id, bookingId: order.bookingId, tripId: order.tripId, handedOverAt: command.now.toISOString() }),
          },
        });
        await writeDeliveryAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'RENTAL_HANDOVER_COMMITTED',
          entityType: 'RentalHandover',
          entityId: handover.id,
          oldValues: { orderStatus: order.status, taskStatus: task.status, packageStatus: pkg.status },
          newValues: { orderStatus: updatedOrder.status, taskStatus: updatedTask.status, packageStatus: PackageStatus.HANDED_OVER },
          requestId: command.idempotencyKey,
        });

        return {
          order: mapRentalOrderForHandover(updatedOrder),
          units: pkg.packageItemsViaPackageId.map((item) => ({
            unitId: item.equipmentUnitId,
            assetCode: item.equipmentUnit.assetCode,
            condition: item.equipmentUnit.condition,
            status: EquipmentUnitStatus.RENTED,
          })),
          handoverRecord: {
            id: handover.id,
            verificationRef: handover.verificationRef,
            recipientNotes: handover.recipientNotes,
            reportedIssues: jsonObjectOrArray(handover.reportedIssues),
            handedOverAt: handover.handedOverAt.toISOString(),
          },
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-405
  // ---------------------------------------------------------------------------
  async markNoShow(command: MarkNoShowCommand): Promise<MarkNoShowResult> {
    return this.runIdempotentMutation(
      'RB-API-405:no-show-refusal',
      command.actorUserId,
      command.idempotencyKey,
      {
        orderId: command.orderId,
        reason: command.reason,
        notes: command.notes ?? null,
        evidenceIds: [...command.evidenceIds].sort(),
        expectedVersion: command.expectedVersion,
      },
      async (tx) => {
        const order = await lockRentalOrder(tx, command.orderId);
        assertExpectedVersion(order.version, command.expectedVersion);
        if (order.status !== RentalOrderStatus.READY_FOR_HANDOVER) throw AppError.fromCode(LG.INVALID_RENTAL_STATE);

        const task = await tx.deliveryTask.findUnique({
          where: { orderId_taskType: { orderId: order.id, taskType: DeliveryTaskType.HANDOVER } },
        });
        if (!task) throw AppError.fromCode(LG.TASK_NOT_FOUND);
        assertDeliveryTaskActor(task.staffId, command.actorUserId);
        if (![DeliveryTaskStatus.PACKAGE_RECEIVED, DeliveryTaskStatus.RECIPIENT_VERIFIED].includes(task.status as any)) {
          throw AppError.fromCode(LG.INVALID_TASK_STATE);
        }
        const pkg = await tx.package.findUnique({ where: { id: task.packageId } });
        if (!pkg || pkg.status !== PackageStatus.TRANSFERRED_TO_DELIVERY) throw AppError.fromCode(LG.CUSTODY_MISMATCH);
        const existingHandover = await tx.rentalHandover.findUnique({ where: { orderId: order.id }, select: { id: true } });
        if (existingHandover) throw AppError.fromCode(LG.INVALID_RENTAL_STATE);

        await validateExceptionEvidence(tx, command.actorUserId, command.evidenceIds);
        const isUserFault = USER_FAULT_REASONS.has(command.reason);
        const refundAmounts = await calculateNoShowRefund(tx, order, command.now, isUserFault);
        const payment = await findSucceededRentalPayment(tx, order.id);
        if (!payment) throw AppError.fromCode(LG.PAYMENT_RECONCILIATION_REQUIRED);
        if (await tx.rentalExtensionRequest.count({ where: { orderId: order.id, status: 'APPLIED' } }))
          throw AppError.fromCode(LG.PAYMENT_RECONCILIATION_REQUIRED); // multiple paid invoices require split refund approval

        let refundRef: string | null = null;
        let refundStatus: string | null = null;
        const totalRefund = refundAmounts.feeRefund + refundAmounts.depositRefund;
        if (totalRefund > 0) {
          const refund = await reserveRentalCancellationRefundWithTx(tx, {
            orderId: order.id, paymentId: payment.id, amount: new Prisma.Decimal(totalRefund),
            reason: command.reason, idempotencyKey: `rental-no-show:${order.id}:v${order.version}`, now: command.now,
          });
          await tx.rentalOutboxEvent.upsert({
            where: { deduplicationKey: `refund-request:${refund.id}` },
            update: {},
            create: {
              deduplicationKey: `refund-request:${refund.id}`,
              eventType: 'RENTAL_REFUND_REQUESTED',
              aggregateType: 'RentalOrder',
              aggregateId: order.id,
              payload: jsonValue({ refundRef: refund.id, paymentRef: payment.id, rentalOrderId: order.id, component: 'NO_SHOW_OR_REFUSAL', amount: totalRefund, currency: order.currency, reason: command.reason }),
            },
          });
          refundRef = refund.id;
          refundStatus = refund.status;
        }

        const lineIds = await tx.rentalOrderLine.findMany({ where: { orderId: order.id }, select: { id: true } });
        await tx.rentalQuantityReservation.updateMany({
          where: { orderLineId: { in: lineIds.map((line) => line.id) }, status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] } },
          data: { status: ReservationStatus.RELEASED, releasedAt: command.now, version: { increment: 1 } },
        });
        await tx.rentalPickupCode.updateMany({
          where: { orderId: order.id, usedAt: null, revokedAt: null },
          data: { revokedAt: command.now },
        });
        const taskStatus = ['NO_SHOW', 'USER_NO_SHOW'].includes(command.reason) ? DeliveryTaskStatus.NO_SHOW : DeliveryTaskStatus.REFUSED;
        await tx.deliveryTask.update({
          where: { id: task.id },
          data: {
            status: taskStatus,
            noShowReason: command.reason,
            exceptionNotes: command.notes ?? null,
            exceptionEvidenceIds: jsonValue(command.evidenceIds),
            exceptionAt: command.now,
            version: { increment: 1 },
          },
        });
        await tx.package.update({ where: { id: pkg.id }, data: { status: PackageStatus.RETURNING, version: { increment: 1 } } });
        const updatedOrder = await tx.rentalOrder.update({
          where: { id: order.id },
          data: {
            status: RentalOrderStatus.CANCELLED,
            exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
            financialStatus: totalRefund > 0 ? RentalFinancialStatus.REFUND_PENDING : order.financialStatus,
            cancelledAt: command.now,
            version: { increment: 1 },
          },
        });
        await tx.rentalOutboxEvent.upsert({
          where: { deduplicationKey: `rental-handover-failed:${order.id}:v${order.version}` },
          update: {},
          create: {
            deduplicationKey: `rental-handover-failed:${order.id}:v${order.version}`,
            eventType: 'RENTAL_HANDOVER_FAILED',
            aggregateType: 'RentalOrder',
            aggregateId: order.id,
            payload: jsonValue({
              orderId: order.id,
              reason: command.reason,
              returnToWarehouseRequired: true,
              returnToInventoryLocationRequired: true,
              refundRef,
            }),
          },
        });
        await writeDeliveryAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'RENTAL_HANDOVER_NOT_COMPLETED',
          entityType: 'RentalOrder',
          entityId: order.id,
          oldValues: { orderStatus: order.status, taskStatus: task.status, packageStatus: pkg.status },
          newValues: { orderStatus: updatedOrder.status, taskStatus, packageStatus: PackageStatus.RETURNING, reason: command.reason, refundRef },
          requestId: command.idempotencyKey,
        });

        return {
          orderId: order.id,
          exceptionStatus: updatedOrder.exceptionStatus,
          refundPreview: {
            feeRefund: refundAmounts.feeRefund,
            depositRefund: refundAmounts.depositRefund,
            totalRefund,
            status: refundStatus,
            refundRef,
          },
          returnToWarehouseRequired: true,
          returnToInventoryLocationRequired: true,
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-407
  // ---------------------------------------------------------------------------
  async getPickupCode(query: GetPickupCodeQuery): Promise<PickupCodeResult> {
    return this.prisma.$transaction(async (tx) => {
      const order = await lockRentalOrder(tx, query.orderId);
      assertUserOrRecipient(order.userId, order.recipientSnapshot, query.actorUserId);
      if (order.status !== RentalOrderStatus.READY_FOR_HANDOVER) throw AppError.fromCode(LG.INVALID_RENTAL_STATE);

      const task = await tx.deliveryTask.findUnique({
        where: { orderId_taskType: { orderId: order.id, taskType: DeliveryTaskType.HANDOVER } },
      });
      if (!task || ![DeliveryTaskStatus.SCHEDULED, DeliveryTaskStatus.PACKAGE_RECEIVED, DeliveryTaskStatus.RECIPIENT_VERIFIED].includes(task.status as any)) {
        throw AppError.fromCode(LG.INVALID_TASK_STATE);
      }
      const pkg = await tx.package.findUnique({ where: { id: task.packageId } });
      if (!pkg || ![PackageStatus.READY, PackageStatus.TRANSFERRED_TO_DELIVERY].includes(pkg.status as any)) throw AppError.fromCode(LG.PACKAGE_MISMATCH);
      const policy = await tx.rentalPolicy.findUnique({ where: { id: order.rentalPolicyId } });
      if (!policy?.pickupCodeTtlMinutes || policy.pickupCodeTtlMinutes <= 0 || !policy.pickupVerificationTtlMinutes || policy.pickupVerificationTtlMinutes <= 0) throw AppError.fromCode(LG.PICKUP_CODE_CONFIG_ERROR);

      await assertCurrentRentalContext(tx, { ...order, rentalPolicy: policy }, query.now);
      await tx.rentalPickupCode.updateMany({
        where: { orderId: order.id, usedAt: null, revokedAt: null },
        data: { revokedAt: query.now },
      });
      const plainCode = await generateUniquePickupCode(tx, order.id);
      const expiresAt = new Date(query.now.getTime() + policy.pickupCodeTtlMinutes * 60_000);
      await tx.rentalPickupCode.create({
        data: {
          orderId: order.id,
          codeHash: hashPickupCode(order.id, plainCode),
          expiresAt,
          createdAt: query.now,
        },
      });
      const pickupPoint = await tx.pickupPoint.findUnique({ where: { id: order.pickupPointId }, select: { id: true, name: true, address: true } });
      if (!pickupPoint) throw AppError.fromCode(LG.CUSTODY_MISMATCH);

      return {
        pickupCode: plainCode,
        expiresAt: expiresAt.toISOString(),
        orderId: order.id,
        recipient: jsonObject(order.recipientSnapshot),
        pickupPoint,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // RB-API-409
  // ---------------------------------------------------------------------------
  async getHandoverPreview(query: GetHandoverPreviewQuery): Promise<HandoverPreviewResult> {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { id: query.orderId },
      include: {
        pickupPoint: { select: { id: true, name: true, address: true } },
        packageViaOrderId: {
          include: {
            packageItemsViaPackageId: {
              include: { equipmentUnit: { include: { product: { select: { id: true, name: true, grade: true } } } } },
            },
          },
        },
        conditionSnapshotsViaOrderId: {
          where: { snapshotStage: SnapshotStage.PRE_HANDOVER },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!order) throw AppError.fromCode(LG.RENTAL_ORDER_NOT_FOUND);
    assertUserOrRecipient(order.userId, order.recipientSnapshot, query.actorUserId);
    if (!order.packageViaOrderId) throw AppError.fromCode(LG.PACKAGE_NOT_FOUND);

    return {
      package: {
        id: order.packageViaOrderId.id,
        code: order.packageViaOrderId.packageCode,
        status: order.packageViaOrderId.status,
        version: order.packageViaOrderId.version,
        units: order.packageViaOrderId.packageItemsViaPackageId.map((item) => ({
          unitId: item.equipmentUnitId,
          assetCode: item.equipmentUnit.assetCode,
          product: {
            id: item.equipmentUnit.product.id,
            name: item.equipmentUnit.product.name,
            grade: item.equipmentUnit.product.grade,
          },
          condition: item.equipmentUnit.condition,
        })),
      },
      conditionSnapshots: order.conditionSnapshotsViaOrderId.map((snapshot) => ({
        id: snapshot.id,
        unitId: snapshot.unitId,
        condition: snapshot.condition,
        notes: snapshot.notes,
        accessories: jsonObjectOrArray(snapshot.accessories),
        evidenceIds: jsonObjectOrArray(snapshot.evidenceIds),
        createdAt: snapshot.createdAt.toISOString(),
      })),
      recipient: jsonObject(order.recipientSnapshot),
      pickupPoint: order.pickupPoint,
      status: order.status,
    };
  }

  // ---------------------------------------------------------------------------
  // RB-API-408
  // ---------------------------------------------------------------------------
  async assignTask(command: AssignRentalTaskCommand): Promise<AssignRentalTaskResult> {
    return this.runIdempotentMutation(
      'RB-API-408:admin-assign-task',
      command.actorUserId,
      command.idempotencyKey,
      { taskId: command.taskId, taskType: command.taskType, assigneeId: command.assigneeId, reason: command.reason, expectedVersion: command.expectedVersion },
      async (tx) => {
        const admin = await tx.user.findFirst({ where: { id: command.actorUserId, role: UserRole.ADMIN, status: UserStatus.ACTIVE }, select: { id: true } });
        if (!admin) throw AppError.fromCode('FORBIDDEN');

        if (command.taskType === 'PREPARATION' || command.taskType === 'WAREHOUSE') {
          const task = await lockInventoryTask(tx, command.taskId);
          assertExpectedVersion(task.version, command.expectedVersion);
          if ([InventoryTaskStatus.TRANSFERRED, InventoryTaskStatus.CLOSED, InventoryTaskStatus.CANCELLED].includes(task.status as any)) throw AppError.fromCode(LG.INVALID_TASK_STATE);
          const assignee = await tx.user.findFirst({ where: { id: command.assigneeId, role: UserRole.STAFF_INVENTORY, status: UserStatus.ACTIVE }, select: { id: true, fullName: true } });
          if (!assignee) throw AppError.fromCode(LG.ASSIGNEE_INVALID);
          const updated = await tx.inventoryTask.update({ where: { id: task.id }, data: { staffId: assignee.id, version: { increment: 1 } } });
          await writeDeliveryAudit(tx, {
            actorUserId: command.actorUserId,
            action: 'ADMIN_RENTAL_TASK_ASSIGNED',
            entityType: 'InventoryTask',
            entityId: task.id,
            oldValues: { staffId: task.staffId, version: task.version },
            newValues: { staffId: assignee.id, version: updated.version, reason: command.reason },
            requestId: command.idempotencyKey,
          });
          return { assignee: { id: assignee.id, displayName: assignee.fullName }, taskVersion: updated.version };
        }

        const task = await lockDeliveryTask(tx, command.taskId);
        assertExpectedVersion(task.version, command.expectedVersion);
        if (task.taskType !== publicTaskTypeToDeliveryTaskType(command.taskType)) throw AppError.fromCode(LG.INVALID_TASK_STATE, { details: { expectedTaskType: command.taskType, actualTaskType: deliveryTaskTypeToPublicType(task.taskType) } });
        if (![DeliveryTaskStatus.SCHEDULED, DeliveryTaskStatus.BLOCKED].includes(task.status as any)) throw AppError.fromCode(LG.INVALID_TASK_STATE);
        const assignee = await tx.user.findFirst({ where: { id: command.assigneeId, role: UserRole.STAFF_DELIVERY, status: UserStatus.ACTIVE }, select: { id: true, fullName: true } });
        if (!assignee) throw AppError.fromCode(LG.ASSIGNEE_INVALID);

        const pendingTransfers = await tx.custodyTransfer.findMany({ where: { deliveryTaskId: task.id, status: CustodyTransferStatus.PENDING_RECEIPT } });
        for (const transfer of pendingTransfers) {
          if (transfer.toStaffId !== assignee.id) {
            await tx.custodyTransfer.update({ where: { id: transfer.id }, data: { status: CustodyTransferStatus.CANCELLED, cancelledAt: command.now, version: { increment: 1 } } });
          }
        }
        const updated = await tx.deliveryTask.update({ where: { id: task.id }, data: { staffId: assignee.id, version: { increment: 1 } } });
        await writeDeliveryAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'ADMIN_RENTAL_TASK_ASSIGNED',
          entityType: 'DeliveryTask',
          entityId: task.id,
          oldValues: { staffId: task.staffId, version: task.version },
          newValues: { staffId: assignee.id, version: updated.version, reason: command.reason, custodyTransferred: false },
          requestId: command.idempotencyKey,
        });
        return { assignee: { id: assignee.id, displayName: assignee.fullName }, taskVersion: updated.version };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-411
  // ---------------------------------------------------------------------------
  async listAdminTasks(query: ListAdminRentalTasksQuery): Promise<DeliveryTaskListResult> {
    const actor = await this.prisma.user.findFirst({ where: { id: query.actorUserId, role: UserRole.ADMIN, status: UserStatus.ACTIVE }, select: { id: true } });
    if (!actor) throw AppError.fromCode('FORBIDDEN');

    const wantPreparation = !query.type || query.type === 'PREPARATION' || query.type === 'WAREHOUSE';
    const wantDelivery = !query.type || query.type === 'OUTBOUND' || query.type === 'RETURN';
    const combined: Array<Record<string, unknown> & { sortAt: number }> = [];
    const dateWindow = query.date ? vietnamBusinessDayUtcWindow(query.date) : null;

    if (wantPreparation) {
      const rows = await this.prisma.inventoryTask.findMany({
        where: {
          staffId: assignmentWhere(query.assignment, query.actorUserId),
          deadline: dateWindow ? { gte: dateWindow.start, lt: dateWindow.end } : undefined,
        },
        include: { staff: { select: { id: true, fullName: true } }, order: { select: { id: true, tripId: true } } },
      });
      for (const row of rows) {
        combined.push({
          id: row.id,
          type: query.type === 'PREPARATION' ? 'PREPARATION' : 'WAREHOUSE',
          status: row.status,
          assignee: row.staff ? { id: row.staff.id, displayName: row.staff.fullName } : null,
          orderId: row.orderId,
          tripId: row.order.tripId,
          scheduledAt: row.deadline?.toISOString() ?? null,
          version: row.version,
          sortAt: row.deadline?.getTime() ?? row.createdAt.getTime(),
        });
      }
    }

    if (wantDelivery) {
      const rows = await this.prisma.deliveryTask.findMany({
        where: {
          taskType: query.type && query.type !== 'PREPARATION' && query.type !== 'WAREHOUSE' ? publicTaskTypeToDeliveryTaskType(query.type) : undefined,
          staffId: assignmentWhere(query.assignment, query.actorUserId),
          scheduledAt: dateWindow ? { gte: dateWindow.start, lt: dateWindow.end } : undefined,
        },
        include: { staff: { select: { id: true, fullName: true } }, servicePoint: { select: { id: true, name: true } } },
      });
      for (const row of rows) {
        combined.push({
          id: row.id,
          type: deliveryTaskTypeToPublicType(row.taskType),
          status: row.status,
          assignee: row.staff ? { id: row.staff.id, displayName: row.staff.fullName } : null,
          orderId: row.orderId,
          tripId: row.tripId,
          point: row.servicePoint,
          scheduledAt: row.scheduledAt?.toISOString() ?? null,
          version: row.version,
          sortAt: row.scheduledAt?.getTime() ?? row.createdAt.getTime(),
        });
      }
    }

    combined.sort((a, b) => a.sortAt - b.sortAt);
    const totalItems = combined.length;
    const start = (query.page - 1) * query.pageSize;
    const pageItems = combined.slice(start, start + query.pageSize).map(({ sortAt: _sortAt, ...item }) => item);
    return { items: pageItems, pagination: pagination(query.page, query.pageSize, totalItems) };
  }

  // ---------------------------------------------------------------------------
  // RB-API-412
  // ---------------------------------------------------------------------------
  async listAssignees(query: ListRentalAssigneesQuery): Promise<RentalAssigneeListResult> {
    if (query.actorRole === UserRole.STAFF_INVENTORY && query.role !== UserRole.STAFF_DELIVERY) throw AppError.fromCode('FORBIDDEN');
    if (query.actorRole === UserRole.STAFF_DELIVERY && query.role !== UserRole.STAFF_DELIVERY) throw AppError.fromCode('FORBIDDEN');
    if (![UserRole.STAFF_INVENTORY, UserRole.STAFF_DELIVERY, UserRole.ADMIN].includes(query.actorRole as any)) throw AppError.fromCode('FORBIDDEN');

    let currentAssigneeId: string | null = null;
    if (query.taskId) {
      const delivery = await this.prisma.deliveryTask.findUnique({ where: { id: query.taskId }, select: { staffId: true } });
      if (delivery) currentAssigneeId = delivery.staffId;
      else {
        const inventory = await this.prisma.inventoryTask.findUnique({ where: { id: query.taskId }, select: { staffId: true } });
        currentAssigneeId = inventory?.staffId ?? null;
      }
    }

    const skip = (query.page - 1) * query.pageSize;
    const role = query.role as UserRole;
    const [users, totalItems] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { role, status: UserStatus.ACTIVE },
        skip,
        take: query.pageSize,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        select: { id: true, fullName: true, email: true, phone: true, role: true },
      }),
      this.prisma.user.count({ where: { role, status: UserStatus.ACTIVE } }),
    ]);
    const loadByUser = new Map<string, number>();
    if (role === UserRole.STAFF_DELIVERY) {
      const grouped = await this.prisma.deliveryTask.groupBy({
        by: ['staffId'],
        where: { staffId: { in: users.map((user) => user.id) }, status: { in: [DeliveryTaskStatus.SCHEDULED, DeliveryTaskStatus.PACKAGE_RECEIVED, DeliveryTaskStatus.RECIPIENT_VERIFIED, DeliveryTaskStatus.COLLECTING] } },
        _count: { _all: true },
      });
      grouped.forEach((row) => { if (row.staffId) loadByUser.set(row.staffId, row._count._all); });
    } else {
      const grouped = await this.prisma.inventoryTask.groupBy({
        by: ['staffId'],
        where: { staffId: { in: users.map((user) => user.id) }, status: { in: [InventoryTaskStatus.OPEN, InventoryTaskStatus.PICKING, InventoryTaskStatus.CONDITION_CAPTURED, InventoryTaskStatus.PACKED, InventoryTaskStatus.READY] } },
        _count: { _all: true },
      });
      grouped.forEach((row) => { if (row.staffId) loadByUser.set(row.staffId, row._count._all); });
    }
    return {
      items: users.map((user) => ({
        id: user.id,
        displayName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        activeTaskCount: loadByUser.get(user.id) ?? 0,
        isCurrentAssignee: user.id === currentAssigneeId,
      })),
      pagination: pagination(query.page, query.pageSize, totalItems),
    };
  }

  private async runIdempotentMutation<T>(
    scope: string,
    userId: string,
    idempotencyKey: string,
    request: unknown,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const requestHash = sha256(stableJson(request));
    try {
      return await this.prisma.$transaction(async (tx) => {
        const cached = await tx.idempotencyRecord.findUnique({ where: { scope_userId_idempotencyKey: { scope, userId, idempotencyKey } } });
        if (cached) {
          if (cached.requestHash !== requestHash) throw AppError.fromCode(LG.IDEMPOTENCY_KEY_REUSED);
          if (cached.responseBody) return cached.responseBody as unknown as T;
          throw AppError.fromCode(LG.OPERATION_CONFLICT);
        }
        await tx.idempotencyRecord.create({ data: { scope, userId, idempotencyKey, requestHash } });
        const result = await work(tx);
        await tx.idempotencyRecord.update({
          where: { scope_userId_idempotencyKey: { scope, userId, idempotencyKey } },
          data: { responseStatus: 200, responseBody: jsonValue(result) },
        });
        return result;
      }, { timeout: 15000, maxWait: 10000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw AppError.fromCode(LG.OPERATION_CONFLICT);
      throw error;
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

const deliveryTaskDetailInclude = {
  staff: { select: { id: true, fullName: true } },
  custodyTransfersViaDeliveryTaskId: {
    where: { status: CustodyTransferStatus.PENDING_RECEIPT },
    orderBy: { requestedAt: 'desc' as const },
    take: 1,
  },
  servicePoint: { select: { id: true, name: true, address: true } },
  package: {
    include: {
      packageItemsViaPackageId: {
        include: {
          equipmentUnit: { include: { product: { select: { id: true, name: true } } } },
          assignment: true,
        },
      },
    },
  },
  order: {
    include: {
      pickupPoint: { select: { id: true, name: true, address: true } },
      conditionSnapshotsViaOrderId: { where: { snapshotStage: SnapshotStage.PRE_HANDOVER } },
      rentalPickupCodesViaOrderId: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  },
} as const;

function mapDeliveryTaskDetail(task: any): DeliveryTaskDetailResult {
  const latestCode = task.order.rentalPickupCodesViaOrderId[0] ?? null;
  const snapshotsByUnit = new Map<string, any>();
  task.order.conditionSnapshotsViaOrderId.forEach((snapshot: any) => snapshotsByUnit.set(snapshot.unitId, snapshot));
  return {
    task: {
      id: task.id,
      type: deliveryTaskTypeToPublicType(task.taskType),
      status: task.status,
      assignee: task.staff ? { id: task.staff.id, displayName: task.staff.fullName } : null,
      scheduledAt: task.scheduledAt?.toISOString() ?? null,
      point: task.servicePoint,
      version: task.version,
      allowedActions: deliveryAllowedActions(task.status),
    },
    package: task.package ? { id: task.package.id, code: task.package.packageCode, status: task.package.status, version: task.package.version } : null,
    custodyTransfer: task.custodyTransfersViaDeliveryTaskId[0]
      ? {
          id: task.custodyTransfersViaDeliveryTaskId[0].id,
          status: task.custodyTransfersViaDeliveryTaskId[0].status,
          requestedAt: task.custodyTransfersViaDeliveryTaskId[0].requestedAt.toISOString(),
        }
      : null,
    units: task.package?.packageItemsViaPackageId.map((item: any) => {
      const snapshot = snapshotsByUnit.get(item.equipmentUnitId);
      return {
        unitId: item.equipmentUnitId,
        assetCode: item.equipmentUnit.assetCode,
        product: item.equipmentUnit.product,
        condition: item.equipmentUnit.condition,
        physicalStatus: item.equipmentUnit.status,
        assignmentStatus: item.assignment.status,
        conditionBefore: snapshot ? {
          id: snapshot.id,
          condition: snapshot.condition,
          notes: snapshot.notes,
          accessories: jsonObjectOrArray(snapshot.accessories),
          evidenceIds: jsonObjectOrArray(snapshot.evidenceIds),
        } : null,
      };
    }) ?? [],
    recipient: jsonObject(task.order.recipientSnapshot),
    verificationStatus: {
      hasCode: Boolean(latestCode),
      codeExpiresAt: latestCode?.expiresAt?.toISOString() ?? null,
      verifiedAt: latestCode?.verifiedAt?.toISOString() ?? null,
      verificationRef: latestCode?.verificationRef ?? null,
      usedAt: latestCode?.usedAt?.toISOString() ?? null,
      revokedAt: latestCode?.revokedAt?.toISOString() ?? null,
    },
  };
}

async function lockDeliveryTask(tx: Prisma.TransactionClient, taskId: string) {
  await tx.$queryRaw`SELECT id FROM delivery_tasks WHERE id = ${taskId}::uuid FOR UPDATE`;
  const task = await tx.deliveryTask.findUnique({ where: { id: taskId } });
  if (!task) throw AppError.fromCode(LG.TASK_NOT_FOUND);
  return task;
}

async function lockInventoryTask(tx: Prisma.TransactionClient, taskId: string) {
  await tx.$queryRaw`SELECT id FROM inventory_tasks WHERE id = ${taskId}::uuid FOR UPDATE`;
  const task = await tx.inventoryTask.findUnique({ where: { id: taskId } });
  if (!task) throw AppError.fromCode(LG.TASK_NOT_FOUND);
  return task;
}

async function lockRentalOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
  const order = await tx.rentalOrder.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.fromCode(LG.RENTAL_ORDER_NOT_FOUND);
  return order;
}

function assertExpectedVersion(actual: number, expected: number) {
  if (actual !== expected) throw AppError.fromCode(LG.VERSION_CONFLICT, { details: { expectedVersion: expected, actualVersion: actual } });
}

function assertDeliveryTaskActor(staffId: string | null, actorUserId: string) {
  if (!staffId) throw AppError.fromCode(LG.TASK_NOT_CLAIMED);
  if (staffId !== actorUserId) throw AppError.fromCode('FORBIDDEN');
}

async function getActiveStaffDelivery(tx: Prisma.TransactionClient, userId: string) {
  const actor = await tx.user.findFirst({ where: { id: userId, role: UserRole.STAFF_DELIVERY, status: UserStatus.ACTIVE }, select: { id: true, fullName: true } });
  if (!actor) throw AppError.fromCode('FORBIDDEN');
  return actor;
}

function assertUserOrRecipient(ownerUserId: string, recipientSnapshot: Prisma.JsonValue, actorUserId: string) {
  const recipientUserId = recipientUserIdFromSnapshot(recipientSnapshot);
  if (actorUserId !== ownerUserId && actorUserId !== recipientUserId) throw AppError.fromCode('FORBIDDEN');
}

function recipientUserIdFromSnapshot(snapshot: Prisma.JsonValue): string | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>).userId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function assertCurrentRentalContext(tx: Prisma.TransactionClient, order: any, now: Date) {
  // Handover validates live Trip status, owner/recipient Trip membership, and handover timing.
  const trip = await tx.trip.findUnique({
    where: { id: order.tripId },
    select: { id: true, status: true, tripType: true, leaderId: true, startAt: true, endAt: true },
  });
  if (!trip || ['DRAFT', 'CANCEL_PENDING', 'CANCELLED', 'INTERRUPTED'].includes(trip.status)) {
    throw AppError.fromCode(LG.STALE_CONTEXT);
  }

  const snapshot = jsonObject(order.recipientSnapshot);
  if (snapshot.userId !== order.userId) {
    throw AppError.fromCode(LG.RECIPIENT_CONTEXT_INVALID);
  }

  if (trip.tripType === 'PRIVATE') {
    const member = await tx.tripMember.findUnique({
      where: { tripId_userId: { tripId: order.tripId, userId: order.userId } },
      select: { id: true, status: true },
    });
    if (!member || member.id !== order.membershipRef || member.status !== 'ACTIVE') {
      throw AppError.fromCode(LG.RECIPIENT_CONTEXT_INVALID);
    }
    if (snapshot.memberId !== member.id) {
      throw AppError.fromCode(LG.RECIPIENT_CONTEXT_INVALID);
    }
  } else if (trip.leaderId === order.userId) {
    if (order.membershipRef && order.membershipRef !== trip.leaderId) {
      throw AppError.fromCode(LG.RECIPIENT_CONTEXT_INVALID);
    }
    if (snapshot.memberId && snapshot.memberId !== trip.leaderId) {
      throw AppError.fromCode(LG.RECIPIENT_CONTEXT_INVALID);
    }
  } else {
    const ownerBookingId = await confirmedPublicBookingOwnerId(tx, order);
    if (!ownerBookingId || snapshot.memberId !== ownerBookingId) {
      const participants = await tx.bookingParticipant.findMany({
        where: {
          userId: order.userId,
          booking: { tripId: order.tripId, ...(order.bookingId ? { id: order.bookingId } : {}) },
        },
        select: {
          id: true,
          bookingId: true,
          status: true,
          booking: { select: { id: true, status: true } },
        },
      });

      const matches = participants.some(
        (p) =>
          p.status === 'ACTIVE' &&
          VALID_PUBLIC_BOOKING_STATUSES.includes(p.booking.status) &&
          (!order.bookingId || p.bookingId === order.bookingId) &&
          (order.membershipRef === p.id || order.membershipRef === p.bookingId) &&
          (snapshot.memberId === p.id || snapshot.memberId === p.bookingId),
      );
      if (!matches) throw AppError.fromCode(LG.RECIPIENT_CONTEXT_INVALID);
    }
  }

  if (!order.pickupPointId || order.plannedHandoverAt > order.rentalEndAt || now > order.rentalEndAt) {
    throw AppError.fromCode(LG.PICKUP_CODE_INVALID_OR_EXPIRED);
  }
  // A Trip's end may precede rentalEndAt legitimately; it must NOT be used as a hard handover guard.
}

async function generateUniquePickupCode(tx: Prisma.TransactionClient, orderId: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = hashPickupCode(orderId, code);
    const existing = await tx.rentalPickupCode.findUnique({ where: { codeHash }, select: { id: true } });
    if (!existing) return code;
  }
  throw AppError.fromCode(LG.OPERATION_CONFLICT, { details: { reason: 'PICKUP_CODE_GENERATION_COLLISION' } });
}

function fingerprintPickupCode(code: string): string {
  const secret = envconfig.RENTAL_PICKUP_CODE_SECRET ?? process.env.RENTAL_PICKUP_CODE_SECRET;
  if (!secret || secret.length < 16) throw AppError.fromCode(LG.PICKUP_CODE_CONFIG_ERROR, { details: { requiredEnv: 'RENTAL_PICKUP_CODE_SECRET', minLength: 16 } });
  return createHmac('sha256', secret).update(`request:${code}`).digest('hex');
}

function hashPickupCode(orderId: string, code: string): string {
  const secret = envconfig.RENTAL_PICKUP_CODE_SECRET ?? process.env.RENTAL_PICKUP_CODE_SECRET;
  if (!secret || secret.length < 16) throw AppError.fromCode(LG.PICKUP_CODE_CONFIG_ERROR, { details: { requiredEnv: 'RENTAL_PICKUP_CODE_SECRET', minLength: 16 } });
  return createHmac('sha256', secret).update(`${orderId}:${code}`).digest('hex');
}

async function ensurePerUnitDepositLedger(tx: Prisma.TransactionClient, order: any, packageItems: any[]) {
  const settlement = await tx.depositSettlement.upsert({
    where: { orderId: order.id },
    update: {},
    create: {
      orderId: order.id,
      rentalPolicyId: order.rentalPolicyId,
      idempotencyKey: `rental-deposit:${order.id}`,
      totalDeposit: order.totalDeposit,
      status: DepositSettlementStatus.OPEN,
      policySnapshot: order.policySnapshot,
    },
  });
  for (const item of packageItems) {
    const depositAmount = item.assignment.orderLine.depositPerUnitSnapshot;
    await tx.depositSettlementItem.upsert({
      where: { assignmentId: item.assignmentId },
      update: {},
      create: {
        settlementId: settlement.id,
        assignmentId: item.assignmentId,
        unitId: item.equipmentUnitId,
        depositAmount,
        status: DepositItemStatus.HELD,
      },
    });
  }
}

async function validateExceptionEvidence(tx: Prisma.TransactionClient, actorUserId: string, evidenceIds: string[]) {
  if (evidenceIds.length === 0) return;
  const uniqueIds = [...new Set(evidenceIds)];
  const evidence = await tx.mediaAsset.findMany({
    where: {
      id: { in: uniqueIds },
      status: MediaStatus.READY,
      scope: { in: [MediaScope.EXCEPTION_EVIDENCE, MediaScope.CONDITION_EVIDENCE] },
      OR: [{ ownerUserId: actorUserId }, { ownerUserId: null }],
    },
    select: { id: true },
  });
  if (evidence.length !== uniqueIds.length) throw AppError.fromCode(LG.EVIDENCE_NOT_READY, { details: { requested: uniqueIds.length, valid: evidence.length } });
  if (typeof tx.mediaAsset?.updateMany === 'function') {
    await tx.mediaAsset.updateMany({ where: { id: { in: uniqueIds } }, data: { retentionUntil: null } });
  }
}

async function calculateNoShowRefund(tx: Prisma.TransactionClient, order: any, now: Date, isUserFault: boolean) {
  const policy = await tx.rentalPolicy.findUnique({ where: { id: order.rentalPolicyId } });
  if (!policy) throw AppError.fromCode(LG.PICKUP_CODE_CONFIG_ERROR);
  const rentalFee = decimalVndToApiInteger(order.rentalFee.toString());
  const totalDeposit = decimalVndToApiInteger(order.totalDeposit.toString());
  if (!isUserFault) return { feeRefund: rentalFee, depositRefund: totalDeposit };
  const freeCancelDeadline = new Date(order.rentalStartAt.getTime() - policy.freeCancellationHours * 3_600_000);
  return { feeRefund: now <= freeCancelDeadline ? rentalFee : 0, depositRefund: totalDeposit };
}

async function findSucceededRentalPayment(tx: Prisma.TransactionClient, orderId: string) {
  // Extension invoices contain FEES ONLY. The initial invoice owns deposit money.
  return tx.payment.findFirst({
    where: { status: PaymentStatus.SUCCEEDED, invoice: { rentalOrderId: orderId },
      application: { status: 'APPLIED' },
      allocations: { some: { component: 'RENTAL_DEPOSIT', rentalOrderLine: { orderId } } } },
    orderBy: { paidAt: 'asc' },
  });
}

async function writeCustodyPackageAndUnits(tx: Prisma.TransactionClient, input: {
  idempotencyKey: string;
  orderId: string;
  packageId: string;
  deliveryTaskId: string;
  unitIds: string[];
  eventType: CustodyEventType;
  fromActorType: CustodyActorType;
  fromUserId?: string;
  fromInventoryLocationId?: string;
  toActorType: CustodyActorType;
  toUserId?: string;
  toInventoryLocationId?: string;
  orderStatusBefore?: RentalOrderStatus;
  orderStatusAfter?: RentalOrderStatus;
  packageStatusBefore?: PackageStatus;
  packageStatusAfter?: PackageStatus;
  unitStatusBefore?: EquipmentUnitStatus;
  unitStatusAfter?: EquipmentUnitStatus;
  deliveryStatusBefore?: DeliveryTaskStatus;
  deliveryStatusAfter?: DeliveryTaskStatus;
  performedBy: string;
  occurredAt: Date;
}) {
  await tx.custodyEvent.create({
    data: {
      idempotencyKey: `${input.idempotencyKey}:package`,
      orderId: input.orderId,
      packageId: input.packageId,
      deliveryTaskId: input.deliveryTaskId,
      eventType: input.eventType,
      fromActorType: input.fromActorType,
      fromUserId: input.fromUserId,
      fromInventoryLocationId: input.fromInventoryLocationId,
      toActorType: input.toActorType,
      toUserId: input.toUserId,
      toInventoryLocationId: input.toInventoryLocationId,
      orderStatusBefore: input.orderStatusBefore,
      orderStatusAfter: input.orderStatusAfter,
      packageStatusBefore: input.packageStatusBefore,
      packageStatusAfter: input.packageStatusAfter,
      deliveryStatusBefore: input.deliveryStatusBefore,
      deliveryStatusAfter: input.deliveryStatusAfter,
      performedBy: input.performedBy,
      occurredAt: input.occurredAt,
    },
  });
  for (const unitId of input.unitIds) {
    await tx.custodyEvent.create({
      data: {
        idempotencyKey: `${input.idempotencyKey}:unit:${unitId}`,
        orderId: input.orderId,
        packageId: input.packageId,
        unitId,
        deliveryTaskId: input.deliveryTaskId,
        eventType: input.eventType,
        fromActorType: input.fromActorType,
        fromUserId: input.fromUserId,
        fromInventoryLocationId: input.fromInventoryLocationId,
        toActorType: input.toActorType,
        toUserId: input.toUserId,
        toInventoryLocationId: input.toInventoryLocationId,
        unitStatusBefore: input.unitStatusBefore,
        unitStatusAfter: input.unitStatusAfter,
        performedBy: input.performedBy,
        occurredAt: input.occurredAt,
      },
    });
  }
}

async function writeDeliveryAudit(tx: Prisma.TransactionClient, input: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  requestId?: string;
}) {
  await tx.auditLog.create({
    data: {
      userId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValues: input.oldValues === undefined ? undefined : jsonValue(input.oldValues),
      newValues: input.newValues === undefined ? undefined : jsonValue(input.newValues),
      requestId: input.requestId,
    },
  });
}

function deliveryAllowedActions(status: DeliveryTaskStatus): string[] {
  switch (status) {
    case DeliveryTaskStatus.SCHEDULED: return ['RECEIVE_PACKAGE'];
    case DeliveryTaskStatus.PACKAGE_RECEIVED: return ['VERIFY_RECIPIENT', 'NO_SHOW_OR_REFUSAL'];
    case DeliveryTaskStatus.RECIPIENT_VERIFIED: return ['HANDOVER', 'NO_SHOW_OR_REFUSAL'];
    default: return [];
  }
}

function mapRentalOrderForHandover(order: any): Record<string, unknown> {
  return {
    id: order.id,
    bookingId: order.bookingId,
    tripId: order.tripId,
    status: order.status,
    exceptionStatus: order.exceptionStatus,
    financialStatus: order.financialStatus,
    rentalStartAt: order.rentalStartAt.toISOString(),
    rentalEndAt: order.rentalEndAt.toISOString(),
    version: order.version,
  };
}

function publicTaskTypeToDeliveryTaskType(type: 'PREPARATION' | 'WAREHOUSE' | 'OUTBOUND' | 'RETURN'): DeliveryTaskType {
  if (type === 'OUTBOUND') return DeliveryTaskType.HANDOVER;
  if (type === 'RETURN') return DeliveryTaskType.RETURN;
  throw AppError.fromCode(LG.INVALID_TASK_STATE, { details: { taskType: type } });
}

function deliveryTaskTypeToPublicType(type: DeliveryTaskType): 'OUTBOUND' | 'RETURN' {
  return type === DeliveryTaskType.HANDOVER ? 'OUTBOUND' : 'RETURN';
}

function assignmentWhere(assignment: 'UNASSIGNED' | 'ASSIGNED' | 'ME' | undefined, actorUserId: string): Prisma.StringNullableFilter | string | null | undefined {
  if (assignment === 'UNASSIGNED') return null;
  if (assignment === 'ASSIGNED') return { not: null };
  if (assignment === 'ME') return actorUserId;
  return undefined;
}

function pagination(page: number, pageSize: number, totalItems: number) {
  return { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) };
}

function decimalVndToApiInteger(value: string): number {
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isInteger()) throw AppError.fromCode(LG.OPERATION_CONFLICT, { details: { reason: 'VND_AMOUNT_NOT_INTEGER' } });
  const number = decimal.toNumber();
  if (!Number.isSafeInteger(number)) throw AppError.fromCode(LG.OPERATION_CONFLICT, { details: { reason: 'VND_AMOUNT_OUT_OF_RANGE' } });
  return number;
}

function vietnamBusinessDayUtcWindow(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function stableJson(value: unknown): string { return JSON.stringify(sortJson(value)); }
function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortJson(item)]));
  return value;
}
function jsonValue(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
function jsonObjectOrArray(value: Prisma.JsonValue | null): unknown {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}
