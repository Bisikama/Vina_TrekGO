import type { Issue, Trail, TripInput } from './trip.types'

export const OCCUPYING_STATES = ['DRAFT', 'OPEN', 'FULL', 'CLOSED', 'CANCEL_PENDING', 'IN_PROGRESS'] as const
export const DEFAULT_REGISTRATION_LEAD_MS = 48 * 60 * 60 * 1000
export const MIN_REGISTRATION_LEAD_MS = 24 * 60 * 60 * 1000

export function resolveDefaultRegistrationDeadline(startAtIso: string): string {
  const startMs = Date.parse(startAtIso)
  return new Date(startMs - DEFAULT_REGISTRATION_LEAD_MS).toISOString()
}

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
  data: Pick<TripInput, 'startAt' | 'endAt' | 'capacity' | 'registrationOpenAt' | 'registrationDeadlineAt'> & {
    price?: string | null
    minPax?: number
  },
  now: Date,
  options: { requirePrice?: boolean } = { requirePrice: true },
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
  if (Number.isFinite(start)) {
    const maxAllowedDeadline = start - MIN_REGISTRATION_LEAD_MS
    let effectiveDeadline = start - DEFAULT_REGISTRATION_LEAD_MS
    if (data.registrationDeadlineAt !== undefined && data.registrationDeadlineAt !== null) {
      const deadline = Date.parse(data.registrationDeadlineAt)
      if (!Number.isFinite(deadline) || deadline > maxAllowedDeadline) {
        issues.push({
          code: 'INVALID_TIME',
          field: 'registrationDeadlineAt',
          message: 'Hạn chót đóng form đăng ký phải trước giờ khởi hành ít nhất 1 ngày (24 giờ).',
        })
      } else {
        effectiveDeadline = deadline
      }
    }
    if (data.registrationOpenAt !== undefined && data.registrationOpenAt !== null) {
      const open = Date.parse(data.registrationOpenAt)
      if (!Number.isFinite(open) || open >= effectiveDeadline) {
        issues.push({
          code: 'INVALID_TIME',
          field: 'registrationOpenAt',
          message: 'Giờ mở đăng ký phải trước hạn chót đóng form đăng ký.',
        })
      }
    }
  }
  if (!Number.isInteger(data.capacity) || data.capacity <= 0 || data.capacity > 2147483647)
    issues.push({ code: 'INVALID_CAPACITY', field: 'capacity', message: 'Số người phải là số nguyên dương hợp lệ.' })
  if (
    data.minPax !== undefined &&
    (!Number.isInteger(data.minPax) || data.minPax <= 0 || data.minPax > data.capacity)
  ) {
    issues.push({
      code: 'INVALID_CAPACITY',
      field: 'minPax',
      message: 'Số khách tối thiểu phải nguyên dương và không vượt quá sức chứa tối đa.',
    })
  }
  const hasPrice = data.price !== undefined && data.price !== null
  if (options.requirePrice || hasPrice) {
    if (!data.price || !/^\d{1,10}$/.test(data.price) || !/[1-9]/.test(data.price))
      issues.push({
        code: 'INVALID_PRICE',
        field: 'price',
        message: 'Giá/người phải là số nguyên dương, tối đa 10 chữ số.',
      })
  }
  return issues
}
