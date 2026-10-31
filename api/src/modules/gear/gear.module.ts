import { Module } from '@nestjs/common'
import { SharedModule } from '../../shared/shared.module'
import { MediaModule } from '../media/media.module'
import { WeatherModule } from '../weather/weather.module'
import { TRIP_FORECAST_PORT } from './application/ports/trip-forecast.port'
import { OpenMeteoTripForecastAdapter } from './infrastructure/adapters/open-meteo-trip-forecast.adapter'
import {
  USER_GEAR_REPOSITORY_PORT,
  GEAR_RULE_REPOSITORY_PORT,
  GEAR_EXTRACTION_DRAFT_REPOSITORY_PORT,
  GEAR_EXTRACTION_CACHE_PORT,
  GEAR_CONCURRENCY_LEASE_PORT,
  GEAR_PLAN_REPOSITORY_PORT,
  GEAR_PLAN_REVISION_REPOSITORY_PORT,
  GEAR_PLAN_OPTION_SET_REPOSITORY_PORT,
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
  PrismaGearQuoteLinkRepository,
  PrismaProductTechnicalProfileRepository,
  PrismaTripContextReadAdapter,
  GeminiGearAiAdapter,
  OpenAiGearAiAdapter,
  SelectableGearAiAdapter,
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
import { GearCapabilitiesController } from './presentation/controllers/gear-capabilities.controller'
import { GearPhase2Controller } from './presentation/controllers/gear-phase2.controller'
import { GearPhase2Service } from './application/services/gear-phase2.service'

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
    // Chọn Gemini / OpenAI bằng GEAR_AI_PROVIDER (đọc lúc gọi).
    provide: GEAR_AI_PORT,
    useClass: SelectableGearAiAdapter,
  },
  GeminiGearAiAdapter,
  OpenAiGearAiAdapter,
  {
    provide: PAGE_READER_PORT,
    useClass: FirecrawlPageReaderAdapter,
  },
  {
    provide: TRIP_FORECAST_PORT,
    useClass: OpenMeteoTripForecastAdapter,
  },
  PrismaUserGearRepository,
  PrismaGearRuleRepository,
  PrismaGearExtractionDraftRepository,
  PrismaGearExtractionCacheAdapter,
  PrismaGearConcurrencyLeaseAdapter,
  PrismaGearPlanRepository,
  PrismaGearPlanRevisionRepository,
  PrismaGearPlanOptionSetRepository,
  PrismaGearQuoteLinkRepository,
  PrismaProductTechnicalProfileRepository,
  PrismaTripContextReadAdapter,
]

export const GEAR_SERVICES = [
  UserGearService,
  GearCheckService,
  GearRuleService,
  StaffProductProfileService,
  GearPlanService,
  GearExtractionService,
  GearPhase2Service,
]

@Module({
  imports: [SharedModule, MediaModule, WeatherModule],
  controllers: [
    UserGearController,
    GearCheckController,
    GearRulesController,
    StaffGearProfileController,
    GearPlanController,
    GearExtractionController,
    GearCapabilitiesController,
    GearPhase2Controller,
  ],
  providers: [...GEAR_REPOSITORY_PROVIDERS, ...GEAR_SERVICES],
  exports: [...GEAR_REPOSITORY_PROVIDERS, ...GEAR_SERVICES],
})
export class GearModule {}
