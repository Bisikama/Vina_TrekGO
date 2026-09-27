import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { IdentityModule } from './modules/identity/identity.module';
import { SystemTrailModule } from './modules/system-trail/system-trail.module';

@Module({
  imports: [SharedModule, IdentityModule, SystemTrailModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
