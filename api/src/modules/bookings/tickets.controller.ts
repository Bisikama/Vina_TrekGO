import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { AppError, COMMON_ERROR_CODES as C } from '../../shared/errors'
import { ParticipantClaimService } from './participant-claim.service'
import { TicketsService } from './tickets.service'
import { ApiTicket } from './tickets.swagger'

export const selfClaimSchema = z.object({ confirmParticipantIdentity: z.literal(true) }).strict()
export const ticketPageSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
const actorId = (actor?: { id: string }) => {
  if (!actor?.id) throw AppError.fromCode(C.UNAUTHENTICATED)
  return actor.id
}
@ApiTags('Public personal tickets')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller()
export class TicketsController {
  constructor(
    private readonly claims: ParticipantClaimService,
    private readonly tickets: TicketsService,
  ) {}
  @Post('bookings/:id/participants/:pid/self-claim')
  @ApiTicket('claim')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Buyer links their own participant after payment; replay never rotates QR again' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'pid', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['confirmParticipantIdentity'],
      additionalProperties: false,
      properties: { confirmParticipantIdentity: { type: 'boolean', enum: [true] } },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'ticketId, tripId, alreadyClaimed, participantStatus, bookingVersion, currentAccess. No QR, invoice or payment data.',
  })
  @ApiResponse({
    status: 409,
    description:
      'PARTICIPANT_ALREADY_LINKED / TRIP_PARTICIPATION_EXISTS / PENDING_INVITATION_EXISTS / PARTICIPANT_CLAIM_NOT_ALLOWED',
  })
  claim(
    @ActiveUser() actor: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('pid', new ParseUUIDPipe()) pid: string,
    @Body(new ZodValidationPipe(selfClaimSchema)) _body: unknown,
  ) {
    return this.claims.selfClaim(actorId(actor), id, pid)
  }
  @Get('me/tickets')
  @ApiTicket('list')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List tickets linked to current USER/LEADER account, including history' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } })
  list(
    @ActiveUser() actor: { id: string },
    @Query(new ZodValidationPipe(ticketPageSchema)) q: { page: number; pageSize: number },
  ) {
    return this.tickets.list(actorId(actor), q.page, q.pageSize)
  }
  @Get('me/tickets/:participantId')
  @ApiTicket('ticket')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'participantId', format: 'uuid' })
  @ApiOperation({ summary: 'Minimal personal ticket; history does not grant operational capabilities' })
  detail(@ActiveUser() actor: { id: string }, @Param('participantId', new ParseUUIDPipe()) id: string) {
    return this.tickets.detail(actorId(actor), id)
  }
}
