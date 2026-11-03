import { API_BASE_URL, refreshSessionOnce } from '@/lib/api-client';
import { generateUUID } from '@/services/storage/recordingDatabase';
import { io, Socket } from 'socket.io-client';
import type {
  AccessRevokedEventData,
  EventEnvelope,
  MemberUpdatedEventData,
  RouteFailedEventData,
  RouteReadyEventData,
  SocketAck,
  SubscriptionDto,
  TripChangedEventData,
  LocationUpdated,
  PresenceUpdated,
  GpsSample,
} from '../types';

export interface TripGpsSocketCallbacks {
  onLocationUpdated?: (data: EventEnvelope<LocationUpdated>) => void;
  onPresenceUpdated?: (data: EventEnvelope<PresenceUpdated>) => void;
  onMemberUpdated?: (data: EventEnvelope<MemberUpdatedEventData>) => void;
  onTripChanged?: (data: EventEnvelope<TripChangedEventData>) => void;
  onRouteReady?: (data: EventEnvelope<RouteReadyEventData>) => void;
  onRouteFailed?: (data: EventEnvelope<RouteFailedEventData>) => void;
  onAccessRevoked?: (data: EventEnvelope<AccessRevokedEventData>) => void;
  onConnect?: () => void;
  /** Called only after the server has accepted the trip-room subscription. */
  onSubscribed?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (err: any) => void;
}

