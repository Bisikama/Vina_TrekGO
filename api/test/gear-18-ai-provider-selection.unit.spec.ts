import { SelectableGearAiAdapter } from '../src/modules/gear/infrastructure/adapters/selectable-gear-ai.adapter'
import { OpenAiGearAiAdapter } from '../src/modules/gear/infrastructure/adapters/openai-gear-ai.adapter'
import {
  activeAiExtractionSettings,
  getGearCapabilities,
  readGearRuntimeConfig,
} from '../src/modules/gear/application/services/gear-capabilities'
import { GEAR_ERROR_CODES } from '../src/shared/errors/codes/gear.error-codes'
import { AppError } from '../src/shared/errors/app-error'

const ENV_KEYS = [
  'GEAR_AI_PROVIDER',
  'OPENAI_API_KEY',
  'OPENAI_MODEL_EXTRACTION',
  'OPENAI_TIMEOUT_MS',
  'OPENAI_MAX_RETRIES',
  'GEMINI_MODEL_EXTRACTION',
  'GEMINI_TIMEOUT_MS',
  'GEAR_AI_ADVICE_ENABLED',
  'GEAR_IMAGE_EXTRACTION_ENABLED',
]

describe('Gear — chọn nhà cung cấp AI (GEAR_AI_PROVIDER)', () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
    jest.restoreAllMocks()
  })

  const extraction = {
    extraction: { category: 'JACKET', attributes: {} },
    metadata: { promptVersion: '1', promptHash: 'h', modelVersion: 'm', schemaVersion: 's', latencyMs: 1 },
  } as any

  function makeSelectable() {
    const gemini = {
      isConfigured: jest.fn(() => true),
      extractGear: jest.fn(async () => extraction),
      generateAdvice: jest.fn(async () => ({ source: 'AI' })),
    }
    const openai = {
      isConfigured: jest.fn(() => false),
      extractGear: jest.fn(async () => extraction),
    }
    return { gemini, openai, adapter: new SelectableGearAiAdapter(gemini as any, openai as any) }
  }

  it('mặc định (không đặt hoặc giá trị lạ) dùng Gemini', async () => {
    const { gemini, openai, adapter } = makeSelectable()
    process.env.GEAR_AI_PROVIDER = 'claude'

    await adapter.extractGear({ sourceType: 'LINK', textContent: 'x' })

    expect(adapter.providerName()).toBe('gemini')
    expect(adapter.isConfigured()).toBe(true)
    expect(adapter.supportsAdvice()).toBe(true)
    expect(gemini.extractGear).toHaveBeenCalledTimes(1)
    expect(openai.extractGear).not.toHaveBeenCalled()
  })

  it('GEAR_AI_PROVIDER=openai → đọc thông số qua OpenAI; isConfigured theo OpenAI; đổi env có hiệu lực ngay', async () => {
    const { gemini, openai, adapter } = makeSelectable()
    process.env.GEAR_AI_PROVIDER = 'openai'

    await adapter.extractGear({ sourceType: 'LINK', textContent: 'x' })

    expect(adapter.providerName()).toBe('openai')
    expect(adapter.isConfigured()).toBe(false)
    expect(openai.extractGear).toHaveBeenCalledTimes(1)
    expect(gemini.extractGear).not.toHaveBeenCalled()

    process.env.GEAR_AI_PROVIDER = 'gemini'
    expect(adapter.providerName()).toBe('gemini')
  })

  it('OpenAI chưa hỗ trợ lời khuyên → generateAdvice ném GEAR_AI_UNAVAILABLE (service dùng bộ quy tắc)', async () => {
    const { gemini, adapter } = makeSelectable()
    process.env.GEAR_AI_PROVIDER = 'openai'

    expect(adapter.supportsAdvice()).toBe(false)
    const err = await adapter.generateAdvice({} as any).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe(GEAR_ERROR_CODES.GEAR_AI_UNAVAILABLE)
    expect(gemini.generateAdvice).not.toHaveBeenCalled()
  })

  it('model và thời gian chờ (khoá cache, TTL khoá) theo nhà cung cấp đang chọn', () => {
    process.env.OPENAI_MODEL_EXTRACTION = 'gpt-x'
    process.env.OPENAI_TIMEOUT_MS = '20000'
    expect(activeAiExtractionSettings(readGearRuntimeConfig())).toEqual({ model: 'gemini-2.5-flash', timeoutMs: 30000 })

    process.env.GEAR_AI_PROVIDER = 'openai'
    expect(activeAiExtractionSettings(readGearRuntimeConfig())).toEqual({ model: 'gpt-x', timeoutMs: 20000 })
  })

  it('capabilities với OpenAI: đọc thông số sẵn sàng, lời khuyên AI báo không hỗ trợ', () => {
    process.env.GEAR_AI_PROVIDER = 'openai'
    process.env.GEAR_AI_ADVICE_ENABLED = 'true'
    process.env.OPENAI_API_KEY = 'sk-test'
    const adapter = new SelectableGearAiAdapter({ extractGear: jest.fn() } as any, new OpenAiGearAiAdapter())

    const caps = getGearCapabilities(adapter, undefined)

    expect(caps.aiProvider).toBe('openai')
    expect(caps.imageExtraction).toMatchObject({ enabled: true, configured: true })
    expect(caps.aiAdvice).toMatchObject({ enabled: true, configured: false })
    expect(caps.aiAdvice.messageVi).toContain('chỉ hỗ trợ đọc thông số')
  })

  describe('OpenAiGearAiAdapter', () => {
    it('isConfigured theo OPENAI_API_KEY (rỗng/khoảng trắng = chưa cấu hình)', () => {
      const adapter = new OpenAiGearAiAdapter()
      expect(adapter.isConfigured()).toBe(false)
      process.env.OPENAI_API_KEY = '   '
      expect(adapter.isConfigured()).toBe(false)
      process.env.OPENAI_API_KEY = 'sk-test'
      expect(adapter.isConfigured()).toBe(true)
    })

    it('thiếu key → GEAR_AI_UNAVAILABLE, không gọi mạng', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch')
      const err = await new OpenAiGearAiAdapter().extractGear({ sourceType: 'LINK', textContent: 'x' }).catch((e) => e)

      expect(err.code).toBe(GEAR_ERROR_CODES.GEAR_AI_UNAVAILABLE)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('trả JSON hợp lệ → kết quả trích xuất với model đã cấu hình', async () => {
      process.env.OPENAI_API_KEY = 'sk-test'
      process.env.OPENAI_MODEL_EXTRACTION = 'gpt-x'
      const body = {
        choices: [{ message: { content: JSON.stringify({ category: 'JACKET', name: 'Áo khoác', attributes: {} }) } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      }
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))

      const res = await new OpenAiGearAiAdapter().extractGear({ sourceType: 'LINK', textContent: 'Áo khoác' })

      expect(JSON.parse((fetchSpy.mock.calls[0][1] as any).body).model).toBe('gpt-x')
      expect(res.metadata.modelVersion).toBe('gpt-x')
      expect(res.metadata.usage).toEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3 })
    })

    it('429 lặp lại → GEAR_AI_RATE_LIMITED (service đổi thành bản nháp nhập tay AI_RATE_LIMITED)', async () => {
      process.env.OPENAI_API_KEY = 'sk-test'
      process.env.OPENAI_MAX_RETRIES = '0'
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response('slow down', { status: 429 }))

      const err = await new OpenAiGearAiAdapter().extractGear({ sourceType: 'LINK', textContent: 'x' }).catch((e) => e)

      expect(err.code).toBe(GEAR_ERROR_CODES.GEAR_AI_RATE_LIMITED)
    })
  })
})
