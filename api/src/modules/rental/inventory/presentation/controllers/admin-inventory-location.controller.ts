import { Controller, Post, Put, Body, Param } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiParam, ApiBody } from '@nestjs/swagger'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { AuthType } from 'src/shared/constants/auth.constant'
import { UserRole } from 'src/shared/constants/enum.constant'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { CreateInventoryLocationUseCase } from '../../application/use-cases/create-inventory-location.use-case'
import { UpdateInventoryLocationUseCase } from '../../application/use-cases/update-inventory-location.use-case'
import { CreateInventoryLocationSchema, type CreateInventoryLocationDto } from '../dtos/create-inventory-location.dto'
import { UpdateInventoryLocationSchema, type UpdateInventoryLocationDto } from '../dtos/update-inventory-location.dto'
import { z } from 'zod'

const IdParamSchema = z.object({
  id: z.string().uuid(),
})

@ApiTags('Admin Inventory Locations')
@ApiBearerAuth()
@Auth([AuthType.Bearer])
@Roles(UserRole.ADMIN)
@Controller('admin/inventory-locations')
export class AdminInventoryLocationController {
  constructor(
    private readonly createInventoryLocationUseCase: CreateInventoryLocationUseCase,
    private readonly updateInventoryLocationUseCase: UpdateInventoryLocationUseCase,
  ) {}

  @ApiOperation({
    summary: 'Tạo mới một địa điểm nhà chứa (Kho)',
    description: 'API dành riêng cho Admin để tạo nhà chứa/kho mới. Dùng để đăng ký các kho lưu trữ, điểm trung chuyển thiết bị (không cho phép xóa cứng sau khi tạo).',
  })
  @ApiBody({
    description: 'Admin nhập mã kho duy nhất, tên và địa chỉ. Tọa độ là tùy chọn.',
    schema: {
      type: 'object',
      required: ['code', 'name', 'address'],
      properties: {
        code: { type: 'string', example: 'INV-HCM-01', description: 'Mã định danh nhà chứa (duy nhất)' },
        name: { type: 'string', example: 'Nhà Chứa Trung Tâm HCM', description: 'Tên hiển thị của nhà chứa' },
        address: { type: 'string', example: 'Quận 1, TP. Hồ Chí Minh', description: 'Địa chỉ chi tiết' },
        latitude: { type: 'number', example: 10.7923, description: 'Vĩ độ (GPS)' },
        longitude: { type: 'number', example: 106.6990, description: 'Kinh độ (GPS)' },
      },
      example: { code: 'INV-HCM-01', name: 'Kho Trung Tâm HCM', address: 'Quận 1, TP. Hồ Chí Minh' },
    },
  })
  @ApiResponse({ status: 201, description: 'Tạo địa điểm nhà chứa thành công' })
  @Post()
  async createLocation(@Body(new ZodValidationPipe(CreateInventoryLocationSchema)) body: CreateInventoryLocationDto) {
    return this.createInventoryLocationUseCase.execute(body)
  }

  @ApiOperation({
    summary: 'Cập nhật thông tin địa điểm nhà chứa (Kho)',
    description: 'API dành riêng cho Admin để cập nhật thông tin nhà chứa hoặc thay đổi trạng thái hoạt động của nó (ACTIVE, INACTIVE, ARCHIVED). Khi không còn sử dụng, hãy đổi trạng thái sang INACTIVE hoặc ARCHIVED thay vì xóa.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Lấy ID kho từ GET /api/v1/staff/inventory-locations', example: '550e8400-e29b-41d4-a716-446655440011' })
  @ApiBody({
    description: 'Gửi các trường cần đổi; ví dụ dưới đây đổi tên kho. Chỉ dùng INACTIVE/ARCHIVED sau khi kiểm tra tác động đến thiết bị.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Nhà Chứa Trung Tâm HCM (Đã đổi địa điểm)', description: 'Tên hiển thị mới' },
        address: { type: 'string', example: 'Quận 2, TP. Hồ Chí Minh', description: 'Địa chỉ chi tiết mới' },
        latitude: { type: 'number', example: 10.7923 },
        longitude: { type: 'number', example: 106.6990 },
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], example: 'INACTIVE', description: 'Trạng thái hoạt động' },
      },
      example: { name: 'Kho Trung Tâm HCM mới' },
    },
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @Put(':id')
  async updateLocation(
    @Param(new ZodValidationPipe(IdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(UpdateInventoryLocationSchema)) body: UpdateInventoryLocationDto,
  ) {
    return this.updateInventoryLocationUseCase.execute(params.id, body)
  }
}
