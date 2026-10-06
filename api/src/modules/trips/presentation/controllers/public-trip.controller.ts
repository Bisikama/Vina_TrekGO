import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseFilters } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { Roles } from '../../../../shared/decorators/roles.decorator'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { UserRole } from '../../../../shared/constants/enum.constant'
import { PublicTripUseCase } from '../../application/use-cases/public-trip.use-case'
import type { Actor } from '../../application/trip.types'
import {
  cancelSchema,
  checkpointsSchema,
  conflictSchema,
  createSchema,
  pageSchema,
  parse,
  trailsSchema,
  updateSchema,
  versionSchema,
} from '../dtos/public-trip.dto'
import { TripErrorFilter } from '../trip-error.filter'

const id = (value: string) => parse(z.string().uuid(), value)
const bodyDoc = (schema: z.ZodType) => ApiBody({ schema: z.toJSONSchema(schema) as SchemaObject })
@ApiTags('CF01 Leader Public Trips')
@UseFilters(TripErrorFilter)
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.LEADER)
@Controller('leader/public-trips')
export class LeaderPublicTripController {
  constructor(private readonly trips: PublicTripUseCase) {}
  @Post()
  @ApiOperation({ summary: 'AAPI-PTR-01 Create draft' })
  @bodyDoc(createSchema)
  create(@ActiveUser() actor: Actor, @Body() body: unknown) {
    return this.trips.create(actor, parse(createSchema, body))
  }
  @Get()
  list(@ActiveUser() actor: Actor, @Query() query: unknown) {
    return this.trips.list(actor, parse(pageSchema, query))
  }
  @Get(':id')
  detail(@ActiveUser() actor: Actor, @Param('id') tripId: string) {
    return this.trips.detail(actor, id(tripId))
  }
  @Patch(':id')
  @bodyDoc(updateSchema)
  update(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Body() body: unknown) {
    const { expectedVersion, ...data } = parse(updateSchema, body)
    return this.trips.update(actor, id(tripId), expectedVersion, data)
  }
  @Put(':id/checkpoints')
  @bodyDoc(checkpointsSchema)
  checkpoints(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Body() body: unknown) {
    const data = parse(checkpointsSchema, body)
    return this.trips.setCheckpoints(actor, id(tripId), data.expectedVersion, data.checkpointIds)
  }
  @Put(':id/trails')
  @bodyDoc(trailsSchema)
  trails(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Body() body: unknown) {
    const data = parse(trailsSchema, body)
    return this.trips.setTrails(actor, id(tripId), data.expectedVersion, data.trailIds)
  }
  @Get(':id/trail-suggestions')
  suggestions(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Query() query: unknown) {
    return this.trips.suggestions(actor, id(tripId), parse(pageSchema, query))
  }
  @Get(':id/readiness')
  readiness(@ActiveUser() actor: Actor, @Param('id') tripId: string) {
    return this.trips.readiness(actor, id(tripId))
  }
  @Post(':id/publish')
  @bodyDoc(versionSchema)
  publish(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Body() body: unknown) {
    return this.trips.publish(actor, id(tripId), parse(versionSchema, body).expectedVersion)
  }
  @Post(':id/cancellation-requests')
  @bodyDoc(cancelSchema)
  cancel(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Body() body: unknown) {
    const d = parse(cancelSchema, body)
    return this.trips.cancel(actor, id(tripId), d.expectedVersion, d.reason, d.evidenceUrls)
  }
}
@ApiTags('CF01 Trip Options')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.LEADER)
@UseFilters(TripErrorFilter)
@Controller()
export class TripOptionsController {
  constructor(private readonly trips: PublicTripUseCase) {}
  @Get('leaders/me/schedule-conflicts')
  conflicts(@ActiveUser() actor: Actor, @Query() query: unknown) {
    const d = parse(conflictSchema, query)
    return this.trips.conflicts(actor, d.startAt, d.endAt, d.excludeTripId)
  }
  @Get('leader/trip-options/destinations')
  destinations(@ActiveUser() actor: Actor, @Query() query: unknown) {
    return this.trips.options(actor, 'destinations', parse(pageSchema, query))
  }
  @Get('leader/trip-options/pickup-points')
  @ApiQuery({
    name: 'destinationId',
    required: true,
    description: 'ID địa điểm lấy từ GET /api/v1/leader/trip-options/destinations',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  pickups(@ActiveUser() actor: Actor, @Query() query: unknown) {
    const p = parse(pageSchema, query)
    return this.trips.options(actor, 'pickups', p, p.destinationId)
  }
  @Get('leader/trip-options/checkpoints')
  checkpoints(@ActiveUser() actor: Actor, @Query() query: unknown) {
    const p = parse(pageSchema, query)
    return this.trips.options(actor, 'checkpoints', p, p.destinationId)
  }
  @Get('leader/trip-options/system-trails/:id')
  trail(@ActiveUser() actor: Actor, @Param('id') trailId: string) {
    return this.trips.trailDetail(actor, id(trailId))
  }
}
@ApiTags('Public Trips')
@Auth([AuthType.None])
@Controller('public-trips')
@UseFilters(TripErrorFilter)
export class PublicTripController {
  constructor(private readonly trips: PublicTripUseCase) {}
  @Get() list(@Query() query: unknown) {
    return this.trips.publicList(parse(pageSchema, query))
  }
  @Get(':id') detail(@Param('id') tripId: string) {
    return this.trips.publicDetail(id(tripId))
  }
}
