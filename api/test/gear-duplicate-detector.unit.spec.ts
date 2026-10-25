import {
  checkItemSimilarity,
  findSimilarItems,
  DuplicateCheckItem,
} from '../src/modules/gear/domain/duplicate-detector';
import { validateAttributesForCategory } from '../src/modules/gear/application/dtos/user-gear.dto';

describe('Gear Advisor V3.1.5 — Section 1.1.G Duplicate Warning Heuristic (Table G5)', () => {
  // Test G5.1: Nhập tay tương tự món AI, tên/hãng/ảnh/nguồn khác
  it('G5.1: detects similarity between AI item and manual item despite different name, brand, photo, source', () => {
    const aiItem: DuplicateCheckItem = {
      id: 'item-ai-1',
      name: 'North Face GoreTex Pro',
      category: 'JACKET',
      condition: 'GOOD',
      attributes: {
        waterproof_mm: 5000,
        temp_rating_c: 5,
        weight_g: 500,
      },
    };

    const manualItem: DuplicateCheckItem = {
      name: 'Áo khoác gió nhập tay',
      category: 'JACKET',
      condition: 'good',
      attributes: {
        waterproof_mm: 5000,
        temp_rating_c: 5,
        weight_g: null, // missing one side
      },
    };

    const res = checkItemSimilarity(manualItem, aiItem);
    expect(res.similar).toBe(true);
    expect(res.matchedFields).toEqual(['waterproof_mm', 'temp_rating_c']);
  });

  // Test G5.2: Gửi lại cùng payload + true -> acknowledgeDuplicate cho phép tạo item mới
  it('G5.2: findSimilarItems identifies existing match; acknowledgment bypasses warning at service level', () => {
    const existing: DuplicateCheckItem = {
      id: 'existing-1',
      name: 'Old Jacket',
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, temp_rating_c: 5 },
      createdAt: new Date('2026-10-20T10:00:00Z'),
    };

    const candidate: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, temp_rating_c: 5 },
    };

    const warning = findSimilarItems(candidate, [existing]);
    expect(warning).not.toBeNull();
    expect(warning?.similarCount).toBe(1);
    expect(warning?.similarItem.id).toBe('existing-1');
    expect(warning?.matchedFields).toEqual(['waterproof_mm', 'temp_rating_c']);
  });

  // Test G5.3: Một field chung bằng nhau, còn lại thiếu một bên -> Cảnh báo
  it('G5.3: one common known field equals, other fields missing on one side -> triggers warning', () => {
    const itemA: DuplicateCheckItem = {
      category: 'BACKPACK',
      condition: 'GOOD',
      attributes: { capacity_l: 35, rain_cover: null, weight_g: 1000 },
    };
    const itemB: DuplicateCheckItem = {
      category: 'BACKPACK',
      condition: 'GOOD',
      attributes: { capacity_l: 35, rain_cover: true, weight_g: null },
    };

    const res = checkItemSimilarity(itemA, itemB);
    expect(res.similar).toBe(true);
    expect(res.matchedFields).toEqual(['capacity_l']);
  });

  // Test G5.4: Một field bằng và một field chung khác nhau -> Không cảnh báo
  it('G5.4: one common field equals but another common field differs -> no warning (contradiction)', () => {
    const itemA: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, temp_rating_c: 5 },
    };
    const itemB: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, temp_rating_c: 6 }, // 5 !== 6
    };

    const res = checkItemSimilarity(itemA, itemB);
    expect(res.similar).toBe(false);
    expect(res.matchedFields).toEqual([]);
  });

  // Test G5.5: Khác category hoặc khác condition -> Không cảnh báo
  it('G5.5: different category or different condition -> no warning', () => {
    const jacket: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000 },
    };
    const pants: DuplicateCheckItem = {
      category: 'PANTS',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000 },
    };
    expect(checkItemSimilarity(jacket, pants).similar).toBe(false);

    const jacketWorn: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'WORN',
      attributes: { waterproof_mm: 5000 },
    };
    expect(checkItemSimilarity(jacket, jacketWorn).similar).toBe(false);
  });

  // Test G5.6: Hai bên all-null; một bên all-null; known fields không giao nhau -> Không cảnh báo
  it('G5.6: all-null on both sides, or all-null on one side, or disjoint known fields -> no warning', () => {
    const allNullA: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: null, temp_rating_c: null },
    };
    const allNullB: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: null, temp_rating_c: null },
    };
    expect(checkItemSimilarity(allNullA, allNullB).similar).toBe(false);

    const disjointA: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, temp_rating_c: null },
    };
    const disjointB: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: null, temp_rating_c: 5 },
    };
    expect(checkItemSimilarity(disjointA, disjointB).similar).toBe(false);
  });

  // Test G5.7: windproof=false ở cả hai; hoặc weight_g=0 ở cả hai -> Tính là một field khớp thật
  it('G5.7: known false=false or known 0=0 counts as a genuine matched field', () => {
    const jacketA: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { windproof: false },
    };
    const jacketB: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { windproof: false },
    };
    const resBool = checkItemSimilarity(jacketA, jacketB);
    expect(resBool.similar).toBe(true);
    expect(resBool.matchedFields).toEqual(['windproof']);

    const poleA: DuplicateCheckItem = {
      category: 'TREKKING_POLE',
      condition: 'GOOD',
      attributes: { length_min_cm: 0 },
    };
    const poleB: DuplicateCheckItem = {
      category: 'TREKKING_POLE',
      condition: 'GOOD',
      attributes: { length_min_cm: 0 },
    };
    const resZero = checkItemSimilarity(poleA, poleB);
    expect(resZero.similar).toBe(true);
    expect(resZero.matchedFields).toEqual(['length_min_cm']);
  });

  // Test G5.8: false so true; 0 so số khác -> Có mâu thuẫn, không cảnh báo
  it('G5.8: false vs true, or 0 vs positive number -> contradiction, no warning', () => {
    const itemA: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { windproof: false, waterproof_mm: 5000 },
    };
    const itemB: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { windproof: true, waterproof_mm: 5000 },
    };
    expect(checkItemSimilarity(itemA, itemB).similar).toBe(false);
  });

  // Test G5.9: Thiếu key và explicit null -> Cùng unknown sau validation, không tính khớp
  it('G5.9: missing key and explicit null are both unknown -> does not count as match', () => {
    const itemA: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: null }, // explicit null
    };
    const itemB: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: {}, // omitted key
    };
    expect(checkItemSimilarity(itemA, itemB).similar).toBe(false);
  });

  // Test G5.10: Numeric string/NaN/Infinity/enum lạ/field sai category -> Validation error
  it('G5.10: invalid attribute types rejected by validateAttributesForCategory before duplicate check', () => {
    expect(() => validateAttributesForCategory('JACKET', { waterproof_mm: '5000' })).toThrow();
    expect(() => validateAttributesForCategory('JACKET', { waterproof_mm: NaN })).toThrow();
    expect(() => validateAttributesForCategory('JACKET', { waterproof_mm: Infinity })).toThrow();
    expect(() => validateAttributesForCategory('JACKET', { invalid_field: 123 })).toThrow();
  });

  // Test G5.11: Trùng tên nhưng thông số mâu thuẫn -> Không cảnh báo
  it('G5.11: identical item names but contradictory attributes -> no warning', () => {
    const itemA: DuplicateCheckItem = {
      name: 'Salomon X-Ultra 4',
      category: 'FOOTWEAR',
      condition: 'GOOD',
      attributes: { grip_level: 5, waterproof: true },
    };
    const itemB: DuplicateCheckItem = {
      name: 'Salomon X-Ultra 4',
      category: 'FOOTWEAR',
      condition: 'GOOD',
      attributes: { grip_level: 3, waterproof: true }, // grip 5 !== 3
    };
    expect(checkItemSimilarity(itemA, itemB).similar).toBe(false);
  });

  // Test G5.12: Nhiều item tương tự, tie createdAt -> similarCount đúng, chọn đại diện ổn định
  it('G5.12: multiple similar items -> correct similarCount, picks newest (createdAt DESC, tie id ASC)', () => {
    const candidate: DuplicateCheckItem = {
      category: 'PANTS',
      condition: 'GOOD',
      attributes: { waterproof_mm: 3000, temp_rating_c: 10 },
    };

    const olderItem: DuplicateCheckItem = {
      id: 'item-older',
      name: 'Older Pants',
      category: 'PANTS',
      condition: 'GOOD',
      attributes: { waterproof_mm: 3000, temp_rating_c: 10 },
      createdAt: new Date('2026-10-01T10:00:00Z'),
    };

    const newerItemA: DuplicateCheckItem = {
      id: 'item-newer-a',
      name: 'Newer Pants A',
      category: 'PANTS',
      condition: 'GOOD',
      attributes: { waterproof_mm: 3000, temp_rating_c: 10 },
      createdAt: new Date('2026-10-22T10:00:00Z'),
    };

    const newerItemB: DuplicateCheckItem = {
      id: 'item-newer-b',
      name: 'Newer Pants B',
      category: 'PANTS',
      condition: 'GOOD',
      attributes: { waterproof_mm: 3000, temp_rating_c: 10 },
      createdAt: new Date('2026-10-22T10:00:00Z'), // tie createdAt
    };

    const details = findSimilarItems(candidate, [olderItem, newerItemB, newerItemA]);
    expect(details).not.toBeNull();
    expect(details?.similarCount).toBe(3);
    // Tie break on createdAt DESC, then id ASC -> 'item-newer-a' wins
    expect(details?.similarItem.id).toBe('item-newer-a');
    expect(details?.matchedFields).toEqual(['waterproof_mm', 'temp_rating_c']);
  });

  // Test G5.13: Đảo thứ tự key/ứng viên -> Cùng kết quả, không mutate input
  it('G5.13: order invariance and no input mutation', () => {
    const candidate: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, temp_rating_c: 5 },
    };
    const existingA: DuplicateCheckItem = {
      id: 'a',
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { temp_rating_c: 5, waterproof_mm: 5000 },
    };
    const existingB: DuplicateCheckItem = {
      id: 'b',
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, temp_rating_c: 5 },
    };

    const copyCandidate = JSON.parse(JSON.stringify(candidate));
    const res1 = findSimilarItems(candidate, [existingA, existingB]);
    const res2 = findSimilarItems(candidate, [existingB, existingA]);

    expect(res1?.similarCount).toBe(res2?.similarCount);
    expect(candidate).toEqual(copyCandidate); // no mutation
  });

  // Test G5.14: A gần B, B gần C, A mâu thuẫn C -> Không bắc cầu (A không gần C qua B)
  it('G5.14: similarity relation is NOT transitive (A ~ B and B ~ C does not imply A ~ C)', () => {
    // A knows waterproof_mm=5000, temp=null
    // B knows waterproof_mm=5000, temp=5
    // C knows waterproof_mm=null, temp=10
    // A ~ B because waterproof_mm matches.
    // B contradicts C because temp 5 !== 10.
    // A vs C: A knows waterproof_mm, C knows temp -> disjoint, NOT similar!
    const itemA: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, temp_rating_c: null },
    };
    const itemB: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, temp_rating_c: 5 },
    };
    const itemC: DuplicateCheckItem = {
      category: 'JACKET',
      condition: 'GOOD',
      attributes: { waterproof_mm: null, temp_rating_c: 10 },
    };

    expect(checkItemSimilarity(itemA, itemB).similar).toBe(true);
    expect(checkItemSimilarity(itemB, itemC).similar).toBe(false);
    expect(checkItemSimilarity(itemA, itemC).similar).toBe(false); // Not transitive!
  });

  // Tests for B04-01 Canonical Schemas: TENT, TREKKING_POLE, RAIN_GEAR, BACKPACK capacity_l=0
  describe('B04-01 Canonical Schemas & Duplicate Alignment', () => {
    it('TENT: detects match on flysheet_waterproof_mm, and rejects contradiction on flysheet5000 vs 1000 even if weight matches', () => {
      const tentA: DuplicateCheckItem = {
        category: 'TENT',
        condition: 'GOOD',
        attributes: { flysheet_waterproof_mm: 5000 },
      };
      const tentB: DuplicateCheckItem = {
        category: 'TENT',
        condition: 'GOOD',
        attributes: { flysheet_waterproof_mm: 5000 },
      };
      expect(checkItemSimilarity(tentA, tentB)).toEqual({
        similar: true,
        matchedFields: ['flysheet_waterproof_mm'],
      });

      const tentWeightMatchConflictFly: DuplicateCheckItem = {
        category: 'TENT',
        condition: 'GOOD',
        attributes: { weight_g: 1000, flysheet_waterproof_mm: 5000 },
      };
      const tentWeightMatchConflictFly2: DuplicateCheckItem = {
        category: 'TENT',
        condition: 'GOOD',
        attributes: { weight_g: 1000, flysheet_waterproof_mm: 1000 },
      };
      // weight_g matches, but flysheet contradicts -> MUST be false!
      expect(checkItemSimilarity(tentWeightMatchConflictFly, tentWeightMatchConflictFly2).similar).toBe(false);
    });

    it('TREKKING_POLE: adjustable=false matches on both sides; contradicts if false vs true', () => {
      const poleA: DuplicateCheckItem = {
        category: 'TREKKING_POLE',
        condition: 'GOOD',
        attributes: { adjustable: false },
      };
      const poleB: DuplicateCheckItem = {
        category: 'TREKKING_POLE',
        condition: 'GOOD',
        attributes: { adjustable: false },
      };
      expect(checkItemSimilarity(poleA, poleB)).toEqual({
        similar: true,
        matchedFields: ['adjustable'],
      });

      const poleC: DuplicateCheckItem = {
        category: 'TREKKING_POLE',
        condition: 'GOOD',
        attributes: { adjustable: true },
      };
      expect(checkItemSimilarity(poleA, poleC).similar).toBe(false);
    });

    it('RAIN_GEAR: waterproof_mm and coverage check', () => {
      const rainA: DuplicateCheckItem = {
        category: 'RAIN_GEAR',
        condition: 'GOOD',
        attributes: { waterproof_mm: 3000, coverage: 'FULL_BODY' },
      };
      const rainB: DuplicateCheckItem = {
        category: 'RAIN_GEAR',
        condition: 'GOOD',
        attributes: { waterproof_mm: 3000, coverage: 'FULL_BODY' },
      };
      expect(checkItemSimilarity(rainA, rainB)).toEqual({
        similar: true,
        matchedFields: ['waterproof_mm', 'coverage'],
      });

      const rainC: DuplicateCheckItem = {
        category: 'RAIN_GEAR',
        condition: 'GOOD',
        attributes: { waterproof_mm: 3000, coverage: 'UPPER_BODY' },
      };
      expect(checkItemSimilarity(rainA, rainC).similar).toBe(false);
    });

    it('BACKPACK: capacity_l=0 is allowed as a valid known value', () => {
      const parsed = validateAttributesForCategory('BACKPACK', { capacity_l: 0 });
      expect(parsed.capacity_l).toBe(0);

      const bagA: DuplicateCheckItem = {
        category: 'BACKPACK',
        condition: 'GOOD',
        attributes: { capacity_l: 0 },
      };
      const bagB: DuplicateCheckItem = {
        category: 'BACKPACK',
        condition: 'GOOD',
        attributes: { capacity_l: 0 },
      };
      expect(checkItemSimilarity(bagA, bagB)).toEqual({
        similar: true,
        matchedFields: ['capacity_l'],
      });
    });
  });
});

