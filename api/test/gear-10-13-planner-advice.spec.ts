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
import { GEAR_PLAN_OPTION_SET_REPOSITORY_PORT } from '../src/modules/gear/application/ports/gear-plan-option-set.repository.port';
import { GEAR_ADVICE_RUN_REPOSITORY_PORT } from '../src/modules/gear/application/ports/gear-advice-run.repository.port';
import { GEAR_QUOTE_LINK_REPOSITORY_PORT } from '../src/modules/gear/application/ports/gear-quote-link.repository.port';
import { GEAR_AI_PORT } from '../src/modules/gear/application/ports/gear-ai.port';

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
  GearPlanDomain,
  GearPlanRevisionDomain,
  UserGearItemDomain,
} from '../src/modules/gear/domain/gear.types';

describe('Gear Advisor V3.1.5 — Phase 10–13 Planner, Advice & Quote Integration (/api/v1/gear/plans)', () => {
  let app: INestApplication;
  let mockPrisma: any;
  let mockAiPort: any;

  // Test Principals
  const aliceId = randomUUID();
  const aliceAuthId = randomUUID();
  const aliceToken = 'Bearer alice-valid-token';

  const bobId = randomUUID();
  const bobAuthId = randomUUID();
  const bobToken = 'Bearer bob-valid-token';

  // Test Trip
  const tripId = randomUUID();

  // In-Memory Storage
  const plans = new Map<string, GearPlanDomain>();
  const planRevisions = new Map<string, GearPlanRevisionDomain[]>();
  const userGearItems = new Map<string, UserGearItemDomain>();
  const optionSets = new Map<string, any>();
  const adviceRuns = new Map<string, any>();
  const quoteLinks = new Map<string, any>();

  const validQuoteId = randomUUID();
  const expiredQuoteId = randomUUID();
  const foreignQuoteId = randomUUID();
  const mismatchedTripQuoteId = randomUUID();

  // Mock Rental Catalog
  const rentalCategories = [
    { id: randomUUID(), slug: 'ao-mua-chong-thoi-tiet', name: 'Áo khoác / áo mưa' },
    { id: randomUUID(), slug: 'giay-leo-nui', name: 'Giày leo núi' },
    { id: randomUUID(), slug: 'balo-trekking', name: 'Balo trekking' },
    { id: randomUUID(), slug: 'tui-ngu-dem-cach-nhiet', name: 'Túi ngủ' },
  ];

  const jacketCategory = rentalCategories[0];
  const footwearCategory = rentalCategories[1];

  const rentalProducts = [
    // Jacket Option A (Cheaper, heavier)
    {
      id: randomUUID(),
      categoryId: jacketCategory.id,
      name: 'Standard Trek Jacket 10k',
      dailyPrice: '50000.00',
      depositPolicyType: 'FIXED',
      depositValue: '100000.00',
      replacementValue: '500000.00',
      status: 'ACTIVE',
      technicalProfile: {
        attributes: {
          waterproof_mm: 10000,
          temp_rating_c: 0,
          windproof: true,
          weight_g: 650,
        },
      },
    },
    // Jacket Option B (Ultralight, higher price)
    {
      id: randomUUID(),
      categoryId: jacketCategory.id,
      name: 'Ultralight Pro Shell 20k',
      dailyPrice: '90000.00',
      depositPolicyType: 'FIXED',
      depositValue: '200000.00',
      replacementValue: '1200000.00',
      status: 'ACTIVE',
      technicalProfile: {
        attributes: {
          waterproof_mm: 20000,
          temp_rating_c: -5,
          windproof: true,
          weight_g: 320,
        },
      },
    },
    // Footwear
    {
      id: randomUUID(),
      categoryId: footwearCategory.id,
      name: 'Salomon Quest 4D GTX',
      dailyPrice: '80000.00',
      depositPolicyType: 'FIXED',
      depositValue: '300000.00',
      replacementValue: '2500000.00',
      status: 'ACTIVE',
      technicalProfile: {
        attributes: {
          waterproof: true,
          ankle_support: true,
          grip_level: 5,
          weight_g: 950,
        },
      },
    },
  ];

  beforeAll(async () => {
    // 1. Mock GearPlanRepositoryPort
    const mockPlanRepo = {
      findByIdAndUser: jest.fn(async (id: string, userId: string) => {
        const plan = plans.get(id);
        if (!plan || plan.userId !== userId) return null;
        return plan;
      }),
      create: jest.fn(async (data: any) => {
        const id = randomUUID();
        const plan: GearPlanDomain = {
          id,
          userId: data.userId,
          title: data.title,
          contextMode: data.contextMode,
          tripId: data.tripId,
          inputRevision: 1,
          evaluatedRevision: null,
          confirmedClimate: null,
          selectedItemIds: data.selectedItemIds ?? [],
          preferences: data.preferences ?? {},
          progressVersion: 1,
          progressJson: [],
          status: 'DRAFT',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        plans.set(id, plan);
        return plan;
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
    const mockPlanRevRepo = {
      findByPlanAndRevision: jest.fn(async (planId: string, revision: number) => {
        const revs = planRevisions.get(planId) ?? [];
        return revs.find((r) => r.revision === revision) ?? null;
      }),
      saveRevision: jest.fn(async (data: any) => {
        const id = randomUUID();
        const rev: GearPlanRevisionDomain = {
          id,
          planId: data.planId,
          revision: data.revision,
          contentHash: data.contentHash,
          inputSnapshot: data.inputSnapshot,
          resultSnapshot: data.resultSnapshot,
          createdAt: new Date(),
        };
        const revs = planRevisions.get(data.planId) ?? [];
        revs.push(rev);
        planRevisions.set(data.planId, revs);
        return rev;
      }),
      findAllByPlan: jest.fn(async (planId: string) => {
        return planRevisions.get(planId) ?? [];
      }),
    };

    // 3. Mock UserGearRepositoryPort
    const mockUserGearRepo = {
      findByIdsAndUser: jest.fn(async (ids: string[], userId: string) => {
        return ids
          .map((id) => userGearItems.get(id))
          .filter((i): i is UserGearItemDomain => !!i && i.userId === userId);
      }),
      findByUserAndCategory: jest.fn(async (userId: string, category: string) => {
        return Array.from(userGearItems.values()).filter(
          (i) => i.userId === userId && i.category === category,
        );
      }),
    };

    // 4. Mock TripContextReadPort
    const mockTripPort = {
      getTripContext: jest.fn(async (tId: string, _uId: string) => {
        return {
          tripId: tId,
          status: 'UPCOMING',
          startAt: new Date(Date.now() + 86400000 * 5),
          endAt: new Date(Date.now() + 86400000 * 7),
          days: 2,
          difficulty: 3,
          terrain: ['FOREST', 'MOUNTAIN'],
          destination: 'Bidoup Nui Ba',
        };
      }),
    };

    // 5. Mock GearRuleService
    const mockRuleService = {
      getActiveRules: jest.fn(async () => []),
    };

    // 6. Mock PrismaService
    mockPrisma = {
      user: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.authUserId === aliceAuthId || where.id === aliceId) {
            return {
              id: aliceId,
              authUserId: aliceAuthId,
              email: 'alice@trekgo.vn',
              role: UserRole.MEMBER,
              status: UserStatus.ACTIVE,
            };
          }
          if (where.authUserId === bobAuthId || where.id === bobId) {
            return {
              id: bobId,
              authUserId: bobAuthId,
              email: 'bob@trekgo.vn',
              role: UserRole.MEMBER,
              status: UserStatus.ACTIVE,
            };
          }
          return null;
        }),
      },
      trip: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === tripId) {
            return {
              id: tripId,
              startAt: new Date(Date.now() + 86400000 * 5),
              endAt: new Date(Date.now() + 86400000 * 7),
              status: 'UPCOMING',
            };
          }
          return null;
        }),
      },
      rentalCategory: {
        findUnique: jest.fn(async ({ where }: any) => {
          return rentalCategories.find((c) => c.slug === where.slug) ?? null;
        }),
      },
      rentalProduct: {
        findMany: jest.fn(async ({ where }: any) => {
          return rentalProducts.filter(
            (p) => p.categoryId === where.categoryId && p.status === where.status,
          );
        }),
      },
      equipmentUnit: {
        count: jest.fn(async () => 5), // 5 units available per product
        findMany: jest.fn(async () => [
          {
            id: 'unit-1',
            status: 'AVAILABLE',
            currentInventoryLocationId: 'loc-1',
            homeInventoryLocationId: 'loc-1',
            readinessCommitmentsViaUnitId: [],
            returnInspectionTasks: [],
          },
          {
            id: 'unit-2',
            status: 'AVAILABLE',
            currentInventoryLocationId: 'loc-1',
            homeInventoryLocationId: 'loc-1',
            readinessCommitmentsViaUnitId: [],
            returnInspectionTasks: [],
          },
        ]),
      },
      rentalQuantityReservation: {
        count: jest.fn(async () => 0), // 0 reservations
        aggregate: jest.fn(async () => ({ _sum: { quantity: 0 } })),
        findMany: jest.fn(async () => []),
      },
      gearPlanOptionSet: {
        create: jest.fn(async ({ data }: any) => {
          const id = randomUUID();
          const record = { id, ...data, createdAt: new Date() };
          optionSets.set(id, record);
          return record;
        }),
        findUnique: jest.fn(async ({ where }: any) => {
          return optionSets.get(where.id) ?? null;
        }),
      },
      gearAdviceRun: {
        create: jest.fn(async ({ data }: any) => {
          const id = randomUUID();
          const record = { id, ...data, createdAt: new Date() };
          adviceRuns.set(id, record);
          return record;
        }),
      },
      rentalQuote: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === validQuoteId) {
            return {
              id: validQuoteId,
              userId: aliceId,
              tripId: tripId,
              status: 'CONFIRMED',
              expiresAt: new Date(Date.now() + 3600000),
            };
          }
          if (where.id === mismatchedTripQuoteId) {
            return {
              id: mismatchedTripQuoteId,
              userId: aliceId,
              tripId: randomUUID(), // Mismatched trip!
              status: 'CONFIRMED',
              expiresAt: new Date(Date.now() + 3600000),
            };
          }
          if (where.id === expiredQuoteId) {
            return {
              id: expiredQuoteId,
              userId: aliceId,
              tripId: tripId,
              status: 'EXPIRED',
              expiresAt: new Date(Date.now() - 3600000),
            };
          }
          if (where.id === foreignQuoteId) {
            return {
              id: foreignQuoteId,
              userId: bobId,
              tripId: tripId,
              status: 'CONFIRMED',
              expiresAt: new Date(Date.now() + 3600000),
            };
          }
          return null;
        }),
      },
      gearQuoteLink: {
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const key = `${create.planRevisionId}_${create.quoteId}`;
          const existing = quoteLinks.get(key);
          if (existing) {
            existing.verifiedAt = update.verifiedAt;
            return existing;
          }
          const record = { id: randomUUID(), ...create, createdAt: new Date() };
          quoteLinks.set(key, record);
          return record;
        }),
      },
      gearPlanRevision: {
        findUnique: jest.fn(async ({ where }: any) => {
          for (const revs of planRevisions.values()) {
            const found = revs.find((r) => r.id === where.id);
            if (found) {
              const plan = plans.get(found.planId);
              return { ...found, plan };
            }
          }
          return null;
        }),
      },
      gearPlan: {
        findFirst: jest.fn(async ({ where }: any) => {
          const plan = plans.get(where.id);
          if (!plan) return null;
          if (where.userId && plan.userId !== where.userId) return null;
          if (where.inputRevision !== undefined && plan.inputRevision !== where.inputRevision) return null;
          if (where.evaluatedRevision !== undefined && plan.evaluatedRevision !== where.evaluatedRevision) return null;
          return { ...plan };
        }),
      },
      $transaction: jest.fn(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    // 7. Mock QuoteLinkRepo
    const mockQuoteLinkRepo = {
      linkQuote: jest.fn(async (planRevisionId: string, quoteId: string, userId: string) => {
        const quote = await mockPrisma.rentalQuote.findUnique({ where: { id: quoteId } });
        if (!quote) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_FOUND, {
            message: 'Báo giá không tồn tại',
          });
        }
        if (quote.userId !== userId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_OWNED, {
            message: 'Báo giá không thuộc sở hữu của bạn',
          });
        }
        if (quote.status === 'EXPIRED' || quote.expiresAt < new Date()) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE, {
            message: 'Báo giá đã hết hạn',
          });
        }
        const rev = await mockPrisma.gearPlanRevision.findUnique({ where: { id: planRevisionId } });
        if (rev && rev.plan && quote.tripId && rev.plan.tripId && quote.tripId !== rev.plan.tripId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE, {
            message: 'Báo giá thuộc chuyến đi khác với kế hoạch trang bị',
          });
        }
        return {
          id: randomUUID(),
          planRevisionId,
          quoteId,
          userId,
          verifiedAt: new Date(),
          createdAt: new Date(),
        };
      }),
    };

    // 8. Mock SupabaseService
    const mockSupabase = {
      verifyToken: jest.fn(async (token: string) => {
        if (token === 'alice-valid-token') return { id: aliceAuthId, email: 'alice@trekgo.vn' };
        if (token === 'bob-valid-token') return { id: bobAuthId, email: 'bob@trekgo.vn' };
        return null;
      }),
    };

    // 9. Mock AI Port (returns rule fallback when not configured)
    mockAiPort = {
      extractGear: jest.fn(),
      generateAdvice: jest.fn(async (req: any) => {
        const candidateRefs = (req.options?.[0]?.rentalLines || []).map(
          (l: any) => `${l.productId}:${l.productName}`,
        );
        return {
          source: 'AI',
          narrativeVi: `Cố vấn Gemini: Chuyến đi 2 ngày tại Bidoup Núi Bà. Chúng tôi đề xuất phương án tối ưu an toàn.`,
          factRefs: ['trip.days:2', 'trip.difficulty:3'],
          actionRefs: ['RENT:jacket', 'PREPARE:footwear'],
          candidateRefs,
          disclaimerVi: 'Khuyến nghị an toàn mang tính chất tham khảo.',
        };
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GearPlanController],
      providers: [
        GearPlanService,
        { provide: GEAR_PLAN_REPOSITORY_PORT, useValue: mockPlanRepo },
        { provide: GEAR_PLAN_REVISION_REPOSITORY_PORT, useValue: mockPlanRevRepo },
        { provide: USER_GEAR_REPOSITORY_PORT, useValue: mockUserGearRepo },
        { provide: TRIP_CONTEXT_READ_PORT, useValue: mockTripPort },
        { provide: GEAR_RULE_REPOSITORY_PORT, useValue: mockRuleService },
        { provide: GEAR_QUOTE_LINK_REPOSITORY_PORT, useValue: mockQuoteLinkRepo },
        { provide: GEAR_AI_PORT, useValue: mockAiPort },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: APP_GUARD, useClass: AuthenticationGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        AccessTokenGuard,
        ApiKeyGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // Setup plan and items
  let testPlanId: string;
  let ownedJacketId: string;

  beforeEach(async () => {
    // Add Alice's owned jacket
    ownedJacketId = randomUUID();
    userGearItems.set(ownedJacketId, {
      id: ownedJacketId,
      userId: aliceId,
      name: 'Alice Owned Jacket',
      category: 'JACKET',
      brand: 'Decathlon',
      condition: 'GOOD',
      attributes: { waterproof_mm: 12000, temp_rating_c: -2, windproof: true, weight_g: 500 },
      photoRef: null,
      source: 'MANUAL',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create a plan for Alice
    const res = await request(app.getHttpServer())
      .post('/api/v1/gear/plans')
      .set('Authorization', aliceToken)
      .send({
        title: 'Bidoup Expedition',
        contextMode: 'TRIP',
        tripId,
        selectedItemIds: [ownedJacketId],
      });
    testPlanId = res.body.id;
  });

  describe('Phase 10 & 11: Deterministic Planner (/api/v1/gear/plans/:id/options)', () => {
    it('rejects un-evaluated plan with 400 GEAR_PLAN_NOT_EVALUATED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/options`)
        .set('Authorization', aliceToken)
        .send({ expectedRevision: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_PLAN_NOT_EVALUATED);
    });

    it('rejects request from non-owner with 404 GEAR_PLAN_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/options`)
        .set('Authorization', bobToken)
        .send({ expectedRevision: 1 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND);
    });

    it('successfully generates MIN_RENTAL_FEE and MIN_KNOWN_TOTAL_WEIGHT options after evaluation', async () => {
      // 1. Evaluate plan first
      const evalRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          confirmedClimate: {
            temp_min_c: 12,
            temp_max_c: 24,
            temp_min_night_c: 8,
            rain_prob_pct: 60,
          },
        });
      expect(evalRes.status).toBe(200);

      // 2. Generate options
      const optRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/options`)
        .set('Authorization', aliceToken)
        .send({
          expectedRevision: 1,
          objective: 'MIN_RENTAL_FEE',
        });

      expect(optRes.status).toBe(200);
      const data = optRes.body;
      expect(data.setId).toBeDefined();
      expect(data.revision).toBe(1);
      expect(data.options).toHaveLength(2);

      const minFeeOption = data.options.find((o: any) => o.id === 'opt_min_fee');
      const minWeightOption = data.options.find((o: any) => o.id === 'opt_min_weight');

      expect(minFeeOption).toBeDefined();
      expect(minWeightOption).toBeDefined();

      // Check that owned suitable jacket was retained in ownedAssignments with 0 rental fee
      expect(minFeeOption.ownedAssignments.some((a: any) => a.category === 'JACKET')).toBe(true);

      // Check that missing/unsuitable items (like FOOTWEAR) were filled by rental lines
      expect(minFeeOption.rentalLines.some((l: any) => l.category === 'FOOTWEAR')).toBe(true);

      // Verify pricing: 2 days of rental
      const footwearLine = minFeeOption.rentalLines.find((l: any) => l.category === 'FOOTWEAR');
      expect(footwearLine.dailyPrice).toBe(80000);
      expect(footwearLine.rentalFee).toBe(160000); // 80k * 2 days
      expect(footwearLine.deposit).toBe(300000);

      // BACKPACK has no rental candidates in mock catalog -> listed in missingRequirements
      expect(minFeeOption.summary.missingRequirements).toContain('req_backpack');

      // Verify optionRef returned
      expect(data.optionRef).toEqual({
        setId: data.setId,
        optionId: 'opt_min_fee',
      });
    });

    it('enforces budgetLimit=0 returning incomplete option and BOUNDED_RECOMMENDATION status', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          confirmedClimate: {
            temp_min_c: 12,
            temp_max_c: 24,
            temp_min_night_c: 8,
            rain_prob_pct: 60,
          },
        });

      const optRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/options`)
        .set('Authorization', aliceToken)
        .send({
          expectedRevision: 1,
          budgetLimit: 0,
        });

      expect(optRes.status).toBe(200);
      const minFeeOption = optRes.body.options.find((o: any) => o.id === 'opt_min_fee');
      expect(minFeeOption.summary.isComplete).toBe(false);
      expect(minFeeOption.summary.searchStatus).toBe('BOUNDED_RECOMMENDATION');
    });

    it('rejects option generation when trip is ended with 400 GEAR_TRIP_NOT_ELIGIBLE', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          confirmedClimate: {
            temp_min_c: 12,
            temp_max_c: 24,
            temp_min_night_c: 8,
            rain_prob_pct: 60,
          },
        });

      // Temporarily mock trip as COMPLETED
      const origFindUnique = mockPrisma.trip.findUnique;
      mockPrisma.trip.findUnique = jest.fn(async () => ({
        id: tripId,
        status: 'COMPLETED',
        endAt: new Date(Date.now() - 86400000),
      }));

      try {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/gear/plans/${testPlanId}/options`)
          .set('Authorization', aliceToken)
          .send({ expectedRevision: 1 });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE);
      } finally {
        mockPrisma.trip.findUnique = origFindUnique;
      }
    });

    it('rejects option generation when plan is stale with 409 GEAR_PLAN_STALE', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          confirmedClimate: {
            temp_min_c: 12,
            temp_max_c: 24,
            temp_min_night_c: 8,
            rain_prob_pct: 60,
          },
        });

      // Modify plan input after evaluation
      await request(app.getHttpServer())
        .patch(`/api/v1/gear/plans/${testPlanId}`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          title: 'Modified Title',
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/options`)
        .set('Authorization', aliceToken)
        .send({ expectedRevision: 1 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_PLAN_STALE);
    });
  });

  describe('Phase 12: Gemini Advisor on Approved Facts (/api/v1/gear/plans/:id/advice)', () => {
    it('generates structured advice referencing verified facts and chosen option', async () => {
      // 1. Evaluate plan
      await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          confirmedClimate: {
            temp_min_c: 12,
            temp_max_c: 24,
            temp_min_night_c: 8,
            rain_prob_pct: 60,
          },
        });

      // 2. Generate options
      const optRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/options`)
        .set('Authorization', aliceToken)
        .send({ expectedRevision: 1 });

      const optionRef = optRes.body.optionRef;

      // 3. Request advice
      const adviceRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/advice`)
        .set('Authorization', aliceToken)
        .send({
          expectedRevision: 1,
          optionRef,
        });

      expect(adviceRes.status).toBe(200);
      const advice = adviceRes.body;
      expect(advice.id).toBeDefined();
      expect(advice.narrativeVi).toBeDefined();
      expect(advice.factRefs).toBeDefined();
      expect(advice.actionRefs).toBeDefined();
      expect(advice.disclaimerVi).toBeDefined();
      expect(advice.source).toBe('AI');
    });

    it('rejects invalid or non-existent option set with 404 GEAR_OPTION_SET_NOT_FOUND', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          confirmedClimate: {
            temp_min_c: 12,
            temp_max_c: 24,
            temp_min_night_c: 8,
            rain_prob_pct: 60,
          },
        });

      const adviceRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/advice`)
        .set('Authorization', aliceToken)
        .send({
          expectedRevision: 1,
          optionRef: {
            setId: randomUUID(),
            optionId: 'opt_min_fee',
          },
        });

      expect(adviceRes.status).toBe(404);
      expect(adviceRes.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_OPTION_SET_NOT_FOUND);
    });

    it('falls back to RULE_FALLBACK when AI claims absolute safety despite missing items', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          confirmedClimate: {
            temp_min_c: 12,
            temp_max_c: 24,
            temp_min_night_c: 8,
            rain_prob_pct: 60,
          },
        });

      const optRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/options`)
        .set('Authorization', aliceToken)
        .send({ expectedRevision: 1 });

      // Mock AI generating contradictory claim of 100% safety despite missing items
      const origGenerate = mockAiPort.generateAdvice;
      mockAiPort.generateAdvice = jest.fn(async () => ({
        source: 'AI',
        narrativeVi: 'Bạn an toàn tuyệt đối 100% và không cần bổ sung bất kỳ thứ gì.',
        factRefs: ['trip.days:2'],
        candidateRefs: optRes.body.options[0].rentalLines.map((l: any) => `${l.productId}:${l.productName}`),
      }));

      try {
        const adviceRes = await request(app.getHttpServer())
          .post(`/api/v1/gear/plans/${testPlanId}/advice`)
          .set('Authorization', aliceToken)
          .send({
            expectedRevision: 1,
            optionRef: optRes.body.optionRef,
          });

        expect(adviceRes.status).toBe(200);
        expect(adviceRes.body.source).toBe('RULE_FALLBACK');
      } finally {
        mockAiPort.generateAdvice = origGenerate;
      }
    });
  });

  describe('Phase 13: Quote Intent & Link to Rental (/api/v1/gear/plans/:id)', () => {
    let optionRef: any;

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/evaluate`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          confirmedClimate: {
            temp_min_c: 12,
            temp_max_c: 24,
            temp_min_night_c: 8,
            rain_prob_pct: 60,
          },
        });

      const optRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/options`)
        .set('Authorization', aliceToken)
        .send({ expectedRevision: 1 });

      optionRef = optRes.body.optionRef;
    });

    it('creates quote intent with rental lines without creating order or charging payment', async () => {
      const intentRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/quote-intents`)
        .set('Authorization', aliceToken)
        .send({
          expectedRevision: 1,
          optionRef,
        });

      expect(intentRes.status).toBe(200);
      const data = intentRes.body;
      expect(data.planId).toBe(testPlanId);
      expect(data.planRevision).toBe(1);
      expect(data.tripId).toBe(tripId);
      expect(data.lines.length).toBeGreaterThan(0);
      expect(data.prefillRentalQuote).toBeDefined();
      expect(data.prefillRentalQuote.tripId).toBe(tripId);
      expect(data.prefillRentalQuote.items).toHaveLength(data.lines.length);
    });

    it('links valid confirmed quote to plan revision idempotently', async () => {
      const linkRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/quote-links`)
        .set('Authorization', aliceToken)
        .send({
          expectedRevision: 1,
          quoteId: validQuoteId,
        });

      expect(linkRes.status).toBe(200);
      expect(linkRes.body.linked).toBe(true);
      expect(linkRes.body.quoteId).toBe(validQuoteId);
      expect(linkRes.body.planRevision).toBe(1);
    });

    it('rejects linking foreign quote with 403 GEAR_QUOTE_NOT_OWNED', async () => {
      const linkRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/quote-links`)
        .set('Authorization', aliceToken)
        .send({
          expectedRevision: 1,
          quoteId: foreignQuoteId,
        });

      expect(linkRes.status).toBe(403);
      expect(linkRes.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_OWNED);
    });

    it('rejects linking expired quote with 400 GEAR_QUOTE_NOT_ELIGIBLE', async () => {
      const linkRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/quote-links`)
        .set('Authorization', aliceToken)
        .send({
          expectedRevision: 1,
          quoteId: expiredQuoteId,
        });

      expect(linkRes.status).toBe(400);
      expect(linkRes.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE);
    });

    it('rejects linking quote from different trip with 400 GEAR_QUOTE_NOT_ELIGIBLE', async () => {
      const linkRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/quote-links`)
        .set('Authorization', aliceToken)
        .send({
          expectedRevision: 1,
          quoteId: mismatchedTripQuoteId,
        });

      expect(linkRes.status).toBe(400);
      expect(linkRes.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE);
    });

    it('rejects quote intent creation when plan is stale with 409 GEAR_PLAN_STALE', async () => {
      // Modify plan input
      await request(app.getHttpServer())
        .patch(`/api/v1/gear/plans/${testPlanId}`)
        .set('Authorization', aliceToken)
        .send({
          expectedInputRevision: 1,
          title: 'Changed title again',
        })
        .expect(200);

      const intentRes = await request(app.getHttpServer())
        .post(`/api/v1/gear/plans/${testPlanId}/quote-intents`)
        .set('Authorization', aliceToken)
        .send({
          expectedRevision: 1,
          optionRef,
        });

      expect(intentRes.status).toBe(409);
      expect(intentRes.body.error.code).toBe(GEAR_ERROR_CODES.GEAR_PLAN_STALE);
    });
  });
});