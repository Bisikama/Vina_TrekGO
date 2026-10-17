import { z } from 'zod'
import { BadRequestException } from '@nestjs/common'
const uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Invalid UUID')
const datetime = z.string().datetime({ offset: true })
const basic = z.object({
  destinationId: uuid,
  title: z.string().trim().min(1).max(220),
  description: z.string().trim().max(5000).nullable().optional(),
  priceExplanation: z.string().trim().max(5000).nullable().optional()
    .describe('Cơ sở tính giá nội bộ: chi phí chung, chi phí/người, số khách dự toán, dự phòng và lợi nhuận. Có thể bỏ trống khi lưu nháp; bắt buộc trước khi publish. Không hiển thị công khai.'),
  startAt: datetime,
  endAt: datetime,
  pickupPointId: uuid,
  capacity: z.number().int().positive().max(2147483647),
  price: z
    .string()
    .regex(/^\d{1,10}$/, 'Giá phải là số nguyên dương, tối đa 10 chữ số')
    .refine((v) => /[1-9]/.test(v), 'Giá phải lớn hơn 0')
    .describe('Giá VND/người cho toàn bộ chuyến đi, là số nguyên dương dạng chuỗi. Ví dụ: "700000".'),
})
export const createSchema = basic.strict()
export const versionSchema = z.object({ expectedVersion: z.number().int().positive() }).strict()
export const updateSchema = basic.partial().extend({ expectedVersion: z.number().int().positive() }).strict()
export const checkpointsSchema = versionSchema.extend({ checkpointIds: z.array(uuid).max(100) }).strict()
export const trailsSchema = versionSchema.extend({ trailIds: z.array(uuid).max(50) }).strict()
export const cancelSchema = versionSchema
  .extend({
    reason: z.string().trim().min(1).max(2000),
    evidenceUrls: z.array(z.string().url().max(2048)).max(10).default([]),
  })
  .strict()
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  destinationId: uuid.optional(),
})
export const conflictSchema = z.object({ startAt: datetime, endAt: datetime, excludeTripId: uuid.optional() }).strict()
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dữ liệu đầu vào không hợp lệ.',
      issues: result.error.issues.map((i) => ({
        code: 'VALIDATION_ERROR',
        field: i.path.join('.'),
        message: i.message,
      })),
    })
  return result.data
}
