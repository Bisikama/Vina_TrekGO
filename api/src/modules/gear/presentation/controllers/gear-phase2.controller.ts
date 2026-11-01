import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../../shared/decorators/active-user.decorator'
import { Roles } from '../../../../shared/decorators/roles.decorator'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { GearPhase2Service } from '../../application/services/gear-phase2.service'
import { catalogCreateItemSchema, catalogSearchSchema, catalogVerifySchema, personalCatalogDraftSchema, personalCatalogUpdateSchema, preparationSelectionSchema } from '../../application/dtos/gear-phase2.dto'
import type { CatalogCreateItemInput, PersonalCatalogDraftInput, PersonalCatalogUpdateInput, PreparationSelectionInput } from '../../application/dtos/gear-phase2.dto'
import { toWireUserGearItem } from './user-gear.controller'

@ApiTags('Gear - Preparation & Personal Catalog')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller()
export class GearPhase2Controller {
  constructor(private readonly service: GearPhase2Service) {}

  @Get('gear/plans/:id/preparation-selections')
  @ApiOperation({ summary: 'Đọc lựa chọn có/chưa có/kiểm tra sau theo kế hoạch' })
  @ApiResponse({ status: 200, description: 'Chưa có bản lưu trả version 0 và choices rỗng' })
  getSelections(@Param('id', ParseUUIDPipe) id: string, @ActiveUser('id') userId: string) {
    return this.service.getSelections(id, userId)
  }

  @Put('gear/plans/:id/preparation-selections')
  @ApiOperation({ summary: 'Lưu lựa chọn theo kế hoạch với CAS độc lập', description: 'Thay toàn bộ choices; version 0 tạo lần đầu. Không chọn món vào plan, không thay checklist đóng gói hay kết quả đánh giá.' })
  @ApiBody({ schema: { type: 'object', required: ['expectedVersion', 'choices'], properties: {
    expectedVersion: { type: 'integer', minimum: 0 }, choices: { type: 'array', items: { type: 'object', required: ['category', 'status'], properties: {
      category: { type: 'string', enum: ['JACKET', 'FOOTWEAR', 'PANTS', 'BACKPACK', 'SLEEPING_BAG', 'TENT', 'TREKKING_POLE', 'RAIN_GEAR'] },
      status: { type: 'string', enum: ['HAVE', 'NOT_HAVE', 'CHECK_LATER'] },
    } } },
  }, example: { expectedVersion: 0, choices: [{ category: 'JACKET', status: 'HAVE' }] } } })
  @ApiResponse({ status: 200, description: 'Bản lựa chọn mới kèm version' })
  @ApiResponse({ status: 409, description: 'Phiên bản lựa chọn đã thay đổi' })
  putSelections(@Param('id', ParseUUIDPipe) id: string, @ActiveUser('id') userId: string,
    @Body(new ZodValidationPipe(preparationSelectionSchema)) body: PreparationSelectionInput) {
    return this.service.putSelections(id, userId, body)
  }

  @Post('staff/gear/personal-catalog')
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo hồ sơ sản phẩm cá nhân chờ kiểm duyệt', description: 'Mỗi thông số có giá trị cần nguồn minh chứng tương ứng; hồ sơ DRAFT chưa hiện với người dùng.' })
  @ApiBody({ schema: { type: 'object', required: ['name', 'category', 'attributes', 'evidence'], properties: {
    name: { type: 'string' }, brand: { type: 'string', nullable: true }, category: { type: 'string' },
    attributes: { type: 'object', example: { waterproof_mm: 10000 } }, evidence: { type: 'object', example: { waterproof_mm: 'Thông số nhà sản xuất, trang 4' } },
  } } })
  createDraft(@ActiveUser('id') actorId: string, @Body(new ZodValidationPipe(personalCatalogDraftSchema)) body: PersonalCatalogDraftInput) {
    return this.service.createDraft(actorId, body)
  }

