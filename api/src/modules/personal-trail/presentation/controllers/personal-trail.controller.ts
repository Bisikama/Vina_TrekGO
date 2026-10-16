import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import type { ActiveUserData } from '../../../../shared/types/user.type'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { PersonalTrailUseCase } from '../../application/use-cases/personal-trail.use-case'
import {
  myTrailsQuerySchema,
  submitVerificationSchema,
  updatePersonalTrailSchema,
  UpdatePersonalTrailRequestDto,
  SubmitVerificationRequestDto,
} from '../dtos/personal-trail.dto'
import type {
  MyTrailsQuery,
  SubmitVerificationInput,
  UpdatePersonalTrailInput,
} from '../dtos/personal-trail.dto'

@ApiTags('Personal Trails')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('personal-trails')
export class PersonalTrailController {
  constructor(private readonly useCase: PersonalTrailUseCase) {}

  @Get('my-trails')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy danh sách cung đường cá nhân của tôi (Get My Personal Trails)',
    description: 'Hỗ trợ phân trang và lọc theo trạng thái kiểm duyệt (DRAFT, PENDING, VERIFIED, REJECTED)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Trang hiện tại' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Số bản ghi trên mỗi trang' })
  @ApiQuery({
    name: 'verificationStatus',
    required: false,
    enum: ['DRAFT', 'PENDING', 'VERIFIED', 'REJECTED', 'APPROVED'],
    description: 'Lọc theo trạng thái kiểm duyệt',
  })
  @ApiResponse({ status: 200, description: 'Danh sách cung đường cá nhân' })
  async getMyTrails(
    @ActiveUser() user: ActiveUserData,
    @Query(new ZodValidationPipe(myTrailsQuerySchema)) query: MyTrailsQuery,
  ) {
    const result = await this.useCase.getMyTrails(user, query)
    return {
      success: true,
      ...result,
    }
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy chi tiết cung đường cá nhân (Get Personal Trail Detail)',
    description: 'Bao gồm gpsSegments (MultiLineString 3D), elevationProfile và telemetry',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID của cung đường cá nhân' })
  @ApiResponse({ status: 200, description: 'Chi tiết cung đường cá nhân' })
  async getDetail(
    @ActiveUser() user: ActiveUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const data = await this.useCase.getDetail(user, id)
    return {
      success: true,
      data,
    }
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cập nhật thông tin cung đường (Update Personal Trail)',
    description: 'Chỉ cho phép cập nhật tên, mô tả, độ khó, quyền riêng tư. Không cho phép sửa đè tọa độ GPS.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID của cung đường cá nhân' })
  @ApiBody({ type: UpdatePersonalTrailRequestDto })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  async update(
    @ActiveUser() user: ActiveUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updatePersonalTrailSchema)) body: UpdatePersonalTrailInput,
  ) {
    const data = await this.useCase.update(user, id, body)
    return {
      success: true,
      message: 'Cập nhật thông tin cung đường thành công',
      data,
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xóa cung đường cá nhân (Soft Delete Personal Trail)',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID của cung đường cá nhân' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  async delete(
    @ActiveUser() user: ActiveUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.useCase.delete(user, id)
  }

  @Post(':id/submit-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi yêu cầu kiểm duyệt cung đường cá nhân lên hệ thống (Submit For Verification)',
    description: 'Điều kiện: Cung đường >= 500m (0.5km), DEM READY',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'UUID của cung đường cá nhân' })
  @ApiBody({ type: SubmitVerificationRequestDto, required: false })
  @ApiResponse({ status: 200, description: 'Đã gửi yêu cầu kiểm duyệt' })
  async submitVerification(
    @ActiveUser() user: ActiveUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(submitVerificationSchema)) body: SubmitVerificationInput,
  ) {
    const data = await this.useCase.submitVerification(user, id, body)
    return {
      success: true,
      message: 'Đã gửi cung đường cho Ban quản trị TrekGo kiểm duyệt.',
      data,
    }
  }
}
