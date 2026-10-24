import { GEAR_RULE_METADATA_REGISTRY } from '../src/modules/gear/domain/rule-metadata.registry';

describe('GearRuleMetadataRegistry Unit Tests (MASTER D, D1, D2 Independent Verification)', () => {
  it('should contain exactly 28 rules', () => {
    expect(GEAR_RULE_METADATA_REGISTRY).toHaveLength(28);
  });

  it('should have unique rule IDs from R01 to R28', () => {
    const ids = GEAR_RULE_METADATA_REGISTRY.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(28);
    for (let i = 1; i <= 28; i++) {
      const expectedId = `R${i.toString().padStart(2, '0')}`;
      expect(uniqueIds.has(expectedId)).toBe(true);
    }
  });

  it('should assign correct categories to all 28 rules', () => {
    const categoryMap: Record<string, string> = {
      R01: 'JACKET',
      R02: 'JACKET',
      R03: 'JACKET',
      R04: 'JACKET',
      R05: 'JACKET',
      R06: 'JACKET',
      R07: 'FOOTWEAR',
      R08: 'FOOTWEAR',
      R09: 'FOOTWEAR',
      R10: 'FOOTWEAR',
      R11: 'FOOTWEAR',
      R12: 'PANTS',
      R13: 'PANTS',
      R14: 'PANTS',
      R15: 'BACKPACK',
      R16: 'BACKPACK',
      R17: 'BACKPACK',
      R18: 'BACKPACK',
      R19: 'BACKPACK',
      R20: 'SLEEPING_BAG',
      R21: 'SLEEPING_BAG',
      R22: 'SLEEPING_BAG',
      R23: 'SLEEPING_BAG',
      R24: 'GENERAL',
      R25: 'GENERAL',
      R26: 'GENERAL',
      R27: 'GENERAL',
      R28: 'GENERAL',
    };

    for (const rule of GEAR_RULE_METADATA_REGISTRY) {
      expect(rule.category).toBe(categoryMap[rule.id]);
    }
  });

  it('should enforce defaultVerdict: NOT_SUITABLE for R01-R23 and null for R24-R28', () => {
    for (const rule of GEAR_RULE_METADATA_REGISTRY) {
      const ruleNum = parseInt(rule.id.substring(1), 10);
      if (ruleNum <= 23) {
        expect(rule.defaultVerdict).toBe('NOT_SUITABLE');
      } else {
        expect(rule.defaultVerdict).toBeNull();
      }
    }
  });

  it('should match exact templates from MASTER D1 and D2', () => {
    const expectedTemplates: Record<string, string> = {
      R01: 'Mưa {rain}% cần áo chống nước ≥ 5000mm, áo bạn chỉ {wp}mm — nước sẽ ngấm khi đi lâu.',
      R02: 'Mưa vừa phải nhưng áo chỉ {wp}mm — nên mang thêm áo mưa dự phòng.',
      R03: 'Nhiệt độ thấp nhất {t}°C mà áo chỉ chịu được {r}°C — nguy cơ lạnh, đặc biệt khi dừng nghỉ.',
      R04: 'Áo sát ngưỡng chịu lạnh — nên mặc thêm lớp giữa (fleece).',
      R05: 'Trời nóng mà áo dày/nặng ({w}g) — mang theo sẽ thừa, cân nhắc để nhà.',
      R06: 'Đường khó mà áo nặng {w}g — tốn sức, nên chọn áo nhẹ hơn.',
      R07: 'Mưa {rain}% mà giày không chống nước — chân ướt cả ngày rất dễ phồng rộp.',
      R08: 'Đường độ khó {d}/5 cần giày cổ cao bảo vệ mắt cá chân.',
      R09: 'Địa hình trơn/đá mà đế giày bám chỉ {g}/5 — đi chậm, cẩn thận.',
      R10: 'Đi {n} ngày, có mưa mà giày không chống nước — không khô kịp qua đêm.',
      R11: 'Đường khó cần đế bám tốt hơn (hiện tại {g}/5).',
      R12: 'Mưa {rain}% cần quần chống nước ≥ 3000mm (hiện {wp}mm).',
      R13: '{t}°C mà quần chỉ chịu được {r}°C — chân sẽ lạnh, nhất là khi nghỉ.',
      R14: 'Trời lạnh mà quần không lót giữ ấm — nên mặc thêm quần giữ nhiệt bên trong.',
      R15: 'Đi 1 ngày cần tối thiểu ~15L (nước, áo mưa, đồ ăn) — balo {c}L quá nhỏ.',
      R16: 'Đi {n} ngày cần tối thiểu ~35L — balo {c}L không đủ.',
      R17: 'Đi {n} ngày cần tối thiểu ~50L (có túi ngủ, lều) — balo {c}L không đủ.',
      R18: 'Mưa {rain}% mà balo không chống nước/không có áo mưa balo — đồ bên trong ướt hết.',
      R19: 'Balo {c}L quá to so với chuyến {n} ngày — nặng và cồng kềnh không cần thiết.',
      R20: 'Đêm lạnh nhất {t}°C mà túi ngủ chỉ chịu được {r}°C — nguy cơ mất ngủ vì lạnh.',
      R21: 'Túi ngủ sát ngưỡng — nên mang thêm lớp lót túi ngủ (liner).',
      R22: 'Đêm nóng mà túi ngủ quá ấm — sẽ hầm, cân nhắc chỉ mang liner.',
      R23: 'Túi ngủ {w}g quá nặng cho chuyến {n} ngày phải vác bộ.',
      R24: 'Đồ đã xuống cấp — giảm một mức đánh giá so với thông số.',
      R25: 'Thiếu dữ liệu: {attributes} — bỏ qua các quy tắc cần thông số này.',
      R26: 'Thiếu {category} trong bộ đồ đã chọn — nên bổ sung hoặc thuê trước chuyến đi.',
      R27: 'Nhiệt độ thấp nhất {t}°C mà chưa có áo khoác được đánh giá PHÙ HỢP — nên thuê áo đủ ấm.',
      R28: 'Mưa {rain}% và có áo khoác KHÔNG NÊN — nên thuê áo mưa bộ hoặc áo chống nước cao.',
    };

    for (const rule of GEAR_RULE_METADATA_REGISTRY) {
      expect(rule.templateVi).toBe(expectedTemplates[rule.id]);
      expect(rule.isActive).toBe(true);
      expect(rule.ruleVersion).toBe('3.1.1');
    }
  });
});

