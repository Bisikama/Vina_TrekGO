import type { PublicInvitationCreate, PublicInvitationPage } from './public-invitations.dto'
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import type { Response } from 'express'
import { z } from 'zod'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { AppError, BOOKING_ERROR_CODES as B, COMMON_ERROR_CODES as C } from '../../shared/errors'
import { PublicInvitationsService } from './public-invitations.service'
import {
  publicInvitationCreateSchema,
  publicInvitationDeclineSchema,
  publicInvitationKeySchema,
  publicInvitationPageSchema,
  publicInvitationRevokeSchema,
} from './public-invitations.dto'
import { selfClaimSchema } from './tickets.controller'
import { ApiPublicInvitation } from './public-invitations.swagger'

const bodyDoc = (schema: z.ZodType) =>
  ApiBody({ required: true, schema: z.toJSONSchema(schema, { io: 'input' }) as SchemaObject })
const actorId = (actor?: { id: string }) => {
  if (!actor?.id) throw AppError.fromCode(C.UNAUTHENTICATED)
  return actor.id
}
@ApiTags('Public participant invitations')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller()
export class PublicInvitationsController {
  constructor(private readonly invitations: PublicInvitationsService) {}
  private async mutation<T>(res: Response, work: () => Promise<T>) {
    try {
      return await work()
    } catch (error) {
      if (error instanceof AppError && error.code === B.INVITE_RATE_LIMITED)
        res.setHeader('Retry-After', String((error.details as Record<string, any>)?.retryAfterSeconds ?? 60))
      throw error
    }
  }
  @Post('bookings/:id/participants/:pid/invitations')
  @ApiOperation({
    summary: 'Buyer invites an existing ACTIVE USER or LEADER to claim a paid participant',
    description:
      'Expiry is clamped to requested time, DB now + TTL (default 7 days), and startAt minus one second. Create replay returns the original snapshot: refetch preview for current state.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'pid', format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 200, pattern: '^[!-~]+$' },
  })
  @ApiPublicInvitation('create')
  @Header('Cache-Control', 'no-store')
  @bodyDoc(publicInvitationCreateSchema)
  create(
    @ActiveUser() actor: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('pid', new ParseUUIDPipe()) pid: string,
    @Headers('idempotency-key') key: string,
    @Body(new ZodValidationPipe(publicInvitationCreateSchema)) body: PublicInvitationCreate,
    @Res({ passthrough: true }) res: Response,
  ) {
    new ZodValidationPipe(publicInvitationKeySchema).transform(key, { type: 'custom' })
    return this.mutation(res, async () => {
      const result = await this.invitations.create(actorId(actor), id, pid, key, body)
      res.setHeader('Idempotency-Replayed', String(result.replayed))
      return result.body
    })
  }
  @Get('me/booking-participant-invitations')
  @ApiOperation({ summary: 'Recipient invitation history, filtered by effective status before pagination' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED', 'INVALIDATED'],
  })
  @ApiPublicInvitation('list')
  @Header('Cache-Control', 'no-store')
  list(
    @ActiveUser() actor: { id: string },
    @Query(new ZodValidationPipe(publicInvitationPageSchema)) page: PublicInvitationPage,
  ) {
    return this.invitations.list(actorId(actor), page)
  }
  @Get('booking-participant-invitations/:id')
  @ApiOperation({ summary: 'Minimal preview for recipient or current buyer; no payment, contact or QR' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiPublicInvitation('preview')
  @Header('Cache-Control', 'no-store')
  preview(@ActiveUser() actor: { id: string }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.invitations.preview(actorId(actor), id)
  }
  @Post('booking-participant-invitations/:id/accept')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Claim the declared participant; confirmation is required; replay never restores lost access',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiPublicInvitation('action')
  @Header('Cache-Control', 'no-store')
  @bodyDoc(selfClaimSchema)
  accept(
    @ActiveUser() actor: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(selfClaimSchema)) _body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.mutation(res, () => this.invitations.change(actorId(actor), id, 'ACCEPTED'))
  }
  @Post('booking-participant-invitations/:id/decline')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recipient declines, including IDENTITY_MISMATCH; does not cancel booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiPublicInvitation('action')
  @Header('Cache-Control', 'no-store')
  @bodyDoc(publicInvitationDeclineSchema)
  decline(
    @ActiveUser() actor: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(publicInvitationDeclineSchema)) body: { reason?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.mutation(res, () => this.invitations.change(actorId(actor), id, 'DECLINED', body.reason))
  }
  @Post('booking-participant-invitations/:id/revoke')
  @HttpCode(200)
  @ApiOperation({ summary: 'Buyer revokes pending invitation; accepted tickets cannot be transferred' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiPublicInvitation('action')
  @Header('Cache-Control', 'no-store')
  @bodyDoc(publicInvitationRevokeSchema)
  revoke(
    @ActiveUser() actor: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(publicInvitationRevokeSchema)) _body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.mutation(res, () => this.invitations.change(actorId(actor), id, 'REVOKED'))
  }
}
