import { Inject, Injectable } from '@nestjs/common';
import { LOGISTICS_PORT, type ListDeliveryTasksQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class ListDeliveryTasksUseCase {
  constructor(@Inject(LOGISTICS_PORT) private readonly port: DeliveryPort) {}
  execute(query: ListDeliveryTasksQuery) { return this.port.listTasks(query); }
}
