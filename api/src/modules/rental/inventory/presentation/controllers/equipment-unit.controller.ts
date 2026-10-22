import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiParam, ApiBody } from '@nestjs/swagger'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { AuthType } from 'src/shared/constants/auth.constant'
import { UserRole } from 'src/shared/constants/enum.constant'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import type { ActiveUserData } from 'src/shared/types/user.type'
import { ApiErrorResponse, ApiErrorResponses } from 'src/shared/swagger/api-error-response.helper'
import { z } from 'zod'

import { ListEquipmentUnitsUseCase } from '../../application/use-cases/list-equipment-units.use-case'
import { CreateEquipmentUnitUseCase } from '../../application/use-cases/create-equipment-unit.use-case'
import { GetEquipmentUnitUseCase } from '../../application/use-cases/get-equipment-unit.use-case'
import { UpdateEquipmentUnitUseCase } from '../../application/use-cases/update-equipment-unit.use-case'
import { BatchCreateEquipmentUnitsUseCase } from '../../application/use-cases/batch-create-equipment-units.use-case'
import { GenerateEquipmentLabelsUseCase } from '../../application/use-cases/generate-equipment-labels.use-case'
import { ChangeEquipmentMaintenanceUseCase } from '../../application/use-cases/change-equipment-maintenance.use-case'

import { ListEquipmentUnitsSchema, type ListEquipmentUnitsDto } from '../dtos/list-equipment-units.dto'
import { CreateEquipmentUnitSchema, type CreateEquipmentUnitDto } from '../dtos/create-equipment-unit.dto'
import { UpdateEquipmentUnitSchema, type UpdateEquipmentUnitDto } from '../dtos/update-equipment-unit.dto'
import {
  BatchCreateEquipmentUnitsSchema,
  type BatchCreateEquipmentUnitsDto,
} from '../dtos/batch-create-equipment-units.dto'
import { GenerateEquipmentLabelsSchema, type GenerateEquipmentLabelsDto } from '../dtos/generate-equipment-labels.dto'
import { ChangeEquipmentMaintenanceSchema, type ChangeEquipmentMaintenanceDto } from '../dtos/equipment-maintenance.dto'

const IdParamSchema = z.object({
  id: z.string().uuid(),
})

@ApiTags('Staff Equipment Units')
@ApiBearerAuth()
@Auth([AuthType.Bearer])
@Controller('staff/equipment-units')
export class EquipmentUnitController {
  constructor(
    private readonly listEquipmentUnitsUseCase: ListEquipmentUnitsUseCase,
    private readonly createEquipmentUnitUseCase: CreateEquipmentUnitUseCase,
    private readonly getEquipmentUnitUseCase: GetEquipmentUnitUseCase,
    private readonly updateEquipmentUnitUseCase: UpdateEquipmentUnitUseCase,
    private readonly batchCreateEquipmentUnitsUseCase: BatchCreateEquipmentUnitsUseCase,
    private readonly generateEquipmentLabelsUseCase: GenerateEquipmentLabelsUseCase,
    private readonly changeEquipmentMaintenanceUseCase: ChangeEquipmentMaintenanceUseCase,
  ) {}

