import { UserGearService } from '../src/modules/gear/application/services/user-gear.service';
import { GearCheckService } from '../src/modules/gear/application/services/gear-check.service';
import { GearRuleService } from '../src/modules/gear/application/services/gear-rule.service';
import { StaffProductProfileService } from '../src/modules/gear/application/services/staff-product-profile.service';
import { UserGearRepositoryPort } from '../src/modules/gear/application/ports/user-gear.repository.port';
import { ProductTechnicalProfileRepositoryPort } from '../src/modules/gear/application/ports/product-technical-profile.repository.port';
import { AppError } from '../src/shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../src/shared/errors/codes/gear.error-codes';
import { UserGearItemDomain, ProductTechnicalProfileDomain } from '../src/modules/gear/domain/gear.types';
import { PrismaGearExtractionDraftRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-extraction-draft.repository';
import { findSimilarItems } from '../src/modules/gear/domain/duplicate-detector';

describe('Gear Advisor V3.1.5 — Phase 04 Services & Operations (CRUD, Hard Delete, Core Check, Staff Profiles)', () => {
  // In-memory mock repository for UserGear
  class MockUserGearRepository implements UserGearRepositoryPort {
    public items: Map<string, UserGearItemDomain> = new Map();
    public photos: Map<string, any[]> = new Map();

    async findByIdAndUser(id: string, userId: string): Promise<UserGearItemDomain | null> {
      const item = this.items.get(id);
      if (item && item.userId === userId) {
        return { ...item };
      }
      return null;
    }

    async findByIdsAndUser(ids: string[], userId: string): Promise<UserGearItemDomain[]> {
      return Array.from(this.items.values())
        .filter((it) => it.userId === userId && ids.includes(it.id))
        .map((it) => ({ ...it }));
    }

    async findAllByUser(userId: string, category?: any): Promise<UserGearItemDomain[]> {
      return Array.from(this.items.values())
        .filter((it) => it.userId === userId && (!category || it.category === category))
        .map((it) => ({ ...it }));
    }

    async countByUser(userId: string): Promise<number> {
      return Array.from(this.items.values()).filter((it) => it.userId === userId).length;
    }

    async create(item: any, photos?: any[]): Promise<UserGearItemDomain> {
      const userItems = Array.from(this.items.values()).filter((it) => it.userId === item.userId);
      if (userItems.length >= 50) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_LIMIT_EXCEEDED, {
          message: 'Tủ đồ đã đạt giới hạn tối đa 50 món',
        });
      }

      if (!item.acknowledgeDuplicate) {
        const candidates = userItems.filter((it) => it.category === item.category);
        const duplicateDetails = findSimilarItems(
          {
            category: item.category,
            condition: item.condition,
            attributes: item.attributes,
          },
          candidates,
        );
        if (duplicateDetails) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_POSSIBLE_DUPLICATE, {
            message: 'Phát hiện món đồ tương tự đã có trong tủ đồ',
            details: duplicateDetails as unknown as Record<string, unknown>,
          });
        }
      }

      const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const domain: UserGearItemDomain = {
        id,
        userId: item.userId,
        name: item.name,
        category: item.category,
        brand: item.brand ?? null,
        condition: item.condition,
        attributes: item.attributes ?? {},
        photoRef: item.photoRef ?? null,
        source: item.source ?? 'MANUAL',
        version: 1,
        photos: photos?.map((p, idx) => ({
          id: `photo-${idx}`,
          itemId: id,
          storageRef: p.storageRef,
          position: p.position,
          createdAt: new Date(),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.items.set(id, domain);
      return { ...domain };
    }

    async patch(id: string, userId: string, patch: any, expectedVersion?: number): Promise<UserGearItemDomain> {
      const existing = this.items.get(id);
      if (!existing || existing.userId !== userId) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, { message: 'Not found' });
      }

      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT, { message: 'CAS conflict' });
      }

      const updated: UserGearItemDomain = {
        ...existing,
        name: patch.name ?? existing.name,
        brand: patch.brand !== undefined ? patch.brand : existing.brand,
        condition: patch.condition ?? existing.condition,
        category: patch.category ?? existing.category,
        attributes: patch.category && patch.category !== existing.category
          ? { ...(patch.attributes ?? {}) }
          : { ...existing.attributes, ...(patch.attributes ?? {}) },
        photoRef: patch.photoRef !== undefined ? patch.photoRef : existing.photoRef,
        version: existing.version + 1,
        updatedAt: new Date(),
      };
      this.items.set(id, updated);
      return { ...updated };
    }

    async delete(id: string, userId: string): Promise<boolean> {
      const existing = this.items.get(id);
      if (!existing || existing.userId !== userId) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, { message: 'Not found' });
      }
      this.items.delete(id);
      this.photos.delete(id);
      return true;
    }

    async addPhoto(itemId: string, userId: string, storageRef: string, position?: number): Promise<any> {
      const existing = this.items.get(itemId);
      if (!existing || existing.userId !== userId) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, { message: 'Not found' });
      }
      const itemPhotos = this.photos.get(itemId) || [];
      if (itemPhotos.length >= 3) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, { message: 'Max 3 photos' });
      }
      const pos = position ?? itemPhotos.length;
      const photo = { id: `photo-${Date.now()}`, itemId, storageRef, position: pos, createdAt: new Date() };
      itemPhotos.push(photo);
      this.photos.set(itemId, itemPhotos);
      if (pos === 0) {
        existing.photoRef = storageRef;
      }
      return photo;
    }

    async deletePhoto(itemId: string, photoId: string, userId: string): Promise<boolean> {
      const existing = this.items.get(itemId);
      if (!existing || existing.userId !== userId) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, { message: 'Not found' });
      }
      let itemPhotos = this.photos.get(itemId) || [];
      itemPhotos = itemPhotos.filter((p) => p.id !== photoId);
      this.photos.set(itemId, itemPhotos);
      return true;
    }

    async reorderPhotos(itemId: string, userId: string, orders: any[]): Promise<any[]> {
      const existing = this.items.get(itemId);
      if (!existing || existing.userId !== userId) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, { message: 'Not found' });
      }
      return [];
    }
  }

  // =========================================================================
  // Section 1.1.H Hard Delete & 50-Item Limit Tests
  // =========================================================================
  describe('Section 1.1.H Hard Delete, Limits, and Replay', () => {
    let mockRepo: MockUserGearRepository;
    let service: UserGearService;

    beforeEach(() => {
      mockRepo = new MockUserGearRepository();
      service = new UserGearService(mockRepo);
    });

    it('H.a: deleting item completely removes it from list and detail returns 404', async () => {
      const item = await service.createItem('user-1', {
        name: 'My Rain Jacket',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 5000, temp_rating_c: 5 },
      });

      // Verify item exists
      const found = await service.getItem(item.id, 'user-1');
      expect(found.id).toBe(item.id);

      // Delete item
      await service.deleteItem(item.id, 'user-1');

      // Verify list is empty
      const list = await service.listItems('user-1');
      expect(list.length).toBe(0);

      // Verify detail returns 404
      await expect(service.getItem(item.id, 'user-1')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND }),
      );
    });

    it('H.b: deleting item frees up 50-item limit immediately', async () => {
      // Populate 50 items
      for (let i = 0; i < 50; i++) {
        mockRepo.items.set(`item-${i}`, {
          id: `item-${i}`,
          userId: 'user-full',
          name: `Item ${i}`,
          category: 'JACKET',
          brand: null,
          condition: 'GOOD',
          attributes: { waterproof_mm: 1000 + i },
          photoRef: null,
          source: 'MANUAL',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // 51st item should throw GEAR_ITEM_LIMIT_EXCEEDED (400)
      await expect(
        service.createItem('user-full', {
          name: 'Item 51',
          category: 'JACKET',
          condition: 'GOOD',
          attributes: { waterproof_mm: 9999 },
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_ITEM_LIMIT_EXCEEDED }),
      );

      // Delete 1 item
      await service.deleteItem('item-0', 'user-full');

      // Now create succeeds immediately
      const created = await service.createItem('user-full', {
        name: 'Item New After Delete',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 9999 },
      });
      expect(created.name).toBe('Item New After Delete');
    });

    it('H.c: recreating identical item after hard delete does NOT trigger duplicate warning', async () => {
      const original = await service.createItem('user-1', {
        name: 'Unique Jacket',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 10000, temp_rating_c: -5 },
      });

      // Attempting duplicate while original is active throws 409
      await expect(
        service.createItem('user-1', {
          name: 'Another Jacket',
          category: 'JACKET',
          condition: 'GOOD',
          attributes: { waterproof_mm: 10000, temp_rating_c: -5 },
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_ITEM_POSSIBLE_DUPLICATE }),
      );

      // Delete original item
      await service.deleteItem(original.id, 'user-1');

      // Recreating identical item now succeeds without warning
      const recreated = await service.createItem('user-1', {
        name: 'Another Jacket',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 10000, temp_rating_c: -5 },
      });
      expect(recreated.id).toBeDefined();
    });

    it('H.d: foreign delete throws 404 and does not affect data of another user', async () => {
      const itemUserA = await service.createItem('user-a', {
        name: 'User A Item',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 5000 },
      });

      // User B tries to delete User A's item -> throws 404
      await expect(service.deleteItem(itemUserA.id, 'user-b')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND }),
      );

      // Verify item still exists for User A
      const found = await service.getItem(itemUserA.id, 'user-a');
      expect(found.id).toBe(itemUserA.id);
    });

    it('H.e: draft extraction confirm replay after item hard delete returns 404 (does NOT recreate item)', async () => {
      const mockPrismaTx: any = {
        gearExtractionDraft: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'draft-deleted-item',
            ownerId: 'user-1',
            status: 'CONFIRMED',
            sourceType: 'IMAGE',
            confirmationPayloadHash: 'hash-matching',
            confirmedItemId: null, // item was deleted, onDelete: SetNull caused this to be null!
            expiresAt: new Date(Date.now() + 60000),
          }),
        },
        userGearItem: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      const mockPrisma: any = {
        $transaction: jest.fn(async (cb) => cb(mockPrismaTx)),
      };

      const draftRepo = new PrismaGearExtractionDraftRepository(mockPrisma);

      // Replay with matching hash should throw GEAR_ITEM_NOT_FOUND (404)
      await expect(
        draftRepo.confirmDraft(
          'draft-deleted-item',
          'user-1',
          'hash-matching',
          { name: 'Jacket', category: 'JACKET', condition: 'GOOD', attributes: {} },
        ),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND }),
      );

      // Replay with differing hash should throw GEAR_DRAFT_PAYLOAD_MISMATCH (409)
      await expect(
        draftRepo.confirmDraft(
          'draft-deleted-item',
          'user-1',
          'hash-different',
          { name: 'Jacket', category: 'JACKET', condition: 'GOOD', attributes: {} },
        ),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_DRAFT_PAYLOAD_MISMATCH }),
      );
    });
  });

  // =========================================================================
  // F06 Concurrent PATCH & CAS Tests
  // =========================================================================
  describe('F06 Concurrent PATCH Semantics', () => {
    let mockRepo: MockUserGearRepository;
    let service: UserGearService;

    beforeEach(() => {
      mockRepo = new MockUserGearRepository();
      service = new UserGearService(mockRepo);
    });

    it('F06.a: PATCH with explicit expectedVersion enforces strict CAS conflict (409)', async () => {
      const item = await service.createItem('user-1', {
        name: 'Initial Name',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 5000 },
      });
      expect(item.version).toBe(1);

      // Update with matching expectedVersion=1 -> succeeds, version becomes 2
      const updated = await service.patchItem(item.id, 'user-1', {
        name: 'Updated Name',
        expectedVersion: 1,
      });
      expect(updated.version).toBe(2);

      // Concurrent request sends stale expectedVersion=1 -> throws 409 GEAR_ITEM_VERSION_CONFLICT
      await expect(
        service.patchItem(item.id, 'user-1', {
          name: 'Stale Update',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT }),
      );
    });

    it('F06.b: PATCH category change drops old attributes and applies new category attributes', async () => {
      const item = await service.createItem('user-1', {
        name: 'Old Item',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 5000, temp_rating_c: 5, windproof: true },
      });

      // Change category to BACKPACK with new capacity_l attribute
      const updated = await service.patchItem(item.id, 'user-1', {
        category: 'BACKPACK',
        attributes: { capacity_l: 45 },
      });

      expect(updated.category).toBe('BACKPACK');
      expect(updated.attributes).toEqual({
        capacity_l: 45,
        weight_g: null,
        waterproof: null,
        rain_cover: null,
      });
      expect((updated.attributes as any).waterproof_mm).toBeUndefined();
    });
  });

  // =========================================================================
  // Core Check Service Tests (/api/v1/gear/check)
  // =========================================================================
  describe('Core Check Service (/api/v1/gear/check)', () => {
    let mockTripContextPort: any;
    let mockUserGearRepo: MockUserGearRepository;
    let gearCheckService: GearCheckService;

    beforeEach(() => {
      mockUserGearRepo = new MockUserGearRepository();
      mockTripContextPort = {
        getTripContext: jest.fn(),
      };
      gearCheckService = new GearCheckService(mockTripContextPort, mockUserGearRepo);
    });

    it('rejects with 404 GEAR_TRIP_NOT_FOUND when trip does not exist', async () => {
      mockTripContextPort.getTripContext.mockRejectedValue(
        AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_FOUND, { message: 'Not found' })
      );

      await expect(
        gearCheckService.checkGear('user-1', {
          tripId: '550e8400-e29b-41d4-a716-446655440000',
          itemIds: ['550e8400-e29b-41d4-a716-446655440001'],
          confirmedClimate: {
            temp_min_c: 8,
            temp_max_c: 16,
            temp_min_night_c: 9,
            rain_prob_pct: 85,
          },
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_TRIP_NOT_FOUND }),
      );
    });

    it('rejects with 400 GEAR_TRIP_NOT_ELIGIBLE when trip is CANCELLED', async () => {
      mockTripContextPort.getTripContext.mockRejectedValue(
        AppError.fromCode(GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE, { message: 'Ineligible' })
      );

      await expect(
        gearCheckService.checkGear('user-1', {
          tripId: '550e8400-e29b-41d4-a716-446655440000',
          itemIds: ['550e8400-e29b-41d4-a716-446655440001'],
          confirmedClimate: {
            temp_min_c: 8,
            temp_max_c: 16,
            temp_min_night_c: 9,
            rain_prob_pct: 85,
          },
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_TRIP_NOT_ELIGIBLE }),
      );
    });

    it('rejects with 403 GEAR_FORBIDDEN when user is not a member of trip', async () => {
      mockTripContextPort.getTripContext.mockRejectedValue(
        AppError.fromCode(GEAR_ERROR_CODES.GEAR_FORBIDDEN, { message: 'Forbidden' })
      );

      await expect(
        gearCheckService.checkGear('user-non-member', {
          tripId: '550e8400-e29b-41d4-a716-446655440000',
          itemIds: ['550e8400-e29b-41d4-a716-446655440001'],
          confirmedClimate: {
            temp_min_c: 8,
            temp_max_c: 16,
            temp_min_night_c: 9,
            rain_prob_pct: 85,
          },
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_FORBIDDEN }),
      );
    });

    it('rejects with 400 GEAR_CLIMATE_NOT_CONFIRMED when confirmedClimate is missing', async () => {
      await expect(
        gearCheckService.checkGear('user-1', {
          tripId: '550e8400-e29b-41d4-a716-446655440000',
          itemIds: ['550e8400-e29b-41d4-a716-446655440001'],
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_CLIMATE_NOT_CONFIRMED }),
      );
    });

    it('rejects with 400 GEAR_CATEGORY_REQUIRES_PLAN when extended category (e.g. TENT) is submitted', async () => {
      mockTripContextPort.getTripContext.mockResolvedValue({
        tripId: 'trip-1',
        status: 'OPEN',
        startAt: new Date('2026-11-01T00:00:00Z'),
        endAt: new Date('2026-11-03T00:00:00Z'),
        days: 2,
        difficulty: 3,
        terrain: ['mountain'],
      });

      mockUserGearRepo.items.set('item-tent-1', {
        id: 'item-tent-1',
        userId: 'user-1',
        name: 'Camp Tent',
        category: 'TENT', // Extended!
        condition: 'GOOD',
        attributes: { sleeping_places: 2 },
        source: 'MANUAL',
        version: 1,
        photos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        gearCheckService.checkGear('user-1', {
          tripId: '550e8400-e29b-41d4-a716-446655440000',
          itemIds: ['item-tent-1'],
          confirmedClimate: {
            temp_min_c: 8,
            temp_max_c: 16,
            temp_min_night_c: 9,
            rain_prob_pct: 85,
          },
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_CATEGORY_REQUIRES_PLAN }),
      );
    });

    it('evaluates core items deterministically when trip and confirmedClimate are valid', async () => {
      mockTripContextPort.getTripContext.mockResolvedValue({
        tripId: 'trip-1',
        status: 'OPEN',
        startAt: new Date('2026-11-01T00:00:00Z'),
        endAt: new Date('2026-11-03T00:00:00Z'),
        days: 2,
        difficulty: 3,
        terrain: ['mountain'],
      });

      mockUserGearRepo.items.set('item-j1', {
        id: 'item-j1',
        userId: 'user-1',
        name: 'Rain Jacket',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 8000, temp_rating_c: 5 },
        source: 'MANUAL',
        version: 1,
        photos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockUserGearRepo.items.set('item-f1', {
        id: 'item-f1',
        userId: 'user-1',
        name: 'Hiking Boots',
        category: 'FOOTWEAR',
        condition: 'GOOD',
        attributes: { waterproof: true, grip_level: 4, ankle_support: true },
        source: 'MANUAL',
        version: 1,
        photos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await gearCheckService.checkGear('user-1', {
        tripId: '550e8400-e29b-41d4-a716-446655440000',
        itemIds: ['item-j1', 'item-f1'],
        confirmedClimate: {
          temp_min_c: 8,
          temp_max_c: 16,
          temp_min_night_c: 9,
          rain_prob_pct: 85,
        },
      });

      expect(result.items.length).toBe(2);
      expect(result.items.find((i) => i.itemId === 'item-j1')?.verdict).toBe('SUITABLE');
      expect(result.items.find((i) => i.itemId === 'item-f1')?.verdict).toBe('SUITABLE');
    });
  });

  // =========================================================================
  // Staff Product Technical Profile Service Tests
  // =========================================================================
  describe('Staff Product Profile Service', () => {
    class MockProfileRepository implements ProductTechnicalProfileRepositoryPort {
      public profiles: Map<string, ProductTechnicalProfileDomain> = new Map();

      async findByProductId(productId: string): Promise<ProductTechnicalProfileDomain | null> {
        return this.profiles.get(productId) ?? null;
      }

      async upsertProfile(
        productId: string,
        category: any,
        attributes: any,
        expectedVersion?: number,
        schemaVersion: string = '3.1.5',
        sources?: any,
      ): Promise<ProductTechnicalProfileDomain> {
        const existing = this.profiles.get(productId);
        if (existing && expectedVersion !== undefined && existing.version !== expectedVersion) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PROFILE_VERSION_CONFLICT, {
            message: 'CAS conflict',
          });
        }
        const updated: ProductTechnicalProfileDomain = {
          id: existing ? existing.id : `prof-${Date.now()}`,
          productId,
          category,
          attributes,
          schemaVersion,
          sources,
          version: existing ? existing.version + 1 : 1,
          createdAt: existing ? existing.createdAt : new Date(),
          updatedAt: new Date(),
        };
        this.profiles.set(productId, updated);
        return { ...updated };
      }
    }

    let mockRepo: MockProfileRepository;
    let service: StaffProductProfileService;

    beforeEach(() => {
      mockRepo = new MockProfileRepository();
      service = new StaffProductProfileService(mockRepo);
    });

    it('upserts and retrieves product technical profile with version and schemaVersion round-trip', async () => {
      const created = await service.upsertProfile('prod-1', {
        category: 'JACKET',
        attributes: { waterproof_mm: 10000, temp_rating_c: -5 },
        schemaVersion: '3.1.5',
      });

      expect(created.productId).toBe('prod-1');
      expect(created.version).toBe(1);
      expect(created.schemaVersion).toBe('3.1.5');

      const found = await service.getProfile('prod-1');
      expect(found.attributes.waterproof_mm).toBe(10000);

      // CAS update with matching version
      const updated = await service.upsertProfile('prod-1', {
        category: 'JACKET',
        attributes: { waterproof_mm: 15000, temp_rating_c: -10 },
        expectedVersion: 1,
      });
      expect(updated.version).toBe(2);

      // CAS update with mismatched version -> throws 409
      await expect(
        service.upsertProfile('prod-1', {
          category: 'JACKET',
          attributes: { waterproof_mm: 20000 },
          expectedVersion: 1,
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_PROFILE_VERSION_CONFLICT }),
      );
    });
  });

  // =========================================================================
  // Requirement Rules Service Tests
  // =========================================================================
  describe('Requirement Rules Service (/api/v1/gear/requirement-rules)', () => {
    it('returns all 28 canonical rule metadata without omission', async () => {
      const service = new GearRuleService();
      const rules = await service.getRequirementRules();
      expect(rules.length).toBe(28);

      const ruleIds = rules.map((r) => r.id);
      for (let i = 1; i <= 28; i++) {
        const id = `R${String(i).padStart(2, '0')}`;
        expect(ruleIds).toContain(id);
      }

      // Check R24-R28 metadata specifics: GENERAL rules have nullable defaultVerdict
      const r24 = rules.find((r) => r.id === 'R24')!;
      expect(r24.defaultVerdict).toBeNull();

      const r25 = rules.find((r) => r.id === 'R25')!;
      expect(r25.defaultVerdict).toBeNull();
    });
  });
});
