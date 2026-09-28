import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors';
import { Prisma, EquipmentUnitStatus, EquipmentCondition, MaintenanceStatus } from '@prisma/client';
import {
  EquipmentUnitPort,
  EquipmentUnitView,
  ListEquipmentUnitsParams,
  EquipmentUnitCounts,
  CreateEquipmentUnitPayload,
  EquipmentUnitHistoryEvent,
  EquipmentUnitStatusValue,
  EquipmentConditionValue,
  BatchCreateEquipmentUnitItem,
  UpdateEquipmentUnitMetadataInput,
  StartMaintenancePayload,
  CompleteMaintenancePayload,
  ChangeMaintenancePortResult,
} from '../../application/ports/equipment-unit.port';

const explicitSelect = {
  id: true,
  assetCode: true,
  qrCode: true,
  serialNumber: true,
  status: true,
  condition: true,
  expectedReadyAt: true,
  acquiredAt: true,
  retiredAt: true,
  version: true,
  product: {
    select: {
      id: true,
      sku: true,
      name: true,
    }
  },
  homeInventoryLocation: {
    select: {
      id: true,
      code: true,
      name: true,
    }
  },
  currentInventoryLocation: {
    select: {
      id: true,
      code: true,
      name: true,
    }
  }
} satisfies Prisma.EquipmentUnitSelect;

type EquipmentUnitWithRelations = Prisma.EquipmentUnitGetPayload<{ select: typeof explicitSelect }>;

@Injectable()
export class PrismaEquipmentUnitAdapter implements EquipmentUnitPort {
  constructor(private readonly prisma: PrismaService) {}

  private getExplicitSelect() {
    return explicitSelect;
  }

  private mapToView(unit: EquipmentUnitWithRelations): EquipmentUnitView {
    return {
      id: unit.id,
      assetCode: unit.assetCode,
      qrCode: unit.qrCode,
      serialNumber: unit.serialNumber,
      product: {
        id: unit.product.id,
        sku: unit.product.sku,
        name: unit.product.name,
      },
      homeInventoryLocation: {
        id: unit.homeInventoryLocation.id,
        code: unit.homeInventoryLocation.code,
        name: unit.homeInventoryLocation.name,
      },
      currentInventoryLocation: unit.currentInventoryLocation ? {
        id: unit.currentInventoryLocation.id,
        code: unit.currentInventoryLocation.code,
        name: unit.currentInventoryLocation.name,
      } : null,
      status: unit.status as EquipmentUnitStatusValue,
      condition: unit.condition as EquipmentConditionValue,
      expectedReadyAt: unit.expectedReadyAt ? unit.expectedReadyAt.toISOString() : null,
      acquiredAt: unit.acquiredAt ? unit.acquiredAt.toISOString().split('T')[0] : null,
      retiredAt: unit.retiredAt ? unit.retiredAt.toISOString().split('T')[0] : null,
      version: unit.version,
    };
  }

