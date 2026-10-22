import type { Page } from './trip.types'

export type HistoryTripType = 'PUBLIC' | 'PRIVATE'
export interface TripHistoryItem {
  id: string
  tripType: HistoryTripType
  title: string
  status: string
  startAt: Date
  endAt: Date
  completedAt: Date | null
  cancelledAt: Date | null
  destination: { id: string; name: string }
}
export interface TripHistoryPage extends Page {
  items: TripHistoryItem[]
  total: number
  totalPages: number
}
export abstract class TripHistoryPort {
  abstract list(userId: string, type: HistoryTripType, page: Page): Promise<TripHistoryPage>
}
