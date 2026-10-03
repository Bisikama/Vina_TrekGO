import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { PrivateInviteRateGuard } from '../private-invite-rate.guard'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { PrivateMembershipUseCase } from '../../application/use-cases/private-membership.use-case'
import type { Actor } from '../../application/trip.types'
import type { MemberPage } from '../../application/private-membership.port'
import {
  inviteCodeSchema,
  joinPrivateSchema,
  memberVersionSchema,
  removeMemberQuerySchema,
  memberPageSchema,
} from '../dtos/private-membership.dto'
const doc = (s: z.ZodType) => ApiBody({ schema: z.toJSONSchema(s) as SchemaObject })
@ApiTags('CF04 Private Trip Membership')
@Controller()
export class PrivateMembershipController {
  constructor(private readonly trips: PrivateMembershipUseCase) {}
  @Get('private-trip-invitations/:code')
  @UseGuards(PrivateInviteRateGuard)
  @Auth([AuthType.None])
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @ApiOperation({ summary: 'Public minimal invite preview; never creates membership' })
  preview(@Param('code', new ZodValidationPipe(inviteCodeSchema)) code: string) {
    return this.trips.preview(code)
  }

  @Post('private-trip-invitations/:code/join')
  @UseGuards(PrivateInviteRateGuard)
  @HttpCode(200)
  @Auth([AuthType.Bearer])
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: { type: 'object', additionalProperties: false }, required: false })
  @ApiOperation({ summary: 'Join/rejoin or return existing membership idempotently' })
  join(
    @ActiveUser() a: Actor,
    @Param('code', new ZodValidationPipe(inviteCodeSchema)) code: string,
    @Body(new ZodValidationPipe(joinPrivateSchema)) _body: unknown,
  ) {
    return this.trips.join(a, code)
  }

  @Get('private-trips/:id/room')
  @Auth([AuthType.Bearer])
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', 'no-store')
  room(@ActiveUser() a: Actor, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.trips.room(a, id)
  }

  @Get('private-trips/:id/members')
  @Auth([AuthType.Bearer])
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'LEFT', 'REMOVED', 'COMPLETED', 'NO_SHOW', 'ALL'] })
  members(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(memberPageSchema)) q: MemberPage,
  ) {
    return this.trips.members(a, id, q)
  }

  @Post('private-trips/:id/leave')
  @HttpCode(200)
  @Auth([AuthType.Bearer])
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', 'no-store')
  @doc(memberVersionSchema)
  leave(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(memberVersionSchema)) b: { expectedMemberVersion: number },
  ) {
    return this.trips.leave(a, id, b.expectedMemberVersion)
  }

  @Delete('private-trips/:id/members/:memberId')
  @HttpCode(200)
  @Auth([AuthType.Bearer])
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'expectedMemberVersion', required: true, type: Number })
  remove(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Query(new ZodValidationPipe(removeMemberQuerySchema)) q: { expectedMemberVersion: number },
  ) {
    return this.trips.remove(a, id, memberId, q.expectedMemberVersion)
  }
}
