import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { CATEGORY_ATTRIBUTE_SCHEMAS, gearCategorySchema } from '../../application/dtos/user-gear.dto'
import type { GearCategory } from '../../domain/gear.types'

const categoryLabels: Record<GearCategory, string> = {
  JACKET: 'Áo khoác', FOOTWEAR: 'Giày', PANTS: 'Quần', BACKPACK: 'Balo',
  SLEEPING_BAG: 'Túi ngủ', TENT: 'Lều', TREKKING_POLE: 'Gậy trekking', RAIN_GEAR: 'Đồ đi mưa',
}

const optionLabels: Record<string, Record<string, string>> = {
  coverage: { UPPER_BODY: 'Thân trên', FULL_BODY: 'Toàn thân' },
}

const metadata: Record<string, { label: string; unit: string | null }> = {
  waterproof_mm: { label: 'Chống nước', unit: 'mm' },
  temp_rating_c: { label: 'Chịu lạnh', unit: '°C' },
  weight_g: { label: 'Trọng lượng', unit: 'g' },
  windproof: { label: 'Cản gió', unit: null },
  waterproof: { label: 'Chống nước', unit: null },
  ankle_support: { label: 'Hỗ trợ cổ chân', unit: null },
  grip_level: { label: 'Độ bám', unit: '/5' },
  insulated: { label: 'Giữ nhiệt', unit: null },
  capacity_l: { label: 'Dung tích', unit: 'L' },
  rain_cover: { label: 'Áo trùm mưa', unit: null },
  sleeping_places: { label: 'Sức chứa', unit: 'người' },
  flysheet_waterproof_mm: { label: 'Chống nước mái', unit: 'mm' },
  floor_waterproof_mm: { label: 'Chống nước đáy', unit: 'mm' },
  adjustable: { label: 'Điều chỉnh', unit: null },
  length_min_cm: { label: 'Dài tối thiểu', unit: 'cm' },
  length_max_cm: { label: 'Dài tối đa', unit: 'cm' },
  coverage: { label: 'Phạm vi che', unit: null },
}

@ApiTags('Gear - Attribute Schema')
@Auth([AuthType.Optional])
@Controller('gear/attribute-schema')
export class GearAttributeSchemaController {
  @Get()
  @ApiOperation({ summary: 'Danh sách thông số và quy tắc theo loại đồ', description: 'Không cần đăng nhập. schema là JSON Schema mô tả giá trị, bao gồm null; các trường đều có thể bỏ qua. Với gậy trekking, length_min_cm phải nhỏ hơn hoặc bằng length_max_cm khi cả hai có giá trị.' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách danh mục và thông số được backend hỗ trợ; schema theo JSON Schema draft 2020-12.',
    schema: {
      type: 'object',
      properties: {
        categories: { type: 'array', items: { type: 'object', properties: {
          category: { type: 'string', example: 'JACKET' },
          label: { type: 'string', example: 'Áo khoác' },
          attributes: { type: 'array', items: { type: 'object', properties: {
            key: { type: 'string', example: 'waterproof_mm' },
            label: { type: 'string', example: 'Chống nước' },
            unit: { type: 'string', nullable: true, example: 'mm' },
            schema: { type: 'object', description: 'JSON Schema cho giá trị, kể cả null', example: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] } },
            options: { type: 'array', description: 'Nhãn hiển thị cho giá trị enum, nếu có', items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } } },
          } } },
          rules: { type: 'array', description: 'Quy tắc liên trường nếu có', items: { type: 'object', example: { type: 'lessThanOrEqual', left: 'length_min_cm', right: 'length_max_cm' } } },
        } } },
      },
    },
  })
  getSchema() {
    return {
      categories: gearCategorySchema.options.map((category) => {
        const jsonSchema = z.toJSONSchema(CATEGORY_ATTRIBUTE_SCHEMAS[category])
        const properties = jsonSchema.properties as Record<string, unknown>
        return {
          category,
          label: categoryLabels[category],
          attributes: Object.entries(properties).map(([key, schema]) => {
            const json = schema as { enum?: string[]; anyOf?: Array<{ enum?: string[] }> }
            const values = json.enum ?? json.anyOf?.find((entry) => entry.enum)?.enum
            const labels = optionLabels[key]
            return {
              key, ...metadata[key], schema,
              ...(values ? { options: values.map((value) => ({ value, label: labels?.[value] ?? value })) } : {}),
            }
          }),
          ...(category === 'TREKKING_POLE' ? { rules: [{ type: 'lessThanOrEqual', left: 'length_min_cm', right: 'length_max_cm' }] } : {}),
        }
      }),
    }
  }
}
