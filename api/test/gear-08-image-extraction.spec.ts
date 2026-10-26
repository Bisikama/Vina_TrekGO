import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { UserRole, UserStatus } from '@prisma/client';

import { GearExtractionController } from '../src/modules/gear/presentation/controllers/gear-extraction.controller';
import { GearExtractionService } from '../src/modules/gear/application/services/gear-extraction.service';
import { GEAR_EXTRACTION_DRAFT_REPOSITORY_PORT } from '../src/modules/gear/application/ports/gear-extraction-draft.repository.port';
import { GEAR_EXTRACTION_CACHE_PORT } from '../src/modules/gear/application/ports/gear-extraction-cache.port';
import { GEAR_CONCURRENCY_LEASE_PORT } from '../src/modules/gear/application/ports/gear-concurrency-lease.port';
import { USER_GEAR_REPOSITORY_PORT } from '../src/modules/gear/application/ports/user-gear.repository.port';
import { GEAR_AI_PORT } from '../src/modules/gear/application/ports/gear-ai.port';
import { MEDIA_ASSET_PORT } from '../src/modules/media/application/ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from '../src/modules/media/application/ports/media-storage.port';
import { PAGE_READER_PORT } from '../src/modules/gear/application/ports/page-reader.port';

import { AuthenticationGuard } from '../src/shared/guards/authentication.guard';
import { RolesGuard } from '../src/shared/guards/roles.guard';
import { AccessTokenGuard } from '../src/shared/guards/access-token.guard';
import { ApiKeyGuard } from '../src/shared/guards/api-key.guard';
import { SupabaseService } from '../src/shared/services/supabase.service';
import { PrismaService } from '../src/shared/services/prisma.service';
import { GlobalErrorFilter } from '../src/shared/errors/global-error.filter';
import { AppError } from '../src/shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../src/shared/errors/codes/gear.error-codes';
import {
  GearExtractionDraftDomain,
  GearExtractionCacheDomain,
  UserGearItemDomain,
} from '../src/modules/gear/domain/gear.types';

