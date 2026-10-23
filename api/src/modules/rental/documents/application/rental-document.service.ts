import { Inject, Injectable } from '@nestjs/common';
import { Prisma, RentalDocumentRenderStatus, RentalDocumentType } from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import { AppError } from 'src/shared/errors';
import { RENTAL_RETURN_ERROR_CODES as RR } from 'src/shared/errors/codes/rental-return.error-codes';
import { RENTAL_DOCUMENT_ERROR_CODES as RD } from 'src/shared/errors/codes/rental-document.error-codes';
import { GetRentalDocumentUseCase } from '../../returns/application/use-cases/get-rental-document.use-case';
import { issueCorrectionTx, snapshotHash } from './rental-document-events';
import { DOCUMENT_STORAGE_PORT, pdfDigest } from '../infrastructure/document-storage.port';
import type { DocumentStoragePort } from '../infrastructure/document-storage.port';
import type { CorrectionBody, RetryRenderBody } from '../presentation/rental-document-admin.dto';

const hash = (value: unknown) => snapshotHash(value);
@Injectable()
export class RentalDocumentService {
  constructor(private readonly prisma: PrismaService,
    private readonly getDocument: GetRentalDocumentUseCase,
    @Inject(DOCUMENT_STORAGE_PORT) private readonly storage: DocumentStoragePort) {}

  private async authorized(documentId: string, actorUserId: string, actorRole: string) {
    await this.getDocument.execute({ documentId, actorUserId, actorRole });
    const doc = await this.prisma.rentalDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw AppError.fromCode(RR.DOCUMENT_NOT_FOUND);
    return doc;
  }

  async download(documentId: string, actorUserId: string, actorRole: string) {
    const doc = await this.authorized(documentId, actorUserId, actorRole);
    if (hash(doc.snapshotJson) !== doc.snapshotHash) throw AppError.fromCode(RD.INTEGRITY_FAILED);
    if (doc.renderStatus !== RentalDocumentRenderStatus.READY || !doc.pdfStorageKey || !doc.pdfHash)
      throw AppError.fromCode(RR.DOCUMENT_NOT_READY);
    const bytes = await this.storage.read(doc.pdfStorageKey);
    if (pdfDigest(bytes) !== doc.pdfHash) throw AppError.fromCode(RD.INTEGRITY_FAILED);
    const downloadUrl = await this.storage.signedGet(doc.pdfStorageKey, 600);
    const expiresAt = new Date(Date.now() + 600_000).toISOString();
    await this.prisma.rentalDocumentAccessLog.create({ data: { documentId, actorUserId, action: 'DOWNLOAD' } });
    return { downloadUrl, expiresAt, fileName: `${doc.documentNumber}.pdf`,
      contentType: 'application/pdf', sha256: doc.pdfHash };
  }

  async verify(documentId: string, actorUserId: string, actorRole: string) {
    const doc = await this.authorized(documentId, actorUserId, actorRole);
    const snapshotVerified = hash(doc.snapshotJson) === doc.snapshotHash;
    let pdfVerified: boolean | null = null;
    if (doc.renderStatus === RentalDocumentRenderStatus.READY && doc.pdfStorageKey && doc.pdfHash) {
      const bytes = await this.storage.read(doc.pdfStorageKey);
      pdfVerified = pdfDigest(bytes) === doc.pdfHash;
    }
    const related = await this.prisma.rentalDocument.findMany({
      where: { OR: [{ rootDocumentId: doc.rootDocumentId ?? doc.id }, { id: doc.rootDocumentId ?? doc.id }] },
      select: { id: true }, orderBy: { issuedAt: 'asc' },
    });
    return { documentNo: doc.documentNumber, issuedAt: doc.issuedAt.toISOString(),
      sourceVersion: doc.sourceVersion, snapshotHash: doc.snapshotHash,
      pdfHash: doc.pdfHash ?? null, relatedDocumentIds: related.map(x => x.id),
      snapshotVerified, pdfVerified, verified: snapshotVerified && pdfVerified === true,
      verificationStatus: !snapshotVerified || pdfVerified === false ? 'FAILED' :
        pdfVerified === true ? 'VERIFIED' : 'SNAPSHOT_ONLY' };
  }

