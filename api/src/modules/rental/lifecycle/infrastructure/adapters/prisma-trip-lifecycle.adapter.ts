import { Injectable } from '@nestjs/common'
import {
  Prisma,
  RentalOrderStatus,
  RentalOrderExceptionStatus,
  ReservationStatus,
  EquipmentUnitStatus,
  EquipmentCondition,
  RentalUnitAssignmentStatus,
  DeliveryTaskStatus,
  InventoryTaskStatus,
  PackageStatus,
  EventStatus,
} from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'
import { issueScheduleNoticeTx } from '../../../documents/application/rental-document-events'
import { getVerifiedCapacitySnapshot } from '../../../ordering/infrastructure/adapters/rental-capacity-snapshot'
import { effectiveDueAt } from '../../../ordering/extension/rental-extension.policy'
import { resolveActivePrimaryRentalLocation } from '../../../shared/primary-inventory-location'
import {
  cancelPendingRentalChargesWithTx,
  reserveLifecycleRentalRefundWithTx,
} from '../../../payments/rental-cancellation-refund'
import { releaseExtensionWithTx } from '../../../ordering/extension/rental-extension.service'
import { ensureReturnTaskWithTx } from '../../application/services/rental-return-task'
import type {
  TripLifecyclePort,
  TripRescheduledCommand,
  TripCancelledCommand,
  BookingCancelledCommand,
  MembershipSourceChangedCommand,
  LifecycleExecutionResult,
} from '../../application/ports/trip-lifecycle.port'

const OPEN_STATUSES: RentalOrderStatus[] = [
  RentalOrderStatus.PENDING_PAYMENT,
  RentalOrderStatus.PAID,
  RentalOrderStatus.PREPARING,
  RentalOrderStatus.READY_FOR_HANDOVER,
  RentalOrderStatus.ACTIVE,
]

const BEFORE_HANDOVER_STATUSES: RentalOrderStatus[] = [
  RentalOrderStatus.PENDING_PAYMENT,
  RentalOrderStatus.PAID,
  RentalOrderStatus.PREPARING,
  RentalOrderStatus.READY_FOR_HANDOVER,
]

function jsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

@Injectable()
export class PrismaTripLifecycleAdapter implements TripLifecyclePort {
  constructor(private readonly prisma: PrismaService) {}

  async processTripRescheduled(command: TripRescheduledCommand): Promise<LifecycleExecutionResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Idempotency / Deduplication via RentalInboxEvent
        const existing = await tx.rentalInboxEvent.findUnique({
          where: { eventId: command.eventId },
        })
        if (existing) {
          if (existing.result) {
            return existing.result as unknown as LifecycleExecutionResult
          }
          return {
            eventId: command.eventId,
            status: 'SKIPPED_DUPLICATE',
            affectedOrderCount: 0,
            affectedOrderIds: [],
            conflicts: [],
            scheduleNoticesIssued: [],
          }
        }

        // Record inbox event in PENDING state
        const inbox = await tx.rentalInboxEvent.create({
          data: {
            eventId: command.eventId,
            eventType: command.eventType,
            entityId: command.entityId,
            entityVersion: command.entityVersion,
            correlationId: command.correlationId,
            occurredAt: command.occurredAt,
            payload: jsonValue(command.payload),
            status: EventStatus.PENDING,
          },
        })

