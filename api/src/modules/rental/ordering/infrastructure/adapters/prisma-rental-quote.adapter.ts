import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import type {
  CreateRentalQuoteRecord,
  PersistedRentalQuote,
  RentalQuotePort,
} from '../../application/ports/rental-quote.port';

@Injectable()
export class PrismaRentalQuoteAdapter implements RentalQuotePort {
  constructor(private readonly prisma: PrismaService) {}

  async createQuote(
    data: CreateRentalQuoteRecord,
  ): Promise<PersistedRentalQuote> {
    // Bước hạ tầng: Quote header và tất cả QuoteLines phải commit cùng nhau.
    // Transaction này CHỈ lưu quote snapshot; tuyệt đối chưa tạo quantity reservation ở B1.
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.rentalQuote.create({
        data: {
          userId: data.userId,
          tripId: data.tripId,
          bookingId: data.bookingId,
          membershipKind: data.membershipKind ?? null,
          membershipRef: data.membershipRef,
          membershipSourceVersion: data.membershipSourceVersion ?? null,
          membershipSnapshot: data.membershipSnapshot as Prisma.InputJsonValue,
          pickupPointId: data.pickupPointId,
          returnPointId: data.returnPointId,
          returnOptionSnapshot: (data.returnOptionSnapshot as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          recipientUserId: data.recipientUserId,
          recipientParticipantId: data.recipientParticipantId,
          recipientSnapshot: data.recipientSnapshot as Prisma.InputJsonValue,
          contextVersion: data.contextVersion,
          rentalPolicyId: data.rentalPolicyId,
          rentalStartAt: data.rentalStartAt,
          rentalEndAt: data.rentalEndAt,
          plannedHandoverAt: data.plannedHandoverAt,
          plannedReturnAt: data.plannedReturnAt,
          occupiedStartAt: data.occupiedStartAt,
          occupiedEndAt: data.occupiedEndAt,
          rentalFee: data.rentalFee,
          totalDeposit: data.totalDeposit,
          totalAmount: data.totalAmount,
          currency: data.currency,
          policySnapshot: data.policySnapshot as Prisma.InputJsonValue,
          expiresAt: data.expiresAt,
          rentalQuoteLinesViaQuoteId: {
            create: data.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              occupiedFrom: line.occupiedFrom,
              occupiedUntil: line.occupiedUntil,
              dailyPriceSnapshot: line.dailyPriceSnapshot,
              depositPerUnitSnapshot: line.depositPerUnitSnapshot,
              replacementValueSnapshot: line.replacementValueSnapshot,
              chargedDays: line.chargedDays,
              lineRentalFee: line.lineRentalFee,
              lineDeposit: line.lineDeposit,
            })),
          },
        },
        select: {
          id: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      return quote;
    });
  }
}
