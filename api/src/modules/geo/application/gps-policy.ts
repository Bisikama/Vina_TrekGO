import { GpsPolicy } from '@prisma/client'
import { AppError, TRIP_GPS_ERROR_CODES as E } from '../../../shared/errors'
import type { GpsPolicyDto } from './trip-gps.contract'

export type FrozenGpsPolicy = GpsPolicyDto & { maxPlausibleSpeedMps: number }
export function freezeGpsPolicy(p: GpsPolicy): FrozenGpsPolicy {
  const policy: FrozenGpsPolicy = {
    id: p.id,
    versionNo: p.versionNo,
    sampleIntervalSeconds: p.sampleIntervalSeconds,
    syncIntervalSeconds: p.syncIntervalSeconds,
    maxBatchSamples: p.maxBatchSamples,
    maxAcceptedAccuracyM: Number(p.maxAcceptedAccuracyM ?? 50),
    maxFutureSkewSeconds: p.maxFutureSkewSeconds,
    liveLocationMaxAgeSeconds: p.liveLocationMaxAgeSeconds,
    staleAfterSeconds: p.staleAfterSeconds,
    offlineAfterSeconds: p.offlineAfterSeconds,
    lateSyncGraceSeconds: p.lateSyncGraceSeconds,
    deviationThresholdM: Number(p.deviationThresholdM),
    deviationConsecutiveSamples: p.deviationConsecutiveSamples,
    recoveryThresholdM: Number(p.recoveryThresholdM),
    recoveryConsecutiveSamples: p.recoveryConsecutiveSamples,
    signalGapSeconds: p.signalGapSeconds,
    defaultCheckpointRadiusM: p.defaultCheckpointRadiusM,
    rawLocationRetentionDays: p.rawLocationRetentionDays,
    maxPlausibleSpeedMps: Number(p.maxPlausibleSpeedMps),
  }
  const { id, ...numbers } = policy
  if (
    Object.values(numbers).some((n) => !Number.isFinite(n) || n < 0) ||
    !policy.maxBatchSamples ||
    policy.maxBatchSamples > 10000 ||
    !policy.signalGapSeconds ||
    !policy.deviationConsecutiveSamples ||
    !policy.recoveryConsecutiveSamples ||
    policy.offlineAfterSeconds < policy.staleAfterSeconds ||
    policy.recoveryThresholdM > policy.deviationThresholdM
  )
    throw new AppError({ code: E.POLICY_UNAVAILABLE })
  return policy
}
export function publicPolicy(p: FrozenGpsPolicy): GpsPolicyDto {
  const { maxPlausibleSpeedMps, ...dto } = p
  return dto
}
