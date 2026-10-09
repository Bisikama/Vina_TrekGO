import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_ORDERING_ERROR_CODES as RT } from 'src/shared/errors/codes/rental-ordering.error-codes';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ApiErrorResponse } from 'src/shared/swagger/api-error-response.helper';
import { CancelRentalOrderUseCase } from '../../application/use-cases/cancel-rental-order.use-case';
import { CreateRentalOrderUseCase } from '../../application/use-cases/create-rental-order.use-case';
import { CreateRentalPaymentUseCase } from '../../application/use-cases/create-rental-payment.use-case';
import { GetRentalOrderUseCase } from '../../application/use-cases/get-rental-order.use-case';
import { GetRentalPaymentUseCase } from '../../application/use-cases/get-rental-payment.use-case';
import { ListRentalOrdersUseCase } from '../../application/use-cases/list-rental-orders.use-case';
import { PreviewRentalCancellationUseCase } from '../../application/use-cases/preview-rental-cancellation.use-case';
import {
  CancelRentalOrderBodySchema,
  CreateRentalOrderBodySchema,
  ListRentalOrdersQuerySchema,
  RentalIdempotencyKeySchema,
  RentalOrderIdParamSchema,
  type CancelRentalOrderBodyDto,
  type CreateRentalOrderBodyDto,
  type ListRentalOrdersQueryDto,
  type RentalOrderIdParamDto,
} from '../dtos/rental-order.dto';

@ApiTags('Rental Orders - B2')
@ApiBearerAuth('bearer')
@Controller('rental-orders')
export class RentalOrderController {
  constructor(
    private readonly createOrderUseCase: CreateRentalOrderUseCase,
    private readonly listOrdersUseCase: ListRentalOrdersUseCase,
    private readonly getOrderUseCase: GetRentalOrderUseCase,
    private readonly createPaymentUseCase: CreateRentalPaymentUseCase,
    private readonly cancelOrderUseCase: CancelRentalOrderUseCase,
    private readonly getPaymentUseCase: GetRentalPaymentUseCase,
    private readonly previewCancellationUseCase: PreviewRentalCancellationUseCase,
  ) {}

  @Post()
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'RB-API-201 - Tạo order và giữ quantity atomically' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ schema: { type: 'object', required: ['quoteId'], properties: { quoteId: { type: 'string', format: 'uuid' } } } })
  @ApiResponse({ status: 201, description: 'order + quantityReservations; không có exact unit' })
  async createOrder(
    @Body(new ZodValidationPipe(CreateRentalOrderBodySchema)) body: CreateRentalOrderBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') userId: string,
  ) {
    return this.createOrderUseCase.execute({ userId, quoteId: body.quoteId, idempotencyKey: requireIdempotencyKey(rawKey) });
  }

  @Get()
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'RB-API-202 / RB-API-501 - Danh sách RentalOrder; B5 dùng cùng resource cho đơn đang thuê' })
  @ApiQuery({ name: 'tripId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'bookingId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listOrders(
    @Query(new ZodValidationPipe(ListRentalOrdersQuerySchema)) query: ListRentalOrdersQueryDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.listOrdersUseCase.execute({ userId, ...query });
  }

  @Get(':id')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.STAFF_INVENTORY, UserRole.STAFF_DELIVERY, UserRole.ADMIN)
  @ApiOperation({ summary: 'RB-API-203 / RB-API-502 - Chi tiết lifecycle RentalOrder' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getOrder(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @ActiveUser('id') actorUserId: string,
    @ActiveUser('role') actorRole: string,
  ) {
    return this.getOrderUseCase.execute({ actorUserId, actorRole, orderId: params.id });
  }

  @Post(':id/cancel')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'RB-API-205 - Hủy RentalOrder trước handover' })
  async cancelOrder(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @Body(new ZodValidationPipe(CancelRentalOrderBodySchema)) body: CancelRentalOrderBodyDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.cancelOrderUseCase.execute({ userId, orderId: params.id, ...body });
  }

  @Get(':id/payment')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'RB-API-206 - Trạng thái payment' })
  async getPayment(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.getPaymentUseCase.execute({ userId, orderId: params.id });
  }

  @Get(':id/cancellation-preview')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'RB-API-207 - Preview tiền hoàn trước khi cancel' })
  async previewCancellation(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.previewCancellationUseCase.execute({ userId, orderId: params.id });
  }
}

function requireIdempotencyKey(raw: string | undefined): string {
  const parsed = RentalIdempotencyKeySchema.safeParse(raw);
  if (!parsed.success) throw AppError.fromCode(RT.IDEMPOTENCY_KEY_REQUIRED);
  return parsed.data;
}
