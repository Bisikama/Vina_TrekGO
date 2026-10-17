import { z } from 'zod'

const text = (max: number) => z.string().trim().min(1).max(max)
const phone = z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,28}[0-9]$/, 'Số điện thoại không hợp lệ')
const time = z.string().datetime({ offset: true })
export const transportIdSchema = z.string().uuid()
export const providerSchema = z.object({
  name: text(200),
  contactName: text(150).nullable().optional(),
  phone,
  email: z.string().trim().email().max(320).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
}).strict()
export const providerUpdateSchema = providerSchema.partial().extend({ status: z.enum(['ACTIVE', 'INACTIVE']).optional() })
  .refine(v => Object.keys(v).length > 0, 'Cần ít nhất một trường cập nhật')
export const providerPageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).strict()
export const transportCreateSchema = z.object({
  providerId: z.string().uuid(),
  vehicleType: text(80),
  seatCapacity: z.number().int().positive().max(2147483647),
  plateNumber: text(30).nullable().optional(),
  driverName: text(150).nullable().optional(),
  driverPhone: phone.nullable().optional(),
  meetingAt: time,
  departureAt: time.nullable().optional(),
  returnAt: time.nullable().optional(),
  note: text(2000).nullable().optional(),
  status: z.enum(['PLANNED', 'CONFIRMED']).default('PLANNED'),
}).strict()
export const transportUpdateSchema = transportCreateSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
  status: z.enum(['PLANNED', 'CONFIRMED', 'CANCELLED']).optional(),
}).strict().refine(v => Object.keys(v).some(k => k !== 'expectedVersion'), 'Cần ít nhất một trường cập nhật')
  .refine(v => v.status !== 'CANCELLED' || Object.keys(v).every(k => ['expectedVersion', 'status', 'note'].includes(k)),
    'Khi hủy chỉ gửi expectedVersion, status và note')
export type ProviderInput = z.infer<typeof providerSchema>
export type ProviderUpdate = z.infer<typeof providerUpdateSchema>
export type ProviderPage = z.infer<typeof providerPageSchema>
export type TransportInput = z.infer<typeof transportCreateSchema>
export type TransportUpdate = z.infer<typeof transportUpdateSchema>
