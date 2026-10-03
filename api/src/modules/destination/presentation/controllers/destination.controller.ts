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
import { GetDestinationsUseCase } from '../../application/use-cases/get-destinations.use-case'
import { GetDestinationDetailUseCase } from '../../application/use-cases/get-destination-detail.use-case'
import { CreateDestinationUseCase } from '../../application/use-cases/create-destination.use-case'
import { UpdateDestinationUseCase } from '../../application/use-cases/update-destination.use-case'
import { DeleteDestinationUseCase } from '../../application/use-cases/delete-destination.use-case'
import {
  GetDestinationsQuerySchema,
  type GetDestinationsQueryDto,
  DestinationResponseDto,
  PaginatedDestinationResponseDto,
  CreateDestinationRequestDto,
  type CreateDestinationDto,
  CreateDestinationSchema,
  UpdateDestinationRequestDto,
  type UpdateDestinationDto,
  UpdateDestinationSchema,
} from '../dtos/destination.dto'

@ApiTags('Destinations')
@Controller('destinations')
export class DestinationController {
  constructor(
    private readonly getDestinationsUseCase: GetDestinationsUseCase,
    private readonly getDestinationDetailUseCase: GetDestinationDetailUseCase,
    private readonly createDestinationUseCase: CreateDestinationUseCase,
    private readonly updateDestinationUseCase: UpdateDestinationUseCase,
    private readonly deleteDestinationUseCase: DeleteDestinationUseCase,
  ) {}

  @Get()
  @Auth([AuthType.None])
  @ApiOperation({
    summary: 'Lấy danh sách các điểm đến / địa danh trekking (có phân trang)',
    description: 'Hỗ trợ phân trang, tìm kiếm theo từ khóa và lọc theo khu vực (region)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Trang hiện tại' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20, description: 'Số bản ghi trên mỗi trang' })
  @ApiQuery({ name: 'keyword', required: false, type: String, description: 'Tìm kiếm theo tên hoặc mô tả' })
  @ApiQuery({ name: 'region', required: false, enum: ['NORTH', 'CENTRAL', 'SOUTH'], description: 'Lọc theo vùng miền' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
    description: 'Lọc theo trạng thái',
  })
  @ApiResponse({ status: 200, type: PaginatedDestinationResponseDto })
  async getDestinations(
    @Query(new ZodValidationPipe(GetDestinationsQuerySchema)) query: GetDestinationsQueryDto,
  ): Promise<PaginatedDestinationResponseDto> {
    return this.getDestinationsUseCase.execute(query)
  }

  @Get(':id')
  @Auth([AuthType.None])
  @ApiOperation({
    summary: 'Lấy chi tiết điểm đến trekking theo ID',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Destination UUID' })
  @ApiResponse({ status: 200, type: DestinationResponseDto })
  async getDestinationDetail(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ): Promise<DestinationResponseDto> {
    return this.getDestinationDetailUseCase.execute(id)
  }

  @Post()
  @ApiBearerAuth('bearer')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo mới một điểm đến / địa danh' })
  @ApiBody({ type: CreateDestinationRequestDto })
  @ApiResponse({ status: 201, description: 'Tạo thành công', type: DestinationResponseDto })
  async createDestination(
    @Body(new ZodValidationPipe(CreateDestinationSchema)) body: CreateDestinationDto,
  ): Promise<DestinationResponseDto> {
    return this.createDestinationUseCase.execute(body)
  }

  @Patch(':id')
  @ApiBearerAuth('bearer')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin điểm đến' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Destination UUID' })
  @ApiBody({ type: UpdateDestinationRequestDto })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công', type: DestinationResponseDto })
  async updateDestination(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body(new ZodValidationPipe(UpdateDestinationSchema)) body: UpdateDestinationDto,
  ): Promise<DestinationResponseDto> {
    return this.updateDestinationUseCase.execute(id, body)
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Vô hiệu hóa điểm đến (chuyển trạng thái sang INACTIVE)' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Destination UUID' })
  @ApiResponse({ status: 200, description: 'Vô hiệu hóa thành công' })
  async deleteDestination(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.deleteDestinationUseCase.execute(id)
  }
}
