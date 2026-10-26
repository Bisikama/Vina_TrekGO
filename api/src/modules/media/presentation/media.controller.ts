import { Controller, Post, Get, Delete, Body, Param, Query, HttpCode, HttpStatus, ParseUUIDPipe, Header } from '@nestjs/common';
import { CreateUploadIntentUseCase } from '../application/use-cases/create-upload-intent.use-case';
import { CompleteUploadUseCase } from '../application/use-cases/complete-upload.use-case';
import { GetMediaDeliveryUseCase } from '../application/use-cases/get-media-delivery.use-case';
import { RequestMediaDeletionUseCase } from '../application/use-cases/request-media-deletion.use-case';
import { CreateUploadIntentDto } from './dto/create-upload-intent.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { GetMediaDeliveryDto, getMediaDeliverySchema } from './dto/get-media-delivery.dto';
import type { GetMediaDeliveryDto as GetMediaDeliveryDtoType } from './dto/get-media-delivery.dto';
import { ActiveUser } from '../../../shared/decorators/active-user.decorator';
import type { ActiveUserData } from '../../../shared/types/user.type';
import { Auth } from '../../../shared/decorators/auth.decorator';
import { AuthType } from '../../../shared/constants/auth.constant';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { createUploadIntentSchema } from './dto/create-upload-intent.dto';
import { completeUploadSchema } from './dto/complete-upload.dto';

