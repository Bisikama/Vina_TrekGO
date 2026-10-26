import { GeminiGearAiAdapter } from '../src/modules/gear/infrastructure/adapters/gemini-gear-ai.adapter'
import { GEAR_EXTRACTION_PROMPT, GEAR_ADVISOR_PROMPT } from '../src/modules/gear/infrastructure/prompts/prompt-assets'
import { GEAR_ERROR_CODES } from '../src/shared/errors/codes/gear.error-codes'
import { normalizeExtractionResult } from '../src/modules/gear/domain/gear-extraction-schema'

describe('Gear Advisor V3.1.5 — Phase 07 Gemini AI Provider & Schemas Unit Tests', () => {
  const originalEnv = process.env
  let adapter: GeminiGearAiAdapter

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    adapter = new GeminiGearAiAdapter()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('Prompt Assets Loading & Parity', () => {
    it('loads gear-extraction.v1.md with version 1.0.0 and valid SHA-256 hash', () => {
      expect(GEAR_EXTRACTION_PROMPT.version).toBe('1.0.0')
      expect(GEAR_EXTRACTION_PROMPT.hash).toHaveLength(64)
      expect(GEAR_EXTRACTION_PROMPT.content).toContain('Bạn trích xuất thông tin trang bị trekking')
    })

    it('loads gear-advisor.v1.md with version 1.0.0 and valid SHA-256 hash', () => {
      expect(GEAR_ADVISOR_PROMPT.version).toBe('1.0.0')
      expect(GEAR_ADVISOR_PROMPT.hash).toHaveLength(64)
      expect(GEAR_ADVISOR_PROMPT.content).toContain('Bạn tư vấn chuẩn bị trang bị trekking')
    })
  })

  describe('Config & Missing Key (LIVE_AI_BLOCKED)', () => {
    it('throws 503 GEAR_AI_UNAVAILABLE when GEMINI_API_KEY is not configured', async () => {
      delete process.env.GEMINI_API_KEY
      const noKeyAdapter = new GeminiGearAiAdapter()

      await expect(
        noKeyAdapter.extractGear({
          sourceType: 'IMAGE',
          imageBase64: 'fake-base64',
          mimeType: 'image/jpeg',
        }),
      ).rejects.toMatchObject({
        code: GEAR_ERROR_CODES.GEAR_AI_UNAVAILABLE,
      })
    })

    it('seamlessly falls back to RULE_FALLBACK for advice when key is missing', async () => {
      delete process.env.GEMINI_API_KEY
      const noKeyAdapter = new GeminiGearAiAdapter()

      const advice = await noKeyAdapter.generateAdvice({
        planId: 'plan-1',
        revision: 1,
        tripContext: { temp_min_c: 10, rain_prob_pct: 30, difficulty: 2 },
        requirements: [],
        coverage: { summary: { isFullyCovered: true } },
      })

      expect(advice.source).toBe('RULE_FALLBACK')
      expect(advice.narrativeVi).toBeDefined()
      expect(advice.disclaimerVi).toBeDefined()
    })
  })

  describe('Evidence Verification in Schema Normalization (B06)', () => {
    it('strips non-null technical attributes that lack matching evidence and moves them to fieldsUnknown', () => {
      const rawPayload = {
        category: 'JACKET',
        name: 'Áo khoác gió Columbia',
        brand: 'Columbia',
        attributes: {
          waterproof_mm: 10000,
          weight_g: 350, // Has NO matching evidence
          windproof: true, // Has matching evidence
        },
        evidence: [
          {
            id: 'ev-1',
            fieldPath: 'attributes.waterproof_mm',
            originalText: 'Chỉ số chống nước 10.000mm',
            unit: 'mm',
          },
          {
            id: 'ev-2',
            fieldPath: 'windproof',
            originalText: 'Công nghệ cản gió Omni-Wind',
          },
        ],
        warnings: [],
        fieldsUnknown: ['temp_rating_c'],
        needsConfirmation: true,
      }

      const normalized = normalizeExtractionResult(rawPayload)

      // waterproof_mm and windproof have matching evidence -> preserved
      expect(normalized.attributes.waterproof_mm).toBe(10000)
      expect(normalized.attributes.windproof).toBe(true)

      // weight_g lacked evidence -> stripped and added to fieldsUnknown
      expect(normalized.attributes.weight_g).toBeUndefined()
      expect(normalized.fieldsUnknown).toContain('weight_g')
      expect(normalized.warnings.some((w) => w.includes('weight_g'))).toBe(true)
    })
  })

  describe('Extraction Processing with Mocked Gemini Client', () => {
    it('successfully extracts and normalizes jacket technical attributes', async () => {
      process.env.GEMINI_API_KEY = 'mock-gemini-key'
      const geminiAdapter = new GeminiGearAiAdapter()

      const mockAiPayload = {
        category: 'JACKET',
        name: 'Áo khoác gió Columbia',
        brand: 'Columbia',
        attributes: {
          waterproof_mm: 10000,
          weight_g: 350,
          windproof: true,
        },
        evidence: [
          { id: 'ev-1', fieldPath: 'waterproof_mm', originalText: '10000mm' },
          { id: 'ev-2', fieldPath: 'weight_g', originalText: '350g' },
          { id: 'ev-3', fieldPath: 'windproof', originalText: 'windproof' },
        ],
        warnings: [],
        fieldsUnknown: ['temp_rating_c'],
        needsConfirmation: true,
      }

      // Mock aiClient generateContent
      ;(geminiAdapter as any).aiClient = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify(mockAiPayload),
            usageMetadata: {
              promptTokenCount: 150,
              candidatesTokenCount: 80,
              totalTokenCount: 230,
            },
          }),
        },
      }

      const result = await geminiAdapter.extractGear({
        sourceType: 'IMAGE',
        imageBase64: 'base64-data',
        mimeType: 'image/jpeg',
      })

      expect(result.extraction.category).toBe('JACKET')
      expect(result.extraction.attributes.waterproof_mm).toBe(10000)
      expect(result.extraction.attributes.weight_g).toBe(350)
      expect(result.metadata.promptVersion).toBe('1.0.0')
      expect(result.metadata.usage?.totalTokens).toBe(230)
    })

    it('throws GEAR_EXTRACTION_SCHEMA_MISMATCH when Gemini returns invalid non-JSON string', async () => {
      process.env.GEMINI_API_KEY = 'mock-gemini-key'
      const geminiAdapter = new GeminiGearAiAdapter()

      ;(geminiAdapter as any).aiClient = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: 'I cannot process this image properly.',
          }),
        },
      }

      await expect(
        geminiAdapter.extractGear({
          sourceType: 'IMAGE',
          imageBase64: 'base64-data',
          mimeType: 'image/jpeg',
        }),
      ).rejects.toMatchObject({
        code: GEAR_ERROR_CODES.GEAR_EXTRACTION_SCHEMA_MISMATCH,
      })
    })
  })

  describe('Advice Processing with Mocked Gemini Client (Actual Adapter & SDK Double)', () => {
    const sampleApprovedClaims = [
      {
        id: 'claim:trip_summary',
        category: 'TRIP_SUMMARY',
        textVi: 'Hành trình khám phá Bidoup Nui Ba dự kiến diễn ra trong 2 ngày với cấp độ khó 3/5.',
        factRefs: ['trip.days:2', 'trip.difficulty:3'],
      },
      {
        id: 'claim:climate_overview',
        category: 'CLIMATE_OVERVIEW',
        textVi: 'Dự báo thời tiết: nhiệt độ dao động từ 12°C đến 24°C, xác suất mưa khoảng 60%.',
        factRefs: ['climate.temp_min:12', 'climate.temp_max:24', 'climate.rain_prob:60'],
      },
      {
        id: 'claim:rental_preview',
        category: 'RENTAL_PREVIEW',
        textVi:
          'Trang bị đề xuất thuê: Standard Trek Jacket 10k. Tổng chi phí thuê ước tính là 100.000 VND (tiền đặt cọc: 200.000 VND).',
        factRefs: ['pricing.total_fee:100000', 'pricing.total_deposit:200000'],
      },
    ]

    it('generates structured advice with source AI and server-rendered narrative when model selects valid claims', async () => {
      process.env.GEMINI_API_KEY = 'mock-gemini-key'
      const geminiAdapter = new GeminiGearAiAdapter()

      ;(geminiAdapter as any).aiClient = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({
              selectedClaimIds: ['claim:trip_summary', 'claim:climate_overview'],
              actionRefs: ['RENT:jacket'],
              candidateRefs: [],
            }),
            usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40, totalTokenCount: 140 },
          }),
        },
      }

      const result = await geminiAdapter.generateAdvice({
        planId: 'p-1',
        revision: 1,
        tripContext: { days: 2, difficulty: 3 },
        requirements: [],
        coverage: { summary: { isFullyCovered: true } },
        options: [],
        approvedClaims: sampleApprovedClaims,
      })

      expect(result.source).toBe('AI')
      expect(result.selectedClaimIds).toEqual(['claim:trip_summary', 'claim:climate_overview'])
      expect(result.narrativeVi).toContain('Hành trình khám phá Bidoup Nui Ba')
      expect(result.narrativeVi).toContain('12°C đến 24°C')
      expect(result.factRefs).toContain('trip.days:2')
      expect(result.factRefs).toContain('climate.rain_prob:60')
    })

    it('eliminates model-supplied hallucinated numbers, product names, and specs even when model emits them in raw text', async () => {
      process.env.GEMINI_API_KEY = 'mock-gemini-key'
      const geminiAdapter = new GeminiGearAiAdapter()

      // SDK double returns model text with hallucinated deposit, fake product, fake weight, fake capacity
      ;(geminiAdapter as any).aiClient = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({
              selectedClaimIds: ['claim:trip_summary'],
              rawNarrativeVi:
                'Bạn phải đặt cọc thêm 999.000 đồng. Sản phẩm được đề xuất: lều X999. Áo của bạn nặng 50 g. Balo của bạn có dung tích 99 lít.',
              actionRefs: [],
              candidateRefs: [],
            }),
          }),
        },
      }

      const result = await geminiAdapter.generateAdvice({
        planId: 'p-1',
        revision: 1,
        tripContext: { days: 2, difficulty: 3 },
        requirements: [],
        coverage: { summary: { isFullyCovered: true } },
        options: [],
        approvedClaims: sampleApprovedClaims,
      })

      expect(result.source).toBe('AI')
      // STRICT CONTRACT: None of the model hallucinations leak into server-rendered narrativeVi!
      expect(result.narrativeVi).not.toContain('999.000')
      expect(result.narrativeVi).not.toContain('lều X999')
      expect(result.narrativeVi).not.toContain('50 g')
      expect(result.narrativeVi).not.toContain('99 lít')
      // Server-rendered values from approved claims are preserved
      expect(result.narrativeVi).toContain('Bidoup Nui Ba')
      expect(result.narrativeVi).toContain('2 ngày')
    })

    it('falls back to RULE_FALLBACK when model returns unknown/foreign claim ID', async () => {
      process.env.GEMINI_API_KEY = 'mock-gemini-key'
      const geminiAdapter = new GeminiGearAiAdapter()

      ;(geminiAdapter as any).aiClient = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({
              selectedClaimIds: ['claim:foreign_unapproved_claim_id'],
              actionRefs: [],
              candidateRefs: [],
            }),
          }),
        },
      }

      const result = await geminiAdapter.generateAdvice({
        planId: 'p-1',
        revision: 1,
        tripContext: { days: 2, difficulty: 3 },
        requirements: [],
        coverage: { summary: { isFullyCovered: true } },
        options: [],
        approvedClaims: sampleApprovedClaims,
      })

      expect(result.source).toBe('RULE_FALLBACK')
    })

    it('falls back to RULE_FALLBACK when model returns invalid non-JSON or empty selectedClaimIds', async () => {
      process.env.GEMINI_API_KEY = 'mock-gemini-key'
      const geminiAdapter = new GeminiGearAiAdapter()

      ;(geminiAdapter as any).aiClient = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({
              selectedClaimIds: [],
            }),
          }),
        },
      }

      const result = await geminiAdapter.generateAdvice({
        planId: 'p-1',
        revision: 1,
        tripContext: { days: 2, difficulty: 3 },
        requirements: [],
        coverage: { summary: { isFullyCovered: true } },
        options: [],
        approvedClaims: sampleApprovedClaims,
      })

      expect(result.source).toBe('RULE_FALLBACK')
    })

    it('falls back to RULE_FALLBACK when model returns unapproved candidate product ref', async () => {
      process.env.GEMINI_API_KEY = 'mock-gemini-key'
      const geminiAdapter = new GeminiGearAiAdapter()

      ;(geminiAdapter as any).aiClient = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({
              selectedClaimIds: ['claim:trip_summary'],
              candidateRefs: ['unapproved-prod-id:Fake Tent X999'],
            }),
          }),
        },
      }

      const result = await geminiAdapter.generateAdvice({
        planId: 'p-1',
        revision: 1,
        tripContext: { days: 2, difficulty: 3 },
        requirements: [],
        coverage: { summary: { isFullyCovered: true } },
        options: [{ rentalLines: [{ productId: 'real-prod-1', productName: 'Real Tent' }] }],
        approvedClaims: sampleApprovedClaims,
      })

      expect(result.source).toBe('RULE_FALLBACK')
    })
  })
})
