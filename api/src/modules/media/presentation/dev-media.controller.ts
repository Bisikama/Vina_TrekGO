import { Controller, Post, UseInterceptors, UploadedFile, Body, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from '../../../shared/decorators/auth.decorator';
import { ActiveUser } from '../../../shared/decorators/active-user.decorator';
import type { ActiveUserData } from '../../../shared/types/user.type';
import { CreateUploadIntentUseCase } from '../application/use-cases/create-upload-intent.use-case';
import { CompleteUploadUseCase } from '../application/use-cases/complete-upload.use-case';
import { MediaScopeValue, MediaResourceTypeValue } from '../application/ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from '../application/ports/media-storage.port';
import type { MediaStoragePort } from '../application/ports/media-storage.port';
import 'multer';
import envConfig from '../../../shared/config';

import { AuthType } from '../../../shared/constants/auth.constant';

class DevUploadBodyDto {
  scope: string;
  captureSource?: 'CAMERA' | 'GALLERY' | 'FILE' | 'SYSTEM' | 'UNKNOWN';
  clientCapturedAt?: string;
}

@Auth([AuthType.Bearer])
@ApiTags('Dev / Test')
@Controller('dev/media')
export class DevMediaController {
  constructor(
    private readonly createIntentUseCase: CreateUploadIntentUseCase,
    private readonly completeUploadUseCase: CompleteUploadUseCase,
    @Inject(MEDIA_STORAGE_PORT) private readonly storagePort: MediaStoragePort,
  ) {}

  @Post('upload-test')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'DEV ONLY: Test end-to-end file upload',
    description: 'Use this endpoint to simulate the full intent + upload + complete flow.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        scope: { type: 'string', default: 'RENTAL_PRODUCT' },
        captureSource: { type: 'string', default: 'UNKNOWN' },
        clientCapturedAt: { type: 'string', format: 'date-time' },
      },
      required: ['file', 'scope'],
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: Math.max(envConfig.MEDIA_MAX_IMAGE_BYTES, envConfig.MEDIA_MAX_VIDEO_BYTES),
    }
  }))
  async uploadTest(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: DevUploadBodyDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }

    // Infer resourceType from mimetype
    const resourceType: MediaResourceTypeValue = file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';

    // 1. Create Intent
    const intent = await this.createIntentUseCase.execute({
      scope: body.scope as MediaScopeValue,
      resourceType,
      contentType: file.mimetype,
      sizeBytes: file.size,
      fileName: file.originalname,
      captureSource: body.captureSource || 'UNKNOWN',
      clientCapturedAt: body.clientCapturedAt,
    }, activeUser);

    // 2. Direct Upload using Development Port Capability
    if (!this.storagePort.simulateDevUpload) {
      throw new HttpException('Storage provider does not support dev upload simulation', HttpStatus.NOT_IMPLEMENTED);
    }
    
    let providerResponse: { publicId: string, version: number, signature: string };
    try {
      providerResponse = await this.storagePort.simulateDevUpload({
        publicId: intent.upload.formFields.public_id,
        resourceType,
        deliveryType: intent.upload.formFields.type as 'upload' | 'authenticated',
        buffer: file.buffer,
      });
    } catch (error: unknown) {
      throw new HttpException(error instanceof Error ? error.message : 'Upload failed', HttpStatus.BAD_GATEWAY);
    }

    // 3. Complete Upload
    return this.completeUploadUseCase.execute(intent.mediaId, {
      publicId: providerResponse.publicId,
      version: providerResponse.version,
      signature: providerResponse.signature,
    }, activeUser);
  }
}