  private async idempotent<T>(scope: string, actorId: string, key: string, request: unknown,
    work: (tx: Prisma.TransactionClient) => Promise<T>, responseStatus = 201): Promise<T> {
    if (!key?.trim() || key.length > 200) throw AppError.fromCode(RR.IDEMPOTENCY_KEY_REQUIRED);
    const requestHash = hash(request);
    try { return await this.prisma.$transaction(async tx => {
      const existing = await tx.idempotencyRecord.findUnique({ where: { scope_userId_idempotencyKey:
        { scope, userId: actorId, idempotencyKey: key } } });
      if (existing) {
        if (existing.requestHash !== requestHash) throw AppError.fromCode(RR.IDEMPOTENCY_KEY_REUSED);
        if (existing.responseBody) return existing.responseBody as T;
        throw AppError.fromCode(RR.OPERATION_CONFLICT);
      }
      await tx.idempotencyRecord.create({ data: { scope, userId: actorId, idempotencyKey: key, requestHash } });
      const response = await work(tx);
      await tx.idempotencyRecord.update({ where: { scope_userId_idempotencyKey:
        { scope, userId: actorId, idempotencyKey: key } },
        data: { responseStatus, responseBody: response as Prisma.InputJsonValue, completedAt: new Date() } });
      return response;
    }); } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        // A competing transaction may have inserted this key while ours waited on
        // the unique constraint. Read in a fresh transaction after its commit.
        for (let attempt = 0; attempt < 4; attempt++) {
          const winner = await this.prisma.idempotencyRecord.findUnique({
            where: { scope_userId_idempotencyKey: { scope, userId: actorId, idempotencyKey: key } },
          });
          if (winner) {
            if (winner.requestHash !== requestHash) throw AppError.fromCode(RR.IDEMPOTENCY_KEY_REUSED);
            if (winner.responseBody) return winner.responseBody as T;
          }
          if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt));
        }
        throw AppError.fromCode(RR.OPERATION_CONFLICT);
      }
      throw error;
    }
  }

  async correct(documentId: string, actorId: string, key: string, body: CorrectionBody) {
    return this.idempotent('RB-API-1006:correction', actorId, key, { documentId, ...body }, async tx => {
      await tx.$queryRaw`SELECT id FROM rental_documents WHERE id = ${documentId}::uuid FOR UPDATE`;
      const source = await tx.rentalDocument.findUnique({ where: { id: documentId } });
      if (!source) throw AppError.fromCode(RR.DOCUMENT_NOT_FOUND);
      if (source.documentType === RentalDocumentType.CORRECTION_NOTICE || source.version !== body.expectedVersion)
        throw AppError.fromCode(RR.VERSION_CONFLICT);
      const snapshot = source.snapshotJson as Record<string, unknown>;
      if (hash(snapshot) !== source.snapshotHash) throw AppError.fromCode(RD.INTEGRITY_FAILED);
      const fields = new Set<string>();
      for (const correction of body.corrections) {
        if (fields.has(correction.field) || !(correction.field in snapshot) ||
            snapshot[correction.field] !== correction.oldValue || correction.oldValue === correction.newValue)
          throw AppError.fromCode(RD.CORRECTION_NOT_ALLOWED);
        fields.add(correction.field);
      }
      const changed = await tx.rentalDocument.updateMany({ where: { id: documentId, version: body.expectedVersion },
        data: { version: { increment: 1 } } });
      if (changed.count !== 1) throw AppError.fromCode(RR.VERSION_CONFLICT);
      const correction = await issueCorrectionTx(tx, documentId, actorId, body.reason, body.corrections, new Date(), key);
      await tx.auditLog.create({ data: { userId: actorId, action: 'RENTAL_DOCUMENT_CORRECTED',
        entityType: 'RentalDocument', entityId: correction.id,
        newValues: { originalDocumentId: documentId, reason: body.reason,
          correctionHash: correction.snapshotHash } } });
      return { correctionDocumentId: correction.id, originalDocumentId: documentId,
        renderStatus: correction.renderStatus };
    });
  }

  async retry(documentId: string, actorId: string, key: string, body: RetryRenderBody) {
    return this.idempotent('RB-API-1007:retry-render', actorId, key, { documentId, ...body }, async tx => {
      await tx.$queryRaw`SELECT id FROM rental_outbox_events
        WHERE deduplication_key = ${`rental-document-render:${documentId}`} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM rental_documents WHERE id = ${documentId}::uuid FOR UPDATE`;
      const doc = await tx.rentalDocument.findUnique({ where: { id: documentId } });
      if (!doc) throw AppError.fromCode(RR.DOCUMENT_NOT_FOUND);
      if (doc.renderStatus !== RentalDocumentRenderStatus.RENDER_FAILED) throw AppError.fromCode(RD.CORRECTION_NOT_ALLOWED);
      if (doc.renderAttemptCount >= 5) throw AppError.fromCode(RD.RENDER_RETRY_EXHAUSTED);
      await tx.rentalDocument.update({ where: { id: documentId },
        data: { renderStatus: RentalDocumentRenderStatus.PENDING_RENDER, renderError: null } });
      await tx.rentalOutboxEvent.update({ where: { deduplicationKey: `rental-document-render:${documentId}` },
        data: { status: 'PENDING', publishedAt: null, lastError: null } });
      await tx.auditLog.create({ data: { userId: actorId, action: 'RENTAL_DOCUMENT_RENDER_RETRY',
        entityType: 'RentalDocument', entityId: documentId,
        newValues: { reason: body.reason, attemptCount: doc.renderAttemptCount } } });
      return { documentId, renderStatus: RentalDocumentRenderStatus.PENDING_RENDER,
        attemptCount: doc.renderAttemptCount };
    }, 202);
  }
}
