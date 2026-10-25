import { ApiMemberInvitation } from '../private-member-invitation.swagger'
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
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { z } from 'zod'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { AppError, BOOKING_ERROR_CODES as B } from '../../../../shared/errors'
import { assertPrivateActor } from '../../application/use-cases/private-trip.use-case'
import type { Actor } from '../../application/trip.types'
import { PrivateMemberInvitationService } from '../../infrastructure/adapters/private-member-invitation.service'
import type { InvitationPage } from '../../infrastructure/adapters/private-member-invitation.service'
import type { CreatePrivateMemberInvitation } from '../dtos/private-member-invitation.dto'
import {
  createPrivateMemberInvitationSchema,
  privateMemberInvitationPageSchema,
  privateMemberInvitationActionSchema,
  declinePrivateMemberInvitationSchema,
  invitationIdempotencyKeySchema,
} from '../dtos/private-member-invitation.dto'

const bodyDoc = (schema: z.ZodType) => ApiBody({ schema: z.toJSONSchema(schema, { io: 'input' }) as SchemaObject, required: schema === createPrivateMemberInvitationSchema })
@ApiTags('Private member invitations')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller()
export class PrivateMemberInvitationController {
  constructor(private readonly invitations: PrivateMemberInvitationService) {}
  private async mutation<T>(res: Response, work: () => Promise<T>) {
    try {
      return await work()
    } catch (error) {
      if (error instanceof AppError && error.code === B.INVITE_RATE_LIMITED) {
        const retryAfter =
          typeof error.details === 'object' &&
          error.details !== null &&
          'retryAfterSeconds' in error.details &&
          typeof (error.details).retryAfterSeconds === 'number'
            ? String((error.details).retryAfterSeconds)
            : '60'
        res.setHeader('Retry-After', retryAfter)
      }
      throw error
    }
  }
  @Post('private-trips/:id/member-invitations')
  @ApiOperation({ summary: 'Host sends a direct invitation; no capacity is reserved' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', minLength: 1, maxLength: 200, pattern: '^[!-~]+$' } })
  @ApiMemberInvitation('create')
  @Header('Cache-Control', 'no-store')
  @bodyDoc(createPrivateMemberInvitationSchema)
  create(
    @ActiveUser() actor: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key: string,
    @Body(new ZodValidationPipe(createPrivateMemberInvitationSchema)) input: CreatePrivateMemberInvitation,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertPrivateActor(actor, true)
    new ZodValidationPipe(invitationIdempotencyKeySchema).transform(key, { type: 'custom' })
    return this.mutation(res, async () => {
      const result = await this.invitations.create(actor.id, id, key, input)
      res.setHeader('Idempotency-Replayed', String(result.replayed))
      return result.body
    })
  }
  @Get('private-trips/:id/member-invitations')
  @ApiMemberInvitation('page', true)
  @ApiOperation({ summary: 'Host invitation history with effective status' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED', 'INVALIDATED'],
  })
  @Header('Cache-Control', 'no-store')
  hostList(
    @ActiveUser() actor: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(privateMemberInvitationPageSchema)) page: InvitationPage,
  ) {
    assertPrivateActor(actor, true)
    return this.invitations.list(actor.id, page, id)
  }
  @Get('me/private-trip-member-invitations')
  @ApiMemberInvitation('page', false)
  @ApiOperation({ summary: 'Current recipient private invitations (M2 paginated inbox)' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED', 'INVALIDATED'],
  })
  @Header('Cache-Control', 'no-store')
  recipientList(
    @ActiveUser() actor: Actor,
    @Query(new ZodValidationPipe(privateMemberInvitationPageSchema)) page: InvitationPage,
  ) {
    assertPrivateActor(actor, true)
    return this.invitations.list(actor.id, page)
  }
  @Get('private-trip-member-invitations/:id')
  @ApiMemberInvitation('preview', true)
  @ApiOperation({ summary: 'Authorized minimal preview; does not grant room access' })
  @Header('Cache-Control', 'no-store')
  preview(@ActiveUser() actor: Actor, @Param('id', new ParseUUIDPipe()) id: string) {
    assertPrivateActor(actor, true)
    return this.invitations.preview(actor.id, id)
  }
  @Post('private-trip-member-invitations/:id/accept')
  @ApiMemberInvitation('accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept or replay invitation; navigate only when canEnterRoom is true' })
  @Header('Cache-Control', 'no-store')
  @bodyDoc(privateMemberInvitationActionSchema)
  accept(
    @ActiveUser() actor: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(privateMemberInvitationActionSchema)) _input: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertPrivateActor(actor, true)
    return this.mutation(res, () => this.invitations.accept(actor.id, id))
  }

  @Post('private-trip-member-invitations/:id/decline')
  @ApiMemberInvitation('change')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recipient declines; repeat is idempotent' })
  @Header('Cache-Control', 'no-store')
  @bodyDoc(declinePrivateMemberInvitationSchema)
  decline(
    @ActiveUser() actor: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(declinePrivateMemberInvitationSchema)) input: { reason?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    assertPrivateActor(actor, true)
    return this.mutation(res, () => this.invitations.change(actor.id, id, 'DECLINED', input.reason))
  }
  @Post('private-trip-member-invitations/:id/revoke')
  @ApiMemberInvitation('change')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sender with current host permission revokes; repeat is idempotent' })
  @Header('Cache-Control', 'no-store')
  @bodyDoc(privateMemberInvitationActionSchema)
  revoke(
    @ActiveUser() actor: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(privateMemberInvitationActionSchema)) _input: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertPrivateActor(actor, true)
    return this.mutation(res, () => this.invitations.change(actor.id, id, 'REVOKED'))
  }
}
