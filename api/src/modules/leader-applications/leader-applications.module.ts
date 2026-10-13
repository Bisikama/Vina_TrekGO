import { Module } from '@nestjs/common'
import { MediaModule } from '../media/media.module'
import { LeaderApplicationsController } from './presentation/leader-applications.controller'
import { LeaderApplicationsService } from './application/leader-applications.service'

@Module({ imports: [MediaModule], controllers: [LeaderApplicationsController], providers: [LeaderApplicationsService] })
export class LeaderApplicationsModule {}
