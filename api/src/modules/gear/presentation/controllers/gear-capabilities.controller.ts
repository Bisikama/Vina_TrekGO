import { Controller, Get, HttpCode, HttpStatus, Inject, Optional } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Auth } from '../../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../../shared/constants/auth.constant'
import { GEAR_AI_PORT } from '../../application/ports/gear-ai.port'
import type { GearAiPort } from '../../application/ports/gear-ai.port'
import { PAGE_READER_PORT } from '../../application/ports/page-reader.port'
import type { PageReaderPort } from '../../application/ports/page-reader.port'
import { getGearCapabilities, type GearCapabilities } from '../../application/services/gear-capabilities'

export type { CapabilityStatus } from '../../application/services/gear-capabilities'
export type GearCapabilitiesResponse = GearCapabilities

@ApiTags('Gear - Capabilities (Trạng thái tiện ích & AI)')
@Auth([AuthType.Optional])
@Controller('gear/capabilities')
export class GearCapabilitiesController {
  constructor(
    @Optional() @Inject(GEAR_AI_PORT) private readonly gearAiPort?: GearAiPort,
    @Optional() @Inject(PAGE_READER_PORT) private readonly pageReaderPort?: PageReaderPort,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kiểm tra trạng thái tính năng và tiện ích AI của Tủ đồ (Gear Advisor)',
    description: `
Truy vấn trạng thái hoạt động của các tiện ích trong hệ thống Gear Advisor:
- **ruleBasedAdvice**: Tư vấn theo bộ quy tắc chuẩn hoá (luôn sẵn sàng, không cần AI).
- **aiAdvice**: Tư vấn bổ sung bằng AI (mặc định tắt, \`GEAR_AI_ADVICE_ENABLED\`). Tắt hoặc lỗi → tự dùng bộ quy tắc.
- **imageExtraction**: Đọc thông số từ ảnh nhãn mác (\`GEAR_IMAGE_EXTRACTION_ENABLED\`).
- **linkExtraction**: Đọc thông số từ đường link web (mặc định tắt, \`GEAR_LINK_EXTRACTION_ENABLED\`).

Phân biệt **bật/tắt** (\`enabled\`) và **đủ cấu hình** (\`configured\`). Khi đọc ảnh/link không dùng được,
\`POST /gear/extractions\` vẫn trả bản nháp "cần nhập tay" (\`manualEntry.required = true\`), không trả lỗi.
Không yêu cầu chuyến đi (Trip) và không trả thông tin nhạy cảm (API key, URL nội bộ).
    `,
  })
  @ApiResponse({ status: 200, description: 'Trạng thái các tiện ích của Tủ đồ' })
  getCapabilities(): GearCapabilitiesResponse {
    return getGearCapabilities(this.gearAiPort, this.pageReaderPort)
  }
}
