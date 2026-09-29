import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { AuthType } from 'src/shared/constants/auth.constant'
import { GetSystemTrailsUseCase } from '../../application/use-cases/get-system-trails.use-case'
import { GetSystemTrailDetailUseCase } from '../../application/use-cases/get-system-trail-detail.use-case'
import { SystemTrailDetailDto, SystemTrailSummaryDto } from '../dtos/system-trail.dto'


@ApiTags('System Trails')
@Controller('system-trails')
export class SystemTrailController {
  constructor(
    private readonly getSystemTrailsUseCase: GetSystemTrailsUseCase,
    private readonly getSystemTrailDetailUseCase: GetSystemTrailDetailUseCase,
  ) {}

  @Get()
  @Auth([AuthType.None])
  @ApiOperation({
    summary: 'Lấy danh sách các cung đường hệ thống',
    description: 'Dùng cho màn hình chọn cung đường hoặc tìm kiếm cung đường trekking',
  })
  @ApiQuery({ name: 'destinationId', required: false, description: 'Lọc theo ID địa danh' })
  @ApiResponse({ status: 200, type: [SystemTrailSummaryDto] })
  async getTrails(@Query('destinationId') destinationId?: string): Promise<SystemTrailSummaryDto[]> {
    return this.getSystemTrailsUseCase.execute(destinationId)
  }

  @Get(':idOrCode')
  @Auth([AuthType.None])
  @ApiOperation({
    summary: 'Lấy dữ liệu chi tiết cung đường để render MapLibre 3D',
    description: 'Trả về toạ độ GeoJSON 3D, danh sách checkpoints và thông số camera/bounds sẵn sàng cho MapLibre',
  })
  @ApiResponse({ status: 200, type: SystemTrailDetailDto })
  async getTrailDetail(@Param('idOrCode') idOrCode: string): Promise<SystemTrailDetailDto> {
    return this.getSystemTrailDetailUseCase.execute(idOrCode)
  }
}