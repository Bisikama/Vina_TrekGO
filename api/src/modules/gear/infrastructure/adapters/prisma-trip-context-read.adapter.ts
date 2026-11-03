import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError } from '../../../../shared/errors/app-error'
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes'
import { TripContextFactData, TripContextReadPort } from '../../application/ports/trip-context-read.port'

/** Tên gọi khác → khoá trong bảng khí hậu ước tính (`CLIMATE_ESTIMATE_REGISTRY`). */
const CLIMATE_DESTINATION_ALIASES: Array<{ key: string; aliases: string[] }> = [
  { key: 'fansipan', aliases: ['fansipan', 'phan xi păng', 'phan xi pang', 'phanxipang'] },
  { key: 'ta nang', aliases: ['ta nang', 'tà năng'] },
  { key: 'bidoup', aliases: ['bidoup'] },
]

/**
 * Tên điểm đến dùng để tra khí hậu: khớp tên gọi khác thì trả khoá chuẩn; không khớp thì trả tên đã chuẩn hoá;
 * không có tên thì `undefined` (trước đây rơi về 'bidoup', gợi ý sai khí hậu cho chuyến không liên quan).
 */
export function resolveClimateDestination(rawName: string | null | undefined): string | undefined {
  const norm = (rawName ?? '').trim().toLowerCase()
  if (!norm) return undefined
  const match = CLIMATE_DESTINATION_ALIASES.find((d) => d.aliases.some((a) => norm.includes(a)))
  return match ? match.key : norm
}

/** Toạ độ đại diện: tâm điểm đến, nếu thiếu thì checkpoint có sequence nhỏ nhất. Không đoán toạ độ mặc định. */
export function resolveTripCoordinates(trip: any): { lat: number; lng: number } | null {
  const toNum = (v: unknown) => (v === null || v === undefined ? NaN : Number(v))
  const centerLat = toNum(trip?.destination?.centerLat)
  const centerLng = toNum(trip?.destination?.centerLng)
  if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) return { lat: centerLat, lng: centerLng }

  const first = trip?.tripCheckpointsViaTripId?.[0]
  const lat = toNum(first?.latitude)
  const lng = toNum(first?.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return null
}

@Injectable()
export class PrismaTripContextReadAdapter implements TripContextReadPort {
  constructor(private readonly prisma: PrismaService) {}

