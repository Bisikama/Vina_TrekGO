import { RentalEvidenceAccessService } from './infrastructure/integration/rental-evidence-access.service';
import { InternalRentalEvidenceAccessController } from './presentation/controllers/internal-rental-evidence-access.controller';
import { RentalOperationalEscalationScheduler } from './infrastructure/jobs/rental-operational-escalation.scheduler';
import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module';
import { RENTAL_RETURN_PORT } from './application/ports/rental-return.port';
import { ReturnScanUseCase } from './application/use-cases/return-scan.use-case';
import { ReturnInspectionUseCase } from './application/use-cases/return-inspection.use-case';
import { ReturnToInventoryLocationUseCase } from './application/use-cases/return-to-inventory-location.use-case';
import { ReceiveReturnUseCase } from './application/use-cases/receive-return.use-case';
import { FinalInspectionUseCase } from './application/use-cases/final-inspection.use-case';
import { CreateDepositSettlementUseCase } from './application/use-cases/create-deposit-settlement.use-case';
import { GetDepositUseCase } from './application/use-cases/get-deposit.use-case';
import { FinalizeReturnUseCase } from './application/use-cases/finalize-return.use-case';
import { CreateAssessmentReviewUseCase } from './application/use-cases/create-assessment-review.use-case';
import { ResolveRentalExceptionUseCase } from './application/use-cases/resolve-rental-exception.use-case';
import { MarkReturnedUnitReadyUseCase } from './application/use-cases/mark-returned-unit-ready.use-case';
import { ListRentalExceptionsUseCase } from './application/use-cases/list-rental-exceptions.use-case';
import { ListReturnsUseCase } from './application/use-cases/list-returns.use-case';
import { GetReturnUseCase } from './application/use-cases/get-return.use-case';
import { GetRentalExceptionUseCase } from './application/use-cases/get-rental-exception.use-case';
import { GetRentalAssessmentUseCase } from './application/use-cases/get-rental-assessment.use-case';
import { ProcessRentalRefundEventUseCase } from './application/use-cases/process-rental-refund-event.use-case';
import { FinalizeReturnReceiptUseCase } from './application/use-cases/finalize-return-receipt.use-case';
import { ListRentalDocumentsUseCase } from './application/use-cases/list-rental-documents.use-case';
import { GetRentalDocumentUseCase } from './application/use-cases/get-rental-document.use-case';
import { PrismaRentalReturnAdapter } from './infrastructure/adapters/prisma-rental-return.adapter';
import { RentalReturnController } from './presentation/controllers/rental-return.controller';
import { DeliveryReturnController } from './presentation/controllers/delivery-return.controller';
import { StaffReturnController } from './presentation/controllers/staff-return.controller';
import { StaffDamageAssessmentRuleController } from './presentation/controllers/staff-damage-assessment-rule.controller';
import { RentalExceptionController } from './presentation/controllers/rental-exception.controller';
import { RentalReturnAdminController } from './presentation/controllers/rental-return-admin.controller';
import { RentalDocumentController } from './presentation/controllers/rental-document.controller';
import { RentalDocumentAdminController } from '../documents/presentation/rental-document-admin.controller';
import { RentalDocumentService } from '../documents/application/rental-document.service';
import { DOCUMENT_STORAGE_PORT, SupabaseDocumentStorage } from '../documents/infrastructure/document-storage.port';
import { RentalPdfRenderer } from '../documents/infrastructure/rental-pdf.renderer';
import { RentalDocumentRenderWorker } from '../documents/infrastructure/rental-document-render.worker';

@Module({
  imports: [SharedModule],
  controllers: [
    RentalReturnController,
    DeliveryReturnController,
    StaffReturnController,
    StaffDamageAssessmentRuleController,
    RentalExceptionController,
    RentalReturnAdminController,
    InternalRentalEvidenceAccessController,
    RentalDocumentController,
    RentalDocumentAdminController,
  ],
  providers: [
    RentalOperationalEscalationScheduler,
    RentalEvidenceAccessService,
    ReturnScanUseCase,
    ReturnInspectionUseCase,
    ReturnToInventoryLocationUseCase,
    ReceiveReturnUseCase,
    FinalInspectionUseCase,
    CreateDepositSettlementUseCase,
    GetDepositUseCase,
    FinalizeReturnUseCase,
    CreateAssessmentReviewUseCase,
    ResolveRentalExceptionUseCase,
    MarkReturnedUnitReadyUseCase,
    ListRentalExceptionsUseCase,
    ListReturnsUseCase,
    GetReturnUseCase,
    GetRentalExceptionUseCase,
    GetRentalAssessmentUseCase,
    ProcessRentalRefundEventUseCase,
    FinalizeReturnReceiptUseCase,
    ListRentalDocumentsUseCase,
    GetRentalDocumentUseCase,
    RentalDocumentService,
    RentalPdfRenderer,
    RentalDocumentRenderWorker,
    { provide: DOCUMENT_STORAGE_PORT, useClass: SupabaseDocumentStorage },
    { provide: RENTAL_RETURN_PORT, useClass: PrismaRentalReturnAdapter },
  ],
  exports: [ProcessRentalRefundEventUseCase, FinalizeReturnReceiptUseCase],
})
export class RentalReturnsModule {}
