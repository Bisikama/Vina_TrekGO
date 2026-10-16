import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { IPersonalTrailRepository } from '../../application/ports/personal-trail.port'
import { MyTrailsQuery, RawSamplesBatchInput } from '../../presentation/dtos/personal-trail.dto'
import { PersonalTrailModel, TrailRecordingModel, TrailRecordingPointModel } from '../../application/ports/personal-trail.port'
import { DifficultyLevel, PersonalTrailVisibility, RecordStatus, TrailSubmissionStatus } from '@prisma/client'
import { AppError } from '../../../../shared/errors/app-error'
import { PersonalTrailErrorCode } from '../../../../shared/errors/codes/personal-trail.error-codes'

function mapDifficulty(input?: string | null): DifficultyLevel | null {
  if (!input) return null
  const upper = input.toUpperCase()
  if (upper === 'EASY' || upper.includes('DỄ')) return DifficultyLevel.EASY
  if (upper === 'MEDIUM' || upper === 'MODERATE' || upper.includes('TRUNG BÌNH')) return DifficultyLevel.MEDIUM
  if (upper === 'HARD' || upper.includes('KHÓ')) return DifficultyLevel.HARD
  if (upper === 'EXTREME' || upper === 'VERY_HARD' || upper.includes('RẤT KHÓ')) return DifficultyLevel.EXTREME
  return DifficultyLevel.MEDIUM
}

function mapVisibility(input?: string | null): PersonalTrailVisibility {
  if (!input) return PersonalTrailVisibility.PRIVATE
  const upper = input.toUpperCase()
  if (upper === 'SHARED' || upper === 'PUBLIC') return PersonalTrailVisibility.SHARED
  return PersonalTrailVisibility.PRIVATE
}

