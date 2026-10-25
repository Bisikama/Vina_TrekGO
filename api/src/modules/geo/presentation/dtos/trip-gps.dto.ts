import { z } from 'zod'

export const gpsStartSchema = z
  .object({ clientSessionId: z.uuid().toLowerCase(), deviceId: z.string().trim().min(1).max(180) })
  .strict()
export const gpsControlSchema = z
  .object({
    commandId: z.uuid().toLowerCase(),
    expectedVersion: z.number().int().positive(),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict()
export const gpsFinishSchema = gpsControlSchema.extend({ reason: z.literal('USER_FINISHED') })
export const gpsSampleSchema = z
  .object({
    clientSampleId: z.uuid().toLowerCase(),
    recordedAt: z.iso.datetime({ offset: true }),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyM: z.number().nonnegative().max(99999),
    altitudeM: z.number().min(-999999).max(999999).nullish(),
    speedMps: z.number().nonnegative().max(99999).nullish(),
    headingDeg: z.number().min(0).lt(360).nullish(),
  })
  .strict()
export const gpsSamplesSchema = z
  .object({
    samples: z
      .array(gpsSampleSchema)
      .min(1)
      .max(10000)
      .refine(
        (samples) => new Set(samples.map((s) => s.clientSampleId)).size === samples.length,
        'Duplicate clientSampleId in batch',
      ),
  })
  .strict()
export const gpsSocketSchema = z.object({ requestId: z.uuid().toLowerCase(), tripId: z.uuid().toLowerCase() }).strict()
export type GpsStart = z.infer<typeof gpsStartSchema>
export type GpsControl = z.infer<typeof gpsControlSchema>
export type GpsSamples = z.infer<typeof gpsSamplesSchema>
