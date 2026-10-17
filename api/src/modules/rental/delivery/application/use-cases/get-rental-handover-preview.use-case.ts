import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_PORT, type GetHandoverPreviewQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class GetRentalHandoverPreviewUseCase {
  constructor(@Inject(DELIVERY_PORT) private readonly port: DeliveryPort) {}
  execute(query: GetHandoverPreviewQuery) { return this.port.getHandoverPreview(query); }
}
