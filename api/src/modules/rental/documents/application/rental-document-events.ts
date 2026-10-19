/** Area B v1.2.2 — append-only documents emitted with the source BUSINESS transaction.
 * Rendering is asynchronous; PDF failure does not revert a valid handover/extension.
 * No public storage URL, secret pickup code or customer signature is recorded here.
 */
import { createHash } from 'node:crypto';
import { Prisma, RentalDocumentType } from '@prisma/client';
import { AppError } from '../../../../shared/errors';
import { RENTAL_RETURN_ERROR_CODES as RR } from '../../../../shared/errors/codes/rental-return.error-codes';

type Tx = Prisma.TransactionClient;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.entries(value as Record<string, unknown>)
      .filter(([,v]) => v !== undefined).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([k,v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  }
  return JSON.stringify(value ?? null);
}
export function snapshotHash(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }

async function insertEventDocument(tx: Tx, input: {
  orderId: string; documentType: RentalDocumentType; sourceRef: string; issuedAt: Date;
  snapshot: Record<string, unknown>; rootDocumentId?: string; previousDocumentId?: string;
  appendixNo?: number; policyVersion?: string; templateVersion?: string;
}) {
  const existing = await tx.rentalDocument.findUnique({
    where: { documentType_sourceRef: { documentType: input.documentType, sourceRef: input.sourceRef } },
  });
  if (existing) return existing;
  const document = await tx.rentalDocument.create({ data: {
    orderId: input.orderId, documentType: input.documentType, sourceRef: input.sourceRef,
    documentNumber: `TG-${input.documentType}-${createHash('sha256').update(input.sourceRef).digest('hex').slice(0,32)}`,
    rootDocumentId: input.rootDocumentId ?? null,
    previousDocumentId: input.previousDocumentId ?? null,
    appendixNo: input.appendixNo ?? null,
    snapshotJson: JSON.parse(canonical(input.snapshot)) as Prisma.InputJsonValue,
    snapshotHash: snapshotHash(input.snapshot),
    policyVersion: input.policyVersion ?? '1.5.2',
    templateVersion: input.templateVersion ?? '1.3.2',
    issuedAt: input.issuedAt,
  }});
  await tx.rentalOutboxEvent.upsert({
    where: { deduplicationKey: `rental-document-render:${document.id}` }, update: {},
    create: { deduplicationKey: `rental-document-render:${document.id}`,
      eventType: 'RENTAL_DOCUMENT_RENDER_REQUESTED', aggregateType: 'RentalDocument', aggregateId: document.id,
      payload: { documentId: document.id, orderId: input.orderId, type: input.documentType, documentNumber: document.documentNumber } },
  });
  return document;
}

