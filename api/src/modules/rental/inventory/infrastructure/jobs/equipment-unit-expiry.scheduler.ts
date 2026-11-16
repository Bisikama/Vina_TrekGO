import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { EQUIPMENT_UNIT_PORT, type EquipmentUnitPort } from '../../application/ports/equipment-unit.port'

/** Withdraws units in stock whose shelf life has run out (AVAILABLE -> RETIRED). */
@Injectable()
export class EquipmentUnitExpiryScheduler {
  private readonly logger = new Logger(EquipmentUnitExpiryScheduler.name)
  private running = false

  constructor(@Inject(EQUIPMENT_UNIT_PORT) private readonly units: EquipmentUnitPort) {}

  // Hourly rather than once a day: a unit released to stock after its expiry day is caught soon,
  // and a restart never skips a day.
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    if (this.running) return
    this.running = true
    try {
      const retired = await this.units.retireExpiredUnits(new Date())
      if (retired > 0) this.logger.log(`Retired ${retired} expired equipment unit(s)`)
    } catch (error) {
      this.logger.error(`Expired unit sweep failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.running = false
    }
  }
}
