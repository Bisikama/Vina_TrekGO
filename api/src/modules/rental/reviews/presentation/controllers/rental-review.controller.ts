import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { UserRole } from 'src/shared/constants'
import { AuthType } from 'src/shared/constants/auth.constant'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_REVIEW_ERROR_CODES as RV } from 'src/shared/errors/codes/rental-review.error-codes'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { ApiErrorResponse } from 'src/shared/swagger/api-error-response.helper'
import { CreateRentalReviewUseCase } from '../../application/use-cases/create-rental-review.use-case'
import { GetOrderReviewableUseCase } from '../../application/use-cases/get-order-reviewable.use-case'
import { ListProductReviewsUseCase } from '../../application/use-cases/list-product-reviews.use-case'
import {
  CreateRentalReviewBodySchema,
  ListProductReviewsQuerySchema,
  RentalReviewOrderParamSchema,
  RentalReviewProductParamSchema,
  type CreateRentalReviewBodyDto,
  type ListProductReviewsQueryDto,
  type RentalReviewOrderParamDto,
  type RentalReviewProductParamDto,
} from '../dtos/rental-review.dto'

@ApiTags('Rental Product Reviews')
@Controller()
export class RentalReviewController {
  constructor(
    private readonly createReviewUseCase: CreateRentalReviewUseCase,
    private readonly listProductReviewsUseCase: ListProductReviewsUseCase,
    private readonly getOrderReviewableUseCase: GetOrderReviewableUseCase,
  ) {}

  @Post('rental-orders/:orderId/reviews')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    operationId: 'createRentalProductReview',
    summary: 'Đánh giá một sản phẩm đã thực nhận trong đơn thuê',
    description:
      'Mỗi người thuê chỉ được tạo một review cho mỗi product trong một order. Server tự xác minh ownership và chứng cứ bàn giao; comment là plain text.',
  })
  @ApiParam({ name: 'orderId', type: String, format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khóa retry-safe từ 8 đến 200 ký tự; giữ nguyên key khi gửi lại cùng payload',
  })
  @ApiBody({
    description: 'Nội dung đánh giá sản phẩm thuê đã thực nhận',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['productId', 'rating'],
      properties: {
        productId: { type: 'string', format: 'uuid', description: 'ID sản phẩm thuê đã nhận trong đơn', example: '550e8400-e29b-41d4-a716-446655440102' },
        rating: { type: 'integer', minimum: 1, maximum: 5, description: 'Đánh giá từ 1 đến 5 sao', example: 5 },
        comment: { type: 'string', nullable: true, maxLength: 2000, description: 'Nhận xét chi tiết về chất lượng sản phẩm', example: 'Lều rất chắc chắn, chống mưa tốt trên đỉnh Bidoup, dễ lắp ráp.' },
      },
      example: {
        productId: '550e8400-e29b-41d4-a716-446655440102',
        rating: 5,
        comment: 'Lều rất chắc chắn, chống mưa tốt trên đỉnh Bidoup, dễ lắp ráp.',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Review sản phẩm đã được tạo' })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'Payload review không hợp lệ')
  @ApiErrorResponse(404, 'Không tìm thấy đơn thuộc user', RV.RENTAL_ORDER_NOT_FOUND, 'Rental order not found')
  @ApiErrorResponse(409, 'Không đủ điều kiện hoặc đã review', RV.RENTAL_REVIEW_ALREADY_EXISTS)
  createReview(
    @Param(new ZodValidationPipe(RentalReviewOrderParamSchema)) params: RentalReviewOrderParamDto,
    @Body(new ZodValidationPipe(CreateRentalReviewBodySchema)) body: CreateRentalReviewBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') userId: string,
  ) {
    return this.createReviewUseCase.execute({
      orderId: params.orderId,
      userId,
      productId: body.productId,
      rating: body.rating,
      comment: body.comment,
      idempotencyKey: requireIdempotencyKey(rawKey),
    })
  }

  @Get('rental-products/:productId/reviews')
  @Auth([AuthType.None])
  @ApiOperation({
    operationId: 'listRentalProductReviews',
    summary: 'Xem review công khai của sản phẩm thuê',
    description:
      'Summary luôn tính trên toàn bộ review đã xác minh của sản phẩm; rating chỉ lọc danh sách và pagination. userName dùng nhãn ẩn danh để không công khai PII.',
  })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, default: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 50, default: 10 })
  @ApiQuery({ name: 'rating', required: false, type: Number, minimum: 1, maximum: 5 })
  @ApiResponse({ status: 200, description: 'Summary, danh sách review và pagination' })
  @ApiErrorResponse(404, 'Sản phẩm không public', 'RENTAL_PRODUCT_NOT_FOUND', 'Rental product not found')
  listProductReviews(
    @Param(new ZodValidationPipe(RentalReviewProductParamSchema)) params: RentalReviewProductParamDto,
    @Query(new ZodValidationPipe(ListProductReviewsQuerySchema)) query: ListProductReviewsQueryDto,
  ) {
    return this.listProductReviewsUseCase.execute({ productId: params.productId, ...query })
  }

  @Get('rental-orders/:orderId/reviewable-items')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    operationId: 'getRentalOrderReviewableItems',
    summary: 'Xem trạng thái review của từng sản phẩm trong đơn thuê',
  })
  @ApiParam({ name: 'orderId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Danh sách item và trạng thái bàn giao/review' })
  @ApiErrorResponse(404, 'Không tìm thấy đơn thuộc user', RV.RENTAL_ORDER_NOT_FOUND, 'Rental order not found')
  getOrderReviewableItems(
    @Param(new ZodValidationPipe(RentalReviewOrderParamSchema)) params: RentalReviewOrderParamDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.getOrderReviewableUseCase.execute({ orderId: params.orderId, userId })
  }
}

function requireIdempotencyKey(rawKey: string | undefined): string {
  if (!rawKey) throw AppError.fromCode(RV.RENTAL_REVIEW_IDEMPOTENCY_KEY_REQUIRED)
  const key = rawKey.trim()
  if (key.length < 8 || key.length > 200) {
    throw AppError.fromCode(RV.RENTAL_REVIEW_IDEMPOTENCY_KEY_INVALID)
  }
  return key
}
