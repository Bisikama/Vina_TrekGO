import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_PORT, type ListAdminRentalTasksQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class ListAdminRentalTasksUseCase {
  constructor(@Inject(DELIVERY_PORT) private readonly port: DeliveryPort) {}
  execute(query: ListAdminRentalTasksQuery) { return this.port.listAdminTasks(query); }
}
