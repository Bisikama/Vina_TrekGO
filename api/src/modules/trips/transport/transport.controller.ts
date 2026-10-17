import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
import { Auth } from '../../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../../shared/decorators/active-user.decorator'
import { Roles } from '../../../shared/decorators/roles.decorator'
import { AuthType } from '../../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe'
import { TransportService } from './transport.service'
import { providerSchema, providerUpdateSchema, providerPageSchema, transportCreateSchema, transportUpdateSchema, transportIdSchema } from './transport.dto'
import type { ProviderInput, ProviderUpdate, ProviderPage, TransportInput, TransportUpdate } from './transport.dto'

const schema = (value: z.ZodType): SchemaObject => {
  const { $schema, ...json } = z.toJSONSchema(value, { target: 'openapi-3.0' })
  return json as SchemaObject
}
const uuid = z.string().uuid()
const date = z.string().datetime()
const providerView = z.object({
  id: uuid, name: z.string(), contactName: z.string().nullable(), phone: z.string().nullable(),
  email: z.string().nullable(), status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']), createdAt: date, updatedAt: date,
})
const transportView = z.object({
  id: uuid, tripId: uuid, providerId: uuid.nullable(), providerName: z.string().nullable(),
  pickupPointId: uuid, returnPointId: uuid.nullable(), sequence: z.number().int(),
  sourceType: z.string(), vehicleType: z.string(), seatCapacity: z.number().int(),
  plateNumber: z.string().nullable(), driverName: z.string().nullable(), driverPhone: z.string().nullable(),
  meetingAt: date, departureAt: date.nullable(), returnAt: date.nullable(),
  status: z.string(), note: z.string().nullable(), version: z.number().int(), createdAt: date, updatedAt: date,
})
const idParam = (name: string) => ApiParam({ name, schema: { type: 'string', format: 'uuid' } })

@Controller('admin')
@ApiTags('Admin trip transport')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles('ADMIN')
@ApiResponse({ status: 400, description: 'VALIDATION_ERROR — dữ liệu hoặc giờ đón/về không hợp lệ; shared error/meta envelope.' })
@ApiResponse({ status: 403, description: 'FORBIDDEN — cần ADMIN ACTIVE.' })
@ApiResponse({ status: 404, description: 'TRIP_TRANSPORT_NOT_FOUND' })
@ApiResponse({ status: 409, description: 'TRIP_TRANSPORT_LOCKED / TRIP_TRANSPORT_VERSION_CONFLICT / TRIP_TRANSPORT_PROVIDER_UNAVAILABLE' })
export class TransportController {
  constructor(private readonly service: TransportService) {}

  @Get('transport-providers')
  @ApiOperation({ summary: 'Danh bạ nhà xe bên ngoài' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'INACTIVE'] })
  @ApiResponse({ status: 200, schema: schema(z.object({ items: z.array(providerView), total: z.number(), page: z.number(), pageSize: z.number() })) })
  providers(@ActiveUser('id') actor: string, @Query(new ZodValidationPipe(providerPageSchema)) query: ProviderPage) {
    return this.service.providers(actor, query)
  }
  @Post('transport-providers')
  @ApiOperation({ summary: 'Thêm nhà xe vào danh bạ', description: 'Chỉ lưu liên hệ, không tạo tài khoản nhà xe hoặc quản lý đội xe.' })
  @ApiBody({ schema: schema(providerSchema) })
  @ApiResponse({ status: 201, schema: schema(providerView) })
  createProvider(@ActiveUser('id') actor: string, @Body(new ZodValidationPipe(providerSchema)) body: ProviderInput) {
    return this.service.createProvider(actor, body)
  }
  @Patch('transport-providers/:id')
  @idParam('id')
  @ApiOperation({ summary: 'Sửa liên hệ hoặc ngừng hợp tác với nhà xe', description: 'INACTIVE chặn bố trí mới; giữ nguyên các xe đã ghi nhận.' })
  @ApiBody({ schema: schema(providerUpdateSchema) })
  @ApiResponse({ status: 200, schema: schema(providerView) })
  updateProvider(@ActiveUser('id') actor: string, @Param('id', new ZodValidationPipe(transportIdSchema)) id: string,
    @Body(new ZodValidationPipe(providerUpdateSchema)) body: ProviderUpdate) {
    return this.service.updateProvider(actor, id, body)
  }
  @Get('public-trips/:tripId/transports')
  @idParam('tripId')
  @ApiOperation({ summary: 'Xem các xe của trip, bao gồm xe đã hủy' })
  @ApiResponse({ status: 200, schema: schema(z.array(transportView)) })
  transports(@ActiveUser('id') actor: string, @Param('tripId', new ZodValidationPipe(transportIdSchema)) tripId: string) {
    return this.service.transports(actor, tripId)
  }
  @Post('public-trips/:tripId/transports')
  @idParam('tripId')
  @ApiOperation({ summary: 'Ghi nhận xe thuê cho public trip', description: 'Lấy điểm đón từ trip. Cho phép nhiều xe. PLANNED/CONFIRMED chưa bắt buộc biển số hoặc tài xế. Không tự đặt xe hoặc thu thêm tiền khách.' })
  @ApiBody({ schema: schema(transportCreateSchema) })
  @ApiResponse({ status: 201, schema: schema(transportView) })
  createTransport(@ActiveUser('id') actor: string, @Param('tripId', new ZodValidationPipe(transportIdSchema)) tripId: string,
    @Body(new ZodValidationPipe(transportCreateSchema)) body: TransportInput) {
    return this.service.createTransport(actor, tripId, body)
  }
  @Patch('public-trips/:tripId/transports/:id')
  @idParam('tripId')
  @idParam('id')
  @ApiOperation({ summary: 'Cập nhật xe/tài xế hoặc hủy bố trí xe', description: 'Gửi expectedVersion mới nhất. CANCELLED giữ lịch sử và không thể sửa lại. Chỉ sửa trước khi trip bắt đầu; không sửa trip đã hủy/kết thúc. Thời gian dùng ISO 8601 có múi giờ.' })
  @ApiBody({ schema: schema(transportUpdateSchema) })
  @ApiResponse({ status: 200, schema: schema(transportView) })
  updateTransport(@ActiveUser('id') actor: string, @Param('tripId', new ZodValidationPipe(transportIdSchema)) tripId: string,
    @Param('id', new ZodValidationPipe(transportIdSchema)) id: string,
    @Body(new ZodValidationPipe(transportUpdateSchema)) body: TransportUpdate) {
    return this.service.updateTransport(actor, tripId, id, body)
  }
}
