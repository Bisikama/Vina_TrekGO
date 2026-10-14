import { Module } from '@nestjs/common'
import { WeatherController } from './presentation/controllers/weather.controller'
import { GetTripWeatherUseCase } from './application/use-cases/get-trip-weather.use-case'
import { WeatherPort } from './application/ports/weather.port'
import { PrismaWeatherAdapter } from './infrastructure/adapters/prisma-weather.adapter'
import { OpenMeteoClient } from './infrastructure/external/open-meteo.client'

@Module({
  controllers: [WeatherController],
  providers: [
    GetTripWeatherUseCase,
    OpenMeteoClient,
    {
      provide: WeatherPort,
      useClass: PrismaWeatherAdapter,
    },
  ],
  exports: [GetTripWeatherUseCase, WeatherPort],
})
export class WeatherModule {}
