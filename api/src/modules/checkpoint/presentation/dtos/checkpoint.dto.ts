import { z } from 'zod'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { RecordStatus, CheckpointType } from '@prisma/client'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// =============================================================================
// QUERY SCHEMAS & DTOS (GET /checkpoints)
// =============================================================================

export const GetCheckpointsQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Trang phải lớn hơn hoặc bằng 1').default(1),
  pageSize: z.coerce.number().int().min(1).max(100, 'Số lượng mỗi trang tối đa 100').default(20),
  destinationId: z
    .string({ message: 'ID địa danh (destinationId) là bắt buộc' })
    .regex(UUID_REGEX, 'ID địa danh không hợp lệ'),
  checkpointType: z
    .nativeEnum(CheckpointType, {
      message: 'Loại trạm không hợp lệ (START | CAMPSITE | SUMMIT | WATER_SOURCE | VIEWPOINT | END)',
    })
    .optional(),
  keyword: z.string().trim().max(100, 'Từ khóa tìm kiếm tối đa 100 ký tự').optional(),
  status: z
    .nativeEnum(RecordStatus, {
      message: 'Trạng thái không hợp lệ (ACTIVE | INACTIVE | ARCHIVED)',
    })
    .optional(),
})

export type GetCheckpointsQueryDto = z.infer<typeof GetCheckpointsQuerySchema>

// =============================================================================
// CREATE SCHEMAS & DTOS (POST /checkpoints)
// =============================================================================

export const CreateCheckpointSchema = z.object({
  destinationId: z
    .string({ message: 'ID địa danh (destinationId) là bắt buộc' })
    .regex(UUID_REGEX, 'ID địa danh phải là UUID hợp lệ'),
  code: z
    .string()
    .trim()
    .max(50, 'Mã trạm tối đa 50 ký tự')
    .toUpperCase()
    .nullable()
    .optional(),
  name: z
    .string({ message: 'Tên trạm dừng chân là bắt buộc' })
    .trim()
    .min(1, 'Tên trạm không được để trống')
    .max(200, 'Tên trạm tối đa 200 ký tự'),
  description: z.string().trim().max(2000, 'Mô tả tối đa 2000 ký tự').nullable().optional(),
  latitude: z.coerce
    .number({ message: 'Vĩ độ (latitude) là bắt buộc' })
    .min(-90, 'Vĩ độ phải từ -90 đến 90')
    .max(90, 'Vĩ độ phải từ -90 đến 90'),
  longitude: z.coerce
    .number({ message: 'Kinh độ (longitude) là bắt buộc' })
    .min(-180, 'Kinh độ phải từ -180 đến 180')
    .max(180, 'Kinh độ phải từ -180 đến 180'),
  defaultRadiusMeters: z.coerce
    .number()
    .int('Bán kính phải là số nguyên')
    .min(5, 'Bán kính quét tối thiểu 5 mét')
    .max(2000, 'Bán kính quét tối đa 2000 mét')
    .default(50)
    .optional(),
  checkpointType: z
    .nativeEnum(CheckpointType, {
      message: 'Loại trạm không hợp lệ (START | CAMPSITE | SUMMIT | WATER_SOURCE | VIEWPOINT | END)',
    })
    .nullable()
    .optional(),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE).optional(),
})

export type CreateCheckpointDto = z.infer<typeof CreateCheckpointSchema>

export class CreateCheckpointRequestDto implements CreateCheckpointDto {
  @ApiProperty({
    example: 'd1000000-0000-0000-0000-000000000001',
    description: 'UUID của điểm đến (Destination)',
  })
  destinationId!: string

  @ApiPropertyOptional({
    example: 'FAN-CP-2800',
    description: 'Mã định danh duy nhất của trạm dừng chân',
  })
  code?: string | null

  @ApiProperty({
    example: 'Trạm dừng chân 2.800m',
    description: 'Tên trạm dừng chân / điểm mốc',
  })
  name!: string

  @ApiPropertyOptional({
    example: 'Điểm hạ trại và tiếp nước chính trước khi lên đỉnh Fansipan',
    description: 'Mô tả chi tiết về điểm mốc',
  })
  description?: string | null

  @ApiProperty({
    example: 22.3155,
    description: 'Vĩ độ GPS (-90 đến 90)',
  })
  latitude!: number

  @ApiProperty({
    example: 103.7745,
    description: 'Kinh độ GPS (-180 đến 180)',
  })
  longitude!: number

  @ApiPropertyOptional({
    example: 50,
    default: 50,
    description: 'Bán kính nhận diện geofence quét check-in (mét)',
  })
  defaultRadiusMeters?: number

