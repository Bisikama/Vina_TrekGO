import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { AuthType } from 'src/shared/constants/auth.constant'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_LIFECYCLE_ERROR_CODES as LC } from 'src/shared/errors/codes/rental-lifecycle.error-codes'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { ApiErrorResponse } from 'src/shared/swagger/api-error-response.helper'
import { HandleTripRescheduledUseCase } from '../../application/use-cases/handle-trip-rescheduled.use-case'
import { HandleTripCancelledUseCase } from '../../application/use-cases/handle-trip-cancelled.use-case'
import { HandleBookingCancelledUseCase } from '../../application/use-cases/handle-booking-cancelled.use-case'
import {
  tripRescheduledEventSchema,
  type TripRescheduledEventDto,
  tripCancelledEventSchema,
  type TripCancelledEventDto,
  bookingCancelledEventSchema,
  type BookingCancelledEventDto,
} from '../dtos/trip-lifecycle-event.dto'
import {
  BOOKING_CANCELLED_EVENT_SCHEMA,
  RENTAL_LIFECYCLE_EVENT_RESULT_SCHEMA,
  TRIP_CANCELLED_EVENT_SCHEMA,
  TRIP_RESCHEDULED_EVENT_SCHEMA,
} from '../rental-lifecycle-swagger.schemas'

function verifyInternalApiKey(apiKey?: string) {
  const configuredKey = process.env.RENTAL_INTEGRATION_API_KEY
  if (!configuredKey || !apiKey || apiKey !== configuredKey) {
    throw AppError.fromCode(LC.API_KEY_INVALID, {
      message: 'Unauthorized internal API access: missing or invalid x-api-key',
    })
  }
}

@ApiTags('Internal Rental Trip Lifecycle (Nội bộ: Tích hợp sự kiện Trip)')
@Controller('internal/rental/trip-events')
@Auth([AuthType.None])
@ApiSecurity('x-api-key')
export class TripLifecycleWebhookController {
  constructor(
    private readonly handleTripRescheduled: HandleTripRescheduledUseCase,
    private readonly handleTripCancelled: HandleTripCancelledUseCase,
    private readonly handleBookingCancelled: HandleBookingCancelledUseCase,
  ) {}