  @Get('staff/gear/personal-catalog/drafts')
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Danh sách hồ sơ sản phẩm cá nhân đang chờ kiểm duyệt' })
  listDrafts() { return this.service.listDrafts() }

  @Put('staff/gear/personal-catalog/:id')
  @Roles(UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Chỉnh sửa hồ sơ đang chờ duyệt', description: 'Gửi toàn bộ nội dung bản nháp và expectedVersion; hồ sơ đã duyệt hoặc thu hồi không chỉnh sửa được.' })
  @ApiBody({ schema: { type: 'object', required: ['expectedVersion', 'name', 'category', 'attributes', 'evidence'], properties: {
    expectedVersion: { type: 'integer', minimum: 1 }, name: { type: 'string' }, brand: { type: 'string', nullable: true },
    category: { type: 'string' }, attributes: { type: 'object' }, evidence: { type: 'object' },
  } } })
  updateDraft(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(personalCatalogUpdateSchema)) body: PersonalCatalogUpdateInput) {
    return this.service.updateDraft(id, body)
  }

  @Post('admin/gear/personal-catalog/:id/verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Duyệt và công bố hồ sơ sản phẩm cá nhân' })
  @ApiBody({ schema: { type: 'object', required: ['expectedVersion'], properties: { expectedVersion: { type: 'integer', minimum: 1 } } } })
  verify(@Param('id', ParseUUIDPipe) id: string, @ActiveUser('id') actorId: string,
    @Body(new ZodValidationPipe(catalogVerifySchema)) body: { expectedVersion: number }) {
    return this.service.verify(id, actorId, body.expectedVersion)
  }

  @Post('admin/gear/personal-catalog/:id/revoke')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ngừng công bố hồ sơ đã kiểm duyệt', description: 'Hồ sơ bị thu hồi không còn xuất hiện trong tìm kiếm và không thể sao chép mới.' })
  @ApiBody({ schema: { type: 'object', required: ['expectedVersion'], properties: { expectedVersion: { type: 'integer', minimum: 1 } } } })
  revoke(@Param('id', ParseUUIDPipe) id: string, @ActiveUser('id') actorId: string,
    @Body(new ZodValidationPipe(catalogVerifySchema)) body: { expectedVersion: number }) {
    return this.service.revoke(id, actorId, body.expectedVersion)
  }

  @Get('gear/personal-catalog')
  @ApiOperation({ summary: 'Tìm sản phẩm cá nhân đã kiểm duyệt', description: 'Lọc q theo tên/thương hiệu và category; dùng nextCursor để lấy trang tiếp theo, limit tối đa 50.' })
  search(@Query(new ZodValidationPipe(catalogSearchSchema)) query: { q?: string; category?: any; cursor?: string; limit: number }) { return this.service.search(query) }

  @Get('gear/personal-catalog/:id')
  @ApiOperation({ summary: 'Xem trạng thái hồ sơ sản phẩm đã công bố', description: 'Hồ sơ đã thu hồi chỉ trả ID, trạng thái và thời điểm thu hồi.' })
  getCatalogItem(@Param('id', ParseUUIDPipe) id: string) { return this.service.getCatalogItem(id) }

  @Post('gear/personal-catalog/:id/items')
  @ApiOperation({ summary: 'Thêm sản phẩm đã kiểm duyệt vào tủ đồ của mình', description: 'Tạo bản sao riêng và gắn nguồn theo từng thông số; vẫn áp dụng giới hạn tủ đồ và cảnh báo trùng.' })
  @ApiBody({ schema: { type: 'object', required: ['condition'], properties: {
    condition: { type: 'string', enum: ['new', 'good', 'worn', 'poor'] }, acknowledgeDuplicate: { type: 'boolean' },
  } } })
  async createItem(@Param('id', ParseUUIDPipe) id: string, @ActiveUser('id') userId: string,
    @Body(new ZodValidationPipe(catalogCreateItemSchema)) body: CatalogCreateItemInput) {
    return toWireUserGearItem(await this.service.createItemFromCatalog(id, userId, body))
  }
}
