import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiParam, ApiBody } from '@nestjs/swagger'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { AuthType } from 'src/shared/constants/auth.constant'
import { UserRole } from 'src/shared/constants/enum.constant'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { ListInventoryLocationsUseCase } from '../../application/use-cases/list-inventory-locations.use-case'
import { GetInventoryLocationUseCase } from '../../application/use-cases/get-inventory-location.use-case'
import { CreateInventoryLocationUseCase } from '../../application/use-cases/create-inventory-location.use-case'
import { UpdateInventoryLocationUseCase } from '../../application/use-cases/update-inventory-location.use-case'
import { ListInventoryLocationsSchema, type ListInventoryLocationsDto } from '../dtos/list-inventory-locations.dto'
import { CreateInventoryLocationSchema, type CreateInventoryLocationDto } from '../dtos/create-inventory-location.dto'
import { UpdateInventoryLocationSchema, type UpdateInventoryLocationDto } from '../dtos/update-inventory-location.dto'
import { z } from 'zod'

const IdParamSchema = z.object({
  id: z.string().uuid(),
})

@ApiTags('Staff Inventory Locations')
@ApiBearerAuth()
@Auth([AuthType.Bearer])
@Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
@Controller('staff/inventory-locations')
export class InventoryLocationController {
  constructor(
    private readonly listInventoryLocationsUseCase: ListInventoryLocationsUseCase,
    private readonly getInventoryLocationUseCase: GetInventoryLocationUseCase,
    private readonly createInventoryLocationUseCase: CreateInventoryLocationUseCase,
    private readonly updateInventoryLocationUseCase: UpdateInventoryLocationUseCase,
  ) {}

  @ApiOperation({
    summary: 'Lấy danh sách các địa điểm kho',
    description: `
Lấy danh sách địa điểm kho có phân trang.
- Nếu không truyền status, mặc định trả về trạng thái ACTIVE.
- Truyền INACTIVE hoặc ARCHIVED để lấy các kho đã đóng hoặc lưu trữ.
`,
  })
  @ApiResponse({ status: 200, description: 'Danh sách địa điểm kho kèm phân trang' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Tìm kiếm theo tên hoặc mã code kho (vd: SGN-01)',
    example: 'SGN',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
    description: 'Lọc theo trạng thái. Mặc định là ACTIVE nếu không truyền.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    minimum: 1,
    default: 1,
    example: 1,
    description: 'Trang hiện tại',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
    description: 'Số lượng item trên mỗi trang',
  })
  @Get()
  async listLocations(@Query(new ZodValidationPipe(ListInventoryLocationsSchema)) query: ListInventoryLocationsDto) {
    return this.listInventoryLocationsUseCase.execute(query)
  }

  @ApiOperation({
    summary: 'Lấy thông tin chi tiết một địa điểm kho',
    description: 'Trả về thông tin chi tiết của một địa điểm kho dựa vào UUID.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'InventoryLocation UUID',
    example: '22222222-2222-4222-8222-222222222222',
  })
  @ApiResponse({ status: 200, description: 'Chi tiết địa điểm kho' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy địa điểm' })
  @Get(':id')
  async getLocation(@Param(new ZodValidationPipe(IdParamSchema)) params: { id: string }) {
    return this.getInventoryLocationUseCase.execute(params.id)
  }

  @ApiOperation({ summary: 'Tạo mới điểm giao nhận (Admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'HCM-01', description: 'Mã điểm giao nhận' },
        name: { type: 'string', example: 'Kho HCM Quận 1', description: 'Tên điểm giao nhận' },
        address: { type: 'string', example: '123 Đường Lê Lợi, Quận 1, TP.HCM', description: 'Địa chỉ cụ thể' },
        latitude: { type: 'number', example: 10.776889, description: 'Vĩ độ (optional)' },
        longitude: { type: 'number', example: 106.700806, description: 'Kinh độ (optional)' },
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], example: 'ACTIVE', description: 'Trạng thái (optional, default: ACTIVE)' },
      },
      required: ['code', 'name', 'address'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Mã điểm giao nhận đã tồn tại' })
  @Roles(UserRole.ADMIN)
  @Post()
  async createLocation(@Body(new ZodValidationPipe(CreateInventoryLocationSchema)) body: CreateInventoryLocationDto) {
    return this.createInventoryLocationUseCase.execute(body)
  }

  @ApiOperation({ summary: 'Cập nhật điểm giao nhận (Admin)' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'InventoryLocation UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'HCM-01-UPDATED', description: 'Mã điểm giao nhận' },
        name: { type: 'string', example: 'Kho HCM Quận 1 (Mới)', description: 'Tên điểm giao nhận' },
        address: { type: 'string', example: '456 Đường Lê Lợi, Quận 1, TP.HCM', description: 'Địa chỉ cụ thể' },
        latitude: { type: 'number', example: 10.776889 },
        longitude: { type: 'number', example: 106.700806 },
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], example: 'INACTIVE' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy điểm giao nhận' })
  @ApiResponse({ status: 400, description: 'Mã điểm giao nhận đã tồn tại' })
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async updateLocation(
    @Param(new ZodValidationPipe(IdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(UpdateInventoryLocationSchema)) body: UpdateInventoryLocationDto,
  ) {
    return this.updateInventoryLocationUseCase.execute({ id: params.id, ...body })
  }
}
