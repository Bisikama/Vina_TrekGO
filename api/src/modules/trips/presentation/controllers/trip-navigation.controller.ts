import { Body, Controller, Get, Param, Post, UseFilters } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { GetNavigationContextUseCase } from '../../application/use-cases/get-navigation-context.use-case'
import { SwitchTrailUseCase } from '../../application/use-cases/switch-trail.use-case'
import { TripErrorFilter } from '../trip-error.filter'
import { navigationContextParamSchema } from '../dtos/navigation-context.dto'
import type { NavigationContextParam } from '../dtos/navigation-context.dto'
import { switchTrailSchema } from '../dtos/switch-trail.dto'
import type { SwitchTrailDto } from '../dtos/switch-trail.dto'

@ApiTags('Trip Navigation')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@UseFilters(TripErrorFilter)
@Controller('trips')
export class TripNavigationController {
  constructor(
    private readonly getNavigationContext: GetNavigationContextUseCase,
    private readonly switchTrailUseCase: SwitchTrailUseCase,
  ) {}

  @Get(':tripId/navigation-context')
  @ApiOperation({ summary: 'RC-API-101 Lấy dữ liệu context hành trình & GeoJSON bản đồ 3D' })
  @ApiParam({
    name: 'tripId',
    type: 'string',
    format: 'uuid',
    description: 'UUID của chuyến đi (Trip ID)',
    example: 'd3b07384-d113-494d-9c32-b7b5f54316d2',
  })
  async getContext(
    @ActiveUser() user: { id: string; role: string },
    @Param(new ZodValidationPipe(navigationContextParamSchema)) params: NavigationContextParam,
  ) {
    return this.getNavigationContext.execute(params.tripId, user.id, user.role)
  }

  @Post(':tripId/switch-trail')
  @ApiOperation({ summary: 'RC-FR-103 Leader chuyển đổi sang cung đường dự phòng' })
  @ApiParam({
    name: 'tripId',
    type: 'string',
    format: 'uuid',
    description: 'UUID của chuyến đi (Trip ID)',
    example: 'd3b07384-d113-494d-9c32-b7b5f54316d2',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['toPlanId'],
      properties: {
        toPlanId: {
          type: 'string',
          format: 'uuid',
          description: 'ID của plan dự phòng cần chuyển sang',
          example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
        reason: {
          type: 'string',
          description: 'Lý do đổi đường',
          example: 'Mưa lớn sạt lở đoạn Km5, chuyển sang cung đường tránh số 2',
        },
      },
    },
  })
  async switchTrail(
    @ActiveUser() user: { id: string; role: string },
    @Param(new ZodValidationPipe(navigationContextParamSchema)) params: NavigationContextParam,
    @Body(new ZodValidationPipe(switchTrailSchema)) body: SwitchTrailDto,
  ) {
    return this.switchTrailUseCase.execute(params.tripId, user.id, user.role, body)
  }
}
