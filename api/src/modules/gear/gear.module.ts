import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import {
  USER_GEAR_REPOSITORY_PORT,
  GEAR_RULE_REPOSITORY_PORT,
  GEAR_EXTRACTION_DRAFT_REPOSITORY_PORT,
  GEAR_EXTRACTION_CACHE_PORT,
  GEAR_CONCURRENCY_LEASE_PORT,
  GEAR_PLAN_REPOSITORY_PORT,
  GEAR_PLAN_REVISION_REPOSITORY_PORT,
  GEAR_PLAN_OPTION_SET_REPOSITORY_PORT,
  GEAR_ADVICE_RUN_REPOSITORY_PORT,
  GEAR_QUOTE_LINK_REPOSITORY_PORT,
  PRODUCT_TECHNICAL_PROFILE_REPOSITORY_PORT,
} from './application/ports';
import {
  PrismaUserGearRepository,
  PrismaGearRuleRepository,
  PrismaGearExtractionDraftRepository,
  PrismaGearExtractionCacheAdapter,
  PrismaGearConcurrencyLeaseAdapter,
  PrismaGearPlanRepository,
  PrismaGearPlanRevisionRepository,
  PrismaGearPlanOptionSetRepository,
  PrismaGearAdviceRunRepository,
  PrismaGearQuoteLinkRepository,
  PrismaProductTechnicalProfileRepository,
} from './infrastructure/adapters';

export const GEAR_REPOSITORY_PROVIDERS = [
  {
    provide: USER_GEAR_REPOSITORY_PORT,
    useClass: PrismaUserGearRepository,
  },
  {
    provide: GEAR_RULE_REPOSITORY_PORT,
    useClass: PrismaGearRuleRepository,
  },
  {
    provide: GEAR_EXTRACTION_DRAFT_REPOSITORY_PORT,
    useClass: PrismaGearExtractionDraftRepository,
  },
  {
    provide: GEAR_EXTRACTION_CACHE_PORT,
    useClass: PrismaGearExtractionCacheAdapter,
  },
  {
    provide: GEAR_CONCURRENCY_LEASE_PORT,
    useClass: PrismaGearConcurrencyLeaseAdapter,
  },
  {
    provide: GEAR_PLAN_REPOSITORY_PORT,
    useClass: PrismaGearPlanRepository,
  },
  {
    provide: GEAR_PLAN_REVISION_REPOSITORY_PORT,
    useClass: PrismaGearPlanRevisionRepository,
  },
  {
    provide: GEAR_PLAN_OPTION_SET_REPOSITORY_PORT,
    useClass: PrismaGearPlanOptionSetRepository,
  },
  {
    provide: GEAR_ADVICE_RUN_REPOSITORY_PORT,
    useClass: PrismaGearAdviceRunRepository,
  },
  {
    provide: GEAR_QUOTE_LINK_REPOSITORY_PORT,
    useClass: PrismaGearQuoteLinkRepository,
  },
  {
    provide: PRODUCT_TECHNICAL_PROFILE_REPOSITORY_PORT,
    useClass: PrismaProductTechnicalProfileRepository,
  },
  PrismaUserGearRepository,
  PrismaGearRuleRepository,
  PrismaGearExtractionDraftRepository,
  PrismaGearExtractionCacheAdapter,
  PrismaGearConcurrencyLeaseAdapter,
  PrismaGearPlanRepository,
  PrismaGearPlanRevisionRepository,
  PrismaGearPlanOptionSetRepository,
  PrismaGearAdviceRunRepository,
  PrismaGearQuoteLinkRepository,
  PrismaProductTechnicalProfileRepository,
];

@Module({
  imports: [SharedModule],
  providers: [...GEAR_REPOSITORY_PROVIDERS],
  exports: [...GEAR_REPOSITORY_PROVIDERS],
})
export class GearModule {}

