import { Inject, Injectable } from '@nestjs/common';
import { LOGISTICS_PORT, type GetHandoverPreviewQuery, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class GetRentalHandoverPreviewUseCase {
  constructor(@Inject(LOGISTICS_PORT) private readonly port: DeliveryPort) {}
  execute(query: GetHandoverPreviewQuery) { return this.port.getHandoverPreview(query); }
}
