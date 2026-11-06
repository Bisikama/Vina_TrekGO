import type { BookingSummary } from '@/features/bookings/types';
import type { PersonalTicket } from '@/features/invitations';
import type { LeaderPublicTrip } from '@/features/leaders/services/leader-public-trips.api';
import type { PrivateTrip } from '@/features/private-trips/types';

export type ParticipationGroup = 'UPCOMING' | 'PENDING' | 'HISTORY' | 'CANCELLED' | 'INACTIVE';
export type MyTripFilter = ParticipationGroup | 'INVITATIONS';
export type MyTripSource = 'ALL' | 'PUBLIC' | 'PRIVATE';
type TripState = { status?: string | null; startAt?: string; endAt?: string | null };
type BookingState = { status: string; expiresAt?: string | null; trip?: TripState | null };
const normalized = (status?: string | null) => (status ?? '').toUpperCase();
const ended = (value: string | null | undefined, now: number) => !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) < now;

export function bookingGroup(booking: BookingState, now = Date.now()): ParticipationGroup {
  const status = normalized(booking.status), tripStatus = normalized(booking.trip?.status);
  if (status === 'CANCELLED') return 'CANCELLED';
  if (['EXPIRED', 'NO_SHOW'].includes(status)) return 'INACTIVE';
  if (tripStatus === 'CANCELLED') return 'CANCELLED';
  if (status === 'PENDING_PAYMENT') return ended(booking.expiresAt, now) || tripStatus === 'COMPLETED' ? 'INACTIVE' : 'PENDING';
  if (status === 'COMPLETED') return 'HISTORY';
  if (['CONFIRMED', 'CHECKED_IN', 'PARTIAL_CHECKIN'].includes(status)) {
    if (tripStatus !== 'CANCEL_PENDING' && (tripStatus === 'COMPLETED' || ended(booking.trip?.endAt, now))) return 'HISTORY';
    return 'UPCOMING';
  }
  return 'INACTIVE';
}

export function ticketGroup(ticket: Pick<PersonalTicket, 'bookingStatus' | 'participantStatus' | 'checkinStatus' | 'trip'>, now = Date.now()): ParticipationGroup {
  const participant = normalized(ticket.participantStatus);
  if (participant === 'CANCELLED' || participant === 'INVALIDATED') return 'CANCELLED';
  if (participant === 'NO_SHOW' || ticket.checkinStatus === 'NO_SHOW') return 'INACTIVE';
  return bookingGroup({ status: ticket.bookingStatus, trip: ticket.trip }, now);
}

export function privateTripGroup(trip: Pick<PrivateTrip, 'status' | 'viewer'>): ParticipationGroup {
  const status = normalized(trip.status), member = normalized(trip.viewer?.membershipStatus);
  if (status === 'CANCELLED') return 'CANCELLED';
  if (['NO_SHOW', 'LEFT', 'REMOVED'].includes(member)) return 'INACTIVE';
  if (status === 'COMPLETED' || member === 'COMPLETED') return 'HISTORY';
  return 'UPCOMING';
}

type Entry<T, K extends string> = { key: string; kind: K; source: Exclude<MyTripSource, 'ALL'>; group: ParticipationGroup; data: T };
export type TripParticipation = Entry<BookingSummary, 'booking'> | Entry<PersonalTicket, 'ticket'> | Entry<PrivateTrip, 'private'> | Entry<LeaderPublicTrip, 'leader'>;

export function buildTripParticipations({ bookings, tickets, privateTrips, leaderTrips = [] }: {
  bookings: BookingSummary[]; tickets: PersonalTicket[]; privateTrips: PrivateTrip[]; leaderTrips?: LeaderPublicTrip[];
}, now = Date.now()): TripParticipation[] {
  const entries: TripParticipation[] = [];
  const represented = new Set<string>();
  const keys = new Set<string>();
  function add(entry: TripParticipation) { if (!keys.has(entry.key)) { keys.add(entry.key); entries.push(entry); } }
  for (const booking of bookings) {
    const group = bookingGroup(booking, now);
    add({ key: 'booking:' + booking.id, kind: 'booking', source: 'PUBLIC', group, data: booking });
    if (booking.trip?.id) represented.add(booking.trip.id + ':' + group);
  }
  for (const ticket of tickets) {
    const group = ticketGroup(ticket, now);
    // An old canceled order must not hide a valid ticket received later.
    if (!represented.has(ticket.trip.id + ':' + group)) add({ key: 'ticket:' + ticket.id, kind: 'ticket', source: 'PUBLIC', group, data: ticket });
  }
  for (const trip of privateTrips) add({ key: 'private:' + trip.id, kind: 'private', source: 'PRIVATE', group: privateTripGroup(trip), data: trip });
  for (const trip of leaderTrips) {
    const group = normalized(trip.status) === 'COMPLETED' ? 'HISTORY' : normalized(trip.status) === 'CANCELLED' ? 'CANCELLED' : null;
    if (group && !represented.has(trip.id + ':' + group)) add({ key: 'leader:' + trip.id, kind: 'leader', source: 'PUBLIC', group, data: trip });
  }
  return entries.sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    const date = (entry: TripParticipation) => {
      const value = entry.kind === 'booking' ? entry.group === 'PENDING' ? entry.data.expiresAt : entry.data.trip?.startAt : entry.kind === 'ticket' ? entry.data.trip.startAt : entry.data.startAt;
      return Date.parse(value ?? '') || 0;
    };
    return (a.group === 'UPCOMING' || a.group === 'PENDING') ? date(a) - date(b) : date(b) - date(a);
  });
}

export function selectTripParticipations(entries: TripParticipation[], source: MyTripSource) {
  const visible = source === 'ALL' ? entries : entries.filter((entry) => entry.source === source);
  const counts: Record<ParticipationGroup, number> = { UPCOMING: 0, PENDING: 0, HISTORY: 0, CANCELLED: 0, INACTIVE: 0 };
  visible.forEach((entry) => { counts[entry.group]++; });
  return { entries: visible, counts };
}
