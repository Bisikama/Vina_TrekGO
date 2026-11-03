import { Prisma, UserRole } from '@prisma/client'

export interface GpsCheckpointPoint {
  sessionId: string
  latitude: number
  longitude: number
  recordedAt: Date
}
export abstract class CheckpointGpsArrivalPort {
  abstract record(
    tx: Prisma.TransactionClient,
    tripId: string,
    userId: string,
    role: UserRole,
    privateTrip: boolean,
    fallbackRadiusM: number,
    points: GpsCheckpointPoint[],
  ): Promise<void>
}
