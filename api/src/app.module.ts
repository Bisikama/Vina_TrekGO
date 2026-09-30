import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { SharedModule } from './shared/shared.module';
import { IdentityModule } from './modules/identity/identity.module';
import { RentalModule } from './modules/rental/rental.module';
import { TripsModule } from './modules/trips/trips.module';
import { MediaModule } from './modules/media/media.module';


@Module({
  imports: [SharedModule, IdentityModule, TripsModule, RentalModule, MediaModule, ScheduleModule.forRoot()],
  controllers: [],
  providers: [],
})
export class AppModule {}
