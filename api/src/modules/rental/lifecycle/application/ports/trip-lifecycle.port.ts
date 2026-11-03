export interface TripRescheduledCommand {
  eventId: string;
  eventType: 'TRIP_RESCHEDULED';
  entityId: string; // tripId
  entityVersion: number;
  correlationId: string;
  occurredAt: Date;
  payload: {
    tripId: string;
    newStartAt: Date;
    newEndAt: Date;
    oldStartAt?: Date;
    oldEndAt?: Date;
    plannedHandoverAt?: Date;
    plannedReturnAt?: Date;
    contextVersion: number;
  };
}

export interface TripCancelledCommand {
  eventId: string;
  eventType: 'TRIP_CANCELLED' | 'TRIP_ABORTED';
  entityId: string; // tripId
  entityVersion: number;
  correlationId: string;
  occurredAt: Date;
  payload: {
    tripId: string;
    reason: string;
    effectiveAt: Date;
    tripVersion: number;
  };
}

export interface BookingCancelledCommand {
  eventId: string;
  eventType: 'BOOKING_CANCELLED';
  entityId: string; // bookingId
  entityVersion: number;
  correlationId: string;
  occurredAt: Date;
  payload: {
    bookingId: string;
    tripId?: string;
    reason: string;
    effectiveAt: Date;
    version: number;
  };
}

export interface MembershipSourceChangedCommand {
  eventId: string;
  eventType: string;
  entityId: string;
  entityVersion: number;
  correlationId: string;
  occurredAt: Date;
  payload: {
    membershipKind: string;
    membershipRef: string;
    version: number;
    reason?: string;
    effectiveAt?: Date;
    tripId?: string;
    userId?: string;
    bookingId?: string;
  };
}

export interface LifecycleExecutionResult {
  eventId: string;
  status: 'PROCESSED' | 'SKIPPED_DUPLICATE' | 'SKIPPED_OUT_OF_ORDER' | 'FAILED';
  affectedOrderCount: number;
  affectedOrderIds: string[];
  conflicts: Array<{ orderId: string; reason: string }>;
  scheduleNoticesIssued: Array<{ orderId: string; documentId: string }>;
  cancelledOrderIds?: string[];
  actionRequiredOrderIds?: string[];
}

export const TRIP_LIFECYCLE_PORT = Symbol('TRIP_LIFECYCLE_PORT');

export interface TripLifecyclePort {
  processTripRescheduled(command: TripRescheduledCommand): Promise<LifecycleExecutionResult>;
  processTripCancelled(command: TripCancelledCommand): Promise<LifecycleExecutionResult>;
  processBookingCancelled(command: BookingCancelledCommand): Promise<LifecycleExecutionResult>;
  processMembershipSourceChanged(command: MembershipSourceChangedCommand): Promise<LifecycleExecutionResult>;
}
