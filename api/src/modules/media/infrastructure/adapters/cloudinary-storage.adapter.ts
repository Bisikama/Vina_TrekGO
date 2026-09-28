import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { MediaStoragePort } from '../../application/ports/media-storage.port';
import envConfig from 'src/shared/config';

@Injectable()
export class CloudinaryStorageAdapter implements MediaStoragePort, OnModuleInit {
  private readonly logger = new Logger(CloudinaryStorageAdapter.name);

  onModuleInit() {
    const cloudName = envConfig.CLOUDINARY_CLOUD_NAME;
    const apiKey = envConfig.CLOUDINARY_API_KEY;
    const apiSecret = envConfig.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn('Cloudinary configuration is missing. Media upload will not work.');
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
}
