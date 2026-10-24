import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type ListRentalDocumentsQuery } from '../ports/rental-return.port';

@Injectable()
export class ListRentalDocumentsUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}

  execute(query: ListRentalDocumentsQuery) {
    return this.port.listRentalDocuments(query);
  }
}
