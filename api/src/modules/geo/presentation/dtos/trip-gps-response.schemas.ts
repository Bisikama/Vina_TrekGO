import { z } from 'zod'
const uuid = z.uuid(),
  time = z.iso.datetime({ offset: true }),
  number = z.number(),
  count = z.number().int().nonnegative()
const position = z.tuple([number, number])
export const gpsLineSchema = z.object({ type: z.literal('LineString'), coordinates: z.array(position).min(2) }).strict()
const geometry = gpsLineSchema.nullable()
export const gpsPolicyResponseSchema = z
  .object({
    id: uuid,
    versionNo: count,
    sampleIntervalSeconds: number,
    syncIntervalSeconds: number,
    maxBatchSamples: count,
    maxAcceptedAccuracyM: number,
    maxFutureSkewSeconds: number,
    liveLocationMaxAgeSeconds: number,
    staleAfterSeconds: number,
    offlineAfterSeconds: number,
    lateSyncGraceSeconds: number,
    deviationThresholdM: number,
    deviationConsecutiveSamples: count,
    recoveryThresholdM: number,
    recoveryConsecutiveSamples: count,
    signalGapSeconds: number,
    defaultCheckpointRadiusM: number,
    rawLocationRetentionDays: number,
  })
  .strict()
export const gpsSessionDtoSchema = z
  .object({
    id: uuid,
    tripId: uuid,
    userId: uuid,
    clientSessionId: uuid,
    deviceId: z.string(),
    recordingIntervals: z.array(z.object({ start: time, end: time.nullable() }).strict()).optional(),
    gpsPolicyId: uuid,
    status: z.enum(['ACTIVE', 'PAUSED', 'STOPPED']),
    version: count,
    startedAt: time,
    endedAt: time.nullable(),
    uploadDeadline: time.nullable(),
    sampleCount: count,
    totalDistanceMeters: number.nullable(),
  })
  .strict()
export const gpsSessionResponseSchema = z
  .object({ session: gpsSessionDtoSchema, policy: gpsPolicyResponseSchema })
  .strict()
export const gpsLocationSchema = z
  .object({
    latitude: number,
    longitude: number,
    accuracyM: number,
    altitudeM: number.nullable(),
    speedMps: number.nullable(),
    headingDeg: number.nullable(),
    recordedAt: time,
    receivedAt: time,
  })
  .strict()
export const gpsProgressSchema = z
  .object({
    applicable: z.boolean(),
    total: count,
    passed: count,
    percentage: number.nullable(),
    arrivedCheckpointIds: z.array(uuid),
    lastArrival: z.object({ checkpointId: uuid, arrivalAt: time, distanceToCheckpointM: number }).strict().nullable(),
  })
  .strict()
export const gpsMemberSchema = z
  .object({
    userId: uuid,
    fullName: z.string(),
    avatarUrl: z.string().nullable(),
    tripRole: z.enum(['HOST', 'LEADER', 'MEMBER']),
    memberVersion: count,
    session: gpsSessionDtoSchema
      .pick({ id: true, status: true, startedAt: true, endedAt: true, sampleCount: true, totalDistanceMeters: true })
      .nullable(),
    lastLocation: gpsLocationSchema.nullable(),
    locationStatus: z.enum(['NO_DATA', 'LIVE', 'STALE', 'OFFLINE', 'PAUSED', 'STOPPED']),
    lastSyncAt: time.nullable(),
    checkpointProgress: gpsProgressSchema,
    deviation: z
      .object({
        status: z.enum(['UNKNOWN', 'NORMAL', 'DEVIATED', 'NOT_APPLICABLE']),
        eventId: uuid.nullable(),
        distanceToRouteMeters: number.nullable(),
        checkedAt: time.nullable(),
      })
      .strict(),
  })
  .strict()
const tripStatus = z.enum([
  'DRAFT',
  'OPEN',
  'FULL',
  'CLOSED',
  'CANCEL_PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'INTERRUPTED',
])
export const gpsStateResponseSchema = z
  .object({
    tripId: uuid,
    tripStatus,
    routeVersion: count,
    rosterVersion: count,
    serverTime: time,
    selfUserId: uuid,
    members: z.array(gpsMemberSchema),
  })
  .strict()
