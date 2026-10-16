import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_PORT, type ListDeliveryTasksQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class ListDeliveryTasksUseCase {
  constructor(@Inject(DELIVERY_PORT) private readonly port: DeliveryPort) {}
  execute(query: ListDeliveryTasksQuery) { return this.port.listTasks(query); }
}
