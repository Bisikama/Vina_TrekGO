import { z } from 'zod'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DifficultyLevel, RecordStatus } from '@prisma/client'

// ============================================================================
// 1. ZOD SCHEMAS (Validation Request)
// ============================================================================

export const TrailCheckpointInputSchema = z.object({
  checkpointId: z.string().uuid('ID checkpoint phải là UUID hợp lệ'),
  sequence: z.number().int().min(1, 'Thứ tự checkpoint phải bắt đầu từ 1'),
  isRequired: z.boolean().optional(),
})

/** Schema validate query params khi lấy danh sách System Trails */
export const GetSystemTrailsQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Trang phải lớn hơn hoặc bằng 1').default(1),
  pageSize: z.coerce.number().int().min(1).max(100, 'Số lượng mỗi trang tối đa 100').default(20),
  destinationId: z.string().uuid('ID địa danh phải là UUID hợp lệ').optional(),
  keyword: z.string().trim().max(100, 'Từ khóa tìm kiếm tối đa 100 ký tự').optional(),
  difficulty: z.nativeEnum(DifficultyLevel, {
    message: 'Độ khó không hợp lệ (EASY | MEDIUM | HARD | EXTREME)',
  }).optional(),
  status: z.nativeEnum(RecordStatus, {
    message: 'Trạng thái không hợp lệ (ACTIVE | INACTIVE | ARCHIVED)',
  }).optional(),
  minDistance: z.coerce.number().min(0, 'Khoảng cách tối thiểu phải >= 0').optional(),
  maxDistance: z.coerce.number().min(0, 'Khoảng cách tối đa phải >= 0').optional(),
})
export type GetSystemTrailsQueryDto = z.infer<typeof GetSystemTrailsQuerySchema>

/** Schema validate body khi tạo mới System Trail */
export const CreateSystemTrailSchema = z.object({
  destinationId: z.string().uuid('ID điểm đến phải là UUID hợp lệ'),
  code: z
    .string({ message: 'Mã cung đường là bắt buộc' })
    .trim()
    .min(3, 'Mã cung đường tối thiểu 3 ký tự')
    .max(50, 'Mã cung đường tối đa 50 ký tự')
    .regex(/^[A-Z0-9_-]+$/, 'Mã cung đường chỉ gồm chữ in hoa, chữ số, gạch nối hoặc gạch dưới'),
  name: z
    .string({ message: 'Tên cung đường là bắt buộc' })
    .trim()
    .min(1, 'Tên cung đường không được để trống')
    .max(200, 'Tên cung đường tối đa 200 ký tự'),
  description: z.string().trim().max(5000, 'Mô tả tối đa 5000 ký tự').nullable().optional(),
  difficulty: z.nativeEnum(DifficultyLevel, {
    message: 'Độ khó không hợp lệ (EASY | MEDIUM | HARD | EXTREME)',
  }),
  distanceKm: z.coerce.number().positive('Khoảng cách phải lớn hơn 0'),
  elevationGainM: z.coerce.number().int().min(0, 'Độ dốc leo tích lũy phải >= 0').nullable().optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(0, 'Thời gian ước tính phải >= 0').nullable().optional(),
  price: z.coerce.number().min(0, 'Giá phải lớn hơn hoặc bằng 0').default(0).optional(),
  routeGeojson: z.any().refine((val) => typeof val === 'object' && val !== null, {
    message: 'routeGeojson phải là một đối tượng GeoJSON hợp lệ',
  }),
  checkpoints: z.array(TrailCheckpointInputSchema).optional(),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE).optional(),
})
export type CreateSystemTrailDto = z.infer<typeof CreateSystemTrailSchema>

/** Schema validate body khi cập nhật System Trail */
export const UpdateSystemTrailSchema = CreateSystemTrailSchema.partial()
export type UpdateSystemTrailDto = z.infer<typeof UpdateSystemTrailSchema>

// ============================================================================
// 2. SWAGGER REQUEST DTOs
// ============================================================================

export class TrailCheckpointInputDto {
  @ApiProperty({ example: 'cp100000-0000-0000-0000-000000000001', description: 'UUID của Checkpoint' })
  checkpointId!: string

