import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { IPersonalTrailRepository } from '../../application/ports/personal-trail.port'
import {
  MyTrailsQuery,
  RawSamplesBatchInput,
  PersonalCheckpointInput,
} from '../../presentation/dtos/personal-trail.dto'
import {
  PersonalTrailModel,
  TrailRecordingModel,
  TrailRecordingPointModel,
} from '../../application/ports/personal-trail.port'
import { DifficultyLevel, PersonalTrailVisibility, RecordStatus, TrailSubmissionStatus, Prisma } from '@prisma/client'
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
  private readonly logger = new Logger(PrismaPersonalTrailAdapter.name)
  constructor(private readonly prisma: PrismaService) {}

  private async transaction<T>(
    operation: string,
    resourceId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    sampleCount?: number,
  ): Promise<T> {
    const started = Date.now()
    let code: string | undefined
    let outcome = 'committed'
    let appErrorCode: string | undefined
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Fail lock contention before the interactive transaction itself expires.
          await tx.$queryRaw`SELECT set_config('lock_timeout', '3000', true)`
          return work(tx)
        },
        { maxWait: 5_000, timeout: 15_000 },
      )
    } catch (error) {
      outcome = 'failed'
      if (error instanceof AppError) appErrorCode = error.code
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        code = error.code
        const lockTimeout = error.code === 'P2010' && error.meta?.code === '55P03'
        if (lockTimeout || error.code === 'P2034') {
          throw new AppError({ code: PersonalTrailErrorCode.PERSONAL_TRAIL_STORAGE_BUSY })
        }
        if (error.code === 'P2028') {
          // P2028 includes ambiguous connection/lifecycle failures: do not blindly replay.
          throw new AppError({ code: PersonalTrailErrorCode.PERSONAL_TRAIL_TRANSACTION_UNAVAILABLE })
        }
      }
      throw error
    } finally {
      this.logger.log(
        JSON.stringify({
          operation,
          resourceId,
          sampleCount,
          durationMs: Date.now() - started,
          prismaCode: code,
          appErrorCode,
          outcome,
        }),
      )
    }
  }

  private async lock(tx: Prisma.TransactionClient, table: 'trail_recordings' | 'personal_trails', id: string) {
    const started = Date.now()
    try {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw(table)} WHERE id = ${id}::uuid FOR UPDATE`)
    } finally {
      this.logger.log(JSON.stringify({ operation: 'lock', table, resourceId: id, durationMs: Date.now() - started }))
    }
  }

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
    try {
      return await this.prisma.trailRecording.create({
        data: {
          clientRecordingId: data.clientRecordingId,
          userId: data.userId,
          startedAt: data.startedAt,
          status: data.status,
        },
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      const existing = await this.findRecordingByClientRecordingId(data.clientRecordingId, data.userId)
      if (existing) return existing
      throw new AppError({ code: PersonalTrailErrorCode.CLIENT_RECORDING_ID_CONFLICT })
    }
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

    const result = await this.transaction(
      'upload',
      recordingId,
      async (tx) => {
        await this.lock(tx, 'trail_recordings', recordingId)
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
      },
      receivedCount,
    )

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
      orderBy: [{ segmentId: 'asc' }, { recordedAt: 'asc' }, { clientSampleId: 'asc' }],
    })

    return points
  }

  async updateRecordingStatus(recordingId: string, status: string): Promise<TrailRecordingModel> {
    return this.transaction('status', recordingId, async (tx) => {
      await this.lock(tx, 'trail_recordings', recordingId)
      const recording = await tx.trailRecording.findUnique({ where: { id: recordingId } })
      if (!recording) throw new AppError({ code: PersonalTrailErrorCode.RECORDING_NOT_FOUND })
      if (recording.status === 'READY') {
        throw new AppError({ code: PersonalTrailErrorCode.RECORDING_ALREADY_FINISHED })
      }
      if (recording.status === status) return recording
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
    checkpoints?: PersonalCheckpointInput[]
  }): Promise<{ recording: TrailRecordingModel; personalTrail: PersonalTrailModel }> {
    return this.transaction('finish', params.recordingId, async (tx) => {
      await this.lock(tx, 'trail_recordings', params.recordingId)
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

      if (params.endedAt.getTime() < existingRec.startedAt.getTime()) {
        throw new AppError({ code: PersonalTrailErrorCode.INVALID_RECORDING_TIME })
      }
      if (elapsedSeconds === undefined) {
        if (existingRec?.startedAt && params.endedAt) {
          elapsedSeconds = Math.max(
            0,
            Math.floor((new Date(params.endedAt).getTime() - new Date(existingRec.startedAt).getTime()) / 1000),
          )
        } else {
          durationStr = '1 phút'
          elapsedSeconds = 60
        }
      }
      if (!Number.isInteger(elapsedSeconds) || elapsedSeconds < 0 || elapsedSeconds > 2_147_483_647) {
        throw new AppError({ code: PersonalTrailErrorCode.INVALID_RECORDING_TIME })
      }
      if (!durationStr) {
        const mins = Math.round(elapsedSeconds / 60)
        durationStr = mins >= 60 ? `${Math.floor(mins / 60)} giờ ${mins % 60} phút` : `${Math.max(1, mins)} phút`
      }
      const difficulty = mapDifficulty(params.trailMetadata?.difficulty)
      const visibility = mapVisibility(params.trailMetadata?.visibility)

      // Reuse the manually prepared destination; never create replacement data here.
      const destinationName = 'Hồ Chí Minh'
      const destination = await tx.destination.findFirst({
        where: { name: { equals: destinationName, mode: 'insensitive' }, status: RecordStatus.ACTIVE },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      if (!destination) throw new AppError({ code: PersonalTrailErrorCode.PERSONAL_TRAIL_DESTINATION_UNAVAILABLE })

      const personalTrail = await tx.personalTrail.create({
        data: {
          userId: params.userId,
          destinationId: destination.id,
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
        ? params.processedGeojson.coordinates.filter((segment: unknown) => Array.isArray(segment) && segment.length > 0)
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
            sequence: (params.checkpoints?.length ?? 0) + 2,
            info: 'END',
          },
          ...(params.checkpoints ?? []).map((checkpoint, index) => ({
            personalTrailId: personalTrail.id,
            name: checkpoint.name,
            latitude: checkpoint.latitude,
            longitude: checkpoint.longitude,
            radiusMeters: checkpoint.radiusMeters,
            info: checkpoint.info ?? null,
            sequence: index + 2,
          })),
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
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
        const statuses =
          query.verificationStatus === 'PENDING'
            ? [TrailSubmissionStatus.SUBMITTED, TrailSubmissionStatus.UNDER_REVIEW]
            : query.verificationStatus === 'VERIFIED'
              ? [TrailSubmissionStatus.APPROVED]
              : [query.verificationStatus as TrailSubmissionStatus]
        // Prisma relation.some matches history, not the latest submission.
        const matching = await this.prisma.$queryRaw<Array<{ personal_trail_id: string }>>(Prisma.sql`
          SELECT latest.personal_trail_id FROM (
            SELECT DISTINCT ON (s.personal_trail_id) s.personal_trail_id, s.status
            FROM trail_submissions s
            JOIN personal_trails t ON t.id = s.personal_trail_id
            WHERE t.user_id = ${userId}::uuid AND t.status = 'ACTIVE'
            ORDER BY s.personal_trail_id, s.created_at DESC, s.id DESC
          ) latest WHERE latest.status::text IN (${Prisma.join(statuses)})
        `)
        where.id = { in: matching.map((row) => row.personal_trail_id) }
      }
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.personalTrail.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          trailSubmissionsViaPersonalTrailId: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
    return this.transaction('update-trail', id, async (tx) => {
      await this.lock(tx, 'personal_trails', id)
      const trail = await tx.personalTrail.findUnique({
        where: { id, status: RecordStatus.ACTIVE },
        include: {
          trailSubmissionsViaPersonalTrailId: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
    return this.transaction('delete-trail', id, async (tx) => {
      await this.lock(tx, 'personal_trails', id)
      const trail = await tx.personalTrail.findUnique({
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

      await tx.personalTrail.update({
        where: { id },
        data: {
          status: RecordStatus.INACTIVE,
          archivedAt: new Date(),
        },
      })
    })
  }

  async submitTrailVerification(trailId: string, userId: string, note?: string): Promise<any> {
    return this.transaction('submit', trailId, async (tx) => {
      await this.lock(tx, 'personal_trails', trailId)
      const trail = await tx.personalTrail.findUnique({
        where: { id: trailId, status: RecordStatus.ACTIVE },
        include: {
          trailSubmissionsViaPersonalTrailId: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
