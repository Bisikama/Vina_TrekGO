import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module';
import { RentalCategoryController } from './presentation/controllers/rental-category.controller';
import { ListRentalCategoriesUseCase } from './application/use-cases/list-rental-categories.use-case';
import { PrismaRentalCategoryAdapter } from './infrastructure/adapters/prisma-rental-category.adapter';
import { RENTAL_CATEGORY_PORT } from './application/ports/rental-category.port';

@Module({
  imports: [SharedModule],
  controllers: [RentalCategoryController],
  providers: [
    ListRentalCategoriesUseCase,
    {
      provide: RENTAL_CATEGORY_PORT,
      useClass: PrismaRentalCategoryAdapter,
    },
  ],
  exports: [],
})
export class CatalogModule {}
