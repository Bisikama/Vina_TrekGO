import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
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

  @Get('admin/rental-early-returns')
  @Roles(UserRole.ADMIN)
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>) {
    return this.service.listForAdmin(query.status)
  }

  @Post('admin/rental-early-returns/:id/confirm')
  @Roles(UserRole.ADMIN)
  confirm(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) p: { id: string },
    @Body(new ZodValidationPipe(versionSchema)) body: z.infer<typeof versionSchema>,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') userId: string,
  ) {
    return this.service.confirm(p.id, userId, body.expectedVersion, key(rawKey))
  }

  @Post('admin/rental-early-returns/:id/reject')
  @Roles(UserRole.ADMIN)
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
