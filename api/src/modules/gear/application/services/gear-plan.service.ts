import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import * as crypto from 'crypto'
import { AppError } from '../../../../shared/errors/app-error'
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes'
import { COMMON_ERROR_CODES } from '../../../../shared/errors/codes/common.error-codes'
import {
  buildTripRequirements,
  evaluateGearCheck,
  isCoreGearCategory,
  lookupClimateEstimate,
  PlanCoverageResult,
  PlanGearItemInput,
  resolvePlanCoverage,
  TripContext,
} from '../../domain'
import type { CoreGearCategory, CoreGearItemInput } from '../../domain'
import { GEAR_PLAN_REPOSITORY_PORT } from '../ports/gear-plan.repository.port'
import type { GearPlanRepositoryPort } from '../ports/gear-plan.repository.port'
import { GEAR_PLAN_REVISION_REPOSITORY_PORT } from '../ports/gear-plan-revision.repository.port'
import type { GearPlanRevisionRepositoryPort } from '../ports/gear-plan-revision.repository.port'
import { USER_GEAR_REPOSITORY_PORT } from '../ports/user-gear.repository.port'
import type { UserGearRepositoryPort } from '../ports/user-gear.repository.port'
import { TRIP_CONTEXT_READ_PORT } from '../ports/trip-context-read.port'
import type { TripContextReadPort } from '../ports/trip-context-read.port'
import { GEAR_PLAN_OPTION_SET_REPOSITORY_PORT } from '../ports/gear-plan-option-set.repository.port'
import type { GearPlanOptionSetRepositoryPort } from '../ports/gear-plan-option-set.repository.port'
import { GEAR_ADVICE_RUN_REPOSITORY_PORT } from '../ports/gear-advice-run.repository.port'
import type { GearAdviceRunRepositoryPort } from '../ports/gear-advice-run.repository.port'
import { GEAR_QUOTE_LINK_REPOSITORY_PORT } from '../ports/gear-quote-link.repository.port'
import type { GearQuoteLinkRepositoryPort } from '../ports/gear-quote-link.repository.port'
import { GEAR_AI_PORT } from '../ports/gear-ai.port'
import type { GearAiPort } from '../ports/gear-ai.port'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { GearRuleService } from './gear-rule.service'
import type {
  CreatePlanInputDto,
  EvaluatePlanDto,
  UpdateChecklistProgressDto,
  UpdatePlanInputDto,
  GeneratePlanOptionsDto,
  GeneratePlanAdviceDto,
  CreateQuoteIntentDto,
  LinkQuoteDto,
} from '../dtos/gear-plan.dto'
import { GearPlanDomain, GearPlanRevisionDomain, GearOptionObjective, GearAdviceSource } from '../../domain/gear.types'
import {
  calculateChargedDays,
  parseWholeVnd,
  calculateDepositPerUnit,
  rentalOccupiedFrom,
} from '../../../../modules/rental/ordering/application/services/rental-ordering.rules'
import { getVerifiedCapacitySnapshot } from '../../../../modules/rental/ordering/infrastructure/adapters/rental-capacity-snapshot'
import { evaluateSubjectRequirementConstraints } from '../../domain/constraint-evaluator'
import {
  solveDeterministicPlannerOption,
  PlannerNeed,
  CandidateProduct,
  OwnedAssignment,
} from '../../domain/pure-planner'
import { validateNarrativeViGrounding } from '../../domain/advice-grounding'

function canonicalStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']'
  }
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}'
}

@Injectable()
export class GearPlanService {
  private readonly logger = new Logger(GearPlanService.name)

  constructor(
    @Inject(GEAR_PLAN_REPOSITORY_PORT)
    private readonly gearPlanRepo: GearPlanRepositoryPort,
    @Inject(GEAR_PLAN_REVISION_REPOSITORY_PORT)
    private readonly planRevisionRepo: GearPlanRevisionRepositoryPort,
    @Inject(USER_GEAR_REPOSITORY_PORT)
    private readonly userGearRepo: UserGearRepositoryPort,
    @Inject(TRIP_CONTEXT_READ_PORT)
    private readonly tripContextPort: TripContextReadPort,
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(GEAR_PLAN_OPTION_SET_REPOSITORY_PORT)
    private readonly optionSetRepo?: GearPlanOptionSetRepositoryPort,
    @Optional()
    @Inject(GEAR_ADVICE_RUN_REPOSITORY_PORT)
    private readonly adviceRunRepo?: GearAdviceRunRepositoryPort,
    @Optional()
    @Inject(GEAR_QUOTE_LINK_REPOSITORY_PORT)
    private readonly quoteLinkRepo?: GearQuoteLinkRepositoryPort,
    @Optional()
    @Inject(GEAR_AI_PORT)
    private readonly gearAiPort?: GearAiPort,
    @Optional()
    private readonly ruleService?: GearRuleService,
  ) {}

