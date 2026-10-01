import { Injectable } from '@nestjs/common';
import {
  EquipmentCondition,
  EquipmentUnitStatus,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import type {
  RentalAvailabilityPort,
  RentalAvailabilityQuery,
} from '../../application/ports/rental-availability.port';

@Injectable()
export class PrismaRentalAvailabilityAdapter implements RentalAvailabilityPort {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableCount(query: RentalAvailabilityQuery): Promise<number> {
    // Bước 1: tính capacity vật lý có thể phục vụ.
    // Không tính unit đang MAINTENANCE / DAMAGED / LOST / RETIRED và condition DAMAGED / LOST.
    // Các trạng thái PICKED/PACKED/RENTED vẫn thuộc fleet vật lý; window bận được trừ bằng quantity reservation.
    const serviceableCapacity = await this.prisma.equipmentUnit.count({
      where: {
        productId: query.productId,
        status: {
          notIn: [
            EquipmentUnitStatus.MAINTENANCE,
            EquipmentUnitStatus.DAMAGED,
            EquipmentUnitStatus.LOST,
            EquipmentUnitStatus.RETIRED,
          ],
        },
        condition: {
          notIn: [EquipmentCondition.DAMAGED, EquipmentCondition.LOST],
        },
      },
    });

    // Bước 2: lấy các quantity hold overlap thật sự đang chiếm capacity.
    // HELD chỉ tính khi TTL còn hiệu lực; CONFIRMED luôn tính khi overlap.
    const overlappingReservations =
      await this.prisma.rentalQuantityReservation.findMany({
        where: {
          productId: query.productId,
          occupiedFrom: { lt: query.occupiedUntil },
          occupiedUntil: { gt: query.occupiedFrom },
          OR: [
            { status: ReservationStatus.CONFIRMED },
            {
              status: ReservationStatus.HELD,
              holdExpiresAt: { gt: query.now },
            },
          ],
        },
        select: { quantity: true },
      });

    const reservedQuantity = overlappingReservations.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    // Bước 3: availableCount không được âm.
    // B2 vẫn phải recheck cùng logic bên trong transaction để chống race condition.
    return Math.max(0, serviceableCapacity - reservedQuantity);
  }
}