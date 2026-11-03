import type { GearAiPort } from '../ports/gear-ai.port'
import type { PageReaderPort } from '../ports/page-reader.port'

/**
 * Một chỗ duy nhất đọc cờ bật/tắt AI của Gear advisor.
 *
 * Đọc `process.env` lúc gọi (không chụp lúc khởi động) để test và runtime bật/tắt được — cùng cách với
 * `BOOKING_EXPIRY_WORKER_ENABLED`, `TRIP_GPS_V2_ENABLED`. `src/shared/config.ts` vẫn validate các biến này
 * khi khởi động (chỉ nhận 'true' | 'false'); mặc định ở đây phải khớp mặc định ở đó.
 */
export interface GearFlags {
  aiAdviceEnabled: boolean
  imageExtractionEnabled: boolean
  linkExtractionEnabled: boolean
}

function flag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim()
  if (raw === 'true') return true
  if (raw === 'false') return false
  return defaultValue
}

export function readGearFlags(): GearFlags {
  return {
    aiAdviceEnabled: flag('GEAR_AI_ADVICE_ENABLED', false),
    imageExtractionEnabled: flag('GEAR_IMAGE_EXTRACTION_ENABLED', true),
    linkExtractionEnabled: flag('GEAR_LINK_EXTRACTION_ENABLED', false),
  }
}

/**
 * Thông số chạy của Gear advisor (quota, giới hạn, timeout, model).
 *
 * Cùng lý do với `readGearFlags`: đọc `process.env` lúc gọi chứ không dùng `envconfig` (parse một lần lúc
 * import), vì test và runtime thay các biến này khi đang chạy. `src/shared/config.ts` vẫn validate khi khởi
 * động; mặc định ở đây phải khớp mặc định ở đó.
 */
export type GearAiProvider = 'gemini' | 'openai'

export interface GearRuntimeConfig {
  aiProvider: GearAiProvider
  openaiModelExtraction: string
  openaiTimeoutMs: number
  openaiMaxRetries: number
  dailyQuota: number
  manualDraftHourlyLimit: number
  geminiTimeoutMs: number
  geminiMaxRetries: number
  geminiModelExtraction: string
  geminiModelAdvisor: string
  firecrawlApiUrl: string
  firecrawlTimeoutMs: number
}

function intEnv(name: string, defaultValue: number, min: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return defaultValue
  const value = Number(raw)
  return Number.isInteger(value) && value >= min ? value : defaultValue
}

function stringEnv(name: string, defaultValue: string): string {
  const raw = process.env[name]?.trim()
  return raw ? raw : defaultValue
}

export function readGearRuntimeConfig(): GearRuntimeConfig {
  const provider = process.env.GEAR_AI_PROVIDER?.trim().toLowerCase()
  return {
    aiProvider: provider === 'openai' ? 'openai' : 'gemini',
    openaiModelExtraction: stringEnv('OPENAI_MODEL_EXTRACTION', 'gpt-4o-mini'),
    openaiTimeoutMs: intEnv('OPENAI_TIMEOUT_MS', 30000, 1),
    openaiMaxRetries: intEnv('OPENAI_MAX_RETRIES', 2, 0),
    dailyQuota: intEnv('GEAR_EXTRACTION_DAILY_QUOTA', 20, 0),
    manualDraftHourlyLimit: intEnv('GEAR_MANUAL_DRAFT_HOURLY_LIMIT', 30, 1),
    geminiTimeoutMs: intEnv('GEMINI_TIMEOUT_MS', 30000, 1),
    geminiMaxRetries: intEnv('GEMINI_MAX_RETRIES', 2, 0),
    geminiModelExtraction: stringEnv('GEMINI_MODEL_EXTRACTION', 'gemini-2.5-flash'),
    geminiModelAdvisor: stringEnv('GEMINI_MODEL_ADVISOR', 'gemini-2.5-flash'),
    firecrawlApiUrl: stringEnv('FIRECRAWL_API_URL', 'https://api.firecrawl.dev'),
    firecrawlTimeoutMs: intEnv('FIRECRAWL_TIMEOUT_MS', 30000, 1),
  }
}

