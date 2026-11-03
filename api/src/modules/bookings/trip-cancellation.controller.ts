import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { Roles } from '../../shared/decorators/roles.decorator'
import { UserRole } from '@prisma/client'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import type { ActiveUserData } from '../../shared/types/user.type'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { TripCancellationService, type CancellationReview } from './trip-cancellation.service'
const idPipe = () => new ZodValidationPipe(z.string().uuid())
const listPipe = new ZodValidationPipe(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  }),
)
const reviewSchema = z
  .object({
    expectedTripVersion: z.number().int().positive(),
    expectedRequestVersion: z.number().int().positive(),
    note: z.string().trim().max(500).default(''),
  })
  .strict()
const keyPipe = new ZodValidationPipe(
  z
    .string()
    .min(1)
    .max(200)
    .regex(/^[\x21-\x7e]+$/),
)
@ApiTags('Trip cancellation requests')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.ADMIN)
@Controller('admin/trip-cancellation-requests')
export class AdminTripCancellationController {
  constructor(private readonly service: TripCancellationService) {}
  @Get()
  list(@ActiveUser() actor: ActiveUserData, @Query(listPipe) q: { page: number; pageSize: number; status?: string }) {
    return this.service.list(actor, q.page, q.pageSize, q.status)
  }
  @Get(':id')
  detail(@ActiveUser() actor: ActiveUserData, @Param('id', idPipe()) id: string) {
    return this.service.detail(actor, id)
  }
  @Post(':id/approve')
  @HttpCode(202)
  approve(
    @ActiveUser() actor: ActiveUserData,
    @Param('id', idPipe()) id: string,
    @Body(new ZodValidationPipe(reviewSchema)) body: CancellationReview,
    @Headers('idempotency-key') key: string,
  ) {
    keyPipe.transform(key, { type: 'custom' })
    return this.service.review(actor, id, 'APPROVED', body, key)
  }
  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @ActiveUser() actor: ActiveUserData,
    @Param('id', idPipe()) id: string,
    @Body(new ZodValidationPipe(reviewSchema.extend({ note: z.string().trim().min(1).max(500) })))
    body: CancellationReview,
    @Headers('idempotency-key') key: string,
  ) {
    keyPipe.transform(key, { type: 'custom' })
    return this.service.review(actor, id, 'REJECTED', body, key)
  }
  @Post('deliveries/:eventId/retry')
  @HttpCode(202)
  retry(
    @ActiveUser() actor: ActiveUserData,
    @Param('eventId', idPipe()) eventId: string,
    @Body(
      new ZodValidationPipe(
        z
          .object({
            consumer: z.enum(['trip-bookings-v1', 'rental-lifecycle-v1']),
            note: z.string().trim().min(1).max(500),
          })
          .strict(),
      ),
    )
    body: { consumer: string; note: string },
  ) {
    return this.service.retry(actor, eventId, body.consumer, body.note)
  }
}
@ApiTags('Trip cancellation requests')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.LEADER)
@Controller('leader/trip-cancellation-requests')
export class LeaderTripCancellationController {
  constructor(private readonly service: TripCancellationService) {}
  @Get()
  list(@ActiveUser() actor: ActiveUserData, @Query(listPipe) q: { page: number; pageSize: number; status?: string }) {
    return this.service.list(actor, q.page, q.pageSize, q.status)
  }
  @Get(':id')
  detail(@ActiveUser() actor: ActiveUserData, @Param('id', idPipe()) id: string) {
    return this.service.detail(actor, id)
  }
}