        // 2. Fetch open RentalOrders for this trip
        const orders = await tx.rentalOrder.findMany({
          where: {
            tripId: command.payload.tripId,
            status: { in: OPEN_STATUSES },
          },
          include: {
            rentalPolicy: true,
            rentalOrderLinesViaOrderId: {
              include: {
                product: true,
                rentalQuantityReservationsViaOrderLineId: {
                  where: {
                    status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] },
                  },
                  orderBy: {
                    reservationCycle: 'asc',
                  },
                },
                rentalUnitAssignmentsViaOrderLineId: {
                  where: {
                    status: { not: RentalUnitAssignmentStatus.CLOSED },
                  },
                  include: {
                    equipmentUnit: true,
                  },
                },
              },
            },
            deliveryTasksViaOrderId: true,
          },
        })

        if (orders.length === 0) {
          const noopResult: LifecycleExecutionResult = {
            eventId: command.eventId,
            status: 'PROCESSED',
            affectedOrderCount: 0,
            affectedOrderIds: [],
            conflicts: [],
            scheduleNoticesIssued: [],
          }
          await tx.rentalInboxEvent.update({
            where: { id: inbox.id },
            data: {
              status: EventStatus.PROCESSED,
              processedAt: new Date(),
              result: jsonValue(noopResult),
            },
          })
          return noopResult
        }

        // RB-POL-33: Primary InventoryLocation scoping
        const primaryLocationId = await resolveActivePrimaryRentalLocation(tx)

        // Concurrency & Lock acquisition: Sort product IDs to prevent deadlocks across concurrent reschedules or create-orders
        const productIdsToLock = Array.from(
          new Set(orders.flatMap((o) => o.rentalOrderLinesViaOrderId.map((l) => l.productId))),
        ).sort()

        for (const pid of productIdsToLock) {
          await tx.$queryRaw(Prisma.sql`SELECT id FROM rental_products WHERE id = ${pid}::uuid FOR UPDATE`)
        }

        const affectedOrderIds: string[] = []
        const conflicts: Array<{ orderId: string; reason: string }> = []
        const scheduleNoticesIssued: Array<{ orderId: string; documentId: string }> = []

        const newStartAt = new Date(command.payload.newStartAt)
        const newEndAt = new Date(command.payload.newEndAt)
        const newPlannedHandoverAt = command.payload.plannedHandoverAt
          ? new Date(command.payload.plannedHandoverAt)
          : newStartAt
        const newPlannedReturnAt = command.payload.plannedReturnAt
          ? new Date(command.payload.plannedReturnAt)
          : newEndAt

        for (const order of orders) {
          // Out-of-order check per order
          if (order.contextVersionSnapshot >= command.payload.contextVersion) {
            continue
          }

          const isBeforeHandover = BEFORE_HANDOVER_STATUSES.includes(order.status)

          // RB-POL-15: effectiveReturnDue protects contractual rentalEndAt
          const effectiveReturnDue = effectiveDueAt(order.rentalEndAt, newPlannedReturnAt)

          const processingNow = new Date()

          // Calculate line-level windows per Policy v1.5.2 RB-POL-30
          // occupiedFrom = rentalStartAt - 12h
          // Nominal occupiedUntil = effectiveReturnDueAt + (requiresDeep ? 48h : 24h), strictly single buffer
          // NEVER add internal allowances (8h transfer + 8h cleaning) on top of the 24h/48h buffer
          const lineWindows: Array<{
            lineId: string
            productId: string
            quantity: number
            occupiedFrom: Date
            occupiedUntil: Date
            allOwnReservationIds: string[]
            baseReservationId?: string
            latestConfirmedReservationId?: string
            latestConfirmedOccupiedUntil?: Date
            activeUnitIds?: string[]
          }> = []

          for (const line of order.rentalOrderLinesViaOrderId) {
            const requiresDeep = line.product.requiresDeepReturnInspection === true
            const bufferHours = requiresDeep ? 48 : 24

            const allReservations = line.rentalQuantityReservationsViaOrderLineId ?? []
            const confirmedReservations = allReservations.filter((r) => r.status === ReservationStatus.CONFIRMED)
            const activeHeldReservations = allReservations.filter(
              (r) => r.status === ReservationStatus.HELD && r.holdExpiresAt && r.holdExpiresAt > processingNow,
            )
            const validOwnReservations = [...confirmedReservations, ...activeHeldReservations]

            let lineFrom: Date
            let lineUntil: Date

            if (isBeforeHandover) {
              // Before handover per RB-POL-30: prep window is nominal 12 hours before contractual rentalStartAt.
              // Protects contractual rentalStartAt even if operational plannedHandoverAt differs.
              const baseRentalStartAt = (order as any).rentalStartAt ?? order.plannedHandoverAt ?? newPlannedHandoverAt
              lineFrom = new Date(baseRentalStartAt.getTime() - 12 * 3600_000)
              lineUntil = new Date(effectiveReturnDue.getTime() + bufferHours * 3600_000)
            } else {
              // ACTIVE: user already has equipment; handover start is immutable
              const minConfirmedFrom =
                confirmedReservations.length > 0
                  ? new Date(Math.min(...confirmedReservations.map((r) => r.occupiedFrom.getTime())))
                  : order.occupiedStartAt
              lineFrom = minConfirmedFrom
              lineUntil = new Date(effectiveReturnDue.getTime() + bufferHours * 3600_000)
            }

            const activeUnitIds = !isBeforeHandover
              ? (line.rentalUnitAssignmentsViaOrderLineId ?? [])
                  .filter((a) => a.equipmentUnit && a.equipmentUnit.status === EquipmentUnitStatus.RENTED)
                  .map((a) => a.equipmentUnitId)
              : undefined

            const baseReservation = allReservations[0]
            const latestConfirmedReservation =
              confirmedReservations.length > 0 ? confirmedReservations[confirmedReservations.length - 1] : undefined

            lineWindows.push({
              lineId: line.id,
              productId: line.productId,
              quantity: line.quantity,
              occupiedFrom: lineFrom,
              occupiedUntil: lineUntil,
              allOwnReservationIds: validOwnReservations.map((r) => r.id),
              baseReservationId: baseReservation?.id,
              latestConfirmedReservationId: latestConfirmedReservation?.id,
              latestConfirmedOccupiedUntil: latestConfirmedReservation?.occupiedUntil,
              activeUnitIds: activeUnitIds && activeUnitIds.length > 0 ? activeUnitIds : undefined,
            })
          }

          // Capacity Safety Gate check per product
          // P0-03 & P1-E & P0-01: Exclude ALL active own reservations (base + confirmed extensions + active holds)
          // Scoped to primary InventoryLocation per RB-POL-33
          let orderHasConflict = false
          let conflictReason = ''

          for (const lw of lineWindows) {
            const ownResIds = lineWindows
              .filter((w) => w.productId === lw.productId)
              .flatMap((w) => w.allOwnReservationIds)

            const snapshot = await getVerifiedCapacitySnapshot(tx, {
              productId: lw.productId,
              requestedQuantity: lw.quantity,
              occupiedFrom: lw.occupiedFrom,
              occupiedUntil: lw.occupiedUntil,
              now: processingNow,
              inventoryLocationId: primaryLocationId,
              excludeReservationIds: ownResIds,
              activeUnitIds: lw.activeUnitIds,
            })

            if (snapshot.actionRequired || snapshot.availableCount < lw.quantity) {
              orderHasConflict = true
              conflictReason = `INSUFFICIENT_CAPACITY_PRODUCT_${lw.productId}`
              break
            }
          }

          if (isBeforeHandover) {
            if (orderHasConflict) {
              // Pre-handover conflict:
              // P0-03 rule: All-or-nothing re-hold. Keep existing reservations completely intact!
              // Do NOT drop or partially update reservations. Set ACTION_REQUIRED with optimistic locking.
              await tx.rentalOrder.update({
                where: { id: order.id, version: order.version },
                data: {
                  exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
                  contextVersionSnapshot: command.payload.contextVersion,
                  version: { increment: 1 },
                },
              })

              conflicts.push({ orderId: order.id, reason: conflictReason })

              await tx.rentalOutboxEvent.upsert({
                where: {
                  deduplicationKey: `reschedule-conflict:${order.id}:${command.payload.contextVersion}`,
                },
                update: {},
                create: {
                  deduplicationKey: `reschedule-conflict:${order.id}:${command.payload.contextVersion}`,
                  eventType: 'RENTAL_ACTION_REQUIRED',
                  aggregateType: 'RentalOrder',
                  aggregateId: order.id,
                  payload: jsonValue({
                    orderId: order.id,
                    tripId: order.tripId,
                    reason: 'RESCHEDULE_CAPACITY_CONFLICT',
                    detail: conflictReason,
                    contextVersion: command.payload.contextVersion,
                    status: order.status,
                  }),
                },
              })

              affectedOrderIds.push(order.id)
              continue
            }

            // Pre-handover SUCCESS: All lines have capacity.
            // Re-hold all-or-nothing across all line reservations
            for (const lw of lineWindows) {
              if (lw.baseReservationId) {
                await tx.rentalQuantityReservation.update({
                  where: { id: lw.baseReservationId },
                  data: {
                    occupiedFrom: lw.occupiedFrom,
                    occupiedUntil: lw.occupiedUntil,
                    version: { increment: 1 },
                  },
                })
              }
            }

            const orderOccupiedStartAt = new Date(Math.min(...lineWindows.map((w) => w.occupiedFrom.getTime())))
            const orderOccupiedEndAt = new Date(Math.max(...lineWindows.map((w) => w.occupiedUntil.getTime())))

            await tx.rentalOrder.update({
              where: { id: order.id, version: order.version },
              data: {
                plannedHandoverAt: newPlannedHandoverAt,
                plannedReturnAt: newPlannedReturnAt,
                operationalReturnDueAt: newPlannedReturnAt,
                occupiedStartAt: orderOccupiedStartAt,
                occupiedEndAt: orderOccupiedEndAt,
                contextVersionSnapshot: command.payload.contextVersion,
                version: { increment: 1 },
              },
            })

            // Sync delivery tasks
            for (const dt of order.deliveryTasksViaOrderId) {
              if (dt.taskType === 'HANDOVER' && dt.status === DeliveryTaskStatus.SCHEDULED) {
                await tx.deliveryTask.update({
                  where: { id: dt.id },
                  data: { scheduledAt: newPlannedHandoverAt, version: { increment: 1 } },
                })
              } else if (dt.taskType === 'RETURN' && dt.status === DeliveryTaskStatus.SCHEDULED) {
                await tx.deliveryTask.update({
                  where: { id: dt.id },
                  data: { scheduledAt: newPlannedReturnAt, version: { increment: 1 } },
                })
              }
            }

            affectedOrderIds.push(order.id)
          } else {
            // ACTIVE ORDER (Customer already holds equipment):
            // Invariants:
            // 1. NEVER revoke equipment from active user or cut short their occupation!
            // 2. ALWAYS record the actual valid operational schedule!
            // 3. Extend reservation occupiedUntil so real physical occupation is recorded.
            for (const lw of lineWindows) {
              const resIdToUpdate = lw.latestConfirmedReservationId ?? lw.baseReservationId
              if (resIdToUpdate) {
                const currentUntil = lw.latestConfirmedOccupiedUntil ?? lw.occupiedUntil
                const targetUntil = lw.occupiedUntil > currentUntil ? lw.occupiedUntil : currentUntil
                await tx.rentalQuantityReservation.update({
                  where: { id: resIdToUpdate },
                  data: {
                    occupiedUntil: targetUntil,
                    version: { increment: 1 },
                  },
                })
              }
            }

            const orderOccupiedEndAt = new Date(Math.max(...lineWindows.map((w) => w.occupiedUntil.getTime())))

            const oldDueAt = order.operationalReturnDueAt

            await tx.rentalOrder.update({
              where: { id: order.id, version: order.version },
              data: {
                plannedReturnAt: newPlannedReturnAt,
                operationalReturnDueAt: newPlannedReturnAt,
                occupiedEndAt: orderOccupiedEndAt,
                ...(orderHasConflict ? { exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED } : {}),
                contextVersionSnapshot: command.payload.contextVersion,
                version: { increment: 1 },
              },
            })

            if (orderHasConflict) {
              conflicts.push({ orderId: order.id, reason: conflictReason })
              await tx.rentalOutboxEvent.upsert({
                where: {
                  deduplicationKey: `reschedule-conflict-active:${order.id}:${command.payload.contextVersion}`,
                },
                update: {},
                create: {
                  deduplicationKey: `reschedule-conflict-active:${order.id}:${command.payload.contextVersion}`,
                  eventType: 'RENTAL_ACTION_REQUIRED',
                  aggregateType: 'RentalOrder',
                  aggregateId: order.id,
                  payload: jsonValue({
                    orderId: order.id,
                    tripId: order.tripId,
                    reason: 'ACTIVE_ORDER_EXTENSION_CAPACITY_CONFLICT',
                    detail: `Trip extended while order ACTIVE. Equipment custody preserved for customer; future capacity conflict flagged: ${conflictReason}`,
                    contextVersion: command.payload.contextVersion,
                    status: order.status,
                  }),
                },
              })
            }

            // Sync return delivery task
            for (const dt of order.deliveryTasksViaOrderId) {
              if (dt.taskType === 'RETURN' && dt.status === DeliveryTaskStatus.SCHEDULED) {
                await tx.deliveryTask.update({
                  where: { id: dt.id },
                  data: { scheduledAt: newPlannedReturnAt, version: { increment: 1 } },
                })
              }
            }

            // Documentary Notice: If operationalReturnDueAt changed, issue SCHEDULE_NOTICE!
            const dueChanged = !oldDueAt || oldDueAt.getTime() !== newPlannedReturnAt.getTime()
            if (dueChanged) {
              const doc = await issueScheduleNoticeTx(tx, {
                orderId: order.id,
                eventId: command.eventId,
                newOperationalDueAt: newPlannedReturnAt,
                oldOperationalDueAt: oldDueAt,
                at: command.occurredAt,
              })

              if (doc) {
                scheduleNoticesIssued.push({ orderId: order.id, documentId: doc.id })

                await tx.rentalOutboxEvent.upsert({
                  where: {
                    deduplicationKey: `schedule-notice:${order.id}:${command.payload.contextVersion}`,
                  },
                  update: {},
                  create: {
                    deduplicationKey: `schedule-notice:${order.id}:${command.payload.contextVersion}`,
                    eventType: 'RENTAL_SCHEDULE_NOTICE_ISSUED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      documentId: doc.id,
                      documentType: 'SCHEDULE_NOTICE',
                      oldOperationalReturnDueAt: oldDueAt ? oldDueAt.toISOString() : null,
                      operationalReturnDueAt: newPlannedReturnAt.toISOString(),
                      contractualRentalEndAt: order.rentalEndAt.toISOString(),
                      contextVersion: command.payload.contextVersion,
                      feeChanged: false,
                    }),
                  },
                })
              }
            }

            affectedOrderIds.push(order.id)
          }
        }

        const executionResult: LifecycleExecutionResult = {
          eventId: command.eventId,
          status: 'PROCESSED',
          affectedOrderCount: affectedOrderIds.length,
          affectedOrderIds,
          conflicts,
          scheduleNoticesIssued,
        }

        await tx.rentalInboxEvent.update({
          where: { id: inbox.id },
          data: {
            status: EventStatus.PROCESSED,
            processedAt: new Date(),
            result: jsonValue(executionResult),
          },
        })

        return executionResult
      })
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.rentalInboxEvent.findUnique({
          where: { eventId: command.eventId },
        })
        if (existing?.result) {
          return existing.result as unknown as LifecycleExecutionResult
        }
        return {
          eventId: command.eventId,
          status: 'SKIPPED_DUPLICATE',
          affectedOrderCount: 0,
          affectedOrderIds: [],
          conflicts: [],
          scheduleNoticesIssued: [],
        }
      }
      throw err
    }
  }

  async processTripCancelled(command: TripCancelledCommand): Promise<LifecycleExecutionResult> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // 1. Deduplication via RentalInboxEvent
          const existing = await tx.rentalInboxEvent.findUnique({
            where: { eventId: command.eventId },
          })
          if (existing) {
            if (existing.result) {
              return existing.result as unknown as LifecycleExecutionResult
            }
            return {
              eventId: command.eventId,
              status: 'SKIPPED_DUPLICATE',
              affectedOrderCount: 0,
              affectedOrderIds: [],
              conflicts: [],
              scheduleNoticesIssued: [],
            }
          }

          const inbox = await tx.rentalInboxEvent.create({
            data: {
              eventId: command.eventId,
              eventType: command.eventType,
              entityId: command.entityId,
              entityVersion: command.entityVersion,
              correlationId: command.correlationId,
              occurredAt: command.occurredAt,
              payload: jsonValue(command.payload),
              status: EventStatus.PENDING,
            },
          })

          // Khóa đơn trước khi đọc trạng thái tài chính, cùng thứ tự với payment consumer.
          await tx.$queryRaw`SELECT id FROM rental_orders WHERE trip_id = ${command.payload.tripId}::uuid
        AND status::text IN ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY_FOR_HANDOVER', 'ACTIVE')
        ORDER BY id FOR UPDATE`
          const orders = await tx.rentalOrder.findMany({
            where: {
              tripId: command.payload.tripId,
              status: { in: OPEN_STATUSES },
            },
            include: {
              rentalPolicy: { select: { freeCancellationHours: true } },
              rentalOrderLinesViaOrderId: {
                include: {
                  rentalUnitAssignmentsViaOrderLineId: {
                    include: {
                      equipmentUnit: true,
                    },
                  },
                },
              },
              inventoryTaskViaOrderId: {
                include: {
                  package: true,
                },
              },
              deliveryTasksViaOrderId: {
                include: {
                  package: true,
                },
              },
            },
          })

          const affectedOrderIds: string[] = []
          const cancelledOrderIds: string[] = []
          const actionRequiredOrderIds: string[] = []

          const effectiveAt = new Date(command.payload.effectiveAt)
          const eventVersion = command.payload.tripVersion ?? command.entityVersion
          const primaryLocationId = await resolveActivePrimaryRentalLocation(tx)

          for (const order of orders) {
            // Out-of-order check
            if (order.contextVersionSnapshot >= eventVersion) {
              continue
            }

            const isBeforeHandover = BEFORE_HANDOVER_STATUSES.includes(order.status)

            if (isBeforeHandover) {
              await cancelPendingRentalChargesWithTx(tx, order.id)
              const pendingExtensions = await tx.rentalExtensionRequest.findMany({
                where: { orderId: order.id, status: 'PENDING_PAYMENT' },
                select: { id: true, orderId: true },
              })
              for (const pending of pendingExtensions) {
                await releaseExtensionWithTx(tx, pending, 'CANCELLED', effectiveAt)
              }
              const financial = await reserveLifecycleRentalRefundWithTx(tx, {
                order,
                source: 'TRIP',
                eventVersion,
                now: effectiveAt,
                reason: command.payload.reason,
              })
              if (financial.reviewReason) {
                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `trip-cancel-financial-review:${order.id}:${eventVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `trip-cancel-financial-review:${order.id}:${eventVersion}`,
                    eventType: 'RENTAL_ACTION_REQUIRED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      reason: financial.reviewReason,
                      paymentReviewRequired: true,
                    }),
                  },
                })
                actionRequiredOrderIds.push(order.id)
              }
              // Check physical custody
              const pkg = order.inventoryTaskViaOrderId?.package ?? order.deliveryTasksViaOrderId?.[0]?.package

              const isTransferredToDelivery =
                order.inventoryTaskViaOrderId?.status === InventoryTaskStatus.TRANSFERRED ||
                order.deliveryTasksViaOrderId?.some(
                  (dt) =>
                    dt.status === DeliveryTaskStatus.PACKAGE_RECEIVED ||
                    dt.status === DeliveryTaskStatus.RECIPIENT_VERIFIED ||
                    dt.status === DeliveryTaskStatus.HANDED_OVER,
                ) ||
                pkg?.status === PackageStatus.TRANSFERRED_TO_DELIVERY ||
                order.rentalOrderLinesViaOrderId.some((l) =>
                  l.rentalUnitAssignmentsViaOrderLineId.some(
                    (a) => a.equipmentUnit && a.equipmentUnit.currentInventoryLocationId === null,
                  ),
                )

              if (isTransferredToDelivery) {
                // Units are with STAFF_DELIVERY! Cannot mark AVAILABLE!
                await tx.rentalOrder.update({
                  where: { id: order.id, version: order.version },
                  data: {
                    status: RentalOrderStatus.CANCELLED,
                    exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
                    financialStatus: financial.financialStatus ?? order.financialStatus,
                    cancelledAt: effectiveAt,
                    contextVersionSnapshot: eventVersion,
                    version: { increment: 1 },
                  },
                })

                // Release quantity reservations
                await tx.rentalQuantityReservation.updateMany({
                  where: {
                    orderLine: { orderId: order.id },
                    status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] },
                  },
                  data: {
                    status: ReservationStatus.RELEASED,
                    releasedAt: new Date(),
                    version: { increment: 1 },
                  },
                })

                // Flag delivery tasks for required return to inventory location
                for (const dt of order.deliveryTasksViaOrderId) {
                  await tx.deliveryTask.update({
                    where: { id: dt.id },
                    data: {
                      exceptionNotes: 'RETURN_TO_INVENTORY_LOCATION_REQUIRED',
                      exceptionAt: effectiveAt,
                      version: { increment: 1 },
                    },
                  })
                }

                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `custody-return-required:${order.id}:${eventVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `custody-return-required:${order.id}:${eventVersion}`,
                    eventType: 'RENTAL_ACTION_REQUIRED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      tripId: order.tripId,
                      reason: 'PRE_HANDOVER_CANCELLATION_DELIVERY_CUSTODY_RETURN_REQUIRED',
                      detail:
                        'Package transferred to delivery staff. Units cannot be made AVAILABLE until received at InventoryLocation.',
                      contextVersion: eventVersion,
                      status: RentalOrderStatus.CANCELLED,
                    }),
                  },
                })

                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `trip-cancel:${order.id}:${eventVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `trip-cancel:${order.id}:${eventVersion}`,
                    eventType: 'RENTAL_ORDER_CANCELLED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      tripId: order.tripId,
                      reason: command.payload.reason,
                      status: 'CANCELLED',
                      financialStatus: financial.financialStatus ?? order.financialStatus,
                      custodyPendingReturn: true,
                    }),
                  },
                })

                if (!actionRequiredOrderIds.includes(order.id)) actionRequiredOrderIds.push(order.id)
                cancelledOrderIds.push(order.id)
              } else {
                // Still in inventory location / not picked
                await tx.rentalQuantityReservation.updateMany({
                  where: {
                    orderLine: { orderId: order.id },
                    status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] },
                  },
                  data: {
                    status: ReservationStatus.RELEASED,
                    releasedAt: new Date(),
                    version: { increment: 1 },
                  },
                })

                // Package cancellation
                if (pkg && pkg.status !== PackageStatus.CLOSED && pkg.status !== PackageStatus.CANCELLED) {
                  await tx.package.update({
                    where: { id: pkg.id },
                    data: {
                      status: PackageStatus.CANCELLED,
                      version: { increment: 1 },
                    },
                  })
                }

                // RentalUnitAssignment and EquipmentUnit release with custody verification
                const releasedUnitIds = new Set<string>()
                const eligibleToReleaseStatuses: EquipmentUnitStatus[] = [
                  EquipmentUnitStatus.PICKED,
                  EquipmentUnitStatus.PACKED,
                ]

                let hasUnsafeUnits = false
                const unsafeUnits: Array<{ unitId: string; reason: string }> = []

                for (const line of order.rentalOrderLinesViaOrderId) {
                  for (const assignment of line.rentalUnitAssignmentsViaOrderLineId) {
                    if (assignment.status !== RentalUnitAssignmentStatus.CLOSED) {
                      await tx.rentalUnitAssignment.update({
                        where: { id: assignment.id },
                        data: {
                          status: RentalUnitAssignmentStatus.CLOSED,
                          closedAt: effectiveAt,
                          version: { increment: 1 },
                        },
                      })
                    }

                    if (assignment.equipmentUnit && !releasedUnitIds.has(assignment.equipmentUnitId)) {
                      const unit = assignment.equipmentUnit
                      const isAtPrimaryLocation = unit.currentInventoryLocationId === primaryLocationId
                      const isUndamaged =
                        unit.condition !== EquipmentCondition.DAMAGED && unit.condition !== EquipmentCondition.LOST
                      const isStatusEligible = eligibleToReleaseStatuses.includes(unit.status)

                      if (isAtPrimaryLocation && isUndamaged && isStatusEligible) {
                        releasedUnitIds.add(assignment.equipmentUnitId)
                        await tx.equipmentUnit.update({
                          where: { id: assignment.equipmentUnitId },
                          data: {
                            status: EquipmentUnitStatus.AVAILABLE,
                            version: { increment: 1 },
                          },
                        })
                      } else {
                        hasUnsafeUnits = true
                        unsafeUnits.push({
                          unitId: assignment.equipmentUnitId,
                          reason: !isAtPrimaryLocation
                            ? 'UNIT_NOT_AT_PRIMARY_LOCATION'
                            : !isUndamaged
                              ? `UNIT_CONDITION_${unit.condition}`
                              : `UNIT_STATUS_INELIGIBLE_${unit.status}`,
                        })
                      }
                    }
                  }
                }

                if (order.inventoryTaskViaOrderId) {
                  await tx.inventoryTask.update({
                    where: { id: order.inventoryTaskViaOrderId.id },
                    data: {
                      status: hasUnsafeUnits ? InventoryTaskStatus.BLOCKED : InventoryTaskStatus.CLOSED,
                      version: { increment: 1 },
                    },
                  })
                }

                for (const dt of order.deliveryTasksViaOrderId) {
                  await tx.deliveryTask.update({
                    where: { id: dt.id },
                    data: { status: DeliveryTaskStatus.CANCELLED, version: { increment: 1 } },
                  })
                }

                await tx.rentalOrder.update({
                  where: { id: order.id, version: order.version },
                  data: {
                    status: RentalOrderStatus.CANCELLED,
                    cancelledAt: effectiveAt,
                    financialStatus: financial.financialStatus ?? order.financialStatus,
                    exceptionStatus:
                      hasUnsafeUnits || financial.reviewReason
                        ? RentalOrderExceptionStatus.ACTION_REQUIRED
                        : RentalOrderExceptionStatus.NONE,
                    // Một lần tăng version sau khi đã xác định trạng thái thiết bị.
                    contextVersionSnapshot: eventVersion,
                    version: { increment: 1 },
                  },
                })

                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `trip-cancel:${order.id}:${eventVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `trip-cancel:${order.id}:${eventVersion}`,
                    eventType: 'RENTAL_ORDER_CANCELLED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      tripId: order.tripId,
                      reason: command.payload.reason,
                      status: 'CANCELLED',
                      financialStatus: financial.financialStatus ?? order.financialStatus,
                      custodyPendingReturn: false,
                    }),
                  },
                })

                if (hasUnsafeUnits) {
                  await tx.rentalOutboxEvent.upsert({
                    where: { deduplicationKey: `rental-action-required:unsafe-units:${order.id}:${eventVersion}` },
                    update: {},
                    create: {
                      deduplicationKey: `rental-action-required:unsafe-units:${order.id}:${eventVersion}`,
                      eventType: 'RENTAL_ACTION_REQUIRED',
                      aggregateType: 'RentalOrder',
                      aggregateId: order.id,
                      payload: jsonValue({
                        orderId: order.id,
                        tripId: order.tripId,
                        reason: 'UNSAFE_CUSTODY_UNIT_ON_CANCELLATION',
                        unsafeUnits,
                        status: RentalOrderStatus.CANCELLED,
                      }),
                    },
                  })
                  if (!actionRequiredOrderIds.includes(order.id)) actionRequiredOrderIds.push(order.id)
                }

                cancelledOrderIds.push(order.id)
              }
            } else {
              // ACTIVE: Trip aborted mid-way.
              // Invariant: Do NOT cancel order or revoke user custody!
              // RB-POL-15: Protect contractual rentalEndAt! Do NOT truncate operationalReturnDueAt if rentalEndAt is later.
              await ensureReturnTaskWithTx(tx, order.id, effectiveAt, 'TRIP_ENDED_EARLY')
              await tx.rentalOrder.update({
                where: { id: order.id, version: order.version },
                data: {
                  exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
                  contextVersionSnapshot: eventVersion,
                  version: { increment: 1 },
                },
              })

              for (const dt of order.deliveryTasksViaOrderId) {
                if (dt.taskType === 'RETURN' && dt.status === DeliveryTaskStatus.SCHEDULED) {
                  await tx.deliveryTask.update({
                    where: { id: dt.id },
                    data: { exceptionNotes: 'TRIP_CANCELLED_WITH_ACTIVE_RENTAL', version: { increment: 1 } },
                  })
                }
              }

              await tx.rentalOutboxEvent.upsert({
                where: { deduplicationKey: `trip-abort-active:${order.id}:${eventVersion}` },
                update: {},
                create: {
                  deduplicationKey: `trip-abort-active:${order.id}:${eventVersion}`,
                  eventType: 'RENTAL_ACTION_REQUIRED',
                  aggregateType: 'RentalOrder',
                  aggregateId: order.id,
                  payload: jsonValue({
                    orderId: order.id,
                    tripId: order.tripId,
                    reason: 'TRIP_CANCELLED_WITH_ACTIVE_RENTAL',
                    detail:
                      'Trip cancelled/aborted while customer holds equipment. Customer custody protected; contractual rentalEndAt preserved; staff action required for recovery.',
                    effectiveAt: effectiveAt.toISOString(),
                    rentalEndAt: order.rentalEndAt.toISOString(),
                    operationalReturnDueAt: order.operationalReturnDueAt?.toISOString() ?? null,
                    equipmentInCustody: true,
                    contextVersion: eventVersion,
                  }),
                },
              })

              actionRequiredOrderIds.push(order.id)
            }

            affectedOrderIds.push(order.id)
          }

          const executionResult: LifecycleExecutionResult = {
            eventId: command.eventId,
            status: 'PROCESSED',
            affectedOrderCount: affectedOrderIds.length,
            affectedOrderIds,
            conflicts: [],
            scheduleNoticesIssued: [],
            cancelledOrderIds,
            actionRequiredOrderIds,
          }

          await tx.rentalInboxEvent.update({
            where: { id: inbox.id },
            data: {
              status: EventStatus.PROCESSED,
              processedAt: new Date(),
              result: jsonValue(executionResult),
            },
          })

          return executionResult
        },
        { timeout: 30_000, maxWait: 10_000 },
      )
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.rentalInboxEvent.findUnique({
          where: { eventId: command.eventId },
        })
        if (existing?.result) {
          return existing.result as unknown as LifecycleExecutionResult
        }
        return {
          eventId: command.eventId,
          status: 'SKIPPED_DUPLICATE',
          affectedOrderCount: 0,
          affectedOrderIds: [],
          conflicts: [],
          scheduleNoticesIssued: [],
        }
      }
      throw err
    }
  }

  async processBookingCancelled(command: BookingCancelledCommand): Promise<LifecycleExecutionResult> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // 1. Deduplication via RentalInboxEvent
          const existing = await tx.rentalInboxEvent.findUnique({
            where: { eventId: command.eventId },
          })
          if (existing) {
            if (existing.result) {
              return existing.result as unknown as LifecycleExecutionResult
            }
            return {
              eventId: command.eventId,
              status: 'SKIPPED_DUPLICATE',
              affectedOrderCount: 0,
              affectedOrderIds: [],
              conflicts: [],
              scheduleNoticesIssued: [],
            }
          }

          const canonicalVersion = command.payload.version ?? command.entityVersion

          // Event ordering per entity/stream (P1-D / Preflight 2):
          // Track high-water mark for the Booking entity stream in RentalInboxEvent using canonical version.
          // Do NOT compare Booking version against Trip contextVersionSnapshot!
          const higherBookingEvent = await tx.rentalInboxEvent.findFirst({
            where: {
              entityId: command.payload.bookingId,
              status: EventStatus.PROCESSED,
              entityVersion: { gte: canonicalVersion },
            },
          })

          if (higherBookingEvent) {
            const outOfOrderResult: LifecycleExecutionResult = {
              eventId: command.eventId,
              status: 'SKIPPED_OUT_OF_ORDER',
              affectedOrderCount: 0,
              affectedOrderIds: [],
              conflicts: [],
              scheduleNoticesIssued: [],
            }
            await tx.rentalInboxEvent.create({
              data: {
                eventId: command.eventId,
                eventType: command.eventType,
                entityId: command.payload.bookingId,
                entityVersion: canonicalVersion,
                correlationId: command.correlationId,
                occurredAt: command.occurredAt,
                payload: jsonValue(command.payload),
                status: EventStatus.PROCESSED,
                processedAt: new Date(),
                result: jsonValue(outOfOrderResult),
              },
            })
            return outOfOrderResult
          }

          const inbox = await tx.rentalInboxEvent.create({
            data: {
              eventId: command.eventId,
              eventType: command.eventType,
              entityId: command.payload.bookingId,
              entityVersion: canonicalVersion,
              correlationId: command.correlationId,
              occurredAt: command.occurredAt,
              payload: jsonValue(command.payload),
              status: EventStatus.PENDING,
            },
          })

          await tx.$queryRaw`SELECT id FROM rental_orders 
          WHERE ((membership_kind = 'PUBLIC_BOOKING_BUYER' AND membership_ref = ${command.payload.bookingId}::text)
                 OR ((membership_kind IS NULL OR membership_kind = 'LEGACY') AND booking_id = ${command.payload.bookingId}::uuid))
          AND status::text IN ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY_FOR_HANDOVER', 'ACTIVE')
          ORDER BY id FOR UPDATE`
          const candidateOrders = await tx.rentalOrder.findMany({
            where: {
              status: { in: OPEN_STATUSES },
              OR: [
                {
                  membershipKind: 'PUBLIC_BOOKING_BUYER',
                  membershipRef: command.payload.bookingId,
                },
                {
                  membershipKind: null,
                  bookingId: command.payload.bookingId,
                },
                {
                  membershipKind: 'LEGACY',
                  bookingId: command.payload.bookingId,
                },
              ],
            },
            include: {
              rentalPolicy: { select: { freeCancellationHours: true } },
              rentalOrderLinesViaOrderId: {
                include: {
                  rentalUnitAssignmentsViaOrderLineId: {
                    include: {
                      equipmentUnit: true,
                    },
                  },
                },
              },
              inventoryTaskViaOrderId: {
                include: {
                  package: true,
                },
              },
              deliveryTasksViaOrderId: {
                include: {
                  package: true,
                },
              },
            },
          })

          // Event version ordering check: Stale leave/cancel events must not affect orders created after rejoin/newer version
          const orders = candidateOrders.filter(
            (o) => o.membershipSourceVersion == null || canonicalVersion >= o.membershipSourceVersion,
          )

          const affectedOrderIds: string[] = []
          const cancelledOrderIds: string[] = []
          const actionRequiredOrderIds: string[] = []

          const effectiveAt = new Date(command.payload.effectiveAt)
          const primaryLocationId = await resolveActivePrimaryRentalLocation(tx)

          for (const order of orders) {
            // Note: Do NOT compare order.contextVersionSnapshot with eventVersion (Booking stream != Trip stream)
            const isBeforeHandover = BEFORE_HANDOVER_STATUSES.includes(order.status)

            if (isBeforeHandover) {
              await cancelPendingRentalChargesWithTx(tx, order.id)
              const pendingExtensions = await tx.rentalExtensionRequest.findMany({
                where: { orderId: order.id, status: 'PENDING_PAYMENT' },
                select: { id: true, orderId: true },
              })
              for (const pending of pendingExtensions) {
                await releaseExtensionWithTx(tx, pending, 'CANCELLED', effectiveAt)
              }
              const financial = await reserveLifecycleRentalRefundWithTx(tx, {
                order,
                source: 'BOOKING',
                eventVersion: canonicalVersion,
                now: effectiveAt,
                reason: command.payload.reason,
              })
              if (financial.reviewReason) {
                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `booking-cancel-financial-review:${order.id}:${canonicalVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `booking-cancel-financial-review:${order.id}:${canonicalVersion}`,
                    eventType: 'RENTAL_ACTION_REQUIRED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      reason: financial.reviewReason,
                      paymentReviewRequired: true,
                    }),
                  },
                })
                actionRequiredOrderIds.push(order.id)
              }
              const pkg = order.inventoryTaskViaOrderId?.package ?? order.deliveryTasksViaOrderId?.[0]?.package

              const isTransferredToDelivery =
                order.inventoryTaskViaOrderId?.status === InventoryTaskStatus.TRANSFERRED ||
                order.deliveryTasksViaOrderId?.some(
                  (dt) =>
                    dt.status === DeliveryTaskStatus.PACKAGE_RECEIVED ||
                    dt.status === DeliveryTaskStatus.RECIPIENT_VERIFIED ||
                    dt.status === DeliveryTaskStatus.HANDED_OVER,
                ) ||
                pkg?.status === PackageStatus.TRANSFERRED_TO_DELIVERY ||
                order.rentalOrderLinesViaOrderId.some((l) =>
                  l.rentalUnitAssignmentsViaOrderLineId.some(
                    (a) => a.equipmentUnit && a.equipmentUnit.currentInventoryLocationId === null,
                  ),
                )

              if (isTransferredToDelivery) {
                await tx.rentalOrder.update({
                  where: { id: order.id, version: order.version },
                  data: {
                    status: RentalOrderStatus.CANCELLED,
                    exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
                    financialStatus: financial.financialStatus ?? order.financialStatus,
                    cancelledAt: effectiveAt,
                    version: { increment: 1 },
                  },
                })

                await tx.rentalQuantityReservation.updateMany({
                  where: {
                    orderLine: { orderId: order.id },
                    status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] },
                  },
                  data: {
                    status: ReservationStatus.RELEASED,
                    releasedAt: new Date(),
                    version: { increment: 1 },
                  },
                })

                for (const dt of order.deliveryTasksViaOrderId) {
                  await tx.deliveryTask.update({
                    where: { id: dt.id },
                    data: {
                      exceptionNotes: 'RETURN_TO_INVENTORY_LOCATION_REQUIRED',
                      exceptionAt: effectiveAt,
                      version: { increment: 1 },
                    },
                  })
                }

                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `custody-return-required-booking:${order.id}:${canonicalVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `custody-return-required-booking:${order.id}:${canonicalVersion}`,
                    eventType: 'RENTAL_ACTION_REQUIRED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      bookingId: order.bookingId,
                      tripId: order.tripId,
                      reason: 'PRE_HANDOVER_CANCELLATION_DELIVERY_CUSTODY_RETURN_REQUIRED',
                      detail:
                        'Package transferred to delivery staff. Units cannot be made AVAILABLE until received at InventoryLocation.',
                      contextVersion: canonicalVersion,
                      status: RentalOrderStatus.CANCELLED,
                    }),
                  },
                })

                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `booking-cancel:${order.id}:${canonicalVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `booking-cancel:${order.id}:${canonicalVersion}`,
                    eventType: 'RENTAL_ORDER_CANCELLED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      bookingId: order.bookingId,
                      tripId: order.tripId,
                      reason: command.payload.reason,
                      status: 'CANCELLED',
                      financialStatus: financial.financialStatus ?? order.financialStatus,
                      custodyPendingReturn: true,
                    }),
                  },
                })

                if (!actionRequiredOrderIds.includes(order.id)) actionRequiredOrderIds.push(order.id)
                cancelledOrderIds.push(order.id)
              } else {
                // Pre-handover: Package in warehouse. Release reservations.
                await tx.rentalQuantityReservation.updateMany({
                  where: {
                    orderLine: { orderId: order.id },
                    status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] },
                  },
                  data: {
                    status: ReservationStatus.RELEASED,
                    releasedAt: new Date(),
                    version: { increment: 1 },
                  },
                })

                // Package cancellation
                if (pkg && pkg.status !== PackageStatus.CLOSED && pkg.status !== PackageStatus.CANCELLED) {
                  await tx.package.update({
                    where: { id: pkg.id },
                    data: {
                      status: PackageStatus.CANCELLED,
                      version: { increment: 1 },
                    },
                  })
                }

                // RentalUnitAssignment and EquipmentUnit release with custody verification
                const releasedUnitIds = new Set<string>()
                const eligibleToReleaseStatuses: EquipmentUnitStatus[] = [
                  EquipmentUnitStatus.PICKED,
                  EquipmentUnitStatus.PACKED,
                ]

                let hasUnsafeUnits = false
                const unsafeUnits: Array<{ unitId: string; reason: string }> = []

                for (const line of order.rentalOrderLinesViaOrderId) {
                  for (const assignment of line.rentalUnitAssignmentsViaOrderLineId) {
                    if (assignment.status !== RentalUnitAssignmentStatus.CLOSED) {
                      await tx.rentalUnitAssignment.update({
                        where: { id: assignment.id },
                        data: {
                          status: RentalUnitAssignmentStatus.CLOSED,
                          closedAt: effectiveAt,
                          version: { increment: 1 },
                        },
                      })
                    }

                    if (assignment.equipmentUnit && !releasedUnitIds.has(assignment.equipmentUnitId)) {
                      const unit = assignment.equipmentUnit
                      const isAtPrimaryLocation = unit.currentInventoryLocationId === primaryLocationId
                      const isUndamaged =
                        unit.condition !== EquipmentCondition.DAMAGED && unit.condition !== EquipmentCondition.LOST
                      const isStatusEligible = eligibleToReleaseStatuses.includes(unit.status)

                      if (isAtPrimaryLocation && isUndamaged && isStatusEligible) {
                        releasedUnitIds.add(assignment.equipmentUnitId)
                        await tx.equipmentUnit.update({
                          where: { id: assignment.equipmentUnitId },
                          data: {
                            status: EquipmentUnitStatus.AVAILABLE,
                            version: { increment: 1 },
                          },
                        })
                      } else {
                        hasUnsafeUnits = true
                        unsafeUnits.push({
                          unitId: assignment.equipmentUnitId,
                          reason: !isAtPrimaryLocation
                            ? 'UNIT_NOT_AT_PRIMARY_LOCATION'
                            : !isUndamaged
                              ? `UNIT_CONDITION_${unit.condition}`
                              : `UNIT_STATUS_INELIGIBLE_${unit.status}`,
                        })
                      }
                    }
                  }
                }

                if (order.inventoryTaskViaOrderId) {
                  await tx.inventoryTask.update({
                    where: { id: order.inventoryTaskViaOrderId.id },
                    data: {
                      status: hasUnsafeUnits ? InventoryTaskStatus.BLOCKED : InventoryTaskStatus.CLOSED,
                      version: { increment: 1 },
                    },
                  })
                }

                for (const dt of order.deliveryTasksViaOrderId) {
                  await tx.deliveryTask.update({
                    where: { id: dt.id },
                    data: { status: DeliveryTaskStatus.CANCELLED, version: { increment: 1 } },
                  })
                }

                await tx.rentalOrder.update({
                  where: { id: order.id, version: order.version },
                  data: {
                    status: RentalOrderStatus.CANCELLED,
                    financialStatus: financial.financialStatus ?? order.financialStatus,
                    exceptionStatus:
                      hasUnsafeUnits || financial.reviewReason
                        ? RentalOrderExceptionStatus.ACTION_REQUIRED
                        : RentalOrderExceptionStatus.NONE,
                    cancelledAt: effectiveAt,
                    version: { increment: 1 },
                  },
                })

                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `booking-cancel:${order.id}:${canonicalVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `booking-cancel:${order.id}:${canonicalVersion}`,
                    eventType: 'RENTAL_ORDER_CANCELLED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      bookingId: order.bookingId,
                      tripId: order.tripId,
                      reason: command.payload.reason,
                      status: 'CANCELLED',
                      financialStatus: financial.financialStatus ?? order.financialStatus,
                      custodyPendingReturn: false,
                    }),
                  },
                })

                if (hasUnsafeUnits) {
                  await tx.rentalOutboxEvent.upsert({
                    where: {
                      deduplicationKey: `rental-action-required:unsafe-units-booking:${order.id}:${canonicalVersion}`,
                    },
                    update: {},
                    create: {
                      deduplicationKey: `rental-action-required:unsafe-units-booking:${order.id}:${canonicalVersion}`,
                      eventType: 'RENTAL_ACTION_REQUIRED',
                      aggregateType: 'RentalOrder',
                      aggregateId: order.id,
                      payload: jsonValue({
                        orderId: order.id,
                        bookingId: order.bookingId,
                        tripId: order.tripId,
                        reason: 'PRE_HANDOVER_CANCELLATION_UNSAFE_UNIT_CUSTODY',
                        detail:
                          'One or more assigned equipment units are damaged, lost, or not at primary warehouse. Staff inventory action required.',
                        unsafeUnits,
                        status: RentalOrderStatus.CANCELLED,
                      }),
                    },
                  })
                  if (!actionRequiredOrderIds.includes(order.id)) actionRequiredOrderIds.push(order.id)
                }

                cancelledOrderIds.push(order.id)
              }
            } else {
              // ACTIVE: user custody preserved. Protect contractual rentalEndAt per RB-POL-15!
              await ensureReturnTaskWithTx(tx, order.id, effectiveAt, 'BOOKING_CANCELLED_AFTER_HANDOVER')
              await tx.rentalOrder.update({
                where: { id: order.id, version: order.version },
                data: {
                  exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
                  version: { increment: 1 },
                },
              })

              for (const dt of order.deliveryTasksViaOrderId) {
                if (dt.taskType === 'RETURN' && dt.status === DeliveryTaskStatus.SCHEDULED) {
                  await tx.deliveryTask.update({
                    where: { id: dt.id },
                    data: { exceptionNotes: 'BOOKING_CANCELLED_WITH_ACTIVE_RENTAL', version: { increment: 1 } },
                  })
                }
              }

              await tx.rentalOutboxEvent.upsert({
                where: { deduplicationKey: `booking-cancel-active:${order.id}:${canonicalVersion}` },
                update: {},
                create: {
                  deduplicationKey: `booking-cancel-active:${order.id}:${canonicalVersion}`,
                  eventType: 'RENTAL_ACTION_REQUIRED',
                  aggregateType: 'RentalOrder',
                  aggregateId: order.id,
                  payload: jsonValue({
                    orderId: order.id,
                    bookingId: order.bookingId,
                    tripId: order.tripId,
                    reason: 'BOOKING_CANCELLED_WITH_ACTIVE_RENTAL',
                    detail:
                      'Booking cancelled while customer holds equipment. Customer custody protected; contractual rentalEndAt preserved; staff action required for recovery.',
                    effectiveAt: effectiveAt.toISOString(),
                    rentalEndAt: order.rentalEndAt.toISOString(),
                    operationalReturnDueAt: order.operationalReturnDueAt?.toISOString() ?? null,
                    equipmentInCustody: true,
                    contextVersion: canonicalVersion,
                  }),
                },
              })

              actionRequiredOrderIds.push(order.id)
            }

            affectedOrderIds.push(order.id)
          }

          const executionResult: LifecycleExecutionResult = {
            eventId: command.eventId,
            status: 'PROCESSED',
            affectedOrderCount: affectedOrderIds.length,
            affectedOrderIds,
            conflicts: [],
            scheduleNoticesIssued: [],
            cancelledOrderIds,
            actionRequiredOrderIds,
          }

          await tx.rentalInboxEvent.update({
            where: { id: inbox.id },
            data: {
              status: EventStatus.PROCESSED,
              processedAt: new Date(),
              result: jsonValue(executionResult),
            },
          })

          return executionResult
        },
        { timeout: 30_000, maxWait: 10_000 },
      )
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.rentalInboxEvent.findUnique({
          where: { eventId: command.eventId },
        })
        if (existing?.result) {
          return existing.result as unknown as LifecycleExecutionResult
        }
        return {
          eventId: command.eventId,
          status: 'SKIPPED_DUPLICATE',
          affectedOrderCount: 0,
          affectedOrderIds: [],
          conflicts: [],
          scheduleNoticesIssued: [],
        }
      }
      throw err
    }
  }

  async processMembershipSourceChanged(command: MembershipSourceChangedCommand): Promise<LifecycleExecutionResult> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.rentalInboxEvent.findUnique({
            where: { eventId: command.eventId },
          })
          if (existing) {
            if (existing.result) {
              return existing.result as unknown as LifecycleExecutionResult
            }
            return {
              eventId: command.eventId,
              status: 'SKIPPED_DUPLICATE',
              affectedOrderCount: 0,
              affectedOrderIds: [],
              conflicts: [],
              scheduleNoticesIssued: [],
            }
          }

          const canonicalVersion = command.payload.version ?? command.entityVersion

          const higherEvent = await tx.rentalInboxEvent.findFirst({
            where: {
              entityId: command.payload.membershipRef,
              status: EventStatus.PROCESSED,
              entityVersion: { gte: canonicalVersion },
            },
          })

          if (higherEvent) {
            const outOfOrderResult: LifecycleExecutionResult = {
              eventId: command.eventId,
              status: 'SKIPPED_OUT_OF_ORDER',
              affectedOrderCount: 0,
              affectedOrderIds: [],
              conflicts: [],
              scheduleNoticesIssued: [],
            }
            await tx.rentalInboxEvent.create({
              data: {
                eventId: command.eventId,
                eventType: command.eventType,
                entityId: command.payload.membershipRef,
                entityVersion: canonicalVersion,
                correlationId: command.correlationId,
                occurredAt: command.occurredAt,
                payload: jsonValue(command.payload),
                status: EventStatus.PROCESSED,
                processedAt: new Date(),
                result: jsonValue(outOfOrderResult),
              },
            })
            return outOfOrderResult
          }

          const inbox = await tx.rentalInboxEvent.create({
            data: {
              eventId: command.eventId,
              eventType: command.eventType,
              entityId: command.payload.membershipRef,
              entityVersion: canonicalVersion,
              correlationId: command.correlationId,
              occurredAt: command.occurredAt,
              payload: jsonValue(command.payload),
              status: EventStatus.PENDING,
            },
          })

          const isRevocationEvent = [
            'PRIVATE_TRIP_MEMBER_LEFT',
            'PRIVATE_TRIP_MEMBER_REMOVED',
            'BOOKING_CANCELLED',
            'PUBLIC_BOOKING_BUYER_CANCELLED',
          ].includes(command.eventType)

          if (!isRevocationEvent) {
            const noOpResult: LifecycleExecutionResult = {
              eventId: command.eventId,
              status: 'PROCESSED',
              affectedOrderCount: 0,
              affectedOrderIds: [],
              conflicts: [],
              scheduleNoticesIssued: [],
            }
            await tx.rentalInboxEvent.update({
              where: { id: inbox.id },
              data: {
                status: EventStatus.PROCESSED,
                processedAt: new Date(),
                result: jsonValue(noOpResult),
              },
            })
            return noOpResult
          }

          await tx.$queryRaw`SELECT id FROM rental_orders 
          WHERE membership_kind = ${command.payload.membershipKind}::varchar 
            AND membership_ref = ${command.payload.membershipRef}::text
            AND status::text IN ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY_FOR_HANDOVER', 'ACTIVE')
          ORDER BY id FOR UPDATE`

          const candidateOrders = await tx.rentalOrder.findMany({
            where: {
              membershipKind: command.payload.membershipKind,
              membershipRef: command.payload.membershipRef,
              status: { in: OPEN_STATUSES },
            },
            include: {
              rentalPolicy: { select: { freeCancellationHours: true } },
              rentalOrderLinesViaOrderId: {
                include: {
                  rentalUnitAssignmentsViaOrderLineId: {
                    include: {
                      equipmentUnit: true,
                    },
                  },
                },
              },
              inventoryTaskViaOrderId: {
                include: {
                  package: true,
                },
              },
              deliveryTasksViaOrderId: {
                include: {
                  package: true,
                },
              },
            },
          })

          const orders = candidateOrders.filter(
            (o) => o.membershipSourceVersion == null || canonicalVersion >= o.membershipSourceVersion,
          )

          const affectedOrderIds: string[] = []
          const cancelledOrderIds: string[] = []
          const actionRequiredOrderIds: string[] = []
          const effectiveAt = command.payload.effectiveAt ? new Date(command.payload.effectiveAt) : new Date()
          const primaryLocationId = await resolveActivePrimaryRentalLocation(tx)

          for (const order of orders) {
            const isBeforeHandover = BEFORE_HANDOVER_STATUSES.includes(order.status)

            if (isBeforeHandover) {
              await cancelPendingRentalChargesWithTx(tx, order.id)
              const pendingExtensions = await tx.rentalExtensionRequest.findMany({
                where: { orderId: order.id, status: 'PENDING_PAYMENT' },
                select: { id: true, orderId: true },
              })
              for (const pending of pendingExtensions) {
                await releaseExtensionWithTx(tx, pending, 'CANCELLED', effectiveAt)
              }

              if (order.status === RentalOrderStatus.PENDING_PAYMENT) {
                await tx.rentalOrder.update({
                  where: { id: order.id, version: order.version },
                  data: {
                    status: RentalOrderStatus.EXPIRED,
                    version: { increment: 1 },
                  },
                })
                await tx.rentalQuantityReservation.updateMany({
                  where: {
                    orderLine: { orderId: order.id },
                    status: ReservationStatus.HELD,
                  },
                  data: {
                    status: ReservationStatus.RELEASED,
                    releasedAt: effectiveAt,
                    version: { increment: 1 },
                  },
                })
                cancelledOrderIds.push(order.id)
                affectedOrderIds.push(order.id)
                continue
              }

              const financial = await reserveLifecycleRentalRefundWithTx(tx, {
                order,
                source: 'MEMBERSHIP',
                eventVersion: canonicalVersion,
                now: effectiveAt,
                reason: command.payload.reason ?? command.eventType,
              })
              if (financial.reviewReason) {
                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `membership-cancel-financial-review:${order.id}:${canonicalVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `membership-cancel-financial-review:${order.id}:${canonicalVersion}`,
                    eventType: 'RENTAL_ACTION_REQUIRED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      reason: financial.reviewReason,
                      paymentReviewRequired: true,
                    }),
                  },
                })
                actionRequiredOrderIds.push(order.id)
              }

              const pkg = order.inventoryTaskViaOrderId?.package ?? order.deliveryTasksViaOrderId?.[0]?.package

              const isTransferredToDelivery =
                order.inventoryTaskViaOrderId?.status === InventoryTaskStatus.TRANSFERRED ||
                order.deliveryTasksViaOrderId?.some(
                  (dt) =>
                    dt.status === DeliveryTaskStatus.PACKAGE_RECEIVED ||
                    dt.status === DeliveryTaskStatus.RECIPIENT_VERIFIED ||
                    dt.status === DeliveryTaskStatus.HANDED_OVER,
                ) ||
                pkg?.status === PackageStatus.TRANSFERRED_TO_DELIVERY ||
                order.rentalOrderLinesViaOrderId.some((l) =>
                  l.rentalUnitAssignmentsViaOrderLineId.some(
                    (a) => a.equipmentUnit && a.equipmentUnit.currentInventoryLocationId === null,
                  ),
                )

              if (isTransferredToDelivery) {
                await tx.rentalOrder.update({
                  where: { id: order.id, version: order.version },
                  data: {
                    status: RentalOrderStatus.CANCELLED,
                    exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
                    financialStatus: financial.financialStatus ?? order.financialStatus,
                    cancelledAt: effectiveAt,
                    version: { increment: 1 },
                  },
                })

                await tx.rentalQuantityReservation.updateMany({
                  where: {
                    orderLine: { orderId: order.id },
                    status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] },
                  },
                  data: {
                    status: ReservationStatus.RELEASED,
                    releasedAt: new Date(),
                    version: { increment: 1 },
                  },
                })

                for (const dt of order.deliveryTasksViaOrderId) {
                  await tx.deliveryTask.update({
                    where: { id: dt.id },
                    data: {
                      exceptionNotes: 'RETURN_TO_INVENTORY_LOCATION_REQUIRED',
                      exceptionAt: effectiveAt,
                      version: { increment: 1 },
                    },
                  })
                }

                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `custody-return-required-membership:${order.id}:${canonicalVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `custody-return-required-membership:${order.id}:${canonicalVersion}`,
                    eventType: 'RENTAL_ACTION_REQUIRED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      membershipRef: order.membershipRef,
                      membershipKind: order.membershipKind,
                      tripId: order.tripId,
                      reason: 'PRE_HANDOVER_CANCELLATION_DELIVERY_CUSTODY_RETURN_REQUIRED',
                      detail:
                        'Package transferred to delivery staff. Units cannot be made AVAILABLE until received at InventoryLocation.',
                      contextVersion: canonicalVersion,
                      status: RentalOrderStatus.CANCELLED,
                    }),
                  },
                })

                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `membership-cancel:${order.id}:${canonicalVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `membership-cancel:${order.id}:${canonicalVersion}`,
                    eventType: 'RENTAL_ORDER_CANCELLED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      membershipRef: order.membershipRef,
                      membershipKind: order.membershipKind,
                      tripId: order.tripId,
                      reason: command.payload.reason ?? command.eventType,
                      status: 'CANCELLED',
                      financialStatus: financial.financialStatus ?? order.financialStatus,
                      custodyPendingReturn: true,
                    }),
                  },
                })

                if (!actionRequiredOrderIds.includes(order.id)) actionRequiredOrderIds.push(order.id)
                cancelledOrderIds.push(order.id)
              } else {
                await tx.rentalQuantityReservation.updateMany({
                  where: {
                    orderLine: { orderId: order.id },
                    status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] },
                  },
                  data: {
                    status: ReservationStatus.RELEASED,
                    releasedAt: new Date(),
                    version: { increment: 1 },
                  },
                })

                if (pkg && pkg.status !== PackageStatus.CLOSED && pkg.status !== PackageStatus.CANCELLED) {
                  await tx.package.update({
                    where: { id: pkg.id },
                    data: {
                      status: PackageStatus.CANCELLED,
                      version: { increment: 1 },
                    },
                  })
                }

                const releasedUnitIds = new Set<string>()
                const eligibleToReleaseStatuses: EquipmentUnitStatus[] = [
                  EquipmentUnitStatus.PICKED,
                  EquipmentUnitStatus.PACKED,
                ]

                let hasUnsafeUnits = false
                const unsafeUnits: Array<{ unitId: string; reason: string }> = []

                for (const line of order.rentalOrderLinesViaOrderId) {
                  for (const assignment of line.rentalUnitAssignmentsViaOrderLineId) {
                    if (assignment.status !== RentalUnitAssignmentStatus.CLOSED) {
                      await tx.rentalUnitAssignment.update({
                        where: { id: assignment.id },
                        data: {
                          status: RentalUnitAssignmentStatus.CLOSED,
                          closedAt: effectiveAt,
                          version: { increment: 1 },
                        },
                      })
                    }

                    if (assignment.equipmentUnit && !releasedUnitIds.has(assignment.equipmentUnitId)) {
                      const unit = assignment.equipmentUnit
                      const isAtPrimaryLocation = unit.currentInventoryLocationId === primaryLocationId
                      const isUndamaged =
                        unit.condition !== EquipmentCondition.DAMAGED && unit.condition !== EquipmentCondition.LOST
                      const isStatusEligible = eligibleToReleaseStatuses.includes(unit.status)

                      if (isAtPrimaryLocation && isUndamaged && isStatusEligible) {
                        releasedUnitIds.add(assignment.equipmentUnitId)
                        await tx.equipmentUnit.update({
                          where: { id: assignment.equipmentUnitId },
                          data: {
                            status: EquipmentUnitStatus.AVAILABLE,
                            version: { increment: 1 },
                          },
                        })
                      } else {
                        hasUnsafeUnits = true
                        unsafeUnits.push({
                          unitId: assignment.equipmentUnitId,
                          reason: !isAtPrimaryLocation
                            ? 'UNIT_NOT_AT_PRIMARY_LOCATION'
                            : !isUndamaged
                              ? `UNIT_CONDITION_${unit.condition}`
                              : `UNIT_STATUS_INELIGIBLE_${unit.status}`,
                        })
                      }
                    }
                  }
                }

                if (order.inventoryTaskViaOrderId) {
                  await tx.inventoryTask.update({
                    where: { id: order.inventoryTaskViaOrderId.id },
                    data: {
                      status: hasUnsafeUnits ? InventoryTaskStatus.BLOCKED : InventoryTaskStatus.CLOSED,
                      version: { increment: 1 },
                    },
                  })
                }

                for (const dt of order.deliveryTasksViaOrderId) {
                  await tx.deliveryTask.update({
                    where: { id: dt.id },
                    data: { status: DeliveryTaskStatus.CANCELLED, version: { increment: 1 } },
                  })
                }

                await tx.rentalOrder.update({
                  where: { id: order.id, version: order.version },
                  data: {
                    status: RentalOrderStatus.CANCELLED,
                    financialStatus: financial.financialStatus ?? order.financialStatus,
                    exceptionStatus:
                      hasUnsafeUnits || financial.reviewReason
                        ? RentalOrderExceptionStatus.ACTION_REQUIRED
                        : RentalOrderExceptionStatus.NONE,
                    cancelledAt: effectiveAt,
                    version: { increment: 1 },
                  },
                })

                await tx.rentalOutboxEvent.upsert({
                  where: { deduplicationKey: `membership-cancel:${order.id}:${canonicalVersion}` },
                  update: {},
                  create: {
                    deduplicationKey: `membership-cancel:${order.id}:${canonicalVersion}`,
                    eventType: 'RENTAL_ORDER_CANCELLED',
                    aggregateType: 'RentalOrder',
                    aggregateId: order.id,
                    payload: jsonValue({
                      orderId: order.id,
                      membershipRef: order.membershipRef,
                      membershipKind: order.membershipKind,
                      tripId: order.tripId,
                      reason: command.payload.reason ?? command.eventType,
                      status: 'CANCELLED',
                      financialStatus: financial.financialStatus ?? order.financialStatus,
                      custodyPendingReturn: false,
                    }),
                  },
                })

                if (hasUnsafeUnits) {
                  await tx.rentalOutboxEvent.upsert({
                    where: {
                      deduplicationKey: `rental-action-required:unsafe-units-membership:${order.id}:${canonicalVersion}`,
                    },
                    update: {},
                    create: {
                      deduplicationKey: `rental-action-required:unsafe-units-membership:${order.id}:${canonicalVersion}`,
                      eventType: 'RENTAL_ACTION_REQUIRED',
                      aggregateType: 'RentalOrder',
                      aggregateId: order.id,
                      payload: jsonValue({
                        orderId: order.id,
                        membershipRef: order.membershipRef,
                        membershipKind: order.membershipKind,
                        tripId: order.tripId,
                        reason: 'PRE_HANDOVER_CANCELLATION_UNSAFE_UNIT_CUSTODY',
                        detail:
                          'One or more assigned equipment units are damaged, lost, or not at primary warehouse. Staff inventory action required.',
                        unsafeUnits,
                        status: RentalOrderStatus.CANCELLED,
                      }),
                    },
                  })
                  if (!actionRequiredOrderIds.includes(order.id)) actionRequiredOrderIds.push(order.id)
                }

                cancelledOrderIds.push(order.id)
              }
            } else {
              // ACTIVE: custody preserved
              await ensureReturnTaskWithTx(tx, order.id, effectiveAt, 'MEMBERSHIP_REVOKED_AFTER_HANDOVER')
              await tx.rentalOrder.update({
                where: { id: order.id, version: order.version },
                data: {
                  exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
                  version: { increment: 1 },
                },
              })

              for (const dt of order.deliveryTasksViaOrderId) {
                if (dt.taskType === 'RETURN' && dt.status === DeliveryTaskStatus.SCHEDULED) {
                  await tx.deliveryTask.update({
                    where: { id: dt.id },
                    data: { exceptionNotes: 'MEMBERSHIP_REVOKED_WITH_ACTIVE_RENTAL', version: { increment: 1 } },
                  })
                }
              }

              await tx.rentalOutboxEvent.upsert({
                where: { deduplicationKey: `membership-cancel-active:${order.id}:${canonicalVersion}` },
                update: {},
                create: {
                  deduplicationKey: `membership-cancel-active:${order.id}:${canonicalVersion}`,
                  eventType: 'RENTAL_ACTION_REQUIRED',
                  aggregateType: 'RentalOrder',
                  aggregateId: order.id,
                  payload: jsonValue({
                    orderId: order.id,
                    membershipRef: order.membershipRef,
                    membershipKind: order.membershipKind,
                    tripId: order.tripId,
                    reason: 'ACTIVE_RENTAL_MEMBERSHIP_REVOKED_CUSTODY_PRESERVED',
                    detail:
                      'User membership revoked while holding physical equipment. Order custody preserved, return workflow scheduled.',
                    status: order.status,
                    contextVersion: canonicalVersion,
                  }),
                },
              })

              if (!actionRequiredOrderIds.includes(order.id)) actionRequiredOrderIds.push(order.id)
            }

            affectedOrderIds.push(order.id)
          }

          const executionResult: LifecycleExecutionResult = {
            eventId: command.eventId,
            status: 'PROCESSED',
            affectedOrderCount: affectedOrderIds.length,
            affectedOrderIds,
            conflicts: [],
            scheduleNoticesIssued: [],
            cancelledOrderIds,
            actionRequiredOrderIds,
          }

          await tx.rentalInboxEvent.update({
            where: { id: inbox.id },
            data: {
              status: EventStatus.PROCESSED,
              processedAt: new Date(),
              result: jsonValue(executionResult),
            },
          })

          return executionResult
        },
        { timeout: 30_000, maxWait: 10_000 },
      )
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.rentalInboxEvent.findUnique({
          where: { eventId: command.eventId },
        })
        if (existing?.result) {
          return existing.result as unknown as LifecycleExecutionResult
        }
        return {
          eventId: command.eventId,
          status: 'SKIPPED_DUPLICATE',
          affectedOrderCount: 0,
          affectedOrderIds: [],
          conflicts: [],
          scheduleNoticesIssued: [],
        }
      }
      throw err
    }
  }
}
