import { Injectable, NotFoundException } from '@nestjs/common'
import { DestinationPort, DestinationSummary } from '../ports/destination.port'

@Injectable()
export class GetDestinationDetailUseCase {
  constructor(private readonly destinationPort: DestinationPort) {}

  async execute(id: string): Promise<DestinationSummary> {
    const destination = await this.destinationPort.findById(id)
    if (!destination) {
      throw new NotFoundException(`Không tìm thấy điểm đến với ID '${id}'`)
    }
    return destination
  }
}
