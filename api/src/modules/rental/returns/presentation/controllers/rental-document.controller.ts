import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { GetRentalDocumentUseCase } from '../../application/use-cases/get-rental-document.use-case';
import { RentalDocumentIdParamSchema, type RentalDocumentIdParamDto } from '../dtos/rental-return.dto';

@ApiTags('Rental Documents')
@ApiBearerAuth('bearer')
@Controller('rental-documents')
@Auth([AuthType.Bearer])
export class RentalDocumentController {
  constructor(private readonly getRentalDocumentUseCase: GetRentalDocumentUseCase) {}

  @Get(':documentId')
  @Roles(UserRole.USER, UserRole.LEADER, UserRole.STAFF_DELIVERY, UserRole.STAFF_INVENTORY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'RB-API-1002 — Xem chi tiết chứng từ (Rental Document direct URL)',
    description: 'Truy vấn chi tiết chứng từ và snapshot bất biến theo documentId.',
  })
  @ApiParam({ name: 'documentId', type: String, format: 'uuid', description: 'UUID chứng từ' })
  @ApiResponse({ status: 200, description: 'Chi tiết chứng từ' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập chứng từ này' })
  @ApiResponse({ status: 404, description: 'Chứng từ không tồn tại' })
  async getDocument(
    @Param(new ZodValidationPipe(RentalDocumentIdParamSchema)) params: RentalDocumentIdParamDto,
    @ActiveUser('id') actorUserId: string,
    @ActiveUser('role') actorRole: string,
  ) {
    return this.getRentalDocumentUseCase.execute({ documentId: params.documentId, actorUserId, actorRole });
  }
}
