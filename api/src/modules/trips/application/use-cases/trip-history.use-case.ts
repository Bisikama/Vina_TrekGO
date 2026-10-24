import { Injectable } from '@nestjs/common'
import { TripHistoryPort } from '../trip-history.port'
import type { HistoryTripType } from '../trip-history.port'
import type { Actor, Page } from '../trip.types'
import { assertPrivateActor } from './private-trip.use-case'

@Injectable()
export class TripHistoryUseCase {
  constructor(private readonly store: TripHistoryPort) {}

  list(actor: Actor, type: HistoryTripType, page: Page) {
    assertPrivateActor(actor, true)
    return this.store.list(actor.id, type, page)
  }
}
