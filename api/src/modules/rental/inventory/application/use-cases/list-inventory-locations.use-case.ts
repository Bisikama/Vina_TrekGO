import { Inject, Injectable } from '@nestjs/common'
import {
  INVENTORY_LOCATION_PORT,
  type InventoryLocationPort,
  type InventoryLocationListView,
  type PaginatedResult,
} from '../ports/inventory-location.port'

interface ListInventoryLocationsInput {
  page: number
  pageSize: number
  search?: string
  status?: string
}

@Injectable()
export class ListInventoryLocationsUseCase {
  constructor(
    @Inject(INVENTORY_LOCATION_PORT)
    private readonly inventoryLocationPort: InventoryLocationPort,
  ) {}

  async execute(input: ListInventoryLocationsInput): Promise<PaginatedResult<InventoryLocationListView>> {
    const { items, total } = await this.inventoryLocationPort.listLocations(input)
    const totalPages = Math.ceil(total / input.pageSize)

    return {
      items,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems: total,
        totalPages,
      },
    }
  }
}
