import { buildTripRequirements, resolvePlanCoverage, TripContext } from '../src/modules/gear/domain'
import { buildGearGuidance } from '../src/modules/gear/domain/gear-guidance'
import { GearPlanService } from '../src/modules/gear/application/services/gear-plan.service'
import { updatePlanInputSchema } from '../src/modules/gear/application/dtos/gear-plan.dto'
import { buildTripEssentials } from '../src/modules/gear/domain/trip-essentials'
import { resolveTrailHighestPoint } from '../src/modules/gear/infrastructure/adapters/prisma-trip-context-read.adapter'
import {
  describeGearConstraint,
  describeGearConstraintFailure,
  humanizeConstraintRationale,
} from '../src/modules/gear/domain/gear-labels'

const trip: TripContext = {
  temp_min_c: 8,
  temp_max_c: 20,
  temp_min_night_c: 6,
  rain_prob_pct: 65,
  difficulty: 4,
  days: 3,
  terrain: ['rocky'],
}

const smallBackpack = {
  id: '00000000-0000-4000-8000-000000000001',
  category: 'BACKPACK' as const,
  condition: 'GOOD' as const,
  attributes: { capacity_l: 20, rain_cover: true, waterproof: false, weight_g: 900 },
}

describe('Gear plan clarity: self-provided requirements and readable guidance', () => {
  it('marks a missing requirement the user will provide as USER_DECLARED_PROVISION with nothing left to rent', () => {
    const result = resolvePlanCoverage([], buildTripRequirements(trip), trip, {
      selfProvidedRequirementIds: ['req_footwear'],
    })
    const footwear = result.requirements.find((r) => r.requirementId === 'req_footwear')!
    const jacket = result.requirements.find((r) => r.requirementId === 'req_jacket')!

    expect(footwear).toMatchObject({
      status: 'USER_DECLARED_PROVISION',
      recommendedAction: 'PROVIDE',
      remainingQuantity: 0,
    })
    expect(footwear.warnings).toEqual([])
    expect(jacket.status).toBe('MISSING')
    expect(result.summary.userDeclaredCount).toBe(1)
  })

  it('keeps COVERED_BY_OWNED when an owned item already satisfies a self-provided requirement', () => {
    const goodBackpack = { ...smallBackpack, attributes: { ...smallBackpack.attributes, capacity_l: 45 } }
    const result = resolvePlanCoverage([goodBackpack], buildTripRequirements(trip), trip, {
      selfProvidedRequirementIds: ['req_backpack'],
    })
    expect(result.requirements.find((r) => r.requirementId === 'req_backpack')?.status).toBe('COVERED_BY_OWNED')
  })

  it('writes constraint failures with Vietnamese labels and units instead of field keys', () => {
    const result = resolvePlanCoverage([smallBackpack], buildTripRequirements(trip), trip)
    const backpack = result.requirements.find((r) => r.requirementId === 'req_backpack')!

    expect(backpack.status).toBe('NEEDS_REPLACEMENT')
    expect(backpack.warnings).toContain('Dung tích 20 L – yêu cầu tối thiểu 35 L')
    expect(backpack.warnings.join(' ')).not.toMatch(/capacity_l/)
  })

  it('describes constraints and rationales for display', () => {
    expect(describeGearConstraint({ field: 'waterproof_mm', op: 'GTE', expected: 5000 })).toBe(
      'Chống nước tối thiểu 5000 mm',
    )
    expect(describeGearConstraint({ field: 'temp_rating_c', op: 'LTE', expected: 5 })).toBe('Chịu lạnh tới 5°C')
    expect(describeGearConstraint({ field: 'ankle_support', op: 'EQ', expected: true })).toBe('Hỗ trợ cổ chân: Có')
    expect(describeGearConstraintFailure({ field: 'temp_rating_c', op: 'LTE', expected: 5 }, 12)).toBe(
      'Chịu lạnh 12°C – yêu cầu chịu được 5°C trở xuống',
    )
    expect(
      humanizeConstraintRationale('R08: Cung đường khó (>=4) yêu cầu giày có cổ bảo vệ cổ chân (ankle_support)'),
    ).toBe('Cung đường khó (>=4) yêu cầu giày có cổ bảo vệ cổ chân')
    expect(humanizeConstraintRationale('R09: Địa hình bùn lầy/đá dốc yêu cầu độ bám tối thiểu (grip_level >= 3)')).toBe(
      'Địa hình bùn lầy/đá dốc yêu cầu độ bám tối thiểu',
    )
  })

  it('lists selected items outside the core categories and adds readable criteria to requirements', () => {
    const tentId = '00000000-0000-4000-8000-000000000009'
    const coverage = resolvePlanCoverage([], buildTripRequirements(trip), trip)
    const guidance = buildGearGuidance(
      { coreCheck: { items: [] }, coverage },
      { items: [{ id: tentId, name: 'Lều 2 người', version: 1, category: 'TENT', attributes: {} }] },
    ) as any

    expect(guidance.items).toEqual([
      expect.objectContaining({
        itemId: tentId,
        nameAtEvaluation: 'Lều 2 người',
        displayStatus: 'NOT_ASSESSED',
        verdict: null,
      }),
    ])
    const jacket = guidance.requirements.find((r: any) => r.requirementId === 'req_jacket')
    expect(jacket.criteria).toContainEqual(
      expect.objectContaining({ field: 'waterproof_mm', text: 'Chống nước tối thiểu 5000 mm' }),
    )
    expect(jacket.criteria.every((c: any) => !/^R\d+/.test(c.reason ?? ''))).toBe(true)
  })
})

