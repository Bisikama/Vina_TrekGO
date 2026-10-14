import { Inject, Injectable } from '@nestjs/common';
import { LOGISTICS_PORT, type ListAdminRentalTasksQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class ListAdminRentalTasksUseCase {
  constructor(@Inject(LOGISTICS_PORT) private readonly port: DeliveryPort) {}
  execute(query: ListAdminRentalTasksQuery) { return this.port.listAdminTasks(query); }
}
