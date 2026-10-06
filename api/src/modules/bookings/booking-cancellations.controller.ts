import { Body, Controller, Headers, HttpCode, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { AppError } from '../../shared/errors'
import type { ActiveUserData } from '../../shared/types/user.type'
import { BookingCancellationService } from './booking-cancellation.service'

@Controller('bookings')
@ApiTags('Bookings')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
export class BookingCancellationsController {
  constructor(private readonly cancellations: BookingCancellationService) {}
  @Post(':id/cancellations')
  @HttpCode(202)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  cancel(
    @Param('id', new ZodValidationPipe(z.string().uuid())) bookingId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body(new ZodValidationPipe(z.object({ reason: z.string().trim().min(1).max(500) }).strict()))
    body: { reason: string },
    @ActiveUser() actor: ActiveUserData,
  ) {
    if (!actor?.id) throw AppError.fromCode('UNAUTHENTICATED')
    new ZodValidationPipe(
      z
        .string()
        .min(1)
        .max(200)
        .regex(/^[\x21-\x7e]+$/),
    ).transform(idempotencyKey, { type: 'custom' })
    return this.cancellations.cancel({
      bookingId,
      actorId: actor.id,
      actorRole: actor.role,
      idempotencyKey,
      reason: body.reason,
    })
  }
}
