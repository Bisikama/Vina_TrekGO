import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import * as dns from 'dns';
import { randomUUID } from 'crypto';
import { UserRole, UserStatus } from '@prisma/client';

import { GearExtractionController } from '../src/modules/gear/presentation/controllers/gear-extraction.controller';
import { GearExtractionService } from '../src/modules/gear/application/services/gear-extraction.service';
import { GEAR_EXTRACTION_DRAFT_REPOSITORY_PORT } from '../src/modules/gear/application/ports/gear-extraction-draft.repository.port';
import { GEAR_EXTRACTION_CACHE_PORT } from '../src/modules/gear/application/ports/gear-extraction-cache.port';
import { GEAR_CONCURRENCY_LEASE_PORT } from '../src/modules/gear/application/ports/gear-concurrency-lease.port';
import { USER_GEAR_REPOSITORY_PORT } from '../src/modules/gear/application/ports/user-gear.repository.port';
import { GEAR_AI_PORT } from '../src/modules/gear/application/ports/gear-ai.port';
import { MEDIA_ASSET_PORT } from '../src/modules/media/application/ports/media-asset.port';

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
import { PAGE_READER_PORT } from '../src/modules/gear/application/ports/page-reader.port';
import { isPrivateOrReservedIp } from '../src/modules/gear/infrastructure/adapters/safe-link-fetcher';

