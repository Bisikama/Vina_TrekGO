import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { RecordStatus, Prisma, type InventoryLocation } from '@prisma/client';
import type {
  InventoryLocationPort,
  InventoryLocationView,
  ListInventoryLocationsParams,
  CreateInventoryLocationParams,
  UpdateInventoryLocationParams,
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

  async listLocations(params: ListInventoryLocationsParams): Promise<{ items: InventoryLocationView[]; total: number }> {
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
          address: true,
          latitude: true,
          longitude: true,
          status: true,
        },
      }),
      this.prisma.inventoryLocation.count({ where }),
    ]);

    return {
      items: items.map(item => this.mapToView(item)),
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

  async createLocation(params: CreateInventoryLocationParams): Promise<InventoryLocationView> {
    const data: Prisma.InventoryLocationCreateInput = {
      code: params.code,
      name: params.name,
      address: params.address,
      latitude: params.latitude,
      longitude: params.longitude,
      status: RecordStatus.ACTIVE,
    };

    const location = await this.prisma.inventoryLocation.create({
      data,
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

    return this.mapToView(location);
  }

  async updateLocation(id: string, params: UpdateInventoryLocationParams): Promise<InventoryLocationView> {
    const data: Prisma.InventoryLocationUpdateInput = {};
    if (params.name !== undefined) data.name = params.name;
    if (params.address !== undefined) data.address = params.address;
    if (params.latitude !== undefined) data.latitude = params.latitude;
    if (params.longitude !== undefined) data.longitude = params.longitude;
    if (params.status !== undefined) data.status = params.status as RecordStatus;

    const location = await this.prisma.inventoryLocation.update({
      where: { id },
      data,
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

    return this.mapToView(location);
  }
}
