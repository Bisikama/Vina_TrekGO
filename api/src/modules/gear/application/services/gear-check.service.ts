import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import {
  CoreGearItemInput,
  evaluateGearCheck,
  GearCheckResult,
  isExtendedGearCategory,
  TripContext,
} from '../../domain';
import type { GearCheckRequestInput } from '../dtos/gear-check.dto';
import {
  TRIP_CONTEXT_READ_PORT,
} from '../ports/trip-context-read.port';
import type { TripContextReadPort } from '../ports/trip-context-read.port';
import {
  USER_GEAR_REPOSITORY_PORT,
} from '../ports/user-gear.repository.port';
import type { UserGearRepositoryPort } from '../ports/user-gear.repository.port';
import { GearRuleService } from './gear-rule.service';

@Injectable()
export class GearCheckService {
  constructor(
    @Inject(TRIP_CONTEXT_READ_PORT)
    private readonly tripContextPort: TripContextReadPort,
    @Inject(USER_GEAR_REPOSITORY_PORT)
    private readonly userGearRepo: UserGearRepositoryPort,
    @Optional()
    private readonly ruleService?: GearRuleService,
  ) {}

  async checkGear(userId: string, input: GearCheckRequestInput): Promise<GearCheckResult> {
    // 0. Validate rule DB integrity if rule repository is present
    await this.ruleService?.validateRulesIntegrity();

    // 1. Verify confirmed climate
    if (!input.confirmedClimate) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CLIMATE_NOT_CONFIRMED, {
        message: 'Điều kiện thời tiết của chuyến đi chưa được xác nhận',
      });
    }

    // 2. Validate duplicate item IDs in input
    const uniqueIds = new Set(input.itemIds);
    if (uniqueIds.size !== input.itemIds.length) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
        message: 'Danh sách món đồ chứa ID bị trùng lặp',
      });
    }

    // 3. Retrieve official canonical trip facts and verify trip eligibility + active membership
    const tripFacts = await this.tripContextPort.getTripContext(input.tripId, userId);

    // 4. Construct canonical TripContext
    const tripContext: TripContext = {
      temp_min_c: input.confirmedClimate.temp_min_c,
      temp_max_c: input.confirmedClimate.temp_max_c,
      temp_min_night_c: input.confirmedClimate.temp_min_night_c,
      rain_prob_pct: input.confirmedClimate.rain_prob_pct,
      difficulty: tripFacts.difficulty,
      days: tripFacts.days,
      terrain: tripFacts.terrain,
    };

    // 5. If itemIds is empty [], evaluate empty selection (detects gaps R26, isReady=false)
    if (input.itemIds.length === 0) {
      return evaluateGearCheck([], tripContext);
    }

    // 6. Fetch all items by IDs and verify all-or-nothing ownership
    const items = await this.userGearRepo.findByIdsAndUser(input.itemIds, userId);
    if (items.length !== input.itemIds.length) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
        message: 'Một hoặc nhiều món đồ không tồn tại hoặc không thuộc quyền sở hữu của bạn',
      });
    }

    // Preserve exact input request order
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const orderedItems = input.itemIds.map((id) => itemMap.get(id)!);

    // 7. Reject extended categories at the boundary for stateless check
    for (const item of orderedItems) {
      if (isExtendedGearCategory(item.category)) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_REQUIRES_PLAN, {
          message: `Món đồ '${item.name}' thuộc danh mục mở rộng (${item.category}). Đánh giá món đồ này yêu cầu lập kế hoạch (Plan)`,
        });
      }
    }

    // 8. Transform to CoreGearItemInput
    const coreInputs: CoreGearItemInput[] = orderedItems.map((item) => ({
      id: item.id,
      category: item.category as any,
      condition: item.condition,
      attributes: (item.attributes) ?? {},
    }));

    // 9. Evaluate pure domain engine
    return evaluateGearCheck(coreInputs, tripContext);
  }
}
