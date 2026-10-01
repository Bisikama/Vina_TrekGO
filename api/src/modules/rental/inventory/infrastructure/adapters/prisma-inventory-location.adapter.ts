import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { RecordStatus, Prisma, type InventoryLocation } from '@prisma/client';
import type {
  InventoryLocationPort,
  InventoryLocationView,
  InventoryLocationListView,
  ListInventoryLocationsParams,
  CreateInventoryLocationInput,
  UpdateInventoryLocationInput,
} from '../../application/ports/inventory-location.port';

@Injectable()
export class PrismaInventoryLocationAdapter implements InventoryLocationPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapToView(location: Prisma.InventoryLocationGetPayload<{ select: { id: true, code: true, name: true, address: true, latitude: true, longitude: true, status: true } }>): InventoryLocationView {
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

  private mapToListView(location: Prisma.InventoryLocationGetPayload<{ select: { id: true, code: true, name: true, status: true } }>): InventoryLocationListView {
    return {
      id: location.id,
      code: location.code,
      name: location.name,
      status: location.status,
    };
  }

  async listLocations(params: ListInventoryLocationsParams): Promise<{ items: InventoryLocationListView[]; total: number }> {
    const { page, pageSize, search, status } = params;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: Prisma.InventoryLocationWhereInput = {};

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
          status: true,
        },
      }),
      this.prisma.inventoryLocation.count({ where }),
    ]);

    return {
      items: items.map(item => this.mapToListView(item)),
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

  async getLocationByCode(code: string): Promise<InventoryLocationView | null> {
    const location = await this.prisma.inventoryLocation.findUnique({
      where: { code },
      select: { id: true, code: true, name: true, address: true, latitude: true, longitude: true, status: true },
    });
    if (!location) return null;
    return this.mapToView(location);
  }

  async createLocation(data: CreateInventoryLocationInput): Promise<InventoryLocationView> {
    const location = await this.prisma.inventoryLocation.create({
      data: {
        code: data.code,
        name: data.name,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        status: (data.status as RecordStatus) || RecordStatus.ACTIVE,
      },
      select: { id: true, code: true, name: true, address: true, latitude: true, longitude: true, status: true },
    });
    return this.mapToView(location);
  }

  async updateLocation(id: string, data: UpdateInventoryLocationInput): Promise<InventoryLocationView> {
    const location = await this.prisma.inventoryLocation.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        status: data.status as RecordStatus,
      },
      select: { id: true, code: true, name: true, address: true, latitude: true, longitude: true, status: true },
    });
    return this.mapToView(location);
  }
}
