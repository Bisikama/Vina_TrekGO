import { Controller, Post, Body, Param, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { CreateUploadIntentUseCase } from '../application/use-cases/create-upload-intent.use-case';
import { CompleteUploadUseCase } from '../application/use-cases/complete-upload.use-case';
import { CreateUploadIntentDto } from './dto/create-upload-intent.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { ActiveUser } from '../../../shared/decorators/active-user.decorator';
import type { ActiveUserData } from '../../../shared/types/user.type';
import { Auth } from '../../../shared/decorators/auth.decorator';
import { AuthType } from '../../../shared/constants/auth.constant';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
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
  ) {}

  @Post('upload-intents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create an upload intent',
    description: `
1. TrekGo creates upload intent
2. client creates multipart/form-data
3. client puts actual binary file in "file"
4. client includes every returned formField
5. client POSTs DIRECTLY to Cloudinary upload.url
6. Cloudinary returns public_id/version/signature
7. client calls TrekGo /media/:id/complete

Explicitly note:
- no base64
- no local path
- no pasted image URL
- file bytes do not pass through NestJS

Examples:
- Image limits: 20MB max. MIME: image/jpeg, image/png, image/webp, image/heic, image/heif.
- Video limits: 100MB max. MIME: video/mp4, video/quicktime, video/webm.
`
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['RENTAL_PRODUCT', 'CONDITION_EVIDENCE', 'RETURN_EVIDENCE', 'EXCEPTION_EVIDENCE'] },
        resourceType: { type: 'string', enum: ['IMAGE', 'VIDEO'] },
        fileName: { type: 'string' },
        contentType: { type: 'string' },
        sizeBytes: { type: 'number' },
        captureSource: { type: 'string', enum: ['CAMERA', 'LIBRARY', 'UPLOAD', 'UNKNOWN'], nullable: true },
        clientCapturedAt: { type: 'string', format: 'date-time', nullable: true },
      },
      required: ['scope', 'resourceType', 'fileName', 'contentType', 'sizeBytes'],
    },
    examples: {
      image: {
        summary: 'IMAGE request',
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
        summary: 'VIDEO request',
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
    description: 'Upload intent created successfully.',
    schema: {
      example: {
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
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden scope access.' })
  @ApiResponse({ status: 413, description: 'Payload too large.' })
  @ApiResponse({ status: 422, description: 'Validation failed or unprocessable entity.' })
  @ApiResponse({ status: 502, description: 'Media provider error.' })
  async createUploadIntent(
    @Body(new ZodValidationPipe(createUploadIntentSchema)) dto: CreateUploadIntentDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.createUploadIntentUseCase.execute(dto, user);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Complete an upload',
    description: `
Idempotent behavior: if the asset is already READY, it will return success immediately without throwing.
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
    description: 'Upload completed successfully.',
    schema: {
      example: {
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
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Validation failed.', schema: { example: { error: { code: 'VALIDATION_FAILED', message: 'Invalid payload' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 404, description: 'Media not found.', schema: { example: { error: { code: 'MEDIA_NOT_FOUND', message: 'Media asset not found' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 409, description: 'State or provider mismatch conflict.', schema: { example: { error: { code: 'MEDIA_INVALID_STATE', message: 'Cannot complete upload for asset in ARCHIVED state' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 410, description: 'Upload intent expired.', schema: { example: { error: { code: 'MEDIA_UPLOAD_EXPIRED', message: 'Upload intent has expired' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 413, description: 'Media file too large.', schema: { example: { error: { code: 'MEDIA_FILE_TOO_LARGE', message: 'Image exceeds maximum size' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 422, description: 'Invalid upload signature.', schema: { example: { error: { code: 'MEDIA_UPLOAD_SIGNATURE_INVALID', message: 'Invalid provider upload signature' }, meta: { requestId: 'uuid' } } } })
  @ApiResponse({ status: 502, description: 'Provider error.', schema: { example: { error: { code: 'MEDIA_PROVIDER_ERROR', message: 'Provider lookup failed' }, meta: { requestId: 'uuid' } } } })
  async completeUpload(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(completeUploadSchema)) dto: CompleteUploadDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.completeUploadUseCase.execute(id, dto, user);
  }
}