export class TripGpsSocketService {
  private socket: Socket | null = null;
  private currentTripId: string | null = null;
  private token: string | null = null;
  private callbacks: TripGpsSocketCallbacks = {};
  private isRefreshing: boolean = false;
  private viewing = true;
  private protocolVersion: 1 | 2 = 1;
  private subscribeAttempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  public connect(token: string, tripId: string, callbacks: TripGpsSocketCallbacks, options?: { viewing: boolean; protocolVersion: 2 }) {
    if (this.socket) this.disconnect();
    this.token = token;
    this.currentTripId = tripId;
    this.callbacks = callbacks;
    this.viewing = options?.viewing ?? true;
    this.protocolVersion = options?.protocolVersion ?? 1;

    const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');

    try {
      this.socket = io(`${apiOrigin}/gps`, {
        path: '/socket.io',
        auth: (cb) => {
          cb({ token: this.token });
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        transports: ['websocket', 'polling'],
      });

      this.setupListeners();
    } catch (err) {
      console.warn('[TripGpsSocket] Init failed:', err);
      this.callbacks.onError?.(err);
    }
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[TripGpsSocket] Connected to /gps namespace');
      this.callbacks.onConnect?.();
      this.subscribeAttempts = 0;
      if (this.currentTripId && this.viewing) {
        this.subscribe(this.currentTripId).then((subscribed) => {
          if (subscribed) this.callbacks.onSubscribed?.();
        });
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[TripGpsSocket] Disconnected:', reason);
      this.callbacks.onDisconnect?.(reason);
      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (err: any) => {
      const serverCode = err?.data?.error?.code;
      const serverMsg = err?.data?.error?.message;
      const details = serverCode || serverMsg ? ` [${serverCode || ''}: ${serverMsg || ''}]` : '';
      console.warn('[TripGpsSocket] Connect error:', (err?.message || err) + details);

      const errorMessage = typeof err?.message === 'string' ? err.message : '';
      const isAuthError =
        errorMessage.includes('authentication failed') ||
        errorMessage.includes('Invalid or expired token') ||
        errorMessage.includes('jwt') ||
        errorMessage.includes('Unauthorized') ||
        serverCode === 'UNAUTHENTICATED' ||
        serverCode === 'GPS_AUTH_FAILED' ||
        serverCode === 'AUTH_FAILED';

      if (isAuthError && !this.isRefreshing) {
        const refreshingSocket = this.socket;
        const refreshingToken = this.token;
        this.isRefreshing = true;
        console.log('[TripGpsSocket] Auth error encountered. Auto-refreshing session token...');
        refreshSessionOnce()
          .then((renewed) => {
            if (this.socket !== refreshingSocket || this.token !== refreshingToken) return;
            if (renewed?.accessToken) {
              console.log('[TripGpsSocket] Session refreshed. Updating socket auth & reconnecting...');
              this.token = renewed.accessToken;
              if (this.socket) {
                this.socket.auth = { token: renewed.accessToken };
                this.socket.connect();
              }
            }
          })
          .catch((refreshErr) => {
            console.warn('[TripGpsSocket] Auto-refresh session for socket failed:', refreshErr);
          })
          .finally(() => {
            this.isRefreshing = false;
          });
      }

      this.callbacks.onError?.(err);
    });

    // Server Server-to-Client Events
    this.socket.on('gps:location.updated', (event: EventEnvelope<LocationUpdated>) => this.callbacks.onLocationUpdated?.(event));
    this.socket.on('gps:presence.updated', (event: EventEnvelope<PresenceUpdated>) => this.callbacks.onPresenceUpdated?.(event));
    this.socket.on('gps:member.updated', (event: EventEnvelope<MemberUpdatedEventData>) => {
      console.log('[TripGpsSocket] Received gps:member.updated:', event.data?.member?.fullName, event.data?.member?.userId);
      this.callbacks.onMemberUpdated?.(event);
    });

    this.socket.on('gps:trip.changed', (event: EventEnvelope<TripChangedEventData>) => {
      console.log('[TripGpsSocket] Received gps:trip.changed');
      this.callbacks.onTripChanged?.(event);
    });

    this.socket.on('gps:route.ready', (event: EventEnvelope<RouteReadyEventData>) => {
      this.callbacks.onRouteReady?.(event);
    });

    this.socket.on('gps:route.failed', (event: EventEnvelope<RouteFailedEventData>) => {
      this.callbacks.onRouteFailed?.(event);
    });

    this.socket.on('gps:access.revoked', (event: EventEnvelope<AccessRevokedEventData>) => {
      this.callbacks.onAccessRevoked?.(event);
    });
  }

  public subscribe(tripId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve(false);
        return;
      }

      const requestId = generateUUID();
      this.socket.timeout(10000).emit(
        'gps:subscribe',
        { requestId, tripId, ...(this.protocolVersion === 2 ? { protocolVersion: 2 } : {}) },
        (timeoutError: Error | null, ack: SocketAck<SubscriptionDto>) => {
          if (!timeoutError && ack && ack.ok) {
            this.subscribeAttempts = 0;
            console.log('[TripGpsSocket] Subscribed to trip:', tripId);
            resolve(true);
          } else {
            console.warn('[TripGpsSocket] Subscribe failed, will retry in 2s:', {
              tripId,
              code: ack && !ack.ok ? ack.error.code : undefined,
              message: ack && !ack.ok ? ack.error.message : undefined,
            });
            if (++this.subscribeAttempts <= 3 && this.viewing) this.retryTimer = setTimeout(() => {
              if (this.viewing && this.socket?.connected && this.currentTripId === tripId) {
                this.subscribe(tripId).then((subscribed) => {
                  if (subscribed) this.callbacks.onSubscribed?.();
                });
              }
            }, 2000);
            resolve(false);
          }
        }
      );
    });
  }

  public unsubscribe(tripId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve(false);
        return;
      }

      const requestId = generateUUID();
      this.socket.timeout(10000).emit(
        'gps:unsubscribe',
        { requestId, tripId },
        (timeoutError: Error | null, ack: SocketAck<{ tripId: string }>) => {
          resolve(!timeoutError && Boolean(ack?.ok));
        }
      );
    });
  }

  public disconnect() {
    clearTimeout(this.retryTimer);
    this.isRefreshing = false;
    if (this.currentTripId && this.socket?.connected) {
      this.unsubscribe(this.currentTripId).catch(() => {});
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  public setViewing(viewing: boolean) {
    if (this.viewing === viewing) return;
    this.viewing = viewing;
    clearTimeout(this.retryTimer);
    this.subscribeAttempts = 0;
    if (!this.currentTripId) return;
    if (viewing) void this.subscribe(this.currentTripId).then(ok => { if (ok) this.callbacks.onSubscribed?.(); });
    else void this.unsubscribe(this.currentTripId);
  }

  public publish(payload: { requestId: string; tripId: string; sessionId: string; deviceId: string; sequence: number; location: GpsSample }): Promise<{ applied: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) { reject(new Error('Socket chưa kết nối.')); return; }
      this.socket.timeout(10000).emit('gps:location.publish', payload, (error: Error | null, ack: SocketAck<{ applied: boolean }>) => {
        if (error) reject(error);
        else if (!ack?.ok) reject(Object.assign(new Error(ack?.error?.message ?? 'Không phát được vị trí.'), { code: ack?.error?.code }));
        else resolve(ack.data);
      });
    });
  }
}

export const tripGpsSocket = new TripGpsSocketService();
