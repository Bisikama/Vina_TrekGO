jest.mock('@nestjs/schedule', () => ({
  Cron: jest.fn(() => () => {}), CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

import { existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { RentalDocumentRenderStatus, RentalDocumentType } from '@prisma/client';
import { RentalDocumentService } from './rental-document.service';
import { evaluateDocumentRetention } from './rental-document-retention.policy';
import { snapshotHash } from './rental-document-events';
import { MemoryDocumentStorage, documentObjectKey, pdfDigest } from '../infrastructure/document-storage.port';
import { RentalPdfRenderer, documentLines, formatVndExact } from '../infrastructure/rental-pdf.renderer';
import { RentalDocumentRenderWorker } from '../infrastructure/rental-document-render.worker';
import { CorrectionBodySchema } from '../presentation/rental-document-admin.dto';

const id = '550e8400-e29b-41d4-a716-446655440000';
const snapshot = { kind: 'HANDOVER', recipientNotes: 'Đã nhận đủ thiết bị' };
const doc = () => ({ id, orderId: id, documentNumber: 'TG-HANDOVER-123',
  documentType: RentalDocumentType.HANDOVER, templateVersion: '1.3.2', policyVersion: '1.5.2',
  snapshotJson: snapshot, snapshotHash: snapshotHash(snapshot), sourceVersion: 2,
  issuedAt: new Date('2026-10-20T10:00:00Z'), renderStatus: RentalDocumentRenderStatus.READY,
  pdfStorageKey: documentObjectKey(id, '1.3.2', snapshotHash(snapshot)), pdfHash: null,
  rootDocumentId: null });

function pdfPageText(bytes: Buffer): string[] {
  const binary = bytes.toString('latin1');
  const pages: string[] = [];
  for (const match of binary.matchAll(/<< \/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g)) {
    const start = match.index + match[0].length;
    const content = inflateSync(bytes.subarray(start, start + Number(match[1]))).toString('latin1');
    if (!content.includes('BT /F1')) continue;
    pages.push([...content.matchAll(/<([0-9a-fA-F]+)> Tj/g)].map(([, hex]) => {
      const chars = Buffer.from(hex, 'hex');
      const codes: number[] = [];
      for (let i = 0; i < chars.length; i += 2) codes.push(chars.readUInt16BE(i));
      return String.fromCharCode(...codes);
    }).join('\n'));
  }
  return pages;
}

describe('Rental Phase 11 documents (pure mock)', () => {
  it('replays the committed winner after a concurrent idempotency-key insert', async () => {
    const response = { correctionDocumentId: 'winner' };
    const request = { documentId: id, reason: 'typo' };
    const prisma = { $transaction: jest.fn().mockRejectedValue({ code: 'P2002' }),
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue({
        requestHash: snapshotHash(request), responseBody: response,
      }) } };
    const service = new RentalDocumentService(prisma as any, {} as any, new MemoryDocumentStorage());
    const work = jest.fn();
    await expect((service as any).idempotent('RB-API-1006:correction', id, 'same-key', request, work))
      .resolves.toEqual(response);
    expect(work).not.toHaveBeenCalled();
    expect(prisma.idempotencyRecord.findUnique).toHaveBeenCalledTimes(1);
    await expect((service as any).idempotent('RB-API-1006:correction', id, 'same-key',
      { ...request, reason: 'different' }, work)).rejects.toThrow();
  });

  it('formats large VND amounts without converting through Number', () => {
    expect(formatVndExact('9007199254740993')).toBe('9.007.199.254.740.993 VND');
    expect(formatVndExact('-001234567890123456789.05')).toBe('-1.234.567.890.123.456.789,05 VND');
  });

  it('renders distinct semantic content from the five immutable document snapshots', () => {
    const cases: Array<[RentalDocumentType, Record<string, unknown>, string]> = [
      [RentalDocumentType.HANDOVER, { recipient: { displayName: 'Nguyễn An' },
        units: [{ assetCode: 'BAL-001', condition: 'GOOD', accessories: ['Dây đeo'] }],
        policySnapshot: { secret: 'must-not-render' } }, 'Mã tài sản: BAL-001'],
      [RentalDocumentType.RETURN_RECEIPT, { receivedUnits: [{ assetCode: 'BAL-001', condition: 'GOOD' }],
        notReturnedUnitIdsAtSessionEnd: ['unit-2'] }, 'THIẾT BỊ CHƯA GHI NHẬN TRẢ'],
      [RentalDocumentType.EXTENSION_APPENDIX, { oldRentalEndAt: '2026-10-20T10:00:00Z',
        newRentalEndAt: '2026-10-21T10:00:00Z', additionalFee: '9007199254740993',
        acceptance: { acceptedTermsVersion: 'v1.5.2' }, templateVersion: '1.0.0' },
      '9.007.199.254.740.993 VND'],
      [RentalDocumentType.SCHEDULE_NOTICE, { operationalReturnDueAt: '2026-10-21T10:00:00Z' },
        'THAY ĐỔI LỊCH VẬN HÀNH'],
      [RentalDocumentType.CORRECTION_NOTICE, { corrections: [{ field: 'remarks',
        oldValue: 'Cũ', newValue: 'Mới' }] }, 'Giá trị sau: Mới'],
    ];
    for (const [documentType, value, expected] of cases) {
      const text = documentLines({ ...doc(), documentType, snapshotJson: value } as any)
        .map(line => line.text).join('\n');
      expect(text).toContain(expected);
      expect(text).not.toContain('policySnapshot');
      expect(text).not.toContain('must-not-render');
      expect(text).not.toContain('templateVersion: 1.0.0');
    }
    expect(CorrectionBodySchema.safeParse({ reason: 'Correct location label', expectedVersion: 1,
      corrections: [{ field: 'returnLocationLabel', oldValue: 'A', newValue: 'B' }] }).success)
      .toBe(false);
  });

  it('stores HTTP 202 for retry-render idempotency replay', async () => {
    const tx = { $queryRaw: jest.fn(), idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
      rentalDocument: { findUnique: jest.fn().mockResolvedValue({
        id, renderStatus: RentalDocumentRenderStatus.RENDER_FAILED, renderAttemptCount: 1 }),
        update: jest.fn() }, rentalOutboxEvent: { update: jest.fn() },
      auditLog: { create: jest.fn() } };
    const prisma = { $transaction: jest.fn((work: (tx: any) => Promise<any>) => work(tx)) };
    const service = new RentalDocumentService(prisma as any, {} as any, new MemoryDocumentStorage());
    await service.retry(id, id, 'retry-key', { reason: 'Storage outage recovered' });
    expect(tx.idempotencyRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ responseStatus: 202 }) }));
  });

  it('continues past ready outbox entries in a backlogged worker tick', async () => {
    const worker = new RentalDocumentRenderWorker({} as any, {} as any, new MemoryDocumentStorage());
    const event = { id, aggregate_id: id, published_at: new Date() };
    (worker as any).claim = jest.fn().mockResolvedValueOnce('SKIP_CURRENT_ITEM')
      .mockResolvedValueOnce(event).mockResolvedValueOnce(null);
    (worker as any).process = jest.fn();
    const previous = process.env.RENTAL_DOCUMENT_WORKER_ENABLED;
    process.env.RENTAL_DOCUMENT_WORKER_ENABLED = 'true';
    try { await worker.tick(); } finally {
      if (previous === undefined) delete process.env.RENTAL_DOCUMENT_WORKER_ENABLED;
      else process.env.RENTAL_DOCUMENT_WORKER_ENABLED = previous;
    }
    expect((worker as any).process).toHaveBeenCalledWith(event);
  });

  it('authorizes before signed download and verifies stored bytes', async () => {
    const storage = new MemoryDocumentStorage();
    const item = { ...doc(), pdfHash: pdfDigest(Buffer.from('%PDF-1.7 test')) };
    await storage.put(item.pdfStorageKey, Buffer.from('%PDF-1.7 test'));
    const prisma = { rentalDocument: { findUnique: jest.fn().mockResolvedValue(item),
      findMany: jest.fn().mockResolvedValue([{ id }]) },
      rentalDocumentAccessLog: { create: jest.fn() } };
    const gate = { execute: jest.fn().mockResolvedValue({ id }) };
    const service = new RentalDocumentService(prisma as any, gate as any, storage);
    const result = await service.download(id, id, 'USER');
    expect(gate.execute.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.rentalDocument.findUnique.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({ sha256: item.pdfHash, contentType: 'application/pdf' });
    expect(new Date(result.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(600_000);
    expect(result.downloadUrl).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect((await service.verify(id, id, 'USER')).verified).toBe(true);
    storage.objects.set(item.pdfStorageKey, Buffer.from('tampered'));
    await expect(service.download(id, id, 'USER')).rejects.toThrow();
    expect((await service.verify(id, id, 'USER')).pdfVerified).toBe(false);
    gate.execute.mockRejectedValueOnce(new Error('FORBIDDEN'));
    await expect(service.download(id, 'other', 'USER')).rejects.toThrow('FORBIDDEN');
  });

  it('detects snapshot tampering without trusting the stored hash', async () => {
    const item = { ...doc(), snapshotJson: { kind: 'HANDOVER', recipientNotes: 'altered' },
      renderStatus: RentalDocumentRenderStatus.PENDING_RENDER };
    const prisma = { rentalDocument: { findUnique: jest.fn().mockResolvedValue(item),
      findMany: jest.fn().mockResolvedValue([{ id }]) } };
    const service = new RentalDocumentService(prisma as any,
      { execute: jest.fn().mockResolvedValue({ id }) } as any, new MemoryDocumentStorage());
    expect((await service.verify(id, id, 'ADMIN')).snapshotVerified).toBe(false);
  });

  it('retains the complete chain through settlement, case closure and legal hold', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    const settled = new Date('2026-01-01T00:00:00Z');
    const base = { now, settlementAt: settled, relatedCases: [{ closedAt: settled }],
      relatedDocumentsReady: true, legalHoldUntil: null };
    expect(evaluateDocumentRetention({ ...base, relatedCases: [{ closedAt: null }] }).eligible).toBe(false);
    expect(evaluateDocumentRetention({ ...base, legalHoldUntil: new Date('2027-01-01') }).eligible).toBe(false);
    expect(evaluateDocumentRetention(base).eligible).toBe(true);
  });

  it('reuses identical upload after a crash and marks the existing document READY', async () => {
    const storage = new MemoryDocumentStorage();
    const item = { ...doc(), renderStatus: RentalDocumentRenderStatus.PENDING_RENDER,
      renderAttemptCount: 2 };
    const bytes = Buffer.from('%PDF-1.7 deterministic');
    await storage.put(item.pdfStorageKey, bytes); // previous worker uploaded before DB update
    const tx = { $queryRaw: jest.fn(), rentalDocument: {
      findUnique: jest.fn().mockResolvedValue(item), update: jest.fn() },
      rentalOutboxEvent: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() } };
    const prisma = { rentalDocument: { findUnique: jest.fn().mockResolvedValue(item) },
      $transaction: jest.fn((work: (tx: any) => Promise<any>) => work(tx)) };
    const worker = new RentalDocumentRenderWorker(prisma as any,
      { render: jest.fn().mockResolvedValue(bytes) }, storage);
    const lease = new Date('2026-10-20T10:00:00Z');
    await (worker as any).process({ id, aggregate_id: id, published_at: lease });
    expect(tx.rentalDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ renderStatus: RentalDocumentRenderStatus.READY,
        pdfHash: pdfDigest(bytes) }) }));
    expect(tx.rentalOutboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ publishedAt: lease, status: 'PUBLISHED' }),
      data: expect.objectContaining({ status: 'PROCESSED' }) }));
  });

  it('does not publish PDF metadata after its lease is fenced out', async () => {
    const storage = new MemoryDocumentStorage();
    const item = { ...doc(), renderStatus: RentalDocumentRenderStatus.PENDING_RENDER,
      renderAttemptCount: 2 };
    const tx = { rentalOutboxEvent: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      rentalDocument: { update: jest.fn() }, $queryRaw: jest.fn() };
    const prisma = { rentalDocument: { findUnique: jest.fn().mockResolvedValue(item) },
      $transaction: jest.fn((work: (tx: any) => Promise<any>) => work(tx)) };
    const worker = new RentalDocumentRenderWorker(prisma as any,
      { render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7 deterministic')) }, storage);
    await (worker as any).process({ id, aggregate_id: id, published_at: new Date() });
    expect(tx.rentalOutboxEvent.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.rentalDocument.update).not.toHaveBeenCalled();
    expect(worker.metrics.processed).toBe(0);
  });

  const localFont = process.env.RENTAL_PDF_FONT_PATH || 'C:/Windows/Fonts/arial.ttf';
  (existsSync(localFont) ? it : it.skip)('renders Unicode Vietnamese from a configured local font', async () => {
    const previous = process.env.RENTAL_PDF_FONT_PATH;
    process.env.RENTAL_PDF_FONT_PATH = localFont;
    try {
      const longSnapshot = { ...snapshot, recipient: { displayName: 'Nguyễn Văn An' },
        units: Array.from({ length: 45 }, (_, i) => ({ assetCode: `BAL-${i + 1}`,
          condition: 'GOOD', accessories: ['Dây đeo'], evidenceIds: [`evidence-${i}`] })) };
      const bytes = await new RentalPdfRenderer().render({ ...doc(),
        snapshotJson: longSnapshot, snapshotHash: snapshotHash(longSnapshot), pdfHash: null } as any);
      expect(bytes.subarray(0, 8).toString()).toBe('%PDF-1.7');
      expect(bytes.toString('latin1')).toContain('/ToUnicode');
      expect(bytes.toString('latin1')).toMatch(/\/Count [2-9]/);
      expect(bytes.toString('latin1')).toContain('%%EOF');
    } finally {
      if (previous === undefined) delete process.env.RENTAL_PDF_FONT_PATH;
      else process.env.RENTAL_PDF_FONT_PATH = previous;
    }
  });

  (existsSync(localFont) ? it : it.skip).each([1, 10, 45])(
    'keeps every asset, condition, accessory and evidence group on one PDF page (%i units)', async count => {
      const previous = process.env.RENTAL_PDF_FONT_PATH;
      process.env.RENTAL_PDF_FONT_PATH = localFont;
      try {
        const units = Array.from({ length: count }, (_, i) => {
          const n = String(i + 1).padStart(3, '0');
          return { assetCode: `BAL-${n}`, condition: `GOOD-${n}`,
            accessories: [`Dây đeo và túi bảo quản tiếng Việt ${n}`], evidenceIds: [`EV-${n}`] };
        });
        const value = { ...snapshot, units };
        const bytes = await new RentalPdfRenderer().render({ ...doc(),
          snapshotJson: value, snapshotHash: snapshotHash(value) } as any);
        const pages = pdfPageText(bytes);
        expect(pages.length).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
          const n = String(i + 1).padStart(3, '0');
          const page = pages.findIndex(text => text.includes(`BAL-${n}`));
          expect(page).toBeGreaterThanOrEqual(0);
          expect(pages[page]).toContain(`GOOD-${n}`);
          expect(pages[page]).toContain(`EV-${n}`);
          expect(pages[page]).toContain(`tiếng Việt ${n}`);
        }
      } finally {
        if (previous === undefined) delete process.env.RENTAL_PDF_FONT_PATH;
        else process.env.RENTAL_PDF_FONT_PATH = previous;
      }
    });

  (existsSync(localFont) ? it : it.skip).each([1, 10, 45])(
    'keeps a received asset and its observations together on one PDF page (%i units)', async count => {
      const previous = process.env.RENTAL_PDF_FONT_PATH;
      process.env.RENTAL_PDF_FONT_PATH = localFont;
      try {
        const receivedUnits = Array.from({ length: count }, (_, i) => {
          const n = String(i + 1).padStart(3, '0');
          return { assetCode: `RET-${n}`, condition: `SCRATCH-${n}`,
            outcome: `RECEIVED-${n}`, accessories: [`Phụ kiện tiếng Việt ${n}`],
            evidenceIds: [`PHOTO-${n}`], notes: `Ghi chú ${n}` };
        });
        const value = { kind: 'RETURN_RECEIPT', returnSessionId: id, receivedUnits };
        const bytes = await new RentalPdfRenderer().render({ ...doc(),
          documentType: RentalDocumentType.RETURN_RECEIPT,
          snapshotJson: value, snapshotHash: snapshotHash(value) } as any);
        const pages = pdfPageText(bytes);
        for (let i = 0; i < count; i++) {
          const n = String(i + 1).padStart(3, '0');
          const page = pages.findIndex(text => text.includes(`RET-${n}`));
          expect(page).toBeGreaterThanOrEqual(0);
          for (const marker of [`SCRATCH-${n}`, `RECEIVED-${n}`, `PHOTO-${n}`,
            `Phụ kiện tiếng Việt ${n}`, `Ghi chú ${n}`]) expect(pages[page]).toContain(marker);
        }
      } finally {
        if (previous === undefined) delete process.env.RENTAL_PDF_FONT_PATH;
        else process.env.RENTAL_PDF_FONT_PATH = previous;
      }
    });
});
