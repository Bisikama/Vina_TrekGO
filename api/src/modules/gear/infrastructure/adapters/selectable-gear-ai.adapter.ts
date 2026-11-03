import { Injectable } from '@nestjs/common'
import { AppError } from '../../../../shared/errors/app-error'
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes'
import type {
  GearAdviceAiRequest,
  GearAdviceAiResult,
  GearAiPort,
  GearExtractionAiRequest,
  GearExtractionAiResult,
} from '../../application/ports/gear-ai.port'
import { readGearRuntimeConfig, type GearAiProvider } from '../../application/services/gear-capabilities'
import { GeminiGearAiAdapter } from './gemini-gear-ai.adapter'
import { OpenAiGearAiAdapter } from './openai-gear-ai.adapter'

/**
 * `GEAR_AI_PORT`: chuyển mỗi lời gọi tới nhà cung cấp chọn bằng `GEAR_AI_PROVIDER` (gemini mặc định | openai).
 * Đọc lúc gọi nên đổi nhà cung cấp chỉ cần đổi env, không sửa code.
 * OpenAI chưa có `generateAdvice` → ném GEAR_AI_UNAVAILABLE, service tự dùng lời khuyên theo bộ quy tắc.
 */
@Injectable()
export class SelectableGearAiAdapter implements GearAiPort {
  constructor(
    private readonly gemini: GeminiGearAiAdapter,
    private readonly openai: OpenAiGearAiAdapter,
  ) {}

  private activeName(): GearAiProvider {
    return readGearRuntimeConfig().aiProvider
  }

  private active(): GearAiPort {
    return this.activeName() === 'openai' ? this.openai : this.gemini
  }

  providerName(): string {
    return this.activeName()
  }

  isConfigured(): boolean {
    const adapter = this.active()
    return adapter.isConfigured ? adapter.isConfigured() : true
  }

  supportsAdvice(): boolean {
    return typeof this.active().generateAdvice === 'function'
  }

  extractGear(request: GearExtractionAiRequest): Promise<GearExtractionAiResult> {
    return this.active().extractGear(request)
  }

  async generateAdvice(request: GearAdviceAiRequest): Promise<GearAdviceAiResult> {
    const adapter = this.active()
    if (!adapter.generateAdvice) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_UNAVAILABLE, {
        message: `Nhà cung cấp AI '${this.activeName()}' chưa hỗ trợ sinh lời khuyên`,
      })
    }
    return adapter.generateAdvice(request)
  }
}
