import { Injectable, Logger } from '@nestjs/common'
import { GoogleGenAI } from '@google/genai'
import {
  GearAiPort,
  GearExtractionAiRequest,
  GearExtractionAiResult,
  GearAdviceAiRequest,
  GearAdviceAiResult,
} from '../../application/ports/gear-ai.port'
import { normalizeExtractionResult } from '../../domain/gear-extraction-schema'
import { ApprovedClaim, buildApprovedClaims, renderNarrativeFromClaims } from '../../domain/advice-grounding'
import { GEAR_EXTRACTION_PROMPT, GEAR_ADVISOR_PROMPT } from '../prompts/prompt-assets'
import { AppError } from '../../../../shared/errors/app-error'
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes'

@Injectable()
export class GeminiGearAiAdapter implements GearAiPort {
  private readonly logger = new Logger(GeminiGearAiAdapter.name)
  private readonly aiClient: GoogleGenAI | null = null
  private readonly apiKey: string | null
  private readonly modelExtraction: string
  private readonly modelAdvisor: string
  private readonly timeoutMs: number
  private readonly maxRetries: number

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || null
    this.modelExtraction = process.env.GEMINI_MODEL_EXTRACTION || 'gemini-2.5-flash'
    this.modelAdvisor = process.env.GEMINI_MODEL_ADVISOR || 'gemini-2.5-flash'
    this.timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10)
    this.maxRetries = parseInt(process.env.GEMINI_MAX_RETRIES || '2', 10)

    if (this.apiKey) {
      this.aiClient = new GoogleGenAI({ apiKey: this.apiKey })
    }
  }

  async extractGear(request: GearExtractionAiRequest): Promise<GearExtractionAiResult> {
    // 1. Live AI gate check (LIVE_AI_BLOCKED -> 503)
    if (!this.apiKey || !this.aiClient || !GEAR_EXTRACTION_PROMPT.isAvailable) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_UNAVAILABLE, {
        message: 'Dịch vụ nhận diện AI hiện chưa được cấu hình. Vui lòng nhập thông số bằng tay.',
      })
    }

    const startTime = Date.now()
    const parts: any[] = [
      {
        text: `${GEAR_EXTRACTION_PROMPT.content}\n\nHãy trích xuất thông số kỹ thuật của trang bị theo định dạng JSON chuẩn.`,
      },
    ]

    if (request.sourceType === 'IMAGE') {
      const base64Data = request.imageBase64 || request.imageBuffer?.toString('base64')
      if (!base64Data) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_REFUSED, {
          message: 'Không tìm thấy dữ liệu hình ảnh để phân tích',
        })
      }
      parts.push({
        inlineData: {
          mimeType: request.mimeType || 'image/jpeg',
          data: base64Data,
        },
      })
    } else {
      if (!request.textContent) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_REFUSED, {
          message: 'Không tìm thấy nội dung văn bản sản phẩm để phân tích',
        })
      }
      parts.push({
        text: `Nội dung chi tiết trang sản phẩm:\n${request.textContent}`,
      })
    }

    // 2. Execute with bounded retries and total timeout budget
    let lastError: any = null
    let attempt = 0
    const totalDeadline = startTime + this.timeoutMs

    while (attempt <= this.maxRetries) {
      attempt++
      const now = Date.now()
      if (now >= totalDeadline) {
        break
      }
      const attemptTimeoutMs = Math.min(this.timeoutMs, totalDeadline - now)
      let timerHandle: any

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerHandle = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), attemptTimeoutMs)
        })

        const response = await Promise.race([
          this.aiClient.models.generateContent({
            model: this.modelExtraction,
            contents: [
              {
                role: 'user',
                parts,
              },
            ],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
          timeoutPromise,
        ])

        const rawText = (response as any)?.text?.trim()
        if (!rawText) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_SCHEMA_MISMATCH, {
            message: 'Phản hồi từ mô hình AI rỗng hoặc không có nội dung',
          })
        }

        let parsedJson: any
        try {
          parsedJson = JSON.parse(rawText)
        } catch {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_SCHEMA_MISMATCH, {
            message: 'Phản hồi từ AI không đúng cấu trúc JSON mong đợi',
          })
        }

        const domainResult = normalizeExtractionResult(parsedJson)
        const latencyMs = Date.now() - startTime

        const usageMetadata = (response as any)?.usageMetadata
        const usage = usageMetadata
          ? {
              promptTokens: usageMetadata.promptTokenCount || 0,
              completionTokens: usageMetadata.candidatesTokenCount || 0,
              totalTokens: usageMetadata.totalTokenCount || 0,
            }
          : undefined

        return {
          extraction: domainResult,
          metadata: {
            promptVersion: GEAR_EXTRACTION_PROMPT.version,
            promptHash: GEAR_EXTRACTION_PROMPT.hash,
            modelVersion: this.modelExtraction,
            schemaVersion: '1.0.0',
            latencyMs,
            usage,
          },
        }
      } catch (err: any) {
        lastError = err
        this.logger.warn(`Gemini extraction attempt ${attempt} failed: ${err.message}`)

        // Timeout: fail fast with GEAR_AI_TIMEOUT, do not retry
        if (err.message === 'GEMINI_TIMEOUT' || err.name === 'AbortError') {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_TIMEOUT, {
            message: 'Thời gian phản hồi từ mô hình AI vượt quá giới hạn',
          })
        }

        // Schema mismatch: fail fast
        if (err instanceof AppError && err.code === GEAR_ERROR_CODES.GEAR_EXTRACTION_SCHEMA_MISMATCH) {
          throw err
        }

        // 401 / Permanent auth error: fail fast with GEAR_AI_REFUSED, do not retry
        const isAuthError =
          err.status === 401 ||
          err.statusCode === 401 ||
          err.message?.includes('401') ||
          err.message?.includes('API_KEY_INVALID')
        if (isAuthError) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_REFUSED, {
            message: 'Khóa API AI không hợp lệ hoặc đã hết hạn',
          })
        }

        // Missing/retired model: fail fast and keep provider internals out of the UI.
        const isModelUnavailable =
          err.status === 404 ||
          err.statusCode === 404 ||
          err.message?.includes('NOT_FOUND') ||
          err.message?.includes('no longer available')
        if (isModelUnavailable) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_UNAVAILABLE, {
            message: 'Mô hình nhận diện AI đang được cập nhật. Vui lòng thử lại sau hoặc nhập thông số bằng tay.',
          })
        }

        // 429 / Quota exceeded: check if maxRetries reached
        const isQuotaError =
          err.status === 429 ||
          err.statusCode === 429 ||
          err.message?.includes('429') ||
          err.message?.includes('RESOURCE_EXHAUSTED')
        if (isQuotaError && attempt >= this.maxRetries) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_QUOTA_EXCEEDED, {
            message: 'Dịch vụ AI vượt quá hạn mức yêu cầu, vui lòng thử lại sau',
          })
        }

        await new Promise((r) => setTimeout(r, 200 * attempt))
      } finally {
        if (timerHandle) clearTimeout(timerHandle)
      }
    }

    if (lastError instanceof AppError) {
      throw lastError
    }

    if (
      lastError?.status === 429 ||
      lastError?.statusCode === 429 ||
      lastError?.message?.includes('429') ||
      lastError?.message?.includes('RESOURCE_EXHAUSTED')
    ) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_QUOTA_EXCEEDED, {
        message: 'Dịch vụ AI vượt quá hạn mức yêu cầu, vui lòng thử lại sau',
      })
    }

    if (lastError?.message === 'GEMINI_TIMEOUT' || lastError?.name === 'AbortError') {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_TIMEOUT, {
        message: 'Thời gian phản hồi từ mô hình AI vượt quá giới hạn',
      })
    }

    this.logger.error(`Gemini AI extraction error: ${lastError?.message}`)
    throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_REFUSED, {
      message: `Mô hình AI từ chối xử lý hoặc phát sinh lỗi: ${lastError?.message || 'Không xác định'}`,
    })
  }

  async generateAdvice(request: GearAdviceAiRequest): Promise<GearAdviceAiResult> {
    const startTime = Date.now()

    // If key not configured or prompt asset missing -> fallback to RULE_FALLBACK seamlessly
    if (!this.apiKey || !this.aiClient || !GEAR_ADVISOR_PROMPT.isAvailable) {
      return this.buildRuleFallbackAdvice(request)
    }

    let approvedClaims = (request.approvedClaims || []) as ApprovedClaim[]
    if (approvedClaims.length === 0 && request.tripContext && request.options && request.options.length > 0) {
      const selectedOption = request.options[0] as any
      approvedClaims = buildApprovedClaims({
        tripContext: request.tripContext,
        selectedOption: {
          summary: selectedOption.summary,
          rentalLines: selectedOption.rentalLines,
          ownedAssignments: selectedOption.ownedAssignments,
        },
      })
    }
    if (approvedClaims.length === 0) {
      return this.buildRuleFallbackAdvice(request)
    }

    try {
      const promptPayload = {
        tripContext: request.tripContext,
        requirements: request.requirements,
        coverage: request.coverage,
        options: request.options || [],
        approvedClaims: approvedClaims.map((c) => ({
          id: c.id,
          category: c.category,
          textVi: c.textVi,
        })),
      }

      let timerHandle: any
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerHandle = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), this.timeoutMs)
      })

      let response: any
      try {
        response = await Promise.race([
          this.aiClient.models.generateContent({
            model: this.modelAdvisor,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `${GEAR_ADVISOR_PROMPT.content}\n\nDữ kiện kế hoạch:\n${JSON.stringify(promptPayload, null, 2)}`,
                  },
                ],
              },
            ],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
          timeoutPromise,
        ])
      } finally {
        if (timerHandle) clearTimeout(timerHandle)
      }

      const rawText = response?.text?.trim()
      let parsed: any = {}
      try {
        parsed = JSON.parse(rawText || '{}')
      } catch {
        this.logger.warn('Gemini advice response was not valid JSON, falling back to RULE_FALLBACK')
        return this.buildRuleFallbackAdvice(request)
      }

      const selectedClaimIds = Array.isArray(parsed.selectedClaimIds)
        ? parsed.selectedClaimIds
        : Array.isArray(parsed.claimIds)
          ? parsed.claimIds
          : []

      // Validate selected claim IDs schema
      if (selectedClaimIds.length === 0 || selectedClaimIds.some((id: any) => typeof id !== 'string')) {
        this.logger.warn('Gemini advice did not provide valid selectedClaimIds, falling back to RULE_FALLBACK')
        return this.buildRuleFallbackAdvice(request)
      }

      // Render narrative strictly from server-owned approved claims
      const renderResult = renderNarrativeFromClaims(selectedClaimIds, approvedClaims)
      if (!renderResult.isValid) {
        this.logger.warn(
          `Gemini advice selected unknown claims (${renderResult.reason}), falling back to RULE_FALLBACK`,
        )
        return this.buildRuleFallbackAdvice(request)
      }

      const actionRefs = Array.isArray(parsed.actionRefs) ? parsed.actionRefs : []
      const candidateRefs = Array.isArray(parsed.candidateRefs) ? parsed.candidateRefs : []

      // Validate candidate refs against allowed products
      const allowedProductIds = new Set<string>()
      for (const opt of (request.options || []) as any[]) {
        for (const line of (opt.rentalLines || []) as any[]) {
          if (line.productId) allowedProductIds.add(line.productId)
        }
      }

      const hasFabricatedCandidateRefs = candidateRefs.some((ref: string) => {
        if (typeof ref !== 'string') return true
        const prodId = ref.split(':')[0]
        return !allowedProductIds.has(prodId)
      })

      if (hasFabricatedCandidateRefs) {
        this.logger.warn('Gemini advice generated fabricated candidate references, falling back to RULE_FALLBACK')
        return this.buildRuleFallbackAdvice(request)
      }

      const disclaimerVi =
        'Tư vấn dựa trên bộ quy chuẩn an toàn TrekGo. Vui lòng kiểm tra kỹ độ bền và thông số trang bị trước khi khởi hành.'

      const usageMetadata = response?.usageMetadata

      return {
        source: 'AI',
        narrativeVi: renderResult.narrativeVi, // Server-rendered from approved claims!
        selectedClaimIds,
        claimIds: selectedClaimIds,
        factRefs: renderResult.factRefs,
        actionRefs,
        candidateRefs,
        disclaimerVi,
        metadata: {
          modelVersion: this.modelAdvisor,
          promptVersion: GEAR_ADVISOR_PROMPT.version,
          latencyMs: Date.now() - startTime,
          tokenUsage: usageMetadata || {},
        },
      }
    } catch (err: any) {
      this.logger.warn(`Gemini advisor error, falling back to RULE_FALLBACK: ${err?.message}`)
      return this.buildRuleFallbackAdvice(request)
    }
  }

  private buildRuleFallbackAdvice(request: GearAdviceAiRequest): GearAdviceAiResult {
    const approvedClaims = (request.approvedClaims || []) as ApprovedClaim[]
    const allClaimIds = approvedClaims.map((c) => c.id)
    let narrativeVi = 'Kế hoạch trang bị đã được phân tích tự động dựa trên 28 quy chuẩn an toàn TrekGo.'
    let factRefs = ['trip.temp_min_c', 'trip.rain_prob_pct', 'trip.difficulty']

    if (approvedClaims.length > 0) {
      const renderResult = renderNarrativeFromClaims(allClaimIds, approvedClaims)
      narrativeVi = renderResult.narrativeVi
      factRefs = renderResult.factRefs
    } else {
      const coverage = request.coverage as any
      const summary = coverage?.summary || {}
      const missingCount = summary.unresolvedCount || 0
      if (summary.isFullyCovered) {
        narrativeVi += ' Bạn đã có đầy đủ các trang bị bắt buộc cho chuyến đi.'
      } else if (missingCount > 0) {
        narrativeVi += ` Bạn còn ${missingCount} món trang bị cần bổ sung hoặc thuê thêm để bảo đảm an toàn.`
      }
    }

    const candidateRefs: string[] = []
    for (const opt of (request.options || []) as any[]) {
      for (const line of (opt.rentalLines || []) as any[]) {
        if (line.productId) candidateRefs.push(`${line.productId}:${line.productName || ''}`)
      }
    }

    const actionRefs = (request.coverage as any)?.summary?.isFullyCovered ? ['READY_FOR_TRIP'] : ['RENT_MISSING_GEAR']

    const disclaimerVi =
      'Tư vấn dựa trên bộ quy chuẩn an toàn TrekGo (chế độ dự phòng). Vui lòng kiểm tra kỹ độ bền và thông số trang bị trước khi khởi hành.'

    return {
      source: 'RULE_FALLBACK',
      selectedClaimIds: allClaimIds,
      claimIds: allClaimIds,
      narrativeVi,
      factRefs,
      actionRefs,
      candidateRefs,
      disclaimerVi,
      metadata: {
        modelVersion: 'rule_fallback_v1',
        promptVersion: '1.0.0',
      },
    }
  }
}
