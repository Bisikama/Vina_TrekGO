import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger'
import { Auth } from '../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { BookingsService } from './bookings.service'
import {
  bookingIdSchema,
  bookingKeySchema,
  bookingPageSchema,
  createBookingSchema,
  updateParticipantsSchema,
} from './booking.dto'
import type { BookingPage, CreateBookingInput, UpdateParticipantsInput } from './booking.dto'

@ApiTags('Bookings')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}
  @Post('trips/:tripId/bookings')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Param('tripId', new ZodValidationPipe(bookingIdSchema)) tripId: string,
    @Headers('idempotency-key') key: string,
    @Body(new ZodValidationPipe(createBookingSchema)) body: CreateBookingInput,
    @ActiveUser('id') userId: string,
  ) {
    new ZodValidationPipe(bookingKeySchema).transform(key, { type: 'custom' })
    return this.bookings.create(tripId, userId, key, body)
  }
  @Patch('bookings/:id/participants')
  update(
    @Param('id', new ZodValidationPipe(bookingIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateParticipantsSchema)) body: UpdateParticipantsInput,
    @ActiveUser('id') userId: string,
  ) {
    return this.bookings.updateParticipants(id, userId, body)
  }
  @Get('bookings')
  list(@Query(new ZodValidationPipe(bookingPageSchema)) query: BookingPage, @ActiveUser('id') userId: string) {
    return this.bookings.list(userId, query)
  }
  @Get('bookings/:id')
  detail(@Param('id', new ZodValidationPipe(bookingIdSchema)) id: string, @ActiveUser('id') userId: string) {
    return this.bookings.detail(id, userId)
  }
}

@ApiTags('Bookings internal')
@Auth([AuthType.ApiKey])
@Controller('internal/bookings')
export class BookingRentalContextController {
  constructor(private readonly bookings: BookingsService) {}
  @Get(':id/rental-context')
  context(@Param('id', new ZodValidationPipe(bookingIdSchema)) id: string) {
    return this.bookings.rentalContext(id)
  }
}
