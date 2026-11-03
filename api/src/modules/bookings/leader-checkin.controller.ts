import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { UserRole } from '@prisma/client'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { AppError, COMMON_ERROR_CODES as C } from '../../shared/errors'
import {
  leaderCheckinBodySchema,
  leaderParticipantsQuerySchema,
  manualParticipantCheckinBodySchema,
  type LeaderCheckinInput,
  type LeaderParticipantsQuery,
  type ManualParticipantCheckinInput,
} from './leader-checkin.dto'
import { LeaderCheckinService } from './leader-checkin.service'
import { ApiLeaderCheckin } from './leader-checkin.swagger'

const actorId = (actor?: { id: string }) => {
  if (!actor?.id) throw AppError.fromCode(C.UNAUTHENTICATED)
  return actor.id
}

@ApiTags('Leader Public Trip Check-in')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.LEADER)
@Controller()
export class LeaderCheckinController {
  constructor(private readonly checkinService: LeaderCheckinService) {}

  @Get(['leader/public-trips/:id/participants', 'leader/trips/:id/participants'])
  @ApiLeaderCheckin('list')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List confirmed public trip participants and attendance summary for trip leader',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Public trip ID' })
  @ApiQuery({
    name: 'checkinStatus',
    required: false,
    enum: ['NOT_CHECKED_IN', 'CHECKED_IN', 'NO_SHOW'],
  })
  @ApiQuery({
    name: 'search',
    required: false,
    schema: { type: 'string', maxLength: 150 },
  })
  listParticipants(
    @ActiveUser() actor: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(leaderParticipantsQuerySchema)) query: LeaderParticipantsQuery,
  ) {
    return this.checkinService.listParticipants(actorId(actor), id, query)
  }

  @Post([
    'leader/public-trips/:id/checkin',
    'leader/trips/:id/checkin',
    'leader/public-trips/:id/check-in',
    'leader/trips/:id/check-in',
  ])
  @ApiLeaderCheckin('checkin')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Leader checks in a participant via QR checkinCode or manual participantId (idempotent)',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Public trip ID' })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          required: ['checkinCode'],
          additionalProperties: false,
          properties: {
            checkinCode: { type: 'string', minLength: 1 },
            method: { type: 'string', enum: ['QR'], default: 'QR' },
          },
        },
        {
          type: 'object',
          required: ['participantId'],
          additionalProperties: false,
          properties: {
            participantId: { type: 'string', format: 'uuid' },
            method: { type: 'string', enum: ['MANUAL'], default: 'MANUAL' },
            checkinStatus: { type: 'string', enum: ['CHECKED_IN', 'NO_SHOW', 'NOT_CHECKED_IN'], default: 'CHECKED_IN' },
          },
        },
      ],
    },
  })
  checkin(
    @ActiveUser() actor: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(leaderCheckinBodySchema)) body: LeaderCheckinInput,
  ) {
    return this.checkinService.checkin(actorId(actor), id, body)
  }

  @Post([
    'leader/public-trips/:id/participants/:participantId/checkin',
    'leader/trips/:id/participants/:participantId/checkin',
    'leader/public-trips/:id/participants/:participantId/check-in',
    'leader/trips/:id/participants/:participantId/check-in',
  ])
  @ApiLeaderCheckin('checkin')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Leader checks in or marks NO_SHOW for a specific participant manually (idempotent)',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Public trip ID' })
  @ApiParam({ name: 'participantId', format: 'uuid', description: 'Booking participant ID' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        checkinStatus: { type: 'string', enum: ['CHECKED_IN', 'NO_SHOW', 'NOT_CHECKED_IN'], default: 'CHECKED_IN' },
      },
    },
  })
  manualParticipantCheckin(
    @ActiveUser() actor: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('participantId', new ParseUUIDPipe()) participantId: string,
    @Body(new ZodValidationPipe(manualParticipantCheckinBodySchema)) body: ManualParticipantCheckinInput,
  ) {
    return this.checkinService.checkin(actorId(actor), id, {
      participantId,
      method: 'MANUAL',
      checkinStatus: body.checkinStatus,
    })
  }
}
