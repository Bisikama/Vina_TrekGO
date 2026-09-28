import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module';
import { RentalCategoryController } from './presentation/controllers/rental-category.controller';
import { ListRentalCategoriesUseCase } from './application/use-cases/list-rental-categories.use-case';
import { PrismaRentalCategoryAdapter } from './infrastructure/adapters/prisma-rental-category.adapter';
import { RENTAL_CATEGORY_PORT } from './application/ports/rental-category.port';

import { RentalProductController } from './presentation/controllers/rental-product.controller';
import { StaffRentalProductController } from './presentation/controllers/staff-rental-product.controller';
import { ListRentalProductsUseCase } from './application/use-cases/list-rental-products.use-case';
import { GetRentalProductUseCase } from './application/use-cases/get-rental-product.use-case';
import { ListStaffRentalProductsUseCase } from './application/use-cases/list-staff-rental-products.use-case';
import { ChangeRentalProductStatusUseCase } from './application/use-cases/change-rental-product-status.use-case';
import { CreateRentalProductUseCase } from './application/use-cases/create-rental-product.use-case';
import { UpdateRentalProductUseCase } from './application/use-cases/update-rental-product.use-case';
import { PrismaRentalProductAdapter } from './infrastructure/adapters/prisma-rental-product.adapter';
import { RENTAL_PRODUCT_PORT } from './application/ports/rental-product.port';

@Module({
  imports: [SharedModule],
  controllers: [
    RentalCategoryController,
    RentalProductController,
    StaffRentalProductController,
  ],
  providers: [
    ListRentalCategoriesUseCase,
    ListRentalProductsUseCase,
    GetRentalProductUseCase,
    ListStaffRentalProductsUseCase,
    ChangeRentalProductStatusUseCase,
    CreateRentalProductUseCase,
    UpdateRentalProductUseCase,
    {
      provide: RENTAL_CATEGORY_PORT,
      useClass: PrismaRentalCategoryAdapter,
    },
    {
      provide: RENTAL_PRODUCT_PORT,
      useClass: PrismaRentalProductAdapter,
    },
  ],
  exports: [],
})
export class CatalogModule {}
