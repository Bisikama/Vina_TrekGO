import { Injectable } from '@nestjs/common'
import {
  DestinationPort,
  DestinationSummary,
  GetDestinationsFilter,
  PaginatedResult,
} from '../ports/destination.port'

@Injectable()
export class GetDestinationsUseCase {
  constructor(private readonly destinationPort: DestinationPort) {}

  async execute(filter?: GetDestinationsFilter): Promise<PaginatedResult<DestinationSummary>> {
    return this.destinationPort.findAll(filter)
  }
}