export async function issueHandoverDocumentTx(tx: Tx, orderId: string, handoverId: string, issuedAt: Date) {
  const existing = await tx.rentalDocument.findUnique({where: {documentType_sourceRef: {documentType: RentalDocumentType.HANDOVER, sourceRef: handoverId}}});
  if (existing) return existing;
  const [order, handover, packageItems, conditions] = await Promise.all([
    tx.rentalOrder.findUnique({where:{id:orderId},include:{rentalOrderLinesViaOrderId:true}}),
    tx.rentalHandover.findUnique({where:{id:handoverId}}),
    tx.packageItem.findMany({where:{package:{orderId}},include:{equipmentUnit:{select:{assetCode:true,productId:true}}}}),
    tx.conditionSnapshot.findMany({where:{orderId,snapshotStage:'PRE_HANDOVER'}}),
  ]);
  if (!order || !handover || order.id!==handover.orderId || !packageItems.length) throw new Error('HANDOVER_DOCUMENT_SOURCE_INCOMPLETE');
  const conditionMap = new Map(conditions.map(x=>[x.assignmentId,x]));
  if (packageItems.some(x=>!conditionMap.has(x.assignmentId))) throw new Error('HANDOVER_DOCUMENT_CONDITION_MISSING');
  const policyVersion = (order.policySnapshot as any)?.policyVersion ?? '1.5.2';
  return insertEventDocument(tx,{orderId,documentType:RentalDocumentType.HANDOVER,sourceRef:handoverId,issuedAt,
    snapshot:{kind:'HANDOVER',orderId,tripId:order.tripId,bookingProvenanceId:order.bookingId,
      handoverId,packageId:handover.packageId,recipient:handover.recipientSnapshot,
      handedOverAt:handover.handedOverAt.toISOString(),staffId:handover.staffId,
      recipientNotes:handover.recipientNotes,reportedIssues:handover.reportedIssues,
      rentalStartAt:order.rentalStartAt.toISOString(),rentalEndAt:order.rentalEndAt.toISOString(),
      rentalFee:order.rentalFee.toString(),totalDeposit:order.totalDeposit.toString(),currency:order.currency,
      pickupPointId:order.pickupPointId,returnPointId:order.returnPointId,
      units:packageItems.map(x=>{const c=conditionMap.get(x.assignmentId)!;return {unitId:x.equipmentUnitId,assetCode:x.equipmentUnit.assetCode,productId:x.equipmentUnit.productId,
        condition:c.condition,accessories:c.accessories,evidenceIds:c.evidenceIds,conditionSnapshotId:c.id};}),
      verificationMethod:'STAFF_DELIVERY_PICKUP_CODE',signatureMethod:'NONE',
      policySnapshot:order.policySnapshot},policyVersion});
}

