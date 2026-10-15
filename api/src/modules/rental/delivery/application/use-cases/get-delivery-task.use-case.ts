import { Inject, Injectable } from '@nestjs/common';
import { LOGISTICS_PORT, type GetDeliveryTaskQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class GetDeliveryTaskUseCase {
  constructor(@Inject(LOGISTICS_PORT) private readonly port: DeliveryPort) {}
  execute(query: GetDeliveryTaskQuery) { return this.port.getTask(query); }
}
