import { Controller, Get, Param, UseFilters } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { TripErrorFilter } from '../../../trips/presentation/trip-error.filter'
import { GetTripWeatherUseCase } from '../../application/use-cases/get-trip-weather.use-case'
import { weatherTripParamSchema } from '../dtos/weather-param.dto'
import type { WeatherTripParam } from '../dtos/weather-param.dto'
import { TripWeatherResponseDto } from '../dtos/weather-response.dto'

@ApiTags('Weather')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@UseFilters(TripErrorFilter)
@Controller('weather')
export class WeatherController {
  constructor(private readonly getTripWeatherUseCase: GetTripWeatherUseCase) {}

  @Get('trips/:tripId')
  @ApiOperation({
    summary: 'RC-API-501 Lấy thông tin thời tiết chuyến đi (theo ngày khởi hành)',
    description:
      'Nếu chuyến đi đã có bản ghi trong cơ sở dữ liệu, trả về ngay từ DB. Nếu chưa có, gọi Open-Meteo theo ngày khởi hành trip.startAt, đánh giá rủi ro và lưu vào DB.',
  })
  @ApiParam({
    name: 'tripId',
    type: 'string',
    format: 'uuid',
    description: 'UUID của chuyến đi',
    example: 'd3b07384-d113-494d-9c32-b7b5f54316d2',
  })
  async getTripWeather(
    @ActiveUser() user: { id: string; role: string },
    @Param(new ZodValidationPipe(weatherTripParamSchema)) params: WeatherTripParam,
  ): Promise<TripWeatherResponseDto> {
    return this.getTripWeatherUseCase.execute(params.tripId, user.id, user.role)
  }
}
