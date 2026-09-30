import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MediaCleanupUseCase } from '../../application/use-cases/media-cleanup.use-case';

@Injectable()
export class MediaCleanupScheduler {
  private readonly logger = new Logger(MediaCleanupScheduler.name);

  constructor(private readonly mediaCleanupUseCase: MediaCleanupUseCase) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.debug('Executing scheduled Media Cleanup');
    await this.mediaCleanupUseCase.execute();
  }
}
