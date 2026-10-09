import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RentalExtensionService } from './rental-extension.service';
@Injectable()
export class RentalExtensionScheduler {
  private readonly logger = new Logger(RentalExtensionScheduler.name);
  constructor(private readonly service: RentalExtensionService) {}
  @Cron(CronExpression.EVERY_MINUTE)
  async expireHolds() {
    const count = await this.service.expire();
    if (count) this.logger.log(`Processed ${count} expired rental extension hold(s)`);
  }
}
