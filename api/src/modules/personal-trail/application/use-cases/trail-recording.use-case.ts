import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  FinishRecordingInput,
  RawSamplesBatchInput,
  StartRecordingInput,
  UpdateRecordingStatusInput,
} from '../../presentation/dtos/personal-trail.dto'
import { I_PERSONAL_TRAIL_REPOSITORY } from '../ports/personal-trail.port'
import type { IPersonalTrailRepository } from '../ports/personal-trail.port'
import { ProcessTrailElevationUseCase } from '../../../elevation/application/use-cases/process-trail-elevation.use-case'
import { AppError } from '../../../../shared/errors/app-error'
import { PersonalTrailErrorCode } from '../../../../shared/errors/codes/personal-trail.error-codes'
import type { ActiveUserData } from '../../../../shared/types/user.type'

@Injectable()
export class TrailRecordingUseCase {
  private readonly logger = new Logger(TrailRecordingUseCase.name)

  constructor(
    @Inject(I_PERSONAL_TRAIL_REPOSITORY)
    private readonly repo: IPersonalTrailRepository,
    private readonly processElevationUseCase: ProcessTrailElevationUseCase,
  ) {}

  async start(user: ActiveUserData, input: StartRecordingInput) {
    // Idempotency: Check if clientRecordingId exists for this user
    const existing = await this.repo.findRecordingByClientRecordingId(input.clientRecordingId, user.id)
    if (existing) {
      return {
        serverRecordingId: existing.id,
        clientRecordingId: existing.clientRecordingId,
        status: existing.status,
        startedAt: existing.startedAt,
      }
    }

    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date()
    const recording = await this.repo.createRecording({
      clientRecordingId: input.clientRecordingId,
      userId: user.id,
      startedAt,
      status: 'RECORDING',
    })

    return {
      serverRecordingId: recording.id,
      clientRecordingId: recording.clientRecordingId,
      status: recording.status,
      startedAt: recording.startedAt,
    }
  }

  async saveRawSamples(user: ActiveUserData, recordingId: string, input: RawSamplesBatchInput) {
    const recording = await this.repo.findRecordingById(recordingId)
    if (!recording) {
      throw new AppError({
        code: PersonalTrailErrorCode.RECORDING_NOT_FOUND,
        message: 'Không tìm thấy phiên ghi trên server',
      })
    }

    if (recording.userId !== user.id) {
      throw new AppError({
        code: PersonalTrailErrorCode.TRAIL_ACCESS_DENIED,
        message: 'Không có quyền truy cập phiên ghi này',
      })
    }

    return this.repo.saveRawSamplesBatch(recordingId, input.samples)
  }

  async updateStatus(user: ActiveUserData, recordingId: string, input: UpdateRecordingStatusInput) {
    const recording = await this.repo.findRecordingById(recordingId)
    if (!recording) {
      throw new AppError({
        code: PersonalTrailErrorCode.RECORDING_NOT_FOUND,
        message: 'Không tìm thấy phiên ghi trên server',
      })
    }

    if (recording.userId !== user.id) {
      throw new AppError({
        code: PersonalTrailErrorCode.TRAIL_ACCESS_DENIED,
        message: 'Không có quyền truy cập phiên ghi này',
      })
    }

    if (recording.status === 'READY') {
      throw new AppError({
        code: PersonalTrailErrorCode.RECORDING_ALREADY_FINISHED,
        message: 'Phiên ghi đã kết thúc và tạo xong cung đường, không thể cập nhật trạng thái',
      })
    }

    const updated = await this.repo.updateRecordingStatus(recordingId, input.status)
    return {
      status: updated.status,
      updatedAt: updated.updatedAt,
    }
  }

  async finish(user: ActiveUserData, recordingId: string, input: FinishRecordingInput) {
    const recording = await this.repo.findRecordingById(recordingId)
    if (!recording) {
      throw new AppError({
        code: PersonalTrailErrorCode.RECORDING_NOT_FOUND,
        message: 'Không tìm thấy phiên ghi trên server',
      })
    }

    if (recording.userId !== user.id) {
      throw new AppError({
        code: PersonalTrailErrorCode.TRAIL_ACCESS_DENIED,
        message: 'Không có quyền truy cập phiên ghi này',
      })
    }

    // Idempotency: If already READY and has personal trail, return it directly
    if (recording.status === 'READY' && recording.createdPersonalTrailId) {
      return {
        serverRecordingId: recording.id,
        serverPersonalTrailId: recording.createdPersonalTrailId,
        status: 'READY',
        estimatedProcessTimeSec: 0,
      }
    }

    // 1. Fetch accepted GPS points
    const points = await this.repo.getPointsByRecordingId(recordingId, true)
    if (!points || points.length < 2) {
      throw new AppError({
        code: PersonalTrailErrorCode.INSUFFICIENT_GPS_POINTS,
        message: 'Cung đường có ít hơn 2 điểm GPS hợp lệ. Không thể tạo trail.',
      })
    }

    // 2. Process DEM elevation & GeoJSON MultiLineString
    const elevationInput = points.map((p) => ({
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      altitudeM: p.altitudeM !== null ? Number(p.altitudeM) : null,
      segmentId: p.segmentId,
      recordedAt: p.recordedAt,
    }))

    const elevationResult = await this.processElevationUseCase.execute(elevationInput)

    // 3. Complete recording and create PersonalTrail in transaction
    const endedAt = input.endedAt ? new Date(input.endedAt) : new Date()
    const { recording: updatedRecording, personalTrail } = await this.repo.completeRecordingAndCreateTrail({
      recordingId,
      userId: user.id,
      endedAt,
      processedGeojson: elevationResult.processedGeojson,
      metrics: elevationResult.metrics,
      trailMetadata: input.trailMetadata,
    })

    return {
      serverRecordingId: updatedRecording.id,
      serverPersonalTrailId: personalTrail.id,
      status: 'READY',
      estimatedProcessTimeSec: 0,
    }
  }

  async getStatus(user: ActiveUserData, recordingId: string) {
    const recording = await this.repo.findRecordingById(recordingId)
    if (!recording) {
      throw new AppError({
        code: PersonalTrailErrorCode.RECORDING_NOT_FOUND,
        message: 'Không tìm thấy phiên ghi trên server',
      })
    }

    if (recording.userId !== user.id) {
      throw new AppError({
        code: PersonalTrailErrorCode.TRAIL_ACCESS_DENIED,
        message: 'Không có quyền truy cập phiên ghi này',
      })
    }

    if (recording.status !== 'READY') {
      return {
        status: recording.status,
        progressPercent: recording.status === 'PROCESSING' ? 50 : 0,
        message: 'Đang chuẩn bị xử lý dữ liệu GPS...',
      }
    }

    return {
      status: 'READY',
      serverPersonalTrailId: recording.createdPersonalTrailId,
      officialTelemetry: {
        distanceKm: Number(recording.distanceKm ?? 0),
        elevationGainM: recording.elevationGainM ?? 0,
        elevationLossM: recording.elevationLossM ?? 0,
        maxElevationM: recording.elevationProfile
          ? Math.max(...(recording.elevationProfile as any[]).map((p) => p.elevationM || 0))
          : 0,
        minElevationM: recording.elevationProfile
          ? Math.min(...(recording.elevationProfile as any[]).map((p) => p.elevationM || 0))
          : 0,
      },
      processedGeojson: recording.processedGeojson,
    }
  }
}
