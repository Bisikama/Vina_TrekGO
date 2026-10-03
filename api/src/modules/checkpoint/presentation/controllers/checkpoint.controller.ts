import { Controller, Get, Param, ParseUUIDPipe, Post, Patch, Delete, Query, Body } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { AuthType } from 'src/shared/constants/auth.constant'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { UserRole } from '@prisma/client'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { GetCheckpointsUseCase } from '../../application/use-cases/get-checkpoints.use-case'
import { GetCheckpointDetailUseCase } from '../../application/use-cases/get-checkpoint-detail.use-case'
import { CreateCheckpointUseCase } from '../../application/use-cases/create-checkpoint.use-case'
import { UpdateCheckpointUseCase } from '../../application/use-cases/update-checkpoint.use-case'
import { DeleteCheckpointUseCase } from '../../application/use-cases/delete-checkpoint.use-case'
import {
  GetCheckpointsQuerySchema,
  type GetCheckpointsQueryDto,
  CheckpointResponseDto,
  PaginatedCheckpointResponseDto,
  CreateCheckpointRequestDto,
  type CreateCheckpointDto,
  CreateCheckpointSchema,
  UpdateCheckpointRequestDto,
  type UpdateCheckpointDto,
  UpdateCheckpointSchema,
} from '../dtos/checkpoint.dto'

@ApiTags('Checkpoints')
@Controller('checkpoints')
export class CheckpointController {
  constructor(
    private readonly getCheckpointsUseCase: GetCheckpointsUseCase,
    private readonly getCheckpointDetailUseCase: GetCheckpointDetailUseCase,
    private readonly createCheckpointUseCase: CreateCheckpointUseCase,
    private readonly updateCheckpointUseCase: UpdateCheckpointUseCase,
    private readonly deleteCheckpointUseCase: DeleteCheckpointUseCase,
  ) {}

  @Get()
  @Auth([AuthType.None])
  @ApiOperation({
    summary: 'Lấy danh sách điểm mốc / trạm dừng chân trekking (có phân trang)',
    description: 'Hỗ trợ lọc theo điểm đến (destinationId), loại trạm (checkpointType), trạng thái và từ khóa tìm kiếm (name, code)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Trang hiện tại' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20, description: 'Số bản ghi trên mỗi trang' })
  @ApiQuery({
    name: 'destinationId',
    required: true,
    type: String,
    description: 'UUID của địa danh (Destination) - Bắt buộc',
  })
  @ApiQuery({
    name: 'checkpointType',
    required: false,
    enum: ['START', 'CAMPSITE', 'SUMMIT', 'WATER_SOURCE', 'VIEWPOINT', 'END'],
    description: 'Lọc theo phân loại trạm',
  })
  @ApiQuery({ name: 'keyword', required: false, type: String, description: 'Tìm theo tên hoặc mã điểm mốc' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
    description: 'Lọc theo trạng thái',
  })
  @ApiResponse({ status: 200, type: PaginatedCheckpointResponseDto })
  async getCheckpoints(
    @Query(new ZodValidationPipe(GetCheckpointsQuerySchema)) query: GetCheckpointsQueryDto,
  ): Promise<PaginatedCheckpointResponseDto> {
    return this.getCheckpointsUseCase.execute(query)
  }

  @Get(':id')
  @Auth([AuthType.None])
  @ApiOperation({
    summary: 'Lấy thông tin chi tiết điểm mốc checkpoint theo ID',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Checkpoint UUID' })
  @ApiResponse({ status: 200, type: CheckpointResponseDto })
  async getCheckpointDetail(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ): Promise<CheckpointResponseDto> {
    return this.getCheckpointDetailUseCase.execute(id)
  }

  @Post()
  @ApiBearerAuth('bearer')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Tạo mới điểm mốc checkpoint (Chỉ dành cho Admin)',
    description: 'Yêu cầu quyền ADMIN và token xác thực hợp lệ',
  })
  @ApiBody({ type: CreateCheckpointRequestDto })
  @ApiResponse({ status: 201, description: 'Tạo thành công', type: CheckpointResponseDto })
  async createCheckpoint(
    @Body(new ZodValidationPipe(CreateCheckpointSchema)) body: CreateCheckpointDto,
  ): Promise<CheckpointResponseDto> {
    return this.createCheckpointUseCase.execute(body)
  }

  @Patch(':id')
  @ApiBearerAuth('bearer')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật điểm mốc checkpoint (Chỉ dành cho Admin)',
    description: 'Yêu cầu quyền ADMIN và token xác thực hợp lệ',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Checkpoint UUID' })
  @ApiBody({ type: UpdateCheckpointRequestDto })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công', type: CheckpointResponseDto })
  async updateCheckpoint(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body(new ZodValidationPipe(UpdateCheckpointSchema)) body: UpdateCheckpointDto,
  ): Promise<CheckpointResponseDto> {
    return this.updateCheckpointUseCase.execute(id, body)
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Vô hiệu hóa điểm mốc checkpoint (Chỉ dành cho Admin)',
    description: 'Chuyển trạng thái sang INACTIVE nếu không có cung đường hoặc chuyến đi nào đang liên kết',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Checkpoint UUID' })
  @ApiResponse({ status: 200, description: 'Vô hiệu hóa thành công' })
  async deleteCheckpoint(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.deleteCheckpointUseCase.execute(id)
  }
}
