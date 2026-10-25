import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { UserRole, UserStatus } from '@prisma/client';

import { GearPlanController } from '../src/modules/gear/presentation/controllers/gear-plan.controller';
import { GearPlanService } from '../src/modules/gear/application/services/gear-plan.service';
import { GearRuleService } from '../src/modules/gear/application/services/gear-rule.service';

import { GEAR_PLAN_REPOSITORY_PORT } from '../src/modules/gear/application/ports/gear-plan.repository.port';
import { GEAR_PLAN_REVISION_REPOSITORY_PORT } from '../src/modules/gear/application/ports/gear-plan-revision.repository.port';
import { USER_GEAR_REPOSITORY_PORT } from '../src/modules/gear/application/ports/user-gear.repository.port';
import { TRIP_CONTEXT_READ_PORT } from '../src/modules/gear/application/ports/trip-context-read.port';
import { GEAR_RULE_REPOSITORY_PORT } from '../src/modules/gear/application/ports/gear-rule.repository.port';

import { AuthenticationGuard } from '../src/shared/guards/authentication.guard';
import { RolesGuard } from '../src/shared/guards/roles.guard';
import { AccessTokenGuard } from '../src/shared/guards/access-token.guard';
import { ApiKeyGuard } from '../src/shared/guards/api-key.guard';
import { SupabaseService } from '../src/shared/services/supabase.service';
import { PrismaService } from '../src/shared/services/prisma.service';
import { GlobalErrorFilter } from '../src/shared/errors/global-error.filter';
import { AppError } from '../src/shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../src/shared/errors/codes/gear.error-codes';
import { COMMON_ERROR_CODES } from '../src/shared/errors/codes/common.error-codes';
import {
  GearPlanDomain,
  GearPlanRevisionDomain,
  UserGearItemDomain,
} from '../src/modules/gear/domain/gear.types';

