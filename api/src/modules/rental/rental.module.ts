import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [CatalogModule, InventoryModule],
  controllers: [],
  providers: [],
})
export class RentalModule {}