export async function issueExtensionAppendixTx(tx: Tx, extensionId: string, issuedAt: Date, preloadedExtension?: any) {
  const extension = preloadedExtension ?? await tx.rentalExtensionRequest.findUnique({
    where: { id: extensionId },
    include: { order: true },
  });
  if (!extension || extension.status !== 'APPLIED' || !extension.appliedAt) throw new Error('DOCUMENT_EXTENSION_NOT_APPLIED');
  if (!extension.acceptedAt || !extension.acceptedByUserId || !extension.termsHash) throw new Error('EXTENSION_ACCEPTANCE_MISSING');
  const root = await tx.rentalDocument.findFirst({ where: { orderId: extension.orderId, documentType: RentalDocumentType.HANDOVER } });
  if (!root) throw new Error('HANDOVER_DOCUMENT_REQUIRED_FOR_APPENDIX');
  const existing = await tx.rentalDocument.findUnique({ where: { documentType_sourceRef: { documentType: RentalDocumentType.EXTENSION_APPENDIX, sourceRef: extensionId } } });
  if (existing) return existing;
  const n = await tx.rentalDocument.count({ where: { orderId: extension.orderId, documentType: RentalDocumentType.EXTENSION_APPENDIX } }) + 1;
  if (n > 2) throw new Error('EXTENSION_DOCUMENT_LIMIT');
  const previous = await tx.rentalDocument.findFirst({ where: { orderId: extension.orderId, documentType: RentalDocumentType.EXTENSION_APPENDIX }, orderBy: { issuedAt: 'desc' } });
  
  const order = extension.order ?? await tx.rentalOrder.findUnique({ where: { id: extension.orderId } });
  const policyVersion = (order?.policySnapshot)?.policyVersion ?? '1.5.2';

  const oldEffectiveDue = extension.oldEffectiveOperationalDueAt
    ? (extension.oldEffectiveOperationalDueAt instanceof Date ? extension.oldEffectiveOperationalDueAt.toISOString() : String(extension.oldEffectiveOperationalDueAt))
    : (order?.operationalReturnDueAt && order.operationalReturnDueAt > (extension.previousRentalEndAt ?? order.rentalEndAt)
        ? (order.operationalReturnDueAt instanceof Date ? order.operationalReturnDueAt.toISOString() : String(order.operationalReturnDueAt))
        : (extension.previousRentalEndAt instanceof Date ? extension.previousRentalEndAt.toISOString() : String(extension.previousRentalEndAt)));

  const newEffectiveDue = extension.newEffectiveOperationalDueAt
    ? (extension.newEffectiveOperationalDueAt instanceof Date ? extension.newEffectiveOperationalDueAt.toISOString() : String(extension.newEffectiveOperationalDueAt))
    : (order?.operationalReturnDueAt
        ? (order.operationalReturnDueAt instanceof Date ? order.operationalReturnDueAt.toISOString() : String(order.operationalReturnDueAt))
        : (extension.requestedRentalEndAt instanceof Date ? extension.requestedRentalEndAt.toISOString() : String(extension.requestedRentalEndAt)));

  const occupiedUntilStr = extension.occupiedUntil
    ? (extension.occupiedUntil instanceof Date ? extension.occupiedUntil.toISOString() : String(extension.occupiedUntil))
    : (order?.occupiedEndAt
        ? (order.occupiedEndAt instanceof Date ? order.occupiedEndAt.toISOString() : String(order.occupiedEndAt))
        : (extension.requestedOccupiedUntil instanceof Date ? extension.requestedOccupiedUntil.toISOString() : String(extension.requestedOccupiedUntil)));

  const quoteId = extension.quoteId ?? (extension).quoteId ?? extensionId;

  const snap = {
    kind: 'EXTENSION_APPENDIX',
    documentNo: `TG-EXTENSION_APPENDIX-${createHash('sha256').update(extensionId).digest('hex').slice(0, 32)}`,
    appendixNo: n,
    rootDocumentId: root.id,
    previousAppendixId: previous?.id ?? null,
    orderId: extension.orderId,
    extensionId,
    acceptance: {
      quoteId,
      acceptedByUserId: extension.acceptedByUserId,
      acceptedAt: extension.acceptedAt instanceof Date ? extension.acceptedAt.toISOString() : String(extension.acceptedAt),
      acceptedTermsVersion: extension.acceptedTermsVersion,
      termsHash: extension.termsHash,
    },
    oldRentalEndAt: extension.previousRentalEndAt instanceof Date ? extension.previousRentalEndAt.toISOString() : String(extension.previousRentalEndAt),
    newRentalEndAt: extension.requestedRentalEndAt instanceof Date ? extension.requestedRentalEndAt.toISOString() : String(extension.requestedRentalEndAt),
    oldEffectiveOperationalDueAt: oldEffectiveDue,
    newEffectiveOperationalDueAt: newEffectiveDue,
    occupiedUntil: occupiedUntilStr,
    returnOption: extension.returnOptionSnapshot,
    additionalFee: extension.additionalFee.toString(),
    currency: extension.currency,
    sourcePaymentId: extension.paymentRef ?? null,
    appliedAt: extension.appliedAt instanceof Date ? extension.appliedAt.toISOString() : String(extension.appliedAt),
    policyVersion,
    templateVersion: '1.0.0',
    originalHandoverUnchanged: true,
  };
  return insertEventDocument(tx, {
    orderId: extension.orderId,
    documentType: RentalDocumentType.EXTENSION_APPENDIX,
    sourceRef: extensionId,
    issuedAt,
    rootDocumentId: root.id,
    previousDocumentId: previous?.id ?? root.id,
    appendixNo: n,
    policyVersion,
    snapshot: snap,
  });
}

export async function issueScheduleNoticeTx(tx:Tx,input:{orderId:string;eventId:string;newOperationalDueAt:Date;at:Date;oldOperationalDueAt?:Date|null}){
  const root=await tx.rentalDocument.findFirst({where:{orderId:input.orderId,documentType:RentalDocumentType.HANDOVER}});
  if(!root) return null; // No physical handover => no documentary schedule notice.
  const order=await tx.rentalOrder.findUnique({where:{id:input.orderId}});
  if(!order) throw new Error('RENTAL_NOT_FOUND');
  const sourceRef=`${input.eventId}:${order.id}`;
  return insertEventDocument(tx,{orderId:order.id,documentType:RentalDocumentType.SCHEDULE_NOTICE,sourceRef,issuedAt:input.at,
    rootDocumentId:root.id,snapshot:{kind:'SCHEDULE_NOTICE',orderId:order.id,tripId:order.tripId,eventId:input.eventId,
      contractualRentalEndAt:order.rentalEndAt.toISOString(),previousOperationalReturnDueAt:input.oldOperationalDueAt?.toISOString()??null,
      operationalReturnDueAt:input.newOperationalDueAt.toISOString(),feeChanged:false,originalDocumentUnchanged:true}});
}

