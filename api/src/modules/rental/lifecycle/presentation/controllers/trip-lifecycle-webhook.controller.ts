import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthType } from 'src/shared/constants/auth.constant';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_LIFECYCLE_ERROR_CODES as LC } from 'src/shared/errors/codes/rental-lifecycle.error-codes';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { HandleTripRescheduledUseCase } from '../../application/use-cases/handle-trip-rescheduled.use-case';
import { HandleTripCancelledUseCase } from '../../application/use-cases/handle-trip-cancelled.use-case';
import { HandleBookingCancelledUseCase } from '../../application/use-cases/handle-booking-cancelled.use-case';
import {
  tripRescheduledEventSchema,
  type TripRescheduledEventDto,
  tripCancelledEventSchema,
  type TripCancelledEventDto,
  bookingCancelledEventSchema,
  type BookingCancelledEventDto,
} from '../dtos/trip-lifecycle-event.dto';

function verifyInternalApiKey(apiKey?: string) {
  const configuredKey = process.env.RENTAL_INTEGRATION_API_KEY;
  if (!configuredKey || !apiKey || apiKey !== configuredKey) {
    throw AppError.fromCode(LC.API_KEY_INVALID, {
      message: 'Unauthorized internal API access: missing or invalid x-api-key',
    });
  }
}

@ApiTags('Internal Rental Trip Lifecycle(Nội bộ: Tích hợp sự kiện Trip Area A)')
@Controller('internal/rental/trip-events')
@Auth([AuthType.None])
export class TripLifecycleWebhookController {
  constructor(
    private readonly handleTripRescheduled: HandleTripRescheduledUseCase,
    private readonly handleTripCancelled: HandleTripCancelledUseCase,
    private readonly handleBookingCancelled: HandleBookingCancelledUseCase,
  ) {}

  @Post('reschedule')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Xử lý sự kiện Trip Rescheduled từ Area A (Internal)',
    description: 'Đồng bộ dời lịch vận hành cho các đơn thuê thuộc chuyến đi, re-hold capacity và phát hành SCHEDULE_NOTICE nếu đơn đã giao.',
  })
  @ApiHeader({ name: 'x-api-key', required: false, description: 'Secret API key nội bộ' })
  @ApiResponse({ status: 200, description: 'Sự kiện được xử lý thành công hoặc bỏ qua idempotent' })
  @ApiResponse({ status: 400, description: 'Payload sự kiện không hợp lệ' })
  @ApiResponse({ status: 401, description: 'API key không hợp lệ' })
  async reschedule(
    @Body(new ZodValidationPipe(tripRescheduledEventSchema))
    body: TripRescheduledEventDto,
    @Headers('x-api-key') apiKey?: string,
  ) {
    verifyInternalApiKey(apiKey);
    return this.handleTripRescheduled.execute(body);
  }

  @Post('cancel-trip')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Xử lý sự kiện Trip Cancelled / Trip Aborted từ Area A (Internal)',
    description: 'Hủy đơn thuê trước giao (giải phóng hold/unit) hoặc chuyển ACTION_REQUIRED thu hồi đối với đơn đang hoạt động.',
  })
  @ApiHeader({ name: 'x-api-key', required: false, description: 'Secret API key nội bộ' })
  @ApiResponse({ status: 200, description: 'Sự kiện được xử lý thành công hoặc bỏ qua idempotent' })
  @ApiResponse({ status: 400, description: 'Payload sự kiện không hợp lệ' })
  @ApiResponse({ status: 401, description: 'API key không hợp lệ' })
  async cancelTrip(
    @Body(new ZodValidationPipe(tripCancelledEventSchema))
    body: TripCancelledEventDto,
    @Headers('x-api-key') apiKey?: string,
  ) {
    verifyInternalApiKey(apiKey);
    return this.handleTripCancelled.execute(body);
  }

  @Post('cancel-booking')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Xử lý sự kiện Booking Cancelled từ Area A (Internal)',
    description: 'Hủy đơn thuê trước giao theo bookingId hoặc chuyển ACTION_REQUIRED nếu đơn đã giao.',
  })
  @ApiHeader({ name: 'x-api-key', required: false, description: 'Secret API key nội bộ' })
  @ApiResponse({ status: 200, description: 'Sự kiện được xử lý thành công hoặc bỏ qua idempotent' })
  @ApiResponse({ status: 400, description: 'Payload sự kiện không hợp lệ' })
  @ApiResponse({ status: 401, description: 'API key không hợp lệ' })
  async cancelBooking(
    @Body(new ZodValidationPipe(bookingCancelledEventSchema))
    body: BookingCancelledEventDto,
    @Headers('x-api-key') apiKey?: string,
  ) {
    verifyInternalApiKey(apiKey);
    return this.handleBookingCancelled.execute(body);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Dispatcher chung nhận sự kiện vòng đời Trip từ Area A (Internal)',
    description: 'Tự động phân luồng sự kiện theo trường eventType (TRIP_RESCHEDULED, TRIP_CANCELLED, TRIP_ABORTED, BOOKING_CANCELLED).',
  })
  @ApiHeader({ name: 'x-api-key', required: false, description: 'Secret API key nội bộ' })
  @ApiResponse({ status: 200, description: 'Sự kiện được điều phối và xử lý thành công' })
  @ApiResponse({ status: 422, description: 'eventType không được hỗ trợ' })
  async dispatchGenericEvent(
    @Body() body: Record<string, unknown>,
    @Headers('x-api-key') apiKey?: string,
  ) {
    verifyInternalApiKey(apiKey);
    const eventType = body?.eventType;

    switch (eventType) {
      case 'TRIP_RESCHEDULED': {
        const validated = tripRescheduledEventSchema.parse(body);
        return this.handleTripRescheduled.execute(validated);
      }
      case 'TRIP_CANCELLED':
      case 'TRIP_ABORTED': {
        const validated = tripCancelledEventSchema.parse(body);
        return this.handleTripCancelled.execute(validated);
      }
      case 'BOOKING_CANCELLED': {
        const validated = bookingCancelledEventSchema.parse(body);
        return this.handleBookingCancelled.execute(validated);
      }
      default:
        throw AppError.fromCode(LC.UNSUPPORTED_EVENT, {
          message: `Unsupported eventType: ${String(eventType)}`,
        });
    }
  }
}
