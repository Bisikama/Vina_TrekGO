export interface PrivateTripInput {
  type: 'PERSONAL' | 'SYSTEM'
  trailRef: string
  destinationId: string
  title: string
  description?: string
  startAt: string
  endAt: string
  pickupPointId: string
  capacity: number
  checkpointIds: string[]
}
export interface PrivateTripUpdate {
  expectedVersion: number
  title?: string
  description?: string
  startAt?: string
  endAt?: string
  pickupPointId?: string
  capacity?: number
}
export abstract class PrivateTripPort {
  abstract create(userId: string, input: PrivateTripInput): Promise<unknown>
  abstract update(userId: string, id: string, input: PrivateTripUpdate): Promise<unknown>
  abstract cancel(userId: string, id: string, version: number, reason?: string): Promise<unknown>
  abstract invite(userId: string, id: string, version: number, expiresAt?: string): Promise<unknown>
  abstract revoke(userId: string, id: string, version: number): Promise<unknown>
  abstract read(userId: string, id?: string, page?: number): Promise<unknown>
  abstract options(
    userId: string,
    kind: 'PERSONAL' | 'SYSTEM' | 'PICKUP',
    page: number,
    destinationId?: string,
  ): Promise<unknown>
  abstract access(userId: string, trailId: string): Promise<unknown>
}
