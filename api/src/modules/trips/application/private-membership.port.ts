export interface MemberPage {
  page: number
  pageSize: number
  status: 'ACTIVE' | 'LEFT' | 'REMOVED' | 'COMPLETED' | 'NO_SHOW' | 'ALL'
}
export abstract class PrivateMembershipPort {
  abstract preview(code: string): Promise<unknown>
  abstract join(userId: string, code: string): Promise<unknown>
  abstract listMine(userId: string, page: Pick<MemberPage, 'page' | 'pageSize'>): Promise<unknown>
  abstract room(userId: string, tripId: string): Promise<unknown>
  abstract members(userId: string, tripId: string, page: MemberPage): Promise<unknown>
  abstract leave(userId: string, tripId: string, expectedVersion: number): Promise<unknown>
  abstract remove(userId: string, tripId: string, memberId: string, expectedVersion: number): Promise<unknown>
}
