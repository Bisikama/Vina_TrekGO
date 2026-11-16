import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from 'src/shared/constants'
import { AuthType } from 'src/shared/constants/auth.constant'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_RETURN_ERROR_CODES as RR } from 'src/shared/errors/codes/rental-return.error-codes'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { z } from 'zod'
import { EARLY_RETURN_ADMIN_LIST_STATUSES, EarlyReturnService } from '../../application/early-return.service'
import { RentalOrderIdParamSchema, RentalReturnIdempotencyKeySchema } from '../dtos/rental-return.dto'

const slotSchema = z.object({ requestedSlotAt: z.string().datetime({ offset: true }) })
const versionSchema = z.object({ expectedVersion: z.number().int().min(1) })
const confirmSchema = versionSchema.extend({ assigneeId: z.guid().optional() })
const assignSchema = versionSchema.extend({ assigneeId: z.guid() })
const rejectSchema = versionSchema.extend({ reason: z.string().trim().min(3).max(500) })
const listQuerySchema = z.object({ status: z.enum(EARLY_RETURN_ADMIN_LIST_STATUSES).default('PENDING') })

@ApiTags('Rental Early Returns')
@ApiBearerAuth('bearer')
@Controller()
@Auth([AuthType.Bearer])
export class EarlyReturnController {
  constructor(private readonly service: EarlyReturnService) {}

  @Get('rental-orders/:id/early-return')
  @Roles(UserRole.USER, UserRole.LEADER)
  async get(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) p: { id: string },
    @ActiveUser('id') userId: string,
  ) {
    return { data: await this.service.get(p.id, userId) }
  }

  @Post('rental-orders/:id/early-return')
  @Roles(UserRole.USER, UserRole.LEADER)
  request(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) p: { id: string },
    @Body(new ZodValidationPipe(slotSchema)) body: z.infer<typeof slotSchema>,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') userId: string,
  ) {
    return this.service.request(p.id, userId, new Date(body.requestedSlotAt), key(rawKey))
  }

  @Post('rental-early-returns/:id/cancel')
  @Roles(UserRole.USER, UserRole.LEADER)
  cancel(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) p: { id: string },
    @Body(new ZodValidationPipe(versionSchema)) body: z.infer<typeof versionSchema>,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') userId: string,
  ) {
    return this.service.cancel(p.id, userId, body.expectedVersion, key(rawKey))
  }

  // Xếp lịch trả sớm là việc điều phối, không động tới tiền: nhân viên kho xử lý, Admin vẫn làm được.
  // Route staff/... là đường chính; admin/... giữ lại để client cũ không vỡ.
  @Get(['staff/rental-early-returns', 'admin/rental-early-returns'])
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Danh sách yêu cầu trả sớm (nhân viên kho / Admin)' })
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>) {
    return this.service.listForAdmin(query.status)
  }

  @Post(['staff/rental-early-returns/:id/confirm', 'admin/rental-early-returns/:id/confirm'])
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Xác nhận lịch trả sớm (nhân viên kho / Admin)',
    description:
      'Dời giờ hẹn của task thu hồi sang giờ khách chọn và chốt nhân viên giao nhận đến lấy đồ. ' +
      '`assigneeId` (STAFF_DELIVERY đang hoạt động) bắt buộc khi task chưa có người nhận; bỏ trống thì giữ người đang nhận. ' +
      'Lỗi 422 `RENTAL_ASSIGNEE_INVALID` với `details.reason = ASSIGNEE_REQUIRED | NOT_ACTIVE_DELIVERY_STAFF`. ' +
      'Không thay đổi phí thuê, tiền cọc hay custody.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedVersion'],
      properties: {
        expectedVersion: { type: 'integer', minimum: 1, example: 1 },
        assigneeId: { type: 'string', format: 'uuid', description: 'UUID nhân viên giao nhận (STAFF_DELIVERY)' },
      },
    },
  })
  confirm(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) p: { id: string },
    @Body(new ZodValidationPipe(confirmSchema)) body: z.infer<typeof confirmSchema>,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') userId: string,
  ) {
    return this.service.confirm(p.id, userId, body.expectedVersion, key(rawKey), undefined, body.assigneeId)
  }

  @Post(['staff/rental-early-returns/:id/assign', 'admin/rental-early-returns/:id/assign'])
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Giao / đổi nhân viên giao nhận cho lịch trả sớm đã xác nhận (nhân viên kho / Admin)',
    description:
      'Chỉ khi yêu cầu đang CONFIRMED và task thu hồi chưa bắt đầu (SCHEDULED). Không đổi giờ hẹn, phí, cọc hay custody. ' +
      'Báo shipper mới, shipper cũ (nếu có) và khách. Lỗi 422 `RENTAL_ASSIGNEE_INVALID` (`NOT_ACTIVE_DELIVERY_STAFF`), ' +
      '409 `VERSION_CONFLICT` khi `expectedVersion` cũ.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedVersion', 'assigneeId'],
      properties: {
        expectedVersion: { type: 'integer', minimum: 1, example: 2 },
        assigneeId: { type: 'string', format: 'uuid', description: 'UUID nhân viên giao nhận (STAFF_DELIVERY)' },
      },
    },
  })
  assign(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) p: { id: string },
    @Body(new ZodValidationPipe(assignSchema)) body: z.infer<typeof assignSchema>,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') userId: string,
  ) {
    return this.service.assign(p.id, userId, body.expectedVersion, body.assigneeId, key(rawKey))
  }

  @Post(['staff/rental-early-returns/:id/reject', 'admin/rental-early-returns/:id/reject'])
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Từ chối lịch trả sớm kèm lý do (nhân viên kho / Admin)' })
  reject(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) p: { id: string },
    @Body(new ZodValidationPipe(rejectSchema)) body: z.infer<typeof rejectSchema>,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') userId: string,
  ) {
    return this.service.reject(p.id, userId, body.expectedVersion, body.reason, key(rawKey))
  }
}

function key(value: string | undefined) {
  const parsed = RentalReturnIdempotencyKeySchema.safeParse(value)
  if (!parsed.success) throw AppError.fromCode(RR.IDEMPOTENCY_KEY_REQUIRED)
  return parsed.data
}
