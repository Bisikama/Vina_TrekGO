import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { Roles } from '../../../../shared/decorators/roles.decorator'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import type { ActiveUserData } from '../../../../shared/types/user.type'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { PersonalTrailUseCase } from '../../application/use-cases/personal-trail.use-case'
import {
  adminSubmissionsQuerySchema,
  reviewSubmissionSchema,
  ReviewSubmissionRequestDto,
} from '../dtos/personal-trail.dto'
import type { AdminSubmissionsQuery, ReviewSubmissionInput } from '../dtos/personal-trail.dto'

@ApiTags('Admin - Personal Trail Submissions')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.ADMIN)
@Controller('admin/trail-submissions')
export class AdminTrailSubmissionController {
  constructor(private readonly useCase: PersonalTrailUseCase) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Danh sách yêu cầu kiểm duyệt cung đường cá nhân',
    description: 'PENDING gồm SUBMITTED và UNDER_REVIEW, sắp xếp cũ nhất trước.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiResponse({ status: 200, description: 'Danh sách yêu cầu kiểm duyệt' })
  async list(@Query(new ZodValidationPipe(adminSubmissionsQuerySchema)) query: AdminSubmissionsQuery) {
    return { success: true, ...(await this.useCase.listSubmissions(query)) }
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chi tiết yêu cầu kiểm duyệt kèm tuyến GPS và checkpoint',
    description: 'Admin xem được cung đường riêng tư vì nó đã được gửi kiểm duyệt.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID của trail submission' })
  @ApiResponse({ status: 200, description: 'Chi tiết yêu cầu kiểm duyệt' })
  @ApiResponse({ status: 404, description: 'TRAIL_SUBMISSION_NOT_FOUND' })
  async detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.useCase.getSubmissionDetail(id) }
  }

  @Patch(':id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Duyệt hoặc từ chối yêu cầu kiểm duyệt cung đường',
    description: 'Chỉ xử lý được yêu cầu đang SUBMITTED/UNDER_REVIEW. Khi từ chối phải có reviewNote.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID của trail submission' })
  @ApiBody({ type: ReviewSubmissionRequestDto })
  @ApiResponse({ status: 200, description: 'Đã xử lý yêu cầu kiểm duyệt' })
  @ApiResponse({ status: 404, description: 'TRAIL_SUBMISSION_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'TRAIL_SUBMISSION_ALREADY_REVIEWED' })
  async review(
    @ActiveUser() admin: ActiveUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(reviewSubmissionSchema)) body: ReviewSubmissionInput,
  ) {
    const data = await this.useCase.reviewSubmission(admin, id, body)
    return {
      success: true,
      message: body.decision === 'APPROVE' ? 'Đã duyệt cung đường' : 'Đã từ chối cung đường',
      data,
    }
  }
}
