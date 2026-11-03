import { PrismaClient } from '@prisma/client'

export const DEFAULT_GPS_POLICY_DATA = {
  policyCode: 'DEFAULT_GPS_POLICY',
  versionNo: 1,
  sampleIntervalSeconds: 5,
  syncIntervalSeconds: 10,
  maxBatchSamples: 200,
  maxAcceptedAccuracyM: 50,
  maxFutureSkewSeconds: 30,
  liveLocationMaxAgeSeconds: 30,
  staleAfterSeconds: 30,
  offlineAfterSeconds: 120,
  lateSyncGraceSeconds: 86400,
  deviationThresholdM: 50,
  deviationConsecutiveSamples: 3,
  recoveryThresholdM: 30,
  recoveryConsecutiveSamples: 3,
  signalGapSeconds: 120,
  defaultCheckpointRadiusM: 30,
  rawLocationRetentionDays: 30,
  maxPlausibleSpeedMps: 0,
  effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
  effectiveTo: null,
  isActive: true,
}

export async function seedGpsPolicy(prisma: PrismaClient) {
  console.log('Seeding GPS Policy...')

  const policy = await prisma.gpsPolicy.upsert({
    where: {
      policyCode_versionNo: {
        policyCode: DEFAULT_GPS_POLICY_DATA.policyCode,
        versionNo: DEFAULT_GPS_POLICY_DATA.versionNo,
      },
    },
    update: {
      sampleIntervalSeconds: DEFAULT_GPS_POLICY_DATA.sampleIntervalSeconds,
      syncIntervalSeconds: DEFAULT_GPS_POLICY_DATA.syncIntervalSeconds,
      maxBatchSamples: DEFAULT_GPS_POLICY_DATA.maxBatchSamples,
      maxAcceptedAccuracyM: DEFAULT_GPS_POLICY_DATA.maxAcceptedAccuracyM,
      maxFutureSkewSeconds: DEFAULT_GPS_POLICY_DATA.maxFutureSkewSeconds,
      liveLocationMaxAgeSeconds: DEFAULT_GPS_POLICY_DATA.liveLocationMaxAgeSeconds,
      staleAfterSeconds: DEFAULT_GPS_POLICY_DATA.staleAfterSeconds,
      offlineAfterSeconds: DEFAULT_GPS_POLICY_DATA.offlineAfterSeconds,
      lateSyncGraceSeconds: DEFAULT_GPS_POLICY_DATA.lateSyncGraceSeconds,
      deviationThresholdM: DEFAULT_GPS_POLICY_DATA.deviationThresholdM,
      deviationConsecutiveSamples: DEFAULT_GPS_POLICY_DATA.deviationConsecutiveSamples,
      recoveryThresholdM: DEFAULT_GPS_POLICY_DATA.recoveryThresholdM,
      recoveryConsecutiveSamples: DEFAULT_GPS_POLICY_DATA.recoveryConsecutiveSamples,
      signalGapSeconds: DEFAULT_GPS_POLICY_DATA.signalGapSeconds,
      defaultCheckpointRadiusM: DEFAULT_GPS_POLICY_DATA.defaultCheckpointRadiusM,
      rawLocationRetentionDays: DEFAULT_GPS_POLICY_DATA.rawLocationRetentionDays,
      maxPlausibleSpeedMps: DEFAULT_GPS_POLICY_DATA.maxPlausibleSpeedMps,
      effectiveFrom: DEFAULT_GPS_POLICY_DATA.effectiveFrom,
      effectiveTo: DEFAULT_GPS_POLICY_DATA.effectiveTo,
      isActive: DEFAULT_GPS_POLICY_DATA.isActive,
    },
    create: DEFAULT_GPS_POLICY_DATA,
  })

  console.log(`GPS Policy seeded: ${policy.policyCode} (v${policy.versionNo}) - ID: ${policy.id}`)
  return policy
}

if (require.main === module) {
  const { Pool } = require('pg')
  const { PrismaPg } = require('@prisma/adapter-pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  seedGpsPolicy(prisma)
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
      await pool.end()
    })
}