describe('Gear plan: saving self-provided requirements', () => {
  const planId = '00000000-0000-4000-8000-0000000000aa'
  const userId = '00000000-0000-4000-8000-0000000000bb'
  const tripId = '00000000-0000-4000-8000-0000000000cc'

  function setup() {
    const plan = {
      id: planId,
      userId,
      tripId,
      selectedItemIds: [],
      preferences: { maxBudgetVnd: 500000, selfProvidedRequirementIds: ['req_jacket'] },
      canonicalContext: {},
      inputRevision: 2,
      evaluatedRevision: null,
    }
    const gearPlanRepo = {
      findByIdAndUser: jest.fn(async () => plan),
      updateSemanticCAS: jest.fn(async (_id: string, _user: string, _rev: number, update: any) => ({ ...plan, ...update, inputRevision: 3 })),
    }
    const tripContextPort = { getTripContext: jest.fn(async () => ({ contextVersion: null })) }
    const service = new GearPlanService(gearPlanRepo as any, {} as any, {} as any, tripContextPort as any, {} as any)
    return { service, gearPlanRepo }
  }

  it('replaces only the self-provided list and keeps other preferences', async () => {
    const { service, gearPlanRepo } = setup()
    const input = updatePlanInputSchema.parse({ expectedInputRevision: 2, selfProvidedRequirementIds: ['req_footwear', 'req_backpack'] })

    await service.updatePlanInput(planId, userId, input)

    expect(gearPlanRepo.updateSemanticCAS).toHaveBeenCalledWith(planId, userId, 2, expect.objectContaining({
      preferences: { maxBudgetVnd: 500000, selfProvidedRequirementIds: ['req_backpack', 'req_footwear'] },
    }))
  })

  it('rejects malformed or duplicated requirement ids', () => {
    expect(updatePlanInputSchema.safeParse({ expectedInputRevision: 1, selfProvidedRequirementIds: ['jacket'] }).success).toBe(false)
    expect(updatePlanInputSchema.safeParse({ expectedInputRevision: 1, selfProvidedRequirementIds: ['req_a', 'req_a'] }).success).toBe(false)
  })
})

