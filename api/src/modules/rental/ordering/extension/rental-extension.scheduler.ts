import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RentalExtensionService } from './rental-extension.service';
import { RentalOverdueService } from '../../lifecycle/application/services/rental-overdue.service';

@Injectable()
export class RentalExtensionScheduler {
  private readonly logger = new Logger(RentalExtensionScheduler.name);

  constructor(
    private readonly service: RentalExtensionService,
    private readonly overdueService: RentalOverdueService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireHolds() {
    const count = await this.service.expire();
    if (count) this.logger.log(`Processed ${count} expired rental extension hold(s)`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scanOverdueOrders() {
    try {
      const opened = await this.overdueService.openDueReturnTasks();
      if (opened) this.logger.log(`Opened ${opened} due rental return task(s)`);
    } catch (error) {
      this.logger.error(`ReturnTask scan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const result = await this.overdueService.scanAndMarkOverdue();
    if (result.overdueOrderIds.length > 0) {
      this.logger.log(`Marked ${result.overdueOrderIds.length} rental order(s) as OVERDUE`);
    }
  }
}
