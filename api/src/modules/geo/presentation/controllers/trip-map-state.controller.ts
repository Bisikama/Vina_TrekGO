import { Controller, Get, Param, UseFilters } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { TripErrorFilter } from '../../../trips/presentation/trip-error.filter'
import { GetTripMapStateUseCase } from '../../application/use-cases/get-trip-map-state.use-case'
import { tripMapStateParamSchema } from '../dtos/trip-map-state.dto'
import type { TripMapStateParam } from '../dtos/trip-map-state.dto'

@ApiTags('Geo & Map Tracking')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@UseFilters(TripErrorFilter)
@Controller('geo/trips')
export class TripMapStateController {
  constructor(private readonly getTripMapStateUseCase: GetTripMapStateUseCase) {}

  @Get(':tripId/map-state')
  @ApiOperation({ summary: 'RC-API-102 Lấy trạng thái GPS session, vị trí gần nhất, lệch đường và tiến độ' })
  @ApiParam({
    name: 'tripId',
    type: 'string',
    format: 'uuid',
    description: 'UUID của chuyến đi',
    example: 'd3b07384-d113-494d-9c32-b7b5f54316d2',
  })
  async getMapState(
    @ActiveUser() user: { id: string; role: string },
    @Param(new ZodValidationPipe(tripMapStateParamSchema)) params: TripMapStateParam,
  ) {
    return this.getTripMapStateUseCase.execute(params.tripId, user.id, user.role)
  }
}
