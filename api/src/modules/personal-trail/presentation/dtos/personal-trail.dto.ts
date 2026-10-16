import { z } from 'zod'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// ============================================================================
// 1. ZOD VALIDATION SCHEMAS
// ============================================================================

export const startRecordingSchema = z.object({
  clientRecordingId: z.string().uuid('clientRecordingId must be a valid UUID'),
  startedAt: z.string().datetime().optional(),
  deviceInfo: z
    .object({
      platform: z.string().optional(),
      osVersion: z.string().optional(),
      deviceModel: z.string().optional(),
    })
    .optional(),
})

export type StartRecordingInput = z.infer<typeof startRecordingSchema>

export const rawSampleItemSchema = z.object({
  clientSampleId: z.string().uuid('clientSampleId must be a valid UUID'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  recordedAt: z.string().datetime(),
  accuracyM: z.number().nullable().optional(),
  altitudeM: z.number().nullable().optional(),
  altitudeAccuracyM: z.number().nullable().optional(),
  speedMps: z.number().nullable().optional(),
  headingDeg: z.number().nullable().optional(),
  segmentId: z.number().int().nonnegative().default(0),
  accepted: z.boolean().nullable().optional().default(true),
  rejectReason: z.string().max(40).nullable().optional(),
})

export const rawSamplesBatchSchema = z.object({
  clientRecordingId: z.string().uuid().optional(),
  samples: z.array(rawSampleItemSchema).min(1, 'Samples batch cannot be empty'),
})

export type RawSamplesBatchInput = z.infer<typeof rawSamplesBatchSchema>

export const updateRecordingStatusSchema = z.object({
  clientRecordingId: z.string().uuid().optional(),
  status: z.enum(['RECORDING', 'PAUSED', 'STOPPED']),
  timestamp: z.string().datetime().optional(),
  currentSegmentId: z.number().int().nonnegative().optional(),
})

export type UpdateRecordingStatusInput = z.infer<typeof updateRecordingStatusSchema>

export const finishRecordingSchema = z
  .object({
    clientRecordingId: z.string().uuid().optional(),
    endedAt: z.string().datetime().optional(),
    trailMetadata: z
      .object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().nullable().optional(),
        region: z.string().nullable().optional(),
        difficulty: z.string().nullable().optional(),
        terrainType: z.string().nullable().optional(),
        visibility: z.string().nullable().optional(),
      })
      .optional(),
    provisionalTelemetry: z
      .object({
        distanceKm: z.number().optional(),
        elevationGainM: z.number().optional(),
        duration: z.string().optional(),
        elapsedSeconds: z.number().optional(),
      })
      .optional(),
    gpsSegments: z.array(z.array(z.array(z.number()))).optional(),
    checkpoints: z.array(z.any()).optional(),
  })
  .default({})

export type FinishRecordingInput = z.infer<typeof finishRecordingSchema>

export const myTrailsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    verificationStatus: z.enum(['DRAFT', 'PENDING', 'VERIFIED', 'REJECTED', 'APPROVED']).optional(),
  })
  .default({ page: 1, limit: 20 })

export type MyTrailsQuery = z.infer<typeof myTrailsQuerySchema>

export const updatePersonalTrailSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional(),
    difficulty: z.enum(['EASY', 'MODERATE', 'HARD', 'VERY_HARD']).optional(),
  })
  .default({})

export type UpdatePersonalTrailInput = z.infer<typeof updatePersonalTrailSchema>

export const submitVerificationSchema = z
  .object({
    noteToAdmin: z.string().max(1000).optional(),
  })
  .default({})

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>

// ============================================================================
// 2. SWAGGER REQUEST DTOs
// ============================================================================

export class DeviceInfoRequestDto {
  @ApiPropertyOptional({ example: 'android', description: 'Hệ điều hành thiết bị' })
  platform?: string

