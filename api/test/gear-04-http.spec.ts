import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { UserRole, UserStatus } from '@prisma/client';

import { UserGearController } from '../src/modules/gear/presentation/controllers/user-gear.controller';
import { GearCheckController } from '../src/modules/gear/presentation/controllers/gear-check.controller';
import { StaffGearProfileController } from '../src/modules/gear/presentation/controllers/staff-gear-profile.controller';
import { GearRulesController } from '../src/modules/gear/presentation/controllers/gear-rules.controller';

import { UserGearService } from '../src/modules/gear/application/services/user-gear.service';
import { GearCheckService } from '../src/modules/gear/application/services/gear-check.service';
import { StaffProductProfileService } from '../src/modules/gear/application/services/staff-product-profile.service';
import { GearRuleService } from '../src/modules/gear/application/services/gear-rule.service';

import { USER_GEAR_REPOSITORY_PORT } from '../src/modules/gear/application/ports/user-gear.repository.port';
import { PRODUCT_TECHNICAL_PROFILE_REPOSITORY_PORT } from '../src/modules/gear/application/ports/product-technical-profile.repository.port';
import { TRIP_CONTEXT_READ_PORT } from '../src/modules/gear/application/ports/trip-context-read.port';
import { GEAR_RULE_REPOSITORY_PORT } from '../src/modules/gear/application/ports/gear-rule.repository.port';
import { MEDIA_ASSET_PORT } from '../src/modules/media/application/ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from '../src/modules/media/application/ports/media-storage.port';
import { MEDIA_REFERENCE_PORT } from '../src/modules/media/application/ports/media-reference.port';

import { AuthenticationGuard } from '../src/shared/guards/authentication.guard';
import { RolesGuard } from '../src/shared/guards/roles.guard';
import { AccessTokenGuard } from '../src/shared/guards/access-token.guard';
import { ApiKeyGuard } from '../src/shared/guards/api-key.guard';
import { SupabaseService } from '../src/shared/services/supabase.service';
import { PrismaService } from '../src/shared/services/prisma.service';
import { GlobalErrorFilter } from '../src/shared/errors/global-error.filter';
import { AppError } from '../src/shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../src/shared/errors/codes/gear.error-codes';
import { UserGearItemDomain, ProductTechnicalProfileDomain } from '../src/modules/gear/domain/gear.types';
import { findSimilarItems } from '../src/modules/gear/domain/duplicate-detector';

