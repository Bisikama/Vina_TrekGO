import { generateUUID } from '@/services/storage/recordingDatabase';
import { GpsProcessor, distanceMeters } from '@/utils/gpsProcessor';
import { TripGpsSocketService } from './trip-gps.socket';
import { TripGpsCoordinator } from './trip-gps.coordinator';
import { stopTripCollector, setCollectorListeners, setCollectorSimulation } from './trip-gps.collector';
import { changeLocalTrip, listLocalTrips, localSamples, type LocalTrip } from './trip-gps.v2-storage';
import type { GpsSample, EventEnvelope, MemberUpdatedEventData, LocationUpdated, PresenceUpdated } from '../types';

export type RuntimeEvent = { tripId?: string; kind: 'refresh' | 'sample' | 'state' | 'member' | 'location' | 'presence' | 'socket' | 'error';
  sample?: GpsSample; message?: string; connected?: boolean;
  member?: EventEnvelope<MemberUpdatedEventData>; location?: EventEnvelope<LocationUpdated>; presence?: EventEnvelope<PresenceUpdated> };
type Publisher = { pending?: GpsSample; last?: GpsSample; at: number; busy: boolean; force: boolean; processor: GpsProcessor };
class TripGpsRuntime {
  private account: string | null = null;
  private token: string | null = null;
  private epoch = 0;
  private authGeneration = 0;
  private coordinator?: TripGpsCoordinator;
  private sockets = new Map<string, TripGpsSocketService>();
  private viewers = new Map<string, number>();
  private publishers = new Map<string, Publisher>();
  private listeners = new Set<(event: RuntimeEvent) => void>();
  private collectorId: string | undefined;
  private collectorQueue: Promise<unknown> = Promise.resolve();
  private simulated = true;
  private collectorRevision = 0;
  on(listener: (event: RuntimeEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit(event: RuntimeEvent) { this.listeners.forEach(listener => listener(event)); }
  async authenticate(account: string | null, token: string | null) {
    if (account === this.account && token === this.token) return;
    const authTicket = ++this.authGeneration;
    const changedAccount = account !== this.account;
    this.token = token;
    this.sockets.forEach(s => s.disconnect()); this.sockets.clear();
    if (changedAccount) {
      this.account = account; this.epoch++;
      this.coordinator?.stop(); this.coordinator = undefined;
      this.publishers.clear(); this.collectorId = undefined; this.simulated = true;
      setCollectorSimulation(true);
      await stopTripCollector();
    }
    const epoch = this.epoch;
    if (!account || !token || epoch !== this.epoch || authTicket !== this.authGeneration || account !== this.account) return;
    this.coordinator ??= new TripGpsCoordinator(account, () => this.account === account && this.epoch === epoch && !!this.token, processed => {
      this.emit({ kind: 'refresh' }); void this.reconcileCollector().catch(e => this.error(e));
      if (processed) this.emit({ kind: 'state' });
    });
    setCollectorListeners((trip, sample) => {
      if (trip.accountId !== this.account) return;
      this.emit({ kind: 'sample', tripId: trip.session.tripId, sample });
      void this.offer(trip, sample).catch(e => this.error(e, trip.session.tripId));
    }, message => this.emit({ kind: 'error', message }));
    const trips = await listLocalTrips(account);
    if (epoch !== this.epoch || authTicket !== this.authGeneration) return;
    trips.forEach(t => {
      if (!t.finalProcessed && !t.accessBlocked) {
        if (t.session.status === 'ACTIVE') this.ensureSocket(t.session.tripId);
        if (t.session.status === 'STOPPED' || t.controlSyncMode === 'IMMEDIATE_LEGACY') this.coordinator?.trigger(t.session.id);
      }
    });
    this.viewers.forEach((count, tripId) => { if (count) this.ensureSocket(tripId); });
    await this.reconcileCollector();
  }
  private error(error: unknown, tripId?: string) { this.emit({ kind: 'error', tripId, message: error instanceof Error ? error.message : String(error) }); }
  watch(tripId: string) {
    this.viewers.set(tripId, (this.viewers.get(tripId) ?? 0) + 1);
    this.ensureSocket(tripId)?.setViewing(true);
    return () => {
      const count = Math.max(0, (this.viewers.get(tripId) ?? 1) - 1); this.viewers.set(tripId, count);
      if (!count) {
        this.sockets.get(tripId)?.setViewing(false);
        void this.releaseIdleSocket(tripId);
      }
    };
  }
  private async releaseIdleSocket(tripId: string) {
    if (!this.account) return;
    const account = this.account;
    const trips = await listLocalTrips(account, tripId);
    if (account !== this.account || this.viewers.get(tripId)) return;
    if (!trips.some(t => t.session.status === 'ACTIVE' && !t.accessBlocked)) { this.sockets.get(tripId)?.disconnect(); this.sockets.delete(tripId); }
  }
  private ensureSocket(tripId: string) {
    if (!this.account || !this.token) return;
    let socket = this.sockets.get(tripId);
    if (socket) return socket;
    socket = new TripGpsSocketService(); this.sockets.set(tripId, socket);
    const epoch = this.epoch, account = this.account;
    const valid = () => epoch === this.epoch && account === this.account;
    socket.connect(this.token, tripId, {
      onConnect: () => {
        if (!valid()) return;
        this.emit({ kind: 'socket', tripId, connected: true });
        void this.reconnectLatest(tripId).catch(e => this.error(e, tripId));
      },
      onSubscribed: () => { if (valid()) this.emit({ kind: 'state', tripId }); },
      onDisconnect: () => { if (valid()) this.emit({ kind: 'socket', tripId, connected: false }); },
      onMemberUpdated: member => { if (valid()) this.emit({ kind: 'member', tripId, member }); },
      onLocationUpdated: location => { if (valid()) this.emit({ kind: 'location', tripId, location }); },
      onPresenceUpdated: presence => { if (valid()) this.emit({ kind: 'presence', tripId, presence }); },
      onTripChanged: () => { if (valid()) this.emit({ kind: 'state', tripId }); },
      onRouteReady: () => { if (valid()) { this.emit({ kind: 'state', tripId }); void this.sync(tripId); } },
      onRouteFailed: () => { if (valid()) this.emit({ kind: 'refresh', tripId }); },
      onAccessRevoked: () => {
        if (!valid()) return;
        void this.denyAccess(tripId).catch(e => this.error(e, tripId));
      },
    }, { viewing: !!this.viewers.get(tripId), protocolVersion: 2 });
    return socket;
  }
  isConnected(tripId: string) { return this.sockets.get(tripId)?.isConnected() ?? false; }
  async denyAccess(tripId: string) {
    if (!this.account) return;
    const account = this.account, epoch = this.epoch;
    const trips = await listLocalTrips(account, tripId);
    if (epoch !== this.epoch) return;
    for (const trip of trips) await changeLocalTrip(account, trip.session.id, local => {
      local.accessBlocked = true; local.syncStatus = 'NEEDS_ATTENTION';
      local.lastError = 'Quyền GPS đã bị thu hồi. Dữ liệu chưa đồng bộ vẫn được giữ trên máy.';
    });
    if (epoch !== this.epoch) return;
    await this.reconcileCollector();
    if (epoch !== this.epoch) return;
    this.sockets.get(tripId)?.disconnect(); this.sockets.delete(tripId);
    this.emit({ kind: 'refresh', tripId });
    this.emit({ kind: 'error', tripId, message: 'Quyền GPS đã bị thu hồi. Dữ liệu local được giữ trên máy.' });
  }
  async sync(tripId?: string, manual = false) {
    if (!this.account) return;
    const account = this.account, epoch = this.epoch;
    const trips = await listLocalTrips(account, tripId);
    if (epoch !== this.epoch) return;
    trips.forEach(t => { if (t.session.status === 'STOPPED' && !t.finalProcessed && !t.accessBlocked) this.coordinator?.trigger(t.session.id, manual); });
  }
  async syncMetadata(tripId?: string) {
    if (!this.account) return;
    const epoch = this.epoch;
    const trips = await listLocalTrips(this.account, tripId);
    if (epoch !== this.epoch) return;
    trips.forEach(t => { if (t.controlSyncMode === 'IMMEDIATE_LEGACY' && t.session.status !== 'STOPPED' && !t.accessBlocked) this.coordinator?.trigger(t.session.id, true); });
  }
  async reconnect() {
    await this.sync(undefined, true);
    await this.syncMetadata();
    for (const tripId of this.sockets.keys()) await this.reconnectLatest(tripId);
  }
  async reconcileCollector(requestPermissions = false) {
    const result = this.collectorQueue.then(async () => {
      const account = this.account, epoch = this.epoch;
      const revision = this.collectorRevision;
      if (!account || !this.token) return;
      const trip = (await listLocalTrips(account)).find(t => t.session.status === 'ACTIVE' && !t.accessBlocked);
      if (epoch !== this.epoch || revision !== this.collectorRevision) return;
      const nextId = undefined; // Trip recording is currently fake-only.
      if (this.collectorId === nextId && !requestPermissions) return;
      this.collectorId = nextId;
      await stopTripCollector();
      if (trip) this.ensureSocket(trip.session.tripId);
    });
    this.collectorQueue = result.catch(() => {});
    return result;
  }
  async suspendCollector() { this.collectorRevision++; this.collectorId = undefined; await stopTripCollector(); }
  async setSimulated(value: boolean) {
    value = true; // Keep old callers from re-enabling a real trip collector.
    setCollectorSimulation(true);
    if (this.simulated === value) return;
    this.simulated = value; this.collectorRevision++; this.collectorId = undefined;
    await stopTripCollector(); await this.reconcileCollector();
  }
  private async reconnectLatest(tripId: string) {
    if (!this.account) return;
    const epoch = this.epoch, account = this.account;
    for (const trip of await listLocalTrips(account, tripId)) {
      if (trip.session.status !== 'ACTIVE' || trip.accessBlocked) continue;
      const latest = (await localSamples(account, trip.session.id)).at(-1);
      if (epoch !== this.epoch) return;
      if (latest) await this.offer(trip, latest, true);
    }
  }
  private async offer(trip: LocalTrip, sample: GpsSample, force = false) {
    if (trip.accountId !== this.account || trip.accessBlocked) return;
    let publisher = this.publishers.get(trip.session.id);
    if (!publisher) { publisher = { at: 0, busy: false, force: true, processor: new GpsProcessor() }; this.publishers.set(trip.session.id, publisher); }
    if (publisher.pending && Date.parse(publisher.pending.recordedAt) > Date.parse(sample.recordedAt)) return;
    if (!force) {
      const accepted = publisher.processor.process({ timestamp: Date.parse(sample.recordedAt), coords: { latitude: sample.latitude, longitude: sample.longitude, accuracy: sample.accuracyM, altitude: sample.altitudeM ?? null, altitudeAccuracy: null, speed: sample.speedMps ?? null, heading: sample.headingDeg ?? null } });
      // Sensor speed provides movement evidence for the slower, sub-5 m publishing path.
      if (!accepted.accepted && !(accepted.reason === 'GPS_JITTER' && (sample.speedMps ?? 0) > 0)) return;
    }
    publisher.pending = sample; publisher.force ||= force;
    await this.pump(trip, publisher);
  }
  private async pump(trip: LocalTrip, publisher: Publisher) {
    const socket = this.sockets.get(trip.session.tripId), point = publisher.pending;
    if (publisher.busy || !point || !socket?.isConnected() || trip.accountId !== this.account) return;
    const age = Date.now() - Date.parse(point.recordedAt);
    if (age > trip.policy.liveLocationMaxAgeSeconds * 1000 || age < -trip.policy.maxFutureSkewSeconds * 1000) { publisher.pending = undefined; return; }
    const distance = publisher.last ? distanceMeters(publisher.last, point) : Infinity;
    const elapsed = Date.now() - publisher.at;
    if (!publisher.force && publisher.last && !((elapsed >= trip.limits!.publishMinIntervalSeconds * 1000 && distance >= trip.limits!.publishMinDistanceM) || (elapsed >= trip.limits!.publishMovingMaxIntervalSeconds * 1000 && distance > 0))) return;
    publisher.busy = true;
    const epoch = this.epoch;
    const sentAt = Date.now();
    try {
      const current = await changeLocalTrip(trip.accountId, trip.session.id, t => { t.publishSequence++; });
      if (epoch !== this.epoch || current.session.status !== 'ACTIVE' || current.accessBlocked) return;
      if (current.controlSyncMode === 'IMMEDIATE_LEGACY' && current.metadataRevision !== current.localRevision) return;
      const ack = await socket.publish({ requestId: generateUUID(), tripId: trip.session.tripId, sessionId: trip.session.id,
        deviceId: trip.session.deviceId, sequence: current.publishSequence, location: point });
      if (ack.applied) { publisher.last = point; publisher.at = sentAt; publisher.force = false; }
      if (publisher.pending === point) publisher.pending = undefined;
    } catch (error) {
      if (epoch === this.epoch && (error as { code?: string })?.code === 'FORBIDDEN') {
        publisher.pending = undefined;
        await this.denyAccess(trip.session.tripId);
      }
      // Other socket errors keep only the latest local point for a new sample/reconnect.
    }
    finally {
      publisher.busy = false;
      if (publisher.pending && publisher.pending !== point && epoch === this.epoch) void this.pump(trip, publisher).catch(e => this.error(e, trip.session.tripId));
    }
  }
}
export const tripGpsRuntime = new TripGpsRuntime();
