import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { MediaReferencePort } from '../../application/ports/media-reference.port';

@Injectable()
export class PrismaMediaReferenceAdapter implements MediaReferencePort {
  private readonly logger = new Logger(PrismaMediaReferenceAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async isPublishedRentalEvidenceForOwner(mediaId: string, userId: string): Promise<boolean> {
    return (await this.prisma.rentalExceptionCase.count({
      where: {
        order: { userId }, status: 'RESOLVED',
        OR: [{ resolution: { startsWith: 'APPROVE_DEDUCTION:' } }, { resolution: { startsWith: 'CONFIRM_LOST:' } }],
        evidenceIds: { array_contains: [mediaId] },
      },
    })) > 0;
  }

  async hasActiveReferences(mediaId: string): Promise<boolean> {
    try {
      if (await this.prisma.leaderCertificate.count({ where: { mediaAssetId: mediaId } })) return true;
      // TECHNICAL DEBT: Currently, Rental entities store media IDs inside unstructured JSON arrays
      // instead of using explicit relational join tables (e.g., ConditionSnapshot.evidenceIds).
      // We use Prisma's JSON filtering (array_contains) to detect active references.
      
      // 1. RentalProduct images
      const productCount = await this.prisma.rentalProduct.count({
        where: {
          images: {
            array_contains: [mediaId]
          }
        }
      });
      if (productCount > 0) return true;

      // 2. ConditionSnapshot evidenceIds
      const snapshotCount = await this.prisma.conditionSnapshot.count({
        where: {
          evidenceIds: {
            array_contains: [mediaId]
          }
        }
      });
      if (snapshotCount > 0) return true;

      // 3. ReturnInspection evidenceIds
      const inspectionCount = await this.prisma.returnInspection.count({
        where: {
          evidenceIds: {
            array_contains: [mediaId]
          }
        }
      });
      if (inspectionCount > 0) return true;

      // 4. ReturnInspectionFinding evidenceIds
      const findingCount = await this.prisma.returnInspectionFinding.count({
        where: {
          evidenceIds: {
            array_contains: [mediaId]
          }
        }
      });
      if (findingCount > 0) return true;

      // 5. RentalExceptionCase evidenceIds
      const exceptionCount = await this.prisma.rentalExceptionCase.count({
        where: {
          evidenceIds: {
            array_contains: [mediaId]
          }
        }
      });
      if (exceptionCount > 0) return true;

      return false;
    } catch (error) {
      this.logger.error(`Error checking media references for ${mediaId}. Context: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fail closed: assume referenced if query fails
      return true;
    }
  }
}
