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
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import type { ActiveUserData } from 'src/shared/types/user.type'
import { UserRole } from '@prisma/client'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { GetSystemTrailsUseCase } from '../../application/use-cases/get-system-trails.use-case'
import { GetSystemTrailDetailUseCase } from '../../application/use-cases/get-system-trail-detail.use-case'
import { CreateSystemTrailUseCase } from '../../application/use-cases/create-system-trail.use-case'
import { UpdateSystemTrailUseCase } from '../../application/use-cases/update-system-trail.use-case'
import { DeleteSystemTrailUseCase } from '../../application/use-cases/delete-system-trail.use-case'
import {
  GetSystemTrailsQuerySchema,
  type GetSystemTrailsQueryDto,
  PaginatedSystemTrailResponseDto,
  SystemTrailDetailDto,
  CreateSystemTrailRequestDto,
  type CreateSystemTrailDto,
  CreateSystemTrailSchema,
  UpdateSystemTrailRequestDto,
  type UpdateSystemTrailDto,
  UpdateSystemTrailSchema,
} from '../dtos/system-trail.dto'

@ApiTags('System Trails')
@Controller('system-trails')
export class SystemTrailController {
  constructor(
    private readonly getSystemTrailsUseCase: GetSystemTrailsUseCase,
    private readonly getSystemTrailDetailUseCase: GetSystemTrailDetailUseCase,
    private readonly createSystemTrailUseCase: CreateSystemTrailUseCase,
    private readonly updateSystemTrailUseCase: UpdateSystemTrailUseCase,
    private readonly deleteSystemTrailUseCase: DeleteSystemTrailUseCase,
  ) {}

  @Get()
  @Auth([AuthType.None])
  @ApiOperation({
    summary: 'Lấy danh sách các cung đường hệ thống (có phân trang)',
    description: 'Hỗ trợ lọc theo điểm đến (destinationId), độ khó (difficulty), khoảng cách và tìm kiếm tên/mã',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Trang hiện tại' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20, description: 'Số bản ghi trên mỗi trang' })
  @ApiQuery({ name: 'destinationId', required: false, type: String, description: 'Lọc theo ID địa danh' })
  @ApiQuery({ name: 'keyword', required: false, type: String, description: 'Tìm theo tên hoặc mã cung đường' })
  @ApiQuery({ name: 'difficulty', required: false, enum: ['EASY', 'MEDIUM', 'HARD', 'EXTREME'], description: 'Lọc theo độ khó' })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], description: 'Lọc theo trạng thái' })
  @ApiQuery({ name: 'minDistance', required: false, type: Number, description: 'Khoảng cách tối thiểu (km)' })
  @ApiQuery({ name: 'maxDistance', required: false, type: Number, description: 'Khoảng cách tối đa (km)' })
  @ApiResponse({ status: 200, type: PaginatedSystemTrailResponseDto })
  async getTrails(
    @Query(new ZodValidationPipe(GetSystemTrailsQuerySchema)) query: GetSystemTrailsQueryDto,
  ): Promise<PaginatedSystemTrailResponseDto> {
    return this.getSystemTrailsUseCase.execute(query)
  }

  @Get(':idOrCode')
  @Auth([AuthType.None])
  @ApiOperation({
    summary: 'Lấy dữ liệu chi tiết cung đường để render MapLibre 3D',
    description: 'Trả về toạ độ GeoJSON 3D, danh sách checkpoints và thông số camera/bounds sẵn sàng cho MapLibre',
  })
  @ApiParam({ name: 'idOrCode', description: 'UUID hoặc Mã cung đường (VD: TRAIL_BADEN_COTDIEN)' })
  @ApiResponse({ status: 200, type: SystemTrailDetailDto })
  async getTrailDetail(@Param('idOrCode') idOrCode: string): Promise<SystemTrailDetailDto> {
    return this.getSystemTrailDetailUseCase.execute(idOrCode)
  }

  @Post()
  @ApiBearerAuth('bearer')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Tạo mới cung đường hệ thống',
    description: 'Yêu cầu quyền ADMIN. Hỗ trợ kèm danh sách Checkpoint theo thứ tự sequence.',
  })
  @ApiBody({ type: CreateSystemTrailRequestDto })
  @ApiResponse({ status: 201, description: 'Tạo thành công', type: SystemTrailDetailDto })
  async createTrail(
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(CreateSystemTrailSchema)) body: CreateSystemTrailDto,
  ): Promise<SystemTrailDetailDto> {
    return this.createSystemTrailUseCase.execute({
      ...body,
      createdBy: user.id,
    })
  }

  @Patch(':id')
  @ApiBearerAuth('bearer')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật cung đường hệ thống',
    description: 'Yêu cầu quyền ADMIN. Nếu sửa toạ độ hoặc checkpoints sẽ tự động tăng version.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'SystemTrail UUID' })
  @ApiBody({ type: UpdateSystemTrailRequestDto })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công', type: SystemTrailDetailDto })
  async updateTrail(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body(new ZodValidationPipe(UpdateSystemTrailSchema)) body: UpdateSystemTrailDto,
  ): Promise<SystemTrailDetailDto> {
    return this.updateSystemTrailUseCase.execute(id, body)
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Vô hiệu hóa cung đường (chuyển sang INACTIVE)',
    description: 'Yêu cầu quyền ADMIN. Kiểm tra an toàn người dùng mua bản đồ và tour liên kết.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'SystemTrail UUID' })
  @ApiResponse({ status: 200, description: 'Vô hiệu hóa thành công' })
  async deleteTrail(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.deleteSystemTrailUseCase.execute(id)
  }
}