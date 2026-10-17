import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { lookupCoordinatesElevationSchema, LookupCoordinatesElevationRequestDto } from '../dtos/elevation.dto'
import type { LookupCoordinatesElevationInput } from '../dtos/elevation.dto'
import { AwsTerrariumElevationAdapter } from '../../infrastructure/adapters/aws-terrarium.adapter'

@ApiTags('Elevation - AWS Terrarium DEM')
@Controller('elevation')
export class ElevationController {
  constructor(private readonly elevationAdapter: AwsTerrariumElevationAdapter) {}

  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tra cứu độ cao thực địa từ AWS Terrarium DEM (DEM Elevation Lookup)',
    description: 'Hỗ trợ tra cứu nhanh độ cao cho danh sách toạ độ WGS84 có cache Redis',
  })
  @ApiBody({ type: LookupCoordinatesElevationRequestDto })
  @ApiResponse({ status: 200, description: 'Mảng độ cao (mét) theo đúng thứ tự toạ độ đầu vào' })
  async lookup(
    @Body(new ZodValidationPipe(lookupCoordinatesElevationSchema))
    body: LookupCoordinatesElevationInput,
  ) {
    const elevations = await this.elevationAdapter.getElevations(body.coordinates)
    return {
      success: true,
      data: elevations,
    }
  }
}