  private extractFacts(
    trip: any,
    plan: any,
  ): { difficulty: number; terrain: string[]; days: number; destination?: string; contextVersion: string; sourceReferences: any } {
    // 1. Calculate canonical days
    const diffMs = trip.endAt.getTime() - trip.startAt.getTime()
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    if (days < 1) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_NEEDS_CONTEXT, {
        message: 'Khoảng thời gian của chuyến đi không hợp lệ (số ngày phải >= 1)',
      })
    }

    // 2. Read trail plan difficulty
    const rawDifficulty = plan?.snapshotDifficulty ?? plan?.systemTrail?.difficulty
    if (!rawDifficulty) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_NEEDS_CONTEXT, {
        message: 'Chuyến đi thiếu dữ kiện độ khó chính thức từ cung đường',
      })
    }

    // Map DifficultyLevel strictly to canonical int 1..5 based on official system policy
    let difficulty: number
    switch (rawDifficulty) {
      case 'EASY':
        difficulty = 1
        break
      case 'MEDIUM':
        difficulty = 3
        break
      case 'HARD':
        difficulty = 4
        break
      case 'EXTREME':
        difficulty = 5
        break
      default:
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_NEEDS_CONTEXT, {
          message: `Mức độ khó '${rawDifficulty}' không hợp lệ hoặc thiếu chính sách ánh xạ chính thức`,
        })
    }

    // 3. Read terrain facts strictly from official trail metadata or geojson properties
    let terrainList: string[] = []
    const geojson = (plan?.snapshotGeojson ?? plan?.systemTrail?.routeGeojson) as Record<string, unknown> | null
    if (geojson && typeof geojson === 'object') {
      const rawTerrain = (geojson as any).terrain ?? (geojson as any).properties?.terrain
      if (Array.isArray(rawTerrain)) {
        terrainList = rawTerrain
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t) => t.trim().toLowerCase())
      }
    }

    // Fallback only to official terrainTags defined on systemTrail (never text descriptions)
    if (terrainList.length === 0 && Array.isArray(plan?.systemTrail?.terrainTags)) {
      terrainList = plan.systemTrail.terrainTags
        .filter((t: any): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t: string) => t.trim().toLowerCase())
    }

    // If still no terrain facts found, throw GEAR_NEEDS_CONTEXT (no keyword guesswork on free text)
    if (terrainList.length === 0) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_NEEDS_CONTEXT, {
        message: 'Chuyến đi thiếu dữ kiện địa hình chính thức từ cung đường',
      })
    }

    const dedupedTerrain = Array.from(new Set(terrainList))
    const tripUpdatedTime = trip.updatedAt ? new Date(trip.updatedAt).getTime() : 0
    const planUpdatedTime = plan?.updatedAt ? new Date(plan.updatedAt).getTime() : 0
    const contextVersion = `ctx_${trip.id}_${tripUpdatedTime}_${plan?.id ?? 'none'}_${planUpdatedTime}`

    let destName = trip.destination?.name || trip.title || plan?.snapshotName || ''
    if ((trip).destinationName) destName = (trip).destinationName
    const destination = resolveClimateDestination(destName)

    const sourceReferences = {
      tripId: trip.id,
      trailId: plan?.systemTrail?.id,
      trailPlanId: plan?.id,
      version: 1,
    }

    return {
      difficulty,
      terrain: dedupedTerrain,
      days,
      destination,
      contextVersion,
      sourceReferences,
    }
  }

  async getTripContext(tripId: string, userId: string): Promise<TripContextFactData> {
    // 1. Query trip with active trail plan and system trail
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        tripActiveTrailPlanViaTripId: {
          include: {
            tripTrailPlan: {
              include: {
                systemTrail: true,
              },
            },
          },
        },
        tripTrailPlansViaTripId: {
          take: 1,
          orderBy: { sequence: 'asc' },
          include: {
            systemTrail: true,
          },
        },
        // Chỉ lấy toạ độ (để gợi ý dự báo thời tiết); tên điểm đến vẫn tra như trước.
        destination: { select: { centerLat: true, centerLng: true } },
        tripCheckpointsViaTripId: {
          take: 1,
          orderBy: { sequence: 'asc' },
          select: { latitude: true, longitude: true },
        },
      },
    })

    if (!trip) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_FOUND, {
        message: 'Không tìm thấy chuyến đi tương ứng',
      })
    }

    // 2. Reject ended or ineligible trips (CANCELLED, COMPLETED, INTERRUPTED, or past endAt)
    const isIneligibleStatus = ['CANCELLED', 'COMPLETED', 'INTERRUPTED'].includes(trip.status)
    const isPastEndAt = trip.endAt ? new Date(trip.endAt).getTime() < Date.now() : false
    if (isIneligibleStatus || isPastEndAt) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, {
        message: 'Chuyến đi đã kết thúc hoặc không đủ điều kiện đánh giá trang bị',
      })
    }

    // 3. Verify user membership in trip (creator, leader, or active member)
    const isCreatorOrLeader = trip.creatorId === userId || trip.leaderId === userId
    if (!isCreatorOrLeader) {
      const member = await this.prisma.tripMember.findFirst({
        where: {
          tripId,
          userId,
          status: 'ACTIVE',
        },
      })

      if (!member) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_FORBIDDEN, {
          message: 'Bạn không phải là thành viên hợp lệ của chuyến đi này',
        })
      }
    }

    const plan = trip.tripActiveTrailPlanViaTripId?.tripTrailPlan ?? trip.tripTrailPlansViaTripId?.[0]
    const facts = this.extractFacts(trip, plan)

    return {
      tripId: trip.id,
      status: trip.status,
      startAt: trip.startAt,
      endAt: trip.endAt,
      days: facts.days,
      difficulty: facts.difficulty,
      terrain: facts.terrain,
      destination: facts.destination,
      coordinates: resolveTripCoordinates(trip),
      contextVersion: facts.contextVersion,
      sourceReferences: facts.sourceReferences,
    }
  }

  async getHistoricalTripContext(tripId: string, userId: string, planId: string): Promise<TripContextFactData> {
    // 1. Verify plan exists, belongs to user, and belongs to this tripId (F06)
    const gearPlan = await this.prisma.gearPlan.findFirst({
      where: {
        id: planId,
        userId,
      },
    })

    if (!gearPlan || gearPlan.tripId !== tripId) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND, {
        message: 'Kế hoạch trang bị không thuộc về chuyến đi này hoặc không thuộc sở hữu của bạn',
      })
    }

    // 2. Query trip with active trail plan and system trail
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        tripActiveTrailPlanViaTripId: {
          include: {
            tripTrailPlan: {
              include: {
                systemTrail: true,
              },
            },
          },
        },
        tripTrailPlansViaTripId: {
          take: 1,
          orderBy: { sequence: 'asc' },
          include: {
            systemTrail: true,
          },
        },
      },
    })

    if (!trip) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_FOUND, {
        message: 'Không tìm thấy chuyến đi tương ứng với kế hoạch',
      })
    }

    // 3. For historical read, we do NOT reject CANCELLED/COMPLETED/INTERRUPTED trips.
    // Read history is authorized based on plan ownership.
    const plan = trip.tripActiveTrailPlanViaTripId?.tripTrailPlan ?? trip.tripTrailPlansViaTripId?.[0]
    const facts = this.extractFacts(trip, plan)

    return {
      tripId: trip.id,
      status: trip.status,
      startAt: trip.startAt,
      endAt: trip.endAt,
      days: facts.days,
      difficulty: facts.difficulty,
      terrain: facts.terrain,
      destination: facts.destination,
      contextVersion: facts.contextVersion,
      sourceReferences: facts.sourceReferences,
    }
  }
}
