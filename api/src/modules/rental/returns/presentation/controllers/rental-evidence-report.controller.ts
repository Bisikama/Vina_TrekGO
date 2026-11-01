import { Controller, Headers, HttpCode, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { AuthType } from 'src/shared/constants/auth.constant'
import { UserRole } from 'src/shared/constants'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { AppError, RENTAL_RETURN_ERROR_CODES as E } from 'src/shared/errors'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { RentalReturnIdempotencyKeySchema } from '../dtos/rental-return.dto'
import { RentalEvidenceAccessService } from '../../infrastructure/integration/rental-evidence-access.service'

const paramsSchema = z.object({ id: z.string().uuid(), assessmentId: z.string().uuid() })
@ApiTags('Rental Returns')
@ApiBearerAuth('bearer')
@Controller('rental-orders')
@Auth([AuthType.Bearer])
export class RentalEvidenceReportController {
  constructor(private readonly access: RentalEvidenceAccessService) {}

  @Post(':id/assessments/:assessmentId/evidence-access-reports')
  @Roles(UserRole.USER, UserRole.LEADER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Báo không xem được chứng cứ của đánh giá thuê' })
  async report(@Param(new ZodValidationPipe(paramsSchema)) params: z.infer<typeof paramsSchema>,
    @Headers('idempotency-key') key: string | undefined, @ActiveUser('id') actorUserId: string) {
    const parsed = RentalReturnIdempotencyKeySchema.safeParse(key)
    if (!parsed.success) throw AppError.fromCode(E.IDEMPOTENCY_KEY_REQUIRED)
    return this.access.report({ orderId: params.id, assessmentId: params.assessmentId, actorUserId, idempotencyKey: parsed.data })
  }

  @Post(':id/assessments/:assessmentId/evidence-access-confirmations')
  @Roles(UserRole.USER, UserRole.LEADER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Khách xác nhận đã xem lại được chứng cứ' })
  async confirm(@Param(new ZodValidationPipe(paramsSchema)) params: z.infer<typeof paramsSchema>,
    @Headers('idempotency-key') key: string | undefined, @ActiveUser('id') actorUserId: string) {
    const parsed = RentalReturnIdempotencyKeySchema.safeParse(key)
    if (!parsed.success) throw AppError.fromCode(E.IDEMPOTENCY_KEY_REQUIRED)
    return this.access.acknowledge({ orderId: params.id, assessmentId: params.assessmentId, actorUserId, idempotencyKey: parsed.data })
  }
}
