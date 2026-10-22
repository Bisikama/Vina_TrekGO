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
  @ApiHeader({
    name: 'x-rental-media-attestation',
    required: true,
    description:
      'Chữ ký số HMAC-SHA256 (64 ký tự hex) được sinh từ RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET với nội dung JSON.stringify([caseId, userId, publishedAt, sortedMediaIds, requestId]).',
    example: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
  })
  @ApiBody({
    description: 'Dữ liệu xác thực truy cập media từ module Media (trừ caseId lấy từ URL param :id)',
    schema: {
      type: 'object',
      required: ['userId', 'publishedAt', 'mediaIds', 'requestId'],
      properties: {
        userId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID của người dùng sở hữu đơn thuê',
          example: '550e8400-e29b-41d4-a716-446655440001',
        },
        publishedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Thời điểm công bố minh chứng (ISO-8601, không lệch quá 15 phút)',
          example: '2026-10-21T10:00:00.000Z',
        },
        mediaIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Danh sách UUID của các media asset minh chứng',
          example: ['550e8400-e29b-41d4-a716-446655440002'],
        },
        requestId: {
          type: 'string',
          description: 'Mã định danh yêu cầu truy cập từ media service',
          example: 'req-attest-001',
        },
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
