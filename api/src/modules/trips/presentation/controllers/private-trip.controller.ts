import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { PrivateTripUseCase } from '../../application/use-cases/private-trip.use-case'
import type { Actor } from '../../application/trip.types'
import type { PrivateTripInput, PrivateTripUpdate } from '../../application/private-trip.port'
import {
  privateCreateSchema,
  privateUpdateSchema,
  privateInviteSchema,
  privateCancelSchema,
  privateVersionSchema,
  privatePageSchema,
  privatePickupSchema,
} from '../dtos/private-trip.dto'
import { ApiPrivateId, ApiPrivatePage, ApiPrivateResponse } from '../private-trip.swagger'
const doc = (schema: z.ZodType) => ApiBody({ schema: z.toJSONSchema(schema) as SchemaObject })
@ApiTags('CF03 Private Trips')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller()
export class PrivateTripController {
  constructor(private readonly trips: PrivateTripUseCase) {}
  @Post('private-trips')
  @ApiPrivateResponse(
    'Tạo chuyến riêng OPEN và thêm HOST',
    'trip',
    201,
    'Cần USER ACTIVE. capacity tính cả host. trailRef là ID trail nguồn; checkpointIds theo thứ tự trail. Không có bước publish.',
  )
  @doc(privateCreateSchema)
  create(@ActiveUser() a: Actor, @Body(new ZodValidationPipe(privateCreateSchema)) input: PrivateTripInput) {
    return this.trips.create(a, input)
  }
  @Get('private-trips')
  @ApiPrivatePage()
  @ApiPrivateResponse(
    'Danh sách chuyến riêng do mình tạo',
    'trips',
    200,
    'Cần USER/LEADER ACTIVE; chỉ chuyến do mình tạo. Không phải danh sách mọi chuyến đã tham gia. Trả [] nếu chưa có chuyến.',
  )
  list(@ActiveUser() a: Actor, @Query(new ZodValidationPipe(privatePageSchema)) q: { page: number }) {
    return this.trips.read(a, undefined, q.page)
  }
  @Get('private-trips/:id')
  @ApiPrivateId()
  @ApiPrivateResponse(
    'Chi tiết private trip dành cho creator',
    'trip',
    200,
    'Member xem /private-trips/{id}/room. Response dùng maxPax và các relation tripTrailPlansViaTripId/tripCheckpointsViaTripId.',
  )
  detail(@ActiveUser() a: Actor, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.trips.read(a, id)
  }
  @Patch('private-trips/:id')
  @ApiPrivateId()
  @ApiPrivateResponse(
    'Host sửa chuyến OPEN trước giờ bắt đầu',
    'trip',
    200,
    'Dùng expectedVersion hiện tại. Chỉ sửa thông tin cơ bản; không đổi trail/destination/checkpoint. Capacity không thấp hơn số member ACTIVE.',
  )
  @doc(privateUpdateSchema)
  update(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(privateUpdateSchema)) input: PrivateTripUpdate,
  ) {
    return this.trips.update(a, id, input)
  }
  @Post('private-trips/:id/invitations')
  @ApiPrivateId()
  @ApiPrivateResponse(
    'Host tạo hoặc đổi link mời',
    'invitation',
    201,
    'Thu hồi link ACTIVE cũ. expiresAt tùy chọn, phải tương lai và trước startAt. Lưu tripVersion mới và dùng inviteCode cho CF04.',
  )
  @Header('Cache-Control', 'no-store')
  @doc(privateInviteSchema)
  invite(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(privateInviteSchema)) input: { expectedVersion: number; expiresAt?: string },
  ) {
    return this.trips.invite(a, id, input.expectedVersion, input.expiresAt)
  }
  @Post('private-trips/:id/invitations/revoke')
  @ApiPrivateId()
  @ApiPrivateResponse(
    'Host thu hồi link mời ACTIVE',
    'revoked',
    200,
    'Không xóa membership đã tham gia. Dùng expectedVersion của trip.',
  )
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @doc(privateVersionSchema)
  revoke(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(privateVersionSchema)) input: { expectedVersion: number },
  ) {
    return this.trips.revoke(a, id, input.expectedVersion)
  }
  @Post('private-trips/:id/cancel')
  @ApiPrivateId()
  @ApiPrivateResponse(
    'Host hủy ngay chuyến riêng',
    'cancelled',
    201,
    'Chỉ OPEN trước giờ bắt đầu. Chuyển CANCELLED và thu hồi link mời; response không kèm các mảng relation kế hoạch.',
  )
  @doc(privateCancelSchema)
  cancel(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(privateCancelSchema)) input: { expectedVersion: number; reason?: string },
  ) {
    return this.trips.cancel(a, id, input.expectedVersion, input.reason)
  }
  @Get('me/personal-trails')
  @ApiPrivatePage()
  @ApiPrivateResponse(
    'Trail cá nhân ACTIVE của user để tạo chuyến',
    'personalTrails',
    200,
    'Lấy trailRef từ id, checkpointIds từ personalCheckpointsViaPersonalTrailId[].id theo sequence.',
  )
  personal(@ActiveUser() a: Actor, @Query(new ZodValidationPipe(privatePageSchema)) q: { page: number }) {
    return this.trips.options(a, 'PERSONAL', q.page)
  }
  @Get('me/trail-accesses')
  @ApiPrivatePage()
  @ApiPrivateResponse(
    'System Trail user đang có quyền ACTIVE',
    'trailAccesses',
    200,
    'trailRef là systemTrailId, không phải id của TrailAccess. checkpointIds lấy từ systemTrail.trailCheckpointsViaSystemTrailId[].checkpointId.',
  )
  purchased(@ActiveUser() a: Actor, @Query(new ZodValidationPipe(privatePageSchema)) q: { page: number }) {
    return this.trips.options(a, 'SYSTEM', q.page)
  }
  @Get('private-trip-options/pickup-points')
  @ApiPrivatePage(false)
  @ApiQuery({
    name: 'destinationId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Địa điểm của trail đang chọn; chỉ lấy điểm ACTIVE thuộc đúng địa điểm, không lấy điểm dùng chung.',
  })
  @ApiPrivateResponse('Điểm tập kết ACTIVE theo địa điểm', 'pickups')
  pickups(
    @ActiveUser() a: Actor,
    @Query(new ZodValidationPipe(privatePickupSchema)) q: { page: number; destinationId: string },
  ) {
    return this.trips.options(a, 'PICKUP', q.page, q.destinationId)
  }
  @Get('trails/:trailId/access')
  @ApiPrivateId('trailId', 'UUID System Trail, không phải ID TrailAccess')
  @ApiPrivateResponse('Kiểm tra user có quyền sử dụng System Trail', 'access')
  access(@ActiveUser() a: Actor, @Param('trailId', new ParseUUIDPipe()) id: string) {
    return this.trips.access(a, id)
  }
}