export async function issueReturnReceiptTx(
  tx: Tx,
  sessionId: string,
  at: Date,
  options?: { failureEvidenceId?: string | null; evidenceIds?: string[] | null; userRemarks?: string | null },
) {
  const session = await tx.rentalReturnSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== 'FINALIZED' || !session.finalizedAt) {
    throw AppError.fromCode(RR.INVALID_RETURN_STATE, { details: { reason: 'RETURN_SESSION_NOT_FINALIZED', sessionId } });
  }
  const root = await tx.rentalDocument.findFirst({
    where: { orderId: session.orderId, documentType: RentalDocumentType.HANDOVER },
  });
  if (!root) {
    throw AppError.fromCode(RR.HANDOVER_DOCUMENT_REQUIRED, { details: { orderId: session.orderId, sessionId } });
  }

  const existing = await tx.rentalDocument.findUnique({
    where: { documentType_sourceRef: { documentType: RentalDocumentType.RETURN_RECEIPT, sourceRef: sessionId } },
  });
  if (existing) return existing;

  const order = tx.rentalOrder?.findUnique
    ? await tx.rentalOrder.findUnique({
        where: { id: session.orderId },
        include: {
          rentalOrderLinesViaOrderId: {
            include: { rentalUnitAssignmentsViaOrderLineId: { include: { equipmentUnit: true } } },
          },
          deliveryTasksViaOrderId: true,
        },
      })
    : null;

  const allAssignments = (order?.rentalOrderLinesViaOrderId ?? [])
    .flatMap((line) => line.rentalUnitAssignmentsViaOrderLineId)
    .filter((a) => !['REPLACED', 'UNASSIGNED'].includes(a.status as any));

  const notReturnedUnitIdsAtSessionEnd = allAssignments
    .filter((a) => a.status !== 'RETURNED' && a.status !== 'CLOSED')
    .map((a) => a.equipmentUnitId);

  const rawReceived = Array.isArray(session.receivedUnits)
    ? (session.receivedUnits as any[]).filter((u: any) => !u.duplicate)
    : [];

  const failureEvidenceId = options?.failureEvidenceId ?? (session as any)?.failureEvidenceId ?? null;
  const evidenceIds = options?.evidenceIds ?? (failureEvidenceId ? [failureEvidenceId] : []);

  if (rawReceived.length === 0 && !failureEvidenceId && evidenceIds.length === 0) {
    throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
      details: { reason: 'ZERO_SCAN_REQUIRES_FAILURE_EVIDENCE', sessionId },
    });
  }

  const returnTask = order?.deliveryTasksViaOrderId.find(
    (t) => (t as any).taskType === 'RETURN',
  );
  const returnLocationRef =
    (returnTask as any)?.hubId ??
    (returnTask as any)?.toLocationId ??
    (returnTask as any)?.address ??
    (session as any)?.locationRef ??
    null;

  const orderPolicySnapshot = (order?.policySnapshot as Record<string, any>) ?? null;
  const policyVersion =
    orderPolicySnapshot?.policyVersion ??
    orderPolicySnapshot?.version ??
    '1.5.2';

  const enrichedUnits = rawReceived.map((u) => {
    const unitId = typeof u === 'string' ? u : u.unitId;
    const assignment = allAssignments.find((a) => a.equipmentUnitId === unitId);
    const assetCode = (typeof u === 'object' && u.assetCode) ? u.assetCode : (assignment?.equipmentUnit?.assetCode ?? unitId);
    const receivedAt = (typeof u === 'object' && u.receivedAt)
      ? u.receivedAt
      : (assignment?.returnedAt ? assignment.returnedAt.toISOString() : null);

    const condition = (typeof u === 'object' && (u.preliminaryCondition ?? u.condition))
      ? (u.preliminaryCondition ?? u.condition)
      : null;
    const outcome = (typeof u === 'object' && (u.preliminaryOutcome ?? u.outcome))
      ? (u.preliminaryOutcome ?? u.outcome)
      : null;
    const accessories = (typeof u === 'object' && Array.isArray(u.accessories))
      ? u.accessories
      : (typeof u === 'object' && Array.isArray(u.accessoryIssues))
        ? u.accessoryIssues
        : [];
    const evidenceIds = (typeof u === 'object' && Array.isArray(u.evidenceIds))
      ? u.evidenceIds
      : [];
    const notes = (typeof u === 'object' && u.notes) ? u.notes : null;

    return {
      unitId,
      assetCode,
      receivedAt,
      condition,
      outcome,
      accessories,
      evidenceIds,
      notes,
    };
  });

  const docNo = `TG-RETURN_RECEIPT-${createHash('sha256').update(sessionId).digest('hex').slice(0, 32)}`;

  return insertEventDocument(tx, {
    orderId: session.orderId,
    documentType: RentalDocumentType.RETURN_RECEIPT,
    sourceRef: sessionId,
    issuedAt: at,
    rootDocumentId: root.id,
    policyVersion,
    templateVersion: '1.3.2',
    snapshot: {
      kind: 'RETURN_RECEIPT',
      documentNo: docNo,
      rootDocumentId: root.id,
      orderId: session.orderId,
      returnSessionId: session.id,
      staffId: session.staffId,
      finalizedAt: session.finalizedAt.toISOString(),
      returnLocationRef,
      receivedUnits: enrichedUnits,
      notReturnedUnitIdsAtSessionEnd,
      remarks: session.remarks ?? null,
      userRemarks: options?.userRemarks ?? null,
      failureEvidenceId,
      evidenceIds,
      policyVersion,
      templateVersion: '1.3.2',
      outcomeNote: 'Outcome ISSUE remains preliminary; settlement is independent.',
      originalDocumentUnchanged: true,
    },
  });
}

