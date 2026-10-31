import { assertPrimaryRentalLocation } from '../../../shared/primary-inventory-location'
import { createHash, randomUUID } from 'crypto'
import { inspectionDeadlines } from '../../application/return-policy-152'
import { Injectable, Logger } from '@nestjs/common'
import {
  CustodyActorType,
  CustodyEventType,
  CustodyTransferStatus,
  DamageDeductionType,
  DepositItemStatus,
  DepositSettlementOutcome,
  DepositSettlementStatus,
  DeliveryTaskStatus,
  DeliveryTaskType,
  EquipmentCondition,
  EquipmentUnitStatus,
  EventStatus,
  InspectionStage,
  MediaScope,
  MediaStatus,
  PackageStatus,
  PaymentStatus,
  Prisma,
  RefundPurpose,
  RefundStatus,
  RentalDocumentRenderStatus,
  RentalDocumentType,
  RentalExceptionCaseStatus,
  RentalExceptionType,
  RentalFinancialStatus,
  RentalOrderExceptionStatus,
  RentalOrderStatus,
  RentalReturnSessionStatus,
  RentalUnitAssignmentStatus,
  ReturnInspectionOutcome,
  SnapshotStage,
  UserRole,
  UserStatus,
} from '@prisma/client'
import { issueReturnReceiptTx } from '../../../documents/application/rental-document-events'
import { PrismaService } from 'src/shared/services/prisma.service'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_RETURN_ERROR_CODES as RR } from 'src/shared/errors/codes/rental-return.error-codes'
import { RENTAL_DOCUMENT_ERROR_CODES as RD } from 'src/shared/errors/codes/rental-document.error-codes'
import { assertGradeDecision } from '../../../inventory/application/services/equipment-grade.rules'
import { applyGradeDecision } from '../../../inventory/infrastructure/equipment-grade-transfer'
import type {
  CreateAssessmentReviewCommand,
  CreateDepositSettlementCommand,
  FinalInspectionCommand,
  FinalizeReturnCommand,
  FinalizeReturnReceiptCommand,
  GetAssessmentQuery,
  GetDepositQuery,
  GetExceptionQuery,
  GetRentalDocumentQuery,
  GetReturnQuery,
  ListExceptionsQuery,
  ListRentalDocumentsQuery,
  ListReturnsQuery,
  MarkUnitReadyCommand,
  ReceiveReturnCommand,
  RentalRefundEventCommand,
  RentalReturnPort,
  ResolveExceptionCommand,
  ReturnInspectionCommand,
  ReturnScanCommand,
  ReturnToInventoryLocationCommand,
} from '../../application/ports/rental-return.port'

const DELIVERY_CUSTODY_DISCREPANCY = 'DELIVERY_CUSTODY_DISCREPANCY'
const DELIVERY_TRANSFER_OMISSION = `${DELIVERY_CUSTODY_DISCREPANCY}:TRANSFER_OMISSION`
const DELIVERY_RECEIPT_SHORTAGE = `${DELIVERY_CUSTODY_DISCREPANCY}:WAREHOUSE_RECEIPT_SHORTAGE`

@Injectable()
export class PrismaRentalReturnAdapter implements RentalReturnPort {
  private readonly logger = new Logger(PrismaRentalReturnAdapter.name)

  constructor(private readonly prisma: PrismaService) {}

