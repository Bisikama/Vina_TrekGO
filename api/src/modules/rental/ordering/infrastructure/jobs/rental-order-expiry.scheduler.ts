import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExpirePendingRentalOrdersUseCase } from '../../application/use-cases/expire-pending-rental-orders.use-case';

@Injectable()
export class RentalOrderExpiryScheduler {
  private readonly logger = new Logger(RentalOrderExpiryScheduler.name);

  constructor(private readonly expireUseCase: ExpirePendingRentalOrdersUseCase) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    const expired = await this.expireUseCase.execute();
    if (expired > 0) this.logger.log(`Expired ${expired} rental order(s)`);
  }
}
