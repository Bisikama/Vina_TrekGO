import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { PrivateInviteRateGuard } from '../private-invite-rate.guard'
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { PrivateMembershipUseCase } from '../../application/use-cases/private-membership.use-case'
import type { Actor } from '../../application/trip.types'
import type { MemberPage } from '../../application/private-membership.port'
import {
  inviteCodeSchema,
  joinPrivateSchema,
  memberVersionSchema,
  removeMemberQuerySchema,
  memberPageSchema,
} from '../dtos/private-membership.dto'
import { ApiPrivateCode, ApiPrivateId, ApiPrivateResponse } from '../private-trip.swagger'
const doc = (s: z.ZodType) => ApiBody({ schema: z.toJSONSchema(s) as SchemaObject })
@ApiTags('CF04 Private Trip Membership')
@Controller()
export class PrivateMembershipController {
  constructor(private readonly trips: PrivateMembershipUseCase) {}
  @Get('private-trip-invitations/:code')
  @ApiPrivateCode()
  @ApiPrivateResponse(
    'Xem lời mời công khai, không tự tham gia',
    'preview',
    200,
    'Không cần token. joinable=false khi hết chỗ/hết lượt; link hết hạn hoặc thu hồi trả 410. Preview không giữ chỗ.',
  )
  @UseGuards(PrivateInviteRateGuard)
  @Auth([AuthType.None])
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  preview(@Param('code', new ZodValidationPipe(inviteCodeSchema)) code: string) {
    return this.trips.preview(code)
  }

  @Post('private-trip-invitations/:code/join')
  @ApiPrivateCode()
  @ApiPrivateResponse(
    'USER tham gia hoặc tham gia lại private trip',
    'joined',
    200,
    'Body {} hoặc bỏ trống; không gửi userId. Member ACTIVE gọi lặp nhận alreadyMember=true. Dùng membership.version cho leave; redirectTo là đường dẫn frontend.',
  )
  @UseGuards(PrivateInviteRateGuard)
  @HttpCode(200)
  @Auth([AuthType.Bearer])
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: { type: 'object', additionalProperties: false }, required: false })
  join(
    @ActiveUser() a: Actor,
    @Param('code', new ZodValidationPipe(inviteCodeSchema)) code: string,
    @Body(new ZodValidationPipe(joinPrivateSchema)) _body: unknown,
  ) {
    return this.trips.join(a, code)
  }

  @Get('private-trips/:id/room')
  @ApiPrivateId()
  @ApiPrivateResponse(
    'Phòng chuyến đi cho host hoặc member ACTIVE',
    'room',
    200,
    'Dùng permissions để hiện nút, viewer.membershipVersion cho leave. Private trip hiện không hỗ trợ rental.',
  )
  @Auth([AuthType.Bearer])
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', 'no-store')
  room(@ActiveUser() a: Actor, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.trips.room(a, id)
  }

  @Get('private-trips/:id/members')
  @ApiPrivateId()
  @ApiPrivateResponse(
    'Danh sách membership theo trang và trạng thái',
    'members',
    200,
    'Member chỉ xem ACTIVE; creator được xem trạng thái khác hoặc ALL. items[].id là memberId, khác userId.',
  )
  @Auth([AuthType.Bearer])
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({
    name: 'status',
    required: false,
    schema: { type: 'string', enum: ['ACTIVE', 'LEFT', 'REMOVED', 'COMPLETED', 'NO_SHOW', 'ALL'], default: 'ACTIVE' },
    description: 'Chỉ creator được chọn trạng thái khác ACTIVE.',
  })
  members(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(memberPageSchema)) q: MemberPage,
  ) {
    return this.trips.members(a, id, q)
  }

  @Post('private-trips/:id/leave')
  @ApiPrivateId()
  @ApiPrivateResponse(
    'Member tự rời nhóm trước giờ bắt đầu',
    'left',
    200,
    'Host không được rời. expectedMemberVersion là version membership, không phải trip. LEFT có thể join lại khi lời mời còn hợp lệ.',
  )
  @HttpCode(200)
  @Auth([AuthType.Bearer])
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', 'no-store')
  @doc(memberVersionSchema)
  leave(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(memberVersionSchema)) b: { expectedMemberVersion: number },
  ) {
    return this.trips.leave(a, id, b.expectedMemberVersion)
  }

  @Delete('private-trips/:id/members/:memberId')
  @ApiPrivateId()
  @ApiPrivateId('memberId', 'ID membership từ members.items[].id; không phải userId')
  @ApiPrivateResponse(
    'Host loại member khỏi nhóm',
    'removed',
    200,
    'Gửi expectedMemberVersion trong query, không phải body. Không loại HOST; người bị REMOVED không thể tự join lại.',
  )
  @HttpCode(200)
  @Auth([AuthType.Bearer])
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({
    name: 'expectedMemberVersion',
    required: true,
    schema: { type: 'integer', minimum: 1 },
    description: 'Lấy từ version của membership bị loại trong danh sách members.',
  })
  remove(
    @ActiveUser() a: Actor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Query(new ZodValidationPipe(removeMemberQuerySchema)) q: { expectedMemberVersion: number },
  ) {
    return this.trips.remove(a, id, memberId, q.expectedMemberVersion)
  }
}