  /**
   * Reads canonical trip facts and climate estimation for plan prefill.
   */
  async getTripPrefill(tripId: string, userId: string): Promise<Record<string, unknown>> {
    const facts = await this.tripContextPort.getTripContext(tripId, userId)

    let month: number | null = null
    if (facts.startAt) {
      const startAtDate = new Date(facts.startAt)
      const saigonMonthStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Saigon',
        month: 'numeric',
      }).format(startAtDate)
      month = parseInt(saigonMonthStr, 10)
    }

    const destination = facts.destination || null
    const climate = destination && month ? lookupClimateEstimate(destination, month) : null

    let requirements: any[] = []
    if (climate && facts.difficulty && facts.days) {
      const tripContext: TripContext = {
        temp_min_c: climate.temp_min_c,
        temp_max_c: climate.temp_max_c,
        temp_min_night_c: climate.temp_min_night_c,
        rain_prob_pct: climate.rain_prob_pct,
        difficulty: facts.difficulty,
        days: facts.days,
        terrain: facts.terrain || [],
      }
      requirements = buildTripRequirements(tripContext)
    }

    return {
      tripId: facts.tripId,
      destination,
      status: facts.status,
      startAt: facts.startAt,
      endAt: facts.endAt,
      days: facts.days,
      difficulty: facts.difficulty,
      terrain: facts.terrain,
      contextVersion: facts.contextVersion,
      sourceReferences: facts.sourceReferences,
      suggestedClimate: climate
        ? {
            temp_min_c: climate.temp_min_c,
            temp_max_c: climate.temp_max_c,
            temp_min_night_c: climate.temp_min_night_c,
            rain_prob_pct: climate.rain_prob_pct,
            source: 'CLIMATE_ESTIMATE',
            sourceReference: climate.sourceReference,
          }
        : null,
      requirements,
    }
  }

  async createPlan(userId: string, input: CreatePlanInputDto): Promise<GearPlanDomain> {
    let facts: any = null
    let missingContext: string[] = []

    try {
      facts = await this.tripContextPort.getTripContext(input.tripId, userId)
    } catch (err: any) {
      if (err?.code === GEAR_ERROR_CODES.GEAR_NEEDS_CONTEXT) {
        // Allow creating incomplete draft plan when official facts are missing
        missingContext = ['difficulty', 'terrain']
      } else {
        throw err
      }
    }

    if (input.selectedItemIds && input.selectedItemIds.length > 0) {
      const items = await this.userGearRepo.findByIdsAndUser(input.selectedItemIds, userId)
      if (items.length !== input.selectedItemIds.length) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
          message: 'Một hoặc nhiều món đồ đã chọn không tồn tại hoặc không thuộc sở hữu của bạn',
        })
      }
    }

    const destination = facts?.destination || null
    let month: number | null = null
    if (facts?.startAt) {
      const startAtDate = new Date(facts.startAt)
      const saigonMonthStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Saigon',
        month: 'numeric',
      }).format(startAtDate)
      month = parseInt(saigonMonthStr, 10)
    }
    const climate = destination && month ? lookupClimateEstimate(destination, month) : null

    const canonicalContext: Record<string, unknown> = {
      tripId: input.tripId,
      destination,
      startAt: facts?.startAt ?? null,
      endAt: facts?.endAt ?? null,
      days: facts?.days ?? null,
      difficulty: facts?.difficulty ?? null,
      terrain: facts?.terrain ?? [],
      contextVersion: facts?.contextVersion ?? null,
      sourceReferences: facts?.sourceReferences ?? null,
      missingContext,
      suggestedClimate: climate
        ? {
            temp_min_c: climate.temp_min_c,
            temp_max_c: climate.temp_max_c,
            temp_min_night_c: climate.temp_min_night_c,
            rain_prob_pct: climate.rain_prob_pct,
            source: 'CLIMATE_ESTIMATE',
            sourceReference: climate.sourceReference,
          }
        : null,
      confirmedClimate: null,
    }

    return this.gearPlanRepo.create({
      userId,
      title: input.title,
      contextMode: 'TRIP',
      tripId: input.tripId,
      selectedItemIds: input.selectedItemIds,
      preferences: input.preferences,
      canonicalContext,
    })
  }

  async getPlan(id: string, userId: string): Promise<GearPlanDomain & { isStale?: boolean }> {
    const plan = await this.gearPlanRepo.findByIdAndUser(id, userId)
    if (!plan) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND, {
        message: 'Kế hoạch trang bị không tồn tại hoặc không thuộc quyền sở hữu của bạn',
      })
    }

    let isStale = false
    if (plan.tripId) {
      try {
        const currentFacts = await this.tripContextPort.getTripContext(plan.tripId, userId)
        const savedCtxVersion = (plan.canonicalContext as any)?.contextVersion
        if (savedCtxVersion && currentFacts.contextVersion !== savedCtxVersion) {
          isStale = true
        }
      } catch (err: any) {
        // If trip ended, fallback to historical read without stale flag
        if (err?.code !== GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE) {
          // preserve
        }
      }
    }

    // Check if gear items have changed since last evaluation
    if (plan.evaluatedRevision && !isStale) {
      try {
        const latestRev = await this.planRevisionRepo.findByPlanAndRevision(id, plan.evaluatedRevision)
        if (latestRev && latestRev.inputSnapshot && Array.isArray((latestRev.inputSnapshot as any).items)) {
          const snapshotItems = (latestRev.inputSnapshot as any).items as Array<{
            id: string
            version?: number
            attributes?: Record<string, unknown>
          }>
          const currentItems =
            plan.selectedItemIds.length > 0
              ? await this.userGearRepo.findByIdsAndUser(plan.selectedItemIds, userId)
              : []
          if (currentItems.length !== snapshotItems.length) {
            isStale = true
          } else {
            for (const sItem of snapshotItems) {
              const cur = currentItems.find((c) => c.id === sItem.id)
              if (!cur) {
                isStale = true
                break
              }
              if (cur.version !== sItem.version) {
                isStale = true
                break
              }
              if (canonicalStringify(cur.attributes) !== canonicalStringify(sItem.attributes)) {
                isStale = true
                break
              }
            }
          }
        }
      } catch {
        // ignore error on stale check
      }
    }

    return { ...plan, isStale }
  }

  async listPlans(userId: string): Promise<GearPlanDomain[]> {
    return this.gearPlanRepo.findAllByUser(userId)
  }

  async updatePlanInput(id: string, userId: string, input: UpdatePlanInputDto): Promise<GearPlanDomain> {
    const plan = await this.getPlan(id, userId)

    // Block mutation if trip is ended or ineligible (F06)
    if (plan.tripId) {
      if (this.prisma.trip) {
        const trip = await this.prisma.trip.findUnique({
          where: { id: plan.tripId },
          select: { id: true, status: true, endAt: true },
        })
        if (
          trip &&
          (trip.status === 'COMPLETED' || trip.status === 'CANCELLED' || (trip.endAt && trip.endAt < new Date()))
        ) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, {
            message: 'Chuyến đi đã kết thúc hoặc không còn khả dụng để tư vấn trang bị',
          })
        }
      }
      await this.tripContextPort.getTripContext(plan.tripId, userId)
    }

    if (input.selectedItemIds && input.selectedItemIds.length > 0) {
      const items = await this.userGearRepo.findByIdsAndUser(input.selectedItemIds, userId)
      if (items.length !== input.selectedItemIds.length) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
          message: 'Một hoặc nhiều món đồ đã chọn không tồn tại hoặc không thuộc sở hữu của bạn',
        })
      }
    }

    return this.gearPlanRepo.updateSemanticCAS(id, userId, input.expectedInputRevision, {
      title: input.title,
      preferences: input.preferences,
      selectedItemIds: input.selectedItemIds,
    })
  }

  async updateChecklistProgress(
    id: string,
    userId: string,
    input: UpdateChecklistProgressDto,
  ): Promise<GearPlanDomain> {
    const plan = await this.getPlan(id, userId)

    // Verify trip is active and eligible (progress cannot be modified after trip ends)
    if (plan.tripId) {
      if (this.prisma.trip) {
        const trip = await this.prisma.trip.findUnique({
          where: { id: plan.tripId },
          select: { id: true, status: true, endAt: true },
        })
        if (
          trip &&
          (trip.status === 'COMPLETED' || trip.status === 'CANCELLED' || (trip.endAt && trip.endAt < new Date()))
        ) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, {
            message: 'Chuyến đi đã kết thúc hoặc không còn khả dụng để tư vấn trang bị',
          })
        }
      }
      await this.tripContextPort.getTripContext(plan.tripId, userId)
    }

    // Check for duplicate requirementIds in input
    const seenReqIds = new Set<string>()
    for (const item of input.items) {
      if (seenReqIds.has(item.requirementId)) {
        throw AppError.fromCode(COMMON_ERROR_CODES.VALIDATION_ERROR, {
          message: `Mã yêu cầu trùng lặp trong danh sách tiến độ: ${item.requirementId}`,
        })
      }
      seenReqIds.add(item.requirementId)
    }

    // Validate requirementIds against server-known requirements from current checklist (B08)
    const validRequirementIds = new Set<string>()

    if (plan.evaluatedRevision) {
      const latestRev = await this.planRevisionRepo.findByPlanAndRevision(id, plan.evaluatedRevision)
      if (latestRev && (latestRev.resultSnapshot as any)?.checklist) {
        for (const c of (latestRev.resultSnapshot as any).checklist) {
          if (c.requirementId) validRequirementIds.add(c.requirementId)
        }
      }
    } else {
      // Before first evaluation, only mandatory baseline requirement IDs (R26) are eligible
      validRequirementIds.add('req_jacket')
      validRequirementIds.add('req_footwear')
      validRequirementIds.add('req_backpack')
    }

    for (const item of input.items) {
      if (!validRequirementIds.has(item.requirementId)) {
        throw AppError.fromCode(COMMON_ERROR_CODES.VALIDATION_ERROR, {
          message: `Mã yêu cầu không tồn tại trong danh sách chuẩn bị: ${item.requirementId}`,
        })
      }
    }

    return this.gearPlanRepo.updateProgressCAS(id, userId, input.expectedProgressVersion, input.items)
  }

  async evaluatePlan(id: string, userId: string, input: EvaluatePlanDto): Promise<Record<string, unknown>> {
    const plan = await this.getPlan(id, userId)

    if (!plan.tripId) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_FOUND, {
        message: 'Kế hoạch thiếu thông tin chuyến đi hợp lệ',
      })
    }

    // 1. Verify trip eligibility and user active membership
    const tripFacts = await this.tripContextPort.getTripContext(plan.tripId, userId)

    // 2. CAS write condition check: inputRevision must match expectedInputRevision
    if (plan.inputRevision !== input.expectedInputRevision) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT, {
        message: `Xung đột phiên bản kế hoạch (hiện tại: ${plan.inputRevision}, yêu cầu: ${input.expectedInputRevision})`,
      })
    }

    // 3. Validate rule repository integrity before running evaluation
    await this.ruleService?.validateRulesIntegrity()

    // 4. Resolve confirmed climate
    let confirmedClimate = (plan.canonicalContext as any)?.confirmedClimate
    let contextUpdated = false

    if (input.confirmedClimate) {
      const existingClimate = (plan.canonicalContext as any)?.confirmedClimate
      const isDifferent =
        !existingClimate ||
        existingClimate.temp_min_c !== input.confirmedClimate.temp_min_c ||
        existingClimate.temp_max_c !== input.confirmedClimate.temp_max_c ||
        existingClimate.temp_min_night_c !== input.confirmedClimate.temp_min_night_c ||
        existingClimate.rain_prob_pct !== input.confirmedClimate.rain_prob_pct

      if (isDifferent) {
        confirmedClimate = input.confirmedClimate
        contextUpdated = true
      }
    }

    if (!confirmedClimate) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_NEEDS_CONTEXT, {
        message: 'Điều kiện thời tiết của chuyến đi chưa được xác nhận',
      })
    }

    const updatedCanonicalContext: Record<string, unknown> = {
      ...(plan.canonicalContext || {}),
      days: tripFacts.days,
      difficulty: tripFacts.difficulty,
      terrain: tripFacts.terrain,
      destination: tripFacts.destination,
      contextVersion: tripFacts.contextVersion,
      confirmedClimate,
    }

    if (contextUpdated) {
      plan.canonicalContext = updatedCanonicalContext
    }

    // 5. Fetch selected owned items and enforce all-or-nothing ownership
    const items =
      plan.selectedItemIds.length > 0 ? await this.userGearRepo.findByIdsAndUser(plan.selectedItemIds, userId) : []

    if (items.length !== plan.selectedItemIds.length) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
        message: 'Một hoặc nhiều món đồ đã chọn không tồn tại hoặc không thuộc sở hữu của bạn',
      })
    }

    // 6. Build TripContext and evaluate coverage
    const tripContext: TripContext = {
      temp_min_c: confirmedClimate.temp_min_c,
      temp_max_c: confirmedClimate.temp_max_c,
      temp_min_night_c: confirmedClimate.temp_min_night_c,
      rain_prob_pct: confirmedClimate.rain_prob_pct,
      difficulty: tripFacts.difficulty,
      days: tripFacts.days,
      terrain: tripFacts.terrain,
    }

    const coreInputs: PlanGearItemInput[] = items.map((i) => ({
      id: i.id,
      category: i.category,
      condition: i.condition,
      attributes: i.attributes || {},
    }))

    const explicitNeeds = Array.isArray((plan.preferences as any)?.explicitNeeds)
      ? (plan.preferences as any).explicitNeeds
      : undefined
    const requirements = buildTripRequirements(tripContext, explicitNeeds)
    const coverageResult: PlanCoverageResult = resolvePlanCoverage(coreInputs, requirements, tripContext)

    // 7. Run Core Engine evaluation for core categories (preserve per-item verdicts and gaps)
    const coreInputsForEngine: CoreGearItemInput[] = items
      .filter((i) => isCoreGearCategory(i.category))
      .map((i) => ({
        id: i.id,
        category: i.category as CoreGearCategory,
        condition: i.condition,
        attributes: i.attributes || {},
      }))

    const coreCheckResult = evaluateGearCheck(coreInputsForEngine, tripContext)

    // Merge user packing checklist progress for display
    const rawProgress = plan.progressJson
    const progressItems: Array<{ requirementId: string; isChecked: boolean }> = Array.isArray(rawProgress)
      ? (rawProgress as Array<{ requirementId: string; isChecked: boolean }>)
      : Array.isArray((rawProgress as any)?.items)
        ? ((rawProgress as any).items as Array<{ requirementId: string; isChecked: boolean }>)
        : []
    const progressMap = new Map(progressItems.map((p) => [p.requirementId, p.isChecked]))

    for (const checkItem of coverageResult.checklist) {
      if (progressMap.has(checkItem.requirementId)) {
        checkItem.isChecked = progressMap.get(checkItem.requirementId) === true
      }
    }

    // Pure technical evaluation hash contentHash MUST be computed without packing progress mutations
    const technicalChecklist = coverageResult.checklist.map((item) => {
      const { isChecked, ...pureProps } = item
      return pureProps
    })

    const technicalCoverage = {
      ...coverageResult,
      checklist: technicalChecklist,
    }

    // 8. Generate full inputSnapshot storing full items technical facts (F04)
    const inputSnapshot = {
      inputRevision: plan.inputRevision,
      selectedItemIds: plan.selectedItemIds,
      items: items.map((i) => ({
        id: i.id,
        category: i.category,
        name: i.name,
        condition: i.condition,
        attributes: i.attributes || {},
        source: i.source,
        version: i.version,
        updatedAt: i.updatedAt,
      })),
      preferences: plan.preferences,
      canonicalContext: updatedCanonicalContext,
    }

    let contentHash = crypto
      .createHash('sha256')
      .update(canonicalStringify({ inputSnapshot, coverage: technicalCoverage }))
      .digest('hex')

    // 9. Idempotency check: if revision with identical content hash already saved, replay safely
    const allRevisions = await this.planRevisionRepo.findAllByPlan(id)
    let targetRevision = plan.inputRevision
    const existingRevision = allRevisions.find((r) => r.revision === targetRevision)

    // If identical content hash already exists and is the current evaluated head: idempotent return
    if (existingRevision) {
      if (existingRevision.contentHash === contentHash && plan.evaluatedRevision === targetRevision) {
        return existingRevision.resultSnapshot
      }
      // If contentHash changed while at this inputRevision (source item/Trip changed),
      // CAS bump to new inputRevision per MASTER 4.1: "source item/Trip đổi được CAS thành input mới trước publish"
      const updatedPlan = await this.gearPlanRepo.updateSemanticCAS(id, userId, plan.inputRevision, {})
      targetRevision = updatedPlan.inputRevision
      plan.inputRevision = targetRevision
      inputSnapshot.inputRevision = targetRevision
      contentHash = crypto
        .createHash('sha256')
        .update(canonicalStringify({ inputSnapshot, coverage: technicalCoverage }))
        .digest('hex')
    }

    const resultSnapshot: Record<string, unknown> = {
      tripContext: tripFacts,
      climate: confirmedClimate,
      requirements: coverageResult.requirements,
      coverage: coverageResult,
      summary: coverageResult.summary,
      checklist: coverageResult.checklist,
      itemVerdicts: coreCheckResult.items.map((i) => ({
        itemId: i.itemId,
        category: i.category,
        verdict: i.verdict,
        reasons: i.reasons,
      })),
      gaps: coreCheckResult.gaps,
      coreCheck: coreCheckResult,
      evaluatedAt: new Date().toISOString(),
    }

    // 10. Save immutable revision record tied to inputRevision per MASTER 4.1
    await this.planRevisionRepo.saveRevision({
      planId: id,
      revision: targetRevision,
      contentHash,
      inputSnapshot,
      resultSnapshot,
      contextVersion: tripFacts.contextVersion || '3.1.5',
      ruleVersions: { version: '3.1.5', rulesCount: 28 },
    })

    // 11. Atomically set evaluated revision on plan with CAS expectedInputRevision and persist canonicalContext
    await this.gearPlanRepo.setEvaluatedRevision(
      id,
      userId,
      targetRevision,
      plan.inputRevision,
      contextUpdated ? updatedCanonicalContext : undefined,
    )

    return resultSnapshot
  }

  async getPlanRevisions(id: string, userId: string): Promise<GearPlanRevisionDomain[]> {
    await this.getPlan(id, userId)
    return this.planRevisionRepo.findAllByPlan(id)
  }

  async getPlanRevisionDetail(id: string, revision: number, userId: string): Promise<GearPlanRevisionDomain> {
    await this.getPlan(id, userId)
    const rev = await this.planRevisionRepo.findByPlanAndRevision(id, revision)
    if (!rev) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, {
        message: `Không tìm thấy phiên bản ${revision} của kế hoạch trang bị`,
      })
    }
    return rev
  }

  async getPlanDiff(
    id: string,
    userId: string,
    fromRevision?: number,
    toRevision?: number,
  ): Promise<Record<string, unknown>> {
    const plan = await this.getPlan(id, userId)

    const revisions = await this.planRevisionRepo.findAllByPlan(id)
    if (revisions.length === 0) {
      return {
        planId: id,
        fromRevision: null,
        toRevision: null,
        changes: [],
        message: 'Kế hoạch chưa có phiên bản đánh giá nào',
      }
    }

    const targetTo = toRevision ?? plan.evaluatedRevision ?? revisions[0].revision
    const targetFrom = fromRevision ?? (targetTo > 1 ? targetTo - 1 : targetTo)

    const revFrom = revisions.find((r) => r.revision === targetFrom)
    if (fromRevision !== undefined && !revFrom) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, {
        message: `Không tìm thấy phiên bản nguồn ${fromRevision} để so sánh`,
      })
    }

    const revTo = revisions.find((r) => r.revision === targetTo)
    if (toRevision !== undefined && !revTo) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, {
        message: `Không tìm thấy phiên bản đích ${toRevision} để so sánh`,
      })
    }

    const effectiveFrom = revFrom ?? revisions[revisions.length - 1]
    const effectiveTo = revTo ?? revisions[0]

    const fromChecklist = (effectiveFrom.resultSnapshot as any)?.checklist ?? []
    const toChecklist = (effectiveTo.resultSnapshot as any)?.checklist ?? []

    const changes: Array<{
      requirementId: string
      category: string
      fromStatus: string
      toStatus: string
      assignedItemChanged: boolean
      warningsChanged: boolean
    }> = []

    const fromMap = new Map<string, any>(fromChecklist.map((c: any) => [c.requirementId, c]))

    for (const toItem of toChecklist) {
      const fromItem = fromMap.get(toItem.requirementId)
      const statusChanged = !fromItem || fromItem.status !== toItem.status
      const assignedItemChanged = fromItem?.assignedItemId !== toItem.assignedItemId
      const warningsChanged = JSON.stringify(fromItem?.warnings ?? []) !== JSON.stringify(toItem.warnings ?? [])

      if (statusChanged || assignedItemChanged || warningsChanged) {
        changes.push({
          requirementId: toItem.requirementId,
          category: toItem.category,
          fromStatus: fromItem?.status ?? 'NONE',
          toStatus: toItem.status,
          assignedItemChanged,
          warningsChanged,
        })
      }
    }

    return {
      planId: id,
      fromRevision: effectiveFrom.revision,
      toRevision: effectiveTo.revision,
      changes,
      factsDiff: {
        fromItemCount: ((effectiveFrom.inputSnapshot as any)?.items ?? []).length,
        toItemCount: ((effectiveTo.inputSnapshot as any)?.items ?? []).length,
      },
      summary: (effectiveTo.resultSnapshot as any)?.summary ?? {},
    }
  }

  /**
   * Phase 10 & 11: Catalog Matching, Availability, Pricing & Deterministic Planner
   * Generates immutable GearPlanOptionSet with MIN_RENTAL_FEE and MIN_KNOWN_TOTAL_WEIGHT options.
   */
  async generatePlanOptions(
    planId: string,
    userId: string,
    dto: GeneratePlanOptionsDto,
  ): Promise<Record<string, unknown>> {
    const plan = await this.gearPlanRepo.findByIdAndUser(planId, userId)
    if (!plan) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND, {
        message: 'Kế hoạch trang bị không tồn tại hoặc không thuộc sở hữu của bạn',
      })
    }

    if (!plan.evaluatedRevision) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_EVALUATED, {
        message: 'Kế hoạch cần được đánh giá trước khi tìm phương án thuê',
      })
    }

    const targetRevision = dto.expectedRevision ?? dto.expectedInputRevision ?? plan.evaluatedRevision
    if (targetRevision !== plan.evaluatedRevision) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, {
        message: `Phiên bản kế hoạch không khớp với phiên bản đánh giá hiện tại (${plan.evaluatedRevision})`,
      })
    }

    const latestRevision = await this.planRevisionRepo.findByPlanAndRevision(planId, targetRevision)
    if (!latestRevision) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, {
        message: 'Không tìm thấy dữ liệu phiên bản đánh giá của kế hoạch',
      })
    }

    const snapshotInputRev = (latestRevision.inputSnapshot as any)?.inputRevision
    if (snapshotInputRev !== undefined && plan.inputRevision !== snapshotInputRev) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_STALE, {
        message: 'Kế hoạch đã thay đổi sau lần đánh giá cuối, vui lòng đánh giá lại trước khi tìm phương án thuê',
      })
    }

    const resultSnapshot = latestRevision.resultSnapshot as any
    const checklist: any[] = resultSnapshot?.checklist ?? []
    const tripId = plan.tripId
    if (!tripId) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_FOUND, {
        message: 'Kế hoạch không liên kết với chuyến đi hợp lệ',
      })
    }

    if (this.prisma.trip) {
      const tripRecord = await this.prisma.trip.findUnique({
        where: { id: tripId },
        select: { id: true, startAt: true, endAt: true, status: true },
      })
      if (
        tripRecord &&
        (tripRecord.status === 'COMPLETED' ||
          tripRecord.status === 'CANCELLED' ||
          (tripRecord.endAt && tripRecord.endAt < new Date()))
      ) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, {
          message: 'Chuyến đi đã kết thúc hoặc không còn khả dụng để thao tác kế hoạch',
        })
      }
    }

    const trip = await this.tripContextPort.getTripContext(tripId, userId)
    const chargedDays = calculateChargedDays(trip.startAt, trip.endAt, 'CEIL_24H')

    // Gear Category to Rental Category Slug mapping (All 8 categories per MASTER 1.1.I)
    const GEAR_TO_RENTAL_CATEGORY_SLUG: Record<string, string | null> = {
      JACKET: 'ao-mua-chong-thoi-tiet',
      FOOTWEAR: 'giay-leo-nui',
      BACKPACK: 'balo-trekking',
      SLEEPING_BAG: 'tui-ngu-dem-cach-nhiet',
      TENT: 'leu-trai',
      TREKKING_POLE: 'gay-trekking',
      RAIN_GEAR: 'ao-mua-chong-thoi-tiet',
      PANTS: null, // explicitly NO rental category in Rental catalog
    }

    // Owned items mapped from input snapshot
    const inputItems: any[] = (latestRevision.inputSnapshot as any)?.items ?? []
    const ownedItemsMap = new Map<string, any>(inputItems.map((i: any) => [i.id, i]))

    // Cache rental candidates per category to avoid repeated DB calls
    const candidatesPerCategory = new Map<string, CandidateProduct[]>()

    for (const req of checklist) {
      if (req.status === 'COVERED_BY_OWNED') continue

      const catKey = req.category
      if (candidatesPerCategory.has(catKey)) continue

      const slug = GEAR_TO_RENTAL_CATEGORY_SLUG[catKey]
      if (!slug || catKey === 'PANTS') {
        candidatesPerCategory.set(catKey, [])
        continue
      }

      const rentalCat = await this.prisma.rentalCategory.findUnique({
        where: { slug },
      })

      if (!rentalCat) {
        candidatesPerCategory.set(catKey, [])
        continue
      }

      const products = await this.prisma.rentalProduct.findMany({
        where: { categoryId: rentalCat.id, status: 'ACTIVE' },
        include: { technicalProfile: true },
        take: dto.candidateLimit ?? 20,
      })

      const candidateList: CandidateProduct[] = []
      for (const product of products) {
        const profileAttrs = (product.technicalProfile?.attributes as Record<string, unknown> | null) || null

        const dailyPriceBigInt = parseWholeVnd(product.dailyPrice.toString())
        const dailyPrice = Number(dailyPriceBigInt)
        const rentalFee = Number(dailyPriceBigInt * BigInt(chargedDays))
        const deposit = Number(
          calculateDepositPerUnit({
            depositPolicyType: product.depositPolicyType,
            depositValue: product.depositValue.toString(),
            replacementValue: product.replacementValue.toString(),
          }),
        )

        let availableCount = 0
        try {
          const occupiedFrom = rentalOccupiedFrom(trip.startAt)
          const activePolicy = this.prisma.rentalPolicy?.findFirst
            ? (await this.prisma.rentalPolicy.findFirst({
                where: {
                  isActive: true,
                  effectiveFrom: { lte: new Date() },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
                },
                orderBy: { effectiveFrom: 'desc' },
              })) || (await this.prisma.rentalPolicy.findFirst({ where: { isActive: true } }))
            : null
          const returnBuf =
            activePolicy?.returnBufferMinutes !== undefined && activePolicy?.returnBufferMinutes !== null
              ? Number(activePolicy.returnBufferMinutes)
              : 1440
          const cleaningBuf =
            activePolicy?.cleaningBufferMinutes !== undefined && activePolicy?.cleaningBufferMinutes !== null
              ? Number(activePolicy.cleaningBufferMinutes)
              : 0
          const bufferMinutes = Math.max(returnBuf, cleaningBuf)
          const occupiedUntil = new Date(trip.endAt.getTime() + bufferMinutes * 60_000)

          const capacitySnapshot = await getVerifiedCapacitySnapshot(this.prisma, {
            productId: product.id,
            occupiedFrom,
            occupiedUntil,
            now: new Date(),
          })
          availableCount = capacitySnapshot.availableCount
        } catch (err: any) {
          // Fail closed: if capacity snapshot cannot be verified, mark unavailable
          this.logger.warn(`Failed to verify capacity snapshot for product ${product.id}: ${err?.message}`)
          availableCount = 0
        }

        const weight_g = typeof profileAttrs?.weight_g === 'number' ? profileAttrs.weight_g : null

        candidateList.push({
          id: product.id,
          name: product.name,
          category: catKey,
          dailyPrice,
          rentalFee,
          deposit,
          availableCount,
          weight_g,
          attributes: profileAttrs || undefined,
        })
      }

      candidatesPerCategory.set(catKey, candidateList)
    }

    // Build owned assignments and uncovered needs for pure planner (B02)
    const ownedAssignments: OwnedAssignment[] = []
    const uncoveredNeeds: PlannerNeed[] = []

    for (const req of checklist) {
      const assignedIds: string[] =
        Array.isArray(req.assignedItemIds) && req.assignedItemIds.length > 0
          ? req.assignedItemIds
          : req.assignedItemId
            ? [req.assignedItemId]
            : []

      for (const itemId of assignedIds) {
        const ownedItem = ownedItemsMap.get(itemId)
        const weight_g =
          typeof ownedItem?.attributes?.weight_g === 'number' ? (ownedItem.attributes.weight_g as number) : null
        ownedAssignments.push({
          requirementId: req.requirementId,
          category: req.category,
          itemId,
          itemName: ownedItem?.name ?? req.title ?? req.requirementId,
          weight_g,
        })
      }

      const remainingQuantity =
        typeof req.remainingQuantity === 'number'
          ? req.remainingQuantity
          : req.status === 'COVERED_BY_OWNED'
            ? 0
            : (req.quantity ?? 1)

      if (remainingQuantity > 0) {
        uncoveredNeeds.push({
          requirementId: req.requirementId,
          category: req.category,
          priority: req.priority ?? 'REQUIRED',
          quantity: remainingQuantity,
          constraints: req.constraints || [],
          title: req.title,
        })
      }
    }

    // Build tripContext for planner technical filtering (B01)
    const plannerTripContext: TripContext = {
      temp_min_c: (latestRevision.resultSnapshot as any)?.climate?.temp_min_c ?? 15,
      temp_max_c: (latestRevision.resultSnapshot as any)?.climate?.temp_max_c ?? 25,
      temp_min_night_c: (latestRevision.resultSnapshot as any)?.climate?.temp_min_night_c ?? 15,
      rain_prob_pct: (latestRevision.resultSnapshot as any)?.climate?.rain_prob_pct ?? 0,
      difficulty: trip.difficulty,
      days: trip.days,
      terrain: trip.terrain || [],
    }

    // Solve combinatorial planner options
    const optionMinFee = solveDeterministicPlannerOption(
      {
        ownedAssignments,
        uncoveredNeeds,
        candidatesPerCategory,
        budgetLimit: dto.budgetLimit,
        tripContext: plannerTripContext,
      },
      'MIN_RENTAL_FEE',
    )

    const optionMinWeight = solveDeterministicPlannerOption(
      {
        ownedAssignments,
        uncoveredNeeds,
        candidatesPerCategory,
        budgetLimit: dto.budgetLimit,
        tripContext: plannerTripContext,
      },
      'MIN_KNOWN_TOTAL_WEIGHT',
    )

    const mapToPrismaObjective = (obj?: string): GearOptionObjective => {
      if (obj === 'MIN_KNOWN_TOTAL_WEIGHT' || obj === 'LIGHTWEIGHT') return 'LIGHTWEIGHT'
      if (obj === 'MIN_RENTAL_FEE' || obj === 'ECONOMICAL') return 'ECONOMICAL'
      return 'BALANCED'
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 mins TTL preview
    const optionSet = await this.prisma.gearPlanOptionSet.create({
      data: {
        planRevisionId: latestRevision.id,
        objective: mapToPrismaObjective(dto.objective),
        searchScope: {
          searchStatus:
            dto.objective === 'MIN_KNOWN_TOTAL_WEIGHT'
              ? optionMinWeight.summary.searchStatus
              : optionMinFee.summary.searchStatus,
          isComplete:
            dto.objective === 'MIN_KNOWN_TOTAL_WEIGHT'
              ? optionMinWeight.summary.isComplete
              : optionMinFee.summary.isComplete,
          chargedDays,
          candidateCategoriesEvaluated: candidatesPerCategory.size,
        },
        optionsJson: [optionMinFee, optionMinWeight] as any,
        expiresAt,
      },
    })

    const chosenOptionId = dto.objective === 'MIN_KNOWN_TOTAL_WEIGHT' ? optionMinWeight.id : optionMinFee.id

    return {
      setId: optionSet.id,
      planRevisionId: latestRevision.id,
      revision: latestRevision.revision,
      objective: optionSet.objective,
      expiresAt: optionSet.expiresAt,
      options: [optionMinFee, optionMinWeight],
      optionRef: {
        setId: optionSet.id,
        optionId: chosenOptionId,
      },
    }
  }

  /**
   * Phase 12: Gemini Advisor on Approved Facts & Options
   */
  async generatePlanAdvice(
    planId: string,
    userId: string,
    dto: GeneratePlanAdviceDto,
  ): Promise<Record<string, unknown>> {
    const plan = await this.gearPlanRepo.findByIdAndUser(planId, userId)
    if (!plan) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND, {
        message: 'Kế hoạch trang bị không tồn tại hoặc không thuộc sở hữu của bạn',
      })
    }

    if (plan.tripId) {
      if (this.prisma.trip) {
        const trip = await this.prisma.trip.findUnique({
          where: { id: plan.tripId },
          select: { id: true, status: true, endAt: true },
        })
        if (
          trip &&
          (trip.status === 'COMPLETED' || trip.status === 'CANCELLED' || (trip.endAt && trip.endAt < new Date()))
        ) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, {
            message: 'Chuyến đi đã kết thúc hoặc không còn khả dụng để tư vấn trang bị',
          })
        }
      }
      await this.tripContextPort.getTripContext(plan.tripId, userId)
    }

    const revision = await this.planRevisionRepo.findByPlanAndRevision(planId, dto.expectedRevision)
    if (!revision) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, {
        message: 'Không tìm thấy phiên bản kế hoạch tương ứng',
      })
    }

    // Check if plan has changed after this evaluation revision
    const inputSnapshotInputRev = (revision.inputSnapshot as any)?.inputRevision
    if (
      plan.evaluatedRevision !== revision.revision ||
      (inputSnapshotInputRev !== undefined && plan.inputRevision !== inputSnapshotInputRev)
    ) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_STALE, {
        message: 'Kế hoạch đã thay đổi sau lần đánh giá cuối, vui lòng đánh giá lại trước khi nhận tư vấn',
      })
    }

    const optionSet = await this.prisma.gearPlanOptionSet.findUnique({
      where: { id: dto.optionRef.setId },
    })
    if (!optionSet || optionSet.planRevisionId !== revision.id) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_OPTION_SET_NOT_FOUND, {
        message: 'Không tìm thấy tập phương án trang bị tương ứng với phiên bản kế hoạch này',
      })
    }

    if (optionSet.expiresAt < new Date()) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_OPTION_SET_EXPIRED, {
        message: 'Tập phương án trang bị đã hết hạn xem trước. Vui lòng tạo lại phương án mới.',
      })
    }

    const options = (optionSet.optionsJson as any[]) || []
    const selectedOption = options.find((o: any) => o.id === dto.optionRef.optionId)
    if (!selectedOption) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_OPTION_NOT_FOUND, {
        message: 'Không tìm thấy phương án được chọn trong tập phương án',
      })
    }

    const tripContext =
      (revision.resultSnapshot as any)?.tripContext ??
      (revision.inputSnapshot as any)?.canonicalContext ??
      (revision.inputSnapshot as any)?.tripContext ??
      {}
    const climate = (revision.resultSnapshot as any)?.climate ?? (revision.inputSnapshot as any)?.confirmedClimate ?? {}

    const days = tripContext.days ?? 1
    const diff = tripContext.difficulty ?? 1

    const approvedFactSet = new Set<string>()
    approvedFactSet.add(`trip.days:${days}`)
    approvedFactSet.add(`trip.difficulty:${diff}`)
    if (climate.temp_min_c !== undefined) approvedFactSet.add(`climate.temp_min:${climate.temp_min_c}`)
    if (climate.temp_max_c !== undefined) approvedFactSet.add(`climate.temp_max:${climate.temp_max_c}`)
    if (climate.rain_prob_pct !== undefined) approvedFactSet.add(`climate.rain_prob:${climate.rain_prob_pct}`)
    approvedFactSet.add(`pricing.total_fee:${selectedOption.summary?.totalRentalFee ?? 0}`)
    approvedFactSet.add(`pricing.total_deposit:${selectedOption.summary?.totalDeposit ?? 0}`)

    const checklist: any[] = (revision.resultSnapshot as any)?.checklist || []
    for (const req of checklist) {
      if (req.status) approvedFactSet.add(`requirement.${req.requirementId}:${req.status}`)
      approvedFactSet.add(`requirement.${req.requirementId}`)
    }

    const factRefs: string[] = Array.from(approvedFactSet)

    const actionRefs: string[] = [
      ...(selectedOption.ownedAssignments || []).map((a: any) => `PREPARE:${a.itemId}:${a.itemName}`),
      ...(selectedOption.rentalLines || []).map((l: any) => `RENT:${l.productId}:${l.productName}:${l.quantity}`),
      ...(selectedOption.summary?.missingRequirements || []).map((r: string) => `MISSING:${r}`),
    ]

    const candidateRefs: string[] = (selectedOption.rentalLines || []).map(
      (l: any) => `${l.productId}:${l.productName}`,
    )

    let adviceResult: any
    try {
      if (!this.gearAiPort || !this.gearAiPort.generateAdvice) throw new Error('GEAR_AI_UNAVAILABLE')
      adviceResult = await this.gearAiPort.generateAdvice({
        planId,
        revision: revision.revision,
        tripContext,
        requirements: (revision.resultSnapshot as any)?.checklist || [],
        coverage: (revision.resultSnapshot as any)?.summary || {},
        options: [selectedOption],
      })
    } catch {
      adviceResult = {
        source: 'RULE_FALLBACK' as GearAdviceSource,
        narrativeVi: this.renderRuleFallbackNarrative({
          tripContext,
          selectedOption,
        }),
        factRefs,
        actionRefs,
        candidateRefs,
      }
    }

    const SERVER_DISCLAIMER =
      'Tư vấn dựa trên bộ quy chuẩn an toàn TrekGo. Vui lòng kiểm tra kỹ độ bền và thông số trang bị trước khi khởi hành.'

    let finalSource: GearAdviceSource = 'RULE_FALLBACK'
    let finalNarrative = ''

    if (adviceResult && adviceResult.source === 'AI') {
      const modelFactRefs: string[] = adviceResult.factRefs || []
      const modelCandRefs: string[] = adviceResult.candidateRefs || []

      const allowedCandidateIds = new Set<string>((selectedOption.rentalLines || []).map((l: any) => l.productId))
      const allowedCandidateNames = (selectedOption.rentalLines || []).map((l: any) => l.productName || '')

      const hasMissing = (selectedOption.summary?.missingRequirements || []).length > 0
      const totalRentalFee = selectedOption.summary?.totalRentalFee ?? 0

      const groundingCheck = validateNarrativeViGrounding({
        narrativeVi: adviceResult.narrativeVi || '',
        tripDays: days,
        tripDifficulty: diff,
        climate: {
          temp_min_c: climate.temp_min_c,
          temp_max_c: climate.temp_max_c,
          rain_prob_pct: climate.rain_prob_pct,
        },
        totalRentalFee,
        allowedCandidateNames,
        allowedCandidateIds,
        allowedFactSet: approvedFactSet,
        modelFactRefs,
        modelCandidateRefs: modelCandRefs,
        hasMissingRequired: hasMissing,
      })

      if (!groundingCheck.isValid) {
        this.logger.warn(
          `AI advice failed verification against approved facts (${groundingCheck.reason}), refusing narrative and falling back to RULE_FALLBACK`,
        )
        finalSource = 'RULE_FALLBACK'
        finalNarrative = this.renderRuleFallbackNarrative({ tripContext, selectedOption })
      } else {
        finalSource = 'AI'
        finalNarrative = adviceResult.narrativeVi
      }
    } else {
      finalSource = 'RULE_FALLBACK'
      finalNarrative = this.renderRuleFallbackNarrative({ tripContext, selectedOption })
    }

    // F03: 1. Re-verify active trip membership / eligibility after network wait
    if (plan.tripId) {
      await this.tripContextPort.getTripContext(plan.tripId, userId)
    }

    // F03: 2. Atomic conditional publish in short transaction coordinating with mutation paths
    const adviceRun = await this.prisma.$transaction(async (tx) => {
      const lockRes = await tx.gearPlan.updateMany({
        where: {
          id: planId,
          userId,
          inputRevision: plan.inputRevision,
          evaluatedRevision: plan.evaluatedRevision,
        },
        data: {
          updatedAt: new Date(),
        },
      })

      if (lockRes.count === 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_STALE, {
          message: 'Kế hoạch đã thay đổi trong quá trình tạo tư vấn, không thể xuất bản kết quả cũ',
        })
      }

      return tx.gearAdviceRun.create({
        data: {
          planRevisionId: revision.id,
          source: finalSource,
          contextHash: revision.contentHash,
          narrativeVi: finalNarrative,
          factRefs: factRefs as any,
          actionRefs: actionRefs as any,
          candidateRefs: candidateRefs as any,
          disclaimerVi: SERVER_DISCLAIMER,
          latencyMs: adviceResult.metadata?.latencyMs ?? null,
          tokenUsage: adviceResult.metadata?.tokenUsage ? adviceResult.metadata.tokenUsage : undefined,
        },
      })
    })

    return {
      id: adviceRun.id,
      planRevisionId: revision.id,
      revision: revision.revision,
      source: adviceRun.source,
      narrativeVi: adviceRun.narrativeVi,
      factRefs,
      actionRefs,
      candidateRefs,
      disclaimerVi: adviceRun.disclaimerVi,
      contextHash: adviceRun.contextHash,
      createdAt: adviceRun.createdAt,
    }
  }

  /**
   * Phase 13: Quote Intent Handoff to Rental
   */
  async createQuoteIntent(planId: string, userId: string, dto: CreateQuoteIntentDto): Promise<Record<string, unknown>> {
    const plan = await this.gearPlanRepo.findByIdAndUser(planId, userId)
    if (!plan) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND, {
        message: 'Kế hoạch trang bị không tồn tại',
      })
    }

    if (plan.tripId) {
      if (this.prisma.trip) {
        const trip = await this.prisma.trip.findUnique({
          where: { id: plan.tripId },
          select: { id: true, status: true, endAt: true },
        })
        if (
          trip &&
          (trip.status === 'COMPLETED' || trip.status === 'CANCELLED' || (trip.endAt && trip.endAt < new Date()))
        ) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, {
            message: 'Chuyến đi đã kết thúc hoặc không còn khả dụng để tư vấn trang bị',
          })
        }
      }
      await this.tripContextPort.getTripContext(plan.tripId, userId)
    }

    const revision = await this.planRevisionRepo.findByPlanAndRevision(planId, dto.expectedRevision)
    if (!revision) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, {
        message: 'Không tìm thấy phiên bản kế hoạch tương ứng',
      })
    }

    // Check if plan has changed after this evaluation revision
    const inputSnapshotInputRev = (revision.inputSnapshot as any)?.inputRevision
    if (
      plan.evaluatedRevision !== revision.revision ||
      (inputSnapshotInputRev !== undefined && plan.inputRevision !== inputSnapshotInputRev)
    ) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_STALE, {
        message: 'Kế hoạch trang bị đã thay đổi sau lần đánh giá cuối, vui lòng đánh giá lại trước khi tạo báo giá',
      })
    }

    const optionSet = await this.prisma.gearPlanOptionSet.findUnique({
      where: { id: dto.optionRef.setId },
    })
    if (!optionSet || optionSet.planRevisionId !== revision.id) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_OPTION_SET_NOT_FOUND, {
        message: 'Không tìm thấy tập phương án trang bị',
      })
    }

    if (optionSet.expiresAt < new Date()) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_OPTION_SET_EXPIRED, {
        message: 'Tập phương án trang bị đã hết hạn. Vui lòng tạo lại phương án mới.',
      })
    }

    const options = (optionSet.optionsJson as any[]) || []
    const selectedOption = options.find((o: any) => o.id === dto.optionRef.optionId)
    if (!selectedOption) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_OPTION_NOT_FOUND, {
        message: 'Không tìm thấy phương án được chọn',
      })
    }

    const lines = (selectedOption.rentalLines || []).map((l: any) => ({
      productId: l.productId,
      productName: l.productName,
      category: l.category,
      quantity: l.quantity,
      dailyPrice: l.dailyPrice,
      rentalFee: l.rentalFee,
      deposit: l.deposit,
    }))

    return {
      planId,
      planRevision: revision.revision,
      tripId: plan.tripId,
      optionRef: dto.optionRef,
      lines,
      summary: {
        totalRentalFee: selectedOption.summary?.totalRentalFee ?? 0,
        totalDeposit: selectedOption.summary?.totalDeposit ?? 0,
        totalEstimatedUpfront: selectedOption.summary?.totalEstimatedUpfront ?? 0,
        currency: 'VND',
      },
      validUntil: optionSet.expiresAt,
      prefillRentalQuote: {
        tripId: plan.tripId,
        items: lines.map((l: any) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
      },
    }
  }

  /**
   * Phase 13: Quote Link idempotency
   */
  async linkQuote(planId: string, userId: string, dto: LinkQuoteDto): Promise<Record<string, unknown>> {
    const plan = await this.gearPlanRepo.findByIdAndUser(planId, userId)
    if (!plan) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND, {
        message: 'Kế hoạch trang bị không tồn tại',
      })
    }

    if (plan.tripId) {
      if (this.prisma.trip) {
        const trip = await this.prisma.trip.findUnique({
          where: { id: plan.tripId },
          select: { id: true, status: true, endAt: true },
        })
        if (
          trip &&
          (trip.status === 'COMPLETED' || trip.status === 'CANCELLED' || (trip.endAt && trip.endAt < new Date()))
        ) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, {
            message: 'Chuyến đi đã kết thúc hoặc không còn khả dụng để tư vấn trang bị',
          })
        }
      }
      await this.tripContextPort.getTripContext(plan.tripId, userId)
    }

    const revision = await this.planRevisionRepo.findByPlanAndRevision(planId, dto.expectedRevision)
    if (!revision) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, {
        message: 'Không tìm thấy phiên bản kế hoạch tương ứng',
      })
    }

    // Check if plan has changed after this evaluation revision
    const inputSnapshotInputRev = (revision.inputSnapshot as any)?.inputRevision
    if (
      plan.evaluatedRevision !== revision.revision ||
      (inputSnapshotInputRev !== undefined && plan.inputRevision !== inputSnapshotInputRev)
    ) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_STALE, {
        message:
          'Kế hoạch trang bị đã thay đổi sau lần đánh giá cuối, vui lòng đánh giá lại trước khi liên kết báo giá',
      })
    }

    if (!this.quoteLinkRepo) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONFIGURATION_ERROR, {
        message: 'Cổng liên kết báo giá chưa được cấu hình',
      })
    }

    const linked = await this.quoteLinkRepo.linkQuote(revision.id, dto.quoteId, userId, dto.optionRef)

    return {
      linked: true,
      id: linked.id,
      planRevisionId: revision.id,
      planRevision: revision.revision,
      quoteId: dto.quoteId,
      verifiedAt: linked.verifiedAt,
    }
  }

  private renderRuleFallbackNarrative(params: { tripContext: any; selectedOption: any }): string {
    const { tripContext, selectedOption } = params
    const days = tripContext?.days ?? 1
    const diff = tripContext?.difficulty ?? 1
    const destination = tripContext?.destination || 'cung đường'

    const lines: string[] = []
    lines.push(
      `Hệ thống cố vấn trang bị VinaTrekGO đã phân tích kế hoạch cho hành trình khám phá ${destination} (${days} ngày, cấp độ khó ${diff}/5).`,
    )

    if (selectedOption.ownedAssignments && selectedOption.ownedAssignments.length > 0) {
      const ownedNames = selectedOption.ownedAssignments.map((a: any) => a.itemName).join(', ')
      lines.push(
        `Trang bị cá nhân phù hợp: Bạn đã có sẵn ${selectedOption.ownedAssignments.length} món đồ đáp ứng tiêu chuẩn an toàn (${ownedNames}).`,
      )
    }

    if (selectedOption.rentalLines && selectedOption.rentalLines.length > 0) {
      const rentDetails = selectedOption.rentalLines.map((l: any) => `${l.productName} (SL: ${l.quantity})`).join(', ')
      lines.push(
        `Trang bị đề xuất thuê: ${rentDetails}. Tổng chi phí thuê ước tính là ${selectedOption.summary.totalRentalFee.toLocaleString(
          'vi-VN',
        )} VND (tiền cọc: ${selectedOption.summary.totalDeposit.toLocaleString('vi-VN')} VND).`,
      )
    }

    if (selectedOption.summary.missingRequirements && selectedOption.summary.missingRequirements.length > 0) {
      lines.push(
        `Lưu ý: Còn ${selectedOption.summary.missingRequirements.length} yêu cầu chưa có trong danh mục thuê (ví dụ: quần trekking dài). Vui lòng chuẩn bị trước khi xuất phát.`,
      )
    }

    lines.push('Hãy kiểm tra kỹ toàn bộ trang bị, đảm bảo độ bám và khả năng chống thấm nước trước ngày khởi hành.')

    return lines.join('\n\n')
  }
}
