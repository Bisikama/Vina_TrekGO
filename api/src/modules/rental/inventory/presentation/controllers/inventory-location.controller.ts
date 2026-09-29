import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { AuthType } from 'src/shared/constants/auth.constant'
import { UserRole } from 'src/shared/constants/enum.constant'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { ListInventoryLocationsUseCase } from '../../application/use-cases/list-inventory-locations.use-case'
import { GetInventoryLocationUseCase } from '../../application/use-cases/get-inventory-location.use-case'
import { ListInventoryLocationsSchema, type ListInventoryLocationsDto } from '../dtos/list-inventory-locations.dto'
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
}
