import { z } from 'zod'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { RecordStatus } from '@prisma/client'


// REQUEST
export const GetDestinationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Trang phải lớn hơn hoặc bằng 1').default(1),
  pageSize: z.coerce.number().int().min(1).max(100, 'Số lượng mỗi trang tối đa 100').default(20),
  keyword: z.string().trim().max(100, 'Từ khóa tìm kiếm tối đa 100 ký tự').optional(),
  region: z.string().trim().max(150, 'Tên vùng tối đa 150 ký tự').optional(),
  status: z
    .nativeEnum(RecordStatus, {
      message: 'Trạng thái không hợp lệ (ACTIVE | INACTIVE | ARCHIVED)',
    })
    .optional(),
})
export type GetDestinationsQueryDto = z.infer<typeof GetDestinationsQuerySchema>

export const CreateDestinationSchema = z.object({
  name: z
    .string({ message: 'Tên địa danh là bắt buộc' })
    .trim()
    .min(1, 'Tên địa danh không được để trống')
    .max(200, 'Tên địa danh tối đa 200 ký tự'),
  description: z.string().trim().max(2000, 'Mô tả tối đa 2000 ký tự').nullable().optional(),
  region: z.string().trim().max(150, 'Khu vực tối đa 150 ký tự').nullable().optional(),
  centerLat: z.coerce
    .number()
    .min(-90, 'Vĩ độ phải từ -90 đến 90')
    .max(90, 'Vĩ độ phải từ -90 đến 90')
    .nullable()
    .optional(),
  centerLng: z.coerce
    .number()
    .min(-180, 'Kinh độ phải từ -180 đến 180')
    .max(180, 'Kinh độ phải từ -180 đến 180')
    .nullable()
    .optional(),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE).optional(),
})
export type CreateDestinationDto = z.infer<typeof CreateDestinationSchema>

// Class dùng riêng cho Swagger UI hiển thị form nhập của Create:
export class CreateDestinationRequestDto implements CreateDestinationDto {
  @ApiProperty({ example: 'Tà Xùa', description: 'Tên địa danh trekking' })
  name!: string

  @ApiPropertyOptional({ example: 'Thiên đường săn mây Bắc Yên, Sơn La' })
  description?: string | null

  @ApiPropertyOptional({ example: 'NORTH' })
  region?: string | null

  @ApiPropertyOptional({ example: 21.2833, description: 'Vĩ độ' })
  centerLat?: number | null

  @ApiPropertyOptional({ example: 104.3833, description: 'Kinh độ' })
  centerLng?: number | null

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ACTIVE })
  status?: RecordStatus
}


export const UpdateDestinationSchema = CreateDestinationSchema.partial()
export type UpdateDestinationDto = z.infer<typeof UpdateDestinationSchema>

export class UpdateDestinationRequestDto implements UpdateDestinationDto {
  @ApiPropertyOptional({ example: 'Tà Xùa - Sơn La', description: 'Tên địa danh' })
  name?: string

  @ApiPropertyOptional({ example: 'Thiên đường săn mây Bắc Yên' })
  description?: string | null

  @ApiPropertyOptional({ example: 'NORTH' })
  region?: string | null

  @ApiPropertyOptional({ example: 21.2833 })
  centerLat?: number | null

  @ApiPropertyOptional({ example: 104.3833 })
  centerLng?: number | null

  @ApiPropertyOptional({ enum: RecordStatus })
  status?: RecordStatus
}


// Response

export class DestinationResponseDto {
  @ApiProperty({ example: 'd1000000-0000-0000-0000-000000000001', description: 'UUID điểm đến' })
  id!: string

  @ApiProperty({ example: 'Núi Bà Đen', description: 'Tên địa danh' })
  name!: string

  @ApiPropertyOptional({ example: 'Nóc nhà Đông Nam Bộ, cao 986m' })
  description?: string | null

  @ApiPropertyOptional({ example: 'SOUTH' })
  region?: string | null

  @ApiPropertyOptional({ example: 11.3789, description: 'Vĩ độ tâm bản đồ' })
  centerLat?: number | null

  @ApiPropertyOptional({ example: 106.1712, description: 'Kinh độ tâm bản đồ' })
  centerLng?: number | null

  @ApiProperty({ enum: RecordStatus, example: RecordStatus.ACTIVE })
  status!: RecordStatus

  @ApiPropertyOptional({ example: 3, description: 'Số lượng cung đường trực thuộc' })
  trailCount?: number

  @ApiProperty({ example: '2026-03-01T08:00:00.000Z' })
  createdAt!: Date

  @ApiProperty({ example: '2026-03-01T08:00:00.000Z' })
  updatedAt!: Date
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Trang hiện tại' })
  page!: number

  @ApiProperty({ example: 20, description: 'Số bản ghi trên mỗi trang' })
  pageSize!: number

  @ApiProperty({ example: 45, description: 'Tổng số bản ghi' })
  totalItems!: number

  @ApiProperty({ example: 3, description: 'Tổng số trang' })
  totalPages!: number
}

export class PaginatedDestinationResponseDto {
  @ApiProperty({ type: [DestinationResponseDto], description: 'Danh sách các điểm đến' })
  items!: DestinationResponseDto[]

  @ApiProperty({ type: PaginationMetaDto, description: 'Thông tin phân trang' })
  pagination!: PaginationMetaDto
}