  @ApiProperty({ example: 1, description: 'Thứ tự trạm dừng trong cung đường' })
  sequence!: number

  @ApiPropertyOptional({ example: true, default: false, description: 'Có bắt buộc đi qua không' })
  isRequired?: boolean
}

export class CreateSystemTrailRequestDto implements CreateSystemTrailDto {
  @ApiProperty({ example: 'd1000000-0000-0000-0000-000000000001', description: 'UUID điểm đến' })
  destinationId!: string

  @ApiProperty({ example: 'TRAIL_BADEN_COTDIEN', description: 'Mã cung đường duy nhất' })
  code!: string

  @ApiProperty({ example: 'Cung đường Cột Điện - Đỉnh Núi Bà Đen', description: 'Tên cung đường' })
  name!: string

  @ApiPropertyOptional({ example: 'Cung trekking phổ biến và rõ đường nhất tại Núi Bà Đen' })
  description?: string | null

  @ApiProperty({ enum: DifficultyLevel, example: DifficultyLevel.MEDIUM })
  difficulty!: DifficultyLevel

  @ApiProperty({ example: 4.5, description: 'Độ dài cung đường (km)' })
  distanceKm!: number

  @ApiPropertyOptional({ example: 941, description: 'Độ cao dốc leo tích lũy (mét)' })
  elevationGainM?: number | null

  @ApiPropertyOptional({ example: 240, description: 'Thời gian ước tính hoàn thành (phút)' })
  estimatedDurationMinutes?: number | null

  @ApiPropertyOptional({ example: 0, description: 'Giá bản đồ số (VND)' })
  price?: number

  @ApiProperty({
    description: 'Đối tượng GeoJSON (LineString / FeatureCollection)',
    example: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Đường mòn Cột Điện' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [106.1785, 11.3652, 45.0],
              [106.1698, 11.3838, 986.0],
            ],
          },
        },
      ],
    },
  })
  routeGeojson!: any

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ACTIVE })
  status?: RecordStatus
}

export class UpdateSystemTrailRequestDto implements UpdateSystemTrailDto {
  @ApiPropertyOptional({ example: 'd1000000-0000-0000-0000-000000000001' })
  destinationId?: string

  @ApiPropertyOptional({ example: 'TRAIL_BADEN_COTDIEN' })
  code?: string

  @ApiPropertyOptional({ example: 'Cung đường Cột Điện - Đỉnh Núi Bà Đen' })
  name?: string

  @ApiPropertyOptional({ example: 'Mô tả cập nhật' })
  description?: string | null

  @ApiPropertyOptional({ enum: DifficultyLevel })
  difficulty?: DifficultyLevel

  @ApiPropertyOptional({ example: 5.0 })
  distanceKm?: number

  @ApiPropertyOptional({ example: 950 })
  elevationGainM?: number | null

  @ApiPropertyOptional({ example: 250 })
  estimatedDurationMinutes?: number | null

  @ApiPropertyOptional({ example: 50000 })
  price?: number

  @ApiPropertyOptional({ description: 'GeoJSON cập nhật' })
  routeGeojson?: any

  @ApiPropertyOptional({ type: [TrailCheckpointInputDto] })
  checkpoints?: TrailCheckpointInputDto[]

  @ApiPropertyOptional({ enum: RecordStatus })
  status?: RecordStatus
}

// ============================================================================
// 3. SWAGGER RESPONSE DTOs
// ============================================================================

export class CheckpointItemDto {
  @ApiProperty({ example: 'cp-uuid-1' })
  id!: string

  @ApiPropertyOptional({ example: 'CP_BADEN_START' })
  code?: string | null

  @ApiProperty({ example: 'Cột số 1 - Chân núi (Điểm xuất phát)' })
  name!: string

  @ApiPropertyOptional({ example: 'Điểm gửi xe và bắt đầu cung đường Cột Điện' })
  description?: string | null

  @ApiProperty({ example: 1 })
  sequence!: number

  @ApiProperty({ example: true })
  isRequired!: boolean

  @ApiProperty({ example: 11.3652 })
  latitude!: number

  @ApiProperty({ example: 106.1785 })
  longitude!: number

  @ApiProperty({ example: 40, description: 'Bán kính tính bằng mét' })
  radiusMeters!: number
}