describe('Gear plan: requirements depend on the trip', () => {
  const ids = (t: TripContext) => buildTripRequirements(t).map((r) => `${r.id}:${r.priority}`)

  it('makes the sleeping bag optional on overnight trips unless the night is very cold', () => {
    // Đêm 6°C: chưa biết chỗ ngủ (homestay thường có chăn) → không bắt buộc.
    expect(ids(trip)).toEqual(expect.arrayContaining([
      'req_sleeping_bag:OPTIONAL', 'req_pants:OPTIONAL', 'req_rain_gear:OPTIONAL', 'req_trekking_pole:OPTIONAL',
    ]))
    // Đêm 5°C trở xuống → bắt buộc, tiêu chí chịu được đêm lạnh nhất.
    const coldTrip: TripContext = { ...trip, temp_min_night_c: 2 }
    expect(ids(coldTrip)).toContain('req_sleeping_bag:REQUIRED')
    expect(buildTripRequirements(coldTrip).find((r) => r.id === 'req_sleeping_bag')?.constraints).toEqual([
      expect.objectContaining({ field: 'temp_rating_c', op: 'LTE', expected: 2 }),
    ])
    expect(ids({ ...trip, days: 1, temp_min_night_c: 2 })).not.toContain('req_sleeping_bag:REQUIRED')
  })

  it('shows only the stricter jacket warmth rule when it is cold', () => {
    const jacketWarmth = (t: TripContext) =>
      buildTripRequirements(t)
        .find((r) => r.id === 'req_jacket')!
        .constraints.filter((c) => c.field === 'temp_rating_c')
        .map((c) => c.expected)
    expect(jacketWarmth({ ...trip, temp_min_c: 8 })).toEqual([8])
    expect(jacketWarmth({ ...trip, temp_min_c: 13 })).toEqual([18])
    expect(jacketWarmth({ ...trip, temp_min_c: 20 })).toEqual([])
  })

  it('keeps an easy dry day hike to the three baseline items', () => {
    const dayHike: TripContext = { ...trip, days: 1, rain_prob_pct: 10, temp_min_c: 20, difficulty: 2 }
    expect(ids(dayHike)).toEqual(['req_jacket:REQUIRED', 'req_footwear:REQUIRED', 'req_backpack:REQUIRED'])
  })
})