  @ApiPropertyOptional({
    enum: CheckpointType,
    example: CheckpointType.CAMPSITE,
    description: 'Phân loại trạm dừng chân',
  })
  checkpointType?: CheckpointType | null

  @ApiPropertyOptional({
    enum: RecordStatus,
    default: RecordStatus.ACTIVE,
    description: 'Trạng thái hoạt động',
  })
  status?: RecordStatus
}

// =============================================================================
// UPDATE SCHEMAS & DTOS (PATCH /checkpoints/:id)
// =============================================================================

export const UpdateCheckpointSchema = CreateCheckpointSchema.partial()

export type UpdateCheckpointDto = z.infer<typeof UpdateCheckpointSchema>

export class UpdateCheckpointRequestDto implements UpdateCheckpointDto {
  @ApiPropertyOptional({
    example: 'd1000000-0000-0000-0000-000000000001',
    description: 'UUID của điểm đến mới',
  })
  destinationId?: string

  @ApiPropertyOptional({
    example: 'FAN-CP-2800-REV1',
    description: 'Mã định danh trạm dừng chân',
  })
  code?: string | null

  @ApiPropertyOptional({
    example: 'Lán nghỉ 2.800m (Trạm Fansipan)',
    description: 'Tên trạm dừng chân',
  })
  name?: string

  @ApiPropertyOptional({
    example: 'Đã bổ sung thêm khu vực cắm trại và nguồn nước',
    description: 'Mô tả chi tiết',
  })
  description?: string | null

  @ApiPropertyOptional({
    example: 22.3156,
    description: 'Vĩ độ GPS',
  })
  latitude?: number

  @ApiPropertyOptional({
    example: 103.7746,
    description: 'Kinh độ GPS',
  })
  longitude?: number

  @ApiPropertyOptional({
    example: 60,
    description: 'Bán kính nhận diện geofence (mét)',
  })
  defaultRadiusMeters?: number

  @ApiPropertyOptional({
    enum: CheckpointType,
    example: CheckpointType.CAMPSITE,
    description: 'Phân loại trạm dừng chân',
  })
  checkpointType?: CheckpointType | null

  @ApiPropertyOptional({
    enum: RecordStatus,
    description: 'Trạng thái hoạt động',
  })
  status?: RecordStatus
}

// =============================================================================
// RESPONSE DTOS
// =============================================================================

export class CheckpointDestinationDto {
  @ApiProperty({ example: 'd1000000-0000-0000-0000-000000000001' })
  id!: string

  @ApiProperty({ example: 'Fansipan' })
  name!: string

  @ApiPropertyOptional({ example: 'NORTH' })
  region?: string | null
}

export class CheckpointResponseDto {
  @ApiProperty({ example: 'c1000000-0000-0000-0000-000000000001', description: 'UUID điểm mốc' })
  id!: string

  @ApiProperty({ example: 'd1000000-0000-0000-0000-000000000001', description: 'UUID điểm đến' })
  destinationId!: string

  @ApiPropertyOptional({ example: 'FAN-CP-2800', description: 'Mã định danh trạm' })
  code?: string | null

  @ApiProperty({ example: 'Trạm dừng chân 2.800m', description: 'Tên trạm' })
  name!: string

  @ApiPropertyOptional({ example: 'Điểm hạ trại và tiếp nước chính' })
  description?: string | null

  @ApiProperty({ example: 22.3155, description: 'Vĩ độ GPS' })
  latitude!: number

  @ApiProperty({ example: 103.7745, description: 'Kinh độ GPS' })
  longitude!: number

  @ApiProperty({ example: 50, description: 'Bán kính quét geofence (mét)' })
  defaultRadiusMeters!: number

  @ApiPropertyOptional({ enum: CheckpointType, example: CheckpointType.CAMPSITE })
  checkpointType?: string | null

  @ApiProperty({ enum: RecordStatus, example: RecordStatus.ACTIVE })
  status!: RecordStatus

  @ApiPropertyOptional({ type: CheckpointDestinationDto, description: 'Thông tin địa danh liên kết' })
  destination?: CheckpointDestinationDto

  @ApiPropertyOptional({ example: 2, description: 'Số lượng cung đường đang đi qua trạm này' })
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

export class PaginatedCheckpointResponseDto {
  @ApiProperty({ type: [CheckpointResponseDto], description: 'Danh sách các điểm mốc checkpoint' })
  items!: CheckpointResponseDto[]

  @ApiProperty({ type: PaginationMetaDto, description: 'Thông tin phân trang' })
  pagination!: PaginationMetaDto
}
