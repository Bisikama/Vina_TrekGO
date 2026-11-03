import { Module } from '@nestjs/common'
import { SharedModule } from 'src/shared/shared.module'
import { RENTAL_REVIEW_PORT } from './application/ports/rental-review.port'
import { CreateRentalReviewUseCase } from './application/use-cases/create-rental-review.use-case'
import { GetOrderReviewableUseCase } from './application/use-cases/get-order-reviewable.use-case'
import { ListProductReviewsUseCase } from './application/use-cases/list-product-reviews.use-case'
import { PrismaRentalReviewAdapter } from './infrastructure/adapters/prisma-rental-review.adapter'
import { RentalReviewController } from './presentation/controllers/rental-review.controller'

@Module({
  imports: [SharedModule],
  controllers: [RentalReviewController],
  providers: [
    CreateRentalReviewUseCase,
    ListProductReviewsUseCase,
    GetOrderReviewableUseCase,
    { provide: RENTAL_REVIEW_PORT, useClass: PrismaRentalReviewAdapter },
  ],
})
export class RentalReviewModule {}
