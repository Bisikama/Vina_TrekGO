import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import {
  GEAR_RULE_METADATA_REGISTRY,
  GearRequirementRuleMetadata,
} from '../../domain';
import {
  GEAR_RULE_REPOSITORY_PORT,
} from '../ports/gear-rule.repository.port';
import type { GearRuleRepositoryPort } from '../ports/gear-rule.repository.port';

export function summarizeRuleSet(
  rules: readonly Pick<GearRequirementRuleMetadata, 'ruleVersion'>[],
): { version: string; rulesCount: number } {
  const versions = Array.from(new Set(rules.map((r) => r.ruleVersion).filter(Boolean))).sort();
  return { version: versions.join(','), rulesCount: rules.length };
}

@Injectable()
export class GearRuleService {
  constructor(
    @Optional()
    @Inject(GEAR_RULE_REPOSITORY_PORT)
    private readonly ruleRepo?: GearRuleRepositoryPort,
  ) {}

  /**
   * C04: Validates the integrity of safety rules between the database and the canonical registry.
   * If ruleRepo is configured, verifies that:
   * 1. The database is not empty.
   * 2. Exactly all 28 canonical rules exist and are active.
   * 3. Categories, default verdicts, and message templates strictly match the canonical registry.
   * Fails closed with GEAR_CONFIGURATION_ERROR (500) if corrupt or incomplete.
   */
  async validateRulesIntegrity(): Promise<void> {
    if (!this.ruleRepo) {
      return;
    }

    const dbRules = await this.ruleRepo.findActive();
    if (!dbRules || dbRules.length === 0) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONFIGURATION_ERROR, {
        message: 'Cơ sở dữ liệu thiếu cấu hình quy tắc an toàn bắt buộc (tập quy tắc rỗng)',
      });
    }

    if (dbRules.length !== GEAR_RULE_METADATA_REGISTRY.length) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONFIGURATION_ERROR, {
        message: `Số lượng quy tắc kích hoạt trong cơ sở dữ liệu (${dbRules.length}) không khớp với 28 quy tắc chuẩn (${GEAR_RULE_METADATA_REGISTRY.length})`,
      });
    }

    const dbMap = new Map(dbRules.map((r) => [r.id, r]));
    for (const canonical of GEAR_RULE_METADATA_REGISTRY) {
      const dbRule = dbMap.get(canonical.id);
      if (!dbRule) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONFIGURATION_ERROR, {
          message: `Thiếu quy tắc chuẩn '${canonical.id}' trong cơ sở dữ liệu`,
        });
      }
      if (dbRule.category !== canonical.category) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONFIGURATION_ERROR, {
          message: `Quy tắc '${canonical.id}' có danh mục không khớp giữa database (${dbRule.category}) và registry (${canonical.category})`,
        });
      }
      if (dbRule.defaultVerdict !== canonical.defaultVerdict) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONFIGURATION_ERROR, {
          message: `Quy tắc '${canonical.id}' có kết luận mặc định không khớp giữa database (${dbRule.defaultVerdict}) và registry (${canonical.defaultVerdict})`,
        });
      }
      if (dbRule.templateVi !== canonical.templateVi) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONFIGURATION_ERROR, {
          message: `Quy tắc '${canonical.id}' có mẫu thông điệp cảnh báo không khớp với registry`,
        });
      }
    }
  }

  /**
   * Phiên bản và số quy tắc đang hoạt động, ghi vào revision kế hoạch để biết đánh giá dựa trên bộ quy tắc nào.
   * Không có repo (hoặc DB rỗng) → lấy theo registry chuẩn.
   */
  async getActiveRuleSetInfo(): Promise<{ version: string; rulesCount: number }> {
    const rules =
      (this.ruleRepo ? await this.ruleRepo.findActive() : null) ?? [];
    return summarizeRuleSet(rules.length > 0 ? rules : GEAR_RULE_METADATA_REGISTRY);
  }

  async getRequirementRules(): Promise<GearRequirementRuleMetadata[]> {
    await this.validateRulesIntegrity();
    return [...GEAR_RULE_METADATA_REGISTRY];
  }
}