/** Model đọc thông số và thời gian chờ của nhà cung cấp AI đang chọn (dùng cho khoá cache và TTL khoá xử lý). */
export function activeAiExtractionSettings(runtime: GearRuntimeConfig): { model: string; timeoutMs: number } {
  return runtime.aiProvider === 'openai'
    ? { model: runtime.openaiModelExtraction, timeoutMs: runtime.openaiTimeoutMs }
    : { model: runtime.geminiModelExtraction, timeoutMs: runtime.geminiTimeoutMs }
}

/** Khoá xử lý AI phải sống lâu hơn toàn bộ thời gian chờ AI (gồm cả backoff giữa các lần thử). */
export const GEAR_AI_LEASE_MARGIN_MS = 15_000

/** Adapter không khai báo `isConfigured` (ví dụ port giả trong test) được coi là đã cấu hình. */
export function isAiConfigured(aiPort: GearAiPort | null | undefined): boolean {
  if (!aiPort) return false
  return aiPort.isConfigured ? aiPort.isConfigured() : true
}

export function isPageReaderConfigured(pageReader: PageReaderPort | null | undefined): boolean {
  if (!pageReader) return false
  return pageReader.isConfigured ? pageReader.isConfigured() : true
}

/** Lý do một bản nháp trích xuất phải nhập tay thay vì do AI điền. */
export type ManualEntryReasonCode =
  | 'AI_DISABLED'
  | 'AI_NOT_CONFIGURED'
  | 'AI_TIMEOUT'
  | 'AI_REFUSED'
  | 'AI_RATE_LIMITED'
  | 'AI_SCHEMA_MISMATCH'
  | 'AI_FAILED'
  | 'LINK_READER_DISABLED'
  | 'LINK_READER_NOT_CONFIGURED'
  | 'LINK_FETCH_FAILED'
  | 'DAILY_QUOTA_EXCEEDED'

export const MANUAL_ENTRY_MESSAGES_VI: Record<ManualEntryReasonCode, string> = {
  AI_DISABLED: 'Tiện ích đọc thông số tự động đang tắt. Vui lòng nhập thông số món đồ bằng tay.',
  AI_NOT_CONFIGURED: 'Tiện ích đọc thông số tự động chưa được cấu hình. Vui lòng nhập thông số món đồ bằng tay.',
  AI_TIMEOUT: 'Đọc thông số tự động mất quá nhiều thời gian. Vui lòng nhập thông số món đồ bằng tay.',
  AI_REFUSED: 'Tiện ích đọc thông số tự động tạm thời không xử lý được. Vui lòng nhập thông số món đồ bằng tay.',
  AI_RATE_LIMITED: 'Tiện ích đọc thông số tự động đang quá tải. Vui lòng nhập thông số món đồ bằng tay.',
  AI_SCHEMA_MISMATCH: 'Không đọc được thông số rõ ràng từ nguồn này. Vui lòng nhập thông số món đồ bằng tay.',
  AI_FAILED: 'Không đọc được thông số tự động. Vui lòng nhập thông số món đồ bằng tay.',
  LINK_READER_DISABLED: 'Tiện ích đọc thông số từ đường dẫn web đang tắt. Vui lòng nhập thông số món đồ bằng tay.',
  LINK_READER_NOT_CONFIGURED:
    'Tiện ích đọc thông số từ đường dẫn web chưa được cấu hình. Vui lòng nhập thông số món đồ bằng tay.',
  LINK_FETCH_FAILED: 'Không mở được trang sản phẩm. Vui lòng nhập thông số món đồ bằng tay.',
  DAILY_QUOTA_EXCEEDED: 'Bạn đã dùng hết lượt đọc thông số tự động hôm nay. Vui lòng nhập thông số món đồ bằng tay.',
}

/** Mã lỗi AI/đọc trang → lý do nhập tay. Mã không có trong bảng → AI_FAILED. */
const REASON_BY_ERROR_CODE: Record<string, ManualEntryReasonCode> = {
  GEAR_AI_UNAVAILABLE: 'AI_NOT_CONFIGURED',
  GEAR_AI_TIMEOUT: 'AI_TIMEOUT',
  GEAR_AI_REFUSED: 'AI_REFUSED',
  GEAR_AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  GEAR_EXTRACTION_SCHEMA_MISMATCH: 'AI_SCHEMA_MISMATCH',
  GEAR_PAGE_READER_UNAVAILABLE: 'LINK_READER_NOT_CONFIGURED',
  GEAR_PAGE_FETCH_FAILED: 'LINK_FETCH_FAILED',
}