  // RB-API-601 ---------------------------------------------------------------
  async returnScan(command: ReturnScanCommand) {
    return this.runIdempotentMutation(
      'RB-API-601:return-scan',
      command.actorUserId,
      command.idempotencyKey,
      {
        orderId: command.orderId,
        assetCodes: [...command.assetCodes].sort(),
        operationId: command.operationId,
        expectedVersion: command.expectedVersion,
      },
      async (tx) => {
        const actor = await requireActiveRole(tx, command.actorUserId, UserRole.STAFF_DELIVERY)
        await lockOrder(tx, command.orderId)
        const order = await tx.rentalOrder.findUnique({
          where: { id: command.orderId },
          include: {
            packageViaOrderId: true,
            rentalHandoverViaOrderId: true,
            rentalOrderLinesViaOrderId: {
              include: {
                rentalUnitAssignmentsViaOrderLineId: {
                  where: {
                    status: { in: [RentalUnitAssignmentStatus.HANDED_OVER, RentalUnitAssignmentStatus.RETURNED] },
                  },
                  include: { equipmentUnit: true },
                },
              },
            },
          },
        })
        if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
        if (!order.rentalHandoverViaOrderId) throw AppError.fromCode(RR.RETURN_NOT_READY)
        if (
          ![RentalOrderStatus.ACTIVE, RentalOrderStatus.RETURN_PENDING, RentalOrderStatus.RETURN_PROCESSING].includes(
            order.status as any,
          )
        ) {
          throw AppError.fromCode(RR.INVALID_RENTAL_STATE)
        }
        assertExpectedVersion(order.version, command.expectedVersion)

        const task = await tx.deliveryTask.findUnique({
          where: { orderId_taskType: { orderId: order.id, taskType: DeliveryTaskType.RETURN } },
        })
        if (!task) throw AppError.fromCode(RR.RETURN_TASK_NOT_FOUND)
        if (task.staffId !== actor.id) throw AppError.fromCode(RR.FORBIDDEN)
        // A return scan is a one-way custody transition. Once Delivery has
        // returned the units or Inventory has received them, reopening the
        // scanner would create a duplicate-only session and regress the task.
        if (
          ![DeliveryTaskStatus.SCHEDULED, DeliveryTaskStatus.COLLECTING].includes(
            task.status as any,
          )
        ) {
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            details: { taskId: task.id, currentStatus: task.status },
          })
        }

        const assignments = order.rentalOrderLinesViaOrderId.flatMap((line) => line.rentalUnitAssignmentsViaOrderLineId)
        const byCode = new Map(assignments.map((assignment) => [assignment.equipmentUnit.assetCode, assignment]))
        const uniqueCodes = [...new Set(command.assetCodes)]
        const duplicates = command.assetCodes.filter((code, index) => command.assetCodes.indexOf(code) !== index)
        const receivedUnits: Array<Record<string, unknown>> = []

        for (const assetCode of uniqueCodes) {
          const assignment = byCode.get(assetCode)
          if (!assignment) throw AppError.fromCode(RR.UNIT_NOT_IN_RENTAL, { details: { assetCode } })
          await lockUnit(tx, assignment.equipmentUnitId)
          const current = await tx.rentalUnitAssignment.findUnique({ where: { id: assignment.id } })
          if (!current) throw AppError.fromCode(RR.UNIT_NOT_IN_RENTAL)
          if (current.status === RentalUnitAssignmentStatus.RETURNED || current.returnedAt) {
            duplicates.push(assetCode)
            receivedUnits.push({
              unitId: assignment.equipmentUnitId,
              assetCode,
              receivedAt: current.returnedAt?.toISOString() ?? null,
              duplicate: true,
            })
            continue
          }
          if (current.status !== RentalUnitAssignmentStatus.HANDED_OVER)
            throw AppError.fromCode(RR.INVALID_RETURN_STATE)

          const updatedAssignment = await tx.rentalUnitAssignment.update({
            where: { id: current.id },
            data: { status: RentalUnitAssignmentStatus.RETURNED, returnedAt: command.now, version: { increment: 1 } },
          })
          await tx.equipmentUnit.update({
            where: { id: assignment.equipmentUnitId },
            data: { status: EquipmentUnitStatus.RETURN_PENDING, version: { increment: 1 } },
          })
          await tx.custodyEvent.create({
            data: {
              idempotencyKey: `return-scan:${command.operationId}:${assignment.equipmentUnitId}`,
              orderId: order.id,
              packageId: order.packageViaOrderId?.id,
              unitId: assignment.equipmentUnitId,
              deliveryTaskId: task.id,
              eventType: CustodyEventType.USER_TO_DELIVERY,
              fromActorType: CustodyActorType.USER,
              fromUserId: order.userId,
              toActorType: CustodyActorType.DELIVERY_STAFF,
              toUserId: actor.id,
              orderStatusBefore: order.status,
              orderStatusAfter: RentalOrderStatus.RETURN_PROCESSING,
              unitStatusBefore: assignment.equipmentUnit.status,
              unitStatusAfter: EquipmentUnitStatus.RETURN_PENDING,
              deliveryStatusBefore: task.status,
              deliveryStatusAfter: DeliveryTaskStatus.COLLECTING,
              performedBy: actor.id,
              occurredAt: command.now,
            },
          })
          receivedUnits.push({
            unitId: assignment.equipmentUnitId,
            assetCode,
            receivedAt: updatedAssignment.returnedAt?.toISOString() ?? command.now.toISOString(),
            duplicate: false,
          })
        }

        const updatedTask = await tx.deliveryTask.update({
          where: { id: task.id },
          data: { status: DeliveryTaskStatus.COLLECTING, version: { increment: 1 } },
        })
        const updatedOrder = await tx.rentalOrder.update({
          where: { id: order.id },
          data: {
            status: RentalOrderStatus.RETURN_PROCESSING,
            exceptionStatus: order.exceptionStatus,
            version: { increment: 1 },
          },
        })
        if (order.packageViaOrderId && order.packageViaOrderId.status !== PackageStatus.RETURNING) {
          await tx.package.update({
            where: { id: order.packageViaOrderId.id },
            data: { status: PackageStatus.RETURNING, version: { increment: 1 } },
          })
        }

        const missingUnits = assignments
          .filter((assignment) => !assignment.returnedAt && !uniqueCodes.includes(assignment.equipmentUnit.assetCode))
          .map((assignment) => ({ unitId: assignment.equipmentUnitId, assetCode: assignment.equipmentUnit.assetCode }))

        await writeAudit(
          tx,
          command.actorUserId,
          'RENTAL_RETURN_SCANNED',
          'RentalOrder',
          order.id,
          { status: order.status, version: order.version },
          {
            status: updatedOrder.status,
            version: updatedOrder.version,
            receivedUnitIds: receivedUnits.map((item) => item.unitId),
            missingUnits,
            operationId: command.operationId,
          },
          command.idempotencyKey,
        )

        const session = await tx.rentalReturnSession.upsert({
          where: { operationId: command.operationId },
          update: {}, // idempotent via operationId, plus enclosing mutation deduplication
          create: {
            orderId: order.id,
            operationId: command.operationId,
            staffId: actor.id,
            receivedUnits: jsonValue(receivedUnits),
          },
        })
        return {
          returnId: task.id,
          returnSessionId: session.id,
          receivedUnits,
          missingUnits,
          duplicates: [...new Set(duplicates)],
          version: updatedOrder.version,
          taskVersion: updatedTask.version,
        }
      },
    )
  }

  // RB-API-602 ---------------------------------------------------------------
  async returnInspection(command: ReturnInspectionCommand) {
    return this.runIdempotentMutation(
      'RB-API-602:return-inspection',
      command.actorUserId,
      command.idempotencyKey,
      { orderId: command.orderId, items: command.items, expectedVersion: command.expectedVersion },
      async (tx) => {
        const actor = await requireActiveRole(tx, command.actorUserId, UserRole.STAFF_DELIVERY)
        await lockOrder(tx, command.orderId)
        const order = await getReturnOrder(tx, command.orderId)
        if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
        assertExpectedVersion(order.version, command.expectedVersion)
        if (order.status !== RentalOrderStatus.RETURN_PROCESSING) throw AppError.fromCode(RR.INVALID_RENTAL_STATE)
        const task = order.deliveryTasksViaOrderId.find((item: any) => item.taskType === DeliveryTaskType.RETURN)
        if (!task) throw AppError.fromCode(RR.RETURN_TASK_NOT_FOUND)
        if (task.staffId !== actor.id) throw AppError.fromCode(RR.FORBIDDEN)
        // Observation is only valid while Delivery still holds the units. Re-running it after
        // Inventory received them would reset FINAL deposit decisions back to REVIEW_REQUIRED.
        if (![DeliveryTaskStatus.COLLECTING, DeliveryTaskStatus.RETURNED].includes(task.status as any))
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            details: { taskId: task.id, currentStatus: task.status },
          })

        const assignmentByUnit = new Map<string, any>()
        for (const line of order.rentalOrderLinesViaOrderId) {
          for (const assignment of line.rentalUnitAssignmentsViaOrderLineId)
            assignmentByUnit.set(assignment.equipmentUnitId, { ...assignment, orderLine: line })
        }
        // Delivery cannot approve deposits or trigger a refund (SOT 1.5.2).
        const discrepancies: Array<Record<string, unknown>> = []
        const inspectionItems: Array<Record<string, unknown>> = []

        for (const item of command.items) {
          const assignment = assignmentByUnit.get(item.unitId)
          if (!assignment) throw AppError.fromCode(RR.UNIT_NOT_IN_RENTAL, { details: { unitId: item.unitId } })
          if (assignment.status !== RentalUnitAssignmentStatus.RETURNED || !assignment.returnedAt)
            throw AppError.fromCode(RR.UNIT_NOT_RETURNED, { details: { unitId: item.unitId } })
          // A partial warehouse receipt keeps the task RETURNED; units already at Inventory are out of Delivery scope.
          if (await hasInventoryLocationReceipt(tx, order.id, item.unitId))
            throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
              details: { unitId: item.unitId, reason: 'UNIT_ALREADY_RECEIVED_BY_INVENTORY' },
            })
          await validateEvidence(tx, actor.id, item.evidenceIds, [
            MediaScope.RETURN_EVIDENCE,
            MediaScope.CONDITION_EVIDENCE,
            MediaScope.EXCEPTION_EVIDENCE,
          ])
          const baseline = await tx.conditionSnapshot.findUnique({
            where: {
              assignmentId_snapshotStage: { assignmentId: assignment.id, snapshotStage: SnapshotStage.PRE_HANDOVER },
            },
          })
          if (!baseline) throw AppError.fromCode(RR.CONDITION_BASELINE_MISSING, { details: { unitId: item.unitId } })

          const nextPreliminaryOutcome =
            item.outcome === 'OBSERVED_RECEIVED' ? ReturnInspectionOutcome.NORMAL : ReturnInspectionOutcome.ISSUE
          const inspection = await tx.returnInspection.upsert({
            where: { assignmentId_stage: { assignmentId: assignment.id, stage: InspectionStage.PRELIMINARY } },
            update: {
              inspectorId: actor.id,
              outcome: nextPreliminaryOutcome,
              receivedAt: assignment.returnedAt,
              notes: item.notes ?? null,
              evidenceIds: jsonValue(item.evidenceIds),
              version: { increment: 1 },
            },
            create: {
              orderId: order.id,
              assignmentId: assignment.id,
              unitId: item.unitId,
              inspectorId: actor.id,
              stage: InspectionStage.PRELIMINARY,
              outcome: nextPreliminaryOutcome,
              receivedAt: assignment.returnedAt,
              notes: item.notes ?? null,
              evidenceIds: jsonValue(item.evidenceIds),
            },
          })
          await tx.rentalExceptionCase.updateMany({
            where: {
              assignmentId: assignment.id,
              caseType: RentalExceptionType.RETURN_INCOMPLETE,
              status: { in: [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW] },
            },
            data: {
              status: RentalExceptionCaseStatus.RESOLVED,
              resolution: 'LATE_RETURN_RECEIVED',
              resolvedAt: command.now,
              version: { increment: 1 },
            },
          })
          // No guessed GOOD condition: observation request does not require a physical assessment.
          if (item.condition)
            await tx.conditionSnapshot.upsert({
              where: {
                assignmentId_snapshotStage: {
                  assignmentId: assignment.id,
                  snapshotStage: SnapshotStage.RETURN_PRELIMINARY,
                },
              },
              update: {},
              create: {
                orderId: order.id,
                assignmentId: assignment.id,
                unitId: item.unitId,
                packageId: order.packageViaOrderId?.id,
                snapshotStage: SnapshotStage.RETURN_PRELIMINARY,
                condition: item.condition,
                notes: item.notes ?? null,
                accessories: jsonValue({ observations: item.accessoryIssues, observationOnly: true }),
                evidenceIds: jsonValue(item.evidenceIds),
                takenBy: actor.id,
              },
            })

          const depositItem = await tx.depositSettlementItem.findUnique({
            where: { assignmentId: assignment.id },
            include: { settlement: true },
          })
          if (!depositItem) throw AppError.fromCode(RR.DEPOSIT_ITEM_NOT_FOUND, { details: { unitId: item.unitId } })

          const deepRequired = Boolean(assignment.orderLine.product.requiresDeepReturnInspection)
          const observedIssue = item.outcome === 'OBSERVED_ISSUE' || item.accessoryIssues.length > 0
          await tx.depositSettlementItem.update({
            where: { id: depositItem.id },
            data: {
              status: DepositItemStatus.REVIEW_REQUIRED,
              inspectionId: inspection.id,
              reason: observedIssue ? 'DELIVERY_OBSERVED_ISSUE_AWAITING_INVENTORY_FINAL' : 'AWAITING_INVENTORY_FINAL',
              version: { increment: 1 },
            },
          })
          if (observedIssue) discrepancies.push({ unitId: item.unitId, reason: 'OBSERVED_ISSUE_NOT_FINAL' })
          else if (deepRequired)
            discrepancies.push({ unitId: item.unitId, reason: 'DEEP_CHECKLIST_REQUIRED_AT_INVENTORY' })
          // Do NOT open a damage/deduction case merely because a product requires deep inspection.
          // STAFF_INVENTORY alone records FINAL and assesses any new damage.
          inspectionItems.push({
            inspectionId: inspection.id,
            unitId: item.unitId,
            outcome: item.outcome,
            baselineCondition: baseline.condition,
            returnCondition: item.condition ?? null,
          })
        }

        // Any handed-over assignment still not scanned becomes MISSING_PENDING_REVIEW.
        const missingAssignments = [...assignmentByUnit.values()].filter(
          (assignment) => assignment.status === RentalUnitAssignmentStatus.HANDED_OVER && !assignment.returnedAt,
        )
        for (const assignment of missingAssignments) {
          const missingInspection = await tx.returnInspection.upsert({
            where: { assignmentId_stage: { assignmentId: assignment.id, stage: InspectionStage.PRELIMINARY } },
            update: {},
            create: {
              orderId: order.id,
              assignmentId: assignment.id,
              unitId: assignment.equipmentUnitId,
              inspectorId: actor.id,
              stage: InspectionStage.PRELIMINARY,
              outcome: ReturnInspectionOutcome.MISSING_PENDING_REVIEW,
              notes: 'Unit not received in current return session',
            },
          })
          await tx.depositSettlementItem.updateMany({
            where: { assignmentId: assignment.id, status: { not: DepositItemStatus.SETTLED } },
            data: {
              status: DepositItemStatus.REVIEW_REQUIRED,
              inspectionId: missingInspection.id,
              reason: 'MISSING_PENDING_REVIEW',
              version: { increment: 1 },
            },
          })
          await ensureReviewCase(tx, {
            orderId: order.id,
            assignmentId: assignment.id,
            unitId: assignment.equipmentUnitId,
            inspectionId: missingInspection.id,
            caseType: RentalExceptionType.RETURN_INCOMPLETE,
            openedBy: actor.id,
            reason: 'MISSING_PENDING_REVIEW',
            evidenceIds: [],
            dueAt: policyDueAt(order.rentalPolicy.lostConfirmationMinutes, command.now),
          })
          discrepancies.push({ unitId: assignment.equipmentUnitId, reason: 'MISSING_PENDING_REVIEW' })
        }

        const activeCaseCount = await tx.rentalExceptionCase.count({
          where: {
            orderId: order.id,
            status: { in: [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW] },
          },
        })
        const nextExceptionStatus =
          missingAssignments.length > 0
            ? RentalOrderExceptionStatus.RETURN_INCOMPLETE
            : activeCaseCount > 0 || discrepancies.length > 0
              ? RentalOrderExceptionStatus.ACTION_REQUIRED
              : RentalOrderExceptionStatus.NONE
        const updatedOrder = await tx.rentalOrder.update({
          where: { id: order.id },
          data: {
            exceptionStatus: nextExceptionStatus,
            financialStatus: order.financialStatus,
            version: { increment: 1 },
          },
        })
        await tx.deliveryTask.update({
          where: { id: task.id },
          data: { status: DeliveryTaskStatus.RETURNED, returnedAt: command.now, version: { increment: 1 } },
        })
        await refreshSettlementAggregate(tx, order.id, command.now)
        await writeAudit(
          tx,
          actor.id,
          'RENTAL_RETURN_INSPECTED',
          'RentalOrder',
          order.id,
          { version: order.version },
          { version: updatedOrder.version, discrepancies, refundCreated: false },
          command.idempotencyKey,
        )
        const openSession = await tx.rentalReturnSession.findFirst({
          where: { orderId: order.id, staffId: actor.id, status: RentalReturnSessionStatus.OPEN },
          orderBy: { createdAt: 'desc' },
        })
        if (openSession) {
          const currentReceived = Array.isArray(openSession.receivedUnits) ? (openSession.receivedUnits as any[]) : []
          const updatedUnits = currentReceived.map((u) => {
            const insp = inspectionItems.find((it: any) => it.unitId === (typeof u === 'string' ? u : u.unitId))
            if (!insp) return u
            const existingObj = typeof u === 'string' ? { unitId: u } : { ...u }
            return {
              ...existingObj,
              preliminaryOutcome: (insp as any).outcome,
              baselineCondition: (insp as any).baselineCondition,
              preliminaryCondition: (insp as any).returnCondition,
            }
          })
          await tx.rentalReturnSession.update({
            where: { id: openSession.id },
            data: { receivedUnits: jsonValue(updatedUnits), version: { increment: 1 } },
          })
        }
        const activeSession =
          openSession ??
          (await tx.rentalReturnSession.findFirst({
            where: { orderId: order.id, staffId: actor.id },
            orderBy: { createdAt: 'desc' },
          }))
        return {
          returnSessionId: activeSession?.id ?? null,
          observations: inspectionItems.map((i) => ({ ...i, observationOnly: true })),
          requiresInventoryInspection: true,
          refundEligible: false,
          discrepancies,
        }
      },
    )
  }

  // RB-API-603 ---------------------------------------------------------------
  async returnToInventoryLocation(command: ReturnToInventoryLocationCommand) {
    return this.runIdempotentMutation(
      'RB-API-603:return-to-inventory-location',
      command.actorUserId,
      command.idempotencyKey,
      {
        taskId: command.deliveryTaskId,
        unitIds: [...command.unitIds].sort(),
        missingInCustodyUnitIds: [...command.missingInCustodyUnitIds].sort(),
        incidentNote: command.incidentNote ?? null,
        packageId: command.packageId ?? null,
        pendingTransferId: command.pendingTransferId ?? null,
        expectedVersion: command.expectedVersion,
      },
      async (tx) => {
        const actor = await requireActiveRole(tx, command.actorUserId, UserRole.STAFF_DELIVERY)
        const task = await lockDeliveryTask(tx, command.deliveryTaskId)
        if (!task || task.taskType !== DeliveryTaskType.RETURN) throw AppError.fromCode(RR.RETURN_TASK_NOT_FOUND)
        if (task.staffId !== actor.id) throw AppError.fromCode(RR.FORBIDDEN)
        assertExpectedVersion(task.version, command.expectedVersion)
        if (![DeliveryTaskStatus.COLLECTING, DeliveryTaskStatus.RETURNED].includes(task.status as any))
          throw AppError.fromCode(RR.INVALID_RETURN_STATE)
        if (command.packageId && command.packageId !== task.packageId) throw AppError.fromCode(RR.CUSTODY_MISMATCH)

        const order = await getReturnOrder(tx, task.orderId)
        if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
        const assignments = order.rentalOrderLinesViaOrderId.flatMap(
          (line: any) => line.rentalUnitAssignmentsViaOrderLineId,
        )
        const assignmentByUnit = new Map(assignments.map((item: any) => [item.equipmentUnitId, item]))
        const unitIds = [...new Set(command.unitIds)]
        const explicitlyMissing = [...new Set(command.missingInCustodyUnitIds)]
        const overlap = explicitlyMissing.filter((unitId) => unitIds.includes(unitId))
        if (overlap.length)
          throw AppError.fromCode(RR.CUSTODY_MISMATCH, {
            details: { reason: 'UNIT_CANNOT_BE_TRANSFERRED_AND_MISSING', unitIds: overlap },
          })
        for (const unitId of [...unitIds, ...explicitlyMissing]) {
          const assignment: any = assignmentByUnit.get(unitId)
          if (!assignment || assignment.status !== RentalUnitAssignmentStatus.RETURNED)
            throw AppError.fromCode(RR.UNIT_NOT_RETURNED, { details: { unitId } })
          const inspection = await tx.returnInspection.findUnique({
            where: { assignmentId_stage: { assignmentId: assignment.id, stage: InspectionStage.PRELIMINARY } },
          })
          if (!inspection)
            throw AppError.fromCode(RR.RETURN_NOT_READY, {
              details: { unitId, reason: 'PRELIMINARY_INSPECTION_REQUIRED' },
            })
        }
        const returnedUnitIds = assignments
          .filter((assignment: any) => assignment.status === RentalUnitAssignmentStatus.RETURNED)
          .map((assignment: any) => assignment.equipmentUnitId)
        const declared = new Set([...unitIds, ...explicitlyMissing])
        const implicitlyMissing = returnedUnitIds.filter((unitId: string) => !declared.has(unitId))
        const custodyMissingUnitIds = [...new Set([...explicitlyMissing, ...implicitlyMissing])]
        if (custodyMissingUnitIds.length && !command.incidentNote)
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            details: { reason: 'CUSTODY_DISCREPANCY_NOTE_REQUIRED', unitIds: custodyMissingUnitIds },
          })
        const custodyCases: Array<Record<string, unknown>> = []
        for (const unitId of custodyMissingUnitIds) {
          const assignment: any = assignmentByUnit.get(unitId)
          custodyCases.push(
            await openDeliveryCustodyDiscrepancy(tx, {
              orderId: order.id,
              assignment,
              openedBy: actor.id,
              reasonCode: DELIVERY_TRANSFER_OMISSION,
              incidentNote: command.incidentNote!,
            }),
          )
        }
        if (custodyCases.length) {
          await tx.rentalOrder.update({
            where: { id: order.id },
            data: { exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED, version: { increment: 1 } },
          })
        }
        const inventoryTask = order.inventoryTaskViaOrderId
        if (!inventoryTask)
          throw AppError.fromCode(RR.CUSTODY_MISMATCH, { details: { reason: 'INVENTORY_TASK_MISSING' } })
        // New transfers in MVP are only destined for the configured primary.
        assertPrimaryRentalLocation(inventoryTask.inventoryLocationId)

        const transferWatchHours = order.rentalPolicy.returnToInventoryAllowanceHours
        if (!transferWatchHours || transferWatchHours <= 0)
          throw AppError.fromCode(RR.POLICY_CONFIG_REQUIRED, { details: { field: 'returnToInventoryAllowanceHours' } })
        const existing = await tx.returnCustodyTransfer.findFirst({
          where: { deliveryTaskId: task.id, status: CustodyTransferStatus.PENDING_RECEIPT },
        })
        if (existing) {
          if (command.pendingTransferId && command.pendingTransferId !== existing.id)
            throw AppError.fromCode(RR.OPERATION_CONFLICT)
          const expected = stringArray(existing.unitIds)
          if (stableJson(expected.sort()) !== stableJson(unitIds.sort()))
            throw AppError.fromCode(RR.OPERATION_CONFLICT, {
              details: { reason: 'PENDING_TRANSFER_HAS_DIFFERENT_UNITS' },
            })
          return {
            pendingTransferId: existing.id,
            unitIds: expected,
            status: existing.status,
            transferStartedAt: existing.transferStartedAt?.toISOString() ?? existing.requestedAt.toISOString(),
            transferWatchAt: existing.transferWatchAt?.toISOString() ?? null,
            monitoringStatus: existing.monitoringStatus,
          }
        }
        if (command.pendingTransferId) throw AppError.fromCode(RR.CUSTODY_TRANSFER_NOT_FOUND)
        if (!unitIds.length) {
          await writeAudit(
            tx,
            actor.id,
            'RETURN_CUSTODY_DISCREPANCY_REPORTED',
            'DeliveryTask',
            task.id,
            undefined,
            { orderId: order.id, missingUnitIds: custodyMissingUnitIds, incidentNote: command.incidentNote },
            command.idempotencyKey,
          )
          return {
            pendingTransferId: null,
            unitIds: [],
            missingInCustodyUnitIds: custodyMissingUnitIds,
            custodyCases,
            status: 'ACTION_REQUIRED',
            transferStartedAt: null,
            transferWatchAt: null,
            monitoringStatus: 'INCIDENT_REPORTED',
          }
        }
        const transfer = await tx.returnCustodyTransfer.create({
          data: {
            orderId: order.id,
            deliveryTaskId: task.id,
            inventoryLocationId: inventoryTask.inventoryLocationId,
            fromStaffId: actor.id,
            unitIds: jsonValue(unitIds),
            receivedUnitIds: jsonValue([]),
            status: CustodyTransferStatus.PENDING_RECEIPT,
            requestedAt: command.now,
            transferStartedAt: command.now,
            transferWatchAt: new Date(command.now.getTime() + transferWatchHours * 3600_000),
            monitoringStatus: 'ON_TIME',
          },
        })
        await writeAudit(
          tx,
          actor.id,
          'RETURN_CUSTODY_TRANSFER_REQUESTED',
          'ReturnCustodyTransfer',
          transfer.id,
          undefined,
          { orderId: order.id, unitIds, inventoryLocationId: inventoryTask.inventoryLocationId },
          command.idempotencyKey,
        )
        return {
          pendingTransferId: transfer.id,
          unitIds,
          status: transfer.status,
          transferStartedAt: transfer.transferStartedAt?.toISOString() ?? null,
          transferWatchAt: transfer.transferWatchAt?.toISOString() ?? null,
          monitoringStatus: transfer.monitoringStatus,
          missingInCustodyUnitIds: custodyMissingUnitIds,
          custodyCases,
        }
      },
    )
  }

  // RB-API-604 ---------------------------------------------------------------
  async receiveReturn(command: ReceiveReturnCommand) {
    return this.runIdempotentMutation(
      'RB-API-604:warehouse-receive-return',
      command.actorUserId,
      command.idempotencyKey,
      {
        returnId: command.returnId,
        transferId: command.pendingTransferId,
        inventoryLocationId: command.inventoryLocationId,
        scannedUnitIds: [...command.scannedUnitIds].sort(),
        incidentNote: command.incidentNote ?? null,
        expectedVersion: command.expectedVersion,
      },
      async (tx) => {
        const actor = await requireActiveRole(tx, command.actorUserId, UserRole.STAFF_INVENTORY)
        const task = await lockDeliveryTask(tx, command.returnId)
        if (!task || task.taskType !== DeliveryTaskType.RETURN) throw AppError.fromCode(RR.RETURN_TASK_NOT_FOUND)
        assertExpectedVersion(task.version, command.expectedVersion)
        const transfer = await tx.returnCustodyTransfer.findUnique({ where: { id: command.pendingTransferId } })
        if (!transfer || transfer.deliveryTaskId !== task.id || transfer.orderId !== task.orderId)
          throw AppError.fromCode(RR.CUSTODY_TRANSFER_NOT_FOUND)
        // Do not acknowledge custody at an arbitrary InventoryLocation supplied by the client.
        if (transfer.inventoryLocationId !== command.inventoryLocationId)
          throw AppError.fromCode(RR.CUSTODY_MISMATCH, { details: { reason: 'INVENTORY_LOCATION_MISMATCH' } })
        if (transfer.status !== CustodyTransferStatus.PENDING_RECEIPT) throw AppError.fromCode(RR.INVALID_RETURN_STATE)

        const expected = new Set(stringArray(transfer.unitIds))
        const previouslyReceived = new Set(stringArray(transfer.receivedUnitIds))
        const scanned = [...new Set(command.scannedUnitIds)]
        const unknown = scanned.filter((id) => !expected.has(id))
        if (unknown.length) throw AppError.fromCode(RR.CUSTODY_MISMATCH, { details: { unknownUnitIds: unknown } })
        const order = await getReturnOrder(tx, task.orderId)
        if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
        const discrepancies: Array<Record<string, unknown>> = []

        for (const unitId of scanned) {
          if (previouslyReceived.has(unitId)) continue
          await lockUnit(tx, unitId)
          const unit = await tx.equipmentUnit.findUnique({ where: { id: unitId }, include: { product: true } })
          if (!unit) throw AppError.fromCode(RR.UNIT_NOT_FOUND)
          const assignment = order.rentalOrderLinesViaOrderId
            .flatMap((line: any) => line.rentalUnitAssignmentsViaOrderLineId)
            .find((item: any) => item.equipmentUnitId === unitId)
          if (!assignment || assignment.status !== RentalUnitAssignmentStatus.RETURNED)
            throw AppError.fromCode(RR.UNIT_NOT_RETURNED)
          const prelim = await tx.returnInspection.findUnique({
            where: { assignmentId_stage: { assignmentId: assignment.id, stage: InspectionStage.PRELIMINARY } },
          })
          if (!prelim)
            throw AppError.fromCode(RR.RETURN_NOT_READY, {
              details: { unitId, reason: 'PRELIMINARY_INSPECTION_REQUIRED' },
            })
          const depositItem = await tx.depositSettlementItem.findUnique({ where: { assignmentId: assignment.id } })
          const needsReview = true // FINAL mandatory for all received units; not ready before inspection + cleaning.
          const nextStatus = needsReview ? EquipmentUnitStatus.MAINTENANCE : EquipmentUnitStatus.CLEANING
          await tx.equipmentUnit.update({
            where: { id: unit.id },
            data: {
              status: nextStatus,
              currentInventoryLocationId: transfer.inventoryLocationId,
              version: { increment: 1 },
            },
          })
          await tx.custodyEvent.create({
            data: {
              idempotencyKey: `return-warehouse-receive:${transfer.id}:${unit.id}`,
              orderId: order.id,
              packageId: task.packageId,
              unitId: unit.id,
              deliveryTaskId: task.id,
              eventType: CustodyEventType.DELIVERY_TO_INVENTORY,
              fromActorType: CustodyActorType.DELIVERY_STAFF,
              fromUserId: transfer.fromStaffId,
              toActorType: CustodyActorType.INVENTORY_LOCATION,
              toInventoryLocationId: transfer.inventoryLocationId,
              unitStatusBefore: unit.status,
              unitStatusAfter: nextStatus,
              deliveryStatusBefore: task.status,
              deliveryStatusAfter: task.status,
              performedBy: actor.id,
              occurredAt: command.now,
            },
          })
          const finalHours = order.rentalPolicy.returnInspectionSlaHours
          const deepHours = order.rentalPolicy.deepInspectionSlaHours
          if (!finalHours || !deepHours)
            throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
              details: { reason: 'SOT_152_POLICY_INSPECTION_SLA_UNCONFIGURED' },
            })
          const deepRequired =
            unit.product.requiresDeepReturnInspection || prelim.outcome !== ReturnInspectionOutcome.NORMAL
          const deadlines = inspectionDeadlines(command.now, deepRequired, finalHours, deepHours)
          await tx.returnInspectionTask.upsert({
            where: { assignmentId: assignment.id },
            update: {},
            create: {
              orderId: order.id,
              assignmentId: assignment.id,
              unitId,
              inventoryLocationId: transfer.inventoryLocationId,
              receivedAt: command.now,
              inspectionDueAt: deadlines.inspectionDueAt,
              deepInspectionDueAt: deadlines.deepInspectionDueAt,
              status: 'PENDING',
            },
          })
          if (prelim.outcome === ReturnInspectionOutcome.NORMAL && needsReview)
            discrepancies.push({ unitId, reason: 'POLICY_OR_INVENTORY_REVIEW_REQUIRED' })
          previouslyReceived.add(unitId)
        }

        const missing = [...expected].filter((id) => !previouslyReceived.has(id))
        if (missing.length && !command.incidentNote)
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            details: { reason: 'CUSTODY_DISCREPANCY_NOTE_REQUIRED', unitIds: missing },
          })
        const assignmentByUnit = new Map(
          order.rentalOrderLinesViaOrderId
            .flatMap((line: any) => line.rentalUnitAssignmentsViaOrderLineId)
            .map((assignment: any) => [assignment.equipmentUnitId, assignment]),
        )
        for (const unitId of missing) {
          const assignment: any = assignmentByUnit.get(unitId)
          const exceptionCase = await openDeliveryCustodyDiscrepancy(tx, {
            orderId: order.id,
            assignment,
            openedBy: actor.id,
            reasonCode: DELIVERY_RECEIPT_SHORTAGE,
            incidentNote: command.incidentNote!,
          })
          discrepancies.push({
            unitId,
            reason: 'DELIVERY_CUSTODY_DISCREPANCY',
            exceptionId: exceptionCase.id,
            customerLiability: false,
          })
        }
        if (missing.length) {
          await tx.rentalOrder.update({
            where: { id: order.id },
            data: { exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED, version: { increment: 1 } },
          })
        }
        const complete = missing.length === 0
        const updatedTransfer = await tx.returnCustodyTransfer.update({
          where: { id: transfer.id },
          data: {
            receivedUnitIds: jsonValue([...previouslyReceived]),
            status: complete ? CustodyTransferStatus.RECEIVED : CustodyTransferStatus.PENDING_RECEIPT,
            receivedAt: complete ? command.now : null,
            version: { increment: 1 },
          },
        })
        const updatedTask = complete
          ? await tx.deliveryTask.update({
              where: { id: task.id },
              data: {
                status: DeliveryTaskStatus.INVENTORY_RECEIVED,
                inventoryReceivedAt: command.now,
                version: { increment: 1 },
              },
            })
          : task
        if (complete) {
          const allReturnedAssignments = order.rentalOrderLinesViaOrderId
            .flatMap((line: any) => line.rentalUnitAssignmentsViaOrderLineId)
            .filter((item: any) => item.status === RentalUnitAssignmentStatus.RETURNED)
          const allAtPreparation = await allUnitsHaveInventoryLocationReceipt(
            tx,
            order.id,
            allReturnedAssignments.map((item: any) => item.equipmentUnitId),
          )
          if (allAtPreparation && order.packageViaOrderId) {
            await tx.package.update({
              where: { id: order.packageViaOrderId.id },
              data: { status: PackageStatus.RETURNED_TO_INVENTORY, version: { increment: 1 } },
            })
          }
        }
        await writeAudit(
          tx,
          actor.id,
          'RETURN_RECEIVED_BY_INVENTORY',
          'ReturnCustodyTransfer',
          transfer.id,
          { receivedUnitIds: stringArray(transfer.receivedUnitIds) },
          { receivedUnitIds: [...previouslyReceived], missingUnitIds: missing, status: updatedTransfer.status },
          command.idempotencyKey,
        )
        const inspectionRows = await tx.returnInspectionTask.findMany({
          where: { orderId: order.id, unitId: { in: [...previouslyReceived] } },
          select: {
            id: true,
            unitId: true,
            receivedAt: true,
            inspectionDueAt: true,
            deepInspectionDueAt: true,
            status: true,
          },
        })
        return {
          return: { id: task.id, orderId: task.orderId, status: updatedTask.status, version: updatedTask.version },
          receivedUnits: inspectionRows.map((t) => ({
            unitId: t.unitId,
            receivedAt: t.receivedAt.toISOString(),
            inspectionDueAt: t.inspectionDueAt.toISOString(),
            deepInspectionDueAt: t.deepInspectionDueAt?.toISOString() ?? null,
            inspectionTaskId: t.id,
            inspectionStatus: t.status,
          })),
          missingUnits: missing,
          discrepancies,
        }
      },
    )
  }

  // RB-API-605 ---------------------------------------------------------------
  async finalInspection(command: FinalInspectionCommand) {
    return this.runIdempotentMutation(
      'RB-API-605:final-inspection',
      command.actorUserId,
      command.idempotencyKey,
      { returnId: command.returnId, items: command.items, expectedVersion: command.expectedVersion },
      async (tx) => {
        const actor = await requireActiveRole(tx, command.actorUserId, UserRole.STAFF_INVENTORY)
        const task = await lockDeliveryTask(tx, command.returnId)
        if (!task || task.taskType !== DeliveryTaskType.RETURN) throw AppError.fromCode(RR.RETURN_TASK_NOT_FOUND)
        assertExpectedVersion(task.version, command.expectedVersion)
        if (![DeliveryTaskStatus.RETURNED, DeliveryTaskStatus.INVENTORY_RECEIVED].includes(task.status as any))
          throw AppError.fromCode(RR.INVALID_RETURN_STATE)
        const order = await getReturnOrder(tx, task.orderId)
        if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
        const assignments = order.rentalOrderLinesViaOrderId.flatMap((line: any) =>
          line.rentalUnitAssignmentsViaOrderLineId.map((assignment: any) => ({ ...assignment, orderLine: line })),
        )
        const assessments: Array<Record<string, unknown>> = []
        const proposedDeductions: Array<Record<string, unknown>> = []

        for (const item of command.items) {
          const assignment = assignments.find((entry: any) => entry.equipmentUnitId === item.issueUnitId)
          if (!assignment) throw AppError.fromCode(RR.UNIT_NOT_IN_RENTAL, { details: { unitId: item.issueUnitId } })
          const atPreparation = await hasInventoryLocationReceipt(tx, order.id, item.issueUnitId)
          if (!atPreparation)
            throw AppError.fromCode(RR.CUSTODY_MISMATCH, {
              details: { unitId: item.issueUnitId, reason: 'UNIT_NOT_RECEIVED_BY_INVENTORY' },
            })
          const depositItem = await tx.depositSettlementItem.findUnique({ where: { assignmentId: assignment.id } })
          if (!depositItem) throw AppError.fromCode(RR.DEPOSIT_ITEM_NOT_FOUND)
          const prelim = await tx.returnInspection.findUnique({
            where: { assignmentId_stage: { assignmentId: assignment.id, stage: InspectionStage.PRELIMINARY } },
          })
          if (!prelim) throw AppError.fromCode(RR.ASSESSMENT_NOT_FOUND)
          const deepRequired =
            assignment.orderLine.product.requiresDeepReturnInspection ||
            prelim.outcome !== ReturnInspectionOutcome.NORMAL
          // SOT 1.5.2: normal items MUST also receive FINAL. Deep checklist is required only when flagged.
          const inspectionTask = await tx.returnInspectionTask.findUnique({ where: { assignmentId: assignment.id } })
          if (!inspectionTask || inspectionTask.status === 'COMPLETED')
            throw AppError.fromCode(RR.INVALID_RETURN_STATE, { details: { reason: 'INSPECTION_TASK_NOT_PENDING' } })
          // A missed SLA triggers escalation but does not falsify a PASS or auto-refund.

          if (item.condition === 'LOST')
            throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
              details: { reason: 'PHYSICALLY_RECEIVED_UNIT_CANNOT_BE_LOST' },
            })
          await validateEvidence(tx, actor.id, item.evidenceIds, [
            MediaScope.RETURN_EVIDENCE,
            MediaScope.EXCEPTION_EVIDENCE,
            MediaScope.CONDITION_EVIDENCE,
          ])
          for (const damage of item.damage)
            await validateEvidence(tx, actor.id, damage.evidenceIds ?? [], [
              MediaScope.RETURN_EVIDENCE,
              MediaScope.EXCEPTION_EVIDENCE,
            ])
          const baseline = await tx.conditionSnapshot.findUnique({
            where: {
              assignmentId_snapshotStage: { assignmentId: assignment.id, snapshotStage: SnapshotStage.PRE_HANDOVER },
            },
          })
          if (!baseline) throw AppError.fromCode(RR.CONDITION_BASELINE_MISSING)

          if (item.outcome === 'PASS' && (item.condition === 'DAMAGED' || item.damage.length > 0))
            throw AppError.fromCode(RR.INVALID_RETURN_STATE, { details: { reason: 'PASS_CONFLICTS_WITH_DAMAGE' } })
          if (deepRequired && !item.evidenceIds.length) {
            throw AppError.fromCode(RR.EVIDENCE_NOT_READY, { details: { reason: 'DEEP_INSPECTION_EVIDENCE_REQUIRED' } })
          }
          const finalOutcome =
            item.damage.length > 0
              ? ReturnInspectionOutcome.DAMAGE_CONFIRMED
              : item.outcome === 'ISSUE' || item.condition === 'DAMAGED'
                ? ReturnInspectionOutcome.ISSUE
                : ReturnInspectionOutcome.NORMAL
          const existingFinal = await tx.returnInspection.findUnique({
            where: { assignmentId_stage: { assignmentId: assignment.id, stage: InspectionStage.FINAL } },
          })
          if (existingFinal)
            throw AppError.fromCode(RR.OPERATION_CONFLICT, {
              details: { unitId: item.issueUnitId, reason: 'FINAL_INSPECTION_IMMUTABLE' },
            })
          const finalInspection = await tx.returnInspection.create({
            data: {
              orderId: order.id,
              assignmentId: assignment.id,
              unitId: assignment.equipmentUnitId,
              inspectorId: actor.id,
              stage: InspectionStage.FINAL,
              outcome: finalOutcome,
              receivedAt: inspectionTask.receivedAt,
              notes: item.notes ?? null,
              evidenceIds: jsonValue(item.evidenceIds),
            },
          })
          await tx.conditionSnapshot.upsert({
            where: {
              assignmentId_snapshotStage: { assignmentId: assignment.id, snapshotStage: SnapshotStage.RETURN_FINAL },
            },
            update: {},
            create: {
              orderId: order.id,
              assignmentId: assignment.id,
              unitId: assignment.equipmentUnitId,
              packageId: order.packageViaOrderId?.id,
              snapshotStage: SnapshotStage.RETURN_FINAL,
              condition: item.condition,
              notes: item.notes ?? null,
              evidenceIds: jsonValue(item.evidenceIds),
              takenBy: actor.id,
            },
          })

          let proposed = new Prisma.Decimal(0)
          let requiresApproval = false
          const findingResults: Array<Record<string, unknown>> = []
          for (const damage of item.damage) {
            const rule = await tx.damageAssessmentRule.findFirst({
              where: {
                id: damage.ruleId,
                productId: assignment.orderLine.productId,
                isActive: true,
                effectiveFrom: { lte: command.now },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: command.now } }],
              },
            })
            if (!rule)
              throw AppError.fromCode(RR.ASSESSMENT_NOT_FOUND, {
                details: { ruleId: damage.ruleId, unitId: item.issueUnitId },
              })
            const assessed = calculateRuleDeduction(
              rule,
              assignment.orderLine,
              depositItem.depositAmount,
              damage.quantity ?? 1,
            )
            proposed = proposed.add(assessed)
            requiresApproval ||= rule.requiresApproval
            await tx.returnInspectionFinding.upsert({
              where: { inspectionId_ruleId: { inspectionId: finalInspection.id, ruleId: rule.id } },
              update: {},
              create: {
                inspectionId: finalInspection.id,
                ruleId: rule.id,
                quantity: damage.quantity ?? 1,
                assessedAmount: assessed,
                notes: damage.notes ?? null,
                evidenceIds: jsonValue(damage.evidenceIds ?? []),
                ruleSnapshot: jsonValue({
                  ruleCode: rule.ruleCode,
                  name: rule.name,
                  severity: rule.severity,
                  deductionType: rule.deductionType,
                  deductionValue: rule.deductionValue.toString(),
                  requiresApproval: rule.requiresApproval,
                  versionNo: rule.versionNo,
                }),
              },
            })
            findingResults.push({
              ruleId: rule.id,
              assessedAmount: decimalToInteger(assessed),
              quantity: damage.quantity ?? 1,
            })
          }
          const capped = Prisma.Decimal.min(proposed, depositItem.depositAmount)
          const excess = Prisma.Decimal.max(proposed.sub(depositItem.depositAmount), new Prisma.Decimal(0))
          await tx.depositSettlementItem.update({
            where: { id: depositItem.id },
            data: {
              inspectionId: finalInspection.id,
              status: DepositItemStatus.REVIEW_REQUIRED, // fail-closed until grouped Shared Payment allocation is committed
              reason:
                finalOutcome === ReturnInspectionOutcome.NORMAL && proposed.equals(0)
                  ? 'FINAL_PASS_AWAIT_GROUPED_REFUND'
                  : 'DEDUCTION_REVIEW_REQUIRED',
              refundAmount:
                finalOutcome === ReturnInspectionOutcome.NORMAL && proposed.equals(0)
                  ? depositItem.depositAmount
                  : new Prisma.Decimal(0),
              deductionAmount: new Prisma.Decimal(0),
              approvedAt: finalOutcome === ReturnInspectionOutcome.NORMAL && proposed.equals(0) ? command.now : null,
              approvedBy: finalOutcome === ReturnInspectionOutcome.NORMAL && proposed.equals(0) ? actor.id : null,
              decisionSnapshot: jsonValue({
                proposedDeduction: proposed.toString(),
                cappedDeduction: capped.toString(),
                excessDamageAmount: excess.toString(),
                requiresApproval,
                baselineCondition: baseline.condition,
                finalCondition: item.condition,
                refundDecision: 'INVENTORY_FINAL_PASS',
                unitId: item.issueUnitId,
                inventoryReceivedAt: inspectionTask.receivedAt.toISOString(),
                inspectionAt: command.now.toISOString(),
                slaBreached: command.now > inspectionTask.inspectionDueAt,
              }),
              version: { increment: 1 },
            },
          })

          let exceptionCase: any = null
          if (proposed.greaterThan(0) || finalOutcome !== ReturnInspectionOutcome.NORMAL) {
            exceptionCase = await ensureReviewCase(tx, {
              orderId: order.id,
              assignmentId: assignment.id,
              unitId: assignment.equipmentUnitId,
              inspectionId: finalInspection.id,
              caseType: RentalExceptionType.DAMAGE_DISPUTE,
              openedBy: actor.id,
              reason: excess.greaterThan(0)
                ? 'DAMAGE_EXCEEDS_DEPOSIT_MANUAL_CASE'
                : proposed.greaterThan(0)
                  ? 'DEDUCTION_APPROVAL_REQUIRED'
                  : 'ASSESSMENT_REQUIRED_FOR_FINAL_ISSUE',
              evidenceIds: item.evidenceIds,
              dueAt: policyDueAt(order.rentalPolicy.adminApprovalMinutes, command.now),
            })
            if (exceptionCase && proposed.greaterThan(0) && item.evidenceIds.length > 0) {
              // Evidence has been checked against READY Media records above.
              const approvalHours = order.rentalPolicy.adminApprovalMinutes
              if (!approvalHours || approvalHours <= 0)
                throw AppError.fromCode(RR.POLICY_CONFIG_REQUIRED, { details: { field: 'adminApprovalMinutes' } })
              await tx.rentalExceptionCase.update({
                where: { id: exceptionCase.id },
                data: {
                  evidenceCompleteAt: command.now,
                  adminReviewStatus: 'PENDING',
                  adminApprovalDueAt: new Date(command.now.getTime() + approvalHours * 60_000),
                },
              })
            }
          } else {
            // Normal pass: resolve any deep inspection exception cases
            await tx.rentalExceptionCase.updateMany({
              where: {
                assignmentId: assignment.id,
                status: { in: [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW] },
              },
              data: {
                status: RentalExceptionCaseStatus.RESOLVED,
                resolution: 'DEEP_INSPECTION_CLEARED',
                resolvedAt: command.now,
                version: { increment: 1 },
              },
            })
          }

          // A pass enters CLEANING, never AVAILABLE. Damage remains physically blocked.
          await tx.equipmentUnit.update({
            where: { id: assignment.equipmentUnitId },
            data: {
              status:
                finalOutcome === ReturnInspectionOutcome.NORMAL
                  ? EquipmentUnitStatus.CLEANING
                  : EquipmentUnitStatus.MAINTENANCE,
              version: { increment: 1 },
            },
          })
          await tx.returnInspectionTask.update({
            where: { assignmentId: assignment.id },
            data: { status: 'COMPLETED', completedAt: command.now },
          })
          if (
            command.now > inspectionTask.inspectionDueAt ||
            (deepRequired && inspectionTask.deepInspectionDueAt && command.now > inspectionTask.deepInspectionDueAt)
          ) {
            await writeAudit(
              tx,
              actor.id,
              'RETURN_INSPECTION_SLA_BREACHED',
              'EquipmentUnit',
              item.issueUnitId,
              undefined,
              {
                inspectionDueAt: inspectionTask.inspectionDueAt.toISOString(),
                deepInspectionDueAt: inspectionTask.deepInspectionDueAt?.toISOString() ?? null,
              },
              command.idempotencyKey,
            )
          }
          assessments.push({
            inspectionId: finalInspection.id,
            unitId: item.issueUnitId,
            outcome: finalInspection.outcome,
            findings: findingResults,
            exceptionCaseId: exceptionCase?.id ?? null,
            version: finalInspection.version,
          })
          proposedDeductions.push({
            unitId: item.issueUnitId,
            proposedAmount: decimalToInteger(proposed),
            deductionCap: decimalToInteger(capped),
            excessAmount: decimalToInteger(excess),
            requiresApproval,
          })
        }
        // Evaluate order-level inspection completeness for clean grouped refund dispatch
        const finalInspections = await tx.returnInspection.findMany({
          where: { orderId: order.id, stage: InspectionStage.FINAL },
          select: { assignmentId: true },
        })
        const missingPrelims = await tx.returnInspection.findMany({
          where: {
            orderId: order.id,
            stage: InspectionStage.PRELIMINARY,
            outcome: ReturnInspectionOutcome.MISSING_PENDING_REVIEW,
          },
          select: { assignmentId: true },
        })
        const completedAssignmentIds = new Set([
          ...finalInspections.map((f) => f.assignmentId),
          ...missingPrelims.map((m) => m.assignmentId),
        ])
        const orderInspectionComplete = assignments.every((a: any) => completedAssignmentIds.has(a.id))

        if (orderInspectionComplete) {
          const passItemsToRelease = await tx.depositSettlementItem.findMany({
            where: {
              settlement: { orderId: order.id },
              status: DepositItemStatus.REVIEW_REQUIRED,
              reason: 'FINAL_PASS_AWAIT_GROUPED_REFUND',
            },
          })
          for (const pi of passItemsToRelease) {
            await tx.depositSettlementItem.update({
              where: { id: pi.id },
              data: {
                status: DepositItemStatus.REFUND_PENDING,
                approvedAt: command.now,
                reason: 'INVENTORY_FINAL_PASS',
                version: { increment: 1 },
              },
            })
            await tx.rentalOutboxEvent.upsert({
              where: { deduplicationKey: `deposit-refund-approved:${pi.id}` },
              update: {},
              create: {
                deduplicationKey: `deposit-refund-approved:${pi.id}`,
                eventType: 'RENTAL_DEPOSIT_REFUND_APPROVED',
                aggregateType: 'RentalOrder',
                aggregateId: order.id,
                payload: jsonValue({
                  orderId: order.id,
                  depositSettlementItemId: pi.id,
                  approvedAmount: pi.depositAmount.toFixed(),
                  requestedBy: actor.id,
                  requestedAt: command.now.toISOString(),
                  operation: 'final-pass',
                }),
              },
            })
          }
        }

        await refreshSettlementAggregate(tx, order.id, command.now)
        await writeAudit(
          tx,
          actor.id,
          'RETURN_FINAL_INSPECTION_RECORDED',
          'DeliveryTask',
          task.id,
          undefined,
          { assessments, proposedDeductions },
          command.idempotencyKey,
        )
        return {
          assessments,
          finalInspections: assessments.map((a) => ({
            ...a,
            finalStatus: a.outcome === ReturnInspectionOutcome.NORMAL ? 'PASS' : 'ISSUE',
          })),
          eligibleDepositItems: assessments
            .filter((a) => a.outcome === ReturnInspectionOutcome.NORMAL)
            .map((a) => a.unitId),
          issues: assessments.filter((a) => a.outcome !== ReturnInspectionOutcome.NORMAL),
          proposedDeductions,
        }
      },
    )
  }

  // RB-API-606 ---------------------------------------------------------------
  async createDepositSettlement(command: CreateDepositSettlementCommand) {
    return this.runIdempotentMutation(
      'RB-API-606:deposit-settlement',
      command.actorUserId,
      command.idempotencyKey,
      { orderId: command.orderId, assessmentId: command.assessmentId, approvalRef: command.approvalRef },
      async (tx) => {
        await requireActiveRole(tx, command.actorUserId, UserRole.ADMIN)
        await lockOrder(tx, command.orderId)
        const order = await tx.rentalOrder.findUnique({
          where: { id: command.orderId },
          include: { depositSettlementViaOrderId: true, rentalPolicy: true },
        })
        if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
        const assessment = await tx.returnInspection.findFirst({
          where: { id: command.assessmentId, orderId: order.id, stage: InspectionStage.FINAL },
        })
        if (!assessment) throw AppError.fromCode(RR.ASSESSMENT_NOT_FOUND)
        const item = await tx.depositSettlementItem.findFirst({
          where: { settlement: { orderId: order.id }, inspectionId: assessment.id },
        })
        if (!item) throw AppError.fromCode(RR.DEPOSIT_ITEM_NOT_FOUND)
        const exceptionCase = await tx.rentalExceptionCase.findFirst({
          where: {
            inspectionId: assessment.id,
            approvalRef: command.approvalRef,
            status: RentalExceptionCaseStatus.RESOLVED,
          },
          orderBy: { resolvedAt: 'desc' },
        })
        if (!exceptionCase) throw AppError.fromCode(RR.ASSESSMENT_NOT_APPROVED)
        // Already dispatched (by an earlier call or by the deposit worker): replay the current
        // result. Rewriting the item here would push a SETTLED item back to REFUND_PENDING.
        if (
          [DepositItemStatus.REFUND_PENDING, DepositItemStatus.REFUND_FAILED, DepositItemStatus.SETTLED].includes(
            item.status as any,
          )
        ) {
          const [settlement, refund, allocation] = await Promise.all([
            tx.depositSettlement.findUnique({ where: { orderId: order.id } }),
            tx.refund.findUnique({ where: { depositSettlementItemId: item.id }, select: { id: true } }),
            tx.depositRefundItemAllocation.findUnique({
              where: { depositSettlementItemId: item.id },
              select: { refundId: true },
            }),
          ])
          return {
            settlement: settlement
              ? {
                  id: settlement.id,
                  status: settlement.status,
                  outcome: settlement.outcome,
                  totalDeposit: decimalToInteger(settlement.totalDeposit),
                  deductionAmount: decimalToInteger(settlement.totalDeduction),
                  refundedAmount: decimalToInteger(settlement.refundAmount),
                  version: settlement.version,
                }
              : null,
            refundRef: refund?.id ?? allocation?.refundId ?? null,
            deductionAmount: decimalToInteger(item.deductionAmount),
            refundAmount: decimalToInteger(item.refundAmount),
            status: item.status,
          }
        }
        const decision = jsonObject(item.decisionSnapshot)
        if (decimalFromUnknown(decision.approvedDeduction ?? '0').greaterThan(0)) {
          const windowMinutes = order.rentalPolicy.userAssessmentReviewMinutes
          if (
            !exceptionCase.evidenceAccessibleAt ||
            !windowMinutes ||
            command.now.getTime() < exceptionCase.evidenceAccessibleAt.getTime() + windowMinutes * 60_000
          )
            throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
              details: { reason: 'USER_48H_REVIEW_WINDOW_NOT_CLOSED' },
            })
          const dispute = await tx.rentalAssessmentReview.findFirst({ where: { inspectionId: assessment.id } })
          if (dispute)
            throw AppError.fromCode(RR.INVALID_RETURN_STATE, { details: { reason: 'USER_DISPUTE_MUST_BE_RESOLVED' } })
        }
        const approvedDeduction = decimalFromUnknown(decision.approvedDeduction ?? decision.cappedDeduction ?? '0')
        if (approvedDeduction.greaterThan(item.depositAmount)) throw AppError.fromCode(RR.DEDUCTION_EXCEEDS_DEPOSIT)
        const refundAmount = item.depositAmount.sub(approvedDeduction)

        let refundRef: string | null = null
        let status: string = DepositItemStatus.SETTLED
        if (refundAmount.greaterThan(0)) {
          const refund = await ensureDepositRefund(
            tx,
            order,
            { ...item, deductionAmount: approvedDeduction, refundAmount },
            assessment.id,
            command.actorUserId,
            command.now,
            `settlement:${item.id}:${command.approvalRef}`,
            refundAmount,
          )
          refundRef = refund.id
          status = DepositItemStatus.REFUND_PENDING
          await tx.depositSettlementItem.update({
            where: { id: item.id },
            data: {
              deductionAmount: approvedDeduction,
              refundAmount,
              status: DepositItemStatus.REFUND_PENDING,
              approvedBy: command.actorUserId,
              approvedAt: command.now,
              version: { increment: 1 },
            },
          })
        } else {
          await tx.depositSettlementItem.update({
            where: { id: item.id },
            data: {
              deductionAmount: approvedDeduction,
              refundAmount: 0,
              status: DepositItemStatus.SETTLED,
              outcome: DepositSettlementOutcome.FULL_DEDUCTION,
              approvedBy: command.actorUserId,
              approvedAt: command.now,
              settledAt: command.now,
              version: { increment: 1 },
            },
          })
        }
        const aggregate = await refreshSettlementAggregate(tx, order.id, command.now)
        await tryCompleteOrder(tx, order.id, command.now)
        await writeAudit(
          tx,
          command.actorUserId,
          'DEPOSIT_SETTLEMENT_CREATED',
          'ReturnInspection',
          assessment.id,
          undefined,
          { approvedDeduction: approvedDeduction.toString(), refundAmount: refundAmount.toString(), refundRef, status },
          command.idempotencyKey,
        )
        return {
          settlement: aggregate,
          refundRef,
          deductionAmount: decimalToInteger(approvedDeduction),
          refundAmount: decimalToInteger(refundAmount),
          status,
        }
      },
    )
  }

  // RB-API-607 ---------------------------------------------------------------
  async getDeposit(query: GetDepositQuery) {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { id: query.orderId },
      include: {
        depositSettlementViaOrderId: {
          include: {
            depositSettlementItemsViaSettlementId: {
              include: {
                unit: { select: { id: true, assetCode: true } },
                refundViaDepositSettlementItemId: true,
                inspection: { select: { outcome: true } },
                depositRefundAllocations: { include: { refund: true } },
              },
            },
          },
        },
      },
    })
    if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
    if (order.userId !== query.actorUserId && !recipientMatches(order.recipientSnapshot, query.actorUserId))
      throw AppError.fromCode(RR.FORBIDDEN)
    const settlement = order.depositSettlementViaOrderId
    if (!settlement)
      return {
        collectedAmount: 0,
        heldAmount: 0,
        refundedAmount: 0,
        refundPendingAmount: 0,
        deductionAmount: 0,
        items: [],
        groupedRefunds: [],
      }
    const inspectionTasks = await this.prisma.returnInspectionTask.findMany({
      where: { orderId: order.id },
      select: { unitId: true, receivedAt: true, inspectionDueAt: true },
    })
    const taskByUnit = new Map(inspectionTasks.map((t) => [t.unitId, t]))
    const refundById = new Map<string, { refundRef: string; status: RefundStatus; amount: number; itemIds: string[] }>()
    const items = settlement.depositSettlementItemsViaSettlementId.map((item) => {
      const grouped = item.depositRefundAllocations[0]
      const refund = grouped?.refund ?? item.refundViaDepositSettlementItemId
      const simulation = (refund?.providerPayload as any)?.sandboxSimulation
      const settlementMode = simulation
        ? 'SANDBOX_SIMULATED'
        : ((item.decisionSnapshot as any)?.settlementMode ?? 'STANDARD')
      const itemRefundAmount = grouped ? decimalToInteger(grouped.amount) : decimalToInteger(item.refundAmount)
      if (grouped && refund) {
        const existing = refundById.get(refund.id) ?? {
          refundRef: refund.id,
          status: refund.status,
          amount: 0,
          itemIds: [],
        }
        existing.amount += itemRefundAmount
        existing.itemIds.push(item.id)
        refundById.set(refund.id, existing)
      }
      const task = taskByUnit.get(item.unitId)
      return {
        unitId: item.unitId,
        assetCode: item.unit.assetCode,
        depositAmount: decimalToInteger(item.depositAmount),
        amount: decimalToInteger(item.depositAmount), // legacy compatible field
        status: publicDepositStatus(item.status, refund?.status, item.deductionAmount),
        inspectionStatus: item.inspection
          ? item.inspection.outcome === ReturnInspectionOutcome.NORMAL
            ? 'FINAL_PASS'
            : 'FINAL_ISSUE'
          : task
            ? 'PENDING'
            : 'NOT_RECEIVED',
        inventoryCustodyReceivedAt: task?.receivedAt.toISOString() ?? null,
        inspectionDueAt: task?.inspectionDueAt.toISOString() ?? null,
        refundBatchId: grouped ? (refund?.id ?? null) : null,
        refundRef: refund?.id ?? null,
        refundStatus: refund?.status ?? null,
        heldReason: item.reason ?? null,
        deduction: decimalToInteger(item.deductionAmount),
        refundAmount: itemRefundAmount,
        reason: item.reason,
        settlementMode,
        simulationNotice: simulation
          ? 'Hoàn cọc mô phỏng (VNPay Sandbox) - không phải bằng chứng tiền đã về tài khoản khách'
          : ((item.decisionSnapshot as any)?.simulationProvenance?.notice ?? null),
      }
    })
    const hasSimulatedItems = items.some((item) => item.settlementMode === 'SANDBOX_SIMULATED')
    const collectedAmount = items.reduce((sum, item) => sum + item.depositAmount, 0)
    const refundedAmount = items
      .filter((item) => item.refundStatus === RefundStatus.SUCCEEDED)
      .reduce((sum, item) => sum + item.refundAmount, 0)
    const refundPendingAmount = items
      .filter((item) => item.refundStatus === RefundStatus.PENDING || item.refundStatus === RefundStatus.PROCESSING)
      .reduce((sum, item) => sum + item.refundAmount, 0)
    const deductionAmount = items
      .filter((item) => item.status === 'DEDUCTED' || item.status === 'SETTLED')
      .reduce((sum, item) => sum + item.deduction, 0)
    const simulatedSettledAmount = items
      .filter((item) => item.settlementMode === 'SANDBOX_SIMULATED')
      .reduce((sum, item) => sum + item.refundAmount, 0)
    // RG-03 Fix: Only unconfirmed simulated items (refund is NOT yet SUCCEEDED by provider) are deducted.
    // Once provider confirms SUCCEEDED, it is already counted in refundedAmount, preventing double-subtraction.
    const unconfirmedSimulatedAmount = items
      .filter((item) => item.settlementMode === 'SANDBOX_SIMULATED' && item.refundStatus !== RefundStatus.SUCCEEDED)
      .reduce((sum, item) => sum + item.refundAmount, 0)
    const heldAmount = Math.max(0, collectedAmount - refundedAmount - deductionAmount)
    const effectiveHeldAmount = Math.max(
      0,
      collectedAmount - refundedAmount - unconfirmedSimulatedAmount - deductionAmount,
    )
    return {
      collectedAmount,
      heldAmount,
      refundedAmount,
      refundPendingAmount,
      deductionAmount,
      items,
      groupedRefunds: [...refundById.values()],
      financialTruth: {
        providerRefundedAmount: refundedAmount,
        providerRefundPendingAmount: refundPendingAmount,
        realMoneyReturned: items.some(
          (item) => item.refundStatus === RefundStatus.SUCCEEDED && item.settlementMode !== 'SANDBOX_SIMULATED',
        ),
      },
      ...(hasSimulatedItems
        ? {
            settlementMode: 'SANDBOX_SIMULATED',
            simulatedSettledAmount,
            unconfirmedSimulatedAmount,
            effectiveHeldAmount,
            notice: 'Hoàn cọc mô phỏng (VNPay Sandbox) - Không phải tiền đã về tài khoản khách',
            warnings: ['TEST_ONLY', 'NO_REAL_MONEY_RETURNED'],
          }
        : {}),
    }
  }

  // RB-API-608 ---------------------------------------------------------------
  async finalizeReturn(command: FinalizeReturnCommand) {
    return this.runIdempotentMutation(
      'RB-API-608:finalize-return',
      command.actorUserId,
      command.idempotencyKey,
      {
        returnId: command.returnId,
        unitOutcomes: command.unitOutcomes,
        inspectionVersion: command.inspectionVersion,
        expectedVersion: command.expectedVersion,
      },
      async (tx) => {
        const actor = await requireActiveRole(tx, command.actorUserId, UserRole.STAFF_INVENTORY)
        const task = await lockDeliveryTask(tx, command.returnId)
        if (!task || task.taskType !== DeliveryTaskType.RETURN) throw AppError.fromCode(RR.RETURN_TASK_NOT_FOUND)
        assertExpectedVersion(task.version, command.expectedVersion)
        const order = await getReturnOrder(tx, task.orderId)
        if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
        const assignments = order.rentalOrderLinesViaOrderId.flatMap(
          (line: any) => line.rentalUnitAssignmentsViaOrderLineId,
        )
        const unitStates: Array<Record<string, unknown>> = []

        for (const input of command.unitOutcomes) {
          const assignment = assignments.find((entry: any) => entry.equipmentUnitId === input.unitId)
          if (!assignment) throw AppError.fromCode(RR.UNIT_NOT_IN_RENTAL, { details: { unitId: input.unitId } })
          if (input.outcome !== 'LOST' && !(await hasInventoryLocationReceipt(tx, order.id, input.unitId)))
            throw AppError.fromCode(RR.CUSTODY_MISMATCH, { details: { unitId: input.unitId } })
          const finalInspection = await tx.returnInspection.findUnique({
            where: { assignmentId_stage: { assignmentId: assignment.id, stage: InspectionStage.FINAL } },
          })
          if (!finalInspection)
            throw AppError.fromCode(RR.RETURN_ITEM_REVIEW_REQUIRED, {
              details: { unitId: input.unitId, reason: 'FINAL_INSPECTION_REQUIRED' },
            })
          if (finalInspection.version !== command.inspectionVersion)
            throw AppError.fromCode(RR.VERSION_CONFLICT, {
              details: { unitId: input.unitId, currentInspectionVersion: finalInspection.version },
            })
          const inspection = finalInspection
          if (input.outcome === 'NORMAL' && inspection.outcome !== ReturnInspectionOutcome.NORMAL)
            throw AppError.fromCode(RR.RETURN_ITEM_REVIEW_REQUIRED, {
              details: { unitId: input.unitId, reason: 'FINAL_OUTCOME_MISMATCH' },
            })
          // Physical AVAILABLE is exclusively written by RB-API-611 with FINAL_PASS + cleaning + READY.
          const physicalUnit = await tx.equipmentUnit.findUnique({
            where: { id: input.unitId },
            select: { status: true },
          })
          if (physicalUnit?.status === EquipmentUnitStatus.AVAILABLE)
            throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
              details: { unitId: input.unitId, reason: 'UNIT_ALREADY_AVAILABLE' },
            })

          const depositItem = await tx.depositSettlementItem.findUnique({ where: { assignmentId: assignment.id } })
          if (!depositItem) throw AppError.fromCode(RR.DEPOSIT_ITEM_NOT_FOUND)
          if (input.outcome === 'NORMAL') {
            // A FINAL_PASS unit can be cleaned independently of its pending deposit refund.
            // Never couple physical readiness to financial REVIEW_REQUIRED status.
            await tx.equipmentUnit.update({
              where: { id: input.unitId },
              data: {
                status: EquipmentUnitStatus.CLEANING,
                condition: EquipmentCondition.GOOD,
                version: { increment: 1 },
              },
            })
            unitStates.push({ unitId: input.unitId, status: EquipmentUnitStatus.CLEANING })
          } else if (input.outcome === 'DAMAGED') {
            if (![DepositItemStatus.SETTLED, DepositItemStatus.REFUND_PENDING].includes(depositItem.status as any))
              throw AppError.fromCode(RR.RETURN_ITEM_REVIEW_REQUIRED, { details: { unitId: input.unitId } })
            await tx.equipmentUnit.update({
              where: { id: input.unitId },
              data: {
                status: EquipmentUnitStatus.DAMAGED,
                condition: EquipmentCondition.DAMAGED,
                version: { increment: 1 },
              },
            })
            await tx.rentalUnitAssignment.update({
              where: { id: assignment.id },
              data: { status: RentalUnitAssignmentStatus.CLOSED, closedAt: command.now, version: { increment: 1 } },
            })
            unitStates.push({ unitId: input.unitId, status: EquipmentUnitStatus.DAMAGED })
          } else {
            if (inspection.outcome !== ReturnInspectionOutcome.LOST_CONFIRMED)
              throw AppError.fromCode(RR.RETURN_ITEM_REVIEW_REQUIRED, {
                details: { unitId: input.unitId, reason: 'LOST_NOT_CONFIRMED_BY_ADMIN' },
              })
            await tx.equipmentUnit.update({
              where: { id: input.unitId },
              data: { status: EquipmentUnitStatus.LOST, condition: EquipmentCondition.LOST, version: { increment: 1 } },
            })
            await tx.rentalUnitAssignment.update({
              where: { id: assignment.id },
              data: { status: RentalUnitAssignmentStatus.CLOSED, closedAt: command.now, version: { increment: 1 } },
            })
            unitStates.push({ unitId: input.unitId, status: EquipmentUnitStatus.LOST })
          }
        }
        const completed = await tryCompleteOrder(tx, order.id, command.now)
        const current = await tx.rentalOrder.findUniqueOrThrow({
          where: { id: order.id },
          select: { status: true, financialStatus: true },
        })
        await writeAudit(
          tx,
          actor.id,
          'RETURN_ASSET_FINALIZED',
          'DeliveryTask',
          task.id,
          undefined,
          { unitStates, orderStatus: current.status, financialStatus: current.financialStatus, completed },
          command.idempotencyKey,
        )
        return { unitStates, orderStatus: current.status, financialStatus: current.financialStatus }
      },
    )
  }

  // RB-API-609 ---------------------------------------------------------------
  async createAssessmentReview(command: CreateAssessmentReviewCommand) {
    return this.runIdempotentMutation(
      'RB-API-609:assessment-review',
      command.actorUserId,
      command.idempotencyKey,
      {
        orderId: command.orderId,
        assessmentId: command.assessmentId,
        reason: command.reason,
        evidenceIds: command.evidenceIds,
      },
      async (tx) => {
        const order = await tx.rentalOrder.findUnique({
          where: { id: command.orderId },
          include: { rentalPolicy: true },
        })
        if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
        if (order.userId !== command.actorUserId) throw AppError.fromCode(RR.FORBIDDEN)
        const inspection = await tx.returnInspection.findFirst({
          where: { id: command.assessmentId, orderId: order.id, stage: InspectionStage.FINAL },
        })
        if (!inspection) throw AppError.fromCode(RR.ASSESSMENT_NOT_FOUND)
        const publishedCase = await tx.rentalExceptionCase.findFirst({
          where: { inspectionId: inspection.id, evidenceAccessibleAt: { not: null } },
          orderBy: { evidenceAccessibleAt: 'desc' },
        })
        if (!publishedCase?.evidenceAccessibleAt)
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, { details: { reason: 'EVIDENCE_NOT_ACCESSIBLE' } })
        if (
          command.now.getTime() >
          publishedCase.evidenceAccessibleAt.getTime() + (order.rentalPolicy.userAssessmentReviewMinutes ?? 0) * 60_000
        )
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, { details: { reason: 'USER_REVIEW_WINDOW_EXPIRED' } })
        await validateEvidence(tx, command.actorUserId, command.evidenceIds, [
          MediaScope.EXCEPTION_EVIDENCE,
          MediaScope.RETURN_EVIDENCE,
        ])
        let exceptionCase = await tx.rentalExceptionCase.findFirst({
          where: {
            inspectionId: inspection.id,
            status: { in: [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW] },
          },
          orderBy: { createdAt: 'desc' },
        })
        if (!exceptionCase) {
          exceptionCase = await tx.rentalExceptionCase.create({
            data: {
              orderId: order.id,
              assignmentId: inspection.assignmentId,
              unitId: inspection.unitId,
              inspectionId: inspection.id,
              caseType: RentalExceptionType.DAMAGE_DISPUTE,
              status: RentalExceptionCaseStatus.UNDER_REVIEW,
              openedBy: command.actorUserId,
              reason: command.reason,
              evidenceIds: jsonValue(command.evidenceIds),
              dueAt: policyDueAt(order.rentalPolicy.userAssessmentReviewMinutes, publishedCase.evidenceAccessibleAt),
            },
          })
        } else {
          exceptionCase = await tx.rentalExceptionCase.update({
            where: { id: exceptionCase.id },
            data: { status: RentalExceptionCaseStatus.UNDER_REVIEW, version: { increment: 1 } },
          })
        }
        const review = await tx.rentalAssessmentReview.upsert({
          where: { inspectionId_userId: { inspectionId: inspection.id, userId: command.actorUserId } },
          update: {},
          create: {
            orderId: order.id,
            inspectionId: inspection.id,
            userId: command.actorUserId,
            exceptionCaseId: exceptionCase.id,
            reason: command.reason,
            evidenceIds: jsonValue(command.evidenceIds),
          },
        })
        await writeAudit(
          tx,
          command.actorUserId,
          'RENTAL_ASSESSMENT_REVIEW_SUBMITTED',
          'RentalAssessmentReview',
          review.id,
          undefined,
          { inspectionId: inspection.id, caseId: exceptionCase.id },
          command.idempotencyKey,
        )
        return {
          caseId: exceptionCase.id,
          reviewStatus: exceptionCase.status,
          dueAt: exceptionCase.dueAt?.toISOString() ?? null,
          evidenceAccessibleAt: publishedCase.evidenceAccessibleAt.toISOString(),
          windowEndsAt: new Date(
            publishedCase.evidenceAccessibleAt.getTime() +
              (order.rentalPolicy.userAssessmentReviewMinutes ?? 0) * 60_000,
          ).toISOString(),
        }
      },
    )
  }

  // RB-API-610 ---------------------------------------------------------------
  async resolveException(command: ResolveExceptionCommand) {
    return this.runIdempotentMutation(
      'RB-API-610:resolve-exception',
      command.actorUserId,
      command.idempotencyKey,
      {
        exceptionId: command.exceptionId,
        decision: command.decision,
        reason: command.reason,
        assessmentVersion: command.assessmentVersion ?? null,
        expectedVersion: command.expectedVersion,
      },
      async (tx) => {
        const actor = await requireActiveRole(tx, command.actorUserId, UserRole.ADMIN)
        await tx.$queryRaw`SELECT id FROM rental_exception_cases WHERE id = ${command.exceptionId}::uuid FOR UPDATE`
        const exceptionCase = await tx.rentalExceptionCase.findUnique({
          where: { id: command.exceptionId },
          include: { inspection: true, order: { include: { rentalPolicy: true } } },
        })
        if (!exceptionCase) throw AppError.fromCode(RR.EXCEPTION_NOT_FOUND)
        assertExpectedVersion(exceptionCase.version, command.expectedVersion)
        if (
          ![RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW].includes(
            exceptionCase.status as any,
          )
        )
          throw AppError.fromCode(RR.EXCEPTION_ALREADY_RESOLVED)
        if (
          command.assessmentVersion &&
          exceptionCase.inspection &&
          exceptionCase.inspection.version !== command.assessmentVersion
        )
          throw AppError.fromCode(RR.VERSION_CONFLICT)
        const depositItem = exceptionCase.assignmentId
          ? await tx.depositSettlementItem.findUnique({ where: { assignmentId: exceptionCase.assignmentId } })
          : null
        const approvalRef = `APR-${randomUUID()}`
        let nextAction = 'NONE'
        let resolvedInspectionId = exceptionCase.inspectionId
        const resolution = command.decision
        const isDeliveryCustodyDiscrepancy = exceptionCase.reason.startsWith(DELIVERY_CUSTODY_DISCREPANCY)
        if (isDeliveryCustodyDiscrepancy && command.decision !== 'CLOSE_NO_ACTION')
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            details: { reason: 'DELIVERY_CUSTODY_LOSS_CANNOT_BE_CHARGED_TO_CUSTOMER' },
          })

        if (command.decision === 'APPROVE_DEDUCTION' || command.decision === 'REJECT_DEDUCTION') {
          if (!exceptionCase.inspection || !depositItem) throw AppError.fromCode(RR.ASSESSMENT_NOT_FOUND)
          if (command.decision === 'APPROVE_DEDUCTION' && !exceptionCase.evidenceCompleteAt)
            throw AppError.fromCode(RR.EVIDENCE_NOT_READY)
          const snapshot = jsonObject(depositItem.decisionSnapshot)
          const capped = decimalFromUnknown(snapshot.cappedDeduction ?? '0')
          const approvedDeduction = command.decision === 'APPROVE_DEDUCTION' ? capped : new Prisma.Decimal(0)
          await tx.depositSettlementItem.update({
            where: { id: depositItem.id },
            data: {
              status:
                command.decision === 'APPROVE_DEDUCTION'
                  ? DepositItemStatus.DEDUCTION_APPROVED
                  : DepositItemStatus.DEDUCTION_REJECTED,
              approvedBy: actor.id,
              approvedAt: command.now,
              decisionSnapshot: jsonValue({
                ...snapshot,
                approvedDeduction: approvedDeduction.toString(),
                approvalRef,
                adminDecision: command.decision,
                adminReason: command.reason,
              }),
              version: { increment: 1 },
            },
          })
          nextAction = 'CREATE_DEPOSIT_SETTLEMENT'
        } else if (command.decision === 'CONFIRM_LOST') {
          if (!exceptionCase.assignmentId || !exceptionCase.unitId || !depositItem)
            throw AppError.fromCode(RR.ASSESSMENT_NOT_FOUND)
          const minutes = exceptionCase.order.rentalPolicy.lostConfirmationMinutes
          if (!minutes || minutes < 2880)
            throw AppError.fromCode(RR.POLICY_CONFIG_REQUIRED, {
              details: { field: 'lostConfirmationMinutes', minimum: 2880 },
            })
          if (!exceptionCase.evidenceCompleteAt) throw AppError.fromCode(RR.EVIDENCE_NOT_READY)
          // Legacy dueAt may have been calculated from a shorter policy window.
          const operationalDue = Math.max(
            exceptionCase.order.rentalEndAt.getTime(),
            exceptionCase.order.operationalReturnDueAt?.getTime() ?? 0,
          )
          const floor = new Date(operationalDue + 2880 * 60_000)
          const configured = new Date(operationalDue + minutes * 60_000)
          const earliest = new Date(
            Math.max(floor.getTime(), configured.getTime(), exceptionCase.dueAt?.getTime() ?? 0),
          )
          if (command.now < earliest)
            throw AppError.fromCode(RR.LOST_CONFIRMATION_TOO_EARLY, { details: { earliestAt: earliest.toISOString() } })
          let inspection = exceptionCase.inspection
          if (!inspection || inspection.stage !== InspectionStage.FINAL) {
            inspection = await tx.returnInspection.upsert({
              where: { assignmentId_stage: { assignmentId: exceptionCase.assignmentId, stage: InspectionStage.FINAL } },
              update: { outcome: ReturnInspectionOutcome.LOST_CONFIRMED, version: { increment: 1 } },
              create: {
                orderId: exceptionCase.orderId,
                assignmentId: exceptionCase.assignmentId,
                unitId: exceptionCase.unitId,
                inspectorId: actor.id,
                stage: InspectionStage.FINAL,
                outcome: ReturnInspectionOutcome.LOST_CONFIRMED,
                notes: command.reason,
              },
            })
          } else {
            inspection = await tx.returnInspection.update({
              where: { id: inspection.id },
              data: {
                outcome: ReturnInspectionOutcome.LOST_CONFIRMED,
                notes: command.reason,
                version: { increment: 1 },
              },
            })
          }
          await tx.depositSettlementItem.update({
            where: { id: depositItem.id },
            data: {
              inspectionId: inspection.id,
              status: DepositItemStatus.DEDUCTION_APPROVED,
              deductionAmount: depositItem.depositAmount,
              refundAmount: 0,
              approvedBy: actor.id,
              approvedAt: command.now,
              decisionSnapshot: jsonValue({
                approvedDeduction: depositItem.depositAmount.toString(),
                approvalRef,
                adminDecision: 'CONFIRM_LOST',
                adminReason: command.reason,
              }),
              version: { increment: 1 },
            },
          })
          nextAction = 'CREATE_DEPOSIT_SETTLEMENT'
        } else {
          if (depositItem) {
            const snapshot = jsonObject(depositItem.decisionSnapshot)
            let settlementInspectionId = exceptionCase.inspectionId
            if (isDeliveryCustodyDiscrepancy) {
              if (!exceptionCase.assignmentId || !exceptionCase.unitId)
                throw AppError.fromCode(RR.ASSESSMENT_NOT_FOUND)
              const finalInspection = await tx.returnInspection.upsert({
                where: {
                  assignmentId_stage: {
                    assignmentId: exceptionCase.assignmentId,
                    stage: InspectionStage.FINAL,
                  },
                },
                update: {
                  outcome: ReturnInspectionOutcome.LOST_CONFIRMED,
                  notes: `INTERNAL_CUSTODY_LOSS_NO_CUSTOMER_LIABILITY: ${command.reason}`,
                  version: { increment: 1 },
                },
                create: {
                  orderId: exceptionCase.orderId,
                  assignmentId: exceptionCase.assignmentId,
                  unitId: exceptionCase.unitId,
                  inspectorId: actor.id,
                  stage: InspectionStage.FINAL,
                  outcome: ReturnInspectionOutcome.LOST_CONFIRMED,
                  notes: `INTERNAL_CUSTODY_LOSS_NO_CUSTOMER_LIABILITY: ${command.reason}`,
                },
              })
              settlementInspectionId = finalInspection.id
              resolvedInspectionId = finalInspection.id
            }
            await tx.depositSettlementItem.update({
              where: { id: depositItem.id },
              data: {
                inspectionId: settlementInspectionId,
                status: DepositItemStatus.DEDUCTION_REJECTED,
                deductionAmount: 0,
                refundAmount: isDeliveryCustodyDiscrepancy ? depositItem.depositAmount : depositItem.refundAmount,
                reason: isDeliveryCustodyDiscrepancy
                  ? 'INTERNAL_CUSTODY_LOSS_NO_CUSTOMER_LIABILITY'
                  : depositItem.reason,
                decisionSnapshot: jsonValue({
                  ...snapshot,
                  approvedDeduction: '0',
                  approvalRef,
                  adminDecision: 'CLOSE_NO_ACTION',
                  adminReason: command.reason,
                }),
                approvedBy: actor.id,
                approvedAt: command.now,
                version: { increment: 1 },
              },
            })
            nextAction = settlementInspectionId ? 'CREATE_DEPOSIT_SETTLEMENT' : 'NONE'
          }
        }
        const resolved = await tx.rentalExceptionCase.update({
          where: { id: exceptionCase.id },
          data: {
            status: RentalExceptionCaseStatus.RESOLVED,
            adminReviewStatus: 'DECIDED',
            resolution: `${resolution}: ${command.reason}`,
            approvalRef,
            inspectionId: resolvedInspectionId,
            resolvedAt: command.now,
            version: { increment: 1 },
          },
        })
        await writeAudit(
          tx,
          actor.id,
          'RENTAL_EXCEPTION_RESOLVED',
          'RentalExceptionCase',
          exceptionCase.id,
          { status: exceptionCase.status, version: exceptionCase.version },
          { status: resolved.status, decision: command.decision, approvalRef, nextAction },
          command.idempotencyKey,
        )
        if (
          command.decision === 'CLOSE_NO_ACTION' &&
          exceptionCase.reason.startsWith(DELIVERY_CUSTODY_DISCREPANCY)
        ) {
          await closeResolvedDeliveryCustodyChain(tx, exceptionCase.orderId, command.now)
        }
        return { resolution: command.decision, nextAction, approvalRef, assessmentId: resolvedInspectionId }
      },
    )
  }

  // RB-API-611 ---------------------------------------------------------------
  async markUnitReady(command: MarkUnitReadyCommand) {
    return this.runIdempotentMutation(
      'RB-API-611:returned-unit-ready',
      command.actorUserId,
      command.idempotencyKey,
      {
        unitId: command.unitId,
        inspectionId: command.inspectionId ?? null,
        accessoriesChecked: command.accessoriesChecked,
        expectedVersion: command.expectedVersion,
        gradeDecision: command.gradeDecision ?? null,
      },
      async (tx) => {
        const actor = await requireActiveRole(tx, command.actorUserId, UserRole.STAFF_INVENTORY)
        await lockUnit(tx, command.unitId)
        const unit = await tx.equipmentUnit.findUnique({ where: { id: command.unitId } })
        if (!unit) throw AppError.fromCode(RR.UNIT_NOT_FOUND)
        assertExpectedVersion(unit.version, command.expectedVersion)
        if (unit.status !== EquipmentUnitStatus.CLEANING || !command.accessoriesChecked)
          throw AppError.fromCode(RR.INVALID_RETURN_STATE)
        // Mandatory: STAFF_INVENTORY's FINAL PASS and custody task completion.
        const assignment = await tx.rentalUnitAssignment.findFirst({
          where: { equipmentUnitId: unit.id, status: RentalUnitAssignmentStatus.RETURNED },
          orderBy: { returnedAt: 'desc' },
        })
        if (!assignment) throw AppError.fromCode(RR.RETURN_ITEM_REVIEW_REQUIRED)
        const [inspection, inspectionTask] = await Promise.all([
          tx.returnInspection.findUnique({
            where: { assignmentId_stage: { assignmentId: assignment.id, stage: InspectionStage.FINAL } },
          }),
          tx.returnInspectionTask.findUnique({ where: { assignmentId: assignment.id } }),
        ])
        if (
          !inspection ||
          inspection.outcome !== ReturnInspectionOutcome.NORMAL ||
          !inspectionTask ||
          inspectionTask.status !== 'COMPLETED' ||
          (command.inspectionId && inspection.id !== command.inspectionId)
        ) {
          throw AppError.fromCode(RR.RETURN_ITEM_REVIEW_REQUIRED)
        }
        // Phân hạng bắt buộc với sản phẩm có hạng; kiểm trước khi đổi trạng thái để lỗi không để lại gì.
        const gradedProduct = await tx.rentalProduct.findUnique({
          where: { id: unit.productId },
          select: { id: true, gradeGroupId: true, grade: true },
        })
        const gradeDecision = gradedProduct
          ? assertGradeDecision(gradedProduct, command.gradeDecision, { required: true })
          : null
        const updated = await tx.equipmentUnit.update({
          where: { id: unit.id },
          data: { status: EquipmentUnitStatus.AVAILABLE, expectedReadyAt: null, version: { increment: 1 } },
        })
        if (assignment)
          await tx.rentalUnitAssignment.update({
            where: { id: assignment.id },
            data: { status: RentalUnitAssignmentStatus.CLOSED, closedAt: command.now, version: { increment: 1 } },
          })
        if (assignment) {
          const orderLine = await tx.rentalOrderLine.findUnique({
            where: { id: assignment.orderLineId },
            select: { orderId: true },
          })
          if (orderLine) await tryCompleteOrder(tx, orderLine.orderId, command.now)
        }
        // Chạy sau tryCompleteOrder: khoá đơn trước, nhóm sản phẩm sau (cùng thứ tự với gia hạn).
        const gradeResult =
          gradedProduct && gradeDecision
            ? await applyGradeDecision(tx, {
                unitId: unit.id,
                product: gradedProduct,
                decision: gradeDecision,
                actorId: actor.id,
                now: command.now,
                assignmentId: assignment.id,
              })
            : null
        const finalProductId = gradeResult?.toProductId ?? updated.productId
        const finalVersion = gradeResult?.unitVersion ?? updated.version
        await writeAudit(
          tx,
          actor.id,
          'RETURNED_UNIT_AVAILABLE',
          'EquipmentUnit',
          unit.id,
          { status: unit.status, version: unit.version, productId: unit.productId },
          { status: updated.status, version: finalVersion, productId: finalProductId },
          command.idempotencyKey,
        )
        return {
          unit: {
            id: updated.id,
            assetCode: updated.assetCode,
            status: updated.status,
            condition: updated.condition,
            productId: finalProductId,
            version: finalVersion,
          },
          readyAt: command.now.toISOString(),
          gradeReview: gradeResult
            ? {
                id: gradeResult.reviewId,
                decision: gradeResult.decision,
                fromProductId: gradeResult.fromProductId,
                toProductId: gradeResult.toProductId,
                shortageOrderIds: gradeResult.shortage.orderIds,
              }
            : null,
        }
      },
    )
  }

  // RB-API-612 ---------------------------------------------------------------
  async listExceptions(query: ListExceptionsQuery) {
    await assertStaffScope(this.prisma, query.actorUserId, query.actorRole, [UserRole.STAFF_INVENTORY, UserRole.ADMIN])
    await this.prisma.$transaction((tx) => materializeRefundReviewCases(tx))
    const where: Prisma.RentalExceptionCaseWhereInput = {
      caseType: query.type ? (query.type as any) : undefined,
      status: query.status ? (query.status as any) : undefined,
      assignedTo: query.assignee,
    }
    const skip = (query.page - 1) * query.pageSize
    const [rows, totalItems] = await this.prisma.$transaction([
      this.prisma.rentalExceptionCase.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          unit: { select: { id: true, assetCode: true } },
          order: {
            select: {
              id: true,
              bookingId: true,
              tripId: true,
              exceptionStatus: true,
              trip: { select: { title: true } },
              user: { select: { fullName: true } },
              recipientParticipant: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.rentalExceptionCase.count({ where }),
    ])
    return {
      items: rows.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        unit: row.unit,
        type: row.caseType,
        status: row.status,
        reason: row.reason,
        assigneeId: row.assignedTo,
        dueAt: row.dueAt?.toISOString() ?? null,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        order: {
          id: row.order.id,
          bookingId: row.order.bookingId,
          tripId: row.order.tripId,
          tripTitle: row.order.trip.title,
          customerName: row.order.recipientParticipant?.fullName ?? row.order.user.fullName,
          exceptionStatus: row.order.exceptionStatus,
        },
      })),
      pagination: pagination(query.page, query.pageSize, totalItems),
    }
  }

  // RB-API-613 ---------------------------------------------------------------
  async listReturns(query: ListReturnsQuery) {
    await requireActiveRole(this.prisma, query.actorUserId, UserRole.STAFF_INVENTORY)
    const tasks = await this.prisma.deliveryTask.findMany({
      where: {
        taskType: DeliveryTaskType.RETURN,
        status: {
          in: [DeliveryTaskStatus.COLLECTING, DeliveryTaskStatus.RETURNED, DeliveryTaskStatus.INVENTORY_RECEIVED],
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      include: {
        order: {
          include: {
            trip: { select: { title: true } },
            user: { select: { fullName: true } },
            recipientParticipant: { select: { fullName: true } },
            depositSettlementViaOrderId: { include: { depositSettlementItemsViaSettlementId: true } },
            returnInspectionsViaOrderId: true,
          },
        },
      },
    })
    const mapped = tasks
      .map((task) => mapReturnQueueItem(task))
      .filter((item) => !query.status || item.status === query.status)
    const start = (query.page - 1) * query.pageSize
    return {
      items: mapped.slice(start, start + query.pageSize),
      pagination: pagination(query.page, query.pageSize, mapped.length),
    }
  }

  // RB-API-614 ---------------------------------------------------------------
  async getReturn(query: GetReturnQuery) {
    await assertStaffScope(this.prisma, query.actorUserId, query.actorRole, [
      UserRole.STAFF_INVENTORY,
      UserRole.STAFF_DELIVERY,
      UserRole.ADMIN,
    ])
    const task = await this.prisma.deliveryTask.findUnique({
      where: { id: query.returnId },
      include: {
        order: { include: returnDetailOrderInclude },
        returnCustodyTransfersViaDeliveryTaskId: {
          include: { inventoryLocation: { select: { id: true, name: true } } },
          orderBy: { requestedAt: 'desc' },
        },
      },
    })
    if (!task || task.taskType !== DeliveryTaskType.RETURN) throw AppError.fromCode(RR.RETURN_TASK_NOT_FOUND)
    if (query.actorRole === UserRole.STAFF_DELIVERY && task.staffId !== query.actorUserId)
      throw AppError.fromCode(RR.FORBIDDEN)
    return buildReturnDetail(task)
  }

  // RB-API-615 ---------------------------------------------------------------
  async getException(query: GetExceptionQuery) {
    await assertStaffScope(this.prisma, query.actorUserId, query.actorRole, [UserRole.STAFF_INVENTORY, UserRole.ADMIN])
    const row = await this.prisma.rentalExceptionCase.findUnique({
      where: { id: query.exceptionId },
      include: {
        unit: { select: { id: true, assetCode: true, condition: true, status: true } },
        inspection: { include: { findingsViaInspectionId: true } },
        rentalAssessmentReviewsViaExceptionCaseId: true,
        order: {
          select: {
            id: true,
            bookingId: true,
            tripId: true,
            exceptionStatus: true,
            trip: { select: { title: true } },
            user: { select: { fullName: true } },
            recipientParticipant: { select: { fullName: true } },
            refundsViaRentalOrderId: {
              orderBy: { createdAt: 'desc' },
              select: { id: true, amount: true, currency: true, status: true, reconcileStatus: true, retryCount: true, lastErrorCode: true, lastCheckedAt: true },
            },
          },
        },
      },
    })
    if (!row) throw AppError.fromCode(RR.EXCEPTION_NOT_FOUND)
    const referencedRefundId = refundIdFromReviewReason(row.reason)
    const referencedRefund = referencedRefundId
      ? await this.prisma.refund.findUnique({
          where: { id: referencedRefundId },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            reconcileStatus: true,
            retryCount: true,
            lastErrorCode: true,
            lastCheckedAt: true,
          },
        })
      : null
    const refund =
      referencedRefund ?? row.order.refundsViaRentalOrderId.find((item) => item.reconcileStatus === 'NEEDS_REVIEW')
    const history = await this.prisma.auditLog.findMany({
      where: { entityType: 'RentalExceptionCase', entityId: row.id },
      orderBy: { createdAt: 'asc' },
    })
    return {
      case: {
        id: row.id,
        orderId: row.orderId,
        unit: row.unit,
        type: row.caseType,
        status: row.status,
        reason: row.reason,
        resolution: row.resolution,
        approvalRef: row.approvalRef,
        dueAt: row.dueAt?.toISOString() ?? null,
        version: row.version,
        order: {
          id: row.order.id,
          bookingId: row.order.bookingId,
          tripId: row.order.tripId,
          tripTitle: row.order.trip.title,
          customerName: row.order.recipientParticipant?.fullName ?? row.order.user.fullName,
          exceptionStatus: row.order.exceptionStatus,
        },
      },
      evidence: jsonArray(row.evidenceIds),
      assessment: row.inspection ? mapInspection(row.inspection) : null,
      refund: refund
        ? {
            id: refund.id,
            amount: decimalToInteger(refund.amount),
            currency: refund.currency,
            status: refund.status,
            reconcileStatus: refund.reconcileStatus,
            retryCount: refund.retryCount,
            lastErrorCode: refund.lastErrorCode,
            lastCheckedAt: refund.lastCheckedAt?.toISOString() ?? null,
          }
        : null,
      reviews: row.rentalAssessmentReviewsViaExceptionCaseId.map((review) => ({
        id: review.id,
        userId: review.userId,
        reason: review.reason,
        evidenceIds: jsonArray((review as any).evidenceIds),
        createdAt: review.createdAt.toISOString(),
      })),
      history: history.map((entry) => ({
        action: entry.action,
        userId: entry.userId,
        oldValues: entry.oldValues,
        newValues: entry.newValues,
        createdAt: entry.createdAt.toISOString(),
      })),
      allowedActions:
        query.actorRole === UserRole.ADMIN &&
        [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW].includes(row.status as any)
          ? ['APPROVE_DEDUCTION', 'REJECT_DEDUCTION', 'CONFIRM_LOST', 'CLOSE_NO_ACTION']
          : [],
    }
  }

  // RB-API-616 ---------------------------------------------------------------
  async getAssessment(query: GetAssessmentQuery) {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { id: query.orderId },
      include: { rentalPolicy: true },
    })
    if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
    if (order.userId !== query.actorUserId && !recipientMatches(order.recipientSnapshot, query.actorUserId))
      throw AppError.fromCode(RR.FORBIDDEN)
    const assessments = await this.prisma.returnInspection.findMany({
      where: { orderId: order.id, stage: InspectionStage.FINAL },
      include: {
        unit: { select: { id: true, assetCode: true } },
        findingsViaInspectionId: true,
        depositSettlementItemsViaInspectionId: true,
        rentalExceptionCasesViaInspectionId: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    return {
      items: assessments.map((assessment) => {
        const depositItem = assessment.depositSettlementItemsViaInspectionId[0]
        const decision = jsonObject(depositItem?.decisionSnapshot)
        const openCase = assessment.rentalExceptionCasesViaInspectionId.find((item) =>
          [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW].includes(item.status as any),
        )
        return {
          inspectionId: assessment.id,
          unit: assessment.unit,
          outcome: assessment.outcome,
          proposedDeduction: decimalToInteger(decimalFromUnknown(decision.proposedDeduction ?? '0')),
          approvedDeduction: decimalToInteger(decimalFromUnknown(decision.approvedDeduction ?? '0')),
          evidence: jsonArray(assessment.evidenceIds),
          findings: assessment.findingsViaInspectionId.map((finding) => ({
            ruleId: finding.ruleId,
            amount: decimalToInteger(finding.assessedAmount),
            quantity: finding.quantity,
            evidenceIds: jsonArray(finding.evidenceIds),
          })),
          reviewDueAt: openCase?.dueAt?.toISOString() ?? null,
          caseId: openCase?.id ?? null,
        }
      }),
      proposedDeduction: assessments.reduce((sum, assessment) => {
        const item = assessment.depositSettlementItemsViaInspectionId[0]
        return sum + decimalToInteger(decimalFromUnknown(jsonObject(item?.decisionSnapshot).proposedDeduction ?? '0'))
      }, 0),
      evidence: assessments.flatMap((assessment) => jsonArray(assessment.evidenceIds)),
      reviewDueAt:
        assessments
          .flatMap((assessment) => assessment.rentalExceptionCasesViaInspectionId)
          .find((item) =>
            [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW].includes(item.status as any),
          )
          ?.dueAt?.toISOString() ?? null,
    }
  }

  // Shared Payment -> Area B refund reconciliation ---------------------------
  async processRefundEvent(command: RentalRefundEventCommand) {
    return this.prisma
      .$transaction(async (tx) => {
        const existing = await tx.rentalInboxEvent.findUnique({ where: { eventId: command.eventId } })
        if (existing) return existing.result ?? { eventId: command.eventId, duplicate: true }
        const inbox = await tx.rentalInboxEvent.create({
          data: {
            eventId: command.eventId,
            eventType: 'REFUND_RESULT',
            entityId: command.rentalOrderId,
            entityVersion: 1,
            occurredAt: command.occurredAt,
            correlationId: command.correlationId,
            payload: jsonValue(command),
          },
        })
        await lockOrder(tx, command.rentalOrderId)
        const refund = await tx.refund.findFirst({
          where: {
            rentalOrderId: command.rentalOrderId,
            OR: [{ id: command.refundRef }, { refundTransactionRef: command.refundRef }],
          },
          include: { depositSettlementItem: true, depositRefundItems: true },
        })
        if (!refund) throw AppError.fromCode(RR.REFUND_RECONCILIATION_REQUIRED)
        if (decimalToInteger(refund.amount) !== command.amount || refund.currency !== command.currency)
          throw AppError.fromCode(RR.REFUND_RECONCILIATION_REQUIRED, {
            details: { reason: 'AMOUNT_OR_CURRENCY_MISMATCH' },
          })
        const refundStatus =
          command.status === 'SUCCEEDED'
            ? RefundStatus.SUCCEEDED
            : command.status === 'FAILED'
              ? RefundStatus.FAILED
              : RefundStatus.PROCESSING
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            status: refundStatus,
            refundTransactionRef: command.refundRef,
            refundedAt: refundStatus === RefundStatus.SUCCEEDED ? command.occurredAt : null,
            version: { increment: 1 },
          },
        })
        const refundItems = refund.depositSettlementItemId
          ? [{ depositSettlementItemId: refund.depositSettlementItemId, amount: refund.amount }]
          : refund.depositRefundItems
        for (const refundItem of refundItems) {
          const item = await tx.depositSettlementItem.findUnique({ where: { id: refundItem.depositSettlementItemId } })
          if (item) {
            if (refundStatus === RefundStatus.SUCCEEDED) {
              await tx.depositSettlementItem.update({
                where: { id: item.id },
                data: {
                  status: DepositItemStatus.SETTLED,
                  refundAmount: refundItem.amount,
                  outcome: item.deductionAmount.greaterThan(0)
                    ? DepositSettlementOutcome.PARTIAL_REFUND
                    : DepositSettlementOutcome.FULL_REFUND,
                  settledAt: command.occurredAt,
                  version: { increment: 1 },
                },
              })
            } else if (refundStatus === RefundStatus.FAILED) {
              await tx.depositSettlementItem.update({
                where: { id: item.id },
                data: {
                  status: DepositItemStatus.REFUND_FAILED,
                  reason: command.reason ?? 'REFUND_FAILED',
                  version: { increment: 1 },
                },
              })
              await ensureReviewCase(tx, {
                orderId: command.rentalOrderId,
                assignmentId: item.assignmentId,
                unitId: item.unitId,
                inspectionId: item.inspectionId ?? undefined,
                caseType: RentalExceptionType.REFUND_FAILURE,
                reason: `${refundReviewReference(refund.id)} ${command.reason ?? 'REFUND_FAILED'}`,
                evidenceIds: [],
                dueAt: null,
              })
            } else {
              await tx.depositSettlementItem.update({
                where: { id: item.id },
                data: { status: DepositItemStatus.REFUND_PENDING, version: { increment: 1 } },
              })
            }
          }
        }
        if (refundStatus === RefundStatus.SUCCEEDED) {
          await tx.rentalExceptionCase.updateMany({
            where: {
              orderId: command.rentalOrderId,
              caseType: RentalExceptionType.REFUND_FAILURE,
              status: { in: [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW] },
              reason: { contains: refundReviewReference(refund.id) },
            },
            data: {
              status: RentalExceptionCaseStatus.RESOLVED,
              adminReviewStatus: 'RESOLVED_BY_PROVIDER',
              resolution: 'REFUND_SUCCEEDED',
              resolvedAt: command.occurredAt,
              version: { increment: 1 },
            },
          })
        }
        const aggregate = await refreshSettlementAggregate(tx, command.rentalOrderId, command.occurredAt)
        const completed = await tryCompleteOrder(tx, command.rentalOrderId, command.occurredAt)
        const result = { eventId: command.eventId, refundId: refund.id, status: refundStatus, aggregate, completed }
        if ([RefundStatus.SUCCEEDED, RefundStatus.FAILED].includes(refundStatus as any)) {
          await tx.rentalOutboxEvent.upsert({
            where: { deduplicationKey: `refund-result:${refund.id}:${refundStatus}` },
            update: {},
            create: {
              deduplicationKey: `refund-result:${refund.id}:${refundStatus}`,
              eventType: refundStatus === RefundStatus.SUCCEEDED ? 'RENTAL_REFUND_SUCCEEDED' : 'RENTAL_REFUND_FAILED',
              aggregateType: 'RentalOrder',
              aggregateId: command.rentalOrderId,
              payload: jsonValue({
                rentalOrderId: command.rentalOrderId,
                refundRef: refund.id,
                status: refundStatus,
                amount: command.amount,
                currency: command.currency,
                reason: command.reason ?? null,
              }),
            },
          })
        }
        await tx.rentalInboxEvent.update({
          where: { id: inbox.id },
          data: { status: EventStatus.PROCESSED, processedAt: new Date(), result: jsonValue(result) },
        })
        return result
      })
      .catch(async (error) => {
        await this.prisma.rentalInboxEvent.upsert({
          where: { eventId: command.eventId },
          update: {
            status: EventStatus.FAILED,
            errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'UNKNOWN_ERROR',
            processedAt: new Date(),
          },
          create: {
            eventId: command.eventId,
            eventType: 'REFUND_RESULT',
            entityId: command.rentalOrderId,
            entityVersion: 1,
            occurredAt: command.occurredAt,
            correlationId: command.correlationId,
            payload: jsonValue(command),
            status: EventStatus.FAILED,
            errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'UNKNOWN_ERROR',
            processedAt: new Date(),
          },
        })
        throw error
      })
  }

  // RB-API-1004 -------------------------------------------------------------
  async finalizeReturnReceipt(command: FinalizeReturnReceiptCommand) {
    const remarks = command.remarks?.trim() ?? null
    // STAFF_DELIVERY cannot attest to customer-authored remarks through this endpoint.
    const userRemarks = null
    const normalizedEvidenceIds = [
      ...(command.failureEvidenceId ? [command.failureEvidenceId] : []),
      ...(Array.isArray(command.evidenceIds) ? command.evidenceIds : []),
    ]
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id) => id.trim())
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
      .sort()
    const primaryFailureEvidenceId =
      command.failureEvidenceId?.trim() ?? (normalizedEvidenceIds.length > 0 ? normalizedEvidenceIds[0] : null)

    return this.runIdempotentMutation(
      'RB-API-1004:finalize-return-receipt',
      command.actorUserId,
      command.idempotencyKey,
      {
        orderId: command.orderId,
        returnSessionId: command.returnSessionId,
        expectedVersion: command.expectedVersion,
        remarks,
        userRemarks,
        failureEvidenceId: primaryFailureEvidenceId,
        evidenceIds: normalizedEvidenceIds,
      },
      async (tx) => {
        const actor = await requireActiveRole(tx, command.actorUserId, [UserRole.STAFF_DELIVERY])
        await lockOrder(tx, command.orderId)
        const order = await tx.rentalOrder.findUnique({
          where: { id: command.orderId },
          include: {
            deliveryTasksViaOrderId: true,
          },
        })
        if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
        assertExpectedVersion(order.version, command.expectedVersion)

        // Verify that this delivery staff is assigned to the RETURN delivery task
        const assignedReturnTask = (order.deliveryTasksViaOrderId || []).find(
          (t) => t.taskType === DeliveryTaskType.RETURN && t.staffId === command.actorUserId,
        )
        if (!assignedReturnTask) {
          throw AppError.fromCode(RR.FORBIDDEN, {
            details: { reason: 'ACTOR_NOT_ASSIGNED_TO_RETURN_TASK', staffId: command.actorUserId, orderId: order.id },
          })
        }

        // Return task must be in an active collecting state according to SOT positive allowlist
        const ALLOWED_RETURN_TASK_STATUSES: DeliveryTaskStatus[] = [
          DeliveryTaskStatus.COLLECTING,
          DeliveryTaskStatus.RETURNED,
        ]
        if (!ALLOWED_RETURN_TASK_STATUSES.includes(assignedReturnTask.status)) {
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            details: {
              reason: 'RETURN_TASK_NOT_IN_COLLECTING_STATE',
              taskId: assignedReturnTask.id,
              status: assignedReturnTask.status,
            },
          })
        }

        const session = await tx.rentalReturnSession.findFirst({
          where: { id: command.returnSessionId, orderId: order.id },
        })
        if (!session) {
          throw AppError.fromCode(RR.RETURN_SESSION_NOT_FOUND, {
            details: { returnSessionId: command.returnSessionId, orderId: order.id },
          })
        }

        // Verify session was created by the same delivery staff
        if (session.staffId !== command.actorUserId) {
          throw AppError.fromCode(RR.FORBIDDEN, {
            details: {
              reason: 'RETURN_SESSION_STAFF_MISMATCH',
              sessionStaffId: session.staffId,
              actorStaffId: command.actorUserId,
            },
          })
        }

        // Idempotency: if already finalized, return existing document with canonical response
        if (session.status === RentalReturnSessionStatus.FINALIZED) {
          const existingDoc = await tx.rentalDocument.findUnique({
            where: {
              documentType_sourceRef: { documentType: RentalDocumentType.RETURN_RECEIPT, sourceRef: session.id },
            },
          })
          if (existingDoc) {
            const snap = existingDoc.snapshotJson as any
            const receivedUnitCount = Array.isArray(snap?.receivedUnits) ? snap.receivedUnits.length : 0
            const notReturnedUnitIds = Array.isArray(snap?.notReturnedUnitIdsAtSessionEnd)
              ? snap.notReturnedUnitIdsAtSessionEnd
              : []
            return {
              id: existingDoc.id,
              receiptDocumentId: existingDoc.id,
              documentId: existingDoc.id,
              type: existingDoc.documentType,
              documentType: existingDoc.documentType,
              documentNo: existingDoc.documentNumber,
              documentNumber: existingDoc.documentNumber,
              returnSessionId: session.id,
              sourceId: session.id,
              sourceRef: session.id,
              receivedUnitCount,
              notReturnedUnitIds,
              renderStatus: existingDoc.renderStatus,
              status: existingDoc.renderStatus,
              downloadReady:
                existingDoc.renderStatus === RentalDocumentRenderStatus.READY && Boolean(existingDoc.pdfStorageKey),
              pdfReady:
                existingDoc.renderStatus === RentalDocumentRenderStatus.READY && Boolean(existingDoc.pdfStorageKey),
              orderId: order.id,
              issuedAt: existingDoc.issuedAt?.toISOString(),
              hash: existingDoc.snapshotHash,
              snapshotHash: existingDoc.snapshotHash,
              immutableSnapshot: existingDoc.snapshotJson,
              snapshot: existingDoc.snapshotJson,
              policyVersion: existingDoc.policyVersion,
              templateVersion: existingDoc.templateVersion,
              version: existingDoc.version,
            }
          }
        }

        if (session.status !== RentalReturnSessionStatus.OPEN) {
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            details: { reason: 'RETURN_SESSION_NOT_OPEN', status: session.status },
          })
        }

        // Scans & Evidence guard: cannot finalize empty or duplicate-only session without failure evidence
        const rawReceived = Array.isArray(session.receivedUnits) ? (session.receivedUnits as any[]) : []
        const validScannedUnits = rawReceived.filter((u: any) => !u.duplicate)
        if (validScannedUnits.length === 0) {
          if (!primaryFailureEvidenceId && normalizedEvidenceIds.length === 0) {
            throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
              details: {
                reason: 'FAILED_COLLECTION_EVIDENCE_REQUIRED',
                message: 'Cannot finalize return receipt with zero scanned units without verified failure evidence',
                sessionId: session.id,
              },
            })
          }
        }

        // Validate all provided failure evidence IDs in transaction (exists, READY, valid scope, authorized owner)
        if (normalizedEvidenceIds.length > 0) {
          await validateEvidence(tx, actor.id, normalizedEvidenceIds, [
            MediaScope.RETURN_EVIDENCE,
            MediaScope.EXCEPTION_EVIDENCE,
            MediaScope.CONDITION_EVIDENCE,
          ])
        }

        const handoverDoc = await tx.rentalDocument.findFirst({
          where: { orderId: order.id, documentType: RentalDocumentType.HANDOVER },
        })
        if (!handoverDoc) {
          throw AppError.fromCode(RR.HANDOVER_DOCUMENT_REQUIRED, {
            details: { orderId: order.id, sessionId: session.id },
          })
        }

        const sessionUpdate = await tx.rentalReturnSession.updateMany({
          where: {
            id: session.id,
            version: session.version,
            status: RentalReturnSessionStatus.OPEN,
          },
          data: {
            status: RentalReturnSessionStatus.FINALIZED,
            finalizedAt: command.now,
            remarks: remarks ?? null,
            version: { increment: 1 },
          },
        })
        if (sessionUpdate.count === 0) {
          throw AppError.fromCode(RR.VERSION_CONFLICT, {
            details: { reason: 'RETURN_SESSION_VERSION_CONFLICT', sessionId: session.id },
          })
        }

        ;(session as any).failureEvidenceId = primaryFailureEvidenceId
        const receiptDoc = await issueReturnReceiptTx(tx, session.id, command.now, {
          failureEvidenceId: primaryFailureEvidenceId,
          evidenceIds: normalizedEvidenceIds,
          userRemarks,
        })

        await writeAudit(
          tx,
          actor.id,
          'RETURN_RECEIPT_ISSUED',
          'RentalDocument',
          receiptDoc.id,
          undefined,
          { documentNumber: receiptDoc.documentNumber, returnSessionId: session.id, orderId: order.id },
          command.idempotencyKey,
        )

        const snap = receiptDoc.snapshotJson as any
        const receivedUnitCount = Array.isArray(snap?.receivedUnits)
          ? snap.receivedUnits.length
          : validScannedUnits.length
        const notReturnedUnitIds = Array.isArray(snap?.notReturnedUnitIdsAtSessionEnd)
          ? snap.notReturnedUnitIdsAtSessionEnd
          : []

        return {
          id: receiptDoc.id,
          receiptDocumentId: receiptDoc.id,
          documentId: receiptDoc.id,
          type: receiptDoc.documentType,
          documentType: receiptDoc.documentType,
          documentNo: receiptDoc.documentNumber,
          documentNumber: receiptDoc.documentNumber,
          returnSessionId: session.id,
          sourceId: session.id,
          sourceRef: session.id,
          receivedUnitCount,
          notReturnedUnitIds,
          renderStatus: receiptDoc.renderStatus,
          status: receiptDoc.renderStatus,
          downloadReady:
            receiptDoc.renderStatus === RentalDocumentRenderStatus.READY && Boolean(receiptDoc.pdfStorageKey),
          pdfReady: receiptDoc.renderStatus === RentalDocumentRenderStatus.READY && Boolean(receiptDoc.pdfStorageKey),
          orderId: order.id,
          issuedAt: receiptDoc.issuedAt?.toISOString(),
          hash: receiptDoc.snapshotHash,
          snapshotHash: receiptDoc.snapshotHash,
          immutableSnapshot: receiptDoc.snapshotJson,
          snapshot: receiptDoc.snapshotJson,
          policyVersion: receiptDoc.policyVersion,
          templateVersion: receiptDoc.templateVersion,
          version: receiptDoc.version,
        }
      },
    )
  }

  private async recordDocumentAccessLog(
    documentIds: string[],
    actorUserId: string,
    action: 'LIST' | 'READ',
  ): Promise<void> {
    if (!documentIds.length) return
    try {
      if (this.prisma.rentalDocumentAccessLog?.createMany) {
        await this.prisma.rentalDocumentAccessLog.createMany({
          data: documentIds.map((id) => ({
            documentId: id,
            actorUserId,
            action,
          })),
        })
        return
      }
      if (this.prisma.rentalDocumentAccessLog?.create) {
        for (const id of documentIds) {
          await this.prisma.rentalDocumentAccessLog.create({
            data: { documentId: id, actorUserId, action },
          })
        }
        return
      }
      throw new Error('RENTAL_DOCUMENT_ACCESS_LOG_UNAVAILABLE')
    } catch (primaryError) {
      this.logger.warn(
        `Failed to persist RentalDocumentAccessLog for documents [${documentIds.join(', ')}], actor ${actorUserId}, action ${action}. Attempting fallback outbox entry. Error: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`,
      )
      try {
        if (this.prisma.rentalOutboxEvent?.create) {
          const timestamp = Date.now()
          for (const id of documentIds) {
            await this.prisma.rentalOutboxEvent.create({
              data: {
                deduplicationKey: `ACCESS_AUDIT_FALLBACK:${id}:${actorUserId}:${action}:${timestamp}`,
                eventType: 'RENTAL_DOCUMENT_ACCESS_AUDIT_FALLBACK',
                aggregateType: 'RentalDocument',
                aggregateId: id,
                payload: {
                  documentId: id,
                  actorUserId,
                  action,
                  attemptedAt: new Date(timestamp).toISOString(),
                  failureReason: primaryError instanceof Error ? primaryError.message : String(primaryError),
                },
                status: 'PENDING',
              },
            })
          }
          return
        }
        throw new Error('RENTAL_DOCUMENT_AUDIT_FALLBACK_UNAVAILABLE')
      } catch (fallbackError) {
        this.logger.error(
          `Fallback RentalOutboxEvent audit record also failed for documents [${documentIds.join(', ')}]. Error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
        )
        throw AppError.fromCode(RD.AUDIT_UNAVAILABLE)
      }
    }
  }

  // RB-API-1001 -------------------------------------------------------------
  async listRentalDocuments(query: ListRentalDocumentsQuery) {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { id: query.orderId },
      include: orderIncludeForDocumentAccess,
    })
    if (!order) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)

    if (!canActorAccessRentalDocuments(order, query.actorUserId, query.actorRole)) {
      throw AppError.fromCode(RR.FORBIDDEN, {
        details: { reason: 'UNAUTHORIZED_DOCUMENT_ACCESS', orderId: query.orderId, actorUserId: query.actorUserId },
      })
    }

    const page = Math.max(1, query.page || 1)
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20))
    const where: Prisma.RentalDocumentWhereInput = {
      orderId: query.orderId,
      ...(query.type ? { documentType: query.type } : {}),
    }

    const [total, docs] = await Promise.all([
      this.prisma.rentalDocument.count({ where }),
      this.prisma.rentalDocument.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    if (docs.length > 0) {
      await this.recordDocumentAccessLog(
        docs.map((d) => d.id),
        query.actorUserId,
        'LIST',
      )
    }

    return {
      items: docs.map((d) => ({
        id: d.id,
        documentId: d.id,
        type: d.documentType,
        documentType: d.documentType,
        documentNo: d.documentNumber,
        documentNumber: d.documentNumber,
        sourceId: d.sourceRef,
        sourceRef: d.sourceRef,
        rootDocumentId: d.rootDocumentId,
        renderStatus: d.renderStatus,
        status: d.renderStatus,
        downloadReady: d.renderStatus === RentalDocumentRenderStatus.READY && Boolean(d.pdfStorageKey),
        pdfReady: d.renderStatus === RentalDocumentRenderStatus.READY && Boolean(d.pdfStorageKey),
        orderId: d.orderId,
        issuedAt: d.issuedAt?.toISOString(),
        policyVersion: d.policyVersion,
        templateVersion: d.templateVersion,
        version: d.version,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  // RB-API-1002 -------------------------------------------------------------
  async getRentalDocument(query: GetRentalDocumentQuery) {
    const doc = await this.prisma.rentalDocument.findUnique({
      where: { id: query.documentId },
      include: {
        order: {
          include: orderIncludeForDocumentAccess,
        },
        rootChildren: { select: { id: true } },
      },
    })
    if (!doc) throw AppError.fromCode(RR.DOCUMENT_NOT_FOUND, { details: { documentId: query.documentId } })

    if (query.expectedOrderId && doc.orderId !== query.expectedOrderId) {
      throw AppError.fromCode(RR.DOCUMENT_NOT_FOUND, {
        details: { documentId: query.documentId, orderId: query.expectedOrderId },
      })
    }

    if (!canActorAccessRentalDocuments(doc.order, query.actorUserId, query.actorRole)) {
      throw AppError.fromCode(RR.FORBIDDEN, {
        details: {
          reason: 'UNAUTHORIZED_DOCUMENT_ACCESS',
          documentId: query.documentId,
          actorUserId: query.actorUserId,
        },
      })
    }

    await this.recordDocumentAccessLog([doc.id], query.actorUserId, 'READ')

    const relatedDocumentIds = [
      ...(doc.rootDocumentId ? [doc.rootDocumentId] : []),
      ...(doc.previousDocumentId ? [doc.previousDocumentId] : []),
      ...(doc.rootChildren || []).map((c: any) => c.id),
    ]

    return {
      id: doc.id,
      documentId: doc.id,
      orderId: doc.orderId,
      type: doc.documentType,
      documentType: doc.documentType,
      documentNo: doc.documentNumber,
      documentNumber: doc.documentNumber,
      sourceId: doc.sourceRef,
      sourceRef: doc.sourceRef,
      rootDocumentId: doc.rootDocumentId,
      renderStatus: doc.renderStatus,
      status: doc.renderStatus,
      downloadReady: doc.renderStatus === RentalDocumentRenderStatus.READY && Boolean(doc.pdfStorageKey),
      pdfReady: doc.renderStatus === RentalDocumentRenderStatus.READY && Boolean(doc.pdfStorageKey),
      hash: doc.snapshotHash,
      snapshotHash: doc.snapshotHash,
      immutableSnapshot: doc.snapshotJson,
      snapshot: doc.snapshotJson,
      relatedDocumentIds,
      issuedAt: doc.issuedAt?.toISOString(),
      policyVersion: doc.policyVersion,
      templateVersion: doc.templateVersion,
      version: doc.version,
    }
  }

  private async runIdempotentMutation<T>(
    scope: string,
    userId: string,
    idempotencyKey: string,
    request: unknown,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const requestHash = sha256(stableJson(request))
    try {
      return await this.prisma.$transaction(async (tx) => {
        const cached = await tx.idempotencyRecord.findUnique({
          where: { scope_userId_idempotencyKey: { scope, userId, idempotencyKey } },
        })
        if (cached) {
          if (cached.requestHash !== requestHash) throw AppError.fromCode(RR.IDEMPOTENCY_KEY_REUSED)
          if (cached.responseBody) return cached.responseBody as unknown as T
          throw AppError.fromCode(RR.OPERATION_CONFLICT)
        }
        await tx.idempotencyRecord.create({ data: { scope, userId, idempotencyKey, requestHash } })
        const result = await work(tx)
        await tx.idempotencyRecord.update({
          where: { scope_userId_idempotencyKey: { scope, userId, idempotencyKey } },
          data: { responseStatus: 200, responseBody: jsonValue(result), completedAt: new Date() },
        })
        return result
      }, {
        maxWait: 10_000,
        timeout: 30_000,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw AppError.fromCode(RR.OPERATION_CONFLICT)
      throw error
    }
  }
}

// Helpers --------------------------------------------------------------------
const orderIncludeForDocumentAccess = {
  deliveryTasksViaOrderId: { select: { staffId: true, taskType: true } },
  inventoryTaskViaOrderId: { select: { staffId: true } },
} as const

function canActorAccessRentalDocuments(
  order: {
    userId: string
    deliveryTasksViaOrderId?: Array<{ staffId: string | null; taskType: DeliveryTaskType }>
    inventoryTaskViaOrderId?: { staffId: string | null } | null
  },
  actorUserId: string,
  actorRole?: string,
): boolean {
  if (actorRole === UserRole.ADMIN) return true
  if (order.userId === actorUserId) return true
  if (actorRole === UserRole.STAFF_DELIVERY) {
    return (order.deliveryTasksViaOrderId || []).some(
      (t) => t.taskType === DeliveryTaskType.RETURN && t.staffId === actorUserId,
    )
  }
  if (actorRole === UserRole.STAFF_INVENTORY) {
    return order.inventoryTaskViaOrderId?.staffId === actorUserId
  }
  return false
}

const returnOrderInclude = {
  rentalPolicy: true,
  packageViaOrderId: true,
  inventoryTaskViaOrderId: true,
  deliveryTasksViaOrderId: true,
  depositSettlementViaOrderId: { include: { depositSettlementItemsViaSettlementId: true } },
  rentalOrderLinesViaOrderId: {
    include: {
      product: true,
      rentalUnitAssignmentsViaOrderLineId: {
        include: { equipmentUnit: { include: { product: true } }, returnInspectionsViaAssignmentId: true },
      },
    },
  },
} as const

const returnDetailOrderInclude = {
  trip: { select: { title: true } },
  user: { select: { fullName: true } },
  recipientParticipant: { select: { fullName: true } },
  packageViaOrderId: true,
  conditionSnapshotsViaOrderId: true,
  returnInspectionsViaOrderId: { include: { findingsViaInspectionId: true } },
  depositSettlementViaOrderId: {
    include: { depositSettlementItemsViaSettlementId: { include: { refundViaDepositSettlementItemId: true } } },
  },
  rentalOrderLinesViaOrderId: {
    include: { product: true, rentalUnitAssignmentsViaOrderLineId: { include: { equipmentUnit: true } } },
  },
} as const

async function getReturnOrder(tx: Prisma.TransactionClient, orderId: string): Promise<any> {
  return tx.rentalOrder.findUnique({ where: { id: orderId }, include: returnOrderInclude })
}

async function requireActiveRole(client: any, userId: string, role: UserRole | UserRole[]) {
  const roles = Array.isArray(role) ? role : [role]
  const user = client.user?.findFirst
    ? await client.user.findFirst({
        where: { id: userId, role: { in: roles }, status: UserStatus.ACTIVE },
        select: { id: true, role: true },
      })
    : client.user?.findUnique
      ? await client.user.findUnique({ where: { id: userId } })
      : null
  if (!user || (user.status && user.status !== UserStatus.ACTIVE)) throw AppError.fromCode(RR.FORBIDDEN)
  return user
}

async function assertStaffScope(client: any, userId: string, actorRole: string, roles: UserRole[]) {
  if (!roles.includes(actorRole as UserRole)) throw AppError.fromCode(RR.FORBIDDEN)
  const user = client.user?.findFirst
    ? await client.user.findFirst({
        where: { id: userId, role: actorRole as UserRole, status: UserStatus.ACTIVE },
        select: { id: true },
      })
    : client.user?.findUnique
      ? await client.user.findUnique({ where: { id: userId } })
      : null
  if (!user) throw AppError.fromCode(RR.FORBIDDEN)
}

async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  if (typeof (tx as any).$queryRaw === 'function') {
    await (tx as any).$queryRaw`SELECT id FROM rental_orders WHERE id = ${orderId}::uuid FOR UPDATE`
  }
}
async function lockUnit(tx: Prisma.TransactionClient, unitId: string) {
  await tx.$queryRaw`SELECT id FROM equipment_units WHERE id = ${unitId}::uuid FOR UPDATE`
}
async function lockDeliveryTask(tx: Prisma.TransactionClient, taskId: string) {
  await tx.$queryRaw`SELECT id FROM delivery_tasks WHERE id = ${taskId}::uuid FOR UPDATE`
  return tx.deliveryTask.findUnique({ where: { id: taskId } })
}
function assertExpectedVersion(actual: number, expected: number) {
  if (actual !== expected)
    throw AppError.fromCode(RR.VERSION_CONFLICT, { details: { expectedVersion: expected, currentVersion: actual } })
}

async function validateEvidence(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  ids: string[],
  scopes: MediaScope[],
) {
  if (!ids.length) return
  const unique = [...new Set(ids)]
  const rows = tx.mediaAsset?.findMany
    ? await tx.mediaAsset.findMany({
        where: {
          id: { in: unique },
          status: MediaStatus.READY,
          scope: { in: scopes },
          OR: [{ ownerUserId: actorUserId }, { ownerUserId: null }],
        },
        select: { id: true },
      })
    : []
  if (rows.length === unique.length && typeof tx.mediaAsset?.updateMany === 'function') {
    await tx.mediaAsset.updateMany({ where: { id: { in: unique } }, data: { retentionUntil: null } })
  }
  if (rows.length !== unique.length) {
    throw AppError.fromCode(RR.EVIDENCE_NOT_READY, {
      details: { requested: unique.length, valid: rows.length, reason: 'EVIDENCE_NOT_READY_OR_FOREIGN' },
    })
  }
}

/**
 * B6 decides that a returned unit is refundable; the Shared Payment worker
 * is the ONLY writer of provider-scoped Refund / RefundAllocation records.
 * No unscoped Refund row or pretend external refund is created here.
 * For a zero-deduction NORMAL return the verified preliminary inspection
 * authorizes an automatic refund; positive deductions still require ADMIN.
 */
async function ensureDepositRefund(
  tx: Prisma.TransactionClient,
  order: any,
  depositItem: any,
  inspectionId: string,
  actorUserId: string,
  now: Date,
  keySuffix: string,
  overrideAmount?: Prisma.Decimal,
) {
  const amount = overrideAmount ?? depositItem.depositAmount
  if (amount.lessThanOrEqualTo(0)) throw AppError.fromCode(RR.PAYMENT_RECONCILIATION_REQUIRED)
  const existingRefund = await tx.refund.findUnique({ where: { depositSettlementItemId: depositItem.id } })
  if (existingRefund) return existingRefund
  // Do not incorrectly attribute a refund to the fee-only extension invoice.
  const payment = await findSucceededRentalPayment(tx, order.id)
  if (!payment || !payment.providerEnvironment || !payment.merchantAccountKey)
    throw AppError.fromCode(RR.PAYMENT_RECONCILIATION_REQUIRED)
  const current = await tx.depositSettlementItem.findUniqueOrThrow({ where: { id: depositItem.id } })
  const noDeduction = current.deductionAmount.equals(0) && amount.equals(current.depositAmount)
  if (!noDeduction && (!current.approvedAt || !current.approvedBy || !current.decisionSnapshot))
    throw AppError.fromCode(RR.PAYMENT_RECONCILIATION_REQUIRED)
  const decision =
    current.decisionSnapshot && typeof current.decisionSnapshot === 'object' && !Array.isArray(current.decisionSnapshot)
      ? (current.decisionSnapshot as Record<string, unknown>)
      : {}
  await tx.depositSettlementItem.update({
    where: { id: depositItem.id },
    data: {
      inspectionId,
      refundAmount: amount,
      status: DepositItemStatus.REFUND_PENDING,
      // No automatic deduction. The inspection is the evidence for the automatic full return.
      approvedAt: current.approvedAt ?? (noDeduction ? now : undefined),
      approvedBy: current.approvedBy ?? (noDeduction ? actorUserId : undefined),
      decisionSnapshot: jsonValue({
        ...decision,
        refundDecision: noDeduction ? 'NORMAL_NO_DEDUCTION' : 'ADMIN_APPROVED',
        inspectionId,
        unitId: current.unitId,
      }),
      version: { increment: 1 },
    },
  })
  // RentalDepositWorker dispatches the real request through PaymentsPort.requestRefund;
  // the provider result is consumed from Shared Payment's REFUND_SUCCEEDED/FAILED.
  await tx.rentalOutboxEvent.upsert({
    where: { deduplicationKey: `deposit-refund-approved:${depositItem.id}` },
    update: {},
    create: {
      deduplicationKey: `deposit-refund-approved:${depositItem.id}`,
      eventType: 'RENTAL_DEPOSIT_REFUND_APPROVED',
      aggregateType: 'RentalOrder',
      aggregateId: order.id,
      payload: jsonValue({
        orderId: order.id,
        depositSettlementItemId: depositItem.id,
        approvedAmount: amount.toFixed(),
        requestedBy: actorUserId,
        requestedAt: now.toISOString(),
        operation: keySuffix,
      }),
    },
  })
  return { id: null as string | null, status: RefundStatus.PENDING }
}

async function findSucceededRentalPayment(tx: Prisma.TransactionClient, orderId: string) {
  // Extension invoices contain FEES ONLY. The initial invoice owns deposit money.
  return tx.payment.findFirst({
    where: {
      status: PaymentStatus.SUCCEEDED,
      invoice: { rentalOrderId: orderId },
      application: { status: 'APPLIED' },
      allocations: { some: { component: 'RENTAL_DEPOSIT', rentalOrderLine: { orderId } } },
    },
    orderBy: { paidAt: 'asc' },
  })
}

async function ensureReviewCase(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string
    assignmentId?: string
    unitId?: string
    inspectionId?: string
    caseType: RentalExceptionType
    openedBy?: string
    reason: string
    evidenceIds: string[]
    dueAt: Date | null
  },
) {
  const existing = await tx.rentalExceptionCase.findFirst({
    where: {
      orderId: input.orderId,
      assignmentId: input.assignmentId,
      inspectionId: input.inspectionId,
      caseType: input.caseType,
      status: { in: [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW] },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return existing
  return tx.rentalExceptionCase.create({
    data: {
      orderId: input.orderId,
      assignmentId: input.assignmentId,
      unitId: input.unitId,
      inspectionId: input.inspectionId,
      caseType: input.caseType,
      status: RentalExceptionCaseStatus.OPEN,
      openedBy: input.openedBy,
      reason: input.reason,
      evidenceIds: jsonValue(input.evidenceIds),
      dueAt: input.dueAt,
    },
  })
}

/**
 * Records a break in the Delivery -> Inventory custody chain.
 * The customer already returned this unit, so this case must never be treated
 * as customer-side MISSING_PENDING_REVIEW or as an automatic deduction.
 */
async function openDeliveryCustodyDiscrepancy(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string
    assignment: any
    openedBy: string
    reasonCode: string
    incidentNote: string
  },
) {
  if (!input.assignment)
    throw AppError.fromCode(RR.UNIT_NOT_IN_RENTAL, { details: { reason: 'CUSTODY_ASSIGNMENT_NOT_FOUND' } })
  const preliminary = await tx.returnInspection.findUnique({
    where: {
      assignmentId_stage: {
        assignmentId: input.assignment.id,
        stage: InspectionStage.PRELIMINARY,
      },
    },
  })
  if (!preliminary)
    throw AppError.fromCode(RR.RETURN_NOT_READY, {
      details: { unitId: input.assignment.equipmentUnitId, reason: 'PRELIMINARY_INSPECTION_REQUIRED' },
    })
  const reason = `${input.reasonCode}: ${input.incidentNote}`
  const evidenceIds = stringArray(preliminary.evidenceIds)
  const exceptionCase = await ensureReviewCase(tx, {
    orderId: input.orderId,
    assignmentId: input.assignment.id,
    unitId: input.assignment.equipmentUnitId,
    inspectionId: preliminary.id,
    caseType: RentalExceptionType.OTHER,
    openedBy: input.openedBy,
    reason,
    evidenceIds,
    dueAt: null,
  })
  await tx.depositSettlementItem.updateMany({
    where: { assignmentId: input.assignment.id, status: { not: DepositItemStatus.SETTLED } },
    data: {
      status: DepositItemStatus.REVIEW_REQUIRED,
      inspectionId: preliminary.id,
      reason: DELIVERY_CUSTODY_DISCREPANCY,
      version: { increment: 1 },
    },
  })
  return {
    id: exceptionCase.id,
    unitId: input.assignment.equipmentUnitId,
    reason: DELIVERY_CUSTODY_DISCREPANCY,
    customerLiability: false,
  }
}

async function closeResolvedDeliveryCustodyChain(
  tx: Prisma.TransactionClient,
  orderId: string,
  now: Date,
) {
  const pendingTransfers = await tx.returnCustodyTransfer.findMany({
    where: { orderId, status: CustodyTransferStatus.PENDING_RECEIPT },
  })
  for (const transfer of pendingTransfers) {
    const received = new Set(stringArray(transfer.receivedUnitIds))
    const missing = stringArray(transfer.unitIds).filter((unitId) => !received.has(unitId))
    const unresolved = missing.length
      ? await tx.rentalExceptionCase.count({
          where: {
            orderId,
            unitId: { in: missing },
            caseType: RentalExceptionType.OTHER,
            reason: { startsWith: DELIVERY_CUSTODY_DISCREPANCY },
            status: { in: [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW] },
          },
        })
      : 0
    if (!unresolved) {
      await tx.returnCustodyTransfer.update({
        where: { id: transfer.id },
        data: {
          status: CustodyTransferStatus.CANCELLED,
          cancelledAt: now,
          monitoringStatus: 'RESOLVED_WITH_CUSTODY_EXCEPTION',
          version: { increment: 1 },
        },
      })
    }
  }
  const openCustodyCases = await tx.rentalExceptionCase.count({
    where: {
      orderId,
      caseType: RentalExceptionType.OTHER,
      reason: { startsWith: DELIVERY_CUSTODY_DISCREPANCY },
      status: { in: [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW] },
    },
  })
  if (openCustodyCases) return
  await tx.deliveryTask.updateMany({
    where: { orderId, taskType: DeliveryTaskType.RETURN, status: DeliveryTaskStatus.RETURNED },
    data: { status: DeliveryTaskStatus.CLOSED, version: { increment: 1 } },
  })
  await tx.package.updateMany({
    where: { orderId, status: PackageStatus.RETURNING },
    data: { status: PackageStatus.CLOSED, version: { increment: 1 } },
  })
}

const refundReviewReference = (refundId: string) => `[refund:${refundId}]`

function refundIdFromReviewReason(reason: string): string | null {
  return reason.match(/\[refund:([0-9a-f-]{36})\]/i)?.[1] ?? null
}

async function materializeRefundReviewCases(tx: Prisma.TransactionClient) {
  const refunds = await tx.refund.findMany({
    where: {
      reconcileStatus: 'NEEDS_REVIEW',
      status: { in: [RefundStatus.PENDING, RefundStatus.PROCESSING] },
      OR: [
        { rentalOrderId: { not: null } },
        { depositSettlementId: { not: null } },
        { depositSettlementItemId: { not: null } },
      ],
    },
    select: {
      id: true,
      rentalOrderId: true,
      lastErrorCode: true,
      depositSettlement: { select: { orderId: true } },
      depositSettlementItem: {
        select: { settlement: { select: { orderId: true } } },
      },
    },
  })
  for (const refund of refunds) {
    const rentalOrderId =
      refund.rentalOrderId ??
      refund.depositSettlement?.orderId ??
      refund.depositSettlementItem?.settlement.orderId
    if (!rentalOrderId) continue
    const reference = refundReviewReference(refund.id)
    const existing = await tx.rentalExceptionCase.findFirst({
      where: {
        orderId: rentalOrderId,
        caseType: RentalExceptionType.REFUND_FAILURE,
        status: { in: [RentalExceptionCaseStatus.OPEN, RentalExceptionCaseStatus.UNDER_REVIEW] },
        reason: { contains: reference },
      },
      select: { id: true },
    })
    if (!existing) {
      await tx.rentalExceptionCase.create({
        data: {
          orderId: rentalOrderId,
          caseType: RentalExceptionType.REFUND_FAILURE,
          status: RentalExceptionCaseStatus.OPEN,
          reason: `${reference} ${refund.lastErrorCode ?? 'REFUND_RECONCILIATION_REQUIRED'}`,
          evidenceIds: jsonValue([]),
        },
      })
    }
    await tx.rentalOrder.updateMany({
      where: { id: rentalOrderId, exceptionStatus: { not: RentalOrderExceptionStatus.ACTION_REQUIRED } },
      data: { exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED, version: { increment: 1 } },
    })
  }
}

function policyDueAt(minutes: number | null | undefined, now: Date): Date | null {
  return minutes && minutes > 0 ? new Date(now.getTime() + minutes * 60_000) : null
}

function calculateRuleDeduction(
  rule: any,
  orderLine: any,
  depositAmount: Prisma.Decimal,
  quantity: number,
): Prisma.Decimal {
  const value = new Prisma.Decimal(rule.deductionValue)
  if (rule.deductionType === DamageDeductionType.FIXED) return value.mul(quantity)
  if (rule.deductionType === DamageDeductionType.PERCENT_DEPOSIT) return depositAmount.mul(value).div(100).mul(quantity)
  if (rule.deductionType === DamageDeductionType.PERCENT_REPLACEMENT_VALUE)
    return new Prisma.Decimal(orderLine.replacementValueSnapshot).mul(value).div(100).mul(quantity)
  return new Prisma.Decimal(0)
}

async function refreshSettlementAggregate(tx: Prisma.TransactionClient, orderId: string, now: Date) {
  const settlement = await tx.depositSettlement.findUnique({
    where: { orderId },
    include: {
      depositSettlementItemsViaSettlementId: {
        include: {
          refundViaDepositSettlementItemId: true,
          depositRefundAllocations: { include: { refund: true } },
        },
      },
    },
  })
  if (!settlement) return null
  let totalDeduction = new Prisma.Decimal(0)
  let refundAmount = new Prisma.Decimal(0)
  let allSettled = true
  let hasActionRequired = false
  for (const item of settlement.depositSettlementItemsViaSettlementId) {
    totalDeduction = totalDeduction.add(item.deductionAmount)
    const groupedAlloc = item.depositRefundAllocations?.[0]
    const refund = groupedAlloc?.refund ?? item.refundViaDepositSettlementItemId
    if (refund?.status === RefundStatus.SUCCEEDED) {
      const amount = groupedAlloc ? groupedAlloc.amount : refund.amount
      refundAmount = refundAmount.add(amount)
    }
    if (item.status !== DepositItemStatus.SETTLED) allSettled = false
    if ([DepositItemStatus.REVIEW_REQUIRED, DepositItemStatus.REFUND_FAILED].includes(item.status as any))
      hasActionRequired = true
  }
  const status = allSettled
    ? DepositSettlementStatus.SETTLED
    : hasActionRequired
      ? DepositSettlementStatus.ACTION_REQUIRED
      : refundAmount.greaterThan(0) || totalDeduction.greaterThan(0)
        ? DepositSettlementStatus.PARTIALLY_SETTLED
        : DepositSettlementStatus.OPEN
  const outcome = allSettled
    ? totalDeduction.equals(0)
      ? DepositSettlementOutcome.FULL_REFUND
      : refundAmount.equals(0)
        ? DepositSettlementOutcome.FULL_DEDUCTION
        : DepositSettlementOutcome.PARTIAL_REFUND
    : null
  const updated = await tx.depositSettlement.update({
    where: { id: settlement.id },
    data: {
      totalDeduction,
      refundAmount,
      status,
      outcome,
      settledAt: allSettled ? now : null,
      version: { increment: 1 },
    },
  })
  const hasFailedOrPendingItem = settlement.depositSettlementItemsViaSettlementId.some((item) =>
    [DepositItemStatus.REFUND_PENDING, DepositItemStatus.REFUND_FAILED].includes(item.status as any),
  )
  const orderFinancialStatus = allSettled
    ? RentalFinancialStatus.SETTLED
    : refundAmount.greaterThan(0)
      ? RentalFinancialStatus.PARTIALLY_REFUNDED
      : hasFailedOrPendingItem
        ? RentalFinancialStatus.REFUND_PENDING
        : RentalFinancialStatus.PAID
  await tx.rentalOrder.update({
    where: { id: orderId },
    data: {
      financialStatus: orderFinancialStatus,
      ...(hasActionRequired ? { exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED } : {}),
      version: { increment: 1 },
    },
  })
  return {
    id: updated.id,
    status: updated.status,
    outcome: updated.outcome,
    totalDeposit: decimalToInteger(updated.totalDeposit),
    deductionAmount: decimalToInteger(updated.totalDeduction),
    refundedAmount: decimalToInteger(updated.refundAmount),
    version: updated.version,
  }
}

export async function tryCompleteOrder(tx: Prisma.TransactionClient, orderId: string, now: Date): Promise<boolean> {
  await lockOrder(tx, orderId)
  const order = await tx.rentalOrder.findUnique({
    where: { id: orderId },
    include: {
      rentalOrderLinesViaOrderId: { include: { rentalUnitAssignmentsViaOrderLineId: true } },
      depositSettlementViaOrderId: { include: { depositSettlementItemsViaSettlementId: true } },
      rentalExceptionCasesViaOrderId: true,
      deliveryTasksViaOrderId: true,
      packageViaOrderId: true,
      returnCustodyTransfersViaOrderId: true,
      rentalReturnSessionsViaOrderId: true,
    },
  })
  if (!order) return false
  if (order.status === RentalOrderStatus.COMPLETED) return true

  // 1. Guard order status: only allowed to complete from RETURN_PROCESSING or RETURN_PENDING (Positive allowlist)
  const allowedOrderStatuses: RentalOrderStatus[] = [
    RentalOrderStatus.RETURN_PROCESSING,
    RentalOrderStatus.RETURN_PENDING,
  ]
  if (!allowedOrderStatuses.includes(order.status)) {
    return false
  }

  // 2. Physical Custody: POSITIVE ALLOWLIST - every transfer must be terminal with valid receipt/cancellation.
  // EXPIRED, PENDING_RECEIPT or unacknowledged transfers are strictly rejected.
  const custodyTransfers = order.returnCustodyTransfersViaOrderId || []
  const allowedCustodyStatuses: CustodyTransferStatus[] = [
    CustodyTransferStatus.RECEIVED,
    CustodyTransferStatus.CANCELLED,
  ]
  const custodyTerminal = custodyTransfers.every((t) => allowedCustodyStatuses.includes(t.status as any))
  if (!custodyTerminal) return false

  // 3. Delivery Tasks: POSITIVE ALLOWLIST
  // Return tasks must be strictly INVENTORY_RECEIVED, CLOSED, or CANCELLED.
  // Rejects BLOCKED, NO_SHOW, REFUSED, SCHEDULED, COLLECTING, RETURNED, PACKAGE_RECEIVED, RECIPIENT_VERIFIED, HANDED_OVER.
  const returnTasks = (order.deliveryTasksViaOrderId || []).filter((t) => t.taskType === DeliveryTaskType.RETURN)
  const allowedReturnTaskStatuses: DeliveryTaskStatus[] = [
    DeliveryTaskStatus.INVENTORY_RECEIVED,
    DeliveryTaskStatus.CLOSED,
    DeliveryTaskStatus.CANCELLED,
  ]
  const returnTasksTerminal = returnTasks.every((t) => allowedReturnTaskStatuses.includes(t.status as any))
  if (!returnTasksTerminal) return false

  // Non-return (outbound delivery) tasks must also be terminal: HANDED_OVER, CLOSED, CANCELLED
  const nonReturnTasks = (order.deliveryTasksViaOrderId || []).filter((t) => t.taskType !== DeliveryTaskType.RETURN)
  const allowedNonReturnTaskStatuses: DeliveryTaskStatus[] = [
    DeliveryTaskStatus.HANDED_OVER,
    DeliveryTaskStatus.CLOSED,
    DeliveryTaskStatus.CANCELLED,
  ]
  const nonReturnTasksTerminal = nonReturnTasks.every((t) => allowedNonReturnTaskStatuses.includes(t.status as any))
  if (!nonReturnTasksTerminal) return false

  // 4. Package: POSITIVE ALLOWLIST - must be RETURNED_TO_INVENTORY, CLOSED, or CANCELLED.
  // Rejects OPEN, PACKED, READY, TRANSFERRED_TO_DELIVERY, HANDED_OVER, RETURNING.
  if (order.packageViaOrderId) {
    const pkgStatus = order.packageViaOrderId.status as any
    const allowedPackageStatuses: PackageStatus[] = [
      PackageStatus.RETURNED_TO_INVENTORY,
      PackageStatus.CLOSED,
      PackageStatus.CANCELLED,
    ]
    if (!allowedPackageStatuses.includes(pkgStatus)) {
      return false
    }
  }

  // 5. Return Sessions: POSITIVE ALLOWLIST - all sessions must be FINALIZED or CANCELLED.
  // Rejects OPEN.
  const returnSessions = order.rentalReturnSessionsViaOrderId || []
  const allowedSessionStatuses: RentalReturnSessionStatus[] = [RentalReturnSessionStatus.FINALIZED]
  const sessionsTerminal = returnSessions.every((s) => allowedSessionStatuses.includes(s.status as any))
  if (!sessionsTerminal) return false

  // 6. Unit assignments: all active assignments must be CLOSED (Positive check)
  const assignments = (order.rentalOrderLinesViaOrderId || [])
    .flatMap((line) => line.rentalUnitAssignmentsViaOrderLineId)
    .filter(
      (item) =>
        ![RentalUnitAssignmentStatus.REPLACED, RentalUnitAssignmentStatus.UNASSIGNED].includes(item.status as any),
    )
  const assetsFinal =
    assignments.length > 0 && assignments.every((item) => item.status === RentalUnitAssignmentStatus.CLOSED)
  if (!assetsFinal) return false

  // 7. Deposit items: all must be SETTLED (Positive check)
  const financeFinal =
    Boolean(order.depositSettlementViaOrderId) &&
    order.depositSettlementViaOrderId!.depositSettlementItemsViaSettlementId.length > 0 &&
    order.depositSettlementViaOrderId!.depositSettlementItemsViaSettlementId.every(
      (item) => item.status === DepositItemStatus.SETTLED,
    )
  if (!financeFinal) return false

  // 8. Exception cases: all must be terminal (RESOLVED, REJECTED, CLOSED) (Positive allowlist)
  const allowedCaseStatuses: RentalExceptionCaseStatus[] = [
    RentalExceptionCaseStatus.RESOLVED,
    RentalExceptionCaseStatus.REJECTED,
    RentalExceptionCaseStatus.CLOSED,
  ]
  const casesFinal = (order.rentalExceptionCasesViaOrderId || []).every((item) =>
    allowedCaseStatuses.includes(item.status as any),
  )
  if (!casesFinal) return false

  // 9. Atomic CAS update on RentalOrder (guards against concurrent closure from cron and payment worker)
  let updatedCount = 1
  if (typeof (tx.rentalOrder as any).updateMany === 'function') {
    const updated = await (tx.rentalOrder as any).updateMany({
      where: {
        id: order.id,
        version: order.version,
        status: { in: [RentalOrderStatus.RETURN_PROCESSING, RentalOrderStatus.RETURN_PENDING] },
      },
      data: {
        status: RentalOrderStatus.COMPLETED,
        exceptionStatus: RentalOrderExceptionStatus.NONE,
        financialStatus: RentalFinancialStatus.SETTLED,
        completedAt: now,
        version: { increment: 1 },
      },
    })
    updatedCount = updated.count
  } else if (typeof tx.rentalOrder.update === 'function') {
    await tx.rentalOrder.update({
      where: { id: order.id },
      data: {
        status: RentalOrderStatus.COMPLETED,
        exceptionStatus: RentalOrderExceptionStatus.NONE,
        financialStatus: RentalFinancialStatus.SETTLED,
        completedAt: now,
        version: { increment: 1 },
      },
    })
  }
  if (updatedCount === 0) {
    // Concurrent update already transitioned the order
    return false
  }

  // 10. Post-completion transition: only transition tasks/packages that were already in INVENTORY_RECEIVED / RETURNED_TO_INVENTORY
  for (const t of returnTasks) {
    if (t.status === DeliveryTaskStatus.INVENTORY_RECEIVED) {
      await tx.deliveryTask.update({
        where: { id: t.id },
        data: { status: DeliveryTaskStatus.CLOSED, version: { increment: 1 } },
      })
    }
  }
  if (order.packageViaOrderId && order.packageViaOrderId.status === PackageStatus.RETURNED_TO_INVENTORY) {
    await tx.package.update({
      where: { id: order.packageViaOrderId.id },
      data: { status: PackageStatus.CLOSED, version: { increment: 1 } },
    })
  }

  // 11. Phase 09/10 System Audit Trail (attributed to SYSTEM actor)
  await writeAudit(
    tx,
    null,
    'RENTAL_ORDER_CLOSED',
    'RentalOrder',
    order.id,
    { status: order.status, version: order.version },
    {
      status: RentalOrderStatus.COMPLETED,
      financialStatus: RentalFinancialStatus.SETTLED,
      completedAt: now.toISOString(),
      actorType: 'SYSTEM',
    },
  )

  // 12. Phase 09 Official Outbox Notifications
  const payload = jsonValue({
    orderId: order.id,
    bookingId: order.bookingId,
    status: RentalOrderStatus.COMPLETED,
    financialStatus: RentalFinancialStatus.SETTLED,
    completedAt: now.toISOString(),
  })
  await tx.rentalOutboxEvent.upsert({
    where: { deduplicationKey: `rental-order-closed:${order.id}` },
    update: {},
    create: {
      deduplicationKey: `rental-order-closed:${order.id}`,
      eventType: 'RENTAL_ORDER_CLOSED',
      aggregateType: 'RentalOrder',
      aggregateId: order.id,
      payload,
    },
  })
  await tx.rentalOutboxEvent.upsert({
    where: { deduplicationKey: `rental-closed:${order.id}` },
    update: {},
    create: {
      deduplicationKey: `rental-closed:${order.id}`,
      eventType: 'RENTAL_CLOSED',
      aggregateType: 'RentalOrder',
      aggregateId: order.id,
      payload,
    },
  })
  return true
}

async function hasInventoryLocationReceipt(
  tx: Prisma.TransactionClient,
  orderId: string,
  unitId: string,
): Promise<boolean> {
  return Boolean(
    await tx.custodyEvent.findFirst({
      where: { orderId, unitId, eventType: CustodyEventType.DELIVERY_TO_INVENTORY },
      select: { id: true },
    }),
  )
}
async function allUnitsHaveInventoryLocationReceipt(
  tx: Prisma.TransactionClient,
  orderId: string,
  unitIds: string[],
): Promise<boolean> {
  if (!unitIds.length) return false
  const count = await tx.custodyEvent.count({
    where: { orderId, unitId: { in: unitIds }, eventType: CustodyEventType.DELIVERY_TO_INVENTORY },
  })
  return count >= new Set(unitIds).size
}

function mapReturnQueueItem(task: any) {
  const inspections = task.order.returnInspectionsViaOrderId ?? []
  const items = task.order.depositSettlementViaOrderId?.depositSettlementItemsViaSettlementId ?? []
  const normalCount = inspections.filter(
    (item: any) => item.stage === InspectionStage.PRELIMINARY && item.outcome === ReturnInspectionOutcome.NORMAL,
  ).length
  const issueCount = inspections.filter((item: any) =>
    [ReturnInspectionOutcome.ISSUE, ReturnInspectionOutcome.DAMAGE_CONFIRMED].includes(item.outcome),
  ).length
  const missingCount = inspections.filter(
    (item: any) => item.outcome === ReturnInspectionOutcome.MISSING_PENDING_REVIEW,
  ).length
  let status = 'INVENTORY_RECEIVED'
  if (items.some((item: any) => item.status === DepositItemStatus.REVIEW_REQUIRED)) status = 'REVIEW_REQUIRED'
  else if (task.status === DeliveryTaskStatus.RETURNED) status = 'TRANSFER_PENDING'
  else if (
    items.some((item: any) => item.status === DepositItemStatus.SETTLED) &&
    task.order.status === RentalOrderStatus.COMPLETED
  )
    status = 'COMPLETED'
  else if (task.status === DeliveryTaskStatus.INVENTORY_RECEIVED) status = 'WAITING_CLEANING'
  return {
    id: task.id,
    orderId: task.orderId,
    tripTitle: task.order.trip?.title ?? null,
    customerName: task.order.recipientParticipant?.fullName ?? task.order.user?.fullName ?? null,
    status,
    normalCount,
    issueCount,
    missingCount,
    scheduledAt: task.scheduledAt?.toISOString() ?? null,
    version: task.version,
  }
}

function buildReturnDetail(task: any) {
  const order = task.order
  const assignments = order.rentalOrderLinesViaOrderId.flatMap((line: any) =>
    line.rentalUnitAssignmentsViaOrderLineId.map((assignment: any) => ({ ...assignment, product: line.product })),
  )
  const inspections = new Map(
    order.returnInspectionsViaOrderId.map((inspection: any) => [
      `${inspection.assignmentId}:${inspection.stage}`,
      inspection,
    ]),
  )
  const depositItems = new Map(
    (order.depositSettlementViaOrderId?.depositSettlementItemsViaSettlementId ?? []).map((item: any) => [
      item.assignmentId,
      item,
    ]),
  )
  const expectedUnits = assignments.map((assignment: any) => ({
    unitId: assignment.equipmentUnitId,
    assetCode: assignment.equipmentUnit.assetCode,
    productId: assignment.product.id,
    productName: assignment.product.name,
    assignmentStatus: assignment.status,
    unitStatus: assignment.equipmentUnit.status,
    unitCondition: assignment.equipmentUnit.condition,
    unitVersion: assignment.equipmentUnit.version,
  }))
  const receivedUnits = assignments
    .filter((assignment: any) => assignment.returnedAt)
    .map((assignment: any) => ({
      unitId: assignment.equipmentUnitId,
      assetCode: assignment.equipmentUnit.assetCode,
      receivedAt: assignment.returnedAt.toISOString(),
    }))
  const missingUnits = assignments
    .filter((assignment: any) => !assignment.returnedAt)
    .map((assignment: any) => ({ unitId: assignment.equipmentUnitId, assetCode: assignment.equipmentUnit.assetCode }))
  const transfer = (task.returnCustodyTransfersViaDeliveryTaskId ?? []).find(
    (item: any) => item.status === CustodyTransferStatus.PENDING_RECEIPT,
  ) ?? task.returnCustodyTransfersViaDeliveryTaskId?.[0] ?? null
  return {
    id: task.id,
    orderId: order.id,
    tripTitle: order.trip?.title ?? null,
    customerName: order.recipientParticipant?.fullName ?? order.user?.fullName ?? null,
    status: task.status,
    version: task.version,
    pendingTransfer: transfer
      ? {
          id: transfer.id,
          inventoryLocationId: transfer.inventoryLocationId,
          inventoryLocationName: transfer.inventoryLocation?.name ?? transfer.inventoryLocationId,
          unitIds: stringArray(transfer.unitIds),
          receivedUnitIds: stringArray(transfer.receivedUnitIds),
          status: transfer.status,
          version: transfer.version,
        }
      : null,
    expectedUnits,
    receivedUnits,
    missingUnits,
    inspection: assignments.map((assignment: any) => ({
      unitId: assignment.equipmentUnitId,
      preliminary: mapInspection(inspections.get(`${assignment.id}:${InspectionStage.PRELIMINARY}`)),
      final: mapInspection(inspections.get(`${assignment.id}:${InspectionStage.FINAL}`)),
    })),
    depositActions: assignments
      .map((assignment: any) => {
        const item: any = depositItems.get(assignment.id)
        return item
          ? {
              unitId: assignment.equipmentUnitId,
              status: item.status,
              depositAmount: decimalToInteger(item.depositAmount),
              deductionAmount: decimalToInteger(item.deductionAmount),
              refundAmount: decimalToInteger(item.refundAmount),
            }
          : null
      })
      .filter(Boolean),
    beforeEvidence: order.conditionSnapshotsViaOrderId
      .filter((snapshot: any) => snapshot.snapshotStage === SnapshotStage.PRE_HANDOVER)
      .map((snapshot: any) => ({
        unitId: snapshot.unitId,
        condition: snapshot.condition,
        accessories: snapshot.accessories,
        evidenceIds: jsonArray(snapshot.evidenceIds),
      })),
  }
}

function mapInspection(inspection: any) {
  if (!inspection) return null
  return {
    id: inspection.id,
    stage: inspection.stage,
    outcome: inspection.outcome,
    notes: inspection.notes,
    evidenceIds: jsonArray(inspection.evidenceIds),
    version: inspection.version,
    createdAt: inspection.createdAt?.toISOString?.() ?? inspection.createdAt,
    findings:
      inspection.findingsViaInspectionId?.map((finding: any) => ({
        ruleId: finding.ruleId,
        amount: decimalToInteger(finding.assessedAmount),
        quantity: finding.quantity,
      })) ?? [],
  }
}

function publicDepositStatus(
  status: DepositItemStatus,
  refundStatus?: RefundStatus | null,
  deductionAmount?: Prisma.Decimal,
): string {
  if (status === DepositItemStatus.HELD) return 'HELD'
  if (status === DepositItemStatus.REVIEW_REQUIRED) return 'REVIEW_REQUIRED'
  if (status === DepositItemStatus.REFUND_PENDING) return 'REFUND_PENDING'
  if (status === DepositItemStatus.REFUND_FAILED) return 'REFUND_FAILED'
  if (status === DepositItemStatus.DEDUCTION_APPROVED) return 'DEDUCTED'
  if (status === DepositItemStatus.DEDUCTION_REJECTED) return 'REVIEW_REQUIRED'
  if (status === DepositItemStatus.SETTLED && deductionAmount?.greaterThan(0)) return 'DEDUCTED'
  if (status === DepositItemStatus.SETTLED && refundStatus === RefundStatus.SUCCEEDED) return 'REFUNDED'
  return 'SETTLED'
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: unknown,
  newValues?: unknown,
  requestId?: string,
) {
  if (tx.auditLog?.create) {
    await tx.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValues: oldValues === undefined ? undefined : jsonValue(oldValues),
        newValues: newValues === undefined ? undefined : jsonValue(newValues),
        requestId,
      },
    })
  }
}

function recipientMatches(snapshot: Prisma.JsonValue, userId: string): boolean {
  const obj = jsonObject(snapshot)
  return obj.userId === userId || obj.recipientUserId === userId || obj.id === userId
}
function pagination(page: number, pageSize: number, totalItems: number) {
  return { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) }
}
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value))
}
function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortJson(item)]),
    )
  return value
}
function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
function jsonObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return JSON.parse(JSON.stringify(value))
}
function jsonArray(value: unknown): any[] {
  return Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : []
}
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
function decimalFromUnknown(value: unknown): Prisma.Decimal {
  try {
    if (value instanceof Prisma.Decimal) return value
    if (typeof value === 'number' || typeof value === 'string') return new Prisma.Decimal(value)
    return new Prisma.Decimal(0)
  } catch {
    return new Prisma.Decimal(0)
  }
}
function decimalToInteger(value: Prisma.Decimal | string | number): number {
  const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)
  if (!decimal.isInteger())
    throw AppError.fromCode(RR.OPERATION_CONFLICT, { details: { reason: 'VND_AMOUNT_NOT_INTEGER' } })
  const number = decimal.toNumber()
  if (!Number.isSafeInteger(number))
    throw AppError.fromCode(RR.OPERATION_CONFLICT, { details: { reason: 'VND_AMOUNT_OUT_OF_RANGE' } })
  return number
}
