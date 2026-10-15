import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  CustodyTransferStatus,
  DeliveryTaskStatus,
  DeliveryTaskType,
  EquipmentCondition,
  EquipmentUnitStatus,
  InventoryTaskStatus,
  MediaScope,
  MediaStatus,
  PackageStatus,
  Prisma,
  RentalOrderStatus,
  RentalUnitAssignmentStatus,
  SnapshotStage,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import { AppError } from 'src/shared/errors/app-error';
import { WAREHOUSE_ERROR_CODES as WH } from 'src/shared/errors/codes/preparation.error-codes';
import { resolveActivePrimaryRentalLocation } from '../../../shared/primary-inventory-location';
import type {
  ClaimPreparationTaskCommand,
  ClaimPreparationTaskResult,
  ConditionSnapshotResult,
  GetPreparationTaskQuery,
  ListPickCandidatesQuery,
  ListReplacementCandidatesQuery,
  ListPreparationTasksQuery,
  MarkPreparationReadyCommand,
  MarkPreparationReadyResult,
  PackPreparationPackageCommand,
  PackPreparationPackageResult,
  PaginatedPreparationCandidatesResult,
  PaginatedPreparationTasksResult,
  PickPreparationUnitsCommand,
  PickPreparationUnitsResult,
  ReplacePreparationUnitCommand,
  ReplacePreparationUnitResult,
  RequestPreparationTransferCommand,
  RequestPreparationTransferResult,
  SavePreHandoverConditionCommand,
  PreparationCandidateView,
  PreparationPackageView,
  PreparationTaskDetailResult,
  PreparationTaskPort,
  PreparationUnitView,
} from '../../application/ports/preparation-task.port';

const ACTIVE_ASSIGNMENT_STATUSES: RentalUnitAssignmentStatus[] = [
  RentalUnitAssignmentStatus.ASSIGNED,
  RentalUnitAssignmentStatus.PACKED,
];
const SAFE_PICK_CONDITIONS: EquipmentCondition[] = [
  EquipmentCondition.NEW,
  EquipmentCondition.GOOD,
  EquipmentCondition.FAIR,
];
const PICKABLE_TASK_STATUSES: InventoryTaskStatus[] = [
  InventoryTaskStatus.OPEN,
  InventoryTaskStatus.PICKING,
  InventoryTaskStatus.CONDITION_CAPTURED,
];
const REPLACEABLE_TASK_STATUSES: InventoryTaskStatus[] = [
  InventoryTaskStatus.PICKING,
  InventoryTaskStatus.CONDITION_CAPTURED,
  InventoryTaskStatus.PACKED,
  InventoryTaskStatus.READY,
];

