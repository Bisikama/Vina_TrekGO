import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import { ProductTechnicalProfileDomain } from '../../domain/gear.types';
import {
  PRODUCT_TECHNICAL_PROFILE_REPOSITORY_PORT,
} from '../ports/product-technical-profile.repository.port';
import type { ProductTechnicalProfileRepositoryPort } from '../ports/product-technical-profile.repository.port';
import type {
  UpsertProductTechnicalProfileInput,
} from '../dtos/product-technical-profile.dto';
import { validateAttributesForCategory } from '../dtos/user-gear.dto';

@Injectable()
export class StaffProductProfileService {
  constructor(
    @Inject(PRODUCT_TECHNICAL_PROFILE_REPOSITORY_PORT)
    private readonly profileRepo: ProductTechnicalProfileRepositoryPort,
  ) {}

  async getProfile(productId: string): Promise<ProductTechnicalProfileDomain> {
    const profile = await this.profileRepo.findByProductId(productId);
    if (!profile) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
        message: 'Không tìm thấy hồ sơ kỹ thuật cho sản phẩm này',
      });
    }
    return profile;
  }

  async upsertProfile(
    productId: string,
    input: UpsertProductTechnicalProfileInput,
    actorId?: string,
  ): Promise<ProductTechnicalProfileDomain> {
    let normalizedAttributes: Record<string, unknown>;
    try {
      normalizedAttributes = validateAttributesForCategory(input.category, input.attributes);
    } catch (err: any) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CATEGORY_MISMATCH, {
        message: err?.message || 'Thuộc tính kỹ thuật sản phẩm không hợp lệ',
        details: { errors: err?.errors || err?.message },
      });
    }

    return this.profileRepo.upsertProfile(
      productId,
      input.category,
      normalizedAttributes,
      input.expectedVersion,
      input.schemaVersion,
      input.sources,
      actorId,
    );
  }
}

