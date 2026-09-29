import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { MediaStoragePort, CreateUploadIntentInput, CreateProviderUploadIntentResult, VerifyUploadResponseInput, GetAssetMetadataInput, ProviderAssetMetadata } from '../../application/ports/media-storage.port';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import envConfig from '../../../../shared/config';

interface CloudinaryError {
  http_code?: number;
  message?: string;
}

function isCloudinaryError(error: unknown): error is CloudinaryError {
  return typeof error === 'object' && error !== null;
}

@Injectable()
export class CloudinaryStorageAdapter implements MediaStoragePort, OnModuleInit {
  private readonly logger = new Logger(CloudinaryStorageAdapter.name);

  onModuleInit() {
    const cloudName = envConfig.CLOUDINARY_CLOUD_NAME;
    const apiKey = envConfig.CLOUDINARY_API_KEY;
    const apiSecret = envConfig.CLOUDINARY_API_SECRET;

    if (!envConfig.MEDIA_ENABLED || !cloudName || !apiKey || !apiSecret) {
      this.logger.warn('Cloudinary configuration is missing or Media is disabled. Media upload will not work.');
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      signature_algorithm: envConfig.CLOUDINARY_SIGNATURE_ALGORITHM || 'sha256',
    });

    this.logger.log(`Cloudinary initialized for cloud: ${cloudName}`);
  }

  createUploadIntent(input: CreateUploadIntentInput): Promise<CreateProviderUploadIntentResult> {
    const paramsToSign = {
      public_id: input.publicId,
      type: input.deliveryType,
      timestamp: input.timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, envConfig.CLOUDINARY_API_SECRET!);
    
    const resourceTypeStr = input.resourceType === 'IMAGE' ? 'image' : 'video';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${envConfig.CLOUDINARY_CLOUD_NAME}/${resourceTypeStr}/upload`;

    return Promise.resolve({
      provider: 'CLOUDINARY',
      uploadUrl,
      method: 'POST',
      formFields: {
        api_key: envConfig.CLOUDINARY_API_KEY!,
        timestamp: input.timestamp,
        signature,
        public_id: input.publicId,
        type: input.deliveryType,
      },
      resourceType: input.resourceType,
    });
  }

  verifyUploadResponse(input: VerifyUploadResponseInput): Promise<boolean> {
    try {
      // @ts-expect-error cloudinary types missing verify_api_response_signature
      const isValid = cloudinary.utils.verify_api_response_signature(
        input.publicId,
        input.version,
        input.signature
      );
      return Promise.resolve(isValid);
    } catch (err) {
      this.logger.error('Failed to verify Cloudinary upload response signature', err);
      return Promise.resolve(false);
    }
  }

  async getAssetMetadata(input: GetAssetMetadataInput): Promise<ProviderAssetMetadata | null> {
    try {
      const resourceTypeStr = input.resourceType === 'IMAGE' ? 'image' : 'video';
      
      const result = await cloudinary.api.resource(input.publicId, {
        resource_type: resourceTypeStr,
        type: input.deliveryType,
      });

      return {
        providerAssetId: result.asset_id,
        providerPublicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        width: result.width || null,
        height: result.height || null,
        durationMs: result.duration ? Math.round(result.duration * 1000) : null,
        secureUrl: result.secure_url,
        resourceType: result.resource_type === 'video' ? 'VIDEO' : 'IMAGE',
        deliveryType: result.type as 'upload' | 'authenticated',
        providerUploadedAt: result.created_at ? new Date(result.created_at) : undefined,
      };
    } catch (error: unknown) {
      if (isCloudinaryError(error)) {
        if (error.http_code === 404) {
          return null;
        }
        
        this.logger.error(`Error fetching Cloudinary asset metadata for ${input.publicId}`, {
          publicId: input.publicId,
          http_code: error.http_code,
          // Do not expose raw Cloudinary error message down to the API consumer, only log it
        });
      } else {
        this.logger.error(`Unknown error fetching Cloudinary asset metadata for ${input.publicId}`, error);
      }

      throw new AppError({
        code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR,
        message: 'Provider lookup failed',
      });
    }
  }
}
