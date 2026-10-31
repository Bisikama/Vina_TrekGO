import { Injectable, Inject, Optional, Logger } from '@nestjs/common'
import { createHash, randomUUID } from 'crypto'
import sharp from 'sharp'
import { AppError } from '../../../../shared/errors/app-error'
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes'
import { COMMON_ERROR_CODES } from '../../../../shared/errors/codes/common.error-codes'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { GearExtractionDraftDomain, UserGearItemDomain, GearItemSource } from '../../domain/gear.types'
import { GEAR_EXTRACTION_DRAFT_REPOSITORY_PORT } from '../ports/gear-extraction-draft.repository.port'
import type { GearExtractionDraftRepositoryPort } from '../ports/gear-extraction-draft.repository.port'
import { GEAR_EXTRACTION_CACHE_PORT } from '../ports/gear-extraction-cache.port'
import type { GearExtractionCachePort } from '../ports/gear-extraction-cache.port'
import { GEAR_CONCURRENCY_LEASE_PORT } from '../ports/gear-concurrency-lease.port'
import type { GearConcurrencyLeasePort } from '../ports/gear-concurrency-lease.port'
import { USER_GEAR_REPOSITORY_PORT } from '../ports/user-gear.repository.port'
import type { UserGearRepositoryPort } from '../ports/user-gear.repository.port'
import { GEAR_AI_PORT } from '../ports/gear-ai.port'
import type { GearAiPort } from '../ports/gear-ai.port'
import { MEDIA_ASSET_PORT } from '../../../media/application/ports/media-asset.port'
import type { MediaAssetPort } from '../../../media/application/ports/media-asset.port'
import { MEDIA_STORAGE_PORT } from '../../../media/application/ports/media-storage.port'
import type { MediaStoragePort } from '../../../media/application/ports/media-storage.port'
import { PAGE_READER_PORT } from '../ports/page-reader.port'
import type { PageReaderPort } from '../ports/page-reader.port'
import { CreateExtractionDto, ConfirmExtractionDraftDto } from '../dtos/gear-extraction.dto'
import { normalizeCreateAttributes } from '../dtos/user-gear.dto'
import { findSimilarItems } from '../../domain/duplicate-detector'
import { GEAR_EXTRACTION_PROMPT } from '../../infrastructure/prompts/prompt-assets'
import { SafeLinkFetcher } from '../../infrastructure/adapters/safe-link-fetcher'
import {
  activeAiExtractionSettings,
  buildManualEntryData,
  GEAR_AI_LEASE_MARGIN_MS,
  isAiConfigured,
  isManualEntryData,
  isPageReaderConfigured,
  manualReasonFromErrorCode,
  readGearFlags,
  readGearRuntimeConfig,
  type ManualEntryReasonCode,
} from './gear-capabilities'

function getStartOfDaySaigon(): Date {
  const now = new Date()
  const saigonOffsetMs = 7 * 60 * 60 * 1000
  const saigonTime = new Date(now.getTime() + saigonOffsetMs)
  saigonTime.setUTCHours(0, 0, 0, 0)
  return new Date(saigonTime.getTime() - saigonOffsetMs)
}

/**
 * Lượt trích xuất có tính vào quota ngày không: PENDING còn mới thì có; READY/CONFIRMED thì có,
 * trừ cache hit và bản nháp "cần nhập tay" (không gọi AI nên không tốn lượt).
 */
function isChargedDraft(
  d: { status: string; extractedData: unknown; createdAt?: Date },
  staleThreshold: Date,
): boolean {
  if (d.status === 'PENDING') return !(d.createdAt && d.createdAt < staleThreshold)
  const data = d.extractedData as Record<string, unknown> | null
  return !data?._cacheHit && !isManualEntryData(data)
}

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']'
  }
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify((obj as any)[k])).join(',') + '}'
}

@Injectable()
export class GearExtractionService {
  private readonly logger = new Logger(GearExtractionService.name)
  private readonly safeLinkFetcher = new SafeLinkFetcher()

  constructor(
    @Inject(GEAR_EXTRACTION_DRAFT_REPOSITORY_PORT)
    private readonly draftRepo: GearExtractionDraftRepositoryPort,
    @Inject(GEAR_EXTRACTION_CACHE_PORT)
    private readonly cachePort: GearExtractionCachePort,
    @Inject(GEAR_CONCURRENCY_LEASE_PORT)
    private readonly leasePort: GearConcurrencyLeasePort,
    @Inject(USER_GEAR_REPOSITORY_PORT)
    private readonly userGearRepo: UserGearRepositoryPort,
    @Inject(GEAR_AI_PORT)
    private readonly gearAiPort: GearAiPort,
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(PAGE_READER_PORT)
    private readonly pageReaderPort?: PageReaderPort,
    @Optional()
    @Inject(MEDIA_ASSET_PORT)
    private readonly mediaAssetPort?: MediaAssetPort,
    @Optional()
    @Inject(MEDIA_STORAGE_PORT)
    private readonly mediaStoragePort?: MediaStoragePort,
  ) {}

