export interface RentalAvailabilityQuery {
  productId: string;
  occupiedFrom: Date;
  occupiedUntil: Date;
  now: Date;
  requestedQuantity?: number;
  inventoryLocationId?: string;
  excludeReservationIds?: string[];
  activeUnitIds?: string[];
}

export const RENTAL_AVAILABILITY_PORT = Symbol('RENTAL_AVAILABILITY_PORT');

export interface RentalAvailabilityPort {
  getAvailableCount(query: RentalAvailabilityQuery): Promise<number>;
}