import { Module } from '@nestjs/common';

import { SharedModule } from 'src/shared/shared.module';
import { InventoryLocationController } from './presentation/controllers/inventory-location.controller';
import { ListInventoryLocationsUseCase } from './application/use-cases/list-inventory-locations.use-case';
import { GetInventoryLocationUseCase } from './application/use-cases/get-inventory-location.use-case';
import { INVENTORY_LOCATION_PORT } from './application/ports/inventory-location.port';
import { PrismaInventoryLocationAdapter } from './infrastructure/adapters/prisma-inventory-location.adapter';
import { CatalogModule } from '../catalog/catalog.module';

import { EquipmentUnitController } from './presentation/controllers/equipment-unit.controller';
import { ListEquipmentUnitsUseCase } from './application/use-cases/list-equipment-units.use-case';
import { CreateEquipmentUnitUseCase } from './application/use-cases/create-equipment-unit.use-case';
import { GetEquipmentUnitUseCase } from './application/use-cases/get-equipment-unit.use-case';
import { UpdateEquipmentUnitUseCase } from './application/use-cases/update-equipment-unit.use-case';
import { BatchCreateEquipmentUnitsUseCase } from './application/use-cases/batch-create-equipment-units.use-case';
import { GenerateEquipmentLabelsUseCase } from './application/use-cases/generate-equipment-labels.use-case';
import { ChangeEquipmentMaintenanceUseCase } from './application/use-cases/change-equipment-maintenance.use-case';
import { EQUIPMENT_UNIT_PORT } from './application/ports/equipment-unit.port';
import { PrismaEquipmentUnitAdapter } from './infrastructure/adapters/prisma-equipment-unit.adapter';

@Module({
  imports: [SharedModule, CatalogModule],
  controllers: [
    InventoryLocationController,
    EquipmentUnitController,
  ],
  providers: [
    ListInventoryLocationsUseCase,
    GetInventoryLocationUseCase,
    ListEquipmentUnitsUseCase,
    CreateEquipmentUnitUseCase,
    GetEquipmentUnitUseCase,
    UpdateEquipmentUnitUseCase,
    BatchCreateEquipmentUnitsUseCase,
    GenerateEquipmentLabelsUseCase,
    ChangeEquipmentMaintenanceUseCase,
    {
      provide: INVENTORY_LOCATION_PORT,
      useClass: PrismaInventoryLocationAdapter,
    },
    {
      provide: EQUIPMENT_UNIT_PORT,
      useClass: PrismaEquipmentUnitAdapter,
    },
  ],
  exports: [INVENTORY_LOCATION_PORT, EQUIPMENT_UNIT_PORT],
})
export class InventoryModule {}