export const gpsContextResponseSchema = z
  .object({
    contractVersion: z.literal('trip-gps/1.0.0'),
    tripId: uuid,
    tripType: z.enum(['PUBLIC', 'PRIVATE']),
    tripStatus,
    routeSource: z.enum(['PERSONAL', 'SYSTEM']),
    routeVersion: count,
    rosterVersion: count,
    routePlans: z.array(
      z
        .object({
          trailPlanId: uuid,
          source: z.enum(['PERSONAL', 'SYSTEM']),
          sourceTrailId: uuid,
          sequence: count,
          name: z.string(),
          geometry: z
            .union([
              gpsLineSchema,
              z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(position)) }).strict(),
            ])
            .nullable(),
        })
        .strict(),
    ),
    activeTrailPlanId: uuid.nullable(),
    checkpointMode: z.enum(['NONE', 'GEOFENCE_ONCE']),
    checkpoints: z.array(
      z
        .object({
          id: uuid,
          name: z.string(),
          sequence: count,
          latitude: number,
          longitude: number,
          radiusMeters: number,
          isRequired: z.boolean(),
        })
        .strict(),
    ),
    permissions: z
      .object({
        canViewGroupLocations: z.boolean(),
        canRecord: z.boolean(),
        cannotRecordReason: z.string().nullable(),
        canManageTrip: z.boolean(),
      })
      .strict(),
    policy: gpsPolicyResponseSchema,
    serverTime: time,
  })
  .strict()
export const gpsSamplesResponseSchema = z
  .object({
    sessionId: uuid,
    acceptedSampleIds: z.array(uuid),
    duplicateSampleIds: z.array(uuid),
    rejectedSamples: z.array(
      z
        .object({
          clientSampleId: uuid,
          code: z.enum([
            'LOW_ACCURACY',
            'OUTSIDE_ACTIVE_INTERVAL',
            'FUTURE_TIMESTAMP',
            'IMPLAUSIBLE_JUMP',
            'BEFORE_SESSION_START',
            'AFTER_SESSION_END',
            'SAMPLE_ID_CONFLICT',
          ]),
        })
        .strict(),
    ),
    sampleCount: count,
    totalDistanceMeters: number.nullable(),
    lastLocation: gpsLocationSchema.nullable(),
    memberVersion: count,
    routeRebuildPending: z.boolean(),
    serverTime: time,
  })
  .strict()
export const gpsFinishResponseSchema = z
  .object({
    session: gpsSessionDtoSchema,
    resultStatus: z.enum(['PROCESSING', 'READY', 'EMPTY', 'FAILED']),
    actualRouteId: uuid.nullable(),
  })
  .strict()
export const gpsLiveResponseSchema = z
  .object({
    tripId: uuid,
    userId: uuid,
    version: count,
    routeGeojson: geometry,
    pointCount: count,
    totalDistanceMeters: number.nullable(),
    serverTime: time,
  })
  .strict()
export const gpsActualResponseSchema = z
  .object({
    tripId: uuid,
    userId: uuid,
    actualRouteId: uuid.nullable(),
    resultStatus: z.enum(['NOT_STARTED', 'RECORDING', 'PROCESSING', 'READY', 'EMPTY', 'FAILED']),
    version: count,
    generatedAt: time.nullable(),
    routeGeojson: geometry,
    pointCount: count,
    distanceMethod: z.literal('SUM_CONSECUTIVE_VALID_POINTS'),
    totalDistanceMeters: number.nullable(),
    gapConnections: z.array(
      z
        .object({
          fromSampleId: uuid,
          toSampleId: uuid,
          fromCoordinateIndex: count,
          toCoordinateIndex: count,
          reason: z.enum(['PAUSE', 'SIGNAL_GAP', 'BETWEEN_SESSIONS']),
          durationSeconds: number,
          straightDistanceMeters: number,
        })
        .strict(),
    ),
    checkpointProgress: gpsProgressSchema,
    sourceSessionIds: z.array(uuid),
    startedAt: time.nullable(),
    movingDurationSeconds: z.number().int().nonnegative().nullable(),
    uploadDeadline: time.nullable(),
  })
  .strict()
