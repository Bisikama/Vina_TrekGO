import { Injectable } from '@nestjs/common';
import {
  EquipmentCondition,
  EquipmentUnitStatus,
  RentalUnitAssignmentStatus,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import type {
  RentalAvailabilityPort,
  RentalAvailabilityQuery,
} from '../../application/ports/rental-availability.port';

@Injectable()
export class PrismaRentalAvailabilityAdapter
  implements RentalAvailabilityPort
{
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableCount(query: RentalAvailabilityQuery): Promise<number> {
    // Bước 1:
    // Tính sức chứa vật lý cơ sở của RentalProduct.
    //
    // Những unit hỏng, mất, ngừng sử dụng hoặc đang bảo trì
    // làm giảm trực tiếp sức chứa thực tế của hệ thống.
    //
    // Các trạng thái PICKED / PACKED / RENTED / RETURN_PENDING / CLEANING
    // vẫn tạm nằm trong sức chứa cơ sở vì sự chiếm dụng của chúng sẽ được
    // xử lý bằng Reservation hoặc bước chặn bổ sung phía dưới.
    //
    // Cách tách này giúp tránh trừ hai lần cùng một thiết bị.
    const usablePhysicalCapacity = await this.prisma.equipmentUnit.count({
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
          notIn: [
            EquipmentCondition.DAMAGED,
            EquipmentCondition.LOST,
          ],
        },
      },
    });

    // Bước 2:
    // Tính tổng số lượng đang được giữ trong khoảng thời gian yêu cầu.
    //
    // HELD chỉ chiếm sức chứa khi thời hạn giữ chỗ vẫn còn hiệu lực.
    // CONFIRMED luôn chiếm sức chứa nếu khoảng thời gian bị chồng lấp.
    //
    // Điều kiện chồng lấp sử dụng khoảng [occupiedFrom, occupiedUntil):
    //
    // existing.occupiedFrom < requested.occupiedUntil
    // &&
    // existing.occupiedUntil > requested.occupiedFrom
    const overlappingReservations =
      await this.prisma.rentalQuantityReservation.findMany({
        where: {
          productId: query.productId,

          occupiedFrom: {
            lt: query.occupiedUntil,
          },

          occupiedUntil: {
            gt: query.occupiedFrom,
          },

          OR: [
            {
              status: ReservationStatus.CONFIRMED,
            },
            {
              status: ReservationStatus.HELD,
              holdExpiresAt: {
                gt: query.now,
              },
            },
          ],
        },

        select: {
          quantity: true,
        },
      });

    const reservedQuantity = overlappingReservations.reduce(
      (total, reservation) => total + reservation.quantity,
      0,
    );

    // Bước 3:
    // Tìm những unit đang bị chặn vật lý nhưng sự chiếm dụng đó
    // chưa được một Reservation CONFIRMED đang overlap đại diện.
    //
    // Ví dụ:
    //
    // - khách trả trễ nên unit vẫn RENTED;
    // - unit vẫn RETURN_PENDING;
    // - unit vẫn CLEANING sau khi window cũ kết thúc;
    // - unit đã được pick/pack nhưng dữ liệu reservation không còn cover.
    //
    // Những unit này phải tiếp tục làm giảm availability.
    const additionalBlockedUnitCount =
      await this.prisma.equipmentUnit.count({
        where: {
          productId: query.productId,

          // Bước 1 đã loại các condition này khỏi sức chứa.
          // Bước 3 cũng phải loại để cùng một unit không bị trừ hai lần.
          condition: {
            notIn: [
              EquipmentCondition.DAMAGED,
              EquipmentCondition.LOST,
            ],
          },

          status: {
            notIn: [
              EquipmentUnitStatus.MAINTENANCE,
              EquipmentUnitStatus.DAMAGED,
              EquipmentUnitStatus.LOST,
              EquipmentUnitStatus.RETIRED,
            ],
          },

          // Unit được xem là có khả năng đang bị chặn nếu:
          // 1. lifecycle vật lý cho thấy nó chưa sẵn sàng; hoặc
          // 2. vẫn tồn tại Assignment đang hoạt động.
          OR: [
            {
              status: {
                in: [
                  EquipmentUnitStatus.PICKED,
                  EquipmentUnitStatus.PACKED,
                  EquipmentUnitStatus.RENTED,
                  EquipmentUnitStatus.RETURN_PENDING,
                  EquipmentUnitStatus.CLEANING,
                ],
              },
            },
            {
              rentalUnitAssignmentsViaEquipmentUnitId: {
                some: {
                  status: {
                    in: [
                      RentalUnitAssignmentStatus.ASSIGNED,
                      RentalUnitAssignmentStatus.PACKED,
                      RentalUnitAssignmentStatus.HANDED_OVER,
                    ],
                  },
                },
              },
            },
          ],

          // Không trừ bổ sung nếu unit này đã được một Reservation
          // CONFIRMED đang overlap đại diện.
          //
          // REPLACED và UNASSIGNED không được dùng để chứng minh
          // unit vẫn thuộc cam kết hiện tại vì unit đã bị thay hoặc bỏ gắn.
          rentalUnitAssignmentsViaEquipmentUnitId: {
            none: {
              status: {
                in: [
                  RentalUnitAssignmentStatus.ASSIGNED,
                  RentalUnitAssignmentStatus.PACKED,
                  RentalUnitAssignmentStatus.HANDED_OVER,
                  RentalUnitAssignmentStatus.RETURNED,
                  RentalUnitAssignmentStatus.CLOSED,
                ],
              },

              orderLine: {
                productId: query.productId,

                rentalQuantityReservationsViaOrderLineId: {
                  some: {
                    productId: query.productId,

                    status: ReservationStatus.CONFIRMED,

                    occupiedFrom: {
                      lt: query.occupiedUntil,
                    },

                    occupiedUntil: {
                      gt: query.occupiedFrom,
                    },
                  },
                },
              },
            },
          },
        },
      });

    // Bước 4:
    // Số lượng khả dụng cuối cùng:
    //
    // sức chứa vật lý
    // - số lượng đang được giữ
    // - unit bị chặn vật lý bổ sung.
    //
    // Luôn giới hạn tối thiểu bằng 0.
    //
    // Đây vẫn chỉ là ảnh chụp availability tại thời điểm kiểm tra.
    // B2 bắt buộc phải kiểm tra lại trong giao dịch cơ sở dữ liệu nguyên tử
    // khi thực sự tạo RentalOrder và giữ số lượng.
    return Math.max(
      0,
      usablePhysicalCapacity -
        reservedQuantity -
        additionalBlockedUnitCount,
    );
  }
}