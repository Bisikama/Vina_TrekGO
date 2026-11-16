import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { AppError, COMMON_ERROR_CODES, RENTAL_ERROR_CODES, RENTAL_ORDERING_ERROR_CODES } from '../../../../../shared/errors';
import { Prisma, EquipmentUnitStatus, EquipmentCondition, MaintenanceStatus, RentalUnitAssignmentStatus } from '@prisma/client';
import { assertGradeDecision } from '../../application/services/equipment-grade.rules';
import { applyGradeDecision } from '../equipment-grade-transfer';
import {
  WEAR_LIMIT_MAINTENANCE_REASON,
  isExpiryExtension,
  isUnitExpired,
  vnCalendarDate,
  wearPercent,
} from '../../application/services/equipment-lifecycle.rules';
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
  DowngradeUnitGradePayload,
  DowngradeUnitGradeResult,
} from '../../application/ports/equipment-unit.port';

const DOWNGRADE_SCOPE = 'RB-INV:equipment-unit-grade-downgrade';
/** Assignment còn mở: unit đang thuộc về một đơn, chưa được đưa về kho xong. */
const OPEN_ASSIGNMENT_STATUSES: RentalUnitAssignmentStatus[] = [
  RentalUnitAssignmentStatus.ASSIGNED,
  RentalUnitAssignmentStatus.PACKED,
  RentalUnitAssignmentStatus.HANDED_OVER,
  RentalUnitAssignmentStatus.RETURNED,
];

