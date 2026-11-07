jest.mock('@nestjs/schedule', () => ({
  Cron: jest.fn(() => () => {}),
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}))

import { existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import sharp from 'sharp'
import envconfig from 'src/shared/config'
import { inflateSync } from 'node:zlib'
import { RentalDocumentRenderStatus, RentalDocumentType } from '@prisma/client'
import { RentalDocumentService } from './rental-document.service'
import { evaluateDocumentRetention } from './rental-document-retention.policy'
import { issueHandoverDocumentTx, RENTAL_HANDOVER_TEMPLATE_VERSION, snapshotHash } from './rental-document-events'
import { MemoryDocumentStorage, documentObjectKey, pdfDigest } from '../infrastructure/document-storage.port'
import { RentalPdfRenderer, documentText, formatVndExact } from '../infrastructure/rental-pdf.renderer'
import { RentalDocumentRenderWorker } from '../infrastructure/rental-document-render.worker'
import { CorrectionBodySchema } from '../presentation/rental-document-admin.dto'
import { documentEvidenceIds, rentalEvidenceLink, verifyRentalEvidenceSignature } from './rental-evidence-link'

const id = '550e8400-e29b-41d4-a716-446655440000'
const snapshot = { kind: 'HANDOVER', recipientNotes: 'Đã nhận đủ thiết bị' }
const doc = () => ({
  id,
  orderId: id,
  documentNumber: 'TG-HANDOVER-123',
  documentType: RentalDocumentType.HANDOVER,
  templateVersion: '1.3.2',
  policyVersion: '1.5.2',
  snapshotJson: snapshot,
  snapshotHash: snapshotHash(snapshot),
  sourceVersion: 2,
  issuedAt: new Date('2026-10-20T10:00:00Z'),
  renderStatus: RentalDocumentRenderStatus.READY,
  pdfStorageKey: documentObjectKey(id, '1.3.2', snapshotHash(snapshot)),
  pdfHash: null,
  rootDocumentId: null,
})

function pdfPageText(bytes: Buffer): string[] {
  const binary = bytes.toString('latin1')
  const pages: string[] = []
  for (const match of binary.matchAll(/<< \/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g)) {
    const start = match.index + match[0].length
    const content = inflateSync(bytes.subarray(start, start + Number(match[1]))).toString('latin1')
    if (!content.includes('BT /F1')) continue
    pages.push(
      [...content.matchAll(/<([0-9a-fA-F]+)> Tj/g)]
        .map(([, hex]) => {
          const chars = Buffer.from(hex, 'hex')
          const codes: number[] = []
          for (let i = 0; i < chars.length; i += 2) codes.push(chars.readUInt16BE(i))
          return String.fromCharCode(...codes)
        })
        .join('\n'),
    )
  }
  return pages
}

describe('Rental Phase 11 documents (pure mock)', () => {
  it('replays the committed winner after a concurrent idempotency-key insert', async () => {
    const response = { correctionDocumentId: 'winner' }
    const request = { documentId: id, reason: 'typo' }
    const prisma = {
      $transaction: jest.fn().mockRejectedValue({ code: 'P2002' }),
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue({
          requestHash: snapshotHash(request),
          responseBody: response,
        }),
      },
    }
    const service = new RentalDocumentService(prisma as any, {} as any, new MemoryDocumentStorage())
    const work = jest.fn()
    await expect((service as any).idempotent('RB-API-1006:correction', id, 'same-key', request, work)).resolves.toEqual(
      response,
    )
    expect(work).not.toHaveBeenCalled()
    expect(prisma.idempotencyRecord.findUnique).toHaveBeenCalledTimes(1)
    await expect(
      (service as any).idempotent('RB-API-1006:correction', id, 'same-key', { ...request, reason: 'different' }, work),
    ).rejects.toThrow()
  })

  it('formats large VND amounts without converting through Number', () => {
    expect(formatVndExact('9007199254740993')).toBe('9.007.199.254.740.993 VND')
    expect(formatVndExact('-001234567890123456789.05')).toBe('-1.234.567.890.123.456.789,05 VND')
  })

  it('shows names and human-readable evidence for new handover and return documents', () => {
    const evidenceId = '550e8400-e29b-41d4-a716-446655440099'
    const handover = {
      ...doc(),
      templateVersion: RENTAL_HANDOVER_TEMPLATE_VERSION,
      snapshotJson: {
        orderId: id,
        tripTitle: 'Núi Dinh',
        staffName: 'Nguyễn Minh',
        pickupPoint: { name: 'Điểm hẹn', address: 'Đường A' },
        recipient: { displayName: 'Trần An', phone: '0900123456', userId: id },
        units: [
          {
            productName: 'Lều hai người',
            assetCode: 'TENT-01',
            condition: 'GOOD',
            accessories: ['Cọc lều'],
            notes: 'Khóa kéo tốt',
            evidenceIds: [evidenceId],
          },
        ],
      },
    } as any
    const text = documentText(handover)
    expect(text).toContain('Núi Dinh')
    expect(text).toContain('Nguyễn Minh')
    expect(text).toContain('Điểm hẹn — Đường A')
    expect(text).toContain('Lều hai người')
    expect(text).toContain('Ghi chú tình trạng: Khóa kéo tốt')
    expect(text).toContain('Ảnh 1')
    expect(text).not.toContain('Mã người nhận')
    expect(text).not.toContain('54400099')
    const receipt = documentText({
      ...handover,
      documentType: RentalDocumentType.RETURN_RECEIPT,
      snapshotJson: {
        orderId: id,
        tripTitle: 'Núi Dinh',
        staffName: 'Lê Bình',
        recipient: { displayName: 'Trần An' },
        returnLocation: { name: 'Điểm trả', address: 'Đường B' },
        receivedUnits: [{ productName: 'Lều hai người', assetCode: 'TENT-01', condition: 'GOOD', outcome: 'PASS' }],
        notReturnedUnitIdsAtSessionEnd: [evidenceId],
        notReturnedUnits: [{ productName: 'Balo 30L', assetCode: 'BALO-02' }],
        userRemarks: 'Đã trả lều',
      },
    } as any)
    expect(receipt).toContain('Điểm trả — Đường B')
    expect(receipt).toContain('Balo 30L')
    expect(receipt).toContain('BALO-02')
    expect(receipt).toContain('Đã trả lều')
    expect(receipt).not.toContain('54400099')
  })

  it('renders a new handover PDF with readable names and no printed technical hash', async () => {
    const value = {
      kind: 'HANDOVER',
      orderId: id,
      tripTitle: 'Núi Dinh',
      staffName: 'Nguyễn Minh',
      recipient: { displayName: 'Trần An' },
      units: [{ productName: 'Lều hai người', assetCode: 'TENT-01', condition: 'GOOD' }],
    }
    const item = {
      ...doc(),
      templateVersion: RENTAL_HANDOVER_TEMPLATE_VERSION,
      snapshotJson: value,
      snapshotHash: snapshotHash(value),
    } as any
    const bytes = await new RentalPdfRenderer().render(item)
    const text = pdfPageText(bytes).join('\n')
    expect(text).toContain('Núi Dinh')
    expect(text).toContain('Nguyễn Minh')
    expect(text).toContain('Lều hai người')
    expect(text).not.toContain(item.snapshotHash)
  })

  it('renders returned and outstanding equipment by name in a new receipt PDF', async () => {
    const value = {
      kind: 'RETURN_RECEIPT',
      orderId: id,
      tripTitle: 'Núi Dinh',
      staffName: 'Lê Bình',
      recipient: { displayName: 'Trần An' },
      returnLocation: { name: 'Điểm trả', address: 'Đường B' },
      receivedUnits: [{ productName: 'Lều hai người', assetCode: 'TENT-01', condition: 'GOOD', outcome: 'PASS' }],
      notReturnedUnitIdsAtSessionEnd: [id],
      notReturnedUnits: [{ productName: 'Balo 30L', assetCode: 'BALO-02' }],
    }
    const item = {
      ...doc(),
      documentType: RentalDocumentType.RETURN_RECEIPT,
      templateVersion: RENTAL_HANDOVER_TEMPLATE_VERSION,
      snapshotJson: value,
      snapshotHash: snapshotHash(value),
    } as any
    const text = pdfPageText(await new RentalPdfRenderer().render(item)).join('\n')
    expect(text).toContain('Lều hai người')
    expect(text).toContain('Balo 30L')
    expect(text).toContain('Điểm trả — Đường B')
    expect(text).not.toContain('54400000')
  })

  it('captures readable handover data at issuance without replacing existing documents', async () => {
    const create = jest.fn(async ({ data }: any) => ({ id: 'new-doc', ...data }))
    const tx: any = {
      rentalDocument: { findUnique: jest.fn().mockResolvedValue(null), create },
      rentalOutboxEvent: { upsert: jest.fn() },
      rentalOrder: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id,
            tripId: id,
            bookingId: null,
            version: 1,
            trip: { title: 'Núi Dinh' },
            pickupPoint: { name: 'Điểm giao', address: 'Đường A' },
            returnPoint: { name: 'Điểm trả', address: 'Đường B' },
            rentalStartAt: new Date('2026-11-01'),
            rentalEndAt: new Date('2026-11-02'),
            rentalFee: 100,
            totalDeposit: 200,
            currency: 'VND',
            policySnapshot: {},
          }),
      },
      rentalHandover: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            orderId: id,
            staffId: id,
            staff: { fullName: 'Nguyễn Minh' },
            recipientSnapshot: { displayName: 'Trần An' },
            handedOverAt: new Date('2026-11-01'),
          }),
      },
      packageItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              assignmentId: 'a',
              equipmentUnitId: id,
              equipmentUnit: { assetCode: 'TENT-01', productId: id, product: { name: 'Lều hai người' } },
            },
          ]),
      },
      conditionSnapshot: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id, assignmentId: 'a', condition: 'GOOD', notes: 'Đủ phụ kiện', accessories: [], evidenceIds: [] },
          ]),
      },
    }
    await issueHandoverDocumentTx(tx, id, id, new Date('2026-11-01'))
    const data = create.mock.calls[0][0].data
    expect(data.templateVersion).toBe(RENTAL_HANDOVER_TEMPLATE_VERSION)
    expect(data.snapshotJson).toMatchObject({
      tripTitle: 'Núi Dinh',
      staffName: 'Nguyễn Minh',
      pickupPoint: { name: 'Điểm giao' },
      units: [{ productName: 'Lều hai người', notes: 'Đủ phụ kiện' }],
    })
    expect(data.snapshotHash).toBe(snapshotHash(data.snapshotJson))
    tx.rentalDocument.findUnique.mockResolvedValue({ id: 'existing' })
    expect(await issueHandoverDocumentTx(tx, id, id, new Date())).toEqual({ id: 'existing' })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('renders distinct semantic content from the five immutable document snapshots', () => {
    const cases: Array<[RentalDocumentType, Record<string, unknown>, string]> = [
      [
        RentalDocumentType.HANDOVER,
        {
          recipient: { displayName: 'Nguyễn An' },
          units: [{ assetCode: 'BAL-001', condition: 'GOOD', accessories: ['Dây đeo'] }],
          policySnapshot: { secret: 'must-not-render' },
        },
        'BAL-001 | Tốt | Dây đeo',
      ],
      [
        RentalDocumentType.RETURN_RECEIPT,
        { receivedUnits: [{ assetCode: 'BAL-001', condition: 'GOOD' }], notReturnedUnitIdsAtSessionEnd: ['unit-2'] },
        'Thiết bị chưa trả (1)',
      ],
      [
        RentalDocumentType.EXTENSION_APPENDIX,
        {
          oldRentalEndAt: '2026-10-20T10:00:00Z',
          newRentalEndAt: '2026-10-21T10:00:00Z',
          additionalFee: '9007199254740993',
          acceptance: { acceptedTermsVersion: 'v1.5.2' },
          templateVersion: '1.0.0',
        },
        '9.007.199.254.740.993 VND',
      ],
      [
        RentalDocumentType.SCHEDULE_NOTICE,
        { operationalReturnDueAt: '2026-10-21T10:00:00Z' },
        'Hạn trả mới: 17:00, 21/10/2026',
      ],
      [
        RentalDocumentType.CORRECTION_NOTICE,
        { corrections: [{ field: 'remarks', oldValue: 'Cũ', newValue: 'Mới' }] },
        'remarks | Cũ | Mới',
      ],
    ]
    for (const [documentType, value, expected] of cases) {
      const text = documentText({ ...doc(), documentType, snapshotJson: value } as any)
      expect(text).toContain(expected)
      expect(text).not.toContain('policySnapshot')
      expect(text).not.toContain('must-not-render')
      expect(text).not.toContain('templateVersion: 1.0.0')
    }
    expect(
      CorrectionBodySchema.safeParse({
        reason: 'Correct location label',
        expectedVersion: 1,
        corrections: [{ field: 'returnLocationLabel', oldValue: 'A', newValue: 'B' }],
      }).success,
    ).toBe(false)
  })

  it('stores HTTP 202 for retry-render idempotency replay', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      rentalDocument: {
        findUnique: jest.fn().mockResolvedValue({
          id,
          renderStatus: RentalDocumentRenderStatus.RENDER_FAILED,
          renderAttemptCount: 1,
        }),
        update: jest.fn(),
      },
      rentalOutboxEvent: { update: jest.fn() },
      auditLog: { create: jest.fn() },
    }
    const prisma = { $transaction: jest.fn((work: (tx: any) => Promise<any>) => work(tx)) }
    const service = new RentalDocumentService(prisma as any, {} as any, new MemoryDocumentStorage())
    await service.retry(id, id, 'retry-key', { reason: 'Storage outage recovered' })
    expect(tx.idempotencyRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ responseStatus: 202 }),
      }),
    )
  })

  it('continues past ready outbox entries in a backlogged worker tick', async () => {
    const worker = new RentalDocumentRenderWorker({} as any, {} as any, new MemoryDocumentStorage())
    const event = { id, aggregate_id: id, published_at: new Date() }
    ;(worker as any).claim = jest
      .fn()
      .mockResolvedValueOnce('SKIP_CURRENT_ITEM')
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(null)
    ;(worker as any).process = jest.fn()
    const previous = process.env.RENTAL_DOCUMENT_WORKER_ENABLED
    process.env.RENTAL_DOCUMENT_WORKER_ENABLED = 'true'
    try {
      await worker.tick()
    } finally {
      if (previous === undefined) delete process.env.RENTAL_DOCUMENT_WORKER_ENABLED
      else process.env.RENTAL_DOCUMENT_WORKER_ENABLED = previous
    }
    expect((worker as any).process).toHaveBeenCalledWith(event)
  })

  it('authorizes before signed download and verifies stored bytes', async () => {
    const storage = new MemoryDocumentStorage()
    const item = { ...doc(), pdfHash: pdfDigest(Buffer.from('%PDF-1.7 test')) }
    await storage.put(item.pdfStorageKey, Buffer.from('%PDF-1.7 test'))
    const prisma = {
      rentalDocument: {
        findUnique: jest.fn().mockResolvedValue(item),
        findMany: jest.fn().mockResolvedValue([{ id }]),
      },
      rentalDocumentAccessLog: { create: jest.fn() },
    }
    const gate = { execute: jest.fn().mockResolvedValue({ id }) }
    const service = new RentalDocumentService(prisma as any, gate as any, storage)
    const result = await service.download(id, id, 'USER')
    expect(gate.execute.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.rentalDocument.findUnique.mock.invocationCallOrder[0],
    )
    expect(result).toMatchObject({ sha256: item.pdfHash, contentType: 'application/pdf' })
    expect(new Date(result.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(600_000)
    expect(result.downloadUrl).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect((await service.verify(id, id, 'USER')).verified).toBe(true)
    storage.objects.set(item.pdfStorageKey, Buffer.from('tampered'))
    await expect(service.download(id, id, 'USER')).rejects.toThrow()
    expect((await service.verify(id, id, 'USER')).pdfVerified).toBe(false)
    gate.execute.mockRejectedValueOnce(new Error('FORBIDDEN'))
    await expect(service.download(id, 'other', 'USER')).rejects.toThrow('FORBIDDEN')
  })

  it('detects snapshot tampering without trusting the stored hash', async () => {
    const item = {
      ...doc(),
      snapshotJson: { kind: 'HANDOVER', recipientNotes: 'altered' },
      renderStatus: RentalDocumentRenderStatus.PENDING_RENDER,
    }
    const prisma = {
      rentalDocument: {
        findUnique: jest.fn().mockResolvedValue(item),
        findMany: jest.fn().mockResolvedValue([{ id }]),
      },
    }
    const service = new RentalDocumentService(
      prisma as any,
      { execute: jest.fn().mockResolvedValue({ id }) } as any,
      new MemoryDocumentStorage(),
    )
    expect((await service.verify(id, id, 'ADMIN')).snapshotVerified).toBe(false)
  })

  it('retains the complete chain through settlement, case closure and legal hold', () => {
    const now = new Date('2026-10-20T00:00:00Z')
    const settled = new Date('2026-01-01T00:00:00Z')
    const base = {
      now,
      settlementAt: settled,
      relatedCases: [{ closedAt: settled }],
      relatedDocumentsReady: true,
      legalHoldUntil: null,
    }
    expect(evaluateDocumentRetention({ ...base, relatedCases: [{ closedAt: null }] }).eligible).toBe(false)
    expect(evaluateDocumentRetention({ ...base, legalHoldUntil: new Date('2027-01-01') }).eligible).toBe(false)
    expect(evaluateDocumentRetention(base).eligible).toBe(true)
  })

  it('reuses identical upload after a crash and marks the existing document READY', async () => {
    const storage = new MemoryDocumentStorage()
    const item = { ...doc(), renderStatus: RentalDocumentRenderStatus.PENDING_RENDER, renderAttemptCount: 2 }
    const bytes = Buffer.from('%PDF-1.7 deterministic')
    await storage.put(item.pdfStorageKey, bytes) // previous worker uploaded before DB update
    const tx = {
      $queryRaw: jest.fn(),
      rentalDocument: {
        findUnique: jest.fn().mockResolvedValue(item),
        update: jest.fn(),
      },
      rentalOutboxEvent: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
    }
    const prisma = {
      rentalDocument: { findUnique: jest.fn().mockResolvedValue(item) },
      $transaction: jest.fn((work: (tx: any) => Promise<any>) => work(tx)),
    }
    const worker = new RentalDocumentRenderWorker(
      prisma as any,
      { render: jest.fn().mockResolvedValue(bytes) },
      storage,
    )
    const lease = new Date('2026-10-20T10:00:00Z')
    await (worker as any).process({ id, aggregate_id: id, published_at: lease })
    expect(tx.rentalDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ renderStatus: RentalDocumentRenderStatus.READY, pdfHash: pdfDigest(bytes) }),
      }),
    )
    expect(tx.rentalOutboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ publishedAt: lease, status: 'PUBLISHED' }),
        data: expect.objectContaining({ status: 'PROCESSED' }),
      }),
    )
  })

  it('does not publish PDF metadata after its lease is fenced out', async () => {
    const storage = new MemoryDocumentStorage()
    const item = { ...doc(), renderStatus: RentalDocumentRenderStatus.PENDING_RENDER, renderAttemptCount: 2 }
    const tx = {
      rentalOutboxEvent: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      rentalDocument: { update: jest.fn() },
      $queryRaw: jest.fn(),
    }
    const prisma = {
      rentalDocument: { findUnique: jest.fn().mockResolvedValue(item) },
      $transaction: jest.fn((work: (tx: any) => Promise<any>) => work(tx)),
    }
    const worker = new RentalDocumentRenderWorker(
      prisma as any,
      { render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7 deterministic')) },
      storage,
    )
    await (worker as any).process({ id, aggregate_id: id, published_at: new Date() })
    expect(tx.rentalOutboxEvent.updateMany).toHaveBeenCalledTimes(1)
    expect(tx.rentalDocument.update).not.toHaveBeenCalled()
    expect(worker.metrics.processed).toBe(0)
  })

  it('renders Vietnamese using the bundled font without environment configuration', async () => {
    const previousEnv = process.env.RENTAL_PDF_FONT_PATH
    const previousConfig = envconfig.RENTAL_PDF_FONT_PATH
    delete process.env.RENTAL_PDF_FONT_PATH
    delete envconfig.RENTAL_PDF_FONT_PATH
    try {
      const value = { ...snapshot, recipientNotes: 'Đã nhận đủ thiết bị tiếng Việt' }
      const bytes = await new RentalPdfRenderer().render({
        ...doc(),
        snapshotJson: value,
        snapshotHash: snapshotHash(value),
      } as any)
      expect(pdfPageText(bytes).join(' ')).toContain('Đã nhận đủ thiết bị tiếng Việt')
    } finally {
      if (previousEnv !== undefined) process.env.RENTAL_PDF_FONT_PATH = previousEnv
      envconfig.RENTAL_PDF_FONT_PATH = previousConfig
    }
  })

  const localFont = process.env.RENTAL_PDF_FONT_PATH || 'C:/Windows/Fonts/arial.ttf'
  ;(existsSync(localFont) ? it : it.skip)('renders Unicode Vietnamese from a configured local font', async () => {
    const previous = process.env.RENTAL_PDF_FONT_PATH
    process.env.RENTAL_PDF_FONT_PATH = localFont
    try {
      const longSnapshot = {
        ...snapshot,
        recipient: { displayName: 'Nguyễn Văn An' },
        units: Array.from({ length: 45 }, (_, i) => ({
          assetCode: `BAL-${i + 1}`,
          condition: 'GOOD',
          accessories: ['Dây đeo'],
          evidenceIds: [`evidence-${i}`],
        })),
      }
      const bytes = await new RentalPdfRenderer().render({
        ...doc(),
        snapshotJson: longSnapshot,
        snapshotHash: snapshotHash(longSnapshot),
        pdfHash: null,
      } as any)
      expect(bytes.subarray(0, 8).toString()).toBe('%PDF-1.7')
      expect(bytes.toString('latin1')).toContain('/ToUnicode')
      expect(bytes.toString('latin1')).toMatch(/\/Count [2-9]/)
      expect(bytes.toString('latin1')).toContain('%%EOF')
      // Logo Vina TrekGo nhúng dạng JPEG và vẽ ở đầu trang 1.
      expect(bytes.toString('latin1')).toContain('/Filter /DCTDecode')
      expect(pdfPageText(bytes)[0]).toContain('VINA TREKGO')
      // Chứng từ mẫu mới phát hành cũng render được; mẫu lạ bị từ chối.
      await expect(
        new RentalPdfRenderer().render({
          ...doc(),
          templateVersion: '1.4.0',
          snapshotJson: longSnapshot,
          snapshotHash: snapshotHash(longSnapshot),
        } as any),
      ).resolves.toBeInstanceOf(Buffer)
      await expect(
        new RentalPdfRenderer().render({
          ...doc(),
          templateVersion: '9.9.9',
          snapshotJson: longSnapshot,
          snapshotHash: snapshotHash(longSnapshot),
        } as any),
      ).rejects.toThrow('PDF_SNAPSHOT_INTEGRITY_OR_TEMPLATE_FAILED')
    } finally {
      if (previous === undefined) delete process.env.RENTAL_PDF_FONT_PATH
      else process.env.RENTAL_PDF_FONT_PATH = previous
    }
  })

  ;(existsSync(localFont) ? it : it.skip).each([1, 10, 45])(
    'keeps every asset, condition, accessory and evidence group on one PDF page (%i units)',
    async (count) => {
      const previous = process.env.RENTAL_PDF_FONT_PATH
      process.env.RENTAL_PDF_FONT_PATH = localFont
      try {
        const units = Array.from({ length: count }, (_, i) => {
          const n = String(i + 1).padStart(3, '0')
          return {
            assetCode: `BAL-${n}`,
            condition: `GOOD-${n}`,
            accessories: [`Dây đeo và túi bảo quản tiếng Việt ${n}`],
            evidenceIds: [`EV-${n}`],
          }
        })
        const value = { ...snapshot, units }
        const bytes = await new RentalPdfRenderer().render({
          ...doc(),
          snapshotJson: value,
          snapshotHash: snapshotHash(value),
        } as any)
        const pages = pdfPageText(bytes)
        expect(pages.length).toBeGreaterThan(0)
        for (let i = 0; i < count; i++) {
          const n = String(i + 1).padStart(3, '0')
          const page = pages.findIndex((text) => text.includes(`BAL-${n}`))
          expect(page).toBeGreaterThanOrEqual(0)
          expect(pages[page]).toContain(`GOOD-${n}`)
          expect(pages[page]).toContain(`EV-${n}`)
          expect(pages[page]).toContain(`tiếng Việt ${n}`)
        }
      } finally {
        if (previous === undefined) delete process.env.RENTAL_PDF_FONT_PATH
        else process.env.RENTAL_PDF_FONT_PATH = previous
      }
    },
  )

  describe('evidence links in PDF', () => {
    const mediaId = '7c1e0a2b-1f3d-4b8e-9a6c-0d2e4f6a8b00'
    const otherMedia = '7c1e0a2b-1f3d-4b8e-9a6c-0d2e4f6a8b99'
    const linkedSnapshot = {
      kind: 'HANDOVER',
      units: [{ assetCode: 'TENT-001', condition: 'GOOD', evidenceIds: [mediaId] }],
    }
    it('embeds the original evidence and a clickable preview without link settings', async () => {
      delete process.env.RENTAL_DOCUMENT_LINK_SECRET
      delete process.env.RENTAL_DOCUMENT_LINK_BASE_URL
      const original = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#b54a32' } })
        .png()
        .toBuffer()
      const asset = {
        id: mediaId,
        status: 'READY',
        scope: 'CONDITION_EVIDENCE',
        resourceType: 'IMAGE',
        providerPublicId: 'evidence/abc',
        providerAssetId: null,
        deliveryType: 'authenticated',
      }
      const prisma: any = { mediaAsset: { findMany: jest.fn().mockResolvedValue([asset]) } }
      const media: any = { openOriginalStream: jest.fn().mockResolvedValue({ stream: Readable.from([original]) }) }
      const worker = new RentalDocumentRenderWorker(prisma, {} as any, new MemoryDocumentStorage(), media)
      const evidence = await (worker as any).evidenceImages(linkedSnapshot)
      expect(evidence).toHaveLength(1)
      expect(evidence[0].bytes.equals(original)).toBe(true)
      const pdf = await new RentalPdfRenderer().render(
        { ...doc(), snapshotJson: linkedSnapshot, snapshotHash: snapshotHash(linkedSnapshot) } as any,
        evidence,
      )
      const raw = pdf.toString('latin1')
      expect(raw).toContain('/Subtype /FileAttachment')
      const attachmentRect = raw.match(/\/Subtype \/FileAttachment \/Rect \[([^\]]+)\]/)
      expect(attachmentRect).not.toBeNull()
      const [left, bottom, right, top] = attachmentRect![1].split(' ').map(Number)
      expect(right - left).toBe(16)
      expect(top - bottom).toBe(16)
      expect(raw).toContain('/Name /Paperclip')
      expect(raw).toContain('/EmbeddedFiles')
      expect(raw).toContain(`/evidence-${mediaId}.png`.slice(1))
      expect(raw).toContain('/Evidence1')
      expect(raw).not.toContain('/Subtype /Link')
      expect(pdf.includes(original)).toBe(true)
      expect(media.openOriginalStream).toHaveBeenCalledTimes(1)
      prisma.mediaAsset.findMany.mockResolvedValueOnce([{ ...asset, status: 'DELETED' }])
      await expect((worker as any).evidenceImages(linkedSnapshot)).rejects.toThrow('PDF_EVIDENCE_UNAVAILABLE')
    })
    const saved: Record<string, string | undefined> = {}
    beforeEach(() => {
      for (const key of ['RENTAL_DOCUMENT_LINK_SECRET', 'RENTAL_DOCUMENT_LINK_BASE_URL']) saved[key] = process.env[key]
      process.env.RENTAL_DOCUMENT_LINK_SECRET = 'x'.repeat(40)
      process.env.RENTAL_DOCUMENT_LINK_BASE_URL = 'https://api.trekgo.test/'
    })
    afterEach(() => {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
    const sigOf = (url: string) => new URL(url).searchParams.get('sig')

    it('signs a link bound to one document and one evidence id', () => {
      const url = rentalEvidenceLink(id, mediaId)!
      expect(url).toMatch(
        new RegExp(`^https://api\\.trekgo\\.test/api/v1/rental-documents/${id}/evidence/${mediaId}\\?sig=`),
      )
      expect(verifyRentalEvidenceSignature(id, mediaId, sigOf(url))).toBe(true)
      expect(verifyRentalEvidenceSignature(id, otherMedia, sigOf(url))).toBe(false)
      expect(verifyRentalEvidenceSignature(id, mediaId, 'forged')).toBe(false)
      expect(
        documentEvidenceIds({ receivedUnits: [{ evidenceIds: [mediaId] }], failureEvidenceId: otherMedia }),
      ).toEqual(new Set([mediaId, otherMedia]))
      delete process.env.RENTAL_DOCUMENT_LINK_SECRET
      expect(rentalEvidenceLink(id, mediaId)).toBeNull()
    })

    it('redirects only for a valid signature, an evidence id of that document and a READY evidence asset', async () => {
      const asset = {
        status: 'READY',
        scope: 'CONDITION_EVIDENCE',
        resourceType: 'IMAGE',
        providerPublicId: 'evidence/abc',
        deliveryType: 'authenticated',
      }
      const prisma: any = {
        rentalDocument: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ snapshotJson: linkedSnapshot, snapshotHash: snapshotHash(linkedSnapshot) }),
        },
        mediaAsset: { findUnique: jest.fn().mockResolvedValue(asset) },
      }
      const media: any = {
        createDeliveryUrl: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/signed' }),
      }
      const service = new RentalDocumentService(prisma, {} as any, new MemoryDocumentStorage(), media)
      const sig = sigOf(rentalEvidenceLink(id, mediaId)!)

      await expect(service.resolveEvidenceLink(id, mediaId, sig)).resolves.toBe('https://res.cloudinary.com/signed')
      expect(media.createDeliveryUrl).toHaveBeenCalledWith(expect.objectContaining({ variant: 'EVIDENCE_PREVIEW' }))

      const notFound = expect.objectContaining({ code: 'RENTAL_DOCUMENT_NOT_FOUND' })
      await expect(service.resolveEvidenceLink(id, mediaId, 'forged')).rejects.toThrow(notFound)
      // Chữ ký hợp lệ nhưng ảnh không thuộc snapshot của chứng từ.
      await expect(
        service.resolveEvidenceLink(id, otherMedia, sigOf(rentalEvidenceLink(id, otherMedia)!)),
      ).rejects.toThrow(notFound)
      prisma.mediaAsset.findUnique.mockResolvedValueOnce({ ...asset, status: 'DELETED' })
      await expect(service.resolveEvidenceLink(id, mediaId, sig)).rejects.toThrow(notFound)
      expect(media.createDeliveryUrl).toHaveBeenCalledTimes(1)
    })

    ;(existsSync(localFont) ? it : it.skip)('adds clickable link annotations for evidence ids', async () => {
      const previous = process.env.RENTAL_PDF_FONT_PATH
      process.env.RENTAL_PDF_FONT_PATH = localFont
      try {
        const bytes = await new RentalPdfRenderer().render({
          ...doc(),
          templateVersion: '1.4.0',
          snapshotJson: linkedSnapshot,
          snapshotHash: snapshotHash(linkedSnapshot),
        } as any)
        const pdf = bytes.toString('latin1')
        expect(pdf).toContain('/Subtype /Link')
        expect(pdf).toContain(`/URI (https://api.trekgo.test/api/v1/rental-documents/${id}/evidence/${mediaId}?sig=`)
        expect(pdf).not.toContain('cloudinary')
        expect(pdfPageText(bytes)[0]).toContain('#4F6A8B00')
      } finally {
        if (previous === undefined) delete process.env.RENTAL_PDF_FONT_PATH
        else process.env.RENTAL_PDF_FONT_PATH = previous
      }
    })
  })

  ;(existsSync(localFont) ? it : it.skip).each([1, 10, 45])(
    'keeps a received asset and its observations together on one PDF page (%i units)',
    async (count) => {
      const previous = process.env.RENTAL_PDF_FONT_PATH
      process.env.RENTAL_PDF_FONT_PATH = localFont
      try {
        const receivedUnits = Array.from({ length: count }, (_, i) => {
          const n = String(i + 1).padStart(3, '0')
          return {
            assetCode: `RET-${n}`,
            condition: `SCRATCH-${n}`,
            outcome: `RECEIVED-${n}`,
            accessories: [`Phụ kiện tiếng Việt ${n}`],
            evidenceIds: [`PHOTO-${n}`],
            notes: `Ghi chú ${n}`,
          }
        })
        const value = { kind: 'RETURN_RECEIPT', returnSessionId: id, receivedUnits }
        const bytes = await new RentalPdfRenderer().render({
          ...doc(),
          documentType: RentalDocumentType.RETURN_RECEIPT,
          snapshotJson: value,
          snapshotHash: snapshotHash(value),
        } as any)
        const pages = pdfPageText(bytes)
        for (let i = 0; i < count; i++) {
          const n = String(i + 1).padStart(3, '0')
          const page = pages.findIndex((text) => text.includes(`RET-${n}`))
          expect(page).toBeGreaterThanOrEqual(0)
          for (const marker of [
            `SCRATCH-${n}`,
            `RECEIVED-${n}`,
            `PHOTO-${n}`,
            `Phụ kiện tiếng Việt ${n}`,
            `Ghi chú ${n}`,
          ])
            expect(pages[page]).toContain(marker)
        }
      } finally {
        if (previous === undefined) delete process.env.RENTAL_PDF_FONT_PATH
        else process.env.RENTAL_PDF_FONT_PATH = previous
      }
    },
  )
})
