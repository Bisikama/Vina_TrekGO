import { Module } from '@nestjs/common'
import { SharedModule } from '../../shared/shared.module'
import { MediaModule } from '../media/media.module'
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
  TRIP_CONTEXT_READ_PORT,
  GEAR_AI_PORT,
  PAGE_READER_PORT,
} from './application/ports'
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
  PrismaTripContextReadAdapter,
  OpenAiGearAiAdapter,
  GeminiGearAiAdapter,
  FirecrawlPageReaderAdapter,
} from './infrastructure/adapters'
import { UserGearService } from './application/services/user-gear.service'
import { GearCheckService } from './application/services/gear-check.service'
import { GearRuleService } from './application/services/gear-rule.service'
import { StaffProductProfileService } from './application/services/staff-product-profile.service'
import { GearPlanService } from './application/services/gear-plan.service'
import { GearExtractionService } from './application/services/gear-extraction.service'
import { UserGearController } from './presentation/controllers/user-gear.controller'
import { GearCheckController } from './presentation/controllers/gear-check.controller'
import { GearRulesController } from './presentation/controllers/gear-rules.controller'
import { StaffGearProfileController } from './presentation/controllers/staff-gear-profile.controller'
import { GearPlanController } from './presentation/controllers/gear-plan.controller'
import { GearExtractionController } from './presentation/controllers/gear-extraction.controller'

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
  {
    provide: TRIP_CONTEXT_READ_PORT,
    useClass: PrismaTripContextReadAdapter,
  },
  {
    provide: GEAR_AI_PORT,
    useClass: GeminiGearAiAdapter,
  },
  {
    provide: PAGE_READER_PORT,
    useClass: FirecrawlPageReaderAdapter,
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
  PrismaTripContextReadAdapter,
  OpenAiGearAiAdapter,
]

export const GEAR_SERVICES = [
  UserGearService,
  GearCheckService,
  GearRuleService,
  StaffProductProfileService,
  GearPlanService,
  GearExtractionService,
]

@Module({
  imports: [SharedModule, MediaModule],
  controllers: [
    UserGearController,
    GearCheckController,
    GearRulesController,
    StaffGearProfileController,
    GearPlanController,
    GearExtractionController,
  ],
  providers: [...GEAR_REPOSITORY_PROVIDERS, ...GEAR_SERVICES],
  exports: [...GEAR_REPOSITORY_PROVIDERS, ...GEAR_SERVICES],
})
export class GearModule {}
