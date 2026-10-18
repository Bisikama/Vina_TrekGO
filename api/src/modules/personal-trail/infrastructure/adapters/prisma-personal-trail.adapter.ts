import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { IPersonalTrailRepository } from '../../application/ports/personal-trail.port'
import { MyTrailsQuery, RawSamplesBatchInput } from '../../presentation/dtos/personal-trail.dto'
import {
  PersonalTrailModel,
  TrailRecordingModel,
  TrailRecordingPointModel,
} from '../../application/ports/personal-trail.port'
import { DifficultyLevel, PersonalTrailVisibility, RecordStatus, TrailSubmissionStatus } from '@prisma/client'
import { AppError } from '../../../../shared/errors/app-error'
import { PersonalTrailErrorCode } from '../../../../shared/errors/codes/personal-trail.error-codes'

function mapDifficulty(input?: string | null): DifficultyLevel | null {
  if (!input) return null
  const upper = input.toUpperCase()
  if (upper === 'EASY' || upper.includes('DỄ')) return DifficultyLevel.EASY
  if (upper === 'MEDIUM' || upper === 'MODERATE' || upper.includes('TRUNG BÌNH')) return DifficultyLevel.MEDIUM
  if (upper === 'EXTREME' || upper === 'VERY_HARD' || upper === 'CHALLENGING' || upper.includes('RẤT KHÓ'))
    return DifficultyLevel.EXTREME
  if (upper === 'HARD' || upper.includes('KHÓ')) return DifficultyLevel.HARD
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
    return record
  }

  async findRecordingByClientRecordingId(
    clientRecordingId: string,
    userId: string,
  ): Promise<TrailRecordingModel | null> {
    const record = await this.prisma.trailRecording.findFirst({
      where: { clientRecordingId, userId },
    })
    return record
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
    return created
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
      altitudeAccuracyM: s.altitudeAccuracyM !== undefined && s.altitudeAccuracyM !== null ? s.altitudeAccuracyM : null,
      speedMps: s.speedMps !== undefined && s.speedMps !== null ? s.speedMps : null,
      headingDeg: s.headingDeg !== undefined && s.headingDeg !== null ? s.headingDeg : null,
      segmentId: s.segmentId ?? 0,
      accepted: s.accepted !== undefined && s.accepted !== null ? s.accepted : true,
      rejectReason: s.rejectReason ?? null,
      recordedAt: new Date(s.recordedAt),
    }))

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trail_recordings WHERE id = ${recordingId}::uuid FOR UPDATE`
      const recording = await tx.trailRecording.findUnique({ where: { id: recordingId } })
      if (!recording) throw new AppError({ code: PersonalTrailErrorCode.RECORDING_NOT_FOUND })
      if (recording.status === 'READY') {
        throw new AppError({ code: PersonalTrailErrorCode.RECORDING_ALREADY_FINISHED })
      }
      const inserted = await tx.trailRecordingPoint.createMany({ data, skipDuplicates: true })
      // Invalidate elevation calculations that started before this upload.
      if (inserted.count > 0) {
        await tx.trailRecording.update({
          where: { id: recordingId },
          data: { updatedAt: new Date(Math.max(Date.now(), recording.updatedAt.getTime() + 1)) },
        })
      }
      return inserted
    })

    const insertedCount = result.count
    const duplicatedCount = Math.max(0, receivedCount - insertedCount)

    return {
      receivedCount,
      insertedCount,
      duplicatedCount,
    }
  }

  async getPointsByRecordingId(recordingId: string, acceptedOnly = true): Promise<TrailRecordingPointModel[]> {
    const where: any = { recordingId }
    if (acceptedOnly) {
      where.OR = [{ accepted: true }, { accepted: null }]
    }

    const points = await this.prisma.trailRecordingPoint.findMany({
      where,
      orderBy: [{ segmentId: 'asc' }, { recordedAt: 'asc' }],
    })

    return points
  }

  async updateRecordingStatus(recordingId: string, status: string): Promise<TrailRecordingModel> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trail_recordings WHERE id = ${recordingId}::uuid FOR UPDATE`
      const recording = await tx.trailRecording.findUnique({ where: { id: recordingId } })
      if (!recording) throw new AppError({ code: PersonalTrailErrorCode.RECORDING_NOT_FOUND })
      if (recording.status === 'READY') {
        throw new AppError({ code: PersonalTrailErrorCode.RECORDING_ALREADY_FINISHED })
      }
      return tx.trailRecording.update({
        where: { id: recordingId },
        data: { status, updatedAt: new Date(Math.max(Date.now(), recording.updatedAt.getTime() + 1)) },
      })
    })
  }

  async completeRecordingAndCreateTrail(params: {
    recordingId: string
    userId: string
    expectedUpdatedAt: Date
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
    provisionalTelemetry?: {
      duration?: string
      elapsedSeconds?: number
    }
    trailMetadata?: {
      title?: string
      description?: string | null
      difficulty?: string | null
      visibility?: string | null
    }
  }): Promise<{ recording: TrailRecordingModel; personalTrail: PersonalTrailModel }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trail_recordings WHERE id = ${params.recordingId}::uuid FOR UPDATE`
      // 1. Create PersonalTrail
      const title = params.trailMetadata?.title || 'Cung đường cá nhân'

      // Tính toán duration chuẩn
      let durationStr = params.provisionalTelemetry?.duration
      let elapsedSeconds = params.provisionalTelemetry?.elapsedSeconds

      const existingRec = await tx.trailRecording.findUnique({
        where: { id: params.recordingId },
      })

      if (!existingRec) throw new AppError({ code: PersonalTrailErrorCode.RECORDING_NOT_FOUND })
      if (existingRec.userId !== params.userId) {
        throw new AppError({ code: PersonalTrailErrorCode.TRAIL_ACCESS_DENIED })
      }
      if (existingRec.status === 'READY' && existingRec.createdPersonalTrailId) {
        const existingTrail = await tx.personalTrail.findUniqueOrThrow({
          where: { id: existingRec.createdPersonalTrailId },
        })
        return {
          recording: existingRec,
          personalTrail: existingTrail as unknown as PersonalTrailModel,
        }
      }
      if (existingRec.updatedAt.getTime() !== params.expectedUpdatedAt.getTime()) {
        throw new AppError({ code: PersonalTrailErrorCode.RECORDING_CHANGED })
      }

      if (!durationStr || !elapsedSeconds) {
        if (existingRec?.startedAt && params.endedAt) {
          elapsedSeconds = Math.max(
            0,
            Math.floor((new Date(params.endedAt).getTime() - new Date(existingRec.startedAt).getTime()) / 1000),
          )
          const mins = Math.round(elapsedSeconds / 60)
          durationStr = mins >= 60 ? `${Math.floor(mins / 60)} giờ ${mins % 60} phút` : `${Math.max(1, mins)} phút`
        } else {
          durationStr = '1 phút'
          elapsedSeconds = 60
        }
      }
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
          duration: durationStr,
          elevationProfile: params.metrics.elevationProfile,
          routeGeojson: params.processedGeojson,
        },
      })

      const routeSegments = Array.isArray(params.processedGeojson?.coordinates)
        ? params.processedGeojson.coordinates.filter(
            (segment: unknown) => Array.isArray(segment) && segment.length > 0,
          )
        : []
      const firstCoordinate = routeSegments[0]?.[0]
      const lastSegment = routeSegments[routeSegments.length - 1]
      const lastCoordinate = lastSegment?.[lastSegment.length - 1]

      await tx.personalCheckpoint.createMany({
        data: [
          {
            personalTrailId: personalTrail.id,
            name: 'Điểm bắt đầu',
            longitude: Number(firstCoordinate[0]),
            latitude: Number(firstCoordinate[1]),
            sequence: 1,
            info: 'START',
          },
          {
            personalTrailId: personalTrail.id,
            name: 'Điểm kết thúc',
            longitude: Number(lastCoordinate[0]),
            latitude: Number(lastCoordinate[1]),
            sequence: 2,
            info: 'END',
          },
        ],
      })

      // 2. Update TrailRecording
      const recording = await tx.trailRecording.update({
        where: { id: params.recordingId },
        data: {
          status: 'READY',
          endedAt: params.endedAt,
          duration: durationStr,
          elapsedSeconds: elapsedSeconds,
          distanceKm: params.metrics.distanceKm,
          elevationGainM: params.metrics.elevationGainM,
          elevationLossM: params.metrics.elevationLossM,
          elevationProfile: params.metrics.elevationProfile,
          processedGeojson: params.processedGeojson,
          createdPersonalTrailId: personalTrail.id,
        },
      })

      return {
        recording: recording,
        personalTrail: personalTrail as unknown as PersonalTrailModel,
      }
    })
  }

  async findPersonalTrailById(id: string): Promise<any> {
    const trail = await this.prisma.personalTrail.findUnique({
      where: { id, status: RecordStatus.ACTIVE },
      include: {
        trailSubmissionsViaPersonalTrailId: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        trailRecordingsViaCreatedPersonalTrailId: {
          select: { clientRecordingId: true, duration: true, elapsedSeconds: true, startedAt: true, endedAt: true },
          take: 1,
        },
      },
    })
    if (!trail) return null

    const latestSubmission = trail.trailSubmissionsViaPersonalTrailId?.[0]
    const verificationStatus = latestSubmission?.status || 'DRAFT'
    const linkedRec = trail.trailRecordingsViaCreatedPersonalTrailId?.[0]

    let duration = trail.duration || linkedRec?.duration
    if (!duration && linkedRec?.startedAt && linkedRec?.endedAt) {
      const sec = Math.max(
        0,
        Math.floor((new Date(linkedRec.endedAt).getTime() - new Date(linkedRec.startedAt).getTime()) / 1000),
      )
      const mins = Math.round(sec / 60)
      duration = mins >= 60 ? `${Math.floor(mins / 60)} giờ ${mins % 60} phút` : `${Math.max(1, mins)} phút`
    }
    if (!duration) {
      duration = '1 phút'
    }

    return {
      ...trail,
      duration,
      clientRecordingId: linkedRec?.clientRecordingId || undefined,
      verificationStatus,
    }
  }

  async findPersonalCheckpointsByTrailId(personalTrailId: string): Promise<any[]> {
    const checkpoints = await this.prisma.personalCheckpoint.findMany({
      where: { personalTrailId },
      orderBy: { sequence: 'asc' },
    })

    return checkpoints.map((checkpoint) => ({
      ...checkpoint,
      latitude: Number(checkpoint.latitude),
      longitude: Number(checkpoint.longitude),
    }))
  }

  async findMyPersonalTrails(userId: string, query: MyTrailsQuery): Promise<{ items: any[]; totalItems: number }> {
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
            : query.verificationStatus === 'VERIFIED'
              ? TrailSubmissionStatus.APPROVED
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
          trailRecordingsViaCreatedPersonalTrailId: {
            select: { clientRecordingId: true, duration: true, elapsedSeconds: true, startedAt: true, endedAt: true },
            take: 1,
          },
        },
      }),
      this.prisma.personalTrail.count({ where }),
    ])

    const formattedItems = items.map((t) => {
      const latestSubmission = t.trailSubmissionsViaPersonalTrailId?.[0]
      const verificationStatus = latestSubmission?.status || 'DRAFT'
      const multiLineCoordinates = (t.routeGeojson as any)?.coordinates || []
      const linkedRec = t.trailRecordingsViaCreatedPersonalTrailId?.[0]

      let duration = t.duration || linkedRec?.duration
      if (!duration && linkedRec?.startedAt && linkedRec?.endedAt) {
        const sec = Math.max(
          0,
          Math.floor((new Date(linkedRec.endedAt).getTime() - new Date(linkedRec.startedAt).getTime()) / 1000),
        )
        const mins = Math.round(sec / 60)
        duration = mins >= 60 ? `${Math.floor(mins / 60)} giờ ${mins % 60} phút` : `${Math.max(1, mins)} phút`
      }
      if (!duration) {
        duration = '1 phút'
      }

      return {
        id: t.id,
        name: t.title,
        title: t.title,
        description: t.description,
        difficulty: t.difficulty,
        distanceKm: Number(t.distanceKm ?? 0),
        elevationGainM: t.elevationGainM ?? 0,
        elevationLossM: t.elevationLossM ?? 0,
        duration,
        visibility: t.visibility,
        verificationStatus,
        demStatus: 'READY',
        gpsSegments: multiLineCoordinates,
        clientRecordingId: linkedRec?.clientRecordingId || undefined,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }
    })

    return { items: formattedItems, totalItems }
  }

  async updatePersonalTrail(id: string, userId: string, data: any): Promise<PersonalTrailModel> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM personal_trails WHERE id = ${id}::uuid FOR UPDATE`
      const trail = await tx.personalTrail.findUnique({
        where: { id, status: RecordStatus.ACTIVE },
        include: {
          trailSubmissionsViaPersonalTrailId: {
            orderBy: { createdAt: 'desc' },
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

      if (
        trail.trailSubmissionsViaPersonalTrailId.some(
          (submission) => submission.status === TrailSubmissionStatus.APPROVED,
        )
      ) {
        throw new AppError({
          code: PersonalTrailErrorCode.CANNOT_MODIFY_VERIFIED_TRAIL,
          message: 'Cung đường đã được xác minh/phê duyệt, không thể chỉnh sửa',
        })
      }

      const updateData: any = {}
      if (data.name || data.title) updateData.title = data.name || data.title
      if (data.description !== undefined) updateData.description = data.description
      if (data.duration) updateData.duration = data.duration
      if (data.difficulty) updateData.difficulty = mapDifficulty(data.difficulty)
      if (data.visibility) updateData.visibility = mapVisibility(data.visibility)

      const updated = await tx.personalTrail.update({
        where: { id },
        data: updateData,
      })

      return updated
    })
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
        status: RecordStatus.INACTIVE,
        archivedAt: new Date(),
      },
    })
  }

  async submitTrailVerification(trailId: string, userId: string, note?: string): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM personal_trails WHERE id = ${trailId}::uuid FOR UPDATE`
      const trail = await tx.personalTrail.findUnique({
        where: { id: trailId, status: RecordStatus.ACTIVE },
        include: {
          trailSubmissionsViaPersonalTrailId: {
            orderBy: { createdAt: 'desc' },
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

      if (
        trail.trailSubmissionsViaPersonalTrailId.some(
          (submission) => submission.status === TrailSubmissionStatus.APPROVED,
        )
      ) {
        throw new AppError({ code: PersonalTrailErrorCode.CANNOT_MODIFY_VERIFIED_TRAIL })
      }
      const latest = trail.trailSubmissionsViaPersonalTrailId[0]
      if (
        latest &&
        (latest.status === TrailSubmissionStatus.SUBMITTED || latest.status === TrailSubmissionStatus.UNDER_REVIEW)
      ) {
        return { trailId, verificationStatus: 'PENDING', submittedAt: latest.createdAt }
      }

      const distance = Number(trail.distanceKm ?? 0)
      if (distance < 0.5) {
        throw new AppError({
          code: PersonalTrailErrorCode.TRAIL_TOO_SHORT_FOR_VERIFY,
          message: 'Cung đường phải dài tối thiểu 500m (0.5 km) để được gửi kiểm duyệt',
        })
      }

      const submission = await tx.trailSubmission.create({
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
    })
  }
}
