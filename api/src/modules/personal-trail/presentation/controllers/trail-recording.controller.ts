import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import type { ActiveUserData } from '../../../../shared/types/user.type'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { TrailRecordingUseCase } from '../../application/use-cases/trail-recording.use-case'
import {
  finishRecordingSchema,
  rawSamplesBatchSchema,
  startRecordingSchema,
  updateRecordingStatusSchema,
  StartRecordingRequestDto,
  RawSamplesBatchRequestDto,
  UpdateRecordingStatusRequestDto,
  FinishRecordingRequestDto,
} from '../dtos/personal-trail.dto'
import type {
  FinishRecordingInput,
  RawSamplesBatchInput,
  StartRecordingInput,
  UpdateRecordingStatusInput,
} from '../dtos/personal-trail.dto'

@ApiTags('Personal Trail - Recordings')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('trail-recordings')
export class TrailRecordingController {
  constructor(private readonly useCase: TrailRecordingUseCase) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Khởi tạo hoặc đối soát phiên ghi thực địa (Start Recording Session)',
    description: 'Hỗ trợ Offline-first & Idempotency bằng clientRecordingId UUID v4',
  })
  @ApiBody({ type: StartRecordingRequestDto })
  @ApiResponse({ status: 201, description: 'Phiên ghi được tạo mới thành công' })
  @ApiResponse({ status: 200, description: 'Trả về phiên ghi đã tồn tại khi retry' })
  async start(
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(startRecordingSchema)) body: StartRecordingInput,
  ) {
    const data = await this.useCase.start(user, body)
    return {
      success: true,
      data,
    }
  }

  @Post(':recordingId/raw-samples')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi lô mẫu GPS thô (Upload Raw GPS Samples Batch)',
    description: 'Idempotent theo clientSampleId, bỏ qua các mẫu bị trùng',
  })
  @ApiParam({ name: 'recordingId', format: 'uuid', description: 'UUID của phiên ghi (recordingId)' })
  @ApiBody({ type: RawSamplesBatchRequestDto })
  @ApiResponse({ status: 200, description: 'Nhận lô mẫu GPS thành công' })
  async uploadRawSamples(
    @ActiveUser() user: ActiveUserData,
    @Param('recordingId', new ParseUUIDPipe()) recordingId: string,
    @Body(new ZodValidationPipe(rawSamplesBatchSchema)) body: RawSamplesBatchInput,
  ) {
    const data = await this.useCase.saveRawSamples(user, recordingId, body)
    return {
      success: true,
      data,
    }
  }

  @Patch(':recordingId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cập nhật trạng thái phiên ghi (Pause / Resume)',
  })
  @ApiParam({ name: 'recordingId', format: 'uuid', description: 'UUID của phiên ghi (recordingId)' })
  @ApiBody({ type: UpdateRecordingStatusRequestDto })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
  async updateStatus(
    @ActiveUser() user: ActiveUserData,
    @Param('recordingId', new ParseUUIDPipe()) recordingId: string,
    @Body(new ZodValidationPipe(updateRecordingStatusSchema)) body: UpdateRecordingStatusInput,
  ) {
    const data = await this.useCase.updateStatus(user, recordingId, body)
    return {
      success: true,
      data,
    }
  }

  @Post(':recordingId/finish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hoàn tất phiên ghi & kích hoạt chuẩn hóa độ cao vệ tinh DEM AWS Terrarium',
    description: 'Xử lý tính toán quãng đường, elevation gain/loss, MultiLineString 3D và tự động tạo PersonalTrail',
  })
  @ApiParam({ name: 'recordingId', format: 'uuid', description: 'UUID của phiên ghi (recordingId)' })
  @ApiBody({ type: FinishRecordingRequestDto, required: false })
  @ApiResponse({ status: 200, description: 'Phiên ghi hoàn tất và đã tạo Personal Trail' })
  async finish(
    @ActiveUser() user: ActiveUserData,
    @Param('recordingId', new ParseUUIDPipe()) recordingId: string,
    @Body(new ZodValidationPipe(finishRecordingSchema)) body: FinishRecordingInput,
  ) {
    const data = await this.useCase.finish(user, recordingId, body)
    return {
      success: true,
      message: 'Đã hoàn tất phiên ghi và chuẩn hóa độ cao vệ tinh DEM.',
      data,
    }
  }

  @Get(':recordingId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Polling kiểm tra tiến độ xử lý và telemetry chính thức của phiên ghi',
  })
  @ApiParam({ name: 'recordingId', format: 'uuid', description: 'UUID của phiên ghi (recordingId)' })
  @ApiResponse({ status: 200, description: 'Thông tin trạng thái phiên ghi' })
  async getStatus(
    @ActiveUser() user: ActiveUserData,
    @Param('recordingId', new ParseUUIDPipe()) recordingId: string,
  ) {
    const data = await this.useCase.getStatus(user, recordingId)
    return {
      success: true,
      data,
    }
  }
}