describe('Gear Advisor V3.1.5 — Phase 06 HTTP Pipeline (/api/v1/gear/plans)', () => {
  let app: INestApplication;

  // Test Principals
  const aliceId = randomUUID();
  const aliceAuthId = randomUUID();
  const aliceToken = 'Bearer alice-valid-token';

  const bobId = randomUUID();
  const bobAuthId = randomUUID();
  const bobToken = 'Bearer bob-valid-token';

  // Test Trip IDs
  const activeTripId = randomUUID();
  const cancelledTripId = randomUUID();

  // In-Memory Storage
  const plans = new Map<string, GearPlanDomain>();
  const planRevisions = new Map<string, GearPlanRevisionDomain[]>();
  const userGearItems = new Map<string, UserGearItemDomain>();

  beforeAll(async () => {
    // Populate user items for Alice
    const goodJacket: UserGearItemDomain = {
      id: randomUUID(),
      userId: aliceId,
      name: 'Alice Pro Trek Jacket',
      category: 'JACKET',
      brand: 'Decathlon',
      condition: 'GOOD',
      attributes: { waterproof_mm: 15000, temp_rating_c: -5, windproof: true, weight_g: 450 },
      photoRef: null,
      source: 'MANUAL',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const badJacket: UserGearItemDomain = {
      id: randomUUID(),
      userId: aliceId,
      name: 'Alice Worn City Jacket',
      category: 'JACKET',
      brand: 'Zara',
      condition: 'POOR',
      attributes: { waterproof_mm: 2000, temp_rating_c: 10, windproof: false, weight_g: 300 },
      photoRef: null,
      source: 'MANUAL',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const goodFootwear: UserGearItemDomain = {
      id: randomUUID(),
      userId: aliceId,
      name: 'Alice Hiking Boots',
      category: 'FOOTWEAR',
      brand: 'Salomon',
      condition: 'GOOD',
      attributes: { waterproof: true, ankle_support: true, grip_level: 5, weight_g: 800 },
      photoRef: null,
      source: 'MANUAL',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const goodBackpack: UserGearItemDomain = {
      id: randomUUID(),
      userId: aliceId,
      name: 'Alice Trek Backpack 50L',
      category: 'BACKPACK',
      brand: 'Osprey',
      condition: 'GOOD',
      attributes: { capacity_l: 50, rain_cover: true, waterproof: true, weight_g: 1200 },
      photoRef: null,
      source: 'MANUAL',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userGearItems.set(goodJacket.id, goodJacket);
    userGearItems.set(badJacket.id, badJacket);
    userGearItems.set(goodFootwear.id, goodFootwear);
    userGearItems.set(goodBackpack.id, goodBackpack);

    // 1. Mock GearPlanRepositoryPort
    const mockPlanRepo = {
      findByIdAndUser: jest.fn(async (id: string, userId: string) => {
        const plan = plans.get(id);
        if (!plan || plan.userId !== userId) return null;
        return { ...plan };
      }),
      findAllByUser: jest.fn(async (userId: string) => {
        return Array.from(plans.values()).filter((p) => p.userId === userId);
      }),
      create: jest.fn(async (input: any) => {
        const plan: GearPlanDomain = {
          id: randomUUID(),
          userId: input.userId,
          title: input.title,
          contextMode: input.contextMode,
          tripId: input.tripId,
          selectedItemIds: input.selectedItemIds || [],
          preferences: input.preferences || {},
          canonicalContext: input.canonicalContext || {},
          inputRevision: 1,
          evaluatedRevision: null,
          progressVersion: 1,
          progressJson: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        plans.set(plan.id, plan);
        return { ...plan };
      }),
      updateSemanticCAS: jest.fn(async (id: string, userId: string, expectedRev: number, update: any) => {
        const plan = plans.get(id);
        if (!plan || plan.userId !== userId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND);
        }
        if (plan.inputRevision !== expectedRev) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT);
        }
        const updated: GearPlanDomain = {
          ...plan,
          ...(update.title !== undefined ? { title: update.title } : {}),
          ...(update.preferences !== undefined ? { preferences: update.preferences } : {}),
          ...(update.canonicalContext !== undefined ? { canonicalContext: update.canonicalContext } : {}),
          ...(update.selectedItemIds !== undefined ? { selectedItemIds: update.selectedItemIds } : {}),
          inputRevision: plan.inputRevision + 1,
          updatedAt: new Date(),
        };
        plans.set(id, updated);
        return { ...updated };
      }),
      updateProgressCAS: jest.fn(async (id: string, userId: string, expectedProg: number, progJson: any[]) => {
        const plan = plans.get(id);
        if (!plan || plan.userId !== userId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND);
        }
        if (plan.progressVersion !== expectedProg) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PROGRESS_CAS_CONFLICT);
        }
        const updated: GearPlanDomain = {
          ...plan,
          progressVersion: plan.progressVersion + 1,
          progressJson: progJson,
          updatedAt: new Date(),
        };
        plans.set(id, updated);
        return { ...updated };
      }),
      setEvaluatedRevision: jest.fn(async (id: string, userId: string, evalRev: number, expectedRev?: number) => {
        const plan = plans.get(id);
        if (!plan || plan.userId !== userId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND);
        }
        if (expectedRev !== undefined && plan.inputRevision !== expectedRev) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT);
        }
        const updated: GearPlanDomain = {
          ...plan,
          evaluatedRevision: evalRev,
          updatedAt: new Date(),
        };
        plans.set(id, updated);
        return { ...updated };
      }),
    };

    // 2. Mock GearPlanRevisionRepositoryPort
    const mockRevisionRepo = {
      findByPlanAndRevision: jest.fn(async (planId: string, revision: number) => {
        const list = planRevisions.get(planId) || [];
        const found = list.find((r) => r.revision === revision);
        return found ? { ...found } : null;
      }),
      findAllByPlan: jest.fn(async (planId: string) => {
        const list = planRevisions.get(planId) || [];
        return [...list].sort((a, b) => b.revision - a.revision);
      }),
      saveRevision: jest.fn(async (input: any) => {
        const list = planRevisions.get(input.planId) || [];
        const existing = list.find((r) => r.revision === input.revision);
        if (existing) {
          if (existing.contentHash === input.contentHash) return existing;
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT);
        }
        const rev: GearPlanRevisionDomain = {
          id: randomUUID(),
          planId: input.planId,
          revision: input.revision,
          contentHash: input.contentHash,
          inputSnapshot: input.inputSnapshot,
          resultSnapshot: input.resultSnapshot,
          contextVersion: input.contextVersion,
          ruleVersions: input.ruleVersions,
          createdAt: new Date(),
        };
        list.push(rev);
        planRevisions.set(input.planId, list);
        return { ...rev };
      }),
    };

    // 3. Mock UserGearRepositoryPort
    const mockUserGearRepo = {
      findByIdsAndUser: jest.fn(async (ids: string[], userId: string) => {
        return ids
          .map((id) => userGearItems.get(id))
          .filter((i): i is UserGearItemDomain => Boolean(i && i.userId === userId));
      }),
    };

    // 4. Mock TripContextReadPort
    const mockTripPort = {
      getTripContext: jest.fn(async (tripId: string, userId: string) => {
        if (tripId === cancelledTripId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, {
            message: 'Chuyến đi đã kết thúc hoặc không đủ điều kiện',
          });
        }
        if (userId !== aliceId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_FORBIDDEN, {
            message: 'Bạn không phải thành viên hợp lệ của chuyến đi',
          });
        }
        return {
          tripId,
          destination: 'Bidoup Nui Ba',
          status: 'OPEN',
          startAt: new Date('2026-11-15T00:00:00Z'),
          endAt: new Date('2026-11-18T00:00:00Z'),
          days: 3,
          difficulty: 4,
          terrain: ['muddy', 'rocky'],
          contextVersion: 'ctx_trip_v1',
          sourceReferences: { tripId, version: 1 },
        };
      }),
      getHistoricalTripContext: jest.fn(async (tripId: string, userId: string, planId: string) => {
        return {
          tripId,
          status: 'COMPLETED',
          startAt: new Date('2026-10-01T00:00:00Z'),
          endAt: new Date('2026-10-04T00:00:00Z'),
          days: 3,
          difficulty: 4,
          terrain: ['rocky'],
          contextVersion: 'ctx_trip_v0',
          sourceReferences: { tripId, version: 1 },
        };
      }),
    };

    // 5. Mock Supabase & Prisma Services
    const mockSupabaseService = {
      verifyToken: jest.fn(async (token: string) => {
        if (token === 'alice-valid-token') return { id: aliceAuthId, email: 'alice@trekgo.vn' };
        if (token === 'bob-valid-token') return { id: bobAuthId, email: 'bob@trekgo.vn' };
        return null;
      }),
    };

    const mockPrismaService = {
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
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GearPlanController],
      providers: [
        GearPlanService,
        GearRuleService,
        { provide: GEAR_PLAN_REPOSITORY_PORT, useValue: mockPlanRepo },
        { provide: GEAR_PLAN_REVISION_REPOSITORY_PORT, useValue: mockRevisionRepo },
        { provide: USER_GEAR_REPOSITORY_PORT, useValue: mockUserGearRepo },
        { provide: TRIP_CONTEXT_READ_PORT, useValue: mockTripPort },
        { provide: GEAR_RULE_REPOSITORY_PORT, useValue: null },
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
    await app.close();
  });

  let createdPlanId: string;

  describe('Route 1: GET /api/v1/gear/plans/prefill', () => {
    it('returns official trip facts, seasonal climate estimate, and baseline requirements', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/prefill?tripId=${activeTripId}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(res.body.tripId).toBe(activeTripId);
      expect(res.body.days).toBe(3);
      expect(res.body.difficulty).toBe(4);
      expect(res.body.terrain).toContain('muddy');
      expect(res.body.contextVersion).toBe('ctx_trip_v1');
      expect(res.body.suggestedClimate).toBeDefined();
      expect(res.body.suggestedClimate.source).toBe('CLIMATE_ESTIMATE');
      expect(res.body.requirements).toBeDefined();
      expect(res.body.requirements.length).toBeGreaterThanOrEqual(3);
    });

    it('rejects with 400 GEAR_TRIP_NOT_ELIGIBLE when trip is cancelled or ended', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/prefill?tripId=${cancelledTripId}`)
        .set('Authorization', aliceToken)
        .expect(400);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE);
    });

    it('rejects with 403 GEAR_FORBIDDEN when user is not a member of the trip', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/prefill?tripId=${activeTripId}`)
        .set('Authorization', bobToken)
        .expect(403);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_FORBIDDEN);
    });
  });

  describe('Route 2: POST /api/v1/gear/plans', () => {
    it('creates a gear plan for an eligible trip with inputRevision=1 and progressVersion=1', async () => {
      const aliceItemIds = Array.from(userGearItems.keys());
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/plans')
        .set('Authorization', aliceToken)
        .send({
          title: 'Alice Bidoup Trekking Plan',
          contextMode: 'TRIP',
          tripId: activeTripId,
          selectedItemIds: aliceItemIds,
          preferences: { budget: 'ECONOMICAL' },
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Alice Bidoup Trekking Plan');
      expect(res.body.inputRevision).toBe(1);
      expect(res.body.progressVersion).toBe(1);
      expect(res.body.evaluatedRevision).toBeNull();

      createdPlanId = res.body.id;
    });

    it('rejects with 404 GEAR_ITEM_NOT_FOUND when user selects items they do not own', async () => {
      const unownedItemId = randomUUID();
      const res = await request(app.getHttpServer())
        .post('/api/v1/gear/plans')
        .set('Authorization', aliceToken)
        .send({
          title: 'Plan With Fake Item',
          contextMode: 'TRIP',
          tripId: activeTripId,
          selectedItemIds: [unownedItemId],
        })
        .expect(404);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND);
    });
  });

  describe('Route 3: GET /api/v1/gear/plans & GET /api/v1/gear/plans/:id', () => {
    it('lists plans belonging to the authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gear/plans')
        .set('Authorization', aliceToken)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((p: any) => p.id === createdPlanId)).toBe(true);
    });

    it('returns 404 when Bob attempts to read Alice plan', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/${createdPlanId}`)
        .set('Authorization', bobToken)
        .expect(404);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND);
    });

    it('reads plan detail for Alice with current context', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/${createdPlanId}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(res.body.id).toBe(createdPlanId);
      expect(res.body.userId).toBe(aliceId);
    });
  });

  describe('Route 4: PATCH /api/v1/gear/plans/:id (CAS Semantic Mutation)', () => {
    it('rejects with 409 GEAR_PLAN_CAS_CONFLICT when expectedInputRevision mismatches', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/gear/plans/${createdPlanId}`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 99, // Mismatch (current is 1)
          title: 'Wrong Revision Title',
        })
        .expect(409);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT);
    });

    it('updates plan input and increments inputRevision to 2 when CAS succeeds', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/gear/plans/${createdPlanId}`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          title: 'Alice Bidoup Trekking Plan — Revised',
        })
        .expect(200);

      expect(res.body.title).toBe('Alice Bidoup Trekking Plan — Revised');
      expect(res.body.inputRevision).toBe(2);
    });
  });

  describe('Route 5: PUT /api/v1/gear/plans/:id/checklist-progress (Progress CAS)', () => {
    it('increments progressVersion without altering inputRevision', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/gear/plans/${createdPlanId}/checklist-progress`)
        .set('Authorization', aliceToken)
        .send({
          expectedProgressVersion: 1,
          items: [{ requirementId: 'req_jacket', isChecked: true, note: 'Đã chuẩn bị áo khoác' }],
        })
        .expect(200);

      expect(res.body.progressVersion).toBe(2);
      expect(res.body.inputRevision).toBe(2); // Unaltered
    });

    it('rejects with 409 GEAR_PROGRESS_CAS_CONFLICT when expectedProgressVersion mismatches', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/gear/plans/${createdPlanId}/checklist-progress`)
        .set('Authorization', aliceToken)
        .send({
          expectedProgressVersion: 1, // Mismatch (now 2)
          items: [{ requirementId: 'req_jacket', isChecked: true }],
        })
        .expect(409);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_PROGRESS_CAS_CONFLICT);
    });
  });

  describe('Route 6: POST /api/v1/gear/plans/:id/evaluate', () => {
    it('rejects with 409 when expectedInputRevision does not match current plan revision', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${createdPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1, // Current is 2
          confirmedClimate: { temp_min_c: 10, temp_max_c: 20, temp_min_night_c: 8, rain_prob_pct: 65 },
        })
        .expect(409);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT);
    });

    it('evaluates plan, handles multi-item coverage, and saves immutable revision snapshot', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${createdPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 2,
          confirmedClimate: {
            temp_min_c: 10,
            temp_max_c: 20,
            temp_min_night_c: 8,
            rain_prob_pct: 65,
          },
        })
        .expect(200);

      expect(res.body.coverage).toBeDefined();
      expect(res.body.summary).toBeDefined();
      expect(res.body.checklist).toBeDefined();

      // Multi-item check: Alice owns both good and bad jackets.
      // Good jacket is selected to cover the requirement without forcing rental!
      const jacketReq = res.body.coverage.requirements.find((r: any) => r.category === 'JACKET');
      expect(jacketReq).toBeDefined();
      expect(jacketReq.status).toBe('COVERED_BY_OWNED');
      expect(jacketReq.recommendedAction).toBe('USE_OWNED');

      // Verify evaluatedRevision on plan is now 2 (reflects inputRevision 2 per MASTER 4.1)
      const planRes = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/${createdPlanId}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(planRes.body.evaluatedRevision).toBe(2);
    });

    it('replays evaluate idempotently without creating duplicate revision or error', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${createdPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 2,
          confirmedClimate: {
            temp_min_c: 10,
            temp_max_c: 20,
            temp_min_night_c: 8,
            rain_prob_pct: 65,
          },
        })
        .expect(200);

      expect(res.body.coverage).toBeDefined();
    });
  });

  describe('Route 7: Revisions & Diff', () => {
    it('lists evaluated revisions for the plan', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/${createdPlanId}/revisions`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].revision).toBe(2);
      expect(res.body[0].contentHash).toBeDefined();
    });

    it('fetches immutable revision detail by revision number', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/${createdPlanId}/revisions/2`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(res.body.revision).toBe(2);
      expect(res.body.contentHash).toBeDefined();
      expect(res.body.resultSnapshot).toBeDefined();
    });

    it('computes diff between revisions or against current evaluated snapshot', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/${createdPlanId}/diff`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(res.body.planId).toBe(createdPlanId);
      expect(res.body.changes).toBeDefined();
      expect(res.body.summary).toBeDefined();
    });

    it('rejects forged checklist requirement ID with 400', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/gear/plans/${createdPlanId}/checklist-progress`)
        .set('Authorization', aliceToken)
        .send({
          expectedProgressVersion: 2,
          items: [{ requirementId: 'forged-fake-id', isChecked: true }],
        })
        .expect(400);

      expect(res.body.error.code).toBe(COMMON_ERROR_CODES.VALIDATION_ERROR);
    });

    it('returns 404 when diff is requested with nonexistent revision', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/${createdPlanId}/diff?from=999`)
        .set('Authorization', aliceToken)
        .expect(404);

      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND);
    });

    it('marks plan isStale when closet item attributes are modified and produces revision 2 on re-evaluate', async () => {
      // Modify good jacket attributes in userGearItems
      const jacket = Array.from(userGearItems.values()).find(
        (i) => i.category === 'JACKET' && ((i.attributes as any)?.waterproof_mm ?? 0) >= 5000,
      )!;
      jacket.version = 2;
      jacket.attributes = { ...jacket.attributes, waterproof_mm: 20000 };
      userGearItems.set(jacket.id, jacket);

      // Check getPlan indicates stale
      const planRes = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/${createdPlanId}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(planRes.body.isStale).toBe(true);

      // Re-evaluate produces new revision 3
      await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${createdPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 2,
          confirmedClimate: { temp_min_c: 10, temp_max_c: 20, temp_min_night_c: 8, rain_prob_pct: 65 },
        })
        .expect(200);

      const updatedPlanRes = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/${createdPlanId}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(updatedPlanRes.body.evaluatedRevision).toBe(3);
    });

    it('reflects stored true user checklist progress in evaluated checklist', async () => {
      // 1. Tick req_jacket as checked
      await request(app.getHttpServer())
        .put(`/api/v1/gear/plans/${createdPlanId}/checklist-progress`)
        .set('Authorization', aliceToken)
        .send({
          expectedProgressVersion: 2,
          items: [{ requirementId: 'req_jacket', isChecked: true }],
        })
        .expect(200);

      // 2. Re-evaluate and check that checklist item isChecked is true
      const evalRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${createdPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 3,
          confirmedClimate: { temp_min_c: 10, temp_max_c: 20, temp_min_night_c: 8, rain_prob_pct: 65 },
        })
        .expect(200);

      const jacketChecklist = evalRes.body.checklist.find((c: any) => c.requirementId === 'req_jacket');
      expect(jacketChecklist).toBeDefined();
      expect(jacketChecklist.isChecked).toBe(true);
    });

    it('handles semantic A to B to A preferences mutation without regressing head or 409 conflict', async () => {
      // 1. Mutate to Preference B (inputRevision -> 4)
      await request(app.getHttpServer())
        .patch(`/api/v1/gear/plans/${createdPlanId}`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 3,
          preferences: { style: 'ultralight_B' },
        })
        .expect(200);

      // Evaluate B (creates revision 4)
      const evalB = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${createdPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 4,
          confirmedClimate: { temp_min_c: 10, temp_max_c: 20, temp_min_night_c: 8, rain_prob_pct: 65 },
        })
        .expect(200);
      expect(evalB.status).not.toBe(409);

      // 2. Mutate back to Preference A (inputRevision -> 5)
      await request(app.getHttpServer())
        .patch(`/api/v1/gear/plans/${createdPlanId}`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 4,
          preferences: {}, // Restores original A preferences
        })
        .expect(200);

      // Evaluate A (should produce new head revision 5 tied to inputRevision per MASTER 4.1)
      const evalA = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${createdPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 5,
          confirmedClimate: { temp_min_c: 10, temp_max_c: 20, temp_min_night_c: 8, rain_prob_pct: 65 },
        })
        .expect(200);

      const planRes = await request(app.getHttpServer())
        .get(`/api/v1/gear/plans/${createdPlanId}`)
        .set('Authorization', aliceToken)
        .expect(200);

      expect(planRes.body.evaluatedRevision).toBe(5);
    });
  });
});