  async listUnits(params: ListEquipmentUnitsParams): Promise<{ items: EquipmentUnitView[]; total: number; counts: EquipmentUnitCounts }> {
    const { page, pageSize, productId, status, condition, inventoryLocationId, q } = params;
    
    // Lọc cơ sở, không bao gồm status để đếm tổng
    const baseWhere: Prisma.EquipmentUnitWhereInput = {};
    if (productId) baseWhere.productId = productId;
    if (condition) baseWhere.condition = condition as EquipmentCondition;
    if (inventoryLocationId) {
      baseWhere.currentInventoryLocationId = inventoryLocationId;
    }
    if (q) {
      baseWhere.AND = baseWhere.AND || [];
      (baseWhere.AND as Prisma.EquipmentUnitWhereInput[]).push({
        OR: [
          { assetCode: { contains: q, mode: 'insensitive' } },
          { serialNumber: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    // Lọc dữ liệu trả về, bao gồm status
    const itemsWhere: Prisma.EquipmentUnitWhereInput = { ...baseWhere };
    if (status) {
      itemsWhere.status = status as EquipmentUnitStatus;
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [items, totalFiltered, countsGroup] = await Promise.all([
      this.prisma.equipmentUnit.findMany({
        where: itemsWhere,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: this.getExplicitSelect(),
      }),
      this.prisma.equipmentUnit.count({ where: itemsWhere }),
      this.prisma.equipmentUnit.groupBy({
        by: ['status'],
        _count: true,
        where: baseWhere,
      }),
    ]);

    const counts: EquipmentUnitCounts = {
      total: 0,
      available: 0,
      picked: 0,
      packed: 0,
      rented: 0,
      returnPending: 0,
      cleaning: 0,
      maintenance: 0,
      damaged: 0,
      lost: 0,
      retired: 0,
    };

    for (const group of countsGroup) {
      const c = group._count;
      counts.total += c;
      switch (group.status) {
        case 'AVAILABLE': counts.available = c; break;
        case 'PICKED': counts.picked = c; break;
        case 'PACKED': counts.packed = c; break;
        case 'RENTED': counts.rented = c; break;
        case 'RETURN_PENDING': counts.returnPending = c; break;
        case 'CLEANING': counts.cleaning = c; break;
        case 'MAINTENANCE': counts.maintenance = c; break;
        case 'DAMAGED': counts.damaged = c; break;
        case 'LOST': counts.lost = c; break;
        case 'RETIRED': counts.retired = c; break;
      }
    }

    return {
      items: items.map((unit) => this.mapToView(unit)),
      total: totalFiltered,
      counts,
    };
  }

  async getUnitById(id: string): Promise<EquipmentUnitView | null> {
    const unit = await this.prisma.equipmentUnit.findUnique({
      where: { id },
      select: this.getExplicitSelect(),
    });

    if (!unit) return null;
    return this.mapToView(unit);
  }

  async findByAssetCode(assetCode: string): Promise<EquipmentUnitView | null> {
    const unit = await this.prisma.equipmentUnit.findUnique({
      where: { assetCode },
      select: this.getExplicitSelect(),
    });

    if (!unit) return null;
    return this.mapToView(unit);
  }

  async getUnitsByIds(ids: string[]): Promise<EquipmentUnitView[]> {
    if (!ids || ids.length === 0) return [];
    
    const units = await this.prisma.equipmentUnit.findMany({
      where: { id: { in: ids } },
      select: this.getExplicitSelect(),
    });

    return units.map((u) => this.mapToView(u));
  }

  async createUnit(payload: CreateEquipmentUnitPayload): Promise<EquipmentUnitView> {
    try {
      const unit = await this.prisma.equipmentUnit.create({
        data: {
          productId: payload.productId,
          homeInventoryLocationId: payload.homeInventoryLocationId,
          currentInventoryLocationId: payload.currentInventoryLocationId,
          assetCode: payload.assetCode,
          qrCode: payload.qrCode,
          serialNumber: payload.serialNumber,
          status: payload.status as EquipmentUnitStatus,
          condition: payload.condition as EquipmentCondition,
          acquiredAt: payload.acquiredAt ? new Date(payload.acquiredAt) : undefined,
        },
        select: this.getExplicitSelect(),
      });

      return this.mapToView(unit);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async createBatch(payloads: BatchCreateEquipmentUnitItem[]): Promise<EquipmentUnitView[]> {
    try {
      const createdUnits = await this.prisma.$transaction(async (tx) => {
        const units: EquipmentUnitWithRelations[] = [];
        for (const payload of payloads) {
          const unit = await tx.equipmentUnit.create({
            data: {
              productId: payload.productId,
              homeInventoryLocationId: payload.homeInventoryLocationId,
              currentInventoryLocationId: payload.currentInventoryLocationId,
              assetCode: payload.assetCode,
              qrCode: payload.qrCode,
              serialNumber: payload.serialNumber,
              status: payload.status as EquipmentUnitStatus,
              condition: payload.condition as EquipmentCondition,
              acquiredAt: payload.acquiredAt ? new Date(payload.acquiredAt) : undefined,
            },
            select: this.getExplicitSelect(),
          });
          units.push(unit as unknown as EquipmentUnitWithRelations);
        }
        return units;
      });
      return createdUnits.map((u) => this.mapToView(u));
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updateMetadata(input: UpdateEquipmentUnitMetadataInput): Promise<EquipmentUnitView> {
    const { id, expectedVersion, ...data } = input;
    
    try {
      const unit = await this.prisma.equipmentUnit.update({
        where: {
          id,
          version: expectedVersion,
        },
        data: {
          ...(data.homeInventoryLocationId !== undefined && { homeInventoryLocationId: data.homeInventoryLocationId }),
          ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber }),
          ...(data.acquiredAt !== undefined && { acquiredAt: data.acquiredAt ? new Date(data.acquiredAt) : null }),
          version: { increment: 1 },
        },
        select: this.getExplicitSelect(),
      });
      return this.mapToView(unit);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        // Bản ghi không tồn tại hoặc sai phiên bản (optimistic locking)
        const exists = await this.prisma.equipmentUnit.findUnique({ where: { id } });
        if (!exists) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND, { details: { id } });
        }
        throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, { details: { id, expectedVersion } });
      }
      this.handlePrismaError(error);
    }
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('assetCode') || target.includes('asset_code')) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_ASSET_CODE_EXISTS);
        }
        if (target.includes('qrCode') || target.includes('qr_code')) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_QR_CODE_EXISTS);
        }
      }
    }
    throw error;
  }

  async getHistory(id: string): Promise<EquipmentUnitHistoryEvent[]> {
    const maintenanceRecords = await this.prisma.maintenanceRecord.findMany({
      where: { unitId: id },
      orderBy: { startAt: 'desc' },
      select: {
        startAt: true,
        reason: true,
        status: true,
        staff: {
          select: { fullName: true },
        },
      },
    });

    return maintenanceRecords.map(record => ({
      type: 'MAINTENANCE',
      occurredAt: record.startAt.toISOString(),
      actor: record.staff?.fullName ?? undefined,
      details: {
        reason: record.reason,
        status: record.status,
      }
    }));
  }

  async startMaintenance(payload: StartMaintenancePayload): Promise<ChangeMaintenancePortResult> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Guard active maintenance record
        const activeCount = await tx.maintenanceRecord.count({
          where: { unitId: payload.unitId, status: 'IN_PROGRESS' }
        });
        if (activeCount > 0) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_STATE_CONFLICT);
        }

        // 1. Atomically update EquipmentUnit
        const unit = await tx.equipmentUnit.update({
          where: {
            id: payload.unitId,
            version: payload.expectedVersion,
            status: { in: ['AVAILABLE', 'CLEANING', 'DAMAGED'] }
          },
          data: {
            status: 'MAINTENANCE',
            version: { increment: 1 },
          },
          select: this.getExplicitSelect(),
        });

        // 2. Create MaintenanceRecord
        const maintenance = await tx.maintenanceRecord.create({
          data: {
            unitId: payload.unitId,
            inventoryLocationId: payload.inventoryLocationId,
            staffId: payload.staffId,
            reason: payload.reason,
            notes: payload.notes || null,
            status: 'IN_PROGRESS',
            startAt: new Date(),
            cost: 0,
            version: 1,
          },
        });

        return { unit, maintenance };
      });

      return {
        unit: this.mapToView(result.unit),
        maintenance: {
          id: result.maintenance.id,
          status: result.maintenance.status,
          reason: result.maintenance.reason,
          notes: result.maintenance.notes,
          startAt: result.maintenance.startAt.toISOString(),
          completedAt: result.maintenance.completedAt ? result.maintenance.completedAt.toISOString() : null,
          version: result.maintenance.version,
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        const exists = await this.prisma.equipmentUnit.findUnique({ where: { id: payload.unitId } });
        if (!exists) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND, { details: { id: payload.unitId } });
        }
        if (exists.version !== payload.expectedVersion) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, { details: { id: payload.unitId, expectedVersion: payload.expectedVersion } });
        }
        if (exists.status === 'RENTED') {
          throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_RENTED);
        }
        throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_MAINTAINABLE, {
          details: { message: `Cannot start maintenance from status ${exists.status}` }
        });
      }
      this.handlePrismaError(error);
    }
  }

  async completeMaintenance(payload: CompleteMaintenancePayload): Promise<ChangeMaintenancePortResult> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Find active IN_PROGRESS MaintenanceRecord
        const activeRecords = await tx.maintenanceRecord.findMany({
          where: {
            unitId: payload.unitId,
            status: 'IN_PROGRESS',
          }
        });

        if (activeRecords.length === 0) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_NOT_ACTIVE);
        }

        if (activeRecords.length > 1) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_MAINTENANCE_STATE_CONFLICT);
        }

        const activeRecord = activeRecords[0];

        const targetStatus = payload.resultingCondition === 'DAMAGED' ? 'DAMAGED' :
                             payload.resultingCondition === 'LOST' ? 'LOST' : 'AVAILABLE';

        // 2. Atomically update EquipmentUnit
        const unit = await tx.equipmentUnit.update({
          where: {
            id: payload.unitId,
            version: payload.expectedVersion,
            status: 'MAINTENANCE',
          },
          data: {
            condition: payload.resultingCondition as EquipmentCondition,
            status: targetStatus as EquipmentUnitStatus,
            version: { increment: 1 },
          },
          select: this.getExplicitSelect(),
        });

        // 3. Update MaintenanceRecord
        const maintenance = await tx.maintenanceRecord.update({
          where: { id: activeRecord.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });

        return { unit, maintenance };
      });

      return {
        unit: this.mapToView(result.unit),
        maintenance: {
          id: result.maintenance.id,
          status: result.maintenance.status,
          reason: result.maintenance.reason,
          notes: result.maintenance.notes,
          startAt: result.maintenance.startAt.toISOString(),
          completedAt: result.maintenance.completedAt ? result.maintenance.completedAt.toISOString() : null,
          version: result.maintenance.version,
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        const exists = await this.prisma.equipmentUnit.findUnique({ where: { id: payload.unitId } });
        if (!exists) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND, { details: { id: payload.unitId } });
        }
        if (exists.version !== payload.expectedVersion) {
          throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, { details: { id: payload.unitId, expectedVersion: payload.expectedVersion } });
        }
        throw AppError.fromCode(RENTAL_ERROR_CODES.INVALID_EQUIPMENT_STATE_TRANSITION, {
          details: { message: `Cannot complete maintenance because unit status is ${exists.status}, expected MAINTENANCE.` }
        });
      }
      this.handlePrismaError(error);
    }
  }
}
