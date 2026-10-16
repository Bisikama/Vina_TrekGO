import { Inject, Injectable } from '@nestjs/common';
import { LOGISTICS_PORT, type ListRentalAssigneesQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class ListRentalAssigneesUseCase {
  constructor(@Inject(LOGISTICS_PORT) private readonly port: DeliveryPort) {}
  execute(query: ListRentalAssigneesQuery) { return this.port.listAssignees(query); }
}
