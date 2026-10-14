import { Inject, Injectable } from '@nestjs/common';
import { LOGISTICS_PORT, type GetPickupCodeQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class GetRentalPickupCodeUseCase {
  constructor(@Inject(LOGISTICS_PORT) private readonly port: DeliveryPort) {}
  execute(query: Omit<GetPickupCodeQuery, 'now'> & { now?: Date }) { return this.port.getPickupCode({ ...query, now: query.now ?? new Date() }); }
}
