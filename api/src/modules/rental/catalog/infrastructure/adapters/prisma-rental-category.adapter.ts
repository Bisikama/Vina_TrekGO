import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { RecordStatus } from '@prisma/client';
import type {
  ListRentalCategoriesParams,
  RentalCategoryPort,
  RentalCategoryView,
} from '../../application/ports/rental-category.port';

@Injectable()
export class PrismaRentalCategoryAdapter implements RentalCategoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveCategories(params: ListRentalCategoriesParams): Promise<{ items: RentalCategoryView[]; total: number }> {
    const { page, pageSize } = params;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where = { status: RecordStatus.ACTIVE };

    const [items, total] = await Promise.all([
      this.prisma.rentalCategory.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          status: true,
        },
      }),
      this.prisma.rentalCategory.count({ where }),
    ]);

    return {
      items,
      total,
    };
  }

  async getCategoryById(id: string): Promise<RentalCategoryView | null> {
    const category = await this.prisma.rentalCategory.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
      },
    });
    return category;
  }
}
