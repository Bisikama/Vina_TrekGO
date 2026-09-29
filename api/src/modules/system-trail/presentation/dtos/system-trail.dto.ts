import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SystemTrailSummaryDto {
  @ApiProperty({ example: 'c1000000-0000-0000-0000-000000000001' })
  id!: string

  @ApiProperty({ example: 'TRAIL_BADEN_COTDIEN' })
  code!: string

  @ApiProperty({ example: 'Cung đường Cột Điện - Đỉnh Núi Bà Đen' })
  name!: string

  @ApiPropertyOptional({ example: 'Cung trekking phổ biến và rõ đường nhất tại Núi Bà Đen' })
  description?: string | null

  @ApiProperty({ example: 'MEDIUM' })
  difficulty!: string

  @ApiProperty({ example: 4.5, description: 'Độ dài cung đường tính bằng km' })
  distanceKm!: number

  @ApiPropertyOptional({ example: 941, description: 'Độ cao dốc leo tích lũy tính bằng mét' })
  elevationGainM?: number | null

  @ApiPropertyOptional({ example: 240, description: 'Thời gian ước tính hoàn thành (phút)' })
  estimatedDurationMinutes?: number | null

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
}

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

export class SystemTrailDetailDto extends SystemTrailSummaryDto {
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