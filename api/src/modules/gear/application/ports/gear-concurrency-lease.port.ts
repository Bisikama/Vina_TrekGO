export const GEAR_CONCURRENCY_LEASE_PORT = Symbol('GEAR_CONCURRENCY_LEASE_PORT');

export interface AcquireLeaseResult {
  acquired: boolean;
  fencingToken: number;
}

export interface GearConcurrencyLeasePort {
  acquireLease(resourceKey: string, ownerToken: string, ttlMs: number): Promise<AcquireLeaseResult>;
  releaseLease(resourceKey: string, ownerToken: string, fencingToken: number): Promise<boolean>;
}