  @ApiPropertyOptional({ example: '14.0', description: 'Phiên bản hệ điều hành' })
  osVersion?: string

  @ApiPropertyOptional({ example: 'Pixel 8', description: 'Tên mẫu máy' })
  deviceModel?: string
}

export class StartRecordingRequestDto {
  @ApiProperty({
    example: '11111111-2222-3333-4444-555555555555',
    description: 'UUID v4 phía client tạo khi bắt đầu ghi offline',
  })
  clientRecordingId!: string

  @ApiPropertyOptional({ example: '2026-10-16T15:00:00.000Z', description: 'Thời điểm bắt đầu ghi' })
  startedAt?: string

  @ApiPropertyOptional({ type: DeviceInfoRequestDto, description: 'Thông tin thiết bị ghi' })
  deviceInfo?: DeviceInfoRequestDto
}

export class RawSampleItemDto {
  @ApiProperty({ example: '22222222-3333-4444-5555-666666666666', description: 'UUID v4 mẫu GPS phía client' })
  clientSampleId!: string

  @ApiProperty({ example: 11.3652, description: 'Vĩ độ WGS84' })
  latitude!: number

  @ApiProperty({ example: 106.1785, description: 'Kinh độ WGS84' })
  longitude!: number

  @ApiProperty({ example: '2026-10-16T15:01:00.000Z', description: 'Thời gian mẫu GPS được ghi' })
  recordedAt!: string

  @ApiPropertyOptional({ example: 4.2, description: 'Độ chính xác GPS theo bán kính (mét)' })
  accuracyM?: number | null

  @ApiPropertyOptional({ example: 45.0, description: 'Độ cao thô từ cảm biến GPS (mét)' })
  altitudeM?: number | null

  @ApiPropertyOptional({ example: 2.0, description: 'Độ chính xác độ cao (mét)' })
  altitudeAccuracyM?: number | null

  @ApiPropertyOptional({ example: 1.25, description: 'Vận tốc di chuyển (m/s)' })
  speedMps?: number | null

  @ApiPropertyOptional({ example: 45.0, description: 'Góc hướng di chuyển (0 - 360 độ)' })
  headingDeg?: number | null

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Mã chặng sau mỗi lần pause/resume' })
  segmentId?: number

  @ApiPropertyOptional({ example: true, default: true, description: 'Mẫu có đạt chất lượng không' })
  accepted?: boolean | null

  @ApiPropertyOptional({ example: null, description: 'Lý do bị loại nếu có' })
  rejectReason?: string | null
}

export class RawSamplesBatchRequestDto {
  @ApiPropertyOptional({
    example: '11111111-2222-3333-4444-555555555555',
    description: 'UUID v4 phiên ghi phía client (tùy chọn)',
  })
  clientRecordingId?: string

  @ApiProperty({
    type: [RawSampleItemDto],
    description: 'Danh sách các mẫu GPS thô ghi nhận được trong đợt đồng bộ này',
    example: [
      {
        clientSampleId: '33333333-4444-5555-6666-777777777777',
        latitude: 11.3652,
        longitude: 106.1785,
        recordedAt: '2026-10-16T15:01:00.000Z',
        accuracyM: 4.0,
        altitudeM: 45.0,
        speedMps: 1.2,
        segmentId: 0,
      },
    ],
  })
  samples!: RawSampleItemDto[]
}

export class UpdateRecordingStatusRequestDto {
  @ApiPropertyOptional({
    example: '11111111-2222-3333-4444-555555555555',
    description: 'UUID v4 phiên ghi phía client',
  })
  clientRecordingId?: string

  @ApiProperty({
    enum: ['RECORDING', 'PAUSED', 'STOPPED'],
    example: 'PAUSED',
    description: 'Trạng thái phiên ghi cần cập nhật',
  })
  status!: 'RECORDING' | 'PAUSED' | 'STOPPED'

  @ApiPropertyOptional({ example: '2026-10-16T15:30:00.000Z', description: 'Thời điểm chuyển trạng thái' })
  timestamp?: string

