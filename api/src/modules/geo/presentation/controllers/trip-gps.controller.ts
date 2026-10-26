import { Body, Controller, Get, Header, Headers, createParamDecorator, HttpCode, Param, Post, Res } from '@nestjs/common'
import type { Response } from 'express'
import { AppError, TRIP_GPS_ERROR_CODES as E } from '../../../../shared/errors'
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiHeader, ApiResponse, ApiParam } from '@nestjs/swagger'
import { z } from 'zod'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { TripGpsRecordingService } from '../../infrastructure/adapters/trip-gps-recording.service'
import { gpsContextV2ResponseSchema, gpsStateV2ResponseSchema, gpsSessionV2ResponseSchema } from '../dtos/trip-gps-sync.dto'
import { gpsControlSchema, gpsFinishSchema, gpsSamplesSchema, gpsStartSchema } from '../dtos/trip-gps.dto'
import type { GpsControl, GpsSamples, GpsStart } from '../dtos/trip-gps.dto'
import {
  gpsActualResponseSchema,
  gpsContextResponseSchema,
  gpsFinishResponseSchema,
  gpsLiveResponseSchema,
  gpsSamplesResponseSchema,
  gpsSessionResponseSchema,
  gpsStateResponseSchema,
} from '../dtos/trip-gps-response.schemas'
const schema = (value: z.ZodType) => z.toJSONSchema(value, { target: 'openapi-3.0' }) as any

const params = z.object({ tripId: z.uuid().toLowerCase(), sessionId: z.uuid().toLowerCase().optional() })
const device = z.string().trim().min(1).max(180)
const GpsDevice = createParamDecorator((_data, ctx) => ctx.switchToHttp().getRequest().headers['x-gps-device-id'])
type Params = z.infer<typeof params>

@ApiTags('Trip GPS recording')
@ApiParam({ name: 'tripId', format: 'uuid', required: true })
@ApiResponse({
  status: 403,
  description: 'Shared error/meta envelope; caller must be a valid trip member, participant or assigned leader',
})
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('geo/trips/:tripId/gps')
export class TripGpsController {
  constructor(private readonly recording: TripGpsRecordingService) {}

  @Get('context')
  @ApiHeader({ name: 'X-GPS-Protocol', required: false, description: 'trip-gps-sync/2 for v2 capabilities' })
  @ApiResponse({ status: 200, schema: schema(z.union([gpsContextResponseSchema, gpsContextV2ResponseSchema])) })
  @ApiOperation({
    summary: 'GPS context: route snapshots, checkpoints, frozen/effective policy and caller permissions',
  })
  context(@ActiveUser() user: { id: string }, @Param(new ZodValidationPipe(params)) p: Params,
    @Headers('x-gps-protocol') protocol?: string) {
    return protocol === 'trip-gps-sync/2' ? this.recording.context(p.tripId, user.id, true) : this.recording.context(p.tripId, user.id)
  }

