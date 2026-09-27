import type { Issue, Trail, TripInput } from './trip.types'

export const OCCUPYING_STATES = ['DRAFT', 'OPEN', 'FULL', 'CLOSED', 'CANCEL_PENDING', 'IN_PROGRESS'] as const
export function routeIssues(required: string[], trails: Pick<Trail, 'id' | 'checkpointIds'>[]): Issue[] {
  const issue = (message: string): Issue[] => [{ code: 'INVALID_ROUTE', field: 'trails', message }]
  if (!required.length) return issue('Cần ít nhất một required checkpoint.')
  if (new Set(required).size !== required.length) return issue('Checkpoint không được trùng.')
  if (!trails.length) return issue('Cần ít nhất một System Trail.')
  if (new Set(trails.map((t) => t.id)).size !== trails.length) return issue('Trail không được trùng.')
  const route: string[] = []
  for (const trail of trails) {
    if (!trail.checkpointIds.length) return issue('Trail chưa có checkpoint để xác định đường đi.')
    if (route.length && route.at(-1) !== trail.checkpointIds[0])
      return issue('Các trail chưa nối tiếp tại cùng checkpoint.')
    route.push(...(route.length ? trail.checkpointIds.slice(1) : trail.checkpointIds))
  }
  let cursor = 0
  for (const id of route) if (id === required[cursor]) cursor++
  return cursor === required.length ? [] : issue('Route chưa đi qua required checkpoints đúng thứ tự.')
}
export function basicIssues(
  data: Pick<TripInput, 'startAt' | 'endAt' | 'capacity'> & { price: string | null },
  now: Date,
): Issue[] {
  const issues: Issue[] = []
  const start = Date.parse(data.startAt),
    end = Date.parse(data.endAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || start <= now.getTime())
    issues.push({
      code: 'INVALID_TIME',
      field: 'startAt',
      message: 'Ngày bắt đầu phải ở tương lai và trước ngày kết thúc.',
    })
  if (!Number.isInteger(data.capacity) || data.capacity <= 0 || data.capacity > 2147483647)
    issues.push({ code: 'INVALID_CAPACITY', field: 'capacity', message: 'Số người phải là số nguyên dương hợp lệ.' })
  if (!data.price || !/^\d{1,10}(\.\d{1,2})?$/.test(data.price) || !/[1-9]/.test(data.price))
    issues.push({
      code: 'INVALID_PRICE',
      field: 'price',
      message: 'Giá/người phải lớn hơn 0 và tối đa hai chữ số thập phân.',
    })
  return issues
}
