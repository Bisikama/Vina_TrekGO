import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../shared/services/prisma.service'
import { AppError, TRIP_PRICING_ERROR_CODES as TP } from '../../../shared/errors'
import {
  evaluateTripPricing,
  type CostItemInput,
  type FeePolicyConfig,
  type PricingEvaluationResult,
} from './pricing-calculator'
import type { CostPlanSaveInput, PricingConfirmInput, PricingPreviewInput } from './trip-pricing.dto'

const DEFAULT_FEE_POLICY: FeePolicyConfig = {
  policyVersion: 'fee-2026-v1',
  platformFeeBps: 800,
  paymentFeeBps: 200,
  defaultContingencyBps: 500,
  defaultTargetMarginBps: 1200,
  roundingStepVnd: '10000',
}

const costPlanInclude = {
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      stepTiers: { orderBy: { triggerMinPax: 'asc' as const } },
    },
  },
} satisfies Prisma.TripCostPlanInclude

type CostPlanRow = Prisma.TripCostPlanGetPayload<{ include: typeof costPlanInclude }>

function durationDaysOf(startAt: Date, endAt: Date): number {
  const diffMs = endAt.getTime() - startAt.getTime()
  return Math.max(1, Math.ceil(diffMs / 86_400_000))
}

function mapRowToCostItems(plan: CostPlanRow): CostItemInput[] {
  return plan.items.map((item) => ({
    category: item.category,
    name: item.nameSnapshot,
    kind: item.kind,
    basis: item.basis,
    unitPrice: item.unitPrice.toFixed(0),
    quantity: item.quantity,
    durationUnits: item.durationUnits,
    capacityPerUnit: item.capacityPerUnit,
    extraNonPayingPax: item.extraNonPayingPax,
    includedInPrice: item.includedInPrice,
    isEnabled: item.isEnabled,
    sourceNote: item.sourceNote,
    stepTiers: item.stepTiers.map((t) => ({
      triggerMinPax: t.triggerMinPax,
      triggerMaxPax: t.triggerMaxPax,
      operation: t.operation,
      amount: t.amount.toFixed(0),
      note: t.note,
    })),
  }))
}

@Injectable()
export class TripPricingService {
  constructor(private readonly db: PrismaService) {}

