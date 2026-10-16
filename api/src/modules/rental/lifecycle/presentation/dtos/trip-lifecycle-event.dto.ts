import { z } from 'zod';

export const tripRescheduledEventSchema = z.object({
  eventId: z.string().min(1).max(220),
  eventType: z.literal('TRIP_RESCHEDULED'),
  entityId: z.string().uuid(),
  entityVersion: z.number().int().positive(),
  correlationId: z.string().min(1).max(220),
  occurredAt: z.coerce.date(),
  payload: z.object({
    tripId: z.string().uuid(),
    newStartAt: z.coerce.date(),
    newEndAt: z.coerce.date(),
    oldStartAt: z.coerce.date().optional(),
    oldEndAt: z.coerce.date().optional(),
    plannedHandoverAt: z.coerce.date().optional(),
    plannedReturnAt: z.coerce.date().optional(),
    contextVersion: z.number().int().positive(),
  }),
});

export type TripRescheduledEventDto = z.infer<typeof tripRescheduledEventSchema>;

export const tripCancelledEventSchema = z.object({
  eventId: z.string().min(1).max(220),
  eventType: z.enum(['TRIP_CANCELLED', 'TRIP_ABORTED']),
  entityId: z.string().uuid(),
  entityVersion: z.number().int().positive(),
  correlationId: z.string().min(1).max(220),
  occurredAt: z.coerce.date(),
  payload: z.object({
    tripId: z.string().uuid(),
    reason: z.string().min(1).max(500),
    effectiveAt: z.coerce.date(),
    tripVersion: z.number().int().positive(),
  }),
});

export type TripCancelledEventDto = z.infer<typeof tripCancelledEventSchema>;

export const bookingCancelledEventSchema = z.object({
  eventId: z.string().min(1).max(220),
  eventType: z.literal('BOOKING_CANCELLED'),
  entityId: z.string().uuid(),
  entityVersion: z.number().int().positive(),
  correlationId: z.string().min(1).max(220),
  occurredAt: z.coerce.date(),
  payload: z.object({
    bookingId: z.string().uuid(),
    tripId: z.string().uuid().optional(),
    reason: z.string().min(1).max(500),
    effectiveAt: z.coerce.date(),
    version: z.number().int().positive(),
  }),
});

export type BookingCancelledEventDto = z.infer<typeof bookingCancelledEventSchema>;