/** Cảnh báo kho: số ngày trước hạn dùng. */
const EXPIRING_SOON_DAYS = 30;

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
  intakeBatchCode: true,
  expiresAt: true,
  conditionNotes: true,
  rentalCount: true,
  version: true,
  product: {
    select: {
      id: true,
      sku: true,
      name: true,
      maxRentalCycles: true,
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
        maxRentalCycles: unit.product.maxRentalCycles,
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
      status: unit.status,
      condition: unit.condition,
      expectedReadyAt: unit.expectedReadyAt ? unit.expectedReadyAt.toISOString() : null,
      acquiredAt: unit.acquiredAt ? unit.acquiredAt.toISOString().split('T')[0] : null,
      retiredAt: unit.retiredAt ? unit.retiredAt.toISOString().split('T')[0] : null,
      intakeBatchCode: unit.intakeBatchCode,
      expiresAt: unit.expiresAt ? unit.expiresAt.toISOString().split('T')[0] : null,
      isExpired: isUnitExpired(unit.expiresAt, new Date()),
      conditionNotes: unit.conditionNotes,
      rentalCount: unit.rentalCount,
      wearPercent: wearPercent(unit.rentalCount, unit.product.maxRentalCycles),
      version: unit.version,
    };
  }

  async listUnits(params: ListEquipmentUnitsParams): Promise<{ items: EquipmentUnitView[]; total: number; counts: EquipmentUnitCounts }> {
    const { page, pageSize, productId, status, condition, inventoryLocationId, q, batchCode, expiringBefore } = params;
    
    // Lọc cơ sở, không bao gồm status để đếm tổng
    const baseWhere: Prisma.EquipmentUnitWhereInput = {};
    if (productId) baseWhere.productId = productId;
    if (condition) baseWhere.condition = condition;
    if (inventoryLocationId) {
      baseWhere.currentInventoryLocationId = inventoryLocationId;
    }
    if (batchCode) baseWhere.intakeBatchCode = batchCode;
    if (expiringBefore) baseWhere.expiresAt = { lte: new Date(expiringBefore) };
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
      itemsWhere.status = status;
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const expiringSoonBefore = new Date(vnCalendarDate(new Date()).getTime() + EXPIRING_SOON_DAYS * 86_400_000);
    const [items, totalFiltered, countsGroup, expiringSoon] = await Promise.all([
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
      this.prisma.equipmentUnit.count({
        where: {
          status: { notIn: [EquipmentUnitStatus.RETIRED, EquipmentUnitStatus.LOST] },
          expiresAt: { lte: expiringSoonBefore },
        },
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
      expiringSoon,
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
          status: payload.status,
          condition: payload.condition,
          acquiredAt: payload.acquiredAt ? new Date(payload.acquiredAt) : undefined,
          intakeBatchCode: payload.batchCode,
          expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
          conditionNotes: payload.conditionNotes,
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
              status: payload.status,
              condition: payload.condition,
              acquiredAt: payload.acquiredAt ? new Date(payload.acquiredAt) : undefined,
              intakeBatchCode: payload.batchCode,
              expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
              conditionNotes: payload.conditionNotes,
            },
            select: this.getExplicitSelect(),
          });
          units.push(unit);
        }
        return units;
      });
      return createdUnits.map((u) => this.mapToView(u));
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updateMetadata(input: UpdateEquipmentUnitMetadataInput): Promise<EquipmentUnitView> {
    const { id, expectedVersion, actorId, actorRole, ...data } = input;

    try {
      return await this.prisma.$transaction(async (tx) => {
      const current = await tx.equipmentUnit.findUnique({ where: { id }, select: { expiresAt: true, version: true } });
      if (!current) throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND, { details: { id } });
      // Kéo dài hoặc xoá hạn dùng đưa món trở lại cho thuê: chỉ ADMIN.
      if (actorRole !== 'ADMIN' && isExpiryExtension(current.expiresAt, data.expiresAt)) {
        throw AppError.fromCode(COMMON_ERROR_CODES.FORBIDDEN, {
          message: 'Chỉ Admin được kéo dài hoặc xoá hạn dùng. Nhân viên kho chỉ được rút ngắn.',
          details: { field: 'expiresAt', reason: 'EXPIRY_EXTENSION_REQUIRES_ADMIN' },
        });
      }
      const unit = await tx.equipmentUnit.update({
        where: {
          id,
          version: expectedVersion,
        },
        data: {
          ...(data.homeInventoryLocationId !== undefined && { homeInventoryLocationId: data.homeInventoryLocationId }),
          ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber }),
          ...(data.acquiredAt !== undefined && { acquiredAt: data.acquiredAt ? new Date(data.acquiredAt) : null }),
          ...(data.batchCode !== undefined && { intakeBatchCode: data.batchCode }),
          ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }),
          ...(data.conditionNotes !== undefined && { conditionNotes: data.conditionNotes }),
          version: { increment: 1 },
        },
        select: this.getExplicitSelect(),
      });
      const before = current.expiresAt ? current.expiresAt.toISOString().slice(0, 10) : null;
      const after = unit.expiresAt ? unit.expiresAt.toISOString().slice(0, 10) : null;
      if (data.expiresAt !== undefined && before !== after) {
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'EQUIPMENT_UNIT_EXPIRY_CHANGED',
            entityType: 'EquipmentUnit',
            entityId: id,
            oldValues: { expiresAt: before, version: current.version },
            newValues: { expiresAt: after, version: unit.version },
          },
        });
      }
      return this.mapToView(unit);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
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

  /**
   * Only units sitting in stock are withdrawn: a unit picked, packed or rented keeps serving its
   * order and is retired when Inventory releases it after the return (RB-API-611).
   */
  async retireExpiredUnits(now: Date): Promise<number> {
    const today = vnCalendarDate(now);
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.$queryRaw<{ id: string; version: number }[]>`
        SELECT id, version FROM equipment_units
        WHERE status = 'AVAILABLE'::"EquipmentUnitStatus" AND expires_at IS NOT NULL AND expires_at <= ${today}::date
        ORDER BY id
        LIMIT 200
        FOR UPDATE SKIP LOCKED`;
      for (const unit of expired) {
        await tx.equipmentUnit.update({
          where: { id: unit.id },
          data: { status: EquipmentUnitStatus.RETIRED, retiredAt: today, version: { increment: 1 } },
        });
        await tx.auditLog.create({
          data: {
            action: 'EQUIPMENT_UNIT_EXPIRED_RETIRED',
            entityType: 'EquipmentUnit',
            entityId: unit.id,
            oldValues: { status: 'AVAILABLE', version: unit.version },
            newValues: { status: 'RETIRED', retiredAt: today.toISOString().split('T')[0], version: unit.version + 1 },
          },
        });
      }
      return expired.length;
    });
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
        const now = new Date();
        const before = await tx.equipmentUnit.findUnique({
          where: { id: payload.unitId },
          select: { expiresAt: true, rentalCount: true },
        });

        // Món dùng được: về kệ, trừ khi kho chọn Ngừng sử dụng hoặc món đã hết hạn dùng.
        const usable = payload.resultingCondition !== 'DAMAGED' && payload.resultingCondition !== 'LOST';
        const retire = usable && (payload.retire === true || isUnitExpired(before?.expiresAt, now));
        const targetStatus = payload.resultingCondition === 'DAMAGED' ? 'DAMAGED' :
                             payload.resultingCondition === 'LOST' ? 'LOST' :
                             retire ? 'RETIRED' : 'AVAILABLE';
        // Bảo trì vì hao mòn xong và dùng tiếp: bắt đầu chu kỳ mới (số lượt cũ ghi audit bên dưới).
        const resetWear = activeRecord.reason === WEAR_LIMIT_MAINTENANCE_REASON && targetStatus === 'AVAILABLE';

        // 2. Atomically update EquipmentUnit
        const unit = await tx.equipmentUnit.update({
          where: {
            id: payload.unitId,
            version: payload.expectedVersion,
            status: 'MAINTENANCE',
          },
          data: {
            condition: payload.resultingCondition,
            status: targetStatus,
            ...(targetStatus === 'RETIRED' ? { retiredAt: vnCalendarDate(now) } : {}),
            ...(resetWear ? { rentalCount: 0 } : {}),
            version: { increment: 1 },
          },
          select: this.getExplicitSelect(),
        });
        if (resetWear || targetStatus === 'RETIRED') {
          await tx.auditLog.create({
            data: {
              userId: payload.actorId ?? null,
              action: resetWear ? 'EQUIPMENT_UNIT_WEAR_RESET' : 'EQUIPMENT_UNIT_RETIRED_AFTER_MAINTENANCE',
              entityType: 'EquipmentUnit',
              entityId: payload.unitId,
              oldValues: { status: 'MAINTENANCE', rentalCount: before?.rentalCount ?? null },
              newValues: { status: targetStatus, rentalCount: unit.rentalCount, maintenanceId: activeRecord.id },
            },
          });
        }

        // 3. Update MaintenanceRecord
        const maintenance = await tx.maintenanceRecord.update({
          where: { id: activeRecord.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
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

  /**
   * Hạ hạng một món đang nằm trong kho (kiểm kho định kỳ, món sửa xong).
   * Món vừa trả về đi qua markUnitReady; ở đây chỉ nhận món AVAILABLE không gắn với đơn nào.
   * Thứ tự khoá: unit → nhóm sản phẩm (trong applyGradeDecision) → đơn bị thiếu hàng.
   */
  async downgradeGrade(payload: DowngradeUnitGradePayload): Promise<DowngradeUnitGradeResult> {
    const decision = {
      decision: 'DOWNGRADE' as const,
      reason: payload.reason,
      note: payload.note,
      evidenceIds: payload.evidenceIds,
    };
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          unitId: payload.unitId,
          expectedVersion: payload.expectedVersion,
          reason: decision.reason,
          note: decision.note ?? null,
          evidenceIds: decision.evidenceIds ?? [],
        }),
      )
      .digest('hex');
    const idemWhere = {
      scope_userId_idempotencyKey: {
        scope: DOWNGRADE_SCOPE,
        userId: payload.actorId,
        idempotencyKey: payload.idempotencyKey,
      },
    };

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const cached = await tx.idempotencyRecord.findUnique({ where: idemWhere });
          if (cached) {
            if (cached.requestHash !== requestHash)
              throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.IDEMPOTENCY_KEY_REUSED);
            if (cached.responseBody) return cached.responseBody as unknown as DowngradeUnitGradeResult;
            throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.OPERATION_CONFLICT);
          }
          await tx.idempotencyRecord.create({
            data: { scope: DOWNGRADE_SCOPE, userId: payload.actorId, idempotencyKey: payload.idempotencyKey, requestHash },
          });

          await tx.$queryRaw`SELECT id FROM equipment_units WHERE id = ${payload.unitId}::uuid FOR UPDATE`;
          const unit = await tx.equipmentUnit.findUnique({
            where: { id: payload.unitId },
            select: {
              id: true,
              status: true,
              version: true,
              productId: true,
              product: { select: { id: true, gradeGroupId: true, grade: true } },
            },
          });
          if (!unit) {
            throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_FOUND, { details: { id: payload.unitId } });
          }
          if (unit.version !== payload.expectedVersion) {
            throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT, {
              details: { id: unit.id, expectedVersion: payload.expectedVersion, currentVersion: unit.version },
            });
          }
          if (unit.status !== EquipmentUnitStatus.AVAILABLE) {
            throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_REGRADABLE, {
              details: { id: unit.id, reason: 'STATUS_NOT_AVAILABLE', status: unit.status },
            });
          }
          const [openAssignment, commitment] = await Promise.all([
            tx.rentalUnitAssignment.findFirst({
              where: { equipmentUnitId: unit.id, status: { in: OPEN_ASSIGNMENT_STATUSES } },
              select: { id: true, status: true },
            }),
            tx.rentalReadinessCommitment.findUnique({ where: { unitId: unit.id }, select: { id: true } }),
          ]);
          if (openAssignment) {
            throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_REGRADABLE, {
              details: { id: unit.id, reason: 'OPEN_ASSIGNMENT', assignmentId: openAssignment.id },
            });
          }
          // Commitment không có productId: chuyển unit sang sản phẩm khác sẽ mang cam kết theo sai sản phẩm.
          if (commitment) {
            throw AppError.fromCode(RENTAL_ERROR_CODES.EQUIPMENT_UNIT_NOT_REGRADABLE, {
              details: { id: unit.id, reason: 'READINESS_COMMITMENT', commitmentId: commitment.id },
            });
          }

          // Sản phẩm thường → NOT_APPLICABLE; món GOOD_USED → DOWNGRADE_NOT_ALLOWED.
          assertGradeDecision(unit.product, decision, { required: true });

          const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
          const result = await applyGradeDecision(tx, {
            unitId: unit.id,
            product: unit.product,
            decision,
            actorId: payload.actorId,
            now,
          });

          await tx.auditLog.create({
            data: {
              userId: payload.actorId,
              action: 'EQUIPMENT_UNIT_GRADE_DOWNGRADED',
              entityType: 'EquipmentUnit',
              entityId: unit.id,
              oldValues: { productId: unit.productId, version: unit.version },
              newValues: { productId: result.toProductId, version: result.unitVersion, gradeReviewId: result.reviewId },
              requestId: payload.idempotencyKey,
            },
          });

          const updated = await tx.equipmentUnit.findUniqueOrThrow({
            where: { id: unit.id },
            select: this.getExplicitSelect(),
          });
          const response: DowngradeUnitGradeResult = {
            unit: this.mapToView(updated),
            gradeReview: {
              id: result.reviewId,
              decision: 'DOWNGRADE',
              fromProductId: result.fromProductId,
              toProductId: result.toProductId!,
              shortageOrderIds: result.shortage.orderIds,
            },
          };
          await tx.idempotencyRecord.update({
            where: idemWhere,
            data: {
              responseStatus: 200,
              responseBody: JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue,
              completedAt: now,
            },
          });
          return response;
        },
        { maxWait: 10_000, timeout: 30_000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.OPERATION_CONFLICT);
      throw error;
    }
  }
}
