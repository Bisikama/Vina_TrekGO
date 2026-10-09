import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ApiErrorResponse } from 'src/shared/swagger/api-error-response.helper';
import { CreateRentalQuoteUseCase } from '../../application/use-cases/create-rental-quote.use-case';
import { GetRentalAvailabilityUseCase } from '../../application/use-cases/get-rental-availability.use-case';
import {
  RentalAvailabilityQuerySchema,
  RentalQuoteBodySchema,
  type RentalAvailabilityQueryDto,
  type RentalQuoteBodyDto,
} from '../dtos/ordering.dto';

@ApiTags('Rental Ordering')
@ApiBearerAuth('bearer')
@Controller('rentals')
export class RentalOperationController {
  constructor(
    private readonly getRentalAvailabilityUseCase: GetRentalAvailabilityUseCase,
    private readonly createRentalQuoteUseCase: CreateRentalQuoteUseCase,
  ) {}

  @Get('availability')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER)
  @ApiOperation({
    summary: 'Kiểm tra số lượng thiết bị còn theo Trip/time window',
    description: `
RB-API-102.
- Server derive occupiedWindow từ Trip/logistics + RentalPolicy.
- Không có maxPerParticipant/maxPerGroup.
- availableCount là snapshot tham khảo; B2 phải recheck trong transaction.
`,
  })
  @ApiQuery({ name: 'tripId', required: true, format: 'uuid' })
  @ApiQuery({ name: 'productId', required: true, format: 'uuid' })
  @ApiQuery({ name: 'requestedReturnAt', required: false })
  @ApiQuery({ name: 'returnOptionId', required: false })
  @ApiResponse({ status: 200, description: 'Availability snapshot theo occupied window' })
  @ApiErrorResponse(404, 'Not Found', 'RENTAL_PRODUCT_NOT_FOUND', 'Không tìm thấy product ACTIVE')
  @ApiErrorResponse(
    422,
    'Unprocessable Entity',
    'TRIP_MEMBERSHIP_NOT_ELIGIBLE',
    'Trip membership không đủ điều kiện thuê',
  )
  async getAvailability(
    @Query(new ZodValidationPipe(RentalAvailabilityQuerySchema))
    query: RentalAvailabilityQueryDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.getRentalAvailabilityUseCase.execute({
      tripId: query.tripId,
      productId: query.productId,
      requestedReturnAt: query.requestedReturnAt ? new Date(query.requestedReturnAt) : undefined,
      returnOptionId: query.returnOptionId,
      userId,
    });
  }

  @Post('quote')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER)
  @ApiOperation({
    summary: 'Tạo báo giá thuê thiết bị',
    description: `
RB-API-103.
- Giá, cọc, chargedDays và currency do server tính.
- Quote chỉ snapshot giá/policy/context; KHÔNG giữ quantity và KHÔNG assign EquipmentUnit.
- Product trùng trong request được server gộp quantity deterministic.
`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tripId', 'items'],
      properties: {
        tripId: { type: 'string', format: 'uuid' },
        recipientTripMemberId: { type: 'string', format: 'uuid', nullable: true },
        requestedReturnAt: { type: 'string', format: 'date-time' },
        returnOptionId: { type: 'string' },
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['productId', 'quantity'],
            properties: {
              productId: { type: 'string', format: 'uuid' },
              quantity: { type: 'integer', minimum: 1 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Quote snapshot theo contract v0.2.0-final-flow' })
  @ApiErrorResponse(
    422,
    'Unprocessable Entity',
    'INSUFFICIENT_AVAILABLE_QUANTITY',
    'Quantity vượt availableCount hiện tại',
  )
  @ApiErrorResponse(
    422,
    'Unprocessable Entity',
    'RENTAL_CUTOFF_PASSED',
    'Đã qua rental cutoff',
  )
  async createQuote(
    @Body(new ZodValidationPipe(RentalQuoteBodySchema)) body: RentalQuoteBodyDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.createRentalQuoteUseCase.execute({
      userId,
      tripId: body.tripId,
      recipientTripMemberId: body.recipientTripMemberId,
      items: body.items,
      requestedReturnAt: body.requestedReturnAt ? new Date(body.requestedReturnAt) : undefined,
      returnOptionId: body.returnOptionId,
    });
  }
}