import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { IdentityModule } from './modules/identity/identity.module';

@Module({
  imports: [SharedModule, IdentityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
