import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_PORT, type GetPickupCodeQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class GetRentalPickupCodeUseCase {
  constructor(@Inject(DELIVERY_PORT) private readonly port: DeliveryPort) {}
  execute(query: Omit<GetPickupCodeQuery, 'now'> & { now?: Date }) { return this.port.getPickupCode({ ...query, now: query.now ?? new Date() }); }
}
