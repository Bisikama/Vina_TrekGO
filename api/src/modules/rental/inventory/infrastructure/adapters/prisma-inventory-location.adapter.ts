import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { RecordStatus } from '@prisma/client';
import type {
  InventoryLocationPort,
  InventoryLocationView,
  ListInventoryLocationsParams,
} from '../../application/ports/inventory-location.port';

@Injectable()
export class PrismaInventoryLocationAdapter implements InventoryLocationPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapToView(location: any): InventoryLocationView {
    return {
      id: location.id,
      code: location.code,
      name: location.name,
      address: location.address,
      latitude: location.latitude ? location.latitude.toNumber() : null,
      longitude: location.longitude ? location.longitude.toNumber() : null,
      status: location.status,
    };
  }

  async listLocations(params: ListInventoryLocationsParams): Promise<{ items: InventoryLocationView[]; total: number }> {
    const { page, pageSize, search, status } = params;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: any = {};

    if (status) {
      where.status = status as RecordStatus;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryLocation.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          status: true,
        },
      }),
      this.prisma.inventoryLocation.count({ where }),
    ]);

    return {
      items: items.map(this.mapToView),
      total,
    };
  }

  async getLocationById(id: string): Promise<InventoryLocationView | null> {
    const location = await this.prisma.inventoryLocation.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        status: true,
      },
    });

    if (!location) return null;
    return this.mapToView(location);
  }
}
