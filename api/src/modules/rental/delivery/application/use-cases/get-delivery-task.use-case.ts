import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_PORT, type GetDeliveryTaskQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class GetDeliveryTaskUseCase {
  constructor(@Inject(DELIVERY_PORT) private readonly port: DeliveryPort) {}
  execute(query: GetDeliveryTaskQuery) { return this.port.getTask(query); }
}