  @Post('reschedule')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'handleRentalTripRescheduled',
    summary: 'Xử lý sự kiện Trip Rescheduled từ Area A (Internal)',
    description:
      'Đồng bộ lịch vận hành, re-hold capacity và phát hành SCHEDULE_NOTICE nếu đơn đã giao. Trong Swagger, bấm Authorize và nhập RENTAL_INTEGRATION_API_KEY tại x-api-key trước khi Execute.',
  })
  @ApiBody({ description: 'Sự kiện TRIP_RESCHEDULED từ Area A', schema: TRIP_RESCHEDULED_EVENT_SCHEMA })
  @ApiResponse({
    status: 200,
    description: 'Sự kiện được xử lý hoặc bỏ qua an toàn theo eventId/entityVersion',
    schema: RENTAL_LIFECYCLE_EVENT_RESULT_SCHEMA,
  })
  @ApiErrorResponse(400, 'Payload không hợp lệ', 'VALIDATION_ERROR', 'Kiểm tra UUID, date-time và các field bắt buộc')
  @ApiErrorResponse(401, 'API key không hợp lệ', 'RENTAL_INTEGRATION_API_KEY_INVALID', 'Thiếu hoặc sai x-api-key')
  async reschedule(
    @Body(new ZodValidationPipe(tripRescheduledEventSchema))
    body: TripRescheduledEventDto,
    @Headers('x-api-key') apiKey?: string,
  ) {
    verifyInternalApiKey(apiKey)
    return this.handleTripRescheduled.execute(body)
  }

  @Post('cancel-trip')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'handleRentalTripCancelled',
    summary: 'Xử lý sự kiện Trip Cancelled / Trip Aborted từ Area A (Internal)',
    description:
      'Hủy đơn thuê trước giao (giải phóng hold/unit) hoặc chuyển ACTION_REQUIRED đối với đơn đang hoạt động. Yêu cầu x-api-key qua nút Authorize.',
  })
  @ApiBody({ description: 'Sự kiện TRIP_CANCELLED hoặc TRIP_ABORTED từ Area A', schema: TRIP_CANCELLED_EVENT_SCHEMA })
  @ApiResponse({
    status: 200,
    description: 'Sự kiện được xử lý hoặc bỏ qua an toàn theo eventId/entityVersion',
    schema: RENTAL_LIFECYCLE_EVENT_RESULT_SCHEMA,
  })
  @ApiErrorResponse(400, 'Payload không hợp lệ', 'VALIDATION_ERROR', 'Kiểm tra UUID, date-time và các field bắt buộc')
  @ApiErrorResponse(401, 'API key không hợp lệ', 'RENTAL_INTEGRATION_API_KEY_INVALID', 'Thiếu hoặc sai x-api-key')
  async cancelTrip(
    @Body(new ZodValidationPipe(tripCancelledEventSchema))
    body: TripCancelledEventDto,
    @Headers('x-api-key') apiKey?: string,
  ) {
    verifyInternalApiKey(apiKey)
    return this.handleTripCancelled.execute(body)
  }

  @Post('cancel-booking')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'handleRentalBookingCancelled',
    summary: 'Xử lý sự kiện Booking Cancelled từ Area A (Internal)',
    description:
      'Hủy đơn thuê trước giao theo bookingId hoặc chuyển ACTION_REQUIRED nếu đơn đã giao. Yêu cầu x-api-key qua nút Authorize.',
  })
  @ApiBody({ description: 'Sự kiện BOOKING_CANCELLED từ Area A', schema: BOOKING_CANCELLED_EVENT_SCHEMA })
  @ApiResponse({
    status: 200,
    description: 'Sự kiện được xử lý hoặc bỏ qua an toàn theo eventId/entityVersion',
    schema: RENTAL_LIFECYCLE_EVENT_RESULT_SCHEMA,
  })
  @ApiErrorResponse(400, 'Payload không hợp lệ', 'VALIDATION_ERROR', 'Kiểm tra UUID, date-time và các field bắt buộc')
  @ApiErrorResponse(401, 'API key không hợp lệ', 'RENTAL_INTEGRATION_API_KEY_INVALID', 'Thiếu hoặc sai x-api-key')
  async cancelBooking(
    @Body(new ZodValidationPipe(bookingCancelledEventSchema))
    body: BookingCancelledEventDto,
    @Headers('x-api-key') apiKey?: string,
  ) {
    verifyInternalApiKey(apiKey)
    return this.handleBookingCancelled.execute(body)
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    operationId: 'dispatchRentalTripLifecycleEvent',
    summary: 'Dispatcher chung nhận sự kiện vòng đời Trip từ Area A (Internal)',
    description:
      'Tự động phân luồng theo eventType: TRIP_RESCHEDULED, TRIP_CANCELLED, TRIP_ABORTED hoặc BOOKING_CANCELLED. Yêu cầu x-api-key qua nút Authorize.',
  })
  @ApiBody({
    description: 'Một trong các sự kiện lifecycle được hỗ trợ',
    schema: {
      oneOf: [TRIP_RESCHEDULED_EVENT_SCHEMA, TRIP_CANCELLED_EVENT_SCHEMA, BOOKING_CANCELLED_EVENT_SCHEMA],
      discriminator: { propertyName: 'eventType' },
      example: TRIP_RESCHEDULED_EVENT_SCHEMA.example,
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Sự kiện được điều phối và xử lý thành công',
    schema: RENTAL_LIFECYCLE_EVENT_RESULT_SCHEMA,
  })
  @ApiErrorResponse(400, 'Payload không hợp lệ', 'VALIDATION_ERROR', 'Payload không khớp schema của eventType')
  @ApiErrorResponse(401, 'API key không hợp lệ', 'RENTAL_INTEGRATION_API_KEY_INVALID', 'Thiếu hoặc sai x-api-key')
  @ApiErrorResponse(422, 'eventType không được hỗ trợ', 'RENTAL_LIFECYCLE_EVENT_UNSUPPORTED', 'eventType không nằm trong danh sách hỗ trợ')
  async dispatchGenericEvent(@Body() body: Record<string, unknown>, @Headers('x-api-key') apiKey?: string) {
    verifyInternalApiKey(apiKey)
    const eventType = body?.eventType

    switch (eventType) {
      case 'TRIP_RESCHEDULED': {
        const validated = new ZodValidationPipe(tripRescheduledEventSchema).transform(body, {
          type: 'body',
        }) as TripRescheduledEventDto
        return this.handleTripRescheduled.execute(validated)
      }
      case 'TRIP_CANCELLED':
      case 'TRIP_ABORTED': {
        const validated = new ZodValidationPipe(tripCancelledEventSchema).transform(body, {
          type: 'body',
        }) as TripCancelledEventDto
        return this.handleTripCancelled.execute(validated)
      }
      case 'BOOKING_CANCELLED': {
        const validated = new ZodValidationPipe(bookingCancelledEventSchema).transform(body, {
          type: 'body',
        }) as BookingCancelledEventDto
        return this.handleBookingCancelled.execute(validated)
      }
      default:
        throw AppError.fromCode(LC.UNSUPPORTED_EVENT, {
          message: `Unsupported eventType: ${String(eventType)}`,
        })
    }
  }
}