describe('Gear Advisor V3.1.5 — Phase 04 HTTP E2E Pipeline (/api/v1/gear & /api/v1/staff/gear)', () => {
  let app: INestApplication;

  // Test Principals
  const aliceId = randomUUID();
  const aliceAuthId = randomUUID();
  const aliceToken = 'Bearer alice-valid-token';

  const bobId = randomUUID();
  const bobAuthId = randomUUID();
  const bobToken = 'Bearer bob-valid-token';

  const staffDeliveryId = randomUUID();
  const staffDeliveryAuthId = randomUUID();
  const staffDeliveryToken = 'Bearer delivery-valid-token';

  const staffInventoryId = randomUUID();
  const staffInventoryAuthId = randomUUID();
  const staffInventoryToken = 'Bearer inventory-valid-token';

  // Test Media IDs
  const aliceMediaId1 = randomUUID();
  const aliceMediaId2 = randomUUID();
  const bobMediaId = randomUUID();

  // Test Trip IDs
  const activeTripId = randomUUID();
  const cancelledTripId = randomUUID();
  const missingFactsTripId = randomUUID();

  // Test Rental Product ID
  const testRentalProductId = randomUUID();

  // In-Memory User Gear State
  const userGearItems = new Map<string, UserGearItemDomain>();
  const userGearPhotos = new Map<string, any[]>();

  // In-Memory Technical Profile State
  const technicalProfiles = new Map<string, ProductTechnicalProfileDomain>();

  beforeAll(async () => {
    // 1. Mock UserGearRepositoryPort
    const mockUserGearRepo = {
      findByIdAndUser: jest.fn(async (id: string, userId: string) => {
        const it = userGearItems.get(id);
        if (it && it.userId === userId) {
          const photos = userGearPhotos.get(id) || [];
          return { ...it, photos: [...photos] };
        }
        return null;
      }),
      findByIdsAndUser: jest.fn(async (ids: string[], userId: string) => {
        return Array.from(userGearItems.values())
          .filter((it) => it.userId === userId && ids.includes(it.id))
          .map((it) => {
            const photos = userGearPhotos.get(it.id) || [];
            return { ...it, photos: [...photos] };
          });
      }),
      findAllByUser: jest.fn(async (userId: string, category?: any) => {
        return Array.from(userGearItems.values())
          .filter((it) => it.userId === userId && (!category || it.category === category))
          .map((it) => {
            const photos = userGearPhotos.get(it.id) || [];
            return { ...it, photos: [...photos] };
          });
      }),
      countByUser: jest.fn(async (userId: string) => {
        return Array.from(userGearItems.values()).filter((it) => it.userId === userId).length;
      }),
      create: jest.fn(async (item: any, photos?: any[]) => {
        const userItems = Array.from(userGearItems.values()).filter((it) => it.userId === item.userId);
        if (userItems.length >= 50) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_LIMIT_EXCEEDED, {
            message: 'Tủ đồ đã đạt giới hạn tối đa 50 món',
          });
        }
        if (!item.acknowledgeDuplicate) {
          const candidates = userItems.filter((it) => it.category === item.category);
          const duplicate = findSimilarItems(
            { category: item.category, condition: item.condition, attributes: item.attributes },
            candidates,
          );
          if (duplicate) {
            throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_POSSIBLE_DUPLICATE, {
              message: 'Phát hiện món đồ tương tự trong tủ đồ',
              details: duplicate as unknown as Record<string, unknown>,
            });
          }
        }
        const id = randomUUID();
        const createdPhotos = (photos || []).map((p, idx) => ({
          id: randomUUID(),
          itemId: id,
          storageRef: p.storageRef,
          position: p.position ?? idx,
          createdAt: new Date(),
        }));
        userGearPhotos.set(id, createdPhotos);

        const domain: UserGearItemDomain = {
          id,
          userId: item.userId,
          name: item.name,
          category: item.category,
          brand: item.brand ?? null,
          condition: item.condition,
          attributes: item.attributes ?? {},
          photoRef: item.photoRef ?? (createdPhotos[0]?.storageRef || null),
          source: item.source ?? 'MANUAL',
          version: 1,
          photos: createdPhotos,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        userGearItems.set(id, domain);
        return { ...domain };
      }),
      patch: jest.fn(async (id: string, userId: string, patch: any, expectedVersion?: number) => {
        const existing = userGearItems.get(id);
        if (!existing || existing.userId !== userId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, { message: 'Not found' });
        }
        if (expectedVersion !== undefined && existing.version !== expectedVersion) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT, { message: 'Version conflict' });
        }
        const updated: UserGearItemDomain = {
          ...existing,
          name: patch.name ?? existing.name,
          brand: patch.brand !== undefined ? patch.brand : existing.brand,
          condition: patch.condition ?? existing.condition,
          category: patch.category ?? existing.category,
          attributes: patch.attributes !== undefined ? { ...patch.attributes } : existing.attributes,
          photoRef: patch.photoRef !== undefined ? patch.photoRef : existing.photoRef,
          version: existing.version + 1,
          updatedAt: new Date(),
        };
        userGearItems.set(id, updated);
        const photos = userGearPhotos.get(id) || [];
        return { ...updated, photos: [...photos] };
      }),
      delete: jest.fn(async (id: string, userId: string) => {
        const existing = userGearItems.get(id);
        if (!existing || existing.userId !== userId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, { message: 'Not found' });
        }
        userGearItems.delete(id);
        userGearPhotos.delete(id);
        return true;
      }),
      addPhoto: jest.fn(async (itemId: string, userId: string, storageRef: string, position?: number) => {
        const existing = userGearItems.get(itemId);
        if (!existing || existing.userId !== userId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, { message: 'Not found' });
        }
        const photos = userGearPhotos.get(itemId) || [];
        if (photos.length >= 3) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, { message: 'Max 3 photos' });
        }
        const pos = position ?? photos.length;
        const newPhoto = { id: randomUUID(), itemId, storageRef, position: pos, createdAt: new Date() };
        photos.push(newPhoto);
        photos.sort((a, b) => a.position - b.position);
        userGearPhotos.set(itemId, photos);
        if (pos === 0) {
          existing.photoRef = storageRef;
        }
        return newPhoto;
      }),
      deletePhoto: jest.fn(async (itemId: string, photoId: string, userId: string) => {
        const existing = userGearItems.get(itemId);
        if (!existing || existing.userId !== userId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, { message: 'Not found' });
        }
        let photos = userGearPhotos.get(itemId) || [];
        photos = photos.filter((p) => p.id !== photoId);
        // compact positions
        photos.sort((a, b) => a.position - b.position);
        photos.forEach((p, idx) => {
          p.position = idx;
        });
        userGearPhotos.set(itemId, photos);
        existing.photoRef = photos[0]?.storageRef || null;
        return true;
      }),
      reorderPhotos: jest.fn(async (itemId: string, userId: string, orders: any[]) => {
        const existing = userGearItems.get(itemId);
        if (!existing || existing.userId !== userId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, { message: 'Not found' });
        }
        const photos = userGearPhotos.get(itemId) || [];
        for (const o of orders) {
          const p = photos.find((x) => x.id === o.photoId);
          if (p) p.position = o.position;
        }
        photos.sort((a, b) => a.position - b.position);
        userGearPhotos.set(itemId, photos);
        existing.photoRef = photos[0]?.storageRef || null;
        return [...photos];
      }),
    };

    // 2. Mock ProductTechnicalProfileRepositoryPort
    const mockProfileRepo = {
      findByProductId: jest.fn(async (productId: string) => {
        return technicalProfiles.get(productId) || null;
      }),
      upsertProfile: jest.fn(
        async (
          productId: string,
          category: any,
          attributes: any,
          expectedVersion?: number,
          schemaVersion?: string,
          sources?: any,
          actorId?: string,
        ) => {
          const existing = technicalProfiles.get(productId);
          if (expectedVersion !== undefined) {
            const currentVersion = existing?.version ?? 0;
            if (currentVersion !== expectedVersion) {
              throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PROFILE_VERSION_CONFLICT, {
                message: 'CAS version conflict',
              });
            }
          }
          const nextVersion = (existing?.version ?? 0) + 1;
          const profile: ProductTechnicalProfileDomain = {
            id: existing?.id || randomUUID(),
            productId,
            category,
            schemaVersion: schemaVersion || '3.1.5',
            attributes: { ...attributes, _lastModifiedBy: actorId },
            verifiedAt: new Date(),
            verifiedByUserId: actorId || null,
            version: nextVersion,
            createdAt: existing?.createdAt || new Date(),
            updatedAt: new Date(),
          };
          technicalProfiles.set(productId, profile);
          return { ...profile };
        },
      ),
    };

    // 3. Mock TripContextReadPort
    const mockTripPort = {
      getTripContext: jest.fn(async (tripId: string, userId: string) => {
        if (tripId === cancelledTripId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, {
            message: 'Chuyến đi đã bị hủy',
          });
        }
        if (tripId === missingFactsTripId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_NEEDS_CONTEXT, {
            message: 'Chuyến đi chưa đủ thông số',
          });
        }
        if (userId !== aliceId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_FORBIDDEN, {
            message: 'Người dùng không phải thành viên của chuyến đi này',
          });
        }
        return {
          tripId,
          days: 3,
          difficulty: 3,
          terrain: 'ROCKY',
        };
      }),
    };

    // 4. Mock Media Ports
    const mockMediaAssetPort = {
      findById: jest.fn(async ({ id }: { id: string }) => {
        if (id === aliceMediaId1 || id === aliceMediaId2) {
          return {
            id,
            ownerUserId: aliceId,
            scope: 'USER_GEAR',
            status: 'READY',
            sizeBytes: 1024 * 1024,
            mimeType: 'image/jpeg',
          };
        }
        if (id === bobMediaId) {
          return {
            id,
            ownerUserId: bobId,
            scope: 'USER_GEAR',
            status: 'READY',
            sizeBytes: 1024 * 1024,
            mimeType: 'image/jpeg',
          };
        }
        return null;
      }),
    };
    const mockMediaStoragePort = {
      deleteFile: jest.fn().mockResolvedValue(true),
    };
    const mockMediaRefPort = {
      hasActiveReferences: jest.fn().mockResolvedValue(false),
    };

    // 5. Mock Supabase & Prisma Services for AuthenticationGuard & AccessTokenGuard
    const mockSupabaseService = {
      verifyToken: jest.fn(async (token: string) => {
        if (token === 'alice-valid-token') return { id: aliceAuthId, email: 'alice@trekgo.vn' };
        if (token === 'bob-valid-token') return { id: bobAuthId, email: 'bob@trekgo.vn' };
        if (token === 'delivery-valid-token') return { id: staffDeliveryAuthId, email: 'delivery@trekgo.vn' };
        if (token === 'inventory-valid-token') return { id: staffInventoryAuthId, email: 'inventory@trekgo.vn' };
        return null;
      }),
    };

    const mockPrismaService = {
      user: {
        findUnique: jest.fn(async ({ where }: { where: { authUserId: string } }) => {
          if (where.authUserId === aliceAuthId) {
            return {
              id: aliceId,
              authUserId: aliceAuthId,
              email: 'alice@trekgo.vn',
              role: UserRole.MEMBER,
              status: UserStatus.ACTIVE,
            };
          }
          if (where.authUserId === bobAuthId) {
            return {
              id: bobId,
              authUserId: bobAuthId,
              email: 'bob@trekgo.vn',
              role: UserRole.MEMBER,
              status: UserStatus.ACTIVE,
            };
          }
          if (where.authUserId === staffDeliveryAuthId) {
            return {
              id: staffDeliveryId,
              authUserId: staffDeliveryAuthId,
              email: 'delivery@trekgo.vn',
              role: UserRole.STAFF_DELIVERY,
              status: UserStatus.ACTIVE,
            };
          }
          if (where.authUserId === staffInventoryAuthId) {
            return {
              id: staffInventoryId,
              authUserId: staffInventoryAuthId,
              email: 'inventory@trekgo.vn',
              role: UserRole.STAFF_INVENTORY,
              status: UserStatus.ACTIVE,
            };
          }
          return null;
        }),
      },
      rentalProduct: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === testRentalProductId) {
            return { id: testRentalProductId, name: 'Trek Tent 2P', category: 'TENT' };
          }
          return null;
        }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        UserGearController,
        GearCheckController,
        StaffGearProfileController,
        GearRulesController,
      ],
      providers: [
        UserGearService,
        GearCheckService,
        StaffProductProfileService,
        GearRuleService,
        { provide: USER_GEAR_REPOSITORY_PORT, useValue: mockUserGearRepo },
        { provide: PRODUCT_TECHNICAL_PROFILE_REPOSITORY_PORT, useValue: mockProfileRepo },
        { provide: TRIP_CONTEXT_READ_PORT, useValue: mockTripPort },
        { provide: MEDIA_ASSET_PORT, useValue: mockMediaAssetPort },
        { provide: MEDIA_STORAGE_PORT, useValue: mockMediaStoragePort },
        { provide: MEDIA_REFERENCE_PORT, useValue: mockMediaRefPort },
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: PrismaService, useValue: mockPrismaService },
        AccessTokenGuard,
        ApiKeyGuard,
        AuthenticationGuard,
        RolesGuard,
        {
          provide: APP_GUARD,
          useClass: AuthenticationGuard,
        },
        {
          provide: APP_GUARD,
          useClass: RolesGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. Authentication & Role Guard Tests (401 & 403)
  // =========================================================================
  describe('Authentication & Authorization Guards (E2E)', () => {
    it('returns 401 Unauthorized when request lacks Bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gear/items')
        .expect(401);

      expect(res.body.error).toBeDefined();
    });

    it('returns 403 Forbidden when STAFF_DELIVERY attempts to manage staff product profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/staff/gear/product-profiles/${testRentalProductId}`)
        .set('Authorization', staffDeliveryToken)
        .expect(403);

      expect(res.body.error).toBeDefined();
    });

    it('allows STAFF_INVENTORY to access staff product profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/staff/gear/product-profiles/${testRentalProductId}`)
        .set('Authorization', staffInventoryToken)
        .expect(404); // Product profile not yet created, but passed auth/role guard

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND);
    });
  });

  // =========================================================================
  // 2. Cross-User Privacy & Media Isolation Tests
  // =========================================================================
  describe('Cross-User Data and Media Isolation', () => {
    let aliceItemId: string;

    beforeAll(async () => {
      // Alice creates an initial jacket
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/items')
        .set('Authorization', aliceToken)
        .send({
          name: "Alice's Rain Shell",
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 8000, temp_rating_c: 5 },
        })
        .expect(201);

      aliceItemId = res.body.id;
    });

    it('returns 404 when Bob tries to GET Alice item detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/items/${aliceItemId}`)
        .set('Authorization', bobToken)
        .expect(404);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND);
    });

    it('returns 404 when Bob tries to PATCH Alice item', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/gear/items/${aliceItemId}`)
        .set('Authorization', bobToken)
        .send({ name: 'Hacked Name' })
        .expect(404);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND);
    });

    it('returns 404 when Bob tries to DELETE Alice item', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/gear/items/${aliceItemId}`)
        .set('Authorization', bobToken)
        .expect(404);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND);
    });

    it('returns 403 Forbidden when Alice attempts to attach Bob media asset', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/items')
        .set('Authorization', aliceToken)
        .send({
          name: 'Jacket with Bob Media',
          category: 'JACKET',
          condition: 'good',
          photoRef: bobMediaId,
          attributes: { waterproof_mm: 5000 },
        })
        .expect(403);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_FORBIDDEN);
    });
  });

  // =========================================================================
  // 3. User Gear CRUD, Validation, and Lowercase Wire Representation
  // =========================================================================
  describe('User Gear CRUD & Canonical Schemas', () => {
    let createdItemId: string;

    it('creates an item and returns lowercase wire representation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/items')
        .set('Authorization', aliceToken)
        .send({
          name: 'Alice Mountain Boots',
          category: 'FOOTWEAR',
          condition: 'good',
          attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 900 },
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.category).toBe('FOOTWEAR');
      expect(res.body.condition).toBe('good');
      expect(res.body.source).toBe('manual');
      expect(res.body.version).toBe(1);
      createdItemId = res.body.id;
    });

    it('returns 400 Bad Request on unknown/extended category schema validation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/items')
        .set('Authorization', aliceToken)
        .send({
          name: 'Invalid Item',
          category: 'NAVIGATION',
          condition: 'good',
          attributes: {},
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 on empty PATCH body', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/gear/items/${createdItemId}`)
        .set('Authorization', aliceToken)
        .send({})
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 409 Conflict when expectedVersion CAS mismatches', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/gear/items/${createdItemId}`)
        .set('Authorization', aliceToken)
        .send({
          name: 'New Name',
          expectedVersion: 999,
        })
        .expect(409);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT);
    });

    it('successfully updates item with valid CAS version', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/gear/items/${createdItemId}`)
        .set('Authorization', aliceToken)
        .send({
          name: 'Alice Mountain Boots V2',
          expectedVersion: 1,
        })
        .expect(200);

      expect(res.body.name).toBe('Alice Mountain Boots V2');
      expect(res.body.version).toBe(2);
    });

    it('returns 409 when creating duplicate item without acknowledgeDuplicate', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/items')
        .set('Authorization', aliceToken)
        .send({
          name: 'Duplicate Boots',
          category: 'FOOTWEAR',
          condition: 'good',
          attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 900 },
        })
        .expect(409);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_ITEM_POSSIBLE_DUPLICATE);
    });

    it('allows duplicate creation when acknowledgeDuplicate is true', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/items')
        .set('Authorization', aliceToken)
        .send({
          name: 'Duplicate Boots Acknowledged',
          category: 'FOOTWEAR',
          condition: 'good',
          acknowledgeDuplicate: true,
          attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 900 },
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
    });
  });

  // =========================================================================
  // 4. Photo Management (Limits, Reorder, Compaction)
  // =========================================================================
  describe('Photo Sub-routes (/api/v1/gear/items/:id/photos)', () => {
    let photoItemId: string;
    let photo1Id: string;
    let photo2Id: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/items')
        .set('Authorization', aliceToken)
        .send({
          name: 'Photo Test Jacket',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 5000 },
        })
        .expect(201);
      photoItemId = res.body.id;
    });

    it('adds first photo at position 0 and synchronizes cover photoRef', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/items/${photoItemId}/photos`)
        .set('Authorization', aliceToken)
        .send({
          storageRef: aliceMediaId1,
          position: 0,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.position).toBe(0);
      photo1Id = res.body.id;

      // Verify item detail now has photoRef = aliceMediaId1
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/gear/items/${photoItemId}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(detail.body.photoRef).toBe(aliceMediaId1);
      expect(detail.body.photos.length).toBe(1);
    });

    it('adds second photo at position 1', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/items/${photoItemId}/photos`)
        .set('Authorization', aliceToken)
        .send({
          storageRef: aliceMediaId2,
          position: 1,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.position).toBe(1);
      photo2Id = res.body.id;
    });

    it('reorders photos swapping position 0 and 1', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/gear/items/${photoItemId}/photos/reorder`)
        .set('Authorization', aliceToken)
        .send({
          photoOrders: [
            { photoId: photo1Id, position: 1 },
            { photoId: photo2Id, position: 0 },
          ],
        })
        .expect(200);

      expect(res.body.photos).toBeDefined();

      // Check that cover photoRef updated to photo2's storageRef
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/gear/items/${photoItemId}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(detail.body.photoRef).toBe(aliceMediaId2);
    });

    it('deletes cover photo and compacts remaining positions', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/gear/items/${photoItemId}/photos/${photo2Id}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(res.body.success).toBe(true);

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/gear/items/${photoItemId}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(detail.body.photos.length).toBe(1);
      expect(detail.body.photos[0].position).toBe(0);
      expect(detail.body.photoRef).toBe(aliceMediaId1);
    });
  });

  // =========================================================================
  // 5. Gear Check Service (/api/v1/gear/check)
  // =========================================================================
  describe('Gear Check Route (/api/v1/gear/check)', () => {
    const validClimate = {
      temp_min_c: 10,
      temp_max_c: 22,
      temp_min_night_c: 8,
      rain_prob_pct: 70,
    };

    it('evaluates check with empty item list without error', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/check')
        .set('Authorization', aliceToken)
        .send({
          tripId: activeTripId,
          itemIds: [],
          confirmedClimate: validClimate,
        })
        .expect(200);

      expect(res.body.isReady).toBe(false);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(Array.isArray(res.body.gaps)).toBe(true);
      expect(Array.isArray(res.body.checklist)).toBe(true);
    });

    it('returns 400 Bad Request when trip is CANCELLED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/check')
        .set('Authorization', aliceToken)
        .send({
          tripId: cancelledTripId,
          itemIds: [],
          confirmedClimate: validClimate,
        })
        .expect(400);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE);
    });

    it('returns 403 Forbidden when user is not a trip participant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/check')
        .set('Authorization', bobToken)
        .send({
          tripId: activeTripId,
          itemIds: [],
          confirmedClimate: validClimate,
        })
        .expect(403);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_FORBIDDEN);
    });

    it('returns 400 Bad Request when trip is missing mandatory facts', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/check')
        .set('Authorization', aliceToken)
        .send({
          tripId: missingFactsTripId,
          itemIds: [],
          confirmedClimate: validClimate,
        })
        .expect(400);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_NEEDS_CONTEXT);
    });

    it('returns 400 Bad Request when request contains duplicate itemIds', async () => {
      const someId = randomUUID();
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/check')
        .set('Authorization', aliceToken)
        .send({
          tripId: activeTripId,
          itemIds: [someId, someId],
          confirmedClimate: validClimate,
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // 6. Staff Product Profile (/api/v1/staff/gear/product-profiles)
  // =========================================================================
  describe('Staff Product Technical Profiles', () => {
    it('creates product profile and stamps actorId in audit metadata', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/staff/gear/product-profiles/${testRentalProductId}`)
        .set('Authorization', staffInventoryToken)
        .send({
          category: 'TENT',
          attributes: {
            sleeping_places: 2,
            flysheet_waterproof_mm: 3000,
            floor_waterproof_mm: 5000,
            weight_g: 2200,
          },
        })
        .expect(200);

      expect(res.body.productId).toBe(testRentalProductId);
      expect(res.body.version).toBe(1);
      expect(res.body.attributes._lastModifiedBy).toBe(staffInventoryId);
    });

    it('returns 409 Conflict when expectedVersion CAS fails on update', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/staff/gear/product-profiles/${testRentalProductId}`)
        .set('Authorization', staffInventoryToken)
        .send({
          category: 'TENT',
          expectedVersion: 99,
          attributes: {
            sleeping_places: 2,
            flysheet_waterproof_mm: 3000,
            floor_waterproof_mm: 5000,
            weight_g: 2200,
          },
        })
        .expect(409);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_PROFILE_VERSION_CONFLICT);
    });
  });

  // =========================================================================
  // 7. Requirement Rules (/api/v1/gear/requirement-rules)
  // =========================================================================
  describe('Requirement Rules Metadata Route', () => {
    it('returns all 28 canonical rule metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gear/requirement-rules')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(28);

      const ruleIds = res.body.map((r: any) => r.id);
      expect(ruleIds).toContain('R01');
      expect(ruleIds).toContain('R28');
    });
  });
});
