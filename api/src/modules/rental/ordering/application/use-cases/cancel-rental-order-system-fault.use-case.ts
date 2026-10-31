import { Inject, Injectable } from '@nestjs/common'
import {
  RENTAL_SYSTEM_FAULT_CANCELLATION_PORT,
  type CancelRentalOrderSystemFaultCommand,
  type RentalSystemFaultCancellationPort,
} from '../ports/rental-system-fault-cancellation.port'

/**
 * ADMIN huỷ đơn chưa bàn giao do lỗi TrekGo (ví dụ hạ hạng làm thiếu hàng): hoàn 100% tiền thuê + cọc.
 * Phần kiểm điều kiện chạy trong adapter sau khi khoá Trip và đơn.
 */
@Injectable()
export class CancelRentalOrderSystemFaultUseCase {
  constructor(
    @Inject(RENTAL_SYSTEM_FAULT_CANCELLATION_PORT)
    private readonly port: RentalSystemFaultCancellationPort,
  ) {}

  execute(command: CancelRentalOrderSystemFaultCommand) {
    return this.port.cancel(command)
  }
}