  @ApiOperation({
    summary: 'Lấy danh sách thiết bị vật lý trong kho',
    description: `
Lấy danh sách thiết bị vật lý thực tế. Quyền: STAFF_INVENTORY | ADMIN
- Trả về danh sách từng EquipmentUnit cụ thể.
- Có thể lọc theo Product, status, condition, current inventory location.
- Có tổng hợp counts (available, rented, etc.) trên toàn bộ danh sách phù hợp với các bộ lọc không phụ thuộc status, giúp làm tab trạng thái.
- Lưu ý: inventoryLocationId ở đây lọc theo CURRENT physical location.
- Không tính toán khả năng có sẵn (availability) theo Trip hay thời gian thuê.
`,
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
  @ApiQuery({
    name: 'productId',
    required: false,
    type: String,
    format: 'uuid',
    description: 'Lọc theo ID của sản phẩm (RentalProduct)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'AVAILABLE',
      'PICKED',
      'PACKED',
      'RENTED',
      'RETURN_PENDING',
      'CLEANING',
      'MAINTENANCE',
      'DAMAGED',
      'LOST',
      'RETIRED',
    ],
    description: 'Lọc theo trạng thái lifecycle của thiết bị',
  })
  @ApiQuery({
    name: 'condition',
    required: false,
    enum: ['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST'],
    description: 'Lọc theo tình trạng vật lý của thiết bị',
  })
  @ApiQuery({
    name: 'inventoryLocationId',
    required: false,
    type: String,
    format: 'uuid',
    description: 'Lọc theo vị trí vật lý HIỆN TẠI của thiết bị',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Tìm kiếm theo từ khoá (ví dụ: mã tài sản TENT-4P-0001)',
    example: 'TENT-4P-0001',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách đơn vị thiết bị kèm phân trang và counts',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            pageSize: { type: 'number' },
            totalItems: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
        counts: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            available: { type: 'number' },
            picked: { type: 'number' },
            packed: { type: 'number' },
            rented: { type: 'number' },
            returnPending: { type: 'number' },
            cleaning: { type: 'number' },
            maintenance: { type: 'number' },
            damaged: { type: 'number' },
            lost: { type: 'number' },
            retired: { type: 'number' },
          },
        },
      },
    },
  })
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @Get()
  async listUnits(@Query(new ZodValidationPipe(ListEquipmentUnitsSchema)) query: ListEquipmentUnitsDto) {
    return this.listEquipmentUnitsUseCase.execute(query)
  }

  @ApiOperation({
    summary: 'Tạo mới một đơn vị thiết bị vật lý',
    description: `
Tạo một thiết bị vật lý mới trong hệ thống. Quyền: STAFF_INVENTORY
- Yêu cầu productId và homeInventoryLocationId.
- qrCode được hệ thống tự động sinh.
- status luôn được hệ thống gán mặc định là AVAILABLE.
- currentInventoryLocation ban đầu được gán bằng homeInventoryLocation.
- condition mặc định là GOOD nếu không truyền. Chỉ chấp nhận NEW, GOOD, FAIR. Bị từ chối nếu là DAMAGED, LOST.
- assetCode có thể tự sinh nếu không truyền.
`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['productId', 'homeInventoryLocationId'],
      properties: {
        productId: { type: 'string', format: 'uuid', description: 'RentalProduct UUID' },
        homeInventoryLocationId: { type: 'string', format: 'uuid', description: 'InventoryLocation UUID' },
        assetCode: {
          type: 'string',
          maxLength: 100,
          nullable: true,
          description: 'Mã tài sản định danh, tự sinh nếu bỏ trống',
        },
        serialNumber: { type: 'string', maxLength: 100, nullable: true, description: 'Số Serial của NSX' },
        condition: {
          type: 'string',
          enum: ['NEW', 'GOOD', 'FAIR'],
          default: 'GOOD',
          description: 'Tình trạng thiết bị ban đầu',
        },
        acquiredAt: { type: 'string', format: 'date', description: 'Ngày mua/nhập kho (YYYY-MM-DD)' },
      },
      example: {
        productId: '11111111-1111-4111-8111-111111111111',
        homeInventoryLocationId: '22222222-2222-4222-8222-222222222222',
        assetCode: 'TENT-4P-0001',
        serialNumber: 'SN-TENT-0001',
        condition: 'GOOD',
        acquiredAt: '2026-09-28',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Đơn vị thiết bị được tạo thành công',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        assetCode: { type: 'string' },
      },
    },
  })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'Kiểm tra các trường bắt buộc và định dạng request')
  @ApiErrorResponse(404, 'Không tìm thấy sản phẩm', 'RENTAL_PRODUCT_NOT_FOUND', 'productId không tồn tại')
  @ApiErrorResponse(409, 'Mã tài sản đã tồn tại', 'EQUIPMENT_ASSET_CODE_EXISTS', 'Chọn assetCode khác')
  @ApiErrorResponse(422, 'Sản phẩm đã lưu trữ', 'RENTAL_PRODUCT_ARCHIVED', 'Không thể tạo thiết bị cho sản phẩm ARCHIVED')
  @Roles(UserRole.STAFF_INVENTORY)
  @Post()
  async createUnit(@Body(new ZodValidationPipe(CreateEquipmentUnitSchema)) body: CreateEquipmentUnitDto) {
    return this.createEquipmentUnitUseCase.execute(body)
  }

  @ApiOperation({
    summary: 'Tạo hàng loạt đơn vị thiết bị',
    description: `
Tạo nhiều thiết bị vật lý cùng lúc thông qua transaction (all-or-nothing). Quyền: STAFF_INVENTORY
- Hỗ trợ chế độ AUTO (hệ thống tự sinh assetCode) và PROVIDED (client cung cấp danh sách assetCode).
- PROVIDED: assetCodes count must equal quantity.
- condition mặc định là GOOD nếu không truyền. Bị từ chối nếu là DAMAGED, LOST.
`,
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          title: 'AUTO mode',
          type: 'object',
          required: ['productId', 'homeInventoryLocationId', 'quantity', 'assetCodeMode'],
          properties: {
            productId: { type: 'string', format: 'uuid' },
            homeInventoryLocationId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1, maximum: 100 },
            assetCodeMode: { type: 'string', enum: ['AUTO'] },
            condition: { type: 'string', enum: ['NEW', 'GOOD', 'FAIR'], default: 'GOOD' },
            acquiredAt: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
          },
          example: {
            productId: '11111111-1111-4111-8111-111111111111',
            homeInventoryLocationId: '22222222-2222-4222-8222-222222222222',
            quantity: 5,
            assetCodeMode: 'AUTO',
            condition: 'GOOD',
            acquiredAt: '2026-09-28',
          },
        },
        {
          title: 'PROVIDED mode',
          type: 'object',
          required: ['productId', 'homeInventoryLocationId', 'quantity', 'assetCodeMode', 'assetCodes'],
          properties: {
            productId: { type: 'string', format: 'uuid' },
            homeInventoryLocationId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1, maximum: 100 },
            assetCodeMode: { type: 'string', enum: ['PROVIDED'] },
            assetCodes: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 100 },
            condition: { type: 'string', enum: ['NEW', 'GOOD', 'FAIR'], default: 'GOOD' },
            acquiredAt: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
          },
          example: {
            productId: '11111111-1111-4111-8111-111111111111',
            homeInventoryLocationId: '22222222-2222-4222-8222-222222222222',
            quantity: 3,
            assetCodeMode: 'PROVIDED',
            assetCodes: ['TENT-0001', 'TENT-0002', 'TENT-0003'],
            condition: 'GOOD',
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Danh sách các đơn vị thiết bị được tạo',
    schema: {
      type: 'object',
      properties: {
        createdUnits: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } },
      },
    },
  })
  @ApiErrorResponse(
    400,
    'Dữ liệu không hợp lệ',
    'BATCH_ASSET_CODE_COUNT_MISMATCH',
    'Số mã assetCodes phải bằng quantity',
  )
  @ApiErrorResponse(409, 'Mã tài sản đã tồn tại', 'EQUIPMENT_ASSET_CODE_EXISTS', 'Ít nhất một assetCode đã được sử dụng')
  @Roles(UserRole.STAFF_INVENTORY)
  @Post('batch')
  async batchCreateUnits(
    @Body(new ZodValidationPipe(BatchCreateEquipmentUnitsSchema)) body: BatchCreateEquipmentUnitsDto,
  ) {
    return this.batchCreateEquipmentUnitsUseCase.execute(body)
  }

  @ApiOperation({
    summary: 'Lấy dữ liệu in mã QR',
    description: `
Lấy thông tin cần thiết để in tem nhãn QR cho thiết bị. Quyền: STAFF_INVENTORY
- API chỉ đọc (read-only), không thay đổi lifecycle thiết bị.
- Thông tin QR chứa mã nhận dạng vô hại, không chứa dữ liệu nhạy cảm.
`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['unitIds'],
      properties: {
        unitIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 },
      },
      example: {
        unitIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Danh sách thông tin in tem mã QR (POST chỉ đọc, không đổi trạng thái thiết bị)',
    schema: {
      type: 'object',
      properties: {
        labels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              unitId: { type: 'string', format: 'uuid' },
              assetCode: { type: 'string' },
              qrPayload: { type: 'string' },
              printText: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiErrorResponse(404, 'Không tìm thấy thiết bị', 'EQUIPMENT_UNIT_NOT_FOUND', 'Ít nhất một unitId không tồn tại')
  @Roles(UserRole.STAFF_INVENTORY)
  @Post('labels')
  async generateLabels(@Body(new ZodValidationPipe(GenerateEquipmentLabelsSchema)) body: GenerateEquipmentLabelsDto) {
    return this.generateEquipmentLabelsUseCase.execute(body)
  }

  @ApiOperation({
    summary: 'Lấy thông tin chi tiết một đơn vị thiết bị',
    description: 'Trả về thông tin chi tiết và lịch sử các thay đổi. Quyền: STAFF_INVENTORY | ADMIN',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'EquipmentUnit UUID',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết đơn vị thiết bị và lịch sử',
    schema: {
      type: 'object',
      properties: {
        unit: { type: 'object' },
        history: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  @ApiErrorResponse(404, 'Không tìm thấy thiết bị', 'EQUIPMENT_UNIT_NOT_FOUND', 'unitId không tồn tại')
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @Get(':id')
  async getUnit(@Param(new ZodValidationPipe(IdParamSchema)) params: { id: string }) {
    return this.getEquipmentUnitUseCase.execute(params.id)
  }

  @ApiOperation({
    summary: 'Cập nhật thông tin metadata của đơn vị thiết bị',
    description: `
Chỉ cho phép cập nhật các trường metadata: homeInventoryLocationId, serialNumber, acquiredAt. Quyền: STAFF_INVENTORY
- Không thể cập nhật lifecycle fields (status, condition, currentInventoryLocationId, qrCode).
- Yêu cầu expectedVersion để chặn xung đột phiên bản (optimistic concurrency).
- Gửi null để xóa trường (ví dụ serialNumber: null).
`,
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'EquipmentUnit UUID',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedVersion'],
      properties: {
        expectedVersion: { type: 'integer', minimum: 1 },
        homeInventoryLocationId: { type: 'string', format: 'uuid', nullable: true },
        serialNumber: { type: 'string', nullable: true },
        acquiredAt: { type: 'string', format: 'date', nullable: true },
      },
      example: {
        expectedVersion: 1,
        homeInventoryLocationId: '22222222-2222-4222-8222-222222222222',
        serialNumber: 'SN-UPDATED-001',
        acquiredAt: '2026-09-30',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Đơn vị thiết bị sau khi cập nhật',
    schema: {
      type: 'object',
      properties: { id: { type: 'string', format: 'uuid' }, version: { type: 'integer' } },
    },
  })
  @ApiErrorResponse(409, 'Xung đột phiên bản', 'VERSION_CONFLICT', 'Thiết bị đã thay đổi; lấy version mới rồi thử lại')
  @Roles(UserRole.STAFF_INVENTORY)
  @Patch(':id')
  async updateUnit(
    @Param(new ZodValidationPipe(IdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(UpdateEquipmentUnitSchema)) body: UpdateEquipmentUnitDto,
  ) {
    return this.updateEquipmentUnitUseCase.execute(params.id, body)
  }

  @ApiOperation({
    summary: 'Chuyển trạng thái bảo trì thiết bị',
    description: `
Thực hiện bảo trì thiết bị với cơ chế atomic. Quyền: STAFF_INVENTORY
START:
- Thiết bị phải đang ở trạng thái AVAILABLE, CLEANING hoặc DAMAGED.
- Không hỗ trợ bảo trì đối với thiết bị đang bị kẹt trong luồng xử lý (PICKED, PACKED, RETURN_PENDING, MAINTENANCE, LOST, RETIRED).
- Đặc biệt bị từ chối với lỗi EQUIPMENT_UNIT_RENTED nếu thiết bị đang RENTED.
COMPLETE:
- Cập nhật lại condition (tình trạng) sau bảo trì.
- Nếu chọn NEW/GOOD/FAIR -> Thiết bị sẽ sẵn sàng (AVAILABLE).
- Nếu chọn DAMAGED/LOST -> Thiết bị sẽ bị khóa ở DAMAGED/LOST.
- Giá trị affectedOrdersEvaluated=false có nghĩa là chưa thực hiện đánh giá ảnh hưởng đơn hàng tương lai.
`,
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'EquipmentUnit UUID',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          title: 'START MAINTENANCE',
          type: 'object',
          required: ['action', 'reason', 'expectedVersion'],
          properties: {
            action: { type: 'string', enum: ['START'] },
            reason: { type: 'string', maxLength: 500 },
            notes: { type: 'string', maxLength: 1000, nullable: true },
            expectedVersion: { type: 'integer', minimum: 1 },
          },
          example: {
            action: 'START',
            reason: 'Khóa kéo của balo bị hỏng, cần sửa chữa',
            notes: 'Phát hiện trong lúc kiểm kê kho',
            expectedVersion: 3,
          },
        },
        {
          title: 'COMPLETE MAINTENANCE',
          type: 'object',
          required: ['action', 'resultingCondition', 'expectedVersion'],
          properties: {
            action: { type: 'string', enum: ['COMPLETE'] },
            resultingCondition: { type: 'string', enum: ['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST'] },
            expectedVersion: { type: 'integer', minimum: 1 },
          },
          example: {
            action: 'COMPLETE',
            resultingCondition: 'GOOD',
            expectedVersion: 4,
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Thiết bị và bản ghi bảo trì',
    schema: {
      type: 'object',
      properties: {
        unit: { type: 'object' },
        maintenance: { type: 'object' },
        affectedOrders: { type: 'array', items: { type: 'object' } },
        affectedOrdersEvaluated: { type: 'boolean' },
      },
    },
  })
  @ApiErrorResponses(409, 'Không thể chuyển trạng thái bảo trì', [
    { name: 'invalidState', summary: 'Trạng thái không cho phép bảo trì', code: 'EQUIPMENT_UNIT_NOT_MAINTAINABLE', message: 'Trạng thái thiết bị hiện tại không cho phép bảo trì' },
    { name: 'rented', summary: 'Thiết bị đang được thuê', code: 'EQUIPMENT_UNIT_RENTED', message: 'Không thể bảo trì thiết bị đang được thuê' },
    { name: 'alreadyInMaintenance', summary: 'Đã ở trạng thái bảo trì', code: 'EQUIPMENT_MAINTENANCE_STATE_CONFLICT', message: 'Thiết bị đã ở trạng thái MAINTENANCE' },
  ])
  @Roles(UserRole.STAFF_INVENTORY)
  @Post(':id/maintenance')
  async changeMaintenance(
    @Param(new ZodValidationPipe(IdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(ChangeEquipmentMaintenanceSchema)) body: ChangeEquipmentMaintenanceDto,
    @ActiveUser() actor: ActiveUserData,
  ) {
    if (body.action === 'START') {
      return this.changeEquipmentMaintenanceUseCase.execute(params.id, { ...body, staffId: actor.id })
    }
    return this.changeEquipmentMaintenanceUseCase.execute(params.id, body)
  }
}