describe('Gear Advisor V3.1.5 — Phase 08 Image Extraction HTTP Pipeline (/api/v1/gear/extractions)', () => {
  let app: INestApplication;

  const aliceId = randomUUID();
  const aliceAuthId = randomUUID();
  const aliceToken = 'Bearer alice-token';

  const bobId = randomUUID();
  const bobAuthId = randomUUID();
  const bobToken = 'Bearer bob-token';

  // In-memory databases
  const drafts = new Map<string, GearExtractionDraftDomain>();
  const caches = new Map<string, GearExtractionCacheDomain>();
  const userItems = new Map<string, UserGearItemDomain>();
  const mediaAssets = new Map<string, any>();

  let aiCallCount = 0;
  let draftCounterToday = 0;

  beforeAll(async () => {
    // 1. Mock Media Asset Port
    const mockMediaPort = {
      findById: jest.fn(async ({ id }: { id: string }) => {
        return mediaAssets.get(id) || null;
      }),
    };

    // 2. Mock Draft Repository Port
    const mockDraftRepo = {
      createDraft: jest.fn(async (input: any) => {
        draftCounterToday++;
        const draft: GearExtractionDraftDomain = {
          id: randomUUID(),
          userId: input.userId,
          sourceType: input.sourceType,
          sourceHash: input.sourceHash,
          status: 'PENDING',
          extractedData: null,
          confirmedItemId: null,
          confirmationPayloadHash: null,
          version: 1,
          expiresAt: input.expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        drafts.set(draft.id, draft);
        return { ...draft };
      }),
      findByIdAndUser: jest.fn(async (id: string, userId: string) => {
        const d = drafts.get(id);
        if (!d || d.userId !== userId) return null;
        return { ...d };
      }),
      updateExtractedData: jest.fn(async (id: string, data: any, status: any, expectedVersion?: number) => {
        const d = drafts.get(id);
        if (!d) throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_DRAFT_NOT_FOUND);
        if (expectedVersion !== undefined && d.version !== expectedVersion) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT);
        }
        const updated: GearExtractionDraftDomain = {
          ...d,
          extractedData: data,
          status,
          version: d.version + 1,
          updatedAt: new Date(),
        };
        drafts.set(id, updated);
        return { ...updated };
      }),
    };

    // 3. Mock Cache Port
    const mockCachePort = {
      getCache: jest.fn(async (ownerScope: string, contentHash: string) => {
        const key = `${ownerScope}:${contentHash}`;
        const record = caches.get(key);
        if (!record || record.status !== 'SUCCESS') return null;
        return { ...record };
      }),
      setCache: jest.fn(async (data: any) => {
        const key = `${data.ownerScope}:${data.contentHash}`;
        const rec: GearExtractionCacheDomain = {
          id: randomUUID(),
          ...data,
          createdAt: new Date(),
        };
        caches.set(key, rec);
        return { ...rec };
      }),
    };

    // 4. Mock Concurrency Lease Port
    const mockLeasePort = {
      acquireLease: jest.fn(async () => ({ acquired: true, fencingToken: 1 })),
      releaseLease: jest.fn(async () => true),
    };

    // 5. Mock User Gear Repository Port
    const mockUserGearRepo = {
      findByIdAndUser: jest.fn(async (id: string, userId: string) => {
        const item = userItems.get(id);
        if (!item || item.userId !== userId) return null;
        return { ...item };
      }),
      findById: jest.fn(async (id: string, userId: string) => {
        const item = userItems.get(id);
        if (!item || item.userId !== userId) return null;
        return { ...item };
      }),
      findAllByUser: jest.fn(async (userId: string, category?: string) => {
        return Array.from(userItems.values()).filter(
          (i) => i.userId === userId && (!category || i.category === category)
        );
      }),
      create: jest.fn(async (input: any) => {
        const userTotal = Array.from(userItems.values()).filter((i) => i.userId === input.userId).length;
        if (userTotal >= 50) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_LIMIT_EXCEEDED);
        }
        const newItem: UserGearItemDomain = {
          id: randomUUID(),
          userId: input.userId,
          name: input.name,
          category: input.category,
          brand: input.brand,
          condition: input.condition,
          attributes: input.attributes,
          photoRef: input.photoRef,
          source: input.source,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        userItems.set(newItem.id, newItem);
        return { ...newItem };
      }),
    };

    // 6. Mock AI Port
    const mockAiPort = {
      extractGear: jest.fn(async (req: any) => {
        aiCallCount++;
        return {
          extraction: {
            category: 'JACKET',
            name: 'Áo khoác chống nước Columbia',
            brand: 'Columbia',
            attributes: {
              waterproof_mm: 10000,
              weight_g: 350,
              windproof: true,
            },
            evidence: [
              {
                id: 'ev-1',
                fieldPath: 'attributes.waterproof_mm',
                originalText: 'Omni-Tech 10000mm',
              },
            ],
            warnings: [],
            fieldsUnknown: ['temp_rating_c'],
            needsConfirmation: true,
          },
          metadata: {
            promptVersion: '1.0.0',
            promptHash: 'mock-hash',
            modelVersion: 'gpt-4o-mini',
            schemaVersion: '3.1.5',
            latencyMs: 120,
          },
        };
      }),
    };

    // 7. Mock Supabase & Prisma
    const mockSupabase = {
      verifyToken: jest.fn(async (token: string) => {
        if (token === 'alice-token') return { id: aliceAuthId, email: 'alice@trekgo.vn' };
        if (token === 'bob-token') return { id: bobAuthId, email: 'bob@trekgo.vn' };
        return null;
      }),
    };

    const mockMediaStoragePort = {
      openOriginalStream: jest.fn(async () => {
        const buf = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        );
        return { stream: Readable.from([buf]) };
      }),
    };

    const mockPrisma: any = {
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      user: {
        findUnique: jest.fn(async ({ where }: { where: { authUserId: string } }) => {
          if (where.authUserId === aliceAuthId) {
            return { id: aliceId, authUserId: aliceAuthId, email: 'alice@trekgo.vn', role: UserRole.MEMBER, status: UserStatus.ACTIVE };
          }
          if (where.authUserId === bobAuthId) {
            return { id: bobId, authUserId: bobAuthId, email: 'bob@trekgo.vn', role: UserRole.MEMBER, status: UserStatus.ACTIVE };
          }
          return null;
        }),
      },
      gearExtractionDraft: {
        findFirst: jest.fn(async ({ where }: any) => {
          const d = drafts.get(where.id);
          if (!d || (where.userId && d.userId !== where.userId)) return null;
          return { ...d };
        }),
        findMany: jest.fn(async ({ where }: any) => {
          return Array.from(drafts.values()).filter((d) => d.userId === where.userId);
        }),
        count: jest.fn(async () => draftCounterToday),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const draft = drafts.get(where.id);
          if (!draft || (where.version !== undefined && draft.version !== where.version)) return { count: 0 };
          const updated = {
            ...draft,
            ...data,
            version: draft.version + 1,
            updatedAt: new Date(),
          };
          drafts.set(where.id, updated);
          return { count: 1 };
        }),
      },
      userGearItem: {
        count: jest.fn(async ({ where }: any) => {
          return Array.from(userItems.values()).filter((i) => i.userId === where.userId).length;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          const item = userItems.get(where.id);
          if (!item || (where.userId && item.userId !== where.userId)) return null;
          return { ...item, photos: [] };
        }),
        findMany: jest.fn(async ({ where }: any) => {
          return Array.from(userItems.values()).filter(
            (i) => i.userId === where.userId && (!where.category || i.category === where.category),
          );
        }),
        create: jest.fn(async ({ data }: any) => {
          const item: UserGearItemDomain = {
            id: randomUUID(),
            userId: data.userId,
            name: data.name,
            category: data.category,
            brand: data.brand ?? null,
            condition: data.condition,
            attributes: data.attributes || {},
            photoRef: data.photoRef ?? null,
            source: data.source,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          userItems.set(item.id, item);
          return { ...item };
        }),
      },
      userGearPhoto: {
        create: jest.fn(async ({ data }: any) => {
          return { id: randomUUID(), ...data, createdAt: new Date() };
        }),
      },
      mediaAsset: {
        findFirst: jest.fn(async ({ where }: any) => {
          return mediaAssets.get(where.id) || null;
        }),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GearExtractionController],
      providers: [
        GearExtractionService,
        { provide: MEDIA_ASSET_PORT, useValue: mockMediaPort },
        { provide: MEDIA_STORAGE_PORT, useValue: mockMediaStoragePort },
        { provide: GEAR_EXTRACTION_DRAFT_REPOSITORY_PORT, useValue: mockDraftRepo },
        { provide: GEAR_EXTRACTION_CACHE_PORT, useValue: mockCachePort },
        { provide: GEAR_CONCURRENCY_LEASE_PORT, useValue: mockLeasePort },
        { provide: USER_GEAR_REPOSITORY_PORT, useValue: mockUserGearRepo },
        { provide: GEAR_AI_PORT, useValue: mockAiPort },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SupabaseService, useValue: mockSupabase },
        AuthenticationGuard,
        RolesGuard,
        AccessTokenGuard,
        ApiKeyGuard,
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

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Route 1: POST /api/v1/gear/extractions (source = IMAGE)', () => {
    let validUploadId: string;
    let foreignUploadId: string;

    beforeEach(() => {
      validUploadId = randomUUID();
      mediaAssets.set(validUploadId, {
        id: validUploadId,
        ownerUserId: aliceId,
        scope: 'USER_GEAR',
        status: 'READY',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 1024, // 1MB
      });

      foreignUploadId = randomUUID();
      mediaAssets.set(foreignUploadId, {
        id: foreignUploadId,
        ownerUserId: bobId,
        scope: 'USER_GEAR',
        status: 'READY',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 1024,
      });
    });

    it('rejects unowned media asset with 403 GEAR_FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'IMAGE',
          uploadId: foreignUploadId,
        })
        .expect(403);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_FORBIDDEN);
    });

    it('rejects oversized media asset (> 5MB) with 400 GEAR_PHOTO_LIMIT_EXCEEDED', async () => {
      const oversizedId = randomUUID();
      mediaAssets.set(oversizedId, {
        id: oversizedId,
        ownerUserId: aliceId,
        scope: 'USER_GEAR',
        status: 'READY',
        mimeType: 'image/jpeg',
        sizeBytes: 6 * 1024 * 1024, // 6MB
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'IMAGE',
          uploadId: oversizedId,
        })
        .expect(400);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED);
    });

    it('successfully extracts gear from valid image and returns draft in READY state', async () => {
      const initialAiCalls = aiCallCount;

      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'IMAGE',
          uploadId: validUploadId,
        })
        .expect(201);

      expect(res.body.status).toBe('READY');
      expect(res.body.sourceType).toBe('IMAGE');
      expect(res.body.extractedData).toBeDefined();
      expect(res.body.extractedData.category).toBe('JACKET');
      expect(res.body.extractedData.attributes.waterproof_mm).toBe(10000);
      expect(aiCallCount).toBe(initialAiCalls + 1);
    });

    it('reuses cache on identical uploadId without calling AI again', async () => {
      // First call primes cache
      await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'IMAGE',
          uploadId: validUploadId,
        })
        .expect(201);

      const currentCalls = aiCallCount;

      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'IMAGE',
          uploadId: validUploadId,
        })
        .expect(201);

      expect(res.body.status).toBe('READY');
      expect(aiCallCount).toBe(currentCalls); // Cache hit: AI was not called!
    });

    it('successfully extracts gear with canonical nested MASTER format { source: { kind: "IMAGE", uploadId } }', async () => {
      const nestedUploadId = randomUUID();
      mediaAssets.set(nestedUploadId, {
        id: nestedUploadId,
        ownerUserId: aliceId,
        scope: 'USER_GEAR',
        status: 'READY',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 512,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: {
            kind: 'IMAGE',
            uploadId: nestedUploadId,
          },
        })
        .expect(201);

      expect(res.body.status).toBe('READY');
      expect(res.body.sourceType).toBe('IMAGE');
      expect(res.body.extractedData).toBeDefined();
    });

    it('successfully extracts gear with Swagger flat format { sourceType: "IMAGE", uploadId }', async () => {
      const swaggerUploadId = randomUUID();
      mediaAssets.set(swaggerUploadId, {
        id: swaggerUploadId,
        ownerUserId: aliceId,
        scope: 'USER_GEAR',
        status: 'READY',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 512,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          sourceType: 'IMAGE',
          uploadId: swaggerUploadId,
        })
        .expect(201);

      expect(res.body.status).toBe('READY');
      expect(res.body.sourceType).toBe('IMAGE');
      expect(res.body.extractedData).toBeDefined();
    });

    it('rejects conflicting format with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: {
            kind: 'IMAGE',
            uploadId: validUploadId,
          },
          sourceType: 'LINK',
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Route 2: GET /api/v1/gear/extractions/:id', () => {
    let aliceDraftId: string;

    beforeAll(async () => {
      const draft: GearExtractionDraftDomain = {
        id: randomUUID(),
        userId: aliceId,
        sourceType: 'IMAGE',
        sourceHash: 'sample-hash',
        status: 'READY',
        extractedData: {
          category: 'JACKET',
          name: 'Áo khoác',
          attributes: { waterproof_mm: 5000 },
        },
        confirmedItemId: null,
        confirmationPayloadHash: null,
        version: 2,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      drafts.set(draft.id, draft);
      aliceDraftId = draft.id;
    });

    it('reads draft details for owner Alice', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/extractions/${aliceDraftId}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(res.body.id).toBe(aliceDraftId);
      expect(res.body.status).toBe('READY');
      expect(res.body.userId).toBe(aliceId);
    });

    it('returns 404 GEAR_EXTRACTION_DRAFT_NOT_FOUND when Bob tries to read Alice draft', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/extractions/${aliceDraftId}`)
        .set('Authorization', bobToken)
        .expect(404);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_EXTRACTION_DRAFT_NOT_FOUND);
    });
  });

  describe('Route 3: POST /api/v1/gear/extractions/:id/confirm', () => {
    let readyDraftId: string;

    beforeEach(() => {
      const draft: GearExtractionDraftDomain = {
        id: randomUUID(),
        userId: aliceId,
        sourceType: 'IMAGE',
        sourceHash: 'sample-hash-ready',
        status: 'READY',
        extractedData: {
          category: 'JACKET',
          name: 'Columbia Waterproof Jacket',
          attributes: { waterproof_mm: 10000, temp_rating_c: -5, weight_g: 350, windproof: true },
        },
        confirmedItemId: null,
        confirmationPayloadHash: null,
        version: 2,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      drafts.set(draft.id, draft);
      readyDraftId = draft.id;
    });

    it('detects duplicate without acknowledgeDuplicate and returns 409 (draft stays READY)', async () => {
      // Seed closet with a similar jacket
      const existingJacket: UserGearItemDomain = {
        id: randomUUID(),
        userId: aliceId,
        name: 'Existing Columbia Jacket',
        category: 'JACKET',
        brand: 'Columbia',
        condition: 'GOOD',
        attributes: { waterproof_mm: 10000, temp_rating_c: -5, weight_g: 350, windproof: true },
        photoRef: null,
        source: 'MANUAL',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userItems.set(existingJacket.id, existingJacket);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/extractions/${readyDraftId}/confirm`)
        .set('Authorization', aliceToken)
        .send({
          expectedVersion: 2,
          item: {
            name: 'Columbia Waterproof Jacket',
            category: 'JACKET',
            brand: 'Columbia',
            condition: 'GOOD',
            attributes: { waterproof_mm: 10000, temp_rating_c: -5, weight_g: 350, windproof: true },
          },
        })
        .expect(409);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_ITEM_POSSIBLE_DUPLICATE);
      // Draft remains READY
      expect(drafts.get(readyDraftId)?.status).toBe('READY');
    });

    it('successfully confirms draft when acknowledgeDuplicate is true and creates item with source AI_IMAGE', async () => {
      const payload = {
        expectedVersion: 2,
        acknowledgeDuplicate: true,
        item: {
          name: 'Columbia Waterproof Jacket Confirmed',
          category: 'JACKET',
          brand: 'Columbia',
          condition: 'NEW',
          attributes: { waterproof_mm: 10000, temp_rating_c: -5, weight_g: 350, windproof: true },
        },
      };

      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/extractions/${readyDraftId}/confirm`)
        .set('Authorization', aliceToken)
        .send(payload)
        .expect(200);

      expect(res.body.replayed).toBe(false);
      expect(res.body.item.id).toBeDefined();
      expect(res.body.item.source).toBe('ai_image');
      expect(res.body.item.name).toBe('Columbia Waterproof Jacket Confirmed');

      // Verify draft is now CONFIRMED
      const draft = drafts.get(readyDraftId);
      expect(draft?.status).toBe('CONFIRMED');
      expect(draft?.confirmedItemId).toBe(res.body.item.id);

      // Replay test: second confirm with identical payload returns replayed: true
      const replayRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/extractions/${readyDraftId}/confirm`)
        .set('Authorization', aliceToken)
        .send(payload)
        .expect(200);

      expect(replayRes.body.replayed).toBe(true);
      expect(replayRes.body.item.id).toBe(res.body.item.id);
    });

    it('rejects confirm with 409 GEAR_DRAFT_PAYLOAD_MISMATCH if payload differs on replay', async () => {
      // First confirm
      const payload1 = {
        acknowledgeDuplicate: true,
        item: {
          name: 'Jacket V1',
          category: 'JACKET',
          condition: 'NEW',
          attributes: { waterproof_mm: 10000, temp_rating_c: -5, weight_g: 350, windproof: true },
        },
      };
      await request(app.getHttpServer())
        .post(`/api/v1/gear/extractions/${readyDraftId}/confirm`)
        .set('Authorization', aliceToken)
        .send(payload1)
        .expect(200);

      // Second confirm with changed name
      const payload2 = {
        item: {
          name: 'Jacket V2 Mismatch',
          category: 'JACKET',
          condition: 'NEW',
          attributes: { waterproof_mm: 10000, temp_rating_c: -5, weight_g: 350, windproof: true },
        },
      };
      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/extractions/${readyDraftId}/confirm`)
        .set('Authorization', aliceToken)
        .send(payload2)
        .expect(409);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_DRAFT_PAYLOAD_MISMATCH);
    });
  });
});