@Injectable()
export class PrismaPersonalTrailAdapter implements IPersonalTrailRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRecordingById(id: string): Promise<TrailRecordingModel | null> {
    const record = await this.prisma.trailRecording.findUnique({
      where: { id },
    })
    return record as TrailRecordingModel | null
  }

  async findRecordingByClientRecordingId(
    clientRecordingId: string,
    userId: string,
  ): Promise<TrailRecordingModel | null> {
    const record = await this.prisma.trailRecording.findFirst({
      where: { clientRecordingId, userId },
    })
    return record as TrailRecordingModel | null
  }

  async createRecording(data: {
    clientRecordingId: string
    userId: string
    startedAt: Date
    status: string
  }): Promise<TrailRecordingModel> {
    const created = await this.prisma.trailRecording.create({
      data: {
        clientRecordingId: data.clientRecordingId,
        userId: data.userId,
        startedAt: data.startedAt,
        status: data.status,
      },
    })
    return created as TrailRecordingModel
  }

  async saveRawSamplesBatch(
    recordingId: string,
    samples: RawSamplesBatchInput['samples'],
  ): Promise<{ receivedCount: number; insertedCount: number; duplicatedCount: number }> {
    const receivedCount = samples.length
    if (receivedCount === 0) {
      return { receivedCount: 0, insertedCount: 0, duplicatedCount: 0 }
    }

    const data = samples.map((s) => ({
      recordingId,
      clientSampleId: s.clientSampleId,
      latitude: s.latitude,
      longitude: s.longitude,
      accuracyM: s.accuracyM !== undefined && s.accuracyM !== null ? s.accuracyM : null,
      altitudeM: s.altitudeM !== undefined && s.altitudeM !== null ? s.altitudeM : null,
      altitudeAccuracyM:
        s.altitudeAccuracyM !== undefined && s.altitudeAccuracyM !== null ? s.altitudeAccuracyM : null,
      speedMps: s.speedMps !== undefined && s.speedMps !== null ? s.speedMps : null,
      headingDeg: s.headingDeg !== undefined && s.headingDeg !== null ? s.headingDeg : null,
      segmentId: s.segmentId ?? 0,
      accepted: s.accepted !== undefined && s.accepted !== null ? s.accepted : true,
      rejectReason: s.rejectReason ?? null,
      recordedAt: new Date(s.recordedAt),
    }))

    const result = await this.prisma.trailRecordingPoint.createMany({
      data,
      skipDuplicates: true,
    })

    const insertedCount = result.count
    const duplicatedCount = Math.max(0, receivedCount - insertedCount)

    return {
      receivedCount,
      insertedCount,
      duplicatedCount,
    }
  }

  async getPointsByRecordingId(
    recordingId: string,
    acceptedOnly = true,
  ): Promise<TrailRecordingPointModel[]> {
    const where: any = { recordingId }
    if (acceptedOnly) {
      where.OR = [{ accepted: true }, { accepted: null }]
    }

    const points = await this.prisma.trailRecordingPoint.findMany({
      where,
      orderBy: [{ segmentId: 'asc' }, { recordedAt: 'asc' }],
    })

    return points as unknown as TrailRecordingPointModel[]
  }

  async updateRecordingStatus(recordingId: string, status: string): Promise<TrailRecordingModel> {
    const updated = await this.prisma.trailRecording.update({
      where: { id: recordingId },
      data: { status },
    })
    return updated as TrailRecordingModel
  }

  async completeRecordingAndCreateTrail(params: {
    recordingId: string
    userId: string
    endedAt: Date
    processedGeojson: any
    metrics: {
      distanceKm: number
      elevationGainM: number
      elevationLossM: number
      minElevationM: number
      maxElevationM: number
      elevationProfile: any
    }
    trailMetadata?: {
      title?: string
      description?: string | null
      difficulty?: string | null
      visibility?: string | null
    }
  }): Promise<{ recording: TrailRecordingModel; personalTrail: PersonalTrailModel }> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create PersonalTrail
      const title = params.trailMetadata?.title || 'Cung đường cá nhân'
      const difficulty = mapDifficulty(params.trailMetadata?.difficulty)
      const visibility = mapVisibility(params.trailMetadata?.visibility)

      const personalTrail = await tx.personalTrail.create({
        data: {
          userId: params.userId,
          title,
          description: params.trailMetadata?.description || null,
          difficulty,
          visibility,
          status: RecordStatus.ACTIVE,
          distanceKm: params.metrics.distanceKm,
          elevationGainM: params.metrics.elevationGainM,
          elevationLossM: params.metrics.elevationLossM,
          elevationProfile: params.metrics.elevationProfile,
          routeGeojson: params.processedGeojson,
        },
      })

      // 2. Update TrailRecording
      const recording = await tx.trailRecording.update({
        where: { id: params.recordingId },
        data: {
          status: 'READY',
          endedAt: params.endedAt,
          distanceKm: params.metrics.distanceKm,
          elevationGainM: params.metrics.elevationGainM,
          elevationLossM: params.metrics.elevationLossM,
          elevationProfile: params.metrics.elevationProfile,
          processedGeojson: params.processedGeojson,
          createdPersonalTrailId: personalTrail.id,
        },
      })

      return {
        recording: recording as TrailRecordingModel,
        personalTrail: personalTrail as unknown as PersonalTrailModel,
      }
    })
  }

  async findPersonalTrailById(id: string): Promise<any | null> {
    const trail = await this.prisma.personalTrail.findUnique({
      where: { id },
      include: {
        trailSubmissionsViaPersonalTrailId: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    if (!trail) return null

    const latestSubmission = trail.trailSubmissionsViaPersonalTrailId?.[0]
    const verificationStatus = latestSubmission?.status || 'DRAFT'

    return {
      ...trail,
      verificationStatus,
    }
  }

  async findMyPersonalTrails(
    userId: string,
    query: MyTrailsQuery,
  ): Promise<{ items: any[]; totalItems: number }> {
    const skip = (query.page - 1) * query.limit
    const take = query.limit

    const where: any = {
      userId,
      status: RecordStatus.ACTIVE,
    }

    if (query.verificationStatus) {
      if (query.verificationStatus === 'DRAFT') {
        where.trailSubmissionsViaPersonalTrailId = { none: {} }
      } else {
        const mappedStatus =
          query.verificationStatus === 'PENDING'
            ? TrailSubmissionStatus.SUBMITTED
            : (query.verificationStatus as TrailSubmissionStatus)
        where.trailSubmissionsViaPersonalTrailId = {
          some: { status: mappedStatus },
        }
      }
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.personalTrail.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          trailSubmissionsViaPersonalTrailId: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.personalTrail.count({ where }),
    ])

    const formattedItems = items.map((t) => {
      const latestSubmission = t.trailSubmissionsViaPersonalTrailId?.[0]
      const verificationStatus = latestSubmission?.status || 'DRAFT'
      return {
        id: t.id,
        name: t.title,
        title: t.title,
        description: t.description,
        difficulty: t.difficulty,
        distanceKm: Number(t.distanceKm ?? 0),
        elevationGainM: t.elevationGainM ?? 0,
        elevationLossM: t.elevationLossM ?? 0,
        visibility: t.visibility,
        verificationStatus,
        demStatus: 'READY',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }
    })

    return { items: formattedItems, totalItems }
  }

  async updatePersonalTrail(id: string, userId: string, data: any): Promise<PersonalTrailModel> {
    const trail = await this.prisma.personalTrail.findUnique({
      where: { id },
      include: {
        trailSubmissionsViaPersonalTrailId: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!trail) {
      throw new AppError({
        code: PersonalTrailErrorCode.PERSONAL_TRAIL_NOT_FOUND,
        message: 'Cung đường không tồn tại',
      })
    }

    if (trail.userId !== userId) {
      throw new AppError({
        code: PersonalTrailErrorCode.TRAIL_ACCESS_DENIED,
        message: 'Không có quyền chỉnh sửa cung đường này',
      })
    }

    const latestSubmission = trail.trailSubmissionsViaPersonalTrailId?.[0]
    if (latestSubmission && latestSubmission.status === TrailSubmissionStatus.APPROVED) {
      throw new AppError({
        code: PersonalTrailErrorCode.CANNOT_MODIFY_VERIFIED_TRAIL,
        message: 'Cung đường đã được xác minh/phê duyệt, không thể chỉnh sửa',
      })
    }

    const updateData: any = {}
    if (data.name || data.title) updateData.title = data.name || data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.difficulty) updateData.difficulty = mapDifficulty(data.difficulty)
    if (data.visibility) updateData.visibility = mapVisibility(data.visibility)

    const updated = await this.prisma.personalTrail.update({
      where: { id },
      data: updateData,
    })

    return updated as unknown as PersonalTrailModel
  }

  async softDeletePersonalTrail(id: string, userId: string): Promise<void> {
    const trail = await this.prisma.personalTrail.findUnique({
      where: { id },
    })

    if (!trail) {
      throw new AppError({
        code: PersonalTrailErrorCode.PERSONAL_TRAIL_NOT_FOUND,
        message: 'Cung đường không tồn tại',
      })
    }

    if (trail.userId !== userId) {
      throw new AppError({
        code: PersonalTrailErrorCode.TRAIL_ACCESS_DENIED,
        message: 'Không có quyền xóa cung đường này',
      })
    }

    await this.prisma.personalTrail.update({
      where: { id },
      data: {
        status: RecordStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    })
  }

  async submitTrailVerification(trailId: string, userId: string, note?: string): Promise<any> {
    const trail = await this.prisma.personalTrail.findUnique({
      where: { id: trailId },
      include: {
        trailSubmissionsViaPersonalTrailId: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!trail) {
      throw new AppError({
        code: PersonalTrailErrorCode.PERSONAL_TRAIL_NOT_FOUND,
        message: 'Cung đường không tồn tại',
      })
    }

    if (trail.userId !== userId) {
      throw new AppError({
        code: PersonalTrailErrorCode.TRAIL_ACCESS_DENIED,
        message: 'Chỉ chủ sở hữu mới có quyền gửi yêu cầu kiểm duyệt',
      })
    }

    const distance = Number(trail.distanceKm ?? 0)
    if (distance < 0.5) {
      throw new AppError({
        code: PersonalTrailErrorCode.TRAIL_TOO_SHORT_FOR_VERIFY,
        message: 'Cung đường phải dài tối thiểu 500m (0.5 km) để được gửi kiểm duyệt',
      })
    }

    const submission = await this.prisma.trailSubmission.create({
      data: {
        personalTrailId: trailId,
        submittedBy: userId,
        status: TrailSubmissionStatus.SUBMITTED,
        submissionNote: note || null,
      },
    })

    return {
      trailId: trail.id,
      verificationStatus: 'PENDING',
      submittedAt: submission.createdAt,
    }
  }
}
