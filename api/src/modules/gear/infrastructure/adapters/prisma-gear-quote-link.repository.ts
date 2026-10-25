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
    // 0. Idempotent check for historical / existing links (B07)
    const existing = this.prisma.gearQuoteLink?.findUnique
      ? await this.prisma.gearQuoteLink.findUnique({
          where: {
            planRevisionId_quoteId: {
              planRevisionId,
              quoteId,
            },
          },
        })
      : null;

    if (existing) {
      if (existing.userId !== userId) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_OWNED, {
          message: 'Liên kết báo giá thuộc quyền sở hữu của người dùng khác',
        });
      }
      return this.toDomain(existing);
    }

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

    // Verify trip alignment: quote must belong to the exact same trip as the plan
    if (quote.tripId && rev.plan?.tripId && quote.tripId !== rev.plan.tripId) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE, {
        message: 'Báo giá thuê không thuộc về chuyến đi của kế hoạch này',
      });
    }

    if (quote.status === 'EXPIRED' || (quote.expiresAt && quote.expiresAt < new Date())) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE, {
        message: 'Báo giá thuê đã hết hạn, không thể liên kết vào kế hoạch',
      });
    }

    // 3. Fail-closed: option sets must exist for this plan revision
    const optionSets = this.prisma.gearPlanOptionSet
      ? await this.prisma.gearPlanOptionSet.findMany({
          where: { planRevisionId },
        })
      : [];

    if (optionSets.length === 0) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE, {
        message: 'Phiên bản kế hoạch chưa có tập phương án nào để đối chiếu báo giá',
      });
    }

    // For new links, must have at least one active, unexpired option set (B07)
    const activeOptionSets = optionSets.filter(
      (s) => !s.expiresAt || new Date(s.expiresAt).getTime() > Date.now(),
    );
    if (activeOptionSets.length === 0) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_OPTION_SET_EXPIRED, {
        message: 'Tập phương án trang bị đã hết hạn. Vui lòng tạo lại phương án mới trước khi liên kết báo giá.',
      });
    }

    // 4. Fail-closed: quote must have quote lines
    const quoteLines = this.prisma.rentalQuoteLine
      ? await this.prisma.rentalQuoteLine.findMany({
          where: { quoteId },
        })
      : [];

    if (!quoteLines || quoteLines.length === 0) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE, {
        message: 'Báo giá thuê không có dòng sản phẩm nào để liên kết',
      });
    }

    // 5. Aggregate quote product quantities
    const quoteQtyMap = new Map<string, number>();
    for (const ql of quoteLines) {
      quoteQtyMap.set(ql.productId, (quoteQtyMap.get(ql.productId) ?? 0) + (ql.quantity ?? 1));
    }

    // 6. Match against a specific valid option (never union mutually exclusive options!)
    let matchedOption = false;

    for (const set of activeOptionSets) {
      const options = (set.optionsJson as any[]) || [];
      for (const opt of options) {
        const optLines = opt.rentalLines || [];
        if (optLines.length === 0 && quoteQtyMap.size === 0) {
          matchedOption = true;
          break;
        }

        const optQtyMap = new Map<string, number>();
        for (const line of optLines) {
          if (line.productId) {
            optQtyMap.set(
              line.productId,
              (optQtyMap.get(line.productId) ?? 0) + (line.quantity ?? 1),
            );
          }
        }

        if (optQtyMap.size !== quoteQtyMap.size) {
          continue;
        }

        let isMatch = true;
        for (const [prodId, neededQty] of optQtyMap.entries()) {
          const actualQty = quoteQtyMap.get(prodId);
          if (actualQty !== neededQty) {
            isMatch = false;
            break;
          }
        }

        if (isMatch) {
          matchedOption = true;
          break;
        }
      }
      if (matchedOption) break;
    }

    if (!matchedOption) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE, {
        message: 'Sản phẩm hoặc số lượng trong báo giá không khớp với bất kỳ phương án đơn lẻ nào của kế hoạch',
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
        // Idempotent: preserve original verifiedAt timestamp
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
