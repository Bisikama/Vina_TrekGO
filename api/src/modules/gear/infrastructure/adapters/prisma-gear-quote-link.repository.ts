import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import { GearQuoteLinkDomain } from '../../domain/gear.types';
import { GearQuoteLinkRepositoryPort } from '../../application/ports/gear-quote-link.repository.port';

@Injectable()
export class PrismaGearQuoteLinkRepository implements GearQuoteLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByRevisionAndQuote(
    planRevisionId: string,
    quoteId: string,
    userId: string,
  ): Promise<GearQuoteLinkDomain | null> {
    const record = await this.prisma.gearQuoteLink.findFirst({
      where: {
        planRevisionId,
        quoteId,
        userId,
      },
    });
    return record ? this.toDomain(record) : null;
  }

  async linkQuote(planRevisionId: string, quoteId: string, userId: string): Promise<GearQuoteLinkDomain> {
    // 1. Verify plan revision ownership chain
    const rev = await this.prisma.gearPlanRevision.findUnique({
      where: { id: planRevisionId },
      include: { plan: true },
    });

    if (!rev) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, {
        message: 'Phiên bản kế hoạch trang bị không tồn tại',
      });
    }

    if (rev.plan.userId !== userId) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_FORBIDDEN, {
        message: 'Phiên bản kế hoạch trang bị thuộc quyền sở hữu của người dùng khác',
      });
    }

    // 2. Verify rental quote ownership & eligibility
    const quote = await this.prisma.rentalQuote.findUnique({
      where: { id: quoteId },
    });

    if (!quote) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_FOUND, {
        message: 'Báo giá thuê liên kết không tồn tại',
      });
    }

    if (quote.userId !== userId) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_OWNED, {
        message: 'Báo giá thuê thuộc quyền sở hữu của người dùng khác',
      });
    }

    if (quote.status === 'EXPIRED' || (quote.expiresAt && quote.expiresAt < new Date())) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE, {
        message: 'Báo giá thuê đã hết hạn, không thể liên kết vào kế hoạch',
      });
    }

    const record = await this.prisma.gearQuoteLink.upsert({
      where: {
        planRevisionId_quoteId: {
          planRevisionId,
          quoteId,
        },
      },
      create: {
        planRevisionId,
        quoteId,
        userId,
        verifiedAt: new Date(),
      },
      update: {
        verifiedAt: new Date(),
      },
    });

    return this.toDomain(record);
  }

  private toDomain(record: any): GearQuoteLinkDomain {
    return {
      id: record.id,
      planRevisionId: record.planRevisionId,
      quoteId: record.quoteId,
      userId: record.userId,
      verifiedAt: record.verifiedAt,
      createdAt: record.createdAt,
    };
  }
}
