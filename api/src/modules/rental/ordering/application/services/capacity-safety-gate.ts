/** RB-POL-31: half-open intervals, end BEFORE start at identical timestamps. */
export interface CapacityReservation {
  id: string;
  quantity: number;
  occupiedFrom: Date;
  occupiedUntil: Date;
}

export interface CapacityReadyUnit {
  id: string;
  ready: boolean;
  verifiedReadyAt?: Date | null;
  verifiedUntil?: Date | null;
  evidenceRef?: string | null;
  verifiedBy?: string | null;
}

export interface CapacitySafetyResult {
  availableCount: number;
  peakReserved: number;
  verifiedSupply: number;
  unknownUnitCount: number;
  actionRequired: boolean;
}

export function calculateSafeCapacity(input: {
  from: Date;
  until: Date;
  units: CapacityReadyUnit[];
  reservations: CapacityReservation[];
}): CapacitySafetyResult {
  const { from, until } = input;
  if (!(from < until)) throw new Error('INVALID_OCCUPIED_WINDOW');

  const verifiedIds = new Set<string>();
  let unknown = 0;

  for (const unit of input.units) {
    if (verifiedIds.has(unit.id)) continue;
    const validProjection =
      !!unit.evidenceRef?.trim() &&
      !!unit.verifiedBy?.trim() &&
      !!unit.verifiedReadyAt &&
      unit.verifiedReadyAt <= from &&
      !!unit.verifiedUntil &&
      unit.verifiedUntil >= until;

    if (unit.ready || validProjection) {
      verifiedIds.add(unit.id);
    } else {
      unknown++;
    }
  }

  const events: Array<{ at: number; delta: number }> = [];
  const seen = new Set<string>();

  for (const r of input.reservations) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    if (!Number.isInteger(r.quantity) || r.quantity < 1)
      throw new Error('INVALID_RESERVATION_QUANTITY');

    const start = Math.max(from.getTime(), r.occupiedFrom.getTime());
    const end = Math.min(until.getTime(), r.occupiedUntil.getTime());
    if (start >= end) continue;

    events.push({ at: start, delta: r.quantity }, { at: end, delta: -r.quantity });
  }

  events.sort((a, b) => a.at - b.at || a.delta - b.delta);

  let occupying = 0;
  let peak = 0;
  for (const event of events) {
    occupying += event.delta;
    peak = Math.max(peak, occupying);
  }

  const availableCount = Math.max(0, verifiedIds.size - peak);
  return {
    availableCount,
    peakReserved: peak,
    verifiedSupply: verifiedIds.size,
    unknownUnitCount: unknown,
    actionRequired: peak > verifiedIds.size,
  };
}
