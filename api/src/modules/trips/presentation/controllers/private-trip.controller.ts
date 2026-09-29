import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { PrivateTripUseCase } from '../../application/use-cases/private-trip.use-case'
import type { Actor } from '../../application/trip.types'
import type { PrivateTripInput, PrivateTripUpdate } from '../../application/private-trip.port'
import {
  privateCreateSchema,
  privateUpdateSchema,
  privateInviteSchema,
  privateCancelSchema,
  privateVersionSchema,
  privatePageSchema,
  privatePickupSchema,
} from '../dtos/private-trip.dto'
const doc = (schema: z.ZodType) => ApiBody({ schema: z.toJSONSchema(schema) as SchemaObject })
@ApiTags('CF03 Private Trips')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller()
export class PrivateTripController {
  constructor(private readonly trips: PrivateTripUseCase) {}
  @Post('private-trips')
  @doc(privateCreateSchema)
  create(@ActiveUser() a: Actor, @Body(new ZodValidationPipe(privateCreateSchema)) input: PrivateTripInput) {
    return this.trips.create(a, input)
  }
  @Get('private-trips')
  list(@ActiveUser() a: Actor, @Query(new ZodValidationPipe(privatePageSchema)) q: { page: number }) {
    return this.trips.read(a, undefined, q.page)
  }
  @Get('private-trips/:id')
  detail(@ActiveUser() a: Actor, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.trips.read(a, id)
  }
  @Patch('private-trips/:id')
  @doc(privateUpdateSchema)
  update(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(privateUpdateSchema)) input: PrivateTripUpdate,
  ) {
    return this.trips.update(a, id, input)
  }
  @Post('private-trips/:id/invitations')
  @Header('Cache-Control', 'no-store')
  @doc(privateInviteSchema)
  invite(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(privateInviteSchema)) input: { expectedVersion: number; expiresAt?: string },
  ) {
    return this.trips.invite(a, id, input.expectedVersion, input.expiresAt)
  }
  @Post('private-trips/:id/invitations/revoke')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @doc(privateVersionSchema)
  revoke(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(privateVersionSchema)) input: { expectedVersion: number },
  ) {
    return this.trips.revoke(a, id, input.expectedVersion)
  }
  @Post('private-trips/:id/cancel')
  @doc(privateCancelSchema)
  cancel(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(privateCancelSchema)) input: { expectedVersion: number; reason?: string },
  ) {
    return this.trips.cancel(a, id, input.expectedVersion, input.reason)
  }
  @Get('me/personal-trails')
  personal(@ActiveUser() a: Actor, @Query(new ZodValidationPipe(privatePageSchema)) q: { page: number }) {
    return this.trips.options(a, 'PERSONAL', q.page)
  }
  @Get('me/trail-accesses')
  purchased(@ActiveUser() a: Actor, @Query(new ZodValidationPipe(privatePageSchema)) q: { page: number }) {
    return this.trips.options(a, 'SYSTEM', q.page)
  }
  @Get('private-trip-options/pickup-points')
  pickups(
    @ActiveUser() a: Actor,
    @Query(new ZodValidationPipe(privatePickupSchema)) q: { page: number; destinationId: string },
  ) {
    return this.trips.options(a, 'PICKUP', q.page, q.destinationId)
  }
  @Get('trails/:trailId/access')
  access(@ActiveUser() a: Actor, @Param('trailId', new ParseUUIDPipe()) id: string) {
    return this.trips.access(a, id)
  }
}
