import { Module } from '@nestjs/common';

import { SharedModule } from 'src/shared/shared.module';
import { InventoryLocationController } from './presentation/controllers/inventory-location.controller';
import { ListInventoryLocationsUseCase } from './application/use-cases/list-inventory-locations.use-case';
import { GetInventoryLocationUseCase } from './application/use-cases/get-inventory-location.use-case';
import { INVENTORY_LOCATION_PORT } from './application/ports/inventory-location.port';
import { PrismaInventoryLocationAdapter } from './infrastructure/adapters/prisma-inventory-location.adapter';

@Module({
  imports: [SharedModule],
  controllers: [InventoryLocationController],
  providers: [
    ListInventoryLocationsUseCase,
    GetInventoryLocationUseCase,
    {
      provide: INVENTORY_LOCATION_PORT,
      useClass: PrismaInventoryLocationAdapter,
    },
  ],
  exports: [INVENTORY_LOCATION_PORT],
})
export class InventoryModule {}
