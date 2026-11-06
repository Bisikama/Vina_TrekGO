import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { EarlyReturnService } from '../../application/early-return.service'

/** Chuyển EXPIRED các yêu cầu trả sớm chưa xác nhận mà không còn xác nhận được. */
@Injectable()
export class RentalEarlyReturnExpiryWorker {
  private readonly logger = new Logger(RentalEarlyReturnExpiryWorker.name)
  private running = false
  constructor(private readonly service: EarlyReturnService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return
    this.running = true
    try {
      const expired = await this.service.expireStale()
      if (expired) this.logger.log(`Expired ${expired} early return request(s)`)
    } catch (error) {
      this.logger.warn(`Early return expiry deferred: ${(error as Error).message}`)
    } finally {
      this.running = false
    }
  }
}
