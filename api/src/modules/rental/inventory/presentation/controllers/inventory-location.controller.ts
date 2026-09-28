import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { AuthType } from 'src/shared/constants/auth.constant';
import { UserRole } from 'src/shared/constants/enum.constant';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ListInventoryLocationsUseCase } from '../../application/use-cases/list-inventory-locations.use-case';
import { GetInventoryLocationUseCase } from '../../application/use-cases/get-inventory-location.use-case';
import { ListInventoryLocationsSchema, type ListInventoryLocationsDto } from '../dtos/list-inventory-locations.dto';

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

  @ApiOperation({ summary: 'Lấy danh sách các địa điểm kho' })
  @ApiResponse({ status: 200, description: 'Danh sách địa điểm kho kèm phân trang' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm kiếm theo tên hoặc mã code' })
  @ApiQuery({ name: 'status', required: false, description: 'Lọc theo trạng thái (ACTIVE, INACTIVE, ARCHIVED)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @Get()
  async listLocations(@Query(new ZodValidationPipe(ListInventoryLocationsSchema)) query: ListInventoryLocationsDto) {
    return this.listInventoryLocationsUseCase.execute(query);
  }

  @ApiOperation({ summary: 'Lấy thông tin chi tiết một địa điểm kho' })
  @ApiResponse({ status: 200, description: 'Chi tiết địa điểm kho' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy địa điểm' })
  @Get(':id')
  async getLocation(@Param('id') id: string) {
    return this.getInventoryLocationUseCase.execute(id);
  }
}
