import { Module } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { MEDIA_ASSET_PORT } from './application/ports/media-asset.port';
import { MEDIA_STORAGE_PORT } from './application/ports/media-storage.port';
import { PrismaMediaAssetAdapter } from './infrastructure/adapters/prisma-media-asset.adapter';
import { CloudinaryStorageAdapter } from './infrastructure/adapters/cloudinary-storage.adapter';

@Module({
  providers: [
    PrismaService,
    {
      provide: MEDIA_ASSET_PORT,
      useClass: PrismaMediaAssetAdapter,
    },
    {
      provide: MEDIA_STORAGE_PORT,
      useClass: CloudinaryStorageAdapter,
    }
  ],
  exports: [MEDIA_ASSET_PORT, MEDIA_STORAGE_PORT],
})
export class MediaModule {}
