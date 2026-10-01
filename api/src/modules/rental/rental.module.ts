import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrderingModule } from './ordering/ordering.module';

@Module({
  imports: [CatalogModule, InventoryModule, OrderingModule],
  controllers: [],
  providers: [],
})
export class RentalModule {}
