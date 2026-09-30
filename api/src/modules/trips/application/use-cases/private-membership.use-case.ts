import { Injectable } from '@nestjs/common'
import { AppError, COMMON_ERROR_CODES as C } from '../../../../shared/errors'
import { PrivateMembershipPort, MemberPage } from '../private-membership.port'
import type { Actor } from '../trip.types'

export function assertMemberActor(actor: Actor | null | undefined, joining = false): asserts actor is Actor {
  if (!actor || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor.id))
    throw AppError.fromCode(C.UNAUTHENTICATED)
  if (actor.status !== 'ACTIVE' || (joining && actor.role !== 'USER')) throw AppError.fromCode(C.FORBIDDEN)
}
@Injectable()
export class PrivateMembershipUseCase {
  constructor(private readonly store: PrivateMembershipPort) {}
  preview(code: string) {
    return this.store.preview(code)
  }
  join(a: Actor, code: string) {
    assertMemberActor(a, true)
    return this.store.join(a.id, code)
  }
  room(a: Actor, id: string) {
    assertMemberActor(a)
    return this.store.room(a.id, id)
  }
  members(a: Actor, id: string, page: MemberPage) {
    assertMemberActor(a)
    return this.store.members(a.id, id, page)
  }
  leave(a: Actor, id: string, v: number) {
    assertMemberActor(a)
    return this.store.leave(a.id, id, v)
  }
  remove(a: Actor, id: string, memberId: string, v: number) {
    assertMemberActor(a)
    return this.store.remove(a.id, id, memberId, v)
  }
}
