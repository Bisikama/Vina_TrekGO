import { Body, Controller, Param, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
import { ActiveUser } from '../../../shared/decorators/active-user.decorator'
import { Auth } from '../../../shared/decorators/auth.decorator'
import { Roles } from '../../../shared/decorators/roles.decorator'
import { AuthType } from '../../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe'
import type { Actor } from '../application/trip.types'
import { PublicTripImagesService } from './public-trip-images.service'
import { publicTripImageIdSchema, publicTripImagesSchema, publicTripImagesResponseSchema,
  type PublicTripImagesInput } from './public-trip-images.dto'

@Controller('leader/public-trips')
@Auth([AuthType.Bearer])
@Roles('LEADER')
@ApiBearerAuth('bearer')
@ApiTags('CF01 Public Trip Images')
export class PublicTripImagesController {
  constructor(private readonly images: PublicTripImagesService) {}

  @Put(':id/images')
  @ApiOperation({ summary: 'Thay thế gallery public trip (0–10 ảnh), ảnh đầu là ảnh bìa',
    description: 'LEADER ACTIVE sở hữu trip; DRAFT/OPEN/FULL/CLOSED. Media phải READY, PUBLIC_TRIP, IMAGE và thuộc leader. Tăng version một lần; dùng version mới cho thao tác tiếp theo.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBody({ schema: z.toJSONSchema(publicTripImagesSchema) as SchemaObject })
  @ApiResponse({ status: 200, schema: z.toJSONSchema(publicTripImagesResponseSchema) as SchemaObject })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN' })
  @ApiResponse({ status: 404, description: 'PUBLIC_TRIP_IMAGES_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'PUBLIC_TRIP_IMAGES_LOCKED / PUBLIC_TRIP_IMAGES_VERSION_CONFLICT' })
  @ApiResponse({ status: 422, description: 'PUBLIC_TRIP_IMAGES_INVALID_MEDIA' })
  replace(
    @ActiveUser() actor: Actor,
    @Param('id', new ZodValidationPipe(publicTripImageIdSchema)) tripId: string,
    @Body(new ZodValidationPipe(publicTripImagesSchema)) input: PublicTripImagesInput,
  ) {
    return this.images.replace(actor, tripId, input)
  }
}