export class SystemTrailSummaryDto {
  @ApiProperty({ example: 'c1000000-0000-0000-0000-000000000001' })
  id!: string

  @ApiProperty({ example: 'TRAIL_BADEN_COTDIEN' })
  code!: string

  @ApiProperty({ example: 'Cung đường Cột Điện - Đỉnh Núi Bà Đen' })
  name!: string

  @ApiPropertyOptional({ example: 'Cung trekking phổ biến và rõ đường nhất tại Núi Bà Đen' })
  description?: string | null

  @ApiProperty({ enum: DifficultyLevel, example: DifficultyLevel.MEDIUM })
  difficulty!: DifficultyLevel

  @ApiProperty({ example: 4.5, description: 'Độ dài cung đường tính bằng km' })
  distanceKm!: number

  @ApiPropertyOptional({ example: 941, description: 'Độ cao dốc leo tích lũy tính bằng mét' })
  elevationGainM?: number | null

  @ApiPropertyOptional({ example: 240, description: 'Thời gian ước tính hoàn thành (phút)' })
  estimatedDurationMinutes?: number | null

  @ApiProperty({ example: 0, description: 'Giá bản đồ số (VND)' })
  price!: number

  @ApiProperty({ enum: RecordStatus, example: RecordStatus.ACTIVE })
  status!: RecordStatus

  @ApiProperty({
    example: {
      id: 'd1000000-0000-0000-0000-000000000001',
      name: 'Núi Bà Đen - Tây Ninh',
      region: 'SOUTH',
      centerLat: 11.3789,
      centerLng: 106.1712,
    },
  })
  destination!: {
    id: string
    name: string
    region: string | null
    centerLat: number | null
    centerLng: number | null
  }

  @ApiProperty({ example: 3, description: 'Số lượng trạm dừng checkpoint trên tuyến' })
  checkpointCount!: number

  @ApiPropertyOptional({ example: '2026-03-01T08:00:00.000Z' })
  createdAt?: Date

  @ApiPropertyOptional({ example: '2026-03-01T08:00:00.000Z' })
  updatedAt?: Date
}

export class SystemTrailDetailDto extends SystemTrailSummaryDto {
  @ApiProperty({ example: 1, description: 'Phiên bản lộ trình cung đường' })
  version!: number

  @ApiProperty({
    description: 'Đối tượng GeoJSON (LineString) để MapLibre render polyline 3D',
    example: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Đường mòn Cột Điện', stroke: '#FF5722', strokeWidth: 4 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [106.1785, 11.3652, 45.0],
              [106.1698, 11.3838, 986.0],
            ],
          },
        },
      ],
    },
  })
  routeGeojson!: any

  @ApiProperty({ type: [CheckpointItemDto] })
  checkpoints!: CheckpointItemDto[]

  @ApiPropertyOptional({
    description: 'Bounding box để gọi map.fitBounds([[minLng, minLat], [maxLng, maxLat]])',
    example: { minLng: 106.1698, minLat: 11.3652, maxLng: 106.1785, maxLat: 11.3838 },
  })
  bounds?: {
    minLng: number
    minLat: number
    maxLng: number
    maxLat: number
  } | null

  @ApiPropertyOptional({
    description: 'Góc nhìn camera 3D tối ưu ban đầu cho MapLibre',
    example: { center: [106.1741, 11.3745], zoom: 13.5, pitch: 60, bearing: -20 },
  })
  initialCamera?: {
    center: [number, number]
    zoom: number
    pitch: number
    bearing: number
  } | null
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Trang hiện tại' })
  page!: number

  @ApiProperty({ example: 20, description: 'Số bản ghi trên mỗi trang' })
  pageSize!: number

  @ApiProperty({ example: 12, description: 'Tổng số bản ghi' })
  totalItems!: number

  @ApiProperty({ example: 1, description: 'Tổng số trang' })
  totalPages!: number
}

export class PaginatedSystemTrailResponseDto {
  @ApiProperty({ type: [SystemTrailSummaryDto], description: 'Danh sách các cung đường hệ thống' })
  items!: SystemTrailSummaryDto[]

  @ApiProperty({ type: PaginationMetaDto, description: 'Thông tin phân trang' })
  pagination!: PaginationMetaDto
}