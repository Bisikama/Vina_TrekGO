import { Body, Controller, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthType } from 'src/shared/constants/auth.constant';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { RentalEvidenceAccessService, type MediaAccessAttestation } from '../../infrastructure/integration/rental-evidence-access.service';

/** Internal Shared Media callback: HMAC authenticated inside service, NOT accessible to USER. */
@ApiTags('Nội bộ: Truy cập minh chứng ngoại lệ (Internal Rental Evidence Access)')
@Controller('internal/rental-exceptions')
@Auth([AuthType.None])
export class InternalRentalEvidenceAccessController {
  constructor(private readonly service: RentalEvidenceAccessService) {}

  @Post(':id/evidence-access')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Xác nhận cấp quyền truy cập minh chứng bằng chữ ký HMAC (Internal)',
    description: 'Endpoint nội bộ phục vụ xác thực chữ ký số HMAC từ module Media để cho phép truy cập tệp minh chứng ngoại lệ.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID của trường hợp ngoại lệ (caseId)' })
  @ApiHeader({ name: 'x-rental-media-attestation', required: true, description: 'Chữ ký HMAC bảo mật từ module Media' })
  @ApiBody({
    description: 'Thông tin xác nhận truy cập media',
    schema: {
      type: 'object',
      required: ['mediaId', 'purpose'],
      properties: {
        mediaId: { type: 'string', format: 'uuid', description: 'UUID của tệp media' },
        purpose: { type: 'string', description: 'Mục đích truy cập', example: 'EXCEPTION_REVIEW' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Chữ ký hợp lệ, quyền truy cập được xác nhận' })
  @ApiResponse({ status: 403, description: 'Chữ ký HMAC không hợp lệ' })
  async confirm(
    @Param('id') id: string,
    @Body() body: Omit<MediaAccessAttestation, 'caseId'>,
    @Headers('x-rental-media-attestation') signature: string,
  ) {
    return this.service.confirm({ ...body, caseId: id }, signature);
  }
}
