import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import type { Actor, Page } from '../../application/trip.types'
import { TripHistoryUseCase } from '../../application/use-cases/trip-history.use-case'

const historyQuery = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict()

const historyResponse = () => ApiResponse({
  status: 200,
  description: 'Trang lịch sử; items rỗng nếu không có kết quả.',
  schema: {
    type: 'object',
    required: ['items', 'page', 'pageSize', 'total', 'totalPages'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'tripType', 'title', 'status', 'startAt', 'endAt', 'completedAt', 'cancelledAt', 'destination'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            tripType: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
            title: { type: 'string' },
            status: { type: 'string', enum: ['COMPLETED', 'CANCELLED', 'INTERRUPTED'] },
            startAt: { type: 'string', format: 'date-time' },
            endAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
            cancelledAt: { type: 'string', format: 'date-time', nullable: true },
            destination: {
              type: 'object',
              required: ['id', 'name'],
              properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' } },
            },
          },
        },
      },
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100 },
      total: { type: 'integer', minimum: 0 },
      totalPages: { type: 'integer', minimum: 0 },
    },
  },
})

@ApiTags('My Trip History')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('me')
export class TripHistoryController {
  constructor(private readonly history: TripHistoryUseCase) {}

  @Get('public-trips/history')
  @ApiOperation({
    summary: 'Lịch sử chuyến công khai của mình',
    description: 'USER/LEADER ACTIVE. Chỉ COMPLETED, CANCELLED, INTERRUPTED có booking của mình đã được xác nhận (confirmedAt khác null). Mỗi chuyến xuất hiện một lần, mới nhất theo startAt rồi id. Không nhận userId.',
  })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1, minimum: 1, maximum: 1000000 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } })
  @historyResponse()
  @ApiResponse({ status: 400, description: 'Query không hợp lệ; dùng error/meta chuẩn.' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
  @ApiResponse({ status: 403, description: 'Tài khoản không ACTIVE hoặc vai trò không được phép.' })
  publicHistory(@ActiveUser() actor: Actor, @Query(new ZodValidationPipe(historyQuery)) page: Page) {
    return this.history.list(actor, 'PUBLIC', page)
  }

  @Get('private-trips/history')
  @ApiOperation({
    summary: 'Lịch sử chuyến riêng của mình',
    description: 'USER/LEADER ACTIVE. Chỉ COMPLETED, CANCELLED, INTERRUPTED do mình tạo hoặc có membership của mình, kể cả LEFT/REMOVED. Mỗi chuyến xuất hiện một lần, mới nhất theo startAt rồi id. Không nhận userId.',
  })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1, minimum: 1, maximum: 1000000 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } })
  @historyResponse()
  @ApiResponse({ status: 400, description: 'Query không hợp lệ; dùng error/meta chuẩn.' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
  @ApiResponse({ status: 403, description: 'Tài khoản không ACTIVE hoặc vai trò không được phép.' })
  privateHistory(@ActiveUser() actor: Actor, @Query(new ZodValidationPipe(historyQuery)) page: Page) {
    return this.history.list(actor, 'PRIVATE', page)
  }
}