export async function issueCorrectionTx(tx:Tx,sourceId:string,actorId:string,reason:string,correctedDisplayDetails:string,at:Date,idempotencyKey:string){
  const source=await tx.rentalDocument.findUnique({where:{id:sourceId}});
  if(!source) throw new Error('RENTAL_DOCUMENT_NOT_FOUND');
  const correctionSourceRef=`${sourceId}:${createHash('sha256').update(idempotencyKey).digest('hex').slice(0,32)}`;
  const proposedHash = snapshotHash({sourceId,actorId,reason,correctedDisplayDetails});
  const existing = await tx.rentalDocument.findUnique({where:{documentType_sourceRef:{
    documentType:RentalDocumentType.CORRECTION_NOTICE,sourceRef:correctionSourceRef}}});
  if (existing) {
    const saved = existing.snapshotJson as Record<string,unknown>;
    if(saved.requestHash!==proposedHash) throw new Error('IDEMPOTENCY_KEY_REUSED');
    return existing;
  }
  return insertEventDocument(tx,{orderId:source.orderId,documentType:RentalDocumentType.CORRECTION_NOTICE,sourceRef:correctionSourceRef,
    rootDocumentId:source.rootDocumentId??source.id,previousDocumentId:source.id,issuedAt:at,
    snapshot:{kind:'CORRECTION_NOTICE',sourceDocumentId:sourceId,sourceSnapshotHash:source.snapshotHash,
      actorId,reason,correctedDisplayDetails,requestHash:proposedHash,sourceRemainsImmutable:true}});
}
