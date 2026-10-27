import { Injectable, Logger } from '@nestjs/common';
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
];

@Injectable()
export class BookingMembershipEventConsumer {
  private readonly logger = new Logger(BookingMembershipEventConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly handleMembershipChanged: HandleMembershipSourceChangedUseCase,
    private readonly handleBookingCancelled: HandleBookingCancelledUseCase,
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

    if (event.eventType === 'BOOKING_CANCELLED') {
      return this.handleBookingCancelled.execute({
        eventId: event.id,
        eventType: 'BOOKING_CANCELLED',
        entityId: event.aggregateId,
        entityVersion: payload.version ?? 1,
        correlationId: payload.correlationId ?? event.id,
        occurredAt,
        payload: {
          bookingId: event.aggregateId,
          tripId: payload.tripId,
          reason: payload.reason ?? 'BOOKING_CANCELLED',
          effectiveAt: payload.effectiveAt ? new Date(payload.effectiveAt) : occurredAt,
          version: payload.version ?? 1,
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
      entityVersion: payload.version ?? 1,
      correlationId: payload.correlationId ?? event.id,
      occurredAt,
      payload: {
        membershipKind,
        membershipRef,
        version: payload.version ?? 1,
        reason: payload.reason ?? event.eventType,
        effectiveAt: payload.effectiveAt ? new Date(payload.effectiveAt) : occurredAt,
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
  async consumePendingEvents(batchSize = 50): Promise<LifecycleExecutionResult[]> {
    const results: LifecycleExecutionResult[] = [];
    const events = await this.prisma.bookingOutboxEvent.findMany({
      where: {
        eventType: { in: MEMBERSHIP_LIFECYCLE_EVENT_TYPES },
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    for (const event of events) {
      // Check if already processed in RentalInboxEvent
      const processed = await this.prisma.rentalInboxEvent.findUnique({
        where: { eventId: event.id },
        select: { id: true },
      });
      if (processed) continue;

      try {
        const res = await this.consume(event);
        if (res) results.push(res);
      } catch (err: any) {
        this.logger.error(`Failed to consume booking event ${event.id}: ${err.message}`, err.stack);
      }
    }

    return results;
  }
}

