import { Body, Controller, Headers, HttpCode, Param, Post, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
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
  @Get(':id/cancellation-preview')
  @ApiOperation({ summary: 'Preview voluntary cancellation and related rental blockers' })
  preview(
    @Param('id', new ZodValidationPipe(z.string().uuid())) bookingId: string,
    @ActiveUser() actor: ActiveUserData,
  ) {
    if (!actor?.id) throw AppError.fromCode('UNAUTHENTICATED')
    return this.cancellations.preview(bookingId, actor.id)
  }

  @Post([':id/cancellations', ':id/cancel'])
  @HttpCode(202)
  @ApiOperation({ summary: 'Cancel booking and schedule eligible refund', description: 'Use cancellations; cancel is a compatibility alias. Owners may cancel before departure. Refund amount comes from the saved booking policy, not the request. HTTP 202 confirms cancellation, not refund completion. Workers create and process the refund asynchronously. Unpaid bookings or zero refundable amount do not create refunds.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Booking ID' })
  @ApiBody({ required: true, schema: { type: 'object', additionalProperties: false, required: ['reason'], properties: { reason: { type: 'string', minLength: 1, maxLength: 500, example: 'My travel plans changed' } } } })
  @ApiResponse({ status: 202, description: 'Cancellation accepted; refundableAmount is approved, not yet refunded', schema: { type: 'object', properties: { bookingId: { type: 'string', format: 'uuid' }, cancellationId: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['CANCELLED'] }, refundableAmount: { type: 'string', example: '10000' }, currency: { type: 'string', example: 'VND' } } } })
  @ApiResponse({ status: 400, description: 'Invalid reason, ID or idempotency key' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Not permitted to cancel this booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 409, description: 'Cancellation not allowed or idempotency payload conflict' })
  @ApiResponse({ status: 410, description: 'Booking hold expired' })
  @ApiResponse({ status: 422, description: 'Cancellation policy snapshot missing or invalid' })
  @ApiHeader({ name: 'idempotency-key', required: true, example: 'cf02-cancel-001' })
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