@Injectable()
export class PrismaPreparationTaskAdapter implements PreparationTaskPort {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // RB-API-301
  // ---------------------------------------------------------------------------
  async listTasks(query: ListPreparationTasksQuery): Promise<PaginatedPreparationTasksResult> {
    const skip = (query.page - 1) * query.pageSize;
    const dateWindow = query.date ? vietnamBusinessDayUtcWindow(query.date) : null;
    const where: Prisma.InventoryTaskWhereInput = {
      AND: [
        { OR: [{ staffId: null }, { staffId: query.actorUserId }] },
        query.status ? { status: query.status as InventoryTaskStatus } : {},
        query.tripId ? { order: { tripId: query.tripId } } : {},
        dateWindow ? { deadline: { gte: dateWindow.start, lt: dateWindow.end } } : {},
      ],
    };

    const [rows, totalItems] = await this.prisma.$transaction([
      this.prisma.inventoryTask.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
        include: {
          staff: { select: { id: true, fullName: true } },
          inventoryLocation: { select: { id: true, name: true } },
          order: {
            include: {
              pickupPoint: { select: { id: true, name: true } },
              rentalOrderLinesViaOrderId: {
                include: {
                  product: { select: { id: true, name: true } },
                  rentalUnitAssignmentsViaOrderLineId: {
                    where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.inventoryTask.count({ where }),
    ]);

    return {
      items: rows.map((row) => {
        const required = row.order.rentalOrderLinesViaOrderId.reduce((sum, line) => sum + line.quantity, 0);
        const picked = row.order.rentalOrderLinesViaOrderId.reduce(
          (sum, line) => sum + line.rentalUnitAssignmentsViaOrderLineId.length,
          0,
        );
        return {
          id: row.id,
          type: 'PREPARE_RENTAL',
          status: row.status,
          orderId: row.orderId,
          orderCode: rentalOrderCode(row.orderId),
          assignee: row.staff ? { id: row.staff.id, displayName: row.staff.fullName } : null,
          deadline: row.deadline?.toISOString() ?? null,
          trip: { id: row.order.tripId },
          pickup: { id: row.order.pickupPoint.id, name: row.order.pickupPoint.name },
          inventoryLocation: { id: row.inventoryLocation.id, name: row.inventoryLocation.name },
          progress: { required, picked, remaining: Math.max(0, required - picked) },
          requiredLineSummary: row.order.rentalOrderLinesViaOrderId.map((line) => ({
            productId: line.product.id,
            productName: line.product.name,
            quantity: line.quantity,
            pickedQty: line.rentalUnitAssignmentsViaOrderLineId.length,
          })),
          version: row.version,
          allowedActions: warehouseAllowedActions(row.status, row.staffId, query.actorUserId),
        };
      }),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // RB-API-302
  // ---------------------------------------------------------------------------
  async getTask(query: GetPreparationTaskQuery): Promise<PreparationTaskDetailResult> {
    const task = await this.prisma.inventoryTask.findUnique({
      where: { id: query.taskId },
      include: taskDetailInclude,
    });
    if (!task) throw AppError.fromCode(WH.TASK_NOT_FOUND);
    assertTaskVisibleToActor(task.staffId, query.actorUserId);
    return mapTaskDetail(task);
  }

  // ---------------------------------------------------------------------------
  // RB-API-303
  // ---------------------------------------------------------------------------
  async pickUnits(command: PickPreparationUnitsCommand): Promise<PickPreparationUnitsResult> {
    return this.runIdempotentMutation(
      'RB-API-303:warehouse-pick',
      command.actorUserId,
      command.idempotencyKey,
      { taskId: command.taskId, assetCodes: [...command.assetCodes].map((x) => x.toUpperCase()).sort(), expectedVersion: command.expectedVersion },
      async (tx) => {
        const task = await lockInventoryTask(tx, command.taskId);
        assertTaskClaimedByActor(task, command.actorUserId);
        assertExpectedVersion(task.version, command.expectedVersion);
        if (!PICKABLE_TASK_STATUSES.includes(task.status)) throw AppError.fromCode(WH.TASK_NOT_PICKABLE);

        const order = await tx.rentalOrder.findUnique({
          where: { id: task.orderId },
          include: {
            rentalOrderLinesViaOrderId: {
              include: {
                product: { select: { id: true, name: true } },
                rentalUnitAssignmentsViaOrderLineId: {
                  where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
                  select: { id: true, equipmentUnitId: true },
                },
              },
            },
          },
        });
        if (!order || ![RentalOrderStatus.PAID, RentalOrderStatus.PREPARING].includes(order.status as any)) {
          throw AppError.fromCode(WH.INVALID_TASK_STATE);
        }

        const lineByProduct = new Map(order.rentalOrderLinesViaOrderId.map((line) => [line.productId, line]));
        const remainingByLine = new Map(
          order.rentalOrderLinesViaOrderId.map((line) => [
            line.id,
            line.quantity - line.rentalUnitAssignmentsViaOrderLineId.length,
          ]),
        );

        const normalizedCodes = [...new Set(command.assetCodes.map((code) => code.trim().toUpperCase()))].sort();
        const assignments: PickPreparationUnitsResult['assignments'] = [];
        const pickedUnitIds: string[] = [];

        for (const assetCode of normalizedCodes) {
          const unit = await lockEquipmentUnitByAssetCode(tx, assetCode);
          if (!unit) throw AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, { details: { assetCode, reason: 'UNIT_NOT_FOUND' } });
          if (
            unit.status !== EquipmentUnitStatus.AVAILABLE ||
            !SAFE_PICK_CONDITIONS.includes(unit.condition) ||
            unit.currentInventoryLocationId !== task.inventoryLocationId
          ) {
            throw AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, {
              details: { assetCode, physicalStatus: unit.status, condition: unit.condition, reason: 'UNAVAILABLE_OR_WRONG_LOCATION' },
            });
          }

          const line = lineByProduct.get(unit.productId);
          if (!line || (remainingByLine.get(line.id) ?? 0) <= 0) {
            throw AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, { details: { assetCode, productId: unit.productId, reason: 'WRONG_PRODUCT_OR_LINE_FULL' } });
          }

          const existingAssignment = await tx.rentalUnitAssignment.findFirst({
            where: { equipmentUnitId: unit.id, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
            select: { id: true },
          });
          if (existingAssignment) {
            throw AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, { details: { assetCode, reason: 'ALREADY_ASSIGNED' } });
          }

          const assignment = await tx.rentalUnitAssignment.create({
            data: {
              orderLineId: line.id,
              equipmentUnitId: unit.id,
              status: RentalUnitAssignmentStatus.ASSIGNED,
              assignedAt: command.now,
            },
          });
          await tx.equipmentUnit.update({
            where: { id: unit.id },
            data: { status: EquipmentUnitStatus.PICKED, version: { increment: 1 } },
          });

          remainingByLine.set(line.id, (remainingByLine.get(line.id) ?? 0) - 1);
          assignments.push({ assignmentId: assignment.id, orderLineId: line.id, unitId: unit.id });
          pickedUnitIds.push(unit.id);
        }

        const updatedTask = await tx.inventoryTask.update({
          where: { id: task.id },
          data: {
            status: InventoryTaskStatus.PICKING,
            startedAt: task.startedAt ?? command.now,
            version: { increment: 1 },
          },
        });
        if (order.status === RentalOrderStatus.PAID) {
          await tx.rentalOrder.update({
            where: { id: order.id },
            data: { status: RentalOrderStatus.PREPARING, version: { increment: 1 } },
          });
        }

        const [allActiveAssignments, pickedUnits] = await Promise.all([
          tx.rentalUnitAssignment.findMany({
            where: { orderLine: { orderId: order.id }, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
            select: { id: true },
          }),
          tx.equipmentUnit.findMany({
            where: { id: { in: pickedUnitIds } },
            select: { id: true, productId: true, assetCode: true, condition: true, status: true },
            orderBy: { assetCode: 'asc' },
          }),
        ]);
        const required = order.rentalOrderLinesViaOrderId.reduce((sum, line) => sum + line.quantity, 0);
        const picked = allActiveAssignments.length;
        await writePreparationAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'WAREHOUSE_UNITS_PICKED',
          entityType: 'InventoryTask',
          entityId: task.id,
          oldValues: { taskVersion: task.version },
          newValues: { taskVersion: updatedTask.version, assignmentIds: assignments.map((a) => a.assignmentId), unitIds: pickedUnitIds },
          requestId: command.idempotencyKey,
        });
        return {
          pickedUnits: pickedUnits.map(mapUnitView),
          assignments,
          progress: { required, picked, remaining: Math.max(0, required - picked) },
          taskVersion: updatedTask.version,
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-304
  // ---------------------------------------------------------------------------
  async savePreHandoverCondition(command: SavePreHandoverConditionCommand): Promise<ConditionSnapshotResult> {
    return this.runIdempotentMutation(
      'RB-API-304:condition-before',
      command.actorUserId,
      command.idempotencyKey,
      {
        taskId: command.taskId,
        unitId: command.unitId,
        condition: command.condition,
        notes: command.notes ?? null,
        accessories: command.accessories ?? [],
        evidenceIds: [...command.evidenceIds].sort(),
        expectedVersion: command.expectedVersion,
      },
      async (tx) => {
        const task = await lockInventoryTask(tx, command.taskId);
        assertTaskClaimedByActor(task, command.actorUserId);
        assertExpectedVersion(task.version, command.expectedVersion);
        if (!PICKABLE_TASK_STATUSES.includes(task.status)) throw AppError.fromCode(WH.INVALID_TASK_STATE);

        const assignment = await tx.rentalUnitAssignment.findFirst({
          where: {
            equipmentUnitId: command.unitId,
            orderLine: { orderId: task.orderId },
            status: { in: ACTIVE_ASSIGNMENT_STATUSES },
          },
          include: { equipmentUnit: true },
        });
        if (!assignment) throw AppError.fromCode(WH.UNIT_NOT_ASSIGNED_TO_TASK);

        const existingSnapshot = await tx.conditionSnapshot.findUnique({
          where: { assignmentId_snapshotStage: { assignmentId: assignment.id, snapshotStage: SnapshotStage.PRE_HANDOVER } },
          select: { id: true },
        });
        if (existingSnapshot) throw AppError.fromCode(WH.CONDITION_SNAPSHOT_EXISTS);

        const evidenceIds = [...new Set(command.evidenceIds)];
        const evidence = await tx.mediaAsset.findMany({
          where: {
            id: { in: evidenceIds },
            status: MediaStatus.READY,
            scope: MediaScope.CONDITION_EVIDENCE,
            OR: [{ ownerUserId: command.actorUserId }, { ownerUserId: null }],
          },
          select: { id: true, secureUrl: true, mimeType: true },
        });
        if (evidence.length !== evidenceIds.length) {
          throw AppError.fromCode(WH.EVIDENCE_NOT_READY, { details: { requested: evidenceIds.length, valid: evidence.length } });
        }

        const snapshot = await tx.conditionSnapshot.create({
          data: {
            orderId: task.orderId,
            assignmentId: assignment.id,
            unitId: command.unitId,
            packageId: task.packageId,
            snapshotStage: SnapshotStage.PRE_HANDOVER,
            condition: command.condition as EquipmentCondition,
            notes: command.notes ?? null,
            accessories: (command.accessories ?? []) as unknown as Prisma.InputJsonValue,
            evidenceIds: evidenceIds as unknown as Prisma.InputJsonValue,
            takenBy: command.actorUserId,
            createdAt: command.now,
          },
        });
        await tx.equipmentUnit.update({
          where: { id: command.unitId },
          data: { condition: command.condition as EquipmentCondition, version: { increment: 1 } },
        });

        const completeness = await preparationCompleteness(tx, task.orderId);
        const updatedTask = await tx.inventoryTask.update({
          where: { id: task.id },
          data: {
            status: completeness.required > 0 && completeness.picked === completeness.required && completeness.evidenceComplete === completeness.required
              ? InventoryTaskStatus.CONDITION_CAPTURED
              : InventoryTaskStatus.PICKING,
            version: { increment: 1 },
          },
        });

        await writePreparationAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'PRE_HANDOVER_CONDITION_CAPTURED',
          entityType: 'EquipmentUnit',
          entityId: command.unitId,
          oldValues: { condition: assignment.equipmentUnit.condition },
          newValues: { condition: command.condition, snapshotId: snapshot.id, evidenceIds },
          requestId: command.idempotencyKey,
        });
        return {
          id: snapshot.id,
          orderId: snapshot.orderId,
          unitId: snapshot.unitId,
          stage: 'BEFORE',
          condition: snapshot.condition,
          notes: snapshot.notes,
          accessories: snapshot.accessories,
          evidence: evidence.map((item) => ({ id: item.id, url: item.secureUrl, contentType: item.mimeType })),
          createdAt: snapshot.createdAt.toISOString(),
          createdBy: snapshot.takenBy,
          version: 1,
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-305
  // ---------------------------------------------------------------------------
  async packPackage(command: PackPreparationPackageCommand): Promise<PackPreparationPackageResult> {
    return this.runIdempotentMutation(
      'RB-API-305:pack-package',
      command.actorUserId,
      command.idempotencyKey,
      { taskId: command.taskId, unitIds: [...command.unitIds].sort(), expectedVersion: command.expectedVersion },
      async (tx) => {
        const task = await lockInventoryTask(tx, command.taskId);
        assertTaskClaimedByActor(task, command.actorUserId);
        assertExpectedVersion(task.version, command.expectedVersion);
        if (![InventoryTaskStatus.PICKING, InventoryTaskStatus.CONDITION_CAPTURED].includes(task.status as any)) {
          throw AppError.fromCode(WH.INVALID_TASK_STATE);
        }

        const order = await lockRentalOrder(tx, task.orderId);
        if (![RentalOrderStatus.PREPARING, RentalOrderStatus.PAID].includes(order.status as any)) {
          throw AppError.fromCode(WH.INVALID_TASK_STATE, { details: { orderStatus: order.status, reason: 'ORDER_NOT_PREPARING_OR_PAID' } });
        }

        const validation = await validatePackageReadiness(tx, task.orderId, command.unitIds, undefined, 'PACK');
        if (!validation.complete) {
          if (validation.reason === 'EVIDENCE') {
            throw AppError.fromCode(WH.EVIDENCE_INCOMPLETE, { details: validation.details });
          }
          if (validation.reason === 'UNSAFE' || validation.reason === 'STATUS_INVALID' || validation.reason === 'LOCATION_MISMATCH' || validation.reason === 'CONFLICT') {
            throw AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, { details: validation.details });
          }
          throw AppError.fromCode(WH.PACKAGE_INCOMPLETE, { details: validation.details });
        }

        let pkg = await tx.package.findUnique({ where: { orderId: task.orderId } });
        if (!pkg) {
          pkg = await tx.package.create({
            data: { orderId: task.orderId, packageCode: packageCode(task.orderId), status: PackageStatus.OPEN },
          });
        } else if (![PackageStatus.OPEN, PackageStatus.PACKED].includes(pkg.status as any)) {
          throw AppError.fromCode(WH.INVALID_TASK_STATE);
        }

        await tx.packageItem.deleteMany({ where: { packageId: pkg.id } });
        for (const assignment of validation.assignments) {
          await tx.packageItem.create({
            data: { packageId: pkg.id, assignmentId: assignment.id, equipmentUnitId: assignment.equipmentUnitId },
          });
          await tx.rentalUnitAssignment.update({
            where: { id: assignment.id },
            data: { status: RentalUnitAssignmentStatus.PACKED, packedAt: command.now, version: { increment: 1 } },
          });
          await tx.equipmentUnit.update({
            where: { id: assignment.equipmentUnitId },
            data: { status: EquipmentUnitStatus.PACKED, version: { increment: 1 } },
          });
        }
        pkg = await tx.package.update({
          where: { id: pkg.id },
          data: { status: PackageStatus.PACKED, sealedAt: command.now, version: { increment: 1 } },
        });
        await tx.conditionSnapshot.updateMany({
          where: { orderId: task.orderId, snapshotStage: SnapshotStage.PRE_HANDOVER, packageId: null },
          data: { packageId: pkg.id },
        });
        const updatedTask = await tx.inventoryTask.update({
          where: { id: task.id },
          data: { packageId: pkg.id, status: InventoryTaskStatus.PACKED, version: { increment: 1 } },
        });
        await writePreparationAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'WAREHOUSE_PACKAGE_PACKED',
          entityType: 'Package',
          entityId: pkg.id,
          oldValues: { status: PackageStatus.OPEN },
          newValues: { status: PackageStatus.PACKED, unitIds: validation.assignments.map((a) => a.equipmentUnitId) },
          requestId: command.idempotencyKey,
        });

        return { package: await mapPackageWithItems(tx, pkg.id), taskStatus: updatedTask.status, taskVersion: updatedTask.version };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-306
  // ---------------------------------------------------------------------------
  async markReady(command: MarkPreparationReadyCommand): Promise<MarkPreparationReadyResult> {
    return this.runIdempotentMutation(
      'RB-API-306:preparation-ready',
      command.actorUserId,
      command.idempotencyKey,
      { taskId: command.taskId, packageId: command.packageId, expectedVersion: command.expectedVersion },
      async (tx) => {
        const task = await lockInventoryTask(tx, command.taskId);
        assertTaskClaimedByActor(task, command.actorUserId);
        assertExpectedVersion(task.version, command.expectedVersion);
        if (task.status !== InventoryTaskStatus.PACKED || task.packageId !== command.packageId) {
          throw AppError.fromCode(WH.INVALID_TASK_STATE);
        }
        const pkg = await tx.package.findUnique({ where: { id: command.packageId } });
        if (!pkg) throw AppError.fromCode(WH.PACKAGE_NOT_FOUND);
        if (pkg.orderId !== task.orderId) throw AppError.fromCode(WH.PACKAGE_MISMATCH);
        if (pkg.status !== PackageStatus.PACKED) throw AppError.fromCode(WH.INVALID_TASK_STATE);

        const order = await lockRentalOrder(tx, task.orderId);
        if (![RentalOrderStatus.PREPARING, RentalOrderStatus.PAID, RentalOrderStatus.READY_FOR_HANDOVER].includes(order.status as any)) {
          throw AppError.fromCode(WH.INVALID_TASK_STATE, {
            details: { reason: 'ORDER_NOT_IN_PREPARING_OR_PAID', orderStatus: order.status },
          });
        }
        if (order.status === RentalOrderStatus.CANCELLED || order.status === RentalOrderStatus.EXPIRED || order.status === RentalOrderStatus.ACTIVE) {
          throw AppError.fromCode(WH.INVALID_TASK_STATE, {
            details: { reason: 'ORDER_ALREADY_CANCELLED_OR_ACTIVE', orderStatus: order.status },
          });
        }

        const validation = await validatePackageReadiness(tx, task.orderId, undefined, pkg.id, 'READY');
        if (!validation.complete) {
          if (validation.reason === 'EVIDENCE') {
            throw AppError.fromCode(WH.EVIDENCE_INCOMPLETE, { details: validation.details });
          }
          if (validation.reason === 'UNSAFE' || validation.reason === 'STATUS_INVALID' || validation.reason === 'LOCATION_MISMATCH' || validation.reason === 'CONFLICT') {
            throw AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, { details: validation.details });
          }
          throw AppError.fromCode(WH.PACKAGE_INCOMPLETE, { details: validation.details });
        }

        await tx.package.update({ where: { id: pkg.id }, data: { status: PackageStatus.READY, version: { increment: 1 } } });
        const updatedTask = await tx.inventoryTask.update({
          where: { id: task.id },
          data: { status: InventoryTaskStatus.READY, version: { increment: 1 } },
        });
        await tx.rentalOrder.update({
          where: { id: order.id },
          data: { status: RentalOrderStatus.READY_FOR_HANDOVER, version: { increment: 1 } },
        });

        const logisticsTask = await tx.deliveryTask.upsert({
          where: { orderId_taskType: { orderId: order.id, taskType: DeliveryTaskType.HANDOVER } },
          update: {
            packageId: pkg.id,
            tripId: order.tripId,
            servicePointId: order.pickupPointId,
            scheduledAt: order.plannedHandoverAt,
            status: DeliveryTaskStatus.SCHEDULED,
            version: { increment: 1 },
          },
          create: {
            orderId: order.id,
            packageId: pkg.id,
            tripId: order.tripId,
            servicePointId: order.pickupPointId,
            taskType: DeliveryTaskType.HANDOVER,
            status: DeliveryTaskStatus.SCHEDULED,
            scheduledAt: order.plannedHandoverAt,
          },
        });

        await tx.rentalOutboxEvent.upsert({
          where: { deduplicationKey: `rental-ready:${order.id}` },
          update: {},
          create: {
            deduplicationKey: `rental-ready:${order.id}`,
            eventType: 'RENTAL_READY_FOR_HANDOVER',
            aggregateType: 'RentalOrder',
            aggregateId: order.id,
            payload: jsonValue({ orderId: order.id, packageId: pkg.id, logisticsTaskId: logisticsTask.id, plannedHandoverAt: order.plannedHandoverAt.toISOString() }),
          },
        });
        await writePreparationAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'WAREHOUSE_PACKAGE_READY',
          entityType: 'InventoryTask',
          entityId: task.id,
          oldValues: { status: task.status },
          newValues: { status: updatedTask.status, orderStatus: RentalOrderStatus.READY_FOR_HANDOVER, logisticsTaskId: logisticsTask.id },
          requestId: command.idempotencyKey,
        });
        return {
          taskId: updatedTask.id,
          taskStatus: updatedTask.status,
          orderStatus: RentalOrderStatus.READY_FOR_HANDOVER,
          logisticsTaskId: logisticsTask.id,
          version: updatedTask.version,
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-307
  // ---------------------------------------------------------------------------
  async replaceUnit(command: ReplacePreparationUnitCommand): Promise<ReplacePreparationUnitResult> {
    return this.runIdempotentMutation(
      'RB-API-307:replace-unit',
      command.actorUserId,
      command.idempotencyKey,
      {
        taskId: command.taskId,
        oldUnitId: command.oldUnitId,
        newUnitId: command.newUnitId,
        reason: command.reason,
        expectedVersion: command.expectedVersion,
      },
      async (tx) => {
        const task = await lockInventoryTask(tx, command.taskId);
        assertTaskClaimedByActor(task, command.actorUserId);
        assertExpectedVersion(task.version, command.expectedVersion);
        if (!REPLACEABLE_TASK_STATUSES.includes(task.status)) throw AppError.fromCode(WH.INVALID_TASK_STATE);

        const pendingTransfer = task.packageId
          ? await tx.custodyTransfer.findFirst({ where: { packageId: task.packageId, status: CustodyTransferStatus.PENDING_RECEIPT }, select: { id: true } })
          : null;
        if (pendingTransfer) throw AppError.fromCode(WH.CUSTODY_TRANSFER_ALREADY_PENDING);

        const [oldLocked, newLocked] = await lockTwoEquipmentUnits(tx, command.oldUnitId, command.newUnitId);
        if (!oldLocked || !newLocked) throw AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK);

        const oldAssignment = await tx.rentalUnitAssignment.findFirst({
          where: {
            equipmentUnitId: command.oldUnitId,
            orderLine: { orderId: task.orderId },
            status: { in: ACTIVE_ASSIGNMENT_STATUSES },
          },
          include: { orderLine: true },
        });
        if (!oldAssignment) throw AppError.fromCode(WH.ASSIGNMENT_NOT_FOUND);
        if (
          newLocked.productId !== oldAssignment.orderLine.productId ||
          newLocked.status !== EquipmentUnitStatus.AVAILABLE ||
          !SAFE_PICK_CONDITIONS.includes(newLocked.condition) ||
          newLocked.currentInventoryLocationId !== task.inventoryLocationId
        ) {
          throw AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, { details: { newUnitId: command.newUnitId, reason: 'NOT_VALID_REPLACEMENT' } });
        }
        const newActiveAssignment = await tx.rentalUnitAssignment.findFirst({
          where: { equipmentUnitId: newLocked.id, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
          select: { id: true },
        });
        if (newActiveAssignment) throw AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, { details: { reason: 'ALREADY_ASSIGNED' } });

        const oldPackageItem = await tx.packageItem.findUnique({ where: { assignmentId: oldAssignment.id } });
        if (oldPackageItem) await tx.packageItem.delete({ where: { id: oldPackageItem.id } });

        await tx.rentalUnitAssignment.update({
          where: { id: oldAssignment.id },
          data: { status: RentalUnitAssignmentStatus.REPLACED, version: { increment: 1 } },
        });
        await tx.equipmentUnit.update({
          where: { id: oldLocked.id },
          data: { status: EquipmentUnitStatus.MAINTENANCE, version: { increment: 1 } },
        });
        await tx.maintenanceRecord.create({
          data: {
            unitId: oldLocked.id,
            inventoryLocationId: task.inventoryLocationId,
            staffId: command.actorUserId,
            reason: command.reason,
            notes: `Replaced before handover from task ${task.id}`,
            startAt: command.now,
          },
        });
        const newAssignment = await tx.rentalUnitAssignment.create({
          data: {
            orderLineId: oldAssignment.orderLineId,
            equipmentUnitId: newLocked.id,
            status: RentalUnitAssignmentStatus.ASSIGNED,
            replacedFromId: oldAssignment.id,
            assignedAt: command.now,
          },
        });
        const newUnit = await tx.equipmentUnit.update({
          where: { id: newLocked.id },
          data: { status: EquipmentUnitStatus.PICKED, version: { increment: 1 } },
        });

        let packageVersion: number | null = null;
        if (task.packageId) {
          const pkg = await tx.package.update({
            where: { id: task.packageId },
            data: { status: PackageStatus.OPEN, sealedAt: null, version: { increment: 1 } },
          });
          packageVersion = pkg.version;
        }
        await tx.deliveryTask.updateMany({
          where: { orderId: task.orderId, taskType: DeliveryTaskType.HANDOVER, status: DeliveryTaskStatus.SCHEDULED },
          data: { status: DeliveryTaskStatus.BLOCKED, version: { increment: 1 } },
        });
        await tx.rentalOrder.update({
          where: { id: task.orderId },
          data: { status: RentalOrderStatus.PREPARING, version: { increment: 1 } },
        });
        const updatedTask = await tx.inventoryTask.update({
          where: { id: task.id },
          data: { status: InventoryTaskStatus.PICKING, completedAt: null, version: { increment: 1 } },
        });

        await writePreparationAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'WAREHOUSE_UNIT_REPLACED',
          entityType: 'RentalUnitAssignment',
          entityId: newAssignment.id,
          oldValues: { assignmentId: oldAssignment.id, unitId: command.oldUnitId, status: oldAssignment.status },
          newValues: { unitId: command.newUnitId, reason: command.reason, requiresNewEvidence: true },
          requestId: command.idempotencyKey,
        });
        return {
          oldUnitId: command.oldUnitId,
          newUnit: {
            id: newUnit.id,
            productId: newUnit.productId,
            assetCode: newUnit.assetCode,
            physicalStatus: newUnit.status,
            condition: newUnit.condition,
          },
          assignmentVersion: newAssignment.version,
          packageVersion,
          requiresNewEvidence: true,
          taskVersion: updatedTask.version,
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-308
  // ---------------------------------------------------------------------------
  async claimTask(command: ClaimPreparationTaskCommand): Promise<ClaimPreparationTaskResult> {
    return this.runIdempotentMutation(
      'RB-API-308:claim-task',
      command.actorUserId,
      command.idempotencyKey,
      { taskId: command.taskId, expectedVersion: command.expectedVersion },
      async (tx) => {
        const task = await lockInventoryTask(tx, command.taskId);
        assertExpectedVersion(task.version, command.expectedVersion);
        if (task.staffId && task.staffId !== command.actorUserId) throw AppError.fromCode(WH.TASK_ALREADY_ASSIGNED);
        if (![InventoryTaskStatus.OPEN, InventoryTaskStatus.PICKING, InventoryTaskStatus.CONDITION_CAPTURED].includes(task.status as any)) {
          throw AppError.fromCode(WH.INVALID_TASK_STATE);
        }
        const actor = await tx.user.findFirst({
          where: { id: command.actorUserId, role: UserRole.STAFF_INVENTORY, status: UserStatus.ACTIVE },
          select: { id: true, fullName: true },
        });
        if (!actor) throw AppError.fromCode('FORBIDDEN');

        const updated = await tx.inventoryTask.update({
          where: { id: task.id },
          data: { staffId: command.actorUserId, startedAt: task.startedAt ?? command.now, version: { increment: 1 } },
        });
        await writePreparationAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'WAREHOUSE_TASK_CLAIMED',
          entityType: 'InventoryTask',
          entityId: task.id,
          oldValues: { staffId: task.staffId, version: task.version },
          newValues: { staffId: command.actorUserId, version: updated.version },
          requestId: command.idempotencyKey,
        });
        return { taskId: updated.id, assignee: { id: actor.id, displayName: actor.fullName }, version: updated.version };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-309
  // ---------------------------------------------------------------------------
  async requestTransfer(command: RequestPreparationTransferCommand): Promise<RequestPreparationTransferResult> {
    return this.runIdempotentMutation(
      'RB-API-309:transfer-request',
      command.actorUserId,
      command.idempotencyKey,
      { taskId: command.taskId, packageId: command.packageId, toStaffId: command.toStaffId, expectedVersion: command.expectedVersion },
      async (tx) => {
        const task = await lockInventoryTask(tx, command.taskId);
        assertTaskClaimedByActor(task, command.actorUserId);
        assertExpectedVersion(task.version, command.expectedVersion);
        if (task.status !== InventoryTaskStatus.READY || task.packageId !== command.packageId) throw AppError.fromCode(WH.INVALID_TASK_STATE);

        const pkg = await tx.package.findUnique({ where: { id: command.packageId } });
        if (!pkg) throw AppError.fromCode(WH.PACKAGE_NOT_FOUND);
        if (pkg.orderId !== task.orderId || pkg.status !== PackageStatus.READY) throw AppError.fromCode(WH.PACKAGE_MISMATCH);

        const order = await lockRentalOrder(tx, task.orderId);
        if (order.status !== RentalOrderStatus.READY_FOR_HANDOVER) {
          throw AppError.fromCode(WH.INVALID_TASK_STATE, {
            details: { reason: 'ORDER_NOT_READY_FOR_HANDOVER', orderStatus: order.status },
          });
        }

        const target = await tx.user.findFirst({
          where: { id: command.toStaffId, role: UserRole.STAFF_DELIVERY, status: UserStatus.ACTIVE },
          select: { id: true },
        });
        if (!target) throw AppError.fromCode(WH.DELIVERY_STAFF_INVALID);

        const deliveryTask = await tx.deliveryTask.findUnique({
          where: { orderId_taskType: { orderId: task.orderId, taskType: DeliveryTaskType.HANDOVER } },
        });
        if (!deliveryTask || deliveryTask.packageId !== pkg.id || ![DeliveryTaskStatus.SCHEDULED, DeliveryTaskStatus.BLOCKED].includes(deliveryTask.status as any)) {
          throw AppError.fromCode(WH.CUSTODY_MISMATCH);
        }
        if (deliveryTask.staffId && deliveryTask.staffId !== command.toStaffId) throw AppError.fromCode(WH.TASK_ALREADY_ASSIGNED);

        const pending = await tx.custodyTransfer.findFirst({
          where: { packageId: pkg.id, status: CustodyTransferStatus.PENDING_RECEIPT },
          select: { id: true },
        });
        if (pending) throw AppError.fromCode(WH.CUSTODY_TRANSFER_ALREADY_PENDING, { details: { custodyTransferId: pending.id } });

        await tx.deliveryTask.update({
          where: { id: deliveryTask.id },
          data: { staffId: command.toStaffId, status: DeliveryTaskStatus.SCHEDULED, version: { increment: 1 } },
        });
        const transfer = await tx.custodyTransfer.create({
          data: {
            orderId: task.orderId,
            packageId: pkg.id,
            inventoryTaskId: task.id,
            deliveryTaskId: deliveryTask.id,
            fromInventoryLocationId: task.inventoryLocationId,
            fromStaffId: command.actorUserId,
            toStaffId: command.toStaffId,
            status: CustodyTransferStatus.PENDING_RECEIPT,
            requestedAt: command.now,
          },
        });
        const updatedTask = await tx.inventoryTask.update({ where: { id: task.id }, data: { version: { increment: 1 } } });
        await writePreparationAudit(tx, {
          actorUserId: command.actorUserId,
          action: 'WAREHOUSE_CUSTODY_TRANSFER_REQUESTED',
          entityType: 'CustodyTransfer',
          entityId: transfer.id,
          oldValues: { custody: 'INVENTORY', packageStatus: pkg.status },
          newValues: { status: transfer.status, toStaffId: command.toStaffId, custody: 'INVENTORY_UNTIL_RECEIPT' },
          requestId: command.idempotencyKey,
        });

        return {
          custodyTransferId: transfer.id,
          status: transfer.status,
          fromStaffId: transfer.fromStaffId,
          toStaffId: transfer.toStaffId,
          packageId: transfer.packageId,
          taskVersion: updatedTask.version,
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // RB-API-310
  // ---------------------------------------------------------------------------
  async listReplacementCandidates(query: ListReplacementCandidatesQuery): Promise<PaginatedPreparationCandidatesResult> {
    const task = await this.prisma.inventoryTask.findUnique({ where: { id: query.taskId } });
    if (!task) throw AppError.fromCode(WH.TASK_NOT_FOUND);
    assertTaskClaimedByActor(task, query.actorUserId);
    if (!REPLACEABLE_TASK_STATUSES.includes(task.status)) throw AppError.fromCode(WH.INVALID_TASK_STATE);

    const assignment = await this.prisma.rentalUnitAssignment.findFirst({
      where: { equipmentUnitId: query.oldUnitId, orderLine: { orderId: task.orderId }, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
      include: { orderLine: true },
    });
    if (!assignment) throw AppError.fromCode(WH.ASSIGNMENT_NOT_FOUND);

    return this.findCandidates({
      page: query.page,
      pageSize: query.pageSize,
      productId: assignment.orderLine.productId,
      inventoryLocationId: task.inventoryLocationId,
      excludeUnitId: query.oldUnitId,
    });
  }

  // ---------------------------------------------------------------------------
  // RB-API-311
  // ---------------------------------------------------------------------------
  async listPickCandidates(query: ListPickCandidatesQuery): Promise<PaginatedPreparationCandidatesResult> {
    const task = await this.prisma.inventoryTask.findUnique({
      where: { id: query.taskId },
      include: {
        order: {
          include: {
            rentalOrderLinesViaOrderId: {
              include: {
                rentalUnitAssignmentsViaOrderLineId: {
                  where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!task) throw AppError.fromCode(WH.TASK_NOT_FOUND);
    assertTaskClaimedByActor(task, query.actorUserId);
    if (!PICKABLE_TASK_STATUSES.includes(task.status)) throw AppError.fromCode(WH.TASK_NOT_PICKABLE);

    const remainingProductIds = task.order.rentalOrderLinesViaOrderId
      .filter((line) => line.quantity > line.rentalUnitAssignmentsViaOrderLineId.length)
      .map((line) => line.productId);
    if (query.productId && !remainingProductIds.includes(query.productId)) {
      return emptyCandidates(query.page, query.pageSize);
    }
    const productIds = query.productId ? [query.productId] : remainingProductIds;
    if (productIds.length === 0) return emptyCandidates(query.page, query.pageSize);

    return this.findCandidates({
      page: query.page,
      pageSize: query.pageSize,
      productIds,
      inventoryLocationId: task.inventoryLocationId,
      q: query.q,
    });
  }

  private async findCandidates(input: {
    page: number;
    pageSize: number;
    productId?: string;
    productIds?: string[];
    inventoryLocationId: string;
    excludeUnitId?: string;
    q?: string;
  }): Promise<PaginatedPreparationCandidatesResult> {
    const where: Prisma.EquipmentUnitWhereInput = {
      productId: input.productId ?? (input.productIds ? { in: input.productIds } : undefined),
      currentInventoryLocationId: input.inventoryLocationId,
      status: EquipmentUnitStatus.AVAILABLE,
      condition: { in: SAFE_PICK_CONDITIONS },
      id: input.excludeUnitId ? { not: input.excludeUnitId } : undefined,
      rentalUnitAssignmentsViaEquipmentUnitId: { none: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } } },
      OR: input.q
        ? [
            { assetCode: { contains: input.q, mode: 'insensitive' } },
            { serialNumber: { contains: input.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const skip = (input.page - 1) * input.pageSize;
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.equipmentUnit.findMany({
        where,
        skip,
        take: input.pageSize,
        orderBy: [{ productId: 'asc' }, { assetCode: 'asc' }],
        include: { currentInventoryLocation: { select: { id: true, name: true } } },
      }),
      this.prisma.equipmentUnit.count({ where }),
    ]);
    return {
      items: items.map(mapCandidateView),
      pagination: { page: input.page, pageSize: input.pageSize, totalItems, totalPages: Math.ceil(totalItems / input.pageSize) },
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
        const cached = await tx.idempotencyRecord.findUnique({
          where: { scope_userId_idempotencyKey: { scope, userId, idempotencyKey } },
        });
        if (cached) {
          if (cached.requestHash !== requestHash) throw AppError.fromCode(WH.IDEMPOTENCY_KEY_REUSED);
          if (cached.responseBody) return cached.responseBody as unknown as T;
          throw AppError.fromCode(WH.OPERATION_CONFLICT);
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.fromCode(WH.OPERATION_CONFLICT);
      }
      throw error;
    }
  }
}

// ============================================================================
// Query/mapping helpers
// ============================================================================

const taskDetailInclude = {
  staff: { select: { id: true, fullName: true } },
  inventoryLocation: { select: { id: true, name: true } },
  package: {
    include: {
      packageItemsViaPackageId: { include: { equipmentUnit: true } },
    },
  },
  order: {
    include: {
      pickupPoint: { select: { id: true, name: true } },
      rentalOrderLinesViaOrderId: {
        include: {
          product: { select: { id: true, name: true } },
          rentalUnitAssignmentsViaOrderLineId: {
            where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
            include: {
              equipmentUnit: true,
              conditionSnapshotsViaAssignmentId: {
                where: { snapshotStage: SnapshotStage.PRE_HANDOVER },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.InventoryTaskInclude;

type TaskDetailRow = Prisma.InventoryTaskGetPayload<{ include: typeof taskDetailInclude }>;

function mapTaskDetail(task: TaskDetailRow): PreparationTaskDetailResult {
  const requiredLines = task.order.rentalOrderLinesViaOrderId.map((line) => {
    const pickedQty = line.rentalUnitAssignmentsViaOrderLineId.length;
    return {
      orderLineId: line.id,
      productId: line.productId,
      productName: line.product.name,
      requiredQty: line.quantity,
      pickedQty,
      remainingQty: Math.max(0, line.quantity - pickedQty),
    };
  });
  const assignments = task.order.rentalOrderLinesViaOrderId.flatMap((line) => line.rentalUnitAssignmentsViaOrderLineId);
  const required = requiredLines.reduce((sum, line) => sum + line.requiredQty, 0);
  const picked = assignments.length;
  const evidenceComplete = assignments.filter((assignment) => assignment.conditionSnapshotsViaAssignmentId.length > 0).length;
  return {
    task: {
      id: task.id,
      orderId: task.orderId,
      status: task.status,
      assignee: task.staff ? { id: task.staff.id, displayName: task.staff.fullName } : null,
      deadline: task.deadline?.toISOString() ?? null,
      version: task.version,
    },
    requiredLines,
    pickedUnits: assignments.map((assignment) => mapUnitView(assignment.equipmentUnit)),
    progress: { required, picked, evidenceComplete },
    package: task.package ? mapPackageRow(task.package) : null,
    pickupContext: {
      pointId: task.order.pickupPoint.id,
      name: task.order.pickupPoint.name,
      scheduledAt: task.order.rentalStartAt.toISOString(),
    },
    version: task.version,
  };
}

type TaskPackageRow = NonNullable<TaskDetailRow['package']>;

function mapPackageRow(pkg: TaskPackageRow): PreparationPackageView {
  return {
    id: pkg.id,
    code: pkg.packageCode,
    orderId: pkg.orderId,
    status: pkg.status,
    unitIds: pkg.packageItemsViaPackageId.map((item) => item.equipmentUnitId),
    qrValue: `package:${pkg.packageCode}`,
    version: pkg.version,
  };
}

function mapUnitView(unit: { id: string; productId: string; assetCode: string; condition: unknown; status: unknown }): PreparationUnitView {
  return {
    unitId: unit.id,
    productId: unit.productId,
    assetCode: unit.assetCode,
    condition: String(unit.condition),
    physicalStatus: String(unit.status),
  };
}

function mapCandidateView(unit: {
  id: string;
  productId: string;
  assetCode: string;
  condition: unknown;
  status: unknown;
  expectedReadyAt: Date | null;
  version: number;
  currentInventoryLocation: { id: string; name: string } | null;
}): PreparationCandidateView {
  return {
    id: unit.id,
    productId: unit.productId,
    assetCode: unit.assetCode,
    condition: String(unit.condition),
    physicalStatus: String(unit.status),
    location: unit.currentInventoryLocation?.name ?? null,
    expectedReadyAt: unit.expectedReadyAt?.toISOString() ?? null,
    version: unit.version,
    custodian: unit.currentInventoryLocation
      ? { type: 'WAREHOUSE', id: unit.currentInventoryLocation.id, displayName: unit.currentInventoryLocation.name }
      : null,
  };
}

async function mapPackageWithItems(tx: Prisma.TransactionClient, packageId: string): Promise<PreparationPackageView> {
  const pkg = await tx.package.findUnique({
    where: { id: packageId },
    include: { packageItemsViaPackageId: { select: { equipmentUnitId: true } } },
  });
  if (!pkg) throw AppError.fromCode(WH.PACKAGE_NOT_FOUND);
  return {
    id: pkg.id,
    code: pkg.packageCode,
    orderId: pkg.orderId,
    status: pkg.status,
    unitIds: pkg.packageItemsViaPackageId.map((item) => item.equipmentUnitId),
    qrValue: `package:${pkg.packageCode}`,
    version: pkg.version,
  };
}

// ============================================================================
// Transaction/domain guards
// ============================================================================

async function lockInventoryTask(tx: Prisma.TransactionClient, taskId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM inventory_tasks WHERE id = ${taskId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw AppError.fromCode(WH.TASK_NOT_FOUND);
  const task = await tx.inventoryTask.findUnique({ where: { id: taskId } });
  if (!task) throw AppError.fromCode(WH.TASK_NOT_FOUND);
  return task;
}

async function lockRentalOrder(tx: Prisma.TransactionClient, orderId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM rental_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw AppError.fromCode(WH.TASK_NOT_FOUND);
  const order = await tx.rentalOrder.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.fromCode(WH.TASK_NOT_FOUND);
  return order;
}

async function lockEquipmentUnits(tx: Prisma.TransactionClient, unitIds: string[]) {
  const sortedIds = [...new Set(unitIds)].sort();
  for (const id of sortedIds) {
    await tx.$queryRaw`SELECT id FROM equipment_units WHERE id = ${id}::uuid FOR UPDATE`;
  }
}

async function lockEquipmentUnitByAssetCode(tx: Prisma.TransactionClient, assetCode: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM equipment_units WHERE UPPER(asset_code) = UPPER(${assetCode}) FOR UPDATE
  `;
  if (rows.length === 0) return null;
  return tx.equipmentUnit.findUnique({ where: { id: rows[0].id } });
}

async function lockTwoEquipmentUnits(tx: Prisma.TransactionClient, firstId: string, secondId: string) {
  const ids = [firstId, secondId].sort();
  for (const id of ids) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM equipment_units WHERE id = ${id}::uuid FOR UPDATE`;
    if (rows.length === 0) return [null, null] as const;
  }
  const units = await tx.equipmentUnit.findMany({ where: { id: { in: ids } } });
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  return [byId.get(firstId) ?? null, byId.get(secondId) ?? null] as const;
}

function assertTaskVisibleToActor(staffId: string | null, actorUserId: string) {
  if (staffId && staffId !== actorUserId) throw AppError.fromCode('FORBIDDEN');
}

function assertTaskClaimedByActor(task: { staffId: string | null }, actorUserId: string) {
  if (!task.staffId) throw AppError.fromCode(WH.TASK_NOT_CLAIMED);
  if (task.staffId !== actorUserId) throw AppError.fromCode('FORBIDDEN');
}

function assertExpectedVersion(actual: number, expected: number) {
  if (actual !== expected) throw AppError.fromCode(WH.VERSION_CONFLICT, { details: { expectedVersion: expected, actualVersion: actual } });
}

async function preparationCompleteness(tx: Prisma.TransactionClient, orderId: string) {
  const lines = await tx.rentalOrderLine.findMany({
    where: { orderId },
    include: {
      rentalUnitAssignmentsViaOrderLineId: {
        where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
        include: {
          conditionSnapshotsViaAssignmentId: {
            where: { snapshotStage: SnapshotStage.PRE_HANDOVER },
            select: { id: true },
          },
        },
      },
    },
  });
  const required = lines.reduce((sum, line) => sum + line.quantity, 0);
  const assignments = lines.flatMap((line) => line.rentalUnitAssignmentsViaOrderLineId);
  return {
    required,
    picked: assignments.length,
    evidenceComplete: assignments.filter((a) => a.conditionSnapshotsViaAssignmentId.length > 0).length,
  };
}

async function validatePackageReadiness(
  tx: Prisma.TransactionClient,
  orderId: string,
  requestedUnitIds?: string[],
  packageId?: string,
  step: 'PACK' | 'READY' = 'PACK',
): Promise<{
  complete: boolean;
  reason?: 'COUNT' | 'EVIDENCE' | 'UNSAFE' | 'STATUS_INVALID' | 'LOCATION_MISMATCH' | 'CONFLICT' | 'MISMATCH';
  details?: Record<string, unknown>;
  assignments: Array<{ id: string; equipmentUnitId: string }>;
}> {
  const primaryLocationId = await resolveActivePrimaryRentalLocation(tx);
  const lines = await tx.rentalOrderLine.findMany({
    where: { orderId },
    select: { id: true, quantity: true, productId: true },
  });
  const required = lines.reduce((sum, line) => sum + line.quantity, 0);

  const assignments = await tx.rentalUnitAssignment.findMany({
    where: { orderLine: { orderId }, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
    include: {
      equipmentUnit: true,
      conditionSnapshotsViaAssignmentId: {
        where: { snapshotStage: SnapshotStage.PRE_HANDOVER },
        select: { id: true, condition: true, evidenceIds: true, unitId: true, orderId: true },
      },
      packageItemViaAssignmentId: true,
      orderLine: { select: { id: true, productId: true, orderId: true } },
    },
  });

  if (assignments.length !== required) {
    return { complete: false, reason: 'COUNT', details: { required, picked: assignments.length }, assignments: [] };
  }

  if (requestedUnitIds) {
    const requested = [...requestedUnitIds].sort();
    const assigned = assignments.map((a) => a.equipmentUnitId).sort();
    if (requested.length !== assigned.length || requested.some((id, index) => id !== assigned[index])) {
      return { complete: false, reason: 'MISMATCH', details: { requestedUnitIds: requested, assignedUnitIds: assigned }, assignments: [] };
    }
  }

  if (packageId && assignments.some((a) => a.packageItemViaAssignmentId?.packageId !== packageId)) {
    return { complete: false, reason: 'MISMATCH', details: { packageId }, assignments: [] };
  }

  // Row lock all equipment units under transaction in deterministic order
  await lockEquipmentUnits(tx, assignments.map((a) => a.equipmentUnitId));

  const lockedUnits = await tx.equipmentUnit.findMany({
    where: { id: { in: assignments.map((a) => a.equipmentUnitId) } },
  });
  const unitMap = new Map(lockedUnits.map((u) => [u.id, u]));

  for (const a of assignments) {
    const unit = unitMap.get(a.equipmentUnitId);
    if (!unit) {
      return { complete: false, reason: 'MISMATCH', details: { unitId: a.equipmentUnitId, reason: 'UNIT_NOT_FOUND' }, assignments: [] };
    }

    // 1. Exact unit assigned to right product/order line
    if (unit.productId !== a.orderLine.productId) {
      return { complete: false, reason: 'MISMATCH', details: { unitId: unit.id, unitProduct: unit.productId, lineProduct: a.orderLine.productId }, assignments: [] };
    }

    // 2. Condition must still be safe (NEW, GOOD, FAIR)
    if (!SAFE_PICK_CONDITIONS.includes(unit.condition)) {
      return { complete: false, reason: 'UNSAFE', details: { unitId: unit.id, condition: unit.condition }, assignments: [] };
    }

    // 3. Current inventory location must match primary warehouse
    if (unit.currentInventoryLocationId !== primaryLocationId) {
      return {
        complete: false,
        reason: 'LOCATION_MISMATCH',
        details: { unitId: unit.id, currentLocationId: unit.currentInventoryLocationId, expectedLocationId: primaryLocationId },
        assignments: [],
      };
    }

    // 4. Physical status must match step:
    //    For PACK: unit must be PICKED (or PACKED if re-packing existing package)
    //    For READY: unit must be PACKED
    if (step === 'PACK') {
      const validPackStatuses: EquipmentUnitStatus[] = [EquipmentUnitStatus.PICKED, EquipmentUnitStatus.PACKED];
      if (!validPackStatuses.includes(unit.status)) {
        return {
          complete: false,
          reason: 'STATUS_INVALID',
          details: { unitId: unit.id, physicalStatus: unit.status, expectedStatuses: [EquipmentUnitStatus.PICKED, EquipmentUnitStatus.PACKED] },
          assignments: [],
        };
      }
    } else {
      if (unit.status !== EquipmentUnitStatus.PACKED) {
        return {
          complete: false,
          reason: 'STATUS_INVALID',
          details: { unitId: unit.id, physicalStatus: unit.status, expectedStatus: EquipmentUnitStatus.PACKED },
          assignments: [],
        };
      }
      if (a.status !== RentalUnitAssignmentStatus.PACKED) {
        return {
          complete: false,
          reason: 'STATUS_INVALID',
          details: { assignmentId: a.id, assignmentStatus: a.status, expectedStatus: RentalUnitAssignmentStatus.PACKED },
          assignments: [],
        };
      }
    }

    // 5. No maintenance, damage, lost, or conflicting assignments
    const conflictingAssignment = await tx.rentalUnitAssignment.findFirst({
      where: {
        equipmentUnitId: unit.id,
        id: { not: a.id },
        status: { in: ACTIVE_ASSIGNMENT_STATUSES },
      },
      select: { id: true, orderLineId: true },
    });
    if (conflictingAssignment) {
      return {
        complete: false,
        reason: 'CONFLICT',
        details: { unitId: unit.id, conflictingAssignmentId: conflictingAssignment.id },
        assignments: [],
      };
    }

    // 6. Pre-handover condition snapshot valid and attached to correct assignment
    if (a.conditionSnapshotsViaAssignmentId.length !== 1) {
      return {
        complete: false,
        reason: 'EVIDENCE',
        details: { unitId: unit.id, assignmentId: a.id, snapshotCount: a.conditionSnapshotsViaAssignmentId.length },
        assignments: [],
      };
    }
    const snapshot = a.conditionSnapshotsViaAssignmentId[0];
    if (snapshot.unitId !== unit.id || snapshot.orderId !== orderId) {
      return { complete: false, reason: 'MISMATCH', details: { snapshotId: snapshot.id, reason: 'SNAPSHOT_UNIT_OR_ORDER_MISMATCH' }, assignments: [] };
    }
    if (!SAFE_PICK_CONDITIONS.includes(snapshot.condition)) {
      return { complete: false, reason: 'UNSAFE', details: { snapshotId: snapshot.id, condition: snapshot.condition }, assignments: [] };
    }
    const evidenceIds = Array.isArray(snapshot.evidenceIds) ? (snapshot.evidenceIds as string[]) : [];
    if (evidenceIds.length === 0) {
      return { complete: false, reason: 'EVIDENCE', details: { snapshotId: snapshot.id, reason: 'EVIDENCE_EMPTY' }, assignments: [] };
    }
  }

  return { complete: true, assignments: assignments.map((a) => ({ id: a.id, equipmentUnitId: a.equipmentUnitId })) };
}

function warehouseAllowedActions(status: InventoryTaskStatus, staffId: string | null, actorUserId: string): string[] {
  if (!staffId) return status === InventoryTaskStatus.OPEN ? ['CLAIM'] : [];
  if (staffId !== actorUserId) return [];
  switch (status) {
    case InventoryTaskStatus.OPEN:
    case InventoryTaskStatus.PICKING:
    case InventoryTaskStatus.CONDITION_CAPTURED:
      return ['PICK', 'SAVE_CONDITION', 'PACK', 'REPLACE_UNIT'];
    case InventoryTaskStatus.PACKED:
      return ['READY', 'REPLACE_UNIT'];
    case InventoryTaskStatus.READY:
      return ['REQUEST_TRANSFER', 'REPLACE_UNIT'];
    default:
      return [];
  }
}

async function writePreparationAudit(tx: Prisma.TransactionClient, input: {
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

function emptyCandidates(page: number, pageSize: number): PaginatedPreparationCandidatesResult {
  return { items: [], pagination: { page, pageSize, totalItems: 0, totalPages: 0 } };
}

function packageCode(orderId: string): string {
  return `PK-TG-${orderId.replace(/-/g, '').toUpperCase()}`;
}

function rentalOrderCode(orderId: string): string {
  return `RNT-${orderId.replace(/-/g, '').slice(0, 16).toUpperCase()}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortJson(v)]));
  }
  return value;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function vietnamBusinessDayUtcWindow(date: string): { start: Date; end: Date } {
  // Business timezone is Asia/Ho_Chi_Minh (+07:00, no DST).
  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
