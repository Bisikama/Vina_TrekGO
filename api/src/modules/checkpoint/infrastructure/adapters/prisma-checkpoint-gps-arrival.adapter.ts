import { Injectable } from '@nestjs/common'
import { Prisma, UserRole } from '@prisma/client'
import { CheckpointGpsArrivalPort, GpsCheckpointPoint } from '../../application/ports/checkpoint-gps-arrival.port'
import { calculateHaversineDistanceM } from '../../../elevation/application/ports/elevation-provider.port'

@Injectable()
export class PrismaCheckpointGpsArrivalAdapter implements CheckpointGpsArrivalPort {
  async record(
    tx: Prisma.TransactionClient,
    tripId: string,
    userId: string,
    role: UserRole,
    privateTrip: boolean,
    fallbackRadiusM: number,
    points: GpsCheckpointPoint[],
  ) {
    const checkpoints = await tx.tripCheckpoint.findMany({ where: { tripId, isEnabled: true } })
    for (const checkpoint of checkpoints) {
      const center = { latitude: Number(checkpoint.latitude), longitude: Number(checkpoint.longitude) }
      const arrival = points.find(
        (p) => calculateHaversineDistanceM(p, center) <= (checkpoint.radiusMeters || fallbackRadiusM),
      )
      if (!arrival) continue
      const data = {
        sessionId: arrival.sessionId,
        arrivalAt: arrival.recordedAt,
        arrivalLatitude: arrival.latitude,
        arrivalLongitude: arrival.longitude,
        distanceToCheckpointM: calculateHaversineDistanceM(arrival, center),
      }
      await tx.checkpointEvent.createMany({
        data: [
          {
            tripId,
            userId,
            tripCheckpointId: checkpoint.id,
            roleAtEvent: role,
            idempotencyKey: `gps:${tripId}:${checkpoint.id}:${userId}`,
            ...data,
            missionStatus: privateTrip ? 'COMPLETED' : 'UNLOCKED',
            completedAt: privateTrip ? arrival.recordedAt : null,
          },
        ],
        skipDuplicates: true,
      })
      // Earlier late samples may move the first arrival back; preserve public mission state.
      await tx.checkpointEvent.updateMany({
        where: {
          tripId,
          userId,
          tripCheckpointId: checkpoint.id,
          arrivalAt: { gt: arrival.recordedAt },
        },
        data: { ...data, ...(privateTrip ? { missionStatus: 'COMPLETED', completedAt: arrival.recordedAt } : {}) },
      })
      if (privateTrip)
        await tx.checkpointEvent.updateMany({
          where: {
            tripId,
            userId,
            tripCheckpointId: checkpoint.id,
            missionStatus: { not: 'COMPLETED' },
          },
          data: { missionStatus: 'COMPLETED', completedAt: arrival.recordedAt },
        })
    }
  }
}
