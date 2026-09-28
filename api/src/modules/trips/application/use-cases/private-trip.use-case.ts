import { Injectable } from '@nestjs/common'
import { AppError, BOOKING_ERROR_CODES as B, COMMON_ERROR_CODES as C } from '../../../../shared/errors'
import { PrivateTripPort } from '../private-trip.port'
import type { PrivateTripInput, PrivateTripUpdate } from '../private-trip.port'
import type { Actor } from '../trip.types'

export function assertPrivateActor(actor: Actor | null | undefined): void {
  if (!actor || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor.id))
    throw AppError.fromCode(C.UNAUTHENTICATED)
  if (actor.status !== 'ACTIVE') throw AppError.fromCode(C.FORBIDDEN)
  if (actor.role === 'LEADER') throw AppError.fromCode(B.LEADER_CANNOT_CREATE_PRIVATE_TRIP)
  if (actor.role !== 'USER') throw AppError.fromCode(C.FORBIDDEN)
}
export function assertPrivateWindow(start: Date, end: Date, capacity: number, now = new Date()): void {
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    start <= now ||
    end <= start ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 2147483647
  )
    throw AppError.fromCode(C.VALIDATION_ERROR, { message: 'Require future start < end and positive capacity' })
}
@Injectable()
export class PrivateTripUseCase {
  constructor(private readonly store: PrivateTripPort) {}
  create(a: Actor, input: PrivateTripInput) {
    assertPrivateActor(a)
    assertPrivateWindow(new Date(input.startAt), new Date(input.endAt), input.capacity)
    return this.store.create(a.id, input)
  }
  update(a: Actor, id: string, input: PrivateTripUpdate) {
    assertPrivateActor(a)
    return this.store.update(a.id, id, input)
  }
  cancel(a: Actor, id: string, version: number, reason?: string) {
    assertPrivateActor(a)
    return this.store.cancel(a.id, id, version, reason)
  }
  invite(a: Actor, id: string, version: number, expiresAt?: string) {
    assertPrivateActor(a)
    return this.store.invite(a.id, id, version, expiresAt)
  }
  revoke(a: Actor, id: string, version: number) {
    assertPrivateActor(a)
    return this.store.revoke(a.id, id, version)
  }
  read(a: Actor, id?: string, page = 1) {
    assertPrivateActor(a)
    return this.store.read(a.id, id, page)
  }
  options(a: Actor, kind: 'PERSONAL' | 'SYSTEM' | 'PICKUP', page: number, destinationId?: string) {
    assertPrivateActor(a)
    return this.store.options(a.id, kind, page, destinationId)
  }
  access(a: Actor, id: string) {
    assertPrivateActor(a)
    return this.store.access(a.id, id)
  }
}
