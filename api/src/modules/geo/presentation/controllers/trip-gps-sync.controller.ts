import { Body, Controller, Get, createParamDecorator, HttpCode, Param, Post, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiTags,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger'
import { z } from 'zod'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { GpsSyncService } from '../../application/gps-sync.service'
import {
  syncParamsSchema,
  syncDeviceSchema,
  syncMetadataSchema,
  syncBatchSchema,
  syncManifestSchema,
  syncCompleteSchema,
  syncStatusSchema,
  syncMetadataResponseSchema,
  syncBatchResponseSchema,
  syncManifestResponseSchema,
  syncCompleteResponseSchema,
  syncStatusResponseSchema,
} from '../dtos/trip-gps-sync.dto'
import type { SyncMetadata, SyncBatch, SyncManifest, SyncComplete } from '../dtos/trip-gps-sync.dto'

const Device = createParamDecorator((_data, ctx) => ctx.switchToHttp().getRequest().headers['x-gps-device-id'])
const schema = (value: z.ZodType) => z.toJSONSchema(value, { target: 'openapi-3.0' }) as any
type Params = { tripId: string; sessionId: string }
@ApiTags('Trip GPS sync v2')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'X-GPS-Device-Id', required: true, description: 'Installation ID owning this v2 session' })
@ApiParam({ name: 'tripId', format: 'uuid', required: true })
@ApiParam({ name: 'sessionId', format: 'uuid', required: true })
@ApiResponse({
  status: 409,
  description: 'Shared error/meta: protocol, revision, idempotency conflict or incomplete manifest',
})
@ApiResponse({
  status: 503,
  description: 'Shared error/meta: GPS_SYNC_UNAVAILABLE, replay same immutable ID after backoff',
})
@Auth([AuthType.Bearer])
@Controller('geo/trips/:tripId/gps/sessions/:sessionId/sync')
export class TripGpsSyncController {
  constructor(private readonly sync: GpsSyncService) {}
  @Post('metadata')
  @HttpCode(200)
  @ApiOperation({ summary: 'V2: replay durable local pause/resume/finish timeline; does not rebuild history' })
  @ApiBody({ schema: schema(syncMetadataSchema) })
  @ApiResponse({
    schema: schema(syncMetadataResponseSchema),
    status: 200,
    description:
      'metadataRevision, acknowledgedCommandIds, recordingStatus, effectiveEndedAt, uploadDeadline, syncStatus, serverTime',
  })
  metadata(
    @ActiveUser() u: { id: string },
    @Param(new ZodValidationPipe(syncParamsSchema)) p: Params,
    @Device(new ZodValidationPipe(syncDeviceSchema)) device: string,
    @Body(new ZodValidationPipe(syncMetadataSchema)) body: SyncMetadata,
  ) {
    return this.sync.metadata(p.tripId, u.id, p.sessionId, device, body)
  }
  @Post('batches')
  @HttpCode(200)
  @ApiOperation({ summary: 'V2: upload up to 200 historical samples after session STOPPED; SHA-256 canonical JSON samples hash' })
  @ApiBody({ schema: schema(syncBatchSchema) })
  @ApiResponse({
    schema: schema(syncBatchResponseSchema),
    status: 200,
    description:
      'batchId, snapshotRevision, acceptedSampleIds, duplicateSampleIds, rejectedSamples, progress, serverTime; replay returns original ACK',
  })
  batches(
    @ActiveUser() u: { id: string },
    @Param(new ZodValidationPipe(syncParamsSchema)) p: Params,
    @Device(new ZodValidationPipe(syncDeviceSchema)) device: string,
    @Body(new ZodValidationPipe(syncBatchSchema)) body: SyncBatch,
  ) {
    return this.sync.batches(p.tripId, u.id, p.sessionId, device, body)
  }
  @Post('manifests/pages')
  @HttpCode(200)
  @ApiOperation({ summary: 'V2: register immutable manifest page after STOPPED; SHA-256 canonical JSON entries' })
  @ApiBody({ schema: schema(syncManifestSchema) })
  @ApiResponse({
    schema: schema(syncManifestResponseSchema),
    status: 200,
    description: 'manifestId, pageIndex, acknowledged, serverTime',
  })
  manifest(
    @ActiveUser() u: { id: string },
    @Param(new ZodValidationPipe(syncParamsSchema)) p: Params,
    @Device(new ZodValidationPipe(syncDeviceSchema)) device: string,
    @Body(new ZodValidationPipe(syncManifestSchema)) body: SyncManifest,
  ) {
    return this.sync.manifest(p.tripId, u.id, p.sessionId, device, body)
  }
  @Post('complete')
  @HttpCode(202)
  @ApiOperation({ summary: 'V2: finalize STOPPED session only (final=true and endedAt required)' })
  @ApiBody({ schema: schema(syncCompleteSchema) })
  @ApiResponse({
    schema: schema(syncCompleteResponseSchema),
    status: 202,
    description:
      'sessionId, snapshotRevision, syncStatus, processedSnapshotRevision, statusUrl, serverTime; poll status even after replay',
  })
  complete(
    @ActiveUser() u: { id: string },
    @Param(new ZodValidationPipe(syncParamsSchema)) p: Params,
    @Device(new ZodValidationPipe(syncDeviceSchema)) device: string,
    @Body(new ZodValidationPipe(syncCompleteSchema)) body: SyncComplete,
  ) {
    return this.sync.complete(p.tripId, u.id, p.sessionId, device, body)
  }
  @Get('status')
  @ApiOperation({ summary: 'V2: sync revisions, counts, missing batch IDs and processor retry status' })
  @ApiQuery({ name: 'snapshotRevision', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    schema: schema(syncStatusResponseSchema),
    status: 200,
    description:
      'metadataRevision, receivedSnapshotRevision, processedSnapshotRevision, syncStatus, acceptedCount, rejectedCount, missingBatchIds, nextCursor, resultStatus, actualRouteId, lastError, attempts, serverTime',
  })
  status(
    @ActiveUser() u: { id: string },
    @Param(new ZodValidationPipe(syncParamsSchema)) p: Params,
    @Device(new ZodValidationPipe(syncDeviceSchema)) device: string,
    @Query(new ZodValidationPipe(syncStatusSchema)) query: { snapshotRevision?: number; cursor: number; limit: number },
  ) {
    return this.sync.status(p.tripId, u.id, p.sessionId, device, query)
  }
}