export function manualReasonFromErrorCode(code: string | undefined): ManualEntryReasonCode {
  return (code && REASON_BY_ERROR_CODE[code]) || 'AI_FAILED'
}

/** Dữ liệu bản nháp "cần nhập tay": không có thông số, chỉ có lý do. Không tính vào quota ngày. */
export function buildManualEntryData(reasonCode: ManualEntryReasonCode, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    _manualEntry: true,
    manualReasonCode: reasonCode,
    messageVi: MANUAL_ENTRY_MESSAGES_VI[reasonCode],
  }
}

export function isManualEntryData(data: unknown): boolean {
  return Boolean(data && typeof data === 'object' && (data as Record<string, unknown>)._manualEntry === true)
}

/** Dạng trả ra API: `null` với bản nháp do AI điền / cache. */
export function toManualEntryView(
  data: unknown,
): { required: true; reasonCode: ManualEntryReasonCode; messageVi: string } | null {
  if (!isManualEntryData(data)) return null
  const d = data as Record<string, unknown>
  const reasonCode = (d.manualReasonCode as ManualEntryReasonCode) ?? 'AI_FAILED'
  return {
    required: true,
    reasonCode,
    messageVi: (d.messageVi as string) ?? MANUAL_ENTRY_MESSAGES_VI[reasonCode] ?? MANUAL_ENTRY_MESSAGES_VI.AI_FAILED,
  }
}

export interface CapabilityStatus {
  enabled: boolean
  configured: boolean
  messageVi: string
}

export interface GearCapabilities {
  aiProvider: string | null
  ruleBasedAdvice: CapabilityStatus
  aiAdvice: CapabilityStatus
  imageExtraction: CapabilityStatus
  linkExtraction: CapabilityStatus
}

export function getGearCapabilities(
  aiPort: GearAiPort | null | undefined,
  pageReader: PageReaderPort | null | undefined,
): GearCapabilities {
  const flags = readGearFlags()
  const ai = isAiConfigured(aiPort)
  const reader = isPageReaderConfigured(pageReader)
  const adviceSupported =
    typeof aiPort?.generateAdvice === 'function' && (aiPort.supportsAdvice ? aiPort.supportsAdvice() : true)
  return {
    aiProvider: aiPort?.providerName ? aiPort.providerName() : null,
    ruleBasedAdvice: {
      enabled: true,
      configured: true,
      messageVi: 'Tư vấn trang bị theo bộ quy tắc chuẩn hoá luôn sẵn sàng, không cần AI.',
    },
    aiAdvice: {
      enabled: flags.aiAdviceEnabled,
      configured: ai && adviceSupported,
      messageVi: !flags.aiAdviceEnabled
        ? 'Tư vấn bổ sung bằng AI đang tắt. Kế hoạch trang bị dùng bộ quy tắc chuẩn hoá.'
        : !ai
          ? 'Tư vấn AI đang bật nhưng chưa được cấu hình. Hệ thống tự dùng bộ quy tắc chuẩn hoá.'
          : !adviceSupported
            ? 'Nhà cung cấp AI hiện tại chỉ hỗ trợ đọc thông số. Kế hoạch trang bị dùng bộ quy tắc chuẩn hoá.'
            : 'Tư vấn bổ sung bằng AI đã sẵn sàng.',
    },
    imageExtraction: {
      enabled: flags.imageExtractionEnabled,
      configured: ai,
      messageVi: !flags.imageExtractionEnabled
        ? MANUAL_ENTRY_MESSAGES_VI.AI_DISABLED
        : !ai
          ? MANUAL_ENTRY_MESSAGES_VI.AI_NOT_CONFIGURED
          : 'Đọc thông số từ ảnh nhãn mác đã sẵn sàng.',
    },
    linkExtraction: {
      enabled: flags.linkExtractionEnabled,
      configured: ai && reader,
      messageVi: !flags.linkExtractionEnabled
        ? MANUAL_ENTRY_MESSAGES_VI.LINK_READER_DISABLED
        : !(ai && reader)
          ? MANUAL_ENTRY_MESSAGES_VI.LINK_READER_NOT_CONFIGURED
          : 'Đọc thông số từ đường dẫn web đã sẵn sàng.',
    },
  }
}
