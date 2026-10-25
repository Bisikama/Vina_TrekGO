import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBookingLinkage } from './public-invitations.swagger'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
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

const bodySchema = (schema: z.ZodType) => {
  const { $schema, ...json } = z.toJSONSchema(schema, { target: 'openapi-3.0' })
  return json as SchemaObject
}

@ApiTags('Bookings')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}
  @Post('trips/:tripId/bookings')
  @ApiHeader({ name: 'idempotency-key', required: true, example: 'cf02-booking-001' })
  @ApiBody({
    required: true,
    description: 'participantCount must match participants.length. New participants must not include id.',
    schema: {
      ...bodySchema(createBookingSchema),
      example: {
        participantCount: 1,
        participants: [{ fullName: 'Nguyen Van A', phone: '0900000001' }],
      },
    },
  })
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
  @ApiBody({
    required: true,
    description:
      'Send the current booking version and the full participant list. Include existing participant IDs to preserve them; omitted participants are cancelled.',
    schema: {
      ...bodySchema(updateParticipantsSchema),
      example: {
        expectedVersion: 1,
        participantCount: 1,
        participants: [{ id: '00000000-0000-4000-8000-000000000001', fullName: 'Nguyen Van A', phone: '0900000001' }],
      },
    },
  })
  update(
    @Param('id', new ZodValidationPipe(bookingIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateParticipantsSchema)) body: UpdateParticipantsInput,
    @ActiveUser('id') userId: string,
  ) {
    return this.bookings.updateParticipants(id, userId, body)
  }
  @Get('bookings')
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 12 } })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'CHECKED_IN', 'PARTIAL_CHECKIN', 'COMPLETED', 'NO_SHOW'] })
  list(@Query(new ZodValidationPipe(bookingPageSchema)) query: BookingPage, @ActiveUser('id') userId: string) {
    return this.bookings.list(userId, query)
  }
  @Get('bookings/:id')
  @ApiBookingLinkage()
  @ApiOperation({ summary: 'Get own booking detail', description: 'Includes payment and refunds. After cancellation, poll this endpoint for refunds[].refundId and status; refund creation is asynchronous.' })
  detail(@Param('id', new ZodValidationPipe(bookingIdSchema)) id: string, @ActiveUser('id') userId: string) {
    return this.bookings.detail(id, userId)
  }
}

@ApiTags('Bookings internal')
@ApiSecurity('x-api-key')
@Auth([AuthType.ApiKey])
@Controller('internal/bookings')
export class BookingRentalContextController {
  constructor(private readonly bookings: BookingsService) {}
  @Get(':id/rental-context')
  context(@Param('id', new ZodValidationPipe(bookingIdSchema)) id: string) {
    return this.bookings.rentalContext(id)
  }
}
