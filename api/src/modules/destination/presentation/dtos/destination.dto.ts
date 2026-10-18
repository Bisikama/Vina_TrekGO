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

export const CreatePickupPointItemSchema = z.object({
  name: z
    .string({ message: 'Tên điểm tập kết là bắt buộc' })
    .trim()
    .min(1, 'Tên điểm tập kết không được để trống')
    .max(200, 'Tên điểm tập kết tối đa 200 ký tự'),
  address: z
    .string({ message: 'Địa chỉ điểm tập kết là bắt buộc' })
    .trim()
    .min(1, 'Địa chỉ điểm tập kết không được để trống'),
  latitude: z.coerce
    .number({ message: 'Vĩ độ điểm tập kết là bắt buộc' })
    .min(-90, 'Vĩ độ phải từ -90 đến 90')
    .max(90, 'Vĩ độ phải từ -90 đến 90'),
  longitude: z.coerce
    .number({ message: 'Kinh độ điểm tập kết là bắt buộc' })
    .min(-180, 'Kinh độ phải từ -180 đến 180')
    .max(180, 'Kinh độ phải từ -180 đến 180'),
  code: z.string().trim().max(50, 'Mã điểm đón tối đa 50 ký tự').nullable().optional(),
  note: z.string().trim().max(1000, 'Ghi chú tối đa 1000 ký tự').nullable().optional(),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE).optional(),
})
export type CreatePickupPointItemDto = z.infer<typeof CreatePickupPointItemSchema>

export const UpdatePickupPointItemSchema = CreatePickupPointItemSchema.extend({
  id: z.string().uuid('ID điểm tập kết phải là UUID hợp lệ').optional(),
})
export type UpdatePickupPointItemDto = z.infer<typeof UpdatePickupPointItemSchema>

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
  pickupPoints: z.array(CreatePickupPointItemSchema).optional(),
})
export type CreateDestinationDto = z.infer<typeof CreateDestinationSchema>

export class CreatePickupPointItemRequestDto implements CreatePickupPointItemDto {
  @ApiProperty({ example: 'Bến xe Mỹ Đình', description: 'Tên điểm tập kết / đón trả khách' })
  name!: string

  @ApiProperty({ example: '20 Phạm Hùng, Mỹ Đình 2, Nam Từ Liêm, Hà Nội', description: 'Địa chỉ đón' })
  address!: string

  @ApiProperty({ example: 21.0285, description: 'Vĩ độ' })
  latitude!: number

  @ApiProperty({ example: 105.7781, description: 'Kinh độ' })
  longitude!: number

  @ApiPropertyOptional({ example: 'PKP-MYDINH', description: 'Mã định danh (tự sinh nếu để trống)' })
  code?: string | null

  @ApiPropertyOptional({ example: 'Tập trung tại cổng số 2 lúc 5h30 sáng' })
  note?: string | null

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ACTIVE })
  status?: RecordStatus
}

export class UpdatePickupPointItemRequestDto
  extends CreatePickupPointItemRequestDto
  implements UpdatePickupPointItemDto
{
  @ApiPropertyOptional({ example: 'e8a1d7f1-0000-4000-8000-000000000001', description: 'UUID điểm đón đã có' })
  id?: string
}

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

  @ApiPropertyOptional({ type: [CreatePickupPointItemRequestDto], description: 'Danh sách điểm tập kết ban đầu' })
  pickupPoints?: CreatePickupPointItemDto[]
}

export const UpdateDestinationSchema = CreateDestinationSchema.omit({ pickupPoints: true })
  .partial()
  .extend({
    pickupPoints: z.array(UpdatePickupPointItemSchema).optional(),
  })
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

  @ApiPropertyOptional({ type: [UpdatePickupPointItemRequestDto], description: 'Danh sách điểm tập kết cập nhật' })
  pickupPoints?: UpdatePickupPointItemDto[]
}

// Response
export class PickupPointResponseDto {
  @ApiProperty({ example: 'p1000000-0000-0000-0000-000000000001', description: 'UUID điểm tập kết' })
  id!: string

  @ApiPropertyOptional({ example: 'd1000000-0000-0000-0000-000000000001' })
  destinationId?: string | null

  @ApiProperty({ example: 'PKP-MYDINH', description: 'Mã định danh' })
  code!: string

  @ApiProperty({ example: 'Bến xe Mỹ Đình', description: 'Tên điểm tập kết' })
  name!: string

  @ApiProperty({ example: '20 Phạm Hùng, Mỹ Đình 2, Nam Từ Liêm, Hà Nội' })
  address!: string

  @ApiProperty({ example: 21.0285 })
  latitude!: number

  @ApiProperty({ example: 105.7781 })
  longitude!: number

  @ApiPropertyOptional({ example: 'Tập trung lúc 5h30 sáng' })
  note?: string | null

  @ApiProperty({ enum: RecordStatus, example: RecordStatus.ACTIVE })
  status!: RecordStatus

  @ApiProperty({ example: '2026-03-01T08:00:00.000Z' })
  createdAt!: Date

  @ApiProperty({ example: '2026-03-01T08:00:00.000Z' })
  updatedAt!: Date
}

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

  @ApiPropertyOptional({ example: 2, description: 'Số lượng điểm tập kết trực thuộc' })
  pickupPointCount?: number

  @ApiPropertyOptional({ type: [PickupPointResponseDto], description: 'Danh sách các điểm tập kết' })
  pickupPoints?: PickupPointResponseDto[]

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
