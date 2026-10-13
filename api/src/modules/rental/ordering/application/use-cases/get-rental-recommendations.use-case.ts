import { Inject, Injectable } from '@nestjs/common';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_ORDERING_ERROR_CODES } from 'src/shared/errors/codes/rental-ordering.error-codes';
import {
  RENTAL_CATALOG_PORT,
  type RentalCatalogPort,
  type RentalProductTransactionData,
} from '../ports/rental-catalog.port';
import {
  RENTAL_CONTEXT_PORT,
  type RentalContextPort,
} from '../ports/rental-context.port';
import {
  calculateChargedDays,
  evaluateRentalEligibility,
} from '../services/rental-ordering.rules';

export interface GetRentalRecommendationsCommand {
  tripId: string;
  userId: string;
  categoryId?: string;
  limit: number;
  now?: Date;
}

interface RuleMatch {
  tag: string;
  reason: string;
}

@Injectable()
export class GetRentalRecommendationsUseCase {
  constructor(
    @Inject(RENTAL_CONTEXT_PORT)
    private readonly contextPort: RentalContextPort,
    @Inject(RENTAL_CATALOG_PORT)
    private readonly catalogPort: RentalCatalogPort,
  ) {}

  async execute(command: GetRentalRecommendationsCommand) {
    const now = command.now ?? new Date();

    // Bước 1: Xác minh Trip context và ownership trước khi dùng dữ liệu Trip để gợi ý.
    const context = await this.contextPort.getByTripId(command.tripId, command.userId, now);
    if (!context) {
      throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.TRIP_MEMBERSHIP_NOT_FOUND);
    }
    if (context.userId !== command.userId) {
      throw AppError.fromCode('FORBIDDEN');
    }

    // Bước 2: Recommendation là một phần của rental flow nên chỉ chạy trên context hợp lệ.
    // Recommendation KHÔNG tự thay đổi kết quả eligibility.
    const decision = evaluateRentalEligibility(context, now);
    if (!decision.eligible) {
      throw AppError.fromCode(
        decision.reason === 'RENTAL_CUTOFF_PASSED'
          ? RENTAL_ORDERING_ERROR_CODES.RENTAL_CUTOFF_PASSED
          : RENTAL_ORDERING_ERROR_CODES.TRIP_MEMBERSHIP_NOT_ELIGIBLE,
      );
    }

    // Bước 3: Lấy candidate set từ catalog ACTIVE.
    // P0 không phụ thuộc AI; nếu sau này có AI thì chỉ được rerank candidate set này.
    const products = await this.catalogPort.listActiveProducts(command.categoryId);
    const durationDays = calculateChargedDays(
      context.trip.startAt,
      context.trip.endAt,
    );

    // Bước 4: Sinh các rule tag từ Trip context.
    // Tag hiện bám mock pack v0.2.0: MULTI_DAY, MODERATE_TRAIL, RAIN_READY.
    const activeRules = this.buildRules({
      durationDays,
      difficulty: context.trip.difficulty,
      weatherSummary: context.trip.weatherSummary,
      rainProbabilityPercent: context.trip.rainProbabilityPercent,
    });

    // Bước 5: Chấm điểm deterministic bằng rule-based matching.
    // Score chỉ phục vụ xếp hạng/giải thích, không ảnh hưởng giá, cọc, quantity hay availability.
    const recommendations = products
      .map((product) => this.scoreProduct(product, activeRules))
      .sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId))
      .slice(0, command.limit);

    return {
      tripSummary: {
        tripId: context.trip.id,
        name: context.trip.name,
        durationDays,
        difficulty: context.trip.difficulty ?? 'UNKNOWN',
        weatherSummary: context.trip.weatherSummary,
      },
      recommendations,
      generatedAt: now,
    };
  }

  // Hàm buildRules dùng để build các rule tag từ Trip context.
  private buildRules(input: {
    durationDays: number;
    difficulty: string | null;
    weatherSummary: string | null;
    rainProbabilityPercent: number | null;
  }): RuleMatch[] {
    const rules: RuleMatch[] = [];

    if (input.durationDays >= 2) {
      rules.push({
        tag: 'MULTI_DAY',
        reason: `Chuyến ${input.durationDays} ngày`,
      });
    }

    if (input.difficulty === 'MEDIUM') {
      rules.push({
        tag: 'MODERATE_TRAIL',
        reason: 'Độ khó trung bình',
      });
    }

    const weatherText = (input.weatherSummary ?? '').toLowerCase();
    const hasRainSignal =
      weatherText.includes('mưa') ||
      weatherText.includes('rain') ||
      (input.rainProbabilityPercent ?? 0) >= 30;

    if (hasRainSignal) {
      rules.push({
        tag: 'RAIN_READY',
        reason: 'Thời tiết có khả năng mưa',
      });
    }

    return rules;
  }

  // Hàm scoreProduct dùng để chấm điểm sản phẩm dựa trên rule tag.
  private scoreProduct(
    product: RentalProductTransactionData,
    activeRules: RuleMatch[],
  ) {
    const tagSet = new Set(product.recommendationTags);
    const matchedRules = activeRules.filter((rule) => tagSet.has(rule.tag));

    // Nếu context chưa có đủ metadata hoặc product chưa gắn tag, vẫn trả candidate với score 0.
    // Cách này fail-open cho recommendation nhưng không bịa lý do.
    const score =
      activeRules.length === 0
        ? 0
        : Math.round((matchedRules.length / activeRules.length) * 100) / 100;

    return {
      productId: product.id,
      score,
      reasons: matchedRules.map((rule) => rule.reason),
      source: 'RULE' as const,
    };
  }
}