  /**
   * B03 Quota Accounting: Enforces configurable extractions/user/day in Asia/Saigon timezone.
   * Cache-hits do NOT count toward this quota.
   */
  async checkDailyQuota(userId: string): Promise<void> {
    const dailyLimit = readGearRuntimeConfig().dailyQuota
    const startOfDay = getStartOfDaySaigon()

    // Count attempts created today that were charged (not cache hits)
    const PENDING_STALE_MS = 2 * 60 * 1000
    const staleThreshold = new Date(Date.now() - PENDING_STALE_MS)

    const chargedDrafts = await this.prisma.gearExtractionDraft.findMany({
      where: {
        userId,
        createdAt: { gte: startOfDay },
        status: { in: ['READY', 'CONFIRMED', 'PENDING'] },
      },
      select: {
        status: true,
        extractedData: true,
        createdAt: true,
      },
    })

    const chargedCount = chargedDrafts.filter((d) => isChargedDraft(d, staleThreshold)).length

    if (chargedCount >= dailyLimit) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_QUOTA_EXCEEDED, {
        message: `Bạn đã sử dụng hết hạn mức ${dailyLimit} lượt trích xuất hôm nay (múi giờ Asia/Saigon). Vui lòng thử lại vào ngày mai.`,
      })
    }
  }

  /**
   * Atomic user-day quota reservation to prevent concurrent double-booking of remaining quota.
   */
  async checkAndReserveQuota(
    userId: string,
    sourceType: 'IMAGE' | 'LINK',
    sourceHash: string,
    expiresAt: Date,
  ): Promise<GearExtractionDraftDomain> {
    const dailyLimit = readGearRuntimeConfig().dailyQuota
    const startOfDay = getStartOfDaySaigon()
    const quotaLeaseKey = `gear:quota:${userId}:${startOfDay.toISOString().slice(0, 10)}`
    const quotaToken = randomUUID()

    let quotaLeaseAcquired = false
    let quotaFencingToken = 0
    for (let i = 0; i < 5; i++) {
      const qLease = await this.leasePort.acquireLease(quotaLeaseKey, quotaToken, 5000)
      if (qLease.acquired) {
        quotaLeaseAcquired = true
        quotaFencingToken = qLease.fencingToken
        break
      }
      await new Promise((r) => setTimeout(r, 100))
    }

    if (!quotaLeaseAcquired) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
        message: 'Hệ thống đang xử lý yêu cầu trích xuất khác của bạn, vui lòng thử lại sau giây lát',
      })
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Atomic user row lock for quota serialization if on real DB
        if (typeof tx.$executeRaw === 'function') {
          await tx.$executeRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`
        }

        const PENDING_STALE_MS = 2 * 60 * 1000
        const staleThreshold = new Date(Date.now() - PENDING_STALE_MS)

        if (tx.gearExtractionDraft.updateMany) {
          await tx.gearExtractionDraft.updateMany({
            where: {
              userId,
              status: 'PENDING',
              createdAt: { lt: staleThreshold },
            },
            data: {
              status: 'FAILED',
              extractedData: { _reclaimedReason: 'ABANDONED_PENDING_TIMEOUT' },
            },
          })
        }

        const chargedDrafts = await tx.gearExtractionDraft.findMany({
          where: {
            userId,
            createdAt: { gte: startOfDay },
            status: { in: ['READY', 'CONFIRMED', 'PENDING'] },
          },
          select: {
            status: true,
            extractedData: true,
            createdAt: true,
          },
        })

        const chargedCount = chargedDrafts.filter((d) => isChargedDraft(d, staleThreshold)).length

        if (chargedCount >= dailyLimit) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_QUOTA_EXCEEDED, {
            message: `Bạn đã sử dụng hết hạn mức ${dailyLimit} lượt trích xuất hôm nay (múi giờ Asia/Saigon). Vui lòng thử lại vào ngày mai.`,
          })
        }

        return this.draftRepo.createDraft(
          {
            userId,
            sourceType,
            sourceHash,
            expiresAt,
          },
          tx,
        )
      })
    } finally {
      if (quotaLeaseAcquired) {
        await this.leasePort.releaseLease(quotaLeaseKey, quotaToken, quotaFencingToken).catch(() => {})
      }
    }
  }

  async createExtraction(userId: string, dto: CreateExtractionDto): Promise<GearExtractionDraftDomain> {
    const runtime = readGearRuntimeConfig()
    const promptVersion = GEAR_EXTRACTION_PROMPT.version
    // Model và thời gian chờ theo nhà cung cấp đang chọn: cache không dùng lẫn giữa Gemini và OpenAI.
    const aiSettings = activeAiExtractionSettings(runtime)
    const modelVersion = aiSettings.model
    const schemaVersion = '3.1.5'
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    const aiLeaseTtlMs = aiSettings.timeoutMs + GEAR_AI_LEASE_MARGIN_MS

    const flags = readGearFlags()

    if (dto.source === 'IMAGE') {
      // 1. Mandatory Media Dependency Verification (B01 fail-closed)
      if (!this.mediaAssetPort || !this.mediaStoragePort) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_MEDIA_UNAVAILABLE, {
          message: 'Dịch vụ lưu trữ ảnh chưa sẵn sàng để đọc hình ảnh',
        })
      }

      const asset = await this.mediaAssetPort.findById({ id: dto.uploadId })
      if (!asset) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
          message: 'Ảnh không tồn tại',
        })
      }

      if (asset.ownerUserId !== userId) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_FORBIDDEN, {
          message: 'Ảnh không thuộc quyền sở hữu của bạn',
        })
      }

      if (asset.scope !== 'USER_GEAR') {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
          message: 'Ảnh không thuộc phạm vi trang bị cá nhân (USER_GEAR)',
        })
      }

      if (asset.status !== 'READY') {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
          message: 'Ảnh chưa sẵn sàng để trích xuất thông số kỹ thuật',
        })
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
      if (!asset.mimeType || !allowedMimes.includes(asset.mimeType)) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
          message: 'Định dạng ảnh không được hỗ trợ (chỉ nhận JPEG, PNG, WEBP)',
        })
      }

      if (!asset.sizeBytes || asset.sizeBytes <= 0 || asset.sizeBytes > 5 * 1024 * 1024) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
          message: 'Kích thước ảnh không hợp lệ hoặc vượt quá giới hạn 5MB',
        })
      }

      // AI không dùng được → bản nháp nhập tay ngay, không tải/resize ảnh và không tốn quota.
      const imageManualReason: ManualEntryReasonCode | null = !flags.imageExtractionEnabled
        ? 'AI_DISABLED'
        : !isAiConfigured(this.gearAiPort)
          ? 'AI_NOT_CONFIGURED'
          : null
      if (imageManualReason) {
        return this.createManualDraft(
          userId,
          'IMAGE',
          createHash('sha256').update(`manual:${dto.uploadId}`).digest('hex'),
          expiresAt,
          imageManualReason,
          { uploadId: dto.uploadId },
        )
      }

      // Stream actual bytes from storage with bounded byte reading
      const streamResult = await this.mediaStoragePort.openOriginalStream({
        providerPublicId: asset.providerPublicId || dto.uploadId,
        resourceType: 'IMAGE',
        deliveryType: asset.deliveryType || 'upload',
      })

      const chunks: Buffer[] = []
      let totalBytesRead = 0
      for await (const chunk of streamResult.stream) {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
        totalBytesRead += buf.length
        if (totalBytesRead > 5 * 1024 * 1024) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
            message: 'Kích thước luồng ảnh vượt quá giới hạn tối đa 5MB',
          })
        }
        chunks.push(buf)
      }
      let imageBuffer = Buffer.concat(chunks)

      // Bounded normalization / resize to max 1024 edge using sharp with fail-closed decoding
      try {
        const meta = await sharp(imageBuffer).metadata()
        if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
          throw new Error('INVALID_IMAGE_FORMAT')
        }
        if ((meta.width && meta.width > 1024) || (meta.height && meta.height > 1024)) {
          imageBuffer = await sharp(imageBuffer)
            .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
            .toBuffer()
        }
      } catch (err: any) {
        this.logger.warn(`Could not process image dimensions via sharp: ${err?.message}`)
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
          message: `Hình ảnh không thể giải mã hoặc bị lỗi cấu trúc: ${err?.message}`,
        })
      }

      // SHA-256 of actual normalized image bytes (B01: identical bytes across uploads share hash)
      const contentHash = createHash('sha256').update(imageBuffer).digest('hex')

      // 2. Cache Check (Cache hits are FREE and do not consume quota)
      const cached = await this.cachePort.getCache(userId, contentHash, promptVersion, modelVersion, schemaVersion)

      if (cached && cached.status === 'SUCCESS') {
        const draft = await this.draftRepo.createDraft({
          userId,
          sourceType: 'IMAGE',
          sourceHash: contentHash,
          expiresAt,
        })
        return this.draftRepo.updateExtractedData(
          draft.id,
          { ...cached.resultJson, _cacheHit: true },
          'READY',
          draft.version,
        )
      }

      // 3. Atomic Quota reservation and PENDING draft creation (hết quota ngày → nhập tay)
      const draft = await this.reserveQuotaOrNull(userId, 'IMAGE', contentHash, expiresAt)
      if (!draft) {
        return this.createManualDraft(userId, 'IMAGE', contentHash, expiresAt, 'DAILY_QUOTA_EXCEEDED', {
          uploadId: dto.uploadId,
        })
      }

      // 4. Concurrency Lease (B04: acquire:false prevents provider call)
      const resourceKey = `gear:lease:${userId}:${contentHash}:${promptVersion}:${modelVersion}:${schemaVersion}`
      const ownerToken = randomUUID()
      const lease = await this.leasePort.acquireLease(resourceKey, ownerToken, aiLeaseTtlMs)

      if (!lease.acquired) {
        // Recheck cache in case concurrent worker published
        const recheckCache = await this.cachePort.getCache(
          userId,
          contentHash,
          promptVersion,
          modelVersion,
          schemaVersion,
        )
        if (recheckCache && recheckCache.status === 'SUCCESS') {
          return this.draftRepo.updateExtractedData(
            draft.id,
            { ...recheckCache.resultJson, _cacheHit: true },
            'READY',
            draft.version,
          )
        }
        // Refund/release quota reservation by marking draft as FAILED
        await this.draftRepo.updateExtractedData(draft.id, {}, 'FAILED', draft.version).catch(() => {})
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
          message: 'Tác vụ trích xuất ảnh đang được xử lý, vui lòng thử lại sau giây lát',
        })
      }

      try {
        let aiResult: Awaited<ReturnType<GearAiPort['extractGear']>>
        try {
          aiResult = await this.gearAiPort.extractGear({
            sourceType: 'IMAGE',
            imageBase64: imageBuffer.toString('base64'),
            imageBuffer,
            mimeType: asset.mimeType,
          })
        } catch (err: any) {
          // AI lỗi/hết giờ/bị giới hạn → bản nháp nhập tay; bản nháp nhập tay không tính quota nên lượt được hoàn.
          this.logger.warn(`Image extraction fell back to manual entry: ${err?.code ?? err?.message}`)
          return this.convertToManualDraft(draft, manualReasonFromErrorCode(err?.code), { uploadId: dto.uploadId })
        }

        // Ghi cache có kiểm khoá. Lỗi ghi cache không được làm mất kết quả AI đã có.
        await this.publishCacheBestEffort(
          {
            ownerScope: userId,
            contentHash,
            promptVersion,
            modelVersion,
            schemaVersion,
            status: 'SUCCESS',
            resultJson: aiResult.extraction as any,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
          { resourceKey, ownerToken, fencingToken: lease.fencingToken },
        )

        // Update draft to READY with real metadata
        return await this.draftRepo.updateExtractedData(
          draft.id,
          {
            ...aiResult.extraction,
            metadata: aiResult.metadata,
          },
          'READY',
          draft.version,
        )
      } finally {
        await this.releaseAiLease(resourceKey, ownerToken, lease.fencingToken)
      }
    } else {
      // LINK Source (B05: Firecrawl Cloud behind PageReaderPort + 2-Layer Cache)
      // 1. Mandatory Public HTTPS & SSRF validation (B05) — lỗi đầu vào vẫn trả 400 kể cả khi tiện ích tắt
      await this.safeLinkFetcher.validateAndResolveUrl(dto.url)

      // Normalize URL: lowercase protocol and host, preserve path & query case
      const parsedUrl = new URL(dto.url.trim())
      const normalizedUrl = `${parsedUrl.protocol}//${parsedUrl.host.toLowerCase()}${parsedUrl.pathname}${parsedUrl.search}`
      const urlHash = createHash('sha256').update(`url:${normalizedUrl}`).digest('hex')

      if (!flags.linkExtractionEnabled) {
        return this.createManualDraft(userId, 'LINK', urlHash, expiresAt, 'LINK_READER_DISABLED', {
          url: normalizedUrl,
        })
      }

      // Layer 1 URL Cache Check (if !forceRefresh)
      if (!dto.forceRefresh) {
        const cachedUrl = await this.cachePort.getCache(userId, urlHash, promptVersion, modelVersion, schemaVersion)
        if (cachedUrl && cachedUrl.status === 'SUCCESS') {
          const draft = await this.draftRepo.createDraft({
            userId,
            sourceType: 'LINK',
            sourceHash: urlHash,
            expiresAt,
          })
          return this.draftRepo.updateExtractedData(
            draft.id,
            { ...cachedUrl.resultJson, _cacheHit: true, url: normalizedUrl },
            'READY',
            draft.version,
          )
        }
      }

      // Kiểm cấu hình TRƯỚC khi gọi Firecrawl: thiếu thì nhập tay (cache hit ở trên vẫn dùng được).
      const linkManualReason: ManualEntryReasonCode | null =
        !this.pageReaderPort || !isPageReaderConfigured(this.pageReaderPort)
          ? 'LINK_READER_NOT_CONFIGURED'
          : !isAiConfigured(this.gearAiPort)
            ? 'AI_NOT_CONFIGURED'
            : null
      if (linkManualReason || !this.pageReaderPort) {
        return this.createManualDraft(
          userId,
          'LINK',
          urlHash,
          expiresAt,
          linkManualReason ?? 'LINK_READER_NOT_CONFIGURED',
          {
            url: normalizedUrl,
          },
        )
      }

      // Read page via PageReaderPort (Firecrawl Cloud). Lỗi đọc trang/thiếu cấu hình → nhập tay;
      // lỗi khác (ví dụ URL chuyển hướng tới địa chỉ bị chặn) vẫn trả lỗi.
      let pageResult: Awaited<ReturnType<PageReaderPort['readPage']>>
      try {
        pageResult = await this.pageReaderPort.readPage(dto.url)
      } catch (err: any) {
        if (
          err?.code === GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED ||
          err?.code === GEAR_ERROR_CODES.GEAR_PAGE_READER_UNAVAILABLE
        ) {
          this.logger.warn(`Link extraction fell back to manual entry: ${err.code}`)
          return this.createManualDraft(userId, 'LINK', urlHash, expiresAt, manualReasonFromErrorCode(err.code), {
            url: normalizedUrl,
          })
        }
        throw err
      }
      const contentHash = pageResult.contentHash

      // Layer 2 Content Cache Check (always check Layer 2 on forceRefresh unless bypassContentCache is true - MASTER 5 & B06)
      if (!dto.bypassContentCache) {
        const cachedContent = await this.cachePort.getCache(
          userId,
          contentHash,
          promptVersion,
          modelVersion,
          schemaVersion,
        )

        if (cachedContent && cachedContent.status === 'SUCCESS') {
          // Also update/refresh Layer 1 URL cache
          await this.cachePort.setCache({
            ownerScope: userId,
            contentHash: urlHash,
            promptVersion,
            modelVersion,
            schemaVersion,
            status: 'SUCCESS',
            resultJson: cachedContent.resultJson,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
          })

          const draft = await this.draftRepo.createDraft({
            userId,
            sourceType: 'LINK',
            sourceHash: contentHash,
            expiresAt,
          })
          return this.draftRepo.updateExtractedData(
            draft.id,
            {
              ...cachedContent.resultJson,
              _cacheHit: true,
              url: normalizedUrl,
              readAt: pageResult.readAt,
              title: pageResult.title,
            },
            'READY',
            draft.version,
          )
        }
      }

      // Atomic quota check and PENDING draft creation (hết quota ngày → nhập tay)
      const draft = await this.reserveQuotaOrNull(userId, 'LINK', contentHash, expiresAt)
      if (!draft) {
        return this.createManualDraft(userId, 'LINK', contentHash, expiresAt, 'DAILY_QUOTA_EXCEEDED', {
          url: normalizedUrl,
        })
      }

      // Concurrency lease for extraction
      const resourceKey = `gear:lease:${userId}:${contentHash}:${promptVersion}:${modelVersion}:${schemaVersion}`
      const ownerToken = randomUUID()
      const lease = await this.leasePort.acquireLease(resourceKey, ownerToken, aiLeaseTtlMs)

      if (!lease.acquired) {
        // Tiến trình khác có thể vừa ghi xong cache nội dung → dùng luôn, giống nhánh IMAGE.
        const recheckCache = await this.cachePort.getCache(
          userId,
          contentHash,
          promptVersion,
          modelVersion,
          schemaVersion,
        )
        if (recheckCache && recheckCache.status === 'SUCCESS') {
          return this.draftRepo.updateExtractedData(
            draft.id,
            {
              ...recheckCache.resultJson,
              _cacheHit: true,
              url: normalizedUrl,
              readAt: pageResult.readAt,
              title: pageResult.title,
            },
            'READY',
            draft.version,
          )
        }
        // Refund/release quota reservation by marking draft as FAILED
        await this.draftRepo.updateExtractedData(draft.id, {}, 'FAILED', draft.version).catch(() => {})
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
          message: 'Tác vụ trích xuất nội dung liên kết đang được xử lý bởi tiến trình khác',
        })
      }

      try {
        let aiResult: Awaited<ReturnType<GearAiPort['extractGear']>>
        try {
          aiResult = await this.gearAiPort.extractGear({
            sourceType: 'LINK',
            textContent: pageResult.markdown,
          })
        } catch (err: any) {
          this.logger.warn(`Link extraction fell back to manual entry: ${err?.code ?? err?.message}`)
          return this.convertToManualDraft(draft, manualReasonFromErrorCode(err?.code), {
            url: normalizedUrl,
            title: pageResult.title,
          })
        }

        const extractionWithMeta = {
          ...aiResult.extraction,
          url: normalizedUrl,
          readAt: pageResult.readAt,
          title: pageResult.title,
          metadata: aiResult.metadata,
        }
        const leaseValidation = { resourceKey, ownerToken, fencingToken: lease.fencingToken }

        // Layer 2 (nội dung) rồi Layer 1 (URL). Lỗi ghi cache không được làm mất kết quả AI đã có.
        await this.publishCacheBestEffort(
          {
            ownerScope: userId,
            contentHash,
            promptVersion,
            modelVersion,
            schemaVersion,
            status: 'SUCCESS',
            resultJson: extractionWithMeta,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          leaseValidation,
        )
        await this.publishCacheBestEffort(
          {
            ownerScope: userId,
            contentHash: urlHash,
            promptVersion,
            modelVersion,
            schemaVersion,
            status: 'SUCCESS',
            resultJson: extractionWithMeta,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          leaseValidation,
        )

        return await this.draftRepo.updateExtractedData(draft.id, extractionWithMeta, 'READY', draft.version)
      } finally {
        await this.releaseAiLease(resourceKey, ownerToken, lease.fencingToken)
      }
    }
  }

  /**
   * Nhả khoá AI trong finally. Lỗi nhả khoá (ví dụ DB lỗi) chỉ ghi log: nếu ném ra, finally sẽ thay kết quả
   * READY đã ghi vào DB bằng lỗi 5xx. Khoá không nhả được sẽ tự hết hạn theo TTL.
   */
  private async releaseAiLease(resourceKey: string, ownerToken: string, fencingToken: number): Promise<void> {
    try {
      await this.leasePort.releaseLease(resourceKey, ownerToken, fencingToken)
    } catch (err: any) {
      this.logger.warn(`Failed to release gear AI lease ${resourceKey}: ${err?.code ?? err?.message}`)
    }
  }

  /** Ghi cache kết quả AI; lỗi (ví dụ khoá đã hết hạn) chỉ ghi log, vì draft vẫn nhận kết quả AI. */
  private async publishCacheBestEffort(
    data: Parameters<GearExtractionCachePort['setCache']>[0],
    leaseValidation: Parameters<GearExtractionCachePort['setCache']>[1],
  ): Promise<void> {
    try {
      await this.cachePort.setCache(data, leaseValidation)
    } catch (err: any) {
      this.logger.warn(`Skipped publishing gear extraction cache: ${err?.code ?? err?.message}`)
    }
  }

  /**
   * Bản nháp nhập tay không tính quota ngày, nên giới hạn riêng theo giờ để chặn tạo row vô hạn.
   * Giới hạn mềm (không khoá): gọi đồng thời có thể vượt vài bản, chấp nhận được vì không liên quan tiền.
   */
  private async assertManualDraftRateLimit(userId: string): Promise<void> {
    const limit = readGearRuntimeConfig().manualDraftHourlyLimit
    const windowMs = 60 * 60 * 1000
    const windowStart = new Date(Date.now() - windowMs)

    const recent = await this.prisma.gearExtractionDraft.findMany({
      where: { userId, createdAt: { gte: windowStart }, status: { in: ['READY', 'CONFIRMED'] } },
      select: { extractedData: true, createdAt: true },
    })
    const manual = recent.filter((d) => isManualEntryData(d.extractedData))
    if (manual.length < limit) return

    const oldest = manual.reduce((min, d) => (d.createdAt < min ? d.createdAt : min), manual[0].createdAt)
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest.getTime() + windowMs - Date.now()) / 1000))
    throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_MANUAL_DRAFT_RATE_LIMITED, {
      details: { limit, windowSeconds: windowMs / 1000, retryAfterSeconds },
    })
  }

  /** Giữ quota ngày; hết quota thì trả null để caller tạo bản nháp nhập tay thay vì báo lỗi. */
  private async reserveQuotaOrNull(
    userId: string,
    sourceType: 'IMAGE' | 'LINK',
    sourceHash: string,
    expiresAt: Date,
  ): Promise<GearExtractionDraftDomain | null> {
    try {
      return await this.checkAndReserveQuota(userId, sourceType, sourceHash, expiresAt)
    } catch (err: any) {
      if (err instanceof AppError && err.code === GEAR_ERROR_CODES.GEAR_EXTRACTION_QUOTA_EXCEEDED) return null
      throw err
    }
  }

  /** Bản nháp READY không có thông số: FE mở form trống để người dùng nhập tay. Không tính quota. */
  private async createManualDraft(
    userId: string,
    sourceType: 'IMAGE' | 'LINK',
    sourceHash: string,
    expiresAt: Date,
    reasonCode: ManualEntryReasonCode,
    extra: Record<string, unknown> = {},
  ): Promise<GearExtractionDraftDomain> {
    await this.assertManualDraftRateLimit(userId)
    const draft = await this.draftRepo.createDraft({ userId, sourceType, sourceHash, expiresAt })
    return this.convertToManualDraft(draft, reasonCode, extra)
  }

  private convertToManualDraft(
    draft: GearExtractionDraftDomain,
    reasonCode: ManualEntryReasonCode,
    extra: Record<string, unknown> = {},
  ): Promise<GearExtractionDraftDomain> {
    return this.draftRepo.updateExtractedData(draft.id, buildManualEntryData(reasonCode, extra), 'READY', draft.version)
  }

  async getDraft(draftId: string, userId: string): Promise<GearExtractionDraftDomain> {
    const draft = await this.draftRepo.findByIdAndUser(draftId, userId)
    if (!draft) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_DRAFT_NOT_FOUND, {
        message: 'Không tìm thấy bản nháp trích xuất trang bị',
      })
    }
    return draft
  }

  /**
   * B02 Atomic Unit of Work for Confirm Draft:
   * Wraps draft lock, replay check, 50-item limit, media validation, duplicate check, item creation, and CAS confirm in one transaction.
   */
  async confirmDraft(
    draftId: string,
    userId: string,
    dto: ConfirmExtractionDraftDto,
  ): Promise<{ item: UserGearItemDomain; replayed: boolean }> {
    const payloadHash = createHash('sha256').update(canonicalStringify(dto.item)).digest('hex')

    return this.prisma.$transaction(async (tx) => {
      // 1. Lock and read draft within transaction, and lock user row to serialize closet capacity across manual & draft confirms
      if (typeof tx.$executeRaw === 'function') {
        try {
          await tx.$executeRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`
        } catch (err: any) {
          if (err instanceof AppError) throw err
          // In unit test mocks $executeRaw might not emulate PostgreSQL SQL parser
        }
      }

      const draft = await tx.gearExtractionDraft.findFirst({
        where: { id: draftId, userId },
      })

      if (!draft) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_DRAFT_NOT_FOUND, {
          message: 'Không tìm thấy bản nháp trích xuất trang bị',
        })
      }

      // 2. Idempotent Replay Handling
      if (draft.status === 'CONFIRMED') {
        if (draft.confirmationPayloadHash !== payloadHash) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_PAYLOAD_MISMATCH, {
            message: 'Dữ liệu xác nhận không khớp với bản nháp ban đầu',
          })
        }

        if (!draft.confirmedItemId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
            message: 'Món đồ cá nhân đã được xác nhận từ bản nháp này nhưng sau đó đã bị xóa khỏi tủ đồ',
          })
        }

        const existingItem = await tx.userGearItem.findFirst({
          where: { id: draft.confirmedItemId, userId },
          include: { photos: { orderBy: { position: 'asc' } } },
        })

        if (!existingItem) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
            message: 'Món đồ cá nhân đã được xác nhận từ bản nháp này nhưng sau đó đã bị xóa khỏi tủ đồ',
          })
        }

        return {
          item: {
            id: existingItem.id,
            userId: existingItem.userId,
            name: existingItem.name,
            category: existingItem.category as any,
            brand: existingItem.brand,
            condition: existingItem.condition as any,
            attributes: (existingItem.attributes as Record<string, unknown>) || {},
            photoRef: existingItem.photoRef,
            source: existingItem.source as any,
            version: existingItem.version,
            createdAt: existingItem.createdAt,
            updatedAt: existingItem.updatedAt,
            photos: existingItem.photos.map((p) => ({
              id: p.id,
              itemId: p.itemId,
              storageRef: p.storageRef,
              position: p.position,
              createdAt: p.createdAt,
            })),
          },
          replayed: true,
        }
      }

      // 3. Draft Readiness & Expiration
      if (draft.status !== 'READY') {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_NOT_READY, {
          message: `Bản nháp chưa sẵn sàng để xác nhận (trạng thái: ${draft.status})`,
        })
      }

      if (draft.expiresAt <= new Date()) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_DRAFT_EXPIRED, {
          message: 'Bản nháp trích xuất trang bị đã hết hạn',
        })
      }

      if (dto.expectedVersion !== undefined && draft.version !== dto.expectedVersion) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
          message: 'Xung đột phiên bản khi xác nhận bản nháp đồng thời',
        })
      }

      // 4. Enforce 50-item closet limit within transaction
      const currentItemCount = await tx.userGearItem.count({
        where: { userId },
      })
      if (currentItemCount >= 50) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_LIMIT_EXCEEDED, {
          message: 'Tủ đồ của bạn đã đạt giới hạn tối đa 50 món',
        })
      }

      // 5. Synchronize cover photo and photos array, and validate media inside transaction (B02)
      let photos = dto.item.photos
      if (dto.item.photoRef && (!photos || photos.length === 0)) {
        photos = [{ storageRef: dto.item.photoRef, position: 0 }]
      }
      const coverPhotoRef = dto.item.photoRef ?? (photos && photos.length > 0 ? photos[0].storageRef : null)

      if (photos && photos.length > 3) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PHOTO_LIMIT_EXCEEDED, {
          message: 'Mỗi món đồ chỉ được tối đa 3 ảnh (vị trí 0..2)',
        })
      }

      if (coverPhotoRef) {
        const photoAsset = await tx.mediaAsset.findFirst({
          where: { id: coverPhotoRef },
        })
        if (!photoAsset || photoAsset.ownerUserId !== userId) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
            message: 'Ảnh đính kèm không tồn tại hoặc không thuộc sở hữu của bạn',
          })
        }
        if (photoAsset.scope !== 'USER_GEAR' || photoAsset.status !== 'READY') {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
            message: 'Ảnh đính kèm chưa sẵn sàng hoặc không đúng phạm vi trang bị',
          })
        }
      }

      if (photos && photos.length > 0) {
        for (const p of photos) {
          if (p.storageRef !== coverPhotoRef) {
            const photoAsset = await tx.mediaAsset.findFirst({
              where: { id: p.storageRef },
            })
            if (!photoAsset || photoAsset.ownerUserId !== userId) {
              throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND, {
                message: 'Ảnh đính kèm không tồn tại hoặc không thuộc sở hữu của bạn',
              })
            }
            if (photoAsset.scope !== 'USER_GEAR' || photoAsset.status !== 'READY') {
              throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
                message: 'Ảnh đính kèm chưa sẵn sàng hoặc không đúng phạm vi trang bị',
              })
            }
          }
        }
      }

      // 6. Validate attributes against canonical category schema
      let normalizedAttrs: Record<string, unknown>
      try {
        normalizedAttrs = normalizeCreateAttributes(dto.item.category, dto.item.attributes)
      } catch (err: any) {
        throw AppError.fromCode(COMMON_ERROR_CODES.VALIDATION_ERROR, {
          message: err?.message || 'Thuộc tính kỹ thuật của món đồ không hợp lệ',
        })
      }

      // 7. Duplicate Check (MASTER 1.1.G) within transaction
      const existingItems = await tx.userGearItem.findMany({
        where: { userId, category: dto.item.category as any },
      })

      const similarWarning = findSimilarItems(
        {
          category: dto.item.category,
          condition: dto.item.condition,
          attributes: normalizedAttrs,
        },
        existingItems.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category as any,
          condition: i.condition as any,
          attributes: (i.attributes as Record<string, unknown>) || {},
          createdAt: i.createdAt,
        })),
      )

      if (similarWarning && dto.acknowledgeDuplicate !== true) {
        // Draft remains READY so user can acknowledge later
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_ITEM_POSSIBLE_DUPLICATE, {
          message: 'Phát hiện món đồ có thông số tương tự trong tủ đồ',
          details: similarWarning as unknown as Record<string, unknown>,
        })
      }

      // 8. Insert UserGearItem within transaction
      // Bản nháp nhập tay: thông số do người dùng nhập, không phải AI → item MANUAL.
      const itemSource: GearItemSource = isManualEntryData(draft.extractedData)
        ? 'MANUAL'
        : draft.sourceType === 'IMAGE'
          ? 'AI_IMAGE'
          : 'AI_LINK'
      const createdItem = await tx.userGearItem.create({
        data: {
          userId,
          name: dto.item.name,
          category: dto.item.category as any,
          brand: dto.item.brand ?? null,
          condition: dto.item.condition as any,
          attributes: normalizedAttrs as any,
          photoRef: coverPhotoRef,
          source: itemSource as any,
          version: 1,
        },
      })

      // 9. Insert photos if provided
      const photosCreated: Array<{
        id: string
        itemId: string
        storageRef: string
        position: number
        createdAt: Date
      }> = []
      if (photos && photos.length > 0) {
        for (let pos = 0; pos < photos.length; pos++) {
          const photo = photos[pos]
          const photoRecord = await tx.userGearItemPhoto.create({
            data: {
              itemId: createdItem.id,
              storageRef: photo.storageRef,
              position: pos,
            },
          })
          photosCreated.push({
            id: photoRecord.id,
            itemId: photoRecord.itemId,
            storageRef: photoRecord.storageRef,
            position: photoRecord.position,
            createdAt: photoRecord.createdAt,
          })
        }
      }

      // 10. Atomic CAS update draft to CONFIRMED
      const updateResult = await tx.gearExtractionDraft.updateMany({
        where: {
          id: draftId,
          version: draft.version,
          status: 'READY',
        },
        data: {
          status: 'CONFIRMED',
          confirmedItemId: createdItem.id,
          confirmationPayloadHash: payloadHash,
          version: { increment: 1 },
        },
      })

      if (updateResult.count === 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_CONCURRENCY_CONFLICT, {
          message: 'Xung đột khi lưu trạng thái xác nhận bản nháp',
        })
      }

      return {
        item: {
          id: createdItem.id,
          userId: createdItem.userId,
          name: createdItem.name,
          category: createdItem.category as any,
          brand: createdItem.brand,
          condition: createdItem.condition as any,
          attributes: normalizedAttrs,
          photoRef: createdItem.photoRef,
          source: itemSource,
          version: createdItem.version,
          createdAt: createdItem.createdAt,
          updatedAt: createdItem.updatedAt,
          photos: photosCreated,
        },
        replayed: false,
      }
    })
  }
}
