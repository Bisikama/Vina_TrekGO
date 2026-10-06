import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseFilters } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { Roles } from '../../../../shared/decorators/roles.decorator'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { UserRole } from '../../../../shared/constants/enum.constant'
import { PublicTripUseCase } from '../../application/use-cases/public-trip.use-case'
import type { Actor } from '../../application/trip.types'
import {
  cancelSchema,
  checkpointsSchema,
  conflictSchema,
  createSchema,
  pageSchema,
  parse,
  trailsSchema,
  updateSchema,
  versionSchema,
} from '../dtos/public-trip.dto'
import { TripErrorFilter } from '../trip-error.filter'
import { ApiCf01Destination, ApiCf01Id, ApiCf01Page, ApiCf01Response } from '../public-trip.swagger'

const id = (value: string) => parse(z.string().uuid(), value)
const bodyDoc = (schema: z.ZodType) => ApiBody({ schema: z.toJSONSchema(schema) as SchemaObject })
@ApiTags('CF01 Leader Public Trips')
@UseFilters(TripErrorFilter)
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.LEADER)
@Controller('leader/public-trips')
export class LeaderPublicTripController {
  constructor(private readonly trips: PublicTripUseCase) {}
  @Post()
  @ApiCf01Response('Tạo bản nháp chuyến công khai', 'trip', 201)
  @bodyDoc(createSchema)
  create(@ActiveUser() actor: Actor, @Body() body: unknown) {
    return this.trips.create(actor, parse(createSchema, body))
  }
  @Get()
  @ApiCf01Page()
  @ApiCf01Response(
    'Danh sách chuyến của Leader đang đăng nhập',
    'trips',
    200,
    'Cần token LEADER ACTIVE. Không nhập body hoặc leaderId. Bao gồm cả DRAFT; trả [] nếu chưa có chuyến ở trang này.',
  )
  list(@ActiveUser() actor: Actor, @Query() query: unknown) {
    return this.trips.list(actor, parse(pageSchema, query))
  }
  @Get(':id')
  @ApiCf01Id()
  @ApiCf01Response('Chi tiết chuyến của Leader', 'trip')
  detail(@ActiveUser() actor: Actor, @Param('id') tripId: string) {
    return this.trips.detail(actor, id(tripId))
  }
  @Patch(':id')
  @ApiCf01Id()
  @ApiCf01Response('Sửa chuyến DRAFT theo expectedVersion', 'trip')
  @bodyDoc(updateSchema)
  update(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Body() body: unknown) {
    const { expectedVersion, ...data } = parse(updateSchema, body)
    return this.trips.update(actor, id(tripId), expectedVersion, data)
  }
  @Put(':id/checkpoints')
  @ApiCf01Id()
  @ApiCf01Response('Thay danh sách checkpoint bắt buộc theo thứ tự', 'trip')
  @bodyDoc(checkpointsSchema)
  checkpoints(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Body() body: unknown) {
    const data = parse(checkpointsSchema, body)
    return this.trips.setCheckpoints(actor, id(tripId), data.expectedVersion, data.checkpointIds)
  }
  @Put(':id/trails')
  @ApiCf01Id()
  @ApiCf01Response('Thay danh sách System Trail theo thứ tự', 'trip')
  @bodyDoc(trailsSchema)
  trails(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Body() body: unknown) {
    const data = parse(trailsSchema, body)
    return this.trips.setTrails(actor, id(tripId), data.expectedVersion, data.trailIds)
  }
  @Get(':id/trail-suggestions')
  @ApiCf01Id()
  @ApiCf01Page()
  @ApiCf01Response('Gợi ý System Trail cho kế hoạch chuyến', 'suggestions')
  suggestions(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Query() query: unknown) {
    return this.trips.suggestions(actor, id(tripId), parse(pageSchema, query))
  }
  @Get(':id/readiness')
  @ApiCf01Id()
  @ApiCf01Response('Kiểm tra điều kiện publish và lỗi cần sửa', 'readiness')
  readiness(@ActiveUser() actor: Actor, @Param('id') tripId: string) {
    return this.trips.readiness(actor, id(tripId))
  }
  @Post(':id/publish')
  @ApiCf01Id()
  @ApiCf01Response('Publish chuyến DRAFT thành OPEN', 'trip', 201)
  @bodyDoc(versionSchema)
  publish(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Body() body: unknown) {
    return this.trips.publish(actor, id(tripId), parse(versionSchema, body).expectedVersion)
  }
  @Post(':id/cancellation-requests')
  @ApiCf01Id()
  @ApiCf01Response('Gửi yêu cầu hủy, chuyển sang CANCEL_PENDING', 'trip', 201)
  @bodyDoc(cancelSchema)
  cancel(@ActiveUser() actor: Actor, @Param('id') tripId: string, @Body() body: unknown) {
    const d = parse(cancelSchema, body)
    return this.trips.cancel(actor, id(tripId), d.expectedVersion, d.reason, d.evidenceUrls)
  }
}
@ApiTags('CF01 Trip Options')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.LEADER)
@UseFilters(TripErrorFilter)
@Controller()
export class TripOptionsController {
  constructor(private readonly trips: PublicTripUseCase) {}
  @Get('leaders/me/schedule-conflicts')
  @ApiQuery({
    name: 'startAt',
    required: true,
    schema: { type: 'string', format: 'date-time' },
    description: 'ISO 8601 có múi giờ, ví dụ 2026-11-15T06:00:00+07:00',
  })
  @ApiQuery({
    name: 'endAt',
    required: true,
    schema: { type: 'string', format: 'date-time' },
    description: 'Thời điểm kết thúc sau startAt',
  })
  @ApiQuery({
    name: 'excludeTripId',
    required: false,
    schema: { type: 'string', format: 'uuid' },
    description: 'ID chuyến đang sửa để loại khỏi kiểm tra trùng lịch',
  })
  @ApiCf01Response('Kiểm tra trùng lịch của Leader', 'conflicts')
  conflicts(@ActiveUser() actor: Actor, @Query() query: unknown) {
    const d = parse(conflictSchema, query)
    return this.trips.conflicts(actor, d.startAt, d.endAt, d.excludeTripId)
  }
  @Get('leader/trip-options/destinations')
  @ApiCf01Page()
  @ApiCf01Response('Địa điểm ACTIVE để tạo chuyến', 'options')
  destinations(@ActiveUser() actor: Actor, @Query() query: unknown) {
    return this.trips.options(actor, 'destinations', parse(pageSchema, query))
  }
  @Get('leader/trip-options/pickup-points')
  @ApiCf01Destination()
  @ApiCf01Page()
  @ApiCf01Response('Điểm tập kết phù hợp địa điểm hoặc dùng chung', 'options')
  pickups(@ActiveUser() actor: Actor, @Query() query: unknown) {
    const p = parse(pageSchema, query)
    return this.trips.options(actor, 'pickups', p, p.destinationId)
  }
  @Get('leader/trip-options/checkpoints')
  @ApiCf01Destination()
  @ApiCf01Page()
  @ApiCf01Response('Checkpoint ACTIVE thuộc địa điểm', 'checkpoints')
  checkpoints(@ActiveUser() actor: Actor, @Query() query: unknown) {
    const p = parse(pageSchema, query)
    return this.trips.options(actor, 'checkpoints', p, p.destinationId)
  }
  @Get('leader/trip-options/system-trails/:id')
  @ApiCf01Id('UUID System Trail, lấy từ trail-suggestions')
  @ApiCf01Response('Chi tiết System Trail ACTIVE', 'trail')
  trail(@ActiveUser() actor: Actor, @Param('id') trailId: string) {
    return this.trips.trailDetail(actor, id(trailId))
  }
}
@ApiTags('Public Trips')
@Auth([AuthType.None])
@Controller('public-trips')
@UseFilters(TripErrorFilter)
export class PublicTripController {
  constructor(private readonly trips: PublicTripUseCase) {}
  @Get()
  @ApiCf01Page()
  @ApiCf01Response(
    'Danh sách chuyến công khai OPEN hoặc FULL',
    'publicTrips',
    200,
    'Không cần đăng nhập. Chỉ trả chuyến đã publish; [] khi không có kết quả.',
  )
  list(@Query() query: unknown) {
    return this.trips.publicList(parse(pageSchema, query))
  }
  @Get(':id')
  @ApiCf01Id()
  @ApiCf01Response('Chi tiết công khai của chuyến đã publish', 'publicTrip')
  detail(@Param('id') tripId: string) {
    return this.trips.publicDetail(id(tripId))
  }
}