@Auth([AuthType.Bearer])
@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(
    private readonly createUploadIntentUseCase: CreateUploadIntentUseCase,
    private readonly completeUploadUseCase: CompleteUploadUseCase,
    private readonly getMediaDeliveryUseCase: GetMediaDeliveryUseCase,
    private readonly requestMediaDeletionUseCase: RequestMediaDeletionUseCase,
  ) {}

  @Post('upload-intents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Tạo Upload Intent (Yêu cầu tải lên)',
    description: `
Luồng xử lý (Trực tiếp từ Client lên Cloudinary):
1. Hệ thống tạo upload intent (trả về URL & thông số form).
2. Client dùng multipart/form-data đính kèm file binary vào field "file".
3. Client đính kèm tất cả các formField nhận được từ API này.
4. Client gọi POST TRỰC TIẾP lên uploadUrl của Cloudinary.
5. Cloudinary trả về public_id, version, signature.
6. Client gọi API /media/:id/complete để xác nhận.

Lưu ý:
- KHÔNG nhận base64, URL ảnh, hay đường dẫn nội bộ.
- File bytes KHÔNG đi qua server NestJS (tiết kiệm băng thông).

Giới hạn & Định dạng:
- Ảnh: Tối đa 20MB. Hỗ trợ: image/jpeg, image/png, image/webp, image/heic, image/heif.
- Video: Tối đa 100MB. Hỗ trợ: video/mp4, video/quicktime, video/webm.

Phân quyền (Roles/Scopes):
- LEADER_CERTIFICATE: USER ACTIVE; IMAGE resource, JPEG/PNG/PDF; shared MEDIA_MAX_IMAGE_BYTES limit; authenticated upload. Use mediaId as SF01 fileKey.
- RENTAL_PRODUCT: STAFF_INVENTORY / ADMIN
- CONDITION_EVIDENCE: STAFF_INVENTORY
- RETURN_EVIDENCE: STAFF_INVENTORY / STAFF_DELIVERY
- EXCEPTION_EVIDENCE: USER / LEADER / STAFF_INVENTORY / STAFF_DELIVERY / ADMIN
- USER_GEAR: USER
`
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['RENTAL_PRODUCT', 'CONDITION_EVIDENCE', 'RETURN_EVIDENCE', 'EXCEPTION_EVIDENCE', 'LEADER_CERTIFICATE', 'USER_GEAR'] },
        resourceType: { type: 'string', enum: ['IMAGE', 'VIDEO'] },
        fileName: { type: 'string' },
        contentType: { type: 'string' },
        sizeBytes: { type: 'integer', minimum: 1 },
        captureSource: { type: 'string', enum: ['CAMERA', 'GALLERY', 'FILE', 'SYSTEM', 'UNKNOWN'] },
        clientCapturedAt: { type: 'string', format: 'date-time', example: '2023-10-01T12:00:00+07:00' },
      },
      required: ['scope', 'resourceType', 'fileName', 'contentType', 'sizeBytes'],
    },
    examples: {
      image: {
        summary: 'Yêu cầu tải ảnh (IMAGE)',
        value: {
          scope: 'RENTAL_PRODUCT',
          resourceType: 'IMAGE',
          fileName: 'tent.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1048576,
          captureSource: 'CAMERA',
          clientCapturedAt: '2023-10-01T12:00:00+07:00'
        }
      },
      video: {
        summary: 'Yêu cầu tải video (VIDEO)',
        value: {
          scope: 'EXCEPTION_EVIDENCE',
          resourceType: 'VIDEO',
          fileName: 'damage.mp4',
          contentType: 'video/mp4',
          sizeBytes: 52428800
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Tạo upload intent thành công.',
    schema: {
      example: {
        data: {
          mediaId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'PENDING_UPLOAD',
          expiresAt: '2023-10-01T12:15:00.000Z',
          provider: 'CLOUDINARY',
          upload: {
            uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
            method: 'POST',
            resourceType: 'IMAGE',
            formFields: {
              api_key: '1234567890',
              timestamp: 1696136400,
              signature: 'abcdef1234567890',
              public_id: 'trekgo/test/123e4567-e89b-12d3-a456-426614174000',
              type: 'upload'
            }
          }
        },
        meta: {
          requestId: 'uuid',
          serverTime: '2023-10-01T12:00:00.000Z',
          contractVersion: '0.2.0-final-flow'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực (Unauthorized).' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập scope này (Forbidden).' })
  @ApiResponse({ status: 413, description: 'Dữ liệu quá lớn (Payload too large).' })
  @ApiResponse({ status: 422, description: 'Dữ liệu đầu vào không hợp lệ (Validation failed).' })
  @ApiResponse({ status: 502, description: 'Lỗi từ dịch vụ lưu trữ Media (Cloudinary).' })
  async createUploadIntent(
    @Body(new ZodValidationPipe(createUploadIntentSchema)) dto: CreateUploadIntentDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.createUploadIntentUseCase.execute(dto, user);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Xác nhận hoàn tất tải lên',
    description: `
Kiểm tra tính toàn vẹn và lưu trữ metadata của file sau khi client tải trực tiếp lên Cloudinary.

Lưu ý Idempotent: Nếu media đã ở trạng thái READY, API vẫn trả về thành công mà không gây lỗi.
`
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        publicId: { type: 'string' },
        version: { type: 'number' },
        signature: { type: 'string' },
      },
      required: ['publicId', 'version', 'signature'],
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Xác nhận hoàn tất tải lên thành công.',
    schema: {
      example: {
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          scope: 'RENTAL_PRODUCT',
          resourceType: 'IMAGE',
          status: 'READY',
          mimeType: 'image/jpeg',
          sizeBytes: 1048576,
          width: 1920,
          height: 1080,
          durationMs: null,
          captureSource: 'CAMERA',
          provenanceStatus: 'DIRECT_CAPTURE',
          readyAt: '2023-10-01T12:05:00.000Z'
        },
        meta: {
          requestId: 'uuid',
          serverTime: '2023-10-01T12:05:00.000Z',
          contractVersion: '0.2.0-final-flow'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ.', schema: { example: { error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 404, description: 'Không tìm thấy media.', schema: { example: { error: { code: 'MEDIA_NOT_FOUND', message: 'Media asset not found' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 409, description: 'Xung đột trạng thái hoặc thông tin nhà cung cấp.', schema: { example: { error: { code: 'MEDIA_INVALID_STATE', message: 'Cannot complete upload for asset in REJECTED state' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 410, description: 'Yêu cầu tải lên đã hết hạn.', schema: { example: { error: { code: 'MEDIA_UPLOAD_EXPIRED', message: 'Upload intent has expired' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 413, description: 'Kích thước file vượt quá giới hạn.', schema: { example: { error: { code: 'MEDIA_FILE_TOO_LARGE', message: 'Image exceeds maximum size' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 422, description: 'Chữ ký tải lên không hợp lệ.', schema: { example: { error: { code: 'MEDIA_UPLOAD_SIGNATURE_INVALID', message: 'Invalid provider upload signature' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 502, description: 'Lỗi từ nhà cung cấp dịch vụ lưu trữ.', schema: { example: { error: { code: 'MEDIA_PROVIDER_ERROR', message: 'Provider lookup failed' }, meta: { requestId: 'uuid' } } } })
  async completeUpload(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(completeUploadSchema)) dto: CompleteUploadDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.completeUploadUseCase.execute(id, dto, user);
  }

  @Auth([AuthType.Bearer, AuthType.None]) // Allow public access (AuthType.None allows public)
  @Get(':id/delivery')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Lấy URL phân phối Media',
    description: `
Lấy URL đã tối ưu hóa cho mục đích hiển thị (Catalog) hoặc bằng chứng (Evidence).
Đối với Catalog, API này có thể được gọi mà không cần token.
Đối với Evidence, bắt buộc phải có token và quyền truy cập.
`
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'variant', required: true, enum: ['CATALOG_THUMBNAIL', 'CATALOG_CARD', 'CATALOG_DETAIL', 'EVIDENCE_THUMBNAIL', 'EVIDENCE_PREVIEW', 'VIDEO_PREVIEW', 'DOCUMENT_ORIGINAL'] })
  @ApiQuery({ name: 'format', required: false, enum: ['AUTO', 'WEBP', 'JPEG'] })
  @ApiResponse({
    status: 200,
    description: 'Thành công',
    schema: {
      example: {
        data: {
          mediaId: 'uuid',
          variant: 'CATALOG_CARD',
          resourceType: 'IMAGE',
          url: 'https://...',
          expiresAt: null,
          format: 'AUTO'
        },
        meta: {
          requestId: 'uuid'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực (Yêu cầu đối với Evidence).' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy media.' })
  async getDeliveryUrl(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(getMediaDeliverySchema)) dto: GetMediaDeliveryDtoType,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.getMediaDeliveryUseCase.execute({ mediaId: id, ...dto }, user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Xóa tài nguyên Media (Hard Delete Request)',
    description: `
      Yêu cầu xóa vĩnh viễn một Media Asset.
      
      Quy trình:
      1. Kiểm tra quyền sở hữu.
      2. Kiểm tra xem Media có đang được sử dụng trong các Entity khác không (sản phẩm, đơn hàng, ...).
      3. Chuyển trạng thái sang DELETE_PENDING.
      4. Xóa file vật lý trên Cloudinary.
      5. Cập nhật thành DELETED (tombstone) trong CSDL.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID của Media Asset', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Yêu cầu xóa thành công hoặc idempotent.',
    schema: { example: { data: { success: true }, meta: { requestId: 'uuid', serverTime: '2023-10-01T12:00:00.000Z', contractVersion: '0.2.0-final-flow' } } }
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xóa media này.',
    schema: { example: { error: { code: 'MEDIA_FORBIDDEN', message: 'Forbidden' }, meta: { requestId: 'uuid' } } }
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy Media.',
    schema: { example: { error: { code: 'MEDIA_NOT_FOUND', message: 'Not found' }, meta: { requestId: 'uuid' } } }
  })
  @ApiResponse({
    status: 409,
    description: 'Không thể xóa do Media đang được tham chiếu, chưa hết hạn lưu trữ hoặc trạng thái không hợp lệ.',
    schema: { example: { error: { code: 'MEDIA_INVALID_STATE', message: 'Cannot delete referenced media' }, meta: { requestId: 'uuid' } } }
  })
  @ApiResponse({
    status: 502,
    description: 'Lỗi từ nhà cung cấp dịch vụ lưu trữ (có thể thử lại).',
    schema: { example: { error: { code: 'MEDIA_PROVIDER_ERROR', message: 'Provider deletion failed', retryable: true }, meta: { requestId: 'uuid' } } }
  })
  async deleteMedia(@Param('id', new ParseUUIDPipe()) id: string, @ActiveUser() user: ActiveUserData): Promise<void> {
    await this.requestMediaDeletionUseCase.execute({
      assetId: id,
      requesterUser: { id: user.id, role: user.role },
    });
  }
}
