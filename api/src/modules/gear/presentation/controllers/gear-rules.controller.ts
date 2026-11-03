import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../../shared/decorators/auth.decorator';
import { AuthType } from '../../../../shared/constants/auth.constant';
import { GearRuleService } from '../../application/services/gear-rule.service';

@ApiTags('Gear - Rules (28 Quy tắc thẩm định kỹ thuật)')
@Auth([AuthType.Optional])
@Controller('gear/requirement-rules')
export class GearRulesController {
  constructor(private readonly gearRuleService: GearRuleService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách 28 quy tắc thẩm định trang bị kỹ thuật (R01 - R28)',
    description: `
Truy vấn toàn bộ 28 quy tắc kiểm tra tính an toàn kỹ thuật của đồ dùng dã ngoại theo chuẩn **MASTER SPEC V3.1.5**:
- **R01 - R06:** Áo khoác (JACKET - chống nước, giữ nhiệt, chống gió, trọng lượng theo độ khó).
- **R07 - R11:** Giày leo núi (FOOTWEAR - chống nước, bảo vệ cổ chân, độ bám đế gai).
- **R12 - R14:** Quần trekking (PANTS - chống nước, giữ nhiệt).
- **R15 - R19:** Balo (BACKPACK - dung tích theo số ngày, bọc chống mưa, tránh quá khổ).
- **R20 - R23:** Túi ngủ (SLEEPING_BAG - giới hạn nhiệt độ đêm, trọng lượng mang vác).
- **R24 - R25:** Tình trạng món đồ (POOR -> NOT_SUITABLE, thiếu thông số bắt buộc).
- **R26 - R28:** Cảnh báo bao phủ kế hoạch (thiếu nhóm bắt buộc, thời tiết mưa lớn, nhiệt độ âm).
`,
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách 28 quy tắc thẩm định trang bị chuẩn của hệ thống TrekGo',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'R01' },
          category: { type: 'string', example: 'JACKET' },
          defaultVerdict: { type: 'string', example: 'NOT_SUITABLE' },
          templateVi: { type: 'string', example: 'Khả năng chống nước của áo khoác chưa đáp ứng điều kiện mưa của chuyến đi.' },
          isActive: { type: 'boolean', example: true },
          ruleVersion: { type: 'string', example: '3.1' },
        },
      },
    },
  })
  getRequirementRules() {
    return this.gearRuleService.getRequirementRules();
  }
}