describe('Gear plan: realistic trip context', () => {
  const planId = '00000000-0000-4000-8000-0000000000aa'
  const userId = '00000000-0000-4000-8000-0000000000bb'
  const tripId = '00000000-0000-4000-8000-0000000000cc'
  const essentialIds = (t: TripContext) => buildTripEssentials(t).map((e) => `${e.id}:${e.priority}`)

  it('lists essentials without specs, depending on the trip', () => {
    const dayHike: TripContext = { ...trip, days: 1, difficulty: 2, rain_prob_pct: 10, temp_min_night_c: 18, temp_max_c: 30, terrain: ['forest'] }
    expect(essentialIds(dayHike)).toEqual(expect.arrayContaining(['ess_water:REQUIRED', 'ess_first_aid:REQUIRED', 'ess_headlamp:RECOMMENDED', 'ess_sun:RECOMMENDED']))
    expect(essentialIds(dayHike).join()).not.toMatch(/ess_warm_layer|ess_spare_clothes|ess_dry_bag/)

    const coldWetOvernight: TripContext = { ...trip, temp_min_night_c: 2, rain_prob_pct: 70, terrain: ['forest', 'muddy'] }
    expect(essentialIds(coldWetOvernight)).toEqual(expect.arrayContaining([
      'ess_headlamp:REQUIRED', 'ess_spare_clothes:REQUIRED', 'ess_warm_layer:REQUIRED', 'ess_hat_gloves:REQUIRED',
      'ess_dry_bag:REQUIRED', 'ess_leech_socks:RECOMMENDED',
    ]))
    expect(buildTripEssentials(coldWetOvernight).every((e) => e.id.startsWith('ess_') && e.reason.length > 0)).toBe(true)
  })

  it('finds the highest point of a 3D trail and ignores 2D geojson', () => {
    const line = { type: 'LineString', coordinates: [[103.8, 22.3, 1600], [103.77, 22.30, 3143.4], [103.76, 22.31, 2800]] }
    expect(resolveTrailHighestPoint(line)).toEqual({ lat: 22.3, lng: 103.77, elevationM: 3143 })
    expect(resolveTrailHighestPoint({ type: 'FeatureCollection', features: [{ geometry: line }] })?.elevationM).toBe(3143)
    expect(resolveTrailHighestPoint({ type: 'LineString', coordinates: [[103.8, 22.3], [103.7, 22.4]] })).toBeNull()
    expect(resolveTrailHighestPoint(null)).toBeNull()
  })

  it('asks for the forecast at the summit and says so in the suggestion', async () => {
    const forecastPort = {
      getForecastClimate: jest.fn(async () => ({
        temp_min_c: 1, temp_max_c: 9, temp_min_night_c: -2, rain_prob_pct: 40, source: 'FORECAST' as const,
        provider: 'open-meteo', forecastFrom: '2026-12-01', forecastTo: '2026-12-03', fetchedAt: '2026-11-28T00:00:00Z',
      })),
    }
    const tripContextPort = {
      getTripContext: jest.fn(async () => ({
        tripId, status: 'OPEN', startAt: new Date('2026-12-01'), endAt: new Date('2026-12-03'), days: 3, difficulty: 4,
        terrain: ['rocky'], destination: 'somewhere', coordinates: { lat: 22.33, lng: 103.84 },
        highestPoint: { lat: 22.303, lng: 103.775, elevationM: 3143 },
      })),
    }
    const service = new GearPlanService(
      {} as any, {} as any, {} as any, tripContextPort as any, {} as any,
      undefined, undefined, undefined, undefined, forecastPort,
    )

    const prefill: any = await service.getTripPrefill(tripId, userId)

    expect(forecastPort.getForecastClimate).toHaveBeenCalledWith(expect.objectContaining({ lat: 22.303, lng: 103.775 }))
    expect(prefill.highestElevationM).toBe(3143)
    expect(prefill.forecastClimate).toMatchObject({ atElevationM: 3143 })
    expect(prefill.forecastClimate.noteVi).toContain('điểm cao nhất')
  })

  it('accepts packing progress for essentials of the evaluated revision', async () => {
    const plan = { id: planId, userId, tripId, selectedItemIds: [], canonicalContext: {}, inputRevision: 2, evaluatedRevision: 2, progressVersion: 1 }
    const gearPlanRepo = {
      findByIdAndUser: jest.fn(async () => plan),
      updateProgressCAS: jest.fn(async () => ({ ...plan, progressVersion: 2 })),
    }
    const planRevisionRepo = {
      findByPlanAndRevision: jest.fn(async () => ({
        resultSnapshot: { checklist: [{ requirementId: 'req_jacket' }], essentials: [{ id: 'ess_headlamp' }] },
      })),
    }
    const tripContextPort = { getTripContext: jest.fn(async () => ({ contextVersion: null })) }
    const service = new GearPlanService(gearPlanRepo as any, planRevisionRepo as any, {} as any, tripContextPort as any, {} as any)

    await service.updateChecklistProgress(planId, userId, {
      expectedProgressVersion: 1,
      items: [{ requirementId: 'req_jacket', isChecked: true }, { requirementId: 'ess_headlamp', isChecked: true }],
    })
    expect(gearPlanRepo.updateProgressCAS).toHaveBeenCalled()

    await expect(
      service.updateChecklistProgress(planId, userId, { expectedProgressVersion: 1, items: [{ requirementId: 'ess_unknown', isChecked: true }] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
