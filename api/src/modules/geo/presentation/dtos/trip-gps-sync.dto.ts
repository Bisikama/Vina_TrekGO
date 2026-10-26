import { z } from 'zod'
import { gpsSampleSchema } from './trip-gps.dto'
import {
  gpsContextResponseSchema,
  gpsSessionResponseSchema,
  gpsStateResponseSchema,
  gpsMemberSchema,
} from './trip-gps-response.schemas'

const uuid = z.uuid().toLowerCase()
const revision = z.number().int().positive().max(2147483647)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const syncParamsSchema = z.object({ tripId: uuid, sessionId: uuid })
export const syncDeviceSchema = z.string().trim().min(1).max(180)
export const syncCommandSchema = z
  .object({
    commandId: uuid,
    sequence: revision,
    action: z.enum(['PAUSE', 'RESUME', 'FINISH']),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict()
export const syncMetadataSchema = z
  .object({
    requestId: uuid,
    revision,
    baseMetadataRevision: z.number().int().nonnegative(),
    commands: z.array(syncCommandSchema).max(100),
    recordingStatus: z.enum(['ACTIVE', 'PAUSED', 'STOPPED']),
    endedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict()
export const syncBatchSchema = z
  .object({
    batchId: uuid,
    payloadHash: hash,
    metadataRevision: revision,
    snapshotRevision: revision,
    samples: z
      .array(gpsSampleSchema)
      .min(1)
      .max(200)
      .refine((s) => new Set(s.map((p) => p.clientSampleId)).size === s.length, 'Duplicate sample ID'),
  })
  .strict()
export const syncManifestSchema = z
  .object({
    manifestId: uuid,
    snapshotRevision: revision,
    pageIndex: z.number().int().min(0).max(99),
    pageCount: z.number().int().min(1).max(100),
    pageHash: hash,
    entries: z
      .array(z.object({ batchId: uuid, payloadHash: hash, sampleCount: z.number().int().min(1).max(200) }).strict())
      .min(1)
      .max(100),
  })
  .strict()
  .refine((p) => p.pageIndex < p.pageCount, 'Invalid page index')
export const syncCompleteSchema = z
  .object({
    completionId: uuid,
    snapshotRevision: revision,
    metadataRevision: revision,
    snapshotMaxSequence: z.number().int().nonnegative(),
    final: z.literal(true),
    expectedSampleCount: z.number().int().min(0).max(10000),
    manifestId: uuid,
    manifestHash: hash,
    endedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
export const syncStatusSchema = z
  .object({
    snapshotRevision: z.coerce.number().int().positive().optional(),
    cursor: z.coerce.number().int().nonnegative().default(0),
    limit: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict()
export const locationPublishSchema = z
  .object({
    requestId: uuid,
    tripId: uuid,
    sessionId: uuid,
    deviceId: syncDeviceSchema,
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    location: gpsSampleSchema,
  })
  .strict()
export type SyncMetadata = z.infer<typeof syncMetadataSchema>
export type SyncBatch = z.infer<typeof syncBatchSchema>
export type SyncManifest = z.infer<typeof syncManifestSchema>
export type SyncComplete = z.infer<typeof syncCompleteSchema>
export type LocationPublish = z.infer<typeof locationPublishSchema>

const time = z.iso.datetime({ offset: true })
export const syncMetadataResponseSchema = z
  .object({
    sessionId: uuid,
    metadataRevision: revision,
    acknowledgedCommandIds: z.array(uuid),
    recordingStatus: z.enum(['ACTIVE', 'PAUSED', 'STOPPED']),
    effectiveEndedAt: time.nullable(),
    uploadDeadline: time.nullable(),
    syncStatus: z.literal('RECEIVING'),
    serverTime: time,
  })
  .strict()
export const syncBatchResponseSchema = z
  .object({
    sessionId: uuid,
    batchId: uuid,
    snapshotRevision: revision,
    acceptedSampleIds: z.array(uuid),
    duplicateSampleIds: z.array(uuid),
    rejectedSamples: z.array(z.object({ clientSampleId: uuid, code: z.string() }).strict()),
    progress: z
      .object({ acceptedCount: z.number().int().nonnegative(), rejectedCount: z.number().int().nonnegative() })
      .strict(),
    serverTime: time,
  })
  .strict()
export const syncManifestResponseSchema = z
  .object({
    manifestId: uuid,
    pageIndex: z.number().int().nonnegative(),
    acknowledged: z.literal(true),
    serverTime: time,
  })
  .strict()
export const syncCompleteResponseSchema = z
  .object({
    sessionId: uuid,
    snapshotRevision: revision,
    syncStatus: z.literal('FINALIZE_PENDING'),
    processedSnapshotRevision: z.number().int().nonnegative(),
    statusUrl: z.string(),
    serverTime: time,
  })
  .strict()
export const syncStatusResponseSchema = z
  .object({
    sessionId: uuid,
    metadataRevision: z.number().int().nonnegative(),
    receivedSnapshotRevision: z.number().int().nonnegative(),
    processedSnapshotRevision: z.number().int().nonnegative(),
    syncStatus: z.enum(['OPEN', 'RECEIVING', 'FINALIZE_PENDING', 'PROCESSING', 'COMPLETE', 'NEEDS_ATTENTION']),
    acceptedCount: z.number().int().nonnegative(),
    rejectedCount: z.number().int().nonnegative(),
    missingBatchIds: z.array(uuid),
    nextCursor: z.number().int().nonnegative().nullable(),
    resultStatus: z.string().nullable(),
    actualRouteId: uuid.nullable(),
    lastError: z.object({ code: z.string(), retryable: z.boolean(), nextRetryAt: time }).strict().nullable(),
    attempts: z.number().int().nonnegative(),
    serverTime: time,
  })
  .strict()

export const gpsSyncLimitsSchema = z
  .object({
    maxBatchSamples: revision,
    maxBodyBytes: revision,
    maxCommandsPerRequest: revision,
    maxManifestEntriesPerPage: revision,
    maxSnapshotSamples: revision,
    publishMinIntervalSeconds: z.number().positive(),
    publishMinDistanceM: z.number().nonnegative(),
    publishMovingMaxIntervalSeconds: z.number().positive(),
    retryDelaysSeconds: z.array(z.number().positive()),
  })
  .strict()
export const gpsSessionV2ResponseSchema = gpsSessionResponseSchema.extend({
  protocolVersion: z.literal(2),
  limits: gpsSyncLimitsSchema,
})
export const gpsContextV2ResponseSchema = gpsContextResponseSchema.extend({
  permissions: gpsContextResponseSchema.shape.permissions.extend({
    canStartNewSession: z.boolean(),
    canContinueExistingSession: z.boolean(),
  }),
  capabilities: gpsSyncLimitsSchema.extend({
    supportedSyncProtocols: z.array(z.number().int()),
    socketPublishSupported: z.boolean(),
  }),
})
export const gpsStateV2ResponseSchema = gpsStateResponseSchema.extend({
  members: z.array(
    gpsMemberSchema.extend({
      connectionStatus: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']),
      presenceVersion: z.number().int().nonnegative(),
      locationVersion: z.number().int().nonnegative(),
      locationFreshness: z.enum(['NO_DATA', 'STALE', 'FRESH']),
    }),
  ),
})
