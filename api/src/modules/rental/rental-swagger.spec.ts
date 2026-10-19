import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RentalCategoryController } from './catalog/presentation/controllers/rental-category.controller';
import { RentalProductController } from './catalog/presentation/controllers/rental-product.controller';
import { StaffRentalProductController } from './catalog/presentation/controllers/staff-rental-product.controller';
import { EquipmentUnitController } from './inventory/presentation/controllers/equipment-unit.controller';
import { AdminInventoryLocationController } from './inventory/presentation/controllers/admin-inventory-location.controller';
import { RentalOperationController } from './ordering/presentation/controllers/rental-operation.controller';
import { RentalOrderController } from './ordering/presentation/controllers/rental-order.controller';
import { RentalExtensionController } from './ordering/extension/rental-extension.controller';
import { RentalReturnController } from './returns/presentation/controllers/rental-return.controller';
import { CreateRentalProductSchema } from './catalog/presentation/dtos/create-rental-product.dto';
import { UpdateRentalProductSchema } from './catalog/presentation/dtos/update-rental-product.dto';
import { ChangeRentalProductStatusSchema } from './catalog/presentation/dtos/change-rental-product-status.dto';
import { RentalQuoteBodySchema } from './ordering/presentation/dtos/ordering.dto';
import { FinalizeReturnReceiptBodySchema } from './returns/presentation/dtos/rental-return.dto';

describe('Rental Swagger requests and responses', () => {
  it('publishes examples accepted by the request validators and raw response shapes', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        RentalCategoryController,
        RentalProductController,
        StaffRentalProductController,
        EquipmentUnitController,
        AdminInventoryLocationController,
        RentalOperationController,
        RentalOrderController,
        RentalExtensionController,
        RentalReturnController,
      ],
    })
      .useMocker(() => ({ execute: jest.fn() }))
      .compile();
    const app = moduleRef.createNestApplication();
    try {
      app.setGlobalPrefix('api/v1');
      const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
      const operation = (route: string, method: 'get' | 'post' | 'patch' | 'put') =>
        document.paths[route]?.[method];
      const bodyExample = (route: string, method: 'post' | 'patch') => {
        const body = operation(route, method)?.requestBody as {
          content?: { 'application/json'?: { schema?: { example?: unknown; required?: string[] } } };
        };
        return body.content?.['application/json']?.schema;
      };

      expect(CreateRentalProductSchema.safeParse(bodyExample('/api/v1/staff/rental-products', 'post')?.example).success).toBe(true);
      expect(UpdateRentalProductSchema.safeParse(bodyExample('/api/v1/staff/rental-products/{id}', 'patch')?.example).success).toBe(true);
      expect(ChangeRentalProductStatusSchema.safeParse(bodyExample('/api/v1/staff/rental-products/{id}/status', 'patch')?.example).success).toBe(true);
      const quoteExample = bodyExample('/api/v1/rentals/quote', 'post')?.example;
      expect(RentalQuoteBodySchema.safeParse(quoteExample).success).toBe(true);
      expect(FinalizeReturnReceiptBodySchema.safeParse(bodyExample('/api/v1/rental-orders/{id}/return-receipts', 'post')?.example).success).toBe(true);
      expect(bodyExample('/api/v1/staff/rental-products', 'post')?.required).toContain('depositPolicy');

      for (const route of ['/api/v1/rental-categories', '/api/v1/rental-products', '/api/v1/staff/rental-products', '/api/v1/staff/equipment-units']) {
        const response = operation(route, 'get')?.responses?.['200'] as {
          content?: { 'application/json'?: { schema?: { properties?: Record<string, unknown> } } };
        };
        const properties = response.content?.['application/json']?.schema?.properties;
        expect(properties).toHaveProperty('items');
        expect(properties).toHaveProperty('pagination');
        expect(properties).not.toHaveProperty('data');
      }
      const extension = bodyExample('/api/v1/rental-orders/{id}/extensions', 'post');
      expect(extension?.required).toContain('acceptedTermsVersion');
      expect(operation('/api/v1/rentals/quote', 'post')?.responses).toHaveProperty('201');
      expect(operation('/api/v1/staff/equipment-units/labels', 'post')?.responses).toHaveProperty('201');
      expect(operation('/api/v1/rental-orders/{id}/cancel', 'post')?.responses).toHaveProperty('201');
      expect(operation('/api/v1/rental-orders/{id}/extensions', 'post')?.responses).toHaveProperty('201');
      const quoteFailure = operation('/api/v1/rentals/quote', 'post')?.responses?.['422'] as {
        content?: { 'application/json'?: { examples?: Record<string, unknown> } };
      };
      expect(quoteFailure.content?.['application/json']?.examples).toEqual(expect.objectContaining({ insufficientQuantity: expect.any(Object), cutoffPassed: expect.any(Object) }));
      const maintenanceFailure = operation('/api/v1/staff/equipment-units/{id}/maintenance', 'post')?.responses?.['409'] as {
        content?: { 'application/json'?: { examples?: Record<string, unknown> } };
      };
      expect(maintenanceFailure.content?.['application/json']?.examples).toEqual(expect.objectContaining({ invalidState: expect.any(Object), rented: expect.any(Object) }));
    } finally {
      await app.close();
    }
  });
});
