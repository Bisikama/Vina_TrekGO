import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Header } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { openApiSchema as schema, LeaderResponse } from './leader.swagger'
import { Auth } from '../../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../../shared/decorators/active-user.decorator'
import { Roles } from '../../../shared/decorators/roles.decorator'
import { AuthType } from '../../../shared/constants/auth.constant'
import { UserRole } from '../../../shared/constants'
import type { ActiveUserData } from '../../../shared/types/user.type'
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe'
import { LeaderApplicationsService } from '../application/leader-applications.service'
import { submitSchema, pageSchema, adminListSchema, reviewSchema } from './leader.schemas'
import type { SubmitInput, ListInput, ReviewInput } from './leader.schemas'
import { applyDecorators } from '@nestjs/common'
import { randomUUID } from 'crypto'

const paging = (limit: number) =>
  applyDecorators(
    ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, default: 1 } }),
    ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: limit } }),
  )

@Controller()
@ApiTags('Leader applications SF01')
@ApiBearerAuth()
@Auth([AuthType.Bearer])
@ApiResponse({ status: 400, description: 'VALIDATION_ERROR: invalid DTO; shared error/meta envelope.' })
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'FORBIDDEN / LEADER_CANNOT_APPLY' })
@ApiResponse({ status: 404, description: 'APPLICATION_NOT_FOUND / DOCUMENT_NOT_FOUND' })
@ApiResponse({ status: 409, description: 'APPLICATION_ALREADY_PENDING / APPLICATION_NOT_REVIEWABLE' })
@ApiResponse({
  status: 422,
  description: 'Certificate or review business rule failed; read error.code and error.details.',
})
export class LeaderApplicationsController {
  constructor(private readonly service: LeaderApplicationsService) {}

  @Post('leader-applications')
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'LR-01 Nộp đơn ứng tuyển Leader',
    description:
      'USER ACTIVE only. Upload using media scope LEADER_CERTIFICATE, complete the upload, then use mediaId as fileKey. No online test or completed-trip threshold.',
  })
  @ApiBody({ schema: schema(submitSchema) })
  @LeaderResponse('submit', 201)
  submit(@ActiveUser() actor: ActiveUserData, @Body(new ZodValidationPipe(submitSchema)) input: SubmitInput) {
    return this.service.submit(actor, input)
  }

  @Get('leader-applications/me')
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'LR-02 Lịch sử đơn của tôi',
    description:
      'Available after promotion. Certificate mediaId can be used with GET /media/:id/delivery?variant=DOCUMENT_ORIGINAL.',
  })
  @paging(10)
  @LeaderResponse('mine', 200)
  mine(@ActiveUser() actor: ActiveUserData, @Query(new ZodValidationPipe(pageSchema)) query: ListInput) {
    return this.service.mine(actor, query)
  }

  @Get('leader-certificate-types')
  @Roles(UserRole.USER, UserRole.LEADER, UserRole.ADMIN)
  @ApiOperation({ summary: 'LR-03 Danh mục loại chứng chỉ' })
  @LeaderResponse('types', 200)
  types(@ActiveUser() actor: ActiveUserData) {
    return this.service.types(actor)
  }

  @Get('admin/leader-applications')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'LR-04 Admin tìm kiếm đơn ứng tuyển' })
  @paging(20)
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
  })
  @ApiQuery({ name: 'search', required: false, description: 'Applicant name or email', type: String })
  @LeaderResponse('list', 200)
  list(@ActiveUser() actor: ActiveUserData, @Query(new ZodValidationPipe(adminListSchema)) query: ListInput) {
    return this.service.list(actor, query)
  }

  @Get('admin/leader-applications/:id')
  @Roles(UserRole.ADMIN)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'LR-05 Chi tiết đơn và URL chứng chỉ có thời hạn' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @LeaderResponse('detail', 200)
  detail(@ActiveUser() actor: ActiveUserData, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detail(actor, id)
  }

  @Patch('admin/leader-applications/:id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'LR-06 Duyệt hoặc từ chối đơn',
    description:
      'Atomic certificate review, application decision, profile verification, role promotion and audit. APPROVED requires no PENDING certificates and at least one valid VERIFIED certificate. Rejection requires a reason.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: schema(reviewSchema) })
  @LeaderResponse('review', 200)
  review(
    @ActiveUser() actor: ActiveUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(reviewSchema)) input: ReviewInput,
    @Req() req: { id?: string; headers: Record<string, string | string[] | undefined> },
  ) {
    const requestId = req.id || req.headers['x-request-id']
    return this.service.review(
      actor,
      id,
      input,
      typeof requestId === 'string' && requestId.trim() ? requestId.slice(0, 120) : randomUUID(),
    )
  }
}
