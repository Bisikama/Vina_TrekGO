import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { MEDIA_ASSET_PORT } from './application/ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from './application/ports/media-storage.port';
import { PrismaMediaAssetAdapter } from './infrastructure/adapters/prisma-media-asset.adapter';
import { CloudinaryStorageAdapter } from './infrastructure/adapters/cloudinary-storage.adapter';
import { CreateUploadIntentUseCase } from './application/use-cases/create-upload-intent.use-case';
import { CompleteUploadUseCase } from './application/use-cases/complete-upload.use-case';
import { GetMediaDeliveryUseCase } from './application/use-cases/get-media-delivery.use-case';
import { MediaController } from './presentation/media.controller';
import { MediaPolicyService } from './application/policies/media.policy';
import { MEDIA_PROVENANCE_PORT } from './application/ports/media-provenance.port';
import { MediaProvenanceAdapter } from './infrastructure/adapters/media-provenance.adapter';
import { MEDIA_REFERENCE_PORT } from './application/ports/media-reference.port';
import { PrismaMediaReferenceAdapter } from './infrastructure/adapters/prisma-media-reference.adapter';
import { RequestMediaDeletionUseCase } from './application/use-cases/request-media-deletion.use-case';
import { MediaCleanupUseCase } from './application/use-cases/media-cleanup.use-case';
import { MediaCleanupScheduler } from './infrastructure/jobs/media-cleanup.scheduler';
import { DevMediaController } from './presentation/dev-media.controller';

import envConfig from '../../shared/config';

const controllers: Array<typeof MediaController | typeof DevMediaController> = [MediaController];
if (envConfig.NODE_ENV !== 'production' && envConfig.MEDIA_DEV_UPLOAD_ENABLED) {
  controllers.push(DevMediaController);
}

@Module({
  controllers,
  providers: [
    PrismaService,
    {
      provide: MEDIA_ASSET_PORT,
      useClass: PrismaMediaAssetAdapter,
    },
    {
      provide: MEDIA_STORAGE_PORT,
      useClass: CloudinaryStorageAdapter,
    },
    {
      provide: MEDIA_PROVENANCE_PORT,
      useClass: MediaProvenanceAdapter,
    },
    {
      provide: MEDIA_REFERENCE_PORT,
      useClass: PrismaMediaReferenceAdapter,
    },
    CreateUploadIntentUseCase,
    CompleteUploadUseCase,
    GetMediaDeliveryUseCase,
    RequestMediaDeletionUseCase,
    MediaCleanupUseCase,
    MediaCleanupScheduler,
    MediaPolicyService,
  ],
  exports: [MEDIA_ASSET_PORT, MEDIA_STORAGE_PORT, MEDIA_PROVENANCE_PORT, MEDIA_REFERENCE_PORT],
})
export class MediaModule {}