  @ApiPropertyOptional({ example: 1, description: 'Chỉ số chặng segment hiện tại' })
  currentSegmentId?: number
}

export class TrailMetadataRequestDto {
  @ApiPropertyOptional({ type: String, example: 'Cung đường leo Núi Bà Đen thực địa' })
  title?: string

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Khảo sát lối mòn phía Tây, dốc thoải' })
  description?: string | null

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Tây Ninh' })
  region?: string | null

  @ApiPropertyOptional({ enum: ['EASY', 'MODERATE', 'HARD', 'VERY_HARD'], example: 'MODERATE' })
  difficulty?: string | null

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Rừng nhiệt đới & đá tảng' })
  terrainType?: string | null

  @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED', 'PUBLIC'], example: 'PRIVATE' })
  visibility?: string | null
}

export class ProvisionalTelemetryRequestDto {
  @ApiPropertyOptional({ example: 4.8, description: 'Quãng đường tạm tính trên thiết bị (km)' })
  distanceKm?: number

  @ApiPropertyOptional({ example: 350, description: 'Độ dốc leo tích lũy tạm tính (m)' })
  elevationGainM?: number

  @ApiPropertyOptional({ example: '02:15:30', description: 'Thời gian thực tế' })
  duration?: string

  @ApiPropertyOptional({ example: 8130, description: 'Số giây trôi qua' })
  elapsedSeconds?: number
}

export class FinishRecordingRequestDto {
  @ApiPropertyOptional({
    example: '11111111-2222-3333-4444-555555555555',
    description: 'UUID v4 phiên ghi phía client',
  })
  clientRecordingId?: string

  @ApiPropertyOptional({ example: '2026-10-16T17:15:00.000Z', description: 'Thời điểm kết thúc' })
  endedAt?: string

  @ApiPropertyOptional({ type: TrailMetadataRequestDto, description: 'Thông tin bổ sung về cung đường' })
  trailMetadata?: TrailMetadataRequestDto

  @ApiPropertyOptional({ type: ProvisionalTelemetryRequestDto, description: 'Telemetry tạm tính phía client' })
  provisionalTelemetry?: ProvisionalTelemetryRequestDto

  @ApiPropertyOptional({
    description: 'Tùy chọn: MultiLineString 3D đã thu thập trên client',
    example: [
      [
        [106.1785, 11.3652, 45.0],
        [106.18, 11.368, 85.0],
      ],
    ],
  })
  gpsSegments?: number[][][]

  @ApiPropertyOptional({ description: 'Danh sách các điểm checkpoint đánh dấu trong phiên ghi' })
  checkpoints?: any[]
}

export class UpdatePersonalTrailRequestDto {
  @ApiPropertyOptional({ type: String, example: 'Cung đường leo Núi Bà Đen thực địa' })
  name?: string

  @ApiPropertyOptional({ type: String, example: 'Cung đường leo Núi Bà Đen thực địa' })
  title?: string

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Khảo sát cung đường mới, dốc thoải, nhiều cảnh đẹp.' })
  description?: string | null

  @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED', 'PUBLIC'], example: 'PRIVATE' })
  visibility?: 'PRIVATE' | 'SHARED' | 'PUBLIC'

  @ApiPropertyOptional({ enum: ['EASY', 'MODERATE', 'HARD', 'VERY_HARD'], example: 'MODERATE' })
  difficulty?: 'EASY' | 'MODERATE' | 'HARD' | 'VERY_HARD'
}

export class SubmitVerificationRequestDto {
  @ApiPropertyOptional({
    example: 'Cung đường này đã được nhóm chúng tôi test thực tế 2 lần, an toàn và có lối mòn rõ ràng.',
    description: 'Ghi chú gửi cho Ban quản trị TrekGo kiểm duyệt',
  })
  noteToAdmin?: string
}