  private async verifyLeader(client: Prisma.TransactionClient | PrismaService, actorId: string) {
    if (!actorId) throw AppError.fromCode('UNAUTHENTICATED')
    const user = await client.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, status: true },
    })
    if (!user || user.role !== 'LEADER' || user.status !== 'ACTIVE') {
      throw AppError.fromCode('FORBIDDEN')
    }
    return user
  }

  private async resolveFeePolicy(client: Prisma.TransactionClient | PrismaService): Promise<FeePolicyConfig> {
    const config = await client.systemConfig?.findUnique?.({
      where: { configKey: 'PUBLIC_TRIP_PRICING_POLICY' },
    })
    if (!config || !config.value || typeof config.value !== 'object') {
      return DEFAULT_FEE_POLICY
    }
    const raw = config.value as Record<string, unknown>
    return {
      policyVersion: typeof raw.policyVersion === 'string' ? raw.policyVersion : DEFAULT_FEE_POLICY.policyVersion,
      platformFeeBps:
        typeof raw.platformFeeBps === 'number' ? raw.platformFeeBps : DEFAULT_FEE_POLICY.platformFeeBps,
      paymentFeeBps:
        typeof raw.paymentFeeBps === 'number' ? raw.paymentFeeBps : DEFAULT_FEE_POLICY.paymentFeeBps,
      defaultContingencyBps:
        typeof raw.defaultContingencyBps === 'number'
          ? raw.defaultContingencyBps
          : DEFAULT_FEE_POLICY.defaultContingencyBps,
      defaultTargetMarginBps:
        typeof raw.defaultTargetMarginBps === 'number'
          ? raw.defaultTargetMarginBps
          : DEFAULT_FEE_POLICY.defaultTargetMarginBps,
      roundingStepVnd:
        typeof raw.roundingStepVnd === 'string' ? raw.roundingStepVnd : DEFAULT_FEE_POLICY.roundingStepVnd,
    }
  }

  private assertEditableTrip(
    trip: {
      id: string
      tripType: string
      creatorId: string
      leaderId: string | null
      status: string
      startAt: Date
    } | null,
    actorId: string,
    now: Date,
  ) {
    if (!trip || trip.tripType !== 'PUBLIC') {
      throw AppError.fromCode(TP.NOT_FOUND)
    }
    if (trip.creatorId !== actorId || trip.leaderId !== actorId) {
      throw AppError.fromCode('FORBIDDEN')
    }
    if (!['DRAFT', 'OPEN', 'FULL'].includes(trip.status)) {
      throw AppError.fromCode(TP.LOCKED)
    }
    if (['OPEN', 'FULL'].includes(trip.status) && trip.startAt <= now) {
      throw AppError.fromCode(TP.LOCKED)
    }
  }

  async getPricingConfig(actorId: string) {
    await this.verifyLeader(this.db, actorId)
    const feePolicy = await this.resolveFeePolicy(this.db)
    return {
      ...feePolicy,
      totalFeeBps: feePolicy.platformFeeBps + feePolicy.paymentFeeBps,
      currency: 'VND',
    }
  }

  async getCostPlan(actorId: string, tripId: string) {
    await this.verifyLeader(this.db, actorId)
    const trip = await this.db.trip.findUnique({
      where: { id: tripId },
      include: {
        tripCostPlanViaTripId: { include: costPlanInclude },
        tripPricingVersionsViaTripId: { orderBy: { versionNo: 'desc' } },
      },
    })
    if (!trip || trip.tripType !== 'PUBLIC') {
      throw AppError.fromCode(TP.NOT_FOUND)
    }
    if (trip.creatorId !== actorId || trip.leaderId !== actorId) {
      throw AppError.fromCode('FORBIDDEN')
    }

    const feePolicy = await this.resolveFeePolicy(this.db)
    const plan = trip.tripCostPlanViaTripId
    const items = plan ? mapRowToCostItems(plan) : []

    let evaluation: PricingEvaluationResult | null = null
    if (plan && items.some((i) => i.includedInPrice && i.isEnabled)) {
      evaluation = evaluateTripPricing({
        maxPax: trip.maxPax,
        targetPax: Math.min(plan.targetPax, trip.maxPax),
        targetMarginBps: plan.targetMarginBps,
        contingencyBps: plan.contingencyBps,
        selectedPrice: plan.selectedPrice?.toFixed(0) ?? trip.pricePerPax?.toFixed(0) ?? null,
        selectedMinPax: plan.selectedMinPax ?? trip.minPax,
        items,
        feePolicy,
      })
    }

    return {
      tripId: trip.id,
      tripVersion: trip.version,
      tripStatus: trip.status,
      costPlanStatus: plan?.status ?? null,
      tripContext: {
        maxPax: trip.maxPax,
        minPax: trip.minPax,
        pricePerPax: trip.pricePerPax?.toFixed(0) ?? null,
        durationDays: durationDaysOf(trip.startAt, trip.endAt),
        startAt: trip.startAt.toISOString(),
        endAt: trip.endAt.toISOString(),
      },
      feePolicy: {
        ...feePolicy,
        totalFeeBps: feePolicy.platformFeeBps + feePolicy.paymentFeeBps,
      },
      plan: plan
        ? {
            id: plan.id,
            currency: plan.currency,
            targetPax: plan.targetPax,
            targetMarginBps: plan.targetMarginBps,
            contingencyBps: plan.contingencyBps,
            selectedPrice: plan.selectedPrice?.toFixed(0) ?? null,
            selectedMinPax: plan.selectedMinPax,
            status: plan.status,
            version: plan.version,
            items,
          }
        : null,
      evaluation,
      pricingVersions: (trip.tripPricingVersionsViaTripId ?? []).map((v) => ({
        id: v.id,
        versionNo: v.versionNo,
        selectedPrice: v.selectedPrice.toFixed(0),
        selectedMinPax: v.selectedMinPax,
        targetPax: v.targetPax,
        publishedAt: v.publishedAt.toISOString(),
      })),
    }
  }

  async previewPricing(actorId: string, tripId: string, input: PricingPreviewInput) {
    await this.verifyLeader(this.db, actorId)
    const trip = await this.db.trip.findUnique({ where: { id: tripId } })
    if (!trip || trip.tripType !== 'PUBLIC') {
      throw AppError.fromCode(TP.NOT_FOUND)
    }
    if (trip.creatorId !== actorId || trip.leaderId !== actorId) {
      throw AppError.fromCode('FORBIDDEN')
    }

    const feePolicy = await this.resolveFeePolicy(this.db)
    const evaluation = evaluateTripPricing({
      maxPax: trip.maxPax,
      targetPax: input.targetPax,
      targetMarginBps: input.targetMarginBps,
      contingencyBps: input.contingencyBps,
      selectedPrice: input.selectedPrice ?? null,
      selectedMinPax: input.selectedMinPax ?? null,
      items: input.items,
      feePolicy,
    })

    return {
      tripId: trip.id,
      tripVersion: trip.version,
      tripContext: {
        maxPax: trip.maxPax,
        minPax: trip.minPax,
        durationDays: durationDaysOf(trip.startAt, trip.endAt),
      },
      ...evaluation,
    }
  }

  async saveCostPlan(actorId: string, tripId: string, input: CostPlanSaveInput) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${actorId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`
      await this.verifyLeader(tx, actorId)

      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: { tripCostPlanViaTripId: true },
      })
      const now = new Date()
      this.assertEditableTrip(trip, actorId, now)

      if (trip!.version !== input.expectedVersion) {
        throw AppError.fromCode(TP.VERSION_CONFLICT)
      }

      const feePolicy = await this.resolveFeePolicy(tx)
      const evaluation = evaluateTripPricing({
        maxPax: trip!.maxPax,
        targetPax: input.targetPax,
        targetMarginBps: input.targetMarginBps,
        contingencyBps: input.contingencyBps,
        selectedPrice: input.selectedPrice ?? null,
        selectedMinPax: input.selectedMinPax ?? null,
        items: input.items,
        feePolicy,
      })

      const planData = {
        currency: 'VND',
        targetPax: input.targetPax,
        targetMarginBps: input.targetMarginBps,
        contingencyBps: input.contingencyBps,
        selectedPrice: input.selectedPrice ? new Prisma.Decimal(input.selectedPrice) : null,
        selectedMinPax: input.selectedMinPax ?? null,
        calcVersion: evaluation.calcVersion,
        policyVersionRef: feePolicy.policyVersion,
        status: 'DRAFT' as const,
      }

      let costPlanId: string
      if (trip!.tripCostPlanViaTripId) {
        costPlanId = trip!.tripCostPlanViaTripId.id
        await tx.tripCostItem.deleteMany({ where: { costPlanId } })
        await tx.tripCostPlan.update({
          where: { id: costPlanId },
          data: { ...planData, version: { increment: 1 } },
        })
      } else {
        const created = await tx.tripCostPlan.create({
          data: {
            tripId,
            ...planData,
          },
        })
        costPlanId = created.id
      }

      for (let idx = 0; idx < input.items.length; idx++) {
        const item = input.items[idx]
        const createdItem = await tx.tripCostItem.create({
          data: {
            costPlanId,
            category: item.category,
            nameSnapshot: item.name,
            kind: item.kind,
            basis: item.basis,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            quantity: item.quantity,
            durationUnits: item.durationUnits,
            capacityPerUnit: item.capacityPerUnit ?? null,
            extraNonPayingPax: item.extraNonPayingPax,
            includedInPrice: item.includedInPrice,
            isEnabled: item.isEnabled,
            sourceNote: item.sourceNote ?? null,
            sortOrder: idx + 1,
          },
        })
        if (item.stepTiers?.length) {
          await tx.tripCostStepTier.createMany({
            data: item.stepTiers.map((tier) => ({
              costItemId: createdItem.id,
              triggerMinPax: tier.triggerMinPax,
              triggerMaxPax: tier.triggerMaxPax,
              operation: tier.operation,
              amount: new Prisma.Decimal(tier.amount),
              note: tier.note ?? null,
            })),
          })
        }
      }

      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: { version: { increment: 1 } },
      })

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'TRIP_COST_PLAN_SAVED',
          entityType: 'Trip',
          entityId: tripId,
          newValues: {
            tripVersion: updatedTrip.version,
            targetPax: input.targetPax,
            selectedPrice: input.selectedPrice ?? null,
            itemCount: input.items.length,
          },
        },
      })

      return {
        tripId,
        tripVersion: updatedTrip.version,
        tripStatus: updatedTrip.status,
        costPlanStatus: 'DRAFT' as const,
        tripContext: {
          maxPax: updatedTrip.maxPax,
          minPax: updatedTrip.minPax,
          pricePerPax: updatedTrip.pricePerPax?.toFixed(0) ?? null,
          durationDays: durationDaysOf(updatedTrip.startAt, updatedTrip.endAt),
        },
        ...evaluation,
      }
    })
  }

  async confirmPricing(actorId: string, tripId: string, input: PricingConfirmInput) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${actorId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`
      await this.verifyLeader(tx, actorId)

      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: {
          tripCostPlanViaTripId: { include: costPlanInclude },
          tripPricingVersionsViaTripId: { orderBy: { versionNo: 'desc' }, take: 1 },
        },
      })
      const now = new Date()
      this.assertEditableTrip(trip, actorId, now)

      if (trip!.version !== input.expectedVersion) {
        throw AppError.fromCode(TP.VERSION_CONFLICT)
      }

      const plan = trip!.tripCostPlanViaTripId
      if (!plan || !plan.items.length) {
        throw AppError.fromCode(TP.NOT_FOUND, {
          message: 'Cần tạo và lưu bảng chi phí (cost-plan) trước khi chốt giá.',
        })
      }

      const feePolicy = await this.resolveFeePolicy(tx)
      const items = mapRowToCostItems(plan)
      const targetPax = input.targetPax ?? plan.targetPax

      const evaluation = evaluateTripPricing({
        maxPax: trip!.maxPax,
        targetPax,
        targetMarginBps: plan.targetMarginBps,
        contingencyBps: plan.contingencyBps,
        selectedPrice: input.selectedPrice,
        selectedMinPax: input.selectedMinPax,
        items,
        feePolicy,
      })

      const lossIntervals = evaluation.riskIntervals.filter((r) => r.type === 'LOSS_IN_OPERATING_RANGE')
      if (lossIntervals.length > 0) {
        throw AppError.fromCode(TP.LOSS_INTERVAL, {
          details: {
            selectedPrice: input.selectedPrice,
            selectedMinPax: input.selectedMinPax,
            lossIntervals,
          },
        })
      }

      const isPostPublish = ['OPEN', 'FULL'].includes(trip!.status)
      const nextPlanStatus = isPostPublish ? ('PUBLISHED' as const) : ('CONFIRMED' as const)

      await tx.tripCostPlan.update({
        where: { id: plan.id },
        data: {
          targetPax,
          selectedPrice: new Prisma.Decimal(input.selectedPrice),
          selectedMinPax: input.selectedMinPax,
          policyVersionRef: feePolicy.policyVersion,
          status: nextPlanStatus,
          version: { increment: 1 },
        },
      })

      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: {
          pricePerPax: new Prisma.Decimal(input.selectedPrice),
          minPax: input.selectedMinPax,
          priceExplanation: evaluation.generatedPriceExplanation,
          version: { increment: 1 },
        },
      })

      let createdPricingVersionNo: number | null = null
      if (isPostPublish) {
        const lastVersionNo = trip!.tripPricingVersionsViaTripId?.[0]?.versionNo ?? 0
        createdPricingVersionNo = lastVersionNo + 1
        await tx.tripPricingVersion.create({
          data: {
            tripId,
            versionNo: createdPricingVersionNo,
            selectedPrice: new Prisma.Decimal(input.selectedPrice),
            selectedMinPax: input.selectedMinPax,
            targetPax,
            costInputSnapshot: {
              currency: plan.currency,
              targetPax,
              targetMarginBps: plan.targetMarginBps,
              contingencyBps: plan.contingencyBps,
              items,
            } as unknown as Prisma.InputJsonValue,
            feeAssumptionSnapshot: evaluation.feePolicy as unknown as Prisma.InputJsonValue,
            pricingResultSnapshot: {
              summary: evaluation.summary,
              riskIntervals: evaluation.riskIntervals,
              scenarios: evaluation.scenarios,
            } as unknown as Prisma.InputJsonValue,
            createdBy: actorId,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: isPostPublish ? 'TRIP_PRICING_UPDATED_POST_PUBLISH' : 'TRIP_PRICING_CONFIRMED',
          entityType: 'Trip',
          entityId: tripId,
          oldValues: {
            pricePerPax: trip!.pricePerPax?.toFixed(0) ?? null,
            minPax: trip!.minPax,
          },
          newValues: {
            newPrice: input.selectedPrice,
            selectedMinPax: input.selectedMinPax,
            targetPax,
            pricingVersionNo: createdPricingVersionNo,
            tripVersion: updatedTrip.version,
          },
        },
      })

      return {
        tripId,
        tripVersion: updatedTrip.version,
        tripStatus: updatedTrip.status,
        costPlanStatus: nextPlanStatus,
        selectedPrice: input.selectedPrice,
        selectedMinPax: input.selectedMinPax,
        targetPax,
        pricingVersionNo: createdPricingVersionNo,
        ...evaluation,
      }
    })
  }
}
