import { Test, TestingModule } from '@nestjs/testing';
 
import { PrismaMediaReferenceAdapter } from './prisma-media-reference.adapter';
import { PrismaService } from '../../../../shared/services/prisma.service';

describe('PrismaMediaReferenceAdapter', () => {
  let adapter: PrismaMediaReferenceAdapter;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaMediaReferenceAdapter,
        {
          provide: PrismaService,
          useValue: {
            leaderCertificate: { count: jest.fn().mockResolvedValue(0) },
            rentalProduct: { count: jest.fn() },
            conditionSnapshot: { count: jest.fn() },
            returnInspection: { count: jest.fn() },
            returnInspectionFinding: { count: jest.fn() },
            rentalExceptionCase: { count: jest.fn() },
          },
        },
      ],
    }).compile();

    adapter = module.get<PrismaMediaReferenceAdapter>(PrismaMediaReferenceAdapter);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PostgreSQL JSON Reference Check', () => {
    it('should query using array_contains: [mediaId]', async () => {
      (prismaService.rentalProduct.count as jest.Mock).mockResolvedValue(0);
      (prismaService.conditionSnapshot.count as jest.Mock).mockResolvedValue(0);
      (prismaService.returnInspection.count as jest.Mock).mockResolvedValue(0);
      (prismaService.returnInspectionFinding.count as jest.Mock).mockResolvedValue(0);
      (prismaService.rentalExceptionCase.count as jest.Mock).mockResolvedValue(0);

      await adapter.hasActiveReferences('media-a');

      expect(prismaService.rentalProduct.count).toHaveBeenCalledWith({
        where: { images: { array_contains: ['media-a'] } },
      });
      expect(prismaService.conditionSnapshot.count).toHaveBeenCalledWith({
        where: { evidenceIds: { array_contains: ['media-a'] } },
      });
      expect(prismaService.returnInspection.count).toHaveBeenCalledWith({
        where: { evidenceIds: { array_contains: ['media-a'] } },
      });
      expect(prismaService.returnInspectionFinding.count).toHaveBeenCalledWith({
        where: { evidenceIds: { array_contains: ['media-a'] } },
      });
      expect(prismaService.rentalExceptionCase.count).toHaveBeenCalledWith({
        where: { evidenceIds: { array_contains: ['media-a'] } },
      });
    });

    it('should return true if any reference exists', async () => {
      (prismaService.rentalProduct.count as jest.Mock).mockResolvedValue(0);
      (prismaService.conditionSnapshot.count as jest.Mock).mockResolvedValue(1);

      const result = await adapter.hasActiveReferences('media-a');

      expect(result).toBe(true);
    });

    it('should fail closed and return true on query failure', async () => {
      (prismaService.rentalProduct.count as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const result = await adapter.hasActiveReferences('media-a');

      expect(result).toBe(true);
    });
  });
});
