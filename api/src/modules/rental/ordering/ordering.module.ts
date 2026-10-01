import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module';
import { RENTAL_AVAILABILITY_PORT } from './application/ports/rental-availability.port';
import { RENTAL_CATALOG_PORT } from './application/ports/rental-catalog.port';
import { RENTAL_CONTEXT_PORT } from './application/ports/rental-context.port';
import { RENTAL_QUOTE_PORT } from './application/ports/rental-quote.port';
import { CreateRentalQuoteUseCase } from './application/use-cases/create-rental-quote.use-case';
import { GetRentalAvailabilityUseCase } from './application/use-cases/get-rental-availability.use-case';
import { GetRentalEligibilityUseCase } from './application/use-cases/get-rental-eligibility.use-case';
import { GetRentalRecommendationsUseCase } from './application/use-cases/get-rental-recommendations.use-case';
import { PrismaRentalAvailabilityAdapter } from './infrastructure/adapters/prisma-rental-availability.adapter';
import { PrismaRentalCatalogAdapter } from './infrastructure/adapters/prisma-rental-catalog.adapter';
import { PrismaRentalContextAdapter } from './infrastructure/adapters/prisma-rental-context.adapter';
import { PrismaRentalQuoteAdapter } from './infrastructure/adapters/prisma-rental-quote.adapter';
import { RentalBookingController } from './presentation/controllers/rental-booking.controller';
import { RentalOperationController } from './presentation/controllers/rental-operation.controller';

@Module({
  imports: [SharedModule],
  controllers: [RentalBookingController, RentalOperationController],
  providers: [
    GetRentalEligibilityUseCase,
    GetRentalAvailabilityUseCase,
    CreateRentalQuoteUseCase,
    GetRentalRecommendationsUseCase,
    { provide: RENTAL_CONTEXT_PORT, useClass: PrismaRentalContextAdapter },
    { provide: RENTAL_CATALOG_PORT, useClass: PrismaRentalCatalogAdapter },
    { provide: RENTAL_AVAILABILITY_PORT, useClass: PrismaRentalAvailabilityAdapter },
    { provide: RENTAL_QUOTE_PORT, useClass: PrismaRentalQuoteAdapter },
  ],
})
export class OrderingModule {}