import { Body, Controller, Get, Headers, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { RentalPolicyAdminService } from '../../application/services/rental-policy-admin.service';
import { PublishRentalPolicySchema, type PublishRentalPolicyDto } from '../dtos/rental-policy-admin.dto';

const policyResponseSchema = {
  type: 'object',
  required: ['data'],
  properties: { data: { type: 'object', required: ['id', 'version', 'policyVersion'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      version: { type: 'integer', minimum: 1 },
      policyVersion: { type: 'string', example: '1.5.2' },
      currency: { type: 'string', example: 'VND' },
      dayCountMode: { type: 'string', example: 'CEIL_24H' },
      rentalCutoffHours: { type: 'integer' },
      damageRules: {
        type: 'array',
        description: 'Danh sách các quy tắc đánh giá hư hại theo chính sách',
        items: {
          type: 'object',
          required: ['id', 'ruleCode', 'productId', 'severity', 'formulaType', 'value'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            ruleCode: { type: 'string' },
            productId: { type: 'string', format: 'uuid' },
            severity: { type: 'string', enum: ['MINOR', 'MODERATE', 'SEVERE', 'TOTAL_LOSS'] },
            formulaType: { type: 'string', enum: ['FIXED', 'PERCENT_DEPOSIT', 'PERCENT_REPLACEMENT_VALUE'] },
            value: { type: 'number' },
            description: { type: 'string', nullable: true },
          },
        },
      },
    } } },
};

@ApiTags('Admin Rental Policy')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.ADMIN)
@Controller('admin/rental-policy')
export class RentalPolicyAdminController {
  constructor(private readonly service: RentalPolicyAdminService) {}

  @Get()
  @ApiOperation({ summary: 'RB-API-703 — Cấu hình Rental có hiệu lực' })
  @ApiResponse({ status: 200, description: 'Policy hiện hành và version', schema: policyResponseSchema })
  async getCurrent() { return { data: await this.service.getCurrent() }; }

  @Put()
  @ApiOperation({ summary: 'RB-API-704 — Xuất bản policy version mới cho đơn tương lai' })
  @ApiBody({ schema: { type: 'object', required: ['expectedVersion', 'reason', 'policy'],
    properties: { expectedVersion: { type: 'integer' }, reason: { type: 'string' },
      policy: { type: 'object' } } } })
  @ApiResponse({ status: 200, description: 'Policy version mới; snapshot đơn cũ giữ nguyên', schema: policyResponseSchema })
  async publish(
    @Body(new ZodValidationPipe(PublishRentalPolicySchema)) body: PublishRentalPolicyDto,
    @ActiveUser('id') adminId: string,
    @Headers('x-request-id') requestId?: string,
  ) { return { data: await this.service.publish(body, adminId, requestId) }; }
}
