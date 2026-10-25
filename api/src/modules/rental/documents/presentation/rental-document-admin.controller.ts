import { Body, Controller, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { RentalDocumentIdParamSchema } from '../../returns/presentation/dtos/rental-return.dto';
import type { RentalDocumentIdParamDto } from '../../returns/presentation/dtos/rental-return.dto';
import { RentalDocumentService } from '../application/rental-document.service';
import { CorrectionBodySchema, RetryRenderBodySchema, type CorrectionBody, type RetryRenderBody } from './rental-document-admin.dto';

@ApiTags('Rental Documents Admin')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.ADMIN)
@Controller('admin/rental-documents')
export class RentalDocumentAdminController {
  constructor(private readonly documents: RentalDocumentService) {}

  @Post(':documentId/corrections')
  @ApiOperation({
    summary: 'RB-API-1006 — Thêm thông báo đính chính hiển thị cho chứng từ',
    description: 'Admin thêm một bản đính chính bất biến (chỉ thay đổi phần hiển thị) cho chứng từ, không sửa snapshot gốc.',
  })
  @ApiParam({ name: 'documentId', type: String, format: 'uuid', description: 'UUID chứng từ cần đính chính' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng' })
  @ApiBody({ schema: { type: 'object', required: ['reason', 'corrections', 'expectedVersion'],
    properties: { reason: { type: 'string' }, expectedVersion: { type: 'integer' },
      corrections: { type: 'array', items: { type: 'object', required: ['field', 'oldValue', 'newValue'],
        properties: { field: { type: 'string' }, oldValue: { type: 'string', nullable: true },
          newValue: { type: 'string', nullable: true } } } } } } })
  @ApiResponse({ status: 201, description: 'Thông báo đính chính bất biến mới được tạo' })
  async correct(@Param(new ZodValidationPipe(RentalDocumentIdParamSchema)) params: RentalDocumentIdParamDto,
    @Body(new ZodValidationPipe(CorrectionBodySchema)) body: CorrectionBody,
    @Headers('idempotency-key') key: string, @ActiveUser('id') actorId: string) {
    return { data: await this.documents.correct(params.documentId, actorId, key, body) };
  }

  @Post(':documentId/retry-render')
  @HttpCode(202)
  @ApiOperation({
    summary: 'RB-API-1007 — Thử kết xuất lại chứng từ bất biến',
    description: 'Admin yêu cầu kết xuất (render) lại PDF cho cùng một chứng từ khi lần kết xuất trước thất bại.',
  })
  @ApiParam({ name: 'documentId', type: String, format: 'uuid', description: 'UUID chứng từ cần kết xuất lại' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Khóa duy nhất để tránh gọi trùng' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } })
  @ApiResponse({ status: 202, description: 'Yêu cầu kết xuất lại đã được đưa vào hàng đợi' })
  async retry(@Param(new ZodValidationPipe(RentalDocumentIdParamSchema)) params: RentalDocumentIdParamDto,
    @Body(new ZodValidationPipe(RetryRenderBodySchema)) body: RetryRenderBody,
    @Headers('idempotency-key') key: string, @ActiveUser('id') actorId: string) {
    return { data: await this.documents.retry(params.documentId, actorId, key, body) };
  }
}
