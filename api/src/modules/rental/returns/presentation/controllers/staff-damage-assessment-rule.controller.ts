import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from 'src/shared/services/prisma.service';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { AuthType } from 'src/shared/constants/auth.constant';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { UserRole } from 'src/shared/constants/enum.constant';

@ApiTags('Staff Damage Assessment Rules')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
@Controller('staff/damage-assessment-rules')
export class StaffDamageAssessmentRuleController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Team Extension — Lấy danh sách quy tắc hư hại phục vụ kiểm tra FINAL (RB-API-605)',
    description:
      'Team extension ngoài SOT để staff tra cứu ruleId khi thực hiện kiểm tra sâu và chấm hư hỏng (RB-API-605 cần ruleId). Chỉ đọc.',
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    type: String,
    format: 'uuid',
    description: 'Lọc danh sách quy tắc theo UUID sản phẩm thuê',
    example: 'aaaaaa11-1111-1111-1111-111111111111',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách quy tắc đánh giá hư hại',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              ruleCode: { type: 'string' },
              productId: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              severity: { type: 'string', enum: ['MINOR', 'MODERATE', 'SEVERE', 'TOTAL_LOSS'] },
              formulaType: { type: 'string', enum: ['FIXED', 'PERCENT_DEPOSIT', 'PERCENT_REPLACEMENT_VALUE'] },
              value: { type: 'number' },
              requiresApproval: { type: 'boolean' },
              versionNo: { type: 'integer' },
              isActive: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  async listRules(@Query('productId') productId?: string) {
    const rules = await this.prisma.damageAssessmentRule.findMany({
      where: {
        isActive: true,
        ...(productId ? { productId } : {}),
      },
      orderBy: [{ severity: 'asc' }, { ruleCode: 'asc' }],
    });

    return {
      items: rules.map((r) => ({
        id: r.id,
        ruleCode: r.ruleCode,
        productId: r.productId,
        name: r.name,
        description: r.description ?? null,
        severity: r.severity,
        formulaType: r.deductionType,
        value: Number(r.deductionValue),
        requiresApproval: r.requiresApproval,
        versionNo: r.versionNo,
        isActive: r.isActive,
      })),
    };
  }
}

