import { ExecutionContext, ForbiddenException, INestApplication, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { RentalDayCountMode, UserRole } from '@prisma/client';
import { REQUEST_USER_KEY } from 'src/shared/constants/auth.constant';
import { GlobalErrorFilter } from 'src/shared/errors';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_ERROR_CODES } from 'src/shared/errors/codes/rental.error-codes';
import { AccessTokenGuard } from 'src/shared/guards/access-token.guard';
import { ApiKeyGuard } from 'src/shared/guards/api-key.guard';
import { AuthenticationGuard } from 'src/shared/guards/authentication.guard';
import { RolesGuard } from 'src/shared/guards/roles.guard';
import { PrismaService } from 'src/shared/services/prisma.service';
import { RedisService } from 'src/shared/redis/redis.service';
import { SupabaseService } from 'src/shared/services/supabase.service';
import { CatalogModule } from '../../catalog.module';
import { RentalPolicyAdminController } from '../../presentation/controllers/rental-policy-admin.controller';
import { PublishRentalPolicySchema } from '../../presentation/dtos/rental-policy-admin.dto';
import { RentalPolicyAdminService } from './rental-policy-admin.service';

describe('RB-API-703/704 Rental policy admin (pure mock)', () => {
  const now = new Date('2026-10-20T08:00:00Z');
  const base = {
    id: 'policy-1', policyCode: 'DEFAULT', versionNo: 1, currency: 'VND',
    dayCountMode: RentalDayCountMode.CEIL_24H, quoteTtlMinutes: 10,
    paymentHoldMinutes: 15, freeCancellationHours: 24,
    cutoffHoursBeforeTrip: 24, prepBufferMinutes: 0, returnBufferMinutes: 1440,
    cleaningBufferMinutes: 1440, deepInspectionBufferMinutes: 2880,
    pickupCodeTtlMinutes: 15, pickupVerificationTtlMinutes: 10,
    overdueReviewMinutes: 120, deepInspectionReviewMinutes: 2880,
    adminApprovalMinutes: 1440, userAssessmentReviewMinutes: 2880,
    lostConfirmationMinutes: 4320, maxRentalAfterTripHours: 72,
    extensionRequestCutoffMinutes: 120, extensionHoldMinutes: 15,
    maxExtensionCount: 2, maxTotalRentalDays: 14,
    returnInspectionSlaHours: 72, deepInspectionSlaHours: 24,
    returnToInventoryAllowanceHours: 8, postInspectionCleaningAllowanceHours: 8,
    cancellationRules: [], effectiveFrom: new Date('2020-01-01T00:00:00Z'),
    effectiveTo: null, isActive: true, createdBy: null,
    createdAt: new Date('2020-01-01T00:00:00Z'),
  };
  const { id, policyCode, versionNo, effectiveFrom, effectiveTo, isActive, createdBy, createdAt,
    ...values } = base;
  const input = PublishRentalPolicySchema.parse({
    expectedVersion: 1, reason: 'Áp dụng cửa sổ chuẩn bị 12 giờ',
    policy: { ...values, prepBufferMinutes: 720, maxRentalAfterTripHours: 48 },
  });

  function fixture() {
    let active = { ...base };
    const tx = {
      $queryRaw: jest.fn(async (parts: TemplateStringsArray) =>
        parts[0].includes('clock_timestamp') ? [{ now }] : []),
      rentalPolicy: {
        findMany: jest.fn(async () => [active]),
        updateMany: jest.fn(async () => ({ count: 1 })),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          active = { ...base, ...data, id: 'policy-2', createdAt: now };
          return active;
        }),
      },
      auditLog: { create: jest.fn() },
    };
    const db = { rentalPolicy: tx.rentalPolicy,
      $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
    return { tx, service: new RentalPolicyAdminService(db as never) };
  }

  it('đọc policy active và version hiện hành', async () => {
    const { service } = fixture();
    await expect(service.getCurrent(now)).resolves.toMatchObject({
      id: 'policy-1', version: 1, policyVersion: '1.5.2',
      rentalCutoffHours: 24, policy: { prepBufferMinutes: 0 },
    });
  });

  it('xuất bản version mới, đóng version cũ và audit trong cùng transaction', async () => {
    const { tx, service } = fixture();
    expect(PublishRentalPolicySchema.safeParse(input).success).toBe(true);
    const result = await service.publish(input, 'admin-1', 'request-1');
    expect(result).toMatchObject({ version: 2, policyVersion: '1.5.2',
      policy: { prepBufferMinutes: 720 } });
    expect(tx.rentalPolicy.updateMany).toHaveBeenCalledWith({
      where: { id: 'policy-1', isActive: true, versionNo: 1 },
      data: { isActive: false, effectiveTo: now },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'admin-1', action: 'RENTAL_POLICY_VERSION_PUBLISHED',
      requestId: 'request-1', newValues: expect.objectContaining({ reason: input.reason, version: 2 }),
    }) });
    expect(await service.getCurrent(now)).toMatchObject({ version: 2 });
  });

  it('retry hoặc expectedVersion cũ không tạo thêm version', async () => {
    const { tx, service } = fixture();
    await service.publish(input, 'admin-1');
    await expect(service.publish(input, 'admin-1')).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(tx.rentalPolicy.create).toHaveBeenCalledTimes(1);
  });

  it('chặn buffer sai và thay đổi quy tắc hoàn tiền chưa có contract', async () => {
    expect(PublishRentalPolicySchema.safeParse({ ...input,
      policy: { ...input.policy, prepBufferMinutes: 0 } }).success).toBe(false);
    expect(PublishRentalPolicySchema.safeParse({ ...input,
      policy: { ...input.policy, maxRentalAfterTripHours: 72 } }).success).toBe(false);
    const { tx, service } = fixture();
    await expect(service.publish({ ...input,
      policy: { ...input.policy, cancellationRules: [{ feePercent: 0 }] } }, 'admin-1'))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(tx.rentalPolicy.updateMany).not.toHaveBeenCalled();
  });

  it('không coi thứ tự key JSON của cancellationRules là thay đổi quy tắc tiền', async () => {
    const { tx, service } = fixture();
    tx.rentalPolicy.findMany.mockResolvedValue([{
      ...base, cancellationRules: { rentalFee: 100, deposit: 100 },
    }] as never);
    await expect(service.publish({ ...input, policy: { ...input.policy,
      cancellationRules: { deposit: 100, rentalFee: 100 },
    } }, 'admin-1')).resolves.toMatchObject({ version: 2 });
    expect(tx.rentalPolicy.create).toHaveBeenCalledTimes(1);
  });

  it('RolesGuard thật từ chối USER và STAFF; chỉ ADMIN qua metadata controller', () => {
    const guard = new RolesGuard(new Reflector());
    const context = (role: UserRole) => ({
      getHandler: () => RentalPolicyAdminController.prototype.publish,
      getClass: () => RentalPolicyAdminController,
      switchToHttp: () => ({ getRequest: () => ({ [REQUEST_USER_KEY]: { id: 'actor-1', role } }) }),
    }) as unknown as ExecutionContext;
    expect(() => guard.canActivate(context(UserRole.USER))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context(UserRole.STAFF_INVENTORY))).toThrow(ForbiddenException);
    expect(guard.canActivate(context(UserRole.ADMIN))).toBe(true);
  });

  it('CatalogModule đăng ký DI và OpenAPI đúng hai route baseline', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [CatalogModule] })
      .overrideProvider(PrismaService).useValue({})
      .overrideProvider(SupabaseService).useValue({})
      .overrideProvider(RedisService).useValue({})
      .compile();
    const app = moduleRef.createNestApplication();
    try {
      app.setGlobalPrefix('api/v1');
      expect(moduleRef.get(RentalPolicyAdminService)).toBeInstanceOf(RentalPolicyAdminService);
      expect(moduleRef.get(RentalPolicyAdminController)).toBeInstanceOf(RentalPolicyAdminController);
      const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
      expect(document.paths['/api/v1/admin/rental-policy']).toHaveProperty('get');
      expect(document.paths['/api/v1/admin/rental-policy']).toHaveProperty('put');
      expect(document.paths['/api/v1/admin/rental-policy'].get?.responses?.['200']?.content?.['application/json']?.schema)
        .toMatchObject({ properties: { data: { properties: { policyVersion: { example: '1.5.2' } } } } });
    } finally {
      await app.close();
    }
  });

  describe('HTTP contract với guards và GlobalErrorFilter (không kết nối DB)', () => {
    let app: INestApplication;
    const service = { getCurrent: jest.fn(), publish: jest.fn() };

    beforeAll(async () => {
      // Bearer giả lập chỉ cấp danh tính trong HTTP test; RolesGuard và pipe vẫn chạy thật.
      const bearer = { canActivate: jest.fn((context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest();
        const token = req.headers.authorization;
        if (token !== 'Bearer admin' && token !== 'Bearer user')
          throw new UnauthorizedException();
        req[REQUEST_USER_KEY] = {
          id: '11111111-1111-4111-8111-111111111111',
          role: token === 'Bearer admin' ? UserRole.ADMIN : UserRole.USER,
        };
        return true;
      }) };
      const moduleRef = await Test.createTestingModule({
        controllers: [RentalPolicyAdminController],
        providers: [
          { provide: RentalPolicyAdminService, useValue: service },
          { provide: AccessTokenGuard, useValue: bearer },
          { provide: ApiKeyGuard, useValue: { canActivate: () => false } },
          { provide: APP_GUARD, useClass: AuthenticationGuard },
          { provide: APP_GUARD, useClass: RolesGuard },
        ],
      }).compile();
      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalFilters(new GlobalErrorFilter());
      await app.init();
    });

    afterEach(() => jest.clearAllMocks());
    afterAll(async () => { await app.close(); });

    it('chặn request thiếu Bearer và USER, cho ADMIN đọc policy', async () => {
      service.getCurrent.mockResolvedValue({ id: 'policy-1', version: 1, policyVersion: '1.5.2' });
      const url = '/api/v1/admin/rental-policy';
      const unauthenticated = await request(app.getHttpServer()).get(url).expect(401);
      expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');
      const forbidden = await request(app.getHttpServer()).get(url)
        .set('Authorization', 'Bearer user').expect(403);
      expect(forbidden.body.error.code).toBe('FORBIDDEN');
      const success = await request(app.getHttpServer()).get(url)
        .set('Authorization', 'Bearer admin').expect(200);
      expect(success.body).toEqual({ data: { id: 'policy-1', version: 1, policyVersion: '1.5.2' } });
      expect(service.getCurrent).toHaveBeenCalledTimes(1);
    });

    it('PUT từ chối DTO sai trước khi gọi service', async () => {
      const response = await request(app.getHttpServer()).put('/api/v1/admin/rental-policy')
        .set('Authorization', 'Bearer admin')
        .send({ ...input, unexpectedField: true }).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(service.publish).not.toHaveBeenCalled();
    });

    it('PUT chuyển VERSION_CONFLICT thành HTTP 409 và truyền actor/requestId đúng', async () => {
      const url = '/api/v1/admin/rental-policy';
      service.publish.mockRejectedValueOnce(AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT));
      const conflict = await request(app.getHttpServer()).put(url)
        .set('Authorization', 'Bearer admin').set('x-request-id', 'policy-http-test')
        .send(input).expect(409);
      expect(conflict.body.error.code).toBe('VERSION_CONFLICT');
      expect(conflict.body.meta.requestId).toBe('policy-http-test');

      service.publish.mockResolvedValueOnce({ id: 'policy-2', version: 2, policyVersion: '1.5.2' });
      const success = await request(app.getHttpServer()).put(url)
        .set('Authorization', 'Bearer admin').set('x-request-id', 'policy-http-test')
        .send(input).expect(200);
      expect(success.body).toEqual({ data: { id: 'policy-2', version: 2, policyVersion: '1.5.2' } });
      expect(service.publish).toHaveBeenLastCalledWith(input,
        '11111111-1111-4111-8111-111111111111', 'policy-http-test');
    });
  });
});
