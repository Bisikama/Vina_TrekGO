import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type GetRentalDocumentQuery } from '../ports/rental-return.port';

@Injectable()
export class GetRentalDocumentUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}

  execute(query: GetRentalDocumentQuery) {
    return this.port.getRentalDocument(query);
  }
}
