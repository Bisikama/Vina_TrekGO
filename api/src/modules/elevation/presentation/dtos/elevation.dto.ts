import { z } from 'zod'
import { ApiProperty } from '@nestjs/swagger'

export const lookupCoordinatesElevationSchema = z.object({
  coordinates: z
    .array(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    )
    .min(1, 'Coordinates list cannot be empty')
    .max(500, 'Max 500 coordinates per lookup'),
})

export type LookupCoordinatesElevationInput = z.infer<typeof lookupCoordinatesElevationSchema>

export class CoordinatePointDto {
  @ApiProperty({ example: 11.3652, description: 'Vĩ độ WGS84 (-90 đến 90)' })
  latitude!: number

  @ApiProperty({ example: 106.1785, description: 'Kinh độ WGS84 (-180 đến 180)' })
  longitude!: number
}

export class LookupCoordinatesElevationRequestDto {
  @ApiProperty({
    type: [CoordinatePointDto],
    description: 'Danh sách tọa độ GPS cần tra cứu độ cao từ DEM AWS Terrarium',
    example: [
      { latitude: 11.3652, longitude: 106.1785 },
      { latitude: 11.3705, longitude: 106.1821 },
    ],
  })
  coordinates!: CoordinatePointDto[]
}