  @Post('end-trip')
  @HttpCode(200)
  @ApiOperation({ summary: 'Leader/host ends trip and closes all GPS sessions (idempotent)' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      required: ['tripId', 'tripStatus', 'completedAt'],
      properties: {
        tripId: { type: 'string', format: 'uuid' },
        tripStatus: { type: 'string', enum: ['COMPLETED'] },
        completedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  endTrip(@ActiveUser() user: { id: string }, @Param(new ZodValidationPipe(params)) p: Params) {
    return this.recording.endTrip(p.tripId, user.id)
  }

  @Get('state')
  @Header('Cache-Control', 'private, no-store')
  @ApiHeader({ name: 'X-GPS-Protocol', required: false, description: 'trip-gps-sync/2 for connection and location versions' })
  @ApiResponse({ status: 200, schema: schema(z.union([gpsStateResponseSchema, gpsStateV2ResponseSchema])) })
  @ApiOperation({ summary: 'Consistent group GPS roster with durable member/roster/route versions' })
  state(@ActiveUser() user: { id: string }, @Param(new ZodValidationPipe(params)) p: Params,
    @Headers('x-gps-protocol') protocol?: string) {
    return protocol === 'trip-gps-sync/2' ? this.recording.stateSnapshot(p.tripId, user.id, true) : this.recording.stateSnapshot(p.tripId, user.id)
  }

  @Get('my-route')
  @ApiResponse({ status: 200, schema: schema(gpsLiveResponseSchema) })
  @ApiOperation({ summary: 'Restore own live route, simplified for display while preserving gap endpoints' })
  liveRoute(@ActiveUser() user: { id: string }, @Param(new ZodValidationPipe(params)) p: Params) {
    return this.recording.liveRoute(p.tripId, user.id)
  }

  @Post('sessions')
  @ApiBody({ schema: schema(gpsStartSchema) })
  @ApiResponse({ status: 200, schema: schema(z.union([gpsSessionResponseSchema, gpsSessionV2ResponseSchema])) })
  @HttpCode(200)
  @ApiOperation({ summary: 'Start own trip GPS recording (public/private)' })
  start(
    @ActiveUser() user: { id: string },
    @Param(new ZodValidationPipe(params)) p: Params,
    @Body(new ZodValidationPipe(gpsStartSchema)) body: GpsStart,
  ) {
    return this.recording.start(p.tripId, user.id, body)
  }

  @Get('sessions/:sessionId')
  @ApiParam({ name: 'sessionId', format: 'uuid', required: true })
  @ApiResponse({ status: 200, schema: schema(z.union([gpsSessionResponseSchema, gpsSessionV2ResponseSchema])) })
  session(@ActiveUser() user: { id: string }, @Param(new ZodValidationPipe(params)) p: Params) {
    return this.recording.getSession(p.tripId, user.id, p.sessionId!)
  }

  @Post('sessions/:sessionId/samples')
  @ApiParam({ name: 'sessionId', format: 'uuid', required: true })
  @ApiHeader({ name: 'X-GPS-Device-Id', required: true })
  @ApiBody({ schema: schema(gpsSamplesSchema) })
  @ApiResponse({ status: 200, schema: schema(gpsSamplesResponseSchema) })
  @HttpCode(200)
  async upload(
    @ActiveUser() user: { id: string },
    @Param(new ZodValidationPipe(params)) p: Params,
    @GpsDevice(new ZodValidationPipe(device)) deviceId: string,
    @Body(new ZodValidationPipe(gpsSamplesSchema)) body: GpsSamples,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      return await this.recording.upload(p.tripId, user.id, p.sessionId!, deviceId, body)
    } catch (error) {
      if (error instanceof AppError && error.code === E.RATE_LIMITED)
        response.setHeader('Retry-After', Number(error.details?.retryAfterSeconds ?? 60))
      throw error
    }
  }

  @Post('sessions/:sessionId/pause')
  @ApiParam({ name: 'sessionId', format: 'uuid', required: true })
  @ApiHeader({ name: 'X-GPS-Device-Id', required: true })
  @ApiBody({ schema: schema(gpsControlSchema) })
  @ApiResponse({ status: 200, schema: schema(gpsSessionResponseSchema) })
  @HttpCode(200)
  pause(
    @ActiveUser() user: { id: string },
    @Param(new ZodValidationPipe(params)) p: Params,
    @GpsDevice(new ZodValidationPipe(device)) deviceId: string,
    @Body(new ZodValidationPipe(gpsControlSchema)) body: GpsControl,
  ) {
    return this.recording.control(p.tripId, user.id, p.sessionId!, deviceId, 'pause', body)
  }

  @Post('sessions/:sessionId/resume')
  @ApiParam({ name: 'sessionId', format: 'uuid', required: true })
  @ApiHeader({ name: 'X-GPS-Device-Id', required: true })
  @ApiBody({ schema: schema(gpsControlSchema) })
  @ApiResponse({ status: 200, schema: schema(gpsSessionResponseSchema) })
  @HttpCode(200)
  resume(
    @ActiveUser() user: { id: string },
    @Param(new ZodValidationPipe(params)) p: Params,
    @GpsDevice(new ZodValidationPipe(device)) deviceId: string,
    @Body(new ZodValidationPipe(gpsControlSchema)) body: GpsControl,
  ) {
    return this.recording.control(p.tripId, user.id, p.sessionId!, deviceId, 'resume', body)
  }

  @Post('sessions/:sessionId/finish')
  @ApiParam({ name: 'sessionId', format: 'uuid', required: true })
  @ApiHeader({ name: 'X-GPS-Device-Id', required: true })
  @ApiBody({ schema: schema(gpsFinishSchema) })
  @ApiResponse({ status: 200, schema: schema(gpsFinishResponseSchema) })
  @HttpCode(200)
  finish(
    @ActiveUser() user: { id: string },
    @Param(new ZodValidationPipe(params)) p: Params,
    @GpsDevice(new ZodValidationPipe(device)) deviceId: string,
    @Body(new ZodValidationPipe(gpsFinishSchema)) body: GpsControl,
  ) {
    return this.recording.control(p.tripId, user.id, p.sessionId!, deviceId, 'finish', body)
  }

  @Get('actual-routes/me')
  @ApiResponse({ status: 200, schema: schema(gpsActualResponseSchema) })
  @ApiOperation({ summary: 'Read own persisted trip route history' })
  result(@ActiveUser() user: { id: string }, @Param(new ZodValidationPipe(params)) p: Params) {
    return this.recording.result(p.tripId, user.id)
  }
}