describe('Gear Advisor V3.1.5 — Phase 09 Link Extraction & SSRF HTTP Pipeline (/api/v1/gear/extractions)', () => {
  let app: INestApplication;

  const aliceId = randomUUID();
  const aliceAuthId = randomUUID();
  const aliceToken = 'Bearer alice-token';

  const drafts = new Map<string, GearExtractionDraftDomain>();
  const caches = new Map<string, GearExtractionCacheDomain>();
  const userItems = new Map<string, UserGearItemDomain>();

  let aiCallCount = 0;

  beforeAll(async () => {
    // 1. Mock Draft Repository Port
    const mockDraftRepo = {
      createDraft: jest.fn(async (input: any) => {
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

    // 2. Mock Cache Port
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

    // 3. Mock Concurrency Lease Port
    const mockLeasePort = {
      acquireLease: jest.fn(async () => ({ acquired: true, fencingToken: 1 })),
      releaseLease: jest.fn(async () => true),
    };

    // 4. Mock User Gear Repository Port
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

    // 5. Mock AI Port
    const mockAiPort = {
      extractGear: jest.fn(async (req: any) => {
        aiCallCount++;
        return {
          extraction: {
            category: 'TENT',
            name: 'Lều cắm trại 2 người Naturehike',
            brand: 'Naturehike',
            attributes: {
              sleeping_places: 2,
              flysheet_waterproof_mm: 3000,
              floor_waterproof_mm: 5000,
              weight_g: 2200,
            },
            evidence: [
              {
                id: 'ev-1',
                fieldPath: 'attributes.sleeping_places',
                originalText: 'Dành cho 2 người',
              },
            ],
            warnings: [],
            fieldsUnknown: [],
            needsConfirmation: true,
          },
          metadata: {
            promptVersion: '1.0.0',
            promptHash: 'mock-hash',
            modelVersion: 'gpt-4o-mini',
            schemaVersion: '3.1.5',
            latencyMs: 140,
          },
        };
      }),
    };

    // 6. Mock Supabase & Prisma
    const mockSupabase = {
      verifyToken: jest.fn(async (token: string) => {
        if (token === 'alice-token') return { id: aliceAuthId, email: 'alice@trekgo.vn' };
        return null;
      }),
    };

    const mockPageReader = {
      readPage: jest.fn(async (url: string) => {
        const markdown = '# Lều cắm trại 2 người Naturehike\n\n- Số người: 2 người\n- Chỉ số chống nước vải ngoài: 3000mm\n- Chỉ số chống nước đáy lều: 5000mm\n- Trọng lượng: 2200g';
        return {
          url,
          finalUrl: url,
          markdown,
          contentHash: 'mock-content-hash-tent',
          title: 'Lều cắm trại 2 người Naturehike',
          readAt: new Date(),
        };
      }),
    };

    const mockPrisma: any = {
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      user: {
        findUnique: jest.fn(async ({ where }: { where: { authUserId: string } }) => {
          if (where.authUserId === aliceAuthId) {
            return { id: aliceId, authUserId: aliceAuthId, email: 'alice@trekgo.vn', role: UserRole.MEMBER, status: UserStatus.ACTIVE };
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
        count: jest.fn(async () => 0),
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
        findFirst: jest.fn(async () => null),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GearExtractionController],
      providers: [
        GearExtractionService,
        { provide: MEDIA_ASSET_PORT, useValue: null },
        { provide: PAGE_READER_PORT, useValue: mockPageReader },
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

  describe('SSRF Protection Guard', () => {
    it('correctly classifies IPv6 link-local fe90::1 and hex mapped IPv4 loopback ::ffff:7f00:1 as private', () => {
      expect(isPrivateOrReservedIp('fe90::1')).toBe(true);
      expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
      expect(isPrivateOrReservedIp('::ffff:7f00:1')).toBe(true);
      expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
      expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    });

    it('rejects non-HTTPS URLs with 400 GEAR_SSRF_BLOCKED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'LINK',
          url: 'http://insecure-store.vn/item/1',
        })
        .expect(400);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_SSRF_BLOCKED);
    });

    it('rejects localhost with 400 GEAR_SSRF_BLOCKED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'LINK',
          url: 'https://localhost:8080/admin/secrets',
        })
        .expect(400);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_SSRF_BLOCKED);
    });

    it('rejects loopback IP 127.0.0.1 with 400 GEAR_SSRF_BLOCKED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'LINK',
          url: 'https://127.0.0.1/api/keys',
        })
        .expect(400);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_SSRF_BLOCKED);
    });

    it('rejects cloud metadata IP 169.254.169.254 with 400 GEAR_SSRF_BLOCKED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'LINK',
          url: 'https://169.254.169.254/latest/meta-data',
        })
        .expect(400);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_SSRF_BLOCKED);
    });

    it('rejects private IPv4 192.168.1.1 with 400 GEAR_SSRF_BLOCKED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'LINK',
          url: 'https://192.168.1.1/router',
        })
        .expect(400);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_SSRF_BLOCKED);
    });
  });

  describe('Valid Link Extraction & 2-Layer Cache', () => {
    const validPublicUrl = 'https://outdoor-gear-vietnam.vn/products/naturehike-cloud-up-2';
    let draftId: string;

    beforeEach(() => {
      jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as any);

      // Mock global.fetch for web page fetching
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (h: string) => (h.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
          },
          text: async () => `
            <html>
              <head><title>Naturehike Cloud Up 2 Tent</title></head>
              <body>
                <h1>Lều cắm trại 2 người Naturehike Cloud Up 2</h1>
                <p>Thông số kỹ thuật:</p>
                <ul>
                  <li>Số người: 2 người</li>
                  <li>Chỉ số chống nước vải ngoài: 3000mm</li>
                  <li>Chỉ số chống nước đáy lều: 5000mm</li>
                  <li>Trọng lượng: 2200g</li>
                </ul>
              </body>
            </html>
          `,
        };
      });
    });

    it('successfully extracts gear facts from valid product link and returns draft in READY state', async () => {
      const initialCalls = aiCallCount;

      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'LINK',
          url: validPublicUrl,
        })
        .expect(201);

      expect(res.body.status).toBe('READY');
      expect(res.body.sourceType).toBe('LINK');
      expect(res.body.extractedData.category).toBe('TENT');
      expect(res.body.extractedData.attributes.sleeping_places).toBe(2);
      expect(res.body.extractedData.attributes.flysheet_waterproof_mm).toBe(3000);
      expect(aiCallCount).toBe(initialCalls + 1);
      draftId = res.body.id;
    });

    it('reuses cached extraction on subsequent call for identical URL without calling AI again', async () => {
      const currentCalls = aiCallCount;

      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'LINK',
          url: validPublicUrl,
        })
        .expect(201);

      expect(res.body.status).toBe('READY');
      expect(aiCallCount).toBe(currentCalls); // Cache hit!
    });

    it('bypasses cache when forceRefresh and bypassContentCache are true and calls AI provider again', async () => {
      const currentCalls = aiCallCount;

      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/extractions')
        .set('Authorization', aliceToken)
        .send({
          source: 'LINK',
          url: validPublicUrl,
          forceRefresh: true,
          bypassContentCache: true,
        })
        .expect(201);

      expect(res.body.status).toBe('READY');
      expect(aiCallCount).toBe(currentCalls + 1); // Refreshed!
    });

    it('confirms LINK extraction draft and creates user gear item with source AI_LINK', async () => {
      const confirmPayload = {
        expectedVersion: 2,
        acknowledgeDuplicate: true,
        item: {
          name: 'Lều cắm trại 2 người Naturehike',
          category: 'TENT',
          brand: 'Naturehike',
          condition: 'NEW',
          attributes: {
            sleeping_places: 2,
            flysheet_waterproof_mm: 3000,
            floor_waterproof_mm: 5000,
            weight_g: 2200,
          },
        },
      };

      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/extractions/${draftId}/confirm`)
        .set('Authorization', aliceToken)
        .send(confirmPayload)
        .expect(200);

      expect(res.body.replayed).toBe(false);
      expect(res.body.item.id).toBeDefined();
      expect(res.body.item.source).toBe('ai_link');
      expect(res.body.item.name).toBe('Lều cắm trại 2 người Naturehike');

      // Verify draft state updated to CONFIRMED
      const draft = drafts.get(draftId);
      expect(draft?.status).toBe('CONFIRMED');
      expect(draft?.confirmedItemId).toBe(res.body.item.id);
    });
  });
});
