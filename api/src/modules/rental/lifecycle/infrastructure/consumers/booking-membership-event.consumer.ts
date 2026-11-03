import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { HandleTripCancelledUseCase } from '../../application/use-cases/handle-trip-cancelled.use-case';
import { CancellationDeliveryService } from '../../../../../shared/services/cancellation-delivery.service';
import { AppError } from '../../../../../shared/errors';
import { PrismaService } from 'src/shared/services/prisma.service';
import { HandleMembershipSourceChangedUseCase } from '../../application/use-cases/handle-membership-source-changed.use-case';
import { HandleBookingCancelledUseCase } from '../../application/use-cases/handle-booking-cancelled.use-case';
import type { LifecycleExecutionResult, MembershipSourceChangedCommand } from '../../application/ports/trip-lifecycle.port';

export const MEMBERSHIP_LIFECYCLE_EVENT_TYPES = [
  'PRIVATE_TRIP_MEMBER_LEFT',
  'PRIVATE_TRIP_MEMBER_REMOVED',
  'PRIVATE_TRIP_MEMBER_JOINED',
  'PUBLIC_PARTICIPANT_CLAIMED',
  'BOOKING_CANCELLED',
  'TRIP_CANCELLED',
  'PRIVATE_TRIP_CANCELLED',
];

@Injectable()
export class BookingMembershipEventConsumer {
  private readonly logger = new Logger(BookingMembershipEventConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly handleMembershipChanged: HandleMembershipSourceChangedUseCase,
    private readonly handleBookingCancelled: HandleBookingCancelledUseCase,
    private readonly handleTripCancelled: HandleTripCancelledUseCase,
    private readonly deliveries: CancellationDeliveryService,
  ) {}

  /**
   * Consumes a single membership-related event.
   * Deduplicates using RentalInboxEvent and leaves BookingOutboxEvent untouched
   * so other consumers can still process the event.
   */
  async consume(event: {
    id: string;
    eventType: string;
    aggregateId: string;
    payload: any;
    createdAt?: Date;
  }): Promise<LifecycleExecutionResult | null> {
    const occurredAt = event.createdAt ? new Date(event.createdAt) : new Date();
    const payload = (typeof event.payload === 'object' && event.payload !== null) ? event.payload : {};

    if (event.eventType === 'TRIP_CANCELLED' || event.eventType === 'PRIVATE_TRIP_CANCELLED') {
      const version = payload.tripVersion ?? payload.version;
      const effectiveAt = new Date(payload.effectiveAt ?? payload.cancelledAt ?? occurredAt);
      if (!Number.isSafeInteger(version) || version < 1 || !Number.isFinite(effectiveAt.getTime())) throw AppError.fromCode('RENTAL_LIFECYCLE_EVENT_INVALID');
      return this.handleTripCancelled.execute({eventId:event.id,eventType:'TRIP_CANCELLED',entityId:event.aggregateId,
        entityVersion:version,correlationId:payload.correlationId ?? event.id,occurredAt,
        payload:{tripId:payload.tripId ?? event.aggregateId,tripVersion:version,effectiveAt,reason:payload.reason ?? event.eventType}});
    }
    if (event.eventType === 'BOOKING_CANCELLED') {
      return this.handleBookingCancelled.execute({
        eventId: event.id,
        eventType: 'BOOKING_CANCELLED',
        entityId: event.aggregateId,
        entityVersion: payload.bookingVersion ?? payload.version ?? 1,
        correlationId: payload.correlationId ?? event.id,
        occurredAt,
        payload: {
          bookingId: event.aggregateId,
          tripId: payload.tripId,
          reason: payload.reason ?? 'BOOKING_CANCELLED',
          effectiveAt: new Date(payload.effectiveAt ?? payload.cancelledAt ?? occurredAt),
          version: payload.bookingVersion ?? payload.version ?? 1,
        },
      });
    }

    let membershipKind = 'PRIVATE_TRIP_MEMBER';
    let membershipRef = event.aggregateId;

    if (event.eventType === 'PUBLIC_PARTICIPANT_CLAIMED') {
      membershipKind = 'PUBLIC_PARTICIPANT';
      membershipRef = payload.participantId ?? event.aggregateId;
    } else if (event.eventType === 'PUBLIC_BOOKING_BUYER_CANCELLED') {
      membershipKind = 'PUBLIC_BOOKING_BUYER';
      membershipRef = payload.bookingId ?? event.aggregateId;
    }

    const command: MembershipSourceChangedCommand = {
      eventId: event.id,
      eventType: event.eventType,
      entityId: event.aggregateId,
      entityVersion: payload.bookingVersion ?? payload.version ?? 1,
      correlationId: payload.correlationId ?? event.id,
      occurredAt,
      payload: {
        membershipKind,
        membershipRef,
        version: payload.bookingVersion ?? payload.version ?? 1,
        reason: payload.reason ?? event.eventType,
        effectiveAt: new Date(payload.effectiveAt ?? payload.cancelledAt ?? occurredAt),
        tripId: payload.tripId,
        userId: payload.userId,
        bookingId: payload.bookingId,
      },
    };

    return this.handleMembershipChanged.execute(command);
  }

  /**
   * Scans pending booking outbox events for membership events that have not been
   * processed by Rental yet (receipt recorded in RentalInboxEvent).
   * Note: NEVER marks booking_outbox_events as PROCESSED.
   */
  async consumePendingEvents(batchSize = 25): Promise<LifecycleExecutionResult[]> {
    const results: LifecycleExecutionResult[] = [];
    await this.deliveries.run('rental-lifecycle-v1', MEMBERSHIP_LIFECYCLE_EVENT_TYPES, async event => {
      const result = await this.consume(event);
      if (!result || result.status === 'FAILED') throw AppError.fromCode('RENTAL_LIFECYCLE_EVENT_INVALID');
      results.push(result);
    }, batchSize);
    return results;
  }
  private running = false;
  @Interval(2000)
  async tick() {
    if (this.running || process.env.TRIP_CANCELLATION_WORKER_ENABLED !== 'true') return;
    this.running = true;
    try { for (let batch=0; batch<4; batch++) { const results=await this.consumePendingEvents(); if (!results.length) break; } }
    catch { this.logger.warn('Rental lifecycle worker unavailable; retrying on next tick'); }
    finally { this.running=false; }
  }
}
