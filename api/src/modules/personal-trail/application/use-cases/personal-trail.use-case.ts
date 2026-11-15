import { Inject, Injectable } from '@nestjs/common'
import {
  AdminSubmissionsQuery,
  ReviewSubmissionInput,
  MyTrailsQuery,
  SubmitVerificationInput,
  UpdatePersonalTrailInput,
} from '../../presentation/dtos/personal-trail.dto'
import { I_PERSONAL_TRAIL_REPOSITORY } from '../ports/personal-trail.port'
import type { IPersonalTrailRepository } from '../ports/personal-trail.port'
import { AppError } from '../../../../shared/errors/app-error'
import { PersonalTrailErrorCode } from '../../../../shared/errors/codes/personal-trail.error-codes'
import type { ActiveUserData } from '../../../../shared/types/user.type'
import { PersonalTrailVisibility } from '@prisma/client'

@Injectable()
export class PersonalTrailUseCase {
  constructor(
    @Inject(I_PERSONAL_TRAIL_REPOSITORY)
    private readonly repo: IPersonalTrailRepository,
  ) {}

  async getMyTrails(user: ActiveUserData, query: MyTrailsQuery) {
    const { items, totalItems } = await this.repo.findMyPersonalTrails(user.id, query)
    const totalPages = Math.ceil(totalItems / query.limit) || 1

    return {
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
      },
      data: items,
    }
  }

  async getDetail(user: ActiveUserData, id: string) {
    const trail = await this.repo.findPersonalTrailById(id)
    if (!trail) {
      throw new AppError({
        code: PersonalTrailErrorCode.PERSONAL_TRAIL_NOT_FOUND,
        message: 'Không tìm thấy cung đường cá nhân',
      })
    }

    // Permission check: owner or public/shared
    if (trail.userId !== user.id && trail.visibility === PersonalTrailVisibility.PRIVATE) {
      throw new AppError({
        code: PersonalTrailErrorCode.TRAIL_ACCESS_DENIED,
        message: 'Cung đường này ở chế độ riêng tư và bạn không phải chủ sở hữu',
      })
    }

    return this.toDetail(trail)
  }

  private toDetail(trail: any) {
    const multiLineCoordinates = trail.routeGeojson?.coordinates || []

    return {
      id: trail.id,
      ownerId: trail.userId,
      name: trail.title,
      title: trail.title,
      description: trail.description,
      difficulty: trail.difficulty,
      distanceKm: Number(trail.distanceKm ?? 0),
      elevationGainM: trail.elevationGainM ?? 0,
      elevationLossM: trail.elevationLossM ?? 0,
      duration: trail.duration || '1 phút',
      visibility: trail.visibility,
      verificationStatus: trail.verificationStatus || 'DRAFT',
      gpsSegments: multiLineCoordinates,
      checkpoints: [],
      elevationProfile: trail.elevationProfile || [],
      clientRecordingId: trail.clientRecordingId,
      createdAt: trail.createdAt,
      updatedAt: trail.updatedAt,
    }
  }

  async update(user: ActiveUserData, id: string, input: UpdatePersonalTrailInput) {
    return this.repo.updatePersonalTrail(id, user.id, input)
  }

  async getCheckpoints(user: ActiveUserData, id: string) {
    await this.getDetail(user, id)
    return this.repo.findPersonalCheckpointsByTrailId(id)
  }

  async delete(user: ActiveUserData, id: string) {
    await this.repo.softDeletePersonalTrail(id, user.id)
    return {
      success: true,
      message: 'Đã xóa cung đường thành công',
    }
  }

  async submitVerification(user: ActiveUserData, id: string, input: SubmitVerificationInput) {
    return this.repo.submitTrailVerification(id, user.id, input.noteToAdmin)
  }

  async listSubmissions(query: AdminSubmissionsQuery) {
    const { items, totalItems } = await this.repo.findSubmissions(query)
    return {
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit) || 1,
      },
      data: items,
    }
  }

  /** Admin view of a submitted trail: access is granted through the submission, not the trail visibility. */
  async getSubmissionDetail(submissionId: string) {
    const submission = await this.repo.findSubmissionById(submissionId)
    const trail = submission && (await this.repo.findPersonalTrailById(submission.personalTrailId))
    if (!submission || !trail) {
      throw new AppError({ code: PersonalTrailErrorCode.TRAIL_SUBMISSION_NOT_FOUND })
    }
    const checkpoints = await this.repo.findPersonalCheckpointsByTrailId(trail.id)
    return { ...submission, trail: { ...this.toDetail(trail), checkpoints } }
  }

  async reviewSubmission(admin: ActiveUserData, submissionId: string, input: ReviewSubmissionInput) {
    return this.repo.reviewSubmission(submissionId, admin.id, input)
  }
}
