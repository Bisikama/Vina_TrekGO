import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrderingModule } from './ordering/ordering.module';
import { PreparationModule } from './preparation/preparation.module';
import { DeliveryModule } from './delivery/delivery.module';
import { RentalReturnsModule } from './returns/returns.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';

@Module({
  imports: [
    CatalogModule,
    InventoryModule,
    OrderingModule,
    PreparationModule,
    DeliveryModule,
    RentalReturnsModule,
    LifecycleModule,
  ],
  controllers: [],
  providers: [],
})
export class RentalModule {}
