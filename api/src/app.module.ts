import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { MongooseModule } from '@nestjs/mongoose'
import envConfig from './shared/config'
import { SharedModule } from './shared/shared.module'
import { IdentityModule } from './modules/identity/identity.module'
import { RentalModule } from './modules/rental/rental.module'
import { TripsModule } from './modules/trips/trips.module'
import { SystemTrailModule } from './modules/system-trail/system-trail.module'
import { GeoModule } from './modules/geo/geo.module'
import { MediaModule } from './modules/media/media.module'
import { CheckpointModule } from './modules/checkpoint/checkpoint.module'
import { DestinationModule } from './modules/destination/destination.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { LeaderApplicationsModule } from './modules/leader-applications/leader-applications.module'
import { WeatherModule } from './modules/weather/weather.module'
import { WebsocketModule } from './websockets/websocket.module'
import { ElevationModule } from './modules/elevation/elevation.module'
import { PersonalTrailModule } from './modules/personal-trail/personal-trail.module'

@Module({
  imports: [
    MongooseModule.forRoot(envConfig.MONGODB_URI),
    SharedModule,
    IdentityModule,
    TripsModule,
    RentalModule,
    SystemTrailModule,
    GeoModule,
    MediaModule,
    ScheduleModule.forRoot(),
    CheckpointModule,
    DestinationModule,
    PaymentsModule,
    NotificationsModule,
    LeaderApplicationsModule,
    WeatherModule,
    WebsocketModule,
    ElevationModule,
    PersonalTrailModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
