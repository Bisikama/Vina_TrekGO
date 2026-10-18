export interface TripInput { destinationId: string; title: string; description?: string; priceExplanation?: string | null; startAt: string; endAt: string; pickupPointId: string; capacity: number; price: string }
export interface Trip extends Omit<TripInput, 'pickupPointId' | 'price' | 'description' | 'priceExplanation'> {
  id: string; status: string; version: number; pickupPointId: string | null; price: string | null; description: string | null; priceExplanation?: string | null;
  checkpoints: { sourceCheckpointId: string | null; name: string; sequence: number }[];
  trails: { systemTrailId: string; snapshotName: string; sequence: number }[];
}
export interface Option { id: string; name: string }
export interface Trail extends Option { checkpointIds: string[]; canAppend: boolean; distanceKm: string; difficulty: string; coveredCheckpointIds: string[] }
export interface Readiness { canPublish: boolean; version: number; issues: { code: string; field: string; message: string }[] }
